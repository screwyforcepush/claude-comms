# Timeline Visualization Design Specifications

## Overview

Comprehensive design system specifications for the polished timeline visualization component, addressing bezier curve animations, smart Y-positioning, branch labeling, visual hierarchy, and performance optimizations.

## 1. Agent Path Bezier Curves

### Design Philosophy
Agent paths should emerge gracefully from the orchestrator line, curve elegantly through execution, and return with visual termination clarity. Curves use arc-length parameterization for constant-speed animation and velocity-preserving easing.

### Curve Generation Algorithm

```typescript
interface CurveSpec {
  startPoint: Point2D;
  peakPoint: Point2D;
  endPoint: Point2D;
  arcLength: number;
  controlPoints: [Point2D, Point2D];
  tension: number; // 0.3-0.7 range
}

function generateAgentCurve(
  agent: AgentData,
  laneY: number,
  spawnX: number,
  endX: number
): CurveSpec {
  const startPoint = { x: spawnX, y: orchestratorY };
  const endPoint = { x: endX, y: orchestratorY };
  
  // Peak calculation for visual appeal
  const midX = spawnX + (endX - spawnX) * 0.5;
  const peakOffset = calculatePeakOffset(agent.type, agent.laneIndex);
  const peakPoint = { x: midX, y: laneY + peakOffset };
  
  // Control points for smooth curves
  const tension = 0.4; // Modern standard
  const cp1 = {
    x: spawnX + (midX - spawnX) * tension,
    y: startPoint.y + (peakPoint.y - startPoint.y) * 0.3
  };
  const cp2 = {
    x: midX + (endX - midX) * (1 - tension),
    y: peakPoint.y + (endPoint.y - peakPoint.y) * 0.7
  };
  
  return {
    startPoint,
    peakPoint,
    endPoint,
    controlPoints: [cp1, cp2],
    tension,
    arcLength: calculateArcLength([startPoint, cp1, cp2, endPoint])
  };
}
```

### Visual Termination System

**Spawn Animation:**
- Bezier path grows from orchestrator with eased expansion
- 400ms duration with `cubic-bezier(0.4, 0, 0.2, 1)` easing
- Synchronized label fade-in at 200ms offset

**Completion Animation:**
- Gentle pulse along entire curve (2 waves)
- Color transition from active to completed state
- Final glow effect at endpoint lasting 1.5s

### Path Styling Specifications

```scss
.agent-curve {
  stroke-width: 3px;
  fill: none;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  
  &.spawning {
    stroke-dasharray: 0, 1000;
    animation: curve-grow 400ms ease-out forwards;
  }
  
  &.in-progress {
    stroke-dasharray: 8, 4;
    animation: progress-flow 2s linear infinite;
  }
  
  &.completed {
    stroke-dasharray: none;
    filter: drop-shadow(0 0 8px currentColor);
  }
  
  &.completing {
    animation: completion-pulse 1.5s ease-out;
  }
}

@keyframes curve-grow {
  from { stroke-dasharray: 0, 1000; }
  to { stroke-dasharray: 1000, 0; }
}

@keyframes progress-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -20; }
}

@keyframes completion-pulse {
  0%, 100% { opacity: 1; filter: none; }
  50% { opacity: 1; filter: drop-shadow(0 0 16px currentColor) brightness(1.3); }
}
```

## 2. Smart Y-Positioning Algorithm

### Lane Assignment Strategy
Uses interval scheduling with conflict-aware allocation to minimize vertical space while preventing overlaps.

