<template>
  <div 
    v-if="isDevelopment || forceShow"
    class="performance-monitor fixed top-4 right-4 bg-gray-900/95 border border-gray-600 rounded-lg p-3 text-xs font-mono z-50"
    :class="{ 'opacity-75 hover:opacity-100 transition-opacity': !expanded }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-white font-semibold">Performance Monitor</h4>
      <button 
        @click="expanded = !expanded"
        class="text-gray-400 hover:text-white transition-colors"
      >
        {{ expanded ? '−' : '+' }}
      </button>
    </div>

    <!-- Key Metrics (always visible) -->
    <div class="space-y-1">
      <div class="flex justify-between items-center">
        <span class="text-gray-400">FPS:</span>
        <span 
          class="font-bold"
          :class="fpsColor"
        >
          {{ Math.round(metrics.fps) }}
        </span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-400">Frame Time:</span>
        <span 
          class="font-bold"
          :class="frameTimeColor"
        >
          {{ metrics.frameTime.toFixed(1) }}ms
        </span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-400">Elements:</span>
        <span class="text-blue-400 font-bold">
          {{ metrics.elementCount.visible }}/{{ metrics.elementCount.agents + metrics.elementCount.messages }}
        </span>
      </div>
    </div>

    <!-- Detailed Metrics (expandable) -->
    <div v-if="expanded" class="mt-3 pt-3 border-t border-gray-700 space-y-1">
      <div class="flex justify-between items-center">
        <span class="text-gray-400">Memory:</span>
        <span 
          class="font-bold"
          :class="memoryColor"
        >
          {{ metrics.memoryMB.toFixed(1) }}MB
        </span>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-gray-400">Cull Ratio:</span>
        <span class="text-green-400 font-bold">
          {{ metrics.cullRatio.toFixed(1) }}%
        </span>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-gray-400">Render Count:</span>
        <span class="text-gray-300">
          {{ metrics.renderCount }}
        </span>
      </div>

      <div class="mt-2 pt-2 border-t border-gray-700">
        <div class="text-gray-400 mb-1">Agent Breakdown:</div>
        <div class="flex justify-between text-xs">
          <span>Agents: {{ metrics.elementCount.agents }}</span>
          <span>Messages: {{ metrics.elementCount.messages }}</span>
        </div>
      </div>

      <!-- Performance Recommendations -->
      <div v-if="recommendations.length > 0" class="mt-2 pt-2 border-t border-gray-700">
        <div class="text-yellow-400 mb-1 font-semibold">Recommendations:</div>
        <div class="space-y-1">
          <div 
            v-for="(recommendation, index) in recommendations" 
            :key="index"
            class="text-xs text-yellow-300"
          >
            • {{ recommendation }}
          </div>
        </div>
      </div>

      <!-- Performance History Chart (Mini) -->
      <div class="mt-3 pt-2 border-t border-gray-700">
        <div class="text-gray-400 mb-1">FPS History (60s):</div>
        <div class="h-8 bg-gray-800 rounded relative overflow-hidden">
          <svg class="w-full h-full" viewBox="0 0 120 32">
            <!-- FPS line chart -->
            <polyline
              :points="fpsChartPoints"
              stroke="#22c55e"
              stroke-width="1"
              fill="none"
              opacity="0.8"
            />
            <!-- Target FPS line (60) -->
            <line
              x1="0"
              y1="4"
              x2="120"
              y2="4"
              stroke="#fbbf24"
              stroke-width="1"
              stroke-dasharray="2,2"
              opacity="0.5"
            />
            <!-- Minimum acceptable FPS line (30) -->
            <line
              x1="0"
              y1="16"
              x2="120"
              y2="16"
              stroke="#ef4444"
              stroke-width="1"
              stroke-dasharray="2,2"
              opacity="0.5"
            />
          </svg>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 FPS</span>
          <span>60 FPS</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="mt-3 pt-2 border-t border-gray-700 flex justify-between">
        <button 
          @click="resetMetrics"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
        >
          Reset
        </button>
        <button 
          @click="exportReport"
          class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
        >
          Export
        </button>
      </div>
    </div>

    <!-- Performance Status Indicator -->
    <div class="absolute -top-1 -right-1">
      <div 
        class="w-3 h-3 rounded-full"
        :class="statusIndicatorColor"
        :title="performanceStatus"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { PerformanceMetrics } from '../types/timeline';

