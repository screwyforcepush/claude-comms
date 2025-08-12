import { ref, computed, reactive, watch } from 'vue';
import type { 
  TimelineData,
  TimelineAgent,
  TimelineBatch,
  TimelineMessage,
  TimelineUserPrompt,
  TimelineTransformOptions,
  TimelineConfig
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
export function useTimelineData(options: TimelineTransformOptions = {}) {
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
    viewport_width: 1200,
    viewport_height: 600,
    show_messages: true,
    show_user_prompts: true,
    auto_fit: true,
    compact_mode: false,
    ...options
  });

  /**
   * Transform raw agent data into timeline agents with positioning
   */
  const timelineAgents = computed<TimelineAgent[]>(() => {
    if (agents.value.length === 0) return [];
    
    // Filter agents by session if specified
    const filteredAgents = transformOptions.session_filter 
      ? agents.value.filter(agent => agent.session_id === transformOptions.session_filter)
      : agents.value;
    
    // Detect batches
    const batches = detectAgentBatches(filteredAgents, config.batch_spawn_threshold);
    
    // Create time scale
    const timeDomain = calculateTimeDomain(filteredAgents, messages.value, events.value);
    const scale = createTimelineScale(
      timeDomain,
      transformOptions.viewport_width,
      { left: 80, right: 40 }
    );
    
    // Transform agents with positioning
    const transformedAgents: TimelineAgent[] = [];
    
    batches.forEach((batch, batchIndex) => {
      batch.agents.forEach((agent, agentIndex) => {
        // Map server agent data to timeline agent
        const timelineAgent: TimelineAgent = {
          id: agent.id,
          name: agent.name,
          subagent_type: agent.subagent_type,
          session_id: agent.session_id || '',
          
          // Status and timing
          status: agent.status || 'pending',
          created_at: agent.created_at,
          completed_at: agent.completion_timestamp,
          
          // Performance metrics  
          total_duration_ms: agent.duration,
          total_tokens: agent.token_count,
          total_tool_use_count: agent.tool_count,
          
          // Initialize position (will be calculated)
          position: {
            x: scale.timeToX(agent.created_at),
            y: 0,
            endX: agent.completion_timestamp ? scale.timeToX(agent.completion_timestamp) : undefined
          },
          
          // Initialize path (will be calculated)
          path: {
            startPoint: { x: 0, y: 0 },
            controlPoint1: { x: 0, y: 0 },
            controlPoint2: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 }
          },
          
          // Batch information
          batchId: batch.batch_id,
          batchIndex: agentIndex
        };
        
        // Calculate agent path with proper positioning
        const path = calculateAgentPath(
          timelineAgent,
          batchIndex,
          batch.agents.length,
          scale,
          config
        );
        
        timelineAgent.path = path;
        timelineAgent.position.y = path.startPoint.y;
        
        transformedAgents.push(timelineAgent);
      });
    });
    
    return transformedAgents;
  });

  /**
   * Transform batches with positioning data
   */
  const timelineBatches = computed<TimelineBatch[]>(() => {
    if (timelineAgents.value.length === 0) return [];
    
    // Group agents by batch
    const batchMap = new Map<string, TimelineAgent[]>();
    timelineAgents.value.forEach(agent => {
      if (!batchMap.has(agent.batchId)) {
        batchMap.set(agent.batchId, []);
      }
      batchMap.get(agent.batchId)!.push(agent);
    });
    
    // Create timeline batches
    const batches: TimelineBatch[] = [];
    batchMap.forEach((batchAgents, batchId) => {
      const minTime = Math.min(...batchAgents.map(a => a.created_at));
      const maxTime = Math.max(...batchAgents.map(a => a.completed_at || a.created_at));
      
      // Calculate batch positioning
      const minY = Math.min(...batchAgents.map(a => a.position.y));
      const maxY = Math.max(...batchAgents.map(a => a.position.y));
      const minX = Math.min(...batchAgents.map(a => a.position.x));
      const maxX = Math.max(...batchAgents.map(a => a.position.endX || a.position.x));
      
      const batch: TimelineBatch = {
        id: batchId,
        session_id: batchAgents[0].session_id,
        spawn_time: minTime,
        spawn_window: maxTime - minTime,
        agents: batchAgents,
        
        position: {
          x: minX - 20,
          y: minY - 10,
          width: Math.max(maxX - minX + 40, 100),
          height: maxY - minY + 20
        },
        
        total_agents: batchAgents.length,
        completed_agents: batchAgents.filter(a => a.status === 'completed').length,
        is_complete: batchAgents.every(a => a.status === 'completed'),
        avg_completion_time: batchAgents
          .filter(a => a.completed_at && a.created_at)
          .reduce((sum, a) => sum + (a.completed_at! - a.created_at), 0) / 
          batchAgents.filter(a => a.completed_at).length || undefined
      };
      
      batches.push(batch);
    });
    
    return batches.sort((a, b) => a.spawn_time - b.spawn_time);
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
          sender: msg.sender,
          message: msg.message,
          created_at: msg.created_at,
          position: {
            x: scale.timeToX(msg.created_at),
            y: 50 // Default position
          },
          notified: msg.notified || [],
          message_type: detectMessageType(msg.message)
        } as TimelineMessage;
      }
      
      // Calculate message position
      const { position, connection } = calculateMessagePosition(
        msg,
        senderAgent,
        undefined, // For now, we don't determine specific recipients
        scale
      );
      
      return {
        id: `msg_${index}`,
        sender: msg.sender,
        message: msg.message,
        created_at: msg.created_at,
        position,
        connection,
        notified: msg.notified || [],
        message_type: detectMessageType(msg.message)
      } as TimelineMessage;
    }).filter(msg => msg.position.x >= 0); // Filter out messages outside viewport
  });

  /**
   * Transform user prompts and system events
   */
  const timelineUserPrompts = computed<TimelineUserPrompt[]>(() => {
    if (!transformOptions.show_user_prompts || events.value.length === 0) return [];
    
    // Create time scale
    const timeDomain = calculateTimeDomain(agents.value, messages.value, events.value);
    const scale = createTimelineScale(
      timeDomain,
      transformOptions.viewport_width,
      { left: 80, right: 40 }
    );
    
    // Filter relevant events (user inputs, task creations, etc.)
    const relevantEvents = events.value.filter(event => 
      event.hook_event_type === 'user_input' ||
      event.hook_event_type === 'task_created' ||
      event.hook_event_type === 'session_start'
    );
    
    return relevantEvents.map(event => ({
      id: event.id || 0,
      session_id: event.session_id,
      timestamp: event.timestamp || 0,
      content: event.summary || JSON.stringify(event.payload),
      hook_event_type: event.hook_event_type,
      
      position: {
        x: scale.timeToX(event.timestamp || 0),
        y: 20 // Fixed position at top
      },
      
      type: event.hook_event_type === 'user_input' ? 'user_input' : 
            event.hook_event_type === 'session_start' ? 'session_start' : 'system_event',
      priority: event.hook_event_type === 'user_input' ? 'high' : 'medium'
    })) as TimelineUserPrompt[];
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
    
    // Calculate optimal height
    const calculatedHeight = transformOptions.auto_fit 
      ? calculateViewportHeight(timelineBatches.value, config, { top: 60, bottom: 40 })
      : transformOptions.viewport_height;
    
    // Apply layout optimizations for performance
    const { agents: optimizedAgents, batches: optimizedBatches } = optimizeTimelineLayout(
      timelineAgents.value,
      timelineBatches.value,
      transformOptions.viewport_width
    );
    
    return {
      scale,
      batches: optimizedBatches,
      agents: optimizedAgents,
      messages: timelineMessages.value,
      user_prompts: timelineUserPrompts.value,
      
      viewport: {
        width: transformOptions.viewport_width,
        height: calculatedHeight,
        padding: {
          top: 60,
          right: 40,
          bottom: 40,
          left: 80
        }
      },
      
      session: {
        id: transformOptions.session_filter || 'all',
        start_time: timeDomain.start,
        end_time: timeDomain.end,
        total_agents: agents.value.length,
        is_active: agents.value.some(a => a.status !== 'completed')
      }
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
  function findAgentAt(x: number, y: number): TimelineAgent | null {
    return timelineAgents.value.find(agent => {
      const path = agent.path;
      // Simple bounding box check - could be enhanced with proper curve intersection
      return x >= Math.min(path.startPoint.x, path.endPoint.x) &&
             x <= Math.max(path.startPoint.x, path.endPoint.x) &&
             y >= Math.min(path.startPoint.y, path.endPoint.y) - 10 &&
             y <= Math.max(path.startPoint.y, path.endPoint.y) + 10;
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
  
  function getAgentsByBatch(batchId: string): TimelineAgent[] {
    return timelineAgents.value.filter(agent => agent.batchId === batchId);
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