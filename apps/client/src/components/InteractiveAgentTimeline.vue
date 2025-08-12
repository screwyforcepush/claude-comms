<template>
  <div class="agent-timeline-container w-full h-full bg-gray-800 rounded-lg border border-blue-400/30 overflow-hidden">
    <!-- Timeline Header -->
    <div class="timeline-header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <div class="flex items-center justify-between">
        <h3 class="text-white font-bold text-lg">Interactive Agent Timeline</h3>
        <div class="flex items-center space-x-3">
          <span class="text-gray-300 text-sm">Session: {{ sessionId || 'None selected' }}</span>
          <div class="flex items-center space-x-2">
            <span class="text-green-400 text-xs">● Live</span>
            <span class="text-gray-400 text-xs">{{ totalAgents }} agents</span>
            <span v-if="selectedMessage || selectedAgent" class="text-blue-400 text-xs">
              {{ selectedMessage ? 'Message' : 'Agent' }} selected
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline Content -->
    <div class="timeline-content relative w-full flex-1 overflow-hidden" ref="timelineContainer">
      <!-- SVG Timeline -->
      <svg
        ref="timelineSvg"
        :width="containerWidth"
        :height="containerHeight"
        class="absolute top-0 left-0 w-full h-full"
        @mousemove="handleMouseMove"
        @click="handleClick"
        @wheel="handleWheel"
        @mouseleave="hideTooltip"
      >
        <!-- Grid Background -->
        <defs>
          <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1"/>
          </pattern>
          <!-- Glow filters for selections -->
          <filter id="messageGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="agentGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Time Axis -->
        <g class="time-axis">
          <line 
            :x1="timelineMargins.left" 
            :y1="timelineMargins.top - 20" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="timelineMargins.top - 20"
            stroke="#6b7280" 
            stroke-width="2"
          />
          <g v-for="tick in timeTicks" :key="tick.time">
            <line 
              :x1="tick.x" 
              :y1="timelineMargins.top - 25" 
              :x2="tick.x" 
              :y2="timelineMargins.top - 15"
              stroke="#6b7280" 
              stroke-width="1"
            />
            <text 
              :x="tick.x" 
              :y="timelineMargins.top - 30"
              text-anchor="middle" 
              fill="#9ca3af" 
              font-size="11px"
              font-family="system-ui"
            >
              {{ tick.label }}
            </text>
          </g>
        </g>

        <!-- Orchestrator Line -->
        <g class="orchestrator-line">
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="#00d4ff" 
            stroke-width="3"
            class="drop-shadow-[0_0_8px_currentColor]"
          />
          <text 
            :x="timelineMargins.left - 10" 
            :y="orchestratorY + 5"
            text-anchor="end" 
            fill="#00d4ff" 
            font-size="14px"
            font-weight="600"
            font-family="system-ui"
          >
            Orchestrator
          </text>
        </g>

        <!-- Agent Lanes -->
        <g class="agent-lanes">
          <g v-for="(agent, index) in visibleAgents" :key="agent.agentId" class="agent-lane">
            <!-- Agent Lane Line -->
            <line 
              :x1="getAgentStartX(agent)" 
              :y1="getAgentLaneY(index)" 
              :x2="getAgentEndX(agent)" 
              :y2="getAgentLaneY(index)"
              :stroke="getAgentColor(agent.type)" 
              :stroke-width="getStrokeWidth(agent.status, agent.agentId === selectedAgent?.id?.toString())"
              :class="getAgentLineClass(agent.status, agent.agentId === selectedAgent?.id?.toString())"
              class="cursor-pointer transition-all duration-200"
              :filter="agent.agentId === selectedAgent?.id?.toString() ? 'url(#agentGlow)' : ''"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            />
            
            <!-- Agent Label -->
            <text 
              :x="timelineMargins.left - 10" 
              :y="getAgentLaneY(index) + 5"
              text-anchor="end" 
              :fill="getAgentColor(agent.type)" 
              font-size="13px"
              font-weight="500"
              font-family="system-ui"
              class="cursor-pointer hover:opacity-80 transition-opacity select-none"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            >
              {{ agent.name }}
            </text>

            <!-- Agent Type Badge -->
            <rect
              :x="timelineMargins.left - 80"
              :y="getAgentLaneY(index) - 10"
              width="65"
              height="16"
              :fill="getAgentColor(agent.type) + '20'"
              :stroke="getAgentColor(agent.type)"
              stroke-width="1"
              rx="8"
              ry="8"
              class="cursor-pointer hover:opacity-80 transition-opacity"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            />
            <text 
              :x="timelineMargins.left - 47.5" 
              :y="getAgentLaneY(index) + 3"
              text-anchor="middle" 
              :fill="getAgentColor(agent.type)" 
              font-size="10px"
              font-weight="600"
              font-family="system-ui"
              class="cursor-pointer select-none"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            >
              {{ agent.type.toUpperCase() }}
            </text>

            <!-- Status Indicator -->
            <circle 
              :cx="getAgentEndX(agent) + 8" 
              :cy="getAgentLaneY(index)"
              r="4" 
              :fill="getStatusColor(agent.status)"
              :class="agent.status === 'in_progress' ? 'animate-pulse' : ''"
              class="cursor-pointer"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            />
          </g>
        </g>

        <!-- Batch Spawn Points -->
        <g class="batch-spawn-points">
          <g v-for="batch in batches" :key="batch.id">
            <circle 
              :cx="getTimeX(batch.spawnTimestamp)" 
              :cy="orchestratorY"
              r="6" 
              fill="#00d4ff"
              stroke="#ffffff"
              stroke-width="2"
              class="drop-shadow-[0_0_12px_currentColor] cursor-pointer hover:r-8 transition-all duration-200"
              @click="selectBatch(batch)"
              @mouseenter="showBatchTooltip(batch, $event)"
              @mouseleave="hideTooltip"
            />
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY - 15"
              text-anchor="middle" 
              fill="#00d4ff" 
              font-size="12px"
              font-weight="600"
              font-family="system-ui"
              class="cursor-pointer select-none"
              @click="selectBatch(batch)"
              @mouseenter="showBatchTooltip(batch, $event)"
              @mouseleave="hideTooltip"
            >
              B{{ batch.batchNumber }}
            </text>
          </g>
        </g>

        <!-- Message Indicators -->
        <g class="message-indicators">
          <g v-for="message in visibleMessages" :key="message.id">
            <circle 
              :cx="message.position.x" 
              :cy="message.position.y"
              :r="getMessageRadius(message)"
              fill="#ffd93d"
              stroke="#ffffff"
              stroke-width="1"
              :class="getMessageClasses(message)"
              :filter="isMessageSelected(message) ? 'url(#messageGlow)' : ''"
              @click="selectMessage(message)"
              @mouseenter="showMessageTooltip(message, $event)"
              @mouseleave="hideTooltip"
            />
            <!-- Selection ring -->
            <circle 
              v-if="isMessageSelected(message)"
              :cx="message.position.x" 
              :cy="message.position.y"
              r="8"
              fill="none"
              stroke="#ffd93d"
              stroke-width="2"
              opacity="0.6"
              class="animate-pulse"
            />
          </g>
        </g>

        <!-- Message Flow Lines (for selected agent) -->
        <g v-if="selectedAgent" class="message-flows">
          <g v-for="flow in messageFlows" :key="`flow-${flow.from.id}-${flow.to.id}`">
            <path
              :d="flow.path"
              stroke="#ffd93d"
              stroke-width="1"
              fill="none"
              stroke-dasharray="3,3"
              opacity="0.7"
              class="animate-pulse"
            />
          </g>
        </g>

        <!-- User Prompts -->
        <g class="user-prompts">
          <g v-for="prompt in userPrompts" :key="prompt.id">
            <rect
              :x="getTimeX(prompt.timestamp) - 8"
              :y="orchestratorY - 20"
              width="16"
              height="16"
              fill="#ec4899"
              stroke="#ffffff"
              stroke-width="2"
              rx="3"
              ry="3"
              class="cursor-pointer hover:opacity-80 transition-all"
              @click="selectPrompt(prompt)"
              @mouseenter="showPromptTooltip(prompt, $event)"
              @mouseleave="hideTooltip"
            />
            <text 
              x="0" 
              y="0"
              text-anchor="middle" 
              fill="#ffffff" 
              font-size="12px"
              font-weight="700"
              font-family="system-ui"
              :transform="`translate(${getTimeX(prompt.timestamp)}, ${orchestratorY - 12})`"
              class="cursor-pointer select-none"
              @click="selectPrompt(prompt)"
              @mouseenter="showPromptTooltip(prompt, $event)"
              @mouseleave="hideTooltip"
            >
              ?
            </text>
          </g>
        </g>
      </svg>

      <!-- Message Detail Pane -->
      <MessageDetailPane 
        :visible="detailPaneVisible"
        :selected-message="selectedMessage"
        :agents="props.agents"
        :session-id="props.sessionId"
        @close="closeDetailPane"
        @agent-selected="handleAgentSelected"
        @highlight-timeline="highlightMessage"
      />

      <!-- Timeline Tooltip -->
      <TimelineTooltip 
        :visible="tooltip.visible"
        :tooltip-data="tooltip"
      />

      <!-- Loading Overlay -->
      <div v-if="isLoading" class="absolute inset-0 bg-gray-800/50 flex items-center justify-center">
        <div class="text-white text-lg">Loading timeline data...</div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && totalAgents === 0" class="absolute inset-0 flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <div class="text-2xl mb-2">📊</div>
          <div class="text-lg mb-2">No agent data available</div>
          <div class="text-sm">Agent timeline will appear when agents are spawned</div>
        </div>
      </div>
    </div>

    <!-- Timeline Controls -->
    <div v-if="showControls" class="timeline-footer bg-gray-700 px-4 py-2 border-t border-gray-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <button 
            @click="zoomIn" 
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Zoom In
          </button>
          <button 
            @click="zoomOut" 
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Zoom Out
          </button>
          <button 
            @click="resetZoom" 
            class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
          >
            Reset
          </button>
          <button 
            @click="clearSelections" 
            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            v-if="selectedAgent || selectedMessage"
          >
            Clear Selection
          </button>
        </div>
        <div class="flex items-center space-x-2">
          <label class="flex items-center space-x-1 text-gray-300 text-sm">
            <input 
              v-model="autoScroll" 
              type="checkbox" 
              class="rounded border-gray-400 bg-gray-700 text-blue-600"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Selection Info Bar -->
    <div 
      v-if="selectedAgent || selectedMessage" 
      class="selection-info bg-blue-600/20 border-t border-blue-400/30 px-4 py-2 text-sm"
    >
      <div v-if="selectedAgent" class="flex items-center justify-between">
        <span class="text-blue-400">
          Selected Agent: <strong>{{ selectedAgent.name }}</strong> ({{ selectedAgent.subagent_type }})
        </span>
        <span class="text-gray-400">
          {{ getAgentMessages(selectedAgent).length }} messages
        </span>
      </div>
      <div v-else-if="selectedMessage" class="flex items-center justify-between">
        <span class="text-yellow-400">
          Selected Message from: <strong>{{ selectedMessage.sender }}</strong>
        </span>
        <span class="text-gray-400">
          {{ formatTimestamp(selectedMessage.created_at) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { AgentStatus, SubagentMessage } from '../types';
import MessageDetailPane from './MessageDetailPane.vue';
import TimelineTooltip from './TimelineTooltip.vue';

// Component Props
const props = withDefaults(defineProps<{
  sessionId?: string;
  agents?: AgentStatus[];
  messages?: SubagentMessage[];
  height?: number;
  showControls?: boolean;
  autoZoom?: boolean;
  followLatest?: boolean;
}>(), {
  agents: () => [],
  messages: () => [],
  height: 600,
  showControls: true,
  autoZoom: true,
  followLatest: true
});

// Component Events
const emit = defineEmits<{
  'agent-selected': [agent: AgentStatus];
  'message-clicked': [message: SubagentMessage];
  'batch-selected': [batch: any];
  'prompt-clicked': [prompt: any];
  'agent-path-clicked': [agent: AgentStatus];
  'highlight-message': [messageId: string];
  'selection-changed': [selection: { agent?: AgentStatus; message?: SubagentMessage }];
}>();

// Refs
const timelineContainer = ref<HTMLDivElement>();
const timelineSvg = ref<SVGElement>();

// Reactive State
const isLoading = ref(false);
const containerWidth = ref(1200);
const containerHeight = ref(600);
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const autoScroll = ref(props.followLatest);

// Interaction State
const selectedMessage = ref<SubagentMessage | null>(null);
const selectedAgent = ref<AgentStatus | null>(null);
const highlightedMessageId = ref<string>('');
const detailPaneVisible = ref(false);
const tooltip = ref<{
  visible: boolean;
  type: 'agent' | 'message' | 'batch' | 'prompt' | 'generic';
  data: any;
  position: { x: number; y: number };
}>({ 
  visible: false, 
  type: 'generic', 
  data: null, 
  position: { x: 0, y: 0 } 
});

// Timeline Configuration
const timelineMargins = {
  top: 60,
  right: 50,
  bottom: 40,
  left: 120
};
const orchestratorY = 80;
const agentLaneHeight = 40;

// Agent Type Colors
const agentColors = {
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
  'cloud-cicd': '#22c55e',
  'general-purpose': '#9ca3af',
  'deep-researcher': '#0ea5e9',
  'business-analyst': '#d946ef',
  'green-verifier': '#84cc16',
  'code-reviewer': '#f59e0b',
  engineer: '#ff6b6b'
};

// Status Colors
const statusColors = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  error: '#ef4444'
};

// Computed Properties
const totalAgents = computed(() => props.agents.length);

const visibleAgents = computed(() => {
  return props.agents.map((agent) => ({
    ...agent,
    agentId: agent.id.toString(),
    type: agent.subagent_type,
    startTime: agent.created_at,
    endTime: agent.completion_timestamp || null,
    status: agent.status || 'pending'
  }));
});

const timeRange = computed(() => {
  if (visibleAgents.value.length === 0) {
    const now = Date.now();
    return { start: now - 300000, end: now };
  }

  const times = visibleAgents.value.map(agent => agent.startTime);
  const endTimes = visibleAgents.value
    .map(agent => agent.endTime)
    .filter(t => t !== null);
  
  const allTimes = [...times, ...endTimes];
  const start = Math.min(...allTimes);
  const end = Math.max(...allTimes);
  const padding = (end - start) * 0.1;

  return { 
    start: start - padding, 
    end: end + padding 
  };
});

const timeTicks = computed(() => {
  const { start, end } = timeRange.value;
  const duration = end - start;
  const tickCount = 8;
  const ticks = [];

  for (let i = 0; i <= tickCount; i++) {
    const time = start + (duration / tickCount) * i;
    const x = getTimeX(time);
    const date = new Date(time);
    const label = date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    ticks.push({ time, x, label });
  }
  
  return ticks;
});

const batches = computed(() => {
  const batchMap = new Map();
  
  visibleAgents.value.forEach(agent => {
    const spawnTime = agent.startTime;
    const key = Math.floor(spawnTime / 5000) * 5000;
    
    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: `batch-${key}`,
        spawnTimestamp: key,
        agents: [],
        batchNumber: batchMap.size + 1
      });
    }
    
    batchMap.get(key).agents.push(agent);
  });
  
  return Array.from(batchMap.values());
});

