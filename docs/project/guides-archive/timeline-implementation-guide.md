# Timeline Implementation Guide

## Quick Start Implementation

This guide provides engineers with immediate implementation steps for the polished timeline visualization.

## 1. Bezier Curve Implementation

### Core Curve Generator
```typescript
// utils/bezierCurves.ts
interface Point2D {
  x: number;
  y: number;
}

interface BezierCurve {
  start: Point2D;
  control1: Point2D;
  control2: Point2D;
  end: Point2D;
  arcLength: number;
  pathData: string;
}

export class TimelineCurveGenerator {
  private readonly TENSION = 0.4;
  private readonly ARC_SAMPLES = 100;
  
  generateAgentCurve(
    spawnX: number,
    laneY: number,
    endX: number,
    orchestratorY: number,
    agentType: string
  ): BezierCurve {
    const start = { x: spawnX, y: orchestratorY };
    const end = { x: endX, y: orchestratorY };
    
    // Calculate peak offset based on agent type and visual appeal
    const peakOffset = this.calculatePeakOffset(agentType, laneY - orchestratorY);
    const peak = {
      x: spawnX + (endX - spawnX) * 0.5,
      y: laneY + peakOffset
    };
    
    // Generate control points for smooth curve
    const control1 = {
      x: spawnX + (peak.x - spawnX) * this.TENSION,
      y: start.y + (peak.y - start.y) * 0.3
    };
    
    const control2 = {
      x: peak.x + (end.x - peak.x) * (1 - this.TENSION),
      y: peak.y + (end.y - peak.y) * 0.7
    };
    
    const arcLength = this.calculateArcLength([start, control1, control2, end]);
    const pathData = `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
    
    return {
      start,
      control1,
      control2,
      end,
      arcLength,
      pathData
    };
  }
  
  private calculatePeakOffset(agentType: string, baseLaneOffset: number): number {
    // Add subtle variation based on agent type for visual interest
    const typeVariations = {
      architect: 0.8,
      engineer: 1.0,
      tester: 1.1,
      reviewer: 0.9,
      verifier: 1.0,
      planner: 0.7,
      analyst: 0.8,
      researcher: 0.9,
      designer: 1.2,
      'cloud-cicd': 1.0,
      'general-purpose': 1.0
    };
    
    const variation = typeVariations[agentType as keyof typeof typeVariations] || 1.0;
    return Math.sin(Math.abs(baseLaneOffset) * 0.05) * 15 * variation;
  }
  
  private calculateArcLength(points: Point2D[]): number {
    let length = 0;
    const steps = this.ARC_SAMPLES;
    
    for (let i = 0; i < steps; i++) {
      const t1 = i / steps;
      const t2 = (i + 1) / steps;
      
      const p1 = this.evaluateBezier(points, t1);
      const p2 = this.evaluateBezier(points, t2);
      
      length += Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
      );
    }
    
    return length;
  }
  
  private evaluateBezier(points: Point2D[], t: number): Point2D {
    const [p0, p1, p2, p3] = points;
    const mt = 1 - t;
    
    return {
      x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
      y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
    };
  }
}
```

### Animation Implementation
```typescript
// utils/curveAnimations.ts
export class CurveAnimator {
  private animationFrames = new Map<string, number>();
  
  animatePathGrowth(
    pathElement: SVGPathElement,
    duration: number = 400,
    easing: string = 'cubic-bezier(0.4, 0, 0.2, 1)'
  ): Promise<void> {
    return new Promise(resolve => {
      const totalLength = pathElement.getTotalLength();
      
      pathElement.style.strokeDasharray = `0 ${totalLength}`;
      pathElement.style.strokeDashoffset = '0';
      
      const animation = pathElement.animate([
        { strokeDasharray: `0 ${totalLength}` },
        { strokeDasharray: `${totalLength} 0` }
      ], {
        duration,
        easing,
        fill: 'forwards'
      });
      
      animation.addEventListener('finish', () => {
        pathElement.style.strokeDasharray = 'none';
        resolve();
      });
    });
  }
  
  animateProgressFlow(
    pathElement: SVGPathElement,
    progress: number // 0 to 1
  ): void {
    const totalLength = pathElement.getTotalLength();
    const visibleLength = totalLength * progress;
    const dashLength = Math.max(20, totalLength * 0.1);
    
    pathElement.style.strokeDasharray = `${dashLength} ${totalLength}`;
    pathElement.style.strokeDashoffset = `${totalLength - visibleLength}`;
  }
}
```

## 2. Smart Y-Positioning Implementation

### Lane Allocator
```typescript
// utils/laneAllocator.ts
interface AgentInterval {
  id: string;
  startTime: number;
  endTime: number;
  type: string;
  priority: number;
  preferredLane?: number;
}

