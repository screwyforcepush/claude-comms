/**
 * SVG Helper Utilities for Agent Timeline Visualization
 * 
 * This module provides utility functions for creating and manipulating SVG elements,
 * focusing on performance and visual consistency for the agent timeline renderer.
 */

import type { AgentType, CurvePoint, Point2D, TimelineColors } from '../types/timeline';

// ============================================================================
// Color System Integration
// ============================================================================

/**
 * Agent type color mappings based on the design system
 * Extended from the existing useEventColors for timeline-specific needs
 */
export const AGENT_TYPE_COLORS: Record<AgentType, string> = {
  // Core agent types with high contrast colors for dark theme
  architect: '#4ecdc4',      // Teal - System architects 
  engineer: '#ff6b6b',       // Red coral - General engineers
  coder: '#ff6b6b',          // Red coral - Code-focused engineers
  tester: '#ffd93d',         // Yellow - Test engineers
  reviewer: '#95e77e',       // Green - Code reviewers
  verifier: '#a78bfa',       // Purple - Green verifiers
  planner: '#f97316',        // Orange - Project planners
  analyst: '#ec4899',        // Pink - Business analysts
  researcher: '#06b6d4',     // Cyan - Research specialists
  designer: '#8b5cf6',       // Violet - UX/UI designers
  'cloud-cicd': '#22c55e',   // Green - DevOps/deployment
  'general-purpose': '#9ca3af',  // Gray - General purpose agents
  'deep-researcher': '#0ea5e9', // Blue - Deep research specialists
  'business-analyst': '#d946ef', // Magenta - Business analysts
  'green-verifier': '#84cc16',   // Lime - Green verifiers
  'code-reviewer': '#f59e0b',    // Amber - Code reviewers
} as const;

/**
 * Get color for agent type with fallback
 */
export function getAgentTypeColor(agentType: AgentType): string {
  return AGENT_TYPE_COLORS[agentType] || '#3b82f6'; // Default blue
}

/**
 * Hash-based color generation for unknown agent types
 * Consistent with existing useEventColors system
 */
