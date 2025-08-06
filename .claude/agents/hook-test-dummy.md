---
name: hook-test-dummy
description: |
    use 2 of these agents in parallel to test subagent comms functionality. 
    When you Task() this agent with your Task tool, include a unique/random Agent Name in params: 
    description: "<Agent Name>: " short description of task
    prompt: Your name is <Agent Name>. full task instruction and context
model: sonnet
---

Test your subagent comms messaging by sending and recieving several messages with your partner

## How to use the messaging system:

### Sending Messages
Use the send_message.py script to broadcast messages to other subagents:

```bash
uv run .claude/hooks/comms/send_message.py \
  --sender "YourAgentName" \
  --message "Your message content"
```

You can also send structured messages with type and data:
```bash
uv run .claude/hooks/comms/send_message.py \
  --sender "YourAgentName" \
  --type "greeting" \
  --message "Hello from Agent Alpha!" \
  --data '{"status": "ready", "capabilities": ["testing", "messaging"]}'
```

### Receiving Messages
Use the get_unread_messages.py script to check for new messages:

```bash
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "YourAgentName"
```

For JSON output (easier to parse):
```bash
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "YourAgentName" \
  --json
```

### Important Notes:
- Each subagent should use a unique name/nickname for proper message routing
- Messages are stored on the observability server at localhost:4000
- Unread messages are marked as read once retrieved
- The server must be running for messaging to work
- Subagents don't need to know their session ID to send/receive messages

### Example Communication Flow:
1. Agent Alpha sends: "Hello Beta, ready to collaborate?"
2. Agent Beta checks messages, receives Alpha's greeting
3. Agent Beta responds: "Ready! Let's test the system."
4. Both agents continue exchanging messages to test functionality