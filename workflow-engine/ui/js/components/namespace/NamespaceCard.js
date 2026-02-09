// NamespaceCard - Individual namespace card in the sidebar list
// WP-5: Transformed to Q palette brandkit styling with riveted panel aesthetic
// WP-6: Uses inline Fullbright component for status indicator
import React from 'react';
import { Timestamp } from '../shared/Timestamp.js';

/**
 * Fullbright - Inline glowing dot indicator using brandkit pattern
 * Uses radial gradient + box-shadow glow effect
 * @param {Object} props
 * @param {string} props.color - CSS color value (use Q palette CSS variables)
 * @param {boolean} props.pulse - Whether to animate with fbPulse
 * @param {number} props.size - Dot size in pixels
 */
function Fullbright({ color, pulse = false, size = 7 }) {
  return React.createElement('span', {
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}, ${color}88)`,
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px ${color}88, 0 0 ${size * 2}px ${color}44`,
      animation: pulse ? 'fbPulse 2.5s ease-in-out infinite' : 'none'
    }
  });
}

/**
 * Map status to Q palette colors for Fullbright indicator
 * @param {string} status - Status value
 * @returns {Object} { color: string, pulse: boolean, size: number }
 */
function getStatusIndicatorProps(status) {
  switch (status) {
    case 'active':
      return { color: 'var(--q-teleport-bright)', pulse: true, size: 7 };
    case 'blocked':
      return { color: 'var(--q-lava1)', pulse: false, size: 7 };
    case 'pending':
      return { color: 'var(--q-torch)', pulse: false, size: 7 };
    case 'complete':
      return { color: 'var(--q-slime1)', pulse: false, size: 5 }; // muted, smaller
    default:
      return { color: 'var(--q-iron1)', pulse: false, size: 7 };
  }
}

/**
 * Count badge for status counts
 * WP-5: Uses Q palette colors with CSS variables
 * - pending: torch (warning/yellow)
 * - active: teleport-bright (running/purple)
 * - blocked: lava1 (danger/red)
 * - complete: slime0 bg alpha, slime1 text (success muted)
 */
function CountBadge({ count, status }) {
  if (count === 0) return null;

  // Q palette color mapping using CSS variables
  const colorStyles = {
    pending: {
      backgroundColor: 'rgba(212, 160, 48, 0.15)', // --q-torch with alpha
      color: 'var(--q-torch)',
    },
    active: {
      backgroundColor: 'rgba(92, 60, 124, 0.15)', // --q-teleport-bright with alpha
      color: 'var(--q-teleport-bright)',
    },
    blocked: {
      backgroundColor: 'rgba(196, 56, 24, 0.15)', // --q-lava1 with alpha
      color: 'var(--q-lava1)',
    },
    complete: {
      backgroundColor: 'rgba(44, 84, 24, 0.15)', // --q-slime0 with alpha
      color: 'var(--q-slime1)', // success muted - slime1 text
    },
  };

  const fallbackStyle = {
    backgroundColor: 'rgba(80, 76, 64, 0.15)', // --q-iron1 with alpha
    color: 'var(--q-iron1)',
  };

  const badgeStyle = colorStyles[status] || fallbackStyle;

  return React.createElement('span', {
    style: {
      ...badgeStyle,
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--t-type-size-badge)',
      paddingLeft: '6px',
      paddingRight: '6px',
      paddingTop: '2px',
      paddingBottom: '2px',
      borderRadius: '9999px', // Keep pill shape for badges
      letterSpacing: 'var(--t-type-tracking-tight)',
    }
  }, count);
}

/**
 * NamespaceCard component - displays a single namespace in the sidebar
 * WP-5: Transformed to Q palette brandkit styling
 * @param {Object} props
 * @param {Object} props.namespace - Namespace data { name, counts, lastActivity }
 * @param {boolean} props.isSelected - Whether this namespace is currently selected
 * @param {Function} props.onClick - Click handler
 */
export function NamespaceCard({ namespace, isSelected = false, onClick }) {
  const { name, assignmentCounts, lastActivity, updatedAt } = namespace;
  const counts = assignmentCounts || { pending: 0, active: 0, blocked: 0, complete: 0 };

  // Calculate total active items (pending + active + blocked)
  const activeCount = (counts.pending || 0) + (counts.active || 0) + (counts.blocked || 0);

  // Determine primary status for indicator
  let primaryStatus = 'complete';
  if (counts.blocked > 0) primaryStatus = 'blocked';
  else if (counts.active > 0) primaryStatus = 'active';
  else if (counts.pending > 0) primaryStatus = 'pending';

  // WP-5: Q palette button styling using inline styles with CSS variables
  // Selected: stone2 background, torch left border
  // Hover: stone1 background
  // Focus: stone2 background
  const buttonStyle = {
    width: '100%',
    textAlign: 'left',
    padding: '12px',
    transition: 'background-color var(--t-anim-transition-fast), border-color var(--t-anim-transition-fast)',
    backgroundColor: isSelected ? 'var(--q-stone2)' : 'transparent',
    outline: 'none',
    cursor: 'pointer',
    border: 'none',
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: isSelected ? 'var(--q-torch)' : 'transparent',
  };

  return React.createElement('button', {
    onClick: () => onClick && onClick(namespace),
    className: 'w-full text-left p-3 transition-colors focus:outline-none',
    style: buttonStyle,
    onMouseEnter: (e) => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = 'var(--q-stone1)';
      }
    },
    onMouseLeave: (e) => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = 'transparent';
      }
    },
    onFocus: (e) => {
      e.currentTarget.style.backgroundColor = 'var(--q-stone2)';
    },
    onBlur: (e) => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = 'transparent';
      }
    }
  },
    // Header row: name + active indicator
    // WP-5: Q palette text colors - bone3 (bright) for selected, bone2 (normal) for unselected
    React.createElement('div', { className: 'flex items-center justify-between mb-2' },
      React.createElement('span', {
        className: 'font-medium truncate',
        style: {
          color: isSelected ? 'var(--q-bone3)' : 'var(--q-bone2)',
        }
      }, name),
      activeCount > 0 && React.createElement(Fullbright, getStatusIndicatorProps(primaryStatus))
    ),

    // Status counts row
    React.createElement('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
      React.createElement(CountBadge, { count: counts.pending, status: 'pending' }),
      React.createElement(CountBadge, { count: counts.active, status: 'active' }),
      React.createElement(CountBadge, { count: counts.blocked, status: 'blocked' }),
      React.createElement(CountBadge, { count: counts.complete, status: 'complete' })
    ),

    // Last activity timestamp
    (lastActivity || updatedAt) && React.createElement('div', { className: 'text-xs' },
      React.createElement(Timestamp, { date: lastActivity || updatedAt, format: 'relative' })
    )
  );
}

export default NamespaceCard;
