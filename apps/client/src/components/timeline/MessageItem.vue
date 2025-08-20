<template>
  <div
    class="message-item p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
    :class="messageTypeClasses"
    :data-testid="'message-item'"
    role="article"
    tabindex="0"
    @click="handleMessageClick"
    @keydown.enter="handleMessageClick"
    @keydown.space.prevent="handleMessageClick"
  >
    <!-- Message Header -->
    <div class="message-header flex items-start justify-between cursor-pointer">
      <div class="flex items-start space-x-3 flex-1">
        <!-- Message Icon and Type -->
        <div class="flex-shrink-0 flex items-center space-x-2">
          <span class="message-icon text-2xl">{{ messageIcon }}</span>
          <div class="flex flex-col">
            <span class="message-label text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ formattedSender }}
            </span>
            <span class="message-recipient text-xs text-gray-500 dark:text-gray-400">
              {{ formattedRecipient }}
            </span>
          </div>
        </div>
        
        <!-- Message Content -->
        <div class="flex-1 min-w-0">
          <div class="message-content text-gray-800 dark:text-gray-100 text-sm leading-relaxed">
            <p class="truncate" v-if="!isExpanded">{{ contentPreview }}</p>
            <p class="whitespace-pre-wrap" v-else>{{ message.content }}</p>
          </div>
          
          <!-- Metadata Row -->
          <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span class="message-timestamp" v-if="message.metadata?.timestamp">
              {{ formatTimestamp(message.metadata.timestamp) }}
            </span>
            <span 
              v-if="message.metadata?.agent_type" 
              class="agent-type bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
            >
              {{ message.metadata.agent_type }}
            </span>
            <!-- Performance metrics for agent responses -->
            <span 
              v-if="message.metadata?.duration_minutes" 
              class="duration bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
            >
              ⏱️ {{ message.metadata.duration_minutes }} min
            </span>
            <span 
              v-if="message.metadata?.cost" 
              class="cost bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded"
            >
              💰 {{ message.metadata.cost }}k tokens
            </span>
            <span 
              v-if="message.metadata?.effort" 
              class="effort bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded"
            >
              🔧 {{ message.metadata.effort }} tools
            </span>
            <span 
              v-if="message.metadata?.status" 
              class="status-badge px-2 py-1 rounded text-xs font-medium"
              :class="statusBadgeClasses"
            >
              {{ message.metadata.status }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex items-center space-x-1 ml-2">
        <button
          @click.stop="copyContent"
          class="copy-btn p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          :title="`Copy ${messageLabel.toLowerCase()} content`"
          :aria-label="`Copy ${messageLabel.toLowerCase()} content`"
        >
          📋
        </button>
        <button
          class="expand-btn p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          :title="isExpanded ? 'Collapse details' : 'Expand details'"
          :aria-label="isExpanded ? 'Collapse details' : 'Expand details'"
          :aria-expanded="isExpanded"
        >
          {{ isExpanded ? '🔽' : '▶️' }}
        </button>
      </div>
    </div>

    <!-- Expanded Details - Metadata Only -->
    <div 
      v-if="isExpanded && Object.keys(message.metadata || {}).length > 1" 
      class="message-details mt-4 pt-4 border-t border-gray-200 dark:border-gray-600"
    >
      <!-- Metadata Section -->
      <div class="metadata-section">
        <div class="bg-gray-50 dark:bg-gray-900 p-3 rounded">
          <pre class="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">{{ JSON.stringify(message.metadata || {}, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineMessage } from '../../types'

const props = defineProps<{
  message: TimelineMessage
  isExpanded: boolean
}>()

const emit = defineEmits<{
  'toggle-expand': [messageKey: string]
  'copy-content': [content: string]
}>()

// Message type configuration
const messageTypeConfig = {
  user_prompt: {
    icon: '👤',
    label: 'User Prompt',
    classes: 'user-prompt-message bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  },
  orchestrator_task: {
    icon: '⚙️',
    label: 'Orchestrator Task',
    classes: 'orchestrator-task-message bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  },
  agent_response: {
    icon: '🤖',
    label: 'Agent Response',
    classes: 'agent-response-message bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
  },
  default: {
    icon: '❓',
    label: 'Unknown Message',
    classes: 'unknown-message bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
  }
}

// Computed properties
const messageConfig = computed(() => {
  // Determine type based on sender/recipient
  let type = 'default'
  if (props.message.sender === 'User') {
    type = 'user_prompt'
  } else if (props.message.sender === 'Orchestrator') {
    type = 'orchestrator_task'
  } else if (props.message.recipient === 'Orchestrator' && props.message.sender !== 'User') {
    type = 'agent_response'
  }
  
  return messageTypeConfig[type as keyof typeof messageTypeConfig] || 
         messageTypeConfig.default
})

const messageIcon = computed(() => messageConfig.value.icon)
const messageLabel = computed(() => messageConfig.value.label)
const messageTypeClasses = computed(() => messageConfig.value.classes)

// Format sender and recipient based on message type
const formattedSender = computed(() => {
  // Debug log
  console.log('MessageItem sender:', props.message.sender, 'recipient:', props.message.recipient);
  
  return props.message.sender || 'Unknown'
})

const formattedRecipient = computed(() => {
  return props.message.recipient ? `→ ${props.message.recipient}` : ''
})

// Create a preview of the content (first line or truncated)
const contentPreview = computed(() => {
  const content = props.message.content || ''
  const firstLine = content.split('\n')[0]
  return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine
})

const statusBadgeClasses = computed(() => {
  const status = props.message.metadata?.status
  switch (status) {
    case 'completed':
      return 'status-completed bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'in_progress':
      return 'status-in-progress bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'error':
      return 'status-error bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'pending':
      return 'status-pending bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    default:
      return 'status-unknown bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
  }
})

// Methods
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

const handleMessageClick = () => {
  // Use a hash of sender+recipient+timestamp as unique identifier
  const messageKey = `${props.message.sender}-${props.message.recipient}-${props.message.metadata?.timestamp}`
  emit('toggle-expand', messageKey)
}

const copyContent = async () => {
  emit('copy-content', props.message.content)
}
</script>

<style scoped>
.message-item {
  /* Custom styling handled by Tailwind classes */
}

.message-content {
  /* Ensure proper text wrapping and overflow handling */
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Focus styles for accessibility */
.message-item:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Hover effects for interactive elements */
.copy-btn:hover,
.expand-btn:hover {
  transform: scale(1.1);
}

/* Smooth transitions */
.message-details {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}
</style>