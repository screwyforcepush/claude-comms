[← Back to Main Documentation](../../../README.md) → [Technical Guides](../README.md) → Development Guide

# Development Guide

**Time to Complete**: 30-45 minutes  
**Prerequisites**: Basic development experience with TypeScript/Vue.js/Python  
**Difficulty**: Intermediate

A comprehensive guide for developing and contributing to the Claude Code Multi-Agent Observability & Communication System, covering local setup, testing strategies, debugging tools, and architectural patterns.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Architecture Overview](#project-architecture-overview)
- [Testing Strategy & TDD Patterns](#testing-strategy--tdd-patterns)
- [Code Organization & Standards](#code-organization--standards)
- [Debugging & Development Tools](#debugging--development-tools)
- [CI/CD Pipeline & Workflows](#cicd-pipeline--workflows)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Advanced Development Patterns](#advanced-development-patterns)

---

## Development Environment Setup

### Prerequisites

Ensure you have the following tools installed:

**Required Core Tools**:
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's CLI for Claude
- **[Astral uv](https://docs.astral.sh/uv/)** - Fast Python package manager for hooks
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime (recommended)
- **Node.js 18+** - Required for client development
- **Python 3.8+** - Required for hook scripts

**Development Tools**:
- **Git** - Version control
- **VS Code** or **JetBrains WebStorm** - Recommended IDEs
- **Docker** (optional) - For containerized development

### Quick Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/claude-comms.git
cd claude-comms

# 2. Install dependencies for both client and server
cd apps/server && bun install
cd ../client && bun install && cd ../..

# 3. Set up environment variables
cp .env.sample .env
# Edit .env with your API keys

# 4. Start development servers
./scripts/start-system.sh
```

### IDE Configuration

**VS Code Extensions (Recommended)**:
```json
{
  "recommendations": [
    "Vue.volar",
    "ms-python.python",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**VS Code Settings**:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.vue": "vue"
  }
}
```

---

## Project Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Vue 3 + Vite)               │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Dashboard     │  │   Timeline   │  │   Matrix    │ │
│  │   Components    │  │   View       │  │   Mode      │ │
│  └─────────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                        WebSocket + HTTP API
                              │
┌─────────────────────────────────────────────────────────┐
│                   Server (Bun + TypeScript)            │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   API Routes    │  │   WebSocket  │  │   Event     │ │
│  │   Handler       │  │   Server     │  │   Storage   │ │
│  └─────────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                         SQLite Database
                              │
┌─────────────────────────────────────────────────────────┐
│              Claude Code Hook Integration               │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Event Hooks   │  │  Communication│  │   Agent     │ │
│  │   (Python)      │  │   System      │  │   Tracking  │ │
│  └─────────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Core Modules

**Client Architecture (`apps/client/`)**:
```
src/
├── components/           # Vue 3 components
│   ├── ui/              # Base UI components
│   ├── timeline/        # Timeline-specific components
│   └── matrix/          # Matrix mode components
├── composables/         # Vue composition API functions
├── stores/             # State management (Pinia)
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── assets/             # Static assets
```

**Server Architecture (`apps/server/`)**:
```
src/
├── api/                # HTTP API routes
├── websocket/          # WebSocket server implementation
├── database/           # Database operations and models
├── types/              # Shared TypeScript types
├── utils/              # Server utilities
└── middleware/         # Express-like middleware
```

**Hook System (`.claude/hooks/`)**:
```
.claude/hooks/
├── observability/      # Event capture hooks
├── comms/             # Multi-agent communication
└── utils/             # Shared hook utilities
```

---

## Testing Strategy & TDD Patterns

### Testing Philosophy

This project follows **Test-Driven Development (TDD)** principles with a comprehensive testing pyramid:

```
        /\
       /  \
      /E2E \     ← Few, high-value integration tests
     /______\
    /        \
   / INTEG.  \   ← Component integration tests
  /___________\
 /             \
/ UNIT TESTS   \  ← Many, fast, isolated tests
/_________________\
```

### Test Categories

#### 1. Unit Tests (Foundation Layer)

**Client Unit Tests** (`apps/client/src/**/*.test.ts`):
```typescript
// Example: Component unit test with Vue Test Utils
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TimelineComponent from '../components/timeline/TimelineComponent.vue'

describe('TimelineComponent', () => {
  it('should render agent events correctly', () => {
    const wrapper = mount(TimelineComponent, {
      props: {
        events: mockEvents,
        agents: mockAgents
      }
    })
    
    expect(wrapper.find('[data-testid="timeline-event"]')).toBeTruthy()
    expect(wrapper.vm.filteredEvents).toHaveLength(3)
  })
})
```

**Server Unit Tests** (`apps/server/src/**/*.test.ts`):
```typescript
// Example: API route unit test
import { describe, it, expect } from 'bun:test'
import { app } from '../index'

describe('Events API', () => {
  it('should create new event', async () => {
    const response = await app.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockEventData)
    })
    
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.event_id).toBeDefined()
  })
})
```

#### 2. Integration Tests (Component Layer)

**Component Integration** (`apps/client/tests/integration/`):
```typescript
// Example: Store-Component integration test
import { createPinia, setActivePinia } from 'pinia'
import { useEventStore } from '@/stores/events'

describe('Event Store Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should sync with WebSocket events', async () => {
    const store = useEventStore()
    const mockWS = new MockWebSocket()
    
    store.connectWebSocket(mockWS)
    mockWS.send(mockEventMessage)
    
    await nextTick()
    expect(store.events).toContain(mockEventMessage.data)
  })
})
```

#### 3. End-to-End Tests (User Journey Layer)

**Playwright E2E Tests** (`apps/client/tests/playwright/`):
```typescript
// Example: Full user workflow test
import { test, expect } from '@playwright/test'

