<template>
  <div class="diablo-panel rounded-lg p-4 h-full overflow-y-auto space-y-3 diablo-scrollbar">
    <div v-for="(item, index) in chatItems" :key="index">
      <!-- User Message -->
      <div v-if="item.type === 'user' && item.message" 
           class="p-3 rounded-lg bg-diablo-850/85 border border-diablo-brass/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-diablo-blood text-diablo-parchment tracking-[0.12em] uppercase shadow-[0_0_12px_rgba(176,30,33,0.45)]">
              User
            </span>
            <div class="flex-1">
              <!-- Handle string content -->
              <p v-if="typeof item.message.content === 'string'" 
                 class="text-lg text-diablo-parchment whitespace-pre-wrap font-medium">
                {{ item.message.content.includes('<command-') ? cleanCommandContent(item.message.content) : item.message.content }}
              </p>
              <!-- Handle array content -->
              <div v-else-if="Array.isArray(item.message.content)" class="space-y-2">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <!-- Text content -->
                  <p v-if="content.type === 'text'" 
                     class="text-lg text-diablo-parchment whitespace-pre-wrap font-medium">
                    {{ content.text }}
                  </p>
                  <!-- Tool result -->
                  <div v-else-if="content.type === 'tool_result'" 
                       class="bg-diablo-900/70 p-2 rounded border border-diablo-ash/60">
                    <span class="text-sm font-mono text-diablo-parchment/70">Tool Result:</span>
                    <pre class="text-sm text-diablo-parchment/75 mt-1">{{ content.content }}</pre>
                  </div>
                </div>
              </div>
              <!-- Metadata -->
              <div v-if="item.timestamp" class="mt-2 text-xs text-diablo-parchment/60">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-diablo-900/75 border border-diablo-ash/70 rounded-lg">
          <pre class="text-xs text-diablo-parchment/75 overflow-x-auto">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- Assistant Message -->
      <div v-else-if="item.type === 'assistant' && item.message" 
           class="p-3 rounded-lg bg-diablo-900/80 border border-diablo-ash/60">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-diablo-ash text-diablo-parchment tracking-[0.12em] uppercase shadow-[0_0_10px_rgba(58,31,26,0.45)]">
              Assistant
            </span>
            <div class="flex-1">
              <!-- Handle content array -->
              <div v-if="Array.isArray(item.message.content)" class="space-y-2">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <!-- Text content -->
                  <p v-if="content.type === 'text'" 
                     class="text-lg text-diablo-parchment whitespace-pre-wrap font-medium">
                    {{ content.text }}
                  </p>
                  <!-- Tool use -->
                  <div v-else-if="content.type === 'tool_use'" 
                       class="bg-diablo-blood/25 p-3 rounded border border-diablo-brass/60">
                    <div class="flex items-center space-x-2 mb-2">
                      <span class="text-2xl">🔧</span>
                      <span class="font-semibold text-diablo-gold">{{ content.name }}</span>
                    </div>
                    <pre class="text-sm text-diablo-parchment/80 overflow-x-auto">{{ JSON.stringify(content.input, null, 2) }}</pre>
                  </div>
                </div>
              </div>
              <!-- Usage info -->
              <div v-if="item.message.usage" class="mt-2 text-xs text-diablo-parchment/60">
                Tokens: {{ item.message.usage.input_tokens }} in / {{ item.message.usage.output_tokens }} out
              </div>
              <!-- Timestamp -->
              <div v-if="item.timestamp" class="mt-1 text-xs text-diablo-parchment/60">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-diablo-900/75 border border-diablo-ash/70 rounded-lg">
          <pre class="text-xs text-diablo-parchment/75 overflow-x-auto">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- System Message -->
      <div v-else-if="item.type === 'system'" 
           class="p-3 rounded-lg bg-diablo-850/85 border border-diablo-brass/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-diablo-brass text-diablo-900 tracking-[0.12em] uppercase">
              System
            </span>
            <div class="flex-1">
              <p class="text-lg text-diablo-parchment font-medium">
                {{ cleanSystemContent(item.content || '') }}
              </p>
              <!-- Tool use ID if present -->
              <div v-if="item.toolUseID" class="mt-1 text-xs text-diablo-parchment/60 font-mono">
                Tool ID: {{ item.toolUseID }}
              </div>
              <!-- Timestamp -->
              <div v-if="item.timestamp" class="mt-1 text-xs text-diablo-parchment/60">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-diablo-900/75 border border-diablo-ash/70 rounded-lg">
          <pre class="text-xs text-diablo-parchment/75 overflow-x-auto">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- Fallback for simple chat format -->
      <div v-else-if="item.role" 
           class="p-3 rounded-lg border"
           :class="item.role === 'user' ? 'bg-diablo-850/80 border-diablo-brass/50' : 'bg-diablo-900/70 border-diablo-ash/60'">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1">
            <span class="text-lg font-semibold px-3 py-1 rounded-full flex-shrink-0"
                  :class="item.role === 'user' ? 'bg-diablo-blood text-diablo-parchment' : 'bg-diablo-ash text-diablo-parchment'">
              {{ item.role === 'user' ? 'User' : 'Assistant' }}
            </span>
            <div class="flex-1">
              <p class="text-lg text-diablo-parchment whitespace-pre-wrap font-medium">
                {{ item.content }}
              </p>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center space-x-1 ml-2">
            <!-- Show Details Button -->
            <button
              @click="toggleDetails(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all"
            >
              {{ isDetailsExpanded(index) ? 'Hide' : 'Show' }} Details
            </button>
            <!-- Copy Button -->
            <button
              @click="copyMessage(index)"
              class="px-2 py-1 text-xs font-semibold text-diablo-parchment/70 hover:text-diablo-gold bg-diablo-900/70 hover:bg-diablo-850/80 border border-diablo-ash/60 rounded transition-all flex items-center"
              :title="'Copy message'"
            >
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <!-- Details Section -->
        <div v-if="isDetailsExpanded(index)" class="mt-3 p-3 bg-diablo-900/75 border border-diablo-ash/70 rounded-lg">
          <pre class="text-xs text-diablo-parchment/75 overflow-x-auto">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  chat: any[];
}>();

