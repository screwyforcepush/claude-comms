import { ref, computed } from 'vue';
import type { HookEvent } from '../types';

export interface EnhancedEvent extends HookEvent {
  position: 'latest' | 'recent' | 'older' | 'oldest' | 'neutral';
  eventIndex: number;
}

export interface OrderingContext {
  order: 'newest-first' | 'oldest-first';
  timeRange: string;
}

export function useTimelineOrdering() {
  const orderMode = ref<'newest-first' | 'oldest-first'>('newest-first');
  
  /**
   * Apply temporal positioning and ordering context to events
   */
  const applyOrderingContext = (events: HookEvent[]): EnhancedEvent[] => {
    if (!events.length) return [];
    
    // Sort events based on current order mode
    const sortedEvents = [...events].sort((a, b) => {
      return orderMode.value === 'newest-first' 
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    });
    
    return sortedEvents.map((event, index) => {
      const position = calculateEventPosition(index, sortedEvents.length);
      
      return {
        ...event,
        position,
        eventIndex: index
      };
    });
  };
  
  /**
   * Calculate temporal position based on index and total count
   */
  const calculateEventPosition = (
    index: number, 
    totalCount: number
  ): 'latest' | 'recent' | 'older' | 'oldest' | 'neutral' => {
    if (totalCount === 1) return 'neutral';
    
    if (orderMode.value === 'newest-first') {
      // For newest-first: index 0 = latest, last index = oldest
      if (index === 0) return 'latest';
      if (index === totalCount - 1) return 'oldest';
      if (index < totalCount * 0.2) return 'recent';
      return 'older';
    } else {
      // For oldest-first: index 0 = oldest, last index = latest
      if (index === 0) return 'oldest';
      if (index === totalCount - 1) return 'latest';
      if (index > totalCount * 0.8) return 'recent';
      return 'older';
    }
  };
  
  /**
   * Generate time range description for current events
   */
  const generateTimeRange = (events: HookEvent[]): string => {
    if (!events.length) return 'No events';
    
    const timestamps = events.map(e => e.timestamp).sort((a, b) => a - b);
    const oldest = timestamps[0];
    const newest = timestamps[timestamps.length - 1];
    
    const diff = newest - oldest;
    const diffMinutes = Math.floor(diff / 60000);
    const diffHours = Math.floor(diff / 3600000);
    const diffDays = Math.floor(diff / 86400000);
    
    if (diffDays > 0) return `${diffDays}d span`;
    if (diffHours > 0) return `${diffHours}h span`;
    if (diffMinutes > 0) return `${diffMinutes}m span`;
    return 'Real-time';
  };
  
  /**
   * Toggle between ordering modes
   */
  const toggleOrder = () => {
    orderMode.value = orderMode.value === 'newest-first' ? 'oldest-first' : 'newest-first';
  };
  
  /**
   * Set specific order mode
   */
  const setOrderMode = (mode: 'newest-first' | 'oldest-first') => {
    orderMode.value = mode;
  };
  
  /**
   * Computed properties for easier access
   */
  const isNewestFirst = computed(() => orderMode.value === 'newest-first');
  const isOldestFirst = computed(() => orderMode.value === 'oldest-first');
  
  /**
   * Get scroll direction based on order mode
   */
  const scrollDirection = computed(() => 
    orderMode.value === 'newest-first' ? 'top' : 'bottom'
  );
  
  /**
   * Get animation direction for event transitions
   */
  const getAnimationDirection = (entering: boolean): string => {
    const baseDirection = orderMode.value === 'newest-first' ? -20 : 20;
    
    if (entering) {
      // Enter from opposite direction
      return `translateY(${-baseDirection}px)`;
    } else {
      // Leave in order direction
      return `translateY(${baseDirection}px)`;
    }
  };
  
  return {
    // State
    orderMode,
    
    // Computed
    isNewestFirst,
    isOldestFirst,
    scrollDirection,
    
    // Methods
    applyOrderingContext,
    calculateEventPosition,
    generateTimeRange,
    toggleOrder,
    setOrderMode,
    getAnimationDirection
  };
}

/**
 * Utility functions for timeline calculations
 */
export const timelineUtils = {
  /**
   * Get relative time string for display
   */
  getRelativeTime: (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 5) return `${seconds}s ago`;
    return 'Just now';
  },
  
  /**
   * Format absolute time for tooltips
   */
  getAbsoluteTime: (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  },
  
  /**
   * Check if event is within time threshold for "recent" classification
   */
  isRecentEvent: (timestamp: number, thresholdMinutes = 5): boolean => {
    const now = Date.now();
    const diff = now - timestamp;
    return diff < thresholdMinutes * 60000;
  },
  
  /**
   * Calculate event age category
   */
  getEventAge: (timestamp: number): 'just-now' | 'recent' | 'older' | 'old' => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 30000) return 'just-now'; // 30 seconds
    if (diff < 300000) return 'recent'; // 5 minutes
    if (diff < 3600000) return 'older'; // 1 hour
    return 'old';
  }
};