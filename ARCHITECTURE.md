# GitNexus Architecture

This document explains the architecture of GitNexus and how its components work together.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitNexus System                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐                    ┌────────────────────┐  │
│  │   CLI/MCP Server   │                    │      Web UI        │  │
│  │   (Node.js)        │◄───────────────────┤   (React + WASM)   │  │
│  │                    │   Bridge Mode      │                    │  │
│  │  - Index repos     │                    │  - Visual graph    │  │
│  │  - MCP server      │                    │  - AI chat         │  │
│  │  - HTTP API        │                    │  - In-browser DB   │  │
│  └────────┬───────────┘                    └────────────────────┘  │
│           │                                                          │
│           ▼                                                          │
│  ┌────────────────────┐                                             │
│  │  Knowledge Graph   │                                             │
│  │   (KuzuDB)         │                                             │
│  │                    │                                             │
│  │  - Symbols         │                                             │
│  │  - Relationships   │                                             │
│  │  - Processes       │                                             │
│  │  - Embeddings      │                                             │
│  └────────────────────┘                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Indexing Pipeline

GitNexus builds the knowledge graph through a multi-phase pipeline:

```
┌──────────────┐
│ Source Code  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 1: Structure                         │
│  - Walk file tree                                            │
│  - Map folder/file relationships                             │
│  - Filter by .gitignore                                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 2: Parsing                           │
│  - Tree-sitter AST parsing                                   │
│  - Extract functions, classes, methods, interfaces           │
│  - Capture signatures, parameters, return types              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 3: Resolution                        │
│  - Resolve imports across files                              │
│  - Resolve function calls                                    │
│  - Build call graph                                          │
│  - Assign confidence scores                                  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 4: Clustering                        │
│  - Community detection (Louvain algorithm)                   │
│  - Group related symbols                                     │
│  - Calculate cohesion scores                                 │
│  - Generate heuristic labels                                 │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 5: Process Detection                 │
│  - Identify entry points                                     │
│  - Trace execution flows                                     │
│  - Build process graphs                                      │
│  - Classify process types                                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Phase 6: Search Indexing                   │
│  - Generate embeddings (transformers.js)                     │
│  - Build BM25 index                                          │
│  - Create vector index                                       │
│  - Setup hybrid search (RRF)                                 │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Knowledge Graph (KuzuDB)                     │
│                                                               │
│  Nodes: File, Function, Class, Interface, Method,            │
│         Community, Process                                    │
│                                                               │
│  Edges: CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES,        │
│         MEMBER_OF, STEP_IN_PROCESS                           │
└───────────────────────────────────────────────────────────────┘
```

---

## Knowledge Graph Schema

### Node Types

```
File
├── path: string
├── name: string
├── extension: string
└── size: number

Function
├── name: string
├── filePath: string
├── startLine: number
├── endLine: number
├── signature: string
└── embedding: float[]

Class
├── name: string
├── filePath: string
├── startLine: number
├── endLine: number
└── embedding: float[]

Interface
├── name: string
├── filePath: string
├── startLine: number
└── endLine: number

Method
├── name: string
├── className: string
├── filePath: string
├── startLine: number
└── endLine: number

Community (Cluster)
├── id: string
├── heuristicLabel: string
├── cohesionScore: float
└── memberCount: number

Process (Execution Flow)
├── id: string
├── summary: string
├── processType: string (cross_community | intra_community)
├── stepCount: number
└── priority: float
```

### Relationship Types

```
CodeRelation
├── type: CALLS | IMPORTS | EXTENDS | IMPLEMENTS | DEFINES | MEMBER_OF | STEP_IN_PROCESS
├── confidence: float (0.0 - 1.0)
├── context: string
└── metadata: json

Confidence Scoring:
- 1.0: Direct AST match (explicit call/import)
- 0.9: High confidence (resolved import)
- 0.8: Good confidence (inferred from usage)
- 0.7: Medium confidence (heuristic match)
- <0.7: Low confidence (fuzzy match)
```

---

## MCP Architecture

### Multi-Repo Registry

```
~/.gitnexus/
├── registry.json          # Global registry of all indexed repos
└── cache/                 # Shared cache

/path/to/project1/
└── .gitnexus/
    ├── db/                # KuzuDB files
    ├── embeddings/        # Vector indexes
    └── metadata.json      # Repo metadata

/path/to/project2/
└── .gitnexus/
    ├── db/
    ├── embeddings/
    └── metadata.json
```