const userPrompts = computed(() => {
  return [] as Array<{id: string; timestamp: number; content: string}>;
});

const visibleMessages = computed(() => {
  return props.messages.map(message => ({
    ...message,
    id: `msg-${message.created_at}-${message.sender}`,
    position: {
      x: getTimeX(message.created_at),
      y: getMessageY(message)
    }
  }));
});

const messageFlows = computed(() => {
  if (!selectedAgent.value) return [];
  
  const agentMessages = getAgentMessages(selectedAgent.value);
  const flows = [];
  
  for (let i = 1; i < agentMessages.length; i++) {
    const from = agentMessages[i - 1];
    const to = agentMessages[i];
    
    flows.push({
      from,
      to,
      path: createMessageFlowPath(from.position, to.position)
    });
  }
  
  return flows;
});

// Helper Functions
const getAgentColor = (type: string): string => {
  return agentColors[type as keyof typeof agentColors] || agentColors.engineer;
};

const getStatusColor = (status: string): string => {
  return statusColors[status as keyof typeof statusColors] || statusColors.pending;
};

const getAgentLaneY = (index: number): number => {
  return orchestratorY + 60 + (index * agentLaneHeight);
};

const getTimeX = (timestamp: number): number => {
  const { start, end } = timeRange.value;
  const timelineWidth = containerWidth.value - timelineMargins.left - timelineMargins.right;
  const ratio = (timestamp - start) / (end - start);
  return timelineMargins.left + (ratio * timelineWidth * zoomLevel.value) + panX.value;
};

