import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { AgentStatus, SubagentMessage, HookEvent } from '../types';

export interface TimelineWebSocketUpdate {
  type: 'subagent_registered' | 'subagent_message' | 'agent_status_update' | 'hook_event';
  data: any;
  sessionId?: string;
  timestamp: number;
}

export interface TimelineAnimationOptions {
  duration: number;
  easing: string;
  batchUpdates: boolean;
}

export function useTimelineWebSocket(
  wsConnection: WebSocket | null,
  sessionId: string | null,
  options: Partial<TimelineAnimationOptions> = {}
) {
  const agents = ref<AgentStatus[]>([]);
  const messages = ref<SubagentMessage[]>([]);
  const recentlyUpdatedAgents = ref<Set<string>>(new Set());
  const recentlyAddedMessages = ref<Set<string>>(new Set());
  
  // Animation and update batching state
  const isUpdating = ref(false);
  const pendingUpdates = ref<TimelineWebSocketUpdate[]>([]);
  const animationRequestId = ref<number | null>(null);
  
  
  // Configuration
  const config = {
    duration: 300,
    easing: 'ease-out',
    batchUpdates: true,
    highlightDuration: 2000,
    ...options
  };

  // Batch update processing to prevent render thrashing
  const processBatchedUpdates = () => {
    if (pendingUpdates.value.length === 0) return;
    
    isUpdating.value = true;
    
    // Process all pending updates
    const updates = [...pendingUpdates.value];
    pendingUpdates.value = [];
    
    // Group updates by type for efficient processing
    const agentRegistrations = updates.filter(u => u.type === 'subagent_registered');
    const statusUpdates = updates.filter(u => u.type === 'agent_status_update');
    const messageUpdates = updates.filter(u => u.type === 'subagent_message');
    const hookEvents = updates.filter(u => u.type === 'hook_event');
    
    // Process agent registrations
    agentRegistrations.forEach(update => {
      const agentData = update.data;
      if (agentData && (!sessionId || agentData.session_id === sessionId)) {
        const existingIndex = agents.value.findIndex(a => a.id === agentData.id);
        
        if (existingIndex === -1) {
          // New agent - add with animation trigger
          agents.value.push({
            ...agentData,
            status: agentData.status || 'pending'
          });
          
          // Mark as recently updated for animation
          recentlyUpdatedAgents.value.add(agentData.id.toString());
          
          // Remove highlight after duration
          setTimeout(() => {
            recentlyUpdatedAgents.value.delete(agentData.id.toString());
          }, config.highlightDuration);
        }
      }
    });
    
    // Process status updates
    statusUpdates.forEach(update => {
      const statusData = update.data;
      if (statusData) {
        const agentIndex = agents.value.findIndex(a => 
          a.name === statusData.name || a.id.toString() === statusData.agentId
        );
        
        if (agentIndex !== -1) {
          const agent = agents.value[agentIndex];
          const updatedAgent = {
            ...agent,
            status: statusData.status,
            completion_timestamp: statusData.status === 'completed' ? Date.now() : agent.completion_timestamp,
            duration: statusData.duration || agent.duration,
            token_count: statusData.token_count || agent.token_count,
            tool_count: statusData.tool_count || agent.tool_count
          };
          
          agents.value[agentIndex] = updatedAgent;
          
          // Mark as recently updated
          recentlyUpdatedAgents.value.add(agent.id.toString());
          setTimeout(() => {
            recentlyUpdatedAgents.value.delete(agent.id.toString());
          }, config.highlightDuration);
        }
      }
    });
    
    // Process message updates
    messageUpdates.forEach(update => {
      const messageData = update.data;
      if (messageData) {
        // Only show messages from agents in current session
        const sessionAgentNames = agents.value.map(a => a.name);
        
        if (sessionAgentNames.includes(messageData.sender)) {
          const messageId = `${messageData.sender}-${messageData.created_at}`;
          
          // Avoid duplicates
          if (!messages.value.find(m => 
            m.sender === messageData.sender && 
            Math.abs(m.created_at - messageData.created_at) < 1000
          )) {
            messages.value.push({
              sender: messageData.sender,
              message: messageData.message,
              created_at: messageData.created_at,
              notified: messageData.notified || []
            });
            
            // Sort messages by timestamp
            messages.value.sort((a, b) => a.created_at - b.created_at);
            
            // Mark as recently added for animation
            recentlyAddedMessages.value.add(messageId);
            setTimeout(() => {
              recentlyAddedMessages.value.delete(messageId);
            }, config.highlightDuration);
          }
        }
      }
    });
    
    // Hook events are processed but Matrix integration removed
    // All hook event data is still captured and available for other processing
    
    // Use requestAnimationFrame for smooth updates
    nextTick(() => {
      isUpdating.value = false;
    });
  };

  // Debounced update processing
  const scheduleUpdate = () => {
    if (animationRequestId.value) {
      cancelAnimationFrame(animationRequestId.value);
    }
    
    if (config.batchUpdates) {
      animationRequestId.value = requestAnimationFrame(processBatchedUpdates);
    } else {
      processBatchedUpdates();
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Filter for timeline-relevant events
      if (data.type === 'subagent_registered' || 
          data.type === 'subagent_message' || 
          data.type === 'agent_status_update' ||
          data.type === 'hook_event') {
        
        const update: TimelineWebSocketUpdate = {
          type: data.type,
          data: data.data,
          sessionId: data.data?.session_id,
          timestamp: Date.now()
        };
        
        pendingUpdates.value.push(update);
        scheduleUpdate();
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message for timeline:', error);
    }
  };

  // Load initial session data
  const loadSessionData = async () => {
    if (!sessionId) {
      agents.value = [];
      messages.value = [];
      return;
    }

    try {
      // Load agents for session
      const agentsResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      if (agentsResponse.ok) {
        const agentData = await agentsResponse.json();
        agents.value = agentData.map((agent: any) => ({
          ...agent,
          status: agent.status || 'pending'
        }));
      }

      // Load messages for session
      const messagesResponse = await fetch(`http://localhost:4000/subagents/messages`);
      if (messagesResponse.ok) {
        const allMessages = await messagesResponse.json();
        const sessionAgentNames = agents.value.map(a => a.name);
        messages.value = allMessages
          .filter((msg: SubagentMessage) => sessionAgentNames.includes(msg.sender))
          .sort((a: SubagentMessage, b: SubagentMessage) => a.created_at - b.created_at);
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  };

  // Clear highlights for specific agent
  const clearAgentHighlight = (agentId: string) => {
    recentlyUpdatedAgents.value.delete(agentId);
  };

  // Clear highlights for specific message
  const clearMessageHighlight = (messageId: string) => {
    recentlyAddedMessages.value.delete(messageId);
  };

  // Auto-scroll functionality
  const shouldAutoScroll = ref(true);
  const scrollToLatest = () => {
    if (shouldAutoScroll.value) {
      // Trigger custom event for parent component to handle scrolling
      const event = new CustomEvent('timeline-scroll-to-latest', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(event);
    }
  };

  // Watch for new data and trigger auto-scroll
  watch([agents, messages], () => {
    if (agents.value.length > 0 || messages.value.length > 0) {
      setTimeout(scrollToLatest, 100); // Small delay to ensure DOM is updated
    }
  }, { deep: true });

  // Setup WebSocket listener
  watch(() => wsConnection, (newConnection, oldConnection) => {
    if (oldConnection) {
      oldConnection.removeEventListener('message', handleWebSocketMessage);
    }
    
    if (newConnection && newConnection.readyState === WebSocket.OPEN) {
      newConnection.addEventListener('message', handleWebSocketMessage);
    }
  }, { immediate: true });

  // Load data when session changes
  watch(() => sessionId, () => {
    loadSessionData();
  }, { immediate: true });

  // Cleanup on unmount
  onUnmounted(() => {
    if (wsConnection) {
      wsConnection.removeEventListener('message', handleWebSocketMessage);
    }
    
    if (animationRequestId.value) {
      cancelAnimationFrame(animationRequestId.value);
    }
    
    // Clear all highlights
    recentlyUpdatedAgents.value.clear();
    recentlyAddedMessages.value.clear();
  });

  return {
    // Reactive data
    agents,
    messages,
    recentlyUpdatedAgents,
    recentlyAddedMessages,
    isUpdating,
    
    // Actions
    loadSessionData,
    clearAgentHighlight,
    clearMessageHighlight,
    
    // Auto-scroll controls
    shouldAutoScroll,
    scrollToLatest: () => {
      const event = new CustomEvent('timeline-scroll-to-latest', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(event);
    }
  };
}