```typescript
interface AgentInterval {
  agentId: string;
  startTime: number;
  endTime: number;
  preferredLane?: number;
  priority: number; // 0-10 scale
}

class SmartLaneAllocator {
  private lanes: Map<number, AgentInterval[]> = new Map();
  private readonly LANE_HEIGHT = 60;
  private readonly COLLISION_BUFFER = 8;
  private readonly MAX_LANES = 20;
  
  allocateLanes(agents: AgentInterval[]): Map<string, number> {
    // Sort by start time, then by priority
    const sortedAgents = agents.sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return b.priority - a.priority;
    });
    
    const assignments = new Map<string, number>();
    
    for (const agent of sortedAgents) {
      const lane = this.findOptimalLane(agent);
      assignments.set(agent.agentId, lane);
      this.assignToLane(lane, agent);
    }
    
    return assignments;
  }
  
  private findOptimalLane(agent: AgentInterval): number {
    // Try preferred lane first
    if (agent.preferredLane !== undefined && 
        this.isLaneAvailable(agent.preferredLane, agent)) {
      return agent.preferredLane;
    }
    
    // Find lowest available lane
    for (let lane = 0; lane < this.MAX_LANES; lane++) {
      if (this.isLaneAvailable(lane, agent)) {
        return lane;
      }
    }
    
    // Force-create new lane if needed
    return this.MAX_LANES;
  }
  
  private isLaneAvailable(lane: number, agent: AgentInterval): boolean {
    const laneAgents = this.lanes.get(lane) || [];
    
    return !laneAgents.some(existing => 
      this.intervalsOverlap(agent, existing)
    );
  }
  
  private intervalsOverlap(a: AgentInterval, b: AgentInterval): boolean {
    const bufferMs = 500; // 0.5s buffer between agents
    return !(a.endTime + bufferMs < b.startTime || 
             b.endTime + bufferMs < a.startTime);
  }
}
```

### Y-Position Calculation

```typescript
function calculateAgentY(laneIndex: number, batchInfo: BatchInfo): number {
  const BASE_Y = 140; // Below orchestrator
  const LANE_HEIGHT = 60;
  const BATCH_SPACING = 20;
  
  // Stagger batches slightly for visual grouping
  const batchOffset = (batchInfo.batchIndex % 3) * (BATCH_SPACING / 3);
  
  return BASE_Y + (laneIndex * LANE_HEIGHT) + batchOffset;
}
```

### Lane Reuse Strategy

```typescript
interface LaneReuseConfig {
  timeGapThreshold: number; // 2000ms minimum gap
  priorityBoost: number; // 1.2x for reusing lanes
  maxReusesPerLane: number; // 8 agents max per lane
  decayFactor: number; // 0.9 preference decay over time
}

const LANE_REUSE_CONFIG: LaneReuseConfig = {
  timeGapThreshold: 2000,
  priorityBoost: 1.2,
  maxReusesPerLane: 8,
  decayFactor: 0.9
};
```

## 3. Branch Labeling System

### Smart Label Placement
Labels follow curves intelligently with collision avoidance and optimal readability positioning.

```typescript
interface LabelPlacement {
  position: Point2D;
  rotation: number; // -30° to +30° max
  offset: Point2D; // perpendicular offset from curve
  usesLeaderLine: boolean;
  collisionPriority: number;
}

class CurveLabelPlacer {
  private readonly MAX_ROTATION = 30; // degrees
  private readonly PREFERRED_OFFSET = 12; // pixels from curve
  private readonly MIN_CURVE_SEGMENT = 40; // min pixels for label
  
  placeLabelOnCurve(
    curve: CurveSpec,
    labelText: string,
    fontSize: number
  ): LabelPlacement {
    const textWidth = this.measureText(labelText, fontSize);
    const idealArcPosition = 0.35; // 35% along curve (visually balanced)
    
    // Find suitable straight-ish segment
    const placement = this.findOptimalSegment(curve, textWidth);
    
    if (placement.curvature < 0.1) {
      // Low curvature - place directly on path
      return this.createDirectPlacement(curve, placement, labelText);
    } else {
      // High curvature - use leader line
      return this.createLeaderLinePlacement(curve, placement, labelText);
    }
  }
  
  private createDirectPlacement(
    curve: CurveSpec,
    segment: CurveSegment,
    text: string
  ): LabelPlacement {
    const point = this.evaluateBezier(curve, segment.t);
    const tangent = this.evaluateBezierTangent(curve, segment.t);
    const normal = this.perpendicularVector(tangent);
    
    // Limit rotation for readability
    const rotation = Math.max(-this.MAX_ROTATION, 
      Math.min(this.MAX_ROTATION, Math.atan2(tangent.y, tangent.x) * 180 / Math.PI));
    
    return {
      position: point,
      rotation,
      offset: this.scaleVector(normal, this.PREFERRED_OFFSET),
      usesLeaderLine: false,
      collisionPriority: 1.0
    };
  }
}
```

