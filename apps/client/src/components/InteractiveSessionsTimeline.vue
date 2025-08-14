<template>
  <div class="sessions-timeline-container w-full h-full bg-gray-800 rounded-lg border border-blue-400/30 overflow-hidden">
    
    <!-- Session Filters Panel -->
    <div v-if="false" class="bg-gray-700 px-4 py-2 border-b border-gray-600">
      <div class="text-gray-400 text-sm">Filters temporarily disabled</div>
    </div>
    
    <!-- Sessions Timeline Header -->
    <div class="timeline-header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <div class="flex items-center justify-between">
        <h3 class="text-white font-bold text-lg">Sessions Timeline</h3>
        <div class="flex items-center space-x-4">
          <!-- Enhanced Time Window Controls -->
          <div class="flex items-center space-x-2 text-sm">
            <span class="text-gray-300">Window:</span>
            <button 
              v-for="window in timeWindows"
              :key="window.label"
              @click="setTimeWindow(window.value)"
              class="px-3 py-1 rounded text-xs font-medium transition-all duration-200 transform hover:scale-105"
              :class="currentWindow === window.value 
                ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'"
              :title="`Switch to ${window.label} time window (Key: ${getWindowShortcut(window.value)})`"
            >
              {{ window.label }}
            </button>
            <!-- Time Window Transition Indicator -->
            <div v-if="isTimeWindowTransitioning" class="ml-2">
              <div class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          
          <!-- Session Stats -->
          <div class="flex items-center space-x-3 text-sm">
            <span class="text-green-400">● {{ activeSessions.length }} Active</span>
            <span class="text-gray-400">{{ totalSessions }} Total</span>
            <span class="text-blue-400">{{ totalAgents }} Agents</span>
            <span class="text-purple-400">{{ Math.round(performanceMetrics.frameRate) }}fps</span>
            <span class="text-orange-400">{{ performanceMetrics.memoryUsage.toFixed(1) }}MB</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sessions Content Area -->
    <div class="sessions-content relative w-full flex-1 overflow-hidden" ref="sessionsContainer">
      <!-- SVG Sessions Timeline -->
      <svg
        ref="sessionsSvg"
        :width="containerWidth"
        :height="containerHeight"
        class="absolute top-0 left-0 w-full h-full"
        :class="{ 'cursor-grabbing': isPanning, 'cursor-grab': !isPanning }"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove" 
        @mouseup="handleMouseUp"
        @click="handleClickAndHideTooltip"
        @wheel="handleWheel"
        @mouseleave="handleMouseLeave"
      >
        <!-- Definitions -->
        <defs>
          <!-- Grid pattern for time background -->
          <pattern id="sessions-grid" width="60" height="40" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1"/>
          </pattern>
          
          <!-- Session colors gradients -->
          <linearGradient id="session-orchestrator" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#00d4ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
          
          <!-- Agent type gradients (reused from single timeline) -->
          <g v-for="colorKey in agentColorKeys" :key="`grad-${colorKey}`">
            <linearGradient :id="`sessionAgentGrad-${colorKey}`" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.3`" />
              <stop offset="30%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:1`" />
              <stop offset="70%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:1`" />
              <stop offset="100%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.3`" />
            </linearGradient>
          </g>
          
          <!-- Glow filters -->
          <filter id="sessionGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Grid Background -->
        <rect width="100%" height="100%" fill="url(#sessions-grid)" style="pointer-events: none;" />

        <!-- Time Axis (shared across all sessions) -->
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

        <!-- Session Swim Lanes -->
        <g class="session-lanes">
          <g v-for="(session, sessionIndex) in visibleSessions" :key="session.sessionId" class="session-lane">
            <!-- Session Lane Background -->
            <rect
              :x="timelineMargins.left"
              :y="getSessionLaneY(sessionIndex)"
              :width="containerWidth - timelineMargins.left - timelineMargins.right"
              :height="sessionLaneHeight"
              :fill="sessionIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)'"
              :stroke="selectedSession?.sessionId === session.sessionId ? '#3b82f6' : 'transparent'"
              :stroke-width="selectedSession?.sessionId === session.sessionId ? '2' : '0'"
              class="cursor-pointer transition-all duration-200"
              @click="selectSession(session)"
            />
            
            <!-- Session Orchestrator Line -->
            <line 
              :x1="timelineMargins.left" 
              :y1="getSessionOrchestratorY(sessionIndex)"
              :x2="containerWidth - timelineMargins.right" 
              :y2="getSessionOrchestratorY(sessionIndex)"
              stroke="url(#session-orchestrator)" 
              stroke-width="4"
              class="drop-shadow-[0_0_8px_#00d4ff]"
              opacity="0.8"
            />
            
            <!-- Session Label -->
            <text 
              :x="timelineMargins.left - 10" 
              :y="getSessionOrchestratorY(sessionIndex) + 4"
              text-anchor="end" 
              fill="#00d4ff" 
              font-size="12px"
              font-weight="600"
              font-family="system-ui"
              class="cursor-pointer select-none"
              @click="selectSession(session)"
            >
              {{ session.displayName }}
            </text>
            
            <!-- Session Status Indicator -->
            <circle
              :cx="timelineMargins.left - 25"
              :cy="getSessionOrchestratorY(sessionIndex)"
              r="3"
              :fill="getSessionStatusColor(session.status)"
              class="drop-shadow-sm"
            />

            <!-- Agent Paths for this Session -->
            <g class="session-agents" v-if="session.agents.length > 0">
              <g v-for="agent in session.agents" :key="agent.agentId" class="agent-path">
                <!-- Curved Agent Path -->
                <path
                  :d="getSessionAgentPath(agent, sessionIndex)"
                  :stroke="`url(#sessionAgentGrad-${agent.type})`"
                  :stroke-width="getAgentStrokeWidth(agent.status, isAgentSelected(agent))"
                  :class="getAgentPathClass(agent.status, isAgentSelected(agent))"
                  class="cursor-pointer transition-all duration-200"
                  fill="none"
                  @click="selectAgent(agent, session)"
                  @mouseenter="showAgentTooltip(agent, session, $event)"
                  @mouseleave="hideTooltip"
                />
                
                <!-- Agent Label -->
                <text 
                  :x="getAgentLabelPosition(agent, sessionIndex).x"
                  :y="getAgentLabelPosition(agent, sessionIndex).y"
                  text-anchor="middle" 
                  :fill="getAgentColor(agent.type)"
                  font-size="9px"
                  font-weight="500"
                  font-family="system-ui"
                  class="cursor-pointer select-none"
                  :class="isAgentSelected(agent) ? 'opacity-100 font-semibold' : 'opacity-70 hover:opacity-90'"
                  @click="selectAgent(agent, session)"
                >
                  {{ agent.name }}
                </text>
              </g>
            </g>

            <!-- Session Messages -->
            <g class="session-messages" v-if="session.messages.length > 0">
              <g v-for="message in session.messages" :key="message.id">
                <circle 
                  :cx="getTimeX(message.timestamp)" 
                  :cy="getMessageY(message, sessionIndex)"
                  r="2"
                  :fill="getMessageColor(message)"
                  stroke="#ffffff"
                  stroke-width="1"
                  class="cursor-pointer transition-all duration-200 hover:drop-shadow-[0_0_6px_currentColor]"
                  @click="selectMessage(message, session)"
                  @mouseenter="showMessageTooltip(message, session, $event)"
                  @mouseleave="hideTooltip"
                />
              </g>
            </g>
          </g>
        </g>

        <!-- NOW marker line -->
        <line
          :x1="getNowX()"
          :y1="timelineMargins.top - 10"
          :x2="getNowX()"
          :y2="containerHeight - timelineMargins.bottom"
          stroke="#22c55e"
          stroke-width="2"
          stroke-dasharray="4,4"
          opacity="0.8"
          class="animate-pulse"
        />
        <text
          :x="getNowX() + 5"
          :y="timelineMargins.top - 15"
          fill="#22c55e"
          font-size="10px"
          font-weight="600"
        >
          NOW
        </text>
      </svg>

      <!-- Sessions Timeline Tooltip -->
      <SessionsTooltip 
        :visible="tooltip.visible"
        :tooltip-data="tooltip"
        @tooltip-mouse-enter="onTooltipMouseEnter"
        @tooltip-mouse-leave="onTooltipMouseLeave"
      />

      <!-- Loading Overlay -->
      <div v-if="isLoading" class="absolute inset-0 bg-gray-800/50 flex items-center justify-center">
        <div class="text-white text-lg">Loading sessions timeline...</div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && totalSessions === 0" class="absolute inset-0 flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <div class="text-2xl mb-2">🔄</div>
          <div class="text-lg mb-2">No sessions in time window</div>
          <div class="text-sm">Try adjusting the time window or check filters</div>
        </div>
      </div>
    </div>

    <!-- Sessions Controls -->
    <div v-if="showControls" class="sessions-footer bg-gray-700 px-4 py-2 border-t border-gray-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <button 
            @click="zoomIn" 
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 text-sm font-medium"
            title="Zoom In (+)"
            :disabled="zoomLevel >= 10"
            :class="zoomLevel >= 10 ? 'opacity-50 cursor-not-allowed' : ''"
          >
            🔍+ Zoom In
          </button>
          <button 
            @click="zoomOut" 
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 text-sm font-medium"
            title="Zoom Out (-)"
            :disabled="zoomLevel <= 0.1"
            :class="zoomLevel <= 0.1 ? 'opacity-50 cursor-not-allowed' : ''"
          >
            🔍- Zoom Out
          </button>
          <button 
            @click="resetView" 
            class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 text-sm font-medium"
            title="Reset View (R)"
          >
            ⚡ Reset View
          </button>
          <button 
            @click="clearSelections" 
            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-all duration-200 transform hover:scale-105 text-sm font-medium"
            title="Clear Selection (Esc)"
            v-if="selectedSession || selectedAgent || selectedMessage"
          >
            ✕ Clear Selection
          </button>
          
          <!-- Enhanced Zoom Level Indicator -->
          <div class="flex items-center space-x-2 px-3 py-1 bg-gray-800 rounded border border-gray-600">
            <span class="text-gray-400 text-xs">Zoom:</span>
            <div class="flex items-center space-x-1">
              <div class="w-16 h-1 bg-gray-600 rounded overflow-hidden">
                <div 
                  class="h-full bg-blue-500 transition-all duration-200"
                  :style="{ width: `${Math.min((zoomLevel / 10) * 100, 100)}%` }"
                ></div>
              </div>
              <span class="text-white text-xs font-mono min-w-[3rem] text-right">
                {{ Math.round(zoomLevel * 100) }}%
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-2 text-sm">
          <span class="text-gray-300">
            {{ visibleSessions.length }} sessions in window
          </span>
          <span class="text-gray-500">|</span>
          <span class="text-gray-300">
            Zoom: {{ Math.round(zoomLevel * 100) }}%
          </span>
          <span v-if="filterPerformanceMetrics" class="text-gray-500">|</span>
          <span v-if="filterPerformanceMetrics" class="text-gray-300 text-xs">
            Filter: {{ filterPerformanceMetrics.filterTime.toFixed(1) }}ms
          </span>
          <span class="text-gray-500">|</span>
          <span class="text-gray-300 text-xs">
            Shortcuts: Ctrl+Scroll, ←→↑↓, +/-, R, 1-4
          </span>
        </div>
      </div>
    </div>

    <!-- Selection Info Bar -->
    <div 
      v-if="selectedSession || selectedAgent || selectedMessage" 
      class="selection-info bg-blue-600/20 border-t border-blue-400/30 px-4 py-2 text-sm"
    >
      <div v-if="selectedSession && !selectedAgent && !selectedMessage" class="flex items-center justify-between">
        <span class="text-blue-400">
          Selected Session: <strong>{{ selectedSession.displayName }}</strong>
        </span>
        <span class="text-gray-400">
          {{ selectedSession.agents.length }} agents, {{ selectedSession.messages.length }} messages
        </span>
      </div>
      <div v-else-if="selectedAgent" class="flex items-center justify-between">
        <span class="text-green-400">
          Selected Agent: <strong>{{ selectedAgent.name }}</strong> in {{ selectedSession?.displayName }}
        </span>
        <span class="text-gray-400">
          Type: {{ selectedAgent.type }}, Status: {{ selectedAgent.status }}
        </span>
      </div>
      <div v-else-if="selectedMessage" class="flex items-center justify-between">
        <span class="text-yellow-400">
          Selected Message from: <strong>{{ selectedMessage.sender }}</strong> in {{ selectedSession?.displayName }}
        </span>
        <span class="text-gray-400">
          {{ formatTimestamp(selectedMessage.timestamp) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import SessionsTooltip from './SessionsTooltip.vue';
import SessionFilterPanel from './SessionFilterPanel.vue';
import { SessionFilterUtils, DEFAULT_SESSION_FILTERS } from '../types/session-filters';
import type { SessionFilterState } from '../types/session-filters';
import { SessionDataAdapter } from '../utils/session-data-adapter';
import type { SessionData, SessionAgent, SessionMessage } from '../utils/session-data-adapter';
import { usePerformanceOptimizer } from '../composables/usePerformanceOptimizer';

interface TimeWindow {
  label: string;
  value: number; // Duration in milliseconds
}

// ============================================================================
// Component Props
// ============================================================================

const props = withDefaults(defineProps<{
  sessions?: any[]; // Accept any type for emergency fix
  height?: number;
  showControls?: boolean;
  defaultWindow?: number;
  autoRefresh?: boolean;
}>(), {
  sessions: () => [],
  height: 600,
  showControls: true,
  defaultWindow: 3600000, // 1 hour
  autoRefresh: true
});

// ============================================================================
// Component Events
// ============================================================================

const emit = defineEmits<{
  'session-selected': [session: SessionData];
  'agent-selected': [agent: SessionAgent, session: SessionData];
  'message-selected': [message: SessionMessage, session: SessionData];
  'time-window-changed': [window: number];
  'zoom-changed': [zoom: number];
  'filters-changed': [filterEvent: {
    filters: SessionFilterState;
    isActive: boolean;
    metrics: { filterTime: number; resultCount: number } | null;
  }];
}>();

// ============================================================================
// Reactive State
// ============================================================================

// Initialize Performance Optimizer
const { performanceMetrics } = usePerformanceOptimizer();

// Container refs
const sessionsContainer = ref<HTMLDivElement>();
const sessionsSvg = ref<SVGElement>();

// Dimensions
const containerWidth = ref(1200);
const containerHeight = ref(600);

// View state
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const currentWindow = ref(props.defaultWindow);

// Enhanced interaction state
const isPanning = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const initialPanPos = ref({ x: 0, y: 0 });
const dragDistance = ref(0);
const PAN_THRESHOLD = 5;

// Momentum pan state
const panVelocity = ref({ x: 0, y: 0 });
const lastPanTime = ref(0);
const lastPanPosition = ref({ x: 0, y: 0 });
const momentumDecay = 0.95;
let momentumAnimationId: number | null = null;

// Smooth zoom state
const isZooming = ref(false);
const zoomCenter = ref({ x: 0, y: 0 });
const targetZoom = ref(1);
let zoomAnimationId: number | null = null;

// Time window transition state
const isTimeWindowTransitioning = ref(false);
let timeWindowTransitionId: number | null = null;

// Selection state
const selectedSession = ref<SessionData | null>(null);
const selectedAgent = ref<SessionAgent | null>(null);
const selectedMessage = ref<SessionMessage | null>(null);

// Loading state
const isLoading = ref(false);

// Tooltip state
const tooltip = ref<{
  visible: boolean;
  type: 'session' | 'agent' | 'message';
  data: any;
  position: { x: number; y: number };
}>({ 
  visible: false, 
  type: 'session', 
  data: null, 
  position: { x: 0, y: 0 } 
});

// ============================================================================
// Configuration
// ============================================================================

const timelineMargins = {
  top: 60,
  right: 50,
  bottom: 40,
  left: 120
};

const sessionLaneHeight = 80; // Height allocated per session
const agentLaneHeight = 20;   // Height per agent lane within session

const timeWindows: TimeWindow[] = [
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 }
];

// Agent colors (reuse from single timeline)
const agentColors: Record<string, string> = {
  orchestrator: '#00d4ff',
  coder: '#ff6b6b',
  architect: '#4ecdc4',
  reviewer: '#95e77e',
  gatekeeper: '#a78bfa',
  verifier: '#a78bfa', 
  planner: '#f97316',
  analyst: '#ec4899',
  researcher: '#06b6d4',
  designer: '#8b5cf6',
  'cloud-cicd': '#22c55e',
  'general-purpose': '#9ca3af',
  'deep-researcher': '#0ea5e9',
  'business-analyst': '#d946ef',
  engineer: '#ff6b6b'
};

// ============================================================================
// Computed Properties
// ============================================================================

const timeRange = computed(() => {
  const now = Date.now();
  return {
    start: now - currentWindow.value,
    end: now,
    duration: currentWindow.value
  };
});

// Filter state
const currentFilters = ref<SessionFilterState>({ ...DEFAULT_SESSION_FILTERS });
const filterPerformanceMetrics = ref<{ filterTime: number; resultCount: number } | null>(null);

// Transformed sessions using data adapter for format consistency
const transformedSessions = computed((): SessionData[] => {
  console.log('🔍 DataDragon: InteractiveSessionsTimeline transformedSessions computed', {
    propsSessionsLength: props.sessions?.length || 0,
    propsSessionsType: typeof props.sessions,
    firstSession: props.sessions?.[0]
  });
  
  // Use props data if available
  if (props.sessions && props.sessions.length > 0) {
    console.log('✅ DataDragon: Using props sessions data:', props.sessions.length);
    return SessionDataAdapter.normalizeToSessionDataArray(props.sessions);
  }
  
  // Generate mock data as fallback
  console.log('🎭 DataDragon: Generating mock sessions data');
  return SessionDataAdapter.createMockSessionData(5);
});

const visibleSessions = computed((): SessionData[] => {
  const { start, end } = timeRange.value;
  
  // First, apply time window filter
  let timeFilteredSessions = transformedSessions.value.filter(session => {
    // Include session if it overlaps with time window
    const sessionEnd = session.endTime || Date.now();
    return session.startTime <= end && sessionEnd >= start;
  });
  
  // Then apply session filters
  if (SessionFilterUtils.isFilterActive(currentFilters.value)) {
    const { filteredSessions, metrics } = SessionFilterUtils.applyFilters(
      timeFilteredSessions, 
      currentFilters.value
    );
    
    // Update performance metrics for monitoring
    filterPerformanceMetrics.value = {
      filterTime: metrics.filterApplicationTime,
      resultCount: metrics.filteredSessionCount
    };
    
    // Log performance warning if filters take too long
    if (metrics.filterApplicationTime > 50) {
      console.warn(`Session filter performance warning: ${metrics.filterApplicationTime}ms (target: <50ms)`);
    }
    
    return filteredSessions.sort((a, b) => a.startTime - b.startTime);
  }
  
  // Reset performance metrics when no filters active
  filterPerformanceMetrics.value = null;
  
  return timeFilteredSessions.sort((a, b) => a.startTime - b.startTime);
});

const totalSessions = computed(() => visibleSessions.value.length);
const activeSessions = computed(() => visibleSessions.value.filter(s => s.status === 'active'));
const totalAgents = computed(() => visibleSessions.value.reduce((sum, session) => sum + session.agentCount, 0));

const agentColorKeys = computed(() => {
  const usedTypes = new Set<string>();
  visibleSessions.value.forEach(session => {
    session.agents.forEach(agent => usedTypes.add(agent.type));
  });
  return Array.from(usedTypes);
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
      minute: '2-digit' 
    });
    
    ticks.push({ time, x, label });
  }
  
  return ticks;
});