### MCP Server Flow

```
┌─────────────────┐
│   AI Editor     │
│ (Cursor/Claude) │
└────────┬────────┘
         │ stdio
         ▼
┌─────────────────────────────────────────┐
│         MCP Server (server.ts)          │
│                                         │
│  1. Reads ~/.gitnexus/registry.json    │
│  2. Discovers all indexed repos         │
│  3. Lazy-loads KuzuDB connections       │
│  4. Routes tool calls to correct repo   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│    LocalBackend (backend/local.ts)      │
│                                         │
│  - Connection pooling (max 5)           │
│  - LRU eviction (5 min idle)            │
│  - Query execution                      │
│  - Result formatting                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         KuzuDB Connections              │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ Repo A   │  │ Repo B   │  ...      │
│  │ DB Conn  │  │ DB Conn  │           │
│  └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
```

### Tool Execution Flow

```
1. AI Agent calls tool
   ↓
2. MCP Server receives request
   ↓
3. Determine target repo
   ├─ Single repo indexed → auto-select
   └─ Multiple repos → use 'repo' param
   ↓
4. Get/create DB connection
   ↓
5. Execute Cypher query
   ↓
6. Format results
   ↓
7. Return to AI Agent
```

---

## Web UI Architecture

### Client-Side Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              React Application                      │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Graph View   │  │  AI Chat     │               │    │
│  │  │ (Sigma.js)   │  │ (LangChain)  │               │    │
│  │  └──────────────┘  └──────────────┘               │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Code Editor  │  │  Process     │               │    │
│  │  │              │  │  Explorer    │               │    │
│  │  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────┬──────────────────────────────┘    │
│                        │                                    │
│                        ▼                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Web Workers (Comlink)                     │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Indexer      │  │  Query       │               │    │
│  │  │ Worker       │  │  Worker      │               │    │
│  │  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────┬──────────────────────────────┘    │
│                        │                                    │
│                        ▼                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │              WebAssembly Layer                      │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Tree-sitter  │  │  KuzuDB      │               │    │
│  │  │ WASM         │  │  WASM        │               │    │
│  │  └──────────────┘  └──────────────┘               │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  transformers.js (WebGPU/WASM)               │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Bridge Mode

When `gitnexus serve` is running, the Web UI can connect to it:

```
┌─────────────┐                    ┌─────────────┐
│  Browser    │                    │  CLI Server │
│  (Web UI)   │                    │  (Node.js)  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Detect server (fetch /api)  │
       ├─────────────────────────────────►│
       │                                  │
       │  2. List repos                   │
       ├─────────────────────────────────►│
       │◄─────────────────────────────────┤
       │  [repo1, repo2, ...]             │
       │                                  │
       │  3. Query repo                   │
       ├─────────────────────────────────►│
       │  POST /api/query                 │
       │  {repo: "repo1", query: "..."}   │
       │                                  │
       │◄─────────────────────────────────┤
       │  Results from KuzuDB             │
       │                                  │
```

---

## Data Flow

### Indexing Flow

```
Source Code
    ↓
Tree-sitter Parser
    ↓
AST Nodes
    ↓
Symbol Extractor
    ↓
Symbols (Functions, Classes, etc.)
    ↓
Import Resolver
    ↓
Call Graph Builder
    ↓
Graph with Relationships
    ↓
Community Detection
    ↓
Process Detection
    ↓
Embedding Generation
    ↓
KuzuDB Storage
```

### Query Flow

```
AI Agent Query
    ↓
MCP Tool Call
    ↓
Backend Router
    ↓
Cypher Query Generator
    ↓
KuzuDB Execution
    ↓
Result Formatter
    ↓
Structured Response
    ↓
AI Agent
```

---

## Performance Optimizations

### Indexing

- **Parallel Processing**: Worker threads for parsing
- **Incremental Updates**: Only re-index changed files (coming soon)
- **Lazy Embeddings**: Skip with `--skip-embeddings` flag
- **Smart Filtering**: Respect .gitignore, skip node_modules

### Querying

