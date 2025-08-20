<template>
  <div 
    class="orchestration-timeline h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 min-h-0"
    role="log"
    aria-live="polite"
    :aria-label="`Orchestration timeline for session ${sessionId || 'all sessions'}`"
    data-testid="orchestration-timeline"
  >
    <!-- Header -->
    <div 
      class="timeline-header flex-shrink-0 px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-t-lg"
      data-testid="timeline-header"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-2xl">📋</span>
          <div>
            <h2 class="text-xl font-bold">Session Events</h2>
            <p class="text-sm text-gray-300" v-if="sessionId">
              Session: {{ sessionId }}
            </p>
            <p class="text-sm text-gray-300" v-else>
              All Sessions
            </p>
          </div>
        </div>
        <div class="text-right text-sm text-gray-300">
          <div>{{ filteredMessages.length }} events</div>
          <div v-if="timeRange">{{ timeRange }}</div>
        </div>
      </div>
    </div>

    <!-- Timeline Content -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <!-- Empty State -->
      <div 
        v-if="filteredMessages.length === 0" 
        class="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8"
        data-testid="empty-state"
      >
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
          No orchestration events to display
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          Events will appear here as they occur
        </p>
      </div>

      <!-- Optimized Scrolling -->
      <div
        v-else
        ref="regularScrollContainer"
        class="regular-scroll-container h-full overflow-y-auto px-4 py-2 space-y-3"
        @scroll="handleScroll"
      >
        <MessageItem
          v-for="(message, index) in filteredMessages"
          :key="`${message.sender}-${message.recipient}-${message.metadata?.timestamp}-${index}`"
          :message="message"
          :is-expanded="expandedMessages.has(`${message.sender}-${message.recipient}-${message.metadata?.timestamp}`)"
          @toggle-expand="toggleMessageExpansion"
          @copy-content="copyMessageContent"
        />
      </div>
    </div>

    <!-- Screen reader announcements -->
    <div 
      aria-live="assertive" 
      aria-atomic="true" 
      class="sr-only"
    >
      {{ screenReaderAnnouncement }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import MessageItem from './timeline/MessageItem.vue'
import type { TimelineMessage } from '../types'

const props = defineProps<{
  messages: TimelineMessage[]
  sessionId?: string
}>()

// Component state with performance optimizations
const expandedMessages = ref<Set<string>>(new Set())
// Virtual scrolling removed - incompatible with Vue 3
const regularScrollContainer = ref<HTMLElement>()
const screenReaderAnnouncement = ref<string>('')

// Performance monitoring
const renderingMetrics = ref({
  lastRenderTime: 0,
  averageRenderTime: 0,
  renderCount: 0
})
// Performance optimization: Dynamic item height estimation
const estimatedItemHeight = computed(() => {
  // Base height for message items
  const baseHeight = 80
  // Adjust based on average content length for better scrolling accuracy
  const avgContentLength = filteredMessages.value.length > 0 
    ? filteredMessages.value.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / filteredMessages.value.length
    : 100
  
  // Increase height estimate for longer messages
  return baseHeight + Math.min(Math.floor(avgContentLength / 100) * 20, 60)
})

// Computed properties
// Performance optimized filtering and sorting
const filteredMessages = computed(() => {
  const startTime = performance.now()
  
  let filtered = props.messages
  
  // Debug logging
  console.log('OrchestrationTimeline received messages:', filtered?.length || 0, 'sessionId:', props.sessionId)
  
  // Early return for empty datasets
  if (!filtered || filtered.length === 0) {
    return []
  }
  
  // Session filtering is already done server-side, no need to filter again
  // Just use the messages as they are already filtered for the session
  
  // Optimized sorting with timestamp fallback
  const sorted = filtered
    .slice() // Avoid mutating original array
    .sort((a, b) => {
      const timeA = a.metadata?.timestamp || 0
      const timeB = b.metadata?.timestamp || 0
      return timeA - timeB
    })
  
  // Performance tracking
  const renderTime = performance.now() - startTime
  renderingMetrics.value.lastRenderTime = renderTime
  renderingMetrics.value.renderCount++
  renderingMetrics.value.averageRenderTime = 
    (renderingMetrics.value.averageRenderTime * (renderingMetrics.value.renderCount - 1) + renderTime) / 
    renderingMetrics.value.renderCount
  
  // Log performance warnings for debugging
  if (renderTime > 100) {
    console.warn(`Timeline filtering took ${renderTime.toFixed(2)}ms for ${sorted.length} messages`)
  }
  
  return sorted
})

// Virtual scrolling removed due to Vue 3 compatibility
// const useVirtualScrolling = computed(() => false)

const timeRange = computed(() => {
  if (filteredMessages.value.length === 0) return ''
  
  const timestamps = filteredMessages.value
    .map(m => m.metadata?.timestamp)
    .filter(Boolean)
    .sort((a, b) => a! - b!)
  
  if (timestamps.length < 2) return ''
  
  const start = new Date(timestamps[0]!)
  const end = new Date(timestamps[timestamps.length - 1]!)
  
  return `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`
})

// Performance optimized auto-scroll detection with throttling
const shouldAutoScroll = computed(() => {
  const container = regularScrollContainer.value
    
  if (!container) return true
  
  try {
    const { scrollTop, scrollHeight, clientHeight } = container
    const threshold = Math.min(scrollHeight * 0.05, 100) // Dynamic threshold
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold
    
    return isNearBottom
  } catch (error) {
    // Fallback for cases where container properties are not available
    return true
  }
})

// Methods
const toggleMessageExpansion = (messageKey: string) => {
  if (expandedMessages.value.has(messageKey)) {
    expandedMessages.value.delete(messageKey)
  } else {
    expandedMessages.value.add(messageKey)
  }
  // Force reactivity
  expandedMessages.value = new Set(expandedMessages.value)
}

const copyMessageContent = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    // Could add toast notification here
  } catch (error) {
    console.warn('Failed to copy message content:', error)
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    const container = regularScrollContainer.value
      
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

// Throttled scroll event handler for performance
let scrollTimeout: NodeJS.Timeout | null = null
const handleScroll = () => {
  // Throttle scroll events to improve performance
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  scrollTimeout = setTimeout(() => {
    // Update scroll position tracking if needed
    // This helps with auto-scroll detection performance
    scrollTimeout = null
  }, 16) // ~60fps throttling
}

const announceNewMessage = (message: TimelineMessage) => {
  let messageType = 'message'
  if (message.sender === 'User') {
    messageType = 'user prompt'
  } else if (message.sender === 'Orchestrator') {
    messageType = 'orchestrator task'
  } else if (message.recipient === 'Orchestrator') {
    messageType = 'agent response'
  }
  
  screenReaderAnnouncement.value = `New ${messageType} received`
  
  // Clear announcement after screen reader has time to read it
  setTimeout(() => {
    screenReaderAnnouncement.value = ''
  }, 1000)
}

// Optimized watcher for new messages with performance tracking
watch(() => props.messages.length, async (newLength, oldLength) => {
  if (newLength > oldLength && shouldAutoScroll.value) {
    // Use requestAnimationFrame for smooth scrolling performance
    requestAnimationFrame(() => {
      scrollToBottom()
    })
    
    // Announce new message for screen readers (throttled)
    const newMessage = props.messages[props.messages.length - 1]
    if (newMessage) {
      announceNewMessage(newMessage)
    }
  }
  
  // Performance monitoring for large datasets
  if (newLength > 1000 && newLength > oldLength) {
    console.info(`Timeline now handling ${newLength} messages`)
  }
}, { flush: 'post' }) // Ensure DOM updates are complete

// Watch for session changes
watch(() => props.sessionId, () => {
  // Reset expansion state when session changes
  expandedMessages.value.clear()
  nextTick(() => scrollToBottom())
})

onMounted(() => {
  // Auto-scroll to bottom on initial load
  scrollToBottom()
})
</script>

<style scoped>
.orchestration-timeline {
  /* Custom styles for the timeline component */
}

.timeline-header {
  /* Header styling is handled by Tailwind classes */
}

.regular-scroll-container {
  /* Scrolling container styles */
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>