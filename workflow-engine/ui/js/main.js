// Main entry point for Workflow Engine UI
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig, isConfigValid } from './config.js';
import { ConvexProvider, useConvex, useQuery } from './hooks/useConvex.js';
import { api } from './api.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { LoadingSpinner } from './components/shared/LoadingSkeleton.js';
import { NamespaceList } from './components/namespace/NamespaceList.js';
import { ChatPanel } from './components/chat/index.js';
import { GrainOverlay, ScanlineSweep } from './components/effects/index.js';
import { LoginGate, logout } from './components/auth/index.js';

// ============================================
// WP-5: Responsive breakpoint utilities
// ============================================

// Breakpoint thresholds
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  laptop: 1440
};

/**
 * Get current responsive mode based on window width
 */
function getResponsiveMode(width) {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  if (width < BREAKPOINTS.laptop) return 'laptop';
  return 'desktop';
}

/**
 * Custom hook for responsive mode detection
 * Returns current mode and a boolean for each breakpoint
 */
function useResponsiveMode() {
  const [mode, setMode] = useState(() => getResponsiveMode(window.innerWidth));

  useEffect(() => {
    function handleResize() {
      const newMode = getResponsiveMode(window.innerWidth);
      setMode(prevMode => prevMode !== newMode ? newMode : prevMode);
    }

    // Debounce resize events
    let timeoutId;
    function debouncedResize() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    }

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return useMemo(() => ({
    mode,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tablet',
    isLaptop: mode === 'laptop',
    isDesktop: mode === 'desktop',
    isCompact: mode === 'mobile' || mode === 'tablet'
  }), [mode]);
}

/**
 * Connection status indicator in header
 */
function ConnectionStatus() {
  const { connected, connecting, error } = useConvex();

  if (error) {
    return React.createElement('div', { className: 'flex items-center gap-2', style: { color: 'var(--q-lava1)' } },
      React.createElement('span', { className: 'status-dot', style: { backgroundColor: 'var(--q-lava1)' } }),
      React.createElement('span', { className: 'text-sm' }, 'Disconnected')
    );
  }

  if (connecting) {
    return React.createElement('div', { className: 'flex items-center gap-2 text-yellow-400' },
      React.createElement(LoadingSpinner, { size: 'sm' }),
      React.createElement('span', { className: 'text-sm' }, 'Connecting...')
    );
  }

  if (connected) {
    return React.createElement('div', { className: 'flex items-center gap-2', style: { color: 'var(--q-slime1)' } },
      React.createElement('span', { className: 'status-dot pulse-animation', style: { backgroundColor: 'var(--q-slime1)' } }),
      React.createElement('span', { className: 'text-sm' }, 'Connected')
    );
  }

  return null;
}

// ConnectionStatus is exported for use in NamespaceList sidebar
export { ConnectionStatus };

/**
 * Main content when no namespace is selected
 */
function WelcomeContent() {
  return React.createElement('div', { className: 'flex items-center justify-center h-full min-h-[400px]' },
    React.createElement('div', { className: 'text-center p-8' },
      React.createElement('svg', {
        className: 'w-16 h-16 mx-auto mb-4',
        style: { color: 'var(--q-bone0)' },
        fill: 'none',
        stroke: 'currentColor',
        viewBox: '0 0 24 24',
        strokeWidth: '1.5'
      },
        React.createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          d: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'
        })
      ),
      React.createElement('h2', {
        className: 'text-xl font-semibold mb-2',
        style: { color: 'var(--q-bone3)' }
      },
        'Select a Namespace'
      ),
      React.createElement('p', {
        className: 'max-w-md',
        style: { color: 'var(--q-bone1)' }
      },
        'Choose a namespace from the sidebar to view chat threads and assignments.'
      )
    )
  );
}

// localStorage key for sidebar collapse state (D8: namespaced)
const SIDEBAR_COLLAPSED_KEY = 'workflow-engine:sidebar-collapsed';