interface LaneAssignment {
  agentId: string;
  lane: number;
  y: number;
}

export class SmartLaneAllocator {
  private readonly LANE_HEIGHT = 60;
  private readonly TIME_BUFFER = 500; // 0.5s buffer
  private readonly BASE_Y = 140;
  
  private lanes = new Map<number, AgentInterval[]>();
  
  allocateLanes(agents: AgentInterval[]): Map<string, LaneAssignment> {
    this.lanes.clear();
    
    // Sort by start time, then priority
    const sortedAgents = [...agents].sort((a, b) => {
      if (Math.abs(a.startTime - b.startTime) < this.TIME_BUFFER) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.startTime - b.startTime;
    });
    
    const assignments = new Map<string, LaneAssignment>();
    
    for (const agent of sortedAgents) {
      const lane = this.findBestLane(agent);
      const y = this.calculateY(lane);
      
      assignments.set(agent.id, {
        agentId: agent.id,
        lane,
        y
      });
      
      this.assignToLane(lane, agent);
    }
    
    return assignments;
  }
  
  private findBestLane(agent: AgentInterval): number {
    // Try preferred lane first
    if (agent.preferredLane !== undefined && 
        this.canAssignToLane(agent.preferredLane, agent)) {
      return agent.preferredLane;
    }
    
    // Find lowest available lane
    for (let lane = 0; lane < 20; lane++) {
      if (this.canAssignToLane(lane, agent)) {
        return lane;
      }
    }
    
    // Force assign to new lane
    return this.lanes.size;
  }
  
  private canAssignToLane(lane: number, agent: AgentInterval): boolean {
    const laneAgents = this.lanes.get(lane);
    if (!laneAgents) return true;
    
    return !laneAgents.some(existing => 
      this.intervalsOverlap(agent, existing)
    );
  }
  
  private intervalsOverlap(a: AgentInterval, b: AgentInterval): boolean {
    return !(a.endTime + this.TIME_BUFFER < b.startTime || 
             b.endTime + this.TIME_BUFFER < a.startTime);
  }
  
  private assignToLane(lane: number, agent: AgentInterval): void {
    if (!this.lanes.has(lane)) {
      this.lanes.set(lane, []);
    }
    this.lanes.get(lane)!.push(agent);
  }
  
  private calculateY(lane: number): number {
    return this.BASE_Y + (lane * this.LANE_HEIGHT);
  }
}
```

## 3. Label Placement Implementation

### Curved Label Placer
```typescript
// utils/labelPlacer.ts
interface LabelPlacement {
  position: Point2D;
  rotation: number;
  offset: Point2D;
  usesLeaderLine: boolean;
  leaderPath?: string;
}

export class CurveLabelPlacer {
  private readonly MAX_ROTATION = 30; // degrees
  private readonly LABEL_OFFSET = 12;
  private readonly MIN_CURVE_RADIUS = 50;
  
  placeLabelOnCurve(
    curve: BezierCurve,
    labelText: string,
    fontSize: number = 12
  ): LabelPlacement {
    const textWidth = this.estimateTextWidth(labelText, fontSize);
    const optimalT = 0.35; // 35% along curve
    
    const position = this.evaluateBezierAtT(curve, optimalT);
    const tangent = this.evaluateBezierTangentAtT(curve, optimalT);
    const curvature = this.calculateCurvatureAtT(curve, optimalT);
    
    if (Math.abs(curvature) < 1 / this.MIN_CURVE_RADIUS) {
      // Low curvature - place directly
      return this.createDirectPlacement(position, tangent, labelText);
    } else {
      // High curvature - use leader line
      return this.createLeaderLinePlacement(position, tangent, labelText);
    }
  }
  
  private createDirectPlacement(
    position: Point2D,
    tangent: Point2D,
    text: string
  ): LabelPlacement {
    const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
    const clampedRotation = Math.max(-this.MAX_ROTATION, 
      Math.min(this.MAX_ROTATION, angle));
    
    const normal = this.getNormalVector(tangent);
    const offset = {
      x: normal.x * this.LABEL_OFFSET,
      y: normal.y * this.LABEL_OFFSET
    };
    
    return {
      position,
      rotation: clampedRotation,
      offset,
      usesLeaderLine: false
    };
  }
  
  private createLeaderLinePlacement(
    curvePosition: Point2D,
    tangent: Point2D,
    text: string
  ): LabelPlacement {
    const normal = this.getNormalVector(tangent);
    const leaderLength = 20;
    
    const labelPosition = {
      x: curvePosition.x + normal.x * leaderLength,
      y: curvePosition.y + normal.y * leaderLength
    };
    
    const leaderPath = `M ${curvePosition.x} ${curvePosition.y} L ${labelPosition.x} ${labelPosition.y}`;
    
    return {
      position: labelPosition,
      rotation: 0, // Keep horizontal for readability
      offset: { x: 0, y: 0 },
      usesLeaderLine: true,
      leaderPath
    };
  }
  
