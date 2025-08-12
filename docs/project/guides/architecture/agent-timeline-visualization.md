# Agent Timeline Visualization - Technical Architecture

## Executive Summary

The Agent Timeline Visualization component provides a real-time, interactive SVG-based timeline showing the orchestrator's workflow, agent spawning, parallel execution paths, and inter-agent communication. The design optimizes for performance with hundreds of agents while maintaining smooth real-time updates through WebSocket streaming.

## Component Architecture

### 1. Component Hierarchy

```
AgentTimelineView.vue (Container)
├── TimelineControls.vue (Session selector, zoom controls, filters)
├── TimelineSVGRenderer.vue (Main visualization)
│   ├── OrchestratorLine.vue (Horizontal main timeline)
│   ├── UserPromptNodes.vue (User interaction points)
│   ├── BatchSpawnPoints.vue (Agent batch creation markers)
│   ├── AgentExecutionPaths.vue (Curved agent paths)
│   │   └── AgentPath.vue (Individual agent curve)
│   ├── MessageDots.vue (Communication events)
│   └── TimeAxis.vue (Time scale and labels)
├── TimelineTooltip.vue (Hover information)
└── TimelineLegend.vue (Visual key)
```

### 2. Data Model

```typescript
// Core timeline data structures
interface TimelineData {
  orchestratorEvents: OrchestratorEvent[];
  userPrompts: UserPrompt[];
  agentBatches: AgentBatch[];
  agentPaths: AgentPath[];
  messages: TimelineMessage[];
  timeRange: TimeRange;
}

interface OrchestratorEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'spawn' | 'wait' | 'complete';
  sessionId: string;
}

interface UserPrompt {
  id: string;
  timestamp: number;
  content: string;
  sessionId: string;
  eventId: number; // Link to events table
}

interface AgentBatch {
  id: string;
  spawnTimestamp: number;
  agents: AgentSpawn[];
  batchNumber: number;
  orchestratorEventId: string;
}

interface AgentSpawn {
  agentId: string;
  name: string;
  type: string;
  color: string; // Predefined color based on agent type
}

interface AgentPath {
  agentId: string;
  name: string;
  type: string;
  startTime: number;  // created_at from subagent_registry
  endTime: number;    // completed_at from subagent_registry
  status: 'pending' | 'in_progress' | 'completed';
  curveData: CurvePoint[]; // Calculated SVG path points
  laneIndex: number;  // Vertical position index
  batchId: string;
  messages: TimelineMessage[];
}

interface TimelineMessage {
  id: string;
  timestamp: number;
  sender: string;
  position: Point2D; // Calculated position on agent path
  content: string;
}

interface CurvePoint {
  x: number;
  y: number;
  controlX?: number;
  controlY?: number;
}

interface TimeRange {
  start: number;
  end: number;
  pixelsPerMs: number; // Zoom level
}
```

### 3. Data Transformation Pipeline

