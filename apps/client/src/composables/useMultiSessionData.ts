import { ref, computed, onMounted, onUnmounted, reactive, watch, readonly } from 'vue';
import type { 
  UseMultiSessionTimelineReturn,
  MultiSessionTimelineData,
  SessionTimelineData,
  SessionTimeWindow,
  SessionLayoutType,
  SessionFilter,
  SessionStatus
} from '../types/multi-session';
import { DEFAULT_SESSION_TIME_WINDOWS, DEFAULT_MULTI_SESSION_CONFIG } from '../types/multi-session';
import type { HookEvent } from '../types';
import { SessionFilterUtils } from '../types/session-filters';
import type { SessionFilterState } from '../types/session-filters';

// ============================================================================
// Multi-Session Data Service Class
// ============================================================================

class MultiSessionDataService {
  private cache = new Map<string, CachedSessionData>();
  private apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private ws: WebSocket | null = null;
  private wsListeners = new Set<(update: MultiSessionUpdate) => void>();
  private reconnectTimeout: number | null = null;
  
  // Cache TTL settings (70% reduction target)
  private readonly CACHE_TTL = {
    sessions: 30000,      // 30s for session list
    sessionDetail: 60000, // 1min for session details
    timeWindow: 15000     // 15s for time window data
  };

  async fetchSessionsInTimeWindow(timeWindow: SessionTimeWindow): Promise<SessionTimelineData[]> {
    const cacheKey = `sessions-${timeWindow.start}-${timeWindow.end}`;
    const cached = this.getFromApiCache(cacheKey);
    
    if (cached) {
      console.log('✅ Cache hit for sessions time window');
      return cached;
    }

    try {
      console.log('🌐 Fetching sessions from API', { timeWindow });
      
      // Use existing API endpoint but adapt the data
      const sessionsResponse = await fetch('http://localhost:4000/subagents/sessions');
      const eventsResponse = await fetch('http://localhost:4000/events/recent?limit=500');
      
      if (!sessionsResponse.ok || !eventsResponse.ok) {
        throw new Error('Failed to fetch session data');
      }
      
      const sessionsData = await sessionsResponse.json();
      const eventsData = await eventsResponse.json();
      
      // Transform the data to SessionTimelineData format
      const transformedSessions = await this.transformToTimelineFormat(
        sessionsData, 
        eventsData, 
        timeWindow
      );
      
      // Cache the result
      this.setApiCache(cacheKey, transformedSessions, this.CACHE_TTL.sessions);
      
      return transformedSessions;
    } catch (error) {
      console.error('❌ Failed to fetch sessions:', error);
      return [];
    }
  }

  private async transformToTimelineFormat(
    sessionsData: any[], 
    eventsData: HookEvent[], 
    timeWindow: SessionTimeWindow
  ): Promise<SessionTimelineData[]> {
    const sessions: SessionTimelineData[] = [];
    
    // Group events by session
    const eventsBySession = new Map<string, HookEvent[]>();
    eventsData.forEach(event => {
      if (event.timestamp >= timeWindow.start && event.timestamp <= timeWindow.end) {
        if (!eventsBySession.has(event.session_id)) {
          eventsBySession.set(event.session_id, []);
        }
        eventsBySession.get(event.session_id)!.push(event);
      }
    });

    // Process each session
    for (const sessionInfo of sessionsData) {
      if (sessionInfo.created_at >= timeWindow.start && sessionInfo.created_at <= timeWindow.end) {
        const events = eventsBySession.get(sessionInfo.session_id) || [];
        const agents = await this.fetchSessionAgents(sessionInfo.session_id);
        const messages = await this.fetchSessionMessages(sessionInfo.session_id);
        
        const sessionData = await this.buildSessionTimelineData(
          sessionInfo, 
          events, 
          agents, 
          messages,
          sessions.length
        );
        
        sessions.push(sessionData);
      }
    }
    
    return sessions.sort((a, b) => a.startTime - b.startTime);
  }

  private async fetchSessionAgents(sessionId: string) {
    const cacheKey = `agents-${sessionId}`;
    const cached = this.getFromApiCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      if (response.ok) {
        const agents = await response.json();
        this.setApiCache(cacheKey, agents, this.CACHE_TTL.sessionDetail);
        return agents;
      }
    } catch (error) {
      console.warn('Failed to fetch session agents:', error);
    }
    
