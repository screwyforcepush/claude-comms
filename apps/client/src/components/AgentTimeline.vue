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
          <!-- Orchestrator gradient -->
          <linearGradient id="orchestratorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#00d4ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
          <!-- Agent path gradients - optimized pooling for performance -->
          <g v-for="colorKey in agentColorKeys" :key="`grad-${colorKey}`">
            <linearGradient :id="`agentGradient-${colorKey}`" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.2`" />
              <stop offset="30%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.8`" />
              <stop offset="70%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.8`" />
              <stop offset="100%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.2`" />
            </linearGradient>
          </g>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Time Axis - REFINED -->
        <g class="time-axis" style="z-index: 10;">
          <line 
            :x1="timelineMargins.left" 
            :y1="timelineMargins.top - 22" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="timelineMargins.top - 22"
            stroke="#6b7280" 
            stroke-width="1.5"
            opacity="0.8"
          />
          <g v-for="tick in timeTicks" :key="tick.time" class="time-tick">
            <line 
              :x1="tick.x" 
              :y1="timelineMargins.top - 27" 
              :x2="tick.x" 
              :y2="timelineMargins.top - 17"
              stroke="#6b7280" 
              stroke-width="1"
              opacity="0.6"
            />
            <text 
              :x="tick.x" 
              :y="timelineMargins.top - 32"
              text-anchor="middle" 
              fill="#a1a9b8" 
              font-size="10px"
              font-weight="500"
              font-family="system-ui"
              style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);"
            >
              {{ tick.label }}
            </text>
          </g>
        </g>

        <!-- Orchestrator Line Enhanced - MAXIMUM PROMINENCE -->
        <g class="orchestrator-line" style="z-index: 50;">
          <!-- Ultra-wide glow base layer for maximum visibility -->
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="#00d4ff" 
            stroke-width="20"
            opacity="0.15"
            class="orchestrator-base-glow"
          />
          <!-- Medium glow layer -->
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="#00d4ff" 
            stroke-width="12"
            opacity="0.25"
            class="orchestrator-mid-glow animate-pulse"
          />
          <!-- Main orchestrator trunk - THICKEST and BRIGHTEST -->
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="url(#orchestratorGradient)" 
            stroke-width="8"
            class="orchestrator-main-line"
            style="filter: drop-shadow(0 0 16px #00d4ff) drop-shadow(0 0 8px #00d4ff) drop-shadow(0 0 4px #ffffff);"
          />
          <!-- Orchestrator Label - MAXIMUM PROMINENCE -->
          <text 
            :x="timelineMargins.left - 12" 
            :y="orchestratorY + 6"
            text-anchor="end" 
            fill="#00d4ff" 
            font-size="14px"
            font-weight="800"
            font-family="system-ui"
            class="orchestrator-label"
            style="text-shadow: 0 0 8px #00d4ff, 0 2px 4px rgba(0, 0, 0, 0.4);"
          >
            ORCHESTRATOR
          </text>
        </g>

        <!-- Agent Lanes with Curved Paths - SECONDARY PROMINENCE -->
        <g class="agent-lanes" style="z-index: 30;">
          <g v-for="(agent, index) in visibleAgents" :key="agent.agentId" class="agent-lane">
            <!-- Subtle background glow for agent paths -->
            <path
              :d="getAgentCurvePath(agent, index)"
              :stroke="getAgentColor(agent.type)"
              :stroke-width="getStrokeWidth(agent.status) + 3"
              :opacity="agent.isRecentlyUpdated ? 0.15 : 0.08"
              fill="none"
              class="agent-path-glow"
            />
            <!-- Main Agent Path connecting to orchestrator -->
            <path
              :d="getAgentCurvePath(agent, index)"
              :stroke="`url(#agentGradient-${agent.type})`"
              :stroke-width="getStrokeWidth(agent.status)"
              :class="getAgentLineClass(agent.status, agent.isRecentlyUpdated)"
              :opacity="agent.isRecentlyUpdated ? 0.9 : 0.65"
              fill="none"
              style="will-change: transform; transform: translateZ(0);"
            />
            <!-- Direction indicator arrow -->
            <path
              v-if="agent.status === 'completed'"
              :d="getDirectionArrow(agent, index)"
              :fill="getAgentColor(agent.type)"
              opacity="0.7"
            />
            
            <!-- Branch Path Labels - POLISHED AND REFINED -->
            <g class="branch-path-labels" v-if="levelOfDetail.showLabels && zoomLevel > 0.7">
              <!-- Label background pill with better spacing -->
              <rect
                :x="getBranchLabelX(agent, index) - getBranchLabelWidth(agent) / 2"
                :y="getBranchLabelY(agent, index) - 9"
                :width="getBranchLabelWidth(agent)"
                height="18"
                :fill="getAgentColor(agent.type) + '15'"
                :stroke="getAgentColor(agent.type) + '35'"
                stroke-width="1"
                rx="9"
                ry="9"
                class="branch-label-bg"
                style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));"
              />
              <!-- Label text with improved contrast -->
              <text
                :x="getBranchLabelX(agent, index)"
                :y="getBranchLabelY(agent, index) + 4"
                text-anchor="middle"
                :fill="getAgentColor(agent.type)"
                font-size="10px"
                font-weight="600"
                font-family="system-ui"
                class="branch-label-text"
                style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);"
              >
                {{ getBranchLabelText(agent) }}
              </text>
            </g>
            
            <!-- Refined highlight glow for recently updated agents -->
            <path
              v-if="agent.isRecentlyUpdated"
              :d="getAgentCurvePath(agent, index)"
              :stroke="getAgentColor(agent.type)"
              stroke-width="6"
              class="animate-pulse agent-highlight-glow"
              opacity="0.25"
              fill="none"
              style="filter: drop-shadow(0 0 12px currentColor);"
            />
            
            <!-- Agent Label - REFINED POSITIONING -->
            <text 
              :x="timelineMargins.left - 12" 
              :y="getAgentLaneY(index) + 4"
              text-anchor="end" 
              :fill="getAgentColor(agent.type)" 
              font-size="12px"
              font-weight="600"
              font-family="system-ui"
              class="agent-name-label"
              style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);"
            >
              {{ agent.name }}
            </text>

            <!-- Agent Type Badge - REFINED -->
            <rect
              :x="timelineMargins.left - 82"
              :y="getAgentLaneY(index) - 11"
              width="68"
              height="18"
              :fill="getAgentColor(agent.type) + '12'"
              :stroke="getAgentColor(agent.type) + '30'"
              stroke-width="1"
              rx="9"
              ry="9"
              class="agent-type-badge"
              style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));"
            />
            <text 
              :x="timelineMargins.left - 48" 
              :y="getAgentLaneY(index) + 2"
              text-anchor="middle" 
              :fill="getAgentColor(agent.type)" 
              font-size="9px"
              font-weight="700"
              font-family="system-ui"
              class="agent-type-text"
              style="text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);"
            >
              {{ agent.type.toUpperCase() }}
            </text>

            <!-- Status Indicator - POLISHED -->
            <!-- Status glow base -->
            <circle 
              :cx="getAgentEndX(agent) + 10" 
              :cy="getAgentLaneY(index)"
              :r="agent.isRecentlyUpdated ? 8 : 6" 
              :fill="getStatusColor(agent.status)"
              opacity="0.2"
              class="status-glow-base"
            />
            <!-- Main status indicator -->
            <circle 
              :cx="getAgentEndX(agent) + 10" 
              :cy="getAgentLaneY(index)"
              :r="agent.isRecentlyUpdated ? 5 : 3.5" 
              :fill="getStatusColor(agent.status)"
              :class="getStatusIndicatorClass(agent.status, agent.isRecentlyUpdated)"
              :stroke="agent.isRecentlyUpdated ? '#ffffff' : 'none'"
              :stroke-width="agent.isRecentlyUpdated ? 1.5 : 0"
              style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));"
            />
          </g>
        </g>

        <!-- Enhanced Spawn Points - BALANCED PROMINENCE -->
        <g class="batch-spawn-points" style="z-index: 40;">
          <g v-for="batch in batches" :key="batch.id">
            <!-- Spawn point glow base -->
            <circle 
              :cx="getTimeX(batch.spawnTimestamp)" 
              :cy="orchestratorY"
              r="12" 
              fill="#00d4ff"
              opacity="0.2"
              class="spawn-glow-base"
            />
            <!-- Main spawn point -->
            <circle 
              :cx="getTimeX(batch.spawnTimestamp)" 
              :cy="orchestratorY"
              r="7" 
              fill="#00d4ff"
              stroke="#ffffff"
              stroke-width="2"
              class="spawn-point cursor-pointer transition-all duration-300"
              style="filter: drop-shadow(0 0 12px #00d4ff) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));"
              @click="selectBatch(batch)"
            />
            <!-- Subtle pulse effect -->
            <circle 
              :cx="getTimeX(batch.spawnTimestamp)" 
              :cy="orchestratorY"
              r="7" 
              fill="none"
              stroke="#00d4ff"
              stroke-width="1.5"
              opacity="0.4"
              class="animate-ping spawn-pulse"
            />
            <!-- Refined batch label with background -->
            <rect
              :x="getTimeX(batch.spawnTimestamp) - 32"
              :y="orchestratorY - 36"
              width="64"
              height="18"
              fill="#00d4ff"
              fill-opacity="0.15"
              stroke="#00d4ff"
              stroke-width="1"
              rx="9"
              ry="9"
              class="batch-label-bg"
              style="filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));"
            />
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY - 21"
              text-anchor="middle" 
              fill="#00d4ff" 
              font-size="12px"
              font-weight="700"
              font-family="system-ui"
              class="batch-label-text"
              style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);"
            >
              BATCH {{ batch.batchNumber }}
            </text>
            <!-- Refined batch timestamp -->
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY - 8"
              text-anchor="middle" 
              fill="#a1a9b8" 
              font-size="8px"
              font-weight="500"
              font-family="system-ui"
              style="text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);"
            >
              {{ formatBatchTimestamp(batch.spawnTimestamp) }}
            </text>
            <!-- Refined agent count indicator -->
            <rect
              :x="getTimeX(batch.spawnTimestamp) - 22"
              :y="orchestratorY + 12"
              width="44"
              height="14"
              fill="#ffffff"
              fill-opacity="0.08"
              stroke="#ffffff"
              stroke-width="0.5"
              rx="7"
              ry="7"
              class="agent-count-bg"
            />
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY + 22"
              text-anchor="middle" 
              fill="#e5e7eb" 
              font-size="9px"
              font-weight="600"
              font-family="system-ui"
              style="text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);"
            >
              {{ batch.agents.length }} agents
            </text>
          </g>
        </g>

        <!-- Agent Completion Points - REFINED -->
        <g class="completion-points" style="z-index: 35;">
          <g v-for="(agent, index) in completedAgents" :key="`complete-${agent.agentId}`">
            <!-- Completion glow base -->
            <circle 
              :cx="getAgentEndX(agent)" 
              :cy="orchestratorY"
              r="8" 
              fill="#22c55e"
              opacity="0.15"
              class="completion-glow-base"
            />
            <!-- Main completion point -->
            <circle 
              :cx="getAgentEndX(agent)" 
              :cy="orchestratorY"
              r="5" 
              fill="#22c55e"
              stroke="#ffffff"
              stroke-width="1.5"
              class="completion-point cursor-pointer transition-all duration-300"
              style="filter: drop-shadow(0 0 8px #22c55e) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));"
              opacity="0.9"
            />
            <!-- Completion merge indicator -->
            <path
              :d="getCompletionMergePath(agent, index)"
              stroke="#22c55e"
              stroke-width="2"
              fill="none"
              opacity="0.5"
              stroke-dasharray="3,3"
            />
          </g>
        </g>

        <!-- Message Indicators - SUBTLE BUT VISIBLE -->
        <g class="message-indicators" style="z-index: 25;">
          <g v-for="message in visibleMessages" :key="message.id">
            <!-- Subtle message flow path animation -->
            <path 
              v-if="message.isRecentlyAdded"
              :d="getMessageFlowPath(message)"
              stroke="#ffd93d"
              stroke-width="1.5"
              fill="none"
              class="animate-pulse message-flow-path"
              opacity="0.4"
              stroke-dasharray="3,3"
            />
            
            <!-- Background glow for message indicators -->
            <circle 
              :cx="message.position.x" 
              :cy="message.position.y"
              :r="message.isRecentlyAdded ? 7 : 5" 
              fill="#ffd93d"
              opacity="0.15"
              class="message-glow"
            />
            
            <!-- Main message indicator - more subtle -->
            <circle 
              :cx="message.position.x" 
              :cy="message.position.y"
              :r="message.isRecentlyAdded ? 4 : 2.5" 
              fill="#ffd93d"
              :stroke="message.isRecentlyAdded ? '#ffffff' : 'none'"
              :stroke-width="message.isRecentlyAdded ? 1.5 : 0"
              :class="getMessageIndicatorClass(message.isRecentlyAdded)"
              :opacity="message.isRecentlyAdded ? 0.9 : 0.7"
              @click="selectMessage(message)"
              style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));"
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

        <!-- User Prompts - REFINED -->
        <g class="user-prompts" style="z-index: 45;">
          <g v-for="prompt in userPrompts" :key="prompt.id">
            <!-- Prompt glow base -->
            <rect
              :x="getTimeX(prompt.timestamp) - 9"
              :y="orchestratorY - 21"
              width="18"
              height="18"
              fill="#ec4899"
              opacity="0.2"
              rx="4"
              ry="4"
              class="prompt-glow-base"
            />
            <!-- Main prompt indicator -->
            <rect
              :x="getTimeX(prompt.timestamp) - 7"
              :y="orchestratorY - 19"
              width="14"
              height="14"
              fill="#ec4899"
              stroke="#ffffff"
              stroke-width="1.5"
              rx="3"
              ry="3"
              class="prompt-indicator cursor-pointer transition-all duration-300"
              style="filter: drop-shadow(0 0 6px #ec4899) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));"
              @click="selectPrompt(prompt)"
            />
            <text 
              :x="getTimeX(prompt.timestamp)" 
              :y="orchestratorY - 10"
              text-anchor="middle" 
              fill="#ffffff" 
              font-size="10px"
              font-weight="800"
              font-family="system-ui"
              class="prompt-text"
              style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); pointer-events: none;"
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
const agentLaneHeight = 55; // Increased from 40px to prevent overlaps

