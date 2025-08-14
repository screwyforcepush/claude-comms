// Session Data Format Adapter
// Bridges the gap between different session data formats in the system

import type { SessionTimelineData } from '../types/multi-session';

// Component interface (InteractiveSessionsTimeline expects)
export interface SessionData {
  sessionId: string;
  displayName: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  agents: SessionAgent[];
  messages: SessionMessage[];
  agentCount: number;
}

export interface SessionAgent {
  agentId: string;
  name: string;
  type: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  laneIndex: number;
}

export interface SessionMessage {
  id: string;
  timestamp: number;
  sender: string;
  content: string;
  recipients?: string[];
}

// Adapter class to transform between formats
export class SessionDataAdapter {
  
  /**
   * Transform SessionTimelineData to SessionData (component format)
   */
  static timelineToSessionData(timelineData: SessionTimelineData): SessionData {
    return {
      sessionId: timelineData.sessionId,
      displayName: timelineData.displayName,
      startTime: timelineData.startTime,
      endTime: timelineData.endTime,
      status: timelineData.status,
      agentCount: timelineData.agentPaths?.length || 0,
      
      // Transform agentPaths to agents with proper lane assignment
      agents: (timelineData.agentPaths || []).map((agentPath, index) => ({
        agentId: agentPath.agentId,
        name: agentPath.name,
        type: agentPath.type,
        startTime: agentPath.startTime,
        endTime: agentPath.endTime || undefined, // Convert null to undefined
        status: agentPath.status as 'pending' | 'in_progress' | 'completed' | 'error',
        laneIndex: agentPath.laneIndex && agentPath.laneIndex > 0 ? agentPath.laneIndex : index + 1
      })),
      
      // Transform messages 
      messages: (timelineData.messages || []).map(msg => ({
        id: msg.id,
        timestamp: msg.timestamp,
        sender: msg.sender,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        recipients: msg.recipients || []
      }))
    };
  }
  
  /**
   * Transform multiple SessionTimelineData to SessionData[]
   */
  static batchTimelineToSessionData(timelineDataArray: SessionTimelineData[]): SessionData[] {
    return timelineDataArray.map(this.timelineToSessionData);
  }
  
  /**
   * Transform SessionData to SessionTimelineData (composable format)
   */
  static sessionDataToTimeline(sessionData: SessionData): SessionTimelineData {
    return {
      sessionId: sessionData.sessionId,
      displayName: sessionData.displayName,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      status: sessionData.status as any,
      
      // Transform agents to agentPaths
      agentPaths: sessionData.agents.map((agent, index) => ({
        agentId: agent.agentId,
        name: agent.name,
        type: agent.type,
        startTime: agent.startTime,
        endTime: agent.endTime || undefined,
        status: agent.status,
        laneIndex: agent.laneIndex || index + 1,
        color: this.getAgentTypeColor(agent.type),
        curveData: { points: [] }, // Required for AgentPath
        batchId: 'batch-0', // Default batch
        messages: [], // Empty messages array
        sessionId: sessionData.sessionId,
        metadata: {
          duration: agent.endTime ? agent.endTime - agent.startTime : undefined,
          tokens: 0, // Default values for missing data
          toolUseCount: 0
        }
      })),
      
      // Transform messages
      messages: sessionData.messages.map(msg => ({
        id: msg.id,
        timestamp: msg.timestamp,
        sender: msg.sender,
        content: msg.content,
        type: 'inter_agent' as const,
        agentId: msg.sender,
        read: true,
        recipients: msg.recipients,
        position: { x: 0, y: 0 }, // Default position for display
        sessionId: sessionData.sessionId
      })),
      
      // Default values for required SessionTimelineData properties
      orchestratorEvents: [],
      userPrompts: [],
      agentBatches: [],
      sessionLaneOffset: 0,
      sessionLaneHeight: 120,
      metrics: {
        totalDuration: sessionData.endTime ? sessionData.endTime - sessionData.startTime : 0,
        agentCount: sessionData.agents.length,
        messageCount: sessionData.messages.length,
        batchCount: 1,
        averageAgentDuration: 0,
        completionRate: 0,
        errorRate: 0
      },
      color: this.generateSessionColor(0)
    };
  }
  
