<template>
  <teleport to="body">
    <!-- Overlay backdrop -->
    <div
      v-if="visible"
      class="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
      :class="{ 'opacity-100': panelVisible, 'opacity-0': !panelVisible }"
      @click="closePanelHandler"
    />
    
    <!-- Slide-in panel from right -->
    <div
      v-if="visible"
      class="fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-600 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
      :class="{ 'translate-x-0': panelVisible, 'translate-x-full': !panelVisible }"
    >
      <!-- Panel Header -->
      <div class="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4 border-b border-gray-600">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-bold text-lg flex items-center space-x-2">
            <span v-if="eventData?.eventType === 'UserPromptSubmit'" class="text-blue-400">💬</span>
            <span v-else-if="eventData?.eventType === 'Notification'" class="text-yellow-400">🔔</span>
            <span>{{ getEventTitle() }}</span>
          </h3>
          <button
            @click="closePanelHandler"
            class="text-gray-400 hover:text-white transition-colors duration-200 rounded-lg p-2 hover:bg-gray-700"
            title="Close panel (Esc)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="text-gray-400 text-sm mt-1">
          {{ formatTimestamp(eventData?.timestamp) }}
        </div>
      </div>

      <!-- Panel Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="eventData" class="space-y-6">
          
          <!-- Event Metadata -->
          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 class="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Event Details</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-400">Type:</span>
                <span class="text-white font-medium">{{ eventData.eventType }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Session:</span>
                <span class="text-white font-mono text-xs">{{ eventData.sessionId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Event ID:</span>
                <span class="text-white font-mono text-xs">{{ eventData.eventId }}</span>
              </div>
              <div v-if="eventData.metadata?.wordCount" class="flex justify-between">
                <span class="text-gray-400">Word Count:</span>
                <span class="text-white">{{ eventData.metadata.wordCount }}</span>
              </div>
              <div v-if="eventData.metadata?.agentCount" class="flex justify-between">
                <span class="text-gray-400">Agent Response:</span>
                <span class="text-white">{{ eventData.metadata.agentCount }} agents spawned</span>
              </div>
            </div>
          </div>

          <!-- Main Content Display -->
          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 class="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              {{ eventData.eventType === 'UserPromptSubmit' ? 'Prompt Content' : 'Notification Message' }}
            </h4>
            
            <!-- UserPromptSubmit Content -->
            <div v-if="eventData.eventType === 'UserPromptSubmit'" class="space-y-4">
              <div class="bg-gray-900 rounded-lg p-4 border border-gray-600">
                <pre class="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap font-mono">{{ getPromptContent() }}</pre>
              </div>
              
              <!-- Prompt Analysis -->
              <div v-if="eventData.metadata?.complexity" class="text-xs text-gray-400 space-y-1">
                <div class="flex items-center space-x-2">
                  <span>Complexity:</span>
                  <span 
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :class="getComplexityClass(eventData.metadata.complexity)"
                  >
                    {{ eventData.metadata.complexity }}
                  </span>
                </div>
                <div v-if="eventData.metadata.responseTime" class="text-gray-500">
                  First response in {{ formatDuration(eventData.metadata.responseTime) }}
                </div>
              </div>
            </div>

            <!-- Notification Content -->
            <div v-if="eventData.eventType === 'Notification'" class="space-y-4">
              <div class="bg-gray-900 rounded-lg p-4 border border-gray-600">
                <div class="text-gray-100 text-sm leading-relaxed">{{ getNotificationContent() }}</div>
              </div>
              
              <!-- Notification Metadata -->
              <div v-if="eventData.metadata?.severity" class="text-xs text-gray-400 space-y-1">
                <div class="flex items-center space-x-2">
                  <span>Severity:</span>
                  <span 
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :class="getSeverityClass(eventData.metadata.severity)"
                  >
                    {{ eventData.metadata.severity }}
                  </span>
                </div>
                <div v-if="eventData.metadata.source" class="text-gray-500">
                  Source: {{ eventData.metadata.source }}
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Event Data (Collapsible) -->
          <div class="bg-gray-800 rounded-lg border border-gray-700">
            <button
              @click="showRawData = !showRawData"
              class="w-full px-4 py-3 text-left flex items-center justify-between text-white hover:bg-gray-750 transition-colors duration-200"
            >
              <h4 class="font-semibold text-sm uppercase tracking-wide">Raw Event Data</h4>
              <svg 
                class="w-4 h-4 transition-transform duration-200"
                :class="{ 'rotate-180': showRawData }"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div 
              v-if="showRawData"
              class="px-4 pb-4 border-t border-gray-700"
            >
              <pre class="text-xs text-gray-400 bg-gray-900 rounded p-3 mt-3 overflow-x-auto font-mono">{{ JSON.stringify(eventData.rawEvent, null, 2) }}</pre>
            </div>
          </div>

          <!-- Related Context (if available) -->
          <div v-if="relatedEvents.length > 0" class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 class="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Related Events</h4>
            <div class="space-y-2">
              <div 
                v-for="related in relatedEvents" 
                :key="related.eventId"
                class="flex items-center justify-between p-2 bg-gray-900 rounded text-sm cursor-pointer hover:bg-gray-750 transition-colors duration-200"
                @click="$emit('event-selected', related)"
              >
                <div class="flex items-center space-x-2">
                  <span v-if="related.eventType === 'UserPromptSubmit'" class="text-blue-400">💬</span>
                  <span v-else class="text-yellow-400">🔔</span>
                  <span class="text-gray-300">{{ related.eventType }}</span>
                </div>
                <span class="text-gray-500 text-xs">{{ formatTimestamp(related.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex items-center justify-center h-64 text-gray-400">
          <div class="text-center">
            <div class="text-4xl mb-4">📄</div>
            <div class="text-lg mb-2">No Event Selected</div>
            <div class="text-sm">Click on an event indicator to view details</div>
          </div>
        </div>
      </div>

      <!-- Panel Footer -->
      <div class="bg-gray-800 px-6 py-3 border-t border-gray-600">
        <div class="flex items-center justify-between text-sm">
          <div class="text-gray-400">
            {{ eventData ? 'Event details' : 'Select an event to view details' }}
          </div>
          <div class="text-gray-500">
            Press <kbd class="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { EventIndicator } from '../types/event-indicators';

// ============================================================================
// Component Props & Events
// ============================================================================

const props = defineProps<{
  visible: boolean;
  eventData?: EventIndicator | null;
  relatedEvents?: EventIndicator[];
}>();

const emit = defineEmits<{
  'close': [];
  'event-selected': [event: EventIndicator];
}>();

// ============================================================================
// Reactive State
// ============================================================================

const panelVisible = ref(false);
const showRawData = ref(false);
const relatedEvents = computed(() => props.relatedEvents || []);

// ============================================================================
// Panel Animation Management
// ============================================================================

watch(() => props.visible, async (newVisible) => {
  if (newVisible) {
    // Show panel with delay for slide-in animation
    await nextTick();
    setTimeout(() => {
      panelVisible.value = true;
    }, 50);
  } else {
    // Hide panel immediately
    panelVisible.value = false;
  }
});

// ============================================================================
// Content Extraction Functions
// ============================================================================

const getEventTitle = (): string => {
  if (!props.eventData) return 'Event Details';
  
  switch (props.eventData.eventType) {
    case 'UserPromptSubmit':
      return 'User Prompt';
    case 'Notification':
      return 'Notification';
    default:
      return 'Event Details';
  }
};

const getPromptContent = (): string => {
  if (!props.eventData || props.eventData.eventType !== 'UserPromptSubmit') return '';
  
  // Extract prompt from payload or content
  const payload = props.eventData.rawEvent?.payload;
  if (payload && 'prompt' in payload && payload.prompt) {
    return payload.prompt;
  }
  
  return props.eventData.content || 'No prompt content available';
};

const getNotificationContent = (): string => {
  if (!props.eventData || props.eventData.eventType !== 'Notification') return '';
  
  // Extract message from payload or content
  const payload = props.eventData.rawEvent?.payload;
  if (payload && 'message' in payload && payload.message) {
    return payload.message;
  }
  
  return props.eventData.content || 'No notification content available';
};

// ============================================================================
// Formatting Functions
// ============================================================================

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return 'Unknown time';
  
  const date = new Date(timestamp);
  return date.toLocaleString([], { 
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

const formatDuration = (duration: number): string => {
  if (duration < 1000) {
    return `${duration}ms`;
  }
  if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  }
  return `${(duration / 60000).toFixed(1)}min`;
};

const getComplexityClass = (complexity: string): string => {
  switch (complexity) {
    case 'simple':
      return 'bg-green-600 text-green-100';
    case 'moderate':
      return 'bg-yellow-600 text-yellow-100';
    case 'complex':
      return 'bg-red-600 text-red-100';
    default:
      return 'bg-gray-600 text-gray-100';
  }
};

const getSeverityClass = (severity: string): string => {
  switch (severity) {
    case 'info':
      return 'bg-blue-600 text-blue-100';
    case 'warning':
      return 'bg-yellow-600 text-yellow-100';
    case 'error':
      return 'bg-red-600 text-red-100';
    default:
      return 'bg-gray-600 text-gray-100';
  }
};

// ============================================================================
// Event Handlers
// ============================================================================

const closePanelHandler = () => {
  panelVisible.value = false;
  setTimeout(() => {
    emit('close');
  }, 300); // Match animation duration
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    closePanelHandler();
  }
};

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* Custom scrollbar for better aesthetics */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Improved kbd styling */
kbd {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}

/* Enhanced hover states */
.hover\:bg-gray-750:hover {
  background-color: #2d3748;
}

/* Smooth transitions for all interactive elements */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Animation for panel slide-in */
.translate-x-full {
  transform: translateX(100%);
}

.translate-x-0 {
  transform: translateX(0);
}

/* Improved readability for code blocks */
pre {
  font-variant-ligatures: none;
  font-feature-settings: normal;
}

/* Better visual hierarchy for sections */
.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.space-y-4 > * + * {
  margin-top: 1rem;
}

.space-y-2 > * + * {
  margin-top: 0.5rem;
}

/* Focus styles for accessibility */
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .w-96 {
    width: 100vw;
  }
}
</style>