### Label Background Pills

```scss
.agent-label {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--agent-color);
  white-space: nowrap;
  pointer-events: none;
  
  // Subtle glow matching agent color
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    0 0 0 1px var(--agent-color-alpha-20);
  
  transform-origin: center;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  
  &.with-leader-line::before {
    content: '';
    position: absolute;
    width: 2px;
    height: var(--leader-length);
    background: var(--agent-color-alpha-60);
    left: 50%;
    top: 100%;
    transform: translateX(-50%) rotate(var(--leader-angle));
    transform-origin: top;
  }
}

.agent-type-badge {
  display: inline-block;
  background: var(--agent-color-alpha-20);
  border: 1px solid var(--agent-color-alpha-40);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 6px;
  color: var(--agent-color);
}
```

### Collision Avoidance Matrix

```typescript
interface CollisionDetector {
  labelBounds: DOMRect[];
  spatialGrid: Map<string, LabelPlacement[]>;
  
  detectCollisions(newLabel: LabelPlacement): LabelPlacement[] {
    const gridKey = this.getGridKey(newLabel.position);
    const nearby = this.spatialGrid.get(gridKey) || [];
    
    return nearby.filter(existing => 
      this.boundsOverlap(newLabel, existing)
    );
  }
  
  resolveCollision(
    primary: LabelPlacement, 
    conflicts: LabelPlacement[]
  ): LabelPlacement {
    // Strategy 1: Increase offset distance
    let resolved = this.tryOffsetIncrease(primary, conflicts);
    if (resolved) return resolved;
    
    // Strategy 2: Switch to leader line
    resolved = this.tryLeaderLine(primary, conflicts);
    if (resolved) return resolved;
    
    // Strategy 3: Reduce font size and retry
    return this.tryFontReduction(primary);
  }
}
```

## 4. Visual Hierarchy Improvements

### Information Architecture Principles

**Primary Elements (Orchestrator, Active Agents):**
- Stroke width: 3px
- Color saturation: 100%
- Glow intensity: High (drop-shadow 0 0 12px)
- Z-index: 100-110

**Secondary Elements (Completed Agents, Messages):**
- Stroke width: 2px  
- Color saturation: 80%
- Glow intensity: Medium (drop-shadow 0 0 6px)
- Z-index: 80-90

**Tertiary Elements (Batch Backgrounds, Grid):**
- Stroke width: 1px
- Color saturation: 40%
- Opacity: 0.1-0.3
- Z-index: 10-20

### Agent Status Visual Encoding

```scss
.agent-curve {
  // Base state
  stroke-width: 2px;
  opacity: 0.8;
  
  &.status-pending {
    stroke: var(--pending-color);
    stroke-dasharray: 4, 4;
    animation: pending-pulse 2s ease-in-out infinite;
  }
  
  &.status-in-progress {
    stroke: var(--active-color);
    stroke-width: 3px;
    opacity: 1;
    stroke-dasharray: 8, 2;
    animation: progress-flow 1.5s linear infinite;
    filter: drop-shadow(0 0 8px var(--active-color-alpha-40));
  }
  
  &.status-completed {
    stroke: var(--completed-color);
    stroke-width: 2px;
    opacity: 0.9;
    filter: drop-shadow(0 0 4px var(--completed-color-alpha-30));
  }
  
  &.status-error {
    stroke: var(--error-color);
    stroke-width: 3px;
    animation: error-pulse 0.8s ease-in-out infinite alternate;
    filter: drop-shadow(0 0 12px var(--error-color-alpha-60));
  }
}
```

