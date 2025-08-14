<template>
  <div class="sessions-view h-full flex flex-col bg-gray-900">
    <!-- Sessions Header -->
    <div class="sessions-header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <div class="flex items-center justify-between">
        <h3 class="text-white font-bold text-lg">Multi-Session Timeline</h3>
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-2">
            <span v-if="isLoading" class="text-yellow-400 text-xs">● Loading...</span>
            <span v-else-if="error" class="text-red-400 text-xs">● Error</span>
            <span v-else class="text-green-400 text-xs">● Connected</span>
            <span class="text-gray-400 text-xs">{{ visibleSessions.length }} sessions</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Info - Commented out for UI cleanup -->
    <!--
    <div v-if="debug" class="bg-gray-800 p-2 text-xs text-gray-300">
      Debug: Loading={{ isLoading }}, Error={{ error }}, Sessions={{ visibleSessions.length }}, DataSource=REAL_DB
    </div>
    -->

    <!-- Sessions Timeline Content -->
    <div class="sessions-timeline-container flex-1 overflow-hidden">
      <InteractiveSessionsTimeline
        :sessions="visibleSessions"
        :filters="filters"
        :height="600"
        :show-controls="true"
        :auto-refresh="true"
        @agent-selected="handleAgentSelected"
        @session-selected="handleSessionSelected"
        @message-selected="handleMessageSelected"
      />
    </div>

    <!-- Agent Detail Pane (matching Agents tab pattern) -->
    <AgentDetailPane
      :visible="showAgentDetails && activePane === 'agent'"
      :selected-agent="selectedAgent"
      :agents="allAgents"
      :messages="allMessages"
      :session-id="selectedSessionId"
      @close="handleAgentDetailClose"
      @agent-selected="handleAgentDetailSelected"
      @message-selected="handleMessageSelectedFromAgent"
      @highlight-timeline="handleHighlightAgentOnTimeline"
    />

    <!-- Message Detail Pane (matching SubagentComms.vue pattern) -->
    <MessageDetailPane
      :visible="showMessageDetails && activePane === 'message'"
      :selected-message="selectedMessage"
      :agents="allAgents"
      :session-id="selectedSessionId"
      @close="handleMessageDetailClose"
      @agent-selected="handleAgentSelectedFromMessage"
      @highlight-timeline="handleHighlightMessageOnTimeline"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue';
import InteractiveSessionsTimeline from './InteractiveSessionsTimeline.vue';
import AgentDetailPane from './AgentDetailPane.vue';
import MessageDetailPane from './MessageDetailPane.vue';
import { SessionDataAdapter, type SessionData, type SessionAgent, type SessionMessage } from '../utils/session-data-adapter';
import { sessionDataService } from '../services/sessionDataService';
import type { AgentStatus, SubagentMessage } from '../types';

// Component Props
const props = defineProps<{
  wsConnection?: any;
  filters?: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
}>();

// Real data state management (following SubagentComms.vue pattern)
const isLoading = ref(true);
const error = ref<string | null>(null);
const debug = ref(true);
const sessionsData = ref<SessionData[]>([]);
let refreshInterval: number | null = null;

// Agent detail pane state (matching SubagentComms.vue pattern)
const selectedAgent = ref<AgentStatus | null>(null);
const selectedSessionId = ref<string>('');
const showAgentDetails = ref(false);

// Message detail pane state (matching SubagentComms.vue pattern)
const selectedMessage = ref<SubagentMessage | null>(null);
const showMessageDetails = ref(false);

// Pane state management - ensure only one pane is open at a time
type ActivePane = 'none' | 'agent' | 'message';
const activePane = ref<ActivePane>('none');

// Use real sessions data
const visibleSessions = computed(() => {
  if (error.value || sessionsData.value.length === 0) {
    // Fallback to empty array instead of mock data
    return [];
  }
  return sessionsData.value;
});