// ============================================================================
// Position Calculation Functions
// ============================================================================

const getTimeX = (timestamp: number): number => {
  const { start, end } = timeRange.value;
  const timelineWidth = containerWidth.value - timelineMargins.left - timelineMargins.right;
  const ratio = (timestamp - start) / (end - start);
  return timelineMargins.left + (ratio * timelineWidth * zoomLevel.value) + panX.value;
};

const getNowX = (): number => {
  return getTimeX(Date.now());
};

const getSessionLaneY = (sessionIndex: number): number => {
  return timelineMargins.top + (sessionIndex * sessionLaneHeight);
};

const getSessionOrchestratorY = (sessionIndex: number): number => {
  return getSessionLaneY(sessionIndex) + sessionLaneHeight / 2;
};

const getAgentLaneY = (agent: SessionAgent, sessionIndex: number): number => {
  const sessionCenterY = getSessionOrchestratorY(sessionIndex);
  const laneOffset = (agent.laneIndex - 1) * agentLaneHeight;
  return sessionCenterY + laneOffset;
};

const getSessionAgentPath = (agent: SessionAgent, sessionIndex: number): string => {
  const startX = getTimeX(agent.startTime);
  const endX = getTimeX(agent.endTime || Date.now());
  const orchestratorY = getSessionOrchestratorY(sessionIndex);
  const agentY = getAgentLaneY(agent, sessionIndex);
  
  const branchOut = 15; // Distance to branch out from orchestrator
  const mergeBack = 15; // Distance before merging back
  
  if (agent.status === 'completed' && agent.endTime) {
    // Complete path with merge back
    return `M ${startX} ${orchestratorY} 
            C ${startX + branchOut} ${orchestratorY} 
              ${startX + branchOut} ${agentY} 
              ${startX + branchOut * 1.5} ${agentY}
            L ${endX - mergeBack * 1.5} ${agentY}
            C ${endX - mergeBack} ${agentY}
              ${endX - mergeBack} ${orchestratorY}
              ${endX} ${orchestratorY}`;
  } else {
    // In-progress path
    return `M ${startX} ${orchestratorY} 
            C ${startX + branchOut} ${orchestratorY} 
              ${startX + branchOut} ${agentY} 
              ${startX + branchOut * 1.5} ${agentY}
            L ${endX} ${agentY}`;
  }
};