### Batch Spawn Point Enhancement

```scss
.batch-spawn-point {
  r: 8px;
  fill: var(--orchestrator-color);
  stroke: rgba(255, 255, 255, 0.8);
  stroke-width: 2px;
  filter: drop-shadow(0 0 16px var(--orchestrator-color-alpha-70));
  cursor: pointer;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    r: 12px;
    stroke-width: 3px;
    filter: drop-shadow(0 0 24px var(--orchestrator-color));
  }
  
  &.active {
    animation: spawn-point-pulse 1s ease-in-out infinite alternate;
  }
}

.batch-number {
  fill: var(--orchestrator-color);
  font-size: 12px;
  font-weight: 700;
  text-anchor: middle;
  font-family: 'SF Mono', 'Monaco', monospace;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
}
```

### Message Dot Visual System

```scss
.message-dot {
  r: 4px;
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  
  &.type-broadcast {
    fill: var(--broadcast-color);
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1px;
    animation: broadcast-pulse 2s ease-in-out infinite;
  }
  
  &.type-direct {
    fill: var(--direct-color);
    stroke: rgba(255, 255, 255, 0.4);
    stroke-width: 1px;
  }
  
  &.type-discovery {
    fill: var(--discovery-color);
    stroke: var(--discovery-color-alpha-80);
    stroke-width: 2px;
    animation: discovery-glow 1.5s ease-in-out infinite alternate;
  }
  
  &:hover {
    r: 6px;
    stroke-width: 2px;
    filter: brightness(1.3);
  }
  
  &.selected {
    r: 8px;
    stroke: #ffffff;
    stroke-width: 3px;
    filter: drop-shadow(0 0 12px currentColor);
    animation: selected-pulse 1s ease-in-out infinite alternate;
  }
}
```

## 5. Polish Elements & Animations

### Progressive Gradient System

Agent paths feature dynamic gradients that show progress and temporal information:

```scss
.agent-curve.with-progress-gradient {
  stroke: url(#agent-gradient);
}

// Dynamic SVG gradient generation
const generateProgressGradient = (progress: number, agentColor: string) => `
<defs>
  <linearGradient id="agent-gradient" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="${agentColor}" stop-opacity="0.3"/>
    <stop offset="${progress * 100}%" stop-color="${agentColor}" stop-opacity="1"/>
    <stop offset="${progress * 100 + 5}%" stop-color="${agentColor}" stop-opacity="0.8"/>
    <stop offset="100%" stop-color="${agentColor}" stop-opacity="0.1"/>
  </linearGradient>
</defs>
`;
```

### Subtle Animations for Active Agents

```scss
@keyframes active-agent-flow {
  0% {
    stroke-dasharray: 0, 20, 0, 100;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 0, 10, 10, 100;
    stroke-dashoffset: -10;
  }
  100% {
    stroke-dasharray: 0, 0, 20, 100;
    stroke-dashoffset: -20;
  }
}

.agent-curve.in-progress {
  animation: active-agent-flow 2s ease-in-out infinite;
}
```

### Better Batch Grouping

```scss
.batch-background {
  fill: rgba(255, 255, 255, 0.02);
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 1px;
  rx: 12px;
  ry: 12px;
  opacity: 0;
  transition: opacity 300ms ease-out;
  
  &.visible {
    opacity: 1;
  }
}

.batch-container:hover .batch-background {
  fill: rgba(255, 255, 255, 0.05);
  stroke: rgba(255, 255, 255, 0.1);
}
```

### Batch Number Display

