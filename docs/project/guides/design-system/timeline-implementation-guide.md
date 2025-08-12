# Agent Timeline Visualization - Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the Agent Timeline Visualization component, designed to display multi-agent spawning, messaging, and batch execution patterns with real-time updates.

## Prerequisites
- Vue 3 with Composition API
- TypeScript support
- Tailwind CSS (already configured)
- Existing WebSocket connection via `useWebSocket` composable
- SVG knowledge for timeline rendering

## File Structure
```
src/
├── components/
│   ├── AgentTimeline.vue              # Main timeline component
│   ├── TimelineControls.vue           # Scale/zoom controls
│   ├── TimelineTooltip.vue            # Hover tooltips
│   └── MessageDetailPane.vue          # Side panel for messages
├── composables/
│   ├── useAgentColors.ts              # Agent color system
│   ├── useTimelineData.ts             # Data processing
│   ├── useTimelineInteraction.ts      # Click/hover logic
│   └── useTimelineAnimation.ts        # Animation controls
└── styles/
    └── timeline.css                   # Component styles (provided)
```

## 1. Data Structures & Types

### Extend Existing Types
```typescript
// Add to existing types.ts
export interface AgentTimelineEvent {
  id: string;
  type: 'agent_spawn' | 'agent_message' | 'agent_complete' | 'batch_start' | 'batch_end' | 'user_prompt';
  agent_id: string;
  agent_type: 'orchestrator' | 'coder' | 'architect' | 'reviewer' | 'tester' | 'verifier' | 'planner' | 'analyst' | 'researcher' | 'designer' | 'deployer';
  timestamp: number;
  session_id: string;
  batch_id?: string;
  message_content?: string;
  target_agent?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
  x?: number; // Timeline x position (calculated)
  y?: number; // Timeline y position (calculated)
}

export interface BatchGroup {
  id: string;
  batch_id: string;
  start_time: number;
  end_time?: number;
  agents: string[];
  status: 'active' | 'completed' | 'error';
}

export interface TimelineViewport {
  startTime: number;
  endTime: number;
  scale: 'true_time' | 'equidistant';
  zoom: number;
  scrollLeft: number;
}

export interface TimelineInteraction {
  selectedAgents: string[];
  hoveredElement?: AgentTimelineEvent;
  messageDetailAgent?: string;
  tooltipPosition?: { x: number; y: number };
}
```

## 2. Color System Implementation

### Create useAgentColors Composable
```typescript
// src/composables/useAgentColors.ts
export function useAgentColors() {
  const agentTypeColors = {
    orchestrator: '#00d4ff',
    coder: '#ff6b6b',
    architect: '#4ecdc4',
    reviewer: '#95e77e',
    tester: '#ffd93d',
    verifier: '#a78bfa',
    planner: '#f97316',
    analyst: '#ec4899',
    researcher: '#06b6d4',
    designer: '#8b5cf6',
    deployer: '#22c55e'
  } as const;

  const statusColors = {
    pending: '#6b7280',
    'in_progress': '#3b82f6',
    completed: '#22c55e',
    error: '#ef4444'
  } as const;

  const getAgentColor = (agentType: string): string => {
    return agentTypeColors[agentType as keyof typeof agentTypeColors] || '#3b82f6';
  };

  const getStatusColor = (status: string): string => {
    return statusColors[status as keyof typeof statusColors] || statusColors.pending;
  };

  const getAgentGlowFilter = (agentType: string): string => {
    const color = getAgentColor(agentType);
    return `drop-shadow(0 0 8px ${color})`;
  };

  return {
    agentTypeColors,
    statusColors,
    getAgentColor,
    getStatusColor,
    getAgentGlowFilter
  };
}
```

## 3. Data Processing Composable

