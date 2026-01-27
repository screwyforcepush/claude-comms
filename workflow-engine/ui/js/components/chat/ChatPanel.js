// ChatPanel - Main container for chat feature
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { ChatSidebar } from './ChatSidebar.js';
import { ChatView } from './ChatView.js';

/**
 * ChatPanel component - Main container managing chat state
 * @param {Object} props
 * @param {string} props.namespace - Current namespace for thread scoping
 */
export function ChatPanel({ namespace }) {
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch threads for this namespace
  const { data: threads, loading: loadingThreads } = useQuery(
    api.chatThreads.list,
    { namespace }
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

  // Get selected thread object
  const selectedThread = threads?.find(t => t._id === selectedThreadId) || null;

  // Reset selection when namespace changes
  useEffect(() => {
    setSelectedThreadId(null);
  }, [namespace]);

  // Auto-select first thread if none selected and threads exist
  useEffect(() => {
    if (!selectedThreadId && threads?.length > 0 && !loadingThreads) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThreadId, loadingThreads]);

  // Handle creating a new thread
  const handleCreateThread = useCallback(async () => {
    if (creating || !namespace) return;

    setCreating(true);
    try {
      const newThreadId = await createThread({ namespace });
      setSelectedThreadId(newThreadId);
    } catch (err) {
      console.error('Failed to create thread:', err);
    } finally {
      setCreating(false);
    }
  }, [creating, namespace, createThread]);

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
      // Add user message
      await addMessage({
        threadId: selectedThreadId,
        role: 'user',
        content: content
      });

      // For MVP: simulate a response after a delay
      // In production, this would trigger a job via the runner
      // and the response would come from the Product Owner agent
      setTimeout(async () => {
        try {
          const mode = selectedThread?.mode || 'jam';
          const response = mode === 'cook'
            ? `I understand you want me to take action. In Cook mode, I can create assignments and insert jobs. For now, this is a placeholder response. The full Product Owner agent will be connected in WP3.\n\nYour message: "${content}"`
            : `Great idea! Let me help you think through this. In Jam mode, I can help spec out ideas and ask clarifying questions. For now, this is a placeholder response. The full Product Owner agent will be connected in WP3.\n\nYour message: "${content}"`;

          await addMessage({
            threadId: selectedThreadId,
            role: 'assistant',
            content: response
          });
        } catch (err) {
          console.error('Failed to add assistant message:', err);
        } finally {
          setSending(false);
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to send message:', err);
      setSending(false);
    }
  }, [selectedThreadId, sending, addMessage, selectedThread?.mode]);

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
  if (!namespace) {
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
