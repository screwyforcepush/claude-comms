// Main entry point for Workflow Engine UI
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig, isConfigValid } from './config.js';
import { ConvexProvider, useConvex } from './hooks/useConvex.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { LoadingSpinner } from './components/shared/LoadingSkeleton.js';
import { NamespaceList } from './components/namespace/NamespaceList.js';
import { NamespaceHeader } from './components/namespace/NamespaceHeader.js';
import { AssignmentList } from './components/assignment/AssignmentList.js';
import { AssignmentDetail } from './components/assignment/AssignmentDetail.js';
import { ChatPanel } from './components/chat/index.js';
import { HelloWorld } from './components/hello/index.js';

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

/**
 * App header component
 */
function Header() {
  return React.createElement('header', { className: 'header h-16 flex items-center px-4' },
    React.createElement('div', { className: 'flex items-center justify-between w-full max-w-7xl mx-auto' },
      // Logo/title
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('h1', { className: 'text-xl font-bold text-white' }, 'Workflow Engine'),
        React.createElement('span', { className: 'text-sm text-gray-500 hidden sm:inline' }, 'Queue Visualization')
      ),
      // Connection status
      React.createElement(ConnectionStatus)
    )
  );
}

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
        'Choose a namespace from the sidebar to view its assignments and job queues.'
      )
    )
  );
}

/**
 * Namespace content with assignments and detail view
 */
function NamespaceContent({ namespace, onRefresh }) {
  const [selectedItem, setSelectedItem] = useState(null);

  const handleSelectAssignment = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleJobSelect = useCallback((job) => {
    // Job selection is handled within AssignmentDetail
    console.log('Job selected:', job._id);
  }, []);

  // Reset selection when namespace changes
  React.useEffect(() => {
    setSelectedItem(null);
  }, [namespace.name]);

  // Show assignment detail if one is selected
  if (selectedItem) {
    return React.createElement(React.Fragment, null,
      React.createElement(NamespaceHeader, {
        namespace,
        onRefresh
      }),
      React.createElement('div', { className: 'flex-1 overflow-y-auto' },
        React.createElement(AssignmentDetail, {
          assignment: selectedItem.assignment,
          jobs: selectedItem.jobs || [],
          onBack: handleBack,
          onJobSelect: handleJobSelect
        })
      )
    );
  }

  // Show assignment list
  return React.createElement(React.Fragment, null,
    React.createElement(NamespaceHeader, {
      namespace,
      onRefresh
    }),
    React.createElement('div', { className: 'flex-1 overflow-y-auto' },
      React.createElement(AssignmentList, {
        key: namespace._id, // Reset filter state when namespace changes (D1)
        namespaceId: namespace._id,
        onSelectAssignment: handleSelectAssignment,
        selectedAssignmentId: null
      })
    )
  );
}

/**
 * Tab navigation icons
 */
function AssignmentsIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
    })
  );
}

function ChatIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
    })
  );
}

function HelloIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z'
    })
  );
}

/**
 * Tab navigation component
 */
function TabNavigation({ activeTab, onTabChange }) {
  const tabs = [
    { key: 'assignments', label: 'Assignments', icon: AssignmentsIcon },
    { key: 'chat', label: 'Chat', icon: ChatIcon },
    { key: 'hello', label: 'Hello', icon: HelloIcon }
  ];

  return React.createElement('div', {
    className: 'flex border-b border-gray-700 bg-gray-800/50'
  },
    tabs.map(tab =>
      React.createElement('button', {
        key: tab.key,
        onClick: () => onTabChange(tab.key),
        className: `flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
          activeTab === tab.key
            ? 'text-white border-blue-500 bg-gray-800'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
        }`
      },
        React.createElement(tab.icon),
        tab.label
      )
    )
  );
}

/**
 * Main application layout with sidebar
 */
function AppLayout() {
  const [selectedNamespace, setSelectedNamespace] = useState(null);
  const [activeTab, setActiveTab] = useState('assignments');

  const handleNamespaceSelect = useCallback((namespace) => {
    setSelectedNamespace(namespace);
  }, []);

  const handleRefresh = useCallback(() => {
    // Trigger refresh by updating state timestamp
    if (selectedNamespace) {
      setSelectedNamespace({ ...selectedNamespace, _refreshed: Date.now() });
    }
  }, [selectedNamespace]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Render main content based on active tab
  const renderMainContent = () => {
    if (!selectedNamespace) {
      return React.createElement(WelcomeContent);
    }

    if (activeTab === 'chat') {
      return React.createElement(ChatPanel, {
        namespaceId: selectedNamespace._id,
        namespaceName: selectedNamespace.name
      });
    }

    if (activeTab === 'hello') {
      return React.createElement(HelloWorld);
    }

    return React.createElement(NamespaceContent, {
      namespace: selectedNamespace,
      onRefresh: handleRefresh
    });
  };

  return React.createElement('div', { className: 'app-layout' },
    // Sidebar with namespace list
    React.createElement('aside', { className: 'sidebar' },
      React.createElement(NamespaceList, {
        selectedNamespace: selectedNamespace?.name,
        onSelect: handleNamespaceSelect
      })
    ),

    // Main content area with tab navigation
    React.createElement('main', { className: 'main-content flex flex-col' },
      // Tab navigation (only show when namespace is selected)
      selectedNamespace && React.createElement(TabNavigation, {
        activeTab: activeTab,
        onTabChange: handleTabChange
      }),

      // Content area
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
      React.createElement('div', { className: 'min-h-screen bg-gray-900 flex flex-col' },
        React.createElement(Header),
        React.createElement('div', { className: 'flex-1 flex' },
          React.createElement(AppLayout)
        )
      )
    )
  );
}

// Initialize React
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
