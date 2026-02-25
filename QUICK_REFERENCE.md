# GitNexus Quick Reference

A cheat sheet for common GitNexus commands and use cases.

> **New to GitNexus?** See [QUICKSTART.md](./QUICKSTART.md) for step-by-step setup instructions.

---

## Installation & Setup

### Local (Recommended)

```bash
# Navigate to your project
cd /path/to/your/project

# Index your codebase (no install required)
npx gitnexus analyze

# Setup MCP for your editor
npx gitnexus setup

# Restart your editor
```

### Docker

```bash
# Clone and start
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus
docker-compose up -d

# Index a repo
cp -r /path/to/project repos/my-project
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project

# Access Web UI at http://localhost:8080
```

### Global Installation (Optional)

```bash
npm install -g gitnexus
gitnexus analyze
gitnexus setup
```

---

## Essential Commands

| Command | Purpose |
|---------|---------|
| `gitnexus analyze` | Index current repository |
| `gitnexus analyze --force` | Force full re-index |
| `gitnexus status` | Check index status |
| `gitnexus list` | List all indexed repos |
| `gitnexus serve` | Start HTTP server |
| `gitnexus clean` | Delete current index |
| `gitnexus wiki` | Generate documentation |

---

## MCP Tools Quick Reference

### 1. list_repos()

List all indexed repositories.

```javascript
list_repos()
```

### 2. query({query, repo?})

Hybrid search (BM25 + semantic).

```javascript
// Search all repos
query({query: "authentication middleware"})

// Search specific repo
query({query: "user validation", repo: "my-app"})
```

**Returns**: Processes, symbols, and definitions grouped by relevance.

### 3. context({name, repo?})

360-degree view of a symbol.

```javascript
context({name: "UserService"})
context({name: "validateUser", repo: "backend"})
```

**Returns**: Symbol details, incoming/outgoing relationships, processes.

### 4. impact({target, direction, maxDepth?, minConfidence?, repo?})

Blast radius analysis.

```javascript
// What depends on this? (upstream)
impact({
  target: "UserService",
  direction: "upstream",
  maxDepth: 3,
  minConfidence: 0.8
})

// What does this depend on? (downstream)
impact({
  target: "UserController",
  direction: "downstream",
  maxDepth: 2
})
```

**Directions**: `upstream` (dependents), `downstream` (dependencies), `both`

### 5. detect_changes({scope, ref?, repo?})

Git-diff impact analysis.

```javascript
// Check staged changes
detect_changes({scope: "staged"})

// Check all uncommitted changes
detect_changes({scope: "all"})

// Check specific commit
detect_changes({scope: "commit", ref: "abc123"})
```

**Returns**: Changed symbols, affected processes, risk level.

### 6. rename({symbol_name, new_name, dry_run?, repo?})

Multi-file coordinated rename.

```javascript
// Preview changes
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

### 7. cypher({query, repo?})

Raw Cypher graph queries.

```javascript
cypher({
  query: `
    MATCH (f:Function {name: 'validateUser'})
    MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f)
    RETURN caller.name, caller.filePath
  `
})
```

---

## MCP Resources Quick Reference

| Resource | Purpose |
|----------|---------|
| `gitnexus://repos` | List all repos |
| `gitnexus://repo/{name}/context` | Repo stats & staleness |
| `gitnexus://repo/{name}/clusters` | Functional areas |
| `gitnexus://repo/{name}/cluster/{name}` | Cluster details |
| `gitnexus://repo/{name}/processes` | Execution flows |
| `gitnexus://repo/{name}/process/{name}` | Process trace |
| `gitnexus://repo/{name}/schema` | Graph schema |

---

## Common Use Cases

### 1. Understanding New Code

```javascript
// Step 1: Read repo context
// Resource: gitnexus://repo/my-app/context

// Step 2: Explore clusters
// Resource: gitnexus://repo/my-app/clusters

// Step 3: Search for relevant code
query({query: "authentication flow", repo: "my-app"})

// Step 4: Deep dive into symbols
context({name: "AuthService", repo: "my-app"})
```

### 2. Impact Analysis Before Changes

```javascript
// Step 1: Check what depends on the function
impact({
  target: "validateUser",
  direction: "upstream",
  maxDepth: 3,
  minConfidence: 0.8
})

// Step 2: Check what it depends on
impact({
  target: "validateUser",
  direction: "downstream",
  maxDepth: 2
})

// Step 3: Make changes

// Step 4: Verify impact
detect_changes({scope: "all"})
```

### 3. Debugging

```javascript
// Step 1: Find the failing function
query({query: "user login error"})

// Step 2: Get full context
context({name: "handleLogin"})

// Step 3: Trace call chain
impact({
  target: "handleLogin",
  direction: "downstream",
  maxDepth: 5
})

// Step 4: Check processes
// Resource: gitnexus://repo/my-app/process/LoginFlow
```

### 4. Refactoring

```javascript
// Step 1: Analyze blast radius
impact({
  target: "UserService",
  direction: "upstream",
  maxDepth: 3
})

// Step 2: Preview rename
rename({
  symbol_name: "UserService",
  new_name: "UserManager",
  dry_run: true
})

// Step 3: Apply rename
rename({
  symbol_name: "UserService",
  new_name: "UserManager",
  dry_run: false
})

// Step 4: Verify changes
detect_changes({scope: "all"})
```

### 5. Pre-Commit Check

```javascript
// Check staged changes
detect_changes({scope: "staged"})

// Review affected processes
// If risk_level is "high", review carefully
```

---

## Cypher Query Examples