```scss
.batch-number-display {
  position: absolute;
  background: linear-gradient(135deg, 
    var(--orchestrator-color-alpha-90) 0%,
    var(--orchestrator-color-alpha-70) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', monospace;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  
  transform: translateX(-50%) translateY(-50%);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateX(-50%) translateY(-50%) scale(1.1);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.4),
      0 0 12px var(--orchestrator-color-alpha-60),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}
```

## 6. Design Token System

### Color Palette Specification

```typescript
export const TIMELINE_DESIGN_TOKENS = {
  colors: {
    // Orchestrator
    orchestrator: '#00d4ff',
    orchestratorGlow: 'rgba(0, 212, 255, 0.6)',
    
    // Agent Types
    agentTypes: {
      architect: '#ec4899',
      engineer: '#22c55e', 
      tester: '#eab308',
      reviewer: '#a855f7',
      verifier: '#10b981',
      planner: '#ef4444',
      analyst: '#14b8a6',
      researcher: '#6366f1',
      designer: '#f97316',
      'cloud-cicd': '#06b6d4',
      'general-purpose': '#3b82f6'
    },
    
    // Status Colors
    status: {
      pending: '#fbbf24',
      inProgress: '#3b82f6', 
      completed: '#10b981',
      error: '#ef4444'
    },
    
    // Message Types
    messages: {
      broadcast: '#f59e0b',
      direct: '#8b5cf6',
      discovery: '#06b6d4'
    },
    
    // Surface Colors
    surface: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)',
      grid: 'rgba(255, 255, 255, 0.05)',
      batchBackground: 'rgba(255, 255, 255, 0.02)',
      labelBackground: 'rgba(0, 0, 0, 0.9)'
    }
  },
  
  spacing: {
    orchestratorY: 80,
    laneHeight: 60,
    batchSeparation: 20,
    labelOffset: 12,
    messageRadius: 4,
    spawnPointRadius: 8
  },
  
  animation: {
    duration: {
      fast: '200ms',
      normal: '300ms', 
      slow: '600ms',
      spawn: '400ms',
      completion: '1500ms'
    },
    easing: {
      standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
      accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  },
  
  typography: {
    agents: {
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'system-ui'
    },
    batches: {
      fontSize: 11,
      fontWeight: 700,
      fontFamily: 'SF Mono, Monaco, monospace'
    },
    time: {
      fontSize: 10,
      fontWeight: 500,
      fontFamily: 'SF Mono, Monaco, monospace'
    }
  },
  
  effects: {
    shadows: {
      small: '0 2px 8px rgba(0, 0, 0, 0.3)',
      medium: '0 4px 16px rgba(0, 0, 0, 0.4)', 
      large: '0 8px 32px rgba(0, 0, 0, 0.5)'
    },
    glows: {
      subtle: '0 0 6px currentColor',
      medium: '0 0 12px currentColor',
      strong: '0 0 24px currentColor'
    },
    blurs: {
      backdrop: 'blur(8px)',
      strong: 'blur(16px)'
    }
  }
} as const;
```

### Accessibility Specifications

```scss
// High contrast mode support
@media (prefers-contrast: high) {
  .agent-curve {
    stroke-width: 4px;
    filter: none;
  }
  
  .message-dot {
    stroke-width: 3px;
    r: 6px;
  }
  
  .agent-label {
    border-width: 2px;
    font-weight: 700;
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .agent-curve,
  .message-dot,
  .batch-spawn-point {
    animation: none;
    transition: none;
  }
  
  .agent-curve.in-progress {
    stroke-dasharray: 8, 4; // Static pattern
  }
}

// Focus management for accessibility
.timeline-interactive:focus-visible {
  outline: 2px solid var(--orchestrator-color);
  outline-offset: 2px;
}
```

This comprehensive design system provides engineers with exact specifications for implementing polished timeline visualization improvements while maintaining performance and accessibility standards.