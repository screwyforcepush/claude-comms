<template>
  <div class="bg-gradient-to-r from-gray-800 to-gray-700 border-b-2 border-blue-500 px-3 py-4 mobile:py-2 shadow-lg">
    <div class="flex flex-wrap gap-3 items-center mobile:flex-col mobile:items-stretch">
      
      <!-- Session ID Search -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-blue-400 mb-1.5 drop-shadow-sm">
          Session Search
        </label>
        <input
          type="text"
          data-testid="session-id-search"
          v-model="localFilters.sessionIdSearch"
          @input="updateFilters"
          placeholder="Search sessions by ID or name..."
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
        />
      </div>
      
      <!-- Status Filter -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-blue-400 mb-1.5 drop-shadow-sm">
          Status
        </label>
        <div class="flex gap-3 items-center bg-gray-800 px-4 py-2 mobile:px-2 mobile:py-1.5 border border-blue-500 rounded-lg">
          <label v-for="status in statusOptions" :key="status" class="flex items-center cursor-pointer text-white hover:text-blue-300 transition-colors">
            <input
              type="checkbox"
              :value="status"
              v-model="localFilters.status"
              @change="updateFilters"
              class="mr-2 rounded border-gray-600 text-blue-600 focus:ring-blue-500/30"
            />
            <span class="text-sm capitalize">{{ status }}</span>
          </label>
        </div>
      </div>
      
      <!-- Time Range -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-blue-400 mb-1.5 drop-shadow-sm">
          Time Range
        </label>
        <div class="flex gap-2 items-center">
          <input
            type="datetime-local"
            data-testid="time-range-start"
            :value="formatDateTimeLocal(localFilters.timeRange.start)"
            @input="handleTimeRangeChange('start', $event)"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
          <span class="text-gray-400 text-sm">to</span>
          <input
            type="datetime-local"
            data-testid="time-range-end"
            :value="formatDateTimeLocal(localFilters.timeRange.end)"
            @input="handleTimeRangeChange('end', $event)"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
        </div>
      </div>
      
      <!-- Agent Count Range -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-blue-400 mb-1.5 drop-shadow-sm">
          Agent Count
        </label>
        <div class="flex gap-2 items-center">
          <input
            type="number"
            data-testid="agent-count-min"
            v-model.number="localFilters.agentCountRange.min"
            @input="updateFilters"
            min="0"
            max="100"
            placeholder="Min agents"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
          <span class="text-gray-400 text-sm">-</span>
          <input
            type="number"
            data-testid="agent-count-max"
            v-model.number="localFilters.agentCountRange.max"
            @input="updateFilters"
            min="1"
            max="100"
            placeholder="Max agents"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
        </div>
      </div>
      
      <!-- Session Duration Range -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-blue-400 mb-1.5 drop-shadow-sm">
          Duration (minutes)
        </label>
        <div class="flex gap-2 items-center">
          <input
            type="number"
            data-testid="duration-min"
            :value="localFilters.sessionDuration.min / 60000"
            @input="handleDurationChange('min', $event)"
            min="0"
            max="1440"
            placeholder="Min duration"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
          <span class="text-gray-400 text-sm">-</span>
          <input
            type="number"
            data-testid="duration-max"
            :value="localFilters.sessionDuration.max / 60000"
            @input="handleDurationChange('max', $event)"
            min="1"
            max="1440"
            placeholder="Max duration"
            class="flex-1 px-2 py-1.5 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500/30 focus:border-blue-700 bg-gray-800 text-white"
          />
        </div>
      </div>
      
      <!-- Clear Filters Button -->
      <button
        v-if="hasActiveFilters"
        data-testid="clear-filters"
        @click="clearFilters"
        class="px-4 py-2 mobile:px-2 mobile:py-1.5 mobile:w-full text-base mobile:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors min-w-max"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SessionFilterState {
  sessionIdSearch: string;
  status: string[];
  timeRange: {
    start: number;
    end: number;
  };
  agentCountRange: {
    min: number;
    max: number;
  };
  sessionDuration: {
    min: number; // in milliseconds
    max: number; // in milliseconds
  };
}

// ============================================================================
// Component Props & Emits
// ============================================================================

const props = defineProps<{
  filters: SessionFilterState;
}>();

const emit = defineEmits<{
  'update:filters': [filters: SessionFilterState];
}>();

// ============================================================================
// Reactive State
// ============================================================================

const localFilters = ref<SessionFilterState>({ ...props.filters });

const statusOptions = ['active', 'completed', 'failed'];

// ============================================================================
// Computed Properties
// ============================================================================

const hasActiveFilters = computed(() => {
  const f = localFilters.value;
  return (
    f.sessionIdSearch.trim() !== '' ||
    f.status.length > 0 ||
    f.timeRange.start > 0 ||
    f.timeRange.end > 0 ||
    f.agentCountRange.min > 0 ||
    f.agentCountRange.max < 100 ||
    f.sessionDuration.min > 0 ||
    f.sessionDuration.max < 86400000 // 24 hours
  );
});

// ============================================================================
// Methods
// ============================================================================

const updateFilters = () => {
  emit('update:filters', { ...localFilters.value });
};

const clearFilters = () => {
  localFilters.value = {
    sessionIdSearch: '',
    status: [],
    timeRange: { start: 0, end: 0 },
    agentCountRange: { min: 0, max: 100 },
    sessionDuration: { min: 0, max: 86400000 } // 24 hours in ms
  };
  updateFilters();
};

const formatDateTimeLocal = (timestamp: number): string => {
  if (!timestamp || timestamp === 0) return '';
  return new Date(timestamp).toISOString().slice(0, 16);
};

const handleTimeRangeChange = (field: 'start' | 'end', event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  if (value) {
    const timestamp = new Date(value).getTime();
    localFilters.value.timeRange[field] = timestamp;
    updateFilters();
  }
};

const handleDurationChange = (field: 'min' | 'max', event: Event) => {
  const target = event.target as HTMLInputElement;
  const minutes = parseInt(target.value) || 0;
  const milliseconds = minutes * 60000;
  
  localFilters.value.sessionDuration[field] = milliseconds;
  updateFilters();
};

// ============================================================================
// Watchers
// ============================================================================

// Sync local filters with props changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });
</script>

<style scoped>
/* Ensure consistent styling with existing FilterPanel */
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .mobile\:flex-col {
    flex-direction: column;
  }
  
  .mobile\:items-stretch {
    align-items: stretch;
  }
  
  .mobile\:w-full {
    width: 100%;
  }
  
  .mobile\:px-2 {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  
  .mobile\:py-1\.5 {
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
  }
  
  .mobile\:text-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
}
</style>