/**
 * Matrix Visual Effects System
 * 
 * Provides color schemes, glow effects, and visual utilities for Matrix mode.
 * Implements the visual effects portion of WP3 requirements.
 * 
 * @author SusanVisual
 * @team JohnState, MarkCanvas, DaveTransform, EricSocket, PaulArch, NancyTest
 */

import type { HookEvent } from '../types';
import { matrixModeTokens } from './matrixDesignTokens';

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export interface MatrixColorScheme {
  background: string;
  head: string;
  trail: string[];
  glow: string;
  shadow: string;
}

export class MatrixColorSystem {
  private readonly colorTokens = matrixModeTokens.colors;

  /**
   * Get color scheme based on event type and status
   */
  getEventColorScheme(event: HookEvent): MatrixColorScheme {
    const eventType = event.hook_event_type.toLowerCase();
    
    // Error events - Red theme
    if (eventType.includes('error') || eventType.includes('fail')) {
      return {
        background: this.colorTokens.background.primary,
        head: this.colorTokens.effects.error.alert,
        trail: [
          this.colorTokens.effects.error.alert,
          this.colorTokens.effects.error.trail,
          '#FF8080',
          '#FF6060',
          '#FF4040',
          '#FF2020'
        ],
        glow: this.colorTokens.effects.error.glow,
        shadow: 'rgba(255, 48, 48, 0.5)'
      };
    }

    // Success/completion events - Bright green
    if (eventType.includes('success') || eventType.includes('complete') || eventType.includes('finish')) {
      return {
        background: this.colorTokens.background.primary,
        head: this.colorTokens.effects.completion.success,
        trail: [
          this.colorTokens.effects.completion.success,
          this.colorTokens.effects.completion.trail,
          '#00DD88',
          '#00BB66',
          '#009944',
          '#007722'
        ],
        glow: this.colorTokens.effects.completion.glow,
        shadow: 'rgba(0, 255, 170, 0.5)'
      };
    }

    // Warning events - Orange/Yellow
    if (eventType.includes('warn') || eventType.includes('pending')) {
      return {
        background: this.colorTokens.background.primary,
        head: this.colorTokens.status.warning,
        trail: [
          this.colorTokens.status.warning,
          '#DD8800',
          '#BB6600',
          '#994400',
          '#772200',
          '#551100'
        ],
        glow: 'rgba(255, 170, 0, 0.4)',
        shadow: 'rgba(255, 170, 0, 0.3)'
      };
    }

    // Spawn/new events - White flash
    if (eventType.includes('start') || eventType.includes('spawn') || eventType.includes('begin')) {
      return {
        background: this.colorTokens.background.primary,
        head: this.colorTokens.effects.spawn.flash,
        trail: [
          this.colorTokens.effects.spawn.flash,
          this.colorTokens.effects.spawn.pulse,
          this.colorTokens.characters.trail.brightest,
          this.colorTokens.characters.trail.bright,
          this.colorTokens.characters.trail.medium,
          this.colorTokens.characters.trail.dim
        ],
        glow: this.colorTokens.effects.spawn.glow,
        shadow: 'rgba(255, 255, 255, 0.3)'
      };
    }

    // Default Matrix green
    return {
      background: this.colorTokens.background.primary,
      head: this.colorTokens.characters.head,
      trail: [
        this.colorTokens.characters.trail.brightest,
        this.colorTokens.characters.trail.bright,
        this.colorTokens.characters.trail.medium,
        this.colorTokens.characters.trail.dim,
        this.colorTokens.characters.trail.dimmer,
        this.colorTokens.characters.trail.darkest
      ],
      glow: 'rgba(0, 255, 0, 0.4)',
      shadow: 'rgba(0, 255, 0, 0.2)'
    };
  }

  /**
   * Get trail color for specific position in trail
   */
  getTrailColor(colorScheme: MatrixColorScheme, position: number, trailLength: number): string {
    const normalizedPosition = Math.min(position / trailLength, 1);
    const colorIndex = Math.floor(normalizedPosition * (colorScheme.trail.length - 1));
    return colorScheme.trail[colorIndex] || colorScheme.trail[colorScheme.trail.length - 1];
  }

