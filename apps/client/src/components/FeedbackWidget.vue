<template>
  <div ref="feedbackContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { FeedbackProvider } from 'annotated-feedback/widget';
import 'annotated-feedback/widget/styles';

const props = defineProps<{
  convexUrl: string;
  project: string;
  enabled?: boolean;
  hotkey?: string;
  showButton?: boolean;
}>();

const feedbackContainer = ref<HTMLDivElement | null>(null);
let reactRoot: Root | null = null;

onMounted(() => {
  if (!feedbackContainer.value) return;

  // Create React root and mount the FeedbackProvider
  reactRoot = createRoot(feedbackContainer.value);

  // Use React.createElement with Fragment as children to satisfy type requirements
  reactRoot.render(
    React.createElement(
      FeedbackProvider,
      {
        convexUrl: props.convexUrl,
        project: props.project,
        enabled: props.enabled ?? true,
        hotkey: props.hotkey ?? 'Alt+F',
        showButton: props.showButton ?? false,
        getContext: () => ({
          route: window.location.pathname,
          url: window.location.href,
          env: import.meta.env.MODE,
        }),
        children: React.createElement(React.Fragment, null) // Satisfy children requirement
      }
    )
  );
});

onBeforeUnmount(() => {
  // Clean up React root when Vue component unmounts
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
});
</script>
