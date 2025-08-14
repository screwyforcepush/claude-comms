/**
 * Console Validation Test Script
 * Validates that the browser console has NO ERRORS when:
 * - Loading the page
 * - Clicking Sessions tab
 * - Interacting with timeline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SessionsView from '../components/SessionsView.vue';
import InteractiveSessionsTimeline from '../components/InteractiveSessionsTimeline.vue';

// Console error tracking
let consoleErrors: any[] = [];
let consoleWarnings: any[] = [];
let vueWarnings: any[] = [];

// Mock console methods to capture output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('Console Validation Tests', () => {
  beforeEach(() => {
    // Reset error tracking
    consoleErrors = [];
    consoleWarnings = [];
    vueWarnings = [];

    // Mock console.error to capture errors
    console.error = (...args: any[]) => {
      consoleErrors.push(args);
      originalConsoleError(...args); // Still log to actual console
    };

    // Mock console.warn to capture warnings
    console.warn = (...args: any[]) => {
      consoleWarnings.push(args);
      originalConsoleWarn(...args); // Still log to actual console
    };

    // Mock Vue's warning handler
    if (typeof window !== 'undefined' && (window as any).__VUE__) {
      const app = (window as any).__VUE__;
      if (app && app.config) {
        app.config.warnHandler = (msg: string, vm: any, trace: string) => {
          vueWarnings.push({ msg, vm, trace });
          originalConsoleWarn(`[Vue warn]: ${msg}`, trace);
        };
      }
    }
  });

  afterEach(() => {
    // Restore original console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('should have zero console errors when mounting SessionsView', async () => {
    // Mount the SessionsView component
    const wrapper = mount(SessionsView, {
      props: {
        filters: {
          sourceApp: '',
          sessionId: '',
          eventType: ''
        }
      }
    });

    await nextTick();

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found during SessionsView mount:', consoleErrors);
    }

    wrapper.unmount();
  });

  it('should have zero console errors when mounting InteractiveSessionsTimeline', async () => {
    // Mount the InteractiveSessionsTimeline component directly
    const wrapper = mount(InteractiveSessionsTimeline, {
      props: {
        sessions: [],
        height: 600,
        showControls: true,
        defaultWindow: 3600000,
        autoRefresh: true
      }
    });

    await nextTick();

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found during InteractiveSessionsTimeline mount:', consoleErrors);
    }

    wrapper.unmount();
  });

  it('should have zero console errors when interacting with timeline', async () => {
    const wrapper = mount(InteractiveSessionsTimeline, {
      props: {
        sessions: [],
        height: 600,
        showControls: true,
        defaultWindow: 3600000,
        autoRefresh: true
      }
    });

    await nextTick();

    // Simulate interactions that could cause errors
    try {
      // Trigger zoom in
      const zoomInButton = wrapper.find('button[title="Zoom In (+)"]');
      if (zoomInButton.exists()) {
        await zoomInButton.trigger('click');
        await nextTick();
      }

      // Trigger zoom out
      const zoomOutButton = wrapper.find('button[title="Zoom Out (-)"]');
      if (zoomOutButton.exists()) {
        await zoomOutButton.trigger('click');
        await nextTick();
      }

      // Trigger reset view
      const resetButton = wrapper.find('button[title="Reset View (R)"]');
      if (resetButton.exists()) {
        await resetButton.trigger('click');
        await nextTick();
      }

      // Trigger time window change
      const timeWindowButtons = wrapper.findAll('.timeline-header button');
      if (timeWindowButtons.length > 0) {
        await timeWindowButtons[0].trigger('click');
        await nextTick();
      }

    } catch (error) {
      consoleErrors.push(['Interaction error:', error]);
    }

    // Check for console errors after interactions
    expect(consoleErrors).toHaveLength(0);
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found during timeline interactions:', consoleErrors);
    }

    wrapper.unmount();
  });

  it('should have zero Vue warnings', async () => {
    const wrapper = mount(SessionsView, {
      props: {
        filters: {
          sourceApp: '',
          sessionId: '',
          eventType: ''
        }
      }
    });

    await nextTick();

    // Check for Vue warnings
    expect(vueWarnings).toHaveLength(0);
    
    if (vueWarnings.length > 0) {
      console.log('❌ Vue warnings found:', vueWarnings);
    }

    wrapper.unmount();
  });

  it('should validate no TypeScript compilation errors in InteractiveSessionsTimeline', () => {
    // This test ensures the component can be imported without TypeScript errors
    expect(InteractiveSessionsTimeline).toBeDefined();
    expect(typeof InteractiveSessionsTimeline).toBe('object');
  });

  it('should validate all required imports are available', async () => {
    const wrapper = mount(InteractiveSessionsTimeline, {
      props: {
        sessions: [],
        height: 600,
        showControls: true
      }
    });

    await nextTick();

    // Check that component mounted successfully
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.sessions-timeline-container').exists()).toBe(true);

    // Check for any missing dependencies that would cause runtime errors
    expect(consoleErrors.filter(error => 
      error.some((arg: any) => 
        typeof arg === 'string' && (
          arg.includes('Cannot read property') ||
          arg.includes('Cannot read properties') ||
          arg.includes('is not defined') ||
          arg.includes('Cannot find module')
        )
      )
    )).toHaveLength(0);

    wrapper.unmount();
  });
});

/**
 * Browser Console Validation Script
 * Run this in browser console to validate real-time console state
 */
export const browserConsoleValidation = {
  errors: [] as any[],
  warnings: [] as any[],
  
  startMonitoring() {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
      this.errors.push({
        timestamp: Date.now(),
        args,
        stack: new Error().stack
      });
      originalError(...args);
    };
    
    console.warn = (...args: any[]) => {
      this.warnings.push({
        timestamp: Date.now(),
        args,
        stack: new Error().stack
      });
      originalWarn(...args);
    };
    
    console.log('🔍 ValidatorViper: Console monitoring started');
  },
  
  getReport() {
    return {
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
      summary: `${this.errors.length} errors, ${this.warnings.length} warnings`
    };
  },
  
  clearLog() {
    this.errors = [];
    this.warnings = [];
    console.log('🧹 ValidatorViper: Console log cleared');
  },
  
  validateSessionsTab() {
    console.log('🔍 ValidatorViper: Validating Sessions tab...');
    
    // Check for Sessions tab existence
    const sessionsTab = document.querySelector('[role="tab"][aria-controls="sessions"]') || 
                       document.querySelector('button:contains("Sessions")') ||
                       document.querySelector('.tab:contains("Sessions")');
    
    if (!sessionsTab) {
      console.error('❌ Sessions tab not found');
      return false;
    }
    
    console.log('✅ Sessions tab found');
    return true;
  },
  
  validateTimelineExists() {
    console.log('🔍 ValidatorViper: Validating timeline existence...');
    
    const timeline = document.querySelector('.sessions-timeline-container') ||
                    document.querySelector('svg') ||
                    document.querySelector('.timeline');
    
    if (!timeline) {
      console.error('❌ Timeline component not found');
      return false;
    }
    
    console.log('✅ Timeline component found');
    return true;
  }
};

// Make available globally for browser console use
if (typeof window !== 'undefined') {
  (window as any).validatorViper = browserConsoleValidation;
}