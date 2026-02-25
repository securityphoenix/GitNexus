# GitNexus Usage Guide

A comprehensive guide to using GitNexus for code intelligence and AI agent integration.

## Table of Contents

1. [What is GitNexus?](#what-is-gitnexus)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [CLI Usage](#cli-usage)
5. [MCP Integration](#mcp-integration)
6. [Web UI](#web-ui)
7. [Docker Deployment](#docker-deployment)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

---

## What is GitNexus?

GitNexus transforms your codebase into a queryable knowledge graph that AI agents can understand. It provides:

- **Deep Code Understanding**: Maps every function, class, dependency, and call chain
- **AI Agent Integration**: Exposes tools via MCP (Model Context Protocol)
- **Impact Analysis**: Shows what breaks when you change code
- **Execution Flow Tracing**: Follows code paths from entry points
- **Semantic Search**: Find code by meaning, not just text

### Supported Languages

TypeScript, JavaScript, Python, Java, C, C++, C#, Go, Rust

---

## Installation

### Option 1: Global Installation (Recommended)

```bash
npm install -g gitnexus
```

### Option 2: Use with npx (No Installation)

```bash
npx gitnexus analyze
```

### Option 3: Docker (See Docker section below)

```bash
docker-compose up -d
```

---

## Quick Start

### 1. Index Your Codebase

```bash
# Navigate to your project
cd /path/to/your/project

# Index the codebase
npx gitnexus analyze
```

This creates:
- `.gitnexus/` - Knowledge graph database
- `.claude/skills/` - AI agent skills
- `AGENTS.md` & `CLAUDE.md` - Context files

### 2. Setup MCP Integration

```bash
# Auto-configure your editor
npx gitnexus setup
```

This configures:
- **Cursor**: `~/.cursor/mcp.json`
- **Claude Code**: Via `claude mcp add`
- **Windsurf**: `~/.windsurf/mcp.json`
- **OpenCode**: `~/.config/opencode/config.json`

### 3. Use with Your AI Agent

Your AI agent now has access to:
- 7 MCP tools for code intelligence
- Agent skills for guided workflows
- Resources for quick context

---

## CLI Usage

### Basic Commands

```bash
# Index current repository
gitnexus analyze

# Force full re-index
gitnexus analyze --force

# Skip embeddings (faster)
gitnexus analyze --skip-embeddings

# Check index status
gitnexus status

# List all indexed repos
gitnexus list

# Clean current repo index
gitnexus clean

# Clean all indexes
gitnexus clean --all --force
```

### Server Commands

```bash
# Start MCP server (stdio mode)
gitnexus mcp

# Start HTTP server for web UI
gitnexus serve

# Start on custom port
gitnexus serve --port 4000
```

### Documentation Generation

```bash
# Generate wiki from knowledge graph
gitnexus wiki

# Use custom model
gitnexus wiki --model gpt-4o

# Use custom API endpoint
gitnexus wiki --base-url https://api.anthropic.com/v1

# Force regeneration
gitnexus wiki --force
```

---

## MCP Integration

### What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI agents to external tools and data sources. GitNexus implements MCP to give agents deep codebase awareness.

### Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list_repos` | List all indexed repositories | `list_repos()` |
| `query` | Hybrid search (BM25 + semantic) | `query({query: "auth middleware"})` |
| `context` | 360-degree symbol view | `context({name: "UserService"})` |
| `impact` | Blast radius analysis | `impact({target: "validateUser", direction: "upstream"})` |
| `detect_changes` | Git-diff impact analysis | `detect_changes({scope: "staged"})` |
| `rename` | Multi-file coordinated rename | `rename({symbol_name: "oldName", new_name: "newName"})` |
| `cypher` | Raw graph queries | `cypher({query: "MATCH (f:Function) RETURN f.name"})` |

### Available Resources

Quick-access context without tool calls:

```
gitnexus://repos                          # List all repos
gitnexus://repo/{name}/context            # Repo stats & staleness
gitnexus://repo/{name}/clusters           # Functional areas
gitnexus://repo/{name}/cluster/{name}     # Cluster details
gitnexus://repo/{name}/processes          # Execution flows
gitnexus://repo/{name}/process/{name}     # Process trace
gitnexus://repo/{name}/schema             # Graph schema
```

### Agent Skills

Four guided workflows installed automatically:

1. **Exploring** - Navigate unfamiliar code
2. **Debugging** - Trace bugs through call chains
3. **Impact Analysis** - Analyze blast radius
4. **Refactoring** - Plan safe refactors

Skills are in `.claude/skills/gitnexus/` and auto-loaded by supported editors.

### Editor-Specific Setup

#### Cursor

Manual setup (if `gitnexus setup` doesn't work):

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

#### Claude Code

```bash
claude mcp add gitnexus -- npx -y gitnexus@latest mcp
```

#### Windsurf

Edit `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

#### OpenCode

Edit `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

---

## Web UI

### Hosted Version

Visit [gitnexus.vercel.app](https://gitnexus.vercel.app) and drag & drop a ZIP file.

### Local Development

```bash
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus/gitnexus-web
npm install
npm run dev
```

Access at http://localhost:5173

### Bridge Mode

Connect the Web UI to your locally indexed repos:

```bash
# Terminal 1: Start backend server
gitnexus serve

# Terminal 2: Start web UI
cd gitnexus-web
npm run dev
```

The Web UI auto-detects the local server and shows all indexed repos without re-uploading.

### Features

- **Graph Visualization**: Interactive WebGL graph with zoom/pan
- **AI Chat**: LangChain-powered agent with tool access
- **Code Navigation**: Jump to definitions, find references
- **Process Explorer**: View execution flows
- **Cluster Analysis**: Explore functional areas

---

## Docker Deployment

### Quick Start with Docker

```bash
# Clone the repo
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus

# Start with helper script
./docker-start.sh

# Or manually
docker-compose up -d
```

Access:
- **Web UI**: http://localhost:8080
- **API Server**: http://localhost:3000

### Index a Repository

```bash
# Place your repo in ./repos/
cp -r /path/to/your/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project
```

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build

# List indexed repos
docker-compose exec gitnexus-server npx gitnexus list

# Clean up everything
docker-compose down -v
```

See [DOCKER.md](./DOCKER.md) for detailed Docker documentation.

---

## Advanced Usage

### Multi-Repo Setup

GitNexus supports multiple indexed repositories with a single MCP server:

```bash
# Index multiple repos
cd ~/projects/app1 && gitnexus analyze
cd ~/projects/app2 && gitnexus analyze
cd ~/projects/app3 && gitnexus analyze

# List all
gitnexus list

# MCP server serves all repos
gitnexus mcp
```

When multiple repos are indexed, specify which one in tool calls:

```javascript
query({query: "authentication", repo: "app1"})
impact({target: "UserService", repo: "app2"})
```

### Custom Indexing

```bash
# Index specific directory
gitnexus analyze /path/to/project

# Skip embeddings (faster, no semantic search)
gitnexus analyze --skip-embeddings

# Force full re-index (ignore cache)
gitnexus analyze --force
```

### Cypher Queries

Query the knowledge graph directly:

```cypher
-- Find all functions called by UserService
MATCH (us:Class {name: 'UserService'})-[:CodeRelation {type: 'CALLS'}]->(fn:Function)
RETURN fn.name, fn.filePath

-- Find high-confidence dependencies
MATCH (a)-[r:CodeRelation]->(b)
WHERE r.confidence > 0.9
RETURN a.name, type(r), b.name, r.confidence

-- Find circular dependencies
MATCH (a)-[:CodeRelation*2..5]->(a)
RETURN a.name, a.filePath

-- Find most-called functions
MATCH (caller)-[r:CodeRelation {type: 'CALLS'}]->(fn:Function)
RETURN fn.name, fn.filePath, count(r) as call_count
ORDER BY call_count DESC
LIMIT 10
```

### Impact Analysis Examples

```javascript
// Find what depends on a function (upstream)
impact({
  target: "validateUser",
  direction: "upstream",
  maxDepth: 3,
  minConfidence: 0.8
})

// Find what a function depends on (downstream)
impact({
  target: "UserController",
  direction: "downstream",
  maxDepth: 2,
  includeTests: false
})

// Filter by relationship types
impact({
  target: "AuthService",
  direction: "upstream",
  relationTypes: ["CALLS", "IMPORTS"]
})
```

### Git-Diff Impact Analysis

Before committing, check what your changes affect:

```javascript
// Check staged changes
detect_changes({scope: "staged"})

// Check all uncommitted changes
detect_changes({scope: "all"})

// Check specific commit
detect_changes({scope: "commit", ref: "abc123"})
```

### Multi-File Rename

Safely rename symbols across multiple files:

```javascript
// Dry run (preview changes)
rename({
  symbol_name: "validateUser",
  new_name: "verifyUser",
  dry_run: true
})

// Apply changes
rename({
  symbol_name: "validateUser",
  new_name: "verifyUser",
  dry_run: false
})
```

---

## Troubleshooting

### Index is Stale

```bash
# Re-index to update
gitnexus analyze --force
```

### MCP Server Not Working

```bash
# Check if server starts
gitnexus mcp

# Verify MCP config
cat ~/.cursor/mcp.json

# Re-run setup
gitnexus setup
```

### Out of Memory

```bash
# Skip embeddings to reduce memory
gitnexus analyze --skip-embeddings

# Or increase Node.js memory
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze
```

### Parsing Errors

Some files may fail to parse. Check logs:

```bash
# Index with verbose output
DEBUG=gitnexus:* gitnexus analyze
```

### Web UI Issues

```bash
# Clear browser cache and reload
# Or try incognito mode

# Check if backend is running
curl http://localhost:3000/health
```

### Docker Issues

```bash
# View logs
docker-compose logs -f gitnexus-server

# Restart services
docker-compose restart

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

---

## Performance Tips

### Large Codebases

- Use `--skip-embeddings` for faster indexing
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=8192"`
- Index incrementally (coming soon)

### Faster Queries

- Use specific `repo` parameter when multiple repos are indexed
- Set `minConfidence` higher to reduce results
- Limit `maxDepth` in impact analysis

### Storage

Indexes are stored in:
- **Per-repo**: `.gitnexus/` (portable, gitignored)
- **Global registry**: `~/.gitnexus/registry.json`

To save space:

```bash
# Clean unused indexes
gitnexus clean --all --force

# Or manually delete
rm -rf /path/to/project/.gitnexus
```

---

## Best Practices

### When to Re-Index

- After major refactoring
- When adding new files/modules
- If queries return stale results
- After pulling significant changes

### Using with AI Agents

1. **Start with resources** - Quick context without tool calls
2. **Use query for exploration** - Find relevant code
3. **Use context for details** - Deep dive into symbols
4. **Use impact before changes** - Understand blast radius
5. **Use detect_changes before commit** - Verify safety

### Security

- **CLI**: Everything runs locally, no network calls
- **Web**: Everything in-browser, no uploads
- **MCP**: Stdio protocol, no external connections
- **Docker**: Use internal networks, set resource limits

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/abhigyanpatwari/GitNexus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/abhigyanpatwari/GitNexus/discussions)
- **Documentation**: [README.md](./README.md)
- **Docker Guide**: [DOCKER.md](./DOCKER.md)

---

## License

GitNexus is licensed under PolyForm Noncommercial 1.0.0. See [LICENSE](./LICENSE) for details.
