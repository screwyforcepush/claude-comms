# Integration Guide

**Time to Complete**: 5-10 minutes per project  
**Prerequisites**: [Setup completed](setup-guide.md)  
**Difficulty**: Beginner to Intermediate

Complete guide to integrating the Claude Code Multi-Agent Observability & Communication System with your projects. Enable monitoring, agent communication, and custom hook configurations.

## 🎯 Integration Overview

The `.claude` directory contains all the hooks and configuration needed to monitor any Claude Code project. Integration involves:

1. **Copy `.claude` directory** to your project
2. **Configure project identification** in settings
3. **Customize hook behavior** (optional)
4. **Enable multi-agent communication** (optional)

---

## 🚀 Quick Integration (2 Minutes)

### Step 1: Copy Monitoring System
```bash
# Copy .claude directory to your project root
cp -R /path/to/observability-system/.claude /path/to/your/project/

# Verify structure
ls -la /path/to/your/project/.claude/
```

### Step 2: Configure Project Name
```bash
# Edit settings to identify your project
cd /path/to/your/project
```

Edit `.claude/settings.json` and replace `cc-hook-multi-agent-obvs` with your project name:
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse --summarize"
      }]
    }]
  }
}
```

### Step 3: Test Integration
```bash
# Start the observability server (if not running)
cd /path/to/observability-system
./scripts/start-system.sh

# Test in your project
cd /path/to/your/project
echo "What files are in this project?" | claude

# Check dashboard at http://localhost:5173 for events
```

**🎉 Your project is now monitored!**

---

## 📂 .claude Directory Structure

Understanding what gets copied to your project:

```
.claude/
├── settings.json                 # Hook configuration (EDIT THIS)
├── hooks/
│   ├── observability/           # Event monitoring hooks
│   │   └── send_event.py       # Main event sender
│   ├── comms/                  # Multi-agent communication
│   │   ├── send_message.py     # Send messages to agents
│   │   ├── get_unread_messages.py # Check for messages
│   │   ├── register_subagent.py   # Register as agent
│   │   └── update_subagent_completion.py # Update status
│   ├── context/                # Context hooks (future)
│   └── safety/                 # Safety hooks (future)
```

---

## ⚙️ Hook Configuration

### Understanding settings.json

The settings file defines when and how hooks execute:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",  // Optional: regex to match specific scenarios
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse --summarize"
          }
        ]
      }
    ]
  }
}
```

**Key Fields:**
- **`source-app`**: Unique identifier for your project in dashboard
- **`event-type`**: Corresponds to Claude Code hook type
- **`matcher`**: Optional regex filter for when hook should run

### Available Hook Types

| Hook Type | When It Fires | Use Case |
|-----------|---------------|----------|
| `PreToolUse` | Before tool execution | Validation, logging, blocking |
| `PostToolUse` | After tool completion | Result tracking, cleanup |
| `UserPromptSubmit` | User submits prompt | Session analysis, prompt capture |
| `Notification` | User interactions | UX monitoring, alerts |
| `Stop` | Agent stops | Session completion tracking |
| `SubagentStop` | Subagent completes | Multi-agent orchestration |
| `PreCompact` | Before conversation compaction | Archive, backup |

### Hook Parameters

#### send_event.py Parameters
```bash
uv run .claude/hooks/observability/send_event.py \
  --source-app PROJECT_NAME \     # Required: Project identifier
  --event-type EVENT_TYPE \       # Required: Hook event type
  --summarize \                   # Optional: AI summarize the event
  --add-chat \                    # Optional: Include chat transcript
  --priority high|medium|low      # Optional: Event priority
```

**Examples:**
```bash
# Basic event tracking
--source-app my-api --event-type PreToolUse

# Enhanced tracking with AI summary
--source-app my-frontend --event-type PostToolUse --summarize

# Session analysis with chat capture
--source-app my-backend --event-type Stop --add-chat
```