  private evaluateBezierAtT(curve: BezierCurve, t: number): Point2D {
    const { start, control1, control2, end } = curve;
    const mt = 1 - t;
    
    return {
      x: mt*mt*mt*start.x + 3*mt*mt*t*control1.x + 3*mt*t*t*control2.x + t*t*t*end.x,
      y: mt*mt*mt*start.y + 3*mt*mt*t*control1.y + 3*mt*t*t*control2.y + t*t*t*end.y
    };
  }
  
  private evaluateBezierTangentAtT(curve: BezierCurve, t: number): Point2D {
    const { start, control1, control2, end } = curve;
    const mt = 1 - t;
    
    const dx = 3*mt*mt*(control1.x - start.x) + 6*mt*t*(control2.x - control1.x) + 3*t*t*(end.x - control2.x);
    const dy = 3*mt*mt*(control1.y - start.y) + 6*mt*t*(control2.y - control1.y) + 3*t*t*(end.y - control2.y);
    
    const length = Math.sqrt(dx*dx + dy*dy);
    return { x: dx/length, y: dy/length };
  }
  
  private getNormalVector(tangent: Point2D): Point2D {
    return { x: -tangent.y, y: tangent.x };
  }
  
  private calculateCurvatureAtT(curve: BezierCurve, t: number): number {
    // Simplified curvature calculation
    const epsilon = 0.001;
    const p1 = this.evaluateBezierAtT(curve, t - epsilon);
    const p2 = this.evaluateBezierAtT(curve, t + epsilon);
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    return distance > 0 ? Math.abs(Math.atan2(dy, dx)) / distance : 0;
  }
  
  private estimateTextWidth(text: string, fontSize: number): number {
    // Rough estimation: average character width * 0.6 * fontSize
    return text.length * 0.6 * fontSize;
  }
}
```

## 4. CSS Implementation

### Core Styles
```scss
// styles/timeline-enhanced.scss
@import url('./timeline-tokens.css');

.timeline-agent-path {
  stroke-width: var(--stroke-width-normal);
  fill: none;
  transition: all var(--animation-duration-normal) var(--animation-easing-standard);
  will-change: stroke-width, filter, opacity;
  
  &.status-spawning {
    stroke-dasharray: 0, 1000;
    animation: path-spawn var(--animation-duration-spawn) var(--animation-easing-standard) forwards;
  }
  
  &.status-in-progress {
    stroke-dasharray: 8, 4;
    animation: progress-flow var(--animation-duration-pulse) linear infinite;
    filter: var(--effects-glows-medium);
  }
  
  &.status-completed {
    stroke-dasharray: none;
    opacity: 0.9;
    filter: var(--effects-glows-subtle);
  }
  
  &.status-completing {
    animation: completion-glow var(--animation-duration-completion) var(--animation-easing-decelerate);
  }
  
  &:hover {
    stroke-width: var(--stroke-width-thick);
    filter: brightness(1.2) var(--effects-glows-medium);
  }
}

.agent-label {
  position: absolute;
  background: var(--surface-label-background);
  backdrop-filter: var(--effects-blurs-backdrop);
  border: var(--effects-borders-thin) solid var(--surface-white-alpha-20);
  border-radius: var(--effects-border-radius-pill);
  padding: 4px 12px;
  font-size: var(--typography-labels-font-size);
  font-weight: var(--typography-labels-font-weight);
  font-family: var(--typography-labels-font-family);
  color: var(--agent-color);
  white-space: nowrap;
  pointer-events: none;
  z-index: var(--layout-z-index-labels);
  
  box-shadow: 
    var(--effects-shadows-small),
    0 0 0 1px var(--agent-color-alpha-20);
  
  transform-origin: center;
  transition: all var(--animation-duration-fast) var(--animation-easing-standard);
  
  &.with-leader-line::after {
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

.batch-spawn-point {
  r: var(--spacing-spawn-point-radius);
  fill: var(--colors-orchestrator-primary);
  stroke: var(--surface-white);
  stroke-width: var(--effects-borders-medium);
  filter: var(--effects-glows-strong);
  cursor: pointer;
  transition: all var(--animation-duration-normal) var(--animation-easing-spring);
  
  &:hover {
    r: calc(var(--spacing-spawn-point-radius) * 1.5);
    filter: brightness(1.2) var(--effects-glows-strong);
  }
  
  &.active {
    animation: spawn-pulse var(--animation-duration-normal) var(--animation-easing-standard) infinite alternate;
  }
}

// Animation keyframes
@keyframes path-spawn {
  from { stroke-dasharray: 0, 1000; }
  to { stroke-dasharray: 1000, 0; }
}

@keyframes progress-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -20; }
}