### Create useTimelineData Composable
```typescript
// src/composables/useTimelineData.ts
import { computed, ref, watch } from 'vue';
import type { AgentTimelineEvent, BatchGroup, TimelineViewport } from '../types';

export function useTimelineData(events: Ref<AgentTimelineEvent[]>) {
  const viewport = ref<TimelineViewport>({
    startTime: 0,
    endTime: 0,
    scale: 'true_time',
    zoom: 1,
    scrollLeft: 0
  });

  // Calculate timeline dimensions
  const timelineWidth = 1200;
  const timelineHeight = 400;
  const orchestratorY = 200;
  const agentLaneHeight = 40;

  // Process events into timeline positions
  const processedEvents = computed(() => {
    if (events.value.length === 0) return [];

    const sortedEvents = [...events.value].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sortedEvents[0]?.timestamp || Date.now();
    const endTime = sortedEvents[sortedEvents.length - 1]?.timestamp || Date.now();
    const timeRange = endTime - startTime || 1;

    // Update viewport
    viewport.value.startTime = startTime;
    viewport.value.endTime = endTime;

    // Assign agent lanes
    const agentLanes = new Map<string, number>();
    let currentLane = 0;

    return sortedEvents.map((event, index) => {
      // Calculate X position
      let x: number;
      if (viewport.value.scale === 'equidistant') {
        x = 50 + (index / (sortedEvents.length - 1)) * (timelineWidth - 100);
      } else {
        x = 50 + ((event.timestamp - startTime) / timeRange) * (timelineWidth - 100);
      }

      // Calculate Y position
      let y: number;
      if (event.agent_type === 'orchestrator') {
        y = orchestratorY;
      } else {
        if (!agentLanes.has(event.agent_id)) {
          agentLanes.set(event.agent_id, currentLane++);
        }
        const lane = agentLanes.get(event.agent_id)!;
        y = orchestratorY - (lane + 1) * agentLaneHeight;
      }

      return {
        ...event,
        x,
        y
      };
    });
  });

  // Group events into batches
  const batchGroups = computed<BatchGroup[]>(() => {
    const batches = new Map<string, BatchGroup>();

    processedEvents.value.forEach(event => {
      if (!event.batch_id) return;

      if (!batches.has(event.batch_id)) {
        batches.set(event.batch_id, {
          id: event.batch_id,
          batch_id: event.batch_id,
          start_time: event.timestamp,
          agents: [],
          status: 'active'
        });
      }

      const batch = batches.get(event.batch_id)!;
      if (!batch.agents.includes(event.agent_id)) {
        batch.agents.push(event.agent_id);
      }

      if (event.type === 'batch_end') {
        batch.end_time = event.timestamp;
        batch.status = 'completed';
      }
    });

    return Array.from(batches.values());
  });

  // Generate SVG paths for agent lifecycles
  const agentPaths = computed(() => {
    const paths = new Map<string, string>();
    const agentEvents = new Map<string, AgentTimelineEvent[]>();

    // Group events by agent
    processedEvents.value.forEach(event => {
      if (!agentEvents.has(event.agent_id)) {
        agentEvents.set(event.agent_id, []);
      }
      agentEvents.get(event.agent_id)!.push(event);
    });

    // Generate curved paths for each agent
    agentEvents.forEach((events, agentId) => {
      if (events.length < 2) return;

      const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
      const spawn = sortedEvents[0];
      const complete = sortedEvents[sortedEvents.length - 1];

      if (spawn.agent_type === 'orchestrator') {
        // Orchestrator is a straight line
        paths.set(agentId, `M ${spawn.x},${spawn.y} L ${complete.x},${complete.y}`);
      } else {
        // Subagents have curved paths
        const midX = (spawn.x + complete.x) / 2;
        paths.set(agentId, 
          `M ${spawn.x},${orchestratorY} ` +
          `Q ${spawn.x + 20},${spawn.y + 20} ${midX},${spawn.y} ` +
          `L ${complete.x - 20},${spawn.y} ` +
          `Q ${complete.x - 20},${spawn.y + 20} ${complete.x},${orchestratorY}`
        );
      }
    });

    return paths;
  });

  const updateViewport = (changes: Partial<TimelineViewport>) => {
    viewport.value = { ...viewport.value, ...changes };
  };

  return {
    viewport: readonly(viewport),
    processedEvents,
    batchGroups,
    agentPaths,
    updateViewport,
    timelineWidth,
    timelineHeight,
    orchestratorY
  };
}
```