---

## 🤝 Multi-Agent Communication Setup

### Enable Agent Registration

Add agent registration to your hooks:

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/register_subagent.py"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse"
        }
      ]
    }],
    "PostToolUse": [{
      "hooks": [
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/update_subagent_completion.py"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PostToolUse"
        }
      ]
    }]
  }
}
```

### Using Communication Commands

#### Send Messages Between Agents
```bash
# Send message to specific agent
uv run .claude/hooks/comms/send_message.py \
  --sender "YourAgentName" \
  --message "Status update: API implementation complete"

# Send with recipient targeting
uv run .claude/hooks/comms/send_message.py \
  --sender "DataProcessor" \
  --recipient "Frontend" \
  --message "Data schema updated, please refresh interfaces"
```

#### Check for Messages
```bash
# Check unread messages
uv run .claude/hooks/comms/get_unread_messages.py --name "YourAgentName"

# Get messages in JSON format
uv run .claude/hooks/comms/get_unread_messages.py --name "YourAgentName" --json

# Mark messages as read
uv run .claude/hooks/comms/get_unread_messages.py --name "YourAgentName" --mark-read
```

---

## 🎨 Customization Examples

### Project-Specific Configurations

#### API Development Project
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash.*test",
      "hooks": [{
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app api-project --event-type PreToolUse --priority high"
      }]
    }],
    "PostToolUse": [{
      "hooks": [{
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app api-project --event-type PostToolUse --summarize"
      }]
    }]
  }
}
```

#### Frontend Development Project
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/register_subagent.py"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app frontend-app --event-type PreToolUse"
        }
      ]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app frontend-app --event-type UserPromptSubmit --add-chat"
      }]
    }]
  }
}
```

#### Multi-Agent Orchestration Project
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/register_subagent.py"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app orchestrator --event-type PreToolUse --summarize"
        }
      ]
    }],
    "SubagentStop": [{
      "hooks": [{
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app orchestrator --event-type SubagentStop --priority high"
      }]
    }]
  }
}
```

### Advanced Hook Patterns

#### Conditional Execution
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write.*\\.ts$",
        "hooks": [{
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app typescript-project --event-type PreToolUse --priority high"
        }]
      },
      {
        "matcher": "Read.*\\.md$",
        "hooks": [{
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app typescript-project --event-type PreToolUse --priority low"
        }]
      }
    ]
  }
}
```

#### Sequential Hook Execution
```json
{
  "hooks": {
    "PostToolUse": [{
      "hooks": [
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-project --event-type PostToolUse"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/update_subagent_completion.py"
        },
        {
          "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/send_message.py --sender MyAgent --message 'Task completed'"
        }
      ]
    }]
  }
}
```

---

## 🔧 Testing Your Integration

### Verification Steps

#### 1. Test Hook Execution
```bash
# Manual hook test
cd /path/to/your/project
uv run .claude/hooks/observability/send_event.py \
  --source-app test-integration \
  --event-type PreToolUse \
  --summarize
```

#### 2. Test Agent Communication
```bash
# Test message sending
uv run .claude/hooks/comms/send_message.py \
  --sender "TestAgent" \
  --message "Integration test message"

# Test message receiving
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "TestAgent"
```

#### 3. Test Real Claude Code Usage
```bash
# Use Claude Code in your project
cd /path/to/your/project
echo "Analyze this project structure" | claude

# Verify events appear in dashboard
curl http://localhost:4000/events/recent | jq '.[] | select(.source_app == "YOUR_PROJECT_NAME")'
```

#### 4. Validate Dashboard Display
- Open `http://localhost:5173`
- Check "Event Timeline" tab for your project events
- Verify project name appears in source app filter
- Check "Agent Communications" tab if using multi-agent features

---

## 🚨 Troubleshooting Integration

### Common Issues