test('agent timeline workflow', async ({ page }) => {
  await page.goto('/')
  
  // Start monitoring session
  await page.click('[data-testid="start-monitoring"]')
  
  // Trigger agent activity (via API)
  await page.request.post('/api/events', {
    data: mockAgentEvent
  })
  
  // Verify timeline updates
  await expect(page.locator('[data-testid="timeline-event"]')).toBeVisible()
  await expect(page.locator('.agent-status')).toHaveText('Active')
})
```

### TDD Workflow Pattern

**Red-Green-Refactor Cycle**:

1. **RED**: Write failing test first
```typescript
// 1. Write the test (fails initially)
describe('AgentCommunicationSystem', () => {
  it('should broadcast message to all agents', () => {
    const system = new AgentCommunicationSystem()
    const result = system.broadcast('test-message')
    expect(result.delivered).toBe(true)
    expect(result.recipients).toHaveLength(3)
  })
})
```

2. **GREEN**: Write minimal code to pass
```typescript
// 2. Implement just enough to pass
class AgentCommunicationSystem {
  broadcast(message: string) {
    return { delivered: true, recipients: ['agent1', 'agent2', 'agent3'] }
  }
}
```

3. **REFACTOR**: Improve code quality
```typescript
// 3. Refactor for production quality
class AgentCommunicationSystem {
  private agents: Agent[] = []
  
  broadcast(message: string): BroadcastResult {
    const results = this.agents.map(agent => 
      this.sendToAgent(agent, message)
    )
    
    return {
      delivered: results.every(r => r.success),
      recipients: results.map(r => r.agentId),
      errors: results.filter(r => !r.success).map(r => r.error)
    }
  }
}
```

### Running Tests

**Quick Test Commands**:
```bash
# Run all tests
./scripts/test-system.sh

# Client tests only
cd apps/client
bun test                    # Unit tests
bun test:watch             # Watch mode
bun test:coverage          # Coverage report
npx playwright test        # E2E tests

# Server tests only
cd apps/server
bun test                   # Unit tests
bun test:watch            # Watch mode
bun test:coverage         # Coverage report
```

### Coverage Requirements

- **Unit Tests**: >90% coverage for new code
- **Integration Tests**: All critical user paths covered
- **E2E Tests**: Core workflows verified
- **Regression Tests**: All bug fixes include tests

---

## Code Organization & Standards

### TypeScript Configuration

**Strict TypeScript Settings** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Code Standards

#### 1. TypeScript/JavaScript Standards

**Naming Conventions**:
```typescript
// ✅ Good: Clear, descriptive names
class AgentEventProcessor {
  private readonly eventQueue: Queue<AgentEvent>
  
  async processEventBatch(events: AgentEvent[]): Promise<ProcessResult> {
    // Implementation
  }
}

