# Timeline Scroll Behavior UX Guidelines

**Designer**: EmmaFlux  
**Date**: 2025-08-15  
**Context**: UI/UX considerations for timeline order reversal and scroll behavior

## Overview

When reversing timeline order from "latest-at-bottom" to "latest-at-top", the scroll behavior and auto-stick functionality requires UX adjustments to maintain intuitive user experience.

## Current Scroll Behavior Analysis

### Existing Implementation (EventTimeline.vue)

```typescript
// Current stickToBottom behavior
const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

watch(() => props.events.length, async () => {
  if (props.stickToBottom) {
    await nextTick();
    scrollToBottom();
  }
});
```

**Current UX Pattern**:
- Latest events at bottom
- Auto-scroll to bottom on new events
- "Stick to bottom" keeps user viewing latest content
- Natural for chat-like interfaces

## Reversed Order UX Requirements

### New Scroll Behavior for Latest-at-Top

```typescript
// Updated scroll behavior for reversed timeline
const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  }
};

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

// Dynamic scroll target based on order mode
const scrollToLatest = () => {
  if (orderMode.value === 'newest-first') {
    scrollToTop();
  } else {
    scrollToBottom();
  }
};

watch(() => props.events.length, async () => {
  if (props.stickToLatest) {
    await nextTick();
    scrollToLatest();
  }
});
```

### Updated Scroll Detection Logic

```typescript
const handleScroll = () => {
  if (!scrollContainer.value) return;
  
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  
  if (orderMode.value === 'newest-first') {
    // Latest at top - check if near top
    const isAtTop = scrollTop < 50;
    if (isAtTop !== props.stickToLatest) {
      emit('update:stickToLatest', isAtTop);
    }
  } else {
    // Latest at bottom - check if near bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isAtBottom !== props.stickToLatest) {
      emit('update:stickToLatest', isAtBottom);
    }
  }
};
```

## Visual Scroll Indicators

### Smart Scroll Hints

```vue
<template>
  <div class="timeline-scroll-container">
    <!-- Scroll position indicator -->
    <div 
      v-if="showScrollHint"
      class="scroll-position-hint"
      :class="scrollHintClass"
    >
      <span class="hint-icon">{{ scrollHintIcon }}</span>
      <span class="hint-text">{{ scrollHintText }}</span>
    </div>

    <!-- Auto-stick toggle -->
    <div class="auto-stick-control">
      <button
        @click="toggleAutoStick"
        class="auto-stick-button"
        :class="{ active: stickToLatest }"
        :title="autoStickTooltip"
      >
        <span class="stick-icon">{{ stickIcon }}</span>
        <span class="stick-label">{{ stickLabel }}</span>
      </button>
    </div>

    <!-- Timeline content -->
    <div 
      ref="scrollContainer"
      class="timeline-content"
      @scroll="handleScroll"
    >
      <!-- Events -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  orderMode: 'newest-first' | 'oldest-first';
  stickToLatest: boolean;
  hasNewEvents: boolean;
}>();

const scrollHintIcon = computed(() => 
  props.orderMode === 'newest-first' ? '↑' : '↓'
);

const scrollHintText = computed(() => 
  props.orderMode === 'newest-first' 
    ? 'Latest events above' 
    : 'Latest events below'
);

const scrollHintClass = computed(() => ({
  'hint-top': props.orderMode === 'newest-first',
  'hint-bottom': props.orderMode === 'oldest-first',
  'has-new-events': props.hasNewEvents
}));

const stickIcon = computed(() => 
  props.orderMode === 'newest-first' ? '📌' : '📌'
);

const stickLabel = computed(() => 
  props.stickToLatest 
    ? (props.orderMode === 'newest-first' ? 'Stick to Top' : 'Stick to Bottom')
    : 'Auto-scroll Off'
);

const autoStickTooltip = computed(() => 
  props.stickToLatest 
    ? `Auto-scroll to ${props.orderMode === 'newest-first' ? 'top' : 'bottom'} for new events`
    : 'Enable auto-scroll for new events'
);
</script>
```

### Scroll Position Styling

