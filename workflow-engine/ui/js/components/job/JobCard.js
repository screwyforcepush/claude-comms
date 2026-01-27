// JobCard - Individual job card component
import React, { useState, useCallback, useMemo } from 'react';
import { StatusBadge, StatusDot } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';

/**
 * Harness icon/badge component
 */
function HarnessBadge({ harness }) {
  const colors = {
    claude: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    codex: 'bg-green-500/20 text-green-400 border-green-500/30',
    gemini: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };

  return React.createElement('span', {
    className: `text-xs px-2 py-0.5 rounded-full border ${colors[harness] || 'bg-gray-700 text-gray-400 border-gray-600'}`
  }, harness || 'unknown');
}

/**
 * Job type badge component
 */
function JobTypeBadge({ jobType }) {
  const colors = {
    plan: 'text-purple-400',
    implement: 'text-blue-400',
    refine: 'text-cyan-400',
    uat: 'text-green-400',
    verify: 'text-yellow-400',
    research: 'text-pink-400'
  };

  return React.createElement('span', {
    className: `text-xs font-medium uppercase tracking-wider ${colors[jobType] || 'text-gray-400'}`
  }, jobType || 'unknown');
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Expand icon
 */
function ExpandIcon({ expanded }) {
  return React.createElement('svg', {
    className: `w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M19 9l-7 7-7-7'
    })
  );
}

/**
 * JobCard component - displays an individual job
 * @param {Object} props
 * @param {Object} props.job - Job data
 * @param {boolean} props.isSelected - Whether this job is selected
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.compact - Compact display mode for chain view
 * @param {Function} props.onExpand - Callback for inline expansion (D3)
 */
export function JobCard({ job, isSelected = false, onClick, compact = false, onExpand }) {
  const [expanded, setExpanded] = useState(false);

  const {
    _id,
    jobType,
    harness,
    context,
    status,
    result,
    startedAt,
    completedAt,
    createdAt
  } = job;

  // Truncated previews
  const contextPreview = useMemo(() => truncateText(context, 100), [context]);
  const resultPreview = useMemo(() => truncateText(result, 150), [result]);

  // Short ID for display
  const shortId = _id ? _id.slice(-8) : 'unknown';

  // Duration calculation
  const duration = useMemo(() => {
    if (!startedAt) return null;
    const endTime = completedAt || Date.now();
    const durationMs = endTime - startedAt;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    if (durationMs < 3600000) return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    return `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`;
  }, [startedAt, completedAt]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (onClick) onClick(job);
  }, [onClick, job]);

  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded(!expanded);
    if (onExpand) onExpand(job, !expanded);
  }, [onExpand, job, expanded]);

  const selectedClass = isSelected
    ? 'ring-2 ring-blue-500 bg-gray-750'
    : 'hover:bg-gray-750';

  // Compact view for chain visualization
  if (compact) {
    return React.createElement('div', {
      onClick: handleClick,
      className: `flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedClass} bg-gray-800 border border-gray-700`
    },
      React.createElement(StatusDot, {
        status,
        pulse: status === 'running'
      }),
      React.createElement(JobTypeBadge, { jobType }),
      React.createElement(HarnessBadge, { harness }),
      React.createElement('code', {
        className: 'text-xs text-gray-500 font-mono ml-auto'
      }, shortId)
    );
  }

  // Full card view
  return React.createElement('div', {
    className: `card p-4 transition-all ${selectedClass}`
  },
    // Header row
    React.createElement('div', {
      onClick: handleClick,
      className: 'flex items-center justify-between mb-2 cursor-pointer'
    },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement(StatusDot, { status, pulse: status === 'running' }),
        React.createElement(JobTypeBadge, { jobType }),
        React.createElement(HarnessBadge, { harness }),
        React.createElement('code', {
          className: 'text-xs text-gray-500 font-mono'
        }, shortId)
      ),
      React.createElement(StatusBadge, { status, size: 'sm' })
    ),

    // Context preview
    context && React.createElement('div', { className: 'mb-3' },
      React.createElement('p', {
        className: 'text-xs text-gray-500 uppercase tracking-wide mb-1'
      }, 'Context/Instructions'),
      React.createElement('p', {
        className: 'text-sm text-gray-300'
      }, expanded ? context : contextPreview)
    ),

    // Result preview (only if completed)
    (status === 'complete' || status === 'failed') && result && React.createElement('div', { className: 'mb-3' },
      React.createElement('p', {
        className: `text-xs uppercase tracking-wide mb-1 ${status === 'failed' ? 'text-red-500' : 'text-gray-500'}`
      }, status === 'failed' ? 'Error' : 'Result'),
      React.createElement('div', {
        className: `text-sm p-2 rounded border ${
          status === 'failed'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-gray-800 border-gray-700 text-gray-300'
        }`
      }, expanded ? result : resultPreview)
    ),

    // Expand/collapse button for long content (D3: inline expansion)
    ((context && context.length > 100) || (result && result.length > 150)) && React.createElement('button', {
      onClick: handleExpand,
      className: 'flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3'
    },
      React.createElement(ExpandIcon, { expanded }),
      expanded ? 'Show less' : 'Show more'
    ),

    // Footer: Timestamps and duration
    React.createElement('div', {
      className: 'flex items-center justify-between pt-3 border-t border-gray-700 text-xs text-gray-500'
    },
      React.createElement('div', { className: 'flex items-center gap-4' },
        createdAt && React.createElement('div', null,
          React.createElement('span', { className: 'text-gray-600' }, 'Created: '),
          React.createElement(Timestamp, { date: createdAt, format: 'relative' })
        ),
        startedAt && React.createElement('div', null,
          React.createElement('span', { className: 'text-gray-600' }, 'Started: '),
          React.createElement(Timestamp, { date: startedAt, format: 'relative' })
        )
      ),
      duration && React.createElement('div', {
        className: 'flex items-center gap-1'
      },
        React.createElement('span', { className: 'text-gray-600' }, 'Duration:'),
        React.createElement('span', { className: 'text-gray-400' }, duration)
      )
    )
  );
}

export default JobCard;
