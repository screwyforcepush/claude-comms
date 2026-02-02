// ChatView - Main chat area for selected thread
import React, { useState, useEffect, useCallback } from 'react';
import { ChatHeader } from './ChatHeader.js';
import { MessageList } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { AssignmentPane } from './AssignmentPane.js';
import { JobDetail } from '../job/JobDetail.js';

/**
 * ChatView component - Main chat area with header, messages, and input
 * @param {Object} props
 * @param {Object} props.thread - Selected thread object
 * @param {Object} props.assignment - Linked assignment (for guardian mode)
 * @param {Array} props.jobs - Jobs for this assignment (WP-3: integration)
 * @param {Array} props.messages - Array of message objects
 * @param {Function} props.onSendMessage - Callback when message is sent
 * @param {Function} props.onUpdateTitle - Callback to update thread title
 * @param {Function} props.onUpdateMode - Callback to update thread mode
 * @param {boolean} props.loadingMessages - Whether messages are loading
 * @param {boolean} props.sending - Whether a message is being sent
 */
export function ChatView({
  thread,
  assignment = null,
  jobs = [],
  messages = [],
  onSendMessage,
  onUpdateTitle,
  onUpdateMode,
  loadingMessages = false,
  sending = false
}) {
  // WP-3: State for assignment pane visibility (D1: default closed)
  const [paneOpen, setPaneOpen] = useState(false);

  // WP-4: State for selected job modal
  const [selectedJob, setSelectedJob] = useState(null);

  // D2: Close pane when switching threads (fresh context)
  useEffect(() => {
    setPaneOpen(false);
    setSelectedJob(null);
  }, [thread?._id]);

  // Toggle pane callback for header
  const handleTogglePane = useCallback(() => {
    setPaneOpen(prev => !prev);
  }, []);

  // Close pane callback
  const handleClosePane = useCallback(() => {
    setPaneOpen(false);
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

    // WP-3: Assignment pane (collapsible right sidebar)
    assignment && React.createElement(AssignmentPane, {
      assignment: assignment,
      jobs: jobs,
      isOpen: paneOpen,
      onClose: handleClosePane,
      onJobSelect: handleJobSelect
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
