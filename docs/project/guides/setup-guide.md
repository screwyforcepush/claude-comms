# Setup Guide

**Time to Complete**: < 5 minutes for quick start, 15 minutes for full setup  
**Prerequisites**: Basic terminal knowledge  
**Difficulty**: Beginner

The fastest way to get the Claude Code Multi-Agent Observability & Communication System running and monitoring your projects.

## 🚀 Quick Start (< 5 Minutes)

### Step 1: Clone and Start (2 minutes)
```bash
# 1. Clone the repository
git clone [repository-url]
cd claude-code-hooks-multi-agent-observability

# 2. Start the system (auto-installs dependencies)
./scripts/start-system.sh

# 3. Open the dashboard
open http://localhost:5173
```

### Step 2: Enable Monitoring (1 minute)
```bash
# Copy .claude directory to your project
cp -R .claude /path/to/your/project/

# That's it! Your project is now monitored
```

### Step 3: Test It Works (1 minute)
```bash
# In your monitored project, run any Claude Code command:
cd /path/to/your/project
echo "What files are in this project?" | claude

# Watch events appear in your dashboard at http://localhost:5173
```

**🎉 You're done!** Events from your Claude Code usage will now stream live to your dashboard.

---

## 📋 Prerequisites

Before starting, ensure you have:

