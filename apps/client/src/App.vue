<template>
  <div class="h-screen flex flex-col bg-gray-900">
    <!-- Header with Diablo Theme -->
    <header class="bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 shadow-2xl border-b-4 border-red-900/50 relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/20 via-transparent to-transparent"></div>
      <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]"></div>
      <div class="px-3 py-4 mobile:py-2 mobile:flex-col mobile:space-y-2 flex items-center justify-between relative z-10">
        <!-- Title Section -->
        <div class="mobile:w-full mobile:text-center">
          <h1 class="text-2xl mobile:text-lg font-bold text-amber-500 drop-shadow-[0_2px_8px_rgba(217,119,6,0.8)] tracking-wide font-serif border-b-2 border-amber-700/50 pb-1 inline-block">
            Claude Comms
          </h1>
        </div>
        
        <!-- Connection Status -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-1.5">
          <div v-if="isConnected" class="flex items-center space-x-1.5 bg-stone-900/60 px-3 py-1.5 rounded border border-amber-900/50">
            <span class="relative flex h-3 w-3">
              <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-600 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.9)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-amber-200 font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Connected</span>
          </div>
          <div v-else class="flex items-center space-x-1.5 bg-stone-900/60 px-3 py-1.5 rounded border border-red-900/50">
            <span class="relative flex h-3 w-3">
              <span class="relative inline-flex rounded-full h-3 w-3 bg-red-700 shadow-[0_0_8px_rgba(185,28,28,0.9)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-red-300 font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Disconnected</span>
          </div>
        </div>
        
        <!-- Event Count and Theme Toggle -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-2">
          <span class="text-base mobile:text-sm text-amber-200 font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-stone-900/80 px-3 py-1.5 rounded border-2 border-amber-900/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
            {{ events.length }} events
          </span>

          <!-- Filters Toggle Button -->
          <button
            v-if="activeTab === 'events' || activeTab === 'sessions'"
            @click="showFilters = !showFilters"
            class="p-3 mobile:p-1.5 rounded bg-stone-900/80 hover:bg-stone-800/90 transition-all duration-150 border-2 border-red-900/50 hover:border-red-800/70 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_12px_rgba(153,27,27,0.4)]"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <span class="text-2xl mobile:text-lg">📊</span>
          </button>

        </div>
      </div>
    </header>
    
    <!-- Tab Navigation -->
    <div class="bg-stone-950 border-b-2 border-red-900/40 shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
      <div class="flex space-x-1 px-4 py-2">
        <button
          @click="activeTab = 'events'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'events'
              ? 'bg-stone-900 text-amber-400 border-amber-800/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]'
              : 'bg-stone-900/60 text-stone-400 border-stone-800/40 hover:text-amber-300 hover:bg-stone-800/80 hover:border-amber-900/40'
          ]"
        >
          Event Timeline
        </button>
        <button
          @click="activeTab = 'subagents'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'subagents'
              ? 'bg-stone-900 text-amber-400 border-amber-800/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]'
              : 'bg-stone-900/60 text-stone-400 border-stone-800/40 hover:text-amber-300 hover:bg-stone-800/80 hover:border-amber-900/40'
          ]"
        >
          Agents
        </button>
        <button
          @click="activeTab = 'sessions'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'sessions'
              ? 'bg-stone-900 text-amber-400 border-amber-800/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]'
              : 'bg-stone-900/60 text-stone-400 border-stone-800/40 hover:text-amber-300 hover:bg-stone-800/80 hover:border-amber-900/40'
          ]"
          data-test="sessions-tab"
        >
          Sessions
        </button>
      </div>
    </div>
    
    <!-- Tab Content -->
    <template v-if="activeTab === 'events'">
      <!-- Filters -->
      <FilterPanel
        v-if="showFilters"
        :filters="filters"
        @update:filters="filters = $event"
      />
      
      <!-- Live Pulse Chart -->
      <LivePulseChart
        :events="events"
        :filters="filters"
      />
      
      <!-- Timeline -->
      <EventTimeline
        :events="events"
        :filters="filters"
        v-model:stick-to-bottom="stickToBottom"
      />
      
      <!-- Stick to bottom button -->
      <StickScrollButton
        :stick-to-bottom="stickToBottom"
        @toggle="stickToBottom = !stickToBottom"
      />
    </template>
    
    <template v-else-if="activeTab === 'subagents'">
      <SubagentComms :ws-connection="wsConnection" />
    </template>
    
    <template v-else-if="activeTab === 'sessions'">
      <!-- Sessions Filters (can be expanded later with specific session filters) -->
      <FilterPanel
        v-if="showFilters"
        :filters="filters"
        @update:filters="filters = $event"
        data-test="filter-panel"
      />
      
      <SessionsView 
        :ws-connection="wsConnection" 
        :filters="filters" 
        data-test="sessions-view"
      />
    </template>
    
    <!-- Error message -->
    <div
      v-if="error"
      class="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded mobile:text-xs"
    >
      {{ error }}
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWebSocketWithPriority } from './composables/useWebSocketWithPriority';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import StickScrollButton from './components/StickScrollButton.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import SubagentComms from './components/SubagentComms.vue';
import SessionsView from './components/SessionsView.vue';

// WebSocket connection
const { allEvents: events, isConnected, error, ws: wsConnection } = useWebSocketWithPriority('ws://localhost:4000/stream');

// Tab state
const activeTab = ref('events');

// Filters
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: ''
});

// UI state
const stickToBottom = ref(true);
const showFilters = ref(false);


</script>