const getAgentLabelPosition = (agent: SessionAgent, sessionIndex: number) => {
  const startX = getTimeX(agent.startTime);
  const endX = getTimeX(agent.endTime || Date.now());
  const agentY = getAgentLaneY(agent, sessionIndex);
  
  return {
    x: (startX + endX) / 2,
    y: agentY - 5
  };
};

const getMessageY = (message: SessionMessage, sessionIndex: number): number => {
  // Try to position message near the sending agent
  const session = visibleSessions.value[sessionIndex];
  const sender = session.agents.find(a => a.name === message.sender);
  
  if (sender) {
    return getAgentLaneY(sender, sessionIndex);
  }
  
  // Fallback to orchestrator line
  return getSessionOrchestratorY(sessionIndex);
};

// ============================================================================
// Styling Functions
// ============================================================================

const getSessionStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return '#22c55e';
    case 'completed': return '#6b7280';
    case 'failed': return '#ef4444';
    default: return '#9ca3af';
  }
};

const getAgentColor = (type: string): string => {
  return agentColors[type] || agentColors['general-purpose'];
};

const getAgentStrokeWidth = (status: string, isSelected: boolean): number => {
  let width = 2;
  if (status === 'in_progress') width = 3;
  if (isSelected) width += 1;
  return width;
};

