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
        @click="handleClickAndHideTooltip"
        @wheel="handleWheel"
        @mouseleave="hideTooltip"
      >
        <!-- Grid Background -->
        <defs>
          <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1"/>
          </pattern>
          <!-- Glow filters for selections -->
          <!-- Orchestrator gradient -->
          <linearGradient id="orchestratorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#00d4ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
          <!-- Agent path gradients - optimized pooling -->
          <g v-for="colorKey in agentColorKeys" :key="`grad-${colorKey}`">
            <linearGradient :id="`agentGradient-${colorKey}`" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.3`" />
              <stop offset="30%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:1`" />
              <stop offset="70%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:1`" />
              <stop offset="100%" :style="`stop-color:${agentColors[colorKey]};stop-opacity:0.3`" />
            </linearGradient>
          </g>
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

        <!-- Orchestrator Line Enhanced -->
        <g class="orchestrator-line" style="z-index: 10;">
          <!-- Main orchestrator trunk with stronger glow -->
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="url(#orchestratorGradient)" 
            stroke-width="6"
            class="drop-shadow-[0_0_16px_#00d4ff]"
            style="filter: drop-shadow(0 0 12px #00d4ff) drop-shadow(0 0 6px #00d4ff);"
          />
          <!-- Secondary glow layer -->
          <line 
            :x1="timelineMargins.left" 
            :y1="orchestratorY" 
            :x2="containerWidth - timelineMargins.right" 
            :y2="orchestratorY"
            stroke="#00d4ff" 
            stroke-width="12"
            opacity="0.3"
            class="animate-pulse"
          />
          <text 
            :x="timelineMargins.left - 10" 
            :y="orchestratorY + 5"
            text-anchor="end" 
            fill="#00d4ff" 
            font-size="16px"
            font-weight="700"
            font-family="system-ui"
            class="drop-shadow-[0_0_8px_currentColor]"
          >
            ORCHESTRATOR
          </text>
        </g>

        <!-- Agent Lanes with Curved Paths -->
        <g class="agent-lanes" style="z-index: 20;">
          <g v-for="(agent, index) in visibleAgents" :key="agent.agentId" class="agent-lane">
            <!-- Curved Agent Path connecting to orchestrator -->
            <path
              :d="getAgentCurvePath(agent, index, getAgentLaneY(index, agent))"
              :stroke="`url(#agentGradient-${agent.type})`"
              :stroke-width="getStrokeWidth(agent.status, agent.agentId === selectedAgent?.id?.toString())"
              :class="getAgentLineClass(agent.status, agent.agentId === selectedAgent?.id?.toString())"
              class="cursor-pointer transition-all duration-200"
              :filter="agent.agentId === selectedAgent?.id?.toString() ? 'url(#agentGlow)' : ''"
              fill="none"
              style="will-change: transform; transform: translateZ(0);"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            />
            
            <!-- Agent Type-Name Label on Branch -->
            <text 
              :x="getAgentLabelX(agent, index)"
              :y="getAgentLaneY(index, agent) - 5"
              text-anchor="middle" 
              :fill="getAgentColor(agent.type)"
              font-size="10px"
              font-weight="600"
              font-family="system-ui"
              class="cursor-pointer select-none drop-shadow-[0_0_2px_rgba(0,0,0,0.8)] transition-opacity duration-200"
              :class="agent.agentId === selectedAgent?.id?.toString() ? 'opacity-100 font-bold' : 'opacity-80 hover:opacity-100'"
              @click="selectAgentPath(agent)"
              @mouseenter="showAgentTooltip(agent, $event)"
              @mouseleave="hideTooltip"
            >
              {{ agent.type }}-{{ agent.name }}
            </text>

            <!-- Direction indicator arrow - REMOVED -->
            
            <!-- Agent labels removed - will be handled by path-based labeling -->

            <!-- Status Indicator - REMOVED -->
          </g>
        </g>

        <!-- Enhanced Spawn Points -->
        <g class="batch-spawn-points" style="z-index: 25;">
          <g v-for="batch in batches" :key="batch.id">
            <!-- Spawn point with branching effect -->
            <circle 
              :cx="getTimeX(batch.spawnTimestamp)" 
              :cy="orchestratorY"
              r="8" 
              fill="#00d4ff"
              stroke="#ffffff"
              stroke-width="3"
              class="drop-shadow-[0_0_16px_#00d4ff] cursor-pointer transition-all duration-300"
              @click="selectBatch(batch)"
              @mouseenter="showBatchTooltip(batch, $event)"
              @mouseleave="hideTooltip"
            />
            <!-- Pulse effect for spawn points removed (was causing floating circles) -->
            <!-- Batch label with enhanced styling -->
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY - 20"
              text-anchor="middle" 
              fill="#00d4ff" 
              font-size="13px"
              font-weight="700"
              font-family="system-ui"
              class="cursor-pointer select-none drop-shadow-[0_0_4px_currentColor]"
              @click="selectBatch(batch)"
              @mouseenter="showBatchTooltip(batch, $event)"
              @mouseleave="hideTooltip"
            >
              BATCH {{ batch.batchNumber }}
            </text>
            <!-- Agent count indicator -->
            <text 
              :x="getTimeX(batch.spawnTimestamp)" 
              :y="orchestratorY + 25"
              text-anchor="middle" 
              fill="#ffffff" 
              font-size="10px"
              font-weight="600"
              opacity="0.8"
            >
              {{ batch.agents.length }} agents
            </text>
          </g>
        </g>

        <!-- Agent Completion Points -->
        <g class="completion-points" style="z-index: 25;">
          <g v-for="(agent, index) in completedAgents" :key="`complete-${agent.agentId}`">
            <!-- Completion indicator at the merge point -->
            <circle 
              :cx="getAgentEndX(agent)" 
              :cy="orchestratorY"
              r="5" 
              fill="#22c55e"
              stroke="#ffffff"
              stroke-width="2"
              class="drop-shadow-[0_0_12px_#22c55e] cursor-pointer transition-all duration-300"
              opacity="0.9"
              @click="selectAgentPath(agent)"
            />
            <!-- Small indicator showing successful merge -->
            <path
              :d="`M ${getAgentEndX(agent) - 3} ${orchestratorY} L ${getAgentEndX(agent)} ${orchestratorY + 4} L ${getAgentEndX(agent) + 3} ${orchestratorY - 1} Z`"
              fill="#ffffff"
              opacity="0.8"
            />
          </g>
        </g>

        <!-- Message Indicators -->
        <g class="message-indicators">
          <g v-for="message in visibleMessages" :key="message.id">
            <circle 
              :cx="message.position.x" 
              :cy="message.position.y"
              :r="getMessageRadius(message)"
              :fill="getMessageColor(message)"
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
              :stroke="getMessageColor(message)"
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
              :stroke="getMessageColor(flow.from)"
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

      <!-- Agent Detail Pane -->
      <AgentDetailPane 
        :visible="agentDetailPaneVisible"
        :selected-agent="selectedAgent"
        :messages="props.messages"
        :session-id="props.sessionId"
        @close="closeAgentDetailPane"
        @message-selected="handleMessageSelectedFromAgent"
        @highlight-timeline="highlightAgent"
      />

      <!-- Timeline Tooltip -->
      <TimelineTooltip 
        :visible="tooltip.visible"
        :tooltip-data="tooltip"
        @tooltip-mouse-enter="onTooltipMouseEnter"
        @tooltip-mouse-leave="onTooltipMouseLeave"
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
import AgentDetailPane from './AgentDetailPane.vue';
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
const baseContainerHeight = ref(600);

