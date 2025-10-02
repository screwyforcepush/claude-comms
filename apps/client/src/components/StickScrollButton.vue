<template>
  <button
    @click="$emit('toggle')"
    class="fixed bottom-6 right-6 mobile:bottom-4 mobile:right-4 p-4 mobile:p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center border-2 transform hover:scale-110"
    :class="[
      stickToBottom 
        ? 'bg-gradient-to-r from-diablo-blood to-diablo-brass text-diablo-parchment border-diablo-brass drop-shadow-[0_0_16px_rgba(214,168,96,0.45)]' 
        : 'bg-diablo-ash/90 hover:bg-diablo-ash text-diablo-parchment border-diablo-ash/80 hover:border-diablo-brass/50'
    ]"
    :title="stickToBottom ? 'Disable auto-scroll' : 'Enable auto-scroll'"
  >
    <svg
      class="w-6 h-6 mobile:w-5 mobile:h-5 drop-shadow-sm"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        v-if="stickToBottom"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
      <path
        v-else
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6v.01"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  stickToBottom: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>
