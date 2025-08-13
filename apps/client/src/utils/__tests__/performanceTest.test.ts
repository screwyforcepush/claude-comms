/**
 * Performance Test Utilities Tests
 * 
 * Test suite for performance testing utilities with consolidated agent structure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimelinePerformanceTester, runQuickPerformanceTest } from '../performanceTest';

// Mock the timelineTestData module since it might not exist
vi.mock('../timelineTestData', () => ({
  generateStressTestData: (agentCount: number) => ({
    agents: Array.from({ length: agentCount }, (_, i) => ({
      id: i,
      name: `Agent${i}`,
      subagent_type: i % 4 === 0 ? 'gatekeeper' : 
                    i % 4 === 1 ? 'engineer' : 
                    i % 4 === 2 ? 'architect' : 'planner',
      created_at: Date.now() - (agentCount - i) * 1000,
      completion_timestamp: Date.now() - (agentCount - i - 1) * 1000,
      status: 'completed'
    })),
    messages: Array.from({ length: agentCount * 2 }, (_, i) => ({
      id: i,
      sender: `Agent${Math.floor(i / 2)}`,
      message: `Message ${i}`,
      created_at: Date.now() - (agentCount * 2 - i) * 500
    }))
  })
}));

describe('Performance Test Utilities', () => {
  let tester: TimelinePerformanceTester;
  let consoleSpy: any;

  beforeEach(() => {
    tester = new TimelinePerformanceTester();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock performance.memory for consistent testing
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024 // 50MB
      },
      configurable: true
    });
    
    // Mock DOM methods
    Object.defineProperty(document, 'querySelector', {
      value: vi.fn(() => ({
        querySelectorAll: vi.fn(() => Array.from({ length: 100 }, () => ({})))
      })),
      configurable: true
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('TimelinePerformanceTester', () => {
    it('should initialize with default configuration', () => {
      expect(tester).toBeDefined();
      // Access private config through testing
      const config = (tester as any).config;
      expect(config.agentCounts).toEqual([50, 100, 200, 500]);
      expect(config.targetFPS).toBe(30);
      expect(config.maxRenderTime).toBe(33.33);
    });

    it('should handle agent count testing with consolidated types', async () => {
      // Mock shorter test for speed
      (tester as any).config.agentCounts = [10];
      (tester as any).config.iterations = 1;

      const results = await tester.runPerformanceTests();
      
      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('10 Agents Test');
      expect(results[0].agentCount).toBe(10);
      expect(results[0].messageCount).toBe(20); // 2 messages per agent
      expect(typeof results[0].renderTime).toBe('number');
      expect(typeof results[0].fps).toBe('number');
      expect(typeof results[0].passed).toBe('boolean');
    });

    it('should measure render performance correctly', async () => {
      const testData = {
        agents: Array.from({ length: 5 }, (_, i) => ({
          id: i,
          name: `TestAgent${i}`,
          subagent_type: 'gatekeeper',
          created_at: Date.now() - (5 - i) * 1000,
          completion_timestamp: Date.now() - (5 - i - 1) * 1000,
          status: 'completed' as const
        })),
        messages: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          sender: `Agent${Math.floor(i / 2)}`,
          message: `Test message ${i}`,
          created_at: Date.now() - (10 - i) * 500
        }))
      };

      const results = await (tester as any).measureRenderPerformance(testData, 2);
      
      expect(results).toHaveLength(2);
      results.forEach(time => {
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(1000); // Should be reasonable
      });
    });

    it('should simulate timeline rendering operations', async () => {
      const testData = {
        agents: [
          {
            id: 1,
            name: 'TestGatekeeper',
            subagent_type: 'gatekeeper',
            created_at: Date.now() - 5000,
            completion_timestamp: Date.now() - 1000,
            status: 'completed' as const
          }
        ],
        messages: [
          {
            id: 1,
            sender: 'TestGatekeeper',
            message: 'Quality check completed',
            created_at: Date.now() - 3000
          }
        ]
      };

      // Should complete without errors
      await expect((tester as any).simulateTimelineRender(testData)).resolves.toBeUndefined();
    });

    it('should generate mock SVG paths for different agent types', () => {
      const agent = {
        id: 1,
        name: 'TestGatekeeper',
        subagent_type: 'gatekeeper',
        created_at: 1000,
        completion_timestamp: 2000,
        status: 'completed' as const
      };

      const timeRange = { start: 0, end: 3000 };
      const path = (tester as any).generateMockSVGPath(agent, timeRange);
      
      expect(path).toMatch(/^M \d+,\d+ Q \d+,\d+ \d+,\d+$/);
      expect(path).toContain('M'); // Move command
      expect(path).toContain('Q'); // Quadratic curve
    });

    it('should calculate mock message positions', () => {
      const message = {
        id: 1,
        sender: 'TestAgent',
        message: 'Test message',
        created_at: 1500
      };

      const timeRange = { start: 1000, end: 2000 };
      const position = (tester as any).calculateMockMessagePosition(message, timeRange);
      
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(1000);
      expect(position.y).toBeGreaterThan(0);
      expect(typeof position.x).toBe('number');
      expect(typeof position.y).toBe('number');
    });

    it('should measure memory usage when available', () => {
      const memory = (tester as any).measureMemoryUsage();
      expect(memory).toBe(50); // 50MB as mocked
    });

    it('should count DOM nodes correctly', () => {
      const nodeCount = (tester as any).countTimelineDOMNodes();
      expect(nodeCount).toBe(100); // As mocked
    });

    it('should export results in correct format', async () => {
      // Run a quick test first
      (tester as any).config.agentCounts = [5];
      (tester as any).config.iterations = 1;
      await tester.runPerformanceTests();

      const exported = tester.exportResults();
      const parsed = JSON.parse(exported);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.config).toBeDefined();
      expect(parsed.results).toBeInstanceOf(Array);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalTests).toBeGreaterThan(0);
    });
  });

  describe('Quick Performance Test', () => {
    it('should run quick performance test successfully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(runQuickPerformanceTest(10)).resolves.toBeUndefined();
      
      // Should log results
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quick performance test with 10 agents')
      );
      
      warnSpy.mockRestore();
    });

    it('should handle performance measurement correctly', async () => {
      const startSpy = vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1050); // End time

      await runQuickPerformanceTest(5);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('50.00ms render time')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('20.0 FPS')
      );

      startSpy.mockRestore();
    });
  });

  describe('Consolidated Agent Type Handling', () => {
    it('should handle all consolidated agent types in performance tests', async () => {
      const agentTypes = ['architect', 'engineer', 'gatekeeper', 'planner', 'business-analyst'];
      
      const testData = {
        agents: agentTypes.map((type, i) => ({
          id: i,
          name: `${type}Agent`,
          subagent_type: type,
          created_at: Date.now() - (agentTypes.length - i) * 1000,
          completion_timestamp: Date.now() - (agentTypes.length - i - 1) * 1000,
          status: 'completed' as const
        })),
        messages: []
      };

      // Should handle all agent types without errors
      await expect((tester as any).simulateTimelineRender(testData)).resolves.toBeUndefined();
    });

    it('should maintain performance with consolidated agent structure', async () => {
      // Test that consolidated agent structure doesn't negatively impact performance
      const startTime = performance.now();
      
      const testData = {
        agents: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Agent${i}`,
          subagent_type: i % 3 === 0 ? 'gatekeeper' : 
                        i % 3 === 1 ? 'engineer' : 'architect',
          created_at: Date.now() - (100 - i) * 10,
          completion_timestamp: Date.now() - (100 - i - 1) * 10,
          status: 'completed' as const
        })),
        messages: []
      };

      await (tester as any).simulateTimelineRender(testData);
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty test data gracefully', async () => {
      const emptyData = { agents: [], messages: [] };
      
      await expect((tester as any).simulateTimelineRender(emptyData)).resolves.toBeUndefined();
    });

    it('should handle missing performance.memory gracefully', () => {
      // Remove performance.memory
      delete (performance as any).memory;
      
      const memory = (tester as any).measureMemoryUsage();
      expect(memory).toBe(0);
    });

    it('should handle missing DOM elements gracefully', () => {
      document.querySelector = vi.fn(() => null);
      
      const nodeCount = (tester as any).countTimelineDOMNodes();
      expect(nodeCount).toBe(0);
    });

    it('should handle agents without completion timestamps', () => {
      const agent = {
        id: 1,
        name: 'IncompleteAgent',
        subagent_type: 'engineer',
        created_at: 1000,
        completion_timestamp: null,
        status: 'in_progress' as const
      };

      const timeRange = { start: 0, end: 3000 };
      const path = (tester as any).generateMockSVGPath(agent, timeRange);
      
      expect(path).toBeDefined();
      expect(path).toMatch(/^M \d+,\d+ Q \d+,\d+ \d+,\d+$/);
    });
  });
});