```typescript
// Transform server data to timeline coordinates
class TimelineDataTransformer {
  private xScale: d3.ScaleLinear;
  private yScale: d3.ScaleOrdinal;
  private orchestratorY: number = 200; // Fixed Y position
  
  constructor(private config: TimelineConfig) {
    this.initializeScales();
  }
  
  transformToTimelineData(
    events: HookEvent[],
    subagents: SubagentRegistry[],
    messages: SubagentMessage[]
  ): TimelineData {
    // 1. Extract user prompts from events
    const userPrompts = this.extractUserPrompts(events);
    
    // 2. Group agents into batches by spawn time proximity
    const agentBatches = this.groupAgentsIntoBatches(subagents);
    
    // 3. Calculate agent execution paths
    const agentPaths = this.calculateAgentPaths(subagents, agentBatches);
    
    // 4. Map messages to timeline positions
    const timelineMessages = this.mapMessagesToTimeline(messages, agentPaths);
    
    // 5. Generate orchestrator events
    const orchestratorEvents = this.generateOrchestratorEvents(
      userPrompts, 
      agentBatches
    );
    
    return {
      orchestratorEvents,
      userPrompts,
      agentBatches,
      agentPaths,
      messages: timelineMessages,
      timeRange: this.calculateTimeRange(events, subagents)
    };
  }
  
  private calculateAgentPaths(
    agents: SubagentRegistry[], 
    batches: AgentBatch[]
  ): AgentPath[] {
    return agents.map((agent, index) => {
      const batch = batches.find(b => 
        b.agents.some(a => a.agentId === agent.id)
      );
      
      // Calculate vertical lane position
      const laneIndex = this.calculateLaneIndex(agent, batch);
      const maxY = this.orchestratorY - 120; // Max height above orchestrator
      const yPosition = this.orchestratorY - (laneIndex * 30) - 30;
      
      // Generate bezier curve control points
      const startX = this.xScale(agent.created_at);
      const endX = this.xScale(agent.completed_at || Date.now());
      
      const curveData = this.generateBezierCurve(
        startX, this.orchestratorY,  // Start at orchestrator
        endX, this.orchestratorY,    // End at orchestrator
        yPosition                     // Peak height
      );
      
      return {
        agentId: agent.id,
        name: agent.name,
        type: agent.subagent_type,
        startTime: agent.created_at,
        endTime: agent.completed_at || Date.now(),
        status: agent.status,
        curveData,
        laneIndex,
        batchId: batch?.id || '',
        messages: []
      };
    });
  }
  
  private generateBezierCurve(
    startX: number, 
    startY: number,
    endX: number, 
    endY: number,
    peakY: number
  ): CurvePoint[] {
    // Quadratic bezier curve with smooth transitions
    const controlPoint1X = startX + (endX - startX) * 0.2;
    const controlPoint2X = endX - (endX - startX) * 0.2;
    
    return [
      { x: startX, y: startY },
      { x: controlPoint1X, y: peakY, controlX: startX + 20, controlY: startY - 20 },
      { x: (startX + endX) / 2, y: peakY },
      { x: controlPoint2X, y: peakY, controlX: endX - 20, controlY: endY - 20 },
      { x: endX, y: endY }
    ];
  }
}
```

### 4. SVG Rendering Strategy

```typescript
// Optimized SVG rendering with D3.js integration
class TimelineSVGRenderer {
  private svg: d3.Selection;
  private viewportGroup: d3.Selection;
  private zoom: d3.ZoomBehavior;
  
  // Layer groups for organized rendering
  private layers = {
    grid: null,
    orchestrator: null,
    agents: null,
    messages: null,
    prompts: null,
    axis: null
  };
  
  mount(container: HTMLElement) {
    // Create SVG with viewport transformation group
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', 400);
    
    // Viewport group for pan/zoom transformations
    this.viewportGroup = this.svg.append('g')
      .attr('class', 'viewport');
    
    // Initialize layers in rendering order
    this.layers.grid = this.viewportGroup.append('g').attr('class', 'grid-layer');
    this.layers.orchestrator = this.viewportGroup.append('g').attr('class', 'orchestrator-layer');
    this.layers.agents = this.viewportGroup.append('g').attr('class', 'agents-layer');
    this.layers.messages = this.viewportGroup.append('g').attr('class', 'messages-layer');
    this.layers.prompts = this.viewportGroup.append('g').attr('class', 'prompts-layer');
    this.layers.axis = this.svg.append('g').attr('class', 'axis-layer');
    
    // Setup zoom behavior
    this.setupZoom();
  }
  
  renderTimeline(data: TimelineData) {
    // Use data joins for efficient updates
    this.renderOrchestratorLine(data.orchestratorEvents);
    this.renderAgentPaths(data.agentPaths);
    this.renderMessages(data.messages);
    this.renderUserPrompts(data.userPrompts);
    this.renderBatchSpawnPoints(data.agentBatches);
    this.updateTimeAxis(data.timeRange);
  }
  
  private renderAgentPaths(paths: AgentPath[]) {
    // Path merging for performance
    const pathGenerator = d3.line<CurvePoint>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveBasis);
    
    // Data join with key function
    const pathSelection = this.layers.agents
      .selectAll('.agent-path')
      .data(paths, d => d.agentId);
    
    // Enter + Update
    pathSelection.enter()
      .append('path')
      .attr('class', d => `agent-path agent-${d.type}`)
      .merge(pathSelection)
      .attr('d', d => pathGenerator(d.curveData))
      .attr('stroke', d => this.getAgentColor(d.type))
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('opacity', d => d.status === 'completed' ? 1 : 0.6);
    
    // Exit
    pathSelection.exit().remove();
  }
  
  private setupZoom() {
    this.zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        // Transform viewport group only
        this.viewportGroup.attr('transform', event.transform);
        // Update axis separately to maintain position
        this.updateAxisForZoom(event.transform);
      });
    
    this.svg.call(this.zoom);
  }
}
```

