// AssignmentDetail - Expanded assignment view with full details
import React, { useState, useMemo, useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';
import { JsonViewer } from '../shared/JsonViewer.js';
import { JobChain } from '../job/JobChain.js';

/**
 * Back arrow icon
 */
function BackIcon() {
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
      d: 'M10 19l-7-7m0 0l7-7m-7 7h18'
    })
  );
}

/**
 * Section header component
 */
function SectionHeader({ title, count }) {
  return React.createElement('div', {
    className: 'flex items-center justify-between mb-3'
  },
    React.createElement('h3', { className: 'text-sm font-semibold text-gray-300 uppercase tracking-wide' },
      title
    ),
    count !== undefined && React.createElement('span', {
      className: 'text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full'
    }, count)
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
 * Artifact item component
 */
function ArtifactItem({ artifact }) {
  const isString = typeof artifact === 'string';

  if (isString) {
    return React.createElement('div', {
      className: 'p-3 bg-gray-800 rounded-lg border border-gray-700'
    },
      React.createElement('p', { className: 'text-sm text-gray-300' }, artifact)
    );
  }

  return React.createElement('div', {
    className: 'p-3 bg-gray-800 rounded-lg border border-gray-700'
  },
    artifact.name && React.createElement('p', {
      className: 'text-sm font-medium text-gray-200 mb-1'
    }, artifact.name),
    artifact.path && React.createElement('code', {
      className: 'text-xs text-blue-400 font-mono block mb-2'
    }, artifact.path),
    artifact.description && React.createElement('p', {
      className: 'text-sm text-gray-400'
    }, artifact.description),
    !artifact.name && !artifact.path && !artifact.description && React.createElement(JsonViewer, {
      data: artifact,
      collapsed: true,
      maxHeight: 150
    })
  );
}

/**
 * Decision item component
 */
function DecisionItem({ decision, index }) {
  const isString = typeof decision === 'string';

  if (isString) {
    return React.createElement('div', {
      className: 'p-3 bg-gray-800 rounded-lg border border-gray-700'
    },
      React.createElement('p', { className: 'text-sm text-gray-300' }, decision)
    );
  }

  return React.createElement('div', {
    className: 'p-3 bg-gray-800 rounded-lg border border-gray-700'
  },
    React.createElement('div', { className: 'flex items-start justify-between mb-2' },
      React.createElement('span', {
        className: 'text-sm font-mono font-medium text-blue-400'
      }, decision.id || `D${index + 1}`),
      decision.status && React.createElement('span', {
        className: `text-xs px-2 py-0.5 rounded-full ${
          decision.status === 'approved' ? 'bg-green-500/20 text-green-400' :
          decision.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
          'bg-gray-700 text-gray-400'
        }`
      }, decision.status)
    ),
    (decision.decision || decision.description) && React.createElement('p', {
      className: 'text-sm text-gray-300 mb-2'
    }, decision.decision || decision.description),
    decision.rationale && React.createElement('p', {
      className: 'text-xs text-gray-500 italic'
    }, decision.rationale),
    decision.option && React.createElement('div', { className: 'mt-2' },
      React.createElement('span', { className: 'text-xs text-gray-500' }, 'Selected: '),
      React.createElement('span', { className: 'text-xs text-gray-300' }, decision.option)
    )
  );
}

/**
 * AssignmentDetail component - expanded view with full assignment details
 * @param {Object} props
 * @param {Object} props.assignment - Assignment data
 * @param {Array} props.jobs - Jobs for this assignment
 * @param {Function} props.onBack - Callback to go back to list
 * @param {Function} props.onJobSelect - Callback when a job is selected
 */
export function AssignmentDetail({ assignment, jobs = [], onBack, onJobSelect }) {
  const [selectedJobId, setSelectedJobId] = useState(null);

  const {
    _id,
    namespace,
    northStar,
    status,
    blockedReason,
    independent,
    priority,
    artifacts,
    decisions,
    createdAt,
    updatedAt
  } = assignment;

  // Parse artifacts and decisions
  const artifactList = useMemo(() => parseJson(artifacts), [artifacts]);
  const decisionList = useMemo(() => parseJson(decisions), [decisions]);

  const handleJobSelect = useCallback((job) => {
    setSelectedJobId(job._id);
    if (onJobSelect) onJobSelect(job);
  }, [onJobSelect]);

  const shortId = _id ? _id.slice(-12) : 'unknown';

  return React.createElement('div', { className: 'p-6' },
    // Header with back button
    React.createElement('div', { className: 'flex items-center gap-4 mb-6' },
      onBack && React.createElement('button', {
        onClick: onBack,
        className: 'p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors'
      },
        React.createElement(BackIcon)
      ),
      React.createElement('div', { className: 'flex-1' },
        React.createElement('div', { className: 'flex items-center gap-3' },
          React.createElement('code', {
            className: 'text-sm text-gray-500 font-mono'
          }, shortId),
          React.createElement(StatusBadge, { status, size: 'md' }),
          independent && React.createElement('span', {
            className: 'text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full'
          }, 'Independent'),
          React.createElement('span', {
            className: 'text-xs text-gray-600'
          }, `Priority: ${priority}`)
        )
      )
    ),

    // North Star
    React.createElement('div', { className: 'card p-4 mb-6' },
      React.createElement('h3', {
        className: 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'
      }, 'North Star'),
      React.createElement('p', {
        className: 'text-gray-200 whitespace-pre-wrap leading-relaxed'
      }, northStar || 'No description provided')
    ),

    // Blocked reason
    status === 'blocked' && blockedReason && React.createElement('div', {
      className: 'mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg'
    },
      React.createElement('h3', {
        className: 'text-xs font-semibold text-red-400 uppercase tracking-wide mb-2'
      }, 'Blocked Reason'),
      React.createElement('p', { className: 'text-red-300' }, blockedReason)
    ),

    // Job Chain
    jobs.length > 0 && React.createElement('div', { className: 'mb-6' },
      React.createElement(SectionHeader, { title: 'Job Chain', count: jobs.length }),
      React.createElement(JobChain, {
        jobs,
        selectedJobId,
        onJobSelect: handleJobSelect
      })
    ),

    // Artifacts
    artifactList.length > 0 && React.createElement('div', { className: 'mb-6' },
      React.createElement(SectionHeader, { title: 'Artifacts', count: artifactList.length }),
      React.createElement('div', { className: 'space-y-2' },
        artifactList.map((artifact, i) =>
          React.createElement(ArtifactItem, { key: i, artifact })
        )
      )
    ),

    // Decisions
    decisionList.length > 0 && React.createElement('div', { className: 'mb-6' },
      React.createElement(SectionHeader, { title: 'Decisions', count: decisionList.length }),
      React.createElement('div', { className: 'space-y-2' },
        decisionList.map((decision, i) =>
          React.createElement(DecisionItem, { key: i, decision, index: i })
        )
      )
    ),

    // Timestamps
    React.createElement('div', {
      className: 'flex items-center gap-6 pt-4 border-t border-gray-700 text-sm text-gray-500'
    },
      React.createElement('div', null,
        React.createElement('span', { className: 'text-gray-600' }, 'Created: '),
        React.createElement(Timestamp, { date: createdAt, format: 'both' })
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'text-gray-600' }, 'Updated: '),
        React.createElement(Timestamp, { date: updatedAt, format: 'both' })
      )
    )
  );
}

export default AssignmentDetail;
