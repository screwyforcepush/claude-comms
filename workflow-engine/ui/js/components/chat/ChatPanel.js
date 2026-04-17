// ChatPanel - Main container for chat feature
// WP-8: Transformed to Q palette brandkit styling
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useConvex, useQuery, useMutation } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { ChatSidebar } from './ChatSidebar.js';
import { ChatView } from './ChatView.js';
import { ThreadIconWithAssignment } from './ThreadItem.js';
import { ModeToggle } from './ModeToggle.js';
import { QIcon } from '../shared/index.js';
import { NamespaceSettings } from '../namespace/index.js';

// localStorage keys for collapse states
const THREADS_PANE_COLLAPSED_KEY = 'workflow-engine:threads-pane-collapsed';
const ASSIGNMENT_PANE_COLLAPSED_KEY = 'workflow-engine:assignment-pane-collapsed';

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
 * Get initial assignment pane open state from localStorage
 */
function getInitialPaneOpen() {
  try {
    const stored = localStorage.getItem(ASSIGNMENT_PANE_COLLAPSED_KEY);
    return stored !== 'true';
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
 * Get status color from assignment status string
 */
function getStatusColor(status) {
  switch (status) {
    case 'active': return 'var(--q-teleport-bright)';
    case 'complete': return 'var(--q-slime1)';
    case 'completed': return 'var(--q-slime1)';
    case 'blocked': return 'var(--q-lava1)';
    case 'failed': return 'var(--q-lava1)';
    case 'pending': return 'var(--q-copper1)';
    default: return 'var(--q-iron1)';
  }
}

/**
 * Get alignment color from alignment status string
 */
function getAlignmentColor(alignmentStatus) {
  switch (alignmentStatus) {
    case 'aligned': return 'var(--q-slime1)';
    case 'misaligned': return 'var(--q-lava1)';
    case 'uncertain': return 'var(--q-torch)';
    default: return 'var(--q-slime1)';
  }
}

/**
 * CC3 Branding header — replaces the old aside sidebar header
 * Shows CC3 logo, title, connection status dot, and collapse chevron
 */
function CC3BrandingHeader({ onToggleCollapse }) {
  const { connected, connecting, error } = useConvex();

  // Connection status dot color
  const statusColor = error ? 'var(--q-lava1)' : connecting ? 'var(--q-torch)' : connected ? 'var(--q-slime1)' : 'var(--q-iron1)';
  const statusPulse = connected && !error && !connecting;

  return React.createElement('div', {
    className: 'flex items-center justify-between px-3 py-2',
    style: { borderBottom: '1px solid var(--q-stone3)' }
  },
    React.createElement('div', { className: 'flex items-center gap-2', style: { minWidth: 0 } },
      React.createElement('img', {
        src: 'public/cc3icon.png',
        alt: 'CC3',
        style: { width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0 }
      }),
      React.createElement('h1', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          color: 'var(--q-torch)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          textShadow: '0 0 30px rgba(212, 160, 48, 0.22), 0 2px 4px var(--q-void0)',
          margin: 0,
          animation: 'torchFlicker 6s infinite',
          whiteSpace: 'nowrap'
        }
      }, 'CLAUDE COMMS III')
    ),
    React.createElement('div', { className: 'flex items-center gap-2' },
      // Connection status fullbright dot
      React.createElement('span', {
        className: `fullbright-dot fullbright-dot--sm ${statusPulse ? 'fullbright-dot--pulse' : ''}`,
        style: {
          background: `radial-gradient(circle, ${statusColor}, ${statusColor}88)`,
          boxShadow: `0 0 5px ${statusColor}88, 0 0 10px ${statusColor}44`
        },
        title: error ? 'Disconnected' : connecting ? 'Connecting' : connected ? 'Connected' : 'Unknown'
      }),
      // Collapse chevron
      React.createElement('button', {
        className: 'sidebar-collapse-btn p-1 transition-colors',
        onClick: onToggleCollapse,
        title: 'Collapse sidebar',
        'aria-label': 'Collapse sidebar',
        style: { backgroundColor: 'transparent' }
      },
        React.createElement('svg', {
          className: 'w-4 h-4 transition-transform duration-200',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '2',
          style: { color: 'var(--q-copper2)' }
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M15 19l-7-7 7-7'
          })
        )
      )
    )
  );
}

/**
 * MobileChatHeader - Compact header for mobile chat view
 * Replaces both the AppLayout mobile-header and ChatHeader on mobile
 */
