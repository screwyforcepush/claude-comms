// NamespaceList - Sidebar namespace list component
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { LoadingSkeleton, LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';
import { NamespaceCard } from './NamespaceCard.js';

/**
 * Refresh icon component
 */
function RefreshIcon({ className = '' }) {
  return React.createElement('svg', {
    className: `w-4 h-4 ${className}`,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
    })
  );
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
 * NamespaceList component - displays all namespaces with filtering
 * @param {Object} props
 * @param {string} props.selectedNamespace - Currently selected namespace name
 * @param {Function} props.onSelect - Callback when namespace is selected
 */
export function NamespaceList({ selectedNamespace, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Fetch namespaces from Convex
  const { data: namespaces, loading, error } = useQuery(api.scheduler.getAllNamespaces);

  // Polling every 30s (Decision D4)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filter namespaces based on search term
  const filteredNamespaces = useMemo(() => {
    if (!namespaces) return [];
    if (!searchTerm.trim()) return namespaces;

    const term = searchTerm.toLowerCase();
    return namespaces.filter(ns =>
      ns.name.toLowerCase().includes(term)
    );
  }, [namespaces, searchTerm]);

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

  const handleRefresh = useCallback(() => {
    // Force re-render which will trigger subscription update
    setLastRefresh(Date.now());
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Loading state
  if (loading && !namespaces) {
    return React.createElement('div', { className: 'p-3' },
      React.createElement('div', { className: 'mb-4' },
        React.createElement('div', { className: 'skeleton h-9 rounded' })
      ),
      React.createElement(LoadingSkeleton, { variant: 'namespace', count: 5 })
    );
  }

  // Error state
  if (error) {
    return React.createElement('div', { className: 'p-3' },
      React.createElement('div', {
        className: 'bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center'
      },
        React.createElement('p', { className: 'text-red-400 text-sm' }, 'Failed to load namespaces'),
        React.createElement('p', { className: 'text-red-500/60 text-xs mt-1' }, error),
        React.createElement('button', {
          onClick: handleRefresh,
          className: 'mt-3 text-sm text-red-400 hover:text-red-300 underline'
        }, 'Try again')
      )
    );
  }

  return React.createElement('div', { className: 'flex flex-col h-full' },
    // Header with search
    React.createElement('div', { className: 'p-3 border-b border-gray-700' },
      // Title row with refresh button
      React.createElement('div', { className: 'flex items-center justify-between mb-3' },
        React.createElement('h2', { className: 'text-sm font-semibold text-gray-400 uppercase tracking-wide' },
          'Namespaces'
        ),
        React.createElement('button', {
          onClick: handleRefresh,
          className: 'p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors',
          title: 'Refresh namespace list'
        },
          loading
            ? React.createElement(LoadingSpinner, { size: 'sm' })
            : React.createElement(RefreshIcon)
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
      namespaces && React.createElement('div', { className: 'mt-2 text-xs text-gray-500' },
        `${sortedNamespaces.length} of ${namespaces.length} namespaces`
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
                onClick: () => onSelect && onSelect(ns)
              })
            )
          )
    )
  );
}

export default NamespaceList;