/**
 * Custom hook for persisted sidebar collapse state with responsive awareness
 * @param {Object} responsive - Responsive mode info from useResponsiveMode
 */
function useSidebarCollapse(responsive) {
  // Track user's explicit preference (from localStorage)
  const [userPreference, setUserPreference] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // WP-5: Auto-collapse at tablet breakpoint
  // Mobile uses drawer pattern so collapsed state doesn't apply the same way
  const isCollapsed = useMemo(() => {
    if (responsive.isMobile) {
      // Mobile: sidebar is a drawer, collapsed state managed separately
      return false;
    }
    if (responsive.isTablet) {
      // Tablet: auto-collapse unless user explicitly expanded
      return true;
    }
    // Desktop/Laptop: respect user preference
    return userPreference;
  }, [responsive.isMobile, responsive.isTablet, userPreference]);

  const toggleCollapsed = useCallback(() => {
    setUserPreference(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  return [isCollapsed, toggleCollapsed, userPreference];
}

/**
 * Mobile menu icon (hamburger)
 */
function MenuIcon() {
  return React.createElement('svg', {
    className: 'w-6 h-6',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M4 6h16M4 12h16M4 18h16'
    })
  );
}

/**
 * Main application layout with sidebar
 */
function AppLayout() {
  // WP-5: Responsive mode detection
  const responsive = useResponsiveMode();

  // Store only the namespace name to allow live lookup from subscription
  const [selectedNamespaceName, setSelectedNamespaceName] = useState(null);

  // Sidebar collapse state with localStorage persistence and responsive awareness
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapse(responsive);

  // WP-5: Mobile drawer state (separate from collapse)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Subscribe to live namespace data at the top level so both sidebar and main content
  // receive realtime updates via the same subscription
  const { data: namespaces } = useQuery(api.scheduler.getAllNamespaces);

  // Look up the selected namespace from live subscription data
  const selectedNamespace = namespaces?.find(ns => ns.name === selectedNamespaceName) || null;

  const handleNamespaceSelect = useCallback((namespaceName) => {
    setSelectedNamespaceName(namespaceName);
    // Close mobile drawer after selection
    if (responsive.isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [responsive.isMobile]);

  // WP-5: Toggle mobile drawer
  const handleToggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(prev => !prev);
  }, []);

  // WP-5: Close mobile drawer
  const handleCloseMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  // Render main content - ChatPanel when namespace selected, WelcomeContent otherwise
  const renderMainContent = () => {
    if (!selectedNamespace) {
      return React.createElement(WelcomeContent);
    }

    return React.createElement(ChatPanel, {
      namespaceId: selectedNamespace._id,
      namespaceName: selectedNamespace.name,
      responsive: responsive
    });
  };

  // Build sidebar classes based on responsive mode
  const sidebarClasses = [
    'sidebar',
    'sidebar-collapsible',
    sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
    responsive.isMobile && mobileDrawerOpen ? 'sidebar-mobile-open' : ''
  ].filter(Boolean).join(' ');

  return React.createElement('div', { className: 'app-layout' },
    // WP-5: Mobile header with menu toggle
    responsive.isMobile && React.createElement('header', { className: 'mobile-header show-mobile' },
      React.createElement('button', {
        type: 'button',
        onClick: handleToggleMobileDrawer,
        className: 'mobile-header-btn',
        'aria-label': 'Open navigation menu'
      }, React.createElement(MenuIcon)),
      React.createElement('span', { className: 'mobile-header-title' },
        selectedNamespace ? selectedNamespace.name : 'Workflow Engine'
      ),
      // Placeholder for right side button (could be assignment pane toggle)
      React.createElement('div', { style: { width: '2.5rem' } })
    ),

    // WP-5: Mobile sidebar overlay
    responsive.isMobile && React.createElement('div', {
      className: `sidebar-overlay ${mobileDrawerOpen ? 'visible' : ''}`,
      onClick: handleCloseMobileDrawer,
      'aria-hidden': 'true'
    }),

    // Sidebar with namespace list - collapsible (drawer on mobile)
    React.createElement('aside', {
      className: sidebarClasses,
      'aria-hidden': responsive.isMobile && !mobileDrawerOpen
    },
      React.createElement(NamespaceList, {
        namespaces: namespaces,
        selectedNamespace: selectedNamespaceName,
        onSelect: handleNamespaceSelect,
        isCollapsed: sidebarCollapsed && !responsive.isMobile,
        onToggleCollapse: responsive.isMobile ? handleCloseMobileDrawer : toggleSidebarCollapsed
      })
    ),

    // Main content area - directly shows chat view
    React.createElement('main', { className: 'main-content flex flex-col' },
      React.createElement('div', { className: 'flex-1 flex flex-col min-h-0' },
        renderMainContent()
      )
    )
  );
}

/**
 * Root App component with config loading and providers
 */
function App() {
  const [config, setConfig] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    loadConfig()
      .then(cfg => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Loading state
  if (loading) {
    return React.createElement('div', { className: 'flex items-center justify-center min-h-screen' },
      React.createElement('div', { className: 'text-center' },
        React.createElement(LoadingSpinner, { size: 'lg' }),
        React.createElement('p', { className: 'mt-4', style: { color: 'var(--q-bone1)' } }, 'Loading configuration...')
      )
    );
  }

  // Error state
  if (error) {
    return React.createElement('div', { className: 'flex items-center justify-center min-h-screen' },
      React.createElement('div', {
        className: 'max-w-md mx-auto p-6 border',
        style: {
          backgroundColor: 'var(--q-stone1)',
          borderColor: 'rgba(196, 56, 24, 0.3)',
          borderRadius: 0
        }
      },
        React.createElement('h2', { className: 'text-xl font-bold mb-4 text-red-400' }, 'Configuration Error'),
        React.createElement('p', { className: 'mb-4', style: { color: 'var(--q-bone1)' } }, error),
        React.createElement('button', {
          onClick: () => window.location.reload(),
          className: 'btn btn-primary'
        }, 'Retry')
      )
    );
  }

  // Invalid config state
  if (!isConfigValid(config)) {
    return React.createElement('div', { className: 'flex items-center justify-center min-h-screen' },
      React.createElement('div', {
        className: 'max-w-md mx-auto p-6 border',
        style: {
          backgroundColor: 'var(--q-stone1)',
          borderColor: 'var(--q-stone3)',
          borderRadius: 0
        }
      },
        React.createElement('h2', { className: 'text-xl font-bold mb-4 text-white' }, 'Configuration Required'),
        React.createElement('p', { className: 'mb-4', style: { color: 'var(--q-bone1)' } },
          'Please edit ',
          React.createElement('code', {
            className: 'px-2 py-0.5',
            style: { backgroundColor: 'var(--q-stone2)', borderRadius: 0 }
          }, 'config.json'),
          ' and set your Convex deployment URL.'
        ),
        React.createElement('pre', {
          className: 'p-3 text-sm overflow-x-auto',
          style: {
            backgroundColor: 'var(--q-void1)',
            color: 'var(--q-bone3)',
            borderRadius: 0
          }
        },
          JSON.stringify({ convexUrl: 'https://your-project.convex.cloud' }, null, 2)
        )
      )
    );
  }

  // Main application with providers
  // LoginGate wraps everything - shows login form if no password in sessionStorage
  return React.createElement(LoginGate, { convexUrl: config.convexUrl },
    React.createElement(ConvexProvider, { url: config.convexUrl },
      React.createElement(ErrorBoundary, null,
        React.createElement('div', {
          className: 'h-screen flex flex-col',
          style: { backgroundColor: 'var(--q-void1)' }
        },
          React.createElement(GrainOverlay),      // WP-3: Grain overlay effect
          React.createElement(ScanlineSweep),     // WP-3: Scanline sweep effect
          React.createElement(AppLayout)
        )
      )
    )
  );
}

// Initialize React
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
