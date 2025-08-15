import { ref, computed } from 'vue';
import { useWebSocket } from './useWebSocket';
import { usePriorityWebSocket } from './usePriorityWebSocket';
import type { PriorityBucketConfig } from '../types';

/**
 * Backward-compatible WebSocket composable that automatically detects
 * and uses priority protocol when supported by the server
 */
export function useWebSocketWithPriority(url: string, config?: Partial<PriorityBucketConfig>) {
  const priorityEnabled = ref(false);
  
  // Feature detection environment variable
  const forcePriorityMode = import.meta.env.VITE_FORCE_PRIORITY_WEBSOCKET === 'true';
  const disablePriorityMode = import.meta.env.VITE_DISABLE_PRIORITY_WEBSOCKET === 'true';
  
  // Determine which composable to use
  if (disablePriorityMode) {
    console.log('Priority WebSocket disabled by environment variable');
    const legacy = useWebSocket(url);
    
    return {
      ...legacy,
      // Add priority-compatible interface
      priorityEvents: computed(() => legacy.events.value.filter(e => (e as any).priority > 0)),
      regularEvents: computed(() => legacy.events.value.filter(e => !(e as any).priority > 0)),
      allEvents: legacy.events,
      eventStats: computed(() => ({
        total: legacy.events.value.length,
        priority: legacy.events.value.filter(e => (e as any).priority > 0).length,
        regular: legacy.events.value.filter(e => !(e as any).priority > 0).length,
        priorityPercentage: 0,
        serverSupportsPriority: false,
        protocolVersion: null
      })),
      serverSupportsPriority: computed(() => false),
      protocolVersion: computed(() => null),
      clearBuckets: () => { legacy.events.value = []; },
      getPriorityEvents: () => legacy.events.value.filter(e => (e as any).priority > 0),
      getRegularEvents: () => legacy.events.value.filter(e => !(e as any).priority > 0),
      isPriorityEvent: (event: any) => (event.priority || 0) > 0,
      optimizeMemoryUsage: () => {},
      bucketConfig: {
        maxPriorityEvents: 200,
        maxRegularEvents: 100,
        totalDisplayLimit: 250,
        priorityOverflowStrategy: 'remove_oldest_regular' as const,
        enablePriorityIndicators: true
      }
    };
  }
  
  if (forcePriorityMode) {
    console.log('Priority WebSocket forced by environment variable');
    return usePriorityWebSocket(url, config);
  }
  
  // Default: Use priority WebSocket with fallback
  try {
    return usePriorityWebSocket(url, config);
  } catch (error) {
    console.warn('Priority WebSocket not available, falling back to standard WebSocket:', error);
    const legacy = useWebSocket(url);
    
    return {
      ...legacy,
      // Add priority-compatible interface with empty implementations
      priorityEvents: computed(() => []),
      regularEvents: computed(() => legacy.events.value),
      allEvents: legacy.events,
      eventStats: computed(() => ({
        total: legacy.events.value.length,
        priority: 0,
        regular: legacy.events.value.length,
        priorityPercentage: 0,
        serverSupportsPriority: false,
        protocolVersion: null
      })),
      serverSupportsPriority: computed(() => false),
      protocolVersion: computed(() => null),
      clearBuckets: () => { legacy.events.value = []; },
      getPriorityEvents: () => [],
      getRegularEvents: () => legacy.events.value,
      isPriorityEvent: () => false,
      optimizeMemoryUsage: () => {},
      bucketConfig: {
        maxPriorityEvents: 200,
        maxRegularEvents: 100,
        totalDisplayLimit: 250,
        priorityOverflowStrategy: 'remove_oldest_regular' as const,
        enablePriorityIndicators: false
      }
    };
  }
}

/**
 * Factory function for creating WebSocket composables with auto-detection
 */
export function createWebSocketComposable(url: string, config?: any) {
  return useWebSocketWithPriority(url, config);
}