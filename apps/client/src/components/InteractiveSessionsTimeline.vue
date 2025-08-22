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
          <!-- Enhanced Time Window Controls with Auto-Pan -->
          <div class="flex items-center space-x-2 text-sm">
            <span class="text-gray-300">Window:</span>
            <button 
              v-for="window in timeWindows"
              :key="window.label"
              @click="setTimeWindow(window.value)"
              class="px-3 py-1 rounded text-xs font-medium transition-all duration-200 transform hover:scale-105"
              :class="getTimeWindowButtonClass(window)"
              :title="getTimeWindowButtonTitle(window)"
            >
              {{ window.label }}
            </button>
            <!-- Auto-Pan Toggle Button -->
            <button 
              @click="toggleAutoPan"
              class="px-3 py-1 rounded text-xs font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-1"
              :class="autoPanEnabled 
                ? 'bg-green-600 text-white shadow-lg ring-2 ring-green-400/50' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'"
              :title="autoPanEnabled ? 'Disable auto-pan (A)' : 'Enable auto-pan (A)'"
            >
              <span>{{ autoPanEnabled ? '⏸️' : '▶️' }}</span>
              <span>Auto-Pan</span>
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
            <!-- FPS counter hidden for UI cleanup -->
            <!-- <span class="text-purple-400">{{ Math.round(performanceMetrics.frameRate) }}fps</span> -->
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
          
          <!-- Orchestrator gradient (matching Agents tab exactly) -->
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
          
          <!-- Glow filters (matching Agents tab exactly) -->
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
              :height="getSessionHeight(session)"
              :fill="sessionIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)'"
              stroke="transparent"
              stroke-width="0"
              class="transition-all duration-200"
              style="pointer-events: none;"
            />
            
            <!-- Session Orchestrator Line Enhanced (matching Agents tab style) -->
            <g class="session-orchestrator-line" style="z-index: 10;">
              <!-- Main orchestrator trunk with stronger glow (matching Agents tab) -->
              <line 
                :x1="timelineMargins.left" 
                :y1="getSessionOrchestratorY(sessionIndex)"
                :x2="containerWidth - timelineMargins.right" 
                :y2="getSessionOrchestratorY(sessionIndex)"
                stroke="url(#session-orchestrator)" 
                stroke-width="6"
                class="drop-shadow-[0_0_16px_#00d4ff]"
                style="filter: drop-shadow(0 0 12px #00d4ff) drop-shadow(0 0 6px #00d4ff);"
              />
              <!-- Secondary glow layer (matching Agents tab) -->
              <line 
                :x1="timelineMargins.left" 
                :y1="getSessionOrchestratorY(sessionIndex)"
                :x2="containerWidth - timelineMargins.right" 
                :y2="getSessionOrchestratorY(sessionIndex)"
                stroke="#00d4ff" 
                stroke-width="12"
                opacity="0.3"
                class="animate-pulse"
              />
            </g>
            
            <!-- Session Label -->
            <text 
              :x="timelineMargins.left - 10" 
              :y="getSessionOrchestratorY(sessionIndex) + 4"
              text-anchor="end" 
              fill="#00d4ff" 
              font-size="12px"
              font-weight="600"
              font-family="system-ui"
              class="select-none"
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
                  :filter="isAgentSelected(agent) ? 'url(#agentGlow)' : ''"
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
                  font-size="12px"
                  font-weight="600"
                  font-family="system-ui"
                  class="cursor-pointer select-none"
                  :class="isAgentSelected(agent) ? 'opacity-100 font-bold' : 'opacity-80 hover:opacity-100'"
                  @click="selectAgent(agent, session)"
                >
                  {{ agent.name }}
                </text>
                
                <!-- Termination indicator for terminated agents -->
                <g v-if="agent.status === 'error'" 
                   :transform="`translate(${getTimeX(agent.endTime || Date.now())}, ${getAgentLaneY(agent, sessionIndex)})`">
                  <!-- Red background circle -->
                  <circle 
                    cx="0" 
                    cy="0"
                    r="6" 
                    fill="#ef4444"
                    stroke="#ffffff"
                    stroke-width="1.5"
                    class="drop-shadow-[0_0_8px_#ef4444] cursor-pointer transition-all duration-300"
                    opacity="0.9"
                    @click="selectAgent(agent, session)"
                  />
                  <!-- Termination cross (✕) -->
                  <g stroke="#ffffff" stroke-width="1.5" stroke-linecap="round">
                    <line x1="-2" y1="-2" x2="2" y2="2" />
                    <line x1="2" y1="-2" x2="-2" y2="2" />
                  </g>
                </g>
              </g>
            </g>

            <!-- Event Indicators on Orchestrator Line -->
            <g class="session-event-indicators" v-if="getSessionEventIndicators(session.sessionId).length > 0" style="pointer-events: all;">
              <g v-for="indicator in getSessionEventIndicators(session.sessionId)" :key="indicator.eventId">
                <!-- UserPromptSubmit indicators (blue circles) -->
                <g v-if="indicator.eventType === 'UserPromptSubmit'">
                  <!-- Glow effect -->
                  <circle 
                    :cx="getTimeX(indicator.timestamp)" 
                    :cy="getSessionOrchestratorY(sessionIndex)"
                    :r="eventIndicatorStyles.UserPromptSubmit.size + 2"
                    :fill="eventIndicatorStyles.UserPromptSubmit.color"
                    opacity="0.3"
                    class="animate-pulse"
                    style="pointer-events: none;"
                  />
                  <!-- Main indicator circle -->
                  <circle 
                    :cx="getTimeX(indicator.timestamp)" 
                    :cy="getSessionOrchestratorY(sessionIndex)"
                    :r="eventIndicatorStyles.UserPromptSubmit.size"
                    :fill="isEventIndicatorSelected(indicator) ? eventIndicatorStyles.UserPromptSubmit.hoverColor : eventIndicatorStyles.UserPromptSubmit.color"
                    stroke="#ffffff"
                    :stroke-width="eventIndicatorStyles.UserPromptSubmit.strokeWidth"
                    class="cursor-pointer transition-all duration-200 hover:drop-shadow-[0_0_8px_#3b82f6]"
                    :class="isEventIndicatorSelected(indicator) ? 'drop-shadow-[0_0_16px_#3b82f6]' : ''"
                    style="pointer-events: auto;"
                    @click="selectEventIndicator(indicator, session)"
                    @mouseenter="showEventIndicatorTooltip(indicator, $event)"
                    @mouseleave="hideTooltip"
                  />
                  <!-- Selection ring -->
                  <circle 
                    v-if="isEventIndicatorSelected(indicator)"
                    :cx="getTimeX(indicator.timestamp)" 
                    :cy="getSessionOrchestratorY(sessionIndex)"
                    :r="eventIndicatorStyles.UserPromptSubmit.size + 4"
                    fill="none"
                    :stroke="eventIndicatorStyles.UserPromptSubmit.color"
                    stroke-width="2"
                    opacity="0.6"
                    class="animate-pulse"
                  />
                </g>
                
                <!-- Notification indicators (orange warning triangles) -->
                <g v-if="indicator.eventType === 'Notification'" :transform="`translate(${getTimeX(indicator.timestamp)}, ${getSessionOrchestratorY(sessionIndex)})`" style="pointer-events: all;">
                  <!-- Glow effect -->
                  <path 
                    d="M-10,-12 L10,-12 L0,6 Z"
                    :fill="eventIndicatorStyles.Notification.color"
                    opacity="0.3"
                    class="animate-pulse"
                    style="pointer-events: none;"
                  />
                  <!-- Main warning triangle -->
                  <path 
                    d="M-8,-10 L8,-10 L0,4 Z"
                    :fill="isEventIndicatorSelected(indicator) ? eventIndicatorStyles.Notification.hoverColor : eventIndicatorStyles.Notification.color"
                    stroke="#ffffff"
                    :stroke-width="eventIndicatorStyles.Notification.strokeWidth"
                    class="cursor-pointer transition-all duration-200 hover:drop-shadow-[0_0_8px_#f59e0b]"
                    :class="isEventIndicatorSelected(indicator) ? 'drop-shadow-[0_0_16px_#f59e0b]' : ''"
                    style="pointer-events: auto;"
                    @click="selectEventIndicator(indicator, session)"
                    @mouseenter="showEventIndicatorTooltip(indicator, $event)"
                    @mouseleave="hideTooltip"
                  />
                  <!-- Exclamation mark -->
                  <text 
                    x="0" 
                    y="-2" 
                    text-anchor="middle"
                    fill="#ffffff"
                    font-size="8"
                    font-weight="bold"
                    style="pointer-events: none;"
                  >!</text>
                  <!-- Selection ring -->
                  <circle 
                    v-if="isEventIndicatorSelected(indicator)"
                    cx="0" 
                    cy="-3"
                    r="12"
                    fill="none"
                    :stroke="eventIndicatorStyles.Notification.color"
                    stroke-width="2"
                    opacity="0.6"
                    class="animate-pulse"
                  />
                </g>
              </g>
            </g>

            <!-- Session Messages Enhanced (matching Agents tab exactly) -->
            <g class="session-messages" v-if="session.messages.length > 0" style="z-index: 30;">
              <g v-for="message in session.messages" :key="message.id">
                <!-- Message glow for visibility (behind main dot) -->
                <circle 
                  :cx="getTimeX(message.timestamp)" 
                  :cy="getMessageY(message, sessionIndex)"
                  :r="getMessageRadius(message) + 3"
                  fill="#facc15"
                  opacity="0.2"
                  class="animate-pulse"
                  style="pointer-events: none;"
                />
                <!-- Main message dot -->
                <circle 
                  :cx="getTimeX(message.timestamp)" 
                  :cy="getMessageY(message, sessionIndex)"
                  :r="getMessageRadius(message)"
                  fill="#facc15"
                  stroke="#ffffff"
                  stroke-width="2"
                  :class="getMessageClasses(message)"
                  :filter="isMessageSelected(message) ? 'url(#messageGlow)' : ''"
                  @click="selectMessage(message, session)"
                  @mouseenter="showMessageTooltip(message, session, $event)"
                  @mouseleave="hideTooltip"
                />
                <!-- Selection ring (matching Agents tab) -->
                <circle 
                  v-if="isMessageSelected(message)"
                  :cx="getTimeX(message.timestamp)" 
                  :cy="getMessageY(message, sessionIndex)"
                  r="10"
                  fill="none"
                  stroke="#facc15"
                  stroke-width="2"
                  opacity="0.8"
                  class="animate-pulse"
                />
                <!-- Message indicator badge for unread status -->
                <circle 
                  v-if="!isMessageSelected(message)"
                  :cx="getTimeX(message.timestamp) + 3" 
                  :cy="getMessageY(message, sessionIndex) - 3"
                  r="2"
                  fill="#ff6b6b"
                  opacity="0.8"
                  style="pointer-events: none;"
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

      <!-- Sessions Timeline Tooltip (reusing Agents tab component) -->
      <TimelineTooltip 
        :visible="tooltip.visible"
        :tooltip-data="tooltip"
        @tooltip-mouse-enter="onTooltipMouseEnter"
        @tooltip-mouse-leave="onTooltipMouseLeave"
      />

      <!-- Event Detail Panel -->
      <EventDetailPanel
        :visible="eventPanel.visible"
        :event-data="eventPanel.selectedEvent"
        :related-events="eventPanel.relatedEvents"
        @close="closeEventPanel"
        @event-selected="selectEvent"
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
            v-if="selectedAgent || selectedMessage || selectedEventIndicator"
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
      v-if="selectedAgent || selectedMessage || selectedEventIndicator" 
      class="selection-info bg-blue-600/20 border-t border-blue-400/30 px-4 py-2 text-sm"
    >
      <div v-if="selectedAgent" class="flex items-center justify-between">
        <span class="text-green-400">
          Selected Agent: <strong>{{ selectedAgent.name }}</strong>
        </span>
        <span class="text-gray-400">
          Type: {{ selectedAgent.type }}, Status: {{ selectedAgent.status }}
        </span>
      </div>
      <div v-else-if="selectedMessage" class="flex items-center justify-between">
        <span class="text-yellow-400">
          Selected Message from: <strong>{{ selectedMessage.sender }}</strong>
        </span>
        <span class="text-gray-400">
          {{ formatTimestamp(selectedMessage.timestamp) }}
        </span>
      </div>
      <div v-else-if="selectedEventIndicator" class="flex items-center justify-between">
        <span class="text-blue-400">
          Selected {{ selectedEventIndicator.eventType === 'UserPromptSubmit' ? 'User Prompt' : 'Notification' }}
        </span>
        <span class="text-gray-400">
          {{ formatTimestamp(selectedEventIndicator.timestamp) }} | Session: {{ selectedEventIndicator.sessionId.slice(-6) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import TimelineTooltip from './TimelineTooltip.vue';
import EventDetailPanel from './EventDetailPanel.vue';
// import SessionFilterPanel from './SessionFilterPanel.vue'; // Unused
import { SessionFilterUtils, DEFAULT_SESSION_FILTERS } from '../types/session-filters';
import type { SessionFilterState } from '../types/session-filters';
import { SessionDataAdapter } from '../utils/session-data-adapter';
import type { SessionData, SessionAgent, SessionMessage } from '../utils/session-data-adapter';
import { usePerformanceOptimizer } from '../composables/usePerformanceOptimizer';
import type { EventIndicator, EventIndicatorType } from '../types/event-indicators';
import type { HookEvent } from '../types';

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
  'event-indicator-clicked': [event: EventIndicator];
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
const currentWindow = ref<number>(props.defaultWindow);

// Auto-pan state management (unified)
const autoPanEnabled = ref(true);
const autoPanInterval = ref<number | null>(null);
const autoPanAnimationId = ref<number | null>(null);
const autoPanTargetX = ref(0);
const lastUserInteractionTime = ref(0);
const lastAutoPanTime = ref(0);

// Auto-pan configuration - Enhanced for responsiveness
const AUTO_PAN_UPDATE_INTERVAL = 250; // Update every 250ms for better responsiveness
const AUTO_PAN_INACTIVITY_THRESHOLD = 3000; // 3 seconds after user stops interacting
const AUTO_PAN_SMOOTH_FACTOR = 0.15; // Increased smoothing factor for better responsiveness
const AUTO_PAN_EASING_FACTOR = 0.12; // Increased easing factor for faster response
const AUTO_PAN_TARGET_RATIO = 0.92; // Keep NOW marker at 92% from left edge (near right side)
const AUTO_PAN_BUFFER = 80; // Reduced buffer for more responsive positioning

// Enhanced interaction state
const isPanning = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const initialPanPos = ref({ x: 0, y: 0 });
const dragDistance = ref(0);
const PAN_THRESHOLD = 5;

// User interaction detection flags
const isUserInteracting = ref(false);
const userInteractionType = ref<'zoom' | 'pan' | 'keyboard' | null>(null);
const userInteractionFlag = ref(false); // Global flag for auto-pan coordination

// Simplified interaction state - removed complex momentum animations

// Time window transition state
const isTimeWindowTransitioning = ref(false);
let timeWindowTransitionId: number | null = null;

// User interaction detection state (consolidated)
const userInteractionTimeout = ref<number | null>(null);
const USER_INTERACTION_COOLDOWN = 3000; // 3 seconds after interaction stops

// Selection state
const selectedAgent = ref<SessionAgent | null>(null);
const selectedMessage = ref<SessionMessage | null>(null);
const highlightedMessageId = ref<string>('');

// Event indicators state
const eventIndicators = ref<EventIndicator[]>([]);
const selectedEventIndicator = ref<EventIndicator | null>(null);
const isLoadingEvents = ref(false);

// Loading state
const isLoading = ref(false);

// Event-based session filtering state
const sessionsWithEventsInWindow = ref<string[]>([]);
const lastWindowFetch = ref(0);

// Tooltip state (matching Agents tab interface)
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

// Event detail panel state
const eventPanel = ref<{
  visible: boolean;
  selectedEvent: EventIndicator | null;
  relatedEvents: EventIndicator[];
}>({
  visible: false,
  selectedEvent: null,
  relatedEvents: []
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

const baseSessionLaneHeight = 32; // Increased base height for better readability
const agentLaneHeight = 38;   // Further increased height per agent lane for better readability
const agentLaneBuffer = 8;    // Further increased buffer space between agent lanes
const sessionPadding = 12;    // Increased padding between sessions for clarity

const timeWindows: TimeWindow[] = [
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 }
];

// Event indicator styles
const eventIndicatorStyles = {
  UserPromptSubmit: {
    color: '#3b82f6',
    hoverColor: '#1d4ed8',
    size: 8,
    strokeWidth: 2
  },
  Notification: {
    color: '#f59e0b',
    hoverColor: '#d97706',
    size: 8,
    strokeWidth: 2
  }
};

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
// Auto-Pan Computed Properties
// ============================================================================

const isAutoPanActive = computed(() => {
  return autoPanEnabled.value && !isUserInteracting.value;
});

const latestContentX = computed(() => {
  if (visibleSessions.value.length === 0) return getNowX();
  
  // Find the rightmost (latest) content across all sessions
  let latestTime = Date.now();
  visibleSessions.value.forEach(session => {
    // Check latest agent activity
    session.agents.forEach(agent => {
      const endTime = agent.endTime || Date.now();
      if (endTime > latestTime) latestTime = endTime;
    });
    
    // Check latest messages
    session.messages.forEach(message => {
      if (message.timestamp > latestTime) latestTime = message.timestamp;
    });
  });
  
  return getTimeX(latestTime);
});

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

// Event indicators for visible sessions
const visibleEventIndicators = computed((): EventIndicator[] => {
  const { start, end } = timeRange.value;
  
  return eventIndicators.value.filter(indicator => {
    // Filter by time range
    if (indicator.timestamp < start || indicator.timestamp > end) {
      return false;
    }
    
    // Filter by visible sessions
    const isSessionVisible = visibleSessions.value.some(
      session => session.sessionId === indicator.sessionId
    );
    
    return isSessionVisible;
  });
});

const visibleSessions = computed((): SessionData[] => {
  const { start, end } = timeRange.value;
  
  // Filter based on sessions that have events in the current window
  let filteredSessions = transformedSessions.value;
  
  // Apply event-based filtering if we have session data
  if (sessionsWithEventsInWindow.value.length > 0) {
    filteredSessions = transformedSessions.value.filter(session => {
      // Check if this session has events in the current window
      return sessionsWithEventsInWindow.value.includes(session.sessionId);
    });
    console.log(`🔍 SessionsTimeline: Filtered to ${filteredSessions.length} sessions with events in window`);
  } else {
    // Fallback to original time-based filtering
    filteredSessions = transformedSessions.value.filter(session => {
      // Include session if its most recent agent was created within the time window
      // Find the most recent agent creation time
      let mostRecentAgentTime = session.startTime;
      if (session.agents && session.agents.length > 0) {
        mostRecentAgentTime = Math.max(...session.agents.map(agent => agent.startTime));
      }
      
      // Include session if the most recent agent was created within the time window
      return mostRecentAgentTime >= start && mostRecentAgentTime <= end;
    });
  }
  
  // Then apply additional session filters
  if (SessionFilterUtils.isFilterActive(currentFilters.value)) {
    const { filteredSessions: additionalFiltered, metrics } = SessionFilterUtils.applyFilters(
      filteredSessions, 
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
    
    return additionalFiltered.sort((a, b) => a.startTime - b.startTime);
  }
  
  // Reset performance metrics when no filters active
  filterPerformanceMetrics.value = null;
  
  return filteredSessions.sort((a, b) => a.startTime - b.startTime);
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
// Session Spacing Calculation Functions
// ============================================================================

/**
 * Group agents by batch based on start time proximity (5 second threshold)
 */
const getAgentBatches = (session: SessionData): Map<string, SessionAgent[]> => {
  const batches = new Map<string, SessionAgent[]>();
  
  if (session.agents.length === 0) return batches;
  
  // Sort agents by start time to ensure proper batch grouping
  const sortedAgents = [...session.agents].sort((a, b) => a.startTime - b.startTime);
  
  sortedAgents.forEach(agent => {
    // Use 5 second threshold for batch detection
    const batchKey = `batch_${Math.floor(agent.startTime / 5000)}`;
    if (!batches.has(batchKey)) {
      batches.set(batchKey, []);
    }
    batches.get(batchKey)!.push(agent);
  });
  
  return batches;
};

/**
 * Get the batch-specific lane index for an agent within its batch
 */
const getAgentBatchLaneIndex = (agent: SessionAgent, session: SessionData): number => {
  const batches = getAgentBatches(session);
  const batchKey = `batch_${Math.floor(agent.startTime / 5000)}`;
  const batchAgents = batches.get(batchKey) || [];
  
  // Find the agent's index within its batch (sorted by start time)
  const batchIndex = batchAgents.findIndex(a => a.agentId === agent.agentId);
  
  // Return 1-based index for proper lane positioning (lane 1 is closest to trunk)
  return batchIndex >= 0 ? batchIndex + 1 : 1;
};

/**
 * Calculate the maximum number of agents in any batch for a given session
 */
const getMaxAgentsInBatches = (session: SessionData): number => {
  if (session.agents.length === 0) return 0;
  
  const batches = getAgentBatches(session);
  
  // Return the maximum batch size for this session
  return Math.max(...Array.from(batches.values()).map(batch => batch.length), 0);
};

/**
 * Calculate dynamic session height based on maximum batch size
 */
const getSessionHeight = (session: SessionData): number => {
  const maxAgentsInBatch = getMaxAgentsInBatches(session);
  
  // Calculate required height:
  // - Base session height for orchestrator line and labels
  // - Space for each agent lane (maxAgents * agentLaneHeight)
  // - Buffer space between agent lanes
  // - Padding for visual separation
  const agentSpaceNeeded = maxAgentsInBatch * (agentLaneHeight + agentLaneBuffer);
  const totalHeight = baseSessionLaneHeight + agentSpaceNeeded + sessionPadding;
  
  // Ensure minimum height for readability (increased for better agent visibility)
  return Math.max(totalHeight, 60);
};

/**
 * Calculate cumulative Y offset for session positioning with variable spacing
 */
const getSessionCumulativeOffset = (sessionIndex: number): number => {
  let cumulativeHeight = 0;
  
  // Sum up heights of all previous sessions
  for (let i = 0; i < sessionIndex; i++) {
    if (i < visibleSessions.value.length) {
      cumulativeHeight += getSessionHeight(visibleSessions.value[i]);
    }
  }
  
  return cumulativeHeight;
};

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
  const cumulativeOffset = getSessionCumulativeOffset(sessionIndex);
  return timelineMargins.top + cumulativeOffset;
};

const getSessionOrchestratorY = (sessionIndex: number): number => {
  const sessionY = getSessionLaneY(sessionIndex);
  // Position orchestrator line in the middle of the base session area
  return sessionY + baseSessionLaneHeight / 2;
};

const getAgentLaneY = (agent: SessionAgent, sessionIndex: number): number => {
  const sessionCenterY = getSessionOrchestratorY(sessionIndex);
  const session = visibleSessions.value[sessionIndex];
  
  // Use batch-specific lane index instead of session-wide lane index
  const batchLaneIndex = getAgentBatchLaneIndex(agent, session);
  
  // Position ALL agents below orchestrator line (matching reference implementation)
  const laneOffset = batchLaneIndex * agentLaneHeight;
  return sessionCenterY + laneOffset;
};

const getSessionAgentPath = (agent: SessionAgent, sessionIndex: number): string => {
  const startX = getTimeX(agent.startTime);
  const endX = getTimeX(agent.endTime || Date.now());
  const orchestratorY = getSessionOrchestratorY(sessionIndex);
  const agentY = getAgentLaneY(agent, sessionIndex);
  
  // Ensure minimum distance for readable branches
  const minBranchWidth = 30;
  const actualWidth = Math.max(endX - startX, minBranchWidth);
  
  const branchOut = Math.min(20, actualWidth * 0.2); // Adaptive branch distance
  const mergeBack = Math.min(20, actualWidth * 0.2); // Adaptive merge distance
  
  // Calculate control points for smooth curves
  const cp1X = startX + branchOut;
  const cp2X = startX + branchOut * 1.5;
  const cp3X = endX - mergeBack * 1.5;
  const cp4X = endX - mergeBack;
  
  if (agent.status === 'completed' && agent.endTime) {
    // Complete path with merge back to orchestrator
    return `M ${startX},${orchestratorY} 
            C ${cp1X},${orchestratorY} ${cp1X},${agentY} ${cp2X},${agentY}
            L ${cp3X},${agentY}
            C ${cp4X},${agentY} ${cp4X},${orchestratorY} ${endX},${orchestratorY}`;
  } else {
    // In-progress, error, or terminated path - branch out but don't merge back
    // Terminated agents end at their lane with no merge back to orchestrator
    const currentEndX = Math.max(endX, startX + minBranchWidth);
    return `M ${startX},${orchestratorY} 
            C ${cp1X},${orchestratorY} ${cp1X},${agentY} ${cp2X},${agentY}
            L ${currentEndX},${agentY}`;
  }
};

const getAgentLabelPosition = (agent: SessionAgent, sessionIndex: number) => {
  const startX = getTimeX(agent.startTime);
  const endX = getTimeX(agent.endTime || Date.now());
  const agentY = getAgentLaneY(agent, sessionIndex);
  
  // Ensure minimum distance for label positioning
  const minBranchWidth = 30;
  const actualEndX = Math.max(endX, startX + minBranchWidth);
  
  // Position label at the center of the agent's horizontal timeline
  const centerX = (startX + actualEndX) / 2;
  
  // For in-progress agents, position label slightly forward
  const labelX = agent.endTime ? centerX : centerX + 10;
  
  return {
    x: labelX,
    y: agentY - 8 // Increased offset above the branch line for better readability
  };
};

const getMessageY = (message: SessionMessage, sessionIndex: number): number => {
  // Try to position message near the sending agent
  const session = visibleSessions.value[sessionIndex];
  const sender = session.agents.find(a => a.name === message.sender);
  
  if (sender) {
    // Position message on the agent's path with slight offset for visibility
    const agentY = getAgentLaneY(sender, sessionIndex);
    // Add small random offset to prevent overlap when multiple messages at same time
    const timeOffset = (message.timestamp % 1000) / 200; // 0-5px offset based on timestamp
    return agentY + timeOffset;
  }
  
  // Fallback to orchestrator line with slight offset for visibility
  const orchestratorY = getSessionOrchestratorY(sessionIndex);
  const timeOffset = (message.timestamp % 1000) / 200;
  return orchestratorY + timeOffset + 10; // Offset below orchestrator line
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
  if (status === 'error') width = 2;
  if (isSelected) width += 1;
  return width;
};

const getAgentPathClass = (status: string, isSelected: boolean): string => {
  let classes = 'transition-all duration-200';
  if (status === 'in_progress') classes += ' animate-pulse';
  if (status === 'error') classes += ' opacity-75';
  if (isSelected) classes += ' drop-shadow-[0_0_8px_currentColor]';
  return classes;
};

// Enhanced message styling functions (matching Agents tab)
const getMessageRadius = (message: any): number => {
  const isSelected = isMessageSelected(message);
  const isHighlighted = message.id === highlightedMessageId.value;
  
  if (isSelected) return 6;
  if (isHighlighted) return 5;
  return 4;
};

// Get message color - now consistent yellow like Agents tab
const getMessageColor = (message: SessionMessage): string => {
  // Use consistent yellow color like Agents tab for all messages
  return '#facc15'; // Yellow color matching Agents tab
};

const getMessageClasses = (message: any): string => {
  const baseClasses = 'cursor-pointer transition-all duration-200';
  const isSelected = isMessageSelected(message);
  const isHighlighted = message.id === highlightedMessageId.value;
  
  if (isSelected) return baseClasses + ' drop-shadow-[0_0_16px_#facc15] animate-pulse';
  if (isHighlighted) return baseClasses + ' drop-shadow-[0_0_12px_#facc15]';
  return baseClasses + ' hover:drop-shadow-[0_0_8px_#facc15]';
};

const isMessageSelected = (message: any): boolean => {
  return selectedMessage.value?.timestamp === message.timestamp && 
         selectedMessage.value?.sender === message.sender;
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


const selectAgent = (agent: SessionAgent, session: SessionData) => {
  selectedAgent.value = agent;
  selectedMessage.value = null;
  emit('agent-selected', agent, session);
};


const selectMessage = (message: SessionMessage, session: SessionData) => {
  selectedMessage.value = message;
  selectedAgent.value = null;
  emit('message-selected', message, session);
};


const clearSelections = () => {
  selectedAgent.value = null;
  selectedMessage.value = null;
  selectedEventIndicator.value = null;
};

// ============================================================================
// Event-Based Session Filtering Functions
// ============================================================================

const fetchSessionsWithEventsInWindow = async () => {
  const { start, end } = timeRange.value;
  
  // Reduced throttling - allow fetches every 500ms for better responsiveness
  const now = Date.now();
  if (now - lastWindowFetch.value < 500) {
    return;
  }
  lastWindowFetch.value = now;
  
  try {
    const response = await fetch(`http://localhost:4000/api/sessions/events-window?start=${Math.floor(start)}&end=${Math.ceil(end)}`);
    if (response.ok) {
      const data = await response.json();
      sessionsWithEventsInWindow.value = data.sessionIds || [];
      console.log(`🔍 SessionsTimeline: Found ${data.sessionIds?.length || 0} sessions with events in window`);
    }
  } catch (error) {
    console.error('Failed to fetch sessions with events:', error);
  }
};

// ============================================================================
// Event Indicator Functions
// ============================================================================

const fetchEventIndicators = async () => {
  if (isLoadingEvents.value) return;
  
  isLoadingEvents.value = true;
  
  try {
    console.log('🔍 Fetching event indicators from API...');
    
    const response = await fetch('http://localhost:4000/events/recent?limit=1000');
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    
    const events: HookEvent[] = await response.json();
    
    // Transform events to indicators
    const indicators: EventIndicator[] = events
      .filter(event => 
        event.hook_event_type === 'UserPromptSubmit' || 
        event.hook_event_type === 'Notification'
      )
      .map(event => ({
        eventId: event.id?.toString() || `${event.timestamp}-${event.hook_event_type}`,
        eventType: event.hook_event_type as EventIndicatorType,
        timestamp: event.timestamp || Date.now(),
        sessionId: event.session_id,
        content: extractEventContent(event),
        position: { x: 0, y: 0 }, // Will be calculated during rendering
        rawEvent: {
          ...event,
          payload: event.payload || {}
        } as any, // Type cast to handle payload compatibility
        metadata: extractEventMetadata(event)
      }));
    
    eventIndicators.value = indicators;
    console.log(`✅ Loaded ${indicators.length} event indicators`);
    
  } catch (error) {
    console.error('❌ Failed to fetch event indicators:', error);
  } finally {
    isLoadingEvents.value = false;
  }
};

const extractEventContent = (event: HookEvent): string => {
  if (event.hook_event_type === 'UserPromptSubmit') {
    return event.payload?.prompt || event.summary || 'User submitted a prompt';
  } else if (event.hook_event_type === 'Notification') {
    return event.payload?.message || event.summary || 'System notification';
  }
  return event.summary || 'Event';
};

const extractEventMetadata = (event: HookEvent) => {
  const metadata: {
    severity?: 'info' | 'warning' | 'error';
    source?: string;
    category?: string;
    wordCount?: number;
    complexity?: 'simple' | 'moderate' | 'complex';
    responseTime?: number;
    agentCount?: number;
  } = {};
  
  if (event.hook_event_type === 'UserPromptSubmit') {
    metadata.wordCount = event.payload?.prompt?.split(' ').length || 0;
    metadata.complexity = metadata.wordCount > 100 ? 'complex' : metadata.wordCount > 20 ? 'moderate' : 'simple';
  } else if (event.hook_event_type === 'Notification') {
    const level = event.payload?.level;
    metadata.severity = (level === 'info' || level === 'warning' || level === 'error') ? level : 'info';
    metadata.source = event.payload?.source || 'system';
  }
  
  return metadata;
};

const getSessionEventIndicators = (sessionId: string): EventIndicator[] => {
  return visibleEventIndicators.value.filter(indicator => 
    indicator.sessionId === sessionId
  );
};

const isEventIndicatorSelected = (indicator: EventIndicator): boolean => {
  return selectedEventIndicator.value?.eventId === indicator.eventId;
};

const selectEventIndicator = (indicator: EventIndicator, session: SessionData) => {
  selectedEventIndicator.value = indicator;
  selectedAgent.value = null;
  selectedMessage.value = null;
  
  // Update indicator position for potential panel usage
  const sessionIndex = visibleSessions.value.findIndex(s => s.sessionId === session.sessionId);
  if (sessionIndex >= 0) {
    indicator.position = {
      x: getTimeX(indicator.timestamp),
      y: getSessionOrchestratorY(sessionIndex)
    };
  }
  
  // Open the event detail panel
  openEventPanel(indicator);
  
  emit('event-indicator-clicked', indicator);
  
  console.log('🎯 Selected event indicator:', indicator);
};

const showEventIndicatorTooltip = (indicator: EventIndicator, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    const preview = indicator.content.substring(0, 100) + 
      (indicator.content.length > 100 ? '...' : '');
    
    tooltip.value = {
      visible: true,
      type: indicator.eventType === 'UserPromptSubmit' ? 'prompt' : 'generic',
      data: {
        title: indicator.eventType === 'UserPromptSubmit' ? 'User Prompt' : 'Notification',
        timestamp: formatTimestamp(indicator.timestamp),
        preview,
        sessionId: indicator.sessionId,
        eventType: indicator.eventType,
        metadata: indicator.metadata
      },
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

// ============================================================================
// User Interaction Detection Functions
// ============================================================================

const disableAutoPanOnUserInteraction = (interactionType: 'zoom' | 'pan' | 'keyboard') => {
  // Only disable autopan on user interaction, do NOT change time window
  if (autoPanEnabled.value && isUserInteracting.value) {
    console.log(`🎯 SarahToggle: User ${interactionType} detected, disabling autopan only (keeping time window)`);
    autoPanEnabled.value = false;
    stopAutoPan();
  }
};

const startUserInteraction = (type: 'zoom' | 'pan' | 'keyboard') => {
  isUserInteracting.value = true;
  userInteractionType.value = type;
  userInteractionFlag.value = true; // Set global flag for auto-pan coordination
  
  // Only disable autopan on user interaction - do NOT change time window
  disableAutoPanOnUserInteraction(type);
  
  // Auto-reset flag after 3 seconds (as per RobertArch's architecture)
  setTimeout(() => {
    userInteractionFlag.value = false;
  }, 3000);
};

const endUserInteraction = () => {
  isUserInteracting.value = false;
  userInteractionType.value = null;
  // Keep userInteractionFlag for auto-pan coordination until timeout
};

// ============================================================================
// Time Window Functions
// ============================================================================

const setTimeWindow = (windowSize: number) => {
  const oldWindow = currentWindow.value;
  
  if (oldWindow === windowSize) return;
  
  // Mark this as a programmatic change, not user interaction
  const wasUserInteracting = isUserInteracting.value;
  isUserInteracting.value = false;
  
  // Reset view when switching time windows (zoom=1, pan=0)
  zoomLevel.value = 1;
  panX.value = 0;
  panY.value = 0;
  emit('zoom-changed', zoomLevel.value);
  
  // Re-enable auto-pan when switching time windows
  autoPanEnabled.value = true;
  startAutoPan();
  
  isTimeWindowTransitioning.value = true;
  currentWindow.value = windowSize;
  emit('time-window-changed', windowSize);
  
  // Restore user interaction state after programmatic change
  setTimeout(() => {
    isUserInteracting.value = wasUserInteracting;
  }, 0);
  
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

// Button styling for time window buttons
const getTimeWindowButtonClass = (window: TimeWindow): string => {
  const isSelected = currentWindow.value === window.value;
  
  if (isSelected) {
    return 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50';
  }
  
  return 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white';
};

const getTimeWindowButtonTitle = (window: TimeWindow): string => {
  const shortcut = getWindowShortcut(window.value);
  const shortcutText = shortcut ? ` (Key: ${shortcut})` : '';
  
  return `Switch to ${window.label} time window${shortcutText}`;
};

// ============================================================================
// Zoom and Pan Functions
// ============================================================================

const zoomIn = () => {
  // Check if this is user-initiated (from button click, not wheel)
  if (!isUserInteracting.value) {
    startUserInteraction('zoom');
  }
  zoomLevel.value = Math.min(zoomLevel.value * 1.25, 10);
  emit('zoom-changed', zoomLevel.value);
};

const zoomOut = () => {
  // Check if this is user-initiated (from button click, not wheel)
  if (!isUserInteracting.value) {
    startUserInteraction('zoom');
  }
  zoomLevel.value = Math.max(zoomLevel.value / 1.25, 0.1);
  emit('zoom-changed', zoomLevel.value);
};

const resetView = () => {
  // Reset view is a programmatic action, don't trigger "off" mode
  const wasUserInteracting = isUserInteracting.value;
  isUserInteracting.value = false;
  
  zoomLevel.value = 1;
  panX.value = 0;
  panY.value = 0;
  emit('zoom-changed', zoomLevel.value);
  
  // Restore user interaction state after reset
  setTimeout(() => {
    isUserInteracting.value = wasUserInteracting;
  }, 0);
  
  // Re-enable auto-pan after view reset
  autoPanEnabled.value = true;
  startAutoPan();
};

// ============================================================================
// Auto-Pan Functions
// ============================================================================

const calculateAutoPanTarget = (): number => {
  // Calculate where the "NOW" marker should be positioned
  // Keep it near the right edge for optimal viewing (no future events beyond NOW)
  const timelineWidth = containerWidth.value - timelineMargins.left - timelineMargins.right;
  const targetRatio = AUTO_PAN_TARGET_RATIO; // Position NOW marker at 92% from left edge
  const nowX = getNowX();
  const idealNowX = timelineMargins.left + (timelineWidth * targetRatio);
  
  return panX.value + (idealNowX - nowX);
};

// Old auto-pan functions removed to avoid duplication

const updateAutoPan = (currentTime: number) => {
  if (!autoPanEnabled.value || isUserInteracting.value) {
    return;
  }
  
  // Calculate target position to keep NOW marker at 92% from left edge (near right side)
  const nowX = getNowX();
  const viewportWidth = containerWidth.value - timelineMargins.left - timelineMargins.right;
  const targetNowX = timelineMargins.left + (viewportWidth * AUTO_PAN_TARGET_RATIO);
  const targetPanX = panX.value + (targetNowX - nowX);
  
  // Use more responsive interpolation with increased easing factor
  const diff = targetPanX - panX.value;
  if (Math.abs(diff) > 0.5) { // More sensitive threshold for smoother updates
    panX.value += diff * AUTO_PAN_EASING_FACTOR;
    autoPanTargetX.value = targetPanX;
  }
  
  lastAutoPanTime.value = currentTime;
};

const autoPanLoop = (currentTime: number) => {
  updateAutoPan(currentTime);
  
  // Continue the animation loop if auto-pan is enabled
  if (autoPanEnabled.value && !isUserInteracting.value) {
    autoPanAnimationId.value = requestAnimationFrame(autoPanLoop);
  } else {
    autoPanAnimationId.value = null;
  }
};

const startAutoPan = () => {
  if (autoPanAnimationId.value) {
    cancelAnimationFrame(autoPanAnimationId.value);
  }
  
  lastAutoPanTime.value = performance.now();
  autoPanAnimationId.value = requestAnimationFrame(autoPanLoop);
};

const stopAutoPan = () => {
  if (autoPanAnimationId.value) {
    cancelAnimationFrame(autoPanAnimationId.value);
    autoPanAnimationId.value = null;
  }
};

const toggleAutoPan = () => {
  autoPanEnabled.value = !autoPanEnabled.value;
  
  if (autoPanEnabled.value) {
    // Re-enable auto-pan and start timer
    startAutoPan();
  } else {
    // Disable auto-pan and stop timer
    stopAutoPan();
  }
};

// ============================================================================
// Mouse Interaction Handlers
// ============================================================================

const handleMouseDown = (event: MouseEvent) => {
  // Check if clicking on background (SVG itself) vs interactive elements
  if (event.target === sessionsSvg.value) {
    // Start user pan interaction
    startUserInteraction('pan');
    
    isPanning.value = true;
    dragStartPos.value = { x: event.clientX, y: event.clientY };
    initialPanPos.value = { x: panX.value, y: panY.value };
    dragDistance.value = 0;
    
    // Prevent default to avoid text selection
    event.preventDefault();
    
    // Add global event listeners for mouse move and up during drag
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }
};

const handleMouseMove = (event: MouseEvent) => {
  // This handles mousemove within the SVG area
  if (isPanning.value) {
    updatePanPosition(event);
  }
};

// Global mouse move handler for smooth dragging outside SVG bounds
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isPanning.value) {
    updatePanPosition(event);
  }
};

const updatePanPosition = (event: MouseEvent) => {
  if (!isPanning.value) return;
  
  const deltaX = event.clientX - dragStartPos.value.x;
  const deltaY = event.clientY - dragStartPos.value.y;
  
  // Calculate total drag distance for threshold check
  dragDistance.value = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Update pan position
  panX.value = initialPanPos.value.x + deltaX;
  panY.value = initialPanPos.value.y + deltaY;
};

const handleMouseUp = (event: MouseEvent) => {
  handleGlobalMouseUp(event);
};

// Global mouse up handler
const handleGlobalMouseUp = (_event: MouseEvent) => {
  if (isPanning.value) {
    isPanning.value = false;
    
    // End user interaction when panning stops
    endUserInteraction();
    
    // Clean up global event listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
};

// Removed complex momentum animation - now using direct pan

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
  
  // Start user zoom interaction
  startUserInteraction('zoom');
  
  const zoomFactor = 1.1;
  if (event.deltaY < 0) {
    zoomLevel.value = Math.min(zoomLevel.value * zoomFactor, 10);
  } else {
    zoomLevel.value = Math.max(zoomLevel.value / zoomFactor, 0.1);
  }
  emit('zoom-changed', zoomLevel.value);
  
  // End zoom interaction after a short delay
  setTimeout(() => {
    endUserInteraction();
  }, 100);
};

// Removed complex cursor-centered zoom animations - now using direct zoom

// Mouse leave handler that combines tooltip hiding and pan cleanup
const handleMouseLeave = () => {
  hideTooltip();
  
  // Clean up any ongoing pan operation when mouse leaves the timeline
  if (isPanning.value) {
    isPanning.value = false;
    endUserInteraction();
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
      type: 'agent' as const,
      data: {
        name: agent.name,
        type: agent.type,
        status: agent.status,
        color: getAgentColor(agent.type),
        duration: agent.endTime ? agent.endTime - agent.startTime : Date.now() - agent.startTime
      },
      position: { x: event.clientX, y: event.clientY }
    };
  }, TOOLTIP_SHOW_DELAY);
};

const showMessageTooltip = (message: SessionMessage, session: SessionData, event: MouseEvent) => {
  clearTooltipTimers();
  
  tooltipShowTimer = window.setTimeout(() => {
    const content = message.content || 'No content';
    const preview = typeof content === 'string' 
      ? content.substring(0, 100) + (content.length > 100 ? '...' : '')
      : 'Object message';
      
    tooltip.value = {
      visible: true,
      type: 'message' as const,
      data: {
        sender: message.sender,
        created_at: message.timestamp,
        preview,
        sessionName: session.displayName,
        fullContent: content
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
      type: 'generic',
      data: null,
      position: { x: 0, y: 0 }
    };
  }, TOOLTIP_HIDE_DELAY);
};

const hideTooltipImmediate = () => {
  clearTooltipTimers();
  tooltip.value = {
    visible: false,
    type: 'generic',
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
// Event Detail Panel Functions
// ============================================================================

const openEventPanel = (eventIndicator: EventIndicator) => {
  // Find related events in the same session
  const relatedEvents = findRelatedEvents(eventIndicator);
  
  eventPanel.value = {
    visible: true,
    selectedEvent: eventIndicator,
    relatedEvents
  };
  
  // Hide tooltip when opening panel
  hideTooltipImmediate();
  
  // Emit event for external listeners
  emit('event-indicator-clicked', eventIndicator);
};

const closeEventPanel = () => {
  eventPanel.value = {
    visible: false,
    selectedEvent: null,
    relatedEvents: []
  };
};

const selectEvent = (eventIndicator: EventIndicator) => {
  openEventPanel(eventIndicator);
};

const findRelatedEvents = (eventIndicator: EventIndicator): EventIndicator[] => {
  // For now, return empty array. SarahFrontend will provide the related events logic
  // when the event indicators are implemented
  return [];
};

// Handler function that can be called from event indicators
const handleEventIndicatorClick = (eventIndicator: EventIndicator, mouseEvent: MouseEvent) => {
  mouseEvent.stopPropagation();
  openEventPanel(eventIndicator);
};

// Expose the handler function to the template and parent components
defineExpose({
  handleEventIndicatorClick,
  openEventPanel,
  closeEventPanel
});

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
    
    // Calculate total height based on dynamic session heights
    const totalSessionsHeight = visibleSessions.value.reduce((sum, session) => {
      return sum + getSessionHeight(session);
    }, 0);
    
    containerHeight.value = Math.max(
      props.height,
      timelineMargins.top + totalSessionsHeight + timelineMargins.bottom
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
      startUserInteraction('keyboard');
      panX.value += panStep;
      setTimeout(() => endUserInteraction(), 100);
      break;
    case 'ArrowRight':
      event.preventDefault();
      startUserInteraction('keyboard');
      panX.value -= panStep;
      setTimeout(() => endUserInteraction(), 100);
      break;
    case 'ArrowUp':
      event.preventDefault();
      startUserInteraction('keyboard');
      panY.value += panStep;
      setTimeout(() => endUserInteraction(), 100);
      break;
    case 'ArrowDown':
      event.preventDefault();
      startUserInteraction('keyboard');
      panY.value -= panStep;
      setTimeout(() => endUserInteraction(), 100);
      break;
    case '+':
    case '=':
      event.preventDefault();
      startUserInteraction('keyboard');
      zoomIn();
      setTimeout(() => endUserInteraction(), 100);
      break;
    case '-':
    case '_':
      event.preventDefault();
      startUserInteraction('keyboard');
      zoomOut();
      setTimeout(() => endUserInteraction(), 100);
      break;
    case 'r':
    case 'R':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        resetView(); // Reset doesn't trigger "off" mode
      }
      break;
    case '1':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(15 * 60 * 1000); // Programmatic window change
      }
      break;
    case '2':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(60 * 60 * 1000); // Programmatic window change
      }
      break;
    case '3':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(6 * 60 * 60 * 1000); // Programmatic window change
      }
      break;
    case '4':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTimeWindow(24 * 60 * 60 * 1000); // Programmatic window change
      }
      break;
    case 'a':
    case 'A':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        toggleAutoPan();
      }
      break;
    case 'Escape':
      if (eventPanel.value.visible) {
        closeEventPanel();
      } else {
        clearSelections();
      }
      break;
  }
};

onMounted(async () => {
  updateDimensions();
  loadPersistedFilters();
  window.addEventListener('resize', updateDimensions);
  document.addEventListener('keydown', handleKeydown);
  
  // Fetch event indicators and sessions with events
  await fetchEventIndicators();
  await fetchSessionsWithEventsInWindow();
  
  // Start auto-pan when component mounts
  startAutoPan();
  
  // Start session refresh if auto-pan is enabled
  if (autoPanEnabled.value) {
    startSessionRefresh();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateDimensions);
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
  
  // Clean up auto-pan interval
  stopAutoPan();
  
  // Clean up session refresh interval
  stopSessionRefresh();
  
  // Clean up time window transitions (keep this one for window switching)
  if (timeWindowTransitionId) {
    cancelAnimationFrame(timeWindowTransitionId);
    timeWindowTransitionId = null;
  }
  
  // Reset animation state
  isTimeWindowTransitioning.value = false;
  
  clearTooltipTimers();
});

watch(() => visibleSessions.value.length, () => {
  updateDimensions();
});

watch(() => props.height, (newHeight) => {
  updateDimensions();
});

// Refetch event indicators when time window changes
watch(() => timeRange.value, async () => {
  await fetchEventIndicators();
  // Also fetch sessions with events in the new window
  await fetchSessionsWithEventsInWindow();
}, { deep: true });

// Watch for new sessions to update event-based filtering
watch(() => transformedSessions.value, () => {
  // When sessions change, refetch sessions with events
  fetchSessionsWithEventsInWindow();
}, { deep: true });

// Set up auto-refresh for event-based session filtering
let sessionRefreshInterval: number | null = null;

const startSessionRefresh = () => {
  if (sessionRefreshInterval) return;
  
  // Refresh sessions more frequently (every 1.5 seconds) if auto-pan is enabled
  sessionRefreshInterval = window.setInterval(() => {
    if (autoPanEnabled.value) {
      fetchSessionsWithEventsInWindow();
    }
  }, 1500);
};

const stopSessionRefresh = () => {
  if (sessionRefreshInterval) {
    clearInterval(sessionRefreshInterval);
    sessionRefreshInterval = null;
  }
};

// Watch autoPanEnabled to control refresh interval
watch(autoPanEnabled, (enabled) => {
  if (enabled) {
    startSessionRefresh();
  } else {
    stopSessionRefresh();
  }
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