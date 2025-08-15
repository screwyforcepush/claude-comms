# 🚀 Scripts Documentation - Multi-Agent Observability System

**Time to Complete**: 5-10 minutes to understand all scripts  
**Prerequisites**: [System Setup](../README.md)  
**Difficulty**: Beginner to Intermediate  
**Last Updated**: January 2025

---

## 📋 Overview

This directory contains all automation scripts for the Multi-Agent Observability System. These scripts handle system lifecycle management, testing, data population, and UI validation tasks.

## 📂 Directory Structure

```
scripts/
├── README.md                     # This documentation
├── start-system.sh              # Start both server and client
├── reset-system.sh              # Stop all processes and clean up
├── test-system.sh               # Run system integration tests
├── test-event-indicators.js     # Test event indicator features
├── populate-test-agents.ts      # Generate realistic test data
├── verify-test-data.ts          # Validate test data integrity
├── capture/                     # Screenshot capture utilities
│   ├── capture-timeline.js      # Capture timeline screenshots
│   └── capture-sessions-timeline.js # Capture sessions view screenshots
└── tests/                       # Test automation scripts
    ├── html/                    # HTML test files
    ├── playwright/              # Playwright automation scripts
    ├── test-batch-spacing.js   # Test batch spacing functionality
    ├── test-prompt-capture.js  # Test prompt capture feature
    ├── test-prompt-response-ui.js # Test prompt/response UI
    └── test-websocket-realtime.js # Test WebSocket real-time features
```

---

## 🛠️ System Management Scripts

### 🚀 start-system.sh

**Purpose**: Starts the complete Multi-Agent Observability System  
**Usage**: Development workflow initialization

```bash
# Start both server and client
./scripts/start-system.sh

# The script will:
# 1. Check for port conflicts (4000, 5173)
# 2. Start server on port 4000
# 3. Start client on port 5173
# 4. Display status and URLs
# 5. Wait for both processes (Ctrl+C to stop)
```

**Features**:
- Port conflict detection
- Health check validation
- Colored status output
- Process cleanup on exit
- Automatic dependency waiting

**URLs Provided**:
- Client: `http://localhost:5173`
- Server API: `http://localhost:4000`
- WebSocket: `ws://localhost:4000/stream`

### 🛑 reset-system.sh

**Purpose**: Stops all system processes and cleans up resources  
**Usage**: System cleanup and troubleshooting

```bash
# Stop all processes and clean up
./scripts/reset-system.sh

# The script will:
# 1. Kill processes on ports 4000 and 5173
# 2. Clean up SQLite WAL files
# 3. Optionally clear database (interactive prompt)
# 4. Display cleanup status
```

**Cleanup Operations**:
- Process termination (graceful and forceful)
- SQLite WAL file removal
- Optional database clearing
- Cross-platform process management (macOS/Linux)

**Interactive Options**:
- Choose to preserve or clear event database
- Safe defaults (preserve data by default)

### 🧪 test-system.sh

**Purpose**: Runs comprehensive system integration tests  
**Usage**: Automated testing and validation

```bash
# Run full system test suite
./scripts/test-system.sh

# Test sequence:
# 1. Start server in background
# 2. Test event endpoints
# 3. Test filter options
# 4. Test demo agent hooks
# 5. Verify recent events
# 6. Clean up processes
```

**Test Coverage**:
- Server startup verification
- API endpoint functionality
- Event submission and retrieval
- Filter options validation
- Demo agent hook execution
- JSON response validation

---

## 🎯 Feature Testing Scripts

### 📊 test-event-indicators.js

**Purpose**: Validates event indicator functionality in the UI  
**Framework**: Playwright automation  
**Target**: Sessions timeline event indicators

```bash
# Test event indicators feature
node scripts/test-event-indicators.js

# Prerequisites:
# - System running (both server and client)
# - Test data populated
# - Browser dependencies installed
```

**Test Scenarios**:
- Event indicator rendering (blue circles, orange triangles)
- Hover interactions and tooltips
- Click interactions and detail panels
- Panel opening/closing with Esc key
- Pointer events and clickability
- Background click handling

**Generated Screenshots**:
- `screenshots/event-indicators-overview.png`
- `screenshots/event-indicator-hover.png`
- `screenshots/event-detail-panel.png`
- `screenshots/notification-detail-panel.png`

### 📈 populate-test-agents.ts

**Purpose**: Generates realistic test data for development and testing  
**Runtime**: Bun TypeScript execution  
**Database**: SQLite with test scenarios

