# AgentDetailPane Component Specification

## Component Overview

The `AgentDetailPane` is a slide-in detail panel that displays comprehensive agent observability data when users click on agent branches in the timeline. It follows the same design patterns as the existing `MessageDetailPane` for consistency.

## Visual Design Specification

### Layout & Dimensions
- **Width**: 384px (24rem) - consistent with MessageDetailPane
- **Height**: Full viewport height
- **Position**: Fixed to right edge, slides in from right
- **Z-index**: 50 (above timeline, below tooltips)

### Animation Behavior
```css
/* Slide-in transition */
transform: translateX(100%); /* hidden state */
transform: translateX(0%);   /* visible state */
transition: transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
```

### Color Scheme
```css
--panel-bg: #1f2937;          /* bg-gray-800 */
--panel-border: #4b5563;      /* border-gray-600 */
--header-bg-start: #374151;   /* from-gray-700 */
--header-bg-end: #4b5563;     /* to-gray-600 */
--text-primary: #ffffff;      /* text-white */
--text-secondary: #d1d5db;    /* text-gray-300 */
--text-muted: #9ca3af;        /* text-gray-400 */
--accent-color: var(--agent-type-color); /* Dynamic based on agent type */
```

## Component Structure

### Header Section
```vue
<div class="header bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
  <div class="flex items-center justify-between">
    <!-- Agent Identity -->
    <div class="flex items-center space-x-3">
      <div class="agent-type-indicator w-4 h-4 rounded-full" 
           :style="{ backgroundColor: agentColor }"></div>
      <div>
        <h3 class="text-white font-bold text-lg">{{ agent.name }}</h3>
        <span class="text-gray-300 text-sm">{{ agent.subagent_type }}</span>
      </div>
    </div>
    
    <!-- Status Badge -->
    <div class="status-badge">
      <span class="status-indicator" :class="statusClass">{{ agent.status }}</span>
    </div>
    
    <!-- Close Button -->
    <button @click="close" class="close-btn">
      <XMarkIcon class="w-5 h-5" />
    </button>
  </div>
</div>
```

### Content Sections

#### 1. Performance Metrics Section
```vue
<div class="performance-metrics mb-6">
  <h4 class="section-title">Performance Metrics</h4>
  
  <div class="metrics-grid grid grid-cols-2 gap-4">
    <!-- Execution Duration -->
    <div class="metric-card">
      <div class="metric-label">Execution Time</div>
      <div class="metric-value">{{ formatDuration(agent.total_duration_ms) }}</div>
      <div class="metric-trend" :class="durationTrendClass">
        {{ durationTrendText }}
      </div>
    </div>
    
    <!-- Token Usage -->
    <div class="metric-card">
      <div class="metric-label">Total Tokens</div>
      <div class="metric-value">{{ formatNumber(agent.total_tokens) }}</div>
      <div class="metric-breakdown">
        <span class="text-xs text-gray-400">
          {{ agent.input_tokens }}in / {{ agent.output_tokens }}out
        </span>
      </div>
    </div>
    
    <!-- Tool Usage -->
    <div class="metric-card">
      <div class="metric-label">Tool Calls</div>
      <div class="metric-value">{{ agent.total_tool_use_count || 0 }}</div>
    </div>
    
    <!-- Cache Efficiency -->
    <div class="metric-card">
      <div class="metric-label">Cache Hit Rate</div>
      <div class="metric-value">{{ cacheHitRate }}%</div>
      <div class="metric-breakdown">
        <span class="text-xs text-gray-400">
          {{ formatNumber(agent.cache_read_input_tokens) }} cached
        </span>
      </div>
    </div>
  </div>
</div>
```

#### 2. Timeline Context Section
```vue
<div class="timeline-context mb-6">
  <h4 class="section-title">Timeline Context</h4>
  
  <div class="context-info bg-gray-700 rounded-lg p-3">
    <!-- Mini Timeline Visualization -->
    <div class="mini-timeline mb-3">
      <svg class="w-full h-8" viewBox="0 0 300 32">
        <!-- Orchestrator line -->
        <line x1="0" y1="16" x2="300" y2="16" 
              stroke="#00d4ff" stroke-width="2" />
        
        <!-- Agent position indicator -->
        <circle :cx="agentPositionX" cy="16" r="4" 
                :fill="agentColor" stroke="#ffffff" stroke-width="2" />
        
        <!-- Batch indicators -->
        <circle v-for="batch in batches" 
                :key="batch.id"
                :cx="batch.x" 
                cy="16" 
                r="2" 
                fill="#00d4ff" />
      </svg>
    </div>
    
    <!-- Context Details -->
    <div class="context-details space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Batch Position</span>
        <span class="text-blue-400 text-sm">{{ batchInfo }}</span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Parallel Agents</span>
        <span class="text-gray-400 text-sm">{{ parallelAgentCount }}</span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Session Duration</span>
        <span class="text-gray-400 text-sm">{{ sessionDuration }}</span>
      </div>
    </div>
  </div>
</div>
```

