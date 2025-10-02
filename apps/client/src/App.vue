<template>
  <div class="diablo-theme relative h-screen min-h-screen flex flex-col bg-diablo-900 bg-diablo-texture text-diablo-parchment">
    <div class="pointer-events-none absolute inset-0 z-0 bg-diablo-vignette opacity-70 mix-blend-overlay"></div>
    <!-- Header with Diablo Theme -->
    <header class="relative z-10 overflow-hidden shadow-2xl border-b-4 border-diablo-blood/60 diablo-header">
      <div class="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIGZpbGw9IiMyMTExMDgiLz48cGF0aCBkPSIwIDMyTDMydi0zMkwzMiAzMloiIGZpbGw9IiM3ZjEwMTRCIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSI3MiA0MEw0MCA3MmwtNDAtNDBMNDBsMzJaIiBmaWxsPSIjYmAxYzIxIiBvcGFjaXR5PSIwLjA4Ii8+PC9zdmc+')]"></div>
      <div class="px-4 py-5 mobile:py-3 mobile:flex-col mobile:space-y-3 flex items-center justify-between relative z-10">
        <!-- Title Section -->
        <div class="mobile:w-full mobile:text-center">
          <h1 class="text-3xl mobile:text-xl font-diablo font-semibold text-diablo-gold drop-shadow-[0_2px_10px_rgba(214,168,96,0.65)] tracking-[0.18em] uppercase border-b border-diablo-brass/60 pb-1 inline-block">
            Claude Comms
          </h1>
        </div>
        
        <!-- Connection Status -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-1.5">
          <div v-if="isConnected" class="flex items-center space-x-1.5 bg-diablo-850/80 px-3 py-1.5 rounded border border-diablo-brass/60 shadow-[0_0_12px_rgba(176,30,33,0.35)]">
            <span class="relative flex h-3 w-3">
              <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-600 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_10px_rgba(214,168,96,0.9)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-diablo-parchment font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Connected</span>
          </div>
          <div v-else class="flex items-center space-x-1.5 bg-diablo-850/80 px-3 py-1.5 rounded border border-diablo-blood/60 shadow-[0_0_12px_rgba(127,16,20,0.4)]">
            <span class="relative flex h-3 w-3">
              <span class="relative inline-flex rounded-full h-3 w-3 bg-diablo-blood shadow-[0_0_8px_rgba(127,16,20,0.9)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-red-300 font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Disconnected</span>
          </div>
        </div>

        <!-- Event Count and Theme Toggle -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-2">
          <span class="text-base mobile:text-sm text-diablo-parchment font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] bg-diablo-850/80 px-3 py-1.5 rounded border-2 border-diablo-brass/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.75)]">
            {{ events.length }} events
          </span>

          <!-- Filters Toggle Button -->
          <button
            v-if="activeTab === 'events' || activeTab === 'sessions'"
            @click="showFilters = !showFilters"
            class="p-3 mobile:p-1.5 rounded bg-diablo-850/80 hover:bg-diablo-800/90 transition-all duration-150 border-2 border-diablo-blood/60 hover:border-diablo-brass/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.75)] hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.9),0_0_16px_rgba(214,168,96,0.4)]"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <span class="text-2xl mobile:text-lg drop-shadow-[0_2px_6px_rgba(214,168,96,0.6)]">📊</span>
          </button>

        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <div class="relative bg-diablo-900/95 border-b-2 border-diablo-blood/50 shadow-[0_4px_18px_rgba(0,0,0,0.65)]">
      <div class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-diablo-brass/60 to-transparent"></div>
      <div class="flex space-x-1 px-4 py-2">
        <button
          @click="activeTab = 'events'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'events'
              ? 'bg-diablo-850 text-diablo-gold border-diablo-brass/70 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),0_0_14px_rgba(214,168,96,0.25)]'
              : 'bg-diablo-900/75 text-diablo-parchment/60 border-diablo-800/50 hover:text-diablo-gold hover:bg-diablo-850/80 hover:border-diablo-brass/50'
          ]"
        >
          Event Timeline
        </button>
        <button
          @click="activeTab = 'subagents'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'subagents'
              ? 'bg-diablo-850 text-diablo-gold border-diablo-brass/70 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),0_0_14px_rgba(214,168,96,0.25)]'
              : 'bg-diablo-900/75 text-diablo-parchment/60 border-diablo-800/50 hover:text-diablo-gold hover:bg-diablo-850/80 hover:border-diablo-brass/50'
          ]"
        >
          Agents
        </button>
        <button
          @click="activeTab = 'sessions'"
          :class="[
            'px-4 py-2 rounded-t font-semibold transition-all border-t-2 border-x-2',
            activeTab === 'sessions'
              ? 'bg-diablo-850 text-diablo-gold border-diablo-brass/70 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),0_0_14px_rgba(214,168,96,0.25)]'
              : 'bg-diablo-900/75 text-diablo-parchment/60 border-diablo-800/50 hover:text-diablo-gold hover:bg-diablo-850/80 hover:border-diablo-brass/50'
          ]"
          data-test="sessions-tab"
        >
          Sessions
        </button>
      </div>
    </div>
    
    <!-- Tab Content -->
    <template v-if="activeTab === 'events'">
      <div class="flex-1 flex flex-col min-h-0 relative z-10">
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
          class="flex-1 min-h-0"
          :events="events"
          :filters="filters"
          v-model:stick-to-bottom="stickToBottom"
        />
      </div>
      
      <!-- Stick to bottom button -->
      <StickScrollButton
        :stick-to-bottom="stickToBottom"
        @toggle="stickToBottom = !stickToBottom"
      />
    </template>
    
    <template v-else-if="activeTab === 'subagents'">
      <div class="flex-1 min-h-0 relative z-10">
        <SubagentComms class="h-full" :ws-connection="wsConnection" />
      </div>
    </template>
    
    <template v-else-if="activeTab === 'sessions'">
      <div class="flex-1 flex flex-col min-h-0 relative z-10">
        <!-- Sessions Filters (can be expanded later with specific session filters) -->
        <FilterPanel
          v-if="showFilters"
          :filters="filters"
          @update:filters="filters = $event"
          data-test="filter-panel"
        />
        
        <SessionsView 
          class="flex-1 min-h-0"
          :ws-connection="wsConnection" 
          :filters="filters" 
          data-test="sessions-view"
        />
      </div>
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
