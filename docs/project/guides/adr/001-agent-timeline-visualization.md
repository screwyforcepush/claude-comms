# ADR-001: Agent Timeline Visualization Architecture

## Status
Proposed

## Context
The multi-agent observability system requires a sophisticated timeline visualization to display orchestrator workflows, agent spawning, parallel execution paths, and inter-agent communication. The visualization must handle hundreds of agents in real-time while maintaining smooth performance.

## Decision

### Rendering Architecture: Hybrid SVG + Canvas
We will use a hybrid approach combining SVG for interactive elements and Canvas for dense, frequently-updating elements:

- **SVG Layer**: Agent paths, orchestrator line, user prompts, spawn points, interactive elements
- **Canvas Overlay**: Message dots (potentially thousands), animation effects, dense visualizations
- **Rationale**: SVG provides superior interactivity and accessibility, while Canvas handles high-volume rendering without DOM overhead

### Data Architecture: Streaming with Batched Updates
- Reuse existing WebSocket connection from `useWebSocket` composable
- Implement update queue with requestAnimationFrame batching
- Throttle renders to 10-16ms intervals (60-100 FPS)
- **Rationale**: Prevents render storms while maintaining smooth real-time updates

### Component Architecture: Composition Pattern
```
AgentTimelineView.vue
├── TimelineSVGRenderer.vue (D3.js integration)
├── TimelineCanvasOverlay.vue (message dots)
└── TimelineInteractionLayer.vue (event handlers)
```
- **Rationale**: Separation of concerns enables independent optimization of each layer

### Performance Strategy
1. **Virtualization**: Only render agents within viewport + overscan
2. **Level-of-Detail**: Reduce detail at lower zoom levels
3. **Path Merging**: Single `<path>` per agent instead of multiple elements
4. **Progressive Rendering**: Prioritized loading with requestAnimationFrame
5. **Memory Management**: Ring buffers for message history

## Consequences

### Positive
- Smooth performance with hundreds of agents
- Rich interactivity without sacrificing speed
- Reuses existing infrastructure (WebSocket, data models)
- Progressive enhancement for older browsers
- Accessible with keyboard navigation

### Negative
- Increased complexity with dual rendering systems
- Canvas requires manual hit detection for interactions
- Learning curve for D3.js integration
- Additional testing complexity

### Neutral
- D3.js dependency adds ~70KB to bundle
- Requires careful memory management for long sessions
- Browser compatibility limited to modern browsers with Canvas support

## Implementation Notes

### Integration with Existing System
- Leverage `AgentStatus` and `SubagentMessage` types from `types.ts`
- Extend color system from DavidUX's design tokens
- Reuse WebSocket patterns from AlexMorgan's analysis
- Apply CSS optimizations from design specifications

### Technology Stack
- Vue 3 + TypeScript (existing)
- D3.js v7 for SVG manipulation
- Canvas API for dense rendering
- Existing Tailwind CSS framework

### Performance Targets
- Initial render: < 500ms for 100 agents
- Frame rate: 60 FPS with 200 active agents
- Memory: < 200MB for 1000-agent session
- Zoom/pan: < 16ms response time

## References
- Design Specification: `/docs/project/guides/design-system/agent-timeline-visualization.md`
- Implementation Guide: `/docs/project/guides/design-system/timeline-implementation-guide.md`
- Technical Architecture: `/docs/project/guides/architecture/agent-timeline-visualization.md`