// ChatInput - Message input with send button
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { QIcon } from '../shared/index.js';
import { formatBytes } from './attachmentUtils.js';

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

function dataTransferHasFiles(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes('Files');
}

function extensionForMime(mime) {
  switch ((mime || '').toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    case 'image/bmp': return 'bmp';
    default: return 'bin';
  }
}

function namePastedFile(file, timestamp, index) {
  if (file.name) return file;
  const suffix = index > 0 ? `-${index + 1}` : '';
  const filename = `pasted-${timestamp}${suffix}.${extensionForMime(file.type)}`;
  try {
    return new File([file], filename, {
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  }
}

/**
 * ChatInput component - Text input with send button
 * Supports both controlled (draftText/onDraftChange) and uncontrolled modes.
 * When draftText is provided, operates as a controlled component for draft persistence.
 * @param {Object} props
 * @param {Function} props.onSend - Callback when message is sent
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.placeholder - Placeholder text
 * @param {string} [props.draftText] - Controlled draft value (optional, WP-6)
 * @param {Function} [props.onDraftChange] - Draft change callback (optional, WP-6)
 * @param {Function} [props.onSendToFork] - Callback to send message into a new forked thread
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  draftText,
  onDraftChange,
  pendingAttachments = [],
  onAddFiles,
  onRemoveAttachment,
  onStop,
  stopPending = false,
  onSendToFork
}) {
  const [internalMessage, setInternalMessage] = useState('');

  // Use controlled value if provided, otherwise internal state
  const message = draftText !== undefined ? draftText : internalMessage;
  const attachments = Array.isArray(pendingAttachments) ? pendingAttachments : [];
  const hasUploading = attachments.some((attachment) => attachment.status === 'uploading');
  const readyAttachmentCount = attachments.filter((attachment) =>
    attachment.status === 'ready' && attachment.storageId
  ).length;
  const hasSendableText = message.trim().length > 0;
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialInputCollapsed);
  const [enterSafe, setEnterSafe] = useState(getInitialEnterSafe);
  const [showToggle, setShowToggle] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

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
  }, [message, isCollapsed]); // message is derived from draftText or internalMessage

  useEffect(() => {
    if (!disabled) return;
    dragDepthRef.current = 0;
    setDropActive(false);
  }, [disabled]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const trimmedMessage = message.trim();
    const content = trimmedMessage.length > 0 ? trimmedMessage : '';
    if ((trimmedMessage || readyAttachmentCount > 0) && !disabled && !hasUploading && onSend) {
      onSend(content);
      if (!onDraftChange) setInternalMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, readyAttachmentCount, disabled, hasUploading, onSend, onDraftChange]);

  // Send the message into a new forked thread instead of this one
  const handleForkSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    const content = trimmedMessage.length > 0 ? trimmedMessage : '';
    if ((trimmedMessage || readyAttachmentCount > 0) && !disabled && !hasUploading && onSendToFork) {
      onSendToFork(content);
      if (!onDraftChange) setInternalMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, readyAttachmentCount, disabled, hasUploading, onSendToFork, onDraftChange]);

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
          if (onDraftChange) {
            onDraftChange(newVal);
          } else {
            setInternalMessage(newVal);
          }
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
    const newValue = e.target.value;
    if (onDraftChange) {
      onDraftChange(newValue);
    } else {
      setInternalMessage(newValue);
    }
  }, [onDraftChange]);

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e) => {
    if (!disabled && onAddFiles && e.target.files?.length) {
      onAddFiles(e.target.files);
    }
    e.target.value = '';
  }, [disabled, onAddFiles]);

  const handlePaste = useCallback((e) => {
    if (disabled || !onAddFiles) return;
    const items = Array.from(e.clipboardData?.items || []);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .map((file, index) => namePastedFile(file, timestamp, index));

    if (files.length > 0) {
      e.preventDefault();
      onAddFiles(files);
    }
  }, [disabled, onAddFiles]);

  const handleDragEnter = useCallback((e) => {
    if (disabled || !dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDropActive(true);
  }, [disabled]);

  const handleDragOver = useCallback((e) => {
    if (disabled || !dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    if (dataTransferHasFiles(e.dataTransfer)) e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDropActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    if (disabled || !dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    if (onAddFiles && e.dataTransfer.files?.length) {
      onAddFiles(e.dataTransfer.files);
    }
  }, [disabled, onAddFiles]);

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

  const canSend = (hasSendableText || readyAttachmentCount > 0) && !disabled && !hasUploading;
  const disabledReason = hasUploading
    ? 'Waiting for uploads...'
    : disabled
      ? 'Quartermaster is busy...'
      : '';

  return React.createElement('form', {
    onSubmit: handleSubmit,
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    className: `chat-input-container border-t p-4 ${dropActive ? 'chat-input-container--drop-active' : ''}`,
    style: {
      backgroundColor: 'var(--q-stone1)',
      borderColor: 'var(--q-stone3)',
      position: 'relative'
    }
  },
    React.createElement('input', {
      ref: fileInputRef,
      type: 'file',
      multiple: true,
      onChange: handleFileInputChange,
      className: 'sr-only',
      tabIndex: -1
    }),

    attachments.length > 0 && React.createElement('div', {
      className: 'chat-attachment-pending-list',
      'aria-label': 'Pending attachments'
    },
      attachments.map((attachment) => {
        const stateText = attachment.status === 'uploading'
          ? 'uploading...'
          : attachment.status === 'error'
            ? `error: ${attachment.error || 'upload failed'}`
            : 'ready';
        return React.createElement('div', {
          key: attachment.id,
          className: `chat-attachment-pending-row chat-attachment-pending-row--${attachment.status}`
        },
          React.createElement('div', {
            className: 'chat-attachment-pending-main'
          },
            React.createElement('span', {
              className: 'chat-attachment-pending-name',
              title: attachment.filename
            }, attachment.filename),
            React.createElement('span', {
              className: 'chat-attachment-pending-meta'
            }, formatBytes(attachment.size)),
            React.createElement('span', {
              className: `chat-attachment-state chat-attachment-state--${attachment.status}`,
              'aria-live': attachment.status === 'uploading' ? 'polite' : undefined
            }, stateText)
          ),
          attachment.oversize && React.createElement('div', {
            className: 'chat-attachment-warning',
            title: 'Over 20 MB'
          },
            React.createElement(QIcon, { name: 'warning', size: 14, color: 'currentColor' }),
            React.createElement('span', null, "over 20 MB - the agent can't fetch this")
          ),
          React.createElement('button', {
            type: 'button',
            onClick: () => onRemoveAttachment?.(attachment.id),
            className: 'chat-attachment-remove',
            'aria-label': `Remove ${attachment.filename}`,
            title: `Remove ${attachment.filename}`,
            disabled: !onRemoveAttachment
          },
            React.createElement(QIcon, { name: 'close', size: 14, color: 'currentColor' })
          )
        );
      })
    ),

    dropActive && React.createElement('div', {
      className: 'chat-attachment-drop-overlay',
      'aria-hidden': 'true'
    }, 'Drop files to attach'),

    React.createElement('div', {
      className: 'flex items-end gap-3'
    },
      React.createElement('button', {
        type: 'button',
        onClick: handlePickFiles,
        disabled: disabled || !onAddFiles,
        className: 'chat-attachment-add-button',
        title: disabled ? 'Wait for the current send to finish' : 'Attach files',
        'aria-label': 'Attach files'
      },
        React.createElement(QIcon, { name: 'add', size: 18, color: 'currentColor' })
      ),

      // Textarea wrapper
      React.createElement('div', { className: 'flex-1 relative' },
        React.createElement('textarea', {
          ref: textareaRef,
          value: message,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          onPaste: handlePaste,
          onFocus: handleFocus,
          onBlur: handleBlur,
          placeholder: placeholder,
          disabled: false,
          rows: 1,
          className: 'w-full resize-none px-4 py-3 focus:outline-none transition-all',
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

        // Send-to-fork: branch this message into a new jam thread
        onSendToFork && React.createElement('button', {
          type: 'button',
          onClick: handleForkSubmit,
          disabled: !canSend,
          className: 'chat-input-fork-button',
          style: {
            width: '48px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canSend ? 'rgba(92, 60, 124, 0.25)' : 'var(--q-stone2)',
            border: `1px solid ${canSend ? 'var(--q-teleport)' : 'var(--q-stone3)'}`,
            borderRadius: 0,
            color: canSend ? 'var(--q-teleport)' : 'var(--q-bone0)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            padding: 0,
            transition: 'all 150ms ease'
          },
          title: canSend
            ? 'Send to fork: branch this message into a new thread'
            : disabledReason || 'Type a message or attach a file to send to a fork'
        },
          React.createElement(QIcon, {
            name: 'fork',
            size: 14,
            color: 'currentColor'
          })
        ),

        // Send / Stop button
        disabled && onStop
          ? React.createElement('button', {
              type: 'button',
              onClick: onStop,
              disabled: stopPending,
              className: 'flex-shrink-0 w-12 h-12 flex items-center justify-center transition-all',
              style: {
                background: stopPending ? 'var(--q-lava0)' : 'rgba(140, 40, 20, 0.2)',
                border: '1px solid var(--q-lava0)',
                borderBottom: '2px solid var(--q-void0)',
                borderRadius: 0,
                color: stopPending ? 'var(--q-bone3)' : 'var(--q-lava1)',
                cursor: stopPending ? 'default' : 'pointer',
                opacity: stopPending ? 0.7 : 1
              },
              title: stopPending ? 'Stopping...' : 'Stop'
            },
              React.createElement(QIcon, {
                name: 'skull',
                size: 20,
                color: 'currentColor'
              })
            )
          : React.createElement('button', {
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
              title: canSend
                ? 'Send message'
                : disabledReason || 'Type a message or attach a file to send'
            },
              React.createElement(QIcon, {
                name: 'dispatch',
                size: 20,
                color: 'currentColor'
              })
            ),
        disabledReason && React.createElement('span', {
          className: 'chat-input-disabled-reason',
          role: 'status'
        }, disabledReason)
      )
    )
  );
}

export default ChatInput;