// Dynamic container height based on lane allocation
const containerHeight = computed(() => {
  if (laneOccupancy.value.size === 0) return baseContainerHeight.value;
  
  // Find the maximum lane index being used
  const maxLane = Math.max(...Array.from(laneOccupancy.value.keys()));
  const maxLaneY = orchestratorY + 60 + (maxLane * agentLaneHeight);
  
  // Add padding for the bottom
  const dynamicHeight = maxLaneY + 100; // 100px bottom padding
  
  // Use the larger of base height or calculated height
  return Math.max(baseContainerHeight.value, dynamicHeight);
});
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const autoScroll = ref(props.followLatest);

// Interaction State
const selectedMessage = ref<SubagentMessage | null>(null);
const selectedAgent = ref<AgentStatus | null>(null);
const highlightedMessageId = ref<string>('');
const detailPaneVisible = ref(false);
const agentDetailPaneVisible = ref(false);
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
const agentLaneHeight = 55; // Increased from 40px to prevent overlaps

// Agent Type Colors
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
  engineer: '#ff6b6b'
};

// Status Colors - REMOVED (no longer needed since status indicators removed)

// Computed Properties
const totalAgents = computed(() => props.agents.length);

// Optimize gradient generation by pooling unique agent types
const agentColorKeys = computed(() => {
  const usedTypes = new Set(props.agents.map(agent => agent.subagent_type));
  return Array.from(usedTypes);
});

