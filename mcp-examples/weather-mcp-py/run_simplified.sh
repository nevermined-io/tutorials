#!/bin/bash
# Script para ejecutar el Weather MCP Server con Simplified API

set -e  # Exit on error

echo "🚀 Starting Weather MCP Server (Simplified API)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo ""
    echo "📝 Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env created. Please edit it with your credentials:"
        echo "   - NVM_SERVER_API_KEY"
        echo "   - NVM_AGENT_ID"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo "❌ Error: .env.example not found either"
        echo ""
        echo "Please create .env manually with:"
        echo "  NVM_SERVER_API_KEY=your-api-key"
        echo "  NVM_AGENT_ID=did:nv:your-agent-id"
        echo "  NVM_ENV=staging_sandbox"
        echo "  PORT=5001"
        exit 1
    fi
fi

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "⚠️  Warning: No virtual environment found"
    echo ""
    echo "💡 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
    echo ""
fi

# Activate virtual environment if exists
if [ -d "venv" ]; then
    echo "🔄 Activating virtual environment..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "🔄 Activating virtual environment..."
    source .venv/bin/activate
fi

# Install/upgrade dependencies if needed
echo "📦 Checking dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "✅ Dependencies ready"
echo ""

# Run server
echo "🚀 Starting server on port ${PORT:-5001}..."
echo ""
python src/server.py



