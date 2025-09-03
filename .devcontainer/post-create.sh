#!/bin/bash
set -euo pipefail

echo "🔒 Setting up secure sandbox environment..."

# Validate required environment variables
if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable is not set"
    exit 1
fi

if [ -z "${REPO_URL:-}" ]; then
    echo "❌ Error: REPO_URL environment variable is not set"
    exit 1
fi

# Set default branch if not specified
BRANCH_NAME="${BRANCH_NAME:-main}"

# Configure git to use token for authentication via helper
git config --global user.email "claude-agent@anthropic.com"
git config --global user.name "Claude Agent"

# Use a more secure credential helper configuration
git config --global credential.helper 'cache --timeout=3600'
git config --global credential.https://github.com.username oauth2

# Store token using git credential helper (more secure than .git-credentials file)
printf "protocol=https\nhost=github.com\nusername=oauth2\npassword=%s\n\n" "${GITHUB_TOKEN}" | git credential-cache store

# DevPod should have already cloned the repository
# We just need to ensure we're in the right directory and set up Git auth

# Find the repository directory
if [ -d "/workspace/.git" ]; then
    cd /workspace
elif [ -d "/workspaces/${REPO_NAME}/.git" ]; then  
    cd "/workspaces/${REPO_NAME}"
elif [ -d ".git" ]; then
    # Already in repo directory
    :
else
    echo "⚠️  Warning: Could not find Git repository. DevPod should have cloned it."
    echo "   You may need to clone manually if needed."
fi

# If we're in a git repo, show current status and handle branch
if [ -d ".git" ]; then
    echo "📦 Repository information:"
    echo "   Location: $(pwd)"
    echo "   Remote: $(git remote get-url origin 2>/dev/null || echo 'No remote configured')"
    echo "   Current Branch: $(git branch --show-current 2>/dev/null || echo 'No branch')"
    
    # Handle branch creation if BRANCH_NAME is specified and different from current
    if [ -n "${BRANCH_NAME:-}" ]; then
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
        if [ "${CURRENT_BRANCH}" != "${BRANCH_NAME}" ]; then
            echo ""
            echo "🌿 Switching to branch: ${BRANCH_NAME}"
            
            # Try to checkout existing branch or create new one
            if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH_NAME}"; then
                echo "   Branch exists on remote, checking out..."
                git checkout "${BRANCH_NAME}"
            else
                echo "   Branch doesn't exist, creating new branch..."
                git checkout -b "${BRANCH_NAME}"
                echo "   📤 Branch created locally. Push when ready with:"
                echo "      git push -u origin ${BRANCH_NAME}"
            fi
        fi
    fi
    echo ""
fi

# Install commonly needed tools
echo "📦 Installing essential development tools..."
sudo apt-get update > /dev/null 2>&1
sudo apt-get install -y --no-install-recommends \
    curl \
    wget \
    jq \
    tree \
    htop \
    build-essential \
    python3-pip \
    vim \
    tmux \
    > /dev/null 2>&1

# Install uv - Fast Python package manager
echo "📦 Installing uv (fast Python package manager)..."
curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1

# Source the uv environment to make it available immediately
if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi

echo ""
echo "✅ Sandbox environment ready!"
echo ""
echo "📋 Environment details:"
echo "   Repository: ${REPO_OWNER}/${REPO_NAME}"
echo "   Branch: ${BRANCH_NAME}"
echo "   Working directory: $(pwd)"
echo ""
echo "🔒 Security features enabled:"
echo "   - Running as non-root user (with sudo in container)"
echo "   - No host privilege escalation"
echo "   - Full repository access via PAT token"
echo "   - Token cached in memory (not on disk)"
echo "   - Isolated environment"
echo ""
echo "📦 Package installation:"
echo "   - System packages: sudo apt-get install <package>"
echo "   - Python packages: uv pip install <package> (or pip install <package>)"
echo "   - Node packages: npm install [-g] <package>"
echo "   - Fast Python tools: uv venv, uv pip, uv run"
echo "   - Any other tools the agent needs!"

# Configure locale settings in user's bashrc
echo "" >> ~/.bashrc
echo "# Locale configuration" >> ~/.bashrc
echo "export LANG=en_US.UTF-8" >> ~/.bashrc
echo "export LC_ALL=en_US.UTF-8" >> ~/.bashrc

# Add uv to PATH in bashrc for future sessions
echo "" >> ~/.bashrc
echo "# Add uv to PATH" >> ~/.bashrc
echo 'if [ -f "$HOME/.cargo/env" ]; then' >> ~/.bashrc
echo '    . "$HOME/.cargo/env"' >> ~/.bashrc
echo 'fi' >> ~/.bashrc

echo ""
echo "🌍 Locale configured: en_US.UTF-8"
echo "⚡ uv installed: Fast Python package management available"

# Clear sensitive tokens from environment
unset GITHUB_TOKEN
unset CLAUDE_CODE_OAUTH_TOKEN