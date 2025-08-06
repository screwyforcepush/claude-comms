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
          <option v-for="session in sessions" :key="session" :value="session">
            {{ session }}
          </option>
        </select>
        <button 
          @click="refreshSessions"
          class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <!-- Content Area -->
      <div v-if="selectedSessionId" class="flex-grow flex space-x-4">
        <!-- Subagents List -->
        <div class="w-1/3 bg-gray-700 rounded-lg p-4">
          <h3 class="text-white font-bold mb-3">Active Subagents</h3>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div 
              v-for="agent in subagents" 
              :key="agent.id"
              class="bg-gray-800 p-3 rounded-lg"
            >
              <div class="text-white font-semibold">{{ agent.name }}</div>
              <div class="text-gray-400 text-sm">Type: {{ agent.subagent_type }}</div>
              <div class="text-gray-500 text-xs">
                Registered: {{ new Date(agent.created_at).toLocaleTimeString() }}
              </div>
            </div>
            <div v-if="subagents.length === 0" class="text-gray-400 italic">
              No subagents registered yet
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

      <!-- Instructions when no session selected -->
      <div v-else class="flex-grow flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <p class="text-lg mb-2">Select a session to view subagent communication</p>
          <p class="text-sm">Subagents are registered when you use Task tool with nickname:description format</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect } from 'vue';

interface Subagent {
  id: number;
  name: string;
  subagent_type: string;
  created_at: number;
}

interface SubagentMessage {
  sender: string;
  message: any;
  created_at: number;
  notified?: string[];
}

const props = defineProps<{
  wsConnection?: any;
}>();

const sessions = ref<string[]>([]);
const selectedSessionId = ref('');
const subagents = ref<Subagent[]>([]);
const messages = ref<SubagentMessage[]>([]);
let refreshInterval: number | null = null;

const refreshSessions = async () => {
  try {
    const response = await fetch('http://localhost:4000/events/filter-options');
    const data = await response.json();
    sessions.value = data.session_ids || [];
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

// Listen to WebSocket for real-time updates
watchEffect(() => {
  if (props.wsConnection) {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'subagent_registered' || data.type === 'subagent_message') {
          // Refresh data if it's for the current session
          if (selectedSessionId.value && data.data?.session_id === selectedSessionId.value) {
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