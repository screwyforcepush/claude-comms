<template>
  <div>
    <!-- Main Panel -->
    <div 
      v-if="visible" 
      class="prompt-detail-panel fixed right-0 top-0 h-screen w-[480px] bg-gray-800 border-l border-gray-600 shadow-2xl transform transition-transform duration-300 ease-out z-50"
      :class="{ 'translate-x-full': !visible }"
    >
      <!-- Header -->
      <div class="flex items-center justify-between bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
        <div class="flex items-center space-x-3">
          <!-- Blue circle indicator to match timeline -->
          <div class="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 shadow-lg ring-2 ring-blue-400/30"></div>
          <h3 class="text-white font-bold text-lg">User Prompt</h3>
        </div>
        <button
          @click="close"
          class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          aria-label="Close prompt details"
          title="Close (Esc)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content - Scrollable Section -->
      <div class="flex-1 overflow-y-auto h-full" style="max-height: calc(100vh - 120px);">
        <div v-if="promptData" class="p-4 space-y-6">
          
          <!-- Prompt Metadata -->
          <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
            <h4 class="text-white font-semibold mb-3 flex items-center">
              <svg class="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Details
            </h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-gray-400 text-xs uppercase tracking-wide">Timestamp</label>
                <div class="text-white text-sm mt-1">{{ formatTimestamp(promptData.timestamp) }}</div>
              </div>
              <div>
                <label class="text-gray-400 text-xs uppercase tracking-wide">Session ID</label>
                <div class="text-gray-300 text-sm mt-1 font-mono">{{ promptData.sessionId?.slice(-8) || 'Unknown' }}</div>
              </div>
              <div>
                <label class="text-gray-400 text-xs uppercase tracking-wide">Word Count</label>
                <div class="text-white text-sm mt-1">{{ getWordCount() }} words</div>
              </div>
              <div>
                <label class="text-gray-400 text-xs uppercase tracking-wide">Complexity</label>
                <div class="text-sm mt-1">
                  <span 
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :class="getComplexityClass()"
                  >
                    {{ getComplexity() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Prompt Content -->
          <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
            <h4 class="text-white font-semibold mb-3 flex items-center">
              <svg class="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Prompt Content
            </h4>
            <!-- This is the scrollable content area -->
            <div class="bg-gray-900/60 border border-gray-600 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <pre class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed break-words">{{ formatPromptContent() }}</pre>
            </div>
          </div>

          <!-- Analysis Section (if metadata available) -->
          <div v-if="promptData.metadata" class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
            <h4 class="text-white font-semibold mb-3 flex items-center">
              <svg class="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z"/>
              </svg>
              Analysis
            </h4>
            <div class="grid grid-cols-2 gap-4">
              <div v-if="promptData.metadata.severity">
                <label class="text-gray-400 text-xs uppercase tracking-wide">Severity</label>
                <div class="mt-1">
                  <span 
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :class="getSeverityClass(promptData.metadata.severity)"
                  >
                    {{ promptData.metadata.severity.toUpperCase() }}
                  </span>
                </div>
              </div>
              <div v-if="promptData.metadata.responseTime">
                <label class="text-gray-400 text-xs uppercase tracking-wide">Response Time</label>
                <div class="text-white text-sm mt-1">{{ promptData.metadata.responseTime }}ms</div>
              </div>
              <div v-if="promptData.metadata.agentCount">
                <label class="text-gray-400 text-xs uppercase tracking-wide">Agents Triggered</label>
                <div class="text-white text-sm mt-1">{{ promptData.metadata.agentCount }} agents</div>
              </div>
              <div v-if="promptData.metadata.source">
                <label class="text-gray-400 text-xs uppercase tracking-wide">Source</label>
                <div class="text-gray-300 text-sm mt-1">{{ promptData.metadata.source }}</div>
              </div>
            </div>
          </div>

          <!-- Raw Event Data (for debugging) -->
          <div v-if="promptData.rawEvent && showRawData" class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-white font-semibold flex items-center">
                <svg class="w-4 h-4 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
                Raw Event Data
              </h4>
              <button
                @click="showRawData = false"
                class="text-gray-400 hover:text-white transition-colors text-xs"
              >
                Hide
              </button>
            </div>
            <div class="bg-gray-900/60 border border-gray-600 rounded-lg p-3 max-h-64 overflow-y-auto">
              <pre class="text-gray-400 text-xs whitespace-pre-wrap font-mono">{{ JSON.stringify(promptData.rawEvent, null, 2) }}</pre>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="p-4 flex items-center justify-center h-full">
          <div class="text-center text-gray-400">
            <div class="text-4xl mb-4">💬</div>
            <div class="text-lg mb-2">No prompt selected</div>
            <div class="text-sm">Click on a blue prompt indicator in the timeline to view details</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-800 px-4 py-3 border-t border-gray-600 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <!-- Toggle Raw Data -->
            <button
              v-if="promptData?.rawEvent && !showRawData"
              @click="showRawData = true"
              class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              Show Raw Data
            </button>
            <!-- Copy Action -->
            <button
              @click="copyPrompt"
              class="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <div class="flex items-center space-x-2 text-xs text-gray-500">
            <span>Press</span>
            <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlay/Backdrop -->
    <div 
      v-if="visible" 
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
      @click="close"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

// Types
interface PromptData {
  eventId: string;
  eventType: 'UserPromptSubmit';
  timestamp: number;
  sessionId: string;
  content: string;
  position: { x: number; y: number };
  rawEvent?: any;
  metadata?: {
    severity?: 'info' | 'warning' | 'error';
    source?: string;
    category?: string;
    wordCount?: number;
    complexity?: 'simple' | 'moderate' | 'complex';
    responseTime?: number;
    agentCount?: number;
  };
}

// Component Props
const props = defineProps<{
  visible: boolean;
  promptData: PromptData | null;
}>();

// Component Events
const emit = defineEmits<{
  'close': [];
}>();

// Reactive state
const showRawData = ref(false);

// Methods
const close = () => {
  emit('close');
};

const formatTimestamp = (timestamp: number): string => {
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

const formatPromptContent = (): string => {
  if (!props.promptData?.content) return 'No content available';
  
  // Clean up the content for better display
  return props.promptData.content.trim();
};

const getWordCount = (): number => {
  if (!props.promptData?.content) return 0;
  return props.promptData.content.trim().split(/\s+/).length;
};

const getComplexity = (): string => {
  const wordCount = getWordCount();
  if (wordCount > 200) return 'Complex';
  if (wordCount > 50) return 'Moderate';
  return 'Simple';
};

const getComplexityClass = (): string => {
  const complexity = getComplexity();
  switch (complexity) {
    case 'Complex': return 'bg-red-600/20 text-red-400 border border-red-600/30';
    case 'Moderate': return 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30';
    case 'Simple': return 'bg-green-600/20 text-green-400 border border-green-600/30';
    default: return 'bg-gray-600/20 text-gray-400 border border-gray-600/30';
  }
};

const getSeverityClass = (severity: string): string => {
  switch (severity) {
    case 'error': return 'bg-red-600/20 text-red-400 border border-red-600/30';
    case 'warning': return 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30';
    case 'info': return 'bg-blue-600/20 text-blue-400 border border-blue-600/30';
    default: return 'bg-gray-600/20 text-gray-400 border border-gray-600/30';
  }
};

const copyPrompt = async () => {
  if (!props.promptData?.content) return;
  
  try {
    await navigator.clipboard.writeText(props.promptData.content);
    // TODO: Add toast notification for successful copy
    console.log('Prompt copied to clipboard');
  } catch (error) {
    console.error('Failed to copy prompt:', error);
  }
};

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    event.preventDefault();
    close();
  }
};

// Watch for visibility changes
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // Prevent body scroll when panel is open
    document.body.style.overflow = 'hidden';
    // Reset raw data toggle when opening
    showRawData.value = false;
  } else {
    document.body.style.overflow = '';
  }
});

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.prompt-detail-panel {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.prompt-detail-panel.translate-x-full {
  transform: translateX(100%);
}

kbd {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', monospace;
  font-size: 0.75rem;
  line-height: 1;
  border: 1px solid rgba(75, 85, 99, 0.5);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Custom scrollbar for dark theme */
.prompt-detail-panel ::-webkit-scrollbar {
  width: 8px;
}

.prompt-detail-panel ::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

.prompt-detail-panel ::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.prompt-detail-panel ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Ensure content doesn't get cut off */
.break-words {
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .prompt-detail-panel {
    width: 100vw;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .prompt-detail-panel {
    transition: none;
  }
  
  .transition-colors,
  .transition-transform {
    transition: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .prompt-detail-panel {
    border-width: 2px;
  }
  
  .bg-gray-700\/50,
  .bg-gray-800,
  .bg-gray-900\/60 {
    background: #000;
    border-color: #fff;
  }
  
  .text-gray-300,
  .text-gray-400 {
    color: #fff;
  }
}
</style>