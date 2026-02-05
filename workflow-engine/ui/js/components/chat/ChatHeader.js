// ChatHeader - Thread title and mode toggle
// WP-6: Transformed to Q palette brandkit styling
// WP-PHASE2: StatusRune integration for assignment status indicators
import React, { useState, useCallback } from 'react';
import { ModeToggle } from './ModeToggle.js';

/**
 * Fullbright indicator - radial gradient dot with glow effect
 * Follows brandkit.jsx pattern (lines 442-450)
 * @param {Object} props
 * @param {string} props.color - CSS color value
 * @param {boolean} props.pulse - Enable pulse animation
 * @param {number} props.size - Dot size in pixels
 */
function Fullbright({ color, pulse = false, size = 5 }) {
  return React.createElement('span', {
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}, ${color}88)`,
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px ${color}88, 0 0 ${size * 2}px ${color}44`,
      animation: pulse ? 'fullbright-pulse 2.5s ease-in-out infinite' : 'none'
    }
  });
}

/**
 * StatusRune component - Brandkit-aligned status indicator
 * Fullbright dot with radial gradient and glow, label in display font
 * Follows brandkit.jsx pattern (lines 615-637)
 * @param {Object} props
 * @param {string} props.status - Status type: 'running' | 'complete' | 'blocked' | 'failed' | 'idle' | 'aligned' | 'misaligned' | 'uncertain'
 * @param {string} props.label - Optional custom label text
 */
