<template>
  <div class="agent-timeline-container w-full h-full bg-gray-800 rounded-lg border border-blue-400/30 overflow-hidden">
    <!-- Timeline Header -->
    <div class="timeline-header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <div class="flex items-center justify-between">
        <h3 class="text-white font-bold text-lg">Agent Timeline</h3>
        <div class="flex items-center space-x-3">
          <span class="text-gray-300 text-sm">Session: {{ sessionId || 'None selected' }}</span>
          <div class="flex items-center space-x-2">
            <span class="text-green-400 text-xs">● Live</span>
            <span class="text-gray-400 text-xs">{{ totalAgents }} agents</span>
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
      >
        <!-- Grid Background -->
        <defs>
          <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1"/>
          </pattern>
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
            <!-- Agent Lane Line with real-time highlighting -->
            <line 
              :x1="getAgentStartX(agent)" 
              :y1="getAgentLaneY(index)" 
              :x2="getAgentEndX(agent)" 
              :y2="getAgentLaneY(index)"
              :stroke="getAgentColor(agent.type)" 
              :stroke-width="getStrokeWidth(agent.status)"
              :class="getAgentLineClass(agent.status, agent.isRecentlyUpdated)"
              :opacity="agent.isRecentlyUpdated ? 1 : 0.8"
            />
            
            <!-- Highlight glow for recently updated agents -->
            <line 
              v-if="agent.isRecentlyUpdated"
              :x1="getAgentStartX(agent)" 
              :y1="getAgentLaneY(index)" 
              :x2="getAgentEndX(agent)" 
              :y2="getAgentLaneY(index)"
              :stroke="getAgentColor(agent.type)" 
              stroke-width="8"
              class="animate-pulse drop-shadow-[0_0_16px_currentColor]"
              opacity="0.3"
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
            />
            <text 
              :x="timelineMargins.left - 47.5" 
              :y="getAgentLaneY(index) + 3"
              text-anchor="middle" 
              :fill="getAgentColor(agent.type)" 
              font-size="10px"
              font-weight="600"
              font-family="system-ui"
            >
              {{ agent.type.toUpperCase() }}
            </text>

            <!-- Status Indicator with enhanced animations -->
            <circle 
              :cx="getAgentEndX(agent) + 8" 
              :cy="getAgentLaneY(index)"
              :r="agent.isRecentlyUpdated ? 6 : 4" 
              :fill="getStatusColor(agent.status)"
              :class="getStatusIndicatorClass(agent.status, agent.isRecentlyUpdated)"
              :stroke="agent.isRecentlyUpdated ? '#ffffff' : 'none'"
              :stroke-width="agent.isRecentlyUpdated ? 2 : 0"
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
              class="drop-shadow-[0_0_12px_currentColor] cursor-pointer hover:r-8 transition-all"
              @click="selectBatch(batch)"
            />
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY - 15"
              text-anchor="middle" 
              fill="#00d4ff" 
              font-size="12px"
              font-weight="600"
              font-family="system-ui"
            >
              B{{ batch.batchNumber }}
            </text>
          </g>
        </g>

        <!-- Message Indicators with flow animation -->
        <g class="message-indicators">
          <g v-for="message in visibleMessages" :key="message.id">
            <!-- Message flow path animation -->
            <path 
              v-if="message.isRecentlyAdded"
              :d="getMessageFlowPath(message)"
              stroke="#ffd93d"
              stroke-width="2"
              fill="none"
              class="animate-pulse"
              opacity="0.6"
            />
            
            <!-- Main message indicator -->
            <circle 
              :cx="message.position.x" 
              :cy="message.position.y"
              :r="message.isRecentlyAdded ? 5 : 3" 
              fill="#ffd93d"
              :stroke="message.isRecentlyAdded ? '#ffffff' : '#ffffff'"
              :stroke-width="message.isRecentlyAdded ? 2 : 1"
              :class="getMessageIndicatorClass(message.isRecentlyAdded)"
              @click="selectMessage(message)"
            />
            
            <!-- Expanding ripple for new messages -->
            <circle 
              v-if="message.isRecentlyAdded"
              :cx="message.position.x" 
              :cy="message.position.y"
              r="0"
              fill="none"
              stroke="#ffd93d"
              stroke-width="2"
              class="animate-ping"
              opacity="0.8"
            >
              <animate attributeName="r" values="0;15;0" dur="2s" repeatCount="3" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="3" />
            </circle>
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
            >
              ?
            </text>
          </g>
        </g>
      </svg>

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

    <!-- Timeline Controls (if enabled) -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { AgentStatus, SubagentMessage } from '../types';
