// MessageList - Scrollable message history
import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble.js';
import { LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';

/**
 * MessageList component - Scrollable list of messages
 * @param {Object} props
 * @param {Array} props.messages - Array of message objects
 * @param {boolean} props.loading - Whether messages are loading
 * @param {boolean} props.sending - Whether a message is being sent
 */
export function MessageList({ messages = [], loading = false, sending = false }) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

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
    ref: containerRef,
    className: 'flex-1 overflow-y-auto p-4'
  },
    // Messages
    React.createElement('div', { className: 'space-y-4' },
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
          className: 'flex gap-3 max-w-[80%]'
        },
          // Assistant avatar - Q palette teleport (matches MessageBubble.js assistant avatar)
          React.createElement('div', {
            className: 'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
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
  );
}

export default MessageList;