interface Props {
  metrics: PerformanceMetrics;
  isDevelopment?: boolean;
  forceShow?: boolean;
  recommendations?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  isDevelopment: true,
  forceShow: false,
  recommendations: () => []
});

// Component state
const expanded = ref(false);
const fpsHistory = ref<number[]>([]);
const maxHistorySize = 60; // Keep 60 seconds of history

// Update FPS history
watch(() => props.metrics.fps, (newFps) => {
  fpsHistory.value.push(newFps);
  if (fpsHistory.value.length > maxHistorySize) {
    fpsHistory.value.shift();
  }
});

// Computed properties for styling
const fpsColor = computed(() => {
  if (props.metrics.fps >= 50) return 'text-green-400';
  if (props.metrics.fps >= 30) return 'text-yellow-400';
  return 'text-red-400';
});

const frameTimeColor = computed(() => {
  if (props.metrics.frameTime <= 16.67) return 'text-green-400';
  if (props.metrics.frameTime <= 33.33) return 'text-yellow-400';
  return 'text-red-400';
});

const memoryColor = computed(() => {
  if (props.metrics.memoryMB <= 50) return 'text-green-400';
  if (props.metrics.memoryMB <= 100) return 'text-yellow-400';
  return 'text-red-400';
});

const statusIndicatorColor = computed(() => {
  if (props.metrics.fps >= 50 && props.metrics.frameTime <= 16.67) {
    return 'bg-green-400 animate-pulse';
  }
  if (props.metrics.fps >= 30 && props.metrics.frameTime <= 33.33) {
    return 'bg-yellow-400 animate-pulse';
  }
  return 'bg-red-400 animate-pulse';
});

const performanceStatus = computed(() => {
  if (props.metrics.fps >= 50) return 'Excellent Performance';
  if (props.metrics.fps >= 30) return 'Good Performance';
  return 'Poor Performance - Optimization Needed';
});

// FPS chart points for mini visualization
const fpsChartPoints = computed(() => {
  if (fpsHistory.value.length < 2) return '';
  
  const points = fpsHistory.value.map((fps, index) => {
    const x = (index / (maxHistorySize - 1)) * 120;
    const y = 32 - ((fps / 60) * 28); // Scale to chart height, inverted
    return `${x},${Math.max(2, Math.min(30, y))}`;
  });
  
  return points.join(' ');
});

// Actions
const resetMetrics = () => {
  fpsHistory.value = [];
  // Emit reset event to parent
  emit('reset-metrics');
};

const exportReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    metrics: props.metrics,
    fpsHistory: fpsHistory.value,
    recommendations: props.recommendations,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeline-performance-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Component events
const emit = defineEmits<{
  'reset-metrics': [];
}>();

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'p':
        event.preventDefault();
        expanded.value = !expanded.value;
        break;
      case 'r':
        event.preventDefault();
        resetMetrics();
        break;
    }
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* Custom scrollbar for better appearance */
.performance-monitor {
  max-height: 80vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #374151 #1f2937;
}

.performance-monitor::-webkit-scrollbar {
  width: 4px;
}

.performance-monitor::-webkit-scrollbar-track {
  background: #1f2937;
}

.performance-monitor::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 2px;
}

.performance-monitor::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}

/* Animation for smooth transitions */
.performance-monitor {
  transition: all 0.2s ease;
}

/* Tooltip styles */
[title] {
  cursor: help;
}

/* Development mode indicator */
.performance-monitor::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #22c55e, #3b82f6, #8b5cf6);
  opacity: 0.6;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .performance-monitor {
    position: fixed;
    top: 2px;
    right: 2px;
    font-size: 10px;
    padding: 8px;
    max-width: 200px;
  }
  
  .performance-monitor h4 {
    font-size: 11px;
  }
}
</style>