const visibleAgents = computed(() => {
  const allAgents = props.agents.map((agent) => ({
    ...agent,
    agentId: agent.id.toString(),
    type: agent.subagent_type,
    startTime: agent.created_at,
    endTime: agent.completion_timestamp || agent.completed_at || null,
    status: agent.status || 'pending'
  }));

  // Performance optimization: Limit visible agents for smooth rendering
  // Virtual scrolling for large datasets
  if (allAgents.length > 100) {
    // Sort by creation time for temporal coherence
    const sorted = allAgents.sort((a, b) => a.startTime - b.startTime);
    
    // Show recent agents + selection context
    const recentCount = Math.min(50, sorted.length);
    const recent = sorted.slice(-recentCount);
    
    // Add any selected agents that might be outside the recent window
    const selectedSet = new Set();
    if (selectedAgent.value) {
      selectedSet.add(selectedAgent.value.id?.toString());
    }
    
    const additionalSelected = sorted.filter(agent => 
      selectedSet.has(agent.agentId) && !recent.some(r => r.agentId === agent.agentId)
    );
    
    return [...recent, ...additionalSelected];
  }
  
  return allAgents;
});

// Computed property for completed agents
const completedAgents = computed(() => {
  return visibleAgents.value.filter(agent => agent.status === 'completed');
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
        batchNumber: 0 // Will be assigned after sorting
      });
    }
    
    batchMap.get(key).agents.push(agent);
  });
  
  // Convert to array and sort by spawn timestamp
  const batchArray = Array.from(batchMap.values()).sort((a, b) => a.spawnTimestamp - b.spawnTimestamp);
  
  // Assign batch numbers in chronological order
  batchArray.forEach((batch, index) => {
    batch.batchNumber = index + 1;
  });
  
  return batchArray;
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

// getStatusColor function - REMOVED (no longer needed since status indicators removed)

// Smart lane allocation algorithm - tracks lane occupancy and reuses lanes
const laneOccupancy = ref<Map<number, Array<{ start: number; end: number }>>>(new Map());

const calculateLaneAllocations = (agents: any[]) => {
  const allocations = new Map<string, number>();
  const occupancy = new Map<number, Array<{ start: number; end: number }>>();
  
  // Sort agents by start time to process in chronological order
  const sortedAgents = [...agents].sort((a, b) => a.startTime - b.startTime);
  
  for (const agent of sortedAgents) {
    const agentStart = agent.startTime;
    const agentEnd = agent.endTime || (agent.status === 'in_progress' ? Date.now() : agentStart + 30000); // Default 30s duration
    
    // Find first available lane
    let assignedLane = 0;
    let foundLane = false;
    
    while (!foundLane) {
      const laneOccupants = occupancy.get(assignedLane) || [];
      
      // Check if this lane is free during the agent's time period
      const hasOverlap = laneOccupants.some(occupant => 
        !(agentEnd <= occupant.start || agentStart >= occupant.end)
      );
      
      if (!hasOverlap) {
        // Lane is available
        foundLane = true;
        allocations.set(agent.agentId, assignedLane);
        
        // Reserve this time slot in the lane
        laneOccupants.push({ start: agentStart, end: agentEnd });
        occupancy.set(assignedLane, laneOccupants);
      } else {
        // Try next lane
        assignedLane++;
      }
      
      // Safety limit to prevent infinite loops
      if (assignedLane > 50) {
        console.warn('Lane allocation exceeded limit, using fallback');
        allocations.set(agent.agentId, assignedLane);
        break;
      }
    }
  }
  
  laneOccupancy.value = occupancy;
  return allocations;
};