const getAgentPathClass = (status: string, isSelected: boolean): string => {
  let classes = 'transition-all duration-200';
  if (status === 'in_progress') classes += ' animate-pulse';
  if (isSelected) classes += ' drop-shadow-[0_0_8px_currentColor]';
  return classes;
};

const getMessageColor = (message: SessionMessage): string => {
  // Simple coloring based on message properties
  // This could be enhanced with read status logic
  return '#3b82f6';
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// ============================================================================
// Selection Functions
// ============================================================================

const isAgentSelected = (agent: SessionAgent): boolean => {
  return selectedAgent.value?.agentId === agent.agentId;
};

const selectSession = (session: SessionData) => {
  selectedSession.value = session;
  selectedAgent.value = null;
  selectedMessage.value = null;
  emit('session-selected', session);
};

const selectAgent = (agent: SessionAgent, session: SessionData) => {
  selectedSession.value = session;
  selectedAgent.value = agent;
  selectedMessage.value = null;
  emit('agent-selected', agent, session);
};

const selectMessage = (message: SessionMessage, session: SessionData) => {
  selectedSession.value = session;
  selectedMessage.value = message;
  selectedAgent.value = null;
  emit('message-selected', message, session);
};

const clearSelections = () => {
  selectedSession.value = null;
  selectedAgent.value = null;
  selectedMessage.value = null;
};

// ============================================================================
// Time Window Functions
// ============================================================================

const setTimeWindow = (windowSize: number) => {
  const oldWindow = currentWindow.value;
  
  if (oldWindow === windowSize) return;
  
  isTimeWindowTransitioning.value = true;
  currentWindow.value = windowSize;
  emit('time-window-changed', windowSize);
  
  // Smooth transition animation
  let transitionProgress = 0;
  const transitionDuration = 400; // ms
  const startTime = performance.now();
  
  const animateWindowTransition = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    transitionProgress = Math.min(elapsed / transitionDuration, 1);
    
    // Ease-out transition
    const easeOut = 1 - Math.pow(1 - transitionProgress, 3);
    
    // Gradually reset pan position
    panX.value *= (1 - easeOut * 0.05);
    panY.value *= (1 - easeOut * 0.05);
    
    if (transitionProgress < 1) {
      timeWindowTransitionId = requestAnimationFrame(animateWindowTransition);
    } else {
      // Transition complete
      isTimeWindowTransitioning.value = false;
      timeWindowTransitionId = null;
      panX.value = 0;
      panY.value = 0;
    }
  };
  
  timeWindowTransitionId = requestAnimationFrame(animateWindowTransition);
};

