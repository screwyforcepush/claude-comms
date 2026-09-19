// MessageBubble - Individual message display
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useConvex } from '../../hooks/useConvex.js';
import { usePassword } from '../auth/PasswordContext.js';
import {
  deriveSiteUrl,
  fetchAttachmentBlob,
  formatBytes,
  isImageMime,
} from './attachmentUtils.js';

const previewUrlCache = new Map();

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
 * Parse hint string into individual hint segments with style info.
 * Extracts "Context Pressure: Nk" and color-codes by threshold.
 * Remaining text becomes a default-styled hint.
 */
const PRESSURE_RE = /Context Pressure: (\d+)k/;

function parseHints(hintString) {
  if (!hintString) return [];
  const hints = [];
  const match = hintString.match(PRESSURE_RE);
  if (match) {
    const k = parseInt(match[1], 10);
    let colorStyle;
    if (k < 80) {
      colorStyle = { color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.08)', borderLeft: '2px solid #4ade80' };
    } else if (k <= 120) {
      colorStyle = { color: 'var(--q-torch)', backgroundColor: 'rgba(212, 160, 48, 0.08)', borderLeft: '2px solid var(--q-torch)' };
    } else {
      colorStyle = { color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.08)', borderLeft: '2px solid #f87171' };
    }
    hints.push({ text: match[0], style: colorStyle });
    const remainder = hintString.replace(PRESSURE_RE, '').trim();
    if (remainder) {
      hints.push({ text: remainder, style: { color: 'var(--q-torch)', backgroundColor: 'rgba(212, 160, 48, 0.08)', borderLeft: '2px solid var(--q-torch)' } });
    }
  } else {
    hints.push({ text: hintString, style: { color: 'var(--q-torch)', backgroundColor: 'rgba(212, 160, 48, 0.08)', borderLeft: '2px solid var(--q-torch)' } });
  }
  return hints;
}

/**
 * Copy-to-clipboard button with copied feedback
 */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  const iconColor = copied ? 'var(--q-slime)' : 'var(--q-bone0)';

  return React.createElement('button', {
    onClick: handleCopy,
    'aria-label': copied ? 'Copied' : 'Copy message',
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      minWidth: '32px',
      minHeight: '32px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'color 0.15s ease',
    }
  },
    React.createElement('svg', {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: iconColor,
      strokeWidth: 2,
    },
      copied
        ? React.createElement('path', { d: 'M5 13l4 4L19 7', strokeLinecap: 'square' })
        : [
            React.createElement('rect', { key: 'back', x: 8, y: 8, width: 13, height: 13, stroke: iconColor, strokeWidth: 2, fill: 'none' }),
            React.createElement('path', { key: 'front', d: 'M16 8V3H3v13h5', stroke: iconColor, strokeWidth: 2, fill: 'none' }),
          ]
    )
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

function previewCacheKey(siteUrl, attachment) {
  return `${siteUrl || ''}:${attachment.storageId}:${attachment.filename || ''}`;
}

function cachedPreviewUrl({ siteUrl, password, attachment }) {
  const key = previewCacheKey(siteUrl, attachment);
  if (!previewUrlCache.has(key)) {
    const promise = fetchAttachmentBlob({
      siteUrl,
      password,
      storageId: attachment.storageId,
      filename: attachment.filename,
    })
      .then((blob) => URL.createObjectURL(blob))
      .catch((err) => {
        previewUrlCache.delete(key);
        throw err;
      });
    previewUrlCache.set(key, promise);
  }
  return previewUrlCache.get(key);
}