const getAgentStartX = (agent: any): number => {
  return getTimeX(agent.startTime);
};

const getAgentEndX = (agent: any): number => {
  const endTime = agent.endTime || Date.now();
  return getTimeX(endTime);
};

const getStrokeWidth = (status: string, isSelected: boolean = false): number => {
  let width = 2;
  switch (status) {
    case 'completed': width = 2; break;
    case 'in_progress': width = 3; break;
    case 'error': width = 3; break;
    default: width = 2;
  }
  return isSelected ? width + 2 : width;
};

const getAgentLineClass = (status: string, isSelected: boolean = false): string => {
  const baseClass = 'drop-shadow-[0_0_8px_currentColor]';
  let classes = baseClass;
  
  if (status === 'in_progress') {
    classes += ' animate-pulse';
  }
  
  if (isSelected) {
    classes += ' drop-shadow-[0_0_16px_currentColor] opacity-100';
  }
  
  return classes;
};

const getMessageY = (message: SubagentMessage): number => {
  const agentIndex = visibleAgents.value.findIndex(agent => agent.name === message.sender);
  if (agentIndex !== -1) {
    return getAgentLaneY(agentIndex);
  }
  return orchestratorY;
};

const getMessageRadius = (message: any): number => {
  const isSelected = isMessageSelected(message);
  const isHighlighted = message.id === highlightedMessageId.value;
  
  if (isSelected) return 5;
  if (isHighlighted) return 4;
  return 3;
};