const getWindowShortcut = (windowValue: number): string => {
  const shortcuts: Record<number, string> = {
    [15 * 60 * 1000]: '1',
    [60 * 60 * 1000]: '2', 
    [6 * 60 * 60 * 1000]: '3',
    [24 * 60 * 60 * 1000]: '4'
  };
  return shortcuts[windowValue] || '';
};

// ============================================================================
// Zoom and Pan Functions
// ============================================================================

const zoomIn = () => {
  // Center zoom on viewport center
  if (sessionsContainer.value) {
    const rect = sessionsContainer.value.getBoundingClientRect();
    zoomCenter.value = {
      x: rect.width / 2,
      y: rect.height / 2
    };
  }
  
  targetZoom.value = Math.min(zoomLevel.value * 1.25, 10);
  
  if (!zoomAnimationId) {
    animateZoom();
  }
};

const zoomOut = () => {
  // Center zoom on viewport center
  if (sessionsContainer.value) {
    const rect = sessionsContainer.value.getBoundingClientRect();
    zoomCenter.value = {
      x: rect.width / 2,
      y: rect.height / 2
    };
  }
  
  targetZoom.value = Math.max(zoomLevel.value / 1.25, 0.1);
  
  if (!zoomAnimationId) {
    animateZoom();
  }
};