import { useTimelineWebSocket } from '../composables/useTimelineWebSocket';
import { TimelineOptimizations } from '../utils/timelineOptimizations';
import type { ViewportState, LevelOfDetail, PerformanceMetrics } from '../types/timeline';

// Component Props
const props = withDefaults(defineProps<{
  sessionId?: string;
  agents?: AgentStatus[];
  messages?: SubagentMessage[];
  height?: number;
  showControls?: boolean;
  autoZoom?: boolean;
  followLatest?: boolean;
  wsConnection?: WebSocket | null;
}>(), {
  agents: () => [],
  messages: () => [],
  height: 600,
  showControls: true,
  autoZoom: true,
  followLatest: true,
  wsConnection: null
});

// Component Events
const emit = defineEmits<{
  'agent-selected': [agent: AgentStatus];
  'message-clicked': [message: SubagentMessage];
  'batch-selected': [batch: any];
  'prompt-clicked': [prompt: any];
}>();

// Refs
const timelineContainer = ref<HTMLDivElement>();
const timelineSvg = ref<SVGElement>();

// WebSocket Integration
const {
  agents: realtimeAgents,
  messages: realtimeMessages,
  recentlyUpdatedAgents,
  recentlyAddedMessages,
  shouldAutoScroll
} = useTimelineWebSocket(props.wsConnection, props.sessionId || null);

// Reactive State
const isLoading = ref(false);
const containerWidth = ref(1200);
const containerHeight = ref(600);
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const autoScroll = ref(props.followLatest);
const lastScrollTime = ref(0);

// Performance optimization instances
const viewportCuller = new TimelineOptimizations.ViewportCuller();
const lodManager = new TimelineOptimizations.LevelOfDetailManager();
const renderScheduler = new TimelineOptimizations.RenderScheduler();
const performanceTracker = new TimelineOptimizations.TimelinePerformanceTracker();

// Performance state
const performanceMetrics = ref<PerformanceMetrics>({
  fps: 60,
  frameTime: 16.67,
  memoryMB: 0,
  renderCount: 0,
  cullRatio: 0,
  elementCount: { agents: 0, messages: 0, visible: 0 }
});

const levelOfDetail = ref<LevelOfDetail>({
  showLabels: true,
  showMessages: true,
  showDetails: true,
  simplifyPaths: false,
  maxAgents: 500,
  maxMessages: 1000,
  pathSimplificationTolerance: 1
});

// Viewport state for optimization
const viewport = ref<ViewportState>({
  zoom: 1,
  panX: 0,
  panY: 0,
  width: 1200,
  height: 600,
  timeRange: { start: Date.now() - 300000, end: Date.now(), duration: 300000, pixelsPerMs: 1 },
  followMode: props.followLatest
});

// Performance monitoring
const isPerformanceMode = ref(false);

// Timeline Configuration
const timelineMargins = {
  top: 60,
  right: 50,
  bottom: 40,
  left: 120
};
const orchestratorY = 80;
const agentLaneHeight = 40;

// Agent Type Colors (from design tokens)
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
  engineer: '#ff6b6b' // fallback to coder color
};

// Status Colors
const statusColors = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  error: '#ef4444'
};

// Computed Properties - Use real-time data when WebSocket is connected
const currentAgents = computed(() => {
  return props.wsConnection ? realtimeAgents.value : props.agents;
});

const currentMessages = computed(() => {
  return props.wsConnection ? realtimeMessages.value : props.messages;
});

const totalAgents = computed(() => currentAgents.value.length);

