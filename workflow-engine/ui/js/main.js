// Main entry point for Workflow Engine UI
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig, isConfigValid } from './config.js';
import { ConvexProvider, useConvex, useQuery } from './hooks/useConvex.js';
import { api } from './api.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { LoadingSpinner } from './components/shared/LoadingSkeleton.js';
import { NamespaceList } from './components/namespace/NamespaceList.js';
import { ChatPanel } from './components/chat/index.js';

/**
 * Connection status indicator in header
 */
function ConnectionStatus() {
  const { connected, connecting, error } = useConvex();

  if (error) {
    return React.createElement('div', { className: 'flex items-center gap-2 text-red-400' },
      React.createElement('span', { className: 'status-dot bg-red-500' }),
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
    return React.createElement('div', { className: 'flex items-center gap-2 text-green-400' },
      React.createElement('span', { className: 'status-dot bg-green-500 pulse-animation' }),
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
        className: 'w-16 h-16 text-gray-600 mx-auto mb-4',
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
      React.createElement('h2', { className: 'text-xl font-semibold text-gray-300 mb-2' },
        'Select a Namespace'
      ),
      React.createElement('p', { className: 'text-gray-500 max-w-md' },
        'Choose a namespace from the sidebar to view chat threads and assignments.'
      )
    )
  );
}

/**
 * Main application layout with sidebar
 */
function AppLayout() {
  // Store only the namespace name to allow live lookup from subscription
  const [selectedNamespaceName, setSelectedNamespaceName] = useState(null);

  // Subscribe to live namespace data at the top level so both sidebar and main content
  // receive realtime updates via the same subscription
  const { data: namespaces } = useQuery(api.scheduler.getAllNamespaces);

  // Look up the selected namespace from live subscription data
  const selectedNamespace = namespaces?.find(ns => ns.name === selectedNamespaceName) || null;

  const handleNamespaceSelect = useCallback((namespaceName) => {
    setSelectedNamespaceName(namespaceName);
  }, []);

  // Render main content - ChatPanel when namespace selected, WelcomeContent otherwise
  const renderMainContent = () => {
    if (!selectedNamespace) {
      return React.createElement(WelcomeContent);
    }

    return React.createElement(ChatPanel, {
      namespaceId: selectedNamespace._id,
      namespaceName: selectedNamespace.name
    });
  };

  return React.createElement('div', { className: 'app-layout' },
    // Sidebar with namespace list
    React.createElement('aside', { className: 'sidebar' },
      React.createElement(NamespaceList, {
        namespaces: namespaces,
        selectedNamespace: selectedNamespaceName,
        onSelect: handleNamespaceSelect
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
        React.createElement('p', { className: 'text-gray-400 mt-4' }, 'Loading configuration...')
      )
    );
  }

  // Error state
  if (error) {
    return React.createElement('div', { className: 'flex items-center justify-center min-h-screen' },
      React.createElement('div', { className: 'max-w-md mx-auto bg-gray-800 rounded-xl p-6 border border-red-500/30' },
        React.createElement('h2', { className: 'text-xl font-bold mb-4 text-red-400' }, 'Configuration Error'),
        React.createElement('p', { className: 'text-gray-400 mb-4' }, error),
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
      React.createElement('div', { className: 'max-w-md mx-auto bg-gray-800 rounded-xl p-6 border border-gray-700' },
        React.createElement('h2', { className: 'text-xl font-bold mb-4 text-white' }, 'Configuration Required'),
        React.createElement('p', { className: 'text-gray-400 mb-4' },
          'Please edit ',
          React.createElement('code', { className: 'bg-gray-700 px-2 py-0.5 rounded' }, 'config.json'),
          ' and set your Convex deployment URL.'
        ),
        React.createElement('pre', { className: 'bg-gray-900 p-3 rounded text-sm text-gray-300 overflow-x-auto' },
          JSON.stringify({ convexUrl: 'https://your-project.convex.cloud' }, null, 2)
        )
      )
    );
  }

  // Main application with providers
  return React.createElement(ConvexProvider, { url: config.convexUrl },
    React.createElement(ErrorBoundary, null,
      React.createElement('div', { className: 'h-screen bg-gray-900 flex flex-col' },
        React.createElement(AppLayout)
      )
    )
  );
}

// Initialize React
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