// Computed properties for agent detail pane (matching SubagentComms.vue pattern)
const allAgents = computed((): AgentStatus[] => {
  // Store fetched full agent data
  const agents: AgentStatus[] = [];
  
  // We'll fetch full data when agents are selected individually
  // For now, provide basic data for the timeline
  sessionsData.value.forEach(session => {
    session.agents.forEach(agent => {
      agents.push({
        id: parseInt(agent.agentId) || 0,
        name: agent.name,
        subagent_type: agent.type,
        status: agent.status,
        created_at: agent.startTime,
        completion_timestamp: agent.endTime,
        total_duration_ms: agent.endTime ? agent.endTime - agent.startTime : undefined,
        session_id: session.sessionId,
        // These will be populated when agent is selected
        total_tokens: undefined,
        input_tokens: undefined,
        output_tokens: undefined,
        total_tool_use_count: undefined,
        cache_creation_input_tokens: undefined,
        cache_read_input_tokens: undefined,
        initial_prompt: undefined,
        final_response: undefined
      });
    });
  });
  return agents;
});

const allMessages = computed((): SubagentMessage[] => {
  // Convert SessionMessages to SubagentMessage format for AgentDetailPane
  const messages: SubagentMessage[] = [];
  sessionsData.value.forEach(session => {
    session.messages.forEach(message => {
      messages.push({
        id: `${message.timestamp}-${message.sender}`,
        sender: message.sender,
        message: message.content,
        created_at: message.timestamp,
        notified: message.notified || []
      });
    });
  });
  return messages;
});

