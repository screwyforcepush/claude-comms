# Agent Prompt & Response Capture - Troubleshooting Guide

**Author:** DavidStellar (Technical Documentation Specialist)  
**Date:** 2025-08-14  
**Status:** Complete Troubleshooting Guide  

## Quick Diagnostics

Before diving into specific issues, run these quick checks:

```bash
# Check if system is running
curl -f http://localhost:4000/health || echo "Server not responding"

# Check database connectivity
curl -f http://localhost:4000/events/recent?limit=1 || echo "Database issue"

# Check WebSocket connection
# In browser console:
# new WebSocket('ws://localhost:4000/stream')
```

## Common Issues and Solutions

### 1. No Prompt/Response Data Captured

#### Symptoms
- Agents appear in Sessions tab but have no prompt/response content
- "No prompt available" or "No response available" messages in modals
- Agent detail panels show metadata but no text content

#### Diagnosis Steps
1. **Check Feature Timing**: 
   ```bash
   # Check when agents were created vs feature implementation
   sqlite3 apps/server/events.db "SELECT created_at, name, initial_prompt FROM subagent_registry ORDER BY created_at DESC LIMIT 5;"
   ```

2. **Verify Hook Configuration**:
   ```bash
   # Check if hooks are properly configured
   cat .claude/settings.json | jq '.hooks'
   ```

3. **Check Database Schema**:
   ```bash
   sqlite3 apps/server/events.db ".schema subagent_registry"
   # Should include initial_prompt and final_response columns
   ```

#### Solutions

**For New Installations:**
```bash
# Ensure database has latest schema
cd apps/server
bun run src/db.ts  # This will apply migrations
```

**For Missing Hook Configuration:**
```json
// Add to .claude/settings.json hooks section
{
  "PreToolUse": [{
    "matcher": ".*Task.*",
    "hooks": [{
      "type": "command", 
      "command": "uv run .claude/hooks/store_agent_prompt.py"
    }]
  }],
  "PostToolUse": [{
    "matcher": ".*Task.*",
    "hooks": [{
      "type": "command",
      "command": "uv run .claude/hooks/store_agent_response.py"  
    }]
  }]
}
```

**For Historical Data:**
- Historical agents (created before feature implementation) will not have prompt/response data
- This is expected behavior - only future agents will capture this data

### 2. Incomplete or Truncated Content

#### Symptoms
- Prompts or responses appear cut off
- Only partial content displayed in modals
- Loading indicators that never complete

#### Diagnosis Steps
1. **Check Content Size**:
   ```bash
   sqlite3 apps/server/events.db "SELECT name, length(initial_prompt), length(final_response) FROM subagent_registry WHERE initial_prompt IS NOT NULL ORDER BY length(initial_prompt) DESC LIMIT 5;"
   ```

2. **Monitor Network Requests**:
   - Open browser DevTools → Network tab
   - Look for failed or incomplete requests to `/subagents/*/full`

3. **Check Server Memory**:
   ```bash
   # Monitor server memory usage
   ps aux | grep -E "(bun|node)" | grep server
   ```

#### Solutions

**For Large Content (>1MB):**
```typescript
// In server configuration, increase limits
const server = Bun.serve({
  port: 4000,
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
  // ... other config
});
```

**For Memory Issues:**
```bash
# Restart server with increased memory
export NODE_OPTIONS="--max-old-space-size=4096"
cd apps/server && bun run src/index.ts
```

**For Network Timeouts:**
```typescript
// In client, increase timeout
const fetchAgentData = async (sessionId: string, name: string) => {
  const response = await fetch(`/subagents/${sessionId}/${name}/full`, {
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });
  // ...
};
```

### 3. Modal Not Opening or Blank Content

#### Symptoms
- Click on agents but modal doesn't appear
- Modal opens but shows empty content
- JavaScript errors in browser console

#### Diagnosis Steps
1. **Check Browser Console**:
   - Open DevTools → Console
   - Look for JavaScript errors
   - Check for failed network requests

2. **Verify Component State**:
   ```javascript
   // In browser console while modal should be open
   console.log(window.$nuxt?.ctx?.app?.vue?.$refs);
   ```

3. **Test Direct API Access**:
   ```bash
   # Test if API returns data
   curl "http://localhost:4000/subagents/your-session-id/agent-name/full"
   ```

#### Solutions

**For JavaScript Errors:**
```bash
# Clear browser cache and reload
# In browser: Ctrl+Shift+R (hard reload)

# Check if client bundle is built correctly
cd apps/client
npm run build
```

