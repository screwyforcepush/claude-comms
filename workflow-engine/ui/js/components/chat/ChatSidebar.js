// ChatSidebar - Thread list sidebar with new chat button
import React, { useCallback } from 'react';
import { ThreadList } from './ThreadList.js';
import { LoadingSpinner } from '../shared/LoadingSkeleton.js';

/**
 * Plus icon for new chat button
 */
function PlusIcon() {
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
      d: 'M12 4v16m8-8H4'
    })
  );
}

/**
 * Delete icon
 */
function TrashIcon() {
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
      d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    })
  );
}

/**
 * ChatSidebar component - Sidebar with thread list and new chat button
 * @param {Object} props
 * @param {Array} props.threads - Array of thread objects
 * @param {Object} props.assignments - Map of assignmentId -> assignment for guardian mode
 * @param {string} props.selectedThreadId - Currently selected thread ID
 * @param {Function} props.onSelectThread - Callback when thread is selected
 * @param {Function} props.onCreateThread - Callback to create new thread
 * @param {Function} props.onDeleteThread - Callback to delete a thread
 * @param {boolean} props.loading - Whether threads are loading
 * @param {boolean} props.creating - Whether a new thread is being created
 */
export function ChatSidebar({
  threads = [],
  assignments = {},
  selectedThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  loading = false,
  creating = false
}) {
  const handleCreateThread = useCallback(() => {
    if (!creating && onCreateThread) {
      onCreateThread();
    }
  }, [creating, onCreateThread]);

  return React.createElement('div', {
    className: 'chat-sidebar flex flex-col h-full bg-gray-900 border-r border-gray-700'
  },
    // Header with new chat button
    React.createElement('div', {
      className: 'p-3 border-b border-gray-700'
    },
      React.createElement('button', {
        type: 'button',
        onClick: handleCreateThread,
        disabled: creating,
        className: `w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors ${
          creating ? 'opacity-50 cursor-wait' : ''
        }`
      },
        creating
          ? React.createElement(LoadingSpinner, { size: 'sm' })
          : React.createElement(PlusIcon),
        React.createElement('span', { className: 'font-medium' },
          creating ? 'Creating...' : 'New Chat'
        )
      )
    ),

    // Thread list header
    React.createElement('div', {
      className: 'px-3 py-2 border-b border-gray-800'
    },
      React.createElement('div', {
        className: 'flex items-center justify-between'
      },
        React.createElement('span', {
          className: 'text-xs font-semibold text-gray-500 uppercase tracking-wide'
        }, 'Conversations'),
        threads.length > 0 && React.createElement('span', {
          className: 'text-xs text-gray-600'
        }, threads.length)
      )
    ),

    // Thread list
    React.createElement(ThreadList, {
      threads: threads,
      assignments: assignments,
      selectedThreadId: selectedThreadId,
      onSelectThread: onSelectThread,
      loading: loading
    }),

    // Delete button for selected thread (if any)
    selectedThreadId && onDeleteThread && React.createElement('div', {
      className: 'p-3 border-t border-gray-800'
    },
      React.createElement('button', {
        type: 'button',
        onClick: () => onDeleteThread(selectedThreadId),
        className: 'w-full flex items-center justify-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm'
      },
        React.createElement(TrashIcon),
        React.createElement('span', null, 'Delete Chat')
      )
    )
  );
}

export default ChatSidebar;