  /**
   * Get opacity for trail position
   */
  getTrailOpacity(position: number, trailLength: number): number {
    const opacityTokens = matrixModeTokens.opacity.characters;
    const normalizedPosition = position / trailLength;
    
    if (position === 0) return opacityTokens.head;
    if (position === 1) return opacityTokens.trail1;
    if (position === 2) return opacityTokens.trail2;
    if (position === 3) return opacityTokens.trail3;
    if (position === 4) return opacityTokens.trail4;
    if (position === 5) return opacityTokens.trail5;
    
    // Fade linearly for longer trails
    return Math.max(opacityTokens.tail, 1 - normalizedPosition);
  }

  /**
   * Generate CSS gradient for trail effect
   */
  generateTrailGradient(colorScheme: MatrixColorScheme, direction = 'to bottom'): string {
    const stops = colorScheme.trail.map((color, index) => {
      const position = (index / (colorScheme.trail.length - 1)) * 100;
      return `${color} ${position}%`;
    });
    
    return `linear-gradient(${direction}, ${stops.join(', ')})`;
  }
}

// ============================================================================
// GLOW EFFECTS SYSTEM
// ============================================================================

export interface GlowEffect {
  type: 'pulse' | 'flash' | 'steady' | 'fade';
  color: string;
  intensity: number;
  duration: number;
  easing: string;
}

export class MatrixGlowEffects {
  private readonly effectTokens = matrixModeTokens.animation.effects;

  /**
   * Create glow effect for event spawn
   */
  createSpawnEffect(): GlowEffect {
    return {
      type: 'flash',
      color: matrixModeTokens.colors.effects.spawn.glow,
      intensity: 1.0,
      duration: parseInt(this.effectTokens.spawn.duration),
      easing: this.effectTokens.spawn.easing
    };
  }

  /**
   * Create glow effect for event completion
   */
  createCompletionEffect(): GlowEffect {
    return {
      type: 'fade',
      color: matrixModeTokens.colors.effects.completion.glow,
      intensity: 0.8,
      duration: parseInt(this.effectTokens.completion.glowDuration),
      easing: 'ease-out'
    };
  }

  /**
   * Create glow effect for errors
   */
  createErrorEffect(): GlowEffect {
    return {
      type: 'pulse',
      color: matrixModeTokens.colors.effects.error.glow,
      intensity: 1.0,
      duration: parseInt(this.effectTokens.error.glowDuration),
      easing: 'ease-in-out'
    };
  }

  /**
   * Apply glow effect to canvas context
   */
  applyCanvasGlow(
    ctx: CanvasRenderingContext2D, 
    effect: GlowEffect, 
    x: number, 
    y: number, 
    width: number, 
    height: number
  ): void {
    ctx.save();
    
    // Set shadow for glow effect
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = effect.intensity * 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Create gradient for intensity variation
    const gradient = ctx.createRadialGradient(
      x + width / 2, y + height / 2, 0,
      x + width / 2, y + height / 2, Math.max(width, height) / 2
    );
    
    gradient.addColorStop(0, effect.color);
    gradient.addColorStop(0.5, effect.color.replace(/[\d\.]+\)$/, `${effect.intensity * 0.5})`));
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
    
    ctx.restore();
  }

  /**
   * Generate CSS filter for glow effects
   */
  generateCSSGlow(effect: GlowEffect): string {
    const blur = effect.intensity * 3;
    const spread = effect.intensity * 2;
    
    return `drop-shadow(0 0 ${blur}px ${effect.color}) drop-shadow(0 0 ${spread}px ${effect.color})`;
  }
}

// ============================================================================
// ANIMATION SYSTEM
// ============================================================================

export interface AnimationFrame {
  timestamp: number;
  progress: number; // 0-1
  easeValue: number; // Eased progress
}

export class MatrixAnimationSystem {
  private readonly animationTokens = matrixModeTokens.animation;

  /**
   * Easing functions for smooth animations
   */
  private easingFunctions = {
    linear: (t: number): number => t,
    easeIn: (t: number): number => t * t,
    easeOut: (t: number): number => t * (2 - t),
    easeInOut: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    elasticOut: (t: number): number => Math.sin(-13 * (t + 1) * Math.PI / 2) * Math.pow(2, -10 * t) + 1,
    bounceOut: (t: number): number => {
      if (t < 1/2.75) return 7.5625 * t * t;
      if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
      if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
    }
  };

  /**
   * Calculate animation frame for given timestamp and duration
   */
  calculateFrame(startTime: number, currentTime: number, duration: number, easing = 'easeOut'): AnimationFrame {
    const elapsed = currentTime - startTime;
    const progress = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
    const easingFn = this.easingFunctions[easing as keyof typeof this.easingFunctions] || this.easingFunctions.linear;
    
    return {
      timestamp: currentTime,
      progress,
      easeValue: easingFn(progress)
    };
  }

