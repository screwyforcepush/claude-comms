// ThreadItem - Single thread preview in sidebar
// WP-6: Transformed to Q palette brandkit styling
import React from 'react';

/**
 * Chat bubble icon
 */
function ChatIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
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
 * Shield icon for guardian mode
 */
function ShieldIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    })
  );
}

/**
 * Get Q palette status color for status dot
 * Maps status to Q palette CSS variables
 */
function getQPaletteStatusColor(status) {
  switch (status) {
    case 'blocked':
    case 'failed':
      return 'var(--q-lava1)';
    case 'active':
    case 'running':
      return 'var(--q-slime1)';
    case 'pending':
      return 'var(--q-torch)';
    case 'complete':
      return 'var(--q-slime1)';
    default:
      return 'var(--q-iron1)';
  }
}

/**
 * Get mode configuration for styling with Q palette
 * Jam: teleport palette
 * Cook: torch palette
 * Guardian: slime palette
 */
function getModeConfig(mode) {
  switch (mode) {
    case 'cook':
      return {
        icon: ChatIcon,
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
        icon: ShieldIcon,
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
        icon: ChatIcon,
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

/**
 * Get alignment status emoji
 */
function getAlignmentEmoji(status) {
  switch (status) {
    case 'aligned': return '\uD83D\uDFE2';
    case 'uncertain': return '\uD83D\uDFE0';
    case 'misaligned': return '\uD83D\uDD34';
    default: return null;
  }
}

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
        backgroundColor: 'rgba(60, 116, 32, 0.2)',
        color: 'var(--q-slime1)',
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
 * @param {Object} props
 * @param {Object} props.thread - Thread object
 * @param {Object} props.assignment - Linked assignment
 * @param {boolean} props.isSelected - Whether selected
 * @param {Function} props.onClick - Click handler
 */
export function ThreadIcon({ thread, assignment, isSelected, onClick }) {
  const modeConfig = getModeConfig(thread.mode);
  const Icon = modeConfig.icon;

  // Alignment emoji (Guardian mode)
  const alignmentEmoji = thread.mode === 'guardian' && assignment
    ? getAlignmentEmoji(assignment.alignmentStatus)
    : null;

  // Status dot color using Q palette
  let statusDotStyle = null;
  if (assignment?.status) {
    statusDotStyle = {
      backgroundColor: getQPaletteStatusColor(assignment.status),
      borderColor: 'var(--q-void0)'
    };
  }

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
      React.createElement(Icon)
    ),

    // Alignment status indicator (guardian mode only) - Top Right
    alignmentEmoji && React.createElement('span', {
      className: 'absolute -top-1 -right-1 text-xs',
      title: `Alignment: ${assignment.alignmentStatus}`
    }, alignmentEmoji),

    // Assignment status dot - Bottom Right with Q palette color
    statusDotStyle && React.createElement('span', {
      className: 'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2',
      style: statusDotStyle,
      title: `Status: ${assignment.status}`
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
  const alignmentEmoji = thread.mode === 'guardian' && assignment
    ? getAlignmentEmoji(assignment.alignmentStatus)
    : null;

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
