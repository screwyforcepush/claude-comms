<template>
  <div class="flex-grow overflow-hidden p-4 bg-gray-800">
    <div class="h-full flex flex-col space-y-4">
      <!-- Session Selector -->
      <div class="flex items-center space-x-4 bg-gray-700 p-3 rounded-lg">
        <label class="text-white font-semibold">Session:</label>
        <select 
          v-model="selectedSessionId" 
          @change="loadSessionData"
          class="px-3 py-1.5 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select a session...</option>
          <option v-for="session in sessions" :key="session.session_id" :value="session.session_id">
            {{ session.session_id }} ({{ session.agent_count }} agents)
          </option>
        </select>
        <button 
          @click="refreshSessions"
          class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <!-- View Selector -->
      <div v-if="selectedSessionId" class="bg-gray-700 mb-4 rounded-lg">
        <div class="flex border-b border-gray-600">
          <button
            @click="activeView = 'timeline'"
            :class="[
              'px-4 py-2 font-semibold transition-all',
              activeView === 'timeline' 
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white hover:bg-gray-600'
            ]"
          >
            📈 Timeline View
          </button>
          <button
            @click="activeView = 'list'"
            :class="[
              'px-4 py-2 font-semibold transition-all',
              activeView === 'list' 
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white hover:bg-gray-600'
            ]"
          >
            📋 List View
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div v-if="selectedSessionId" class="flex-grow">
        
        <!-- Timeline View -->
        <div v-if="activeView === 'timeline'" class="h-full">
          
          <InteractiveAgentTimeline 
            :session-id="selectedSessionId"
            :agents="subagents"
            :messages="messages"
            :height="600"
            :show-controls="true"
            :auto-zoom="true"
            :follow-latest="true"
            @agent-selected="handleAgentSelected"
            @message-clicked="handleMessageClicked"
            @batch-selected="handleBatchSelected"
            @prompt-clicked="handlePromptClicked"
            @agent-path-clicked="handleAgentPathClicked"
            @highlight-message="handleHighlightMessage"
            @selection-changed="handleSelectionChanged"
          />
        </div>

        <!-- List View (Original Layout) -->
        <div v-else class="flex space-x-4 h-full">
          <!-- Agents List -->
          <div class="w-1/3 bg-gray-700 rounded-lg p-4">
            <h3 class="text-white font-bold mb-3">Agents</h3>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              <div 
                v-for="agent in subagents" 
                :key="agent.id"
                class="bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                @click="handleAgentSelected(agent)"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="text-white font-semibold">{{ agent.name }}</div>
                  <span 
                    :class="[
                      'px-2 py-1 rounded-full text-xs font-medium',
                      getStatusColor(agent.status)
                    ]"
                  >
                    {{ agent.status || 'pending' }}
                  </span>
                </div>
                
                <div class="text-gray-400 text-sm mb-2">Type: {{ agent.subagent_type }}</div>
                
                <div class="flex flex-wrap gap-2 mb-2">
                  <span v-if="agent.duration" class="text-gray-500 text-xs">
                    {{ formatDuration(agent.duration) }}
                  </span>
                  <span v-if="agent.token_count" class="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    {{ agent.token_count }} tokens
                  </span>
                  <span v-if="agent.tool_count" class="bg-green-600 text-white text-xs px-2 py-1 rounded">
                    {{ agent.tool_count }} tools
                  </span>
                </div>
                
                <div class="text-gray-500 text-xs">
                  Started: {{ new Date(agent.created_at).toLocaleTimeString() }}
                </div>
                <div v-if="agent.completion_timestamp" class="text-gray-500 text-xs">
                  Completed: {{ new Date(agent.completion_timestamp).toLocaleTimeString() }}
                </div>
              </div>
              <div v-if="subagents.length === 0" class="text-gray-400 italic">
                No agents registered yet
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div class="flex-grow bg-gray-700 rounded-lg p-4">
            <h3 class="text-white font-bold mb-3">Messages</h3>
            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div 
                v-for="(msg, idx) in messages" 
                :key="idx"
                class="bg-gray-800 p-3 rounded-lg"
              >
                <div class="flex justify-between items-start mb-2">
                  <span class="text-blue-400 font-semibold">{{ msg.sender }}</span>
                  <span class="text-gray-500 text-xs">
                    {{ new Date(msg.created_at).toLocaleTimeString() }}
                  </span>
                </div>
                <div class="text-white">
                  <pre class="whitespace-pre-wrap text-sm">{{ formatMessage(msg.message) }}</pre>
                </div>
                <div v-if="msg.notified && msg.notified.length > 0" class="mt-2">
                  <span class="text-gray-500 text-xs">
                    Read by: {{ msg.notified.join(', ') }}
                  </span>
                </div>
              </div>
              <div v-if="messages.length === 0" class="text-gray-400 italic">
                No messages yet
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions when no session selected -->
      <div v-else class="flex-grow flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <p class="text-lg mb-2">Select a session to view agent status and communication</p>
          <p class="text-sm">Agents are registered when you use Task tool with nickname:description format</p>
        </div>
      </div>
    </div>

    <!-- Agent Detail Pane -->
    <AgentDetailPane
      :visible="showAgentDetails && activePane === 'agent'"
      :selected-agent="selectedAgent"
      :agents="subagents"
      :messages="messages"
      :session-id="selectedSessionId"
      @close="handleAgentDetailClose"
      @agent-selected="handleAgentDetailSelected"
      @message-selected="handleMessageSelectedFromAgent"
      @highlight-timeline="handleHighlightAgentOnTimeline"
    />

    <!-- Message Detail Pane -->
    <MessageDetailPane
      :visible="showMessageDetails && activePane === 'message'"
      :selected-message="selectedMessage"
      :agents="subagents"
      :session-id="selectedSessionId"
      @close="handleMessageDetailClose"
      @agent-selected="handleAgentSelectedFromMessage"
      @highlight-timeline="handleHighlightMessageOnTimeline"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect } from 'vue';
