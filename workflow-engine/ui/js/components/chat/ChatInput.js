// ChatInput - Message input with send button
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { QIcon } from '../shared/index.js';

// localStorage keys
const CHAT_INPUT_COLLAPSED_KEY = 'workflow-engine:chat-input-collapsed';
const CHAT_INPUT_ENTER_SAFE_KEY = 'workflow-engine:chat-input-enter-safe';

function getInitialInputCollapsed() {
  try {
    return localStorage.getItem(CHAT_INPUT_COLLAPSED_KEY) === 'true';
  } catch {
    return false; // Default: expanded (full height)
  }
}

function getInitialEnterSafe() {
  try {
    const stored = localStorage.getItem(CHAT_INPUT_ENTER_SAFE_KEY);
    return stored !== 'false'; // Default: true (safe mode on)
  } catch {
    return true;
  }
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
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialInputCollapsed);
  const [enterSafe, setEnterSafe] = useState(getInitialEnterSafe);
  const [showToggle, setShowToggle] = useState(false);
  const textareaRef = useRef(null);

  const COLLAPSED_MAX = 150;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const naturalHeight = textarea.scrollHeight;
      const maxH = isCollapsed ? COLLAPSED_MAX : window.innerHeight * 0.7;
      textarea.style.height = `${Math.min(naturalHeight, maxH)}px`;
      setShowToggle(naturalHeight > COLLAPSED_MAX);
    }
  }, [message, isCollapsed]);

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
    if (e.key === 'Enter') {
      // Option+Enter on Mac: manually insert newline (macOS doesn't do this natively)
      if (e.altKey) {
        e.preventDefault();
        const ta = textareaRef.current;
        if (ta) {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const val = ta.value;
          const newVal = val.substring(0, start) + '\n' + val.substring(end);
          setMessage(newVal);
          // Set cursor position after the inserted newline on next tick
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 1;
          });
        }
        return;
      }

      if (enterSafe) {
        // Safety ON: Enter = newline (natural), Cmd+Enter = send
        if (e.metaKey) {
          e.preventDefault();
          handleSubmit();
        }
        // Plain Enter / Shift+Enter: let browser insert newline naturally
      } else {
        // Safety OFF: Enter = send, Shift+Enter = newline
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      }
    }
  }, [handleSubmit, enterSafe]);

  const handleChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(CHAT_INPUT_COLLAPSED_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  const handleToggleEnterSafe = useCallback(() => {
    setEnterSafe(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(CHAT_INPUT_ENTER_SAFE_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
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
      // Textarea wrapper
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
            maxHeight: isCollapsed ? '150px' : '70vh',
            backgroundColor: 'var(--q-void1)',
            border: `1px solid ${isFocused ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
            borderBottom: `2px solid ${isFocused ? 'var(--q-copper0)' : 'var(--q-void0)'}`,
            borderRadius: 0,
            color: 'var(--q-bone3)',
            fontFamily: 'var(--font-console)',
            boxShadow: isFocused ? '0 0 12px var(--q-copper1-44), inset 0 0 20px var(--q-copper0-15)' : 'none'
          }
        }),

        // Collapse/expand toggle - only visible when content exceeds collapsed height
        showToggle && React.createElement('button', {
          type: 'button',
          onClick: handleToggleCollapse,
          className: 'chat-input-collapse-toggle',
          style: {
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--q-stone1)',
            border: '1px solid var(--q-stone3)',
            borderRadius: 0,
            color: 'var(--q-bone0)',
            cursor: 'pointer',
            padding: 0,
            zIndex: 1
          },
          title: isCollapsed ? 'Expand input' : 'Collapse input'
        },
          React.createElement('svg', {
            width: 12,
            height: 12,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2.5',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            style: {
              transition: 'transform 200ms ease'
            }
          },
            // Double chevron: up when collapsed (expand), down when expanded (collapse)
            React.createElement('path', {
              d: isCollapsed
                ? 'M7 14l5-5 5 5M7 19l5-5 5 5'
                : 'M7 10l5 5 5-5M7 5l5 5 5-5'
            })
          )
        )
      ),

      // Send column: safety toggle + send button
      React.createElement('div', {
        className: 'flex-shrink-0 flex flex-col items-center gap-1'
      },
        // Enter safety toggle
        React.createElement('button', {
          type: 'button',
          onClick: handleToggleEnterSafe,
          className: 'chat-input-safety-toggle',
          style: {
            width: '48px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: enterSafe ? 'rgba(122, 78, 40, 0.25)' : 'var(--q-stone2)',
            border: `1px solid ${enterSafe ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
            borderRadius: 0,
            color: enterSafe ? 'var(--q-copper2)' : 'var(--q-bone0)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 150ms ease'
          },
          title: enterSafe
            ? 'Safe mode ON: Enter = new line, Cmd+Enter = send. Click to toggle.'
            : 'Safe mode OFF: Enter = send, Shift+Enter = new line. Click to toggle.'
        },
          // Return key icon (⏎)
          React.createElement('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2.5',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          },
            React.createElement('path', {
              d: 'M9 17l-5-5 5-5'
            }),
            React.createElement('path', {
              d: 'M20 7v4a2 2 0 01-2 2H4'
            })
          )
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
      )
    )
  );
}

export default ChatInput;
