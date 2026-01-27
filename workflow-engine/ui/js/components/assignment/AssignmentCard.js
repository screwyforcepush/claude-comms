// AssignmentCard - Individual assignment card component
import React, { useState, useCallback, useMemo } from 'react';
import { StatusBadge, StatusDot } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';

/**
 * Chevron icon for collapsible sections
 */
function ChevronIcon({ expanded }) {
  return React.createElement('svg', {
    className: `w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9 5l7 7-7 7'
    })
  );
}

/**
 * Collapsible section component
 */
function CollapsibleSection({ title, count, children, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!children || (Array.isArray(children) && children.length === 0)) {
    return null;
  }

  return React.createElement('div', { className: 'mt-3 border-t border-gray-700 pt-3' },
    React.createElement('button', {
      onClick: (e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      },
      className: 'flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors w-full text-left'
    },
      React.createElement(ChevronIcon, { expanded }),
      React.createElement('span', null, title),
      count !== undefined && React.createElement('span', {
        className: 'text-xs bg-gray-700 px-1.5 py-0.5 rounded-full'
      }, count)
    ),
    expanded && React.createElement('div', { className: 'mt-2 pl-6' }, children)
  );
}

/**
 * Parse JSON string safely
 */
function parseJson(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Progress bar component for job completion
 */
function ProgressBar({ completed, total }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return React.createElement('div', { className: 'flex items-center gap-2' },
    React.createElement('div', { className: 'flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden' },
      React.createElement('div', {
        className: 'h-full bg-green-500 transition-all duration-300',
        style: { width: `${percentage}%` }
      })
    ),
    React.createElement('span', { className: 'text-xs text-gray-500 min-w-[40px]' },
      `${completed}/${total}`
    )
  );
}

/**
 * AssignmentCard component - displays an individual assignment
 * @param {Object} props
 * @param {Object} props.assignment - Assignment data
 * @param {Array} props.jobs - Jobs for this assignment
 * @param {boolean} props.isSelected - Whether this assignment is selected
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.compact - Compact display mode
 */
export function AssignmentCard({ assignment, jobs = [], isSelected = false, onClick, compact = false }) {
  const {
    _id,
    namespace,
    northStar,
    status,
    blockedReason,
    artifacts,
    decisions,
    createdAt,
    updatedAt
  } = assignment;

  // Parse artifacts and decisions
  const artifactList = useMemo(() => parseJson(artifacts), [artifacts]);
  const decisionList = useMemo(() => parseJson(decisions), [decisions]);

  // Calculate job stats
  const jobStats = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter(j => j.status === 'complete').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    return { total, completed, running, failed, pending };
  }, [jobs]);

  // Truncate north star for preview
  const truncatedNorthStar = useMemo(() => {
    if (!northStar) return 'No description';
    return northStar.length > 150 ? northStar.slice(0, 150) + '...' : northStar;
  }, [northStar]);

  // Short ID for display
  const shortId = _id ? _id.slice(-8) : 'unknown';

  const handleClick = useCallback(() => {
    if (onClick) onClick(assignment);
  }, [onClick, assignment]);

  const selectedClass = isSelected
    ? 'ring-2 ring-blue-500 bg-gray-750'
    : 'hover:bg-gray-750';

  return React.createElement('div', {
    onClick: handleClick,
    className: `card p-4 cursor-pointer transition-all ${selectedClass}`
  },
    // Header: ID + Status
    React.createElement('div', { className: 'flex items-center justify-between mb-2' },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('code', { className: 'text-xs text-gray-500 font-mono' }, shortId),
        namespace && React.createElement('span', {
          className: 'text-xs text-gray-600 px-1.5 py-0.5 bg-gray-800 rounded'
        }, namespace)
      ),
      React.createElement(StatusBadge, { status, size: 'sm' })
    ),

    // North Star / Description
    React.createElement('p', {
      className: 'text-gray-200 text-sm leading-relaxed mb-3'
    }, truncatedNorthStar),

    // Blocked reason if applicable
    status === 'blocked' && blockedReason && React.createElement('div', {
      className: 'mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400'
    },
      React.createElement('span', { className: 'font-medium' }, 'Blocked: '),
      blockedReason
    ),

    // Job progress
    jobStats.total > 0 && React.createElement('div', { className: 'mb-3' },
      React.createElement('div', { className: 'flex items-center justify-between text-xs text-gray-500 mb-1' },
        React.createElement('span', null, 'Job Progress'),
        React.createElement('div', { className: 'flex items-center gap-2' },
          jobStats.running > 0 && React.createElement('span', { className: 'flex items-center gap-1' },
            React.createElement(StatusDot, { status: 'running', pulse: true }),
            React.createElement('span', { className: 'text-purple-400' }, `${jobStats.running} running`)
          ),
          jobStats.failed > 0 && React.createElement('span', { className: 'text-red-400' },
            `${jobStats.failed} failed`
          )
        )
      ),
      React.createElement(ProgressBar, {
        completed: jobStats.completed,
        total: jobStats.total
      })
    ),

    // Compact mode: show summary only
    !compact && React.createElement(React.Fragment, null,
      // Artifacts section (collapsible)
      React.createElement(CollapsibleSection, {
        title: 'Artifacts',
        count: artifactList.length
      },
        artifactList.length > 0 && React.createElement('ul', { className: 'space-y-1' },
          artifactList.slice(0, 5).map((artifact, i) =>
            React.createElement('li', {
              key: i,
              className: 'text-xs text-gray-400 flex items-start gap-2'
            },
              React.createElement('span', { className: 'text-gray-600' }, '\u2022'),
              typeof artifact === 'string'
                ? artifact
                : React.createElement('span', null,
                    artifact.name || artifact.path || JSON.stringify(artifact)
                  )
            )
          ),
          artifactList.length > 5 && React.createElement('li', {
            className: 'text-xs text-gray-500 italic'
          }, `+${artifactList.length - 5} more`)
        )
      ),

      // Decisions section (collapsible)
      React.createElement(CollapsibleSection, {
        title: 'Decisions',
        count: decisionList.length
      },
        decisionList.length > 0 && React.createElement('ul', { className: 'space-y-1' },
          decisionList.slice(0, 5).map((decision, i) =>
            React.createElement('li', {
              key: i,
              className: 'text-xs text-gray-400 flex items-start gap-2'
            },
              React.createElement('span', { className: 'text-gray-600' }, '\u2022'),
              typeof decision === 'string'
                ? decision
                : React.createElement('span', null,
                    decision.id
                      ? React.createElement('span', { className: 'font-mono text-blue-400' }, decision.id + ': ')
                      : null,
                    decision.description || decision.decision || JSON.stringify(decision)
                  )
            )
          ),
          decisionList.length > 5 && React.createElement('li', {
            className: 'text-xs text-gray-500 italic'
          }, `+${decisionList.length - 5} more`)
        )
      )
    ),

    // Footer: Timestamps
    React.createElement('div', {
      className: 'flex items-center justify-between mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500'
    },
      React.createElement('div', { className: 'flex items-center gap-1' },
        React.createElement('span', null, 'Created:'),
        React.createElement(Timestamp, { date: createdAt, format: 'relative' })
      ),
      React.createElement('div', { className: 'flex items-center gap-1' },
        React.createElement('span', null, 'Updated:'),
        React.createElement(Timestamp, { date: updatedAt, format: 'relative' })
      )
    )
  );
}

export default AssignmentCard;