## 4. Interaction Handling Composable

### Create useTimelineInteraction Composable
```typescript
// src/composables/useTimelineInteraction.ts
import { ref, reactive } from 'vue';
import type { AgentTimelineEvent, TimelineInteraction } from '../types';

export function useTimelineInteraction() {
  const interaction = reactive<TimelineInteraction>({
    selectedAgents: [],
    hoveredElement: undefined,
    messageDetailAgent: undefined,
    tooltipPosition: undefined
  });

  const handleAgentHover = (event: AgentTimelineEvent, mouseEvent: MouseEvent) => {
    interaction.hoveredElement = event;
    interaction.tooltipPosition = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY
    };
  };

  const handleAgentLeave = () => {
    interaction.hoveredElement = undefined;
    interaction.tooltipPosition = undefined;
  };

  const handleAgentClick = (event: AgentTimelineEvent, shiftKey: boolean = false) => {
    if (shiftKey) {
      // Multi-select with Shift
      const index = interaction.selectedAgents.indexOf(event.agent_id);
      if (index > -1) {
        interaction.selectedAgents.splice(index, 1);
      } else {
        interaction.selectedAgents.push(event.agent_id);
      }
    } else {
      // Single select
      interaction.selectedAgents = [event.agent_id];
    }
  };

  const handleMessageClick = (event: AgentTimelineEvent) => {
    interaction.messageDetailAgent = event.agent_id;
  };

  const clearSelection = () => {
    interaction.selectedAgents = [];
  };

  const closeMessageDetail = () => {
    interaction.messageDetailAgent = undefined;
  };

  // Keyboard navigation
  const handleKeyDown = (keyEvent: KeyboardEvent) => {
    switch (keyEvent.key) {
      case 'Escape':
        clearSelection();
        closeMessageDetail();
        break;
      case 'Enter':
      case ' ':
        if (interaction.hoveredElement) {
          handleAgentClick(interaction.hoveredElement, keyEvent.shiftKey);
        }
        break;
    }
  };

  return {
    interaction: readonly(interaction),
    handleAgentHover,
    handleAgentLeave,
    handleAgentClick,
    handleMessageClick,
    clearSelection,
    closeMessageDetail,
    handleKeyDown
  };
}
```

## 5. Animation Control Composable

### Create useTimelineAnimation Composable
```typescript
// src/composables/useTimelineAnimation.ts
import { ref, watch, nextTick } from 'vue';
import type { AgentTimelineEvent } from '../types';

export function useTimelineAnimation(events: Ref<AgentTimelineEvent[]>) {
  const animationsEnabled = ref(true);
  const prefersReducedMotion = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Watch for system preference changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    prefersReducedMotion.value = e.matches;
  });

  const shouldAnimate = computed(() => {
    return animationsEnabled.value && !prefersReducedMotion.value;
  });

  const animateNewAgent = async (agentId: string) => {
    if (!shouldAnimate.value) return;

    await nextTick();
    const agentElement = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (agentElement) {
      agentElement.classList.add('timeline-animation');
      (agentElement as SVGElement).style.animationName = 'agent-spawn';
      
      setTimeout(() => {
        agentElement.classList.remove('timeline-animation');
        (agentElement as SVGElement).style.animationName = '';
      }, 300);
    }
  };

  const animateNewMessage = async (messageId: string) => {
    if (!shouldAnimate.value) return;

    await nextTick();
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      (messageElement as SVGElement).style.animationName = 'message-pulse';
      (messageElement as SVGElement).style.animationDuration = '2s';
      (messageElement as SVGElement).style.animationIterationCount = '3';
      
      setTimeout(() => {
        (messageElement as SVGElement).style.animation = '';
      }, 6000);
    }
  };

  const animateAgentCompletion = async (agentId: string) => {
    if (!shouldAnimate.value) return;

    await nextTick();
    const agentElement = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (agentElement) {
      agentElement.classList.add('timeline-animation');
      (agentElement as SVGElement).style.animationName = 'agent-complete';
      
      setTimeout(() => {
        agentElement.classList.remove('timeline-animation');
        (agentElement as SVGElement).style.animationName = '';
      }, 600);
    }
  };

  // Watch for new events and trigger animations
  let previousEventCount = 0;
  watch(events, async (newEvents) => {
    if (newEvents.length > previousEventCount) {
      const newEvent = newEvents[newEvents.length - 1];
      
      switch (newEvent.type) {
        case 'agent_spawn':
          await animateNewAgent(newEvent.agent_id);
          break;
        case 'agent_message':
          await animateNewMessage(newEvent.id);
          break;
        case 'agent_complete':
          await animateAgentCompletion(newEvent.agent_id);
          break;
      }
    }
    
    previousEventCount = newEvents.length;
  }, { deep: true });

  const toggleAnimations = () => {
    animationsEnabled.value = !animationsEnabled.value;
    
    // Apply CSS class to disable animations
    const container = document.querySelector('.timeline-container');
    if (container) {
      container.classList.toggle('animations-disabled', !animationsEnabled.value);
    }
  };

  return {
    animationsEnabled: readonly(animationsEnabled),
    prefersReducedMotion: readonly(prefersReducedMotion),
    shouldAnimate,
    animateNewAgent,
    animateNewMessage,
    animateAgentCompletion,
    toggleAnimations
  };
}
```

