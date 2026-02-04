// MessageBubble - Individual message display
import React from 'react';

/**
 * User icon for user messages
 */
function UserIcon() {
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
      d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    })
  );
}

/**
 * Assistant icon for assistant messages
 */
function AssistantIcon() {
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
      d: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
    })
  );
}

/**
 * PM icon for PM report messages
 */
function PMIcon() {
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
      d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
    })
  );
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Simple markdown-like rendering (basic support for code blocks and line breaks)
 * Code blocks use Q palette void background with bone text
 */
function renderContent(content) {
  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Code block - Q palette void background
      const code = part.slice(3, -3);
      const lines = code.split('\n');
      const language = lines[0]?.match(/^\w+$/) ? lines.shift() : '';
      const codeContent = lines.join('\n').trim();

      return React.createElement('pre', {
        key: index,
        className: 'p-3 my-2 overflow-x-auto text-sm',
        style: {
          backgroundColor: 'var(--q-void1)',
          fontFamily: 'var(--font-console)'
        }
      },
        language && React.createElement('div', {
          className: 'text-xs mb-2',
          style: { color: 'var(--q-bone0)' }
        }, language),
        React.createElement('code', {
          style: {
            color: 'var(--q-bone1)',
            fontFamily: 'var(--font-console)'
          }
        }, codeContent)
      );
    } else {
      // Regular text with line breaks
      const lines = part.split('\n');
      return React.createElement('span', { key: index },
        lines.map((line, lineIndex) =>
          React.createElement(React.Fragment, { key: lineIndex },
            line,
            lineIndex < lines.length - 1 && React.createElement('br')
          )
        )
      );
    }
  });
}

/**
 * Get role configuration for styling - Q palette brandkit
 * User: copper gradient, Assistant: stone palette, PM: torch/copper accent
 */
function getRoleConfig(role) {
  switch (role) {
    case 'user':
      return {
        icon: UserIcon,
        label: 'You',
        avatarStyle: { backgroundColor: 'var(--q-copper1)' },
        bubbleStyle: {
          background: 'linear-gradient(180deg, var(--q-copper1), var(--q-copper0))',
          color: 'var(--q-void0)',
          textShadow: '0 1px 0 var(--q-copper3-44)'
        },
        bubbleClass: '',
        isRight: true,
      };
    case 'pm':
      return {
        icon: PMIcon,
        label: 'PM Report',
        avatarStyle: { backgroundColor: 'var(--q-torch)' },
        bubbleStyle: {
          backgroundColor: 'var(--q-stone1)',
          color: 'var(--q-bone3)',
          border: '1px solid var(--q-copper1-44)'
        },
        bubbleClass: '',
        isRight: false,
      };
    case 'assistant':
    default:
      return {
        icon: AssistantIcon,
        label: 'Product Owner',
        avatarStyle: { backgroundColor: 'var(--q-teleport)' },
        bubbleStyle: {
          backgroundColor: 'var(--q-stone2)',
          color: 'var(--q-bone2)',
          border: '1px solid var(--q-stone3)'
        },
        bubbleClass: '',
        isRight: false,
      };
  }
}

/**
 * MessageBubble component - Individual message with role styling
 * Uses Q palette brandkit: copper for user, stone for assistant, torch/copper for PM
 * @param {Object} props
 * @param {Object} props.message - Message object with role, content, createdAt
 * @param {boolean} props.isLast - Whether this is the last message (for styling)
 */
export function MessageBubble({ message, isLast = false }) {
  const config = getRoleConfig(message.role);
  const Icon = config.icon;

  return React.createElement('div', {
    className: `flex ${config.isRight ? 'justify-end' : 'justify-start'} ${isLast ? '' : 'mb-4'} ${message.role === 'pm' ? 'pm-message' : ''}`
  },
    React.createElement('div', {
      className: `flex gap-3 max-w-[80%] ${config.isRight ? 'flex-row-reverse' : 'flex-row'}`
    },
      // Avatar - Q palette colors via inline style
      React.createElement('div', {
        className: 'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        style: config.avatarStyle
      },
        React.createElement(Icon)
      ),

      // Message content
      React.createElement('div', {
        className: `flex flex-col ${config.isRight ? 'items-end' : 'items-start'}`
      },
        // Role label - Q palette bone0, PM uses torch
        React.createElement('span', {
          className: 'text-xs mb-1 px-1',
          style: { color: message.role === 'pm' ? 'var(--q-torch)' : 'var(--q-bone0)' }
        }, config.label),

        // Message bubble - Q palette styling via inline style
        React.createElement('div', {
          className: `px-4 py-2.5 ${config.bubbleClass}`,
          style: config.bubbleStyle
        },
          React.createElement('div', {
            className: 'text-sm leading-relaxed whitespace-pre-wrap break-words',
            style: { fontFamily: 'var(--font-body)' }
          }, renderContent(message.content))
        ),

        // Timestamp - Q palette bone0
        message.createdAt && React.createElement('span', {
          className: 'text-xs mt-1 px-1',
          style: { color: 'var(--q-bone0)' }
        }, formatTime(message.createdAt))
      )
    )
  );
}

export default MessageBubble;