// Smart lane allocation - computed property
const agentLaneAllocations = computed(() => {
  return calculateLaneAllocations(visibleAgents.value);
});

// Main interface - preserve backward compatibility for DanLabels
const getAgentLaneY = (index: number, agent?: any): number => {
  // If agent is provided, use smart allocation
  if (agent && agentLaneAllocations.value.has(agent.agentId)) {
    const smartLaneIndex = agentLaneAllocations.value.get(agent.agentId) || 0;
    return orchestratorY + 60 + (smartLaneIndex * agentLaneHeight);
  }
  
  // For backward compatibility, also try to get agent from visibleAgents by index
  if (!agent && index < visibleAgents.value.length) {
    const agentFromIndex = visibleAgents.value[index];
    if (agentFromIndex && agentLaneAllocations.value.has(agentFromIndex.agentId)) {
      const smartLaneIndex = agentLaneAllocations.value.get(agentFromIndex.agentId) || 0;
      return orchestratorY + 60 + (smartLaneIndex * agentLaneHeight);
    }
  }
  
  // Fallback to index-based allocation
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

const getAgentLabelX = (agent: any, index: number): number => {
  const startX = getAgentStartX(agent);
  const endX = getAgentEndX(agent);
  
  // Position label in the middle of the horizontal section
  // Based on the curve path logic, the horizontal section starts after the curve-out
  const branchOutDistance = 6; // Should match the curve calculation (2 * 3)
  const mergeBackDistance = 6;  // Should match the curve calculation (2 * 3)
  
  if (agent.status === 'completed' && agent.endTime) {
    // For completed agents, position in the middle of the horizontal section
    const horizontalStart = startX + branchOutDistance;
    const horizontalEnd = endX - mergeBackDistance;
    return (horizontalStart + horizontalEnd) / 2;
  } else {
    // For in-progress agents, position towards the end of the current horizontal section
    const horizontalStart = startX + branchOutDistance;
    const currentLength = Math.max(0, endX - horizontalStart);
    // Position at 60% along the horizontal section to avoid overlap with the branch end
    return horizontalStart + (currentLength * 0.6);
  }
};

// New helper function for curved agent paths
const getAgentCurvePath = (agent: any, index: number, agentY?: number): string => {
  const startX = getAgentStartX(agent);
  const endX = getAgentEndX(agent);
  const laneY = agentY || getAgentLaneY(index, agent);
  
  // Calculate branch out and merge back control points - sharpened to 10% of original
  const branchOutDistance = 3; // How far to branch out from orchestrator (reduced from 30)
  const mergeBackDistance = 3; // How far before merging back (reduced from 30)
  
  // Create a git-tree-like path:
  // 1. Start from orchestrator at spawn time
  // 2. Branch out with a curve to the agent lane
  // 3. Run horizontally along the agent lane
  // 4. Merge back to orchestrator at completion time
  
  if (agent.status === 'completed' && agent.endTime) {
    // Completed agents: full lifecycle with merge back
    return `M ${startX} ${orchestratorY} 
            C ${startX + branchOutDistance} ${orchestratorY} 
              ${startX + branchOutDistance} ${laneY} 
              ${startX + branchOutDistance * 2} ${laneY}
            L ${endX - mergeBackDistance * 2} ${laneY}
            C ${endX - mergeBackDistance} ${laneY}
              ${endX - mergeBackDistance} ${orchestratorY}
              ${endX} ${orchestratorY}`;
  } else {
    // In-progress or pending agents: branch out but don't merge back yet
    return `M ${startX} ${orchestratorY} 
            C ${startX + branchOutDistance} ${orchestratorY} 
              ${startX + branchOutDistance} ${laneY} 
              ${startX + branchOutDistance * 2} ${laneY}
            L ${endX} ${laneY}`;
  }
};

// Direction arrow for completed agents - REMOVED (no longer needed)


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
  const baseClass = 'drop-shadow-[0_0_8px_currentColor] transition-all duration-500 hover:drop-shadow-[0_0_12px_currentColor]';
  let classes = baseClass;
  
  if (status === 'in_progress') {
    classes += ' animate-pulse';
  }
  
  if (isSelected) {
    classes += ' drop-shadow-[0_0_16px_currentColor] opacity-100';
  }
  
  if (status === 'completed') {
    classes += ' transition-opacity duration-500';
  }
  
  return classes;
};

