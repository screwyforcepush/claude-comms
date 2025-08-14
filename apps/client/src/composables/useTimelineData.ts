import { ref, computed, reactive } from 'vue';
import type { 
  TimelineData,
  AgentPath,
  AgentBatch,
  TimelineMessage,
  UserPrompt,
  TimelineConfig,
  CurvePoint,
  TimelineTransformOptions
} from '../types/timeline';
import type { AgentStatus, SubagentMessage, HookEvent } from '../types';
import {
  createTimelineScale,
  detectAgentBatches,
  calculateAgentPath,
  calculateMessagePosition,
  calculateViewportHeight,
  detectMessageType,
  optimizeTimelineLayout,
  DEFAULT_TIMELINE_CONFIG
} from '../utils/timelineCalculations';

/**
 * Main composable for timeline data transformation
 */
export function useTimelineData(options: Partial<TimelineTransformOptions> = {}) {
  // Reactive state
  const agents = ref<AgentStatus[]>([]);
  const messages = ref<SubagentMessage[]>([]);
  const events = ref<HookEvent[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // Configuration
  const config = reactive<TimelineConfig>({
    ...DEFAULT_TIMELINE_CONFIG,
    // Allow config overrides through options
  });
  
  // Transform options
  const transformOptions = reactive<TimelineTransformOptions>({
    viewport_width: options.viewport_width || 1200,
    viewport_height: options.viewport_height || 600,
    show_messages: options.show_messages !== undefined ? options.show_messages : true,
    show_user_prompts: options.show_user_prompts !== undefined ? options.show_user_prompts : true,
    auto_fit: options.auto_fit !== undefined ? options.auto_fit : true,
    compact_mode: options.compact_mode !== undefined ? options.compact_mode : false,
    session_filter: options.session_filter
  });

  /**
   * Transform raw agent data into timeline agents with positioning
   */
  const timelineAgents = computed<AgentPath[]>(() => {
    if (agents.value.length === 0) return [];
    
    // Filter agents by session if specified
    const filteredAgents = transformOptions.session_filter 
      ? agents.value.filter(agent => agent.session_id === transformOptions.session_filter)
      : agents.value;
    
    // Detect batches (using default threshold)
    const batches = detectAgentBatches(filteredAgents, 5000); // 5 second threshold
    
    // Create time scale
    const timeDomain = calculateTimeDomain(filteredAgents, messages.value, events.value);
    const scale = createTimelineScale(
      timeDomain,
      transformOptions.viewport_width,
      { left: 80, right: 40 }
    );
    
    // Transform agents with positioning
    const transformedAgents: AgentPath[] = [];
    
    batches.forEach((batch, batchIndex) => {
      batch.agents.forEach((agent, agentIndex) => {
        // Map server agent data to timeline agent path
        const timelineAgent: AgentPath = {
          agentId: agent.id.toString(),
          name: agent.name,
          type: agent.subagent_type as any, // Cast to AgentType
          startTime: agent.created_at,
          endTime: agent.completion_timestamp || agent.completed_at || null,
          status: agent.status || 'pending',
          curveData: [], // Will be populated below
          laneIndex: agentIndex,
          batchId: batch.batch_id,
          messages: [], // Will be populated later
          sessionId: agent.session_id || '',
          
          // Performance metrics  
          metrics: {
            duration: agent.duration || 0,
            tokenCount: agent.token_count || 0,
            toolUseCount: agent.tool_count || 0,
            messageCount: 0,
            completionRate: agent.status === 'completed' ? 1 : 0
          }
        };
        
        // Calculate sophisticated agent path with orchestrator connection
        const path = calculateAgentPath(
          timelineAgent,
          batchIndex,
          batch.agents.length,
          scale,
          config
        );
        
        // Calculate agent lane Y for the curved path
        const orchestratorY = 200;
        const batchSeparation = 120; // Fixed separation
        const laneHeight = config.agentLaneHeight;
        const batchCenterY = orchestratorY + (batchIndex + 1) * batchSeparation;
        const verticalSpread = (agentIndex - (batch.agents.length - 1) / 2) * (laneHeight * 0.8);
        const agentLaneY = batchCenterY + verticalSpread;
        
        // Convert path to CurvePoint[] format for AgentPath interface
        const curveData: CurvePoint[] = [
          {
            x: path.startPoint.x,
            y: path.startPoint.y,
            type: 'move'
          },
          {
            x: path.startPoint.x + (path.endPoint.x - path.startPoint.x) * 0.3,
            y: agentLaneY,
            controlX: path.controlPoint1.x,
            controlY: path.controlPoint1.y,
            type: 'cubic'
          },
          {
            x: path.startPoint.x + (path.endPoint.x - path.startPoint.x) * 0.7,
            y: agentLaneY,
            type: 'line'
          },
          {
            x: path.endPoint.x,
            y: path.endPoint.y,
            controlX: path.controlPoint2.x,
            controlY: path.controlPoint2.y,
            type: 'cubic'
          }
        ];
        
        timelineAgent.curveData = curveData;
        
        transformedAgents.push(timelineAgent);
      });
    });
    
    return transformedAgents;
  });

  /**
   * Transform batches with positioning data
   */
  const timelineBatches = computed<AgentBatch[]>(() => {
    if (timelineAgents.value.length === 0) return [];
    
    // Group agents by batch
    const batchMap = new Map<string, AgentPath[]>();
    timelineAgents.value.forEach(agent => {
      if (!batchMap.has(agent.batchId)) {
        batchMap.set(agent.batchId, []);
      }
      batchMap.get(agent.batchId)!.push(agent);
    });
    
    // Create timeline batches with chronological numbering
    const batchArray: Array<{agents: AgentPath[], batchId: string, minTime: number, maxTime: number}> = [];
    
    // First collect all batch data with spawn times
    batchMap.forEach((batchAgents, batchId) => {
      const minTime = Math.min(...batchAgents.map(a => a.startTime));
      const maxTime = Math.max(...batchAgents.map(a => a.endTime || a.startTime));
      batchArray.push({ agents: batchAgents, batchId, minTime, maxTime });
    });
    
    // Sort batches chronologically by spawn time and create final batch objects
    const sortedBatches = batchArray
      .sort((a, b) => a.minTime - b.minTime)
      .map((batchData, index) => {
        const { agents: batchAgents, batchId, minTime, maxTime } = batchData;
        
        // Note: Batch positioning could be enhanced in future versions
        
        const batchAgentSpawns = batchAgents.map(agent => ({
          agentId: agent.agentId,
          name: agent.name,
          type: agent.type,
          color: getAgentTypeColor(agent.type),
          description: `${agent.name} - ${agent.type}`,
          task: undefined // Could be populated from agent metadata
        }));
        
        const batch: AgentBatch = {
          id: batchId,
          spawnTimestamp: minTime,
          completionTimestamp: batchAgents.every(a => a.endTime) ? maxTime : undefined,
          agents: batchAgentSpawns,
          batchNumber: index + 1, // Chronological numbering
          orchestratorEventId: `orchestrator_${batchId}`,
          parallelCount: batchAgents.length,
          status: batchAgents.every(a => a.status === 'completed') ? 'completed' : 
                 batchAgents.some(a => a.status === 'in_progress') ? 'running' :
                 batchAgents.some(a => a.status === 'error' || a.status === 'terminated') ? 'error' : 'spawning'
        };
        
        return batch;
      });
    
    return sortedBatches;
  });

  /**
   * Transform messages with positioning along agent paths
   */
  const timelineMessages = computed<TimelineMessage[]>(() => {
    if (!transformOptions.show_messages || messages.value.length === 0) return [];
    
    // Create time scale for messages
    const timeDomain = calculateTimeDomain(agents.value, messages.value, events.value);
    const scale = createTimelineScale(
      timeDomain,
      transformOptions.viewport_width,
      { left: 80, right: 40 }
    );
    
    return messages.value.map((msg, index) => {
      // Find sender agent
      const senderAgent = timelineAgents.value.find(a => a.name === msg.sender);
      if (!senderAgent) {
        // Create placeholder position if sender not found
        return {
          id: `msg_${index}`,
          timestamp: msg.created_at,
          sender: msg.sender,
          content: msg.message,
          sessionId: 'unknown',
          position: {
            x: scale.timeToX(msg.created_at),
            y: 50 // Default position
          },
          type: detectMessageType(msg.message)
        } as TimelineMessage;
      }
      
      // Calculate message position
      const { position } = calculateMessagePosition(
        msg,
        senderAgent,
        undefined, // For now, we don't determine specific recipients
        scale
      );
      
      return {
        id: `msg_${index}`,
        timestamp: msg.created_at,
        sender: msg.sender,
        content: msg.message,
        sessionId: senderAgent.sessionId,
        position,
        type: detectMessageType(msg.message)
      } as TimelineMessage;
    }).filter(msg => msg.position.x >= 0); // Filter out messages outside viewport
  });

  /**
   * Transform user prompts and system events
   */
  const timelineUserPrompts = computed<UserPrompt[]>(() => {
    if (!transformOptions.show_user_prompts || events.value.length === 0) return [];
    
    // Note: Enhanced user prompt timing could be implemented in future versions
    
    // Filter relevant events (user inputs, task creations, etc.)
    const relevantEvents = events.value.filter(event => 
      event.hook_event_type === 'user_input' ||
      event.hook_event_type === 'task_created' ||
      event.hook_event_type === 'session_start'
    );
    
    return relevantEvents.map(event => ({
      id: (event.id || 0).toString(),
      timestamp: event.timestamp || 0,
      content: event.summary || JSON.stringify(event.payload),
      sessionId: event.session_id,
      eventId: event.id || 0,
      responseTime: undefined, // Could be calculated from subsequent agent spawns
      agentCount: undefined // Could be calculated from batch information
    })) as UserPrompt[];
  });

  /**
   * Complete timeline data with scale and viewport
   */
  const timelineData = computed<TimelineData>(() => {
    const timeDomain = calculateTimeDomain(agents.value, messages.value, events.value);
    const scale = createTimelineScale(
      timeDomain,
      transformOptions.viewport_width,
      { left: 80, right: 40 }
    );
    
    // Note: Auto-fit height calculation available for enhanced viewport sizing
    
    // Apply layout optimizations for performance
    const { agents: optimizedAgents, batches: optimizedBatches } = optimizeTimelineLayout(
      timelineAgents.value,
      timelineBatches.value,
      transformOptions.viewport_width
    );
    
    return {
      orchestratorEvents: [], // TODO: Generate from events
      userPrompts: timelineUserPrompts.value,
      agentBatches: optimizedBatches,
      agentPaths: optimizedAgents,
      messages: timelineMessages.value,
      timeRange: {
        start: timeDomain.start,
        end: timeDomain.end,
        duration: timeDomain.end - timeDomain.start,
        pixelsPerMs: scale.timeToX(1) - scale.timeToX(0)
      },
      sessionId: transformOptions.session_filter || 'all',
      lastUpdated: Date.now()
    };
  });

  /**
   * Calculate time domain from all data sources
   */
  function calculateTimeDomain(
    agents: AgentStatus[], 
    messages: SubagentMessage[], 
    events: HookEvent[]
  ): { start: number; end: number } {
    const allTimestamps: number[] = [
      ...agents.map(a => a.created_at),
      ...agents.map(a => a.completion_timestamp).filter(Boolean) as number[],
      ...messages.map(m => m.created_at),
      ...events.map(e => e.timestamp).filter(Boolean) as number[]
    ];
    
    if (allTimestamps.length === 0) {
      const now = Date.now();
      return { start: now - 3600000, end: now }; // Default 1 hour window
    }
    
    const start = Math.min(...allTimestamps);
    const end = Math.max(...allTimestamps);
    
    // Add padding to domain
    const padding = (end - start) * 0.05; // 5% padding
    return {
      start: start - padding,
      end: end + padding + 60000 // Extra minute for ongoing operations
    };
  }

  /**
   * Update data sources
   */
  function setAgents(newAgents: AgentStatus[]) {
    agents.value = newAgents;
  }
  
  function setMessages(newMessages: SubagentMessage[]) {
    messages.value = newMessages;
  }
  
  function setEvents(newEvents: HookEvent[]) {
    events.value = newEvents;
  }

  /**
   * Update transform options
   */
  function updateOptions(newOptions: Partial<TimelineTransformOptions>) {
    Object.assign(transformOptions, newOptions);
  }
  
  function updateConfig(newConfig: Partial<TimelineConfig>) {
    Object.assign(config, newConfig);
  }

  /**
   * Utility functions for external use
   */
  function findAgentAt(x: number, y: number): AgentPath | null {
    return timelineAgents.value.find(agent => {
      const curveData = agent.curveData;
      if (curveData.length === 0) return false;
      
      // Simple bounding box check using curve data
      const xValues = curveData.map(p => p.x);
      const yValues = curveData.map(p => p.y);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      
      return x >= minX && x <= maxX && y >= minY - 10 && y <= maxY + 10;
    }) || null;
  }
  
  function findMessageAt(x: number, y: number): TimelineMessage | null {
    return timelineMessages.value.find(msg => {
      const distance = Math.sqrt(
        Math.pow(x - msg.position.x, 2) + Math.pow(y - msg.position.y, 2)
      );
      return distance <= 15; // 15px hit radius
    }) || null;
  }
  
  function getAgentsByBatch(batchId: string): AgentPath[] {
    return timelineAgents.value.filter(agent => agent.batchId === batchId);
  }
  
  /**
   * Helper function to get agent type colors
   */
  function getAgentTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      'engineer': '#3b82f6',
      'gatekeeper': '#10b981',
      'architect': '#8b5cf6',
      'planner': '#ef4444',
      'business-analyst': '#dc2626',
      'designer': '#ec4899',
      'deep-researcher': '#059669',
      'agent-orchestrator': '#6366f1'
    };
    return colorMap[type] || '#6b7280';
  }

  return {
    // Reactive data
    agents,
    messages,
    events,
    isLoading,
    error,
    
    // Computed timeline data
    timelineData,
    timelineAgents,
    timelineBatches,
    timelineMessages,
    timelineUserPrompts,
    
    // Configuration
    config,
    transformOptions,
    
    // Methods
    setAgents,
    setMessages,
    setEvents,
    updateOptions,
    updateConfig,
    
    // Utilities
    findAgentAt,
    findMessageAt,
    getAgentsByBatch
  };
}