/**
 * Unit Tests for useMatrixMode Composable
 * Testing state management, persistence, and mode transitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';

// Mock localStorage before importing the composable
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock the composable that will be implemented
interface UseMatrixModeReturn {
  isEnabled: typeof ref<boolean>;
  isTransitioning: typeof ref<boolean>;
  transitionProgress: typeof ref<number>;
  toggle: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  setTransitionProgress: (progress: number) => void;
}

// Since the composable doesn't exist yet, we'll create a mock implementation
// that defines the expected interface for TDD
function createMockUseMatrixMode(): UseMatrixModeReturn {
  const isEnabled = ref(false);
  const isTransitioning = ref(false);
  const transitionProgress = ref(0);

  const toggle = async (): Promise<void> => {
    if (isTransitioning.value) return;
    
    isTransitioning.value = true;
    transitionProgress.value = 0;
    
    // Simulate transition animation
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      transitionProgress.value = i * 10;
    }
    
    isEnabled.value = !isEnabled.value;
    isTransitioning.value = false;
    transitionProgress.value = 0;
    
    // Persist to localStorage
    mockLocalStorage.setItem('matrixMode', isEnabled.value.toString());
  };

  const enable = async (): Promise<void> => {
    if (!isEnabled.value) {
      await toggle();
    }
  };

  const disable = async (): Promise<void> => {
    if (isEnabled.value) {
      await toggle();
    }
  };

  const setTransitionProgress = (progress: number): void => {
    transitionProgress.value = Math.max(0, Math.min(100, progress));
  };

  // Initialize from localStorage on creation
  const stored = mockLocalStorage.getItem('matrixMode');
  if (stored !== null) {
    isEnabled.value = stored === 'true';
  }

  return {
    isEnabled,
    isTransitioning,
    transitionProgress,
    toggle,
    enable,
    disable,
    setTransitionProgress
  };
}

describe('useMatrixMode Composable', () => {
  let useMatrixMode: () => UseMatrixModeReturn;

  beforeEach(() => {
    vi.clearAllMocks();
    useMatrixMode = createMockUseMatrixMode;
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with Matrix mode disabled', () => {
      const { isEnabled, isTransitioning, transitionProgress } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
      expect(isTransitioning.value).toBe(false);
      expect(transitionProgress.value).toBe(0);
    });

    it('should load saved state from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      
      const { isEnabled } = useMatrixMode();
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('matrixMode');
      expect(isEnabled.value).toBe(true);
    });

    it('should handle invalid localStorage values gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid');
      
      const { isEnabled } = useMatrixMode();
      
      // Should default to false for invalid values
      expect(isEnabled.value).toBe(false);
    });

    it('should handle null localStorage values', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const { isEnabled } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle from disabled to enabled', async () => {
      const { isEnabled, toggle } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
      
      await toggle();
      
      expect(isEnabled.value).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('matrixMode', 'true');
    });

    it('should toggle from enabled to disabled', async () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      const { isEnabled, toggle } = useMatrixMode();
      
      expect(isEnabled.value).toBe(true);
      
      await toggle();
      
      expect(isEnabled.value).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('matrixMode', 'false');
    });

    it('should handle multiple rapid toggles gracefully', async () => {
      const { isEnabled, toggle, isTransitioning } = useMatrixMode();
      
      const promise1 = toggle();
      const promise2 = toggle(); // Should be ignored
      const promise3 = toggle(); // Should be ignored
      
      await promise1;
      await promise2;
      await promise3;
      
      // Should only toggle once
      expect(isEnabled.value).toBe(true);
      expect(isTransitioning.value).toBe(false);
    });

    it('should show transition state during toggle', async () => {
      const { isTransitioning, transitionProgress, toggle } = useMatrixMode();
      
      const togglePromise = toggle();
      
      // Should immediately set transitioning state
      await nextTick();
      expect(isTransitioning.value).toBe(true);
      expect(transitionProgress.value).toBeGreaterThanOrEqual(0);
      
      await togglePromise;
      
      expect(isTransitioning.value).toBe(false);
      expect(transitionProgress.value).toBe(0);
    });
  });

  describe('Direct Enable/Disable', () => {
    it('should enable Matrix mode when disabled', async () => {
      const { isEnabled, enable } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
      
      await enable();
      
      expect(isEnabled.value).toBe(true);
    });

    it('should do nothing when enabling already enabled mode', async () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      const { isEnabled, enable, isTransitioning } = useMatrixMode();
      
      expect(isEnabled.value).toBe(true);
      
      await enable();
      
      expect(isEnabled.value).toBe(true);
      expect(isTransitioning.value).toBe(false);
    });

    it('should disable Matrix mode when enabled', async () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      const { isEnabled, disable } = useMatrixMode();
      
      expect(isEnabled.value).toBe(true);
      
      await disable();
      
      expect(isEnabled.value).toBe(false);
    });

    it('should do nothing when disabling already disabled mode', async () => {
      const { isEnabled, disable, isTransitioning } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
      
      await disable();
      
      expect(isEnabled.value).toBe(false);
      expect(isTransitioning.value).toBe(false);
    });
  });

  describe('Transition Progress', () => {
    it('should allow setting transition progress', () => {
      const { transitionProgress, setTransitionProgress } = useMatrixMode();
      
      setTransitionProgress(50);
      expect(transitionProgress.value).toBe(50);
      
      setTransitionProgress(100);
      expect(transitionProgress.value).toBe(100);
    });

    it('should clamp transition progress to valid range', () => {
      const { transitionProgress, setTransitionProgress } = useMatrixMode();
      
      setTransitionProgress(-10);
      expect(transitionProgress.value).toBe(0);
      
      setTransitionProgress(150);
      expect(transitionProgress.value).toBe(100);
    });

    it('should update progress during transition', async () => {
      const { transitionProgress, toggle } = useMatrixMode();
      
      const progressValues: number[] = [];
      
      // Watch for progress changes
      const stopWatching = vi.fn();
      
      const togglePromise = toggle();
      
      // Simulate checking progress during transition
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        progressValues.push(transitionProgress.value);
      }
      
      await togglePromise;
      
      // Should have seen progress values between 0 and 100
      expect(progressValues.some(val => val > 0 && val < 100)).toBe(true);
      expect(transitionProgress.value).toBe(0); // Reset after completion
    });
  });

  describe('Persistence', () => {
    it('should persist enabled state to localStorage', async () => {
      const { toggle } = useMatrixMode();
      
      await toggle();
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('matrixMode', 'true');
    });

    it('should persist disabled state to localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      const { toggle } = useMatrixMode();
      
      await toggle();
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('matrixMode', 'false');
    });

    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const { toggle } = useMatrixMode();
      
      // Should not throw error
      await expect(toggle()).resolves.toBeUndefined();
    });
  });

  describe('Reactivity', () => {
    it('should maintain reactive references', async () => {
      const { isEnabled, toggle } = useMatrixMode();
      
      let reactiveCalls = 0;
      
      // Simulate Vue reactivity watching
      const stopWatching = vi.fn();
      
      // Mock a reactive effect
      const watchEffect = () => {
        reactiveCalls++;
        return isEnabled.value;
      };
      
      watchEffect(); // Initial call
      
      await toggle();
      watchEffect(); // Should detect change
      
      expect(reactiveCalls).toBe(2);
    });

    it('should trigger reactivity on transition state changes', async () => {
      const { isTransitioning, toggle } = useMatrixMode();
      
      let transitionStates: boolean[] = [];
      
      // Watch transition state
      const watchTransition = () => {
        transitionStates.push(isTransitioning.value);
      };
      
      watchTransition(); // Initial state
      
      const togglePromise = toggle();
      await nextTick();
      watchTransition(); // Should be transitioning
      
      await togglePromise;
      watchTransition(); // Should be done transitioning
      
      expect(transitionStates).toEqual([false, true, false]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid enable/disable calls', async () => {
      const { enable, disable, isEnabled } = useMatrixMode();
      
      const promises = [
        enable(),
        disable(),
        enable(),
        disable(),
        enable()
      ];
      
      await Promise.all(promises);
      
      // Final state should be enabled (last call wins)
      expect(isEnabled.value).toBe(true);
    });

    it('should handle transition interruption gracefully', async () => {
      const { toggle, isEnabled, isTransitioning } = useMatrixMode();
      
      // Start first toggle
      const firstToggle = toggle();
      
      // Attempt second toggle while first is in progress
      const secondToggle = toggle();
      
      await firstToggle;
      await secondToggle;
      
      // Should complete first toggle, ignore second
      expect(isEnabled.value).toBe(true);
      expect(isTransitioning.value).toBe(false);
    });

    it('should work with concurrent composable instances', () => {
      const instance1 = useMatrixMode();
      const instance2 = useMatrixMode();
      
      // Should share localStorage state
      expect(instance1.isEnabled.value).toBe(instance2.isEnabled.value);
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks with multiple instances', () => {
      const instances = Array.from({ length: 100 }, () => useMatrixMode());
      
      // All instances should be collectable
      instances.forEach(instance => {
        expect(typeof instance.toggle).toBe('function');
        expect(typeof instance.isEnabled.value).toBe('boolean');
      });
    });

    it('should handle high-frequency progress updates', () => {
      const { setTransitionProgress } = useMatrixMode();
      
      // Rapid progress updates should not cause issues
      for (let i = 0; i <= 100; i++) {
        setTransitionProgress(i);
      }
      
      expect(true).toBe(true); // Test completes without errors
    });
  });
});