## 6. Main Timeline Component

### Create AgentTimeline.vue
```vue
<template>
  <div class="timeline-container" :class="{ 'animations-disabled': !shouldAnimate }">
    <!-- Timeline Controls -->
    <TimelineControls 
      :viewport="viewport"
      :animations-enabled="animationsEnabled"
      @update-viewport="updateViewport"
      @toggle-animations="toggleAnimations"
    />
    
    <!-- Timeline SVG -->
    <div class="timeline-viewport" ref="timelineViewport">
      <svg 
        :width="timelineWidth" 
        :height="timelineHeight"
        class="timeline-svg"
        role="img"
        :aria-labelledby="timelineId + '-title'"
        :aria-describedby="timelineId + '-desc'"
        @keydown="handleKeyDown"
        tabindex="0"
      >
        <title :id="timelineId + '-title'">Agent Timeline Visualization</title>
        <desc :id="timelineId + '-desc'">
          Interactive timeline showing {{ processedEvents.length }} agent events across {{ Object.keys(agentPaths).length }} agents
        </desc>
        
        <!-- Grid lines -->
        <g class="grid-lines">
          <line 
            v-for="x in gridLines" 
            :key="`grid-${x}`"
            :x1="x" 
            :y1="50" 
            :x2="x" 
            :y2="timelineHeight - 50"
            class="grid-line"
          />
        </g>
        
        <!-- Time axis labels -->
        <g class="time-labels">
          <text
            v-for="(time, index) in timeLabels"
            :key="`time-${index}`"
            :x="time.x"
            :y="timelineHeight - 20"
            class="time-label"
          >
            {{ time.label }}
          </text>
        </g>
        
        <!-- Orchestrator line -->
        <line 
          :x1="50" 
          :y1="orchestratorY" 
          :x2="timelineWidth - 50" 
          :y2="orchestratorY"
          class="orchestrator-line"
        />
        
        <!-- Batch groupings -->
        <g class="batch-groups">
          <g 
            v-for="batch in batchGroups" 
            :key="batch.id"
            class="batch-group"
            :class="{ active: batch.status === 'active' }"
          >
            <rect
              :x="getBatchX(batch) - 10"
              :y="getBatchY(batch) - 10"
              :width="getBatchWidth(batch) + 20"
              :height="getBatchHeight(batch) + 20"
              class="batch-group"
              rx="8"
            />
            <text
              :x="getBatchX(batch)"
              :y="getBatchY(batch) - 15"
              class="batch-label"
            >
              Batch {{ batch.id }}
            </text>
          </g>
        </g>
        
        <!-- Agent lifecycle paths -->
        <g class="agent-paths" role="list" aria-label="Agent lifecycles">
          <path
            v-for="(path, agentId) in agentPaths"
            :key="`path-${agentId}`"
            :d="path"
            :class="[
              'agent-line',
              `agent-${getAgentType(agentId)}`,
              { 
                selected: interaction.selectedAgents.includes(agentId),
                'multi-selected': interaction.selectedAgents.length > 1 && interaction.selectedAgents.includes(agentId)
              }
            ]"
            :data-agent-id="agentId"
            role="listitem"
            :aria-label="getAgentAriaLabel(agentId)"
            tabindex="0"
            @click="(e) => handleAgentClick(getAgentById(agentId), e.shiftKey)"
            @mouseenter="(e) => handleAgentHover(getAgentById(agentId), e)"
            @mouseleave="handleAgentLeave"
            @focus="(e) => handleAgentHover(getAgentById(agentId), e)"
            @blur="handleAgentLeave"
          />
        </g>
        
        <!-- User prompts -->
        <g class="user-prompts">
          <circle
            v-for="event in userPrompts"
            :key="`prompt-${event.id}`"
            :cx="event.x"
            :cy="event.y"
            r="5"
            class="user-prompt"
            @click="handleAgentClick(event)"
          />
        </g>
        
        <!-- Spawn points -->
        <g class="spawn-points">
          <circle
            v-for="event in spawnPoints"
            :key="`spawn-${event.id}`"
            :cx="event.x"
            :cy="event.y"
            r="5"
            class="spawn-point"
            @click="handleAgentClick(event)"
          />
        </g>
        
        <!-- Agent labels -->
        <g class="agent-labels">
          <text
            v-for="(label, agentId) in agentLabels"
            :key="`label-${agentId}`"
            :x="label.x"
            :y="label.y - 10"
            :class="[
              'agent-label',
              { highlighted: interaction.selectedAgents.includes(agentId) }
            ]"
          >
            {{ label.text }}
          </text>
        </g>
        
        <!-- Message dots -->
        <g class="message-dots" role="list" aria-label="Inter-agent messages">
          <circle
            v-for="event in messageEvents"
            :key="`message-${event.id}`"
            :cx="event.x"
            :cy="event.y"
            :r="getMessageRadius(event)"
            class="message-dot"
            :data-message-id="event.id"
            role="listitem"
            :aria-label="getMessageAriaLabel(event)"
            tabindex="0"
            @click="handleMessageClick(event)"
            @mouseenter="(e) => handleAgentHover(event, e)"
            @mouseleave="handleAgentLeave"
          />
        </g>
      </svg>
    </div>
    
    <!-- Tooltip -->
    <TimelineTooltip 
      v-if="interaction.hoveredElement && interaction.tooltipPosition"
      :event="interaction.hoveredElement"
      :position="interaction.tooltipPosition"
    />
    
    <!-- Message Detail Pane -->
    <MessageDetailPane
      :open="!!interaction.messageDetailAgent"
      :agent-id="interaction.messageDetailAgent"
      :events="messageEventsForAgent"
      @close="closeMessageDetail"
    />
    
    <!-- Screen Reader Summary -->
    <div class="sr-only" aria-live="polite">
      Timeline updated: {{ processedEvents.length }} events, {{ Object.keys(agentPaths).length }} active agents
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useTimelineData } from '@/composables/useTimelineData';
import { useTimelineInteraction } from '@/composables/useTimelineInteraction';
import { useTimelineAnimation } from '@/composables/useTimelineAnimation';
import { useAgentColors } from '@/composables/useAgentColors';
import TimelineControls from './TimelineControls.vue';
import TimelineTooltip from './TimelineTooltip.vue';
import MessageDetailPane from './MessageDetailPane.vue';
import type { AgentTimelineEvent } from '@/types';

interface Props {
  events: AgentTimelineEvent[];
}

const props = defineProps<Props>();
const timelineId = `timeline-${Math.random().toString(36).slice(2)}`;

// Composables
const eventsRef = toRef(props, 'events');
const { 
  viewport, 
  processedEvents, 
  batchGroups, 
  agentPaths, 
  updateViewport,
  timelineWidth,
  timelineHeight,
  orchestratorY
} = useTimelineData(eventsRef);

const { 
  interaction, 
  handleAgentHover, 
  handleAgentLeave, 
  handleAgentClick, 
  handleMessageClick,
  clearSelection,
  closeMessageDetail,
  handleKeyDown: handleInteractionKeyDown
} = useTimelineInteraction();

const {
  animationsEnabled,
  shouldAnimate,
  toggleAnimations
} = useTimelineAnimation(eventsRef);

const { getAgentColor } = useAgentColors();

// Computed properties
const gridLines = computed(() => {
  const lines = [];
  for (let i = 0; i <= 10; i++) {
    lines.push(50 + (i * (timelineWidth - 100)) / 10);
  }
  return lines;
});

const timeLabels = computed(() => {
  if (processedEvents.value.length === 0) return [];
  
  const labels = [];
  const startTime = viewport.value.startTime;
  const endTime = viewport.value.endTime;
  const timeRange = endTime - startTime;
  
  for (let i = 0; i <= 8; i++) {
    const time = startTime + (i * timeRange) / 8;
    const x = 50 + (i * (timelineWidth - 100)) / 8;
    labels.push({
      x,
      label: new Date(time).toLocaleTimeString()
    });
  }
  
  return labels;
});

const userPrompts = computed(() => 
  processedEvents.value.filter(e => e.type === 'user_prompt')
);

const spawnPoints = computed(() => 
  processedEvents.value.filter(e => e.type === 'batch_start')
);

const messageEvents = computed(() => 
  processedEvents.value.filter(e => e.type === 'agent_message')
);

const agentLabels = computed(() => {
  const labels = new Map();
  
  Object.keys(agentPaths.value).forEach(agentId => {
    const agentEvents = processedEvents.value.filter(e => e.agent_id === agentId);
    if (agentEvents.length > 0) {
      const firstEvent = agentEvents[0];
      labels.set(agentId, {
        x: firstEvent.x || 0,
        y: firstEvent.y || 0,
        text: getAgentDisplayName(firstEvent.agent_type)
      });
    }
  });
  
  return labels;
});

const messageEventsForAgent = computed(() => {
  if (!interaction.messageDetailAgent) return [];
  return processedEvents.value.filter(e => 
    e.agent_id === interaction.messageDetailAgent && e.type === 'agent_message'
  );
});

// Helper methods
const getAgentById = (agentId: string) => {
  return processedEvents.value.find(e => e.agent_id === agentId) || processedEvents.value[0];
};

const getAgentType = (agentId: string) => {
  const agent = getAgentById(agentId);
  return agent?.agent_type || 'coder';
};

const getAgentDisplayName = (agentType: string) => {
  const names = {
    orchestrator: 'Orchestrator',
    coder: 'Coder',
    architect: 'Architect',
    reviewer: 'Reviewer',
    tester: 'Tester',
    verifier: 'Verifier',
    planner: 'Planner',
    analyst: 'Analyst',
    researcher: 'Researcher',
    designer: 'Designer',
    deployer: 'Deployer'
  };
  return names[agentType as keyof typeof names] || agentType;
};

const getMessageRadius = (event: AgentTimelineEvent) => {
  return interaction.hoveredElement?.id === event.id ? 5 : 3;
};

const getAgentAriaLabel = (agentId: string) => {
  const agent = getAgentById(agentId);
  const agentEvents = processedEvents.value.filter(e => e.agent_id === agentId);
  const messages = agentEvents.filter(e => e.type === 'agent_message').length;
  
  return `${getAgentDisplayName(agent.agent_type)} agent, ${messages} messages, ${agent.status || 'active'}`;
};

const getMessageAriaLabel = (event: AgentTimelineEvent) => {
  return `Message from ${getAgentDisplayName(event.agent_type)} at ${new Date(event.timestamp).toLocaleTimeString()}`;
};

const getBatchX = (batch: any) => {
  // Implementation for batch positioning
  return 100;
};

const getBatchY = (batch: any) => {
  return 100;
};

const getBatchWidth = (batch: any) => {
  return 200;
};

const getBatchHeight = (batch: any) => {
  return 150;
};

// Event handlers
const handleKeyDown = (event: KeyboardEvent) => {
  handleInteractionKeyDown(event);
};

// Component lifecycle
onMounted(() => {
  // Initialize component
});

onUnmounted(() => {
  // Cleanup
});
</script>

<style scoped>
@import '@/styles/timeline.css';
</style>
```