#### 3. Resource Efficiency Section
```vue
<div class="resource-efficiency mb-6">
  <h4 class="section-title">Resource Efficiency</h4>
  
  <div class="efficiency-metrics space-y-3">
    <!-- Tokens per Second -->
    <div class="efficiency-row">
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Tokens/Second</span>
        <span class="text-white font-medium">{{ tokensPerSecond }}</span>
      </div>
      <div class="efficiency-bar">
        <div class="bar-fill" :style="{ width: tokensPerSecondPercent + '%' }"></div>
      </div>
    </div>
    
    <!-- Cost Efficiency -->
    <div class="efficiency-row">
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Cost Efficiency</span>
        <span class="text-white font-medium">{{ costEfficiency }}</span>
      </div>
      <div class="efficiency-bar">
        <div class="bar-fill" :style="{ width: costEfficiencyPercent + '%' }"></div>
      </div>
    </div>
    
    <!-- Tool Efficiency -->
    <div class="efficiency-row">
      <div class="flex items-center justify-between">
        <span class="text-gray-300 text-sm">Tool Efficiency</span>
        <span class="text-white font-medium">{{ toolEfficiency }}</span>
      </div>
      <div class="efficiency-bar">
        <div class="bar-fill" :style="{ width: toolEfficiencyPercent + '%' }"></div>
      </div>
    </div>
  </div>
</div>
```

#### 4. Related Messages Section
```vue
<div class="related-messages mb-6" v-if="relatedMessages.length > 0">
  <h4 class="section-title">Messages ({{ relatedMessages.length }})</h4>
  
  <div class="message-list space-y-2 max-h-40 overflow-y-auto">
    <div v-for="message in relatedMessages" 
         :key="message.id"
         class="message-item bg-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-600 transition-colors"
         @click="selectMessage(message)">
      
      <div class="flex items-center justify-between mb-1">
        <span class="text-white text-sm font-medium">{{ message.sender }}</span>
        <span class="text-gray-400 text-xs">{{ formatTime(message.created_at) }}</span>
      </div>
      
      <div class="text-gray-300 text-xs truncate">
        {{ getMessagePreview(message.message) }}
      </div>
    </div>
  </div>
</div>
```

#### 5. Actions Footer
```vue
<div class="actions-footer pt-4 border-t border-gray-600">
  <div class="grid grid-cols-2 gap-2">
    <button class="action-btn primary" @click="exportAgent">
      <DocumentArrowDownIcon class="w-4 h-4" />
      Export Data
    </button>
    
    <button class="action-btn secondary" @click="compareAgent">
      <ChartBarIcon class="w-4 h-4" />
      Compare
    </button>
    
    <button class="action-btn secondary" @click="copyDetails">
      <ClipboardIcon class="w-4 h-4" />
      Copy Details
    </button>
    
    <button class="action-btn secondary" @click="viewTrace">
      <MagnifyingGlassIcon class="w-4 h-4" />
      View Trace
    </button>
  </div>
</div>
```

## Style System

### Component Classes
```css
/* Main container */
.agent-detail-pane {
  @apply fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-600 shadow-2xl z-50;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.agent-detail-pane.hidden {
  transform: translateX(100%);
}

/* Section styling */
.section-title {
  @apply text-white font-semibold mb-3 text-sm;
}

/* Metric cards */
.metric-card {
  @apply bg-gray-700 rounded-lg p-3;
}

.metric-label {
  @apply text-gray-400 text-xs mb-1;
}

.metric-value {
  @apply text-white font-bold text-lg;
}

.metric-trend {
  @apply text-xs font-medium;
}

.metric-trend.positive {
  @apply text-green-400;
}

.metric-trend.negative {
  @apply text-red-400;
}

.metric-trend.neutral {
  @apply text-gray-400;
}

/* Efficiency bars */
.efficiency-bar {
  @apply w-full h-2 bg-gray-600 rounded-full overflow-hidden;
}

.bar-fill {
  @apply h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500;
}

/* Action buttons */
.action-btn {
  @apply flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors;
}

.action-btn.primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.action-btn.secondary {
  @apply bg-gray-600 text-white hover:bg-gray-500;
}

/* Status indicators */
.status-indicator {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.status-indicator.pending {
  @apply bg-yellow-600 text-white;
}

.status-indicator.in_progress {
  @apply bg-blue-600 text-white;
}

.status-indicator.completed {
  @apply bg-green-600 text-white;
}

.status-indicator.error {
  @apply bg-red-600 text-white;
}
```

