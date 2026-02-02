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
 */
function renderContent(content) {
  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Code block
      const code = part.slice(3, -3);
      const lines = code.split('\n');
      const language = lines[0]?.match(/^\w+$/) ? lines.shift() : '';
      const codeContent = lines.join('\n').trim();

      return React.createElement('pre', {
        key: index,
        className: 'bg-gray-900 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono'
      },
        language && React.createElement('div', {
          className: 'text-xs text-gray-500 mb-2'
        }, language),
        React.createElement('code', { className: 'text-gray-300' }, codeContent)
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
 * Get role configuration for styling
 */
function getRoleConfig(role) {
  switch (role) {
    case 'user':
      return {
        icon: UserIcon,
        label: 'You',
        bgColor: 'bg-blue-500',
        bubbleColor: 'bg-blue-500 text-white rounded-tr-sm',
        isRight: true,
      };
    case 'pm':
      return {
        icon: PMIcon,
        label: 'PM Report',
        bgColor: 'bg-amber-600',
        bubbleColor: 'bg-amber-900/50 text-amber-100 rounded-tl-sm border border-amber-700/50',
        isRight: false,
      };
    case 'assistant':
    default:
      return {
        icon: AssistantIcon,
        label: 'Product Owner',
        bgColor: 'bg-purple-500',
        bubbleColor: 'bg-gray-800 text-gray-100 rounded-tl-sm',
        isRight: false,
      };
  }
}

/**
 * MessageBubble component - Individual message with role styling
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
      // Avatar
      React.createElement('div', {
        className: `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`
      },
        React.createElement(Icon)
      ),

      // Message content
      React.createElement('div', {
        className: `flex flex-col ${config.isRight ? 'items-end' : 'items-start'}`
      },
        // Role label
        React.createElement('span', {
          className: `text-xs mb-1 px-1 ${message.role === 'pm' ? 'text-amber-500' : 'text-gray-500'}`
        }, config.label),

        // Message bubble
        React.createElement('div', {
          className: `rounded-2xl px-4 py-2.5 ${config.bubbleColor}`
        },
          React.createElement('div', {
            className: 'text-sm leading-relaxed whitespace-pre-wrap break-words'
          }, renderContent(message.content))
        ),

        // Timestamp
        message.createdAt && React.createElement('span', {
          className: 'text-xs text-gray-600 mt-1 px-1'
        }, formatTime(message.createdAt))
      )
    )
  );
}

export default MessageBubble;