// Track which items have details expanded
const expandedDetails = ref<Set<number>>(new Set());

const toggleDetails = (index: number) => {
  if (expandedDetails.value.has(index)) {
    expandedDetails.value.delete(index);
  } else {
    expandedDetails.value.add(index);
  }
  // Force reactivity
  expandedDetails.value = new Set(expandedDetails.value);
};

const isDetailsExpanded = (index: number) => {
  return expandedDetails.value.has(index);
};

const chatItems = computed(() => {
  // Handle both simple chat format and complex claude-code format
  if (props.chat.length > 0 && props.chat[0].type) {
    // Complex format from chat.json
    return props.chat;
  } else {
    // Simple format with role/content
    return props.chat;
  }
});

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// const cleanContent = (content: string) => {
//   // Remove command message tags
//   return content
//     .replace(/<command-message>.*?<\/command-message>/gs, '')
//     .replace(/<command-name>.*?<\/command-name>/gs, '')
//     .trim();
// };

const cleanSystemContent = (content: string) => {
  // Remove ANSI escape codes
  return content.replace(/\u001b\[[0-9;]*m/g, '');
};

const cleanCommandContent = (content: string) => {
  // Remove command tags and clean content
  return content
    .replace(/<command-message>.*?<\/command-message>/gs, '')
    .replace(/<command-name>(.*?)<\/command-name>/gs, '$1')
    .trim();
};

// Track copy button states
const copyButtonStates = ref<Map<number, string>>(new Map());

const getCopyButtonText = (index: number) => {
  return copyButtonStates.value.get(index) || '📋';
};

const copyMessage = async (index: number) => {
  const item = chatItems.value[index];
  
  try {
    // Copy the entire JSON payload
    const jsonPayload = JSON.stringify(item, null, 2);
    await navigator.clipboard.writeText(jsonPayload);
    
    copyButtonStates.value.set(index, '✅');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonStates.value.set(index, '❌');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  }
  // Force reactivity
  copyButtonStates.value = new Map(copyButtonStates.value);
};
</script>