const getMessageClasses = (message: any): string => {
  const baseClasses = 'cursor-pointer transition-all duration-200 animate-pulse';
  const isSelected = isMessageSelected(message);
  const isHighlighted = message.id === highlightedMessageId.value;
  
  if (isSelected) return baseClasses + ' drop-shadow-[0_0_12px_currentColor]';
  if (isHighlighted) return baseClasses + ' drop-shadow-[0_0_8px_currentColor]';
  return baseClasses + ' hover:drop-shadow-[0_0_8px_currentColor]';
};

const isMessageSelected = (message: any): boolean => {
  return selectedMessage.value?.created_at === message.created_at && 
         selectedMessage.value?.sender === message.sender;
};

const getAgentMessages = (agent: AgentStatus) => {
  return visibleMessages.value.filter(msg => msg.sender === agent.name);
};

const createMessageFlowPath = (from: {x: number, y: number}, to: {x: number, y: number}): string => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} Q ${midX} ${midY - 20} ${to.x} ${to.y}`;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// Event Handlers
const handleMouseMove = (_event: MouseEvent) => {
  // Handle panning if dragging
  // TODO: Implement drag panning
};

const handleClick = (event: MouseEvent) => {
  // Handle background clicks to clear selections
  if (event.target === timelineSvg.value) {
    clearSelections();
  }
};

const handleWheel = (event: WheelEvent) => {
  event.preventDefault();
  const zoomFactor = 1.1;
  if (event.deltaY < 0) {
    zoomLevel.value = Math.min(zoomLevel.value * zoomFactor, 5);
  } else {
    zoomLevel.value = Math.max(zoomLevel.value / zoomFactor, 0.2);
  }
};

// Selection Handlers
const selectMessage = (message: any) => {
  selectedMessage.value = message;
  selectedAgent.value = null;
  detailPaneVisible.value = true;
  emit('message-clicked', message);
  emit('selection-changed', { message });
};

const selectAgentPath = (agent: any) => {
  selectedAgent.value = agent;
  selectedMessage.value = null;
  detailPaneVisible.value = false;
  emit('agent-path-clicked', agent);
  emit('selection-changed', { agent });
};

const selectBatch = (batch: any) => {
  emit('batch-selected', batch);
};

const selectPrompt = (prompt: any) => {
  emit('prompt-clicked', prompt);
};

const handleAgentSelected = (agent: AgentStatus) => {
  emit('agent-selected', agent);
};

const closeDetailPane = () => {
  detailPaneVisible.value = false;
  selectedMessage.value = null;
};

const clearSelections = () => {
  selectedMessage.value = null;
  selectedAgent.value = null;
  detailPaneVisible.value = false;
  emit('selection-changed', {});
};

const highlightMessage = (messageId: string) => {
  highlightedMessageId.value = messageId;
  emit('highlight-message', messageId);
  
  setTimeout(() => {
    highlightedMessageId.value = '';
  }, 3000);
};

// Tooltip functions
const showAgentTooltip = (agent: any, event: MouseEvent) => {
  const rect = (event.target as SVGElement).getBoundingClientRect();
  tooltip.value = {
    visible: true,
    type: 'agent' as const,
    data: {
      name: agent.name,
      type: agent.type,
      status: agent.status,
      color: getAgentColor(agent.type),
      duration: agent.duration
    },
    position: { x: rect.left + rect.width / 2, y: rect.top }
  };
};

const showMessageTooltip = (message: any, event: MouseEvent) => {
  const rect = (event.target as SVGElement).getBoundingClientRect();
  const preview = typeof message.message === 'string' 
    ? message.message.substring(0, 50) + (message.message.length > 50 ? '...' : '')
    : 'Object message';
    
  tooltip.value = {
    visible: true,
    type: 'message' as const,
    data: {
      sender: message.sender,
      created_at: message.created_at,
      preview
    },
    position: { x: rect.left + rect.width / 2, y: rect.top }
  };
};

const showBatchTooltip = (batch: any, event: MouseEvent) => {
  const rect = (event.target as SVGElement).getBoundingClientRect();
  tooltip.value = {
    visible: true,
    type: 'batch' as const,
    data: batch,
    position: { x: rect.left + rect.width / 2, y: rect.top }
  };
};

const showPromptTooltip = (prompt: any, event: MouseEvent) => {
  const rect = (event.target as SVGElement).getBoundingClientRect();
  tooltip.value = {
    visible: true,
    type: 'prompt' as const,
    data: prompt,
    position: { x: rect.left + rect.width / 2, y: rect.top }
  };
};

const hideTooltip = () => {
  tooltip.value = {
    visible: false,
    type: 'generic',
    data: null,
    position: { x: 0, y: 0 }
  };
};

// Control Functions
const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5);
};

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.2);
};

const resetZoom = () => {
  zoomLevel.value = 1;
  panX.value = 0;
  panY.value = 0;
};

// Lifecycle
const updateDimensions = () => {
  if (timelineContainer.value) {
    containerWidth.value = timelineContainer.value.clientWidth;
    containerHeight.value = props.height;
  }
};

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    clearSelections();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    clearSelections();
  }
};

onMounted(() => {
  updateDimensions();
  window.addEventListener('resize', updateDimensions);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateDimensions);
  document.removeEventListener('keydown', handleKeydown);
});

watch(() => props.height, (newHeight) => {
  containerHeight.value = newHeight;
});
</script>

<style scoped>
.agent-timeline-container {
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
}

.timeline-content {
  position: relative;
  flex: 1;
  min-height: 400px;
}

.timeline-header,
.timeline-footer,
.selection-info {
  flex-shrink: 0;
}

/* Hover effects */
.agent-lane line:hover {
  stroke-width: 4;
}

.message-indicators circle:hover {
  r: 5;
}

/* Selection animations */
@keyframes selectionPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .agent-timeline-container {
    font-size: 12px;
  }
  
  .timeline-header h3 {
    font-size: 16px;
  }
  
  .timeline-header .text-sm {
    font-size: 11px;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .bg-gray-800 {
    background-color: #000;
  }
  
  .border-gray-600 {
    border-color: #fff;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
  
  .transition-all {
    transition: none;
  }
}
</style>