### Find All Callers

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: 'validateUser'})
RETURN caller.name, caller.filePath
```

### Find High-Confidence Dependencies

```cypher
MATCH (a)-[r:CodeRelation]->(b)
WHERE r.confidence > 0.9
RETURN a.name, type(r), b.name, r.confidence
ORDER BY r.confidence DESC
```

### Find Circular Dependencies

```cypher
MATCH (a)-[:CodeRelation*2..5]->(a)
RETURN a.name, a.filePath
```

### Find Most-Called Functions

```cypher
MATCH (caller)-[r:CodeRelation {type: 'CALLS'}]->(fn:Function)
RETURN fn.name, fn.filePath, count(r) as call_count
ORDER BY call_count DESC
LIMIT 10
```

### Find Unused Functions

```cypher
MATCH (f:Function)
WHERE NOT (()-[:CodeRelation {type: 'CALLS'}]->(f))
RETURN f.name, f.filePath
```

### Find Functions in a Cluster

```cypher
MATCH (c:Community {heuristicLabel: 'Authentication'})<-[:CodeRelation {type: 'MEMBER_OF'}]-(fn)
RETURN fn.name, fn.filePath
```

### Find Cross-Cluster Calls

```cypher
MATCH (f1)-[:CodeRelation {type: 'MEMBER_OF'}]->(c1:Community)
MATCH (f2)-[:CodeRelation {type: 'MEMBER_OF'}]->(c2:Community)
MATCH (f1)-[:CodeRelation {type: 'CALLS'}]->(f2)
WHERE c1.id <> c2.id
RETURN f1.name, c1.heuristicLabel, f2.name, c2.heuristicLabel
```

### Find Entry Points

```cypher
MATCH (p:Process)
MATCH (p)-[:CodeRelation {type: 'STEP_IN_PROCESS'}]->(step)
WHERE step.stepIndex = 0
RETURN p.summary, step.name, step.filePath
```

---

## Docker Quick Reference

### Start Services

```bash
# Using helper script
./docker-start.sh

# Or manually
docker-compose up -d

# Check status
docker-compose ps
```

**Access:**
- Web UI: http://localhost:8080
- API Server: http://localhost:3000

### Index a Repository

```bash
# Create repos directory
mkdir -p repos

# Copy your project
cp -r /path/to/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project

# Verify
docker-compose exec gitnexus-server npx gitnexus list
```

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start services |
| `docker-compose down` | Stop services |
| `docker-compose logs -f` | View logs |
| `docker-compose ps` | Check status |
| `docker-compose up -d --build` | Rebuild |
| `docker-compose down -v` | Stop + remove data |

### Run Web UI Locally (Development)

```bash
# Terminal 1: Start backend
cd gitnexus
npm install && npm run build
node dist/cli/index.js serve

# Terminal 2: Start frontend
cd gitnexus-web
npm install
npm run dev

# Open http://localhost:5173
```

See [QUICKSTART.md](./QUICKSTART.md) for more details.

---

## Troubleshooting

### Index is Stale

```bash
gitnexus analyze --force
```

### MCP Not Working

```bash
# Check config
cat ~/.cursor/mcp.json

# Re-setup
gitnexus setup

# Test server
gitnexus mcp
```

### Out of Memory

```bash
# Skip embeddings
gitnexus analyze --skip-embeddings

# Increase memory
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze
```

### Parsing Errors

```bash
# Enable debug logs
DEBUG=gitnexus:* gitnexus analyze
```

---

## Performance Tips

### Faster Indexing

```bash
# Skip embeddings (no semantic search)
gitnexus analyze --skip-embeddings

# Increase memory
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze
```

### Faster Queries

```javascript
// Use higher confidence threshold
impact({target: "UserService", minConfidence: 0.9})

// Limit depth
impact({target: "UserService", maxDepth: 2})

// Specify repo (when multiple indexed)
query({query: "auth", repo: "backend"})
```

---

## Editor-Specific Setup

### Cursor

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

### Claude Code

```bash
claude mcp add gitnexus -- npx -y gitnexus@latest mcp
```

### Windsurf

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

---

## File Locations

| Path | Purpose |
|------|---------|
| `.gitnexus/` | Per-repo index (gitignored) |
| `~/.gitnexus/registry.json` | Global repo registry |
| `.claude/skills/gitnexus/` | Agent skills |
| `AGENTS.md` | Agent context file |
| `CLAUDE.md` | Claude-specific context |

---

## Confidence Scores

| Score | Meaning |
|-------|---------|
| 1.0 | Direct AST match |
| 0.9 | High confidence (resolved import) |
| 0.8 | Good confidence (inferred usage) |
| 0.7 | Medium confidence (heuristic) |
| <0.7 | Low confidence (fuzzy match) |

---

## Graph Schema

### Node Types

- `File`, `Function`, `Class`, `Interface`, `Method`
- `Community` (cluster), `Process` (execution flow)

### Relationship Types

- `CALLS` - Function/method calls
- `IMPORTS` - Module imports
- `EXTENDS` - Class inheritance
- `IMPLEMENTS` - Interface implementation
- `DEFINES` - File defines symbol
- `MEMBER_OF` - Symbol belongs to cluster
- `STEP_IN_PROCESS` - Symbol is step in process

---

## Useful Resources

- **Main README**: [README.md](./README.md)
- **Usage Guide**: [USAGE_GUIDE.md](./USAGE_GUIDE.md)
- **Docker Guide**: [DOCKER.md](./DOCKER.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **GitHub**: https://github.com/abhigyanpatwari/GitNexus
- **Web UI**: https://gitnexus.vercel.app

---

## Getting Help

- **Issues**: https://github.com/abhigyanpatwari/GitNexus/issues
- **Discussions**: https://github.com/abhigyanpatwari/GitNexus/discussions

---

## License

PolyForm Noncommercial 1.0.0