const visibleAgents = computed(() => {
  const renderStart = performance.now();
  
  // Transform agents to timeline format with highlighting (preserving WebSocket functionality)
  const allAgents = currentAgents.value.map((agent: AgentStatus) => {
    const isRecentlyUpdated = recentlyUpdatedAgents.value.has(agent.id.toString());
    return {
      ...agent,
      agentId: agent.id.toString(),
      type: agent.subagent_type,
      startTime: agent.created_at,
      endTime: agent.completion_timestamp || null,
      status: agent.status || 'pending',
      laneIndex: 0, // Will be calculated by viewport culler
      isRecentlyUpdated
    };
  });

  // Auto-enable performance mode for large datasets
  if (allAgents.length > 200 && !isPerformanceMode.value) {
    console.log('Large agent count detected:', allAgents.length, 'Enabling performance optimizations');
    isPerformanceMode.value = true;
  }

  // Update viewport state for culling calculations
  viewport.value.zoom = zoomLevel.value;
  viewport.value.panX = panX.value;
  viewport.value.panY = panY.value;
  viewport.value.width = containerWidth.value;
  viewport.value.height = containerHeight.value;

  // Calculate level of detail based on current conditions
  const currentLOD = lodManager.calculateLOD(
    zoomLevel.value,
    allAgents.length,
    currentMessages.value.length,
    isPerformanceMode.value ? 'performance' : 'auto'
  );
  levelOfDetail.value = currentLOD;

  // Apply viewport culling for performance with large datasets
  let visibleAgentsList = allAgents;
  if (allAgents.length > 50) {
    const timelineConfig = {
      width: containerWidth.value,
      height: containerHeight.value,
      margins: timelineMargins,
      orchestratorY,
      agentLaneHeight,
      maxAgentLanes: 20
    } as any;

    try {
      visibleAgentsList = viewportCuller.cullAgents(
        allAgents as any,
        viewport.value,
        timelineConfig
      );
    } catch (error) {
      console.warn('Viewport culling failed, using all agents:', error);
      visibleAgentsList = allAgents;
    }
  }

  // Limit based on LOD to maintain 60fps
  const finalList = visibleAgentsList.slice(0, currentLOD.maxAgents);

  // Schedule performance tracking update to avoid blocking render
  const renderTime = performance.now() - renderStart;
  renderScheduler.schedule('performance-update', () => {
    performanceTracker.updateMetrics(renderTime, {
      total: allAgents.length,
      visible: finalList.length,
      agents: allAgents.length,
      messages: currentMessages.value.length
    });
    performanceMetrics.value = performanceTracker.getMetrics();
    
    // Auto-adjust LOD based on performance
    if (performanceMetrics.value.fps < 40 && !isPerformanceMode.value) {
      isPerformanceMode.value = true;
      console.warn('Performance mode auto-enabled, FPS:', performanceMetrics.value.fps);
    }
  }, 'low');

  return finalList;
});

