// ThreadItem - Single thread preview in sidebar
// WP-6: Transformed to Q palette brandkit styling
// WP-7: Fullbright notification dot pattern for status and alignment indicators
import React from 'react';
import { QIcon } from '../shared/index.js';

/**
 * Fullbright indicator component - glowing status dot
 * Follows brandkit pattern with radial gradient and layered box-shadow glow
 * @param {Object} props
 * @param {string} props.color - CSS color value (use Q palette CSS variables)
 * @param {boolean} props.pulse - Enable pulse animation for active states
 * @param {number} props.size - Dot size in pixels (default: 7)
 * @param {string} props.title - Tooltip text
 * @param {string} props.className - Additional CSS classes for positioning
 */
function Fullbright({ color, pulse = false, size = 7, title, className = '' }) {
  return React.createElement('span', {
    className: className,
    title: title,
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}, ${color}88)`,
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px ${color}88, 0 0 ${size * 2}px ${color}44`,
      animation: pulse ? 'fbPulse 2.5s ease-in-out infinite' : 'none',
      flexShrink: 0
    }
  });
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
}


/**
 * Get Fullbright status configuration
 * Maps status to Q palette colors and pulse state
 * @returns {Object} { color: string, pulse: boolean }
 */
function getFullbrightStatusConfig(status) {
  switch (status) {
    case 'blocked':
    case 'failed':
      return { color: 'var(--q-lava1)', pulse: false };
    case 'active':
    case 'running':
      return { color: 'var(--q-teleport-bright)', pulse: true };
    case 'pending':
      return { color: 'var(--q-torch)', pulse: false };
    case 'complete':
      return { color: 'var(--q-slime1)', pulse: false };
    default:
      return { color: 'var(--q-iron1)', pulse: false };
  }
}

/**
 * Get Fullbright alignment configuration
 * Maps alignment status to Q palette colors
 * @returns {Object|null} { color: string } or null if no alignment
 */
function getFullbrightAlignmentConfig(alignmentStatus) {
  switch (alignmentStatus) {
    case 'aligned':
      return { color: 'var(--q-slime1)' };
    case 'uncertain':
      return { color: 'var(--q-torch)' };
    case 'misaligned':
      return { color: 'var(--q-lava1)' };
    default:
      return null;
  }
}

/**
 * Get mode configuration for styling with Q palette
 * Jam: teleport palette + eye icon
 * Cook: torch palette + axe icon
 * Guardian: slime palette + armor icon
 */
function getModeConfig(mode) {
  switch (mode) {
    case 'cook':
      return {
        iconName: 'axe',
        label: 'Cook',
        // Q palette: torch (orange/copper)
        bgStyle: {
          backgroundColor: 'rgba(212, 160, 48, 0.2)',
          color: 'var(--q-torch)'
        },
        badgeStyle: {
          backgroundColor: 'rgba(212, 160, 48, 0.2)',
          color: 'var(--q-torch)',
          fontFamily: 'var(--font-display)'
        }
      };
    case 'guardian':
      return {
        iconName: 'armor',
        label: 'Guardian',
        // Q palette: slime (green)
        bgStyle: {
          backgroundColor: 'rgba(60, 116, 32, 0.2)',
          color: 'var(--q-slime1)'
        },
        badgeStyle: {
          backgroundColor: 'rgba(60, 116, 32, 0.2)',
          color: 'var(--q-slime1)',
          fontFamily: 'var(--font-display)'
        }
      };
    case 'jam':
    default:
      return {
        iconName: 'eye',
        label: 'Jam',
        // Q palette: teleport (purple)
        bgStyle: {
          backgroundColor: 'rgba(92, 60, 124, 0.2)',
          color: 'var(--q-teleport)'
        },
        badgeStyle: {
          backgroundColor: 'rgba(92, 60, 124, 0.2)',
          color: 'var(--q-teleport)',
          fontFamily: 'var(--font-display)'
        }
      };
  }
}

// NOTE: getAlignmentEmoji removed - replaced with Fullbright dots via getFullbrightAlignmentConfig

/**
 * Get Q palette assignment status badge style
 */
function getAssignmentStatusStyle(status) {
  switch (status) {
    case 'blocked':
    case 'failed':
      return {
        backgroundColor: 'rgba(196, 56, 24, 0.2)',
        color: 'var(--q-lava1)',
        fontFamily: 'var(--font-display)'
      };
    case 'active':
    case 'running':
      return {
        backgroundColor: 'rgba(92, 60, 124, 0.2)',
        color: 'var(--q-teleport-bright)',
        fontFamily: 'var(--font-display)'
      };
    default:
      return {
        backgroundColor: 'rgba(80, 76, 64, 0.2)',
        color: 'var(--q-iron1)',
        fontFamily: 'var(--font-display)'
      };
  }
}

/**
 * ThreadIcon component - Visual icon for thread (used in collapsed view and list)
 * WP-7: Uses Fullbright dots for status and alignment indicators
 * @param {Object} props
 * @param {Object} props.thread - Thread object
 * @param {Object} props.assignment - Linked assignment
 * @param {boolean} props.isSelected - Whether selected
 * @param {Function} props.onClick - Click handler
 */