const getMessageY = (message: SubagentMessage): number => {
  const agent = visibleAgents.value.find(agent => agent.name === message.sender);
  if (agent) {
    const agentIndex = visibleAgents.value.indexOf(agent);
    return getAgentLaneY(agentIndex, agent);
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

// Get message color based on read status
const getMessageColor = (message: SubagentMessage): string => {
  const notified = message.notified || [];
  const totalAgents = visibleAgents.value.length;
  
  if (notified.length === 0) {
    // Unread by all agents - orange
    return '#ff9500';
  } else if (notified.length < totalAgents) {
    // Read by some agents - yellow
    return '#ffd93d';
  } else {
    // Read by all agents - blue
    return '#3b82f6';
  }
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

const handleClickAndHideTooltip = (event: MouseEvent) => {
  // Combine both click functionalities
  handleClick(event);
  hideTooltipImmediate();
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
  agentDetailPaneVisible.value = true;
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

const handleMessageSelectedFromAgent = (message: SubagentMessage) => {
  selectedMessage.value = message;
  selectedAgent.value = null;
  agentDetailPaneVisible.value = false;
  detailPaneVisible.value = true;
  emit('message-clicked', message);
  emit('selection-changed', { message });
};

const highlightAgent = (agentId: number) => {
  // Find and highlight the agent on timeline
  const agent = visibleAgents.value.find(a => a.agentId === agentId.toString());
  if (agent) {
    selectedAgent.value = agent;
    // Trigger selection animation or highlight effect
    emit('agent-selected', agent);
  }
};

const closeDetailPane = () => {
  detailPaneVisible.value = false;
  selectedMessage.value = null;
};

const closeAgentDetailPane = () => {
  agentDetailPaneVisible.value = false;
  selectedAgent.value = null;
};

const clearSelections = () => {
  selectedMessage.value = null;
  selectedAgent.value = null;
  detailPaneVisible.value = false;
  agentDetailPaneVisible.value = false;
  emit('selection-changed', {});
};

const highlightMessage = (messageId: string) => {
  highlightedMessageId.value = messageId;
  emit('highlight-message', messageId);
  
  setTimeout(() => {
    highlightedMessageId.value = '';
  }, 3000);
};

// Tooltip state management with delays
let tooltipShowTimer: number | null = null;
let tooltipHideTimer: number | null = null;
const TOOLTIP_SHOW_DELAY = 200; // ms - reduced for better responsiveness
const TOOLTIP_HIDE_DELAY = 150; // ms - slightly increased for stability

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

// Tooltip functions with improved stability
const showAgentTooltip = (agent: any, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
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
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const showMessageTooltip = (message: any, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
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
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const showBatchTooltip = (batch: any, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: true,
      type: 'batch' as const,
      data: batch,
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const showPromptTooltip = (prompt: any, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: true,
      type: 'prompt' as const,
      data: prompt,
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const hideTooltip = () => {
  clearTooltipTimers();
  
  tooltipHideTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: false,
      type: 'generic',
      data: null,
      position: { x: 0, y: 0 }
    };
  }, TOOLTIP_HIDE_DELAY);
};

// Immediate hide function for specific cases
const hideTooltipImmediate = () => {
  clearTooltipTimers();
  tooltip.value = {
    visible: false,
    type: 'generic',
    data: null,
    position: { x: 0, y: 0 }
  };
};

// Tooltip hover tolerance handlers
const onTooltipMouseEnter = () => {
  // Cancel any pending hide when hovering over tooltip
  clearTooltipTimers();
};

const onTooltipMouseLeave = () => {
  // Hide tooltip when leaving tooltip area
  hideTooltip();
};

// Performance-optimized update batching
let rafId: number | null = null;
let pendingUpdates: (() => void)[] = [];

const batchUpdate = (updateFn: () => void) => {
  pendingUpdates.push(updateFn);
  
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      // Execute all pending updates in a single frame
      const updates = [...pendingUpdates];
      pendingUpdates = [];
      rafId = null;
      
      // Batch DOM updates to minimize reflows
      updates.forEach(update => update());
    });
  }
};

// Control Functions with batched updates
const zoomIn = () => {
  batchUpdate(() => {
    zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5);
  });
};

const zoomOut = () => {
  batchUpdate(() => {
    zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.2);
  });
};

