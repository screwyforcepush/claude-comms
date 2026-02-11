// NamespaceList - Sidebar namespace list component
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useConvex } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { LoadingSkeleton, LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';
import { NamespaceCard } from './NamespaceCard.js';

/**
 * Connection status indicator for sidebar header
 * Uses fullbright dot pattern with Q palette colors
 */
function SidebarConnectionStatus() {
  const { connected, connecting, error } = useConvex();

  if (error) {
    return React.createElement('div', {
      className: 'flex items-center gap-1.5',
      style: { color: 'var(--q-lava1)' }
    },
      React.createElement('span', {
        className: 'fullbright-dot fullbright-dot--sm',
        style: { color: 'var(--q-lava1)' }
      }),
      React.createElement('span', { className: 'text-xs' }, 'Offline')
    );
  }

  if (connecting) {
    return React.createElement('div', {
      className: 'flex items-center gap-1.5',
      style: { color: 'var(--q-torch)' }
    },
      React.createElement(LoadingSpinner, { size: 'sm' }),
      React.createElement('span', { className: 'text-xs' }, 'Connecting')
    );
  }

  if (connected) {
    return React.createElement('div', {
      className: 'flex items-center gap-1.5',
      style: { color: 'var(--q-slime1)' }
    },
      React.createElement('span', {
        className: 'fullbright-dot fullbright-dot--sm fullbright-pulse',
        style: { color: 'var(--q-slime1)' }
      }),
      React.createElement('span', { className: 'text-xs sr-only' }, 'Live')
    );
  }

  return null;
}

/**
 * Search icon component
 * Uses Q palette bone0 color
 */
function SearchIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    style: { color: 'var(--q-bone0)' },
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
 * Uses Q palette stone colors for hover, copper for chevron
 */
function CollapseToggleButton({ isCollapsed, onToggle }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return React.createElement('button', {
    onClick: onToggle,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: 'sidebar-collapse-btn p-1 rounded transition-colors',
    style: {
      backgroundColor: isHovered ? 'var(--q-stone2)' : 'transparent'
    },
    title: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
    'aria-label': isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
  },
    React.createElement('svg', {
      className: `w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`,
      style: { color: isHovered ? 'var(--q-torch)' : 'var(--q-copper2)' },
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
 * Uses Q palette copper3 color
 */
function FolderIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5',
    style: { color: 'var(--q-copper3)' },
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
  const { data: localNamespaces, loading, error } = useQuery(
    namespaces ? null : api.namespaces.list
  );

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

  // Sort namespaces: active first, then by updatedAt
  const sortedNamespaces = useMemo(() => {
    return [...filteredNamespaces].sort((a, b) => {
      // Active namespaces first
      const aC = a.assignmentCounts || {};
      const bC = b.assignmentCounts || {};
      const aActive = (aC.active || 0) + (aC.pending || 0);
      const bActive = (bC.active || 0) + (bC.pending || 0);
      if (aActive !== bActive) return bActive - aActive;

      // Then by last activity
      return (b.updatedAt || 0) - (a.updatedAt || 0);
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
  // Uses Q palette for backgrounds, borders and selected state with torch glow
  if (isCollapsed) {
    return React.createElement('div', { className: 'flex flex-col h-full' },
      // Collapsed header with expand button
      React.createElement('div', {
        className: 'p-2 border-b flex justify-center',
        style: {
          borderColor: 'var(--q-stone3)',
          backgroundColor: 'rgba(30, 24, 19, 0.5)'  // --q-stone1 with 50% opacity
        }
      },
        React.createElement(CollapseToggleButton, {
          isCollapsed: true,
          onToggle: onToggleCollapse
        })
      ),

      // Connection status indicator (icon only)
      React.createElement('div', {
        className: 'p-2 border-b flex justify-center',
        style: { borderColor: 'var(--q-stone3)' }
      },
        React.createElement(SidebarConnectionStatus)
      ),

      // Collapsed namespace icons
      React.createElement('div', { className: 'flex-1 overflow-y-auto' },
        sortedNamespaces.map(ns => {
          const isSelected = selectedNamespace === ns.name;
          const hasActive = (ns.assignmentCounts?.active || 0) > 0;

          return React.createElement('button', {
            key: ns.name,
            onClick: () => onSelect && onSelect(ns.name),
            className: 'w-full p-2 flex justify-center items-center transition-colors',
            style: {
              backgroundColor: isSelected ? 'rgba(212, 160, 48, 0.12)' : 'transparent',  // torch with alpha
              borderLeft: isSelected ? '2px solid var(--q-torch)' : '2px solid transparent',
              boxShadow: isSelected ? 'inset 0 0 20px rgba(212, 160, 48, 0.08)' : 'none'
            },
            title: ns.name
          },
            React.createElement('div', {
              className: 'w-8 h-8 flex items-center justify-center text-xs font-semibold',
              style: {
                backgroundColor: hasActive ? 'rgba(60, 116, 32, 0.2)' : 'var(--q-stone2)',  // slime1/20% or stone2
                color: hasActive ? 'var(--q-slime1)' : 'var(--q-bone0)',
                borderRadius: '0'  // Quake aesthetic: no rounded corners
              }
            },
              (() => {
                const parts = ns.name.split(/[-_ ]+/);
                if (parts.length >= 2) {
                  return (parts[0][0] + parts[1][0]).toUpperCase();
                }
                return ns.name.substring(0, 2).toUpperCase();
              })()
            )
          );
        })
      )
    );
  }

  // Expanded view - full content
  // Uses Q palette for all visual styling with Silkscreen display font for branding
  // CopperTexture pattern applied to entire sidebar per brandkit.jsx
  return React.createElement('div', {
    className: 'flex flex-col h-full',
    style: {
      background: `
        repeating-linear-gradient(90deg, transparent 0px, transparent 63px, var(--q-stone0-40) 63px, var(--q-stone0-40) 64px),
        repeating-linear-gradient(0deg, transparent 0px, transparent 63px, var(--q-stone0-30) 63px, var(--q-stone0-30) 64px),
        linear-gradient(180deg, var(--q-copper0-30), transparent 2px),
        linear-gradient(135deg, var(--q-stone1) 0%, var(--q-void1) 100%)
      `
    }
  },
    // Branding header with collapse toggle
    // Q palette: stone1 semi-transparent background, stone3 border, torch title with text shadow
    React.createElement('div', {
      className: 'p-3 border-b',
      style: {
        borderColor: 'var(--q-stone3)',
        backgroundColor: 'transparent'  // transparent to show CopperTexture from parent
      }
    },
      React.createElement('div', { className: 'flex items-center justify-between' },
        React.createElement('div', { className: 'flex items-center gap-2', style: { minWidth: 0 } },
          React.createElement('img', {
            src: 'public/cc3icon.png',
            alt: 'CC3',
            style: { width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0 }
          }),
          React.createElement('h1', {
            style: {
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              color: 'var(--q-torch)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              textShadow: '0 0 30px rgba(212, 160, 48, 0.22), 0 2px 4px var(--q-void0)',
              margin: 0,
              animation: 'torchFlicker 6s infinite',
              whiteSpace: 'nowrap'
            }
          }, 'CLAUDE COMMS III')
        ),
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
    // Q palette: stone3 border, display font for heading, copper2 text
    React.createElement('div', {
      className: 'p-3 border-b',
      style: { borderColor: 'var(--q-stone3)' }
    },
      // Title row
      React.createElement('div', { className: 'flex items-center justify-between mb-3' },
        React.createElement('h2', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            color: 'var(--q-copper2)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            margin: 0
          }
        },
          'Namespaces'
        )
      ),

      // Search input - uses rune-input class for Q palette styling
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
          className: 'rune-input pl-9 text-sm'
        })
      ),

      // Count summary
      effectiveNamespaces && React.createElement('div', {
        className: 'mt-2 text-xs',
        style: { color: 'var(--q-bone0)' }
      },
        `${sortedNamespaces.length} of ${effectiveNamespaces.length} namespaces`
      )
    ),

    // Namespace list
    // Q palette: stone3 semi-transparent dividers
    React.createElement('div', { className: 'flex-1 overflow-y-auto' },
      sortedNamespaces.length === 0
        ? React.createElement(EmptyState, {
            icon: 'folder',
            title: searchTerm ? 'No matches' : 'No namespaces',
            description: searchTerm
              ? `No namespaces match "${searchTerm}"`
              : 'Create assignments to see namespaces here'
          })
        : React.createElement('div', {
            style: {
              // Use CSS border-bottom on each child instead of divide utility
              // This is handled in the NamespaceCard component
            }
          },
            sortedNamespaces.map((ns, index) =>
              React.createElement('div', {
                key: ns.name,
                style: {
                  borderBottom: index < sortedNamespaces.length - 1 ? '1px solid rgba(52, 42, 32, 0.5)' : 'none'  // --q-stone3 with 50% opacity
                }
              },
                React.createElement(NamespaceCard, {
                  namespace: ns,
                  isSelected: selectedNamespace === ns.name,
                  onClick: () => onSelect && onSelect(ns.name)
                })
              )
            )
          )
    )
  );
}

export default NamespaceList;