  /**
   * Get character drop speed based on event age
   */
  getDropSpeed(eventAge: number, eventType: string): number {
    const speeds = this.animationTokens.speeds;
    const ageMinutes = eventAge / (1000 * 60);
    
    // Adjust base speed by event type
    const typeMultiplier = this.getSpeedMultiplierForEventType(eventType);
    
    if (ageMinutes < 1) {
      // Recent events
      const baseSpeed = (parseInt(speeds.recent.min) + parseInt(speeds.recent.max)) / 2;
      return baseSpeed * typeMultiplier;
    } else if (ageMinutes < 5) {
      // Medium age events
      const baseSpeed = (parseInt(speeds.medium.min) + parseInt(speeds.medium.max)) / 2;
      return baseSpeed * typeMultiplier;
    } else if (ageMinutes < 15) {
      // Old events
      const baseSpeed = (parseInt(speeds.old.min) + parseInt(speeds.old.max)) / 2;
      return baseSpeed * typeMultiplier;
    } else {
      // Background events
      const baseSpeed = (parseInt(speeds.background.min) + parseInt(speeds.background.max)) / 2;
      return baseSpeed * typeMultiplier;
    }
  }

  /**
   * Get speed multiplier based on event type
   */
  private getSpeedMultiplierForEventType(eventType: string): number {
    const type = eventType.toLowerCase();
    
    if (type.includes('error')) return 1.5; // Errors fall faster
    if (type.includes('success')) return 1.2; // Success slightly faster
    if (type.includes('start') || type.includes('spawn')) return 1.3; // New events faster
    if (type.includes('complete')) return 0.8; // Completions slower
    if (type.includes('pending')) return 0.6; // Pending very slow
    
    return 1.0; // Default speed
  }

  /**
   * Calculate trail length based on event importance
   */
  getTrailLength(eventType: string): number {
    const trails = this.animationTokens.trails;
    const type = eventType.toLowerCase();
    
    if (type.includes('error') || type.includes('success')) {
      // Important events get longer trails
      return Math.floor(
        (trails.eventStream.minLength + trails.eventStream.maxLength) / 2 * 1.2
      );
    }
    
    if (type.includes('background') || type.includes('heartbeat')) {
      // Background events get shorter trails
      return trails.backgroundStream.minLength;
    }
    
    // Default event trail length
    return Math.floor(
      (trails.eventStream.minLength + trails.eventStream.maxLength) / 2
    );
  }
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

export interface EffectPerformanceMetrics {
  glowEffectsCount: number;
  animationsCount: number;
  renderTime: number;
  memoryUsage: number;
}

export class MatrixEffectPerformance {
  private startTime = 0;
  private frameCount = 0;
  private totalRenderTime = 0;

  /**
   * Start performance measurement for frame
   */
  startFrame(): void {
    this.startTime = performance.now();
  }

  /**
   * End performance measurement for frame
   */
  endFrame(): number {
    const renderTime = performance.now() - this.startTime;
    this.totalRenderTime += renderTime;
    this.frameCount++;
    return renderTime;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): EffectPerformanceMetrics & { averageRenderTime: number; fps: number } {
    const averageRenderTime = this.totalRenderTime / Math.max(this.frameCount, 1);
    const fps = this.frameCount > 0 ? 1000 / averageRenderTime : 0;
    
    return {
      glowEffectsCount: 0, // To be tracked by effect system
      animationsCount: 0,  // To be tracked by animation system
      renderTime: this.totalRenderTime,
      memoryUsage: 0,      // To be calculated from active objects
      averageRenderTime,
      fps
    };
  }

  /**
   * Reset performance counters
   */
  reset(): void {
    this.startTime = 0;
    this.frameCount = 0;
    this.totalRenderTime = 0;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instances
export const matrixColorSystem = new MatrixColorSystem();
export const matrixGlowEffects = new MatrixGlowEffects();
export const matrixAnimationSystem = new MatrixAnimationSystem();
export const matrixEffectPerformance = new MatrixEffectPerformance();

// Export unified effects API for team integration
export const MatrixEffectsApi = {
  colors: matrixColorSystem,
  glow: matrixGlowEffects,
  animation: matrixAnimationSystem,
  performance: matrixEffectPerformance,
  tokens: matrixModeTokens
};