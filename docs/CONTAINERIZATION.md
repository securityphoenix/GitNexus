# GitNexus Containerization Guide

Complete guide for running GitNexus in containers for development, testing, and production.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Container Architecture](#container-architecture)
4. [Development Setup](#development-setup)
5. [Production Deployment](#production-deployment)
6. [Kubernetes](#kubernetes)
7. [Best Practices](#best-practices)

---

## Overview

GitNexus can be containerized in two ways:

1. **CLI/MCP Server** - Node.js container for indexing and serving MCP
2. **Web UI** - Nginx container for the browser-based interface

Both can run standalone or together using Docker Compose.

### Benefits of Containerization

- **Consistency**: Same environment everywhere
- **Isolation**: No dependency conflicts
- **Scalability**: Easy to scale horizontally
- **Portability**: Run anywhere Docker runs
- **CI/CD**: Integrate into pipelines

---

## Quick Start

### Prerequisites

```bash
# Install Docker
# macOS: https://docs.docker.com/desktop/install/mac-install/
# Linux: https://docs.docker.com/engine/install/
# Windows: https://docs.docker.com/desktop/install/windows-install/

# Verify installation
docker --version
docker-compose --version
```

### Start GitNexus

```bash
# Clone repository
git clone https://github.com/abhigyanpatwari/gitnexus.git
cd gitnexus

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Access:
- **Web UI**: http://localhost:8080
- **API Server**: http://localhost:3000

### Index Your First Repository

```bash
# Create repos directory
mkdir -p repos

# Copy your project
cp -r /path/to/your/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project

# Verify
docker-compose exec gitnexus-server npx gitnexus list
```

The Web UI will automatically detect and display the indexed repository.

---

## Container Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              gitnexus-network (bridge)              │    │
│  │                                                     │    │
│  │  ┌──────────────────────┐  ┌──────────────────┐   │    │
│  │  │  gitnexus-web        │  │ gitnexus-server  │   │    │
│  │  │  (Nginx + React)     │  │ (Node.js)        │   │    │
│  │  │                      │  │                  │   │    │
│  │  │  Port: 80 → 8080     │  │ Port: 3000       │   │    │
│  │  └──────────┬───────────┘  └────────┬─────────┘   │    │
│  │             │                       │             │    │
│  │             │  HTTP API             │             │    │
│  │             └───────────────────────┘             │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Volumes                           │    │
│  │                                                      │    │
│  │  ┌──────────────────┐  ┌──────────────────────┐    │    │
│  │  │ ./repos:/repos   │  │ gitnexus-data:       │    │    │
│  │  │ (bind mount)     │  │ /root/.gitnexus      │    │    │
│  │  │                  │  │ (named volume)       │    │    │
│  │  └──────────────────┘  └──────────────────────┘    │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

See [DOCKER.md](../DOCKER.md) for detailed Docker documentation.

---

## Quick Reference

For complete containerization details, examples, and troubleshooting, see:

- [DOCKER.md](../DOCKER.md) - Complete Docker guide
- [USAGE_GUIDE.md](../USAGE_GUIDE.md) - Usage examples
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

---

## License

PolyForm Noncommercial 1.0.0
