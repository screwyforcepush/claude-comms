<template>
  <div class="h-screen flex flex-col bg-gray-900">
    <!-- Header with Cyberpunk Theme -->
    <header class="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 shadow-lg border-b-2 border-cyan-500 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse"></div>
      <div class="px-3 py-4 mobile:py-2 mobile:flex-col mobile:space-y-2 flex items-center justify-between relative z-10">
        <!-- Title Section -->
        <div class="mobile:w-full mobile:text-center">
          <h1 class="text-2xl mobile:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse tracking-wider">
            Claude Comms
          </h1>
        </div>
        
        <!-- Connection Status -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-1.5">
          <div v-if="isConnected" class="flex items-center space-x-1.5">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-cyan-300 font-semibold drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">Connected</span>
          </div>
          <div v-else class="flex items-center space-x-1.5">
            <span class="relative flex h-3 w-3">
              <span class="relative inline-flex rounded-full h-3 w-3 bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]"></span>
            </span>
            <span class="text-base mobile:text-sm text-pink-300 font-semibold drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">Disconnected</span>
          </div>
        </div>
        
        <!-- Event Count and Theme Toggle -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-2">
          <span class="text-base mobile:text-sm text-cyan-300 font-semibold drop-shadow-[0_0_5px_rgba(34,211,238,0.5)] bg-black/60 px-3 py-1.5 rounded-full border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
            {{ events.length }} events
          </span>

          <!-- Filters Toggle Button -->
          <button
            v-if="activeTab === 'events' || activeTab === 'sessions'"
            @click="showFilters = !showFilters"
            class="p-3 mobile:p-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 transition-all duration-200 border border-purple-500/50 hover:border-purple-400/80 backdrop-blur-sm shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <span class="text-2xl mobile:text-lg">📊</span>
          </button>

        </div>
      </div>
    </header>
    
    <!-- Tab Navigation -->
    <div class="bg-black/80 border-b border-purple-500/30 shadow-[0_4px_10px_rgba(168,85,247,0.2)]">
      <div class="flex space-x-1 px-4 py-2">
        <button
          @click="activeTab = 'events'"
          :class="[
            'px-4 py-2 rounded-t-lg font-semibold transition-all',
            activeTab === 'events'
              ? 'bg-gray-900 text-cyan-400 border-t-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
              : 'bg-gray-800/60 text-gray-400 hover:text-cyan-300 hover:bg-gray-700/80 hover:shadow-[0_0_5px_rgba(34,211,238,0.3)]'
          ]"
        >
          Event Timeline
        </button>
        <button
          @click="activeTab = 'subagents'"
          :class="[
            'px-4 py-2 rounded-t-lg font-semibold transition-all',
            activeTab === 'subagents'
              ? 'bg-gray-900 text-cyan-400 border-t-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
              : 'bg-gray-800/60 text-gray-400 hover:text-cyan-300 hover:bg-gray-700/80 hover:shadow-[0_0_5px_rgba(34,211,238,0.3)]'
          ]"
        >
          Agents
        </button>
        <button
          @click="activeTab = 'sessions'"
          :class="[
            'px-4 py-2 rounded-t-lg font-semibold transition-all',
            activeTab === 'sessions'
              ? 'bg-gray-900 text-cyan-400 border-t-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
              : 'bg-gray-800/60 text-gray-400 hover:text-cyan-300 hover:bg-gray-700/80 hover:shadow-[0_0_5px_rgba(34,211,238,0.3)]'
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