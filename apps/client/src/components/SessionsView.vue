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

    <!-- Debug Info -->
    <div v-if="debug" class="bg-gray-800 p-2 text-xs text-gray-300">
      Debug: Loading={{ isLoading }}, Error={{ error }}, Sessions={{ finalSessions.length }}, Mock={{ useMockData }}
    </div>

    <!-- Sessions Timeline Content -->
    <div class="sessions-timeline-container flex-1 overflow-hidden">
      <InteractiveSessionsTimeline
        :sessions="finalSessions"
        :filters="filters"
        :height="600"
        :show-controls="true"
        :auto-refresh="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import InteractiveSessionsTimeline from './InteractiveSessionsTimeline.vue';
import { SessionDataAdapter } from '../utils/session-data-adapter';

// Component Props
const props = defineProps<{
  wsConnection?: any;
  filters?: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
}>();

// Simplified - use mock data for emergency fix
const isLoading = ref(false);
const error = ref<string | null>(null);
const debug = ref(true);
const useMockData = ref(true);

// Use mock sessions directly for now
const visibleSessions = computed(() => {
  return SessionDataAdapter.createMockSessionData(5);
});

// Initial load
onMounted(async () => {
  console.log('🚀 RecoveryRaven: SessionsView mounted with mock data');
});
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