#### No Events Appearing
```bash
# Check .claude directory exists
ls -la /path/to/your/project/.claude/

# Verify settings.json syntax
cd /path/to/your/project
python3 -m json.tool .claude/settings.json

# Test hook manually
uv run .claude/hooks/observability/send_event.py --source-app test --event-type test

# Check server connectivity
curl http://localhost:4000/events/recent
```

#### Hook Execution Failures
```bash
# Check Python/uv installation
which python3 && which uv

# Test hook script directly
cd /path/to/your/project
python3 .claude/hooks/observability/send_event.py --help

# Check file permissions
chmod +x .claude/hooks/**/*.py
```

#### Agent Communication Issues
```bash
# Test agent registration
uv run .claude/hooks/comms/register_subagent.py

# Check agent registry
curl http://localhost:4000/subagents

# Test message API directly
curl -X POST http://localhost:4000/subagents/message \
  -H "Content-Type: application/json" \
  -d '{"sender": "test", "message": "test"}'
```

#### Environment Variable Issues
```bash
# Check CLAUDE_PROJECT_DIR
echo $CLAUDE_PROJECT_DIR

# If undefined, hooks may fail - ensure Claude Code sets this automatically
# Or set manually for testing:
export CLAUDE_PROJECT_DIR=/path/to/your/project
```

### Advanced Debugging

#### Enable Debug Logging
```bash
# Add debug flag to hooks
uv run .claude/hooks/observability/send_event.py \
  --source-app debug-test \
  --event-type test \
  --debug
```

#### Monitor Network Traffic
```bash
# Monitor HTTP requests to server
netstat -an | grep 4000

# Test WebSocket connection
wscat -c ws://localhost:4000/stream
```

#### Validate JSON Configuration
```bash
# Validate settings.json syntax
cd /path/to/your/project
python3 -c "import json; print(json.load(open('.claude/settings.json')))"
```

---

## 🌟 Integration Patterns

### Single Project Monitoring
**Use Case**: Monitor one project's Claude Code usage  
**Configuration**: Basic settings.json with unique `source-app` name

### Multi-Project Dashboard
**Use Case**: Monitor multiple projects from one dashboard  
**Configuration**: Copy `.claude` to each project with different `source-app` names

### Team Collaboration
**Use Case**: Multiple developers monitoring shared projects  
**Configuration**: Enable agent communication hooks for coordination

### CI/CD Integration
**Use Case**: Monitor Claude Code usage in automated pipelines  
**Configuration**: Lightweight settings with essential events only

### Development vs Production
**Use Case**: Different monitoring levels for different environments  
**Configuration**: Environment-specific settings files

---

## 📚 Related Documentation

**🏁 Getting Started**: [Setup Guide](setup-guide.md) - Initial system setup  
**🔧 Configuration**: [Configuration Guide](configuration.md) - Advanced settings  
**🤝 Multi-Agent**: [Agent Communication](agent-communication.md) - Team coordination  
**📡 API Reference**: [API Documentation](api-reference.md) - Complete endpoints  
**🐛 Troubleshooting**: [Common Issues](troubleshooting.md) - Detailed solutions  
**🏗️ Architecture**: [System Overview](architecture/system-overview.md) - Technical details

---

## ✅ Integration Checklist

- [ ] `.claude` directory copied to project root
- [ ] `settings.json` configured with unique `source-app` name
- [ ] Observability server running at `http://localhost:4000`
- [ ] Dashboard accessible at `http://localhost:5173`
- [ ] Test event successfully sent and displayed
- [ ] Claude Code usage generates events in dashboard
- [ ] Project name appears in dashboard filters
- [ ] Multi-agent communication tested (if enabled)
- [ ] Integration validated with real workflow

**🎯 Next Steps**: [Explore advanced features](api-reference.md) or [optimize performance](performance-optimization.md)

---

*Need help? Check the [troubleshooting guide](troubleshooting.md) or review [system architecture](architecture/system-overview.md) for deeper understanding.*