### Required Software
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[Astral uv](https://docs.astral.sh/uv/)** - Fast Python package manager
- **[Bun](https://bun.sh/)** or npm/yarn - JavaScript runtime
- **Python 3.8+** - For hook scripts
- **Node.js 18+** - For client development

### Platform Support
- **macOS** (recommended)
- **Linux** (Ubuntu, Debian, CentOS, etc.)
- **Windows** (via WSL recommended)

### API Keys
- **Anthropic API Key** (required) - Get from [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key** (optional) - For additional AI features
- **ElevenLabs API Key** (optional) - For text-to-speech

---

## 🛠️ Installation Methods

Choose the installation method that fits your setup:

### Method 1: One-Command Install (Recommended)

**macOS:**
```bash
# Install dependencies via Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install python node
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://claude.ai/install.sh | sh

# Clone and start
git clone [repository-url]
cd claude-code-hooks-multi-agent-observability
./scripts/start-system.sh
```

**Linux (Ubuntu/Debian):**
```bash
# Install dependencies
sudo apt update && sudo apt install python3 python3-pip nodejs npm curl git -y
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://claude.ai/install.sh | sh

# Clone and start
git clone [repository-url]
cd claude-code-hooks-multi-agent-observability
./scripts/start-system.sh
```

**Windows (WSL):**
```bash
# Enable WSL and install Ubuntu
wsl --install

# Follow Linux installation steps within WSL
```

### Method 2: Manual Installation

#### Step 1: Install Dependencies
```bash
# Verify installations
claude --version
python3 --version
uv --version
bun --version
node --version
```

#### Step 2: Environment Configuration
```bash
# Copy environment template
cp .env.sample .env

# Edit .env with your API keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # Optional
ELEVEN_API_KEY=your_elevenlabs_api_key_here  # Optional
ENGINEER_NAME=Your Name  # Optional
```

#### Step 3: Start Services
```bash
# Method A: Use start script (recommended)
./scripts/start-system.sh

# Method B: Manual startup
cd apps/server && bun dev &
cd apps/client && npm run dev &
```

### Method 3: Development Setup

For contributing or advanced customization:

```bash
# Clone repository
git clone [repository-url]
cd claude-code-hooks-multi-agent-observability

# Install dependencies
cd apps/server && bun install
cd ../client && npm install

# Build applications
cd apps/server && bun run typecheck
cd ../client && npm run build

# Start development servers
./scripts/start-system.sh --dev
```

---

## ⚙️ Configuration

### Server Configuration

The server uses these default settings:
- **Port**: 4000
- **Database**: SQLite with WAL mode
- **WebSocket**: Real-time event streaming
- **CORS**: Enabled for development

**Custom Port:**
```bash
# Set custom server port
export SERVER_PORT=8080
./scripts/start-system.sh
```

### Client Configuration

**Environment Variables:**
```bash
# Create client .env file
echo "VITE_MAX_EVENTS_TO_DISPLAY=100" > apps/client/.env
echo "VITE_SERVER_URL=http://localhost:4000" >> apps/client/.env
```

**Performance Tuning:**
```bash
# For systems with limited resources
echo "VITE_MAX_EVENTS_TO_DISPLAY=50" > apps/client/.env
echo "VITE_REFRESH_INTERVAL=5000" >> apps/client/.env
```

### Database Configuration

The system automatically:
- Creates SQLite database at `apps/server/events.db`
- Sets up tables for events, agents, and messages
- Enables WAL mode for optimal performance
- Handles schema migrations

**Manual Database Reset:**
```bash
./scripts/reset-system.sh
# Choose 'y' when prompted to clear database
```

---

## 🔧 Verification & Testing

### Verify Installation
```bash
# Check all dependencies
claude --version
python3 --version && uv --version
bun --version && node --version

# Verify API connectivity
echo $ANTHROPIC_API_KEY | cut -c1-10  # Should show first 10 chars
```

### Test System Functionality

#### 1. Start and Access
```bash
./scripts/start-system.sh
```
Expected output:
```
✅ Server running on http://localhost:4000
✅ Client running on http://localhost:5173
🎯 Dashboard: http://localhost:5173
```

#### 2. Verify Dashboard
- Open `http://localhost:5173`
- See "Multi-Agent Observability Dashboard"
- Both "Event Timeline" and "Agent Communications" tabs visible

#### 3. Test Event Generation
```bash
# Generate test event
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test",
    "session_id": "test-123",
    "hook_event_type": "PreToolUse",
    "payload": {"tool_name": "Bash", "tool_input": {"command": "echo hello"}}
  }'

# Verify in dashboard - event should appear in timeline
```

#### 4. Test Real Claude Code Integration
```bash
# In the observability project directory
echo "List files in this directory" | claude

# Should see events appear in dashboard immediately
```

#### 5. Run System Tests
```bash
# Comprehensive system validation
./scripts/test-system.sh

# Expected: All tests pass with ✅ status
```

---

## 🚨 Troubleshooting

### Common Issues

#### "Command not found" Errors
```bash
# Reinstall Claude Code
curl -fsSL https://claude.ai/install.sh | sh

# Reinstall uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH (restart terminal after)
export PATH="$HOME/.local/bin:$PATH"  # For uv
export PATH="$HOME/.bun/bin:$PATH"    # For bun
```

#### Server Won't Start
```bash
# Check port conflicts
lsof -i :4000
sudo kill -9 $(lsof -t -i:4000)

# Reset system
./scripts/reset-system.sh
./scripts/start-system.sh
```

#### No Events Appearing
```bash
# Verify .claude directory copied correctly
ls -la /path/to/your/project/.claude/

# Test hooks manually
cd /path/to/your/project
uv run .claude/hooks/observability/send_event.py --source-app test --event-type test

# Check server is running
curl http://localhost:4000/events/recent
```

#### API Key Issues
```bash
# Verify environment setup
cat .env
source .env
echo $ANTHROPIC_API_KEY
```

### Advanced Troubleshooting

#### Debug Mode
```bash
export DEBUG=true
./scripts/start-system.sh --verbose
```

#### Network Configuration
```bash
# Use different ports if needed
export SERVER_PORT=8080
export CLIENT_PORT=3000
./scripts/start-system.sh
```

#### Performance Issues
```bash
# Lightweight mode
echo "VITE_MAX_EVENTS_TO_DISPLAY=25" > apps/client/.env
export LIGHTWEIGHT_MODE=true
```

### Getting Help

1. **Check logs**: `tail -f apps/server/server.log`
2. **Run diagnostics**: `./scripts/test-system.sh`
3. **Create minimal test**: `./scripts/minimal-test.sh`
4. **Reset everything**: `./scripts/reset-system.sh`

---

## 🎯 Next Steps

After successful setup:

1. **🎨 Explore Dashboard**: Navigate Event Timeline and Agent Communications
2. **📖 Integration Guide**: [Configure hook integration](integration-guide.md)
3. **🏗️ Architecture**: [Understand system design](architecture/system-overview.md)
4. **🔗 API Reference**: [Explore endpoints](api-reference.md)
5. **🤝 Multi-Agent**: [Enable agent communication](agent-communication.md)

---

## 📚 Related Documentation

**📦 Setup**: [Installation Guide](installation-guide.md) - Complete detailed setup  
**🔗 Integration**: [Integration Guide](integration-guide.md) - Hook configuration  
**🔧 Configuration**: [Configuration Guide](configuration.md) - Advanced settings  
**🐛 Troubleshooting**: [Common Issues](troubleshooting.md) - Detailed solutions  
**🏗️ Architecture**: [System Overview](architecture/system-overview.md) - Technical details

---

*For detailed installation with platform-specific instructions, see the [complete installation guide](installation-guide.md).*