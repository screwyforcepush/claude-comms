// MessageBubble - Individual message display
import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

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
 * Quartermaster icon for assistant messages (rune icon from brandkit)
 */
function QuartermasterIcon() {
  return React.createElement('svg', {
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
  );
}

/**
 * Dispatch icon for PM/dispatch report messages (dispatch icon from brandkit)
 * Uses dark stroke on light torch background
 */
function DispatchIcon() {
  return React.createElement('svg', {
    className: 'w-5 h-5',
    fill: 'none',
    viewBox: '0 0 24 24'
  },
    React.createElement('path', { d: 'M4 12h12', stroke: 'var(--q-void0)', strokeWidth: 2 }),
    React.createElement('path', { d: 'M14 7l6 5-6 5', stroke: 'var(--q-void0)', strokeWidth: 2, fill: 'none', strokeLinejoin: 'miter' })
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

// Configure marked for GFM with breaks
marked.setOptions({
  gfm: true,
  breaks: true
});

/**
 * Render markdown content to sanitized HTML
 * Uses marked for parsing and DOMPurify for XSS prevention
 */
function renderMarkdown(content) {
  if (!content) return { __html: '' };
  const rawHtml = marked.parse(content);
  const cleanHtml = DOMPurify.sanitize(rawHtml);
  return { __html: cleanHtml };
}

/**
 * Get role configuration for styling - Q palette brandkit
 * User: copper gradient, Assistant: stone palette, Dispatcher: torch/copper accent
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
        icon: DispatchIcon,
        label: 'Dispatch',
        avatarStyle: { backgroundColor: 'var(--q-torch)' },
        bubbleStyle: {
          backgroundColor: 'var(--q-stone1)',
          color: 'var(--q-bone3)',
          border: '1px solid var(--q-torch-33)'
        },
        bubbleClass: '',
        isRight: false,
      };
    case 'assistant':
    default:
      return {
        icon: QuartermasterIcon,
        label: 'Quartermaster',
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
 * Uses Q palette brandkit: copper for user, stone for assistant, torch/copper for dispatcher
 * @param {Object} props
 * @param {Object} props.message - Message object with role, content, createdAt
 * @param {boolean} props.isLast - Whether this is the last message (for styling)
 */
export function MessageBubble({ message, isLast = false }) {
  const config = getRoleConfig(message.role);
  const Icon = config.icon;

  // Memoize markdown parsing per message content
  const markdownHtml = useMemo(() => renderMarkdown(message.content), [message.content]);

  return React.createElement('div', {
    className: `flex ${config.isRight ? 'justify-end' : 'justify-start'} ${isLast ? '' : 'mb-4'} ${message.role === 'pm' ? 'pm-message' : ''}`
  },
    React.createElement('div', {
      className: `message-content-wrapper flex gap-3 max-w-[80%] ${config.isRight ? 'flex-row-reverse' : 'flex-row'}`
    },
      // Avatar - Q palette colors via inline style
      React.createElement('div', {
        className: 'message-avatar flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        style: config.avatarStyle
      },
        React.createElement(Icon)
      ),

      // Message content
      React.createElement('div', {
        className: `message-column flex flex-col ${config.isRight ? 'items-end' : 'items-start'}`
      },
        // Role label - Q palette bone0, dispatcher uses torch
        React.createElement('span', {
          className: 'text-xs mb-1 px-1',
          style: { color: message.role === 'pm' ? 'var(--q-torch)' : 'var(--q-bone0)' }
        }, config.label),

        // Message bubble - Q palette styling via inline style
        React.createElement('div', {
          className: `message-bubble px-4 py-2.5 ${config.bubbleClass}`,
          style: config.bubbleStyle
        },
          React.createElement('div', {
            className: `markdown-content ${config.isRight ? 'markdown-user' : ''} text-sm leading-relaxed break-words`,
            style: { fontFamily: 'var(--font-body)' },
            dangerouslySetInnerHTML: markdownHtml
          })
        ),

        // Hint bar — system annotation beneath bubble
        message.hint && React.createElement('div', {
          className: 'message-hint flex items-center gap-1.5 mt-1 px-2 py-1',
          style: {
            fontSize: '11px',
            fontFamily: 'var(--font-console)',
            color: 'var(--q-torch)',
            backgroundColor: 'rgba(212, 160, 48, 0.08)',
            borderLeft: '2px solid var(--q-torch)',
            letterSpacing: '0.3px',
            lineHeight: '1.4',
            whiteSpace: 'pre-line',
          }
        },
          React.createElement('span', null, message.hint)
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