import type { Session, AgentStatus, SubagentMessage } from '../types';
import InteractiveAgentTimeline from './InteractiveAgentTimeline.vue';
import AgentDetailPane from './AgentDetailPane.vue';
import MessageDetailPane from './MessageDetailPane.vue';

const props = defineProps<{
  wsConnection?: any;
}>();

const sessions = ref<Session[]>([]);
const selectedSessionId = ref('');
const subagents = ref<AgentStatus[]>([]);
const messages = ref<SubagentMessage[]>([]);
const activeView = ref<'timeline' | 'list'>('timeline');
const selectedAgent = ref<AgentStatus | null>(null);
const selectedMessage = ref<SubagentMessage | null>(null);
const showAgentDetails = ref(false);
const showMessageDetails = ref(false);
let refreshInterval: number | null = null;

// Pane state management - ensure only one pane is open at a time
type ActivePane = 'none' | 'agent' | 'message';
const activePane = ref<ActivePane>('none');

const refreshSessions = async () => {
  try {
    const response = await fetch('http://localhost:4000/subagents/sessions');
    const data = await response.json();
    // Sort sessions by created_at DESC and store as Session objects
    sessions.value = data.sort((a: Session, b: Session) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Auto-select the most recent session if none selected
    if (!selectedSessionId.value && sessions.value.length > 0) {
      selectedSessionId.value = sessions.value[0].session_id;
      loadSessionData();
    }
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
  }
};

const loadSessionData = async () => {
  if (!selectedSessionId.value) {
    subagents.value = [];
    messages.value = [];
    return;
  }

  try {
    // Load subagents
    const agentsResponse = await fetch(`http://localhost:4000/subagents/${selectedSessionId.value}`);
    if (agentsResponse.ok) {
      subagents.value = await agentsResponse.json();
    }

    // Load all messages (not filtered by session since messages don't have session_id)
    const messagesResponse = await fetch(`http://localhost:4000/subagents/messages`);
    if (messagesResponse.ok) {
      const allMessages = await messagesResponse.json();
      // Filter messages to show only those from subagents in this session
      const sessionAgentNames = subagents.value.map(a => a.name);
      messages.value = allMessages.filter((msg: SubagentMessage) => 
        sessionAgentNames.includes(msg.sender)
      );
    }
  } catch (error) {
    console.error('Failed to load session data:', error);
  }
};

const formatMessage = (message: any): string => {
  if (typeof message === 'string') {
    return message;
  }
  return JSON.stringify(message, null, 2);
};

const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-600 text-white';
    case 'in_progress':
      return 'bg-blue-600 text-white';
    case 'pending':
    default:
      return 'bg-gray-600 text-white';
  }
};