// ❌ Bad: Unclear, abbreviated names
class AEP {
  private q: any
  
  async proc(evts: any): Promise<any> {
    // Implementation
  }
}
```

**Function Design Patterns**:
```typescript
// ✅ Good: Single responsibility, pure when possible
const calculateEventPriority = (event: AgentEvent): Priority => {
  const typeWeights = { error: 10, warning: 5, info: 1 }
  return typeWeights[event.type] || 1
}

// ✅ Good: Clear error handling
const fetchEvents = async (filters: EventFilters): Promise<Result<AgentEvent[], ApiError>> => {
  try {
    const response = await api.get('/events', { params: filters })
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: new ApiError(error.message) }
  }
}
```

#### 2. Vue.js Component Standards

**Component Structure**:
```vue
<template>
  <!-- Use semantic HTML -->
  <section class="timeline-container" role="main" aria-label="Agent Timeline">
    <header class="timeline-header">
      <h2>Agent Activity Timeline</h2>
    </header>
    
    <div class="timeline-content" data-testid="timeline-events">
      <!-- Component content -->
    </div>
  </section>
</template>

<script setup lang="ts">
// ✅ Good: Type-safe props and emits
interface Props {
  events: AgentEvent[]
  agentFilter?: string
  autoRefresh?: boolean
}

interface Emits {
  (e: 'event-selected', event: AgentEvent): void
  (e: 'filter-changed', filter: string): void
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true
})

const emit = defineEmits<Emits>()

// ✅ Good: Composition API with clear separation
const { filteredEvents, currentPage } = useEventFiltering(props.events)
const { isConnected, connect } = useWebSocket()
</script>

<style scoped>
/* ✅ Good: BEM naming convention with Tailwind */
.timeline-container {
  @apply flex flex-col h-full bg-white dark:bg-gray-900;
}

.timeline-header {
  @apply flex items-center justify-between p-4 border-b;
}
</style>
```

#### 3. Python Hook Standards

**Hook Script Pattern**:
```python
#!/usr/bin/env python3
"""
Event capture hook for Claude Code observability.

This hook captures tool execution events and sends them to the
observability server for real-time monitoring.
"""

import json
import sys
import argparse
from typing import Dict, Any, Optional
from pathlib import Path

def capture_event(event_type: str, payload: Dict[str, Any]) -> bool:
    """
    Capture and send event to observability server.
    
    Args:
        event_type: Type of event (PreToolUse, PostToolUse, etc.)
        payload: Event data payload
        
    Returns:
        True if event was sent successfully, False otherwise
    """
    try:
        # Event processing logic
        return send_to_server(event_type, payload)
    except Exception as e:
        # Graceful degradation - never break Claude Code workflow
        log_error(f"Hook error: {e}")
        return False

if __name__ == "__main__":
    # CLI interface for hook
    parser = argparse.ArgumentParser(description="Claude Code observability hook")
    parser.add_argument("--event-type", required=True)
    parser.add_argument("--source-app", default="claude-code")
    
    args = parser.parse_args()
    
    # Read event data from stdin
    payload = json.load(sys.stdin)
    
    success = capture_event(args.event_type, payload)
    sys.exit(0 if success else 1)
```

### Architecture Patterns from Extracted Knowledge

Based on AliceNova's extracted patterns, implement these proven architectural approaches:

#### 1. Three-Level Cache Architecture
```typescript
// Implementation of hierarchical caching pattern
class CacheManager {
  private l1Cache = new Map<string, any>()        // Memory cache
  private l2Cache = new DiskCache()               // Persistent cache
  
  async get<T>(key: string): Promise<T | null> {
    // L1: Check memory cache
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key)
    }
    
    // L2: Check disk cache
    const diskValue = await this.l2Cache.get(key)
    if (diskValue) {
      this.l1Cache.set(key, diskValue)  // Promote to L1
      return diskValue
    }
    
    // L3: Generate from source (not implemented here)
    return null
  }
}
```

#### 2. Error Recovery Mechanisms
```typescript
// Standardized error handling pattern
class ErrorFactory {
  static apiError(message: string, details?: any): ApiError {
    return new ApiError('API_ERROR', message, details)
  }
  
  static validationError(message: string, field: string): ValidationError {
    return new ValidationError('VALIDATION_ERROR', message, { field })
  }
}