// Agent Type Colors (from design tokens)
const agentColors: Record<string, string> = {
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

// Optimize gradient generation by pooling unique agent types
const agentColorKeys = computed(() => {
  const usedTypes = new Set(currentAgents.value.map(agent => agent.subagent_type));
  return Array.from(usedTypes);
});

// Define the agent data structure used in this component
interface VisibleAgent extends AgentStatus {
  agentId: string;
  type: string;
  startTime: number;
  endTime: number | null;
  status: 'pending' | 'in_progress' | 'completed';
  laneIndex: number;
  isRecentlyUpdated: boolean;
}

const visibleAgents = computed<VisibleAgent[]>(() => {
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
      ) as unknown as VisibleAgent[];
    } catch (error) {
      // Fallback to all agents if viewport culling fails
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
    }
  }, 'low');

  return finalList;
});

// Computed property for completed agents
const completedAgents = computed(() => {
  return visibleAgents.value.filter(agent => agent.status === 'completed');
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
        batchNumber: 0 // Will be assigned chronologically below
      });
    }
    
    batchMap.get(key).agents.push(agent);
  });
  
  // Sort batches chronologically by spawn timestamp and assign numbers
  const sortedBatches = Array.from(batchMap.values())
    .sort((a, b) => a.spawnTimestamp - b.spawnTimestamp)
    .map((batch, index) => ({
      ...batch,
      batchNumber: index + 1
    }));
  
  return sortedBatches;
});