## 7. Supporting Components

### TimelineControls.vue (Basic Implementation)
```vue
<template>
  <div class="timeline-controls">
    <div class="timeline-scale-toggle">
      <button
        class="scale-mode-button"
        :class="{ active: viewport.scale === 'true_time' }"
        @click="$emit('update-viewport', { scale: 'true_time' })"
      >
        True Time
      </button>
      <button
        class="scale-mode-button"
        :class="{ active: viewport.scale === 'equidistant' }"
        @click="$emit('update-viewport', { scale: 'equidistant' })"
      >
        Equidistant
      </button>
    </div>
    
    <div class="timeline-zoom-controls">
      <button class="zoom-button" @click="$emit('update-viewport', { zoom: viewport.zoom * 1.2 })">
        +
      </button>
      <span>{{ Math.round(viewport.zoom * 100) }}%</span>
      <button class="zoom-button" @click="$emit('update-viewport', { zoom: viewport.zoom / 1.2 })">
        -
      </button>
    </div>
    
    <button 
      class="zoom-button"
      @click="$emit('toggle-animations')"
      :title="animationsEnabled ? 'Disable animations' : 'Enable animations'"
    >
      {{ animationsEnabled ? '⏸️' : '▶️' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TimelineViewport } from '@/types';

interface Props {
  viewport: TimelineViewport;
  animationsEnabled: boolean;
}

defineProps<Props>();
defineEmits<{
  'update-viewport': [changes: Partial<TimelineViewport>];
  'toggle-animations': [];
}>();
</script>
```