// Atomic operation pattern with rollback
async function atomicOperation<T>(
  operation: () => Promise<T>,
  rollback: () => Promise<void>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    await rollback()
    throw error
  }
}
```

---

## Debugging & Development Tools

### Development Server Configuration

**Hot Reload Setup**:
```bash
# Terminal 1: Server with hot reload
cd apps/server
bun --watch src/index.ts

# Terminal 2: Client with hot reload
cd apps/client
bun dev

# Terminal 3: Hook development
cd .claude/hooks
python -m pytest --watch
```

### Browser DevTools Integration

**Vue DevTools Configuration**:
```typescript
// Enable Vue DevTools in development
if (import.meta.env.DEV) {
  app.config.devtools = true
  app.config.debug = true
}
```

### Server-Side Debugging

**Bun Debugger Setup**:
```bash
# Start server with inspector
bun --inspect src/index.ts

# Connect VS Code debugger
# Add to .vscode/launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Bun",
  "port": 6499
}
```

### WebSocket Debugging

**Real-time Event Monitoring**:
```typescript
// Add to client for debugging WebSocket events
if (import.meta.env.DEV) {
  const originalSend = WebSocket.prototype.send
  WebSocket.prototype.send = function(data) {
    console.log('WS Send:', data)
    return originalSend.call(this, data)
  }
}
```

### Python Hook Debugging

**Hook Development Pattern**:
```python
# Debug hook in isolation
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def debug_hook_execution():
    """Test hook functionality without Claude Code."""
    test_payload = {
        "tool_name": "Bash",
        "command": "ls -la",
        "session_id": "debug-session"
    }
    
    result = capture_event("PreToolUse", test_payload)
    logger.info(f"Hook result: {result}")

if __name__ == "__main__":
    debug_hook_execution()
```

### Performance Profiling

**Client Performance Monitoring**:
```typescript
// Add performance markers
const measureComponentRender = (componentName: string) => {
  performance.mark(`${componentName}-start`)
  
  onMounted(() => {
    performance.mark(`${componentName}-end`)
    performance.measure(
      `${componentName}-render`,
      `${componentName}-start`,
      `${componentName}-end`
    )
  })
}
```

---

## CI/CD Pipeline & Workflows

### GitHub Actions Integration

The project uses GitHub Actions for automated testing and deployment:

**Test Pipeline** (`.github/workflows/test.yml`):
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      # Server tests
      - name: Test Server
        run: |
          cd apps/server
          bun install
          bun test
          
      # Client tests
      - name: Test Client
        run: |
          cd apps/client
          bun install
          bun test
          
      # E2E tests
      - name: E2E Tests
        run: |
          ./scripts/start-system.sh &
          sleep 10
          cd apps/client
          npx playwright test
```

### Pre-commit Hooks

**Setup Husky for Git Hooks**:
```bash
# Install husky
bun add -D husky

# Setup pre-commit hook
echo "#!/bin/sh
./scripts/test-system.sh
bun run lint" > .husky/pre-commit
```

### Local Quality Gates

**Development Quality Checklist**:
```bash
# Run before committing
./scripts/quality-check.sh

# Contents of quality-check.sh:
#!/bin/bash
echo "🔍 Running quality checks..."

# 1. Lint checks
cd apps/client && bun run lint
cd apps/server && bun run lint

# 2. Type checking
cd apps/client && bun run type-check
cd apps/server && bun run type-check

# 3. Unit tests
bun test

# 4. Integration tests
./scripts/test-system.sh

echo "✅ All quality checks passed!"
```

---

## Performance Optimization

### Client-Side Optimization

**Vue Performance Patterns**:
```typescript
// ✅ Good: Use v-memo for expensive lists
<template>
  <div v-for="event in events" 
       :key="event.id"
       v-memo="[event.timestamp, event.status]">
    {{ event.details }}
  </div>
</template>

// ✅ Good: Lazy load heavy components
const MatrixMode = defineAsyncComponent(() => import('./MatrixMode.vue'))

// ✅ Good: Virtual scrolling for large lists
import { FixedSizeList as List } from 'vue-virtual-scroller'
```

