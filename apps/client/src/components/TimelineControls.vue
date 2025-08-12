<template>
  <div class="timeline-controls bg-gray-700 border-t border-gray-600 px-4 py-3">
    <div class="flex flex-col space-y-3 md:flex-row md:space-y-0 md:items-center md:justify-between">
      
      <!-- Zoom Controls -->
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <label class="text-gray-300 text-sm font-medium">Zoom:</label>
          <div class="flex items-center space-x-1">
            <button 
              @click="zoomOut"
              :disabled="zoom <= minZoom"
              class="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <span class="text-lg leading-none">−</span>
            </button>
            
            <div class="flex items-center space-x-2 px-3 py-1 bg-gray-800 rounded border border-gray-600">
              <span class="text-white text-sm font-mono">{{ zoomPercentage }}%</span>
            </div>
            
            <button 
              @click="zoomIn"
              :disabled="zoom >= maxZoom"
              class="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <span class="text-lg leading-none">+</span>
            </button>
          </div>
          
          <button 
            @click="resetZoom"
            class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
            title="Reset Zoom to 100%"
          >
            Reset
          </button>
        </div>
        
        <!-- Zoom Slider (for desktop) -->
        <div class="hidden lg:flex items-center space-x-2">
          <input
            type="range"
            :min="minZoom"
            :max="maxZoom"
            :step="0.1"
            v-model.number="zoom"
            class="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      <!-- Time Range Controls -->
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <label class="text-gray-300 text-sm font-medium">Time Range:</label>
          <select 
            v-model="selectedTimeRange"
            @change="changeTimeRange"
            class="px-3 py-1 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="1m">Last 1 min</option>
            <option value="3m">Last 3 min</option>
            <option value="5m">Last 5 min</option>
            <option value="10m">Last 10 min</option>
            <option value="30m">Last 30 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="all">All time</option>
          </select>
        </div>

        <!-- Pan Controls -->
        <div class="flex items-center space-x-1">
          <button 
            @click="panLeft"
            class="w-8 h-8 flex items-center justify-center bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title="Pan Left"
          >
            <span class="text-sm">←</span>
          </button>
          <button 
            @click="panRight"
            class="w-8 h-8 flex items-center justify-center bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title="Pan Right"
          >
            <span class="text-sm">→</span>
          </button>
        </div>
      </div>

      <!-- View Options -->
      <div class="flex items-center space-x-4">
        <!-- Auto-scroll -->
        <label class="flex items-center space-x-2 text-gray-300 text-sm cursor-pointer">
          <input 
            v-model="autoScroll" 
            type="checkbox" 
            class="rounded border-gray-400 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
            @change="toggleAutoScroll"
          />
          <span>Auto-scroll</span>
        </label>

        <!-- Follow Latest -->
        <label class="flex items-center space-x-2 text-gray-300 text-sm cursor-pointer">
          <input 
            v-model="followLatest" 
            type="checkbox" 
            class="rounded border-gray-400 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
            @change="toggleFollowLatest"
          />
          <span>Follow Latest</span>
        </label>

        <!-- Show Grid -->
        <label class="flex items-center space-x-2 text-gray-300 text-sm cursor-pointer">
          <input 
            v-model="showGrid" 
            type="checkbox" 
            class="rounded border-gray-400 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
            @change="toggleGrid"
          />
          <span>Grid</span>
        </label>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">
        <button 
          @click="fitToContent"
          class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          title="Fit timeline to show all content"
        >
          Fit All
        </button>
        
        <button 
          @click="centerOnLatest"
          :disabled="!hasContent"
          class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
          title="Center on latest activity"
        >
          Latest
        </button>

        <button 
          @click="exportView"
          class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
          title="Export current view as image"
        >
          Export
        </button>
      </div>
    </div>

    <!-- Time Range Slider (mobile friendly) -->
    <div class="mt-3 block md:hidden">
      <div class="flex items-center space-x-2">
        <span class="text-gray-400 text-xs">{{ formatTime(visibleTimeStart) }}</span>
        <div class="flex-1 relative">
          <input
            type="range"
            min="0"
            max="100"
            v-model.number="timePosition"
            class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            @input="onTimePositionChange"
          />
          <div class="absolute top-0 left-0 w-full h-2 pointer-events-none">
            <div 
              class="absolute top-0 h-2 bg-blue-500 rounded-lg opacity-30"
              :style="{ left: '0%', width: visibleRangePercentage + '%' }"
            ></div>
          </div>
        </div>
        <span class="text-gray-400 text-xs">{{ formatTime(visibleTimeEnd) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// Props
const props = withDefaults(defineProps<{
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  timeRange?: string;
  autoScroll?: boolean;
  followLatest?: boolean;
  showGrid?: boolean;
  hasContent?: boolean;
  visibleTimeStart?: number;
  visibleTimeEnd?: number;
  totalTimeStart?: number;
  totalTimeEnd?: number;
}>(), {
  zoom: 1,
  minZoom: 0.1,
  maxZoom: 10,
  timeRange: '5m',
  autoScroll: true,
  followLatest: true,
  showGrid: true,
  hasContent: false,
  visibleTimeStart: Date.now() - 300000,
  visibleTimeEnd: Date.now(),
  totalTimeStart: Date.now() - 3600000,
  totalTimeEnd: Date.now()
});

// Events
const emit = defineEmits<{
  'update:zoom': [zoom: number];
  'update:timeRange': [range: string];
  'update:autoScroll': [enabled: boolean];
  'update:followLatest': [enabled: boolean];
  'update:showGrid': [enabled: boolean];
  'pan': [direction: 'left' | 'right', amount: number];
  'fit-to-content': [];
  'center-on-latest': [];
  'export-view': [];
}>();

// Reactive State
const zoom = ref(props.zoom);
const selectedTimeRange = ref(props.timeRange);
const autoScroll = ref(props.autoScroll);
const followLatest = ref(props.followLatest);
const showGrid = ref(props.showGrid);
const timePosition = ref(50);

// Computed Properties
const zoomPercentage = computed(() => Math.round(zoom.value * 100));

const visibleRangePercentage = computed(() => {
  const totalDuration = props.totalTimeEnd - props.totalTimeStart;
  const visibleDuration = props.visibleTimeEnd - props.visibleTimeStart;
  return totalDuration > 0 ? (visibleDuration / totalDuration) * 100 : 0;
});

// Methods
const zoomIn = () => {
  const newZoom = Math.min(zoom.value * 1.2, props.maxZoom);
  zoom.value = newZoom;
  emit('update:zoom', newZoom);
};

const zoomOut = () => {
  const newZoom = Math.max(zoom.value / 1.2, props.minZoom);
  zoom.value = newZoom;
  emit('update:zoom', newZoom);
};

const resetZoom = () => {
  zoom.value = 1;
  emit('update:zoom', 1);
};

const changeTimeRange = () => {
  emit('update:timeRange', selectedTimeRange.value);
};

const panLeft = () => {
  emit('pan', 'left', 50);
};

const panRight = () => {
  emit('pan', 'right', 50);
};

const toggleAutoScroll = () => {
  emit('update:autoScroll', autoScroll.value);
};

const toggleFollowLatest = () => {
  emit('update:followLatest', followLatest.value);
};

const toggleGrid = () => {
  emit('update:showGrid', showGrid.value);
};

const fitToContent = () => {
  emit('fit-to-content');
};

const centerOnLatest = () => {
  emit('center-on-latest');
};

const exportView = () => {
  emit('export-view');
};

const onTimePositionChange = () => {
  // Calculate the time based on position
  const totalDuration = props.totalTimeEnd - props.totalTimeStart;
  const _targetTime = props.totalTimeStart + (totalDuration * timePosition.value / 100);
  // This would emit an event to update the visible time range center
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// Watchers to sync with parent props
watch(() => props.zoom, (newZoom) => {
  zoom.value = newZoom;
});

watch(() => props.timeRange, (newRange) => {
  selectedTimeRange.value = newRange;
});

watch(() => props.autoScroll, (newValue) => {
  autoScroll.value = newValue;
});

watch(() => props.followLatest, (newValue) => {
  followLatest.value = newValue;
});

watch(() => props.showGrid, (newValue) => {
  showGrid.value = newValue;
});

// Update time position when visible time changes
watch([() => props.visibleTimeStart, () => props.totalTimeStart, () => props.totalTimeEnd], 
  ([visibleStart, totalStart, totalEnd]) => {
    const totalDuration = totalEnd - totalStart;
    if (totalDuration > 0) {
      timePosition.value = ((visibleStart - totalStart) / totalDuration) * 100;
    }
  }
);
</script>

<style scoped>
/* Custom slider styles */
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.slider::-webkit-slider-track {
  height: 8px;
  border-radius: 4px;
  background: #4b5563;
}

.slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  appearance: none;
}

.slider::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #4b5563;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .timeline-controls {
    font-size: 14px;
  }
  
  .timeline-controls button {
    padding: 0.375rem 0.75rem;
  }
  
  .timeline-controls select {
    padding: 0.375rem 0.75rem;
  }
  
  .w-8 {
    width: 2.5rem;
    height: 2.5rem;
  }
}

/* Focus styles for accessibility */
.timeline-controls button:focus,
.timeline-controls select:focus,
.timeline-controls input:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
</style>