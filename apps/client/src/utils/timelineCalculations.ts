import type { 
  AgentBatch, 
  TimelineAgent, 
  TimelineMessage,
  TimelineConfig 
} from '../types/timeline';
import type { AgentStatus, SubagentMessage } from '../types';

/**
 * Default timeline configuration
 */
export const DEFAULT_TIMELINE_CONFIG: any = {
  width: 1200,
  height: 600,
  margins: { top: 60, right: 60, bottom: 60, left: 120 },
  orchestratorY: 200,
  agentLaneHeight: 60,
  maxAgentLanes: 10,
  agent_lane_height: 60,
  batch_separation: 80,
  message_height: 20,
  user_prompt_height: 40,
  batch_spawn_threshold: 100, // 100ms window for batch detection
  curve_tension: 0.4,
  colors: {
    orchestrator: '#00d4ff',
    orchestratorGlow: '#00d4ff',
    userPrompt: '#ffffff',
    spawnPoint: '#3b82f6',
    message: '#ffffff',
    background: '#1f2937',
    grid: 'rgba(59, 130, 246, 0.1)',
    pending: '#fbbf24',
    in_progress: '#3b82f6',
    completed: '#10b981',
    message_line: '#6b7280',
    batch_background: '#f3f4f6',
    user_prompt: '#8b5cf6',
    agentTypes: {}
  },
  animations: {
    enabled: true,
    spawnDuration: 300,
    messagePulseDuration: 2000,
    pathTransitionDuration: 250,
    hoverTransitionDuration: 150,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  performance: {
    virtualizeThreshold: 100,
    lodZoomThresholds: { messages: 1.5, labels: 0.8, details: 2.0 },
    updateThrottleMs: 100,
    maxVisibleAgents: 200,
    useCanvasForMessages: false,
    progressiveRenderBatchSize: 20,
    enableGPUAcceleration: true
  },
  animation_duration: 300,
  ease_function: 'cubic-bezier(0.4, 0, 0.2, 1)'
};

/**
 * Create timeline scale from time domain to pixel coordinates
 */
export function createTimelineScale(
  timeDomain: { start: number; end: number },
  viewportWidth: number,
  padding: { left: number; right: number }
): any {
  const availableWidth = viewportWidth - padding.left - padding.right;
  const duration = timeDomain.end - timeDomain.start;
  
  const timeToX = (timestamp: number): number => {
    if (duration === 0) return padding.left;
    const ratio = (timestamp - timeDomain.start) / duration;
    return padding.left + (ratio * availableWidth);
  };
  
  const xToTime = (x: number): number => {
    const ratio = (x - padding.left) / availableWidth;
    return timeDomain.start + (ratio * duration);
  };
  
  // Generate tick marks
  const ticks = generateTimeTicks(timeDomain, availableWidth, timeToX);
  
  return {
    domain: {
      start: timeDomain.start,
      end: timeDomain.end,
      duration
    },
    range: {
      start: padding.left,
      end: padding.left + availableWidth,
      width: availableWidth
    },
    timeToX,
    xToTime,
    ticks
  };
}

/**
 * Generate time axis tick marks
 */
function generateTimeTicks(
  domain: { start: number; end: number },
  width: number,
  timeToX: (timestamp: number) => number
): Array<{ timestamp: number; x: number; label: string; type: 'major' | 'minor' }> {
  const duration = domain.end - domain.start;
  const ticks = [];
  
  // Determine appropriate tick interval based on duration
  let tickInterval: number;
  let labelFormat: (timestamp: number) => string;
  
  if (duration < 60000) { // < 1 minute - show seconds
    tickInterval = 5000; // 5 second intervals
    labelFormat = (ts) => new Date(ts).toLocaleTimeString([], { 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } else if (duration < 3600000) { // < 1 hour - show minutes
    tickInterval = 60000; // 1 minute intervals
    labelFormat = (ts) => new Date(ts).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else { // >= 1 hour - show hours
    tickInterval = 3600000; // 1 hour intervals
    labelFormat = (ts) => new Date(ts).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Generate major ticks
  const startTick = Math.ceil(domain.start / tickInterval) * tickInterval;
  for (let timestamp = startTick; timestamp <= domain.end; timestamp += tickInterval) {
    const x = timeToX(timestamp);
    if (x >= 0 && x <= width) {
      ticks.push({
        timestamp,
        x,
        label: labelFormat(timestamp),
        type: 'major' as const
      });
    }
  }
  
  // Generate minor ticks (quarter intervals)
  const minorInterval = tickInterval / 4;
  for (let timestamp = startTick; timestamp <= domain.end; timestamp += minorInterval) {
    if (timestamp % tickInterval !== 0) { // Don't duplicate major ticks
      const x = timeToX(timestamp);
      if (x >= 0 && x <= width) {
        ticks.push({
          timestamp,
          x,
          label: '',
          type: 'minor' as const
        });
      }
    }
  }
  
  return ticks.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Group agents into batches based on spawn timing
 */
export function detectAgentBatches(
  agents: any[],
  spawnThreshold: number = DEFAULT_TIMELINE_CONFIG.batch_spawn_threshold
): Array<{ batch_id: string; agents: any[]; spawn_time: number }> {
  if (agents.length === 0) return [];
  
  // Sort agents by creation time
  const sortedAgents = [...agents].sort((a, b) => a.created_at - b.created_at);
  
  const batches: Array<{ batch_id: string; agents: AgentStatus[]; spawn_time: number }> = [];
  let currentBatch: AgentStatus[] = [];
  let currentBatchStart = sortedAgents[0].created_at;
  
  for (const agent of sortedAgents) {
    // If agent was created within threshold of batch start, add to current batch
    if (agent.created_at - currentBatchStart <= spawnThreshold) {
      currentBatch.push(agent);
    } else {
      // Start new batch
      if (currentBatch.length > 0) {
        batches.push({
          batch_id: `batch_${batches.length + 1}`,
          agents: currentBatch,
          spawn_time: currentBatchStart
        });
      }
      
      currentBatch = [agent];
      currentBatchStart = agent.created_at;
    }
  }
  
  // Add final batch
  if (currentBatch.length > 0) {
    batches.push({
      batch_id: `batch_${batches.length + 1}`,
      agents: currentBatch,
      spawn_time: currentBatchStart
    });
  }
  
  // Sort batches chronologically and assign sequential batch numbers
  return batches.sort((a, b) => a.spawn_time - b.spawn_time)
    .map((batch, index) => ({
      ...batch,
      batch_id: `batch_${index + 1}` // Chronological numbering
    }));
}

/**
 * Calculate sophisticated Bezier curve for agent path:
 * Orchestrator (y=200) → Agent Lane → Orchestrator (y=200)
 * Creates smooth curves with proper control points for visual appeal
 */
export function calculateAgentPath(
  agent: TimelineAgent,
  batchIndex: number,
  totalInBatch: number,
  scale: TimelineScale,
  config: TimelineConfig
): { startPoint: { x: number; y: number }; controlPoint1: { x: number; y: number }; controlPoint2: { x: number; y: number }; endPoint: { x: number; y: number } } {
  
  const startX = scale.timeToX(agent.created_at);
  const endX = agent.completed_at ? scale.timeToX(agent.completed_at) : scale.range.end;
  
  // Orchestrator baseline - all paths start and end here
  const orchestratorY = 200;
  
  // Calculate agent lane Y position based on batch and agent index
  const laneHeight = config.agent_lane_height;
  const batchSeparation = config.batch_separation;
  
  // Spread agents in batch vertically around batch center
  const batchCenterY = orchestratorY + (batchIndex + 1) * batchSeparation;
  const agentIndexInBatch = agent.batchIndex;
  const verticalSpread = (agentIndexInBatch - (totalInBatch - 1) / 2) * (laneHeight * 0.8);
  const agentLaneY = batchCenterY + verticalSpread;
  
  // Calculate control points for smooth orchestrator → lane → orchestrator flow
  const pathLength = endX - startX;
  const laneDeviation = Math.abs(agentLaneY - orchestratorY);
  
  // Control point positions as ratios of path length
  const cp1Ratio = 0.25; // First quarter for departure curve
  const cp2Ratio = 0.75; // Last quarter for return curve
  
  // Adaptive control point Y offsets based on lane distance
  const departureOffset = laneDeviation * 0.6; // Smooth departure
  const returnOffset = laneDeviation * 0.6; // Smooth return
  
  const controlPoint1X = startX + (pathLength * cp1Ratio);
  const controlPoint1Y = orchestratorY + departureOffset * (agentLaneY > orchestratorY ? 1 : -1);
  
  const controlPoint2X = startX + (pathLength * cp2Ratio);
  const controlPoint2Y = orchestratorY + returnOffset * (agentLaneY > orchestratorY ? 1 : -1);
  
  return {
    startPoint: { x: startX, y: orchestratorY },
    controlPoint1: { x: controlPoint1X, y: controlPoint1Y },
    controlPoint2: { x: controlPoint2X, y: controlPoint2Y },
    endPoint: { x: endX, y: orchestratorY }
  };
}

/**
 * Generate SVG path string for agent bezier curve
 * Optimized for performance with hundreds of agents
 */
export function generateAgentPathString(
  path: { startPoint: { x: number; y: number }; controlPoint1: { x: number; y: number }; controlPoint2: { x: number; y: number }; endPoint: { x: number; y: number } },
  agentLaneY: number,
  pathLength: number
): string {
  const { startPoint, controlPoint1, controlPoint2, endPoint } = path;
  
  // Create path with orchestrator → lane → orchestrator flow
  const pathCommands = [
    `M ${startPoint.x.toFixed(2)},${startPoint.y.toFixed(2)}`, // Move to start (orchestrator)
    
    // Smooth curve from orchestrator to agent lane
    `Q ${controlPoint1.x.toFixed(2)},${controlPoint1.y.toFixed(2)} ${(startPoint.x + pathLength * 0.3).toFixed(2)},${agentLaneY.toFixed(2)}`,
    
    // Execution phase - horizontal along agent lane with slight curve
    `Q ${(startPoint.x + pathLength * 0.5).toFixed(2)},${(agentLaneY - 5).toFixed(2)} ${(startPoint.x + pathLength * 0.7).toFixed(2)},${agentLaneY.toFixed(2)}`,
    
    // Smooth curve back to orchestrator
    `Q ${controlPoint2.x.toFixed(2)},${controlPoint2.y.toFixed(2)} ${endPoint.x.toFixed(2)},${endPoint.y.toFixed(2)}`
  ];
  
  return pathCommands.join(' ');
}

/**
 * Calculate optimized control points for smooth curves
 * Handles edge cases and provides consistent curve quality
 */
export function calculateOptimalControlPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  peakY: number,
  tension: number = 0.4
): {
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  midPoint: { x: number; y: number };
} {
  const pathLength = endX - startX;
  const heightDiff = Math.abs(peakY - startY);
  
  // Adaptive tension based on path characteristics
  const adaptiveTension = Math.min(tension + (heightDiff / 200) * 0.2, 0.8);
  
  // Control points positioned for optimal curve shape
  const cp1X = startX + pathLength * (0.25 + adaptiveTension * 0.1);
  const cp1Y = startY + (peakY - startY) * (0.3 + adaptiveTension * 0.2);
  
  const cp2X = startX + pathLength * (0.75 - adaptiveTension * 0.1);
  const cp2Y = endY + (peakY - endY) * (0.3 + adaptiveTension * 0.2);
  
  const midPoint = {
    x: startX + pathLength * 0.5,
    y: peakY
  };
  
  return {
    cp1: { x: cp1X, y: cp1Y },
    cp2: { x: cp2X, y: cp2Y },
    midPoint
  };
}

/**
 * Calculate message position along agent curve
 */
export function calculateMessagePosition(
  message: SubagentMessage,
  senderAgent: TimelineAgent,
  recipientAgent: TimelineAgent | undefined,
  scale: TimelineScale
): {
  position: { x: number; y: number; targetY?: number };
  connection?: { startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; curvature: number };
} {
  
  const messageX = scale.timeToX(message.created_at);
  
  // Calculate position along sender's path curve
  const senderPath = senderAgent.path;
  const t = calculateCurveParameter(messageX, senderPath);
  const messageY = calculateBezierPoint(t, senderPath).y;
  
  const result: any = {
    position: {
      x: messageX,
      y: messageY
    }
  };
  
  // If there's a specific recipient, calculate connection
  if (recipientAgent) {
    const recipientPath = recipientAgent.path;
    const recipientT = calculateCurveParameter(messageX, recipientPath);
    const targetY = calculateBezierPoint(recipientT, recipientPath).y;
    
    result.position.targetY = targetY;
    result.connection = {
      startPoint: { x: messageX, y: messageY },
      endPoint: { x: messageX, y: targetY },
      curvature: Math.abs(targetY - messageY) * 0.2
    };
  }
  
  return result;
}

/**
 * Calculate parameter t for a given X position on a Bezier curve
 */
function calculateCurveParameter(
  targetX: number,
  path: { startPoint: { x: number; y: number }; controlPoint1: { x: number; y: number }; controlPoint2: { x: number; y: number }; endPoint: { x: number; y: number } }
): number {
  // Use binary search to find t where Bezier X equals targetX
  let low = 0;
  let high = 1;
  let t = 0.5;
  const tolerance = 1;
  
  for (let i = 0; i < 20; i++) { // Max iterations
    const point = calculateBezierPoint(t, path);
    const diff = point.x - targetX;
    
    if (Math.abs(diff) < tolerance) break;
    
    if (diff > 0) {
      high = t;
    } else {
      low = t;
    }
    t = (low + high) / 2;
  }
  
  return Math.max(0, Math.min(1, t));
}

/**
 * Calculate point on cubic Bezier curve for parameter t
 */
function calculateBezierPoint(
  t: number,
  path: { startPoint: { x: number; y: number }; controlPoint1: { x: number; y: number }; controlPoint2: { x: number; y: number }; endPoint: { x: number; y: number } }
): { x: number; y: number } {
  const { startPoint: p0, controlPoint1: p1, controlPoint2: p2, endPoint: p3 } = path;
  
  const x = (1 - t) ** 3 * p0.x + 
            3 * (1 - t) ** 2 * t * p1.x + 
            3 * (1 - t) * t ** 2 * p2.x + 
            t ** 3 * p3.x;
  
  const y = (1 - t) ** 3 * p0.y + 
            3 * (1 - t) ** 2 * t * p1.y + 
            3 * (1 - t) * t ** 2 * p2.y + 
            t ** 3 * p3.y;
  
  return { x, y };
}

/**
 * Calculate optimal viewport height based on batch layout
 */
export function calculateViewportHeight(
  batches: TimelineBatch[],
  config: TimelineConfig,
  padding: { top: number; bottom: number }
): number {
  if (batches.length === 0) return 400;
  
  const maxBatchY = Math.max(...batches.map(batch => 
    batch.position.y + batch.position.height
  ));
  
  return maxBatchY + padding.top + padding.bottom + config.user_prompt_height;
}

/**
 * Detect message type based on content analysis
 */
export function detectMessageType(message: any): 'broadcast' | 'direct' | 'discovery' {
  if (typeof message === 'string') {
    if (message.toLowerCase().includes('broadcast') || 
        message.toLowerCase().includes('team') ||
        message.toLowerCase().includes('all')) {
      return 'broadcast';
    }
    if (message.toLowerCase().includes('discovery') ||
        message.toLowerCase().includes('found') ||
        message.toLowerCase().includes('discovered')) {
      return 'discovery';
    }
  }
  return 'direct';
}

/**
 * Optimize timeline layout for performance with hundreds of agents
 * Implements various performance optimizations including curve simplification
 */
export function optimizeTimelineLayout(
  agents: any[],
  batches: any[],
  viewportWidth: number
): { agents: any[]; batches: any[] } {
  // Performance optimizations for large datasets
  
  // 1. Simplify curves for agents outside detailed view
  const optimizedAgents = agents.map(agent => {
    if (agent.curveData && agent.curveData.length > 4) {
      // For distant or small agents, use simplified 3-point curves
      const simplified = simplifyAgentCurve(agent.curveData, 2.0); // 2px tolerance
      return { ...agent, curveData: simplified };
    }
    return agent;
  });
  
  // 2. Batch consolidation for overlapping time ranges
  const optimizedBatches = batches.map(batch => {
    if (batch.agents && batch.agents.length > 50) {
      // For very large batches, use representative sampling
      const sampled = {
        ...batch,
        agents: batch.agents.slice(0, 20), // Show first 20 + summary
        _isConsolidated: true,
        _hiddenCount: batch.agents.length - 20
      };
      return sampled;
    }
    return batch;
  });
  
  return { agents: optimizedAgents, batches: optimizedBatches };
}

/**
 * Simplify curve data using Douglas-Peucker-like algorithm
 * Reduces curve points while maintaining visual quality
 */
export function simplifyAgentCurve(
  curveData: any[],
  tolerance: number = 1.0
): any[] {
  if (curveData.length <= 2) return curveData;
  
  // Always keep start and end points
  const simplified = [curveData[0]];
  
  // Keep critical control points for bezier curves
  for (let i = 1; i < curveData.length - 1; i++) {
    const point = curveData[i];
    const prev = simplified[simplified.length - 1];
    
    // Keep points that represent significant direction changes
    const distance = Math.sqrt(
      Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2)
    );
    
    if (distance > tolerance || point.type === 'cubic') {
      simplified.push(point);
    }
  }
  
  // Always keep the end point
  simplified.push(curveData[curveData.length - 1]);
  
  return simplified;
}

/**
 * Batch curve calculations for performance
 * Pre-calculates common curve segments that can be reused
 */
export function batchCalculateCurves(
  agents: any[],
  config: any
): Map<string, any> {
  const curveCache = new Map();
  
  // Group agents by similar characteristics for curve reuse
  const curveGroups = new Map();
  
  agents.forEach(agent => {
    const key = `${agent.batchId}_${agent.laneIndex}`;
    if (!curveGroups.has(key)) {
      curveGroups.set(key, []);
    }
    curveGroups.get(key).push(agent);
  });
  
  // Pre-calculate representative curves for each group
  curveGroups.forEach((groupAgents, key) => {
    const representative = groupAgents[0];
    if (representative && representative.curveData) {
      curveCache.set(key, {
        template: representative.curveData,
        agentCount: groupAgents.length
      });
    }
  });
  
  return curveCache;
}