const userPrompts = computed(() => {
  // For now, return empty array - will be populated from WebSocket events
  return [] as Array<{id: string; timestamp: number; content: string}>;
});

// Define the message data structure used in this component
interface VisibleMessage extends SubagentMessage {
  id: string;
  isRecentlyAdded: boolean;
  timestamp: number;
  position: { x: number; y: number };
}

const visibleMessages = computed<VisibleMessage[]>(() => {
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
      ) as unknown as VisibleMessage[];
    } catch (error) {
      // Fallback to all messages if viewport culling fails
      visibleMessagesList = allMessages;
    }
  }

  // Limit based on LOD to maintain smooth rendering
  return visibleMessagesList.slice(0, levelOfDetail.value.maxMessages);
});

// Helper Functions
const getAgentColor = (type: string): string => {
  return agentColors[type] || agentColors.engineer;
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
  // Use actual completion timestamp instead of Date.now() fallback
  // Only use current time if agent is actively in_progress
  const endTime = agent.endTime || (agent.status === 'in_progress' ? Date.now() : agent.startTime);
  return getTimeX(endTime);
};

// Enhanced curved agent paths that properly connect to orchestrator
const getAgentCurvePath = (agent: any, index: number): string => {
  const startX = getAgentStartX(agent);
  const endX = getAgentEndX(agent);
  const agentY = getAgentLaneY(index);
  
  // Calculate control points for smooth branching curves
  const branchDistance = Math.min(40, Math.abs(agentY - orchestratorY) * 0.6);
  const returnDistance = Math.min(30, Math.abs(agentY - orchestratorY) * 0.5);
  
  // Create bezier path: orchestrator → agent lane → orchestrator
  // Path flows: spawn point → curve down to agent lane → curve back up to completion point
  const spawnControlX = startX + branchDistance;
  const spawnControlY = orchestratorY + (agentY - orchestratorY) * 0.4;
  
  const completionControlX = endX - returnDistance;
  const completionControlY = orchestratorY + (agentY - orchestratorY) * 0.4;
  
  // Use cubic bezier for smooth orchestrator-agent-orchestrator flow
  return `M ${startX},${orchestratorY} ` +
         `C ${spawnControlX},${spawnControlY} ` +
         `${startX + branchDistance * 1.5},${agentY} ` +
         `${endX - branchDistance * 1.5},${agentY} ` +
         `S ${completionControlX},${completionControlY} ` +
         `${endX},${orchestratorY}`;
};

