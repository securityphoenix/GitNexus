# Getting Started with GitNexus

Welcome to GitNexus! This guide will help you get up and running quickly.

> **Want the shortest path?** See [QUICKSTART.md](./QUICKSTART.md) for a condensed quick start and reference.

## What is GitNexus?

GitNexus transforms your codebase into a queryable knowledge graph that AI agents can understand. It provides:

- **Deep Code Understanding** - Maps every function, class, dependency, and call chain
- **AI Agent Integration** - Exposes tools via MCP (Model Context Protocol)
- **Impact Analysis** - Shows what breaks when you change code
- **Execution Flow Tracing** - Follows code paths from entry points
- **Semantic Search** - Find code by meaning, not just text

### Supported Languages

TypeScript, JavaScript, Python, Java, C, C++, C#, Go, Rust

---

## Choose Your Path

### 1. Quick Start (5 minutes)

Use GitNexus with your AI editor right now:

```bash
# Navigate to your project
cd /path/to/your/project

# Index your codebase
npx gitnexus analyze

# Setup MCP integration
npx gitnexus setup
```

That's it! Your AI agent now has deep codebase awareness.

### 2. Web UI (No Installation)

Try GitNexus in your browser:

1. Visit [gitnexus.vercel.app](https://gitnexus.vercel.app)
2. Drag & drop a ZIP of your code
3. Explore the graph and chat with AI

### 3. Docker (Containerized)

Run GitNexus in containers:

```bash
# Clone and start
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus
docker-compose up -d

# Access at http://localhost:8080
```

---

## Installation Options

### Option 1: Global Installation (Recommended)

```bash
npm install -g gitnexus
```

### Option 2: Use with npx (No Installation)

```bash
npx gitnexus analyze
```

### Option 3: Docker

```bash
docker-compose up -d
```

---

## First Steps

### 1. Index Your Codebase

```bash
cd /path/to/your/project
npx gitnexus analyze
```

This creates:
- `.gitnexus/` - Knowledge graph database (gitignored)
- `.claude/skills/` - AI agent skills
- `AGENTS.md` & `CLAUDE.md` - Context files

**Time**: 30 seconds to 5 minutes depending on codebase size

### 2. Setup MCP Integration

```bash
npx gitnexus setup
```

This auto-configures:
- **Cursor** (`~/.cursor/mcp.json`)
- **Claude Code** (via `claude mcp add`)
- **Windsurf** (`~/.windsurf/mcp.json`)
- **OpenCode** (`~/.config/opencode/config.json`)

### 3. Use with Your AI Agent

Open your AI editor (Cursor, Claude Code, etc.) and try:

> "What does the UserService class do?"

> "Show me what depends on the validateUser function"

> "What will break if I change AuthService?"

Your AI agent now has access to:
- 7 MCP tools for code intelligence
- 4 agent skills for guided workflows
- Resources for quick context

---

## What You Get

### MCP Tools

| Tool | What It Does |
|------|--------------|
| `query` | Search code by meaning |
| `context` | 360-degree symbol view |
| `impact` | Blast radius analysis |
| `detect_changes` | Git-diff impact |
| `rename` | Multi-file rename |
| `cypher` | Raw graph queries |
| `list_repos` | List indexed repos |

### Agent Skills

| Skill | Purpose |
|-------|---------|
| **Exploring** | Navigate unfamiliar code |
| **Debugging** | Trace bugs through call chains |
| **Impact Analysis** | Analyze blast radius before changes |
| **Refactoring** | Plan safe refactors |

### Resources

Quick-access context without tool calls:

```
gitnexus://repos                    # List all repos
gitnexus://repo/{name}/context      # Repo stats
gitnexus://repo/{name}/clusters     # Functional areas
gitnexus://repo/{name}/processes    # Execution flows
```

---

## Common Use Cases

### Understanding New Code

```javascript
// 1. Read repo context
// Resource: gitnexus://repo/my-app/context

// 2. Search for relevant code
query({query: "authentication flow"})

// 3. Deep dive into symbols
context({name: "AuthService"})
```

### Impact Analysis Before Changes

```javascript
// Check what depends on this function
impact({
  target: "validateUser",
  direction: "upstream",
  maxDepth: 3
})

// Make changes...

// Verify impact
detect_changes({scope: "all"})
```

### Debugging

```javascript
// 1. Find the failing function
query({query: "user login error"})

// 2. Get full context
context({name: "handleLogin"})

// 3. Trace call chain
impact({
  target: "handleLogin",
  direction: "downstream",
  maxDepth: 5
})
```

### Refactoring

```javascript
// 1. Analyze blast radius
impact({target: "UserService", direction: "upstream"})

// 2. Preview rename
rename({
  symbol_name: "UserService",
  new_name: "UserManager",
  dry_run: true
})

// 3. Apply rename
rename({
  symbol_name: "UserService",
  new_name: "UserManager",
  dry_run: false
})
```

---

## Next Steps

### Learn More

- **[USAGE_GUIDE.md](./USAGE_GUIDE.md)** - Comprehensive usage guide
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Command cheat sheet
- **[DOCKER.md](./DOCKER.md)** - Docker deployment guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture

### Try These Commands

```bash
# Check index status
gitnexus status

# List all indexed repos
gitnexus list

# Generate documentation
gitnexus wiki

# Start HTTP server for web UI
gitnexus serve

# Force re-index
gitnexus analyze --force
```

### Explore the Web UI

```bash
# Start server
gitnexus serve

# Open web UI locally
cd gitnexus-web
npm install
npm run dev

# Access at http://localhost:5173
```

The Web UI auto-detects the local server and shows all indexed repos.

---

## Troubleshooting

### MCP Not Working

```bash
# Verify config
cat ~/.cursor/mcp.json

# Re-setup
gitnexus setup

# Test server
gitnexus mcp
```

### Index is Stale

```bash
# Re-index
gitnexus analyze --force
```

### Out of Memory

```bash
# Skip embeddings (faster, less memory)
gitnexus analyze --skip-embeddings

# Or increase memory
NODE_OPTIONS="--max-old-space-size=8192" gitnexus analyze
```

### Parsing Errors

```bash
# Enable debug logs
DEBUG=gitnexus:* gitnexus analyze
```

---

## Docker Quick Start

### Start Services

```bash
# Using helper script
./docker-start.sh

# Or manually
docker-compose up -d
```

### Index a Repository

```bash
# Copy repo
cp -r /path/to/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project
```

### Access

- **Web UI**: http://localhost:8080
- **API Server**: http://localhost:3000

See [DOCKER.md](./DOCKER.md) for complete Docker guide.

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

Restart Cursor.

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

## Multi-Repo Setup

GitNexus supports multiple indexed repositories:

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
```

---

## Getting Help

- **Documentation**: [README.md](./README.md)
- **Issues**: [GitHub Issues](https://github.com/abhigyanpatwari/GitNexus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/abhigyanpatwari/GitNexus/discussions)
- **Web UI**: [gitnexus.vercel.app](https://gitnexus.vercel.app)

---

## What's Next?

1. **Index your main project**: `gitnexus analyze`
2. **Try the tools**: Ask your AI agent about your code
3. **Explore the Web UI**: `gitnexus serve` + open browser
4. **Read the guides**: Check out the documentation links above
5. **Join the community**: Star the repo, open issues, contribute!

---

## License

GitNexus is licensed under PolyForm Noncommercial 1.0.0. See [LICENSE](./LICENSE) for details.

---

## Quick Links

| Resource | Link |
|----------|------|
| **Main README** | [README.md](./README.md) |
| **Usage Guide** | [USAGE_GUIDE.md](./USAGE_GUIDE.md) |
| **Quick Reference** | [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) |
| **Docker Guide** | [DOCKER.md](./DOCKER.md) |
| **Architecture** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Web UI** | [gitnexus.vercel.app](https://gitnexus.vercel.app) |
| **GitHub** | [github.com/abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus) |
