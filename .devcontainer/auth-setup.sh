#!/bin/bash
set -eo pipefail

echo "🔐 Setting up tool authentication..."

# Authenticate GitHub CLI with PAT token
if [ -n "${GH_TOKEN:-}" ]; then
    echo "🔑 Authenticating GitHub CLI..."
    echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null || {
        echo "⚠️  GitHub CLI authentication had warnings but may be working"
    }
    if gh auth status > /dev/null 2>&1; then
        echo "✅ GitHub CLI authenticated successfully"
        # Set git to use HTTPS with token for this session
        gh auth setup-git 2>/dev/null || echo "⚠️  Git setup completed with warnings"
    else
        echo "❌ GitHub CLI authentication failed"
    fi
else
    echo "⚠️  No GH_TOKEN found - GitHub CLI not authenticated"
fi

# Verify Node.js and npm are available
if command -v node > /dev/null 2>&1; then
    echo "✅ Node.js $(node --version) is available"
else
    echo "❌ Node.js not found"
fi

if command -v npm > /dev/null 2>&1; then
    echo "✅ npm $(npm --version) is available"
else
    echo "❌ npm not found"
fi

# Check Claude Code installation
if command -v claude > /dev/null 2>&1; then
    echo "✅ Claude Code CLI is available"
    echo "ℹ️  To authenticate: claude auth login"
else
    echo "❌ Claude Code CLI not found"
fi

echo "🎉 Tool setup completed!"