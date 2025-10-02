<template>
  <div class="bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 border-b-2 border-red-900/40 px-3 py-4 mobile:py-2 shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
    <div class="flex flex-wrap gap-3 items-center mobile:flex-col mobile:items-stretch">
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-amber-400 mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Source App
        </label>
        <select
          v-model="localFilters.sourceApp"
          @change="updateFilters"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border-2 border-amber-900/50 rounded focus:ring-2 focus:ring-amber-700/50 focus:border-amber-700 bg-stone-950 text-amber-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] hover:border-amber-800 transition-all duration-150"
        >
          <option value="">All Sources</option>
          <option v-for="app in filterOptions.source_apps" :key="app" :value="app">
            {{ app }}
          </option>
        </select>
      </div>

      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-amber-400 mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Session ID
        </label>
        <select
          v-model="localFilters.sessionId"
          @change="updateFilters"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border-2 border-amber-900/50 rounded focus:ring-2 focus:ring-amber-700/50 focus:border-amber-700 bg-stone-950 text-amber-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] hover:border-amber-800 transition-all duration-150"
        >
          <option value="">All Sessions</option>
          <option v-for="session in filterOptions.session_ids" :key="session" :value="session">
            {{ session.slice(0, 8) }}...
          </option>
        </select>
      </div>

      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-amber-400 mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Event Type
        </label>
        <select
          v-model="localFilters.eventType"
          @change="updateFilters"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border-2 border-amber-900/50 rounded focus:ring-2 focus:ring-amber-700/50 focus:border-amber-700 bg-stone-950 text-amber-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] hover:border-amber-800 transition-all duration-150"
        >
          <option value="">All Types</option>
          <option v-for="type in filterOptions.hook_event_types" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="px-4 py-2 mobile:px-2 mobile:py-1.5 mobile:w-full text-base mobile:text-sm font-medium text-amber-200 bg-stone-900/80 hover:bg-stone-800 rounded border-2 border-red-900/50 hover:border-red-800/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] transition-all duration-150"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FilterOptions } from '../types';

const props = defineProps<{
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
}>();

const emit = defineEmits<{
  'update:filters': [filters: typeof props.filters];
}>();

const filterOptions = ref<FilterOptions>({
  source_apps: [],
  session_ids: [],
  hook_event_types: []
});

const localFilters = ref({ ...props.filters });

const hasActiveFilters = computed(() => {
  return localFilters.value.sourceApp || localFilters.value.sessionId || localFilters.value.eventType;
});

const updateFilters = () => {
  emit('update:filters', { ...localFilters.value });
};

const clearFilters = () => {
  localFilters.value = {
    sourceApp: '',
    sessionId: '',
    eventType: ''
  };
  updateFilters();
};

const fetchFilterOptions = async () => {
  try {
    const response = await fetch('http://localhost:4000/events/filter-options');
    if (response.ok) {
      filterOptions.value = await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch filter options:', error);
  }
};

onMounted(() => {
  fetchFilterOptions();
  // Refresh filter options periodically
  setInterval(fetchFilterOptions, 10000);
});
</script>