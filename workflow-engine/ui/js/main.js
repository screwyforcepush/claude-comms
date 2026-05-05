// Main entry point for Workflow Engine UI
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useQuery } from './hooks/useConvex.js';
import { api } from './api.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { ConfirmDialogProvider } from './components/shared/ConfirmDialog.js';
import { ChatPanel } from './components/chat/index.js';
import { IntrospectionDashboard } from './components/introspection/index.js';
import { GrainOverlay, ScanlineSweep } from './components/effects/index.js';
import { LoginGate } from './components/auth/index.js';

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

// WP-5: WelcomeContent removed — ChatPanel always renders (cross-namespace view)

/**
 * Main application layout with sidebar
 */
function AppLayout() {
  const responsive = useResponsiveMode();
  const [activeView, setActiveView] = useState('threads');

  // Subscribe to live namespace data
  const { data: namespaces } = useQuery(api.namespaces.list);

  // Mobile back button: close all drawers/panes instead of leaving app
  const [mobileBackTrigger, setMobileBackTrigger] = useState(0);

  useEffect(() => {
    if (!responsive.isMobile) return;

    history.pushState(null, '');

    const handlePopState = () => {
      if (activeView === 'introspection') {
        setActiveView('threads');
      } else {
        setMobileBackTrigger(c => c + 1);
      }
      history.pushState(null, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, responsive.isMobile]);

  return React.createElement('div', { className: 'app-layout' },
    // Main content area — ChatPanel is the full operations center
    React.createElement('main', { className: 'main-content flex flex-col', style: { marginLeft: 0 } },
      React.createElement('div', { className: 'flex-1 flex flex-col min-h-0' },
        activeView === 'introspection'
          ? React.createElement(IntrospectionDashboard, {
              namespaces: namespaces,
              responsive: responsive,
              onBack: () => setActiveView('threads')
            })
          : React.createElement(ChatPanel, {
              namespaces: namespaces,
              responsive: responsive,
              mobileBackTrigger: mobileBackTrigger,
              onOpenIntrospection: () => setActiveView('introspection')
            })
      )
    )
  );
}

/**
 * Root App component
 * LoginGate handles both Convex URL + password collection, then wraps children
 * with ConvexProvider and PasswordProvider internally.
 */
function App() {
  return React.createElement(LoginGate, null,
    React.createElement(ErrorBoundary, null,
      React.createElement(ConfirmDialogProvider, null,
        React.createElement('div', {
          className: 'h-screen flex flex-col',
          style: { backgroundColor: 'var(--q-void1)' }
        },
          React.createElement(GrainOverlay),
          React.createElement(ScanlineSweep),
          React.createElement(AppLayout)
        )
      )
    )
  );
}

// Initialize React
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
