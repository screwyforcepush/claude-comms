/**
 * Global Test Setup
 * Ensures proper cleanup and prevents memory leaks
 */
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { config } from '@vue/test-utils';

// Configure Vue Test Utils globally
beforeAll(() => {
  // Set global stubs
  config.global.stubs = {
    teleport: true,
    transition: false
  };
  
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  // Mock ResizeObserver  
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear all timers
  vi.clearAllTimers();
  
  // Reset modules if needed
  vi.resetModules();
  
  // Clear any DOM modifications
  document.body.innerHTML = '';
  
  // Clear localStorage/sessionStorage
  localStorage.clear();
  sessionStorage.clear();
});

// Final cleanup
afterAll(() => {
  // Restore all mocks
  vi.restoreAllMocks();
  
  // Clear any remaining timers
  vi.useRealTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Export test utilities
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

export const waitFor = (condition: () => boolean, timeout = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for condition'));
      }
    }, 10);
  });
};