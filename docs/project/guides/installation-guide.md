[← Back to Main Documentation](../../../README.md) → [Technical Guides](../README.md) → Installation Guide

# Installation Guide

**Time to Complete**: 10-15 minutes  
**Prerequisites**: Basic terminal/command line knowledge  
**Difficulty**: Beginner

A comprehensive guide to installing and configuring the Claude Code Multi-Agent Observability & Communication System.

## Prerequisites

Before getting started, ensure you have the following installed on your system:

### Required Software
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI for Claude
- **[Astral uv](https://docs.astral.sh/uv/)** - Fast Python package manager (required for hook scripts)
- **[Bun](https://bun.sh/)**, **npm**, or **yarn** - For running the server and client
- **Node.js** - Required for client development
- **Python 3.8+** - Required for hook scripts

### Required API Keys
- **Anthropic API Key** - Set as `ANTHROPIC_API_KEY` environment variable (required)

### Optional API Keys
- **OpenAI API Key** - For multi-model support with just-prompt MCP tool
- **ElevenLabs API Key** - For audio features and TTS notifications
- **Google Gemini API Key** - For additional AI model support

### Platform Support
This system supports:
- **macOS** (recommended)
- **Linux** (Ubuntu, Debian, CentOS, etc.)
- **Windows** (via WSL recommended)

## Quick Start

The fastest way to get the system running:

```bash
# 1. Clone the repository
git clone [repository-url]
cd claude-code-hooks-multi-agent-observability

# 2. Start both server and client
./scripts/start-system.sh

# 3. Open http://localhost:5173 in your browser

# 4. Open Claude Code and run any command to see events stream
# Example: Run git ls-files to understand the codebase.

# 5. Copy the .claude folder to other projects you want to monitor
cp -R .claude /path/to/your/project/
```

## Detailed Setup

### Step 1: System Installation

#### For macOS
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install python
brew install node
curl -fsSL https://bun.sh/install | bash

# Install Astral uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | sh
```

#### For Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Python and Node.js
sudo apt install python3 python3-pip nodejs npm

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Astral uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | sh
```

#### For Windows (WSL recommended)
```bash
# Enable WSL and install Ubuntu
wsl --install

# Follow Linux installation steps above within WSL
```

### Step 2: Environment Configuration

#### Application Root Configuration
Create a `.env` file in the project root with your API keys:

```bash
# Copy the sample environment file
cp .env.sample .env

# Edit .env file with your API keys
```

Required environment variables:
```env
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional
OPENAI_API_KEY=your_openai_api_key_here
ELEVEN_API_KEY=your_elevenlabs_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ENGINEER_NAME=Your Name
```

#### Client Configuration
Create environment configuration for the client:

```bash
# Create client environment file
echo "VITE_MAX_EVENTS_TO_DISPLAY=100" > apps/client/.env
```

### Step 3: .claude Directory Integration

To enable observability in your own projects:

#### 3.1 Copy .claude Directory
```bash
# Copy the entire .claude directory to your project root
cp -R .claude /path/to/your/project/
```

#### 3.2 Update Configuration
Open `.claude/settings.json` in your project and modify the `source-app` parameter:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "uv run .claude/hooks/pre_tool_use.py"
        },
        {
          "type": "command",
          "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse --summarize"
        }
      ]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "uv run .claude/hooks/post_tool_use.py"
        },
        {
          "type": "command",
          "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type PostToolUse --summarize"
        }
      ]
    }],
    "UserPromptSubmit": [{
      "hooks": [
        {
          "type": "command",
          "command": "uv run .claude/hooks/user_prompt_submit.py --log-only"
        },
        {
          "type": "command",
          "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type UserPromptSubmit --summarize"
        }
      ]
    }]
    // ... (similar patterns for Notification, Stop, SubagentStop, PreCompact)
  }
}
```

Replace `YOUR_PROJECT_NAME` with a unique identifier for your project (e.g., `my-api-server`, `react-app`, etc.).

#### 3.3 Start Observability Server
Ensure the observability server is running:

```bash
# From the observability project directory (this codebase)
./scripts/start-system.sh
```

## Platform-Specific Instructions

### macOS Specific Setup

#### Permissions
You may need to grant permissions for terminal applications:
```bash
# Allow terminal applications in System Preferences > Security & Privacy > Privacy > Full Disk Access
```

#### Path Configuration
Add to your shell profile (`.zshrc` or `.bash_profile`):
```bash
# Add to ~/.zshrc
export PATH="$HOME/.local/bin:$PATH"  # For uv
export PATH="$HOME/.bun/bin:$PATH"    # For bun
```

### Linux Specific Setup

#### Package Dependencies
Install additional dependencies if needed:
```bash
# Ubuntu/Debian
sudo apt install build-essential curl git

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install curl git
```

#### User Permissions
Ensure your user has proper permissions:
```bash
# Add user to necessary groups
sudo usermod -aG sudo $USER
```

### Windows (WSL) Specific Setup

#### WSL Configuration
Configure WSL for optimal performance:
```bash
# Create or edit /etc/wsl.conf
[network]
generateHosts = false

[interop]
enabled = false
appendWindowsPath = false
```

#### File System Access
Access Windows files from WSL:
```bash
# Windows C: drive is accessible at /mnt/c/
cp -R .claude /mnt/c/path/to/your/windows/project/
```

## Verification Steps

### Verify Installation
Run these commands to verify your installation:

```bash
# 1. Check Claude Code
claude --version

# 2. Check Python and uv
python3 --version
uv --version

# 3. Check Bun/Node
bun --version
node --version
npm --version

