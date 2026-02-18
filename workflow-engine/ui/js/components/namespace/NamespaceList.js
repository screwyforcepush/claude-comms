// NamespaceList - Branding-only sidebar component
// WP-5: Simplified from full namespace selector to branding + connection status sidebar
import React from 'react';
import { useConvex } from '../../hooks/useConvex.js';
import { LoadingSpinner } from '../shared/LoadingSkeleton.js';

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
 * Collapse toggle button - chevron icon that points left when expanded, right when collapsed
 * Uses Q palette stone colors for hover, copper for chevron
 */
function CollapseToggleButton({ isCollapsed, onToggle }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return React.createElement('button', {
    onClick: onToggle,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: 'sidebar-collapse-btn p-1 transition-colors',
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
 * NamespaceList component - branding-only sidebar
 * WP-5: Simplified to show CC3 branding, connection status, and collapse toggle only.
 * Namespace selection has been moved to the namespace filter accordion in ChatSidebar.
 * @param {Object} props
 * @param {boolean} props.isCollapsed - Whether the sidebar is collapsed
 * @param {Function} props.onToggleCollapse - Callback to toggle collapse state
 */
export function NamespaceList({ isCollapsed, onToggleCollapse }) {
  // Collapsed view - show just expand button and connection status
  if (isCollapsed) {
    return React.createElement('div', { className: 'flex flex-col h-full' },
      // Collapsed header with expand button
      React.createElement('div', {
        className: 'p-2 border-b flex justify-center',
        style: {
          borderColor: 'var(--q-stone3)',
          backgroundColor: 'rgba(30, 24, 19, 0.5)'
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
      )
    );
  }

  // Expanded view - branding header with CC3 logo, title, connection status, and collapse button
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
    React.createElement('div', {
      className: 'p-3 border-b',
      style: {
        borderColor: 'var(--q-stone3)',
        backgroundColor: 'transparent'
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
    )
  );
}

export default NamespaceList;
