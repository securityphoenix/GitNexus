# GitNexus Documentation Index

Complete guide to all GitNexus documentation.

## 📚 Documentation Overview

This repository contains comprehensive documentation for using, deploying, and understanding GitNexus.

---

## 🚀 Getting Started

### [QUICKSTART.md](./QUICKSTART.md) ⭐ NEW

**Fastest path!** Everything in one document.

- Quick start (local & Docker)
- CLI reference
- MCP tools reference
- Docker reference
- Troubleshooting

**Time to read**: 5 minutes  
**Best for**: Getting running immediately

### [GETTING_STARTED.md](./GETTING_STARTED.md)

**Detailed introduction** and first steps.

- What is GitNexus?
- Installation options
- First steps (index, setup, use)
- Common use cases
- Troubleshooting basics

**Time to read**: 10 minutes  
**Best for**: New users wanting more context

---

## 📖 Core Documentation

### [README.md](./README.md)

**Main project README** with overview and features.

- Project overview
- Two ways to use GitNexus (CLI + Web)
- Quick start guide
- MCP integration
- Tool examples
- Tech stack

**Time to read**: 10 minutes  
**Best for**: Understanding what GitNexus does

### [USAGE_GUIDE.md](./USAGE_GUIDE.md)

**Comprehensive usage guide** covering all features.

- Installation methods
- CLI commands
- MCP integration details
- Web UI usage
- Docker deployment
- Advanced usage
- Troubleshooting

**Time to read**: 20 minutes  
**Best for**: In-depth learning, reference

### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

**Cheat sheet** for common commands and patterns.

- Command reference
- MCP tools quick reference
- Common use cases
- Cypher query examples
- Docker commands
- Troubleshooting tips

**Time to read**: 5 minutes  
**Best for**: Quick lookup, daily reference

---

## 🐳 Docker & Deployment

### [DOCKER.md](./DOCKER.md)

**Complete Docker guide** for containerization.

- Quick start with Docker
- Individual containers
- Docker Compose setup
- Volume management
- Production deployment
- Kubernetes examples
- Troubleshooting

**Time to read**: 15 minutes  
**Best for**: Running GitNexus in containers

### [docker-compose.yml](./docker-compose.yml)

**Docker Compose configuration** for running GitNexus.

- CLI/MCP server container
- Web UI container
- Volume configuration
- Network setup

**Usage**:
```bash
docker-compose up -d
```

### [docker-start.sh](./docker-start.sh)

**Helper script** for Docker operations.

- Interactive menu
- Start/stop services
- Index repositories
- View logs
- Clean up

**Usage**:
```bash
./docker-start.sh
```

---

## 🏗️ Architecture & Technical

### [ARCHITECTURE.md](./ARCHITECTURE.md)

**System architecture** and technical details.

- System overview
- Indexing pipeline
- Knowledge graph schema
- MCP architecture
- Web UI architecture
- Data flow
- Performance optimizations
- Storage details

**Time to read**: 25 minutes  
**Best for**: Understanding internals, contributing

### [docs/CONTAINERIZATION.md](./docs/CONTAINERIZATION.md)

**Containerization guide** with deployment patterns.

- Container architecture
- Development setup
- Production deployment
- Kubernetes manifests
- Best practices
- CI/CD integration

**Time to read**: 20 minutes  
**Best for**: Production deployments, DevOps

---

## 🎯 Use Case Specific

### [AGENTS.md](./AGENTS.md) & [CLAUDE.md](./CLAUDE.md)

**AI agent context files** (auto-generated).

- GitNexus overview for AI agents
- Available tools and skills
- Usage instructions

**Auto-created by**: `gitnexus analyze`  
**Best for**: AI agents (not for humans)

---

## 📂 Documentation Structure

```
GitNexus/
├── QUICKSTART.md            # ⭐ Start here - fastest path
├── GETTING_STARTED.md       # Detailed introduction
├── README.md                # Main overview
├── USAGE_GUIDE.md           # Comprehensive guide
├── QUICK_REFERENCE.md       # Cheat sheet
├── DOCKER.md                # Docker guide
├── ARCHITECTURE.md          # Technical details
├── DOCUMENTATION_INDEX.md   # This file
│
├── docker-compose.yml       # Docker Compose config
├── docker-start.sh          # Docker helper script
├── .dockerignore            # Docker ignore file
│
├── docs/
│   └── CONTAINERIZATION.md  # Deployment guide
│
├── gitnexus/
│   ├── Dockerfile           # CLI/MCP server image
│   └── ...
│
└── gitnexus-web/
    ├── Dockerfile           # Web UI image
    ├── nginx.conf           # Nginx config
    └── ...
```

---

## 🎓 Learning Paths

### Path 1: Quick Start (15 minutes)

For users who want to start using GitNexus immediately:

1. [GETTING_STARTED.md](./GETTING_STARTED.md) - Installation and first steps
2. [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Command cheat sheet
3. Start using with your AI editor!

### Path 2: Comprehensive (1 hour)

For users who want to understand everything:

1. [README.md](./README.md) - Overview
2. [GETTING_STARTED.md](./GETTING_STARTED.md) - First steps
3. [USAGE_GUIDE.md](./USAGE_GUIDE.md) - Detailed usage
4. [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Reference
5. Experiment with your codebase

### Path 3: Docker Deployment (30 minutes)

For users who want to run in containers:

1. [DOCKER.md](./DOCKER.md) - Docker guide
2. [docker-compose.yml](./docker-compose.yml) - Review config
3. Run `docker-compose up -d`
4. [docs/CONTAINERIZATION.md](./docs/CONTAINERIZATION.md) - Production patterns

### Path 4: Technical Deep Dive (1.5 hours)

For contributors and advanced users:

1. [README.md](./README.md) - Overview
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
3. [USAGE_GUIDE.md](./USAGE_GUIDE.md) - All features
4. Explore the codebase with GitNexus itself!

---

## 📋 Quick Links by Topic

### Installation

- [GETTING_STARTED.md](./GETTING_STARTED.md#installation-options)
- [USAGE_GUIDE.md](./USAGE_GUIDE.md#installation)
- [README.md](./README.md#quick-start)

### CLI Commands

- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#essential-commands)
- [USAGE_GUIDE.md](./USAGE_GUIDE.md#cli-usage)

### MCP Integration

- [USAGE_GUIDE.md](./USAGE_GUIDE.md#mcp-integration)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#mcp-tools-quick-reference)
- [README.md](./README.md#mcp-setup)

### Docker

- [DOCKER.md](./DOCKER.md)
- [docker-compose.yml](./docker-compose.yml)
- [docker-start.sh](./docker-start.sh)
- [docs/CONTAINERIZATION.md](./docs/CONTAINERIZATION.md)

### Web UI

- [USAGE_GUIDE.md](./USAGE_GUIDE.md#web-ui)
- [README.md](./README.md#web-ui-browser-based)

### Troubleshooting

- [USAGE_GUIDE.md](./USAGE_GUIDE.md#troubleshooting)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#troubleshooting)
- [DOCKER.md](./DOCKER.md#troubleshooting)

### Architecture

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/CONTAINERIZATION.md](./docs/CONTAINERIZATION.md#container-architecture)

### Examples

- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#common-use-cases)
- [USAGE_GUIDE.md](./USAGE_GUIDE.md#advanced-usage)
- [README.md](./README.md#tool-examples)

---

## 🔍 Finding What You Need

### "How do I install GitNexus?"

→ [GETTING_STARTED.md](./GETTING_STARTED.md#installation-options)

### "How do I use GitNexus with Cursor?"

→ [USAGE_GUIDE.md](./USAGE_GUIDE.md#editor-specific-setup)

### "What commands are available?"

→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#essential-commands)

### "How do I run GitNexus in Docker?"

→ [DOCKER.md](./DOCKER.md#quick-start)

### "How does GitNexus work internally?"

→ [ARCHITECTURE.md](./ARCHITECTURE.md)

### "How do I deploy to production?"

→ [docs/CONTAINERIZATION.md](./docs/CONTAINERIZATION.md#production-deployment)

### "What MCP tools are available?"

→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#mcp-tools-quick-reference)

### "How do I write Cypher queries?"

→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#cypher-query-examples)

### "How do I troubleshoot issues?"

→ [USAGE_GUIDE.md](./USAGE_GUIDE.md#troubleshooting)

---

## 📝 Documentation Maintenance

### For Contributors

When adding new features:

1. Update [README.md](./README.md) with overview
2. Add details to [USAGE_GUIDE.md](./USAGE_GUIDE.md)
3. Add commands to [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
4. Update [ARCHITECTURE.md](./ARCHITECTURE.md) if needed
5. Update this index

### For Users

If documentation is unclear or missing:

1. Open an issue: [GitHub Issues](https://github.com/abhigyanpatwari/GitNexus/issues)
2. Suggest improvements
3. Submit a PR with documentation updates

---

## 🌟 Additional Resources

### External Links

- **GitHub Repository**: https://github.com/abhigyanpatwari/GitNexus
- **Web UI (Hosted)**: https://gitnexus.vercel.app
- **npm Package**: https://www.npmjs.com/package/gitnexus
- **Issues**: https://github.com/abhigyanpatwari/GitNexus/issues
- **Discussions**: https://github.com/abhigyanpatwari/GitNexus/discussions

### Related Technologies

- **MCP**: https://modelcontextprotocol.io/
- **KuzuDB**: https://kuzudb.com/
- **Tree-sitter**: https://tree-sitter.github.io/
- **Cursor**: https://cursor.sh/
- **Claude Code**: https://claude.ai/

---

## 📊 Documentation Stats

| Document | Size | Time to Read | Audience |
|----------|------|--------------|----------|
| GETTING_STARTED.md | ~3 KB | 5 min | Beginners |
| README.md | ~20 KB | 10 min | Everyone |
| USAGE_GUIDE.md | ~15 KB | 20 min | Users |
| QUICK_REFERENCE.md | ~8 KB | 5 min | Users |
| DOCKER.md | ~12 KB | 15 min | DevOps |
| ARCHITECTURE.md | ~18 KB | 25 min | Developers |
| CONTAINERIZATION.md | ~10 KB | 20 min | DevOps |

**Total**: ~86 KB of documentation

---

## 🎯 Next Steps

1. **New to GitNexus?** → Start with [GETTING_STARTED.md](./GETTING_STARTED.md)
2. **Want to use it?** → Read [USAGE_GUIDE.md](./USAGE_GUIDE.md)
3. **Need quick reference?** → Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
4. **Deploying?** → See [DOCKER.md](./DOCKER.md)
5. **Contributing?** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📧 Feedback

Found an issue with the documentation?

- Open an issue: [GitHub Issues](https://github.com/abhigyanpatwari/GitNexus/issues)
- Start a discussion: [GitHub Discussions](https://github.com/abhigyanpatwari/GitNexus/discussions)
- Submit a PR with improvements

---

## License

GitNexus is licensed under PolyForm Noncommercial 1.0.0. See [LICENSE](./LICENSE) for details.