```bash
# Generate comprehensive test data
bun run scripts/populate-test-agents.ts

# Generates:
# - 10 test agents across 3 sessions
# - 45+ test events with realistic timing
# - Inter-agent communication messages
# - Varied durations, token counts, tool usage
```

**Generated Test Data**:

**Session 1** (`session-2024-01-15-auth-feature`):
- 3 completed agents
- 1 in-progress agent  
- 1 pending agent
- Focus: Authentication implementation

**Session 2** (`session-2024-01-15-ui-components`):
- 3 completed agents
- Focus: UI component development

**Session 3** (`session-2024-01-15-database-migration`):
- 1 completed agent
- 1 in-progress agent
- Focus: Database schema migration

**Data Characteristics**:
- Realistic agent names and types
- Duration ranges: 500ms - 120s
- Token counts: 100 - 50,000
- Tool usage: 1-30 tools per agent
- Status distribution across pending/in_progress/completed

### ✅ verify-test-data.ts

**Purpose**: Validates test data integrity and completeness  
**Usage**: Data verification and troubleshooting

```bash
# Verify test data integrity
bun run scripts/verify-test-data.ts

# Checks:
# - Agent count (expected: 10)
# - Event count (expected: 45+)
# - Message count (expected: 4+)
# - Session distribution
# - Event type distribution
```

**Verification Reports**:
- Total agents, events, and messages
- Session breakdown with agent counts
- Event type distribution
- Status validation against expectations

---

## 📸 Screenshot Capture Scripts

### 🖼️ capture/capture-timeline.js

**Purpose**: Captures timeline UI screenshots for documentation  
**Viewport**: Multiple responsive breakpoints  
**Features**: Interactive testing and visual validation

```bash
# Capture timeline screenshots
node scripts/capture/capture-timeline.js

# Prerequisites:
# - System running on localhost:5173
# - Sessions tab accessible
# - Test data available
```

**Captured Views**:
- Desktop main view (1920x1080)
- Time window variations (15m, 1h, 6h, 24h)
- Zoom states (zoomed in/out)
- Mobile viewport (375x667)
- Interactive states (agent selection)

**Generated Files**:
- `screenshots/timeline/desktop-main.png`
- `screenshots/timeline/desktop-15min.png`
- `screenshots/timeline/desktop-zoomed.png`
- `screenshots/timeline/mobile-view.png`

### 📱 capture/capture-sessions-timeline.js

**Purpose**: Comprehensive responsive screenshot capture  
**Viewports**: Multiple device breakpoints  
**Output**: Organized screenshot directory

```bash
# Capture responsive screenshots
node scripts/capture/capture-sessions-timeline.js

# Captures across viewports:
# - Mobile (375x667)
# - Tablet (768x1024)  
# - Laptop (1366x768)
# - Desktop (1920x1080)
# - 4K (3840x2160)
```

**Screenshot Organization**:
```
screenshots/sessions-timeline/
├── sessions-desktop-1920x1080.png
├── sessions-mobile-375x667.png
├── sessions-tablet-768x1024.png
├── sessions-laptop-1366x768.png
├── sessions-4k-3840x2160.png
├── sessions-15m-window.png
├── sessions-1h-window.png
├── sessions-6h-window.png
├── sessions-24h-window.png
└── sessions-zoomed-in.png
```

---

## 🔬 Advanced Testing Scripts

### 🎭 tests/playwright/playwright-ui-test.js

**Purpose**: End-to-end UI testing for prompt/response features  
**Framework**: Playwright with visual validation  
**Target**: Agent detail panes and modal interactions

```bash
# Run comprehensive UI tests
node scripts/tests/playwright/playwright-ui-test.js

# Test flow:
# 1. Navigate to application
# 2. Access Agents tab
# 3. Open agent detail pane
# 4. Test prompt/response modal
# 5. Capture screenshots for validation
```

**Test Coverage**:
- Agent card interaction
- Detail pane opening
- Prompt/response section visibility
- Modal opening and functionality
- Full page visual validation

### 🌐 tests/test-websocket-realtime.js

**Purpose**: WebSocket real-time functionality testing  
**Framework**: Node.js WebSocket client  
**Performance**: High-frequency update testing

```bash
# Test WebSocket real-time features
node scripts/tests/test-websocket-realtime.js

# Prerequisites:
# - Server running on localhost:4000
# - WebSocket endpoint active (/stream)
```

**Test Scenarios**:

1. **Connection and Subscription**:
   - WebSocket connection establishment
   - Multi-session subscription
   - Subscription confirmation

