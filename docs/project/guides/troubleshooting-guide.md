# Troubleshooting Guide

A comprehensive guide for diagnosing and resolving common issues with the Claude Code Multi-Agent Observability & Communication System.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [System Requirements Issues](#system-requirements-issues)
- [Installation & Setup Problems](#installation--setup-problems)
- [Server & Backend Issues](#server--backend-issues)
- [Client & Dashboard Problems](#client--dashboard-problems)
- [Hook Integration Issues](#hook-integration-issues)
- [Multi-Agent Communication Problems](#multi-agent-communication-problems)
- [Database & Storage Issues](#database--storage-issues)
- [Performance & Memory Problems](#performance--memory-problems)
- [API & WebSocket Issues](#api--websocket-issues)
- [Development Environment Issues](#development-environment-issues)
- [Advanced Debugging](#advanced-debugging)
- [Getting Help](#getting-help)

## Quick Diagnostics

### System Health Check
```bash
# Run comprehensive system validation
./scripts/test-system.sh

# Check individual components
curl -s http://localhost:4000/health || echo "Server not responding"
curl -s http://localhost:5173 || echo "Client not responding"

# Verify all dependencies
uv --version && bun --version && node --version

# Test hook system
echo '{"session_id":"health-check"}' | uv run .claude/hooks/observability/send_event.py --source-app test --event-type HealthCheck

# Check WebSocket connectivity
# Browser console: new WebSocket('ws://localhost:4000/stream')
```

### Emergency Recovery Workflow
```bash
# Step 1: Complete system reset
./scripts/reset-system.sh

# Step 2: Verify clean state
lsof -i :4000 :5173  # Should show no results
ps aux | grep -E "bun|node" | grep -E "server|client"  # Should show no results

# Step 3: Clean reinstall
rm -rf apps/*/node_modules apps/*/.vite apps/*/dist
cd apps/server && bun install
cd apps/client && npm install

# Step 4: Start and validate
./scripts/start-system.sh
./scripts/test-system.sh

# Step 5: Test full workflow
echo '{"session_id":"recovery-test"}' | uv run .claude/hooks/observability/send_event.py --source-app recovery --event-type Test
# Check http://localhost:5173 for the event
```

### Common Quick Fixes
```bash
# Complete system reset (safest option)
./scripts/reset-system.sh

# Manual reset steps (if script fails)
# 1. Stop all processes
lsof -ti :4000 :5173 | xargs kill -9

# 2. Clear databases and logs
rm -f apps/server/events.db* apps/server/server.log apps/client/dev.log

# 3. Clear caches
rm -rf apps/client/.vite apps/client/dist
rm -rf apps/server/node_modules/.cache

# 4. Reinstall dependencies
cd apps/client && rm -rf node_modules && npm install
cd apps/server && rm -rf node_modules && bun install

# 5. Restart system
./scripts/start-system.sh
```

## System Requirements Issues

### Missing Prerequisites

**Problem**: Command not found errors  
**Solution**:
- [Install Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Install Astral uv](https://docs.astral.sh/uv/)
- [Install Bun](https://bun.sh/) or Node.js

**Problem**: Python version compatibility  
**Solution**:
```bash
# Check Python version (3.8+ required)
python --version

# Use uv to manage Python versions
uv python install 3.11
```

### API Key Configuration

**Problem**: Authentication errors  
**Solution**:
```bash
# Copy and configure environment file
cp .env.sample .env

# Add required API keys to .env
ANTHROPIC_API_KEY=your_key_here
```

## Installation & Setup Problems

### Dependency Installation Failures

**Problem**: `npm install` or `bun install` fails  
**Common Causes**:
- Network connectivity issues
- Missing build tools (Python, C++ compiler)
- Cache corruption
- Version conflicts

**Solutions**:
```bash
# Clear package manager cache
npm cache clean --force
bun pm cache rm

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# For bun projects
rm -rf node_modules bun.lockb
bun install

# Install with verbose logging to identify issues
npm install --verbose
bun install --verbose
```

**Problem**: Missing Python dependencies for node-gyp  
**Solution**:
```bash
# macOS - install Xcode command line tools
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential python3-dev

# Use uv to manage Python environment
uv python install 3.11
uv venv
source .venv/bin/activate
```

### Port Conflicts

**Problem**: "Port already in use" errors  
**Symptoms**:
- Server fails to start on port 4000
- Client dev server fails to start on port 5173
- Process hangs during startup

**Solutions**:
```bash
# Check what's using the ports
lsof -i :4000
lsof -i :5173

# Kill processes on specific ports
sudo lsof -ti :4000 | xargs kill -9
sudo lsof -ti :5173 | xargs kill -9

# Use system reset script
./scripts/reset-system.sh

# Start with different ports if needed
PORT=4001 cd apps/server && bun run dev
PORT=5174 cd apps/client && npm run dev
```

**Prevention**: Always use `./scripts/reset-system.sh` before starting development

### Permission Issues

**Problem**: Permission denied errors during setup  
**Common Files Affected**:
- Hook scripts in `.claude/hooks/`
- Shell scripts in `scripts/`
- Log files and databases

**Solutions**:
```bash
# Make hook scripts executable
chmod +x .claude/hooks/**/*.py
chmod +x scripts/*.sh

# Fix ownership of project files
sudo chown -R $USER:$USER .

# Set proper permissions for log files
mkdir -p apps/server/logs
chmod 755 apps/server/logs

# For database files
chmod 664 apps/server/events.db*
```

**Problem**: Cannot write to log files  
**Solution**:
```bash
# Create log directories with proper permissions
mkdir -p apps/server/logs apps/client/logs
touch apps/server/server.log apps/client/dev.log
chmod 664 apps/server/server.log apps/client/dev.log
```

## Server & Backend Issues

### Server Won't Start

**Problem**: Bun server fails to start or crashes immediately  
**Symptoms**:
- Process exits with error code
- "Cannot find module" errors
- Port binding failures
- TypeScript compilation errors

**Diagnostic Steps**:
```bash
# Check if server is already running
lsof -i :4000

# Try starting with verbose output
cd apps/server
bun --verbose src/index.ts

# Check for TypeScript errors
bun run typecheck

# Inspect server logs
tail -f server.log
```

**Common Solutions**:
```bash
# Reinstall dependencies
cd apps/server
rm -rf node_modules bun.lockb
bun install

# Reset database if corrupted
rm -f events.db events.db-wal events.db-shm

# Start in development mode with auto-restart
bun run dev

# Check for missing environment variables
cp ../../.env.sample ../../.env
```

### Database Connection Problems

**Problem**: SQLite database errors or corruption  
**Symptoms**:
- "Database is locked" errors
- "No such table" errors
- "Database disk image is malformed"
- Events not being saved

**Database Recovery**:
```bash
# Stop all server processes first
./scripts/reset-system.sh

# Backup existing database
cp apps/server/events.db apps/server/events.db.backup

# Check database integrity
sqlite3 apps/server/events.db "PRAGMA integrity_check;"

# If corrupted, restore from backup or start fresh
rm -f apps/server/events.db*
# Database will be recreated on next server start
```

**Schema Issues**:
```bash
# Check current schema
sqlite3 apps/server/events.db ".schema"

# Common tables should include: events, subagents, messages
# If missing, restart server to recreate tables

# Manual schema inspection
sqlite3 apps/server/events.db "SELECT name FROM sqlite_master WHERE type='table';"
```

**WAL File Issues**:
```bash
# Clear Write-Ahead Log files safely
sqlite3 apps/server/events.db "PRAGMA wal_checkpoint(FULL);"
rm -f apps/server/events.db-wal apps/server/events.db-shm
```

### WebSocket Connection Failures

**Problem**: Real-time dashboard updates not working  
**Symptoms**:
- Events appear in API but not in dashboard
- "WebSocket connection failed" in browser console
- Timeline not updating automatically
- Network errors in developer tools

**Connection Diagnostics**:
```bash
# Test WebSocket endpoint manually
wscat -c ws://localhost:4000/stream

# Check server WebSocket support
curl -v http://localhost:4000/health

# Verify server is accepting WebSocket upgrades
curl -v \-H "Upgrade: websocket" \-H "Connection: Upgrade" \-H "Sec-WebSocket-Key: test" \-H "Sec-WebSocket-Version: 13" \http://localhost:4000/stream
```

**Browser Debugging**:
1. Open Browser Developer Tools (F12)
2. Go to Network tab, filter by "WS" (WebSocket)
3. Look for connection attempts to `ws://localhost:4000/stream`
4. Check console for WebSocket errors

**Common Fixes**:
```bash
# Restart server with WebSocket debug logging
cd apps/server
DEBUG=ws,websocket bun run dev

# Check for proxy or firewall blocking WebSocket
# Test direct connection without proxy

# Verify client WebSocket implementation
cd apps/client
grep -r "WebSocket\|ws://" src/
```

**CORS Issues with WebSocket**:
```bash
# Check server CORS configuration
# WebSocket connections may need different CORS handling
# Review server WebSocket setup in src/index.ts
```

## Client & Dashboard Problems

### Dashboard Not Loading

**Problem**: Client application won't load or shows blank page  
**Symptoms**:
- White screen or loading forever
- "Cannot GET /" error
- JavaScript errors in console
- Vite build/dev server failures

**Basic Diagnostics**:
```bash
# Check if client dev server is running
curl http://localhost:5173
lsof -i :5173

# Check for build errors
cd apps/client
npm run build

# Start with verbose logging
npm run dev -- --debug
```

**Browser Console Debugging**:
1. Open Developer Tools (F12)
2. Check Console tab for JavaScript errors
3. Look for failed network requests in Network tab
4. Check if Vue components are loading properly

**Common Issues & Fixes**:
```bash
# Node modules corruption
cd apps/client
rm -rf node_modules package-lock.json
npm install

# Vite cache issues
rm -rf .vite dist
npm run dev

# TypeScript compilation errors
npm run typecheck
vue-tsc --noEmit

# Missing environment variables
echo "VITE_SERVER_URL=http://localhost:4000" > .env.local
```

### Timeline Not Updating

**Problem**: Events show in API but timeline doesn't refresh  
**Symptoms**:
- Static timeline despite new events
- WebSocket connection issues
- Priority event bucket problems
- Memory performance issues

**WebSocket Connection Check**:
```bash
# Test WebSocket from browser console
# Open browser dev tools and run:
const ws = new WebSocket('ws://localhost:4000/stream');
ws.onopen = () => console.log('WebSocket connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('WebSocket error:', e);
```

**Timeline Component Debugging**:
```bash
# Check for Vue component errors
cd apps/client
npm run test src/__tests__/EventTimeline.test.ts

# Test priority bucket functionality
npm run test src/__tests__/priority-bucket-validation.test.ts

# Check memory performance
npm run test src/__tests__/priority-bucket-memory-performance.test.ts
```

**Data Flow Verification**:
```bash
# Test event creation manually
curl -X POST http://localhost:4000/events \-H "Content-Type: application/json" \-d '{
  "source_app": "test",
  "session_id": "debug-session",
  "hook_event_type": "PreToolUse",
  "payload": {"tool": "Debug", "command": "test"}
}'

# Check recent events endpoint
curl http://localhost:4000/events/recent?limit=5

# Verify WebSocket is broadcasting
# Should see new events in WebSocket connection above
```

### Visual Rendering Issues

**Problem**: Timeline appears broken, overlapping, or incorrectly styled  
**Symptoms**:
- SVG elements not rendering
- Timeline events overlapping
- Zoom/scroll behavior broken
- CSS styling conflicts
- Performance degradation with large datasets

**CSS and Styling Debug**:
```bash
# Check for Tailwind CSS compilation issues
cd apps/client
npm run build

# Verify CSS files are being loaded
curl http://localhost:5173/src/style.css

# Test timeline-specific styles
grep -r "timeline" src/styles/
```

**SVG Rendering Issues**:
```bash
# Test SVG helper functions
npm run test src/utils/__tests__/svgHelpers.test.ts

# Check for SVG namespace and attribute issues
# Look for console errors about invalid SVG attributes

# Verify timeline calculations
npm run test src/utils/__tests__/timelineCalculations.test.ts
```

**Performance-Related Visual Issues**:
```bash
# Test virtual scrolling implementation
npm run test tests/test-virtual-scrolling.js

# Check memory usage with large datasets
npm run test src/utils/__tests__/performanceTest.test.ts

# Verify timeline optimizations
npm run test src/composables/__tests__/useTimelineRenderer.test.ts
```

**Browser-Specific Issues**:
1. Test in different browsers (Chrome, Firefox, Safari)
2. Check for CSS vendor prefix issues
3. Verify WebGL support for complex visualizations
4. Test responsive design at different screen sizes

**Matrix Mode Visual Issues**:
```bash
# Test matrix character rendering
npm run test src/utils/__tests__/matrixDesignTokens.test.ts

# Check matrix effects performance
grep -r "matrix" src/utils/

# Verify matrix mode toggle functionality
# Check browser console for matrix-related errors
```

## Hook Integration Issues

### Hook Scripts Not Executing

**Problem**: Claude Code hooks not triggering or sending events  
**Symptoms**:
- No events appearing in dashboard
- Hook scripts return errors
- Permission denied on hook files
- Python environment issues

**Hook Script Diagnostics**:
```bash
# Test hook script manually
echo '{"session_id":"test","tool_name":"Bash","tool_input":{"command":"ls"}}' | \
  uv run .claude/hooks/observability/send_event.py --source-app test --event-type PreToolUse

# Check hook script permissions
ls -la .claude/hooks/observability/send_event.py
chmod +x .claude/hooks/observability/send_event.py

# Test communication hook
uv run .claude/hooks/comms/send_message.py --sender "TestAgent" --message "Test message"
```

**Python Environment Issues**:
```bash
# Check uv installation and Python version
uv --version
uv python list

# Verify required packages are available
uv run python -c "import json, urllib.request, sys"
uv run python -c "import requests"

# Reinstall if packages missing
uv add requests

# Test with explicit Python path
/usr/bin/python3 .claude/hooks/observability/send_event.py --help
```

**Server Connection Issues**:
```bash
# Test server connectivity from hook
curl -v http://localhost:4000/events

# Check if server is accepting hook requests
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"manual","session_id":"test","hook_event_type":"Test","payload":{}}'

# Verify hook endpoint in server logs
tail -f apps/server/server.log | grep -i hook
```

### Event Capture Problems

**Problem**: Events sent but not appearing in database/dashboard  
**Symptoms**:
- Hook scripts succeed but no database records
- Events appear briefly then disappear
- Priority events not properly categorized
- WebSocket not broadcasting events

**Event Flow Debugging**:
```bash
# 1. Send test event and trace through system
echo '{"session_id":"debug-trace","tool_name":"Debug","tool_input":{"test":true}}' | \
  uv run .claude/hooks/observability/send_event.py --source-app trace --event-type Debug

# 2. Check if event reached server (check logs immediately)
tail -5 apps/server/server.log

# 3. Verify event in database
sqlite3 apps/server/events.db "SELECT * FROM events WHERE session_id='debug-trace' ORDER BY timestamp DESC LIMIT 5;"

# 4. Check WebSocket broadcast
# (If WebSocket connection from previous section is open, should see event)

# 5. Verify dashboard receives event
# Check browser Network tab for /events API calls
```

**Priority Event Classification**:
```bash
# Test priority event types
echo '{"session_id":"priority-test","type":"UserPromptSubmit"}' | \
  uv run .claude/hooks/observability/send_event.py --source-app test --event-type UserPromptSubmit

# Check priority field in database
sqlite3 apps/server/events.db "SELECT hook_event_type, priority FROM events WHERE session_id='priority-test';"

# Test normal event for comparison
echo '{"session_id":"normal-test","tool_name":"Bash"}' | \
  uv run .claude/hooks/observability/send_event.py --source-app test --event-type PreToolUse
```

**Database Storage Issues**:
```bash
# Check for database write permissions
ls -la apps/server/events.db*
sqlite3 apps/server/events.db "PRAGMA journal_mode;"

# Verify table schema supports all event fields
sqlite3 apps/server/events.db ".schema events"

# Check for storage space issues
df -h apps/server/
du -h apps/server/events.db*
```

### Python Environment Issues

**Problem**: uv or Python-related errors in hook execution  
**Symptoms**:
- "uv: command not found"
- "ModuleNotFoundError" for requests
- Python version compatibility issues
- Virtual environment activation problems

**uv Installation & Setup**:
```bash
# Install uv if missing
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH (add to .bashrc/.zshrc for persistence)
export PATH="$HOME/.cargo/bin:$PATH"

# Verify installation
uv --version

# Check available Python versions
uv python list
uv python install 3.11
```

**Dependency Management**:
```bash
# Create/update virtual environment for hooks
cd .claude/hooks
uv venv
source .venv/bin/activate

# Install required packages
uv add requests
uv add urllib3

# Test imports
uv run python -c "import requests; print('OK')"
```

**Script Execution Issues**:
```bash
# Test shebang line interpretation
head -1 .claude/hooks/observability/send_event.py

# Try different execution methods
# Method 1: Direct uv run
uv run .claude/hooks/observability/send_event.py --help

# Method 2: Explicit Python
python3 .claude/hooks/observability/send_event.py --help

# Method 3: With virtual environment
cd .claude/hooks && source .venv/bin/activate
python send_event.py --help
```

**Claude Code Integration**:
```bash
# Check if Claude Code can find hooks
ls -la .claude/
ls -la .claude/hooks/

# Verify hook configuration in Claude Code
# Check for .claude/config.json or similar
find .claude -name "*.json" -o -name "*.toml" -o -name "*.yaml"

# Test hook with Claude Code directly
# (This requires Claude Code session)
```

## Multi-Agent Communication Problems

### Message Delivery Failures

**Problem**: Agent messages not reaching intended recipients  
**Symptoms**:
- Subagents not receiving broadcasts
- Communication hooks failing silently
- Messages appear in logs but not in recipient inboxes
- Timeout errors in message delivery

**Message System Diagnostics**:
```bash
# Test message sending manually
uv run .claude/hooks/comms/send_message.py \
  --sender "DiagnosticAgent" \
  --message "Test message delivery"

# Check message endpoint
curl -v -X POST http://localhost:4000/subagents/message \
  -H "Content-Type: application/json" \
  -d '{"sender":"CurlTest","message":"Direct API test"}'

# Verify message storage
sqlite3 apps/server/events.db "SELECT * FROM messages ORDER BY timestamp DESC LIMIT 5;"

# Test message retrieval
uv run .claude/hooks/comms/get_unread_messages.py --name "TestAgent"
```

**Common Message Delivery Issues**:
```bash
# Server not processing messages
grep -i "message\|subagent" apps/server/server.log

# Database table missing or corrupted
sqlite3 apps/server/events.db ".schema messages"
sqlite3 apps/server/events.db "SELECT COUNT(*) FROM messages;"

# Python requests library issues
uv run python -c "import requests; print(requests.__version__)"

# Network connectivity to server
curl -v http://localhost:4000/subagents
```

### Agent Registration Issues

**Problem**: Subagents cannot register or appear in system  
**Symptoms**:
- Agent not listed in dashboard
- Registration hook script failures
- "Agent not found" errors
- Duplicate agent registrations

**Registration Process Testing**:
```bash
# Test agent registration manually
uv run .claude/hooks/comms/register_subagent.py \
  --name "TestAgent" \
  --role "test" \
  --capabilities "testing,debugging"

# Check registration endpoint
curl -v -X POST http://localhost:4000/subagents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CurlTestAgent",
    "role": "test",
    "capabilities": ["api-testing"]
  }'

# Verify agent in database
sqlite3 apps/server/events.db "SELECT * FROM subagents ORDER BY created_at DESC LIMIT 5;"

# List all registered agents
curl http://localhost:4000/subagents
```

**Registration Failures**:
```bash
# Check subagents table schema
sqlite3 apps/server/events.db ".schema subagents"

# Look for duplicate name constraints
sqlite3 apps/server/events.db "SELECT name, COUNT(*) FROM subagents GROUP BY name HAVING COUNT(*) > 1;"

# Check for registration script permissions
ls -la .claude/hooks/comms/register_subagent.py
chmod +x .claude/hooks/comms/register_subagent.py

# Test with different agent names
# Some names might conflict with system reserved words
```

### Inter-Agent Coordination Problems

**Problem**: Agents not coordinating effectively, missing communications  
**Symptoms**:
- Agents working in isolation
- Missed dependency notifications
- Conflicting file modifications
- Broadcast messages not received

**Coordination Workflow Testing**:
```bash
# Simulate multi-agent coordination
# Terminal 1: Register first agent
uv run .claude/hooks/comms/register_subagent.py --name "AgentAlpha" --role "primary"

# Terminal 2: Register second agent  
uv run .claude/hooks/comms/register_subagent.py --name "AgentBeta" --role "support"

# Terminal 1: Send coordination message
uv run .claude/hooks/comms/send_message.py --sender "AgentAlpha" --message "Starting implementation phase"

# Terminal 2: Check for message
uv run .claude/hooks/comms/get_unread_messages.py --name "AgentBeta"

# Verify message flow in dashboard
# Check http://localhost:5173 for inter-agent communications
```

**Coordination Debugging**:
```bash
# Check message routing logic
sqlite3 apps/server/events.db "SELECT sender, recipient, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT 10;"

# Verify agent status updates
sqlite3 apps/server/events.db "SELECT name, status, last_seen FROM subagents;"

# Test completion status updates
uv run .claude/hooks/comms/update_subagent_completion.py --name "TestAgent" --status "completed"

# Monitor real-time coordination in WebSocket
# Open browser console, connect to WebSocket, watch for agent messages
```

**Common Coordination Failures**:
- **Message timing**: Agents sending messages before recipients are registered
- **Name conflicts**: Multiple agents using similar names causing confusion
- **Status synchronization**: Agent status not updating properly
- **Database locks**: High-frequency messaging causing SQLite locks
- **WebSocket disruption**: Real-time coordination broken due to connection issues

**Coordination Best Practices**:
```bash
# Use unique, descriptive agent names
# Format: FirstNameLastName (e.g., "AliceNova", "BobStellar")

# Implement proper error handling in coordination scripts
# Check return codes from communication hooks

# Test coordination with realistic delays
# Real agents may have processing delays between messages

# Monitor coordination patterns in dashboard
# Look for message frequency, response times, coordination bottlenecks
```

## Database & Storage Issues

### SQLite Database Corruption

**Problem**: Database integrity errors or malformed data  
**Symptoms**:
- "Database disk image is malformed"
- "No such table" errors after schema changes
- Data inconsistencies or missing records
- WAL file corruption

**Database Recovery Procedures**:
```bash
# Step 1: Stop all database access
./scripts/reset-system.sh

# Step 2: Backup current database
cp apps/server/events.db apps/server/events.db.backup-$(date +%Y%m%d-%H%M%S)

# Step 3: Check database integrity
sqlite3 apps/server/events.db "PRAGMA integrity_check;"
sqlite3 apps/server/events.db "PRAGMA foreign_key_check;"

# Step 4: Attempt repair
sqlite3 apps/server/events.db "VACUUM;"
sqlite3 apps/server/events.db "REINDEX;"

# Step 5: If corruption persists, rebuild database
if [ $? -ne 0 ]; then
  echo "Database corrupted, rebuilding..."
  rm -f apps/server/events.db*
  # Database will be recreated on next server start
  ./scripts/start-system.sh
fi
```

### Data Migration Problems

**Problem**: Schema changes causing data compatibility issues  
**Symptoms**:
- Missing columns after updates
- Data type mismatches
- Foreign key constraint failures
- Priority field migration issues

**Migration Verification**:
```bash
# Check current schema version
sqlite3 apps/server/events.db "PRAGMA user_version;"

# Inspect table structure
sqlite3 apps/server/events.db ".schema events"
sqlite3 apps/server/events.db ".schema subagents"
sqlite3 apps/server/events.db ".schema messages"

# Check for priority column (added in recent updates)
sqlite3 apps/server/events.db "PRAGMA table_info(events);" | grep priority

# Test priority migration
npm run test apps/server/src/__tests__/priority-database-migration.test.ts
```

**Manual Migration Recovery**:
```bash
# If automatic migration failed, manual fix:
sqlite3 apps/server/events.db "ALTER TABLE events ADD COLUMN priority TEXT DEFAULT 'normal';"
sqlite3 apps/server/events.db "UPDATE events SET priority='high' WHERE hook_event_type IN ('UserPromptSubmit','Notification','Stop','SubagentStop');"
sqlite3 apps/server/events.db "CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority);"
```

### Storage Space Issues

**Problem**: Disk space exhaustion from accumulated events and logs  
**Symptoms**:
- "No space left on device" errors
- Database write failures
- Log rotation issues
- Performance degradation

**Space Management**:
```bash
# Check current disk usage
df -h .
du -h apps/server/events.db*
du -h apps/server/server.log*
du -h apps/client/dev.log*

# Check event count and size
sqlite3 apps/server/events.db "SELECT COUNT(*), 
  SUM(LENGTH(payload)) as total_payload_size 
  FROM events;"

# Events by day (identify data accumulation patterns)
sqlite3 apps/server/events.db "SELECT 
  DATE(timestamp/1000, 'unixepoch') as day,
  COUNT(*) as event_count,
  priority,
  SUM(LENGTH(payload)) as day_size
  FROM events 
  GROUP BY day, priority 
  ORDER BY day DESC 
  LIMIT 14;"
```

**Cleanup Procedures**:
```bash
# Clean old events (keep last 7 days)
sqlite3 apps/server/events.db "DELETE FROM events 
  WHERE timestamp < strftime('%s', 'now', '-7 days') * 1000;"

# Clean old messages (keep last 3 days)
sqlite3 apps/server/events.db "DELETE FROM messages 
  WHERE timestamp < strftime('%s', 'now', '-3 days') * 1000;"

# Reclaim space
sqlite3 apps/server/events.db "VACUUM;"

# Rotate log files
mv apps/server/server.log apps/server/server.log.old
mv apps/client/dev.log apps/client/dev.log.old
touch apps/server/server.log apps/client/dev.log

# Set up automatic cleanup (cron job example)
echo "0 2 * * * cd $(pwd) && sqlite3 apps/server/events.db \"DELETE FROM events WHERE timestamp < strftime('%s', 'now', '-7 days') * 1000; VACUUM;\"" | crontab -
```

## Performance & Memory Problems

### High Memory Usage

**Problem**: System consuming excessive memory, causing slowdowns  
**Symptoms**:
- Browser tab becomes unresponsive
- Server process uses >1GB RAM
- System becomes sluggish
- Out of memory errors

**Memory Profiling Tools**:
```bash
# Monitor server memory usage
top -p $(pgrep -f "bun.*server")
ps aux | grep -E "bun.*server|node.*client"

# Check database size
du -h apps/server/events.db*
sqlite3 apps/server/events.db "SELECT COUNT(*) as total_events FROM events;"

# Monitor client memory in browser
# Open Dev Tools > Memory tab > Take heap snapshot
# Look for large arrays, timeline data structures
```

**Server-Side Memory Issues**:
```bash
# Check for event accumulation
sqlite3 apps/server/events.db "SELECT COUNT(*), DATE(timestamp/1000, 'unixepoch') as day FROM events GROUP BY day ORDER BY day DESC LIMIT 7;"

# Clear old events if database is too large
sqlite3 apps/server/events.db "DELETE FROM events WHERE timestamp < strftime('%s', 'now', '-7 days') * 1000;"
sqlite3 apps/server/events.db "VACUUM;"

# Restart server to clear memory
./scripts/reset-system.sh
```

**Client-Side Memory Issues**:
```bash
# Test timeline with memory limits
cd apps/client
npm run test src/__tests__/priority-bucket-memory-performance.test.ts

# Check for memory leaks in WebSocket connections
# Browser Dev Tools > Memory > Record memory profile
# Look for detached DOM nodes, large timeline arrays

# Clear browser cache and restart
# Chrome: Settings > Privacy > Clear browsing data
```

**Memory Optimization Settings**:
```bash
# Reduce event retention in database
# Edit server configuration to limit events per session
# Implement automatic cleanup of old events

# Adjust client timeline limits
# Check priority-bucket-memory-performance.test.ts for thresholds
# Default limits: 200 priority + 100 regular + 250 total events
```

### Slow Timeline Rendering

**Problem**: Timeline takes too long to load or becomes unresponsive  
**Symptoms**:
- Timeline freezes with large datasets
- Scrolling performance issues
- Browser "Page Unresponsive" warnings
- SVG rendering delays

**Performance Benchmarking**:
```bash
# Run performance tests
cd apps/client
npm run test src/utils/__tests__/performanceTest.test.ts
npm run test src/__tests__/priority-bucket-memory-performance.test.ts

# Test virtual scrolling implementation
npm run test tests/test-virtual-scrolling.js

# Check timeline calculations performance
npm run test src/utils/__tests__/timelineCalculations.test.ts
```

**Timeline Optimization Strategies**:
```bash
# Check current timeline optimizations
grep -r "optimization\|performance" src/utils/timeline*
grep -r "virtual.*scroll" src/

# Test with reduced dataset
# Temporarily limit events in API calls
curl "http://localhost:4000/events/recent?limit=50"

# Monitor SVG rendering performance
# Browser Dev Tools > Performance tab
# Record timeline interaction, look for long tasks
```

**Data Pagination Issues**:
```bash
# Test API pagination
curl "http://localhost:4000/events/recent?limit=100&offset=0"
curl "http://localhost:4000/events/recent?limit=100&offset=100"

# Check for infinite scroll implementation
grep -r "pagination\|infinite.*scroll" src/

# Verify priority bucket limits are working
sqlite3 apps/server/events.db "SELECT priority, COUNT(*) FROM events GROUP BY priority;"
```

**Browser-Specific Performance**:
1. **Chrome**: Enable experimental features for better SVG performance
2. **Firefox**: Check about:config for webgl settings
3. **Safari**: Verify hardware acceleration is enabled
4. **All browsers**: Disable browser extensions that might interfere

**Timeline Component Debugging**:
```bash
# Check for expensive re-renders
# Look for missing Vue.js key attributes
grep -r "v-for" src/components/

# Test timeline with React DevTools profiler
# Or Vue DevTools performance panel

# Check for memory leaks in timeline watchers
grep -r "watch\|computed" src/composables/useTimeline*
```

### WebSocket Performance Issues

**Problem**: Real-time updates causing performance degradation  
**Symptoms**:
- High CPU usage during WebSocket activity
- Delayed message processing
- Connection timeouts
- Browser becomes unresponsive during heavy event streams

**WebSocket Connection Monitoring**:
```bash
# Monitor WebSocket message frequency
# Browser Dev Tools > Network > WS tab
# Look for message rate, size, and timing

# Test WebSocket performance with load
cd scripts
node tests/test-websocket-realtime.js

# Check server WebSocket handling
grep -r "websocket\|ws" apps/server/src/
```

**Message Processing Optimization**:
```bash
# Test priority bucket WebSocket performance
cd apps/client
npm run test src/__tests__/websocket-priority-performance.test.ts

# Check for message queuing issues
npm run test src/__tests__/usePriorityWebSocket.test.ts

# Verify batching and throttling
grep -r "throttle\|debounce\|batch" src/composables/
```

**Connection Stability Issues**:
```bash
# Test WebSocket reconnection logic
# Temporarily stop server, verify client reconnects
./scripts/reset-system.sh
./scripts/start-system.sh

# Check for connection leak issues
netstat -an | grep :4000
lsof -i :4000

# Monitor WebSocket in browser dev tools
# Look for frequent disconnect/reconnect cycles
```

**Event Broadcasting Optimization**:
```bash
# Check server broadcasting efficiency
# Look for O(n) operations in WebSocket broadcast
grep -r "broadcast\|emit" apps/server/src/

# Test with multiple clients
# Open multiple browser tabs to localhost:5173
# Monitor if performance degrades with multiple connections

# Check priority event filtering performance
sqlite3 apps/server/events.db "EXPLAIN QUERY PLAN SELECT * FROM events WHERE priority='high' ORDER BY timestamp DESC LIMIT 100;"
```

**WebSocket Protocol Optimization**:
```bash
# Check message size and compression
# Large events might need compression
# Browser Dev Tools > Network > WS > Message content

# Verify binary vs text message efficiency
# Check if JSON compression would help

# Test different WebSocket libraries if needed
# Current: native WebSocket
# Alternatives: Socket.IO, ws with compression
```

## API & WebSocket Issues

### API Endpoint Errors

**Problem**: API requests failing with 4xx/5xx status codes  
**Common Error Codes**:
- **400 Bad Request**: Invalid JSON or missing required fields
- **404 Not Found**: Endpoint doesn't exist or server not running
- **405 Method Not Allowed**: Wrong HTTP method
- **500 Internal Server Error**: Server-side exceptions
- **503 Service Unavailable**: Server overloaded or database locked

**API Testing and Debugging**:
```bash
# Test all major endpoints with verbose output
curl -v http://localhost:4000/health
curl -v http://localhost:4000/events/recent?limit=1
curl -v http://localhost:4000/events/filter-options
curl -v http://localhost:4000/subagents

# Test POST endpoints with proper content type
curl -v -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "api-test",
    "session_id": "api-debug",
    "hook_event_type": "APITest",
    "payload": {"debug": true}
  }'

# Check server response headers
curl -I http://localhost:4000/health

# Test with malformed JSON (should return 400)
curl -v -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

**Common API Issues**:
```bash
# Server not responding (check if running)
lsof -i :4000

# Content-Type header missing
# Always include: -H "Content-Type: application/json"

# CORS issues from browser
# Check browser dev tools for CORS errors

# Database locked errors
# Check for long-running database operations
sqlite3 apps/server/events.db "PRAGMA busy_timeout=30000;"
```

### CORS Problems

**Problem**: Cross-Origin Resource Sharing blocking browser requests  
**Symptoms**:
- "CORS policy" errors in browser console
- Network requests failing from frontend
- OPTIONS preflight requests failing
- WebSocket connection blocked

**CORS Diagnostics**:
```bash
# Test CORS headers from server
curl -v -H "Origin: http://localhost:5173" http://localhost:4000/health

# Test preflight OPTIONS request
curl -v -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:4000/events

# Check if server includes proper CORS headers
# Look for: Access-Control-Allow-Origin, Access-Control-Allow-Methods
```

**Browser CORS Testing**:
```javascript
// Test in browser console (F12)
fetch('http://localhost:4000/health')
  .then(response => {
    console.log('Response headers:', [...response.headers.entries()]);
    return response.json();
  })
  .then(data => console.log('Data:', data))
  .catch(error => console.error('CORS Error:', error));
```

**CORS Configuration Issues**:
```bash
# Check server CORS setup
grep -r "cors\|origin" apps/server/src/

# Verify allowed origins include client URL
# Should allow: http://localhost:5173

# WebSocket CORS (different from HTTP CORS)
# Check WebSocket connection from different origin
```

### Rate Limiting Issues

**Problem**: Requests being throttled or blocked due to high frequency  
**Symptoms**:
- "Too Many Requests" (429) errors
- Requests timing out under load
- Hook scripts failing during high activity
- WebSocket disconnections under load

**Rate Limiting Diagnostics**:
```bash
# Test burst request handling
for i in {1..10}; do
  curl -s -w "%{http_code} %{time_total}\n" \
    -X POST http://localhost:4000/events \
    -H "Content-Type: application/json" \
    -d '{"source_app":"burst-test","session_id":"rate-test-'$i'","hook_event_type":"BurstTest","payload":{}}' &
done
wait

# Monitor server performance under load
top -p $(pgrep -f "bun.*server")

# Check for database lock contention
sqlite3 apps/server/events.db "PRAGMA busy_timeout;"
```

**Load Testing**:
```bash
# Install basic load testing tool
npm install -g autocannon

# Test API endpoint under load
autocannon -c 10 -d 10 http://localhost:4000/health

# Test event creation under load
autocannon -c 5 -d 5 -m POST \
  -H "Content-Type: application/json" \
  -b '{"source_app":"load-test","session_id":"load","hook_event_type":"LoadTest","payload":{}}' \
  http://localhost:4000/events
```

**Performance Optimization**:
```bash
# Check for server bottlenecks
# Monitor CPU, memory, database I/O
iotop  # Linux
sudo fs_usage | grep events.db  # macOS

# Database optimization
sqlite3 apps/server/events.db "PRAGMA journal_mode=WAL;"
sqlite3 apps/server/events.db "PRAGMA synchronous=NORMAL;"
sqlite3 apps/server/events.db "PRAGMA cache_size=10000;"

# Consider implementing proper rate limiting
# Add rate limiting middleware to server
```

## Development Environment Issues

### Test Failures

**Problem**: Unit tests, integration tests, or E2E tests failing  
**Common Test Categories**:
- **Unit Tests**: Component and function testing
- **Integration Tests**: API and database testing
- **E2E Tests**: Full workflow testing
- **Visual Tests**: UI rendering and Playwright tests

**Running Test Suites**:
```bash
# Server tests
cd apps/server
bun test                     # Run all tests
bun test --coverage          # With coverage
bun test --watch            # Watch mode

# Client tests
cd apps/client
npm run test                 # Vitest unit tests
npm run test:coverage        # With coverage
npm test -- --reporter=verbose  # Detailed output

# Playwright E2E tests
npm run test:e2e
pnpm exec playwright test --headed  # With browser
```

**Test Isolation and Database Issues**:
```bash
# Tests may interfere with each other
# Check for proper test isolation
cd apps/server
grep -r "beforeEach\|afterEach" __tests__/

# Database isolation for server tests
npm run test __tests__/database-isolation.test.ts

# Clear test database between runs
rm -f apps/server/test-events.db*
```

**Common Test Failures**:
```bash
# Port conflicts during testing
# Tests may try to use same ports as dev servers
lsof -i :4000 :5173
./scripts/reset-system.sh

# Timeline rendering tests
cd apps/client
npm test src/__tests__/EventTimeline.test.ts
npm test src/__tests__/InteractiveSessionsTimeline.e2e.test.ts

# Priority bucket tests
npm test src/__tests__/priority-bucket-validation.test.ts

# WebSocket tests
npm test src/__tests__/websocket-priority-performance.test.ts
```

### Build Problems

**Problem**: TypeScript compilation or build process failures  
**Symptoms**:
- TypeScript type errors
- Module resolution failures
- Vite build errors
- Missing dependencies in production build

**Build Diagnostics**:
```bash
# Server build (TypeScript check)
cd apps/server
bun run typecheck           # Check types without emit
tsc --noEmit --strict       # Strict type checking

# Client build
cd apps/client
npm run build              # Production build
vue-tsc --noEmit           # Vue TypeScript check
npm run preview            # Test production build
```

**Common Build Issues**:
```bash
# Type import/export issues
grep -r "import type\|export type" apps/*/src/

# Missing .d.ts files
find apps/ -name "*.d.ts"

# Check tsconfig.json configuration
cat apps/server/tsconfig.json
cat apps/client/tsconfig.json

# Module resolution problems
# Check for correct relative imports
grep -r "from ['\"]\.\." apps/*/src/
```

**Build Environment Issues**:
```bash
# Node.js version compatibility
node --version
cat .nvmrc  # If using nvm

# Package.json scripts verification
cat apps/server/package.json | jq .scripts
cat apps/client/package.json | jq .scripts

# Clear build caches
rm -rf apps/client/.vite apps/client/dist
rm -rf apps/server/node_modules/.cache
```

### Hot Reload Not Working

**Problem**: File changes not triggering automatic reloads  
**Symptoms**:
- Code changes not reflected in browser
- Server not restarting on file changes
- Vite HMR (Hot Module Replacement) failing
- TypeScript watch mode issues

**Hot Reload Diagnostics**:
```bash
# Check if dev servers are running in watch mode
ps aux | grep -E "bun.*watch|vite.*dev"

# Server hot reload (bun --watch)
cd apps/server
bun --watch src/index.ts    # Manual start with watch

# Client hot reload (Vite)
cd apps/client
npm run dev                 # Should include HMR
```

**File System Watching Issues**:
```bash
# Check file system limits (Linux)
cat /proc/sys/fs/inotify/max_user_watches
# If too low, increase with:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# macOS file watching
# Ensure files are not on network drives
# Check for permission issues
ls -la apps/server/src/
```

**Vite HMR Configuration**:
```bash
# Check Vite configuration
cat apps/client/vite.config.ts

# Test HMR manually in browser console
# Look for Vite HMR connection messages
# Check for WebSocket connection to Vite dev server

# Common HMR issues:
# - Proxy configuration interfering
# - Browser cache preventing updates
# - File imports not using proper paths
```

**Browser Cache Issues**:
```bash
# Hard refresh to bypass cache
# Chrome/Firefox: Ctrl+Shift+R or Cmd+Shift+R
# Or disable cache in dev tools

# Check for service worker caching
# Browser Dev Tools > Application > Service Workers

# Clear application storage
# Browser Dev Tools > Application > Storage > Clear site data
```

## Advanced Debugging

### Debug Mode Configuration
```bash
# Enable debug logging
export DEBUG=true

# Verbose server logging
cd apps/server && DEBUG=* bun --watch src/index.ts

# Client development with detailed logging
cd apps/client && DEBUG=true npm run dev
```

### Log Analysis

**Server Log Investigation**:
```bash
# Real-time log monitoring
tail -f apps/server/server.log

# Search for specific errors
grep -i "error\|exception\|fail" apps/server/server.log

# Check WebSocket-related logs
grep -i "websocket\|ws" apps/server/server.log

# Database operation logs
grep -i "sqlite\|database\|db" apps/server/server.log

# Hook event processing
grep -i "hook\|event" apps/server/server.log | tail -20
```

**Client Debug Logging**:
```bash
# Enable verbose client logging
cd apps/client
DEBUG=true npm run dev

# Check for client-side errors
tail -f dev.log
grep -i "error\|warning" dev.log

# Timeline-specific debugging
grep -i "timeline\|rendering" dev.log
```

**Browser Console Analysis**:
1. **Console Tab**: JavaScript errors, Vue warnings, WebSocket messages
2. **Network Tab**: Failed API requests, slow responses, WebSocket traffic
3. **Performance Tab**: Long tasks, memory usage, rendering bottlenecks
4. **Application Tab**: Local storage, session storage, service workers

**Common Log Patterns to Watch**:
- `Connection refused`: Server not running or port conflicts
- `SQLITE_BUSY`: Database locked by another process
- `WebSocket error`: Network issues or server restart
- `Memory leak detected`: Timeline component not cleaning up
- `Hook execution failed`: Python environment or permission issues

### Network Debugging

**API Endpoint Testing**:
```bash
# Test all major endpoints
curl -v http://localhost:4000/health
curl -v http://localhost:4000/events/recent?limit=5
curl -v http://localhost:4000/events/filter-options
curl -v http://localhost:4000/subagents

# Test event creation
curl -v -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "curl-test",
    "session_id": "network-debug",
    "hook_event_type": "NetworkTest",
    "payload": {"test": true}
  }'

# Test subagent messaging
curl -v -X POST http://localhost:4000/subagents/message \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "NetworkTest",
    "message": "Debug message"
  }'
```

**WebSocket Connection Testing**:
```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Test WebSocket connection
wscat -c ws://localhost:4000/stream

# Test with authentication if required
wscat -c ws://localhost:4000/stream -H "Authorization: Bearer token"

# Monitor WebSocket traffic
# Keep connection open and trigger events from another terminal
```

**CORS and Headers Debugging**:
```bash
# Check CORS headers
curl -v -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:4000/events

# Test with different user agents
curl -v -H "User-Agent: Mozilla/5.0 (Custom Test)" \
  http://localhost:4000/health
```

**Proxy and Firewall Issues**:
```bash
# Test direct connection bypassing proxy
no_proxy=localhost,127.0.0.1 curl http://localhost:4000/health

# Check for local firewall blocking
sudo ufw status  # Ubuntu
sudo iptables -L  # General Linux

# Test with different ports
PORT=4001 cd apps/server && bun run dev
curl http://localhost:4001/health
```

**DNS Resolution Issues**:
```bash
# Test localhost resolution
ping localhost
nslookup localhost

# Use IP address instead of hostname
curl http://127.0.0.1:4000/health

# Check /etc/hosts file
cat /etc/hosts | grep localhost
```

### Performance Profiling

**Server Performance Monitoring**:
```bash
# Monitor server resource usage
top -p $(pgrep -f "bun.*server")
htop  # More detailed view

# Profile server with clinic.js (if available)
npm install -g clinic
cd apps/server
clinic doctor -- bun src/index.ts

# Memory profiling
valgrind --tool=massif bun src/index.ts  # Linux only

# Database performance
sqlite3 apps/server/events.db "PRAGMA compile_options;"
sqlite3 apps/server/events.db "ANALYZE;"
```

**Client Performance Analysis**:
```bash
# Bundle size analysis
cd apps/client
npm run build -- --report

# Lighthouse performance audit
npm install -g lighthouse
lighthouse http://localhost:5173 --output html --output-path ./lighthouse-report.html

# Vue DevTools profiling
# Install Vue DevTools browser extension
# Use Performance tab to profile component renders
```

**Timeline-Specific Performance Testing**:
```bash
# Run performance test suite
cd apps/client
npm run test src/utils/__tests__/performanceTest.test.ts
npm run test src/__tests__/priority-bucket-memory-performance.test.ts

# Test with large datasets
node scripts/populate-test-agents.ts --events 1000
# Then monitor timeline rendering performance
```

**WebSocket Performance Profiling**:
```bash
# Test WebSocket message throughput
node scripts/tests/test-websocket-realtime.js

# Monitor network traffic
# Browser Dev Tools > Network > WS tab
# Look for message frequency, size, latency

# Server-side WebSocket profiling
# Add timing logs to WebSocket broadcast functions
```

**Memory Leak Detection**:
```bash
# Browser memory profiling
# Chrome Dev Tools > Memory tab
# 1. Take initial heap snapshot
# 2. Use application for a while
# 3. Take second snapshot
# 4. Compare for memory growth

# Server memory monitoring
watch -n 5 'ps aux | grep -E "bun.*server" | grep -v grep'

# Check for file descriptor leaks
lsof -p $(pgrep -f "bun.*server") | wc -l
watch -n 10 'lsof -p $(pgrep -f "bun.*server") | wc -l'
```

## Getting Help

### Before Asking for Help
1. **Check this troubleshooting guide** for your specific issue
2. **Run system diagnostics** with `./scripts/test-system.sh`
3. **Search existing issues** on GitHub
4. **Gather system information** (OS, versions, error messages)

### How to Report Issues
1. **Use the issue template** on GitHub
2. **Include reproduction steps** and expected vs actual behavior
3. **Provide system information** and relevant logs
4. **Include screenshots** for UI-related issues

### Community Resources
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community help
- **Documentation**: [Complete guides](../guides/) and [API reference](api-reference.md)

### System Information Collection
```bash
# Collect system diagnostics
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "Bun: $(bun --version)"
echo "uv: $(uv --version)"
echo "Python: $(python --version)"

# Check service status
curl -s http://localhost:4000/health || echo "Server not responding"
curl -s http://localhost:5173 || echo "Client not responding"
```

---

## Cross-References and Related Documentation

### Architecture and Setup Guides
- **[Installation Guide](installation-guide.md)**: Initial system setup and requirements
- **[Setup Guide](setup-guide.md)**: Step-by-step configuration instructions  
- **[Architecture Guide](architecture-guide.md)**: System components and data flow
- **[Integration Guide](integration-guide.md)**: Claude Code hook integration

### Specific Component Guides
- **[API Reference](api-reference.md)**: Server endpoints and WebSocket protocol
- **[Priority Event Bucket Architecture](priority-event-bucket-architecture.md)**: Real-time event classification
- **[Timeline Architecture](timeline-architecture-analysis.md)**: Client-side rendering and performance
- **[Matrix Mode Implementation](matrix-mode-implementation-guide.md)**: Visual effects troubleshooting

### Development and Testing
- **[Test Architecture Best Practices](test-architecture-best-practices.md)**: Testing strategy and debugging
- **[NPX Installer Architecture](npx-installer-architecture.md)**: Package installation issues
- **[Orchestration Guide](orchestration-guide.md)**: Multi-agent system coordination

### Common Issue Patterns (from Phase Archive)
- **Cache corruption and recovery** → [phases-archive-extracted-patterns.md](phases-archive-extracted-patterns.md#cache-architecture-patterns)
- **WebSocket performance optimization** → [phases-archive-extracted-patterns.md](phases-archive-extracted-patterns.md#websocket-and-real-time-architecture)
- **Error handling patterns** → [phases-archive-extracted-patterns.md](phases-archive-extracted-patterns.md#error-handling-and-recovery-strategies)
- **Performance optimization techniques** → [phases-archive-extracted-patterns.md](phases-archive-extracted-patterns.md#performance-optimization-techniques)

### Quick Reference Command Cheat Sheet
```bash
# System Management
./scripts/reset-system.sh     # Complete system reset
./scripts/start-system.sh     # Start both server and client
./scripts/test-system.sh      # Run system validation

# Debugging
tail -f apps/server/server.log              # Monitor server logs
tail -f apps/client/dev.log                 # Monitor client logs
curl http://localhost:4000/health           # Test server
wscat -c ws://localhost:4000/stream         # Test WebSocket

# Hook Testing
echo '{"session_id":"test"}' | uv run .claude/hooks/observability/send_event.py --source-app debug --event-type Test
uv run .claude/hooks/comms/send_message.py --sender "Debug" --message "Test"

# Database Management
sqlite3 apps/server/events.db "SELECT COUNT(*) FROM events;"  # Check event count
sqlite3 apps/server/events.db "PRAGMA integrity_check;"       # Check database integrity

# Performance Monitoring
top -p $(pgrep -f "bun.*server")            # Monitor server resources
npm run test -- --coverage                  # Run tests with coverage
```

---

**Note**: This troubleshooting guide is continuously updated based on community feedback and common issues. If you encounter a problem not covered here, please report it so we can improve this guide for everyone.

**Last Updated**: Based on system architecture analysis and extracted patterns from completed development phases.