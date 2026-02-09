// ThreadList - Scrollable list of chat threads
import React from 'react';
import { useQuery } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { ThreadItem } from './ThreadItem.js';
import { LoadingSkeleton } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';

/**
 * Wrapper that subscribes to a single assignment for a thread
 * Each thread with an assignmentId gets its own lightweight subscription
 */
function ThreadItemWithAssignment({ thread, isSelected, onClick }) {
  const { data: assignment } = useQuery(
    thread.assignmentId ? api.assignments.get : null,
    thread.assignmentId ? { id: thread.assignmentId } : {}
  );
  return React.createElement(ThreadItem, {
    thread,
    assignment: assignment || null,
    isSelected,
    onClick
  });
}

/**
 * ThreadList component - List of chat threads
 * @param {Object} props
 * @param {Array} props.threads - Array of thread objects
 * @param {string} props.selectedThreadId - Currently selected thread ID
 * @param {Function} props.onSelectThread - Callback when thread is selected
 * @param {boolean} props.loading - Whether threads are loading
 */
export function ThreadList({ threads = [], selectedThreadId, onSelectThread, loading = false }) {
  // Loading state
  if (loading && threads.length === 0) {
    return React.createElement('div', {
      className: 'p-3',
      style: { backgroundColor: 'var(--q-void1)' }
    },
      React.createElement('div', { className: 'space-y-2' },
        Array.from({ length: 5 }).map((_, i) =>
          React.createElement('div', {
            key: i,
            className: 'flex items-start gap-3 px-3 py-3'
          },
            React.createElement('div', { className: 'skeleton-q w-8 h-8' }),
            React.createElement('div', { className: 'flex-1' },
              React.createElement('div', { className: 'skeleton-q h-4 w-3/4 mb-2' }),
              React.createElement('div', { className: 'skeleton-q h-3 w-1/2' })
            )
          )
        )
      )
    );
  }

  // Empty state
  if (threads.length === 0) {
    return React.createElement('div', { className: 'p-6' },
      React.createElement(EmptyState, {
        icon: 'chat',
        title: 'No conversations',
        description: 'Start a new chat to begin'
      })
    );
  }

  return React.createElement('div', {
    className: 'flex-1 overflow-y-auto',
    style: { backgroundColor: 'var(--q-void1)' }
  },
    threads.map((thread, index) =>
      React.createElement(React.Fragment, { key: thread._id },
        index > 0 && React.createElement('div', {
          style: { height: '1px', backgroundColor: 'var(--q-stone2)' }
        }),
        React.createElement(ThreadItemWithAssignment, {
          thread: thread,
          isSelected: selectedThreadId === thread._id,
          onClick: () => onSelectThread && onSelectThread(thread)
        })
      )
    )
  );
}

export default ThreadList;
