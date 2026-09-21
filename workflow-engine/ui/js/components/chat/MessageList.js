// MessageList - Scrollable message history
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble.js';
import { LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';

// How close to the bottom (px) still counts as "at the tail".
const NEAR_BOTTOM_PX = 48;

/**
 * MessageList component - Scrollable list of messages
 *
 * Scroll policy — @see docs/project/spec/mental-model.md#scrollback-belongs-to-the-reader
 * The list follows the tail only while the reader is already at the tail. Anything that
 * lands while they are scrolled back (a reply, a PM post, a job starting, a websocket
 * reconnect re-delivering the same rows) must not move the viewport; it raises a
 * "new messages" pill instead. The follow trigger is keyed on the tail message, never
 * on the array reference, so re-deliveries of identical content are no-ops.
 *
 * @param {Object} props
 * @param {Array} props.messages - Array of message objects
 * @param {string|null} [props.threadId] - Active thread; a change re-pins the reader to the tail
 * @param {boolean} props.loading - Whether messages are loading
 * @param {boolean} props.sending - Whether a message is being sent
 * @param {Function} [props.onMarkRead] - Callback to mark thread as read when messages render (WP-6)
 */
export function MessageList({ messages = [], threadId = null, loading = false, sending = false, onMarkRead }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Is the reader at the tail? Ref for handlers, no re-render needed.
  const pinnedRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  // Tail identity of the last render we reacted to; null = fresh thread.
  const prevTailRef = useRef(null);
  const prevCountRef = useRef(0);
  const [unseen, setUnseen] = useState(false);

  const count = messages.length;
  const tailKey = count > 0 ? `${count}:${messages[count - 1]._id || count}` : '0';

  const scrollToBottom = useCallback((behavior) => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = true;
    setUnseen(false);
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Reader moved: pin when they reach the tail, unpin only when they move up
  // (moving down without reaching the tail is a smooth-scroll animation or a
  // partial drag — neither should flip state).
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const movedUp = el.scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = el.scrollTop;
    if (distance <= NEAR_BOTTOM_PX) {
      pinnedRef.current = true;
      setUnseen(false);
    } else if (movedUp) {
      pinnedRef.current = false;
    }
  }, []);

  // Thread switch: always start at the tail of the new thread.
  useEffect(() => {
    pinnedRef.current = true;
    prevTailRef.current = null;
    prevCountRef.current = 0;
    setUnseen(false);
  }, [threadId]);

  // Tail changed (message appended/removed). Follow if pinned; otherwise signal.
  useEffect(() => {
    if (prevTailRef.current === tailKey) return; // same rows re-delivered — no-op
    const firstForThread = prevTailRef.current === null;
    const grew = count > prevCountRef.current;
    prevTailRef.current = tailKey;
    prevCountRef.current = count;
    if (pinnedRef.current) {
      scrollToBottom(firstForThread ? 'auto' : 'smooth');
    } else if (grew) {
      setUnseen(true);
    }
  }, [tailKey, count, scrollToBottom]);

  // Layout changes (soft keyboard resizing the viewport, image previews loading,
  // the typing indicator appearing) keep a pinned reader at the tail and leave
  // an unpinned reader exactly where they are.
  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, [count === 0 && !sending]); // re-attach when the list mounts after empty/loading state

  // WP-6: Trigger markRead when messages are viewed (new messages arrive while thread is active)
  useEffect(() => {
    if (onMarkRead && messages.length > 0) {
      onMarkRead();
    }
  }, [messages, onMarkRead]);

  // Loading state - Q palette bone text
  if (loading && messages.length === 0) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center'
    },
      React.createElement('div', { className: 'text-center' },
        React.createElement(LoadingSpinner, { size: 'lg' }),
        React.createElement('p', {
          className: 'mt-3',
          style: { color: 'var(--q-bone0)' }
        }, 'Loading messages...')
      )
    );
  }

  // Empty state - Q palette bone text on void background
  if (messages.length === 0 && !sending) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center p-8'
    },
      React.createElement('div', { className: 'text-center max-w-md' },
        React.createElement('svg', {
          className: 'w-16 h-16 mx-auto mb-4',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '1.5',
          style: { color: 'var(--q-bone0)' }
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
          })
        ),
        React.createElement('h3', {
          className: 'text-lg font-medium mb-2',
          style: { color: 'var(--q-bone2)' }
        }, 'Start a conversation'),
        React.createElement('p', {
          className: 'text-sm',
          style: { color: 'var(--q-bone0)' }
        }, 'Send a message to begin chatting with the Quartermaster. They can help you spec out ideas and create assignments.')
      )
    );
  }

  return React.createElement('div', {
    className: 'chat-message-list-wrap flex-1 min-h-0 flex flex-col'
  },
  React.createElement('div', {
    ref: containerRef,
    onScroll: handleScroll,
    className: 'chat-message-list flex-1 min-h-0 overflow-y-auto p-4'
  },
    // Messages
    React.createElement('div', { ref: contentRef, className: 'space-y-4' },
      messages.map((message, index) =>
        React.createElement(MessageBubble, {
          key: message._id || `msg-${index}`,
          message: message,
          isLast: index === messages.length - 1 && !sending
        })
      ),

      // Sending indicator - Q palette styling matching assistant messages
      sending && React.createElement('div', {
        className: 'flex justify-start'
      },
        React.createElement('div', {
          className: 'message-content-wrapper flex gap-3 max-w-[80%]'
        },
          // Assistant avatar - Q palette teleport (matches MessageBubble.js assistant avatar)
          React.createElement('div', {
            className: 'message-avatar flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            style: { backgroundColor: 'var(--q-teleport)' }
          },
            React.createElement('svg', {
              className: 'w-5 h-5',
              fill: 'none',
              stroke: 'currentColor',
              viewBox: '0 0 24 24',
              strokeWidth: '2'
            },
              React.createElement('rect', { x: 5, y: 3, width: 14, height: 18, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }),
              React.createElement('path', { d: 'M9 7 L12 10 L15 7', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none' }),
              React.createElement('line', { x1: 12, y1: 10, x2: 12, y2: 17, stroke: 'currentColor', strokeWidth: 1.6 }),
              React.createElement('line', { x1: 9, y1: 14, x2: 15, y2: 14, stroke: 'currentColor', strokeWidth: 1.6 })
            )
          ),

          // Typing indicator - Q palette stone/bone styling
          React.createElement('div', { className: 'flex flex-col items-start' },
            React.createElement('span', {
              className: 'text-xs mb-1 px-1',
              style: { color: 'var(--q-bone0)' }
            }, 'Quartermaster'),
            React.createElement('div', {
              className: 'px-4 py-3',
              style: {
                backgroundColor: 'var(--q-stone2)',
                border: '1px solid var(--q-stone3)'
              }
            },
              React.createElement('div', {
                className: 'flex items-center gap-1'
              },
                React.createElement('span', {
                  className: 'w-2 h-2 rounded-full animate-bounce',
                  style: { backgroundColor: 'var(--q-copper1)', animationDelay: '0ms' }
                }),
                React.createElement('span', {
                  className: 'w-2 h-2 rounded-full animate-bounce',
                  style: { backgroundColor: 'var(--q-copper1)', animationDelay: '150ms' }
                }),
                React.createElement('span', {
                  className: 'w-2 h-2 rounded-full animate-bounce',
                  style: { backgroundColor: 'var(--q-copper1)', animationDelay: '300ms' }
                })
              )
            )
          )
        )
      )
    ),

    // Scroll anchor
    React.createElement('div', { ref: messagesEndRef })
  ),

    // New-messages pill: raised when something lands while the reader is scrolled back.
    unseen && React.createElement('button', {
      type: 'button',
      onClick: () => scrollToBottom('smooth'),
      className: 'chat-new-messages-pill',
      title: 'Jump to latest'
    },
      React.createElement('span', { 'aria-hidden': 'true' }, '▼'),
      React.createElement('span', null, 'NEW')
    )
  );
}

export default MessageList;
