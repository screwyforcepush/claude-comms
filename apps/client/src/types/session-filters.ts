// Session Filter Types
export interface SessionFilterState {
  sessionIdSearch: string;
  status: SessionStatus[];
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

export type SessionStatus = 'active' | 'completed' | 'failed';

export const DEFAULT_SESSION_FILTERS: SessionFilterState = {
  sessionIdSearch: '',
  status: [],
  timeRange: { start: 0, end: 0 },
  agentCountRange: { min: 0, max: 100 },
  sessionDuration: { min: 0, max: 86400000 } // 24 hours in ms
};

// Filter performance monitoring
export interface FilterPerformanceMetrics {
  filterApplicationTime: number;
  filteredSessionCount: number;
  totalSessionCount: number;
  timestamp: number;
}

// Filter state persistence
export interface SessionFilterPersistence {
  userId?: string;
  sessionId: string;
  filters: SessionFilterState;
  lastUpdated: number;
}

// Helper functions for filter operations
export class SessionFilterUtils {
  
  static applyFilters(
    sessions: any[], 
    filters: SessionFilterState
  ): { filteredSessions: any[]; metrics: FilterPerformanceMetrics } {
    const startTime = performance.now();
    let filtered = [...sessions];
    
    // Session ID/Name search filter
    if (filters.sessionIdSearch.trim()) {
      const searchTerm = filters.sessionIdSearch.toLowerCase().trim();
      filtered = filtered.filter(session => 
        session.sessionId.toLowerCase().includes(searchTerm) ||
        session.displayName?.toLowerCase().includes(searchTerm) ||
        // Support searching in agent names too
        session.agentPaths?.some((agent: any) => 
          agent.name?.toLowerCase().includes(searchTerm) ||
          agent.type?.toLowerCase().includes(searchTerm)
        )
      );
    }
    
    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(session => 
        filters.status.includes(session.status)
      );
    }
    
    // Time range filter
    if (filters.timeRange.start > 0 || filters.timeRange.end > 0) {
      const start = filters.timeRange.start || 0;
      const end = filters.timeRange.end || Date.now();
      
      filtered = filtered.filter(session => {
        const sessionEnd = session.endTime || Date.now();
        return session.startTime <= end && sessionEnd >= start;
      });
    }
    
    // Agent count range filter
    if (filters.agentCountRange.min > 0 || filters.agentCountRange.max < 100) {
      filtered = filtered.filter(session => {
        const agentCount = session.agentPaths?.length || session.agents?.length || 0;
        return agentCount >= filters.agentCountRange.min && 
               agentCount <= filters.agentCountRange.max;
      });
    }
    
    // Session duration filter  
    if (filters.sessionDuration.min > 0 || filters.sessionDuration.max < 86400000) {
      filtered = filtered.filter(session => {
        const endTime = session.endTime || Date.now();
        const duration = endTime - session.startTime;
        return duration >= filters.sessionDuration.min && 
               duration <= filters.sessionDuration.max;
      });
    }
    
    const endTime = performance.now();
    
    const metrics: FilterPerformanceMetrics = {
      filterApplicationTime: endTime - startTime,
      filteredSessionCount: filtered.length,
      totalSessionCount: sessions.length,
      timestamp: Date.now()
    };
    
    return { filteredSessions: filtered, metrics };
  }
  
  static isFilterActive(filters: SessionFilterState): boolean {
    return (
      filters.sessionIdSearch.trim() !== '' ||
      filters.status.length > 0 ||
      filters.timeRange.start > 0 ||
      filters.timeRange.end > 0 ||
      filters.agentCountRange.min > 0 ||
      filters.agentCountRange.max < 100 ||
      filters.sessionDuration.min > 0 ||
      filters.sessionDuration.max < 86400000
    );
  }
  
  static validateFilters(filters: SessionFilterState): string[] {
    const errors: string[] = [];
    
    // Validate time range
    if (filters.timeRange.start > 0 && filters.timeRange.end > 0) {
      if (filters.timeRange.start >= filters.timeRange.end) {
        errors.push('Start time must be before end time');
      }
    }
    
    // Validate agent count range
    if (filters.agentCountRange.min > filters.agentCountRange.max) {
      errors.push('Minimum agent count must be less than or equal to maximum');
    }
    
    if (filters.agentCountRange.min < 0 || filters.agentCountRange.max < 0) {
      errors.push('Agent count values must be non-negative');
    }
    
    // Validate session duration range
    if (filters.sessionDuration.min > filters.sessionDuration.max) {
      errors.push('Minimum duration must be less than or equal to maximum duration');
    }
    
    if (filters.sessionDuration.min < 0 || filters.sessionDuration.max < 0) {
      errors.push('Duration values must be non-negative');
    }
    
    return errors;
  }
  
  static formatDurationForDisplay(milliseconds: number): string {
    if (milliseconds < 60000) { // Less than 1 minute
      return `${Math.round(milliseconds / 1000)}s`;
    } else if (milliseconds < 3600000) { // Less than 1 hour
      return `${Math.round(milliseconds / 60000)}m`;
    } else if (milliseconds < 86400000) { // Less than 1 day
      const hours = Math.floor(milliseconds / 3600000);
      const minutes = Math.round((milliseconds % 3600000) / 60000);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else { // 1 day or more
      const days = Math.floor(milliseconds / 86400000);
      const hours = Math.round((milliseconds % 86400000) / 3600000);
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
  }
  
  static serializeFilters(filters: SessionFilterState): string {
    return JSON.stringify(filters);
  }
  
  static deserializeFilters(serializedFilters: string): SessionFilterState {
    try {
      return JSON.parse(serializedFilters);
    } catch (error) {
      console.warn('Failed to deserialize session filters, using defaults:', error);
      return { ...DEFAULT_SESSION_FILTERS };
    }
  }
}