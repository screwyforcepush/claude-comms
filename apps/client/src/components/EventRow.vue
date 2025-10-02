<template>
  <div
    class="group relative p-4 mobile:p-2 rounded-lg shadow-[inset_0_1px_6px_rgba(0,0,0,0.65)] hover:shadow-[0_6px_18px_rgba(214,168,96,0.28)] transition-all duration-200 cursor-pointer border border-diablo-ash/70 hover:border-diablo-brass/60 hover:bg-diablo-850/90 bg-diablo-900/80 backdrop-blur-[1px] transform hover:translate-y-[-1px] min-h-[44px] touch-manipulation"
    :class="{ 'ring-2 ring-diablo-brass border-diablo-brass shadow-[0_0_24px_rgba(214,168,96,0.55)]': isExpanded }"
    @click="toggleExpanded"
    title="Click to expand event details"
    style="touch-action: manipulation;"
  >
    <!-- App color indicator -->
    <div 
      class="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg"
      :style="{ backgroundColor: appHexColor }"
    ></div>
    
    <!-- Session color indicator -->
    <div 
      class="absolute left-3 top-0 bottom-0 w-1.5"
      :class="gradientClass"
    ></div>
    
    <div class="ml-4">
      <!-- Desktop Layout: Original horizontal layout -->
      <div class="hidden mobile:block mb-2">
        <!-- Mobile: App + Time on first row -->
        <div class="flex items-center justify-between mb-1">
          <span
            class="text-xs font-semibold text-diablo-gold px-1.5 py-0.5 rounded border bg-diablo-850/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.75)]"
            :style="{ ...appBgStyle, ...appBorderStyle }"
          >
            {{ event.source_app }}
          </span>
          <span class="text-xs text-diablo-parchment/70 font-medium">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>

        <!-- Mobile: Session + Event Type on second row -->
        <div class="flex items-center space-x-2">
          <span class="text-xs text-diablo-parchment/75 px-1.5 py-0.5 rounded border bg-diablo-900/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]" :class="borderColorClass">
            {{ sessionIdShort }}
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-diablo-blood/30 text-diablo-gold border border-diablo-brass/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] uppercase tracking-wide">
            <span class="mr-1 text-sm">{{ hookEmoji }}</span>
            {{ event.hook_event_type }}
          </span>
        </div>
      </div>

      <!-- Desktop Layout: Original single row layout -->
      <div class="flex items-center justify-between mb-2 mobile:hidden">
        <div class="flex items-center space-x-4">
          <span
            class="text-base font-semibold text-diablo-gold px-2 py-0.5 rounded border bg-diablo-850/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.75)] uppercase tracking-wide"
            :style="{ ...appBgStyle, ...appBorderStyle }"
          >
            {{ event.source_app }}
          </span>
          <span class="text-sm text-diablo-parchment/75 px-2 py-0.5 rounded border bg-diablo-900/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]" :class="borderColorClass">
            {{ sessionIdShort }}
          </span>
          <span class="inline-flex items-center px-3 py-0.5 rounded text-sm font-bold bg-diablo-blood/30 text-diablo-gold border border-diablo-brass/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] uppercase tracking-[0.14em]">
            <span class="mr-1.5 text-base">{{ hookEmoji }}</span>
            {{ event.hook_event_type }}
          </span>
        </div>
        <span class="text-sm text-diablo-parchment/70 font-semibold">
          {{ formatTime(event.timestamp) }}
        </span>
      </div>
      
      <!-- Tool info and Summary - Desktop Layout -->
      <div class="flex items-center justify-between mb-2 mobile:hidden">
        <div v-if="toolInfo" class="text-base text-diablo-parchment/85 font-semibold">
          <span class="font-medium">{{ toolInfo.tool }}</span>
          <span v-if="toolInfo.detail" class="ml-2 text-diablo-parchment/65" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
        </div>

        <!-- Summary aligned to the right -->
        <div v-if="event.summary" class="max-w-[50%] px-3 py-1.5 bg-diablo-ash/50 border border-diablo-brass/50 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
          <span class="text-sm text-diablo-gold font-semibold">
            <span class="mr-1">📝</span>
            {{ event.summary }}
          </span>
        </div>
      </div>

      <!-- Tool info and Summary - Mobile Layout -->
      <div class="space-y-2 hidden mobile:block mb-2">
        <div v-if="toolInfo" class="text-sm text-diablo-parchment/80 font-semibold w-full">
          <span class="font-medium">{{ toolInfo.tool }}</span>
          <span v-if="toolInfo.detail" class="ml-2 text-diablo-parchment/60" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
        </div>
        
        <div v-if="event.summary" class="w-full px-2 py-1 bg-diablo-ash/50 border border-diablo-brass/40 rounded-lg shadow-md">
          <span class="text-xs text-diablo-gold font-semibold">
            <span class="mr-1">📝</span>
            {{ event.summary }}
          </span>
        </div>
      </div>

      <!-- Expanded content -->
      <div v-if="isExpanded" class="mt-2 pt-2 border-t-2 border-diablo-blood/60 bg-gradient-to-r from-diablo-900/95 via-diablo-850/95 to-diablo-900/95 rounded-b-lg p-3 space-y-3">
        <!-- Payload -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-base mobile:text-sm font-semibold text-diablo-gold drop-shadow-[0_2px_6px_rgba(214,168,96,0.5)] flex items-center uppercase tracking-wide">
              <span class="mr-1.5 text-xl mobile:text-base">📦</span>
              Payload
            </h4>
            <button
              @click.stop="copyPayload"
              class="px-3 py-1 mobile:px-2 mobile:py-0.5 text-sm mobile:text-xs font-semibold rounded-lg diablo-button transition-all duration-200 hover:scale-105 cursor-pointer min-h-[44px] min-w-[44px] touch-manipulation"
              title="Copy payload to clipboard"
              style="touch-action: manipulation;"
            >
              <span>{{ copyButtonText }}</span>
            </button>
          </div>
          <pre class="text-sm mobile:text-xs text-diablo-parchment bg-[#150907] p-3 mobile:p-2 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono border border-diablo-ash/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)] hover:shadow-[0_0_12px_rgba(214,168,96,0.2)] transition-shadow duration-200">{{ formattedPayload }}</pre>
        </div>
        
        <!-- Chat transcript button -->
        <div v-if="event.chat && event.chat.length > 0" class="flex justify-end">
          <button
            @click.stop="!isMobile && (showChatModal = true)"
            :class="[
              'px-4 py-2 mobile:px-3 mobile:py-1.5 font-semibold rounded-lg transition-all duration-200 flex items-center space-x-1.5 shadow-md hover:shadow-lg min-h-[44px] min-w-[44px] touch-manipulation uppercase tracking-wide',
              isMobile 
                ? 'bg-diablo-ash/40 cursor-not-allowed opacity-50 text-diablo-parchment/40 border border-diablo-ash/60' 
                : 'diablo-button transform hover:scale-105 cursor-pointer'
            ]"
            :disabled="isMobile"
            :title="isMobile ? 'Chat transcript not available on mobile' : `View chat transcript (${event.chat.length} messages)`"
            style="touch-action: manipulation;"
          >
            <span class="text-base mobile:text-sm">💬</span>
            <span class="text-sm mobile:text-xs font-semibold drop-shadow-[0_2px_6px_rgba(214,168,96,0.4)]">
              {{ isMobile ? 'Not available in mobile' : `View Chat Transcript (${event.chat.length} messages)` }}
            </span>
          </button>
        </div>
      </div>
    </div>
    <!-- Chat Modal -->
    <ChatTranscriptModal 
      v-if="event.chat && event.chat.length > 0"
      :is-open="showChatModal"
      :chat="event.chat"
      @close="showChatModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent } from '../types';
