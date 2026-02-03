// ChatPanel - Main container for chat feature
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { ChatSidebar } from './ChatSidebar.js';
import { ChatView } from './ChatView.js';

// localStorage key for threads pane collapse state
const THREADS_PANE_COLLAPSED_KEY = 'workflow-engine:threads-pane-collapsed';

/**
 * Get initial collapsed state from localStorage
 */
function getInitialCollapsedState() {
  try {
    const stored = localStorage.getItem(THREADS_PANE_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Chevron icon for collapse toggle
 */
function CollapseChevron({ collapsed }) {
  return React.createElement('svg', {
    className: `w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M15 19l-7-7 7-7'
    })
  );
}

/**
 * Chat icon for collapsed state
 */
function ChatIcon() {
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
      d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
    })
  );
}

/**
 * ChatPanel component - Main container managing chat state
 * @param {Object} props
 * @param {string} props.namespaceId - Current namespace ID for thread scoping
 * @param {string} props.namespaceName - Current namespace name (for display)
 * @param {Object} props.responsive - Responsive mode info (optional, for WP-5)
 */
export function ChatPanel({ namespaceId, namespaceName, responsive }) {
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // WP-3: Threads pane collapse state with localStorage persistence
  const [threadsPaneCollapsed, setThreadsPaneCollapsed] = useState(getInitialCollapsedState);

  // WP-5: Mobile drawer state for threads pane
  const [threadsMobileOpen, setThreadsMobileOpen] = useState(false);

  // Fetch threads for this namespace
  const { data: threads, loading: loadingThreads } = useQuery(
    api.chatThreads.list,
    { namespaceId }
  );

  // Fetch assignments with jobs for assignment visibility (WP-5: unified data flow)
  const { data: allAssignmentsData } = useQuery(
    api.scheduler.getAllAssignments,
    { namespaceId }
  );

  // Get selected thread object (must be defined before useMemos that reference it)
  const selectedThread = threads?.find(t => t._id === selectedThreadId) || null;

  // Build assignments map for quick lookup (assignment data only)
  const assignments = React.useMemo(() => {
    if (!allAssignmentsData) return {};
    return allAssignmentsData.reduce((acc, item) => {
      acc[item.assignment._id] = item.assignment;
      return acc;
    }, {});
  }, [allAssignmentsData]);

  // Get assignment + jobs for selected thread (WP-5: data flow for job chain)
  const selectedAssignmentWithJobs = React.useMemo(() => {
    if (!selectedThread?.assignmentId || !allAssignmentsData) return null;
    return allAssignmentsData.find(item => item.assignment._id === selectedThread.assignmentId);
  }, [selectedThread?.assignmentId, allAssignmentsData]);

  // Fetch messages for selected thread
  const { data: messages, loading: loadingMessages } = useQuery(
    selectedThreadId ? api.chatMessages.list : null,
    selectedThreadId ? { threadId: selectedThreadId } : {}
  );

  // Query for active chatJob to show typing indicator
  const { data: activeChatJob } = useQuery(
    selectedThreadId ? api.chatJobs.getActiveForThread : null,
    selectedThreadId ? { threadId: selectedThreadId } : {}
  );

  // Show typing indicator when there's an active job (pending or running)
  const isProcessing = !!activeChatJob;

  // Mutations
  const createThread = useMutation(api.chatThreads.create);
  const addMessage = useMutation(api.chatMessages.add);
  const updateMode = useMutation(api.chatThreads.updateMode);
  const updateTitle = useMutation(api.chatThreads.updateTitle);
  const removeThread = useMutation(api.chatThreads.remove);
  const triggerChatJob = useMutation(api.chatJobs.trigger);

  // Reset selection when namespace changes
  useEffect(() => {
    setSelectedThreadId(null);
  }, [namespaceId]);

  // Auto-select first thread if none selected and threads exist
  useEffect(() => {
    if (!selectedThreadId && threads?.length > 0 && !loadingThreads) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThreadId, loadingThreads]);

  // Handle creating a new thread
  const handleCreateThread = useCallback(async () => {
    if (creating || !namespaceId) return;

    setCreating(true);
    try {
      const newThreadId = await createThread({ namespaceId });
      setSelectedThreadId(newThreadId);
    } catch (err) {
      console.error('Failed to create thread:', err);
    } finally {
      setCreating(false);
    }
  }, [creating, namespaceId, createThread]);

  // Handle selecting a thread
  const handleSelectThread = useCallback((thread) => {
    setSelectedThreadId(thread._id);
  }, []);

  // Handle deleting a thread
  const handleDeleteThread = useCallback(async (threadId) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await removeThread({ id: threadId });
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }, [removeThread, selectedThreadId]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (content) => {
    if (!selectedThreadId || sending) return;

    setSending(true);
    try {
      // 1. Add user message immediately for instant feedback
      await addMessage({
        threadId: selectedThreadId,
        role: 'user',
        content: content
      });

      // 2. Trigger chat job - runner picks it up and executes Claude
      //    Response is saved to chatMessages by the runner
      //    UI updates via Convex real-time subscription
      await triggerChatJob({
        threadId: selectedThreadId
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [selectedThreadId, sending, addMessage, triggerChatJob]);

  // Handle updating thread title
  const handleUpdateTitle = useCallback(async (title) => {
    if (!selectedThreadId) return;

    try {
      await updateTitle({ id: selectedThreadId, title });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }, [selectedThreadId, updateTitle]);

  // Handle updating thread mode
  const handleUpdateMode = useCallback(async (mode) => {
    if (!selectedThreadId) return;

    try {
      await updateMode({ id: selectedThreadId, mode });
    } catch (err) {
      console.error('Failed to update mode:', err);
    }
  }, [selectedThreadId, updateMode]);

  // WP-3: Handle toggling threads pane collapse
  const handleToggleThreadsPane = useCallback(() => {
    // WP-5: On mobile, toggle drawer instead of collapse
    if (responsive?.isMobile) {
      setThreadsMobileOpen(prev => !prev);
      return;
    }
    setThreadsPaneCollapsed(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(THREADS_PANE_COLLAPSED_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, [responsive?.isMobile]);

  // WP-5: Close mobile threads drawer
  const handleCloseThreadsMobile = useCallback(() => {
    setThreadsMobileOpen(false);
  }, []);

  // No namespace selected
  if (!namespaceId) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center bg-gray-900'
    },
      React.createElement('div', { className: 'text-center p-8' },
        React.createElement('svg', {
          className: 'w-16 h-16 text-gray-600 mx-auto mb-4',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '1.5'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
          })
        ),
        React.createElement('h2', {
          className: 'text-xl font-semibold text-gray-300 mb-2'
        }, 'Select a Namespace'),
        React.createElement('p', {
          className: 'text-gray-500'
        }, 'Choose a namespace from the sidebar to access chat.')
      )
    );
  }

  // WP-5: Build threads pane classes based on responsive mode
  const threadsPaneClasses = [
    'threads-pane',
    'flex-shrink-0',
    'border-r',
    'border-gray-700',
    'bg-gray-900',
    'overflow-hidden',
    'transition-all',
    'duration-300',
    'ease-in-out',
    threadsPaneCollapsed ? 'threads-pane-collapsed' : 'threads-pane-expanded',
    responsive?.isMobile && threadsMobileOpen ? 'threads-mobile-open' : ''
  ].filter(Boolean).join(' ');

  return React.createElement('div', {
    className: 'chat-panel flex flex-1 min-h-0'
  },
    // WP-5: Mobile threads overlay
    responsive?.isMobile && React.createElement('div', {
      className: `threads-overlay ${threadsMobileOpen ? 'visible' : ''}`,
      onClick: handleCloseThreadsMobile,
      'aria-hidden': 'true'
    }),

    // WP-3: Collapsible thread sidebar container
    React.createElement('div', {
      className: threadsPaneClasses,
      'aria-hidden': responsive?.isMobile && !threadsMobileOpen
    },
      // Collapsed state: icon-only strip with expand button
      threadsPaneCollapsed && React.createElement('div', {
        className: 'threads-pane-collapsed-content h-full flex flex-col items-center py-3 gap-3'
      },
        // Expand button - uses threads-toggle class to survive CSS visibility rules
        React.createElement('button', {
          type: 'button',
          onClick: handleToggleThreadsPane,
          className: 'threads-toggle p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors',
          title: 'Expand conversations',
          'aria-label': 'Expand conversations'
        },
          React.createElement(CollapseChevron, { collapsed: true })
        ),
        // Chat icon indicator
        React.createElement('div', {
          className: 'p-2 text-gray-500'
        },
          React.createElement(ChatIcon)
        ),
        // Thread count badge
        threads && threads.length > 0 && React.createElement('div', {
          className: 'text-xs text-gray-500 font-medium'
        }, threads.length)
      ),

      // Expanded state: full sidebar
      !threadsPaneCollapsed && React.createElement('div', {
        className: 'threads-pane-expanded-content h-full flex flex-col'
      },
        // Collapse button in header area
        React.createElement('div', {
          className: 'flex items-center justify-between px-3 py-2 border-b border-gray-700'
        },
          React.createElement('span', {
            className: 'text-xs font-semibold text-gray-500 uppercase tracking-wide'
          }, 'Threads'),
          React.createElement('button', {
            type: 'button',
            onClick: handleToggleThreadsPane,
            className: 'p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors',
            title: 'Collapse conversations'
          },
            React.createElement(CollapseChevron, { collapsed: false })
          )
        ),
        // ChatSidebar content (without its own header)
        React.createElement(ChatSidebar, {
          threads: threads || [],
          assignments: assignments,
          selectedThreadId: selectedThreadId,
          onSelectThread: handleSelectThread,
          onCreateThread: handleCreateThread,
          onDeleteThread: handleDeleteThread,
          loading: loadingThreads,
          creating: creating
        })
      )
    ),

    // Main chat view (WP-5: pass groups data for assignment pane + responsive mode)
    React.createElement(ChatView, {
      thread: selectedThread,
      assignment: selectedAssignmentWithJobs?.assignment || null,
      groups: selectedAssignmentWithJobs?.groups || [],
      messages: messages || [],
      onSendMessage: handleSendMessage,
      onUpdateTitle: handleUpdateTitle,
      onUpdateMode: handleUpdateMode,
      loadingMessages: loadingMessages,
      sending: sending || isProcessing,
      responsive: responsive,
      onToggleThreadsPane: handleToggleThreadsPane
    })
  );
}

export default ChatPanel;
