# Vue Integration Guide: Agent Status Visualization

## Overview

This guide provides practical implementation instructions for integrating the agent status visualization design into the existing SubagentComms.vue component.

## Implementation Strategy

### Phase 1: Extend Data Structures

First, extend the existing interfaces to include metadata fields:

```typescript
// Add to apps/client/src/types.ts or create new interface file
interface EnhancedSubagent extends Subagent {
  // Status tracking
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused';
  
  // Timing metadata
  startTime?: number;
  endTime?: number;
  duration?: number;
  estimatedCompletion?: number;
  
  // Performance metadata
  toolCount?: number;
  tokenUsage?: number;
  resourceUsage?: {
    cpu: number;  // 0-100
    memory: number; // 0-100
  };
  
  // Progress tracking
  progress?: number; // 0-100 for determinate tasks
  lastActivity?: number;
  
  // Additional context
  description?: string;
  tags?: string[];
}
```

### Phase 2: Create Composable Utilities

Create a composable for status management:

```typescript
// apps/client/src/composables/useAgentStatus.ts
import { computed, ref } from 'vue'

export function useAgentStatus() {
  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        color: '#a78bfa',
        icon: 'pending',
        label: 'Queued',
        bgClass: 'bg-violet-400/10',
        textClass: 'text-violet-400',
        borderClass: 'border-violet-400/20'
      },
      running: {
        color: '#38bdf8',
        icon: 'running',
        label: 'Running',
        bgClass: 'bg-sky-400/10',
        textClass: 'text-sky-400',
        borderClass: 'border-sky-400/20'
      },
      completed: {
        color: '#34d399',
        icon: 'completed',
        label: 'Done',
        bgClass: 'bg-emerald-400/10',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-400/20'
      },
      error: {
        color: '#f87171',
        icon: 'error',
        label: 'Error',
        bgClass: 'bg-red-400/10',
        textClass: 'text-red-400',
        borderClass: 'border-red-400/20'
      },
      paused: {
        color: '#fbbf24',
        icon: 'paused',
        label: 'Paused',
        bgClass: 'bg-amber-400/10',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-400/20'
      }
    }
    return configs[status] || configs.pending
  }

  const getToolCountSize = (count: number) => {
    if (count < 10) return 'xs'
    if (count < 100) return 'sm'
    return 'md'
  }

  const getTokenUsageIntensity = (usage: number) => {
    if (usage < 25) return 'low'
    if (usage < 50) return 'medium'
    if (usage < 75) return 'high'
    return 'extreme'
  }

  const formatDuration = (duration: number) => {
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const calculateProgress = (startTime: number, estimatedCompletion?: number) => {
    if (!estimatedCompletion) return null
    
    const now = Date.now()
    const elapsed = now - startTime
    const total = estimatedCompletion - startTime
    
    return Math.min(Math.max((elapsed / total) * 100, 0), 100)
  }

  return {
    getStatusConfig,
    getToolCountSize,
    getTokenUsageIntensity,
    formatDuration,
    calculateProgress
  }
}
```

### Phase 3: Create Component Library

#### StatusIndicator.vue
```vue
<template>
  <div class="flex items-center gap-2">
    <div 
      class="status-icon"
      :class="[
        `status-icon--${status}`,
        config.bgClass
      ]"
      :aria-label="config.label"
      role="img"
    >
      <div class="status-icon-inner" :class="config.textClass">
        <!-- Icon shapes implemented via CSS -->
      </div>
    </div>
    <span 
      v-if="showLabel" 
      class="text-xs font-medium"
      :class="config.textClass"
    >
      {{ config.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStatus } from '../composables/useAgentStatus'

interface Props {
  status: string
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: false
})

const { getStatusConfig } = useAgentStatus()
const config = computed(() => getStatusConfig(props.status))
</script>

<style scoped>
.status-icon {
  @apply w-4 h-4 rounded-full flex items-center justify-center relative;
  @apply border transition-all duration-150 ease-out;
}

.status-icon--pending {
  @apply border-violet-400/40 bg-transparent;
}

.status-icon--pending .status-icon-inner {
  @apply w-2 h-2 border border-violet-400 rounded-full;
}

.status-icon--running {
  background: conic-gradient(from 0deg, theme('colors.sky.400') 0 270deg, transparent 270deg 360deg);
  animation: spin 1.2s linear infinite;
}

.status-icon--completed {
  @apply bg-emerald-400 border-emerald-400;
}

.status-icon--completed::after {
  content: '';
  @apply absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 3px;
  border-left: 2px solid #000;
  border-bottom: 2px solid #000;
  transform: translate(-50%, -60%) rotate(-45deg);
}

.status-icon--error {
  @apply bg-red-400 border-red-400;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.status-icon--paused {
  @apply bg-amber-400 border-amber-400;
}

.status-icon--paused::before,
.status-icon--paused::after {
  content: '';
  @apply absolute bg-black;
  width: 2px;
  height: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.status-icon--paused::before {
  left: 4px;
}

.status-icon--paused::after {
  right: 4px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .status-icon--running {
    animation: none;
  }
}
</style>
```

