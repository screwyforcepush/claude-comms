<template>
  <div class="sessions-timeline-container w-full h-full bg-gray-800 rounded-lg border border-blue-400/30 overflow-hidden">
    <!-- Sessions Timeline Header -->
    <div class="timeline-header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <div class="flex items-center justify-between">
        <h3 class="text-white font-bold text-lg">Sessions Timeline</h3>
        <div class="flex items-center space-x-4">
          <!-- Enhanced Time Window Controls -->
          <div class="flex items-center space-x-2 text-sm">
            <span class="text-gray-300">Window:</span>
            <button 
              v-for="window in timeWindows"
              :key="window.label"
              @click="setComponentTimeWindow(window.value)"
              class="px-3 py-1 rounded text-xs font-medium transition-all duration-200 transform hover:scale-105"
              :class="currentWindow === window.value 
                ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'"
            >
              {{ window.label }}
            </button>
          </div>
          
          <!-- Session Stats -->
          <div class="flex items-center space-x-3 text-sm">
            <span class="text-green-400">● {{ activeSessions.length }} Active</span>
            <span class="text-gray-400">{{ totalSessions }} Total</span>
            <span class="text-blue-400">{{ totalAgents }} Agents</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sessions Content Area -->
    <div class="sessions-content relative w-full flex-1 overflow-hidden" ref="sessionsContainer">
      <!-- Loading State -->
      <div v-if="isLoading" class="absolute inset-0 bg-gray-800/50 flex items-center justify-center">
        <div class="text-white text-lg flex items-center space-x-3">
          <div class="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading sessions timeline...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="!isLoading && componentError" class="absolute inset-0 bg-gray-800/50 flex items-center justify-center">
        <div class="text-red-400 text-center">
          <div class="text-6xl mb-4">⚠️</div>
          <div class="text-xl mb-2 font-medium">Failed to load sessions</div>
          <div class="text-sm text-red-300 mb-6 max-w-md">{{ componentError }}</div>
          <button 
            @click="refreshSessions" 
            class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium"
          >
            🔄 Retry Loading
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && !componentError && totalSessions === 0" class="absolute inset-0 flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <div class="text-6xl mb-4">🔄</div>
          <div class="text-xl mb-2 font-medium">No sessions in time window</div>
          <div class="text-sm text-gray-500 mb-6">Sessions will appear here when agents start orchestration</div>
          <button 
            @click="refreshSessions" 
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="!isLoading && !componentError && totalSessions > 0" class="text-white p-4">
        <div class="text-center">
          <div class="text-2xl mb-4">✅</div>
          <div class="text-xl mb-2 font-medium">Data Integration Successful!</div>
          <div class="text-sm text-gray-300 mb-4">
            {{ totalSessions }} sessions loaded from multi-session composable
          </div>
          <div class="text-sm text-gray-400">
            Real-time updates: {{ multiSessionData.lastUpdated ? '✅ Connected' : '⏳ Connecting...' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMultiSessionData } from '../composables/useMultiSessionData';
import type { SessionTimelineData, SessionTimeWindow } from '../types/multi-session';
import { DEFAULT_SESSION_TIME_WINDOWS } from '../types/multi-session';

// ============================================================================
// Interface Definitions for Backward Compatibility
// ============================================================================

interface SessionData {
  sessionId: string;
  displayName: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  agents: SessionAgent[];
  messages: SessionMessage[];
  agentCount: number;
}

interface SessionAgent {
  agentId: string;
  name: string;
  type: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  laneIndex: number;
}

interface SessionMessage {
  id: string;
  timestamp: number;
  sender: string;
  content: string;
  recipients?: string[];
}

interface TimeWindow {
  label: string;
  value: number; // Duration in milliseconds
}

// ============================================================================
// Data Transformation Adapter
// ============================================================================

/**
 * Transforms SessionTimelineData (from composable) to SessionData (expected by component)
 */
function transformSessionTimelineToSessionData(sessionTimeline: SessionTimelineData): SessionData {
  return {
    sessionId: sessionTimeline.sessionId,
    displayName: sessionTimeline.displayName,
    startTime: sessionTimeline.startTime,
    endTime: sessionTimeline.endTime,
    status: sessionTimeline.status,
    agents: sessionTimeline.agentPaths.map(agentPath => ({
      agentId: agentPath.agentId,
      name: agentPath.name,
      type: agentPath.type,
      startTime: agentPath.startTime,
      endTime: agentPath.endTime,
      status: agentPath.status,
      laneIndex: agentPath.laneIndex
    })),
    messages: sessionTimeline.messages.map(msg => ({
      id: msg.id,
      timestamp: msg.timestamp,
      sender: msg.sender,
      content: msg.content,
      recipients: msg.recipients
    })),
    agentCount: sessionTimeline.agentPaths.length
  };
}

// ============================================================================
// Component Props
// ============================================================================

const props = withDefaults(defineProps<{
  sessions?: SessionData[]; // Optional override for mock data
  height?: number;
  showControls?: boolean;
  defaultWindow?: number;
  autoRefresh?: boolean;
}>(), {
  sessions: () => [],
  height: 600,
  showControls: true,
  defaultWindow: 3600000, // 1 hour
  autoRefresh: true
});

// ============================================================================
// Multi-Session Data Integration
// ============================================================================

// Initialize the multi-session data composable
const defaultTimeWindow: SessionTimeWindow = {
  start: Date.now() - props.defaultWindow,
  end: Date.now(),
  duration: props.defaultWindow,
  label: '1 hour'
};

const {
  multiSessionData,
  visibleSessions: sessionTimelineData,
  timeWindow: currentTimeWindow,
  isLoading: dataLoading,
  error: dataError,
  setTimeWindow,
  refreshSessions
} = useMultiSessionData(defaultTimeWindow, {
  autoRefresh: props.autoRefresh,
  maxSessions: 50
});

// Transform SessionTimelineData to SessionData for backward compatibility
const transformedSessions = computed((): SessionData[] => {
  if (props.sessions && props.sessions.length > 0) {
    // Use override sessions if provided (for testing/mock)
    return props.sessions;
  }
  
  // Transform real data from composable
  return sessionTimelineData.value.map(transformSessionTimelineToSessionData);
});

// ============================================================================
// Reactive State
// ============================================================================

// Container refs
const sessionsContainer = ref<HTMLDivElement>();

// View state
const currentWindow = ref(props.defaultWindow);

// Loading state - use real loading state from composable
const isLoading = computed(() => dataLoading.value);

// Error state from composable
const componentError = computed(() => dataError.value);

// Configuration
const timeWindows: TimeWindow[] = [
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 }
];

