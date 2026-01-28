// JobDetail - Expanded job view with modal support (D3)
import React, { useEffect, useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';
import { JsonViewer } from '../shared/JsonViewer.js';

/**
 * Close icon
 */
function CloseIcon() {
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
      d: 'M6 18L18 6M6 6l12 12'
    })
  );
}

/**
 * Harness badge component
 */
function HarnessBadge({ harness }) {
  const colors = {
    claude: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    codex: 'bg-green-500/20 text-green-400 border-green-500/30',
    gemini: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };

  return React.createElement('span', {
    className: `text-sm px-3 py-1 rounded-full border ${colors[harness] || 'bg-gray-700 text-gray-400 border-gray-600'}`
  }, harness || 'unknown');
}

/**
 * Job type badge component
 */
function JobTypeBadge({ jobType }) {
  const colors = {
    plan: 'bg-purple-500/20 text-purple-400',
    implement: 'bg-blue-500/20 text-blue-400',
    refine: 'bg-cyan-500/20 text-cyan-400',
    uat: 'bg-green-500/20 text-green-400',
    verify: 'bg-yellow-500/20 text-yellow-400',
    research: 'bg-pink-500/20 text-pink-400'
  };

  return React.createElement('span', {
    className: `text-sm font-medium uppercase px-3 py-1 rounded-full ${colors[jobType] || 'bg-gray-700 text-gray-400'}`
  }, jobType || 'unknown');
}

/**
 * Try to parse content as JSON for better display
 */
function ContentViewer({ content, label, isError = false }) {
  if (!content) return null;

  // Try to parse as JSON
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Not JSON, display as text
  }

  return React.createElement('div', { className: 'space-y-2' },
    React.createElement('h4', {
      className: `text-xs font-semibold uppercase tracking-wide ${isError ? 'text-red-400' : 'text-gray-400'}`
    }, label),
    parsed
      ? React.createElement(JsonViewer, {
          data: parsed,
          collapsed: false,
          maxHeight: 400
        })
      : React.createElement('div', {
          className: `p-4 rounded-lg border overflow-auto max-h-96 ${
            isError
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-gray-800 border-gray-700'
          }`
        },
          React.createElement('pre', {
            className: `text-sm whitespace-pre-wrap ${isError ? 'text-red-300' : 'text-gray-300'}`
          }, content)
        )
  );
}

/**
 * Modal backdrop and container
 */
function Modal({ isOpen, onClose, children }) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 z-50 flex items-center justify-center p-4'
  },
    // Backdrop
    React.createElement('div', {
      className: 'absolute inset-0 bg-black/70 backdrop-blur-sm',
      onClick: onClose
    }),
    // Modal content
    React.createElement('div', {
      className: 'relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col'
    }, children)
  );
}

/**
 * JobDetail component - expanded job view with full details
 * D3: Inline expansion with modal option for large content
 * @param {Object} props
 * @param {Object} props.job - Job data
 * @param {Function} props.onClose - Callback to close the modal
 * @param {boolean} props.isModal - Whether displaying as modal (default true)
 */
export function JobDetail({ job, onClose, isModal = true }) {
  const {
    _id,
    assignmentId,
    jobType,
    harness,
    context,
    status,
    result,
    nextJobId,
    startedAt,
    completedAt,
    createdAt
  } = job;

  const shortId = _id ? _id.slice(-12) : 'unknown';
  const shortAssignmentId = assignmentId ? assignmentId.slice(-8) : 'unknown';
  const shortNextJobId = nextJobId ? nextJobId.slice(-8) : null;

  // Calculate duration
  const duration = React.useMemo(() => {
    if (!startedAt) return null;
    const endTime = completedAt || Date.now();
    const durationMs = endTime - startedAt;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    if (durationMs < 3600000) return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    return `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`;
  }, [startedAt, completedAt]);

  const content = React.createElement(React.Fragment, null,
    // Header
    React.createElement('div', {
      className: 'flex items-center justify-between p-4 border-b border-gray-700'
    },
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement(JobTypeBadge, { jobType }),
        React.createElement(HarnessBadge, { harness }),
        React.createElement(StatusBadge, { status, size: 'md' })
      ),
      React.createElement('div', { className: 'flex items-center gap-4' },
        React.createElement('code', {
          className: 'text-sm text-gray-500 font-mono'
        }, shortId),
        isModal && React.createElement('button', {
          onClick: onClose,
          className: 'p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors'
        },
          React.createElement(CloseIcon)
        )
      )
    ),

    // Body (scrollable)
    React.createElement('div', {
      className: 'flex-1 overflow-y-auto p-4 space-y-6'
    },
      // Metadata
      React.createElement('div', {
        className: 'grid grid-cols-2 md:grid-cols-4 gap-4'
      },
        React.createElement('div', null,
          React.createElement('p', { className: 'text-xs text-gray-500 uppercase' }, 'Assignment'),
          React.createElement('code', { className: 'text-sm text-gray-300 font-mono' }, shortAssignmentId)
        ),
        shortNextJobId && React.createElement('div', null,
          React.createElement('p', { className: 'text-xs text-gray-500 uppercase' }, 'Next Job'),
          React.createElement('code', { className: 'text-sm text-gray-300 font-mono' }, shortNextJobId)
        ),
        duration && React.createElement('div', null,
          React.createElement('p', { className: 'text-xs text-gray-500 uppercase' }, 'Duration'),
          React.createElement('p', { className: 'text-sm text-gray-300' }, duration)
        ),
        React.createElement('div', null,
          React.createElement('p', { className: 'text-xs text-gray-500 uppercase' }, 'Status'),
          React.createElement(StatusBadge, { status, size: 'sm' })
        )
      ),

      // Context/Instructions
      React.createElement(ContentViewer, {
        content: context,
        label: 'Context / Instructions'
      }),

      // Result or Error
      (status === 'complete' || status === 'failed') && React.createElement(ContentViewer, {
        content: result,
        label: status === 'failed' ? 'Error Details' : 'Result',
        isError: status === 'failed'
      })
    ),

    // Footer with timestamps
    React.createElement('div', {
      className: 'p-4 border-t border-gray-700 bg-gray-850'
    },
      React.createElement('div', {
        className: 'flex items-center gap-6 text-xs text-gray-500'
      },
        createdAt && React.createElement('div', null,
          React.createElement('span', { className: 'text-gray-600' }, 'Created: '),
          React.createElement(Timestamp, { date: createdAt, format: 'both' })
        ),
        startedAt && React.createElement('div', null,
          React.createElement('span', { className: 'text-gray-600' }, 'Started: '),
          React.createElement(Timestamp, { date: startedAt, format: 'both' })
        ),
        completedAt && React.createElement('div', null,
          React.createElement('span', { className: 'text-gray-600' }, 'Completed: '),
          React.createElement(Timestamp, { date: completedAt, format: 'both' })
        )
      )
    )
  );

  // Wrap in modal if isModal is true
  if (isModal) {
    return React.createElement(Modal, {
      isOpen: true,
      onClose
    }, content);
  }

  // Inline display
  return React.createElement('div', {
    className: 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden'
  }, content);
}

export default JobDetail;
