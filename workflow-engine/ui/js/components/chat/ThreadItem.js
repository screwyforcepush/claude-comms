// ThreadItem - Single thread preview in sidebar
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
 * Get mode configuration for styling
 */
function getModeConfig(mode) {
  switch (mode) {
    case 'cook':
      return {
        icon: ChatIcon,
        label: 'Cook',
        bgColor: 'bg-orange-500/20 text-orange-400',
        badgeColor: 'bg-orange-500/20 text-orange-400',
      };
    case 'guardian':
      return {
        icon: ShieldIcon,
        label: 'Guardian',
        bgColor: 'bg-emerald-500/20 text-emerald-400',
        badgeColor: 'bg-emerald-500/20 text-emerald-400',
      };
    case 'jam':
    default:
      return {
        icon: ChatIcon,
        label: 'Jam',
        bgColor: 'bg-blue-500/20 text-blue-400',
        badgeColor: 'bg-blue-500/20 text-blue-400',
      };
  }
}

/**
 * Get alignment status emoji
 */
function getAlignmentEmoji(status) {
  switch (status) {
    case 'aligned': return '🟢';
    case 'uncertain': return '🟠';
    case 'misaligned': return '🔴';
    default: return null;
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

  // Status dot color (Assignment status)
  let statusDotColor = null;
  if (assignment?.status) {
    switch (assignment.status) {
      case 'blocked': statusDotColor = 'bg-red-500'; break;
      case 'active': statusDotColor = 'bg-blue-500'; break;
      case 'pending': statusDotColor = 'bg-yellow-500'; break;
      case 'complete': statusDotColor = 'bg-green-500'; break;
      case 'running': statusDotColor = 'bg-purple-500'; break;
      case 'failed': statusDotColor = 'bg-red-600'; break;
      default: statusDotColor = 'bg-gray-500';
    }
  }

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    title: thread.title || 'New Chat',
    className: `relative flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
      isSelected ? 'bg-gray-800 ring-2 ring-blue-500' : 'hover:bg-gray-800'
    }`
  },
    React.createElement('div', {
      className: `w-8 h-8 rounded-lg flex items-center justify-center ${modeConfig.bgColor}`
    },
      React.createElement(Icon)
    ),
    
    // Alignment status indicator (guardian mode only) - Top Right
    alignmentEmoji && React.createElement('span', {
      className: 'absolute -top-1 -right-1 text-xs',
      title: `Alignment: ${assignment.alignmentStatus}`
    }, alignmentEmoji),

    // Assignment status dot - Bottom Right
    statusDotColor && React.createElement('span', {
      className: `absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${statusDotColor}`,
      title: `Status: ${assignment.status}`
    })
  );
}

/**
 * ThreadItem component - Single thread in sidebar list
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

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    className: `w-full text-left px-3 py-3 transition-colors ${
      isSelected
        ? 'bg-blue-500/20 border-l-2 border-blue-500'
        : 'hover:bg-gray-800 border-l-2 border-transparent'
    }`
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
        // Title
        React.createElement('div', {
          className: `text-sm font-medium truncate ${
            isSelected ? 'text-white' : 'text-gray-300'
          }`
        }, thread.title || 'New Chat'),

        // Meta info
        React.createElement('div', {
          className: 'flex items-center gap-2 mt-0.5 flex-wrap'
        },
          // Mode badge
          React.createElement('span', {
            className: `text-xs px-1.5 py-0.5 rounded ${modeConfig.badgeColor}`
          }, modeConfig.label),

          // Assignment status badge (all modes when assignment exists)
          assignment && React.createElement('span', {
            className: `text-xs px-1.5 py-0.5 rounded ${
              assignment.status === 'blocked'
                ? 'bg-red-500/20 text-red-400'
                : assignment.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
            }`
          }, assignment.status),

          // Separator
          React.createElement('span', { className: 'text-gray-600' }, '\u00B7'),

          // Timestamp
          React.createElement('span', {
            className: 'text-xs text-gray-500'
          }, formatRelativeTime(thread.updatedAt))
        )
      )
    )
  );
}

export default ThreadItem;