2. **High-Frequency Updates**:
   - 20 updates per second (200 total)
   - Agent status update simulation
   - Message processing rate measurement

3. **Reconnection Logic**:
   - Exponential backoff testing
   - Connection loss simulation
   - Automatic reconnection attempts

4. **Event Queuing**:
   - Event queuing during disconnection
   - Event consolidation logic
   - Queue processing on reconnection

**Performance Metrics**:
- Test duration and message rate
- Memory usage monitoring
- Reconnection attempt tracking
- Message processing efficiency

---

## 🧰 Utility Scripts Reference

### Script Execution Patterns

**Shell Scripts** (`.sh`):
```bash
# Make executable (if needed)
chmod +x scripts/script-name.sh

# Execute directly
./scripts/script-name.sh
```

**Node.js Scripts** (`.js`):
```bash
# Direct execution
node scripts/script-name.js

# With specific Node.js version
node --version && node scripts/script-name.js
```

**TypeScript Scripts** (`.ts`):
```bash
# Using Bun runtime
bun run scripts/script-name.ts

# Alternative with ts-node (if available)
npx ts-node scripts/script-name.ts
```

### Common Prerequisites

**For All Scripts**:
- Node.js 18+ installed
- Dependencies installed (`npm install` or `bun install`)
- Project built (`npm run build` in both apps)

**For UI/Visual Scripts**:
- System running (`./scripts/start-system.sh`)
- Browser dependencies for Playwright
- Test data populated (`bun run scripts/populate-test-agents.ts`)

**For WebSocket Scripts**:
- Server running on port 4000
- WebSocket endpoint accessible
- Network connectivity to localhost

### Error Handling and Troubleshooting

**Common Issues**:

1. **Port Already in Use**:
   ```bash
   # Reset the system first
   ./scripts/reset-system.sh
   # Then restart
   ./scripts/start-system.sh
   ```

2. **Missing Dependencies**:
   ```bash
   # Reinstall dependencies
   npm install
   # Or with Bun
   bun install
   ```

3. **Database Issues**:
   ```bash
   # Reset with database clear
   ./scripts/reset-system.sh
   # Choose 'y' when prompted to clear database
   ```

4. **Playwright Browser Issues**:
   ```bash
   # Install Playwright browsers
   npx playwright install
   ```

### Performance Considerations

**Resource Usage**:
- System scripts: Low resource usage
- Playwright scripts: Moderate CPU/memory usage
- WebSocket tests: Network-intensive
- Data population: Database-intensive

**Execution Time**:
- System management: 5-30 seconds
- Screenshot capture: 30-60 seconds
- UI testing: 1-3 minutes
- Data population: 10-30 seconds

---

## 🔗 Related Documentation

**Setup and Configuration**:
- [Main README](../README.md) - System overview and setup
- [Server README](../apps/server/README.md) - Backend configuration
- [Client README](../apps/client/README.md) - Frontend setup

**Development Guides**:
- [Architecture Guide](../docs/project/guides/architecture/) - System design
- [API Reference](../docs/project/guides/api-reference.md) - Backend APIs
- [Testing Guide](../docs/project/guides/testing/) - Testing patterns

**Phase Documentation**:
- [Phase 06 Definition](../docs/project/phases/06-codebase-maintenance/phase-definition.md) - Current maintenance phase
- [Formatting Standards](../docs/project/phases/06-codebase-maintenance/formatting-style-standards.md) - Documentation style guide

---

## 💡 Usage Examples

### Development Workflow
```bash
# 1. Start system for development
./scripts/start-system.sh

# 2. In another terminal, populate test data
bun run scripts/populate-test-agents.ts

# 3. Verify data integrity
bun run scripts/verify-test-data.ts

# 4. Run visual tests
node scripts/test-event-indicators.js

# 5. When done, clean up
./scripts/reset-system.sh
```

### Testing Workflow
```bash
# 1. Run system tests
./scripts/test-system.sh

# 2. Run UI automation tests
node scripts/tests/playwright/playwright-ui-test.js

# 3. Test WebSocket functionality
node scripts/tests/test-websocket-realtime.js

# 4. Capture documentation screenshots
node scripts/capture/capture-sessions-timeline.js
```

### Troubleshooting Workflow
```bash
# 1. Reset everything
./scripts/reset-system.sh

# 2. Start fresh
./scripts/start-system.sh

# 3. Repopulate data
bun run scripts/populate-test-agents.ts

# 4. Verify system health
./scripts/test-system.sh
```

---

**📚 For more guides, visit our [documentation hub](../docs/project/guides/README.md).**