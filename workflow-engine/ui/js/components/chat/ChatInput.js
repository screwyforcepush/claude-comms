// ChatInput - Message input with send button
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { QIcon } from '../shared/index.js';

/**
 * ChatInput component - Text input with send button
 * @param {Object} props
 * @param {Function} props.onSend - Callback when message is sent
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.placeholder - Placeholder text
 */
export function ChatInput({ onSend, disabled = false, placeholder = 'Type a message...' }) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
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

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const canSend = message.trim().length > 0 && !disabled;

  return React.createElement('form', {
    onSubmit: handleSubmit,
    className: 'chat-input-container border-t p-4',
    style: {
      backgroundColor: 'var(--q-stone1)',
      borderColor: 'var(--q-stone3)'
    }
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
          onFocus: handleFocus,
          onBlur: handleBlur,
          placeholder: placeholder,
          disabled: disabled,
          rows: 1,
          className: `w-full resize-none px-4 py-3 focus:outline-none transition-all ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`,
          style: {
            minHeight: '48px',
            maxHeight: '150px',
            backgroundColor: 'var(--q-void1)',
            border: `1px solid ${isFocused ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
            borderBottom: `2px solid ${isFocused ? 'var(--q-copper0)' : 'var(--q-void0)'}`,
            borderRadius: 0,
            color: 'var(--q-bone3)',
            fontFamily: 'var(--font-console)',
            boxShadow: isFocused ? '0 0 12px var(--q-copper1-44), inset 0 0 20px var(--q-copper0-15)' : 'none'
          }
        })
      ),

      // Send button
      React.createElement('button', {
        type: 'submit',
        disabled: !canSend,
        className: 'flex-shrink-0 w-12 h-12 flex items-center justify-center transition-all',
        style: {
          background: canSend
            ? 'linear-gradient(180deg, var(--q-copper1), var(--q-copper0))'
            : 'var(--q-stone2)',
          border: `1px solid ${canSend ? 'var(--q-copper2)' : 'var(--q-stone3)'}`,
          borderBottom: `2px solid ${canSend ? 'var(--q-void0)' : 'var(--q-void0)'}`,
          borderRadius: 0,
          color: canSend ? 'var(--q-void0)' : 'var(--q-bone0)',
          cursor: canSend ? 'pointer' : 'not-allowed'
        },
        title: canSend ? 'Send message' : disabled ? 'Sending...' : 'Type a message to send'
      },
        React.createElement(QIcon, {
          name: 'dispatch',
          size: 20,
          color: 'currentColor'
        })
      )
    ),

    // Hint text
    React.createElement('p', {
      className: 'text-xs mt-2 pl-1',
      style: {
        color: 'var(--q-bone0)'
      }
    }, 'Press Enter to send, Shift+Enter for new line')
  );
}

export default ChatInput;
