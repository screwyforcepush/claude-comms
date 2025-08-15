# Multi-Agent Observability Dashboard - Interactive Vue 3 Real-time Analytics

Modern Vue 3 TypeScript dashboard providing comprehensive real-time visualization and analytics for Claude Code multi-agent workflows. Features interactive timelines, agent communications monitoring, and advanced session analytics with WebSocket-powered live updates.

## 🚀 Quick Start

**Goal**: Running dashboard in 45 seconds
**Prerequisites**: Node.js/Bun + [Server running](../server/README.md) on localhost:4000

### Installation (3 commands max)
```bash
# 1. Install dependencies
bun install

# 2. Start development server
bun run dev

# 3. Open dashboard
open http://localhost:5173
```

**Expected Result**: Dashboard loads with real-time timeline, agent communication panels, and WebSocket connection indicators active

## 🎯 What This Does

### Core Capabilities
1. **Real-time Timeline**: Live event visualization with auto-scroll and filtering
2. **Agent Communication**: Inter-agent message monitoring and chat transcripts  
3. **Session Analytics**: Multi-session comparison and performance metrics
4. **Interactive UI**: Responsive design with advanced filtering and search
5. **Visual Analytics**: Pulse charts, agent timelines, and session visualizations

### Key Benefits
- Zero-latency real-time updates via WebSocket streaming
- Advanced filtering by session, agent, event type, and time ranges
- Comprehensive agent lifecycle and communication monitoring  
- Responsive design supporting desktop and mobile workflows
- Extensible component architecture for custom analytics

## 🏗️ Architecture Overview

```
Bun Server WebSocket → Vue 3 Composables → Reactive Components → TailwindCSS UI
      ↓                     ↓                    ↓
  Live Data Updates → State Management → Interactive Timeline
      ↓                     ↓                    ↓  
  Session Analytics → Performance → Visual Components
```

**Tech Stack**: Vue 3, TypeScript, Vite, TailwindCSS, WebSocket, Vitest
**Integration**: WebSocket client with reactive state management

## 📦 Integration Guide

### Add to Your Project
```bash
# 1. Copy dashboard to your workspace
cp -R apps/client /path/to/your/workspace/

# 2. Configure server connection
cp .env.sample .env

# 3. Start development
bun run dev
```

### Basic Configuration
```json
{
  "server": {
    "url": "http://localhost:4000",
    "websocket": "ws://localhost:4000/stream"
  },
  "features": {
    "realTimeUpdates": true,
    "agentCommunications": true,
    "sessionAnalytics": true,
    "performanceMetrics": true
  }
}
```

## 📚 Documentation Hub

### 🚀 Getting Started
→ [Development Setup](../../docs/project/guides/development.md) - Local development environment (5 min)
→ [Dashboard Guide](../../docs/project/guides/dashboard-usage.md) - Feature walkthrough (10 min)
→ [Configuration](../../docs/project/guides/configuration.md) - Environment setup (3 min)

### 🔧 Technical Reference
→ [Component Architecture](src/components/) - Vue component library
→ [State Management](src/composables/) - Reactive composables and data flow
→ [Timeline Visualization](../../docs/project/guides/design-system/timeline-component-guide.md) - Interactive timeline features

### 🛠️ Development
→ [Component Testing](src/components/__tests__/) - Component test patterns
→ [E2E Testing](src/__tests__/) - End-to-end test suites
→ [Performance Optimization](../../docs/project/guides/performance-optimization.md) - Client-side optimization

## 🛠️ Common Commands

| Task | Command | Time | Notes |
|------|---------|------|-------|
| Development | `bun run dev` | 10s | Vite hot reload |
| Production Build | `bun run build` | 30s | Optimized bundle |
| Type Check | `vue-tsc -b` | 15s | TypeScript validation |
| Tests | `bun run test` | 20s | Vitest unit tests |
| Test Watch | `bun run test:watch` | - | Continuous testing |
| Coverage | `bun run test:coverage` | 25s | Test coverage report |
| Preview | `bun run preview` | 5s | Preview production build |

## 🔌 Quick Reference

### Most-Used Components
- **EventTimeline**: Real-time event stream with filtering
- **InteractiveSessionsTimeline**: Multi-session visualization
- **AgentDetailPane**: Agent information and communication
- **SessionsView**: Session analytics and comparison
- **ChatTranscript**: Agent conversation history
- **PerformanceMonitor**: System metrics and health

### Key Composables
- **useWebSocket**: WebSocket connection and real-time updates
- **useMultiSessionData**: Session data management and analytics
- **useTimelineData**: Timeline state and event processing  
- **useEventColors**: Event type styling and visualization
- **usePerformanceOptimizer**: Performance monitoring and optimization