@keyframes completion-glow {
  0%, 100% { 
    opacity: 1; 
    filter: var(--effects-glows-subtle); 
  }
  50% { 
    opacity: 1; 
    filter: brightness(1.4) var(--effects-glows-strong); 
  }
}

@keyframes spawn-pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.1); opacity: 0.8; }
}

// Agent type color classes
@each $agent-type in (architect, engineer, tester, reviewer, verifier, planner, analyst, researcher, designer, cloud-cicd, general-purpose) {
  .agent-type-#{$agent-type} {
    --agent-color: var(--colors-agents-#{$agent-type}-primary);
    --agent-color-alpha-20: var(--colors-agents-#{$agent-type}-alpha-20);
    --agent-color-alpha-40: var(--colors-agents-#{$agent-type}-alpha-40);
    --agent-color-alpha-60: var(--colors-agents-#{$agent-type}-alpha-60);
    --agent-color-alpha-80: var(--colors-agents-#{$agent-type}-alpha-80);
    
    stroke: var(--agent-color);
    filter: var(--colors-agents-#{$agent-type}-glow);
  }
}
```

## 5. React/Vue Component Integration

### Vue Component Enhancement
```typescript
// Add to existing InteractiveAgentTimeline.vue
import { TimelineCurveGenerator } from '@/utils/bezierCurves';
import { SmartLaneAllocator } from '@/utils/laneAllocator';
import { CurveLabelPlacer } from '@/utils/labelPlacer';

// In setup function
const curveGenerator = new TimelineCurveGenerator();
const laneAllocator = new SmartLaneAllocator();
const labelPlacer = new CurveLabelPlacer();

// Enhanced agent paths computation
const enhancedAgentPaths = computed(() => {
  const agentIntervals = visibleAgents.value.map(agent => ({
    id: agent.agentId,
    startTime: agent.startTime,
    endTime: agent.endTime || Date.now(),
    type: agent.type,
    priority: getAgentPriority(agent.type)
  }));
  
  const laneAssignments = laneAllocator.allocateLanes(agentIntervals);
  
  return visibleAgents.value.map(agent => {
    const assignment = laneAssignments.get(agent.agentId);
    const spawnX = getTimeX(agent.startTime);
    const endX = getTimeX(agent.endTime || Date.now());
    
    const curve = curveGenerator.generateAgentCurve(
      spawnX,
      assignment?.y || getAgentLaneY(0),
      endX,
      orchestratorY,
      agent.type
    );
    
    const labelPlacement = labelPlacer.placeLabelOnCurve(
      curve,
      agent.name,
      12
    );
    
    return {
      ...agent,
      curve,
      laneAssignment: assignment,
      labelPlacement
    };
  });
});

function getAgentPriority(type: string): number {
  const priorities = {
    architect: 9,
    planner: 8,
    engineer: 7,
    tester: 6,
    reviewer: 5,
    verifier: 4,
    analyst: 3,
    researcher: 2,
    designer: 1,
    'general-purpose': 0
  };
  return priorities[type as keyof typeof priorities] || 0;
}
```

## 6. Performance Considerations

### Virtualization Implementation
```typescript
// utils/virtualization.ts
export class TimelineVirtualizer {
  private readonly VIEWPORT_BUFFER = 100; // pixels
  
  cullVisibleElements<T extends { position: Point2D }>(
    elements: T[],
    viewport: { x: number; y: number; width: number; height: number }
  ): T[] {
    return elements.filter(element => {
      const { position } = element;
      return (
        position.x >= viewport.x - this.VIEWPORT_BUFFER &&
        position.x <= viewport.x + viewport.width + this.VIEWPORT_BUFFER &&
        position.y >= viewport.y - this.VIEWPORT_BUFFER &&
        position.y <= viewport.y + viewport.height + this.VIEWPORT_BUFFER
      );
    });
  }
  
  shouldUseLOD(elementCount: number, zoomLevel: number): boolean {
    return elementCount > 200 || zoomLevel < 0.5;
  }
}
```

## Next Steps

1. **Install Dependencies**: Add the utility classes to your project
2. **Update Styles**: Import the enhanced CSS tokens and animations  
3. **Test Integration**: Start with bezier curves, then add lane allocation
4. **Optimize Performance**: Add virtualization for large datasets
5. **Validate Accessibility**: Test with screen readers and high contrast mode

The implementation is modular - you can adopt each piece incrementally while maintaining existing functionality.