function clickEphemeralDownload(blobUrl, filename) {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename || 'attachment';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function AttachmentPreview({ attachment, siteUrl, password }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImageMime(attachment.mime) || !siteUrl || !password || !attachment.storageId) {
      setPreviewUrl(null);
      setFailed(false);
      return undefined;
    }

    let cancelled = false;
    setFailed(false);
    cachedPreviewUrl({ siteUrl, password, attachment })
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.storageId, attachment.filename, attachment.mime, siteUrl, password]);

  if (!isImageMime(attachment.mime)) return null;
  if (failed) {
    return React.createElement('div', {
      className: 'chat-attachment-preview-unavailable'
    }, 'preview unavailable');
  }
  if (!previewUrl) {
    return React.createElement('div', {
      className: 'chat-attachment-preview-loading',
      'aria-label': `Loading preview for ${attachment.filename}`
    });
  }

  return React.createElement('img', {
    className: 'chat-attachment-preview-image',
    src: previewUrl,
    alt: attachment.filename || 'attachment preview',
    loading: 'lazy'
  });
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
  const { url: convexUrl } = useConvex();
  const password = usePassword();
  const siteUrl = deriveSiteUrl(convexUrl);
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const hasMarkdown = !!message.content?.trim();
  const [attachmentErrors, setAttachmentErrors] = useState({});

  // Memoize markdown parsing per message content
  const markdownHtml = useMemo(
    () => hasMarkdown ? renderMarkdown(message.content) : { __html: '' },
    [message.content, hasMarkdown]
  );

  const handleDownloadAttachment = useCallback((attachment) => {
    if (!siteUrl || !password || !attachment.storageId) {
      setAttachmentErrors((previous) => ({
        ...previous,
        [attachment.storageId || attachment.filename]: 'unavailable',
      }));
      return;
    }

    fetchAttachmentBlob({
      siteUrl,
      password,
      storageId: attachment.storageId,
      filename: attachment.filename,
    })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        clickEphemeralDownload(blobUrl, attachment.filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);
      })
      .catch((err) => {
        console.error('Failed to download attachment:', err);
        setAttachmentErrors((previous) => ({
          ...previous,
          [attachment.storageId]: 'unavailable',
        }));
      });
  }, [siteUrl, password]);

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
          hasMarkdown && React.createElement('div', {
            className: `markdown-content ${config.isRight ? 'markdown-user' : ''} text-sm leading-relaxed break-words`,
            style: { fontFamily: 'var(--font-body)' },
            dangerouslySetInnerHTML: markdownHtml
          }),
          attachments.length > 0 && React.createElement('div', {
            className: `chat-attachment-chip-list ${hasMarkdown ? 'chat-attachment-chip-list--after-markdown' : ''}`
          },
            attachments.map((attachment, index) => {
              const errorKey = attachment.storageId || attachment.filename || `attachment-${index}`;
              const unavailable = attachmentErrors[errorKey];
              return React.createElement('div', {
                key: errorKey,
                className: 'chat-attachment-message-item'
              },
                React.createElement('button', {
                  type: 'button',
                  className: `chat-attachment-chip ${unavailable ? 'chat-attachment-chip--error' : ''}`,
                  onClick: () => handleDownloadAttachment(attachment),
                  disabled: !siteUrl || !password || !attachment.storageId || !!unavailable,
                  title: unavailable
                    ? 'Attachment unavailable'
                    : 'Download attachment',
                  'aria-label': unavailable
                    ? `${attachment.filename || 'Attachment'} unavailable`
                    : `Download ${attachment.filename || 'attachment'}`
                },
                  React.createElement('span', {
                    className: 'chat-attachment-chip-name',
                    title: attachment.filename
                  }, attachment.filename || 'attachment'),
                  React.createElement('span', {
                    className: 'chat-attachment-chip-meta'
                  }, formatBytes(attachment.size))
                ),
                React.createElement(AttachmentPreview, {
                  attachment,
                  siteUrl,
                  password
                })
              );
            })
          )
        ),

        // Hint bars — system annotations beneath bubble, color-coded
        message.hint && parseHints(message.hint).map((hint, i) =>
          React.createElement('div', {
            key: `hint-${i}`,
            className: 'message-hint flex items-center gap-1.5 mt-1 px-2 py-1',
            style: {
              fontSize: '11px',
              fontFamily: 'var(--font-console)',
              letterSpacing: '0.3px',
              lineHeight: '1.4',
              ...hint.style,
            }
          },
            React.createElement('span', null, hint.text)
          )
        ),

        // Timestamp + copy button row
        React.createElement('div', {
          className: 'flex items-center gap-1 mt-1',
          style: { flexDirection: config.isRight ? 'row-reverse' : 'row' }
        },
          message.createdAt && React.createElement('span', {
            className: 'text-xs px-1',
            style: { color: 'var(--q-bone0)' }
          }, formatTime(message.createdAt)),
          React.createElement(CopyButton, { text: message.content || '' })
        )
      )
    )
  );
}

export default MessageBubble;