## Component Props & Events

### Props
```typescript
interface Props {
  visible: boolean;
  selectedAgent: AgentStatus | null;
  agents?: AgentStatus[];
  messages?: SubagentMessage[];
  sessionId?: string;
}
```

### Events
```typescript
interface Events {
  'close': [];
  'agent-selected': [agent: AgentStatus];
  'message-clicked': [message: SubagentMessage];
  'export-agent': [agent: AgentStatus];
  'compare-agents': [agents: AgentStatus[]];
}
```

## Computed Properties & Methods

### Key Computeds
```typescript
// Performance calculations
const tokensPerSecond = computed(() => {
  if (!props.selectedAgent?.total_duration_ms || !props.selectedAgent?.total_tokens) return 0;
  return Math.round((props.selectedAgent.total_tokens / props.selectedAgent.total_duration_ms) * 1000);
});

const cacheHitRate = computed(() => {
  const total = (props.selectedAgent?.cache_read_input_tokens || 0) + 
                (props.selectedAgent?.input_tokens || 0);
  if (total === 0) return 0;
  return Math.round(((props.selectedAgent?.cache_read_input_tokens || 0) / total) * 100);
});

// Timeline context
const batchInfo = computed(() => {
  // Calculate batch position and batch number
  return `Batch ${batchNumber} of ${totalBatches}`;
});

const parallelAgentCount = computed(() => {
  // Count agents with overlapping execution times
  return agentsInSameBatch.value.length - 1;
});
```

### Key Methods
```typescript
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

const exportAgent = () => {
  const data = {
    agent: props.selectedAgent,
    metrics: {
      tokensPerSecond: tokensPerSecond.value,
      cacheHitRate: cacheHitRate.value,
      // ... other calculated metrics
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], 
                       { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-${props.selectedAgent?.name}-details.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

## Accessibility Features

### ARIA Labels
```vue
<div 
  role="dialog"
  aria-labelledby="agent-detail-title"
  aria-describedby="agent-detail-content"
  aria-modal="true"
>
  <h3 id="agent-detail-title" class="sr-only">
    Agent {{ agent.name }} Details
  </h3>
  
  <div id="agent-detail-content" class="sr-only">
    Performance and observability data for {{ agent.subagent_type }} agent
  </div>
</div>
```

### Keyboard Navigation
- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate buttons
- **Escape**: Close panel
- **Arrow Keys**: Navigate metric cards

### Focus Management
```typescript
const focusFirstElement = () => {
  nextTick(() => {
    const firstButton = panelRef.value?.querySelector('button');
    firstButton?.focus();
  });
};

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    focusFirstElement();
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
```

## Mobile Responsiveness

```css
@media (max-width: 768px) {
  .agent-detail-pane {
    @apply w-full;
  }
  
  .metrics-grid {
    @apply grid-cols-1;
  }
  
  .actions-footer .grid {
    @apply grid-cols-1 gap-2;
  }
}
```

## Integration Points

### Timeline Component Changes
```vue
<!-- In InteractiveAgentTimeline.vue -->
<AgentDetailPane 
  :visible="agentDetailVisible"
  :selected-agent="selectedAgent"
  :agents="agents"
  :messages="messages"
  :session-id="sessionId"
  @close="closeAgentDetail"
  @agent-selected="handleAgentSelected"
  @message-clicked="handleMessageClicked"
  @export-agent="handleExportAgent"
  @compare-agents="handleCompareAgents"
/>
```

### Event Handler Updates
```typescript
// Add to InteractiveAgentTimeline component
const agentDetailVisible = ref(false);

const selectAgentPath = (agent: any) => {
  selectedAgent.value = agent;
  selectedMessage.value = null;
  agentDetailVisible.value = true; // New: Show agent detail instead of message detail
  emit('agent-path-clicked', agent);
  emit('selection-changed', { agent });
};

const closeAgentDetail = () => {
  agentDetailVisible.value = false;
  selectedAgent.value = null;
};
```

This specification provides a complete blueprint for implementing the Agent Performance Dashboard feature with full design consistency, technical feasibility, and high user value for observability.