```css
/* Scroll position hints */
.scroll-position-hint {
  position: absolute;
  right: 16px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  color: #e5e7eb;
  font-size: 12px;
  font-weight: 500;
  z-index: 100;
  opacity: 0;
  transform: scale(0.95);
  transition: all 300ms ease;
  pointer-events: none;
}

.scroll-position-hint.hint-top {
  top: 16px;
  animation: slide-from-top 300ms ease-out;
}

.scroll-position-hint.hint-bottom {
  bottom: 16px;
  animation: slide-from-bottom 300ms ease-out;
}

.scroll-position-hint.has-new-events {
  opacity: 1;
  transform: scale(1);
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.hint-icon {
  font-size: 14px;
  margin-right: 6px;
  color: #00d4ff;
}

/* Auto-stick control */
.auto-stick-control {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 110;
}

.auto-stick-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(55, 65, 81, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 6px;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.auto-stick-button:hover {
  background: rgba(55, 65, 81, 1);
  border-color: rgba(59, 130, 246, 0.4);
  color: #e5e7eb;
  transform: scale(1.02);
}

.auto-stick-button.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.stick-icon {
  font-size: 12px;
}

/* Animation keyframes */
@keyframes slide-from-top {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slide-from-bottom {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

## Smart Auto-Scroll Behavior

### Context-Aware Scrolling

```typescript
// Enhanced auto-scroll logic
export function useSmartScroll(orderMode: Ref<string>) {
  const isUserScrolling = ref(false);
  const lastScrollTime = ref(0);
  const scrollTimeout = ref<number | null>(null);

  const detectUserScroll = () => {
    isUserScrolling.value = true;
    lastScrollTime.value = Date.now();
    
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value);
    }
    
    scrollTimeout.value = setTimeout(() => {
      isUserScrolling.value = false;
    }, 2000); // 2 seconds of inactivity
  };

  const shouldAutoScroll = computed(() => {
    const timeSinceLastScroll = Date.now() - lastScrollTime.value;
    return !isUserScrolling.value && timeSinceLastScroll > 1000;
  });

  const smartScrollToLatest = (container: HTMLElement) => {
    if (!shouldAutoScroll.value) return;

    if (orderMode.value === 'newest-first') {
      // Smooth scroll to top for newest-first
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Smooth scroll to bottom for oldest-first
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  return {
    detectUserScroll,
    smartScrollToLatest,
    shouldAutoScroll
  };
}
```

### New Event Notification

```vue
<template>
  <!-- New event notification banner -->
  <div 
    v-if="hasNewEventsOffscreen"
    class="new-events-notification"
    :class="notificationClass"
    @click="scrollToLatest"
  >
    <span class="notification-icon">{{ notificationIcon }}</span>
    <span class="notification-text">
      {{ newEventCount }} new {{ newEventCount === 1 ? 'event' : 'events' }}
    </span>
    <span class="notification-action">{{ actionText }}</span>
  </div>
</template>

<script setup lang="ts">
const notificationClass = computed(() => ({
  'notification-top': props.orderMode === 'newest-first',
  'notification-bottom': props.orderMode === 'oldest-first'
}));

const notificationIcon = computed(() => 
  props.orderMode === 'newest-first' ? '↑' : '↓'
);

const actionText = computed(() => 
  props.orderMode === 'newest-first' ? 'Scroll to top' : 'Scroll to bottom'
);
</script>
```

```css
/* New events notification */
.new-events-notification {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  z-index: 120;
  box-shadow: 
    0 4px 16px rgba(59, 130, 246, 0.4),
    0 0 12px rgba(59, 130, 246, 0.3);
  animation: notification-appear 300ms ease-out;
  transition: all 200ms ease;
}

.new-events-notification:hover {
  transform: translateX(-50%) scale(1.02);
  box-shadow: 
    0 6px 20px rgba(59, 130, 246, 0.5),
    0 0 16px rgba(59, 130, 246, 0.4);
}

.new-events-notification.notification-top {
  top: 60px; /* Below header */
}

.new-events-notification.notification-bottom {
  bottom: 16px;
}

.notification-icon {
  margin-right: 8px;
  font-size: 16px;
}

.notification-action {
  margin-left: 8px;
  opacity: 0.8;
  font-size: 12px;
}

@keyframes notification-appear {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
```

## Accessibility Considerations

### Screen Reader Support

```html
<!-- Accessible scroll behavior announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  <span v-if="announceScrollChange">
    Timeline order changed to {{ orderMode === 'newest-first' ? 'newest first' : 'oldest first' }}.
    {{ autoScrollEnabled ? 'Auto-scroll enabled.' : 'Auto-scroll disabled.' }}
  </span>
</div>

<div aria-live="assertive" aria-atomic="true" class="sr-only">
  <span v-if="announceNewEvents">
    {{ newEventCount }} new {{ newEventCount === 1 ? 'event' : 'events' }} added.
    {{ autoScrollEnabled ? 'Automatically scrolled to latest.' : 'Use scroll controls to view latest events.' }}
  </span>
</div>
```

### Keyboard Navigation

```typescript
// Enhanced keyboard support for scroll behavior
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Home':
      event.preventDefault();
      if (orderMode.value === 'newest-first') {
        scrollToTop(); // Go to latest
      } else {
        scrollToBottom(); // Go to latest
      }
      break;
      
    case 'End':
      event.preventDefault();
      if (orderMode.value === 'newest-first') {
        scrollToBottom(); // Go to oldest
      } else {
        scrollToTop(); // Go to oldest
      }
      break;
      
    case 'PageUp':
      event.preventDefault();
      scrollByPage(-1);
      break;
      
    case 'PageDown':
      event.preventDefault();
      scrollByPage(1);
      break;
  }
};
```

## Implementation Priority

### Phase 1: Basic Scroll Adaptation
1. Update scroll direction logic for reversed order
2. Implement smart auto-scroll behavior
3. Add basic scroll position hints

### Phase 2: Enhanced UX
1. New event notifications
2. Auto-stick toggle controls
3. Smooth scroll animations

### Phase 3: Advanced Features
1. Keyboard navigation enhancement
2. Accessibility announcements
3. User preference persistence

This scroll behavior guide ensures that timeline order reversal maintains intuitive user experience while providing clear visual feedback about the new chronological arrangement.