#### ToolCountBadge.vue
```vue
<template>
  <div 
    class="tool-badge"
    :class="[
      `tool-badge--${size}`,
      { 'tool-badge--empty': count === 0 }
    ]"
    :title="`${count} tools used`"
  >
    {{ displayCount }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStatus } from '../composables/useAgentStatus'

interface Props {
  count: number
}

const props = defineProps<Props>()

const { getToolCountSize } = useAgentStatus()

const size = computed(() => getToolCountSize(props.count))

const displayCount = computed(() => {
  if (props.count === 0) return '-'
  if (props.count > 999) return '999+'
  return props.count.toString()
})
</script>

<style scoped>
.tool-badge {
  @apply inline-flex items-center justify-center;
  @apply bg-gray-700 border border-gray-600;
  @apply text-gray-300 font-semibold;
  @apply rounded transition-all duration-150;
  font-size: 10px;
  line-height: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
}

.tool-badge--xs {
  min-width: 16px;
}

.tool-badge--sm {
  min-width: 20px;
  height: 18px;
}

.tool-badge--md {
  min-width: 24px;
  height: 20px;
  font-weight: 700;
  @apply text-blue-300;
}

.tool-badge--empty {
  @apply text-gray-500 border-gray-700;
}

.tool-badge:hover {
  @apply border-gray-500;
}
</style>
```

#### ProgressIndicator.vue
```vue
<template>
  <div class="progress-container">
    <!-- Determinate progress -->
    <div 
      v-if="progress !== null" 
      class="progress-bar-container"
      role="progressbar"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`Progress: ${progress}%`"
    >
      <div 
        class="progress-bar"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
    
    <!-- Indeterminate progress -->
    <div 
      v-else-if="status === 'running'"
      class="progress-shimmer-container"
      aria-busy="true"
      aria-live="polite"
      aria-label="Processing"
    >
      <div class="progress-shimmer"></div>
    </div>
    
    <!-- Static state for completed/error -->
    <div 
      v-else
      class="progress-static"
      :class="{
        'progress-static--completed': status === 'completed',
        'progress-static--error': status === 'error'
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  status: string
  progress?: number | null
}

defineProps<Props>()
</script>

<style scoped>
.progress-container {
  @apply w-full h-2 rounded-sm overflow-hidden relative;
  background: rgba(255, 255, 255, 0.05);
}

.progress-bar-container {
  @apply w-full h-full relative;
}

.progress-bar {
  @apply h-full rounded-sm transition-all duration-300 ease-out;
  background: theme('colors.sky.400');
}

.progress-shimmer-container {
  @apply w-full h-full relative;
}

.progress-shimmer {
  @apply absolute inset-0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(56, 189, 248, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

.progress-static {
  @apply w-full h-full rounded-sm;
}

.progress-static--completed {
  background: theme('colors.emerald.400');
}

.progress-static--error {
  background: theme('colors.red.400');
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

@media (prefers-reduced-motion: reduce) {
  .progress-shimmer {
    animation: none;
    background: rgba(56, 189, 248, 0.2);
  }
}
</style>
```

### Phase 4: Update SubagentComms.vue

Replace the existing agent card structure:

```vue
<template>
  <div class="flex-grow overflow-hidden p-4 bg-gray-800">
    <!-- ... existing session selector ... -->
    
    <div v-if="selectedSessionId" class="flex-grow flex space-x-4">
      <!-- Enhanced Subagents List -->
      <div class="w-1/3 bg-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-white font-bold">Active Subagents</h3>
          <div class="text-xs text-gray-400">
            {{ subagents.length }} agents
          </div>
        </div>
        
        <div class="space-y-3 max-h-96 overflow-y-auto">
          <div 
            v-for="agent in enhancedSubagents" 
            :key="agent.id"
            class="agent-card bg-gray-800 rounded-lg border border-gray-600/50 
                   hover:border-gray-500/50 transition-colors duration-200"
          >
            <!-- Agent Header -->
            <div class="p-3 pb-2">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <StatusIndicator :status="agent.status" />
                  <div class="min-w-0 flex-1">
                    <h4 class="text-white font-medium text-sm truncate">
                      {{ agent.name }}
                    </h4>
                    <p class="text-gray-400 text-xs">
                      {{ agent.subagent_type }}
                    </p>
                  </div>
                </div>
                
                <!-- Metadata badges -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <ToolCountBadge 
                    v-if="agent.toolCount !== undefined"
                    :count="agent.toolCount" 
                  />
                  <TokenUsageIndicator 
                    v-if="agent.tokenUsage !== undefined"
                    :usage="agent.tokenUsage"
                  />
                </div>
              </div>
              
              <!-- Progress visualization -->
              <ProgressIndicator 
                :status="agent.status"
                :progress="agent.progress"
                class="mb-2"
              />
              
              <!-- Timing information -->
              <div class="flex justify-between items-center text-xs text-gray-500">
                <span v-if="agent.duration">
                  {{ formatDuration(agent.duration) }}
                </span>
                <span v-else-if="agent.startTime">
                  {{ formatDuration(Date.now() - agent.startTime) }} elapsed
                </span>
                <span v-else>
                  {{ new Date(agent.created_at).toLocaleTimeString() }}
                </span>
                
                <span v-if="agent.estimatedCompletion && agent.status === 'running'">
                  ETA {{ formatTimeRemaining(agent.estimatedCompletion) }}
                </span>
              </div>
            </div>
          </div>
          
          <div v-if="subagents.length === 0" 
               class="text-gray-400 italic text-center py-8">
            No subagents registered yet
          </div>
        </div>
      </div>
      
      <!-- ... existing messages panel ... -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import StatusIndicator from './StatusIndicator.vue'
import ToolCountBadge from './ToolCountBadge.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import TokenUsageIndicator from './TokenUsageIndicator.vue'
import { useAgentStatus } from '../composables/useAgentStatus'

// ... existing interfaces and props ...

const { formatDuration, calculateProgress } = useAgentStatus()

// Mock enhancement function - replace with actual data fetching
const enhancedSubagents = computed(() => {
  return subagents.value.map(agent => ({
    ...agent,
    // Mock status based on timing or other heuristics
    status: mockStatus(agent),
    toolCount: Math.floor(Math.random() * 50),
    tokenUsage: Math.floor(Math.random() * 100),
    duration: Date.now() - agent.created_at,
    progress: agent.status === 'running' ? Math.floor(Math.random() * 100) : null
  }))
})

const mockStatus = (agent: Subagent) => {
  const age = Date.now() - agent.created_at
  if (age < 5000) return 'pending'
  if (age < 30000) return 'running'
  return Math.random() > 0.8 ? 'error' : 'completed'
}

const formatTimeRemaining = (eta: number) => {
  const remaining = eta - Date.now()
  return formatDuration(Math.max(remaining, 0))
}

// ... existing script content ...
</script>

<style scoped>
.agent-card {
  transition: all 0.2s ease-out;
}

.agent-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
```

### Phase 5: Server-Side Integration

To fully implement this design, you'll need to extend the server endpoints to provide metadata:

```typescript
// Add to apps/server/src/types.ts
export interface EnhancedSubagent extends Subagent {
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused';
  startTime?: number;
  endTime?: number;
  toolCount?: number;
  tokenUsage?: number;
  progress?: number;
}
```

## Performance Considerations

### 1. Update Throttling
- Batch status updates to avoid excessive re-renders
- Use `requestAnimationFrame` for smooth animations
- Implement debouncing for rapid status changes

### 2. Memory Management
- Clean up intervals and animations on component unmount
- Use `Object.freeze()` for immutable status configs
- Implement virtual scrolling for large agent lists

### 3. Accessibility Optimizations
- Use `aria-live` regions for status announcements
- Provide keyboard navigation for status filters
- Ensure animations respect `prefers-reduced-motion`

## Testing Strategy

### Unit Tests
- Test status calculation logic
- Verify accessibility attributes
- Test duration formatting functions

### Integration Tests
- Test component communication
- Verify WebSocket updates trigger re-renders
- Test responsive behavior

### Visual Regression Tests
- Capture status indicator states
- Test theme variations
- Verify animation behavior

This integration guide provides a complete implementation path while maintaining backward compatibility and following Vue.js best practices.