- **Connection Pooling**: Reuse KuzuDB connections
- **LRU Cache**: Cache query results
- **Lazy Loading**: Open DB connections on-demand
- **Confidence Filtering**: Reduce results with `minConfidence`

### Web UI

- **WebGL Rendering**: Hardware-accelerated graph visualization
- **Web Workers**: Offload heavy computation
- **Virtual Scrolling**: Handle large result sets
- **Code Splitting**: Load features on-demand

---

## Storage

### File Layout

```
Project Root
├── .gitnexus/
│   ├── db/
│   │   ├── nodes.kuzu
│   │   ├── rels.kuzu
│   │   └── metadata.kuzu
│   ├── embeddings/
│   │   └── vectors.bin
│   └── metadata.json
├── .claude/
│   └── skills/
│       └── gitnexus/
│           ├── exploring/
│           ├── debugging/
│           ├── impact-analysis/
│           └── refactoring/
├── AGENTS.md
└── CLAUDE.md

~/.gitnexus/
├── registry.json
└── cache/
```

### Storage Requirements

| Component | Size (typical) | Notes |
|-----------|----------------|-------|
| KuzuDB | 10-50 MB per 10k LOC | Compressed graph |
| Embeddings | 5-20 MB per 10k LOC | Optional, can skip |
| Metadata | < 1 MB | JSON files |
| Total | ~15-70 MB per 10k LOC | Varies by language |

---

## Scaling Considerations

### Large Codebases (>100k LOC)

- Use `--skip-embeddings` for faster indexing
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=8192"`
- Consider splitting into multiple repos
- Use Docker with resource limits

### Multiple Repos

- Global registry handles unlimited repos
- Connection pooling prevents resource exhaustion
- Each repo's index is independent
- No cross-repo queries (yet)

### Concurrent Queries

- MCP server is single-threaded (stdio)
- HTTP server supports concurrent requests
- KuzuDB supports concurrent reads
- Connection pool prevents contention

---

## Security Model

### CLI

- **No network**: Everything runs locally
- **No telemetry**: No data collection
- **Sandboxed**: Only accesses indexed repos
- **Gitignored**: `.gitnexus/` never committed

### Web UI

- **In-browser**: No server uploads
- **localStorage**: API keys stored locally
- **CORS**: Respects same-origin policy
- **No persistence**: Data cleared on refresh (unless using backend)

### MCP

- **stdio protocol**: No network exposure
- **Read-only**: No file modifications (except rename tool)
- **Scoped**: Only accesses indexed repos
- **No shell**: No arbitrary command execution

---

## Extension Points

### Custom Languages

Add support for new languages by:

1. Adding Tree-sitter grammar
2. Implementing language-specific resolver
3. Registering in language registry

### Custom Tools

Extend MCP with custom tools:

```typescript
server.addTool({
  name: "my_custom_tool",
  description: "Does something custom",
  inputSchema: { /* ... */ },
  handler: async (params) => {
    // Custom logic
    return result;
  }
});
```

### Custom Embeddings

Use different embedding models:

```typescript
const embedder = new CustomEmbedder({
  model: "my-model",
  dimensions: 768
});
```

---

## Future Architecture

### Planned Improvements

- **Incremental Indexing**: Only re-index changed files
- **Cross-Repo Queries**: Query across multiple repos
- **Distributed Storage**: Scale to massive codebases
- **Real-time Updates**: Watch mode for live updates
- **Plugin System**: Third-party extensions
- **Cloud Sync**: Optional cloud backup

---

## Debugging

### Enable Debug Logs

```bash
# CLI
DEBUG=gitnexus:* gitnexus analyze

# MCP Server
DEBUG=gitnexus:* gitnexus mcp

# Web UI
localStorage.setItem('debug', 'gitnexus:*')
```

### Inspect Database

```bash
# Open KuzuDB shell
cd .gitnexus/db
kuzu-shell

# Run queries
MATCH (n) RETURN count(n);
MATCH (f:Function) RETURN f.name LIMIT 10;
```

---

## Contributing

To contribute to GitNexus architecture:

1. Read this document
2. Check [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Discuss major changes in issues first
4. Follow the existing patterns
5. Add tests for new features

---

## References

- [KuzuDB Documentation](https://kuzudb.com/docs/)
- [Tree-sitter Documentation](https://tree-sitter.github.io/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Graphology Documentation](https://graphology.github.io/)