### 5. Real-time Update Strategy

```typescript
// WebSocket integration for real-time updates
class TimelineWebSocketHandler {
  private updateQueue: TimelineUpdate[] = [];
  private rafId: number | null = null;
  private lastUpdateTime: number = 0;
  private updateThrottleMs: number = 100; // 10 FPS for updates
  
  constructor(
    private ws: WebSocket,
    private renderer: TimelineSVGRenderer,
    private transformer: TimelineDataTransformer
  ) {
    this.setupWebSocketHandlers();
  }
  
  private setupWebSocketHandlers() {
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case 'subagent_registered':
          this.queueUpdate({ type: 'agent_spawn', data: message.data });
          break;
        case 'agent_status_update':
          this.queueUpdate({ type: 'agent_status', data: message.data });
          break;
        case 'subagent_message':
          this.queueUpdate({ type: 'message', data: message.data });
          break;
      }
    });
  }
  
  private queueUpdate(update: TimelineUpdate) {
    this.updateQueue.push(update);
    
    // Throttled batch processing
    const now = Date.now();
    if (now - this.lastUpdateTime > this.updateThrottleMs) {
      this.processBatchedUpdates();
      this.lastUpdateTime = now;
    } else if (!this.rafId) {
      // Schedule next frame update
      this.rafId = requestAnimationFrame(() => {
        this.processBatchedUpdates();
        this.rafId = null;
      });
    }
  }
  
  private processBatchedUpdates() {
    if (this.updateQueue.length === 0) return;
    
    // Process all queued updates in one render pass
    const updates = [...this.updateQueue];
    this.updateQueue = [];
    
    // Merge updates by type
    const mergedData = this.mergeUpdates(updates);
    
    // Single render call
    this.renderer.updatePartial(mergedData);
  }
}
```

### 6. Performance Optimization

```typescript
// Performance optimizations for large-scale timelines
class TimelinePerformanceOptimizer {
  // Virtualization for agent lanes
  private visibleRange: { start: number; end: number };
  private virtualizedAgents: Set<string> = new Set();
  
  // Level-of-detail rendering
  private zoomLevel: number = 1;
  private lodThresholds = {
    messages: 1.5,  // Hide messages below this zoom
    labels: 0.8,    // Hide labels below this zoom
    details: 2.0    // Show full details above this zoom
  };
  
  // Canvas overlay for dense elements
  private canvasOverlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  optimizeRenderData(data: TimelineData, viewport: ViewportState): OptimizedData {
    // 1. Viewport culling
    const visibleAgents = this.cullAgentsOutsideViewport(data.agentPaths, viewport);
    
    // 2. Level-of-detail filtering
    const lodData = this.applyLevelOfDetail(data, viewport.zoom);
    
    // 3. Path simplification for distant view
    if (viewport.zoom < 1) {
      lodData.agentPaths = this.simplifyPaths(lodData.agentPaths);
    }
    
    // 4. Message aggregation
    if (lodData.messages.length > 1000) {
      lodData.messages = this.aggregateMessages(lodData.messages, viewport);
    }
    
    return lodData;
  }
  
  renderDenseElementsToCanvas(messages: TimelineMessage[]) {
    // Render thousands of message dots to canvas
    this.ctx.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);
    
    // Batch render by type for fewer state changes
    this.ctx.fillStyle = 'white';
    this.ctx.globalAlpha = 0.9;
    
    messages.forEach(msg => {
      this.ctx.beginPath();
      this.ctx.arc(msg.position.x, msg.position.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
  
  // Progressive rendering for initial load
  async progressiveRender(data: TimelineData, renderer: TimelineSVGRenderer) {
    // Render in priority order
    renderer.renderOrchestratorLine(data.orchestratorEvents);
    await this.nextFrame();
    
    renderer.renderUserPrompts(data.userPrompts);
    await this.nextFrame();
    
    // Render agents in batches
    const batchSize = 20;
    for (let i = 0; i < data.agentPaths.length; i += batchSize) {
      const batch = data.agentPaths.slice(i, i + batchSize);
      renderer.renderAgentPaths(batch);
      await this.nextFrame();
    }
    
    // Finally render messages
    this.renderDenseElementsToCanvas(data.messages);
  }
  
  private nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }
}
```

