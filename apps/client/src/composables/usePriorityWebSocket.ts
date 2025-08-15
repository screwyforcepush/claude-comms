import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { HookEvent, PriorityWebSocketMessage, PriorityBucketConfig } from '../types';

/**
 * Priority-aware WebSocket composable with dual-bucket management
 * Maintains backward compatibility while providing enhanced priority event handling
 */
export function usePriorityWebSocket(url: string, config?: Partial<PriorityBucketConfig>) {
  const priorityEvents = ref<HookEvent[]>([]);
  const regularEvents = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const protocolVersion = ref<string | null>(null);
  const serverSupportsPriority = ref(false);
  
  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  
  // Configuration with defaults
  const bucketConfig: PriorityBucketConfig = {
    maxPriorityEvents: parseInt(import.meta.env.VITE_MAX_PRIORITY_EVENTS || '200'),
    maxRegularEvents: parseInt(import.meta.env.VITE_MAX_REGULAR_EVENTS || '100'),
    totalDisplayLimit: parseInt(import.meta.env.VITE_TOTAL_EVENT_DISPLAY_LIMIT || '250'),
    priorityOverflowStrategy: 'remove_oldest_regular',
    enablePriorityIndicators: true,
    ...config
  };
  
  // Combined events for display (computed)
  const allEvents = computed(() => {
    const combined = [...priorityEvents.value, ...regularEvents.value]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply total display limit with intelligent limiting
    if (combined.length > bucketConfig.totalDisplayLimit) {
      return intelligentDisplayLimiting(combined, bucketConfig);
    }
    
    return combined;
  });
  
  // Priority statistics
  const eventStats = computed(() => ({
    total: allEvents.value.length,
    priority: priorityEvents.value.length,
    regular: regularEvents.value.length,
    priorityPercentage: allEvents.value.length > 0 
      ? (priorityEvents.value.length / allEvents.value.length) * 100 
      : 0,
    serverSupportsPriority: serverSupportsPriority.value,
    protocolVersion: protocolVersion.value
  }));
  
  function intelligentDisplayLimiting(events: HookEvent[], config: PriorityBucketConfig): HookEvent[] {
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    switch (config.priorityOverflowStrategy) {
      case 'remove_oldest_regular':
        // Always preserve priority events, remove oldest regular
        const maxRegularInDisplay = Math.max(0, config.totalDisplayLimit - priorityEvts.length);
        return [
          ...priorityEvts,
          ...regularEvts.slice(-maxRegularInDisplay)
        ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
      case 'remove_oldest_priority':
        // Remove oldest priority events if needed
        return events.slice(-config.totalDisplayLimit);
        
      case 'strict_limits':
        // Respect individual bucket limits strictly
        const limitedPriority = priorityEvts.slice(-config.maxPriorityEvents);
        const limitedRegular = regularEvts.slice(-config.maxRegularEvents);
        return [...limitedPriority, ...limitedRegular]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-config.totalDisplayLimit);
          
      default:
        return events.slice(-config.totalDisplayLimit);
    }
  }
  
  function addToPriorityBucket(event: HookEvent) {
    priorityEvents.value.push(event);
    
    if (priorityEvents.value.length > bucketConfig.maxPriorityEvents) {
      // Remove oldest priority events when limit exceeded
      const overflow = priorityEvents.value.length - bucketConfig.maxPriorityEvents;
      priorityEvents.value = priorityEvents.value.slice(overflow);
    }
  }
  
  function addToRegularBucket(event: HookEvent) {
    regularEvents.value.push(event);
    
    if (regularEvents.value.length > bucketConfig.maxRegularEvents) {
      // More aggressive cleanup for regular events
      const keepCount = Math.max(
        bucketConfig.maxRegularEvents - 20, // Remove batch of 20
        bucketConfig.maxRegularEvents * 0.8  // Keep 80%
      );
      regularEvents.value = regularEvents.value.slice(-keepCount);
    }
  }
  
  function handleNewEvent(event: HookEvent) {
    const priority = event.priority || 0;
    
    if (priority > 0) {
      addToPriorityBucket(event);
    } else {
      addToRegularBucket(event);
    }
  }
  
  function handleInitialEvents(events: HookEvent[]) {
    // Separate initial events by priority
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    // Load into respective buckets with limits
    priorityEvents.value = priorityEvts.slice(-bucketConfig.maxPriorityEvents);
    regularEvents.value = regularEvts.slice(-bucketConfig.maxRegularEvents);
  }
  
  const connect = () => {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('Priority WebSocket connected');
        isConnected.value = true;
        error.value = null;
      };
      
      ws.onmessage = (event) => {
        try {
          const message: PriorityWebSocketMessage = JSON.parse(event.data);
          
          // Check if server supports priority protocol
          if (message.priority_info?.protocol_version) {
            serverSupportsPriority.value = true;
            protocolVersion.value = message.priority_info.protocol_version;
          }
          
          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            handleInitialEvents(initialEvents);
            
            // Log priority statistics
            if (message.priority_info) {
              console.log('Priority bucket stats:', message.priority_info);
            }
          } else if (message.type === 'event' || message.type === 'priority_event') {
            const newEvent = message.data as HookEvent;
            handleNewEvent(newEvent);
          } else if (message.type === 'session_event' || message.type === 'priority_session_event') {
            // Handle multi-session events
            const newEvent = message.data as HookEvent;
            handleNewEvent(newEvent);
          }
        } catch (err) {
          console.error('Failed to parse priority WebSocket message:', err);
          // Try to parse as legacy WebSocket message
          try {
            const legacyMessage = JSON.parse(event.data);
            if (legacyMessage.type === 'initial') {
              const initialEvents = Array.isArray(legacyMessage.data) ? legacyMessage.data : [];
              handleInitialEvents(initialEvents);
            } else if (legacyMessage.type === 'event') {
              const newEvent = legacyMessage.data as HookEvent;
              handleNewEvent(newEvent);
            }
          } catch (legacyErr) {
            console.error('Failed to parse as legacy WebSocket message:', legacyErr);
          }
        }
      };
      
      ws.onerror = (err) => {
        console.error('Priority WebSocket error:', err);
        error.value = 'WebSocket connection error';
      };
      
      ws.onclose = () => {
        console.log('Priority WebSocket disconnected');
        isConnected.value = false;
        serverSupportsPriority.value = false;
        protocolVersion.value = null;
        
        // Attempt to reconnect
        reconnectTimeout = window.setTimeout(() => {
          console.log('Attempting to reconnect priority WebSocket...');
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect priority WebSocket:', err);
      error.value = 'Failed to connect to server';
    }
  };
  
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
  };
  
  // Bucket management utilities
  const clearBuckets = () => {
    priorityEvents.value = [];
    regularEvents.value = [];
  };
  
  const getPriorityEvents = () => priorityEvents.value.slice();
  const getRegularEvents = () => regularEvents.value.slice();
  
  const isPriorityEvent = (event: HookEvent) => (event.priority || 0) > 0;
  
  // Memory management
  const optimizeMemoryUsage = () => {
    const now = Date.now();
    const priorityRetention = 24 * 60 * 60 * 1000; // 24 hours
    const regularRetention = 4 * 60 * 60 * 1000;   // 4 hours
    
    // Remove old events based on retention policy
    priorityEvents.value = priorityEvents.value.filter(
      e => now - (e.timestamp || 0) < priorityRetention
    );
    
    regularEvents.value = regularEvents.value.filter(
      e => now - (e.timestamp || 0) < regularRetention
    );
  };
  
  // Periodic memory optimization
  let memoryOptimizationInterval: number;
  
  onMounted(() => {
    connect();
    
    // Setup memory optimization interval (every 5 minutes)
    memoryOptimizationInterval = window.setInterval(optimizeMemoryUsage, 5 * 60 * 1000);
  });
  
  onUnmounted(() => {
    disconnect();
    
    if (memoryOptimizationInterval) {
      clearInterval(memoryOptimizationInterval);
    }
  });
  
  return {
    // Event arrays
    allEvents,
    priorityEvents: computed(() => priorityEvents.value),
    regularEvents: computed(() => regularEvents.value),
    
    // Statistics
    eventStats,
    
    // Connection state
    isConnected,
    error,
    serverSupportsPriority,
    protocolVersion,
    
    // Utilities
    clearBuckets,
    getPriorityEvents,
    getRegularEvents,
    isPriorityEvent,
    optimizeMemoryUsage,
    
    // Configuration
    bucketConfig: bucketConfig
  };
}