// ============================================================================
// Computed Properties
// ============================================================================

const timeRange = computed(() => {
  const now = Date.now();
  return {
    start: now - currentWindow.value,
    end: now,
    duration: currentWindow.value
  };
});

const visibleSessions = computed((): SessionData[] => {
  const { start, end } = timeRange.value;
  
  return transformedSessions.value.filter(session => {
    // Include session if it overlaps with time window
    const sessionEnd = session.endTime || Date.now();
    return session.startTime <= end && sessionEnd >= start;
  }).sort((a, b) => a.startTime - b.startTime); // Chronological order
});

const totalSessions = computed(() => visibleSessions.value.length);
const activeSessions = computed(() => visibleSessions.value.filter(s => s.status === 'active'));
const totalAgents = computed(() => visibleSessions.value.reduce((sum, session) => sum + session.agentCount, 0));

// ============================================================================
// Time Window Functions
// ============================================================================

const setComponentTimeWindow = (windowSize: number) => {
  const oldWindow = currentWindow.value;
  
  if (oldWindow === windowSize) return;
  
  currentWindow.value = windowSize;
  
  // Update the composable's time window
  const newTimeWindow: SessionTimeWindow = {
    start: Date.now() - windowSize,
    end: Date.now(),
    duration: windowSize,
    label: getWindowLabel(windowSize)
  };
  
  setTimeWindow(newTimeWindow);
};

const getWindowLabel = (windowValue: number): string => {
  const labels: Record<number, string> = {
    [15 * 60 * 1000]: '15 minutes',
    [60 * 60 * 1000]: '1 hour',
    [6 * 60 * 60 * 1000]: '6 hours',
    [24 * 60 * 60 * 1000]: '24 hours'
  };
  return labels[windowValue] || `${Math.round(windowValue / 60000)} minutes`;
};

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  // Initial data load if not using override props
  if (!props.sessions || props.sessions.length === 0) {
    console.log('🚀 InteractiveSessionsTimeline: Loading initial session data');
    await refreshSessions();
  }
});

onUnmounted(() => {
  // Cleanup handled by composable
});

// Watch for data changes
watch(() => transformedSessions.value, (sessions) => {
  if (sessions.length > 0) {
    console.log(`✅ Loaded ${sessions.length} sessions for timeline display`);
  }
});

// Watch for errors
watch(componentError, (error) => {
  if (error) {
    console.error('💥 Multi-session data error:', error);
  }
});
</script>

<style scoped>
.sessions-timeline-container {
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
}

.sessions-content {
  position: relative;
  flex: 1;
  min-height: 400px;
}

.timeline-header {
  flex-shrink: 0;
}
</style>