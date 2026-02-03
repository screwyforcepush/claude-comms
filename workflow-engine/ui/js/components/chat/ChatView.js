// ChatView - Main chat area for selected thread
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatHeader } from './ChatHeader.js';
import { MessageList } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { AssignmentPane } from './AssignmentPane.js';
import { JobDetail } from '../job/JobDetail.js';

// localStorage key for assignment pane collapse state (D8: namespaced key)
const ASSIGNMENT_PANE_COLLAPSED_KEY = 'workflow-engine:assignment-pane-collapsed';

/**
 * Get initial collapsed state from localStorage
 * Note: We store "collapsed" state, but the component uses "open" state (inverted)
 */
function getInitialPaneOpen() {
  try {
    const stored = localStorage.getItem(ASSIGNMENT_PANE_COLLAPSED_KEY);
    // If stored as 'true' (collapsed), paneOpen should be false
    return stored !== 'true';
  } catch {
    return false; // Default to closed (collapsed = true)
  }
}

/**
 * ChatView component - Main chat area with header, messages, and input
 * @param {Object} props
 * @param {Object} props.thread - Selected thread object
 * @param {Object} props.assignment - Linked assignment (for guardian mode)
 * @param {Array} props.groups - Job groups for this assignment (each group contains jobs array)
 * @param {Array} props.messages - Array of message objects
 * @param {Function} props.onSendMessage - Callback when message is sent
 * @param {Function} props.onUpdateTitle - Callback to update thread title
 * @param {Function} props.onUpdateMode - Callback to update thread mode
 * @param {boolean} props.loadingMessages - Whether messages are loading
 * @param {boolean} props.sending - Whether a message is being sent
 * @param {Object} props.responsive - Responsive mode info (WP-5)
 * @param {Function} props.onToggleThreadsPane - Callback to toggle threads pane on mobile (WP-5)
 */
export function ChatView({
  thread,
  assignment = null,
  groups = [],
  messages = [],
  onSendMessage,
  onUpdateTitle,
  onUpdateMode,
  loadingMessages = false,
  sending = false,
  responsive,
  onToggleThreadsPane
}) {
  // WP-3: State for assignment pane visibility with localStorage persistence
  const [paneOpen, setPaneOpen] = useState(getInitialPaneOpen);

  // WP-4: State for selected job modal
  const [selectedJob, setSelectedJob] = useState(null);

  // Ref to toggle button for focus management
  const toggleButtonRef = useRef(null);

  // D2: Close pane when switching threads (fresh context)
  // Note: We still reset on thread change but don't persist this reset
  useEffect(() => {
    setPaneOpen(false);
    setSelectedJob(null);
  }, [thread?._id]);

  // Toggle pane callback for header - with localStorage persistence
  const handleTogglePane = useCallback(() => {
    setPaneOpen(prev => {
      const newValue = !prev;
      try {
        // Store collapsed state (inverted from open state)
        localStorage.setItem(ASSIGNMENT_PANE_COLLAPSED_KEY, String(!newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  // Close pane callback - with focus management and localStorage persistence
  const handleClosePane = useCallback(() => {
    setPaneOpen(false);
    try {
      localStorage.setItem(ASSIGNMENT_PANE_COLLAPSED_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
    // Return focus to toggle button when pane closes
    if (toggleButtonRef.current) {
      toggleButtonRef.current.focus();
    }
  }, []);

  // WP-4: Job selection callback for modal
  const handleJobSelect = useCallback((job) => {
    setSelectedJob(job);
  }, []);

  // WP-4: Close job modal callback
  const handleCloseJobModal = useCallback(() => {
    setSelectedJob(null);
  }, []);
  // No thread selected state
  if (!thread) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center bg-gray-900'
    },
      React.createElement('div', { className: 'text-center max-w-md p-8' },
        React.createElement('svg', {
          className: 'w-20 h-20 text-gray-700 mx-auto mb-4',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '1'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
          })
        ),
        React.createElement('h2', {
          className: 'text-xl font-semibold text-gray-400 mb-2'
        }, 'Product Owner Chat'),
        React.createElement('p', {
          className: 'text-gray-600 mb-6'
        }, 'Select a conversation from the sidebar or create a new one to start chatting with the Product Owner.'),
        React.createElement('div', {
          className: 'flex flex-col gap-3 text-sm text-gray-500'
        },
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              className: 'px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium'
            }, 'Jam'),
            React.createElement('span', null, 'Read-only ideation mode')
          ),
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              className: 'px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium'
            }, 'Cook'),
            React.createElement('span', null, 'Full autonomy to create assignments')
          ),
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              className: 'px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium'
            }, 'Guardian'),
            React.createElement('span', null, 'PO monitors assignment alignment')
          )
        )
      )
    );
  }

  return React.createElement('div', {
    className: 'flex-1 flex min-h-0'
  },
    // Main chat column (header + messages + input)
    React.createElement('div', {
      className: 'flex-1 flex flex-col bg-gray-900 min-h-0 min-w-0'
    },
      // Header with title, mode toggle, and pane toggle
      React.createElement(ChatHeader, {
        thread: thread,
        assignment: assignment,
        onUpdateTitle: onUpdateTitle,
        onUpdateMode: onUpdateMode,
        onTogglePane: handleTogglePane,
        paneOpen: paneOpen,
        toggleButtonRef: toggleButtonRef,
        disabled: sending
      }),

      // Message list (scrollable)
      React.createElement(MessageList, {
        messages: messages,
        loading: loadingMessages,
        sending: sending
      }),

      // Input area
      React.createElement(ChatInput, {
        onSend: onSendMessage,
        disabled: sending,
        placeholder: thread.mode === 'guardian'
          ? 'Discuss alignment with the Product Owner...'
          : thread.mode === 'cook'
            ? 'Tell the Product Owner what to build...'
            : 'Discuss ideas with the Product Owner...'
      })
    ),

    // WP-5: Assignment pane overlay for mobile
    responsive?.isMobile && paneOpen && React.createElement('div', {
      className: 'assignment-overlay visible',
      onClick: handleClosePane,
      'aria-hidden': 'true'
    }),

    // WP-3: Assignment pane (collapsible right sidebar, drawer on mobile)
    assignment && React.createElement(AssignmentPane, {
      assignment: assignment,
      groups: groups,
      isOpen: paneOpen,
      onClose: handleClosePane,
      onJobSelect: handleJobSelect,
      responsive: responsive
    }),

    // WP-4: Job detail modal
    selectedJob && React.createElement(JobDetail, {
      job: selectedJob,
      onClose: handleCloseJobModal,
      isModal: true
    })
  );
}

export default ChatView;
