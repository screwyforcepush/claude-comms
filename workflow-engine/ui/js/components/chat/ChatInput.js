// ChatInput - Message input with send button
import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Send icon component
 */
function SendIcon() {
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
      d: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
    })
  );
}

/**
 * ChatInput component - Text input with send button
 * @param {Object} props
 * @param {Function} props.onSend - Callback when message is sent
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.placeholder - Placeholder text
 */
export function ChatInput({ onSend, disabled = false, placeholder = 'Type a message...' }) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled && onSend) {
      onSend(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const canSend = message.trim().length > 0 && !disabled;

  return React.createElement('form', {
    onSubmit: handleSubmit,
    className: 'chat-input-container border-t border-gray-700 p-4 bg-gray-900'
  },
    React.createElement('div', {
      className: 'flex items-end gap-3'
    },
      // Textarea
      React.createElement('div', { className: 'flex-1 relative' },
        React.createElement('textarea', {
          ref: textareaRef,
          value: message,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: placeholder,
          disabled: disabled,
          rows: 1,
          className: `w-full resize-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`,
          style: { minHeight: '48px', maxHeight: '150px' }
        })
      ),

      // Send button
      React.createElement('button', {
        type: 'submit',
        disabled: !canSend,
        className: `flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
          canSend
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`,
        title: canSend ? 'Send message' : disabled ? 'Sending...' : 'Type a message to send'
      },
        React.createElement(SendIcon)
      )
    ),

    // Hint text
    React.createElement('p', {
      className: 'text-xs text-gray-600 mt-2 pl-1'
    }, 'Press Enter to send, Shift+Enter for new line')
  );
}

export default ChatInput;