**For Component Issues:**
```typescript
// In Vue component, add error handling
const openModal = async (agent: AgentStatus) => {
  try {
    const data = await fetchAgentData(agent.session_id, agent.name);
    // ... handle data
  } catch (error) {
    console.error('Failed to load agent data:', error);
    // Show user-friendly error message
  }
};
```

**For API Connection Issues:**
```bash
# Check server status
curl -I http://localhost:4000/health

# Verify WebSocket connection
curl --upgrade websocket http://localhost:4000/stream
```

### 4. Performance Issues with Large Content

#### Symptoms
- Slow modal opening times
- Browser becomes unresponsive
- High memory usage in browser

#### Diagnosis Steps
1. **Measure Content Size**:
   ```bash
   sqlite3 apps/server/events.db "SELECT name, length(initial_prompt) as prompt_size, length(final_response) as response_size FROM subagent_registry ORDER BY prompt_size DESC LIMIT 10;"
   ```

2. **Monitor Browser Performance**:
   - Open DevTools → Performance tab
   - Record performance while opening large modals

#### Solutions

**For Large Text Rendering:**
```typescript
// Implement virtual scrolling for large content
import { FixedSizeList as List } from 'react-window';

// Or use text chunking
const chunkedText = text.match(/.{1,10000}/g) || [];
```

**For Memory Management:**
```typescript
// Use shallowRef for large text to avoid reactivity overhead
import { shallowRef } from 'vue';

const largeTextContent = shallowRef('');
```

**For Progressive Loading:**
```typescript
const loadContentProgressively = async (sessionId: string, name: string) => {
  // Load preview first
  const preview = await fetch(`/subagents/${sessionId}/${name}/preview`);
  
  // Load full content on user request
  const fullContent = await fetch(`/subagents/${sessionId}/${name}/full`);
};
```

### 5. Real-time Updates Not Working

#### Symptoms
- New agents don't appear automatically in Sessions tab
- Prompt/response data doesn't update in real-time
- Stale data shown in modals

#### Diagnosis Steps
1. **Check WebSocket Connection**:
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://localhost:4000/stream');
   ws.onopen = () => console.log('WebSocket connected');
   ws.onmessage = (msg) => console.log('Received:', JSON.parse(msg.data));
   ws.onerror = (err) => console.error('WebSocket error:', err);
   ```

2. **Verify Server Events**:
   ```bash
   # Check recent events in database
   sqlite3 apps/server/events.db "SELECT * FROM events ORDER BY timestamp DESC LIMIT 5;"
   ```

#### Solutions

**For WebSocket Issues:**
```typescript
// Implement reconnection logic
class WebSocketManager {
  private reconnect() {
    setTimeout(() => {
      this.ws = new WebSocket(this.url);
      this.setupHandlers();
    }, 1000 * Math.pow(2, this.reconnectAttempts++));
  }
  
  private setupHandlers() {
    this.ws.onerror = () => this.reconnect();
    // ... other handlers
  }
}
```

**For Event Broadcasting:**
```typescript
// Ensure server broadcasts prompt/response updates
const updateAgent = (sessionId: string, name: string, data: UpdateAgentDataRequest) => {
  // Update database
  storeAgentPrompt(sessionId, name, data.initial_prompt);
  
  // Broadcast to clients
  const message = JSON.stringify({
    type: 'agent_updated',
    sessionId,
    name,
    data
  });
  
  wsClients.forEach(client => {
    try {
      client.send(message);
    } catch (err) {
      wsClients.delete(client);
    }
  });
};
```

### 6. Database Errors

#### Symptoms
- "Database locked" errors in server logs
- Missing prompt/response data
- Server crashes during agent creation

#### Diagnosis Steps
1. **Check Database Status**:
   ```bash
   sqlite3 apps/server/events.db ".timeout 1000"
   sqlite3 apps/server/events.db "PRAGMA integrity_check;"
   ```

2. **Review Server Logs**:
   ```bash
   tail -f apps/server/server.log | grep -i error
   ```

#### Solutions

**For Database Locks:**
```typescript
// Implement connection pooling and retries
const executeWithRetry = async (query: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return db.query(query);
    } catch (error) {
      if (error.message.includes('SQLITE_BUSY') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
};
```

**For Database Corruption:**
```bash
# Backup and restore database
cp apps/server/events.db apps/server/events.db.backup
sqlite3 apps/server/events.db ".backup main backup.db"
mv backup.db apps/server/events.db
```

## Performance Optimization

### Server-Side Optimizations

```typescript
// Add indexes for better query performance
db.query(`
  CREATE INDEX IF NOT EXISTS idx_subagent_session_name 
  ON subagent_registry(session_id, name);
`);

// Use prepared statements
const updatePromptStmt = db.prepare(`
  UPDATE subagent_registry 
  SET initial_prompt = ? 
  WHERE session_id = ? AND name = ?
`);
```

### Client-Side Optimizations

```typescript
// Implement caching
const agentDataCache = new Map<string, AgentData>();

const getCachedAgentData = (key: string) => {
  if (agentDataCache.has(key)) {
    return agentDataCache.get(key);
  }
  // Fetch from server and cache
};

// Use intersection observer for lazy loading
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadAgentData(entry.target.dataset.agentId);
    }
  });
});
```

## Monitoring and Debugging

### Log Analysis

```bash
# Monitor prompt capture in real-time
tail -f apps/server/server.log | grep "prompt\|response"