const resetZoom = () => {
  batchUpdate(() => {
    zoomLevel.value = 1;
    panX.value = 0;
    panY.value = 0;
  });
};

// Lifecycle
const updateDimensions = () => {
  if (timelineContainer.value) {
    containerWidth.value = timelineContainer.value.clientWidth;
    baseContainerHeight.value = props.height;
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
  
  // Memory leak prevention
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  // Clear pending updates
  pendingUpdates = [];
  
  // Clear tooltip timers and hide immediately
  clearTooltipTimers();
  hideTooltipImmediate();
  
  // Clean up lane occupancy maps
  laneOccupancy.value.clear();
});

watch(() => props.height, (newHeight) => {
  baseContainerHeight.value = newHeight;
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

/* Enhanced Timeline Animations */
@keyframes dash-flow {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -20;
  }
}

@keyframes orchestrator-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 12px #00d4ff) drop-shadow(0 0 6px #00d4ff);
    opacity: 1;
  }
  50% {
    filter: drop-shadow(0 0 20px #00d4ff) drop-shadow(0 0 10px #00d4ff);
    opacity: 0.9;
  }
}

@keyframes agent-spawn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes completion-glow {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 16px #22c55e);
  }
}

/* Orchestrator enhanced styling */
.orchestrator-line line:first-child {
  animation: orchestrator-pulse 3s ease-in-out infinite;
}

/* Agent path animations */
.agent-lane path[stroke-dasharray] {
  animation: dash-flow 2s linear infinite;
}

.agent-lane path {
  animation: agent-spawn 0.8s ease-out;
}

.completion-points circle {
  animation: completion-glow 2s ease-in-out infinite;
}

/* Hover effects */
.agent-lane:hover path {
  stroke-width: 4 !important;
  filter: drop-shadow(0 0 8px currentColor) !important;
}

.spawn-point:hover circle {
  r: 10;
  filter: drop-shadow(0 0 20px #00d4ff);
}

/* Mobile optimizations - Enhanced for performance */
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
  
  /* Aggressive performance optimizations on mobile */
  .orchestrator-line line:first-child,
  .agent-lane path,
  .completion-points circle {
    animation: none;
  }
  
  /* Reduce GPU layers on mobile to save memory */
  .agent-lane path {
    transform: none !important;
    will-change: auto;
  }
  
  /* Simplify gradients on mobile */
  .agent-lane path {
    stroke: currentColor !important;
  }
  
  /* Optimize agent labels for mobile */
  .agent-lane text {
    font-size: 8px !important;
    font-weight: 500;
  }
  
  /* Hide less important elements on small screens */
  .message-flows {
    display: none;
  }
  
  /* Touch-friendly interaction zones */
  .agent-lane,
  .message-indicators circle,
  .batch-spawn-points circle {
    cursor: pointer;
    touch-action: manipulation;
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
  .animate-pulse,
  .orchestrator-line line:first-child,
  .agent-lane path,
  .completion-points circle {
    animation: none;
  }
  
  .transition-all {
    transition: none;
  }
}
</style>