const resetView = () => {
  // Stop any ongoing animations
  if (zoomAnimationId) {
    cancelAnimationFrame(zoomAnimationId);
    zoomAnimationId = null;
  }
  if (momentumAnimationId) {
    cancelAnimationFrame(momentumAnimationId);
    momentumAnimationId = null;
  }
  
  // Reset to default state with animation
  targetZoom.value = 1;
  
  // Animate reset
  const animateReset = () => {
    const zoomDiff = 1 - zoomLevel.value;
    const panXDiff = -panX.value;
    const panYDiff = -panY.value;
    
    if (Math.abs(zoomDiff) < 0.01 && Math.abs(panXDiff) < 1 && Math.abs(panYDiff) < 1) {
      zoomLevel.value = 1;
      panX.value = 0;
      panY.value = 0;
      emit('zoom-changed', zoomLevel.value);
      return;
    }
    
    zoomLevel.value += zoomDiff * 0.15;
    panX.value += panXDiff * 0.15;
    panY.value += panYDiff * 0.15;
    
    emit('zoom-changed', zoomLevel.value);
    requestAnimationFrame(animateReset);
  };
  
  animateReset();
};

// ============================================================================
// Mouse Interaction Handlers
// ============================================================================

const handleMouseDown = (event: MouseEvent) => {
  if (event.target === sessionsSvg.value) {
    isPanning.value = true;
    dragStartPos.value = { x: event.clientX, y: event.clientY };
    initialPanPos.value = { x: panX.value, y: panY.value };
    dragDistance.value = 0;
    
    event.preventDefault();
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }
};

const handleMouseMove = (event: MouseEvent) => {
  if (isPanning.value) {
    updatePanPosition(event);
  }
};

const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isPanning.value) {
    updatePanPosition(event);
  }
};

const updatePanPosition = (event: MouseEvent) => {
  if (!isPanning.value) return;
  
  const currentTime = performance.now();
  const deltaX = event.clientX - dragStartPos.value.x;
  const deltaY = event.clientY - dragStartPos.value.y;
  
  dragDistance.value = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Calculate velocity for momentum
  if (lastPanTime.value > 0) {
    const timeDelta = currentTime - lastPanTime.value;
    if (timeDelta > 0) {
      const velX = (event.clientX - lastPanPosition.value.x) / timeDelta;
      const velY = (event.clientY - lastPanPosition.value.y) / timeDelta;
      panVelocity.value = { x: velX * 16, y: velY * 16 }; // Scale for 60fps
    }
  }
  
  panX.value = initialPanPos.value.x + deltaX;
  panY.value = initialPanPos.value.y + deltaY;
  
  lastPanTime.value = currentTime;
  lastPanPosition.value = { x: event.clientX, y: event.clientY };
};

const handleMouseUp = () => {
  handleGlobalMouseUp();
};

const handleGlobalMouseUp = () => {
  if (isPanning.value) {
    isPanning.value = false;
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    
    // Start momentum animation if velocity is significant
    const velocityMagnitude = Math.sqrt(
      panVelocity.value.x * panVelocity.value.x + 
      panVelocity.value.y * panVelocity.value.y
    );
    
    if (velocityMagnitude > 0.5) {
      startMomentumAnimation();
    }
    
    // Reset tracking variables
    lastPanTime.value = 0;
    lastPanPosition.value = { x: 0, y: 0 };
  }
};

const startMomentumAnimation = () => {
  if (momentumAnimationId) {
    cancelAnimationFrame(momentumAnimationId);
  }
  
  const animateMomentum = () => {
    const velocityMagnitude = Math.sqrt(
      panVelocity.value.x * panVelocity.value.x + 
      panVelocity.value.y * panVelocity.value.y
    );
    
    // Stop animation when velocity is very small
    if (velocityMagnitude < 0.1) {
      momentumAnimationId = null;
      panVelocity.value = { x: 0, y: 0 };
      return;
    }
    
    // Apply velocity to pan position
    panX.value += panVelocity.value.x;
    panY.value += panVelocity.value.y;
    
    // Apply decay to velocity
    panVelocity.value.x *= momentumDecay;
    panVelocity.value.y *= momentumDecay;
    
    momentumAnimationId = requestAnimationFrame(animateMomentum);
  };
  
  momentumAnimationId = requestAnimationFrame(animateMomentum);
};

