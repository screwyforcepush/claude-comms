<template>
  <div v-if="visible" class="prompt-response-modal">
    <!-- Modal Backdrop -->
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
      @click="handleBackdropClick"
    ></div>

    <!-- Modal Content -->
    <div 
      class="fixed inset-4 bg-gray-800 rounded-lg border border-gray-600 shadow-2xl z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Header -->
      <div class="flex items-center justify-between bg-gradient-to-r from-gray-700 to-gray-600 px-6 py-4 rounded-t-lg border-b border-gray-600">
        <h2 id="modal-title" class="text-white font-bold text-xl flex items-center">
          <svg class="w-6 h-6 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          {{ agent?.name }} - Prompt & Response
        </h2>
        <div class="flex items-center space-x-2">
          <!-- View Toggle -->
          <div class="flex bg-gray-700 rounded-lg p-1">
            <button
              @click="viewMode = 'side-by-side'"
              class="px-3 py-1 rounded text-sm font-medium transition-colors"
              :class="viewMode === 'side-by-side' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white'"
              title="Side by side view"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 002 2m0 0v10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2"/>
              </svg>
            </button>
            <button
              @click="viewMode = 'stacked'"
              class="px-3 py-1 rounded text-sm font-medium transition-colors"
              :class="viewMode === 'stacked' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white'"
              title="Stacked view"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>

          <!-- Close Button -->
          <button
            @click="close"
            class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            aria-label="Close modal"
            title="Close (Esc)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-hidden">
        <!-- Side-by-side Layout -->
        <div v-if="viewMode === 'side-by-side'" class="flex h-full">
          <!-- Prompt Panel -->
          <div class="flex-1 flex flex-col border-r border-gray-600">
            <div class="bg-gray-700/50 px-4 py-3 border-b border-gray-600 flex items-center justify-between">
              <h3 class="text-white font-semibold flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Initial Prompt
                <span class="ml-2 text-xs text-gray-400">({{ getWordCount(agent?.initial_prompt) }} words)</span>
              </h3>
              <button
                @click="copyToClipboard(agent?.initial_prompt, 'prompt')"
                class="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
                title="Copy prompt"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 p-4 overflow-y-auto">
              <div v-if="agent?.initial_prompt" class="bg-gray-900/60 border border-gray-600 rounded-lg p-4 h-full">
                <pre 
                  class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed break-words h-full overflow-y-auto"
                  data-testid="modal-prompt-content"
                >{{ agent.initial_prompt }}</pre>
              </div>
              <div v-else class="flex items-center justify-center h-full text-gray-400">
                <div class="text-center">
                  <div class="text-4xl mb-2">📝</div>
                  <div>No prompt available</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Response Panel -->
          <div class="flex-1 flex flex-col">
            <div class="bg-gray-700/50 px-4 py-3 border-b border-gray-600 flex items-center justify-between">
              <h3 class="text-white font-semibold flex items-center">
                <svg class="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Final Response
                <span class="ml-2 text-xs text-gray-400">({{ getWordCount(agent?.final_response) }} words)</span>
              </h3>
              <button
                @click="copyToClipboard(agent?.final_response, 'response')"
                class="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
                title="Copy response"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 p-4 overflow-y-auto">
              <div v-if="agent?.final_response" class="bg-gray-900/60 border border-gray-600 rounded-lg p-4 h-full">
                <pre 
                  class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed break-words h-full overflow-y-auto"
                  data-testid="modal-response-content"
                >{{ agent.final_response }}</pre>
              </div>
              <div v-else class="flex items-center justify-center h-full text-gray-400">
                <div class="text-center">
                  <div class="text-4xl mb-2">📄</div>
                  <div>No response available</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stacked Layout -->
        <div v-else class="flex flex-col h-full">
          <!-- Prompt Section -->
          <div class="flex-1 flex flex-col border-b border-gray-600">
            <div class="bg-gray-700/50 px-4 py-3 border-b border-gray-600 flex items-center justify-between">
              <h3 class="text-white font-semibold flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Initial Prompt
                <span class="ml-2 text-xs text-gray-400">({{ getWordCount(agent?.initial_prompt) }} words)</span>
              </h3>
              <button
                @click="copyToClipboard(agent?.initial_prompt, 'prompt')"
                class="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 p-4 overflow-y-auto min-h-0">
              <div v-if="agent?.initial_prompt" class="bg-gray-900/60 border border-gray-600 rounded-lg p-4 h-full">
                <pre class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed break-words">{{ agent.initial_prompt }}</pre>
              </div>
              <div v-else class="flex items-center justify-center h-full text-gray-400">
                <div class="text-center">
                  <div class="text-4xl mb-2">📝</div>
                  <div>No prompt available</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Response Section -->
          <div class="flex-1 flex flex-col min-h-0">
            <div class="bg-gray-700/50 px-4 py-3 border-b border-gray-600 flex items-center justify-between">
              <h3 class="text-white font-semibold flex items-center">
                <svg class="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Final Response
                <span class="ml-2 text-xs text-gray-400">({{ getWordCount(agent?.final_response) }} words)</span>
              </h3>
              <button
                @click="copyToClipboard(agent?.final_response, 'response')"
                class="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 p-4 overflow-y-auto min-h-0">
              <div v-if="agent?.final_response" class="bg-gray-900/60 border border-gray-600 rounded-lg p-4 h-full">
                <pre class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed break-words">{{ agent.final_response }}</pre>
              </div>
              <div v-else class="flex items-center justify-center h-full text-gray-400">
                <div class="text-center">
                  <div class="text-4xl mb-2">📄</div>
                  <div>No response available</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-800 px-6 py-4 border-t border-gray-600 flex items-center justify-between rounded-b-lg">
        <div class="flex items-center space-x-4 text-sm text-gray-400">
          <span>Agent: {{ agent?.name }}</span>
          <span>•</span>
          <span>Type: {{ agent?.subagent_type }}</span>
          <span>•</span>
          <span>Status: {{ agent?.status || 'unknown' }}</span>
        </div>
        <div class="flex items-center space-x-2 text-xs text-gray-500">
          <span>Press</span>
          <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">Esc</kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { AgentStatus } from '../types'

interface Props {
  visible: boolean
  agent: AgentStatus | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const viewMode = ref<'side-by-side' | 'stacked'>('side-by-side')

const close = () => {
  emit('close')
}

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    close()
  }
}

const getWordCount = (text: string | undefined): number => {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

const copyToClipboard = async (text: string | undefined, type: 'prompt' | 'response') => {
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    // TODO: Add toast notification for successful copy
    console.log(`${type} copied to clipboard`)
  } catch (error) {
    console.error(`Failed to copy ${type}:`, error)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    event.preventDefault()
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // Prevent body scroll when modal is open
  if (props.visible) {
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.prompt-response-modal {
  font-family: system-ui, -apple-system, sans-serif;
}

/* Custom scrollbar for dark theme */
.prompt-response-modal ::-webkit-scrollbar {
  width: 8px;
}

.prompt-response-modal ::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

.prompt-response-modal ::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.prompt-response-modal ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', monospace;
  font-size: 0.75rem;
  line-height: 1;
  border: 1px solid rgba(75, 85, 99, 0.5);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Ensure text doesn't get cut off */
.break-words {
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .fixed.inset-4 {
    inset: 1rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-gray-800,
  .bg-gray-700\/50,
  .bg-gray-900\/60 {
    background: #000;
    border-color: #fff;
  }
  
  .text-gray-300,
  .text-gray-400 {
    color: #fff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-colors {
    transition: none;
  }
}
</style>