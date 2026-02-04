// ChatHeader - Thread title and mode toggle
// WP-6: Transformed to Q palette brandkit styling
import React, { useState, useCallback } from 'react';
import { ModeToggle } from './ModeToggle.js';

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
      // Alignment emoji (Guardian mode only)
      thread.mode === 'guardian' && React.createElement('span', {
        className: 'text-lg',
        title: `Alignment: ${assignment.alignmentStatus || 'aligned'}`
      }, assignment.alignmentStatus === 'misaligned' ? '🔴' :
         assignment.alignmentStatus === 'uncertain' ? '🟠' : '🟢'),
      // Status badge (ALL modes) - Q palette
      React.createElement('span', {
        className: 'text-xs px-1.5 py-0.5',
        style: assignment.status === 'blocked'
          ? {
              backgroundColor: 'rgba(196, 56, 24, 0.2)',
              color: 'var(--q-lava1)',
              borderRadius: 0
            }
          : assignment.status === 'active'
            ? {
                backgroundColor: 'rgba(60, 116, 32, 0.2)',
                color: 'var(--q-slime1)',
                borderRadius: 0
              }
            : {
                backgroundColor: 'rgba(80, 76, 64, 0.2)',
                color: 'var(--q-iron1)',
                borderRadius: 0
              }
      }, assignment.status),
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