const handleClickAndHideTooltip = (event: MouseEvent) => {
  if (dragDistance.value < PAN_THRESHOLD) {
    if (event.target === sessionsSvg.value) {
      clearSelections();
    }
  }
  hideTooltipImmediate();
};

const handleWheel = (event: WheelEvent) => {
  event.preventDefault();
  
  // Check for Ctrl key for zoom, otherwise pan
  if (event.ctrlKey || event.metaKey) {
    handleCursorCenteredZoom(event);
  } else {
    // Horizontal scroll for pan
    const panSpeed = 2;
    panX.value += event.deltaX * panSpeed;
    panY.value += event.deltaY * panSpeed;
  }
};

const handleCursorCenteredZoom = (event: WheelEvent) => {
  const rect = sessionsContainer.value?.getBoundingClientRect();
  if (!rect) return;
  
  // Calculate cursor position relative to container
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;
  
  // Store zoom center point
  zoomCenter.value = { x: cursorX, y: cursorY };
  
  // Calculate zoom factor
  const zoomFactor = 1.15;
  const oldZoom = zoomLevel.value;
  
  if (event.deltaY < 0) {
    targetZoom.value = Math.min(oldZoom * zoomFactor, 10);
  } else {
    targetZoom.value = Math.max(oldZoom / zoomFactor, 0.1);
  }
  
  // Start smooth zoom animation
  if (!zoomAnimationId) {
    animateZoom();
  }
};

const animateZoom = () => {
  const currentZoom = zoomLevel.value;
  const zoomDiff = targetZoom.value - currentZoom;
  
  if (Math.abs(zoomDiff) < 0.01) {
    zoomLevel.value = targetZoom.value;
    zoomAnimationId = null;
    emit('zoom-changed', zoomLevel.value);
    return;
  }
  
  // Smooth zoom interpolation
  const zoomStep = zoomDiff * 0.15;
  zoomLevel.value += zoomStep;
  
  // Adjust pan to keep zoom center in same position
  const zoomRatio = zoomLevel.value / currentZoom;
  const centerX = zoomCenter.value.x - timelineMargins.left;
  const centerY = zoomCenter.value.y - timelineMargins.top;
  
  panX.value = (panX.value + centerX) * zoomRatio - centerX;
  panY.value = (panY.value + centerY) * zoomRatio - centerY;
  
  emit('zoom-changed', zoomLevel.value);
  
  zoomAnimationId = requestAnimationFrame(animateZoom);
};

const handleMouseLeave = () => {
  hideTooltip();
  if (isPanning.value) {
    isPanning.value = false;
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
};

// ============================================================================
// Tooltip Functions
// ============================================================================

let tooltipShowTimer: number | null = null;
let tooltipHideTimer: number | null = null;
const TOOLTIP_SHOW_DELAY = 300;
const TOOLTIP_HIDE_DELAY = 200;

const clearTooltipTimers = () => {
  if (tooltipShowTimer) {
    clearTimeout(tooltipShowTimer);
    tooltipShowTimer = null;
  }
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
};

const showAgentTooltip = (agent: SessionAgent, session: SessionData, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: true,
      type: 'agent',
      data: {
        agent,
        session,
        color: getAgentColor(agent.type)
      },
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const showMessageTooltip = (message: SessionMessage, session: SessionData, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    const preview = typeof message.content === 'string' 
      ? message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
      : 'Object message';
      
    tooltip.value = {
      visible: true,
      type: 'message',
      data: {
        message,
        session,
        preview
      },
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const hideTooltip = () => {
  clearTooltipTimers();
  
  tooltipHideTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: false,
      type: 'session',
      data: null,
      position: { x: 0, y: 0 }
    };
  }, TOOLTIP_HIDE_DELAY);
};

const hideTooltipImmediate = () => {
  clearTooltipTimers();
  tooltip.value = {
    visible: false,
    type: 'session',
    data: null,
    position: { x: 0, y: 0 }
  };
};

const onTooltipMouseEnter = () => {
  clearTooltipTimers();
};

const onTooltipMouseLeave = () => {
  hideTooltip();
};

// ============================================================================
// Filter Management
// ============================================================================

const handleFiltersUpdate = (newFilters: SessionFilterState) => {
  console.log('🔍 Session filters updated:', newFilters);
  
  // Validate filters before applying
  const validationErrors = SessionFilterUtils.validateFilters(newFilters);
  if (validationErrors.length > 0) {
    console.warn('Filter validation errors:', validationErrors);
    // Could emit error event to parent or show toast notification
    return;
  }
  
  currentFilters.value = { ...newFilters };
  
  // Persist filter state in localStorage for session persistence
  try {
    localStorage.setItem('sessionFilters', SessionFilterUtils.serializeFilters(newFilters));
  } catch (error) {
    console.warn('Failed to persist session filters:', error);
  }
  
  // Emit filter event for parent components
  emit('filters-changed', {
    filters: newFilters,
    isActive: SessionFilterUtils.isFilterActive(newFilters),
    metrics: filterPerformanceMetrics.value
  });
};

// Load persisted filters on mount
const loadPersistedFilters = () => {
  try {
    const savedFilters = localStorage.getItem('sessionFilters');
    if (savedFilters) {
      const parsed = SessionFilterUtils.deserializeFilters(savedFilters);
      currentFilters.value = parsed;
      console.log('📥 Loaded persisted session filters');
    }
  } catch (error) {
    console.warn('Failed to load persisted session filters:', error);
  }
};

// ============================================================================
// Lifecycle
// ============================================================================

const updateDimensions = () => {
  if (sessionsContainer.value) {
    containerWidth.value = sessionsContainer.value.clientWidth;
    containerHeight.value = Math.max(
      props.height,
      timelineMargins.top + (visibleSessions.value.length * sessionLaneHeight) + timelineMargins.bottom
    );
  }
};

// Keyboard event handler
const handleKeydown = (event: KeyboardEvent) => {
  // Ignore keyboard events when user is typing in inputs
  if ((event.target as HTMLElement)?.tagName === 'INPUT' || 
      (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
    return;
  }
  
  const panStep = 50;
  const zoomStep = 1.15;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      panX.value += panStep;
      break;
    case 'ArrowRight':
      event.preventDefault();
      panX.value -= panStep;
      break;
    case 'ArrowUp':
      event.preventDefault();
      panY.value += panStep;
      break;
    case 'ArrowDown':
      event.preventDefault();
      panY.value -= panStep;
      break;
    case '+':
    case '=':
      event.preventDefault();
      zoomIn();
      break;
    case '-':
    case '_':
      event.preventDefault();
      zoomOut();
      break;
    case 'r':
    case 'R':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        resetView();
      }
      break;
    case '1':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(15 * 60 * 1000); // 15 minutes
      }
      break;
    case '2':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(60 * 60 * 1000); // 1 hour
      }
      break;
    case '3':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(6 * 60 * 60 * 1000); // 6 hours
      }
      break;
    case '4':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(24 * 60 * 60 * 1000); // 24 hours
      }
      break;
    case 'Escape':
      clearSelections();
      break;
  }
};

