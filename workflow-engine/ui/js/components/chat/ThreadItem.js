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
 * ThreadItem component - Single thread in sidebar list
 * @param {Object} props
 * @param {Object} props.thread - Thread object
 * @param {boolean} props.isSelected - Whether this thread is selected
 * @param {Function} props.onClick - Callback when thread is clicked
 */
export function ThreadItem({ thread, isSelected, onClick }) {
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
      React.createElement('div', {
        className: `flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          thread.mode === 'cook' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
        }`
      },
        React.createElement(ChatIcon)
      ),

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
          className: 'flex items-center gap-2 mt-0.5'
        },
          // Mode badge
          React.createElement('span', {
            className: `text-xs px-1.5 py-0.5 rounded ${
              thread.mode === 'cook'
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-blue-500/20 text-blue-400'
            }`
          }, thread.mode === 'cook' ? 'Cook' : 'Jam'),

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