// Load real session data (same pattern as SubagentComms.vue)
const loadSessionsData = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    
    console.log('🔍 DataDetective: Fetching real session data...');
    const data = await sessionDataService.fetchSessionsData(10);
    sessionsData.value = data;
    
    console.log(`✅ DataDetective: Loaded ${data.length} sessions with real data`);
  } catch (err) {
    console.error('❌ DataDetective: Failed to load session data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load sessions';
    sessionsData.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Listen to WebSocket for real-time updates (same pattern as SubagentComms.vue)
watchEffect(() => {
  if (props.wsConnection) {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Refresh data on relevant events (same as SubagentComms.vue line 411-416)
        if (data.type === 'subagent_registered' || 
            data.type === 'subagent_message' || 
            data.type === 'agent_status_update' ||
            data.type === 'session_event' ||
            data.type === 'agent_registered' ||
            data.type === 'agent_message') {
          console.log('📡 DataDetective: WebSocket update received, refreshing sessions data');
          loadSessionsData();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    props.wsConnection.addEventListener('message', handleMessage);
    
    return () => {
      props.wsConnection.removeEventListener('message', handleMessage);
    };
  }
});

// Initial load and auto-refresh (same pattern as SubagentComms.vue)
onMounted(async () => {
  console.log('🚀 DataDetective: SessionsView mounted - loading REAL data');
  await loadSessionsData();
  
  // Auto-refresh every 5 seconds (same interval as SubagentComms.vue line 433-437)
  refreshInterval = window.setInterval(() => {
    loadSessionsData();
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Agent detail pane event handlers (matching SubagentComms.vue pattern)
const handleAgentSelected = async (agent: SessionAgent, session: SessionData) => {
  console.log('🤖 AgentAlex: Agent selected from timeline:', agent.name, 'in session:', session.sessionId);
  
  // Fetch the full agent data from the server to get performance metrics and prompt/response
  try {
    const agents = await sessionDataService.fetchSessionAgents(session.sessionId);
    const fullAgentData = agents.find(a => a.name === agent.name);
    
    if (fullAgentData) {
      selectedAgent.value = fullAgentData;
    } else {
      // Fallback to basic conversion if full data not found
      selectedAgent.value = {
        id: parseInt(agent.agentId) || 0,
        name: agent.name,
        subagent_type: agent.type,
        status: agent.status,
        created_at: agent.startTime,
        completion_timestamp: agent.endTime,
        total_duration_ms: agent.endTime ? agent.endTime - agent.startTime : undefined,
        // Add placeholder values for missing fields
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tool_use_count: 0
      };
    }
  } catch (error) {
    console.error('Failed to fetch full agent data:', error);
    // Fallback to basic conversion on error
    selectedAgent.value = {
      id: parseInt(agent.agentId) || 0,
      name: agent.name,
      subagent_type: agent.type,
      status: agent.status,
      created_at: agent.startTime,
      completion_timestamp: agent.endTime,
      total_duration_ms: agent.endTime ? agent.endTime - agent.startTime : undefined,
      // Add placeholder values for missing fields
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tool_use_count: 0
    };
  }
  
  selectedSessionId.value = session.sessionId;
  // Close message pane if open and show agent pane
  closeAllPanes();
  showAgentDetails.value = true;
  activePane.value = 'agent';
};

const handleSessionSelected = (session: SessionData) => {
  console.log('📊 AgentAlex: Session selected:', session.sessionId);
  selectedSessionId.value = session.sessionId;
  // Don't auto-open agent details for session selection
};

const handleMessageSelected = (message: SessionMessage, session: SessionData) => {
  console.log('💬 AgentAlex: Message selected from:', message.sender);
  selectedSessionId.value = session.sessionId;
  
  // Convert SessionMessage to SubagentMessage format
  selectedMessage.value = {
    id: `${message.timestamp}-${message.sender}`,
    sender: message.sender,
    message: message.content,
    created_at: message.timestamp,
    notified: message.notified || []
  };
  
  // Close agent pane if open and show message pane
  closeAllPanes();
  showMessageDetails.value = true;
  activePane.value = 'message';
};

// Pane management helpers
const closeAllPanes = () => {
  showAgentDetails.value = false;
  showMessageDetails.value = false;
  activePane.value = 'none';
};

const handleAgentDetailClose = () => {
  console.log('✨ AgentAlex: Closing agent details');
  showAgentDetails.value = false;
  selectedAgent.value = null;
  activePane.value = 'none';
};

const handleAgentDetailSelected = (agent: AgentStatus) => {
  console.log('🔄 AgentAlex: Agent selected from detail pane:', agent.name);
  selectedAgent.value = agent;
};

const handleMessageSelectedFromAgent = (message: SubagentMessage) => {
  console.log('💬 AgentAlex: Message selected from agent details:', message.sender);
  selectedMessage.value = message;
  // Switch from agent pane to message pane
  closeAllPanes();
  showMessageDetails.value = true;
  activePane.value = 'message';
};

const handleHighlightAgentOnTimeline = (agentId: number) => {
  console.log('🎯 AgentAlex: Highlighting agent on timeline:', agentId);
  // The timeline already handles highlighting selected agents
  // This could trigger additional visual effects if needed
};

// Message detail pane event handlers
const handleMessageDetailClose = () => {
  console.log('✨ AgentAlex: Closing message details');
  showMessageDetails.value = false;
  selectedMessage.value = null;
  activePane.value = 'none';
};

const handleAgentSelectedFromMessage = (agent: AgentStatus) => {
  console.log('🤖 AgentAlex: Agent selected from message detail:', agent.name);
  selectedAgent.value = agent;
  // Switch from message pane to agent pane
  closeAllPanes();
  showAgentDetails.value = true;
  activePane.value = 'agent';
};

const handleHighlightMessageOnTimeline = (messageId: string) => {
  console.log('🎯 AgentAlex: Highlight message on timeline:', messageId);
  // Future: Scroll to and highlight message on timeline
};
</script>

<style scoped>
.sessions-view {
  font-family: system-ui, -apple-system, sans-serif;
}

.sessions-header {
  flex-shrink: 0;
}

.sessions-timeline-container {
  position: relative;
}
</style>