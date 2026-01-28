// ChatPanel - Main container for chat feature
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { ChatSidebar } from './ChatSidebar.js';
import { ChatView } from './ChatView.js';

/**
 * ChatPanel component - Main container managing chat state
 * @param {Object} props
 * @param {string} props.namespaceId - Current namespace ID for thread scoping
 * @param {string} props.namespaceName - Current namespace name (for display)
 */
export function ChatPanel({ namespaceId, namespaceName }) {
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch threads for this namespace
  const { data: threads, loading: loadingThreads } = useQuery(
    api.chatThreads.list,
    { namespaceId }
  );

  // Fetch messages for selected thread
  const { data: messages, loading: loadingMessages } = useQuery(
    selectedThreadId ? api.chatMessages.list : null,
    selectedThreadId ? { threadId: selectedThreadId } : {}
  );

  // Mutations
  const createThread = useMutation(api.chatThreads.create);
  const addMessage = useMutation(api.chatMessages.add);
  const updateMode = useMutation(api.chatThreads.updateMode);
  const updateTitle = useMutation(api.chatThreads.updateTitle);
  const removeThread = useMutation(api.chatThreads.remove);
  const triggerChatJob = useMutation(api.chatJobs.trigger);

  // Get selected thread object
  const selectedThread = threads?.find(t => t._id === selectedThreadId) || null;

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

  return React.createElement('div', {
    className: 'chat-panel flex flex-1 min-h-0'
  },
    // Thread sidebar
    React.createElement('div', {
      className: 'w-64 flex-shrink-0'
    },
      React.createElement(ChatSidebar, {
        threads: threads || [],
        selectedThreadId: selectedThreadId,
        onSelectThread: handleSelectThread,
        onCreateThread: handleCreateThread,
        onDeleteThread: handleDeleteThread,
        loading: loadingThreads,
        creating: creating
      })
    ),

    // Main chat view
    React.createElement(ChatView, {
      thread: selectedThread,
      messages: messages || [],
      onSendMessage: handleSendMessage,
      onUpdateTitle: handleUpdateTitle,
      onUpdateMode: handleUpdateMode,
      loadingMessages: loadingMessages,
      sending: sending
    })
  );
}

export default ChatPanel;