function MobileChatHeader({
  thread,
  assignment,
  namespaceName,
  onToggleThreadsPane,
  onToggleAssignmentPane,
  paneOpen,
  onUpdateMode,
  sending
}) {
  return React.createElement('header', {
    className: 'mobile-chat-header'
  },
    // Left group: threads drawer toggle
    React.createElement('div', {
      className: 'flex items-center gap-1 flex-shrink-0'
    },
      // Threads - open threads drawer
      React.createElement('button', {
        type: 'button',
        onClick: onToggleThreadsPane,
        className: 'mobile-header-btn',
        'aria-label': 'Open threads',
        title: 'Threads'
      },
        React.createElement(QIcon, { name: 'menu', size: 20, color: 'currentColor' })
      )
    ),

    // Center: thread title + namespace subtext (or just namespace if no thread)
    React.createElement('div', {
      className: 'flex-1 min-w-0 px-2'
    },
      React.createElement('div', {
        className: 'truncate',
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          letterSpacing: '1.5px',
          color: 'var(--q-bone3)',
          lineHeight: '1.2'
        }
      }, thread ? (thread.title || 'New Chat') : namespaceName),
      thread && React.createElement('div', {
        className: 'truncate',
        style: {
          fontFamily: 'var(--font-console)',
          fontSize: '9px',
          color: 'var(--q-bone0)',
          letterSpacing: '1px',
          lineHeight: '1.2',
          marginTop: '2px'
        }
      }, namespaceName)
    ),

    // Right group: status runes + compact mode toggle
    React.createElement('div', {
      className: 'flex items-center gap-1 flex-shrink-0'
    },
      // Status runes (only when assignment exists)
      assignment && React.createElement('div', {
        className: 'flex items-center gap-1 mr-1'
      },
        // Alignment rune (guardian mode only)
        thread?.mode === 'guardian' && React.createElement('span', {
          title: `Alignment: ${(assignment.alignmentStatus || 'aligned').toUpperCase()}`,
          style: { display: 'flex', alignItems: 'center' }
        },
          React.createElement(QIcon, {
            name: 'armor',
            size: 14,
            color: getAlignmentColor(assignment.alignmentStatus || 'aligned')
          })
        ),
        // Assignment status rune
        React.createElement('span', {
          title: `Status: ${(assignment.status || 'idle').toUpperCase()}`,
          style: { display: 'flex', alignItems: 'center' }
        },
          React.createElement(QIcon, {
            name: 'health',
            size: 14,
            color: getStatusColor(assignment.status)
          })
        )
      ),
      // Assignment pane toggle (only when assignment exists)
      assignment && React.createElement('button', {
        type: 'button',
        onClick: onToggleAssignmentPane,
        className: 'mobile-header-btn',
        'aria-label': paneOpen ? 'Hide assignment details' : 'Show assignment details',
        'aria-expanded': paneOpen,
        title: paneOpen ? 'Hide details' : 'Show details',
        style: paneOpen ? { color: 'var(--q-copper2)' } : undefined
      },
        React.createElement(QIcon, {
          name: 'route',
          size: 16,
          color: paneOpen ? 'var(--q-copper2)' : 'currentColor'
        })
      ),
      // Compact mode toggle
      React.createElement(ModeToggle, {
        mode: thread?.mode || 'jam',
        onChange: onUpdateMode,
        disabled: sending,
        hasAssignment: !!thread?.assignmentId || !!assignment,
        compact: true
      })
    )
  );
}

/**
 * ChatPanel component - Main container managing chat state
 * WP-5: Transformed from per-namespace to cross-namespace operations center.
 * No longer requires namespaceId/namespaceName props — fetches all threads via listAll.
 * @param {Object} props
 * @param {Array} props.namespaces - All namespace objects from parent (for filter + map)
 * @param {Object} props.responsive - Responsive mode info (optional, for WP-5)
 */