# Check for patterns in failures
grep -E "(error|failed)" apps/server/server.log | tail -20

# Monitor database performance
sqlite3 apps/server/events.db "PRAGMA compile_options;"
```

### Health Checks

```typescript
// Add health endpoint for prompt/response feature
app.get('/health/prompt-response', (req, res) => {
  try {
    const recentAgents = db.query(`
      SELECT COUNT(*) as count 
      FROM subagent_registry 
      WHERE initial_prompt IS NOT NULL 
      AND created_at > ?
    `).get(Date.now() - 3600000); // Last hour
    
    res.json({
      status: 'healthy',
      feature: 'prompt-response-capture',
      recent_captures: recentAgents.count
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Set environment variable
export DEBUG_PROMPT_CAPTURE=true

# Or in .env file
DEBUG_PROMPT_CAPTURE=true
```

```typescript
// In server code
const debug = process.env.DEBUG_PROMPT_CAPTURE === 'true';

const storeAgentPrompt = (sessionId: string, name: string, prompt: string) => {
  if (debug) {
    console.log(`[DEBUG] Storing prompt for ${name} (${prompt.length} chars)`);
  }
  // ... storage logic
};
```

## Recovery Procedures

### Data Recovery

If prompt/response data appears corrupted or missing:

```bash
# 1. Stop the server
pkill -f "bun.*server"

# 2. Backup current database
cp apps/server/events.db apps/server/events.db.backup

# 3. Check database integrity
sqlite3 apps/server/events.db "PRAGMA integrity_check;"

# 4. Recover from backup if needed
sqlite3 apps/server/events.db.backup ".backup main apps/server/events.db"

# 5. Restart server
cd apps/server && bun run src/index.ts
```

### System Reset

For complete system reset (WARNING: loses all data):

```bash
# Stop all processes
./scripts/reset-system.sh

# Remove database
rm -f apps/server/events.db*

# Restart system
./scripts/start-system.sh
```

## Prevention Best Practices

1. **Regular Backups**:
   ```bash
   # Add to crontab for daily backups
   0 2 * * * sqlite3 /path/to/events.db ".backup main /path/to/backups/events-$(date +%Y%m%d).db"
   ```

2. **Monitor Disk Space**:
   ```bash
   # Check available space
   df -h | grep -E "(server|events)"
   ```

3. **Update Dependencies**:
   ```bash
   cd apps/server && bun update
   cd apps/client && npm update
   ```

4. **Review Logs Regularly**:
   ```bash
   # Set up log rotation
   logrotate /etc/logrotate.d/observability-system
   ```

## Getting Additional Help

### Log Collection for Support

When requesting help, collect these logs:

```bash
# Create support bundle
mkdir -p support-logs
cp apps/server/server.log support-logs/
sqlite3 apps/server/events.db ".schema" > support-logs/schema.sql
sqlite3 apps/server/events.db "SELECT COUNT(*) FROM subagent_registry WHERE initial_prompt IS NOT NULL" > support-logs/capture-stats.txt
tar -czf support-bundle.tar.gz support-logs/
```

### Community Resources

- Check GitHub issues for similar problems
- Review the technical architecture document
- Consult the main system README for general troubleshooting
- Contact the development team with specific error messages and steps to reproduce

---

This troubleshooting guide covers the most common issues with the Agent Prompt & Response Capture feature. For implementation details, see the [technical architecture documentation](./agent-prompt-response-architecture.md).