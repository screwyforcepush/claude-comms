// ChatSidebar - Thread list sidebar with new chat button
import React, { useCallback, useState } from 'react';
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
 * New Chat button with copper gradient styling per QButton pattern
 * Uses Q palette: copper gradient background, void0 text, copper2 border
 */
function NewChatButton({ onClick, creating }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    disabled: creating,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => { setIsHovered(false); setIsPressed(false); },
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
    className: 'w-full flex items-center justify-center gap-2',
    style: {
      padding: '10px 16px',
      background: creating
        ? 'var(--q-stone2)'
        : isHovered
          ? 'linear-gradient(180deg, var(--q-copper2) 0%, var(--q-copper0) 100%)'
          : 'linear-gradient(180deg, var(--q-copper1) 0%, var(--q-copper0) 100%)',
      border: '1px solid var(--q-copper2)',
      borderTop: '1px solid rgba(148, 98, 50, 0.53)',  // copper2 with alpha
      borderBottom: '2px solid var(--q-void0)',
      borderRadius: 'var(--t-border-radius)',
      color: creating ? 'var(--q-bone0)' : 'var(--q-void0)',
      cursor: creating ? 'not-allowed' : 'pointer',
      boxShadow: isHovered && !creating ? '0 0 12px rgba(212, 160, 48, 0.2)' : 'none',  // torch glow
      textShadow: creating ? 'none' : '0 1px 0 rgba(176, 120, 64, 0.27)',  // copper3 with alpha
      transform: isPressed ? 'translateY(1px)' : 'none',
      transition: 'all 0.1s',
      opacity: creating ? 0.5 : 1,
      fontFamily: 'var(--font-display)',
      fontSize: '12px',
      letterSpacing: '2px',
      textTransform: 'uppercase'
    }
  },
    creating
      ? React.createElement(LoadingSpinner, { size: 'sm' })
      : React.createElement(PlusIcon),
    React.createElement('span', null,
      creating ? 'Creating...' : 'New Chat'
    )
  );
}

/**
 * Delete button with lava styling for danger action
 * Uses Q palette: lava colors with hover states
 */
function DeleteChatButton({ onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: 'w-full flex items-center justify-center gap-2 text-sm',
    style: {
      padding: '8px 12px',
      backgroundColor: isHovered ? 'rgba(140, 40, 20, 0.1)' : 'transparent',  // lava0 with alpha
      border: 'none',
      borderRadius: 'var(--t-border-radius)',
      color: isHovered ? 'var(--q-lava1)' : 'var(--q-lava0)',
      cursor: 'pointer',
      transition: 'all 0.15s'
    }
  },
    React.createElement(TrashIcon),
    React.createElement('span', null, 'Delete Chat')
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
    className: 'chat-sidebar flex flex-col flex-1 min-h-0',
    style: {
      backgroundColor: 'var(--q-stone0)'
    }
  },
    // Header with new chat button - Q palette: stone3 border
    React.createElement('div', {
      className: 'p-3',
      style: {
        borderBottom: '1px solid var(--q-stone3)'
      }
    },
      React.createElement(NewChatButton, {
        onClick: handleCreateThread,
        creating: creating
      })
    ),

    // Thread list header - Q palette: stone3 border, bone0 muted text
    React.createElement('div', {
      className: 'px-3 py-2',
      style: {
        borderBottom: '1px solid var(--q-stone3)'
      }
    },
      React.createElement('div', {
        className: 'flex items-center justify-between'
      },
        React.createElement('span', {
          className: 'text-xs font-semibold uppercase tracking-wide',
          style: {
            color: 'var(--q-bone0)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '2px'
          }
        }, 'Conversations'),
        threads.length > 0 && React.createElement('span', {
          className: 'text-xs',
          style: {
            color: 'var(--q-bone0)'
          }
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

    // Delete button for selected thread (if any) - Q palette: stone3 border, lava colors
    selectedThreadId && onDeleteThread && React.createElement('div', {
      className: 'p-3',
      style: {
        borderTop: '1px solid var(--q-stone3)'
      }
    },
      React.createElement(DeleteChatButton, {
        onClick: () => onDeleteThread(selectedThreadId)
      })
    )
  );
}

export default ChatSidebar;