### 7. Interactive Features

```typescript
// Interactive behavior handlers
class TimelineInteractionManager {
  private hoveredElement: TimelineElement | null = null;
  private selectedAgent: string | null = null;
  private tooltip: TimelineTooltip;
  
  setupInteractions(svg: d3.Selection, data: TimelineData) {
    // Agent path hover
    svg.selectAll('.agent-path')
      .on('mouseenter', (event, d) => {
        this.handleAgentHover(d);
        this.showTooltip(event, d);
      })
      .on('mouseleave', () => {
        this.clearHover();
        this.hideTooltip();
      })
      .on('click', (event, d) => {
        this.selectAgent(d.agentId);
        event.stopPropagation();
      });
    
    // Message dot interactions
    svg.selectAll('.message-dot')
      .on('click', (event, d) => {
        this.showMessageModal(d);
        event.stopPropagation();
      });
    
    // Pan/zoom with boundaries
    this.setupConstrainedZoom(svg);
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }
  
  private handleAgentHover(agent: AgentPath) {
    // Highlight connected elements
    d3.select(`#agent-${agent.agentId}`)
      .classed('highlighted', true)
      .raise(); // Bring to front
    
    // Dim other agents
    d3.selectAll('.agent-path')
      .filter(d => d.agentId !== agent.agentId)
      .transition()
      .duration(200)
      .attr('opacity', 0.3);
    
    // Highlight related messages
    d3.selectAll('.message-dot')
      .filter(d => d.sender === agent.name)
      .classed('highlighted', true);
  }
  
  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'r':
          this.resetZoom();
          break;
        case '+':
          this.zoomIn();
          break;
        case '-':
          this.zoomOut();
          break;
        case 'ArrowLeft':
          this.panLeft();
          break;
        case 'ArrowRight':
          this.panRight();
          break;
      }
    });
  }
}
```

## Implementation Plan

### Phase 1: Core Components (Week 1)
1. Create base component structure
2. Implement data transformation pipeline
3. Basic SVG rendering with D3.js
4. Connect to existing WebSocket

### Phase 2: Interactivity (Week 2)
1. Pan/zoom functionality
2. Hover effects and tooltips
3. Click handlers for details
4. Keyboard navigation

### Phase 3: Performance (Week 3)
1. Implement virtualization
2. Add canvas overlay for messages
3. Progressive rendering
4. Level-of-detail system

### Phase 4: Polish (Week 4)
1. Animations and transitions
2. Responsive design
3. Error handling
4. Performance monitoring

## Technology Stack

- **Vue 3**: Component framework
- **TypeScript**: Type safety
- **D3.js v7**: SVG manipulation and scales
- **Canvas API**: Dense element rendering
- **Vite**: Build tooling
- **Pinia**: State management (if needed)

## Performance Targets

- Initial render: < 500ms for 100 agents
- Real-time updates: 60 FPS with 200 agents
- Memory usage: < 200MB for 1000 agents
- Zoom/pan: Smooth at all scales

## Testing Strategy

1. Unit tests for data transformations
2. Component tests for Vue components
3. Performance benchmarks
4. Visual regression tests
5. Load testing with synthetic data

## Dependencies

```json
{
  "dependencies": {
    "d3": "^7.8.5",
    "d3-scale": "^4.0.2",
    "d3-zoom": "^3.0.0",
    "d3-selection": "^3.0.0",
    "d3-shape": "^3.2.0"
  }
}
```