    return [];
  }

  private async fetchSessionMessages(sessionId: string) {
    const cacheKey = `messages-${sessionId}`;
    const cached = this.getFromApiCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('http://localhost:4000/subagents/messages');
      if (response.ok) {
        const allMessages = await response.json();
        // Filter messages for this session (approximate based on timing)
        const sessionMessages = allMessages.filter((msg: any) => 
          msg.sender.includes(sessionId.slice(-6)) || // Heuristic matching
          Math.abs(msg.created_at - Date.now()) < 3600000 // Within 1 hour
        );
        
        this.setApiCache(cacheKey, sessionMessages, this.CACHE_TTL.sessionDetail);
        return sessionMessages;
      }
    } catch (error) {
      console.warn('Failed to fetch session messages:', error);
    }
    
    return [];
  }

  async buildSessionTimelineData(
    sessionInfo: any,
    events: HookEvent[],
    agents: any[],
    messages: any[],
    sessionIndex: number
  ): Promise<SessionTimelineData> {
    // Calculate session timing
    const startTime = Math.min(sessionInfo.created_at, ...events.map(e => e.timestamp));
    const endTime = this.calculateSessionEndTime(events, agents);
    
    // Transform agents to timeline format
    const agentPaths = agents.map((agent, index) => ({
      agentId: agent.name,
      name: agent.name,
      type: agent.subagent_type,
      startTime: agent.created_at,
      endTime: agent.completed_at || undefined,
      status: this.mapAgentStatus(agent.status),
      laneIndex: index + 1, // 0 is reserved for orchestrator
      color: this.getAgentTypeColor(agent.subagent_type),
      metadata: {
        duration: agent.total_duration_ms,
        tokens: agent.total_tokens,
        toolUseCount: agent.total_tool_use_count
      }
    }));

    // Transform events to orchestrator events and user prompts
    const { orchestratorEvents, userPrompts } = this.categorizeEvents(events);
    
    // Transform messages to timeline format
    const timelineMessages = messages.map((msg, index) => ({
      id: `${sessionInfo.session_id}-msg-${index}`,
      timestamp: msg.created_at,
      sender: msg.sender,
      content: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
      type: 'inter_agent' as const,
      agentId: msg.sender,
      read: true // Assume read for now
    }));

    // Calculate session metrics
    const metrics = this.calculateSessionMetrics(agents, messages, events);
    
    return {
      sessionId: sessionInfo.session_id,
      displayName: this.generateSessionDisplayName(sessionInfo.session_id, agents.length),
      startTime,
      endTime,
      status: this.calculateSessionStatus(agents) as SessionStatus,
      orchestratorEvents,
      userPrompts,
      agentBatches: this.inferAgentBatches(agentPaths),
      agentPaths,
      messages: timelineMessages,
      sessionLaneOffset: sessionIndex * DEFAULT_MULTI_SESSION_CONFIG.session_lane_height,
      sessionLaneHeight: DEFAULT_MULTI_SESSION_CONFIG.session_lane_height,
      metrics,
      color: this.generateSessionColor(sessionIndex)
    };
  }

  private calculateSessionEndTime(events: HookEvent[], agents: any[]): number | undefined {
    const completedAgents = agents.filter(a => a.completed_at);
    if (completedAgents.length === 0) return undefined;
    
    const latestAgentCompletion = Math.max(...completedAgents.map(a => a.completed_at));
    const latestEventTime = events.length > 0 ? Math.max(...events.map(e => e.timestamp)) : 0;
    
    return Math.max(latestAgentCompletion, latestEventTime);
  }

  mapAgentStatus(dbStatus: string): 'pending' | 'in_progress' | 'completed' | 'error' {
    switch (dbStatus) {
      case 'pending': return 'pending';
      case 'active': return 'in_progress';
      case 'completed': return 'completed';
      case 'failed': 
      case 'error': return 'error';
      default: return 'pending';
    }
  }

  private categorizeEvents(events: HookEvent[]) {
    const orchestratorEvents = events
      .filter(e => e.hook_event_type.includes('orchestrator') || e.hook_event_type.includes('task'))
      .map(e => ({
        id: e.id!.toString(),
        timestamp: e.timestamp!,
        type: 'batch_start' as const,
        description: e.summary || `${e.hook_event_type}: ${e.source_app}`,
        metadata: e.payload
      }));

    const userPrompts = events
      .filter(e => e.hook_event_type.includes('user') || e.hook_event_type.includes('prompt'))
      .map(e => ({
        id: e.id!.toString(),
        timestamp: e.timestamp!,
        content: e.summary || JSON.stringify(e.payload),
        metadata: e.payload
      }));

    return { orchestratorEvents, userPrompts };
  }

  private inferAgentBatches(agentPaths: any[]) {
    // Group agents that started around the same time into batches
    const batches: any[] = [];
    const BATCH_TIME_WINDOW = 10000; // 10 seconds
    
    const sortedAgents = [...agentPaths].sort((a, b) => a.startTime - b.startTime);
    let currentBatch: any[] = [];
    let batchStartTime = 0;
    
    for (const agent of sortedAgents) {
      if (currentBatch.length === 0 || agent.startTime - batchStartTime <= BATCH_TIME_WINDOW) {
        if (currentBatch.length === 0) {
          batchStartTime = agent.startTime;
        }
        currentBatch.push(agent);
      } else {
        // Start new batch
        if (currentBatch.length > 0) {
          batches.push({
            id: `batch-${batches.length + 1}`,
            startTime: batchStartTime,
            endTime: Math.max(...currentBatch.map(a => a.endTime || Date.now())),
            agents: currentBatch,
            status: this.calculateBatchStatus(currentBatch)
          });
        }
        currentBatch = [agent];
        batchStartTime = agent.startTime;
      }
    }
    
    // Add final batch
    if (currentBatch.length > 0) {
      batches.push({
        id: `batch-${batches.length + 1}`,
        startTime: batchStartTime,
        endTime: Math.max(...currentBatch.map(a => a.endTime || Date.now())),
        agents: currentBatch,
        status: this.calculateBatchStatus(currentBatch)
      });
    }
    
    return batches;
  }

  private calculateBatchStatus(agents: any[]) {
    const statuses = agents.map(a => a.status);
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'in_progress')) return 'in_progress';
    if (statuses.every(s => s === 'completed')) return 'completed';
    return 'pending';
  }

  calculateSessionMetrics(agents: any[], messages: any[], events: HookEvent[]) {
    const completedAgents = agents.filter(a => a.completed_at);
    const totalDuration = completedAgents.length > 0 
      ? Math.max(...completedAgents.map(a => a.completed_at)) - Math.min(...agents.map(a => a.created_at))
      : 0;
    
    const avgDuration = agents.length > 0 
      ? agents.reduce((sum, a) => sum + (a.total_duration_ms || 0), 0) / agents.length 
      : 0;
    
    const completionRate = agents.length > 0 ? completedAgents.length / agents.length : 0;
    const errorRate = agents.length > 0 
      ? agents.filter(a => a.status === 'failed').length / agents.length 
      : 0;

    return {
      totalDuration,
      agentCount: agents.length,
      messageCount: messages.length,
      batchCount: Math.ceil(agents.length / 3), // Estimated
      averageAgentDuration: avgDuration,
      completionRate,
      errorRate
    };
  }

  calculateSessionStatus(agents: any[]): string {
    if (agents.length === 0) return 'pending';
    
    const statuses = agents.map(a => a.status);
    if (statuses.some(s => s === 'failed')) return 'failed';
    if (statuses.some(s => s === 'active' || s === 'pending')) return 'active';
    if (statuses.every(s => s === 'completed')) return 'completed';
    
    return 'pending';
  }

  private generateSessionDisplayName(sessionId: string, agentCount: number): string {
    const shortId = sessionId.slice(-8);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Session ${shortId} (${agentCount} agents)`;
  }

  private generateSessionColor(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[index % colors.length];
  }

  getAgentTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      orchestrator: '#00d4ff',
      engineer: '#ff6b6b',
      architect: '#4ecdc4',
      reviewer: '#95e77e',
      verifier: '#a78bfa',
      planner: '#f97316',
      analyst: '#ec4899',
      researcher: '#06b6d4',
      designer: '#8b5cf6',
      'cloud-cicd': '#22c55e',
      'business-analyst': '#d946ef',
      'deep-researcher': '#0ea5e9'
    };
    return colorMap[type] || '#9ca3af';
  }

  // Enhanced WebSocket management with real-time updates
  private eventQueue: Array<MultiSessionUpdate> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private subscribedSessions = new Set<string>();
  private isReconnecting = false;
  private lastHeartbeat = 0;
  private heartbeatInterval: number | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 5000; // 5 seconds
  
  connectWebSocket(onUpdate: (update: MultiSessionUpdate) => void) {
    // Prevent duplicate connections
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.wsListeners.add(onUpdate);
      return;
    }
    
    if (this.isReconnecting && this.ws?.readyState === WebSocket.CONNECTING) {
      this.wsListeners.add(onUpdate);
      return;
    }
    
    this.wsListeners.add(onUpdate);
    this.attemptConnection();
  }
  
  private attemptConnection() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    try {
      console.log(`🔌 Attempting WebSocket connection (attempt ${this.reconnectAttempts + 1})`);
      
      // Use multi-session endpoint with enhanced protocol
      this.ws = new WebSocket('ws://localhost:4000/api/sessions/multi-stream');
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          console.warn('🔌 Connection timeout, closing socket');
          this.ws.close();
        }
      }, this.CONNECTION_TIMEOUT);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('🔌 Multi-session WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.lastHeartbeat = Date.now();
        
        // Re-subscribe to previously subscribed sessions
        if (this.subscribedSessions.size > 0) {
          this.subscribeToSessions(Array.from(this.subscribedSessions));
        }
        
        // Process queued events
        this.processEventQueue();
        
        // Start heartbeat
        this.startHeartbeat();
      };
      
      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };
      
      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 Multi-session WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
        this.stopHeartbeat();
        
        // Schedule reconnection with exponential backoff
        if (this.wsListeners.size > 0 && !this.isReconnecting) {
          this.scheduleReconnectWithBackoff();
        }
      };
      
      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('🔌 Multi-session WebSocket error:', error);
        this.stopHeartbeat();
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (this.wsListeners.size > 0) {
        this.scheduleReconnectWithBackoff();
      }
    }
  }
  
  private handleWebSocketMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      
      // Handle heartbeat responses
      if (message.type === 'pong') {
        this.lastHeartbeat = Date.now();
        return;
      }
      
      // Handle subscription confirmations
      if (message.type === 'subscription_confirmed' || message.type === 'unsubscription_confirmed') {
        console.log(`🔌 Subscription ${message.type}:`, message.sessionIds || [message.sessionId]);
        return;
      }
      
      // Transform server messages to multi-session updates
      let update: MultiSessionUpdate | null = null;
      
      switch (message.type) {
        case 'session_event':
        case 'subagent_registered':
        case 'agent_registered':
          update = {
            type: 'session_updated',
            sessionId: message.sessionId || message.data?.session_id || this.extractSessionId(message.data?.sender),
            data: message.data,
            timestamp: Date.now(),
            eventType: 'agent_registered'
          };
          break;
          
        case 'agent_status_update':
          update = {
            type: 'session_updated', 
            sessionId: message.sessionId || message.data?.session_id || this.extractSessionId(message.data?.name),
            data: message.data,
            timestamp: Date.now(),
            eventType: 'agent_status_changed'
          };
          break;
          
        case 'subagent_message':
        case 'agent_message':
          update = {
            type: 'batch_update',
            sessionId: this.extractSessionId(message.data?.sender || ''),
            data: message.data,
            timestamp: Date.now(),
            eventType: 'message_sent'
          };
          break;
          
        case 'event':
          // Handle general events that might indicate new sessions
          if (message.data?.hook_event_type?.includes('task_start') || 
              message.data?.hook_event_type?.includes('session_start')) {
            update = {
              type: 'session_added',
              sessionId: message.data.session_id,
              data: message.data,
              timestamp: Date.now(),
              eventType: 'session_started'
            };
          } else {
            update = {
              type: 'session_updated',
              sessionId: message.data.session_id,
              data: message.data,
              timestamp: Date.now(),
              eventType: 'session_event'
            };
          }
          break;
      }
      
      if (update) {
        // Invalidate relevant caches
        this.invalidateSessionCache(update.sessionId);
        
        // Add animation hint for new sessions
        if (update.type === 'session_added') {
          update.animateIn = true;
        }
        
        // Queue event if connection is unstable, otherwise process immediately
        if (this.ws?.readyState === WebSocket.OPEN && !this.isReconnecting) {
          this.notifyListeners(update);
        } else {
          this.eventQueue.push(update);
        }
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error);
    }
  }
  
  private notifyListeners(update: MultiSessionUpdate) {
    this.wsListeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('WebSocket listener error:', error);
      }
    });
  }
  
  private processEventQueue() {
    if (this.eventQueue.length === 0) return;
    
    console.log(`🔄 Processing ${this.eventQueue.length} queued events`);
    
    // Group events by session to avoid duplicate notifications
    const eventsBySession = new Map<string, MultiSessionUpdate>();
    
    this.eventQueue.forEach(event => {
      const existing = eventsBySession.get(event.sessionId);
      if (!existing || event.timestamp > existing.timestamp) {
        eventsBySession.set(event.sessionId, event);
      }
    });
    
    // Notify listeners of consolidated events
    eventsBySession.forEach(update => {
      this.notifyListeners(update);
    });
    
    // Clear queue
    this.eventQueue = [];
  }
  
  // Enhanced reconnection with exponential backoff
  private scheduleReconnectWithBackoff() {
    if (this.reconnectTimeout || this.isReconnecting) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔌 Max reconnection attempts reached');
      return;
    }
    
    this.isReconnecting = true;
    
    // Calculate delay with exponential backoff + jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    ) + Math.random() * 1000; // Add jitter
    
    console.log(`🔄 Scheduling reconnection in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempts++;
      
      if (this.wsListeners.size > 0) {
        this.attemptConnection();
      } else {
        this.isReconnecting = false;
      }
    }, delay);
  }
  
  // Session subscription management
  subscribeToSessions(sessionIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue subscriptions for when connection is restored
      sessionIds.forEach(id => this.subscribedSessions.add(id));
      return;
    }
    
    const message = {
      action: 'subscribe',
      sessionIds: sessionIds
    };
    
    try {
      this.ws.send(JSON.stringify(message));
      sessionIds.forEach(id => this.subscribedSessions.add(id));
      console.log('🔌 Subscribed to sessions:', sessionIds);
    } catch (error) {
      console.error('Failed to send subscription message:', error);
    }
  }
  
  unsubscribeFromSessions(sessionIds: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        action: 'unsubscribe', 
        sessionIds: sessionIds
      };
      
      try {
        this.ws.send(JSON.stringify(message));
        console.log('🔌 Unsubscribed from sessions:', sessionIds);
      } catch (error) {
        console.error('Failed to send unsubscription message:', error);
      }
    }
    
    sessionIds.forEach(id => this.subscribedSessions.delete(id));
  }
  
  // Heartbeat management
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check if we've received a recent heartbeat response
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
        if (timeSinceLastHeartbeat > this.HEARTBEAT_INTERVAL * 2) {
          console.warn('🔌 Heartbeat timeout, reconnecting...');
          this.ws.close();
          return;
        }
        
        try {
          this.ws.send(JSON.stringify({ action: 'ping' }));
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }
  
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private extractSessionId(sender: string): string {
    // Extract session ID from agent name or use fallback
    return sender.split('-')[0] || 'unknown';
  }

  private scheduleReconnect() {
    // Use the enhanced backoff reconnection
    this.scheduleReconnectWithBackoff();
  }

  disconnectWebSocket() {
    console.log('🔌 Disconnecting WebSocket...');
    
    // Clear all timeouts and intervals
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopHeartbeat();
    
    // Close connection
    if (this.ws) {
      this.ws.close(1000, 'Component unmounted');
      this.ws = null;
    }
    
    // Clear all state
    this.wsListeners.clear();
    this.subscribedSessions.clear();
    this.eventQueue = [];
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.lastHeartbeat = 0;
  }

  // Cache management
  private getFromApiCache<T>(key: string): T | null {
    const cached = this.apiCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.apiCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setApiCache(key: string, data: any, ttl: number) {
    this.apiCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private invalidateSessionCache(sessionId: string) {
    // Remove all cache entries related to this session
    for (const [key] of this.apiCache) {
      if (key.includes(sessionId)) {
        this.apiCache.delete(key);
      }
    }
  }

  clearCache() {
    this.apiCache.clear();
    this.cache.clear();
    console.log('🧹 Multi-session cache cleared');
  }

  getCacheStats() {
    return {
      apiCacheSize: this.apiCache.size,
      sessionCacheSize: this.cache.size,
      wsConnected: this.ws?.readyState === WebSocket.OPEN,
      wsListeners: this.wsListeners.size,
      subscribedSessions: this.subscribedSessions.size,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      queuedEvents: this.eventQueue.length,
      lastHeartbeat: this.lastHeartbeat
    };
  }
}

// ============================================================================
// Types for Internal Use
// ============================================================================

interface CachedSessionData {
  sessionId: string;
  data: SessionTimelineData;
  lastFetched: number;
  lastAccessed: number;
}

type MultiSessionUpdate = {
  type: 'session_added' | 'session_updated' | 'session_removed' | 'batch_update';
  sessionId: string;
  data?: any;
  timestamp: number;
  eventType?: 'agent_registered' | 'agent_status_changed' | 'message_sent' | 'session_started' | 'session_event';
  animateIn?: boolean; // Hint for UI animations
};

// ============================================================================
// Main Composable Function
// ============================================================================

export function useMultiSessionData(
  defaultTimeWindow: SessionTimeWindow = DEFAULT_SESSION_TIME_WINDOWS[1], // 1 hour
  options: {
    autoRefresh?: boolean;
    cacheTimeout?: number;
    maxSessions?: number;
  } = {}
): UseMultiSessionTimelineReturn {
  
  // ============================================================================
  // Reactive State
  // ============================================================================
  
  const dataService = new MultiSessionDataService();
  
  // Core data state
  const rawSessionsData = ref<SessionTimelineData[]>([]);
  const timeWindow = ref<SessionTimeWindow>(defaultTimeWindow);
  const sessionLayout = ref<SessionLayoutType>('swim_lanes');
  const currentFilter = ref<SessionFilter>({});
  
  // Loading and error state
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // Performance monitoring
  const lastFetchTime = ref<number>(0);
  const cacheHitRate = ref<number>(0);
  
  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const visibleSessions = computed((): SessionTimelineData[] => {
    let filtered = rawSessionsData.value;
    
    // Apply filters
    const filter = currentFilter.value;
    
    if (filter.sessionIds && filter.sessionIds.length > 0) {
      filtered = filtered.filter(session => 
        filter.sessionIds!.includes(session.sessionId)
      );
    }
    
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(session => 
        filter.status!.includes(session.status)
      );
    }
    
    if (filter.timeRange) {
      const { start, end } = filter.timeRange;
      filtered = filtered.filter(session => {
        const sessionEnd = session.endTime || Date.now();
        return session.startTime <= end && sessionEnd >= start;
      });
    }
    
    if (filter.agentCountRange) {
      const { min, max } = filter.agentCountRange;
      filtered = filtered.filter(session => {
        const count = session.agentPaths.length;
        return count >= min && count <= max;
      });
    }
    
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(session => 
        session.displayName.toLowerCase().includes(query) ||
        session.sessionId.toLowerCase().includes(query) ||
        session.agentPaths.some(agent => 
          agent.name.toLowerCase().includes(query) ||
          agent.type.toLowerCase().includes(query)
        )
      );
    }
    
    // Apply max sessions limit
    const maxSessions = options.maxSessions || DEFAULT_MULTI_SESSION_CONFIG.max_sessions;
    if (filtered.length > maxSessions) {
      // Keep most recent sessions
      filtered = filtered
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, maxSessions);
    }
    
    return filtered.sort((a, b) => a.startTime - b.startTime);
  });
  
  const multiSessionData = computed((): MultiSessionTimelineData => {
    const sessions = visibleSessions.value;
    const timeRange = {
      start: timeWindow.value.start,
      end: timeWindow.value.end,
      duration: timeWindow.value.duration
    };
    
    return {
      sessions,
      timeRange,
      sessionLayout: sessionLayout.value,
      lastUpdated: lastFetchTime.value,
      totalSessions: sessions.length,
      totalAgents: sessions.reduce((sum, s) => sum + s.agentPaths.length, 0)
    };
  });
  
  // ============================================================================
  // Data Fetching Functions
  // ============================================================================
  
  const fetchSessionsInWindow = async (window: SessionTimeWindow): Promise<SessionTimelineData[]> => {
    try {
      const startTime = Date.now();
      const sessions = await dataService.fetchSessionsInTimeWindow(window);
      
      const fetchDuration = Date.now() - startTime;
      console.log(`⏱️  Fetch completed in ${fetchDuration}ms`);
      
      return sessions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to fetch sessions in window:', errorMessage);
      error.value = errorMessage;
      return [];
    }
  };
  
  const refreshSessions = async (): Promise<void> => {
    if (isLoading.value) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const sessions = await fetchSessionsInWindow(timeWindow.value);
      rawSessionsData.value = sessions;
      lastFetchTime.value = Date.now();
      
      console.log(`✅ Refreshed ${sessions.length} sessions`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh sessions';
      error.value = errorMessage;
      console.error('❌ Refresh failed:', errorMessage);
    } finally {
      isLoading.value = false;
    }
  };
  
  // ============================================================================
  // Session Management Functions
  // ============================================================================
  
  const setTimeWindow = (window: SessionTimeWindow): void => {
    console.log('🕐 Setting time window:', window);
    timeWindow.value = window;
    
    // Auto-refresh when time window changes
    if (options.autoRefresh !== false) {
      refreshSessions();
    }
  };
  
  const setSessionLayout = (layout: SessionLayoutType): void => {
    console.log('🎨 Setting session layout:', layout);
    sessionLayout.value = layout;
  };
  
  const filterSessions = (filter: SessionFilter): void => {
    console.log('🔍 Applying session filter:', filter);
    currentFilter.value = filter;
  };
  
  const applySessionFilters = (filters: SessionFilterState): void => {
    console.log('🔍 Applying advanced session filters:', filters);
    
    // Convert SessionFilterState to internal SessionFilter format for compatibility
    const internalFilter: SessionFilter = {
      sessionIds: filters.sessionIdSearch ? [filters.sessionIdSearch] : undefined,
      status: filters.status.length > 0 ? filters.status : undefined,
      timeRange: filters.timeRange.start > 0 || filters.timeRange.end > 0 ? filters.timeRange : undefined,
      agentCountRange: filters.agentCountRange.min > 0 || filters.agentCountRange.max < 100 ? filters.agentCountRange : undefined,
      searchQuery: filters.sessionIdSearch
    };
    
    currentFilter.value = internalFilter;
  };
  
  const addSession = (session: SessionTimelineData): void => {
    const existingIndex = rawSessionsData.value.findIndex(
      s => s.sessionId === session.sessionId
    );
    
    if (existingIndex >= 0) {
      // Update existing session
      rawSessionsData.value[existingIndex] = session;
      console.log('🔄 Updated existing session:', session.sessionId);
    } else {
      // Add new session
      rawSessionsData.value.push(session);
      console.log('➕ Added new session:', session.sessionId);
    }
  };
  
  const removeSession = (sessionId: string): void => {
    const initialLength = rawSessionsData.value.length;
    rawSessionsData.value = rawSessionsData.value.filter(
      s => s.sessionId !== sessionId
    );
    
    if (rawSessionsData.value.length < initialLength) {
      console.log('🗑️  Removed session:', sessionId);
    }
  };
  
  // ============================================================================
  // Real-time Updates via WebSocket with Smooth Animations
  // ============================================================================
  
  // Throttle state for high-frequency updates
  const updateThrottle = ref(new Map<string, number>());
  const THROTTLE_DELAY = 100; // 100ms throttle for same session updates
  const animatingSessionIds = ref(new Set<string>());
  
  const handleMultiSessionUpdate = (update: MultiSessionUpdate) => {
    console.log('📡 Received real-time update:', {
      type: update.type,
      sessionId: update.sessionId,
      eventType: update.eventType,
      animateIn: update.animateIn
    });
    
    // Throttle high-frequency updates for the same session
    const now = Date.now();
    const lastUpdate = updateThrottle.value.get(update.sessionId) || 0;
    
    if (now - lastUpdate < THROTTLE_DELAY && update.type !== 'session_added') {
      // Debounce rapid updates
      setTimeout(() => {
        if (!updateThrottle.value.has(update.sessionId) || 
            now >= updateThrottle.value.get(update.sessionId)!) {
          processUpdate(update);
        }
      }, THROTTLE_DELAY);
      return;
    }
    
    updateThrottle.value.set(update.sessionId, now);
    processUpdate(update);
  };
  
  const processUpdate = (update: MultiSessionUpdate) => {
    switch (update.type) {
      case 'session_added':
        handleNewSession(update);
        break;
        
      case 'session_updated':
        handleSessionUpdate(update);
        break;
        
      case 'session_removed':
        handleSessionRemoval(update);
        break;
        
      case 'batch_update':
        handleBatchUpdate(update);
        break;
    }
  };
  
  const handleNewSession = async (update: MultiSessionUpdate) => {
    // Mark session for animation
    if (update.animateIn) {
      animatingSessionIds.value.add(update.sessionId);
    }
    
    // Subscribe to the new session for future updates
    dataService.subscribeToSessions([update.sessionId]);
    
    // Fetch full session data efficiently
    try {
      const newSession = await fetchNewSessionData(update.sessionId, update.data);
      if (newSession) {
        // Add with animation hint
        addSession(newSession);
        
        // Trigger smooth appear animation
        if (update.animateIn) {
          setTimeout(() => {
            animatingSessionIds.value.delete(update.sessionId);
          }, 2000); // Animation duration
        }
      }
    } catch (error) {
      console.error('Failed to fetch new session data:', error);
      // Fallback to full refresh
      if (options.autoRefresh !== false) {
        refreshSessions();
      }
    }
  };
  
  const handleSessionUpdate = async (update: MultiSessionUpdate) => {
    const existingSession = rawSessionsData.value.find(s => s.sessionId === update.sessionId);
    
    if (!existingSession) {
      // Session not in current window, might be a new one
      handleNewSession({ ...update, type: 'session_added' });
      return;
    }
    
    // Selective update based on event type
    switch (update.eventType) {
      case 'agent_registered':
        await updateSessionAgents(update.sessionId, update.data);
        break;
        
      case 'agent_status_changed':
        await updateAgentStatus(update.sessionId, update.data);
        break;
        
      case 'session_event':
        // Light refresh for general session events
        await refreshSessionData(update.sessionId);
        break;
        
      default:
        // Full session refresh for unknown updates
        await refreshSessionData(update.sessionId);
        break;
    }
  };
  
  const handleSessionRemoval = (update: MultiSessionUpdate) => {
    removeSession(update.sessionId);
    dataService.unsubscribeFromSessions([update.sessionId]);
    animatingSessionIds.value.delete(update.sessionId);
  };
  
  const handleBatchUpdate = async (update: MultiSessionUpdate) => {
    // Handle agent messages and batch-level updates
    if (update.eventType === 'message_sent') {
      await updateSessionMessages(update.sessionId, update.data);
    } else {
      // Generic batch update - light refresh
      await refreshSessionData(update.sessionId);
    }
  };
  
  // Efficient partial update functions
  const fetchNewSessionData = async (sessionId: string, eventData?: any): Promise<SessionTimelineData | null> => {
    try {
      // Use the existing transformation logic with minimal API calls
      const sessionResponse = await fetch(`http://localhost:4000/subagents/${sessionId}`);
      if (!sessionResponse.ok) return null;
      
      const agents = await sessionResponse.json();
      const messages = await dataService.fetchSessionMessages(sessionId);
      
      // Create basic session info from event data
      const sessionInfo = {
        session_id: sessionId,
        created_at: eventData?.timestamp || Date.now()
      };
      
      // Use existing transformation logic
      const sessionData = await dataService.buildSessionTimelineData(
        sessionInfo,
        eventData ? [eventData] : [],
        agents,
        messages,
        rawSessionsData.value.length
      );
      
      return sessionData;
    } catch (error) {
      console.error('Failed to fetch new session data:', error);
      return null;
    }
  };
  
  const refreshSessionData = async (sessionId: string) => {
    // Optimized refresh for specific session without full data reload
    try {
      const sessionIndex = rawSessionsData.value.findIndex(s => s.sessionId === sessionId);
      if (sessionIndex === -1) return;
      
      const agents = await dataService.fetchSessionAgents(sessionId);
      const messages = await dataService.fetchSessionMessages(sessionId);
      
      // Update existing session data
      const existingSession = rawSessionsData.value[sessionIndex];
      const updatedSession = {
        ...existingSession,
        agentPaths: await transformAgentsToTimelineFormat(agents, sessionIndex),
        messages: await transformMessagesToTimelineFormat(messages, sessionId),
        metrics: dataService.calculateSessionMetrics(agents, messages, [])
      };
      
      rawSessionsData.value[sessionIndex] = updatedSession;
    } catch (error) {
      console.error('Failed to refresh session data:', error);
    }
  };
  
  const updateSessionAgents = async (sessionId: string, agentData: any) => {
    const sessionIndex = rawSessionsData.value.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return;
    
    try {
      // Fetch latest agents for this session
      const agents = await dataService.fetchSessionAgents(sessionId);
      const updatedAgentPaths = await transformAgentsToTimelineFormat(agents, sessionIndex);
      
      // Update only agent-related data
      const session = rawSessionsData.value[sessionIndex];
      rawSessionsData.value[sessionIndex] = {
        ...session,
        agentPaths: updatedAgentPaths,
        metrics: {
          ...session.metrics,
          agentCount: agents.length
        }
      };
    } catch (error) {
      console.error('Failed to update session agents:', error);
    }
  };
  
  const updateAgentStatus = async (sessionId: string, statusData: any) => {
    const sessionIndex = rawSessionsData.value.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return;
    
    const session = rawSessionsData.value[sessionIndex];
    const agentIndex = session.agentPaths.findIndex(a => a.name === statusData.name);
    
    if (agentIndex !== -1) {
      // Update specific agent status without full reload
      const updatedAgentPaths = [...session.agentPaths];
      updatedAgentPaths[agentIndex] = {
        ...updatedAgentPaths[agentIndex],
        status: dataService.mapAgentStatus(statusData.status),
        endTime: statusData.completed_at || updatedAgentPaths[agentIndex].endTime
      };
      
      rawSessionsData.value[sessionIndex] = {
        ...session,
        agentPaths: updatedAgentPaths,
        status: dataService.calculateSessionStatus(updatedAgentPaths) as SessionStatus
      };
    }
  };
  
  const updateSessionMessages = async (sessionId: string, messageData: any) => {
    const sessionIndex = rawSessionsData.value.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return;
    
    try {
      // Fetch latest messages for this session
      const messages = await dataService.fetchSessionMessages(sessionId);
      const updatedMessages = await transformMessagesToTimelineFormat(messages, sessionId);
      
      const session = rawSessionsData.value[sessionIndex];
      rawSessionsData.value[sessionIndex] = {
        ...session,
        messages: updatedMessages,
        metrics: {
          ...session.metrics,
          messageCount: messages.length
        }
      };
    } catch (error) {
      console.error('Failed to update session messages:', error);
    }
  };
  
  // Helper transformation functions
  const transformAgentsToTimelineFormat = async (agents: any[], sessionIndex: number) => {
    return agents.map((agent, index) => ({
      agentId: agent.name,
      name: agent.name,
      type: agent.subagent_type,
      startTime: agent.created_at,
      endTime: agent.completed_at || undefined,
      status: dataService.mapAgentStatus(agent.status),
      laneIndex: index + 1,
      color: dataService.getAgentTypeColor(agent.subagent_type),
      metadata: {
        duration: agent.total_duration_ms,
        tokens: agent.total_tokens,
        toolUseCount: agent.total_tool_use_count
      }
    }));
  };
  
  const transformMessagesToTimelineFormat = async (messages: any[], sessionId: string) => {
    return messages.map((msg, index) => ({
      id: `${sessionId}-msg-${index}`,
      timestamp: msg.created_at,
      sender: msg.sender,
      content: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
      type: 'inter_agent' as const,
      agentId: msg.sender,
      read: true
    }));
  };
  
  // ============================================================================
  // Lifecycle Management
  // ============================================================================
  
  let refreshInterval: number | null = null;
  
  const startAutoRefresh = () => {
    if (refreshInterval || options.autoRefresh === false) return;
    
    // Auto-refresh every 30 seconds
    refreshInterval = window.setInterval(() => {
      if (!isLoading.value) {
        refreshSessions();
      }
    }, 30000);
    
    console.log('🔄 Started auto-refresh (30s interval)');
  };
  
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
      console.log('⏹️  Stopped auto-refresh');
    }
  };
  
  // ============================================================================
  // Initialization Functions
  // ============================================================================
  
  const initialize = async () => {
    console.log('🚀 Multi-session composable initializing');
    
    // Connect to WebSocket for real-time updates with session subscription
    dataService.connectWebSocket(handleMultiSessionUpdate);
    
    // Subscribe to sessions in current time window for real-time updates
    const initialSessionIds = rawSessionsData.value.map(s => s.sessionId);
    if (initialSessionIds.length > 0) {
      dataService.subscribeToSessions(initialSessionIds);
    }
    
    // Initial data fetch
    await refreshSessions();
    
    // Start auto-refresh if enabled
    if (options.autoRefresh !== false) {
      startAutoRefresh();
    }
  };
  
  const cleanup = () => {
    console.log('🔌 Multi-session composable cleaning up');
    
    // Clean up resources
    stopAutoRefresh();
    dataService.disconnectWebSocket();
    dataService.clearCache();
  };
  
  // Component Lifecycle Hooks (only when in component context)
  try {
    onMounted(initialize);
    onUnmounted(cleanup);
  } catch (error) {
    // Not in component context - lifecycle hooks not available
    // Tests or other non-component usage should call initialize() manually
  }
  
  // ============================================================================
  // Watchers for Reactive Updates
  // ============================================================================
  
  watch(timeWindow, (newWindow, oldWindow) => {
    console.log('👀 Time window changed:', newWindow);
    
    // Update subscriptions for new time window
    if (oldWindow) {
      const oldSessionIds = rawSessionsData.value.map(s => s.sessionId);
      if (oldSessionIds.length > 0) {
        dataService.unsubscribeFromSessions(oldSessionIds);
      }
    }
    
    if (options.autoRefresh !== false) {
      refreshSessions().then(() => {
        // Subscribe to sessions in new time window
        const newSessionIds = rawSessionsData.value.map(s => s.sessionId);
        if (newSessionIds.length > 0) {
          dataService.subscribeToSessions(newSessionIds);
        }
      });
    }
  });
  
  // Watch for changes in visible sessions to update subscriptions
  watch(() => rawSessionsData.value.map(s => s.sessionId), (newSessionIds, oldSessionIds) => {
    if (!oldSessionIds) return;
    
    const added = newSessionIds.filter(id => !oldSessionIds.includes(id));
    const removed = oldSessionIds.filter(id => !newSessionIds.includes(id));
    
    if (added.length > 0) {
      dataService.subscribeToSessions(added);
    }
    
    if (removed.length > 0) {
      dataService.unsubscribeFromSessions(removed);
    }
  }, { deep: true });
  
  // ============================================================================
  // Return Interface
  // ============================================================================
  
  return {
    multiSessionData,
    visibleSessions,
    timeWindow,
    sessionLayout,
    isLoading,
    error,
    
    // Session management methods
    setTimeWindow,
    setSessionLayout,
    filterSessions,
    applySessionFilters,
    addSession,
    removeSession,
    
    // Data fetching methods
    refreshSessions,
    fetchSessionsInWindow,
    
    // Manual lifecycle methods for tests
    initialize,
    cleanup,
    
    // Real-time update controls
    animatingSessionIds: readonly(animatingSessionIds),
    getConnectionStats: () => dataService.getCacheStats()
  };
}