onMounted(async () => {
  updateDimensions();
  loadPersistedFilters();
  window.addEventListener('resize', updateDimensions);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateDimensions);
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
  
  // Clean up all animations
  if (zoomAnimationId) {
    cancelAnimationFrame(zoomAnimationId);
    zoomAnimationId = null;
  }
  if (momentumAnimationId) {
    cancelAnimationFrame(momentumAnimationId);
    momentumAnimationId = null;
  }
  if (timeWindowTransitionId) {
    cancelAnimationFrame(timeWindowTransitionId);
    timeWindowTransitionId = null;
  }
  
  // Reset animation state
  isTimeWindowTransitioning.value = false;
  panVelocity.value = { x: 0, y: 0 };
  
  clearTooltipTimers();
});

watch(() => visibleSessions.value.length, () => {
  updateDimensions();
});

watch(() => props.height, (newHeight) => {
  updateDimensions();
});
</script>

<style scoped>
.sessions-timeline-container {
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
}

.sessions-content {
  position: relative;
  flex: 1;
  min-height: 400px;
}

.timeline-header,
.sessions-footer,
.selection-info {
  flex-shrink: 0;
}

/* Pan cursor styles */
.cursor-grab {
  cursor: grab;
}

.cursor-grabbing {
  cursor: grabbing;
}

/* Session lane hover effects */
.session-lane:hover .session-agents path {
  stroke-width: 3;
}

/* Agent path hover effects */
.agent-path:hover path {
  filter: drop-shadow(0 0 8px currentColor);
}

/* Smooth transitions */
.transition-all {
  transition: all 0.2s ease;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .sessions-timeline-container {
    font-size: 12px;
  }
  
  .timeline-header h3 {
    font-size: 16px;
  }
  
  .timeline-header .text-sm {
    font-size: 11px;
  }
  
  /* Reduce session lane height on mobile */
  .session-lane {
    /* Handled by computed sessionLaneHeight */
  }
}

/* GPU Acceleration */
.gpu-accelerated {
  transform: translate3d(0, 0, 0);
  will-change: transform, opacity;
  backface-visibility: hidden;
  perspective: 1000px;
}

/* Performance optimizations */
.session-lane {
  contain: layout style paint;
}

.agent-path {
  contain: layout style;
}

/* Performance indicators */
.performance-warning {
  backdrop-filter: blur(4px);
  border: 1px solid rgba(234, 179, 8, 0.3);
  animation: pulse 2s infinite;
}

.render-indicator {
  backdrop-filter: blur(4px);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

/* Memory-efficient animations */
@keyframes optimized-pulse {
  0%, 100% {
    opacity: 0.8;
    transform: scale3d(1, 1, 1);
  }
  50% {
    opacity: 1;
    transform: scale3d(1.05, 1.05, 1);
  }
}

.optimized-animate-pulse {
  animation: optimized-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse,
  .transition-all,
  .optimized-animate-pulse {
    animation: none;
    transition: none;
  }
  
  .gpu-accelerated {
    transform: none;
    will-change: auto;
  }
}
</style>