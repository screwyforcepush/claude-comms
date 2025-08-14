// Real Session Data Service
// Fetches actual session data from the same APIs used by SubagentComms.vue

import type { SessionData, SessionAgent, SessionMessage } from '../utils/session-data-adapter';
import type { Session, AgentStatus, SubagentMessage } from '../types';

export class SessionDataService {
  private baseUrl = 'http://localhost:4000';

  /**
   * Fetch all sessions with agent counts (same as SubagentComms.vue line 223)
   */
  async fetchSessions(): Promise<Session[]> {
    try {
      const response = await fetch(`${this.baseUrl}/subagents/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      // Sort sessions by created_at DESC (same as SubagentComms.vue line 226-228)
      return data.sort((a: Session, b: Session) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      throw error;
    }
  }

  /**
   * Fetch agents for a specific session (same as SubagentComms.vue line 249)
   */
  async fetchSessionAgents(sessionId: string): Promise<AgentStatus[]> {
    try {
      const response = await fetch(`${this.baseUrl}/subagents/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agents for session ${sessionId}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch agents for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all messages (same as SubagentComms.vue line 255)
   */
  async fetchAllMessages(): Promise<SubagentMessage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/subagents/messages`);
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  }

  /**
   * Transform Session and AgentStatus data to SessionData format
   * This bridges the gap between the database format and timeline component format
   */
  private transformToSessionData(
    session: Session, 
    agents: AgentStatus[], 
    allMessages: SubagentMessage[]
  ): SessionData {
    // Filter messages to only those from agents in this session (same logic as SubagentComms.vue line 259-262)
    const sessionAgentNames = agents.map(a => a.name);
    const sessionMessages = allMessages.filter(msg => 
      sessionAgentNames.includes(msg.sender)
    );

    // Transform agents to SessionAgent format
    const transformedAgents: SessionAgent[] = agents.map((agent, index) => ({
      agentId: agent.id?.toString() || `${session.session_id}-${index}`,
      name: agent.name,
      type: agent.subagent_type || 'unknown',
      startTime: new Date(agent.created_at).getTime(),
      endTime: agent.completion_timestamp ? new Date(agent.completion_timestamp).getTime() : undefined,
      status: (agent.status as 'pending' | 'in_progress' | 'completed' | 'error') || 'pending',
      laneIndex: index + 1
    }));

    // Transform messages to SessionMessage format
    const transformedMessages: SessionMessage[] = sessionMessages.map((msg, index) => ({
      id: msg.id?.toString() || `msg-${index}`,
      timestamp: new Date(msg.created_at).getTime(),
      sender: msg.sender,
      content: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
      recipients: msg.notified || []
    }));

    // Determine session status based on agent statuses
    let sessionStatus: 'active' | 'completed' | 'failed' = 'active';
    if (agents.every(agent => agent.status === 'completed')) {
      sessionStatus = 'completed';
    } else if (agents.some(agent => agent.status === 'error')) {
      sessionStatus = 'failed';
    }

    // Calculate session end time
    const endTimes = agents
      .filter(agent => agent.completion_timestamp)
      .map(agent => new Date(agent.completion_timestamp!).getTime());
    const sessionEndTime = endTimes.length > 0 ? Math.max(...endTimes) : undefined;

    return {
      sessionId: session.session_id,
      displayName: session.session_id, // Use session_id as display name for now
      startTime: new Date(session.created_at).getTime(),
      endTime: sessionEndTime,
      status: sessionStatus,
      agentCount: session.agent_count,
      agents: transformedAgents,
      messages: transformedMessages
    };
  }

  /**
   * Fetch complete session data for multiple sessions
   * Returns data in the format expected by InteractiveSessionsTimeline
   */
  async fetchSessionsData(limit: number = 10): Promise<SessionData[]> {
    try {
      // Step 1: Fetch all sessions (same as SubagentComms refreshSessions)
      const sessions = await this.fetchSessions();
      
      // Step 2: Fetch all messages once (same as SubagentComms loadSessionData)
      const allMessages = await this.fetchAllMessages();
      
      // Step 3: Fetch agents for each session and transform data
      const sessionDataPromises = sessions.slice(0, limit).map(async (session) => {
        try {
          const agents = await this.fetchSessionAgents(session.session_id);
          return this.transformToSessionData(session, agents, allMessages);
        } catch (error) {
          console.error(`Failed to fetch data for session ${session.session_id}:`, error);
          // Return minimal session data if agent fetch fails
          return {
            sessionId: session.session_id,
            displayName: session.session_id,
            startTime: new Date(session.created_at).getTime(),
            endTime: undefined,
            status: 'failed' as const,
            agentCount: session.agent_count,
            agents: [],
            messages: []
          };
        }
      });

      const sessionData = await Promise.all(sessionDataPromises);
      console.log(`✅ DataDetective: Fetched real data for ${sessionData.length} sessions`);
      return sessionData;
      
    } catch (error) {
      console.error('Failed to fetch sessions data:', error);
      throw error;
    }
  }

  /**
   * Fetch data for a single session
   */
  async fetchSingleSessionData(sessionId: string): Promise<SessionData | null> {
    try {
      // Fetch session info from the sessions list
      const sessions = await this.fetchSessions();
      const session = sessions.find(s => s.session_id === sessionId);
      
      if (!session) {
        console.warn(`Session ${sessionId} not found`);
        return null;
      }

      // Fetch agents and messages
      const [agents, allMessages] = await Promise.all([
        this.fetchSessionAgents(sessionId),
        this.fetchAllMessages()
      ]);

      return this.transformToSessionData(session, agents, allMessages);
    } catch (error) {
      console.error(`Failed to fetch data for session ${sessionId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const sessionDataService = new SessionDataService();