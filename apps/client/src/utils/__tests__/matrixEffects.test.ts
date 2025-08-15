/**
 * Matrix Effects System Tests
 * 
 * Tests for color system, glow effects, and visual utilities.
 * Follows TDD principles for WP3 visual effects requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MatrixColorSystem,
  MatrixGlowEffects,
  MatrixAnimationSystem,
  MatrixEffectPerformance,
  matrixColorSystem,
  matrixGlowEffects,
  matrixAnimationSystem,
  matrixEffectPerformance
} from '../matrixEffects';
import type { HookEvent } from '../../types';

// Mock Canvas Context for glow effect tests
const mockCanvasContext = {
  save: vi.fn(),
  restore: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  fillRect: vi.fn(),
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  fillStyle: ''
} as any;

describe('MatrixColorSystem', () => {
  let colorSystem: MatrixColorSystem;
  let mockEvent: HookEvent;

  beforeEach(() => {
    colorSystem = new MatrixColorSystem();
    mockEvent = {
      id: 1,
      source_app: 'test-app',
      session_id: 'session-123',
      hook_event_type: 'pre_response',
      payload: {},
      timestamp: Date.now()
    };
  });

  describe('getEventColorScheme', () => {
    it('should return error color scheme for error events', () => {
      const errorEvent = { ...mockEvent, hook_event_type: 'error_occurred' };
      const scheme = colorSystem.getEventColorScheme(errorEvent);
      
      expect(scheme.head).toContain('#FF');
      expect(scheme.trail[0]).toContain('#FF');
      expect(scheme.glow).toContain('255, 48, 48');
    });

    it('should return success color scheme for success events', () => {
      const successEvent = { ...mockEvent, hook_event_type: 'success_response' };
      const scheme = colorSystem.getEventColorScheme(successEvent);
      
      expect(scheme.head).toBe('#FFFFFF');
      expect(scheme.trail[1]).toContain('#00FFAA');
    });

    it('should return warning color scheme for warning events', () => {
      const warningEvent = { ...mockEvent, hook_event_type: 'warning_message' };
      const scheme = colorSystem.getEventColorScheme(warningEvent);
      
      expect(scheme.head).toContain('#FFAA00');
      expect(scheme.trail[0]).toContain('#FFAA00');
    });

    it('should return spawn color scheme for spawn events', () => {
      const spawnEvent = { ...mockEvent, hook_event_type: 'start_session' };
      const scheme = colorSystem.getEventColorScheme(spawnEvent);
      
      expect(scheme.head).toBe('#FFFFFF');
      expect(scheme.glow).toContain('0, 255, 0');
    });

    it('should return default Matrix green for unspecified events', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      
      expect(scheme.head).toBe('#FFFFFF');
      expect(scheme.trail[0]).toBe('#00FF00');
      expect(scheme.background).toBe('#000000');
    });

    it('should have consistent structure for all color schemes', () => {
      const events = [
        { ...mockEvent, hook_event_type: 'error' },
        { ...mockEvent, hook_event_type: 'success' },
        { ...mockEvent, hook_event_type: 'warning' },
        { ...mockEvent, hook_event_type: 'start' },
        { ...mockEvent, hook_event_type: 'normal' }
      ];

      events.forEach(event => {
        const scheme = colorSystem.getEventColorScheme(event);
        
        expect(scheme.background).toBeDefined();
        expect(scheme.head).toBeDefined();
        expect(Array.isArray(scheme.trail)).toBe(true);
        expect(scheme.trail.length).toBeGreaterThan(0);
        expect(scheme.glow).toBeDefined();
        expect(scheme.shadow).toBeDefined();
      });
    });
  });

  describe('getTrailColor', () => {
    it('should return head color for position 0', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const color = colorSystem.getTrailColor(scheme, 0, 10);
      
      expect(color).toBe(scheme.trail[0]);
    });

    it('should return tail color for last position', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const trailLength = 10;
      const color = colorSystem.getTrailColor(scheme, trailLength - 1, trailLength);
      
      expect(color).toBe(scheme.trail[scheme.trail.length - 1]);
    });

    it('should interpolate colors for middle positions', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const color = colorSystem.getTrailColor(scheme, 5, 10);
      
      expect(scheme.trail).toContain(color);
    });

    it('should handle edge cases gracefully', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      
      // Position beyond trail length
      const color = colorSystem.getTrailColor(scheme, 100, 10);
      expect(color).toBe(scheme.trail[scheme.trail.length - 1]);
    });
  });

  describe('getTrailOpacity', () => {
    it('should return 1.0 for head position', () => {
      const opacity = colorSystem.getTrailOpacity(0, 10);
      expect(opacity).toBe(1.0);
    });

    it('should decrease opacity along trail', () => {
      const opacity1 = colorSystem.getTrailOpacity(1, 10);
      const opacity2 = colorSystem.getTrailOpacity(5, 10);
      const opacity3 = colorSystem.getTrailOpacity(9, 10);
      
      expect(opacity1).toBeGreaterThan(opacity2);
      expect(opacity2).toBeGreaterThan(opacity3);
    });

    it('should respect minimum opacity', () => {
      const opacity = colorSystem.getTrailOpacity(100, 10);
      expect(opacity).toBeGreaterThanOrEqual(0.05);
    });

    it('should return consistent values for defined positions', () => {
      expect(colorSystem.getTrailOpacity(1, 10)).toBe(0.9);
      expect(colorSystem.getTrailOpacity(2, 10)).toBe(0.8);
    });
  });

  describe('generateTrailGradient', () => {
    it('should generate valid CSS gradient', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const gradient = colorSystem.generateTrailGradient(scheme);
      
      expect(gradient).toContain('linear-gradient');
      expect(gradient).toContain('to bottom');
      expect(gradient).toContain('#');
      expect(gradient).toContain('%');
    });

    it('should support custom direction', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const gradient = colorSystem.generateTrailGradient(scheme, 'to right');
      
      expect(gradient).toContain('to right');
    });

    it('should include all trail colors', () => {
      const scheme = colorSystem.getEventColorScheme(mockEvent);
      const gradient = colorSystem.generateTrailGradient(scheme);
      
      scheme.trail.forEach(color => {
        expect(gradient).toContain(color);
      });
    });
  });
});

describe('MatrixGlowEffects', () => {
  let glowEffects: MatrixGlowEffects;

  beforeEach(() => {
    glowEffects = new MatrixGlowEffects();
    vi.clearAllMocks();
  });

  describe('createSpawnEffect', () => {
    it('should create flash effect for spawns', () => {
      const effect = glowEffects.createSpawnEffect();
      
      expect(effect.type).toBe('flash');
      expect(effect.intensity).toBe(1.0);
      expect(effect.duration).toBeGreaterThan(0);
      expect(effect.color).toContain('rgba');
    });
  });

  describe('createCompletionEffect', () => {
    it('should create fade effect for completions', () => {
      const effect = glowEffects.createCompletionEffect();
      
      expect(effect.type).toBe('fade');
      expect(effect.intensity).toBe(0.8);
      expect(effect.easing).toBe('ease-out');
    });
  });

  describe('createErrorEffect', () => {
    it('should create pulse effect for errors', () => {
      const effect = glowEffects.createErrorEffect();
      
      expect(effect.type).toBe('pulse');
      expect(effect.intensity).toBe(1.0);
      expect(effect.color).toContain('rgba');
    });
  });

  describe('applyCanvasGlow', () => {
    it('should apply glow to canvas context', () => {
      const effect = { type: 'flash', color: '#00FF00', intensity: 0.8, duration: 500, easing: 'ease' };
      
      glowEffects.applyCanvasGlow(mockCanvasContext, effect, 10, 20, 30, 40);
      
      expect(mockCanvasContext.save).toHaveBeenCalled();
      expect(mockCanvasContext.restore).toHaveBeenCalled();
      expect(mockCanvasContext.createRadialGradient).toHaveBeenCalled();
      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
    });

    it('should set shadow properties', () => {
      const effect = { type: 'flash', color: '#FF0000', intensity: 1.0, duration: 500, easing: 'ease' };
      
      glowEffects.applyCanvasGlow(mockCanvasContext, effect, 0, 0, 100, 100);
      
      expect(mockCanvasContext.shadowColor).toBe('#FF0000');
      expect(mockCanvasContext.shadowBlur).toBe(15); // intensity * 15
    });
  });

  describe('generateCSSGlow', () => {
    it('should generate CSS filter for glow', () => {
      const effect = { type: 'flash', color: '#00FF00', intensity: 0.5, duration: 500, easing: 'ease' };
      const cssGlow = glowEffects.generateCSSGlow(effect);
      
      expect(cssGlow).toContain('drop-shadow');
      expect(cssGlow).toContain('#00FF00');
      expect(cssGlow).toContain('px');
    });

    it('should scale blur and spread with intensity', () => {
      const lowIntensity = { type: 'flash', color: '#00FF00', intensity: 0.2, duration: 500, easing: 'ease' };
      const highIntensity = { type: 'flash', color: '#00FF00', intensity: 1.0, duration: 500, easing: 'ease' };
      
      const lowGlow = glowEffects.generateCSSGlow(lowIntensity);
      const highGlow = glowEffects.generateCSSGlow(highIntensity);
      
      // High intensity should have larger blur values
      const lowBlur = parseFloat(lowGlow.match(/(\d+\.?\d*)px/)?.[1] || '0');
      const highBlur = parseFloat(highGlow.match(/(\d+\.?\d*)px/)?.[1] || '0');
      
      expect(highBlur).toBeGreaterThan(lowBlur);
    });
  });
});

describe('MatrixAnimationSystem', () => {
  let animationSystem: MatrixAnimationSystem;

  beforeEach(() => {
    animationSystem = new MatrixAnimationSystem();
  });

  describe('calculateFrame', () => {
    it('should calculate animation progress correctly', () => {
      const startTime = 1000;
      const currentTime = 1500;
      const duration = 1000;
      
      const frame = animationSystem.calculateFrame(startTime, currentTime, duration);
      
      expect(frame.progress).toBe(0.5);
      expect(frame.timestamp).toBe(currentTime);
      expect(frame.easeValue).toBeGreaterThanOrEqual(0);
      expect(frame.easeValue).toBeLessThanOrEqual(1);
    });

    it('should cap progress at 1.0', () => {
      const startTime = 1000;
      const currentTime = 3000; // 2000ms elapsed
      const duration = 1000; // 1000ms duration
      
      const frame = animationSystem.calculateFrame(startTime, currentTime, duration);
      
      expect(frame.progress).toBe(1.0);
    });

    it('should apply different easing functions', () => {
      const startTime = 1000;
      const currentTime = 1500;
      const duration = 1000;
      
      const linear = animationSystem.calculateFrame(startTime, currentTime, duration, 'linear');
      const easeOut = animationSystem.calculateFrame(startTime, currentTime, duration, 'easeOut');
      
      expect(linear.easeValue).toBe(0.5);
      expect(easeOut.easeValue).not.toBe(0.5);
    });

    it('should handle zero duration gracefully', () => {
      const startTime = 1000;
      const currentTime = 1000;
      const duration = 0;
      
      const frame = animationSystem.calculateFrame(startTime, currentTime, duration);
      
      expect(frame.progress).toBe(1.0);
    });
  });

  describe('getDropSpeed', () => {
    it('should return higher speeds for recent events', () => {
      const recentSpeed = animationSystem.getDropSpeed(30000, 'normal'); // 30 seconds
      const oldSpeed = animationSystem.getDropSpeed(600000, 'normal'); // 10 minutes
      
      expect(recentSpeed).toBeGreaterThan(oldSpeed);
    });

    it('should apply event type multipliers', () => {
      const errorSpeed = animationSystem.getDropSpeed(60000, 'error');
      const normalSpeed = animationSystem.getDropSpeed(60000, 'normal');
      
      expect(errorSpeed).toBeGreaterThan(normalSpeed);
    });

    it('should return slower speeds for pending events', () => {
      const pendingSpeed = animationSystem.getDropSpeed(60000, 'pending');
      const normalSpeed = animationSystem.getDropSpeed(60000, 'normal');
      
      expect(pendingSpeed).toBeLessThan(normalSpeed);
    });

    it('should handle very old events', () => {
      const veryOldSpeed = animationSystem.getDropSpeed(3600000, 'normal'); // 1 hour
      
      expect(veryOldSpeed).toBeGreaterThan(0);
      expect(veryOldSpeed).toBeLessThan(100); // Should be background speed range
    });
  });

  describe('getTrailLength', () => {
    it('should return longer trails for important events', () => {
      const errorLength = animationSystem.getTrailLength('error');
      const successLength = animationSystem.getTrailLength('success');
      const normalLength = animationSystem.getTrailLength('normal');
      
      expect(errorLength).toBeGreaterThan(normalLength);
      expect(successLength).toBeGreaterThan(normalLength);
    });

    it('should return shorter trails for background events', () => {
      const backgroundLength = animationSystem.getTrailLength('background');
      const normalLength = animationSystem.getTrailLength('normal');
      
      expect(backgroundLength).toBeLessThan(normalLength);
    });

    it('should return reasonable trail lengths', () => {
      const length = animationSystem.getTrailLength('normal');
      
      expect(length).toBeGreaterThan(3);
      expect(length).toBeLessThan(25);
    });
  });
});

describe('MatrixEffectPerformance', () => {
  let performance: MatrixEffectPerformance;

  beforeEach(() => {
    performance = new MatrixEffectPerformance();
  });

  describe('frame measurement', () => {
    it('should measure frame render time', () => {
      performance.startFrame();
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }
      
      const renderTime = performance.endFrame();
      
      expect(renderTime).toBeGreaterThan(0);
    });

    it('should track multiple frames', () => {
      performance.startFrame();
      performance.endFrame();
      
      performance.startFrame();
      performance.endFrame();
      
      const metrics = performance.getMetrics();
      
      expect(metrics.averageRenderTime).toBeGreaterThan(0);
    });

    it('should calculate FPS correctly', () => {
      performance.startFrame();
      performance.endFrame();
      
      const metrics = performance.getMetrics();
      
      expect(metrics.fps).toBeGreaterThan(0);
      expect(metrics.averageRenderTime).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      performance.startFrame();
      performance.endFrame();
      
      performance.reset();
      
      const metrics = performance.getMetrics();
      
      expect(metrics.averageRenderTime).toBe(0);
      expect(metrics.renderTime).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return complete metrics object', () => {
      const metrics = performance.getMetrics();
      
      expect(metrics).toHaveProperty('glowEffectsCount');
      expect(metrics).toHaveProperty('animationsCount');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('averageRenderTime');
      expect(metrics).toHaveProperty('fps');
    });

    it('should handle no frames gracefully', () => {
      const metrics = performance.getMetrics();
      
      expect(metrics.averageRenderTime).toBe(0);
      expect(metrics.fps).toBe(0);
    });
  });
});

describe('Singleton Exports', () => {
  it('should export singleton instances', () => {
    expect(matrixColorSystem).toBeInstanceOf(MatrixColorSystem);
    expect(matrixGlowEffects).toBeInstanceOf(MatrixGlowEffects);
    expect(matrixAnimationSystem).toBeInstanceOf(MatrixAnimationSystem);
    expect(matrixEffectPerformance).toBeInstanceOf(MatrixEffectPerformance);
  });

  it('should export MatrixEffectsApi for team integration', async () => {
    const module = await import('../matrixEffects');
    
    expect(module.MatrixEffectsApi.colors).toBeDefined();
    expect(module.MatrixEffectsApi.glow).toBeDefined();
    expect(module.MatrixEffectsApi.animation).toBeDefined();
    expect(module.MatrixEffectsApi.performance).toBeDefined();
    expect(module.MatrixEffectsApi.tokens).toBeDefined();
  });
});

// Integration tests
describe('Integration Tests', () => {
  it('should work together for complete event visualization', () => {
    const mockEvent: HookEvent = {
      id: 1,
      source_app: 'test-app',
      session_id: 'session-123',
      hook_event_type: 'error_occurred',
      payload: {},
      timestamp: Date.now()
    };

    // Get color scheme
    const colorScheme = matrixColorSystem.getEventColorScheme(mockEvent);
    expect(colorScheme.head).toBeDefined();

    // Get animation properties
    const speed = matrixAnimationSystem.getDropSpeed(60000, mockEvent.hook_event_type);
    const trailLength = matrixAnimationSystem.getTrailLength(mockEvent.hook_event_type);
    
    expect(speed).toBeGreaterThan(0);
    expect(trailLength).toBeGreaterThan(0);

    // Get glow effect
    const glowEffect = matrixGlowEffects.createErrorEffect();
    expect(glowEffect.type).toBe('pulse');

    // All components should work together without errors
    expect(true).toBe(true);
  });

  it('should handle performance measurement across effects', () => {
    matrixEffectPerformance.startFrame();
    
    // Simulate using multiple effect systems
    const colorScheme = matrixColorSystem.getEventColorScheme({
      id: 1,
      source_app: 'test',
      session_id: 'test',
      hook_event_type: 'test',
      payload: {}
    });
    
    const glowEffect = matrixGlowEffects.createSpawnEffect();
    const speed = matrixAnimationSystem.getDropSpeed(60000, 'test');
    
    const renderTime = matrixEffectPerformance.endFrame();
    
    expect(renderTime).toBeGreaterThan(0);
    expect(colorScheme).toBeDefined();
    expect(glowEffect).toBeDefined();
    expect(speed).toBeGreaterThan(0);
  });
});