## 8. Integration Steps

### Step 1: Add to App.vue
```vue
<!-- Add to the Agents tab in App.vue -->
<template v-else-if="activeTab === 'timeline'">
  <AgentTimeline :events="timelineEvents" />
</template>
```

### Step 2: Extend WebSocket Integration
```typescript
// In useWebSocket.ts, add timeline event handling
const handleTimelineEvent = (event: any) => {
  // Convert incoming WebSocket events to AgentTimelineEvent format
  const timelineEvent: AgentTimelineEvent = {
    id: event.id || `${Date.now()}-${Math.random()}`,
    type: event.event_type,
    agent_id: event.agent_id,
    agent_type: event.agent_type || 'coder',
    timestamp: event.timestamp || Date.now(),
    session_id: event.session_id,
    batch_id: event.batch_id,
    message_content: event.message,
    target_agent: event.target_agent,
    status: event.status
  };
  
  timelineEvents.value.push(timelineEvent);
};
```

### Step 3: Add Timeline Tab
```vue
<!-- Add timeline tab to App.vue -->
<button
  @click="activeTab = 'timeline'"
  :class="[
    'px-4 py-2 rounded-t-lg font-semibold transition-all',
    activeTab === 'timeline' 
      ? 'bg-gray-900 text-blue-400 border-t-2 border-blue-400' 
      : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
  ]"
>
  Timeline
</button>
```

## 9. Testing Guidelines

### Unit Tests
- Test color assignment consistency
- Verify timeline positioning calculations
- Test event filtering and processing
- Validate accessibility attributes

### Integration Tests  
- Test WebSocket event handling
- Verify real-time updates
- Test responsive behavior
- Validate keyboard navigation

### Performance Tests
- Monitor SVG rendering performance
- Test with large datasets (1000+ events)
- Verify animation performance
- Check memory usage during real-time updates

## 10. Deployment Checklist

- [ ] All CSS custom properties defined
- [ ] Responsive breakpoints tested
- [ ] Accessibility validation passed
- [ ] Animation performance optimized
- [ ] WebSocket integration tested
- [ ] Color contrast ratios verified
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility confirmed
- [ ] Cross-browser compatibility tested
- [ ] Performance benchmarks met

This implementation guide provides the foundation for building the Agent Timeline Visualization component while maintaining consistency with the existing design system and ensuring optimal performance and accessibility.