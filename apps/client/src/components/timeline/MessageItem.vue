<template>
  <div
    class="message-item p-4 rounded-lg border bg-diablo-900/85 border-diablo-ash/60 text-diablo-parchment shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)] hover:border-diablo-brass/60 hover:shadow-[0_0_14px_rgba(214,168,96,0.22)] transition-all duration-150"
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
            <div class="flex items-center space-x-2">
              <!-- Agent Icon -->
              <img
                v-if="message.metadata?.agent_type"
                :src="senderIconPath"
                :alt="senderIconAlt"
                class="w-4 h-4 inline-block"
              />
              <span class="message-label text-sm font-semibold text-diablo-gold tracking-wide uppercase">
                {{ formattedSender }}
              </span>
            </div>
            <span class="message-recipient text-xs text-diablo-parchment/60">
              {{ formattedRecipient }}
            </span>
          </div>
        </div>
        
        <!-- Message Content -->
        <div class="flex-1 min-w-0">
          <div class="message-content text-diablo-parchment text-sm leading-relaxed">
            <p class="truncate" v-if="!isExpanded">{{ contentPreview }}</p>
            <p class="whitespace-pre-wrap" v-else>{{ message.content }}</p>
          </div>

          <!-- Metadata Row -->
          <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-diablo-parchment/65">
            <span class="message-timestamp" v-if="message.metadata?.timestamp">
              {{ formatTimestamp(message.metadata.timestamp) }}
            </span>
            <span 
              v-if="message.metadata?.agent_type" 
              class="agent-type diablo-tag px-2 py-1 rounded border border-diablo-brass/50"
            >
              {{ message.metadata.agent_type }}
            </span>
            <!-- Read by indicator for team messages -->
            <span 
              v-if="message.recipient === 'Team' && message.metadata?.read_by" 
              class="read-by px-2 py-1 rounded border"
              :class="message.metadata.read_by.length > 0 
                ? 'border-diablo-brass/60 bg-diablo-blood/25 text-diablo-gold' 
                : 'border-diablo-ash/55 bg-diablo-900/70 text-diablo-parchment/45'"
            >
              👁️ {{ message.metadata.read_by.length > 0 ? message.metadata.read_by.join(', ') : 'Unread' }}
            </span>
            <!-- Performance metrics for agent responses -->
            <span 
              v-if="message.metadata?.duration_minutes" 
              class="duration px-2 py-1 rounded border border-diablo-brass/60 bg-diablo-900/70 text-diablo-gold"
            >
              ⏱️ {{ message.metadata.duration_minutes }} min
            </span>
            <span 
              v-if="message.metadata?.cost" 
              class="cost px-2 py-1 rounded border border-diablo-brass/60 bg-diablo-900/70 text-[#9be27a]"
            >
              💰 {{ message.metadata.cost }}k tokens
            </span>
            <span 
              v-if="message.metadata?.effort" 
              class="effort px-2 py-1 rounded border border-diablo-brass/60 bg-diablo-900/70 text-[#d3a6ff]"
            >
              🔧 {{ message.metadata.effort }} tools
            </span>
            <span 
              v-if="message.metadata?.status" 
              class="status-badge px-2 py-1 rounded text-xs font-medium border"
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
          class="copy-btn p-1 text-diablo-parchment/60 hover:text-diablo-gold transition-colors"
          :title="`Copy ${messageLabel.toLowerCase()} content`"
          :aria-label="`Copy ${messageLabel.toLowerCase()} content`"
        >
          📋
        </button>
        <button
          class="expand-btn p-1 text-diablo-parchment/60 hover:text-diablo-gold transition-colors"
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
      v-if="isExpanded && hasDisplayableMetadata" 
      class="message-details mt-4 pt-4 border-t border-diablo-ash/60"
    >
      <!-- Metadata Section -->
      <div class="metadata-section">
        <div class="bg-diablo-900/70 border border-diablo-ash/60 p-3 rounded">
          <pre class="text-xs text-diablo-parchment/70 overflow-x-auto">{{ JSON.stringify(filteredMetadata, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineMessage } from '../../types'
import { useAgentIcon } from '../../composables/useAgentIcon'

const props = defineProps<{
  message: TimelineMessage
  isExpanded: boolean
}>()

const emit = defineEmits<{
  'toggle-expand': [messageKey: string]
  'copy-content': [content: string]
}>()

// Agent Icon composable
const { getAgentIconPath, getAgentIconAlt } = useAgentIcon()

// Message type configuration
const messageTypeConfig = {
  user_prompt: {
    icon: '👤',
    label: 'User Prompt',
    classes: 'bg-[#21100d] border-diablo-brass/60'
  },
  orchestrator_task: {
    icon: '⚙️',
    label: 'Orchestrator Task',
    classes: 'bg-[#1b0e0b] border-diablo-blood/55'
  },
  agent_response: {
    icon: '🤖',
    label: 'Agent Response',
    classes: 'bg-[#120d0c] border-[#3f2a1f]'
  },
  team_message: {
    icon: '💬',
    label: 'Team Communication',
    classes: 'bg-[#1c140e] border-diablo-brass/50'
  },
  default: {
    icon: '❓',
    label: 'Unknown Message',
    classes: 'bg-diablo-900/80 border-diablo-ash/60'
  }
} as const

// Computed properties
const messageConfig = computed(() => {
  // Determine type based on sender/recipient
  let type = 'default'
  if (props.message.sender === 'User') {
    type = 'user_prompt'
  } else if (props.message.sender === 'Orchestrator') {
    type = 'orchestrator_task'
  } else if (props.message.recipient === 'Team') {
    type = 'team_message'
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

// Get agent icon path based on agent type
const senderIconPath = computed(() => {
  return getAgentIconPath(props.message.metadata?.agent_type)
})

const senderIconAlt = computed(() => {
  return getAgentIconAlt(props.message.metadata?.agent_type)
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
  const status = props.message.metadata?.status?.toLowerCase()
  const palette: Record<string, string> = {
    completed: 'bg-[#12331a] border-[#3b6a3d] text-[#8ddf8a]',
    in_progress: 'bg-[#1a2130] border-[#2c4a63] text-[#7ab5ff]',
    error: 'bg-[#2c0f10] border-[#7f1d1d] text-[#f98f8f]',
    pending: 'bg-[#2b2113] border-[#7c4f1d] text-[#f1c27d]'
  }

  return palette[status ?? ''] || 'bg-diablo-900/70 border-diablo-ash/60 text-diablo-parchment/65'
})

// Filter out timestamp and read_by from metadata display (they're shown in the main UI)
const filteredMetadata = computed(() => {
  if (!props.message.metadata) return {}
  const { timestamp, read_by, ...rest } = props.message.metadata
  return rest
})

// Check if there's displayable metadata (excluding timestamp)
const hasDisplayableMetadata = computed(() => {
  const filtered = filteredMetadata.value
  return Object.keys(filtered).length > 0
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