export function hashAgentTypeColor(agentType: string): string {
  let hash = 7151;
  for (let i = 0; i < agentType.length; i++) {
    hash = ((hash << 5) + hash) + agentType.charCodeAt(i);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Apply opacity modifier for agent status
 */
export function getStatusOpacity(status: 'pending' | 'in_progress' | 'completed' | 'error'): number {
  switch (status) {
    case 'pending': return 0.4;
    case 'in_progress': return 0.8;
    case 'completed': return 1.0;
    case 'error': return 0.9;
    default: return 0.6;
  }
}

// ============================================================================
// SVG Path Generation
// ============================================================================

/**
 * Generate smooth bezier curve path string for agent execution paths
 * Creates curved lines that gracefully branch from and return to orchestrator
 */
export function createBezierPath(points: CurvePoint[]): string {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    
    if (current.controlX !== undefined && current.controlY !== undefined) {
      // Quadratic bezier curve
      path += ` Q ${current.controlX} ${current.controlY} ${current.x} ${current.y}`;
    } else {
      // Smooth curve using previous point as control
      const controlX = previous.x + (current.x - previous.x) * 0.5;
      const controlY = Math.min(previous.y, current.y) - 20; // Arc upward
      path += ` Q ${controlX} ${controlY} ${current.x} ${current.y}`;
    }
  }
  
  return path;
}

/**
 * Calculate bezier curve points for agent path
 * Creates smooth arc from orchestrator line, up to peak, and back down
 */
export function calculateAgentCurve(
  startX: number,
  startY: number, 
  endX: number,
  endY: number,
  peakY: number,
  curveIntensity: number = 0.3
): CurvePoint[] {
  const midX = startX + (endX - startX) * 0.5;
  const controlOffset = Math.abs(endX - startX) * curveIntensity;
  
  return [
    { x: startX, y: startY },
    { 
      x: startX + controlOffset, 
      y: peakY,
      controlX: startX + 10,
      controlY: startY - 20 
    },
    { x: midX, y: peakY },
    { 
      x: endX - controlOffset, 
      y: peakY,
      controlX: endX - 10,
      controlY: endY - 20 
    },
    { x: endX, y: endY }
  ];
}

/**
 * Generate path for orchestrator main line with subtle curves
 */
export function createOrchestratorPath(
  startX: number,
  endX: number,
  y: number,
  spawnPoints: Array<{ x: number; intensity: number }>
): string {
  let path = `M ${startX} ${y}`;
  
  // Add subtle waves at spawn points
  let currentX = startX;
  
  spawnPoints.forEach(point => {
    if (point.x > currentX) {
      // Gentle curve leading to spawn point
      const preX = point.x - 20;
      const postX = point.x + 20;
      const waveHeight = 2 + (point.intensity * 3);
      
      path += ` L ${preX} ${y}`;
      path += ` Q ${point.x} ${y - waveHeight} ${postX} ${y}`;
      currentX = postX;
    }
  });
  
  // Complete the line
  if (currentX < endX) {
    path += ` L ${endX} ${y}`;
  }
  
  return path;
}

// ============================================================================
// SVG Filter Definitions
// ============================================================================

/**
 * Create SVG filter for glow effects
 * Used for orchestrator line and active agents
 */
export function createGlowFilter(
  id: string, 
  color: string, 
  intensity: number = 1,
  blur: number = 8
): string {
  const glowOpacity = Math.min(0.6 * intensity, 1);
  
  return `
    <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feMorphology operator="dilate" radius="2"/>
      <feGaussianBlur stdDeviation="${blur}" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `;
}

/**
 * Create SVG filter for drop shadows
 */
export function createDropShadowFilter(id: string): string {
  return `
    <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
    </filter>
  `;
}

/**
 * Generate complete SVG defs section with all filters
 */
export function createSVGDefs(colors: TimelineColors): string {
  return `
    <defs>
      <!-- Glow filters for different elements -->
      ${createGlowFilter('orchestrator-glow', colors.orchestratorGlow, 1.2, 10)}
      ${createGlowFilter('agent-glow', colors.orchestrator, 0.8, 6)}
      ${createGlowFilter('message-glow', colors.message, 1.0, 4)}
      
      <!-- Drop shadow filters -->
      ${createDropShadowFilter('node-shadow')}
      
      <!-- Gradient definitions -->
      <linearGradient id="orchestrator-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${colors.orchestrator};stop-opacity:0.8"/>
        <stop offset="50%" style="stop-color:${colors.orchestrator};stop-opacity:1"/>
        <stop offset="100%" style="stop-color:${colors.orchestrator};stop-opacity:0.8"/>
      </linearGradient>
      
      <!-- Animation definitions -->
      <animate id="message-pulse" attributeName="r" 
               values="3;5;3" dur="2s" repeatCount="indefinite"/>
               
      <animateTransform id="spawn-scale" attributeName="transform" type="scale"
                        values="0;1.2;1" dur="0.3s" begin="0s"/>
    </defs>
  `;
}

// ============================================================================
// Coordinate Transformations
// ============================================================================

/**
 * Transform timeline timestamp to SVG x coordinate
 */
export function timestampToX(
  timestamp: number, 
  timeRange: { start: number; end: number },
  svgWidth: number,
  margins: { left: number; right: number }
): number {
  const timeSpan = timeRange.end - timeRange.start;
  const availableWidth = svgWidth - margins.left - margins.right;
  const normalizedTime = (timestamp - timeRange.start) / timeSpan;
  
  return margins.left + (normalizedTime * availableWidth);
}

/**
 * Calculate agent lane Y coordinate
 */
export function calculateLaneY(
  laneIndex: number,
  orchestratorY: number,
  laneHeight: number
): number {
  return orchestratorY - (laneIndex + 1) * laneHeight - 20;
}

/**
 * Find optimal lane assignment for agents to minimize overlapping
 */
export function assignAgentLanes(
  agents: Array<{ startTime: number; endTime: number; id: string }>,
  maxLanes: number = 10
): Map<string, number> {
  const laneAssignments = new Map<string, number>();
  const lanes: Array<{ endTime: number }[]> = Array(maxLanes).fill(null).map(() => []);
  
  // Sort agents by start time
  const sortedAgents = [...agents].sort((a, b) => a.startTime - b.startTime);
  
  sortedAgents.forEach(agent => {
    // Find the first available lane
    let assignedLane = 0;
    for (let i = 0; i < maxLanes; i++) {
      const lane = lanes[i];
      const canFit = lane.every(occupant => occupant.endTime <= agent.startTime);
      
      if (canFit) {
        assignedLane = i;
        break;
      }
    }
    
    // Add agent to lane
    lanes[assignedLane].push({ endTime: agent.endTime });
    laneAssignments.set(agent.id, assignedLane);
  });
  
  return laneAssignments;
}

// ============================================================================
// Animation Utilities
// ============================================================================

/**
 * Create CSS animation string for pulsing messages
 */
export function createMessagePulseAnimation(duration: number = 2): string {
  return `message-pulse ${duration}s infinite`;
}

/**
 * Generate keyframe animations for spawn effects
 */
export function createSpawnAnimation(): string {
  return `
    @keyframes agent-spawn {
      0% {
        opacity: 0;
        stroke-width: 0;
        filter: drop-shadow(0 0 0px currentColor);
      }
      50% {
        opacity: 0.7;
        stroke-width: 4px;
        filter: drop-shadow(0 0 12px currentColor);
      }
      100% {
        opacity: 1;
        stroke-width: 2px;
        filter: drop-shadow(0 0 8px currentColor);
      }
    }
  `;
}

/**
 * CSS for hover effect transitions
 */
export function createHoverStyles(): string {
  return `
    .agent-line {
      transition: all 150ms ease;
      cursor: pointer;
    }
    
    .agent-line:hover {
      stroke-width: 3px;
      filter: drop-shadow(0 0 12px currentColor);
    }
    
    .message-dot {
      transition: all 200ms ease;
      cursor: pointer;
    }
    
    .message-dot:hover {
      r: 5;
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8));
    }
  `;
}

// ============================================================================
// Performance Optimizations
// ============================================================================

/**
 * Simplify path for distant zoom levels
 */
export function simplifyPath(points: CurvePoint[], tolerance: number = 1): CurvePoint[] {
  if (points.length <= 2) return points;
  
  // Douglas-Peucker simplification algorithm
  function getPerpendicularDistance(point: CurvePoint, lineStart: CurvePoint, lineEnd: CurvePoint): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const param = dot / lenSq;
    const closestPoint = {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D
    };
    
    return Math.sqrt(
      Math.pow(point.x - closestPoint.x, 2) + 
      Math.pow(point.y - closestPoint.y, 2)
    );
  }
  
  function simplifyRecursive(start: number, end: number): CurvePoint[] {
    if (end - start <= 1) return [points[start], points[end]];
    
    let maxDistance = 0;
    let maxIndex = start;
    
    for (let i = start + 1; i < end; i++) {
      const distance = getPerpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    if (maxDistance > tolerance) {
      const left = simplifyRecursive(start, maxIndex);
      const right = simplifyRecursive(maxIndex, end);
      return [...left.slice(0, -1), ...right];
    }
    
    return [points[start], points[end]];
  }
  
  return simplifyRecursive(0, points.length - 1);
}

/**
 * Calculate if element is within visible viewport
 */
export function isElementVisible(
  elementBounds: { x: number; y: number; width: number; height: number },
  viewportBounds: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    elementBounds.x + elementBounds.width < viewportBounds.x ||
    elementBounds.x > viewportBounds.x + viewportBounds.width ||
    elementBounds.y + elementBounds.height < viewportBounds.y ||
    elementBounds.y > viewportBounds.y + viewportBounds.height
  );
}

/**
 * Format timestamp for display on timeline axis
 */
export function formatTimeLabel(timestamp: number, format: 'relative' | 'absolute' = 'relative'): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (format === 'relative') {
    if (diff < 1000) return 'now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }
  
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Generate accessibility attributes for SVG elements
 */
export function createAccessibilityAttrs(
  role: string,
  label: string,
  description?: string
): Record<string, string> {
  const attrs: Record<string, string> = {
    role,
    'aria-label': label,
    tabindex: '0'
  };
  
  if (description) {
    attrs['aria-description'] = description;
  }
  
  return attrs;
}