function StatusRune({ status, label }) {
  // Status configuration mapped to Q palette
  // running/active = teleport (purple), complete = slime (green), blocked/failed = lava (red)
  const statusConfig = {
    running: { color: 'var(--q-teleport-bright)', label: label || 'RUNNING', pulse: true },
    active: { color: 'var(--q-teleport-bright)', label: label || 'ACTIVE', pulse: true },
    complete: { color: 'var(--q-slime1)', label: label || 'COMPLETE', pulse: false },
    completed: { color: 'var(--q-slime1)', label: label || 'COMPLETE', pulse: false },
    blocked: { color: 'var(--q-lava1)', label: label || 'BLOCKED', pulse: false },
    failed: { color: 'var(--q-lava1)', label: label || 'FAILED', pulse: false },
    idle: { color: 'var(--q-iron1)', label: label || 'IDLE', pulse: false },
    pending: { color: 'var(--q-copper1)', label: label || 'PENDING', pulse: false },
    // Alignment statuses (Guardian mode)
    aligned: { color: 'var(--q-slime1)', label: label || 'ALIGNED', pulse: false },
    misaligned: { color: 'var(--q-lava1)', label: label || 'MISALIGNED', pulse: true },
    uncertain: { color: 'var(--q-torch)', label: label || 'UNCERTAIN', pulse: false }
  };

  const config = statusConfig[status] || statusConfig.idle;

  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--t-type-size-badge)',
      letterSpacing: 'var(--t-type-tracking-normal)',
      color: config.color,
      background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${config.color} 33%, transparent)`,
      padding: '3px 8px',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      borderRadius: 0
    }
  },
    React.createElement(Fullbright, { color: config.color, pulse: config.pulse, size: 5 }),
    config.label
  );
}

/**
 * Edit icon
 */
function EditIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    })
  );
}

/**
 * Check icon
 */
function CheckIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M5 13l4 4L19 7'
    })
  );
}

/**
 * Cancel icon
 */
function XIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M6 18L18 6M6 6l12 12'
    })
  );
}

/**
 * Details panel icon (info/document icon)
 */
function DetailsIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    })
  );
}

/**
 * ChatHeader component - Title (editable) and mode toggle
 * @param {Object} props
 * @param {Object} props.thread - Thread object
 * @param {Object} props.assignment - Linked assignment (for guardian mode)
 * @param {Function} props.onUpdateTitle - Callback when title is updated
 * @param {Function} props.onUpdateMode - Callback when mode is changed
 * @param {Function} props.onTogglePane - Callback to toggle assignment pane (WP-3)
 * @param {boolean} props.paneOpen - Whether the pane is currently open (WP-3)
 * @param {Object} props.toggleButtonRef - Ref to the toggle button for focus management
 * @param {boolean} props.disabled - Whether controls are disabled
 */
export function ChatHeader({ thread, assignment, onUpdateTitle, onUpdateMode, onTogglePane, paneOpen = false, toggleButtonRef, disabled = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = useCallback(() => {
    setEditTitle(thread?.title || 'New Chat');
    setIsEditing(true);
  }, [thread?.title]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditTitle('');
  }, []);

  const saveTitle = useCallback(() => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== thread?.title && onUpdateTitle) {
      onUpdateTitle(trimmedTitle);
    }
    setIsEditing(false);
    setEditTitle('');
  }, [editTitle, thread?.title, onUpdateTitle]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }, [saveTitle, cancelEditing]);

  const handleModeChange = useCallback((mode) => {
    if (onUpdateMode) {
      onUpdateMode(mode);
    }
  }, [onUpdateMode]);

  if (!thread) {
    return React.createElement('div', {
      className: 'chat-header flex items-center justify-between px-4 py-3',
      style: {
        backgroundColor: 'var(--q-stone1)',
        borderBottom: '1px solid var(--q-stone3)'
      }
    },
      React.createElement('span', {
        style: { color: 'var(--q-bone0)' }
      }, 'Select a conversation')
    );
  }

  return React.createElement('div', {
    className: 'chat-header flex items-center justify-between px-4 py-3',
    style: {
      backgroundColor: 'var(--q-stone1)',
      borderBottom: '1px solid var(--q-stone3)'
    }
  },
    // Title section
    React.createElement('div', { className: 'flex items-center gap-2 min-w-0 flex-1' },
      isEditing
        ? React.createElement('div', { className: 'flex items-center gap-2 flex-1' },
            React.createElement('input', {
              type: 'text',
              value: editTitle,
              onChange: (e) => setEditTitle(e.target.value),
              onKeyDown: handleKeyDown,
              autoFocus: true,
              className: 'flex-1 px-2 py-1 text-lg focus:outline-none',
              style: {
                backgroundColor: 'var(--q-void1)',
                border: '1px solid var(--q-stone3)',
                borderRadius: 0,
                color: 'var(--q-bone3)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '2px'
              },
              placeholder: 'Chat title...'
            }),
            React.createElement('button', {
              type: 'button',
              onClick: saveTitle,
              className: 'chat-header-save-btn p-1.5 transition-colors',
              style: {
                color: 'var(--q-slime1)',
                borderRadius: 0
              },
              title: 'Save'
            }, React.createElement(CheckIcon)),
            React.createElement('button', {
              type: 'button',
              onClick: cancelEditing,
              className: 'chat-header-cancel-btn p-1.5 transition-colors',
              style: {
                color: 'var(--q-bone0)',
                borderRadius: 0
              },
              title: 'Cancel'
            }, React.createElement(XIcon))
          )
        : React.createElement('div', { className: 'flex items-center gap-2 min-w-0' },
            React.createElement('h2', {
              className: 'text-lg truncate',
              style: {
                fontFamily: 'var(--font-display)',
                color: 'var(--q-bone3)',
                letterSpacing: '2px'
              }
            }, thread.title || 'New Chat'),
            !disabled && React.createElement('button', {
              type: 'button',
              onClick: startEditing,
              className: 'chat-header-edit-btn p-1 transition-colors flex-shrink-0',
              style: {
                color: 'var(--q-bone0)',
                borderRadius: 0
              },
              title: 'Edit title'
            }, React.createElement(EditIcon))
          )
    ),

    // Assignment status (ALL modes when assignment exists)
    assignment && React.createElement('div', {
      className: 'flex items-center gap-2 mr-4'
    },
      // Alignment StatusRune (Guardian mode only) - replaces emoji indicator
      thread.mode === 'guardian' && React.createElement(StatusRune, {
        status: assignment.alignmentStatus || 'aligned',
        label: (assignment.alignmentStatus || 'aligned').toUpperCase()
      }),
      // Status StatusRune (ALL modes) - replaces plain text badge
      // Maps assignment status to StatusRune: active->running (teleport), blocked->blocked (lava), completed->complete (slime)
      React.createElement(StatusRune, {
        status: assignment.status === 'active' ? 'running' :
                assignment.status === 'blocked' ? 'blocked' :
                assignment.status === 'completed' ? 'complete' :
                assignment.status === 'failed' ? 'failed' :
                assignment.status || 'idle'
      }),
      // WP-3: Details toggle button (visible when assignment exists) - Q palette
      onTogglePane && React.createElement('button', {
        type: 'button',
        ref: toggleButtonRef,
        onClick: onTogglePane,
        className: 'chat-header-details-btn p-1.5 transition-colors',
        style: paneOpen
          ? {
              backgroundColor: 'rgba(122, 78, 40, 0.2)',
              color: 'var(--q-copper2)',
              borderRadius: 0
            }
          : {
              color: 'var(--q-bone0)',
              borderRadius: 0
            },
        'aria-expanded': paneOpen,
        'aria-controls': 'assignment-pane',
        title: paneOpen ? 'Hide assignment details' : 'Show assignment details'
      }, React.createElement(DetailsIcon))
    ),

    // Mode toggle
    React.createElement('div', { className: 'flex-shrink-0 ml-4' },
      React.createElement(ModeToggle, {
        mode: thread.mode || 'jam',
        onChange: handleModeChange,
        disabled: disabled,
        hasAssignment: !!thread.assignmentId || !!assignment
      })
    )
  );
}

export default ChatHeader;