export function ChatPanel({ namespaces, responsive, mobileBackTrigger }) {
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // WP-3: Threads pane collapse state with localStorage persistence
  const [threadsPaneCollapsed, setThreadsPaneCollapsed] = useState(getInitialCollapsedState);

  // WP-5: Mobile drawer state for threads pane
  const [threadsMobileOpen, setThreadsMobileOpen] = useState(false);

  // Assignment pane state (lifted from ChatView for mobile header access)
  const [paneOpen, setPaneOpen] = useState(getInitialPaneOpen);

  // Mobile back button: close all panes when triggered from AppLayout
  useEffect(() => {
    if (mobileBackTrigger > 0) {
      setThreadsMobileOpen(false);
      setPaneOpen(false);
    }
  }, [mobileBackTrigger]);

  // WP-6: Draft state management — in-memory Map + debounced localStorage persistence
  const draftsRef = useRef(new Map());
  const draftTimersRef = useRef(new Map());

  // Load draft from localStorage on first access for a given threadId
  const getDraft = useCallback((threadId) => {
    if (!threadId) return '';
    if (draftsRef.current.has(threadId)) {
      return draftsRef.current.get(threadId);
    }
    // Try localStorage fallback
    try {
      const stored = localStorage.getItem(`workflow-engine:draft:${threadId}`);
      if (stored) {
        draftsRef.current.set(threadId, stored);
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
    return '';
  }, []);

  // Save draft (in-memory immediate, localStorage debounced at 500ms)
  const saveDraft = useCallback((threadId, text) => {
    if (!threadId) return;
    draftsRef.current.set(threadId, text);
    // Debounced localStorage write
    const existing = draftTimersRef.current.get(threadId);
    if (existing) clearTimeout(existing);
    draftTimersRef.current.set(threadId, setTimeout(() => {
      try {
        if (text) {
          localStorage.setItem(`workflow-engine:draft:${threadId}`, text);
        } else {
          localStorage.removeItem(`workflow-engine:draft:${threadId}`);
        }
      } catch {
        // Ignore localStorage errors
      }
    }, 500));
  }, []);

  // Clear draft from both in-memory and localStorage
  const clearDraft = useCallback((threadId) => {
    if (!threadId) return;
    draftsRef.current.delete(threadId);
    try {
      localStorage.removeItem(`workflow-engine:draft:${threadId}`);
    } catch {
      // Ignore localStorage errors
    }
    const timer = draftTimersRef.current.get(threadId);
    if (timer) clearTimeout(timer);
    draftTimersRef.current.delete(threadId);
  }, []);

  // WP-6: Current draft state for the selected thread (reactive)
  const [currentDraft, setCurrentDraft] = useState('');

  // WP-6: markRead mutation
  const markRead = useMutation(api.chatThreads.markRead);

  // WP-5: Namespace filter state — empty set means "show all"
  const [selectedNamespaceIds, setSelectedNamespaceIds] = useState(new Set());

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNamespaceId, setSettingsNamespaceId] = useState(null);

  // Open settings — if one namespace is filtered, use that; otherwise use first
  const handleOpenSettings = useCallback(() => {
    let targetNsId = null;
    if (selectedNamespaceIds.size === 1) {
      targetNsId = selectedNamespaceIds.values().next().value;
    } else if (namespaces && namespaces.length === 1) {
      targetNsId = namespaces[0]._id;
    } else if (namespaces && namespaces.length > 0) {
      // Multiple namespaces, none filtered — use first
      targetNsId = namespaces[0]._id;
    }
    if (targetNsId) {
      setSettingsNamespaceId(targetNsId);
      setSettingsOpen(true);
    }
  }, [selectedNamespaceIds, namespaces]);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  // WP-5: Toggle a namespace in/out of the filter set
  const handleToggleNamespace = useCallback((nsId) => {
    setSelectedNamespaceIds(prev => {
      const next = new Set(prev);
      if (next.has(nsId)) {
        next.delete(nsId);
      } else {
        next.add(nsId);
      }
      return next;
    });
  }, []);

  // WP-5: Build namespaceMap (id -> name) from namespaces prop
  const namespaceMap = useMemo(() => {
    if (!namespaces) return {};
    const map = {};
    for (const ns of namespaces) {
      map[ns._id] = ns.name;
    }
    return map;
  }, [namespaces]);

  // Thread pagination — increase limit to load more
  const [threadLimit, setThreadLimit] = useState(50);

  // Fetch threads cross-namespace, paginated by limit, sorted by latestMessageAt desc
  const { data: allThreads, loading: loadingThreads } = useQuery(
    api.chatThreads.listAll,
    { limit: threadLimit }
  );

  // Whether there may be more threads beyond current limit
  const hasMoreThreads = allThreads && allThreads.length >= threadLimit;

  const handleLoadMoreThreads = useCallback(() => {
    setThreadLimit(prev => prev + 50);
  }, []);

  // WP-5: Client-side namespace filtering
  const threads = useMemo(() => {
    if (!allThreads) return null;
    if (selectedNamespaceIds.size === 0) return allThreads; // No filter = show all
    return allThreads.filter(t => selectedNamespaceIds.has(t.namespaceId));
  }, [allThreads, selectedNamespaceIds]);

  // Get selected thread object (must be defined before useMemos that reference it)
  const selectedThread = threads?.find(t => t._id === selectedThreadId) || null;

  // Per-assignment subscription for the selected thread's assignment
  const { data: selectedAssignment } = useQuery(
    selectedThread?.assignmentId ? api.assignments.get : null,
    selectedThread?.assignmentId ? { id: selectedThread.assignmentId } : {}
  );

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

  // WP-7: Mutation hooks for assignment & agent control (U5, U6, R1, R2)
  const updateAssignmentStatus = useMutation(api.assignments.update);
  const updateFocusAssignment = useMutation(api.chatThreads.updateFocusAssignment);
  const killJob = useMutation(api.jobs.requestKill);
  const killChatJob = useMutation(api.chatJobs.requestKill);
  const retryGroup = useMutation(api.jobs.retryGroup);

  // WP-5: No longer reset selection on namespace change (cross-namespace view)
  // Auto-select first thread if none selected and threads exist
  useEffect(() => {
    if (!selectedThreadId && threads?.length > 0 && !loadingThreads) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThreadId, loadingThreads]);

  // FIX-5: Auto-reselect when namespace filter hides the currently selected thread
  useEffect(() => {
    if (!threads || !selectedThreadId) return;
    const stillVisible = threads.some(t => t._id === selectedThreadId);
    if (!stillVisible) {
      setSelectedThreadId(threads.length > 0 ? threads[0]._id : null);
    }
  }, [threads, selectedThreadId]);

  // WP-6: Load draft when selected thread changes
  useEffect(() => {
    setCurrentDraft(getDraft(selectedThreadId));
  }, [selectedThreadId, getDraft]);

  // WP-6: Handle draft text change from ChatInput
  const handleDraftChange = useCallback((text) => {
    setCurrentDraft(text);
    saveDraft(selectedThreadId, text);
  }, [selectedThreadId, saveDraft]);

  // WP-6: markRead callback for MessageList — fires when messages render
  const handleMarkRead = useCallback(() => {
    if (selectedThreadId) {
      markRead({ id: selectedThreadId }).catch(() => {});
    }
  }, [selectedThreadId, markRead]);

  // WP-6: Also call markRead when thread is first selected
  useEffect(() => {
    if (selectedThreadId) {
      markRead({ id: selectedThreadId }).catch(() => {});
    }
  }, [selectedThreadId, markRead]);

  // WP-5: Handle creating a new thread
  // Accepts optional namespaceId; falls back to first filtered or first available
  const handleCreateThread = useCallback(async (namespaceId) => {
    if (creating) return;

    // Determine which namespace to create the thread in
    let targetNamespaceId = namespaceId || null;
    if (!targetNamespaceId) {
      if (selectedNamespaceIds.size > 0) {
        targetNamespaceId = selectedNamespaceIds.values().next().value;
      } else if (namespaces && namespaces.length > 0) {
        targetNamespaceId = namespaces[0]._id;
      }
    }

    if (!targetNamespaceId) return;

    setCreating(true);
    try {
      const newThreadId = await createThread({ namespaceId: targetNamespaceId });
      setSelectedThreadId(newThreadId);
    } catch (err) {
      console.error('Failed to create thread:', err);
    } finally {
      setCreating(false);
    }
  }, [creating, selectedNamespaceIds, namespaces, createThread]);

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
      const messageId = await addMessage({
        threadId: selectedThreadId,
        role: 'user',
        content: content
      });

      // 2. Trigger chat job - runner picks it up and executes Claude
      //    Response is saved to chatMessages by the runner
      //    UI updates via Convex real-time subscription
      await triggerChatJob({
        threadId: selectedThreadId,
        triggerMessageId: messageId
      });

      // WP-6: Clear draft on successful send
      clearDraft(selectedThreadId);
      setCurrentDraft('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [selectedThreadId, sending, addMessage, triggerChatJob, clearDraft]);

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

  // WP-7: Assignment status update callback (U5)
  const handleUpdateAssignmentStatus = useCallback(async (status) => {
    if (!selectedAssignment?._id) return;
    try {
      await updateAssignmentStatus({ id: selectedAssignment._id, status });
    } catch (err) {
      console.error('Failed to update assignment status:', err);
    }
  }, [selectedAssignment?._id, updateAssignmentStatus]);

  // PM Nudge update callback
  const handleUpdateNudge = useCallback(async (pmNudge) => {
    if (!selectedAssignment?._id) return;
    try {
      await updateAssignmentStatus({ id: selectedAssignment._id, pmNudge });
    } catch (err) {
      console.error('Failed to update nudge:', err);
    }
  }, [selectedAssignment?._id, updateAssignmentStatus]);

  // WP-7: Focus assignment change callback (U6)
  const handleChangeFocusAssignment = useCallback(async (assignmentId) => {
    if (!selectedThreadId) return;
    try {
      await updateFocusAssignment({ id: selectedThreadId, assignmentId });
    } catch (err) {
      console.error('Failed to change focus assignment:', err);
    }
  }, [selectedThreadId, updateFocusAssignment]);

  // WP-7: Kill job callback (R1)
  const handleKillJob = useCallback(async (jobId) => {
    try {
      await killJob({ id: jobId });
    } catch (err) {
      console.error('Failed to kill job:', err);
    }
  }, [killJob]);

  // WP-7: Kill chat job callback (R2)
  const handleKillChatJob = useCallback(async (chatJobId) => {
    try {
      await killChatJob({ id: chatJobId });
    } catch (err) {
      console.error('Failed to kill chat job:', err);
    }
  }, [killChatJob]);

  // Retry a job group (cascade-deletes downstream, resets this group)
  const handleRetryGroup = useCallback(async (groupId, downstreamCount) => {
    const msg = downstreamCount > 0
      ? `Retry this group? ${downstreamCount} downstream group${downstreamCount === 1 ? '' : 's'} will be deleted.`
      : 'Retry this group?';
    if (!confirm(msg)) return;
    try {
      await retryGroup({ id: groupId });
    } catch (err) {
      console.error('Failed to retry group:', err);
    }
  }, [retryGroup]);

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

  // Assignment pane toggle (lifted from ChatView for mobile header access)
  const handleTogglePane = useCallback(() => {
    setPaneOpen(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(ASSIGNMENT_PANE_COLLAPSED_KEY, String(!newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  const handleClosePane = useCallback(() => {
    setPaneOpen(false);
    try {
      localStorage.setItem(ASSIGNMENT_PANE_COLLAPSED_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Auto-open pane when thread changes and has assignment
  useEffect(() => {
    setPaneOpen(!!selectedAssignment);
  }, [selectedThread?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // WP-5: Derive namespace name for the selected thread (for mobile header)
  const selectedThreadNamespaceName = selectedThread ? (namespaceMap[selectedThread.namespaceId] || '') : '';

  // WP-5: Build threads pane classes based on responsive mode
  // WP-8: Remove gray-* Tailwind classes, use Q palette via inline styles
  const threadsPaneClasses = [
    'threads-pane',
    'flex-shrink-0',
    'overflow-hidden',
    'transition-all',
    'duration-300',
    'ease-in-out',
    threadsPaneCollapsed ? 'threads-pane-collapsed' : 'threads-pane-expanded',
    responsive?.isMobile && threadsMobileOpen ? 'threads-mobile-open' : ''
  ].filter(Boolean).join(' ');

  // WP-8: Threads pane inline styles using Q palette
  const threadsPaneStyle = {
    backgroundColor: 'var(--q-stone0)',
    borderRight: '1px solid var(--q-stone3)'
  };

  return React.createElement('div', {
    className: 'chat-panel flex flex-1 min-h-0'
  },
    // Mobile chat header (replaces both AppLayout mobile-header and ChatHeader on mobile)
    responsive?.isMobile && React.createElement(MobileChatHeader, {
      thread: selectedThread,
      assignment: selectedAssignment || null,
      namespaceName: selectedThreadNamespaceName,
      onToggleThreadsPane: handleToggleThreadsPane,
      onToggleAssignmentPane: handleTogglePane,
      paneOpen: paneOpen,
      onUpdateMode: handleUpdateMode,
      sending: sending || isProcessing
    }),

    // WP-5: Mobile threads overlay
    responsive?.isMobile && React.createElement('div', {
      className: `threads-overlay ${threadsMobileOpen ? 'visible' : ''}`,
      onClick: handleCloseThreadsMobile,
      'aria-hidden': 'true'
    }),

    // WP-3: Collapsible thread sidebar container with Q palette styling
    React.createElement('div', {
      className: threadsPaneClasses,
      style: threadsPaneStyle,
      'aria-hidden': responsive?.isMobile && !threadsMobileOpen
    },
      // Collapsed state: icon-only strip with expand button
      threadsPaneCollapsed && React.createElement('div', {
        className: 'threads-pane-collapsed-content h-full flex flex-col items-center py-3 gap-3'
      },
        // Expand button - Q palette styling
        React.createElement('button', {
          type: 'button',
          onClick: handleToggleThreadsPane,
          className: 'threads-toggle p-2 transition-colors flex-shrink-0 chat-panel-collapse-btn',
          style: {
            color: 'var(--q-bone0)',
            borderRadius: 0
          },
          title: 'Expand conversations',
          'aria-label': 'Expand conversations'
        },
          React.createElement(CollapseChevron, { collapsed: true })
        ),

        // New Chat Button (Collapsed) - Q palette copper instead of blue
        React.createElement('button', {
          type: 'button',
          onClick: handleCreateThread,
          disabled: creating,
          className: `p-2 transition-colors flex-shrink-0 chat-panel-new-btn ${creating ? 'opacity-50 cursor-wait' : ''}`,
          style: {
            // Q palette: copper glow (replaces blue-500/10, blue-400)
            backgroundColor: 'rgba(122, 78, 40, 0.15)', // copper1 at 15%
            color: 'var(--q-copper2)',
            borderRadius: 0
          },
          title: 'New Chat'
        },
          React.createElement('svg', {
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
           )
        ),

        // Scrollable Thread Icons
        React.createElement('div', {
          className: 'flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 py-2 scrollbar-hide'
        },
          threads && threads.map(thread =>
            React.createElement(ThreadIconWithAssignment, {
              key: thread._id,
              thread: thread,
              isSelected: selectedThreadId === thread._id,
              onClick: () => handleSelectThread(thread)
            })
          )
        )
      ),

      // Expanded state: full sidebar
      !threadsPaneCollapsed && React.createElement('div', {
        className: 'threads-pane-expanded-content h-full flex flex-col'
      },
        // CC3 Branding header with connection status and collapse toggle
        React.createElement(CC3BrandingHeader, {
          onToggleCollapse: handleToggleThreadsPane
        }),
        // ChatSidebar content (without its own header)
        // WP-5: Pass namespace filter props and namespaceMap for cross-namespace view
        React.createElement(ChatSidebar, {
          threads: threads || [],
          selectedThreadId: selectedThreadId,
          onSelectThread: handleSelectThread,
          onCreateThread: handleCreateThread,
          onCreateInNamespace: handleCreateThread,
          onDeleteThread: handleDeleteThread,
          loading: loadingThreads,
          creating: creating,
          namespaces: namespaces,
          selectedNamespaceIds: selectedNamespaceIds,
          onToggleNamespace: handleToggleNamespace,
          namespaceMap: namespaceMap,
          hasMore: hasMoreThreads,
          onLoadMore: handleLoadMoreThreads,
          onOpenSettings: handleOpenSettings
        })
      )
    ),

    // Main chat view (pass chain data for assignment pane + responsive mode)
    // WP-6: Added draftText, onDraftChange, onMarkRead props for draft persistence and markRead
    React.createElement(ChatView, {
      thread: selectedThread,
      assignment: selectedAssignment || null,
      assignmentId: selectedThread?.assignmentId || null,
      messages: messages || [],
      onSendMessage: handleSendMessage,
      onUpdateTitle: handleUpdateTitle,
      onUpdateMode: handleUpdateMode,
      loadingMessages: loadingMessages,
      sending: sending || isProcessing,
      responsive: responsive,
      onToggleThreadsPane: handleToggleThreadsPane,
      paneOpen: paneOpen,
      onTogglePane: handleTogglePane,
      onClosePane: handleClosePane,
      draftText: currentDraft,
      onDraftChange: handleDraftChange,
      onMarkRead: handleMarkRead,
      onUpdateAssignmentStatus: handleUpdateAssignmentStatus,
      onUpdateNudge: handleUpdateNudge,
      onChangeFocusAssignment: handleChangeFocusAssignment,
      onKillJob: handleKillJob,
      onKillChatJob: handleKillChatJob,
      onRetryGroup: handleRetryGroup,
      activeChatJob: activeChatJob || null
    }),

    // Settings modal
    React.createElement(NamespaceSettings, {
      isOpen: settingsOpen,
      onClose: handleCloseSettings,
      namespaceId: settingsNamespaceId,
      namespaceName: settingsNamespaceId ? (namespaceMap[settingsNamespaceId] || '') : '',
      allNamespaceIds: namespaces ? namespaces.map(ns => ns._id) : [],
    })
  );
}

export default ChatPanel;
