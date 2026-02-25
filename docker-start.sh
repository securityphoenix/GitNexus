#!/bin/bash

# GitNexus Docker Quick Start Script
# This script helps you get GitNexus running in Docker quickly

set -e

echo "🚀 GitNexus Docker Setup"
echo "========================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create repos directory if it doesn't exist
if [ ! -d "repos" ]; then
    echo "📁 Creating repos directory..."
    mkdir -p repos
fi

# Ask user what they want to do
echo "What would you like to do?"
echo "1) Start GitNexus (Web UI + Server)"
echo "2) Index a repository"
echo "3) Stop GitNexus"
echo "4) View logs"
echo "5) Clean up everything"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🏗️  Building and starting GitNexus..."
        docker-compose up -d --build
        echo ""
        echo "✅ GitNexus is running!"
        echo ""
        echo "🌐 Access the Web UI at: http://localhost:8080"
        echo "🔌 API Server at: http://localhost:3000"
        echo ""
        echo "📊 View logs: docker-compose logs -f"
        echo "🛑 Stop: docker-compose down"
        ;;
    2)
        echo ""
        read -p "Enter the path to your repository: " repo_path
        
        if [ ! -d "$repo_path" ]; then
            echo "❌ Directory not found: $repo_path"
            exit 1
        fi
        
        # Get repo name
        repo_name=$(basename "$repo_path")
        
        # Copy repo to repos directory
        echo "📦 Copying repository to repos/$repo_name..."
        cp -r "$repo_path" "repos/$repo_name"
        
        # Check if container is running
        if ! docker-compose ps | grep -q "gitnexus-server.*Up"; then
            echo "🏗️  Starting GitNexus server..."
            docker-compose up -d gitnexus-server
            sleep 5
        fi
        
        echo "🔍 Indexing repository..."
        docker-compose exec gitnexus-server npx gitnexus analyze "/repos/$repo_name"
        
        echo ""
        echo "✅ Repository indexed successfully!"
        echo "🌐 View it in the Web UI: http://localhost:8080"
        ;;
    3)
        echo ""
        echo "🛑 Stopping GitNexus..."
        docker-compose down
        echo "✅ GitNexus stopped"
        ;;
    4)
        echo ""
        echo "📊 Showing logs (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    5)
        echo ""
        read -p "⚠️  This will remove all containers, volumes, and indexed data. Continue? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo "🧹 Cleaning up..."
            docker-compose down -v
            rm -rf repos/*
            echo "✅ Cleanup complete"
        else
            echo "❌ Cancelled"
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
