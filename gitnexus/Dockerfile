# GitNexus CLI/MCP Server Dockerfile
# This container runs the GitNexus CLI and MCP server for code intelligence

FROM node:20-bookworm

# Install system dependencies for native modules (tree-sitter, kuzu, bcrypt)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    build-essential \
    g++ \
    make \
    cmake \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove the prepare script to prevent build during install
RUN jq 'del(.scripts.prepare)' package.json > package.json.tmp && mv package.json.tmp package.json

# Install dependencies (native modules will be compiled)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Restore original package.json for proper build
COPY package.json ./

# Build TypeScript
RUN npm run build || (echo "Build failed, checking for dist..." && ls -la dist/ 2>/dev/null || exit 1)

# Create directory for indexed repositories
RUN mkdir -p /root/.gitnexus

# Expose port for HTTP server (gitnexus serve)
EXPOSE 4747

# Default command runs HTTP server
CMD ["node", "dist/cli/index.js", "serve"]

# Usage examples:
# Build: docker build -t gitnexus-cli .
# Run HTTP server: docker run -p 3000:3000 gitnexus-cli
# Run MCP server: docker run -i gitnexus-cli mcp
# Index a repo: docker run -v /path/to/repo:/repo gitnexus-cli analyze /repo
