// ChatView - Main chat area for selected thread
// WP-7: Added Stop/Interrupt button for active chatJob (R2), prop pass-through for U5, U6, R1
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatHeader } from './ChatHeader.js';
import { MessageList } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { AssignmentPane } from './AssignmentPane.js';
import { JobDetail } from '../job/JobDetail.js';
import { QIcon } from '../shared/index.js';

/**
 * ChatView component - Main chat area with header, messages, and input
 * @param {Object} props
 * @param {Object} props.thread - Selected thread object
 * @param {Object} props.assignment - Linked assignment (for guardian mode)
 * @param {Object} props.chainData - Chain data from getGroupChain (assignment + groups without jobs)
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
  chainData = null,
  messages = [],
  onSendMessage,
  onUpdateTitle,
  onUpdateMode,
  loadingMessages = false,
  sending = false,
  responsive,
  onToggleThreadsPane,
  paneOpen = false,
  onTogglePane,
  onClosePane,
  draftText,        // WP-6: Per-thread draft text (controlled)
  onDraftChange,    // WP-6: Draft change callback
  onMarkRead,       // WP-6: Mark thread as read callback
  onUpdateAssignmentStatus,  // WP-7 U5: Update assignment status
  onChangeFocusAssignment,   // WP-7 U6: Change focused assignment
  onKillJob,                 // WP-7 R1: Kill a running job
  onKillChatJob,             // WP-7 R2: Kill active chatJob
  activeChatJob = null       // WP-7 R2: Active chatJob for current thread
}) {
  // WP-4: State for selected job modal
  const [selectedJob, setSelectedJob] = useState(null);

  // Ref to toggle button for focus management
  const toggleButtonRef = useRef(null);

  // Reset job selection on thread change
  useEffect(() => {
    setSelectedJob(null);
  }, [thread?._id]);

  // Close pane with focus management (wraps parent callback)
  const handleClosePane = useCallback(() => {
    if (onClosePane) onClosePane();
    if (toggleButtonRef.current) {
      toggleButtonRef.current.focus();
    }
  }, [onClosePane]);

  // WP-4: Job selection callback for modal
  const handleJobSelect = useCallback((job) => {
    setSelectedJob(job);
  }, []);

  // WP-4: Close job modal callback
  const handleCloseJobModal = useCallback(() => {
    setSelectedJob(null);
  }, []);

  // WP-7 R2: Stop/interrupt chat job state
  const [stopRequested, setStopRequested] = useState(false);

  // Reset stop requested state when activeChatJob changes
  useEffect(() => {
    setStopRequested(false);
  }, [activeChatJob?._id]);

  // WP-7 R2: Handle stop button click
  const handleStopChatJob = useCallback(() => {
    if (!activeChatJob?._id || !onKillChatJob) return;
    setStopRequested(true);
    onKillChatJob(activeChatJob._id);
  }, [activeChatJob?._id, onKillChatJob]);

  // No thread selected state
  // WP-8: Transformed to Q palette styling
  if (!thread) {
    // Mode badge styles using Q palette (matches ModeToggle.js pattern)
    const modeBadgeStyles = {
      jam: {
        backgroundColor: 'rgba(92, 60, 124, 0.2)',
        color: 'var(--q-teleport)',
        fontFamily: 'var(--font-display)',
        padding: '4px 8px',
        borderRadius: 0,
        fontSize: '12px'
      },
      cook: {
        backgroundColor: 'rgba(212, 160, 48, 0.2)',
        color: 'var(--q-torch)',
        fontFamily: 'var(--font-display)',
        padding: '4px 8px',
        borderRadius: 0,
        fontSize: '12px'
      },
      guardian: {
        backgroundColor: 'rgba(60, 116, 32, 0.2)',
        color: 'var(--q-slime1)',
        fontFamily: 'var(--font-display)',
        padding: '4px 8px',
        borderRadius: 0,
        fontSize: '12px'
      }
    };

    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center',
      style: { backgroundColor: 'var(--q-void1)' }
    },
      React.createElement('div', { className: 'text-center max-w-md p-8' },
        React.createElement('svg', {
          className: 'w-20 h-20 mx-auto mb-4',
          style: { color: 'var(--q-iron1)' },
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
          className: 'text-xl font-semibold mb-2',
          style: { color: 'var(--q-bone2)' }
        }, 'Quartermaster'),
        React.createElement('p', {
          className: 'mb-6',
          style: { color: 'var(--q-bone0)' }
        }, 'Select a conversation from the sidebar or create a new one to start chatting with the Quartermaster.'),
        React.createElement('div', {
          className: 'flex flex-col gap-3 text-sm',
          style: { color: 'var(--q-bone0)' }
        },
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              style: modeBadgeStyles.jam
            }, 'Jam'),
            React.createElement('span', null, 'Read-only ideation mode')
          ),
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              style: modeBadgeStyles.cook
            }, 'Cook'),
            React.createElement('span', null, 'Full autonomy to create assignments')
          ),
          React.createElement('div', { className: 'flex items-center gap-2 justify-center' },
            React.createElement('span', {
              style: modeBadgeStyles.guardian
            }, 'Guardian'),
            React.createElement('span', null, 'QM monitors assignment alignment')
          )
        )
      )
    );
  }

  return React.createElement('div', {
    className: 'flex-1 flex min-h-0 min-w-0'
  },
    // Main chat column (header + messages + input)
    // WP-8: Q palette background
    React.createElement('div', {
      className: 'flex-1 flex flex-col min-h-0 min-w-0',
      style: { backgroundColor: 'var(--q-void1)' }
    },
      // Header with title, mode toggle, and pane toggle
      React.createElement(ChatHeader, {
        thread: thread,
        assignment: assignment,
        onUpdateTitle: onUpdateTitle,
        onUpdateMode: onUpdateMode,
        onTogglePane: onTogglePane,
        paneOpen: paneOpen,
        toggleButtonRef: toggleButtonRef,
        disabled: sending
      }),

      // Message list (scrollable)
      // WP-6: Added onMarkRead prop for unread tracking
      React.createElement(MessageList, {
        messages: messages,
        loading: loadingMessages,
        sending: sending,
        onMarkRead: onMarkRead
      }),

      // WP-7 R2: Stop button for active chatJob
      activeChatJob && React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 16px 0',
        }
      },
        React.createElement('button', {
          type: 'button',
          onClick: handleStopChatJob,
          disabled: stopRequested || activeChatJob.killRequested,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 16px',
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: (stopRequested || activeChatJob.killRequested) ? 'var(--q-bone3)' : 'var(--q-lava1)',
            backgroundColor: (stopRequested || activeChatJob.killRequested) ? 'var(--q-lava0)' : 'rgba(140, 40, 20, 0.2)',
            border: '1px solid var(--q-lava0)',
            borderRadius: 0,
            cursor: (stopRequested || activeChatJob.killRequested) ? 'default' : 'pointer',
            opacity: (stopRequested || activeChatJob.killRequested) ? 0.7 : 1,
            transition: 'all var(--t-anim-transition-fast)',
          }
        },
          React.createElement(QIcon, { name: 'skull', size: 14, color: 'currentColor' }),
          (stopRequested || activeChatJob.killRequested) ? 'Stopping...' : 'Stop'
        )
      ),

      // Input area
      // WP-6: Added draftText/onDraftChange props for per-thread draft persistence
      React.createElement(ChatInput, {
        onSend: onSendMessage,
        disabled: sending,
        placeholder: thread.mode === 'guardian'
          ? 'Discuss alignment with the Quartermaster...'
          : thread.mode === 'cook'
            ? 'Tell the Quartermaster what to build...'
            : 'Discuss ideas with the Quartermaster...',
        draftText: draftText,
        onDraftChange: onDraftChange
      })
    ),

    // WP-5: Assignment pane overlay for mobile
    responsive?.isMobile && paneOpen && React.createElement('div', {
      className: 'assignment-overlay visible',
      onClick: handleClosePane,
      'aria-hidden': 'true'
    }),

    // WP-3: Assignment pane (collapsible right sidebar, drawer on mobile)
    // WP-7: Added status editing (U5), multi-assignment nav (U6), kill job (R1) props
    assignment && React.createElement(AssignmentPane, {
      assignment: assignment,
      chainGroups: chainData?.groups || [],
      isOpen: paneOpen,
      onClose: handleClosePane,
      onJobSelect: handleJobSelect,
      responsive: responsive,
      onUpdateStatus: onUpdateAssignmentStatus,
      onChangeFocusAssignment: onChangeFocusAssignment,
      thread: thread,
      onKillJob: onKillJob
    }),

    // WP-4: Job detail modal
    // WP-7 R1: Pass onKillJob so Kill button works in modal view
    selectedJob && React.createElement(JobDetail, {
      job: selectedJob,
      onClose: handleCloseJobModal,
      isModal: true,
      onKillJob: onKillJob
    })
  );
}

export default ChatView;