  /**
   * Check if data is in SessionTimelineData format
   */
  static isTimelineData(data: any): data is SessionTimelineData {
    return data && 
           typeof data.sessionId === 'string' &&
           Array.isArray(data.agentPaths);
  }
  
  /**
   * Check if data is in SessionData format
   */
  static isSessionData(data: any): data is SessionData {
    return data && 
           typeof data.sessionId === 'string' &&
           Array.isArray(data.agents);
  }
  
  /**
   * Auto-detect format and convert to SessionData
   */
  static normalizeToSessionData(data: SessionTimelineData | SessionData): SessionData {
    if (this.isTimelineData(data)) {
      return this.timelineToSessionData(data);
    } else if (this.isSessionData(data)) {
      return data;
    } else {
      console.warn('Unknown session data format, attempting conversion:', data);
      // Fallback: assume it's timeline data
      return this.timelineToSessionData(data as SessionTimelineData);
    }
  }
  
  /**
   * Auto-detect format and convert array to SessionData[]
   */
  static normalizeToSessionDataArray(dataArray: (SessionTimelineData | SessionData)[]): SessionData[] {
    return dataArray.map(data => this.normalizeToSessionData(data));
  }
  
  /**
   * Filter adapter - applies filters to mixed format data
   */
  static applyFiltersWithAdaptation(
    sessions: (SessionTimelineData | SessionData)[]
  ): SessionData[] {
    // Normalize all sessions to SessionData format first
    const normalizedSessions = this.normalizeToSessionDataArray(sessions);
    
    // Apply filters (SessionFilterUtils will be imported separately)
    // For now, return the normalized sessions
    return normalizedSessions;
  }
  
  // Helper methods
  private static getAgentTypeColor(type: string): string {
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
  
  private static generateSessionColor(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[index % colors.length];
  }
  
  /**
   * Create mock session data for testing
   */
  static createMockSessionData(count: number = 5): SessionData[] {
    const now = Date.now();
    const sessions: SessionData[] = [];
    
    for (let i = 0; i < count; i++) {
      const startTime = now - (Math.random() * 3600000); // Random start within last hour
      const duration = Math.random() * 1800000; // Random duration up to 30 minutes
      const agentCount = Math.floor(Math.random() * 10) + 1;
      
      sessions.push({
        sessionId: `session-${i + 1}`,
        displayName: `Session ${i + 1}`,
        startTime,
        endTime: startTime + duration,
        status: ['active', 'completed', 'failed'][Math.floor(Math.random() * 3)] as any,
        agentCount,
        agents: Array.from({ length: agentCount }, (_, j) => {
          const agentStartTime = startTime + (j * 1000);
          const agentDuration = Math.random() * (duration - (j * 1000));
          const agentEndTime = Math.random() > 0.3 ? agentStartTime + agentDuration : undefined; // 30% chance of in-progress
          
          return {
            agentId: `agent-${i + 1}-${j + 1}`,
            name: `Agent${j + 1}`,
            type: ['engineer', 'architect', 'tester', 'reviewer', 'planner', 'gatekeeper'][j % 6],
            startTime: agentStartTime,
            endTime: agentEndTime,
            status: agentEndTime ? 'completed' : 'in_progress' as any,
            laneIndex: j + 1
          };
        }),
        messages: []
      });
    }
    
    return sessions;
  }
  
  /**
   * Validate session data integrity
   */
  static validateSessionData(data: SessionData): string[] {
    const errors: string[] = [];
    
    if (!data.sessionId) {
      errors.push('Missing sessionId');
    }
    
    if (!data.displayName) {
      errors.push('Missing displayName');
    }
    
    if (!data.startTime || data.startTime <= 0) {
      errors.push('Invalid startTime');
    }
    
    if (data.endTime && data.endTime <= data.startTime) {
      errors.push('endTime must be after startTime');
    }
    
    if (!Array.isArray(data.agents)) {
      errors.push('agents must be an array');
    }
    
    if (data.agentCount !== data.agents.length) {
      errors.push('agentCount does not match agents array length');
    }
    
    return errors;
  }
}