const timeRange = computed(() => {
  if (visibleAgents.value.length === 0) {
    const now = Date.now();
    return { start: now - 300000, end: now }; // 5 minutes range
  }

  const times = visibleAgents.value.map(agent => agent.startTime);
  const endTimes = visibleAgents.value
    .map(agent => agent.endTime)
    .filter(t => t !== null);
  
  const allTimes = [...times, ...endTimes];
  const start = Math.min(...allTimes);
  const end = Math.max(...allTimes);
  const padding = (end - start) * 0.1; // 10% padding

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
  // Group agents by spawn time to identify batches
  const batchMap = new Map();
  
  visibleAgents.value.forEach(agent => {
    const spawnTime = agent.startTime;
    const key = Math.floor(spawnTime / 5000) * 5000; // 5-second grouping
    
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
  // For now, return empty array - will be populated from WebSocket events
  return [] as Array<{id: string; timestamp: number; content: string}>;
});

const visibleMessages = computed(() => {
  if (!levelOfDetail.value.showMessages) {
    return []; // Hide messages at low zoom levels for performance
  }

  const allMessages = currentMessages.value.map((message: SubagentMessage) => {
    const messageId = `msg-${message.created_at}-${message.sender}`;
    const isRecentlyAdded = recentlyAddedMessages.value.has(messageId);
    return {
      ...message,
      id: messageId,
      isRecentlyAdded,
      timestamp: message.created_at,
      position: {
        x: getTimeX(message.created_at),
        y: getMessageY(message)
      }
    };
  });

  // Apply viewport culling to messages for large datasets
  let visibleMessagesList = allMessages;
  if (allMessages.length > 100 && isPerformanceMode.value) {
    const timelineConfig = {
      width: containerWidth.value,
      height: containerHeight.value,
      margins: timelineMargins,
      orchestratorY,
      agentLaneHeight
    } as any;

    try {
      visibleMessagesList = viewportCuller.cullMessages(
        allMessages as any,
        viewport.value,
        timelineConfig
      );
    } catch (error) {
      console.warn('Message viewport culling failed, using all messages:', error);
      visibleMessagesList = allMessages;
    }
  }

  // Limit based on LOD to maintain smooth rendering
  return visibleMessagesList.slice(0, levelOfDetail.value.maxMessages);
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

const getStrokeWidth = (status: string): number => {
  switch (status) {
    case 'completed': return 2;
    case 'in_progress': return 3;
    case 'error': return 3;
    default: return 2;
  }
};

const getAgentLineClass = (status: string, isRecentlyUpdated: boolean = false): string => {
  const baseClass = 'drop-shadow-[0_0_8px_currentColor] transition-all duration-300';
  let animationClass = '';
  
  if (status === 'in_progress') {
    animationClass += ' animate-pulse';
  }
  
  if (isRecentlyUpdated) {
    animationClass += ' animate-pulse';
  }
  
  return baseClass + animationClass;
};

const getStatusIndicatorClass = (status: string, isRecentlyUpdated: boolean = false): string => {
  let classes = 'transition-all duration-300';
  
  if (status === 'in_progress' || isRecentlyUpdated) {
    classes += ' animate-pulse';
  }
  
  return classes;
};

const getMessageIndicatorClass = (isRecentlyAdded: boolean = false): string => {
  let classes = 'cursor-pointer hover:opacity-80 transition-all duration-300';
  
  if (isRecentlyAdded) {
    classes += ' animate-bounce';
  }
  
  return classes;
};

const getMessageFlowPath = (message: any): string => {
  // Create a simple animated flow path from orchestrator to message position
  const startX = timelineMargins.left;
  const startY = orchestratorY;
  const endX = message.position.x;
  const endY = message.position.y;
  
  // Create a curved path for better visual flow
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - 20; // Arc above
  
  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
};

const getMessageY = (message: SubagentMessage): number => {
  // Find the agent lane for this message sender
  const agentIndex = visibleAgents.value.findIndex(agent => agent.name === message.sender);
  if (agentIndex !== -1) {
    return getAgentLaneY(agentIndex);
  }
  // Default to orchestrator level if sender not found
  return orchestratorY;
};

// Event Handlers
const handleMouseMove = (_event: MouseEvent) => {
  // TODO: Implement tooltip logic
};

const handleClick = (_event: MouseEvent) => {
  // TODO: Implement click handling for timeline elements
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

const selectBatch = (batch: any) => {
  emit('batch-selected', batch);
};

const selectMessage = (message: any) => {
  emit('message-clicked', message);
};

const selectPrompt = (prompt: any) => {
  emit('prompt-clicked', prompt);
};

// Control Functions with performance optimization
const zoomIn = () => {
  const newZoom = Math.min(zoomLevel.value * 1.2, 5);
  renderScheduler.schedule('zoom-update', () => {
    zoomLevel.value = newZoom;
  }, 'high');
};

const zoomOut = () => {
  const newZoom = Math.max(zoomLevel.value / 1.2, 0.2);
  renderScheduler.schedule('zoom-update', () => {
    zoomLevel.value = newZoom;
  }, 'high');
};

const resetZoom = () => {
  renderScheduler.schedule('reset-zoom', () => {
    zoomLevel.value = 1;
    panX.value = 0;
    panY.value = 0;
  }, 'high');
};

const togglePerformanceMode = () => {
  isPerformanceMode.value = !isPerformanceMode.value;
  console.log('Performance mode:', isPerformanceMode.value ? 'enabled' : 'disabled');
};

const resetPerformanceMetrics = () => {
  performanceTracker.reset?.();
};

// Auto-scroll functionality
const handleAutoScroll = () => {
  if (autoScroll.value && props.followLatest) {
    const now = Date.now();
    // Throttle auto-scroll to prevent excessive updates
    if (now - lastScrollTime.value > 500) {
      scrollToLatestContent();
      lastScrollTime.value = now;
    }
  }
};

const scrollToLatestContent = () => {
  if (visibleAgents.value.length > 0) {
    // Find the most recent activity
    const latestTime = Math.max(
      ...visibleAgents.value.map(agent => 
        Math.max(agent.startTime, agent.endTime || 0)
      ),
      ...visibleMessages.value.map(msg => msg.created_at)
    );
    
    // Adjust pan to show latest content
    const latestX = getTimeX(latestTime);
    const viewportCenter = containerWidth.value / 2;
    
    if (latestX > viewportCenter) {
      panX.value = Math.max(viewportCenter - latestX, -containerWidth.value);
    }
  }
};

// Custom event listener for timeline scroll requests
const handleTimelineScrollEvent = (_event: Event) => {
  if (props.sessionId) {
    handleAutoScroll();
  }
};

// Lifecycle
const updateDimensions = () => {
  if (timelineContainer.value) {
    containerWidth.value = timelineContainer.value.clientWidth;
    containerHeight.value = props.height;
  }
};

onMounted(() => {
  updateDimensions();
  window.addEventListener('resize', updateDimensions);
  document.addEventListener('timeline-scroll-to-latest', handleTimelineScrollEvent as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateDimensions);
  document.removeEventListener('timeline-scroll-to-latest', handleTimelineScrollEvent as EventListener);
});

// Watch for container height changes
watch(() => props.height, (newHeight) => {
  containerHeight.value = newHeight;
});

// Watch for new agents/messages and handle auto-scroll
watch([visibleAgents, visibleMessages], () => {
  nextTick(() => {
    handleAutoScroll();
  });
}, { deep: true });

// Sync auto-scroll setting with timeline WebSocket composable
watch(() => autoScroll.value, (newValue) => {
  shouldAutoScroll.value = newValue;
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

.timeline-header {
  flex-shrink: 0;
}

.timeline-footer {
  flex-shrink: 0;
}

/* Mobile optimizations */
@media (max-width: 699px) {
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
</style>