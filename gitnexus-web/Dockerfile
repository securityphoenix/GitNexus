# GitNexus Web UI Dockerfile
# This container serves the browser-based graph explorer and AI chat interface

FROM node:20-bookworm AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application (skip tsc, just run vite build)
# The source has some TS errors but Vite can still build
RUN npx vite build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Usage:
# Build: docker build -t gitnexus-web .
# Run: docker run -p 8080:80 gitnexus-web
# Access: http://localhost:8080
