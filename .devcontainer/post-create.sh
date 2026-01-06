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
    ripgrep \
    chromium \
    > /dev/null 2>&1

# Install uv - Fast Python package manager
echo "📦 Installing uv (fast Python package manager)..."
curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1

# Add uv to PATH immediately
export PATH="$PATH:$HOME/.local/bin"

# Install common Python packages including requests and tiktoken
echo "📦 Installing common Python packages..."
sudo apt-get install -y --no-install-recommends python3-requests > /dev/null 2>&1

# Install tiktoken using pip with --break-system-packages flag  
echo "📦 Installing tiktoken..."
pip3 install --break-system-packages tiktoken > /dev/null 2>&1

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
echo "   - Python packages: uv pip install <package> (in venv) or pip install <package>"
echo "   - Node packages: npm install [-g] <package>"
echo "   - Fast Python tools: uv venv, uv pip, uv run"
echo "   - Pre-installed: python3-requests library available globally"
echo "   - Any other tools the agent needs!"

# Configure locale settings in user's bashrc
echo "" >> ~/.bashrc
echo "# Locale configuration" >> ~/.bashrc
echo "export LANG=en_US.UTF-8" >> ~/.bashrc
echo "export LC_ALL=en_US.UTF-8" >> ~/.bashrc

# Add uv to PATH in bashrc for future sessions
echo "" >> ~/.bashrc
echo "# Add uv to PATH" >> ~/.bashrc
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc

# Install tmux helper for sandbox sessions
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/smux" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

PHONETIC=(alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu)

find_free() {
    for n in "${PHONETIC[@]}"; do
        tmux has-session -t "$n" 2>/dev/null || { echo "$n"; return; }
    done
    echo "session-$(date +%s)"
}

case "${1:-}" in
    ls)
        tmux ls
        exit 0
        ;;
    kill)
        shift
        tmux kill-session -t "${1:?session name}"
        exit 0
        ;;
esac

session="${1:-$(find_free)}"
shift || true
cmd="${*:-${SHELL:-/bin/bash}}"

tmux has-session -t "$session" 2>/dev/null || tmux new-session -d -s "$session" "$cmd"
tmux attach -t "$session"
EOF
chmod +x "$HOME/.local/bin/smux"

# Add helper alias for bash/zsh shells
touch ~/.bashrc ~/.zshrc
if ! grep -q 'alias smux=' ~/.bashrc 2>/dev/null; then
    echo 'alias smux="$HOME/.local/bin/smux"' >> ~/.bashrc
fi
if ! grep -q 'alias smux=' ~/.zshrc 2>/dev/null; then
    echo 'alias smux="$HOME/.local/bin/smux"' >> ~/.zshrc
fi

echo ""
echo "🌍 Locale configured: en_US.UTF-8"
echo "⚡ uv installed: Fast Python package management available"

# Install Chrome MCP wrapper for containerized environments
echo ""
echo "🌐 Installing Chrome MCP wrapper..."
echo '#!/usr/bin/env bash
# Chrome wrapper for MCP in containerized environments
# Required: --no-sandbox flag for Docker/devcontainer compatibility
exec /usr/bin/chromium --no-sandbox "$@"' | sudo tee /usr/local/bin/chromium-mcp > /dev/null
sudo chmod +x /usr/local/bin/chromium-mcp
echo "✅ Chrome MCP wrapper installed at /usr/local/bin/chromium-mcp"

# Install Claude MCP servers
echo ""
echo "🔌 Installing Claude MCP servers..."

# Install Perplexity Ask MCP server if API key is available
if [ -n "${PERPLEXITY_API_KEY:-}" ]; then
    echo "   Installing perplexity-ask MCP server..."
    claude mcp add perplexity-ask --scope user -- env PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY}" npx -y server-perplexity-ask
    echo "   ✅ perplexity-ask MCP server installed"
else
    echo "   ⚠️  Skipping perplexity-ask (no PERPLEXITY_API_KEY found)"
fi

echo ""
echo "✅ Claude MCP servers configured"

# Install Codex
echo ""
echo "🤖 Installing Codex..."
npm install -g @openai/codex > /dev/null 2>&1
echo "   ✅ Codex installed"

# Install Gemini CLI
echo ""
echo "💎 Installing Gemini CLI..."
npm install -g @google/gemini-cli@latest > /dev/null 2>&1
echo "   ✅ Gemini CLI installed"

# Install ast-grep
echo ""
echo "🔍 Installing ast-grep..."
npm install -g @ast-grep/cli > /dev/null 2>&1
echo "   ✅ ast-grep installed"

# Create Codex configuration directory
mkdir -p ~/.codex

# Create Codex config.toml
echo "   Creating Codex configuration..."
cat > ~/.codex/config.toml <<EOF
model_reasoning_effort = "high"
ask-for-approval = "never"
sandbox_mode = "danger-full-access"
trust_level = "trusted"


[mcp_servers."chrome-devtools"]
command = "npx"
args = ["chrome-devtools-mcp@latest", "--executablePath=/usr/local/bin/chromium-mcp", "--headless=true", "--isolated=true"]

[mcp_servers."perplexity-ask"]
command = "npx"
args = ["-y", "server-perplexity-ask"]
env = { "PERPLEXITY_API_KEY" = "${PERPLEXITY_API_KEY}" }
EOF

# Create Codex auth.json if CODEX_AUTH_JSON is available
if [ -n "${CODEX_AUTH_JSON:-}" ]; then
    echo "   Creating Codex authentication file..."
    echo "${CODEX_AUTH_JSON}" > ~/.codex/auth.json
    echo "   ✅ Codex authentication configured"
else
    echo "   ⚠️  Skipping Codex auth (no CODEX_AUTH_JSON found)"
fi

echo "✅ Codex configured"

# Create Convex configuration if access token is available
if [ -n "${CONVEX_ACCESS_TOKEN:-}" ]; then
    echo ""
    echo "⚡ Configuring Convex..."
    mkdir -p /home/node/.convex
    cat > /home/node/.convex/config.json <<EOF
{
  "accessToken": "${CONVEX_ACCESS_TOKEN}"
}
EOF
    echo "   ✅ Convex configured"
else
    echo ""
    echo "   ⚠️  Skipping Convex config (no CONVEX_ACCESS_TOKEN found)"
fi

# Clear sensitive tokens from environment
unset GITHUB_TOKEN
unset PERPLEXITY_API_KEY
unset CODEX_AUTH_JSON
unset CONVEX_ACCESS_TOKEN
