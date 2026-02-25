# GitNexus Quick Start & Reference

Everything you need to get GitNexus running in under 5 minutes.

---

## Table of Contents

- [Quick Start - Local](#quick-start---local)
- [Quick Start - Docker](#quick-start---docker)
- [CLI Reference](#cli-reference)
- [MCP Tools Reference](#mcp-tools-reference)
- [Docker Reference](#docker-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start - Local

### Option 1: npx (No Installation)

```bash
# Navigate to your project
cd /path/to/your/project

# Index your codebase
npx gitnexus analyze

# Setup MCP for your editor
npx gitnexus setup

# Restart your editor (Cursor, Claude Code, etc.)
```

**Done!** Your AI agent now has deep codebase awareness.

### Option 2: Global Installation

```bash
# Install once
npm install -g gitnexus

# Use anywhere
cd /path/to/your/project
gitnexus analyze
gitnexus setup
```

### Option 3: Run Web UI Locally

```bash
# Clone repo
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus

# Terminal 1: Start backend
cd gitnexus
npm install
npm run build
node dist/cli/index.js serve

# Terminal 2: Start frontend
cd gitnexus-web
npm install
npm run dev

# Open http://localhost:5173
```

---

## Quick Start - Docker

### One-Command Start

```bash
# Clone and start
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus
docker-compose up -d
```

**Access:**
- Web UI: http://localhost:8080
- API: http://localhost:4747

### Index Your First Repository

```bash
# Copy your project
mkdir -p repos
cp -r /path/to/your/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project
```

### Interactive Helper

```bash
./docker-start.sh
```

Provides menu for: Start, Index, Stop, Logs, Cleanup

---

## CLI Reference

### Essential Commands

| Command | Description |
|---------|-------------|
| `gitnexus analyze` | Index current repository |
| `gitnexus analyze --force` | Force full re-index |
| `gitnexus analyze --skip-embeddings` | Faster indexing (no semantic search) |
| `gitnexus setup` | Configure MCP for your editors |
| `gitnexus status` | Show index status |
| `gitnexus list` | List all indexed repos |
| `gitnexus serve` | Start HTTP server (port 3000) |
| `gitnexus mcp` | Start MCP server (stdio) |
| `gitnexus wiki` | Generate documentation |
| `gitnexus clean` | Delete current repo index |
| `gitnexus clean --all --force` | Delete all indexes |

### Examples

```bash
# Index a specific directory
gitnexus analyze /path/to/project

# Index with more memory
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze

# Generate wiki with custom model
gitnexus wiki --model gpt-4o

# Start server on custom port
gitnexus serve --port 4000
```

---

## MCP Tools Reference

### Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list_repos` | List indexed repos | `list_repos()` |
| `query` | Search code | `query({query: "auth middleware"})` |
| `context` | Symbol details | `context({name: "UserService"})` |
| `impact` | Blast radius | `impact({target: "validateUser", direction: "upstream"})` |
| `detect_changes` | Git diff impact | `detect_changes({scope: "staged"})` |
| `rename` | Multi-file rename | `rename({symbol_name: "old", new_name: "new"})` |
| `cypher` | Raw graph query | `cypher({query: "MATCH (f:Function) RETURN f.name"})` |

### Tool Examples

#### Search Code

```javascript
query({query: "authentication flow"})
query({query: "user validation", repo: "backend"})
```

#### Get Symbol Context

```javascript
context({name: "UserService"})
context({name: "validateUser", repo: "my-app"})
```

#### Impact Analysis

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
  direction: "downstream"
})
```

#### Pre-Commit Check

```javascript
detect_changes({scope: "staged"})
detect_changes({scope: "all"})
detect_changes({scope: "commit", ref: "abc123"})
```

#### Rename Symbol

```javascript
// Preview
rename({symbol_name: "oldName", new_name: "newName", dry_run: true})

// Apply
rename({symbol_name: "oldName", new_name: "newName", dry_run: false})
```

### MCP Resources

| Resource | Content |
|----------|---------|
| `gitnexus://repos` | All indexed repos |
| `gitnexus://repo/{name}/context` | Repo stats |
| `gitnexus://repo/{name}/clusters` | Functional areas |
| `gitnexus://repo/{name}/processes` | Execution flows |
| `gitnexus://repo/{name}/schema` | Graph schema |

---

## Docker Reference

### Docker Compose Commands

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start all services |
| `docker-compose down` | Stop all services |
| `docker-compose logs -f` | View logs |
| `docker-compose ps` | Check status |
| `docker-compose up -d --build` | Rebuild and start |
| `docker-compose down -v` | Stop and remove volumes |

### Index Repository in Docker

```bash
# Copy project to repos/
cp -r /path/to/project repos/my-project

# Index
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project

# List
docker-compose exec gitnexus-server npx gitnexus list

# Status
docker-compose exec gitnexus-server npx gitnexus status
```

### Run Individual Containers

**Server only:**

```bash
cd gitnexus
docker build -t gitnexus-cli .
docker run -d -p 3000:3000 -v $(pwd)/repos:/repos gitnexus-cli serve
```

**Web UI only:**

```bash
cd gitnexus-web
docker build -t gitnexus-web .
docker run -d -p 8080:80 gitnexus-web
```

### Docker Architecture

```
┌─────────────────────────────────────┐
│         Docker Network              │
│                                     │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Web UI   │◄───┤ Server       │  │
│  │ :8080    │    │ :3000        │  │
│  └──────────┘    └──────────────┘  │
│                         │          │
│                         ▼          │
│                  ┌──────────────┐  │
│                  │ Volume:      │  │
│                  │ gitnexus-data│  │
│                  └──────────────┘  │
└─────────────────────────────────────┘
```

### Ports

| Service | Internal | External |
|---------|----------|----------|
| Web UI | 80 | 8080 |
| API Server | 4747 | 4747 |

### Volumes

| Volume | Path | Purpose |
|--------|------|---------|
| `./repos` | `/repos` | Repositories to index |
| `gitnexus-data` | `/root/.gitnexus` | Persistent index data |

---

## Editor Setup

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

### OpenCode

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

## Common Use Cases

### 1. Understand New Code

```javascript
// Search
query({query: "authentication flow"})

// Get details
context({name: "AuthService"})

// See processes
// Resource: gitnexus://repo/my-app/processes
```

### 2. Before Making Changes

```javascript
// Check impact
impact({target: "UserService", direction: "upstream", maxDepth: 3})

// Make changes...

// Verify
detect_changes({scope: "all"})
```

### 3. Debug Issues

```javascript
// Find code
query({query: "login error handling"})

// Trace calls
impact({target: "handleLogin", direction: "downstream", maxDepth: 5})
```

### 4. Safe Refactoring

```javascript
// Check blast radius
impact({target: "validateUser", direction: "upstream"})

// Preview rename
rename({symbol_name: "validateUser", new_name: "verifyUser", dry_run: true})

// Apply
rename({symbol_name: "validateUser", new_name: "verifyUser", dry_run: false})
```

---

## Cypher Query Examples

### Find Callers

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: 'validateUser'})
RETURN caller.name, caller.filePath
```

### Find Most-Called Functions

```cypher
MATCH (caller)-[r:CodeRelation {type: 'CALLS'}]->(fn:Function)
RETURN fn.name, count(r) as calls
ORDER BY calls DESC
LIMIT 10
```

### Find Unused Functions

```cypher
MATCH (f:Function)
WHERE NOT (()-[:CodeRelation {type: 'CALLS'}]->(f))
RETURN f.name, f.filePath
```

### Find Circular Dependencies

```cypher
MATCH (a)-[:CodeRelation*2..5]->(a)
RETURN a.name, a.filePath
```

### Find High-Confidence Calls

```cypher
MATCH (a)-[r:CodeRelation {type: 'CALLS'}]->(b)
WHERE r.confidence > 0.9
RETURN a.name, b.name, r.confidence
```

---

## Troubleshooting

### Index Issues

```bash
# Force re-index
gitnexus analyze --force

# Check status
gitnexus status

# Enable debug
DEBUG=gitnexus:* gitnexus analyze
```

### MCP Not Working

```bash
# Verify config
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

### Docker Issues

```bash
# View logs
docker-compose logs -f gitnexus-server

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Clean start
docker-compose down -v
docker-compose up -d
```

### Web UI Can't Connect

```bash
# Check server is running
curl http://localhost:3000/health

# Check Docker network
docker-compose exec gitnexus-web wget -O- http://gitnexus-server:3000/health
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
| `~/.cursor/mcp.json` | Cursor MCP config |

---

## Performance Tips

### Faster Indexing

```bash
gitnexus analyze --skip-embeddings
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze
```

### Faster Queries

```javascript
impact({target: "X", minConfidence: 0.9})  // Higher threshold
impact({target: "X", maxDepth: 2})          // Limit depth
query({query: "X", repo: "specific-repo"})  // Specify repo
```

### Docker Resources

```yaml
# docker-compose.yml
services:
  gitnexus-server:
    deploy:
      resources:
        limits:
          memory: 4G
```

---

## Quick Comparison

| Method | Setup Time | Best For |
|--------|------------|----------|
| `npx gitnexus analyze` | 30 sec | Quick local use |
| `npm install -g gitnexus` | 1 min | Regular use |
| `docker-compose up -d` | 2 min | Containerized deployment |
| `npm run dev` (web) | 3 min | Web UI development |

---

## Links

| Resource | URL |
|----------|-----|
| Web UI (Hosted) | https://gitnexus.vercel.app |
| GitHub | https://github.com/abhigyanpatwari/GitNexus |
| npm | https://www.npmjs.com/package/gitnexus |
| Issues | https://github.com/abhigyanpatwari/GitNexus/issues |

---

## License

PolyForm Noncommercial 1.0.0
