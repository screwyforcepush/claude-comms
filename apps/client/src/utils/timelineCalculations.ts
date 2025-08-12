import type { 
  TimelineScale, 
  TimelineBatch, 
  TimelineAgent, 
  TimelineMessage,
  TimelineConfig 
} from '../types/timeline';
import type { AgentStatus, SubagentMessage } from '../types';

/**
 * Default timeline configuration
 */
export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  agent_lane_height: 60,
  batch_separation: 80,
  message_height: 20,
  user_prompt_height: 40,
  batch_spawn_threshold: 100, // 100ms window for batch detection
  curve_tension: 0.4,
  colors: {
    pending: '#fbbf24',
    in_progress: '#3b82f6',
    completed: '#10b981',
    message_line: '#6b7280',
    batch_background: '#f3f4f6',
    user_prompt: '#8b5cf6'
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
): TimelineScale {
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
  agents: AgentStatus[],
  spawnThreshold: number = DEFAULT_TIMELINE_CONFIG.batch_spawn_threshold
): Array<{ batch_id: string; agents: AgentStatus[]; spawn_time: number }> {
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
  
  return batches;
}

/**
 * Calculate Bezier curve control points for agent paths
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
  
  // Calculate Y position based on batch index
  const baseY = 100; // Starting Y position
  const laneHeight = config.agent_lane_height;
  const batchSeparation = config.batch_separation;
  
  // Spread agents in batch vertically with some curve
  const batchY = baseY + (batchIndex * batchSeparation);
  const agentIndexInBatch = agent.batchIndex;
  const verticalSpread = (agentIndexInBatch - (totalInBatch - 1) / 2) * (laneHeight * 0.6);
  
  const startY = batchY + verticalSpread;
  const endY = batchY + verticalSpread;
  
  // Create curved path for visual appeal
  const midX = startX + (endX - startX) / 2;
  const curvatureOffset = Math.sin((agentIndexInBatch / totalInBatch) * Math.PI) * 20;
  
  const controlPoint1X = startX + (endX - startX) * config.curve_tension;
  const controlPoint1Y = startY - curvatureOffset;
  
  const controlPoint2X = startX + (endX - startX) * (1 - config.curve_tension);
  const controlPoint2Y = endY - curvatureOffset;
  
  return {
    startPoint: { x: startX, y: startY },
    controlPoint1: { x: controlPoint1X, y: controlPoint1Y },
    controlPoint2: { x: controlPoint2X, y: controlPoint2Y },
    endPoint: { x: endX, y: endY }
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
 * Optimize timeline layout for performance
 */
export function optimizeTimelineLayout(
  agents: TimelineAgent[],
  batches: TimelineBatch[],
  viewportWidth: number
): { agents: TimelineAgent[]; batches: TimelineBatch[] } {
  // For large datasets, we can implement:
  // 1. Virtual scrolling regions
  // 2. Level-of-detail rendering
  // 3. Batch consolidation for distant time ranges
  
  // For now, return as-is but this is where performance optimizations would go
  return { agents, batches };
}