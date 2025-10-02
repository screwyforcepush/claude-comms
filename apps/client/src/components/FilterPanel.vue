<template>
  <div class="diablo-panel border-b-2 border-diablo-blood/40 px-3 py-4 mobile:py-2 shadow-[0_6px_18px_rgba(0,0,0,0.6)]">
    <div class="flex flex-wrap gap-3 items-center mobile:flex-col mobile:items-stretch">
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-semibold text-diablo-gold mb-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] tracking-wide uppercase">
          Source App
        </label>
        <select
          v-model="localFilters.sourceApp"
          @change="updateFilters"
          class="diablo-field w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm rounded focus:ring-2 focus:ring-[rgba(214,168,96,0.25)] focus:border-[rgba(214,168,96,0.6)] transition-all duration-150"
        >
          <option value="">All Sources</option>
          <option v-for="app in filterOptions.source_apps" :key="app" :value="app">
            {{ app }}
          </option>
        </select>
      </div>

      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-semibold text-diablo-gold mb-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] tracking-wide uppercase">
          Session ID
        </label>
        <select
          v-model="localFilters.sessionId"
          @change="updateFilters"
          class="diablo-field w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm rounded focus:ring-2 focus:ring-[rgba(214,168,96,0.25)] focus:border-[rgba(214,168,96,0.6)] transition-all duration-150"
        >
          <option value="">All Sessions</option>
          <option v-for="session in filterOptions.session_ids" :key="session" :value="session">
            {{ session.slice(0, 8) }}...
          </option>
        </select>
      </div>

      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-semibold text-diablo-gold mb-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] tracking-wide uppercase">
          Event Type
        </label>
        <select
          v-model="localFilters.eventType"
          @change="updateFilters"
          class="diablo-field w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm rounded focus:ring-2 focus:ring-[rgba(214,168,96,0.25)] focus:border-[rgba(214,168,96,0.6)] transition-all duration-150"
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
        class="px-4 py-2 mobile:px-2 mobile:py-1.5 mobile:w-full text-base mobile:text-sm font-semibold tracking-wide uppercase text-diablo-parchment bg-diablo-850/80 hover:bg-diablo-800 rounded border-2 border-diablo-blood/60 hover:border-diablo-brass/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)] transition-all duration-150"
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
