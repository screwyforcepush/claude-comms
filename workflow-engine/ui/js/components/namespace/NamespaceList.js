// NamespaceList - Sidebar namespace list component
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useConvex } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { LoadingSkeleton, LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';
import { NamespaceCard } from './NamespaceCard.js';

/**
 * Connection status indicator for sidebar header
 */
function SidebarConnectionStatus() {
  const { connected, connecting, error } = useConvex();

  if (error) {
    return React.createElement('div', { className: 'flex items-center gap-1.5 text-red-400' },
      React.createElement('span', { className: 'status-dot bg-red-500' }),
      React.createElement('span', { className: 'text-xs' }, 'Offline')
    );
  }

  if (connecting) {
    return React.createElement('div', { className: 'flex items-center gap-1.5 text-yellow-400' },
      React.createElement(LoadingSpinner, { size: 'sm' }),
      React.createElement('span', { className: 'text-xs' }, 'Connecting')
    );
  }

  if (connected) {
    return React.createElement('div', { className: 'flex items-center gap-1.5 text-green-400' },
      React.createElement('span', { className: 'status-dot bg-green-500 pulse-animation' }),
      React.createElement('span', { className: 'text-xs' }, 'Live')
    );
  }

  return null;
}

/**
 * Search icon component
 */
function SearchIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4 text-gray-500',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
    })
  );
}

/**
 * Collapse toggle button - chevron icon that points left when expanded, right when collapsed
 */
function CollapseToggleButton({ isCollapsed, onToggle }) {
  return React.createElement('button', {
    onClick: onToggle,
    className: 'sidebar-collapse-btn p-1 rounded hover:bg-gray-700 transition-colors',
    title: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
    'aria-label': isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
  },
    React.createElement('svg', {
      className: `w-4 h-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`,
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24',
      strokeWidth: '2'
    },
      React.createElement('path', {
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        d: 'M15 19l-7-7 7-7'  // Chevron pointing left
      })
    )
  );
}

/**
 * Folder icon for collapsed state
 */
function FolderIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5 text-gray-400',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
    })
  );
}

/**
 * NamespaceList component - displays all namespaces with filtering
 * @param {Object} props
 * @param {Array} props.namespaces - Live namespaces data from parent subscription
 * @param {string} props.selectedNamespace - Currently selected namespace name
 * @param {Function} props.onSelect - Callback when namespace is selected (receives namespace name)
 * @param {boolean} props.isCollapsed - Whether the sidebar is collapsed
 * @param {Function} props.onToggleCollapse - Callback to toggle collapse state
 */
