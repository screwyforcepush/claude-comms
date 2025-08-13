/**
 * Type Helper Utilities Tests
 * 
 * Test suite for type helper functions focusing on agent consolidation
 * and backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_TYPE_COLORS,
  getAgentTypeColor,
  extendAgentStatus,
  extendTimelineMessage,
  safeGetProperty,
  safeMapArray,
  SAFE_TIMELINE_CONFIG
} from '../typeHelpers';

describe('Type Helpers - Agent Consolidation', () => {
  describe('Agent Type Colors with Legacy Support', () => {
    it('should have colors for all core consolidated agent types', () => {
      const coreTypes = [
        'architect',
        'engineer',
        'gatekeeper',
        'planner',
        'business-analyst',
        'designer',
        'deep-researcher',
        'agent-orchestrator'
      ];

      coreTypes.forEach(type => {
        expect(AGENT_TYPE_COLORS[type]).toBeDefined();
        expect(AGENT_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should support legacy agent types for backward compatibility', () => {
      const legacyTypes = [
        'code-reviewer',
        'green-verifier',
        'tester',
        'coder',
        'reviewer',
        'verifier',
        'analyst',
        'researcher'
      ];

      legacyTypes.forEach(type => {
        expect(AGENT_TYPE_COLORS[type]).toBeDefined();
        expect(AGENT_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should map legacy types to consolidated colors correctly', () => {
      // Gatekeeper consolidation
      expect(AGENT_TYPE_COLORS['code-reviewer']).toBe('#10b981');
      expect(AGENT_TYPE_COLORS['green-verifier']).toBe('#10b981');
      expect(AGENT_TYPE_COLORS['reviewer']).toBe('#10b981');
      expect(AGENT_TYPE_COLORS['verifier']).toBe('#10b981');
      expect(AGENT_TYPE_COLORS['gatekeeper']).toBe('#10b981');

      // Engineer consolidation (includes testing)
      expect(AGENT_TYPE_COLORS['tester']).toBe('#ff6b6b');
      expect(AGENT_TYPE_COLORS['coder']).toBe('#ff6b6b');
      expect(AGENT_TYPE_COLORS['engineer']).toBe('#ff6b6b');

      // Business analyst mapping
      expect(AGENT_TYPE_COLORS['analyst']).toBe('#d946ef');
      expect(AGENT_TYPE_COLORS['business-analyst']).toBe('#d946ef');

      // Researcher mapping
      expect(AGENT_TYPE_COLORS['researcher']).toBe('#0ea5e9');
      expect(AGENT_TYPE_COLORS['deep-researcher']).toBe('#0ea5e9');
    });
  });

  describe('getAgentTypeColor with Legacy Mapping', () => {
    it('should return correct colors for core agent types', () => {
      expect(getAgentTypeColor('gatekeeper')).toBe('#10b981');
      expect(getAgentTypeColor('engineer')).toBe('#ff6b6b');
      expect(getAgentTypeColor('architect')).toBe('#4ecdc4');
    });

    it('should map legacy types to consolidated agent colors', () => {
      // Legacy quality gate types → gatekeeper
      expect(getAgentTypeColor('code-reviewer')).toBe('#10b981');
      expect(getAgentTypeColor('green-verifier')).toBe('#10b981');
      expect(getAgentTypeColor('reviewer')).toBe('#10b981');
      expect(getAgentTypeColor('verifier')).toBe('#10b981');

      // Legacy engineer types → engineer
      expect(getAgentTypeColor('tester')).toBe('#ff6b6b');
      expect(getAgentTypeColor('coder')).toBe('#ff6b6b');

      // Legacy analyst types → business-analyst
      expect(getAgentTypeColor('analyst')).toBe('#d946ef');

      // Legacy researcher types → deep-researcher
      expect(getAgentTypeColor('researcher')).toBe('#0ea5e9');
    });

    it('should return engineer color for unknown types', () => {
      expect(getAgentTypeColor('unknown-agent-type')).toBe('#ff6b6b');
      expect(getAgentTypeColor('')).toBe('#ff6b6b');
    });
  });

  describe('Agent Status Extension', () => {
    it('should extend agent status with all required fields', () => {
      const mockAgent = {
        id: 123,
        name: 'TestAgent',
        subagent_type: 'gatekeeper',
        created_at: 1640995200000,
        status: 'completed',
        completion_timestamp: 1640995300000
      };

      const extended = extendAgentStatus(mockAgent);

      expect(extended.agentId).toBe('123');
      expect(extended.type).toBe('gatekeeper');
      expect(extended.startTime).toBe(1640995200000);
      expect(extended.endTime).toBe(1640995300000);
      expect(extended.status).toBe('completed');
      expect(extended.laneIndex).toBe(0);
      expect(extended.isRecentlyUpdated).toBe(false);
    });

    it('should handle legacy agent types in extension', () => {
      const legacyAgent = {
        id: 456,
        name: 'LegacyReviewer',
        subagent_type: 'code-reviewer', // Legacy type
        created_at: 1640995200000,
        status: 'in_progress'
      };

      const extended = extendAgentStatus(legacyAgent);

      expect(extended.type).toBe('code-reviewer'); // Preserves original type
      expect(extended.agentId).toBe('456');
      expect(extended.endTime).toBeNull();
    });

    it('should provide defaults for missing fields', () => {
      const minimalAgent = {};

      const extended = extendAgentStatus(minimalAgent);

      expect(extended.agentId).toMatch(/^agent-\d+$/);
      expect(extended.type).toBe('general-purpose');
      expect(extended.status).toBe('pending');
      expect(extended.startTime).toBeGreaterThan(0);
      expect(extended.endTime).toBeNull();
    });
  });

  describe('Timeline Message Extension', () => {
    it('should extend timeline message correctly', () => {
      const mockMessage = {
        sender: 'TestGatekeeper',
        message: 'Code review completed',
        created_at: 1640995250000,
        notified: ['Agent1', 'Agent2']
      };

      const position = { x: 100, y: 50 };
      const extended = extendTimelineMessage(mockMessage, position);

      expect(extended.id).toBe('msg-1640995250000-TestGatekeeper');
      expect(extended.sender).toBe('TestGatekeeper');
      expect(extended.message).toBe('Code review completed');
      expect(extended.timestamp).toBe(1640995250000);
      expect(extended.position).toEqual(position);
      expect(extended.isRecentlyAdded).toBe(false);
      expect(extended.notified).toEqual(['Agent1', 'Agent2']);
    });
  });

  describe('Safe Property Access', () => {
    it('should safely get properties with defaults', () => {
      const obj = { name: 'test', count: 5 };

      expect(safeGetProperty(obj, 'name', 'default')).toBe('test');
      expect(safeGetProperty(obj, 'missing', 'default')).toBe('default');
      expect(safeGetProperty(null, 'name', 'default')).toBe('default');
      expect(safeGetProperty(undefined, 'name', 'default')).toBe('default');
    });

    it('should handle different data types', () => {
      const obj = { count: 0, flag: false, list: [] };

      expect(safeGetProperty(obj, 'count', 10)).toBe(0);
      expect(safeGetProperty(obj, 'flag', true)).toBe(false);
      expect(safeGetProperty(obj, 'list', null)).toEqual([]);
    });
  });

  describe('Safe Array Mapping', () => {
    it('should safely map valid arrays', () => {
      const arr = [1, 2, 3];
      const result = safeMapArray(arr, x => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should return empty array for invalid inputs', () => {
      expect(safeMapArray(null, x => x * 2)).toEqual([]);
      expect(safeMapArray(undefined, x => x * 2)).toEqual([]);
      expect(safeMapArray('not-array' as any, x => x * 2)).toEqual([]);
    });

    it('should handle empty arrays', () => {
      const result = safeMapArray([], x => x * 2);
      expect(result).toEqual([]);
    });
  });

  describe('Safe Timeline Configuration', () => {
    it('should have valid default configuration', () => {
      expect(SAFE_TIMELINE_CONFIG.width).toBeGreaterThan(0);
      expect(SAFE_TIMELINE_CONFIG.height).toBeGreaterThan(0);
      expect(SAFE_TIMELINE_CONFIG.margins).toBeDefined();
      expect(SAFE_TIMELINE_CONFIG.colors).toBeDefined();
      expect(SAFE_TIMELINE_CONFIG.animations).toBeDefined();
    });

    it('should include consolidated agent colors', () => {
      const agentColors = SAFE_TIMELINE_CONFIG.colors.agentTypes;
      
      // Core consolidated types
      expect(agentColors.gatekeeper).toBe('#10b981');
      expect(agentColors.engineer).toBe('#ff6b6b');
      expect(agentColors.architect).toBe('#4ecdc4');
      
      // Legacy types should still be present for compatibility
      expect(agentColors['code-reviewer']).toBeDefined();
      expect(agentColors['green-verifier']).toBeDefined();
      expect(agentColors.tester).toBeDefined();
    });

    it('should have reasonable default values', () => {
      expect(SAFE_TIMELINE_CONFIG.orchestratorY).toBe(200);
      expect(SAFE_TIMELINE_CONFIG.agentLaneHeight).toBe(60);
      expect(SAFE_TIMELINE_CONFIG.maxAgentLanes).toBe(10);
      expect(SAFE_TIMELINE_CONFIG.batchThreshold).toBe(100);
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle malformed agent data gracefully', () => {
    const malformedData = [
      null,
      undefined,
      {},
      { id: null },
      { subagent_type: null },
      { created_at: 'invalid' }
    ];

    malformedData.forEach(data => {
      expect(() => extendAgentStatus(data)).not.toThrow();
      const result = extendAgentStatus(data);
      expect(result.agentId).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.startTime).toBeGreaterThan(0);
    });
  });

  it('should handle malformed message data gracefully', () => {
    const malformedData = [
      null,
      undefined,
      {},
      { sender: null },
      { created_at: 'invalid' }
    ];

    const position = { x: 0, y: 0 };

    malformedData.forEach(data => {
      expect(() => extendTimelineMessage(data, position)).not.toThrow();
      const result = extendTimelineMessage(data, position);
      expect(result.id).toBeDefined();
      expect(result.position).toEqual(position);
    });
  });
});