# 4. Check API connectivity
echo $ANTHROPIC_API_KEY | cut -c1-10  # Should show first 10 chars of key
```

### Test System Functionality

#### 1. Start the System
```bash
./scripts/start-system.sh
```

Expected output:
```
Starting Bun server...
Server is running on http://localhost:4000
Starting Vue client...
Client is running on http://localhost:5173
```

#### 2. Verify Dashboard Access
- Open `http://localhost:5173` in your browser
- You should see the Multi-Agent Observability Dashboard
- Both "Event Timeline" and "Subagent Communications" tabs should be visible

#### 3. Test Event Generation
In Claude Code, run:
```bash
git ls-files
```

You should see events appear in the dashboard timeline in real-time.

#### 4. Test Manual Event
```bash
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test",
    "session_id": "test-123",
    "hook_event_type": "PreToolUse",
    "payload": {"tool_name": "Bash", "tool_input": {"command": "ls"}}
  }'
```

#### 5. Test Multi-Agent Communication
```bash
# Send a test message
uv run .claude/hooks/comms/send_message.py \
  --sender "TestAgent" \
  --message "Hello from installation test!"

# Check for messages
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "TestAgent" \
  --json
```

## Configuration Details

### Server Ports
- **Server**: `4000` (HTTP/WebSocket)
- **Client**: `5173` (Vite dev server)

### Environment Variables Reference

#### Required Variables
- `ANTHROPIC_API_KEY`: Your Anthropic Claude API key

#### Optional Variables
- `OPENAI_API_KEY`: OpenAI API key for additional AI features
- `ELEVEN_API_KEY`: ElevenLabs API key for text-to-speech
- `GEMINI_API_KEY`: Google Gemini API key
- `ENGINEER_NAME`: Your name for logging and identification

#### Client Variables
- `VITE_MAX_EVENTS_TO_DISPLAY`: Maximum events to show in dashboard (default: 100)

### Database Configuration
The system uses SQLite with WAL mode for optimal performance:
- Database file: `apps/server/events.db`
- Tables: `events`, `subagent_registry`, `subagent_messages`
- Automatic schema migrations on startup

## Troubleshooting

### Common Issues

#### "Command not found" Errors

**Problem**: `claude: command not found`
**Solution**:
```bash
# Reinstall Claude Code
curl -fsSL https://claude.ai/install.sh | sh

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"
```

**Problem**: `uv: command not found`
**Solution**:
```bash
# Reinstall Astral uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Restart terminal or reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### Server Connection Issues

**Problem**: Server won't start or times out
**Solutions**:
```bash
# Check if port 4000 is in use
lsof -i :4000

# Kill processes using port 4000
sudo kill -9 $(lsof -t -i:4000)

# Check server logs
tail -f apps/server/server.log

# Restart the system
./scripts/reset-system.sh
./scripts/start-system.sh
```

#### Hook Script Failures

**Problem**: Hooks not executing or showing permission errors
**Solutions**:
```bash
# Make scripts executable
chmod +x .claude/hooks/**/*.py

# Check Python path
which python3
which uv

# Test hook manually
uv run .claude/hooks/send_event.py --help
```

#### API Key Issues

**Problem**: Authentication failures with API keys
**Solutions**:
```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Check .env file format (no spaces around =)
cat .env

# Reload environment
source .env
```

#### Dashboard Not Loading

**Problem**: Browser shows connection refused or blank page
**Solutions**:
```bash
# Check client server status
cd apps/client
npm run dev

# Check for port conflicts
lsof -i :5173

# Clear browser cache and reload
```

#### Events Not Appearing

**Problem**: Claude Code actions don't generate events
**Solutions**:
```bash
# Verify .claude/settings.json is properly configured
cat .claude/settings.json

# Check if observability server is running
curl http://localhost:4000/events/recent

# Test hooks manually
uv run .claude/hooks/send_event.py --source-app test --event-type test
```

### Advanced Troubleshooting

#### Debug Mode
Enable debug logging:
```bash
# Set debug environment variable
export DEBUG=true

# Restart with verbose logging
./scripts/start-system.sh --verbose
```

#### Network Issues
If running in a restricted network environment:
```bash
# Use different ports if needed
export SERVER_PORT=8080
export CLIENT_PORT=3000

# Configure proxy if needed
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
```

#### Performance Issues
For systems with limited resources:
```bash
# Reduce event display limit
echo "VITE_MAX_EVENTS_TO_DISPLAY=50" > apps/client/.env

# Use lightweight mode (fewer AI features)
export LIGHTWEIGHT_MODE=true
```

### Getting Help

If you continue to experience issues:

1. **Check the logs**:
   ```bash
   tail -f apps/server/server.log
   tail -f logs/*.log
   ```

2. **Validate your setup**:
   ```bash
   ./scripts/test-system.sh
   ```

3. **Create a minimal test case**:
   ```bash
   # Test with minimal configuration
   ./scripts/minimal-test.sh
   ```

4. **Report the issue** with:
   - Your operating system and version
   - Node.js, Python, and Claude Code versions
   - Complete error messages
   - Steps to reproduce the issue

## Next Steps

After successful installation:

1. **🎯 Explore the Dashboard**: Navigate through the Event Timeline and Subagent Communications tabs
2. **📖 Read the Architecture Guide**: Understand how the system works
3. **🤝 Try Multi-Agent Examples**: Create test agents to see communication in action
4. **🔗 Integrate with Your Projects**: Copy `.claude` to your development projects
5. **⚙️ Customize Configuration**: Adjust settings for your specific needs

## Related Documentation

📖 **Prerequisites**: [System Requirements](system-requirements.md)  
🔗 **Next Steps**: [Configuration Guide](configuration.md)  
🔧 **Troubleshooting**: [Common Issues](troubleshooting.md)  
🏗️ **Architecture**: [System Overview](architecture/system-overview.md)  
📡 **API Reference**: [Endpoints & Examples](api-reference.md)