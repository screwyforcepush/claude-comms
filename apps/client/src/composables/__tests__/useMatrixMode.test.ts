/**
 * Unit Tests for useMatrixMode Composable
 * 
 * Comprehensive test suite covering:
 * - State management and reactivity
 * - Mode toggle functionality
 * - Configuration management
 * - Drop lifecycle management
 * - Memory management (50MB limit)
 * - Performance monitoring
 * - LocalStorage persistence
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { nextTick } from 'vue';
import { useMatrixMode, DEFAULT_CONFIG, MATRIX_CHARACTERS } from '../useMatrixMode';
import type { HookEvent } from '../../types';
import type { MatrixDrop, MatrixConfig, MatrixPreset } from '../../types/matrix';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = vi.fn();

// Helper function to create test HookEvent
function createTestEvent(overrides: Partial<HookEvent> = {}): HookEvent {
  return {
    id: 1,
    timestamp: Date.now(),
    hook_event_type: 'agent_spawn',
    session_id: 'test-session-123',
    source_app: 'test-app',
    payload: { agentName: 'TestAgent' },
    created_at: new Date().toISOString(),
    ...overrides
  };
}

// Helper function to create test drop
function createTestDrop(overrides: Partial<MatrixDrop> = {}): MatrixDrop {
  return {
    id: 'test-drop-1',
    column: 0,
    position: 0,
    speed: 1,
    characters: [],
    isEventDrop: false,
    spawnTime: Date.now(),
    lastUpdate: Date.now(),
    brightness: 1,
    trail: true,
    ...overrides
  };
}

describe('useMatrixMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const matrixMode = useMatrixMode();

      expect(matrixMode.isEnabled.value).toBe(false);
      expect(matrixMode.isTransitioning.value).toBe(false);
      expect(matrixMode.drops.value).toEqual([]);
      expect(matrixMode.config.value).toEqual(DEFAULT_CONFIG);
    });

    it('should create empty drop pool on initialization', () => {
      const matrixMode = useMatrixMode();

      expect(matrixMode.dropPool.value.available).toEqual([]);
      expect(matrixMode.dropPool.value.active.size).toBe(0);
      expect(matrixMode.dropPool.value.maxSize).toBe(1000);
    });

    it('should initialize performance metrics', () => {
      const matrixMode = useMatrixMode();

      expect(matrixMode.performance.value.fps).toBe(60);
      expect(matrixMode.performance.value.dropCount).toBe(0);
      expect(matrixMode.performance.value.characterCount).toBe(0);
      expect(matrixMode.performance.value.memoryUsage).toBe(0);
      expect(matrixMode.performance.value.isThrottling).toBe(false);
    });
  });

  describe('Mode Toggle', () => {
    it('should enable Matrix mode correctly', async () => {
      const matrixMode = useMatrixMode();

      expect(matrixMode.isEnabled.value).toBe(false);

      await matrixMode.enable();

      expect(matrixMode.isEnabled.value).toBe(true);
      expect(matrixMode.isTransitioning.value).toBe(false);
    });

    it('should disable Matrix mode correctly', async () => {
      const matrixMode = useMatrixMode();

      await matrixMode.enable();
      expect(matrixMode.isEnabled.value).toBe(true);

      await matrixMode.disable();

      expect(matrixMode.isEnabled.value).toBe(false);
      expect(matrixMode.isTransitioning.value).toBe(false);
    });

    it('should toggle Matrix mode', async () => {
      const matrixMode = useMatrixMode();

      expect(matrixMode.isEnabled.value).toBe(false);

      await matrixMode.toggle();
      expect(matrixMode.isEnabled.value).toBe(true);

      await matrixMode.toggle();
      expect(matrixMode.isEnabled.value).toBe(false);
    });

    it('should set transitioning state during toggle', async () => {
      const matrixMode = useMatrixMode();
      
      const enablePromise = matrixMode.enable();
      
      // Should be transitioning immediately
      expect(matrixMode.isTransitioning.value).toBe(true);
      
      await enablePromise;
      
      // Should not be transitioning after completion
      expect(matrixMode.isTransitioning.value).toBe(false);
    });

    it('should not enable if already enabled', async () => {
      const matrixMode = useMatrixMode();

      await matrixMode.enable();
      expect(matrixMode.isEnabled.value).toBe(true);

      // Try to enable again
      await matrixMode.enable();
      expect(matrixMode.isEnabled.value).toBe(true);
    });

    it('should clear drops when disabling', async () => {
      const matrixMode = useMatrixMode();

      // Add some drops
      const testDrop = createTestDrop();
      matrixMode.addDrop(testDrop);
      expect(matrixMode.drops.value.length).toBe(1);

      await matrixMode.enable();
      await matrixMode.disable();

      expect(matrixMode.drops.value.length).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const matrixMode = useMatrixMode();

      const newConfig: Partial<MatrixConfig> = {
        dropSpeed: 100,
        trailLength: 15,
        glowIntensity: 0.8
      };

      matrixMode.updateConfig(newConfig);

      expect(matrixMode.config.value.dropSpeed).toBe(100);
      expect(matrixMode.config.value.trailLength).toBe(15);
      expect(matrixMode.config.value.glowIntensity).toBe(0.8);
      // Other config should remain unchanged
      expect(matrixMode.config.value.columnWidth).toBe(DEFAULT_CONFIG.columnWidth);
    });

    it('should reset configuration to defaults', () => {
      const matrixMode = useMatrixMode();

      // Modify config first
      matrixMode.updateConfig({ dropSpeed: 200, trailLength: 5 });
      expect(matrixMode.config.value.dropSpeed).toBe(200);

      // Reset
      matrixMode.resetConfig();

      expect(matrixMode.config.value).toEqual(DEFAULT_CONFIG);
    });

    it('should apply presets correctly', () => {
      const matrixMode = useMatrixMode();

      // Apply performance preset
      matrixMode.applyPreset('performance');

      expect(matrixMode.config.value.maxDrops).toBe(500);
      expect(matrixMode.config.value.trailLength).toBe(8);
      expect(matrixMode.config.value.glowIntensity).toBe(0.3);
    });

    it('should save configuration to localStorage', () => {
      const matrixMode = useMatrixMode();

      const newConfig = { dropSpeed: 150 };
      matrixMode.updateConfig(newConfig);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'matrix-mode-state',
        expect.stringContaining('dropSpeed')
      );
    });
  });

  describe('Drop Management', () => {
    it('should add drops correctly', () => {
      const matrixMode = useMatrixMode();

      const testDrop = createTestDrop();
      matrixMode.addDrop(testDrop);

      expect(matrixMode.drops.value.length).toBe(1);
      expect(matrixMode.drops.value[0]).toStrictEqual(testDrop);
      expect(matrixMode.dropPool.value.active.has(testDrop.id)).toBe(true);
      expect(matrixMode.performance.value.dropCount).toBe(1);
    });

    it('should remove drops correctly', () => {
      const matrixMode = useMatrixMode();

      const testDrop = createTestDrop();
      matrixMode.addDrop(testDrop);
      expect(matrixMode.drops.value.length).toBe(1);

      matrixMode.removeDrop(testDrop.id);

      expect(matrixMode.drops.value.length).toBe(0);
      expect(matrixMode.dropPool.value.active.has(testDrop.id)).toBe(false);
      expect(matrixMode.performance.value.dropCount).toBe(0);
    });

    it('should clear all drops', () => {
      const matrixMode = useMatrixMode();

      // Add multiple drops
      for (let i = 0; i < 5; i++) {
        matrixMode.addDrop(createTestDrop({ id: `drop-${i}` }));
      }
      expect(matrixMode.drops.value.length).toBe(5);

      matrixMode.clearAllDrops();

      expect(matrixMode.drops.value.length).toBe(0);
      expect(matrixMode.dropPool.value.active.size).toBe(0);
      expect(matrixMode.performance.value.dropCount).toBe(0);
    });

    it('should enforce maximum drop limit', () => {
      const matrixMode = useMatrixMode();

      // Set a low limit for testing
      matrixMode.updateConfig({ maxDrops: 3 });

      // Add drops beyond limit
      for (let i = 0; i < 5; i++) {
        matrixMode.addDrop(createTestDrop({ id: `drop-${i}` }));
      }

      // Should only keep the last 3 drops
      expect(matrixMode.drops.value.length).toBe(3);
      expect(matrixMode.drops.value[0].id).toBe('drop-2');
      expect(matrixMode.drops.value[2].id).toBe('drop-4');
    });

    it('should reuse drops from pool', () => {
      const matrixMode = useMatrixMode();

      const testDrop = createTestDrop();
      
      // Add and remove drop
      matrixMode.addDrop(testDrop);
      matrixMode.removeDrop(testDrop.id);

      // Pool should have the drop available for reuse
      expect(matrixMode.dropPool.value.available.length).toBe(1);
    });
  });

  describe('Event Processing', () => {
    it('should process single event when enabled', () => {
      const matrixMode = useMatrixMode();

      // Enable matrix mode first
      matrixMode.state.value.isEnabled = true;

      const testEvent = createTestEvent();
      matrixMode.processEvent(testEvent);

      expect(matrixMode.drops.value.length).toBe(1);
      expect(matrixMode.drops.value[0].sourceEvent).toBe(testEvent);
      expect(matrixMode.drops.value[0].isEventDrop).toBe(true);
    });

    it('should not process events when disabled', () => {
      const matrixMode = useMatrixMode();

      const testEvent = createTestEvent();
      matrixMode.processEvent(testEvent);

      expect(matrixMode.drops.value.length).toBe(0);
    });

    it('should process event batch', () => {
      const matrixMode = useMatrixMode();
      matrixMode.state.value.isEnabled = true;

      const events = [
        createTestEvent({ id: 1 }),
        createTestEvent({ id: 2 }),
        createTestEvent({ id: 3 })
      ];

      matrixMode.processEventBatch(events);

      expect(matrixMode.drops.value.length).toBe(3);
      expect(matrixMode.drops.value.every(drop => drop.isEventDrop)).toBe(true);
    });

    it('should generate characters from event data', () => {
      const matrixMode = useMatrixMode();
      matrixMode.state.value.isEnabled = true;

      const testEvent = createTestEvent({
        hook_event_type: 'agent_spawn'
      });

      matrixMode.processEvent(testEvent);

      const drop = matrixMode.drops.value[0];
      expect(drop.characters.length).toBeGreaterThan(0);
      expect(drop.characters[0].char).toBe('A'); // First char of event type
      expect(drop.characters[0].isLeading).toBe(true);
    });

    it('should assign column based on session_id', () => {
      const matrixMode = useMatrixMode();
      matrixMode.state.value.isEnabled = true;

      const event1 = createTestEvent({ session_id: 'session-1' });
      const event2 = createTestEvent({ session_id: 'session-1' });
      const event3 = createTestEvent({ session_id: 'session-2' });

      matrixMode.processEvent(event1);
      matrixMode.processEvent(event2);
      matrixMode.processEvent(event3);

      // Same session should have same column
      expect(matrixMode.drops.value[0].column).toBe(matrixMode.drops.value[1].column);
      // Different session should have different column (with high probability)
      expect(matrixMode.drops.value[0].column).not.toBe(matrixMode.drops.value[2].column);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const matrixMode = useMatrixMode();

      // Add drops with characters
      for (let i = 0; i < 10; i++) {
        const drop = createTestDrop({
          characters: Array(10).fill(null).map(() => ({
            char: 'A',
            age: 0,
            brightness: 1,
            color: '#00ff00',
            isLeading: false,
            position: 0
          }))
        });
        matrixMode.addDrop(drop);
      }

      // Trigger memory calculation by updating performance metrics
      matrixMode.updatePerformanceMetrics();

      expect(matrixMode.getMemoryUsage()).toBeGreaterThan(0);
      expect(matrixMode.performance.value.memoryUsage).toBeGreaterThan(0);
    });

    it('should enforce memory limit', () => {
      const matrixMode = useMatrixMode();

      // Mock high memory usage
      matrixMode.performance.value.memoryUsage = 60; // Over 50MB limit

      // Add some drops
      for (let i = 0; i < 10; i++) {
        matrixMode.addDrop(createTestDrop({ id: `drop-${i}` }));
      }

      const initialDropCount = matrixMode.drops.value.length;
      
      matrixMode.enforceMemoryLimit();

      // Should have removed some drops
      expect(matrixMode.drops.value.length).toBeLessThan(initialDropCount);
    });
  });

  describe('Performance Monitoring', () => {
    it('should update performance metrics', () => {
      const matrixMode = useMatrixMode();

      // Set initial values
      matrixMode.performance.value.fps = 45;
      matrixMode.performance.value.lastMeasurement = Date.now() - 200;

      matrixMode.updatePerformanceMetrics();

      expect(matrixMode.performance.value.fpsHistory.length).toBeGreaterThan(0);
      expect(matrixMode.performance.value.lastMeasurement).toBeGreaterThan(0);
    });

    it('should throttle quality when FPS is low', () => {
      const matrixMode = useMatrixMode();

      // Enable adaptive quality
      matrixMode.updateConfig({ adaptiveQuality: true });

      // Set low FPS history
      matrixMode.performance.value.fpsHistory = [20, 22, 25, 23, 21];

      const originalTrailLength = matrixMode.config.value.trailLength;
      const originalGlowIntensity = matrixMode.config.value.glowIntensity;

      matrixMode.adjustQualityIfNeeded();

      expect(matrixMode.config.value.trailLength).toBeLessThan(originalTrailLength);
      expect(matrixMode.config.value.glowIntensity).toBeLessThan(originalGlowIntensity);
      expect(matrixMode.performance.value.isThrottling).toBe(true);
    });

    it('should increase quality when FPS is high', () => {
      const matrixMode = useMatrixMode();

      // Enable adaptive quality and set throttling
      matrixMode.updateConfig({ 
        adaptiveQuality: true,
        trailLength: 8,
        glowIntensity: 0.3
      });
      matrixMode.performance.value.isThrottling = true;

      // Set high FPS history
      matrixMode.performance.value.fpsHistory = [58, 59, 60, 59, 58];

      matrixMode.adjustQualityIfNeeded();

      expect(matrixMode.config.value.trailLength).toBeGreaterThan(8);
      expect(matrixMode.config.value.glowIntensity).toBeGreaterThan(0.3);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should load state from localStorage on initialization', () => {
      const savedState = {
        isEnabled: true,
        config: { dropSpeed: 80 },
        preset: 'performance',
        lastUsed: Date.now(),
        version: '1.0.0'
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedState));

      const matrixMode = useMatrixMode();

      expect(matrixMode.isEnabled.value).toBe(true);
      expect(matrixMode.config.value.dropSpeed).toBe(80);
    });

    it('should save state to localStorage on mode toggle', async () => {
      const matrixMode = useMatrixMode();

      await matrixMode.enable();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'matrix-mode-state',
        expect.stringContaining('"isEnabled":true')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => useMatrixMode()).not.toThrow();
    });
  });

  describe('Renderer Integration', () => {
    it('should set and get renderer correctly', () => {
      const matrixMode = useMatrixMode();

      const mockRenderer = {
        canvas: document.createElement('canvas'),
        context: {} as CanvasRenderingContext2D,
        isInitialized: false,
        animationFrameId: null,
        initialize: vi.fn(),
        startAnimation: vi.fn(),
        stopAnimation: vi.fn(),
        render: vi.fn(),
        resize: vi.fn(),
        cleanup: vi.fn(),
        renderDrop: vi.fn(),
        renderCharacter: vi.fn(),
        applyGlowEffect: vi.fn(),
        clearCanvas: vi.fn()
      };

      matrixMode.setRenderer(mockRenderer);

      expect(matrixMode.getRenderer()).toBe(mockRenderer);
    });

    it('should cleanup renderer on unmount', () => {
      const matrixMode = useMatrixMode();

      const mockRenderer = {
        cleanup: vi.fn()
      } as any;

      matrixMode.setRenderer(mockRenderer);
      matrixMode.cleanup();

      expect(mockRenderer.cleanup).toHaveBeenCalled();
      expect(matrixMode.getRenderer()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle enable errors gracefully', async () => {
      const matrixMode = useMatrixMode();

      // Mock a renderer that throws on initialization
      const mockRenderer = {
        initialize: vi.fn().mockImplementation(() => {
          throw new Error('Canvas initialization failed');
        })
      } as any;

      matrixMode.setRenderer(mockRenderer);

      // Should not throw
      await expect(matrixMode.enable()).resolves.toBeUndefined();
      
      // State should remain consistent
      expect(matrixMode.isTransitioning.value).toBe(false);
    });
  });

  describe('Constants and Utilities', () => {
    it('should export character sets correctly', () => {
      expect(MATRIX_CHARACTERS.katakana.length).toBeGreaterThan(0);
      expect(MATRIX_CHARACTERS.symbols.length).toBeGreaterThan(0);
      expect(MATRIX_CHARACTERS.numbers).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      expect(MATRIX_CHARACTERS.alphanumeric.length).toBe(62);
    });

    it('should export default config correctly', () => {
      expect(DEFAULT_CONFIG.columnWidth).toBe(20);
      expect(DEFAULT_CONFIG.dropSpeed).toBe(60);
      expect(DEFAULT_CONFIG.maxDrops).toBe(1000);
      expect(DEFAULT_CONFIG.targetFPS).toBe(60);
    });
  });
});