export function ThreadIcon({ thread, assignment, isSelected, onClick }) {
  const modeConfig = getModeConfig(thread.mode);

  // Alignment Fullbright config (Guardian mode only)
  const alignmentConfig = thread.mode === 'guardian' && assignment
    ? getFullbrightAlignmentConfig(assignment.alignmentStatus)
    : null;

  // Status Fullbright config
  const statusConfig = assignment?.status
    ? getFullbrightStatusConfig(assignment.status)
    : null;

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    title: thread.title || 'New Chat',
    className: `relative flex-shrink-0 w-10 h-10 flex items-center justify-center transition-colors`,
    style: isSelected
      ? {
          backgroundColor: 'var(--q-stone2)',
          boxShadow: '0 0 0 2px var(--q-torch)'
        }
      : undefined
  },
    React.createElement('div', {
      className: 'w-8 h-8 flex items-center justify-center',
      style: modeConfig.bgStyle
    },
      React.createElement(QIcon, {
        name: modeConfig.iconName,
        size: 16,
        color: 'currentColor'
      })
    ),

    // Alignment status indicator (guardian mode only) - Top Right - Fullbright dot
    alignmentConfig && React.createElement(Fullbright, {
      color: alignmentConfig.color,
      size: 6,
      pulse: false,
      title: `Alignment: ${assignment.alignmentStatus}`,
      className: 'absolute -top-0.5 -right-0.5'
    }),

    // Assignment status dot - Bottom Right - Fullbright with pulse for active states
    statusConfig && React.createElement(Fullbright, {
      color: statusConfig.color,
      size: 7,
      pulse: statusConfig.pulse,
      title: `Status: ${assignment.status}`,
      className: 'absolute -bottom-0.5 -right-0.5'
    })
  );
}

/**
 * ThreadItem component - Single thread in sidebar list
 * WP-6: Transformed with Q palette styling
 * - Copper texture hover state
 * - Torch accent border for selected
 * - Mode badges use Q palette (teleport/torch/slime)
 * - Status dots use Q palette
 * - Text uses bone palette
 * - Display font for mode labels
 * @param {Object} props
 * @param {Object} props.thread - Thread object
 * @param {Object} props.assignment - Linked assignment (for guardian mode)
 * @param {boolean} props.isSelected - Whether this thread is selected
 * @param {Function} props.onClick - Callback when thread is clicked
 */
export function ThreadItem({ thread, assignment, isSelected, onClick }) {
  const modeConfig = getModeConfig(thread.mode);
  // Note: Alignment is displayed via Fullbright dot in ThreadIcon (top-right position)

  // Base styles for the button
  const baseStyle = {
    transition: 'background-color 0.15s, border-color 0.15s'
  };

  // Selected state: torch accent border
  const selectedStyle = isSelected
    ? {
        ...baseStyle,
        backgroundColor: 'rgba(212, 160, 48, 0.15)',
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: 'var(--q-torch)'
      }
    : {
        ...baseStyle,
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: 'transparent'
      };

  // Hover state is handled via CSS class with Q palette copper tint
  // We use a combination of inline styles and a custom class

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    className: `w-full text-left px-3 py-3 thread-item-q`,
    style: selectedStyle
  },
    React.createElement('div', { className: 'flex items-start gap-3' },
      // Icon
      React.createElement(ThreadIcon, {
        thread,
        assignment,
        isSelected: false, // Don't show ring inside the item, the item itself is highlighted
        onClick: null // Let parent button handle click
      }),

      // Content
      React.createElement('div', { className: 'flex-1 min-w-0' },
        // Title - Q palette bone3 for selected, bone2 for normal
        React.createElement('div', {
          className: 'text-sm font-medium truncate',
          style: {
            color: isSelected ? 'var(--q-bone4)' : 'var(--q-bone2)'
          }
        }, thread.title || 'New Chat'),

        // Meta info
        React.createElement('div', {
          className: 'flex items-center gap-2 mt-0.5 flex-wrap'
        },
          // Mode badge with Q palette and display font
          React.createElement('span', {
            className: 'text-xs px-1.5 py-0.5 rounded',
            style: modeConfig.badgeStyle
          }, modeConfig.label),

          // Assignment status badge (all modes when assignment exists)
          assignment && React.createElement('span', {
            className: 'text-xs px-1.5 py-0.5 rounded',
            style: getAssignmentStatusStyle(assignment.status)
          }, assignment.status),

          // Separator - Q palette iron
          React.createElement('span', {
            style: { color: 'var(--q-iron0)' }
          }, '\u00B7'),

          // Timestamp - Q palette bone0 (muted)
          React.createElement('span', {
            className: 'text-xs',
            style: { color: 'var(--q-bone0)' }
          }, formatRelativeTime(thread.updatedAt))
        )
      )
    )
  );
}

export default ThreadItem;
