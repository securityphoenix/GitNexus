# GitNexus Docker Guide

This guide explains how to run GitNexus in Docker containers.

## Quick Start

### Using Docker Compose (Recommended)

Run both the CLI server and Web UI together:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access:
- **Web UI**: http://localhost:8080
- **API Server**: http://localhost:4747

### Index a Repository

```bash
# Place your repo in ./repos/
mkdir -p repos
cp -r /path/to/your/project repos/my-project

# Index it
docker-compose exec gitnexus-server npx gitnexus analyze /repos/my-project

# Check status
docker-compose exec gitnexus-server npx gitnexus list
```

The Web UI will automatically detect the server and show all indexed repos.

---

## Individual Containers

### CLI/MCP Server

Build and run the GitNexus CLI server:

```bash
cd gitnexus
docker build -t gitnexus-cli .

# Run HTTP server
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/repos:/repos \
  -v gitnexus-data:/root/.gitnexus \
  --name gitnexus-server \
  gitnexus-cli serve

# Index a repository
docker exec gitnexus-server npx gitnexus analyze /repos/my-project

# Run MCP server (stdio mode)
docker run -i gitnexus-cli mcp
```

### Web UI

Build and run the Web UI:

```bash
cd gitnexus-web
docker build -t gitnexus-web .

# Run standalone (in-browser mode)
docker run -d -p 8080:80 --name gitnexus-web gitnexus-web

# Run with backend connection
docker run -d \
  -p 8080:80 \
  -e VITE_BACKEND_URL=http://localhost:3000 \
  --name gitnexus-web \
  gitnexus-web
```

Access at http://localhost:8080

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Docker Network                     │
│                                                      │
│  ┌──────────────────┐       ┌──────────────────┐   │
│  │  gitnexus-web    │       │ gitnexus-server  │   │
│  │  (Nginx + React) │◄──────┤ (Node.js + MCP)  │   │
│  │  Port: 8080      │       │ Port: 3000       │   │
│  └──────────────────┘       └──────────────────┘   │
│           │                          │              │
│           │                          │              │
└───────────┼──────────────────────────┼──────────────┘
            │                          │
            ▼                          ▼
      Browser Access            Volume: gitnexus-data
   http://localhost:8080        (Persistent indexes)
```

---

## Environment Variables

### gitnexus-server

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | HTTP server port | `3000` |

### gitnexus-web

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend API URL | - |

---

## Volume Mounts

### Persistent Data

```bash
# Named volume for indexes
-v gitnexus-data:/root/.gitnexus

# Mount repositories to analyze
-v /path/to/repos:/repos

# Mount specific project
-v /path/to/project:/workspace
```

### Example: Index Multiple Repos

```yaml
services:
  gitnexus-server:
    volumes:
      - ~/projects/app1:/repos/app1
      - ~/projects/app2:/repos/app2
      - ~/projects/app3:/repos/app3
      - gitnexus-data:/root/.gitnexus
```

Then index each:

```bash
docker-compose exec gitnexus-server npx gitnexus analyze /repos/app1
docker-compose exec gitnexus-server npx gitnexus analyze /repos/app2
docker-compose exec gitnexus-server npx gitnexus analyze /repos/app3
```

---

## Production Deployment

### Using Docker Compose with External Network

```yaml
version: '3.8'

services:
  gitnexus-server:
    image: gitnexus-cli:latest
    restart: always
    environment:
      - NODE_ENV=production
    volumes:
      - /var/lib/gitnexus:/root/.gitnexus
    networks:
      - internal

  gitnexus-web:
    image: gitnexus-web:latest
    restart: always
    environment:
      - VITE_BACKEND_URL=https://api.yourdomain.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gitnexus.rule=Host(`gitnexus.yourdomain.com`)"
    networks:
      - internal
      - web

networks:
  internal:
  web:
    external: true
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitnexus-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gitnexus-server
  template:
    metadata:
      labels:
        app: gitnexus-server
    spec:
      containers:
      - name: gitnexus
        image: gitnexus-cli:latest
        args: ["serve"]
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: data
          mountPath: /root/.gitnexus
        - name: repos
          mountPath: /repos
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: gitnexus-data
      - name: repos
        persistentVolumeClaim:
          claimName: gitnexus-repos
---
apiVersion: v1
kind: Service
metadata:
  name: gitnexus-server
spec:
  selector:
    app: gitnexus-server
  ports:
  - port: 3000
    targetPort: 3000
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs gitnexus-server
docker-compose logs gitnexus-web

# Rebuild
docker-compose up -d --build
```

### Out of memory during indexing

Increase Docker memory limit:

```yaml
services:
  gitnexus-server:
    deploy:
      resources:
        limits:
          memory: 4G
```

### Web UI can't connect to server

Check network connectivity:

```bash
# From web container
docker-compose exec gitnexus-web wget -O- http://gitnexus-server:3000/health

# Check environment
docker-compose exec gitnexus-web env | grep BACKEND
```

### Permission issues with volumes

```bash
# Fix ownership
docker-compose exec gitnexus-server chown -R node:node /root/.gitnexus
```

---

## Development

### Hot Reload Development

```yaml
services:
  gitnexus-server:
    build:
      context: ./gitnexus
      target: development
    volumes:
      - ./gitnexus/src:/app/src
    command: npm run dev

  gitnexus-web:
    build:
      context: ./gitnexus-web
      target: development
    volumes:
      - ./gitnexus-web/src:/app/src
    command: npm run dev
```

### Build Multi-Architecture Images

```bash
# Setup buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t gitnexus-cli:latest \
  --push \
  ./gitnexus
```

---

## Security Considerations

1. **Network Isolation**: Use internal networks for service-to-service communication
2. **Volume Permissions**: Ensure proper file permissions on mounted volumes
3. **Environment Variables**: Use Docker secrets for sensitive data
4. **Image Scanning**: Scan images for vulnerabilities before deployment
5. **Resource Limits**: Set memory and CPU limits to prevent resource exhaustion

```yaml
services:
  gitnexus-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

---

## Performance Optimization

### Multi-Stage Builds

The Dockerfiles use multi-stage builds to minimize image size:

- **Builder stage**: Installs all dependencies and builds
- **Production stage**: Only includes runtime dependencies

### Caching

```bash
# Use BuildKit for better caching
DOCKER_BUILDKIT=1 docker build -t gitnexus-cli ./gitnexus

# Cache npm dependencies
docker build --cache-from gitnexus-cli:latest -t gitnexus-cli ./gitnexus
```

### Health Checks

Add health checks to docker-compose.yml:

```yaml
services:
  gitnexus-server:
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## License

GitNexus is licensed under PolyForm Noncommercial 1.0.0. See LICENSE for details.