// Direction arrow for completed agents
const getDirectionArrow = (agent: any, index: number): string => {
  const endX = getAgentEndX(agent);
  const agentY = getAgentLaneY(index);
  
  // Small arrow pointing towards completion
  return `M ${endX - 15} ${agentY - 5} 
          L ${endX - 5} ${agentY} 
          L ${endX - 15} ${agentY + 5} 
          Z`;
};

// Completion merge path indicator
const getCompletionMergePath = (agent: any, index: number): string => {
  const endX = getAgentEndX(agent);
  const agentY = getAgentLaneY(index);
  
  // Simple curve from agent lane to orchestrator
  return `M ${endX - 20} ${agentY} 
          Q ${endX - 10} ${(agentY + orchestratorY) / 2} 
          ${endX} ${orchestratorY}`;
};

const getStrokeWidth = (status: string): number => {
  // Refined stroke widths for better visual hierarchy
  switch (status) {
    case 'completed': return 2.5;
    case 'in_progress': return 3.5;
    case 'error': return 3;
    default: return 2;
  }
};

const getAgentLineClass = (status: string, isRecentlyUpdated: boolean = false): string => {
  const baseClass = 'agent-path transition-all duration-700 hover:drop-shadow-[0_0_8px_currentColor]';
  let animationClass = '';
  
  if (status === 'in_progress') {
    animationClass += ' agent-path-active';
  }
  
  if (isRecentlyUpdated) {
    animationClass += ' agent-path-highlight';
  }
  
  if (status === 'completed') {
    animationClass += ' agent-path-completed';
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

// Helper function to format batch timestamp
const formatBatchTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// Branch Path Label Helper Functions
const getBranchLabelX = (agent: any, index: number): number => {
  const startX = getAgentStartX(agent);
  const endX = getAgentEndX(agent);
  const agentY = getAgentLaneY(index);
  
  // Position label at the midpoint of the horizontal section of the agent path
  // This is the flattest part of the curve where text is most readable
  const horizontalMidpoint = startX + (endX - startX) * 0.5;
  
  // Adjust position slightly based on path curvature to avoid conflicts
  const curvatureOffset = Math.abs(agentY - orchestratorY) > 80 ? 20 : 0;
  
  return horizontalMidpoint + curvatureOffset;
};

const getBranchLabelY = (_agent: any, index: number): number => {
  const agentY = getAgentLaneY(index);
  
  // Position label slightly above the agent lane for better visibility
  // Adjust based on the distance from orchestrator to avoid crowding
  const verticalOffset = Math.abs(agentY - orchestratorY) > 80 ? -12 : -8;
  
  return agentY + verticalOffset;
};

const getBranchLabelText = (agent: any): string => {
  // Format: "AgentName (type)" - keep it concise for path labels
  const maxNameLength = 12; // Prevent overly long labels
  const displayName = agent.name.length > maxNameLength 
    ? agent.name.substring(0, maxNameLength) + '...' 
    : agent.name;
  
  return `${displayName} (${agent.type})`;
};

const getBranchLabelWidth = (agent: any): number => {
  // Calculate approximate width based on text content
  const text = getBranchLabelText(agent);
  const charWidth = 6.5; // Approximate character width for 11px font
  const padding = 16; // Horizontal padding for pill background
  
  return Math.max(text.length * charWidth + padding, 80); // Minimum width of 80px
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

// Performance mode controls (can be used in UI if needed)
// const togglePerformanceMode = () => {
//   isPerformanceMode.value = !isPerformanceMode.value;
//   console.log('Performance mode:', isPerformanceMode.value ? 'enabled' : 'disabled');
// };
//
// const resetPerformanceMetrics = () => {
//   performanceTracker.resetMetrics?.();
// };

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
      ...visibleAgents.value.map(item => 
        Math.max(item.startTime, item.endTime || 0)
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

/* POLISHED Timeline Animations - Production Ready */
@keyframes orchestrator-main-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 16px #00d4ff) drop-shadow(0 0 8px #00d4ff) drop-shadow(0 0 4px #ffffff);
  }
  50% {
    filter: drop-shadow(0 0 24px #00d4ff) drop-shadow(0 0 12px #00d4ff) drop-shadow(0 0 6px #ffffff);
  }
}

@keyframes orchestrator-glow-pulse {
  0%, 100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes agent-path-flow {
  0% {
    opacity: 0.65;
  }
  100% {
    opacity: 0.85;
  }
}

@keyframes agent-spawn-refined {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  70% {
    opacity: 0.9;
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes completion-refined-glow {
  0%, 100% {
    opacity: 0.9;
    filter: drop-shadow(0 0 8px #22c55e) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 12px #22c55e) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
  }
}

@keyframes message-subtle-pulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@keyframes spawn-point-pulse {
  0% {
    opacity: 0.4;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* POLISHED Component Styling - Production Ready */

/* Orchestrator styling - MAXIMUM PROMINENCE */
.orchestrator-main-line {
  animation: orchestrator-main-pulse 4s ease-in-out infinite;
}

.orchestrator-mid-glow {
  animation: orchestrator-glow-pulse 3s ease-in-out infinite;
}

/* Agent path styling - REFINED SECONDARY PROMINENCE */
.agent-path {
  animation: agent-spawn-refined 0.6s ease-out;
}

.agent-path-active {
  animation: agent-path-flow 2s ease-in-out infinite alternate;
}

.agent-path-highlight {
  animation: agent-path-flow 1.5s ease-in-out infinite alternate;
}

.agent-path-completed {
  opacity: 0.65 !important;
  transition: opacity 0.8s ease-out;
}

.agent-path-glow {
  pointer-events: none;
}

/* Completion points - REFINED */
.completion-point {
  animation: completion-refined-glow 3s ease-in-out infinite;
}

.completion-glow-base {
  pointer-events: none;
}

/* Spawn points - BALANCED */
.spawn-point:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 0 16px #00d4ff) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3)) !important;
}

.spawn-pulse {
  animation: spawn-point-pulse 2s ease-out infinite;
}

/* Message indicators - SUBTLE */
.message-glow {
  pointer-events: none;
}

.message-indicators circle:hover {
  transform: scale(1.2);
  opacity: 1 !important;
}

.message-flow-path {
  pointer-events: none;
}

/* Batch labels - CLEAN */
.batch-label-bg {
  transition: all 0.3s ease;
}

.batch-label-text {
  pointer-events: none;
}

.agent-count-bg {
  transition: all 0.3s ease;
}

/* POLISHED Hover Effects */
.agent-lane:hover .agent-path {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px currentColor) !important;
  transform: translateY(-0.5px);
}

.agent-lane:hover .agent-path-glow {
  opacity: 0.2 !important;
}

.batch-spawn-points:hover .batch-label-bg {
  fill-opacity: 0.25;
  transform: scale(1.02);
}

.batch-spawn-points:hover .agent-count-bg {
  fill-opacity: 0.12;
}

/* Enhanced styling for specific elements */
.agent-highlight-glow {
  pointer-events: none;
}

.agent-name-label {
  transition: all 0.3s ease;
  user-select: none;
}

.agent-type-badge {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.agent-type-text {
  user-select: none;
  pointer-events: none;
}

.status-glow-base {
  pointer-events: none;
}

.orchestrator-label {
  user-select: none;
  pointer-events: none;
}

.prompt-indicator:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 0 10px #ec4899) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
}

.prompt-glow-base {
  pointer-events: none;
}

.prompt-text {
  user-select: none;
}

.time-tick {
  pointer-events: none;
}

/* Agent lane hover refinements */
.agent-lane:hover .agent-name-label {
  font-weight: 700;
  transform: translateX(-2px);
}

.agent-lane:hover .agent-type-badge {
  transform: scale(1.02) translateX(-1px);
  fill-opacity: 0.2;
  stroke-opacity: 0.5;
}

/* POLISHED Branch Path Label Styling */
.branch-label-bg {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.branch-label-text {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  user-select: none;
}

/* Enhanced visibility for branch labels */
.agent-lane:hover .branch-label-bg {
  fill-opacity: 0.25;
  stroke-opacity: 0.5;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
  transform: scale(1.03) translateY(-1px);
}

.agent-lane:hover .branch-label-text {
  font-weight: 700;
  opacity: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Smooth appearance animation for new labels */
@keyframes branch-label-appear {
  0% {
    opacity: 0;
    transform: translateY(-5px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.branch-path-labels {
  animation: branch-label-appear 0.5s ease-out;
}

/* Responsive label sizing */
@media (max-width: 1200px) {
  .branch-label-text {
    font-size: 10px;
  }
}

@media (max-width: 900px) {
  .branch-label-text {
    font-size: 9px;
  }
}

/* POLISHED Responsive Design */
@media (max-width: 1200px) {
  .branch-label-text {
    font-size: 9px;
  }
  
  .agent-name-label {
    font-size: 11px;
  }
  
  .orchestrator-label {
    font-size: 13px;
  }
}

@media (max-width: 900px) {
  .branch-path-labels {
    display: none; /* Hide labels for cleaner view */
  }
  
  .agent-type-badge {
    width: 60px;
  }
  
  .agent-name-label {
    font-size: 10px;
  }
}

/* Mobile optimizations - PRODUCTION READY */
@media (max-width: 699px) {
  .agent-timeline-container {
    font-size: 11px;
  }
  
  .timeline-header h3 {
    font-size: 15px;
  }
  
  .timeline-header .text-sm {
    font-size: 10px;
  }
  
  /* Simplified mobile layout */
  .branch-path-labels,
  .agent-type-badge {
    display: none;
  }
  
  .agent-name-label {
    font-size: 9px;
  }
  
  .orchestrator-label {
    font-size: 12px;
  }
  
  /* Reduce animations on mobile for performance */
  .orchestrator-main-line,
  .agent-path,
  .completion-point,
  .spawn-pulse {
    animation: none;
  }
  
  /* Simplified mobile spacing */
  .agent-timeline-container {
    --agent-lane-height: 45px;
  }
}
</style>