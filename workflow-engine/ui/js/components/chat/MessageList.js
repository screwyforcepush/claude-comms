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

  // Loading state
  if (loading && messages.length === 0) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center'
    },
      React.createElement('div', { className: 'text-center' },
        React.createElement(LoadingSpinner, { size: 'lg' }),
        React.createElement('p', { className: 'text-gray-500 mt-3' }, 'Loading messages...')
      )
    );
  }

  // Empty state
  if (messages.length === 0 && !sending) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center p-8'
    },
      React.createElement('div', { className: 'text-center max-w-md' },
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
            d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
          })
        ),
        React.createElement('h3', {
          className: 'text-lg font-medium text-gray-300 mb-2'
        }, 'Start a conversation'),
        React.createElement('p', {
          className: 'text-gray-500 text-sm'
        }, 'Send a message to begin chatting with the Product Owner. They can help you spec out ideas and create assignments.')
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

      // Sending indicator
      sending && React.createElement('div', {
        className: 'flex justify-start'
      },
        React.createElement('div', {
          className: 'flex gap-3 max-w-[80%]'
        },
          // Assistant avatar
          React.createElement('div', {
            className: 'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500'
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
                d: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
              })
            )
          ),

          // Typing indicator
          React.createElement('div', { className: 'flex flex-col items-start' },
            React.createElement('span', {
              className: 'text-xs text-gray-500 mb-1 px-1'
            }, 'Product Owner'),
            React.createElement('div', {
              className: 'bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3'
            },
              React.createElement('div', {
                className: 'flex items-center gap-1'
              },
                React.createElement('span', {
                  className: 'w-2 h-2 bg-gray-500 rounded-full animate-bounce',
                  style: { animationDelay: '0ms' }
                }),
                React.createElement('span', {
                  className: 'w-2 h-2 bg-gray-500 rounded-full animate-bounce',
                  style: { animationDelay: '150ms' }
                }),
                React.createElement('span', {
                  className: 'w-2 h-2 bg-gray-500 rounded-full animate-bounce',
                  style: { animationDelay: '300ms' }
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