const formatDuration = (duration: number): string => {
  if (duration < 1000) {
    return `${duration}ms`;
  }
  return `${(duration / 1000).toFixed(1)}s`;
};

// Pane management helpers
const closeAllPanes = () => {
  showAgentDetails.value = false;
  showMessageDetails.value = false;
  activePane.value = 'none';
};

// Timeline event handlers
const handleAgentSelected = (agent: AgentStatus) => {
  console.log('Agent selected:', agent);
  selectedAgent.value = agent;
  // Close message pane if open and show agent pane
  closeAllPanes();
  showAgentDetails.value = true;
  activePane.value = 'agent';
};

const handleMessageClicked = (message: SubagentMessage) => {
  console.log('Message clicked:', message);
  selectedMessage.value = message;
  // Close agent pane if open and show message pane
  closeAllPanes();
  showMessageDetails.value = true;
  activePane.value = 'message';
};

const handleBatchSelected = (batch: any) => {
  console.log('Batch selected:', batch);
  // Future: Highlight batch in timeline, show batch details
};

const handlePromptClicked = (prompt: any) => {
  console.log('Prompt clicked:', prompt);
  // Future: Show prompt details and resulting agents
};

const handleAgentPathClicked = (agent: AgentStatus) => {
  console.log('Agent path clicked:', agent);
  // Future: Show agent execution path and related messages
};

const handleHighlightMessage = (messageId: string) => {
  console.log('Highlight message:', messageId);
  // Message highlight animation triggered in timeline
};

const handleSelectionChanged = (selection: { agent?: AgentStatus; message?: SubagentMessage }) => {
  console.log('Selection changed:', selection);
  if (selection.agent) {
    selectedAgent.value = selection.agent;
    // Close message pane if open and show agent pane
    closeAllPanes();
    showAgentDetails.value = true;
    activePane.value = 'agent';
  } else if (selection.message) {
    selectedMessage.value = selection.message;
    // Close agent pane if open and show message pane
    closeAllPanes();
    showMessageDetails.value = true;
    activePane.value = 'message';
  }
};

// Agent detail pane event handlers
const handleAgentDetailClose = () => {
  showAgentDetails.value = false;
  selectedAgent.value = null;
  activePane.value = 'none';
};

const handleAgentDetailSelected = (agent: AgentStatus) => {
  selectedAgent.value = agent;
  // Keep the pane open with the new agent - no need to close/reopen
};

const handleMessageSelectedFromAgent = (message: SubagentMessage) => {
  console.log('Message selected from agent detail:', message);
  selectedMessage.value = message;
  // Switch from agent pane to message pane
  closeAllPanes();
  showMessageDetails.value = true;
  activePane.value = 'message';
};

// Message detail pane event handlers
const handleMessageDetailClose = () => {
  showMessageDetails.value = false;
  selectedMessage.value = null;
  activePane.value = 'none';
};

const handleAgentSelectedFromMessage = (agent: AgentStatus) => {
  console.log('Agent selected from message detail:', agent);
  selectedAgent.value = agent;
  // Switch from message pane to agent pane
  closeAllPanes();
  showAgentDetails.value = true;
  activePane.value = 'agent';
};

const handleHighlightMessageOnTimeline = (messageId: string) => {
  console.log('Highlight message on timeline:', messageId);
  // Future: Scroll to and highlight message on timeline
};

const handleHighlightAgentOnTimeline = (agentId: number) => {
  console.log('Highlight agent on timeline:', agentId);
  // Future: Scroll to and highlight agent on timeline
};

// Listen to WebSocket for real-time updates
watchEffect(() => {
  if (props.wsConnection) {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'subagent_registered' || data.type === 'subagent_message' || data.type === 'agent_status_update') {
          // Refresh data if it's for the current session or if it's an agent status update
          if (selectedSessionId.value && (data.data?.session_id === selectedSessionId.value || data.type === 'agent_status_update')) {
            loadSessionData();
          }
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

onMounted(() => {
  refreshSessions();
  // Auto-refresh every 5 seconds
  refreshInterval = window.setInterval(() => {
    if (selectedSessionId.value) {
      loadSessionData();
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>