**WebSocket Optimization**:
```typescript
// Batch events to reduce re-renders
const useBatchedEvents = (batchSize = 10, delay = 100) => {
  const eventBatch = ref<AgentEvent[]>([])
  
  const debouncedFlush = debounce(() => {
    emit('batch-update', eventBatch.value)
    eventBatch.value = []
  }, delay)
  
  const addEvent = (event: AgentEvent) => {
    eventBatch.value.push(event)
    
    if (eventBatch.value.length >= batchSize) {
      debouncedFlush.flush()
    } else {
      debouncedFlush()
    }
  }
  
  return { addEvent }
}
```

### Server-Side Optimization

**Database Query Optimization**:
```typescript
// Use prepared statements and indexing
const getEventsByAgent = db.prepare(`
  SELECT * FROM events 
  WHERE agent_id = ? 
  AND timestamp > ? 
  ORDER BY timestamp DESC 
  LIMIT ?
`)

// Add database indexes for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_agent_timestamp 
  ON events(agent_id, timestamp);
  
  CREATE INDEX IF NOT EXISTS idx_events_session 
  ON events(session_id);
`)
```

---

## Security Considerations

### Input Validation

**API Request Validation**:
```typescript
import { z } from 'zod'

const EventSchema = z.object({
  source_app: z.string().min(1).max(100),
  session_id: z.string().uuid(),
  hook_event_type: z.enum(['PreToolUse', 'PostToolUse', 'PromptSubmit']),
  payload: z.record(z.any())
})

app.post('/events', async (req, res) => {
  try {
    const validatedData = EventSchema.parse(req.body)
    // Process validated data
  } catch (error) {
    return res.status(400).json({ error: 'Invalid request data' })
  }
})
```

### Hook Script Security

**Secure Hook Implementation**:
```python
import os
import tempfile
from pathlib import Path

def secure_file_write(content: str, filename: str) -> bool:
    """Securely write content to file with proper permissions."""
    try:
        # Use secure temp directory
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            f.write(content)
            temp_path = f.name
        
        # Set secure permissions (owner read/write only)
        os.chmod(temp_path, 0o600)
        
        # Move to final location
        final_path = Path(filename)
        final_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(temp_path, final_path)
        
        return True
    except Exception as e:
        logger.error(f"Secure write failed: {e}")
        return False
```

---

## Advanced Development Patterns

### Multi-Agent Communication Patterns

Based on the extracted patterns, implement proper agent coordination:

```typescript
// Agent communication message types
interface AgentMessage {
  sender: string
  recipient: string | 'broadcast'
  type: 'status' | 'data' | 'command'
  payload: any
  timestamp: number
}

class AgentCommunicationHub {
  private agents = new Map<string, AgentConnection>()
  
  broadcast(message: Omit<AgentMessage, 'recipient'>) {
    const broadcastMessage: AgentMessage = {
      ...message,
      recipient: 'broadcast'
    }
    
    for (const [agentId, connection] of this.agents) {
      if (agentId !== message.sender) {
        connection.send(broadcastMessage)
      }
    }
  }
  
  sendDirect(agentId: string, message: Omit<AgentMessage, 'recipient'>) {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.send({ ...message, recipient: agentId })
    }
  }
}
```

### State Management Patterns

**Pinia Store Organization**:
```typescript
// stores/events.ts
export const useEventStore = defineStore('events', () => {
  const events = ref<AgentEvent[]>([])
  const filteredEvents = computed(() => /* filtering logic */)
  
  const addEvent = (event: AgentEvent) => {
    events.value.unshift(event)
    
    // Implement retention policy
    if (events.value.length > MAX_EVENTS) {
      events.value = events.value.slice(0, MAX_EVENTS)
    }
  }
  
  return { events, filteredEvents, addEvent }
})
```

This development guide provides a comprehensive foundation for contributing to the Claude Code Multi-Agent Observability system. The patterns and practices outlined here are based on proven architectural decisions extracted from previous phases and represent battle-tested approaches to building scalable, maintainable systems.

For specific implementation details, refer to the related guides:
- [Architecture Guide](./architecture-guide.md) - Deep dive into system design
- [Testing Strategy](./test-architecture-best-practices.md) - Comprehensive testing approaches
- [API Reference](./api-reference.md) - Complete API documentation

---

*Last Updated: 2025-08-16*  
*Created by: HenryComet*  
*Based on patterns extracted by: AliceNova*  
*Contributing guidelines established by: BobStellar*