import { useMediaQuery } from '../composables/useMediaQuery';
import ChatTranscriptModal from './ChatTranscriptModal.vue';

const props = defineProps<{
  event: HookEvent;
  gradientClass: string;
  colorClass: string;
  appGradientClass: string;
  appColorClass: string;
  appHexColor: string;
}>();

const isExpanded = ref(false);
const showChatModal = ref(false);
const copyButtonText = ref('📋 Copy');

// Media query for responsive design
const { isMobile } = useMediaQuery();

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const sessionIdShort = computed(() => {
  return props.event.session_id.slice(0, 8);
});

const hookEmoji = computed(() => {
  const emojiMap: Record<string, string> = {
    'PreToolUse': '🔧',
    'PostToolUse': '✅',
    'Notification': '🔔',
    'Stop': '🛑',
    'SubagentStop': '👥',
    'PreCompact': '📦',
    'UserPromptSubmit': '💬'
  };
  return emojiMap[props.event.hook_event_type] || '❓';
});

const borderColorClass = computed(() => {
  // Convert bg-color-500 to border-color-500
  return props.colorClass.replace('bg-', 'border-');
});


const appBorderStyle = computed(() => {
  return {
    borderColor: props.appHexColor
  };
});

const appBgStyle = computed(() => {
  // Use the hex color with 20% opacity
  return {
    backgroundColor: props.appHexColor + '33' // Add 33 for 20% opacity in hex
  };
});

const formattedPayload = computed(() => {
  return JSON.stringify(props.event.payload, null, 2);
});

const toolInfo = computed(() => {
  const payload = props.event.payload;
  
  // Handle UserPromptSubmit events
  if (props.event.hook_event_type === 'UserPromptSubmit' && payload.prompt) {
    return {
      tool: 'Prompt:',
      detail: `"${payload.prompt.slice(0, 100)}${payload.prompt.length > 100 ? '...' : ''}"`
    };
  }
  
  // Handle tool-based events
  if (payload.tool_name) {
    const info: { tool: string; detail?: string } = { tool: payload.tool_name };
    
    if (payload.tool_input) {
      if (payload.tool_input.command) {
        info.detail = payload.tool_input.command.slice(0, 50) + (payload.tool_input.command.length > 50 ? '...' : '');
      } else if (payload.tool_input.file_path) {
        info.detail = payload.tool_input.file_path.split('/').pop();
      } else if (payload.tool_input.pattern) {
        info.detail = payload.tool_input.pattern;
      }
    }
    
    return info;
  }
  
  return null;
});

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPayload.value);
    copyButtonText.value = '✅ Copied!';
    setTimeout(() => {
      copyButtonText.value = '📋 Copy';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonText.value = '❌ Failed';
    setTimeout(() => {
      copyButtonText.value = '📋 Copy';
    }, 2000);
  }
};
</script>