### Feature Modules
- **Timeline Visualization**: Interactive event timeline with advanced filtering
- **Agent Communications**: Real-time inter-agent message monitoring
- **Session Analytics**: Multi-session comparison and performance metrics
- **Visual Components**: Charts, graphs, and data visualization
- **Responsive Design**: Mobile-first responsive interface

[Complete Component Reference →](src/components/)

## 🔧 Key Files

### Core Application
- **`src/App.vue`**: Main application component with routing
- **`src/main.ts`**: Application entry point and Vue initialization
- **`src/types.ts`**: TypeScript interfaces and type definitions
- **`vite.config.ts`**: Vite build configuration and plugins

### Components Library
- **`src/components/EventTimeline.vue`**: Real-time event timeline
- **`src/components/InteractiveSessionsTimeline.vue`**: Multi-session analytics
- **`src/components/AgentDetailPane.vue`**: Agent information panel
- **`src/components/SessionsView.vue`**: Session analytics dashboard
- **`src/components/ChatTranscript.vue`**: Agent conversation interface

### State Management
- **`src/composables/useWebSocket.ts`**: WebSocket connection management
- **`src/composables/useMultiSessionData.ts`**: Session data reactive state
- **`src/composables/useTimelineData.ts`**: Timeline data processing
- **`src/composables/useEventColors.ts`**: Visual styling utilities

### Styling & Design
- **`src/style.css`**: Global styles and design tokens
- **`src/styles/timeline.css`**: Timeline-specific styling
- **`tailwind.config.js`**: TailwindCSS configuration
- **`postcss.config.js`**: PostCSS processing configuration

### Testing
- **`src/__tests__/`**: Unit and integration tests
- **`src/components/__tests__/`**: Component-specific tests
- **`tests/`**: E2E and visual regression tests
- **`vitest.config.ts`**: Test configuration and environment

## 🚀 Performance Features

### Real-time Optimization
- **WebSocket Connection Pooling**: Efficient real-time data streaming
- **Virtual Scrolling**: Handle large datasets without performance impact
- **Reactive Updates**: Selective component re-rendering
- **Memory Management**: Automatic cleanup of old event data

### UI Performance
- **Component Lazy Loading**: On-demand component loading
- **Image Optimization**: Responsive image handling
- **CSS-in-JS**: Scoped styling with performance optimization
- **Tree Shaking**: Minimal bundle size with dead code elimination

### Development Experience
- **Hot Module Replacement**: Instant development feedback
- **TypeScript Integration**: Full type safety with IDE support
- **Component Documentation**: Comprehensive component docs
- **Testing Infrastructure**: Comprehensive test coverage

## 🖥️ UI Features

### Interactive Timeline
- **Real-time Updates**: Live event streaming with auto-scroll
- **Advanced Filtering**: Filter by session, agent, event type, time range
- **Search Functionality**: Full-text search across event data
- **Visual Indicators**: Color-coded events with status indicators
- **Zoom Controls**: Timeline zoom and navigation controls

### Agent Communications
- **Live Messaging**: Real-time inter-agent message display
- **Chat Transcripts**: Full conversation history with AI summaries
- **Agent Status**: Live agent status and completion tracking
- **Message Threading**: Organized conversation views

### Session Analytics
- **Multi-session Views**: Compare multiple sessions side-by-side
- **Performance Metrics**: Agent execution time and token usage
- **Visual Charts**: Performance trends and analytics
- **Export Capabilities**: Data export for external analysis

### Responsive Design
- **Mobile Optimization**: Full mobile and tablet support
- **Adaptive Layout**: Dynamic layout based on screen size
- **Touch Interactions**: Touch-optimized controls and gestures
- **Accessibility**: WCAG-compliant interface design

## 🧪 Testing Strategy

### Test Coverage
- **Unit Tests**: Component logic and utilities (>90% coverage)
- **Integration Tests**: Component interactions and data flow
- **E2E Tests**: Full user workflows with Playwright
- **Visual Regression**: UI consistency across browsers

### Test Types
```bash
# Unit tests with Vitest
bun run test

# Component tests with Vue Test Utils
bun run test src/components/

# E2E tests with Playwright  
bun run test:e2e

# Visual regression tests
bun run test:visual
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/dashboard-enhancement`
3. Follow Vue 3 Composition API patterns
4. Add comprehensive tests for new features
5. Submit pull request with screenshots

**Development Standards**:
- Vue 3 Composition API with `<script setup>`
- TypeScript strict mode enabled
- TailwindCSS utility-first styling
- Comprehensive test coverage
- Responsive design principles
- Accessibility compliance

## 📄 License

MIT License - See [LICENSE](../../LICENSE) file for details

---

**📚 For comprehensive documentation, visit our [guides directory](../../docs/project/guides/).**