export function NamespaceList({ namespaces, selectedNamespace, onSelect, isCollapsed, onToggleCollapse }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fallback: If namespaces not provided from parent, fetch directly
  // This maintains backwards compatibility and handles initial loading state
  const { data: localNamespaces, loading, error } = useQuery(api.scheduler.getAllNamespaces);

  // Use parent-provided namespaces if available, otherwise use local query
  const effectiveNamespaces = namespaces || localNamespaces;

  // Filter namespaces based on search term
  const filteredNamespaces = useMemo(() => {
    if (!effectiveNamespaces) return [];
    if (!searchTerm.trim()) return effectiveNamespaces;

    const term = searchTerm.toLowerCase();
    return effectiveNamespaces.filter(ns =>
      ns.name.toLowerCase().includes(term)
    );
  }, [effectiveNamespaces, searchTerm]);

  // Sort namespaces: active first, then by lastActivity
  const sortedNamespaces = useMemo(() => {
    return [...filteredNamespaces].sort((a, b) => {
      // Active namespaces first
      const aActive = (a.counts?.active || 0) + (a.counts?.pending || 0);
      const bActive = (b.counts?.active || 0) + (b.counts?.pending || 0);
      if (aActive !== bActive) return bActive - aActive;

      // Then by last activity
      return (b.lastActivity || 0) - (a.lastActivity || 0);
    });
  }, [filteredNamespaces]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Loading state
  if (loading && !effectiveNamespaces) {
    return React.createElement('div', { className: 'p-3' },
      React.createElement('div', { className: 'mb-4' },
        React.createElement('div', { className: 'skeleton h-9 rounded' })
      ),
      React.createElement(LoadingSkeleton, { variant: 'namespace', count: 5 })
    );
  }

  // Error state - Convex subscriptions auto-reconnect, but offer reload for severe errors
  if (error) {
    return React.createElement('div', { className: 'p-3' },
      React.createElement('div', {
        className: 'bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center'
      },
        React.createElement('p', { className: 'text-red-400 text-sm' }, 'Failed to load namespaces'),
        React.createElement('p', { className: 'text-red-500/60 text-xs mt-1' }, error),
        React.createElement('button', {
          onClick: () => window.location.reload(),
          className: 'mt-3 text-sm text-red-400 hover:text-red-300 underline'
        }, 'Reload page')
      )
    );
  }

  // Collapsed view - show minimal icons
  if (isCollapsed) {
    return React.createElement('div', { className: 'flex flex-col h-full' },
      // Collapsed header with expand button
      React.createElement('div', { className: 'p-2 border-b border-gray-700 bg-gray-800/50 flex justify-center' },
        React.createElement(CollapseToggleButton, {
          isCollapsed: true,
          onToggle: onToggleCollapse
        })
      ),

      // Connection status indicator (icon only)
      React.createElement('div', { className: 'p-2 border-b border-gray-700 flex justify-center' },
        React.createElement(SidebarConnectionStatus)
      ),

      // Collapsed namespace icons
      React.createElement('div', { className: 'flex-1 overflow-y-auto' },
        sortedNamespaces.map(ns =>
          React.createElement('button', {
            key: ns.name,
            onClick: () => onSelect && onSelect(ns.name),
            className: `w-full p-2 flex justify-center items-center hover:bg-gray-800 transition-colors ${
              selectedNamespace === ns.name ? 'bg-blue-500/20 border-l-2 border-blue-500' : ''
            }`,
            title: ns.name
          },
            React.createElement('div', {
              className: `w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                (ns.counts?.active || 0) > 0
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700 text-gray-400'
              }`
            },
              (() => {
                const parts = ns.name.split(/[-_ ]+/);
                if (parts.length >= 2) {
                  return (parts[0][0] + parts[1][0]).toUpperCase();
                }
                return ns.name.substring(0, 2).toUpperCase();
              })()
            )
          )
        )
      )
    );
  }

  // Expanded view - full content
  return React.createElement('div', { className: 'flex flex-col h-full' },
    // Branding header with collapse toggle
    React.createElement('div', { className: 'p-3 border-b border-gray-700 bg-gray-800/50' },
      React.createElement('div', { className: 'flex items-center justify-between' },
        React.createElement('h1', { className: 'text-lg font-bold text-white' }, 'Workflow Engine'),
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement(SidebarConnectionStatus),
          React.createElement(CollapseToggleButton, {
            isCollapsed: false,
            onToggle: onToggleCollapse
          })
        )
      )
    ),

    // Search section
    React.createElement('div', { className: 'p-3 border-b border-gray-700' },
      // Title row
      React.createElement('div', { className: 'flex items-center justify-between mb-3' },
        React.createElement('h2', { className: 'text-sm font-semibold text-gray-400 uppercase tracking-wide' },
          'Namespaces'
        )
      ),

      // Search input
      React.createElement('div', { className: 'relative' },
        React.createElement('div', {
          className: 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'
        },
          React.createElement(SearchIcon)
        ),
        React.createElement('input', {
          type: 'text',
          value: searchTerm,
          onChange: handleSearchChange,
          placeholder: 'Filter namespaces...',
          className: 'input pl-9 text-sm'
        })
      ),

      // Count summary
      effectiveNamespaces && React.createElement('div', { className: 'mt-2 text-xs text-gray-500' },
        `${sortedNamespaces.length} of ${effectiveNamespaces.length} namespaces`
      )
    ),

    // Namespace list
    React.createElement('div', { className: 'flex-1 overflow-y-auto' },
      sortedNamespaces.length === 0
        ? React.createElement(EmptyState, {
            icon: 'folder',
            title: searchTerm ? 'No matches' : 'No namespaces',
            description: searchTerm
              ? `No namespaces match "${searchTerm}"`
              : 'Create assignments to see namespaces here'
          })
        : React.createElement('div', { className: 'divide-y divide-gray-700/50' },
            sortedNamespaces.map(ns =>
              React.createElement(NamespaceCard, {
                key: ns.name,
                namespace: ns,
                isSelected: selectedNamespace === ns.name,
                onClick: () => onSelect && onSelect(ns.name)
              })
            )
          )
    )
  );
}

export default NamespaceList;
