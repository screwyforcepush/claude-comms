/**
 * Type helpers and compatibility layer for timeline components
 * Provides simplified type definitions to fix build issues
 */

// Simplified transform options
export interface TimelineTransformOptions {
  batchThreshold?: number;
  laneHeight?: number;
  simplifyPaths?: boolean;
}

// Extended agent status to match timeline needs
export interface ExtendedAgentStatus {
  agentId: string;
  type: string;
  startTime: number;
  endTime: number | null;
  status: 'pending' | 'in_progress' | 'completed';
  laneIndex: number;
  isRecentlyUpdated: boolean;
  id: number;
  name: string;
  subagent_type: string;
  created_at: number;
  duration?: number;
  token_count?: number;
  tool_count?: number;
  completion_timestamp?: number;
  session_id?: string;
}

// Extended message for timeline display
export interface ExtendedTimelineMessage {
  id: string;
  isRecentlyAdded: boolean;
  timestamp: number;
  position: { x: number; y: number };
  sender: string;
  message: any;
  created_at: number;
  notified?: string[];
}

// Helper function to convert AgentStatus to ExtendedAgentStatus
export function extendAgentStatus(agent: any): ExtendedAgentStatus {
  return {
    agentId: agent.id?.toString() || agent.agentId || `agent-${Date.now()}`,
    type: agent.subagent_type || agent.type || 'general-purpose',
    startTime: agent.created_at || Date.now(),
    endTime: agent.completion_timestamp || null,
    status: agent.status || 'pending',
    laneIndex: agent.laneIndex || 0,
    isRecentlyUpdated: false,
    id: agent.id,
    name: agent.name,
    subagent_type: agent.subagent_type,
    created_at: agent.created_at,
    duration: agent.duration,
    token_count: agent.token_count,
    tool_count: agent.tool_count,
    completion_timestamp: agent.completion_timestamp,
    session_id: agent.session_id
  };
}

// Helper function to convert SubagentMessage to ExtendedTimelineMessage
export function extendTimelineMessage(message: any, position: { x: number; y: number }): ExtendedTimelineMessage {
  return {
    id: `msg-${message.created_at}-${message.sender}`,
    isRecentlyAdded: false,
    timestamp: message.created_at,
    position,
    sender: message.sender,
    message: message.message,
    created_at: message.created_at,
    notified: message.notified
  };
}

// Simple batch interface
export interface SimpleBatch {
  id: string;
  spawnTimestamp: number;
  agents: any[];
  batchNumber: number;
}

// Color mapping for agent types
export const AGENT_TYPE_COLORS: Record<string, string> = {
  // Core consolidated agent types
  'architect': '#4ecdc4',           // Teal - System architects
  'engineer': '#ff6b6b',            // Red coral - Engineers (includes testing capabilities)
  'gatekeeper': '#10b981',          // Emerald - Quality gates (reviews, verification, validation)
  'planner': '#f97316',             // Orange - Project planners
  'business-analyst': '#d946ef',    // Magenta - Business analysts
  'designer': '#8b5cf6',            // Violet - UX/UI designers
  'deep-researcher': '#0ea5e9',     // Blue - Deep research specialists
  'agent-orchestrator': '#9ca3af',  // Gray - Agent orchestrator
  
  // Legacy aliases for backward compatibility
  'coder': '#ff6b6b',          // Maps to engineer
  'tester': '#ff6b6b',         // Maps to engineer
  'reviewer': '#10b981',       // Maps to gatekeeper
  'verifier': '#10b981',       // Maps to gatekeeper
  'green-verifier': '#10b981', // Maps to gatekeeper
  'code-reviewer': '#10b981',  // Maps to gatekeeper
  'analyst': '#d946ef',        // Maps to business-analyst
  'researcher': '#0ea5e9',     // Maps to deep-researcher
  'cloud-cicd': '#22c55e',     // Legacy - DevOps/deployment
  'general-purpose': '#9ca3af' // Legacy - General purpose
};

// Default color for unknown types with comprehensive legacy mapping
export function getAgentTypeColor(type: string): string {
  // Map legacy types to new consolidated types
  const typeMapping: Record<string, string> = {
    'code-reviewer': 'gatekeeper',
    'green-verifier': 'gatekeeper',
    'reviewer': 'gatekeeper',
    'verifier': 'gatekeeper',
    'tester': 'engineer',
    'coder': 'engineer',
    'analyst': 'business-analyst',
    'researcher': 'deep-researcher'
  };
  
  const mappedType = typeMapping[type] || type;
  return AGENT_TYPE_COLORS[mappedType] || AGENT_TYPE_COLORS['engineer'];
}

// Safe property access helpers
export function safeGetProperty<T>(obj: any, path: string, defaultValue: T): T {
  return obj?.[path] ?? defaultValue;
}

export function safeMapArray<T, R>(arr: T[] | undefined | null, mapFn: (item: T) => R): R[] {
  return Array.isArray(arr) ? arr.map(mapFn) : [];
}

// Timeline configuration with safe defaults
export const SAFE_TIMELINE_CONFIG = {
  width: 1200,
  height: 600,
  margins: { top: 60, right: 60, bottom: 60, left: 120 },
  orchestratorY: 200,
  agentLaneHeight: 60,
  maxAgentLanes: 10,
  batchThreshold: 100,
  colors: {
    orchestrator: '#00d4ff',
    orchestratorGlow: '#00d4ff',
    userPrompt: '#ffffff',
    spawnPoint: '#3b82f6',
    message: '#ffffff',
    background: '#1f2937',
    grid: 'rgba(59, 130, 246, 0.1)',
    agentTypes: AGENT_TYPE_COLORS
  },
  animations: {
    enabled: true,
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};