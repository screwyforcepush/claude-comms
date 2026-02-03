// ChatHeader - Thread title and mode toggle
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
      className: 'chat-header flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900'
    },
      React.createElement('span', { className: 'text-gray-500' }, 'Select a conversation')
    );
  }

  return React.createElement('div', {
    className: 'chat-header flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900'
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
              className: 'flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-lg font-semibold focus:outline-none focus:border-blue-500',
              placeholder: 'Chat title...'
            }),
            React.createElement('button', {
              type: 'button',
              onClick: saveTitle,
              className: 'p-1.5 text-green-400 hover:text-green-300 hover:bg-gray-800 rounded transition-colors',
              title: 'Save'
            }, React.createElement(CheckIcon)),
            React.createElement('button', {
              type: 'button',
              onClick: cancelEditing,
              className: 'p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors',
              title: 'Cancel'
            }, React.createElement(XIcon))
          )
        : React.createElement('div', { className: 'flex items-center gap-2 min-w-0' },
            React.createElement('h2', {
              className: 'text-lg font-semibold text-white truncate'
            }, thread.title || 'New Chat'),
            !disabled && React.createElement('button', {
              type: 'button',
              onClick: startEditing,
              className: 'p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors flex-shrink-0',
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
      // Status badge (ALL modes)
      React.createElement('span', {
        className: `text-xs px-1.5 py-0.5 rounded ${
          assignment.status === 'blocked'
            ? 'bg-red-500/20 text-red-400'
            : assignment.status === 'active'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
        }`
      }, assignment.status),
      // WP-3: Details toggle button (visible when assignment exists)
      onTogglePane && React.createElement('button', {
        type: 'button',
        ref: toggleButtonRef,
        onClick: onTogglePane,
        className: `p-1.5 rounded transition-colors ${
          paneOpen
            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
        }`,
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
