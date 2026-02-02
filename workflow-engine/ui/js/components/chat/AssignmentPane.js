// AssignmentPane - Collapsible right sidebar showing assignment details + job chain
import React, { useState, useMemo } from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';
import { JobChain } from '../job/JobChain.js';
import { JsonViewer } from '../shared/JsonViewer.js';

/**
 * Close icon (X)
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
 * Chevron icon for collapsible sections
 */
function ChevronIcon({ rotated }) {
  return React.createElement('svg', {
    className: `w-4 h-4 transition-transform ${rotated ? 'rotate-180' : ''}`,
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
 * Collapsible section header
 */
function SectionHeader({ title, count, isOpen, onToggle }) {
  return React.createElement('button', {
    type: 'button',
    onClick: onToggle,
    className: 'w-full flex items-center justify-between py-2 text-left hover:bg-gray-800/50 rounded px-2 -mx-2 transition-colors'
  },
    React.createElement('div', { className: 'flex items-center gap-2' },
      React.createElement('h3', {
        className: 'text-sm font-semibold text-gray-300 uppercase tracking-wide'
      }, title),
      count !== undefined && React.createElement('span', {
        className: 'text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full'
      }, count)
    ),
    React.createElement(ChevronIcon, { rotated: isOpen })
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
      className: 'p-2 bg-gray-800 rounded border border-gray-700 text-xs'
    },
      React.createElement('p', { className: 'text-gray-300' }, artifact)
    );
  }

  return React.createElement('div', {
    className: 'p-2 bg-gray-800 rounded border border-gray-700 text-xs'
  },
    artifact.name && React.createElement('p', {
      className: 'font-medium text-gray-200 mb-0.5'
    }, artifact.name),
    artifact.path && React.createElement('code', {
      className: 'text-blue-400 font-mono block mb-1 break-all'
    }, artifact.path),
    artifact.description && React.createElement('p', {
      className: 'text-gray-400'
    }, artifact.description),
    !artifact.name && !artifact.path && !artifact.description && React.createElement(JsonViewer, {
      data: artifact,
      collapsed: true,
      maxHeight: 100
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
      className: 'p-2 bg-gray-800 rounded border border-gray-700 text-xs'
    },
      React.createElement('p', { className: 'text-gray-300' }, decision)
    );
  }

  return React.createElement('div', {
    className: 'p-2 bg-gray-800 rounded border border-gray-700 text-xs'
  },
    React.createElement('div', { className: 'flex items-start justify-between mb-1' },
      React.createElement('span', {
        className: 'font-mono font-medium text-blue-400'
      }, decision.id || `D${index + 1}`),
      decision.status && React.createElement('span', {
        className: `px-1.5 py-0.5 rounded-full ${
          decision.status === 'approved' ? 'bg-green-500/20 text-green-400' :
          decision.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
          'bg-gray-700 text-gray-400'
        }`
      }, decision.status)
    ),
    (decision.decision || decision.description) && React.createElement('p', {
      className: 'text-gray-300 mb-1'
    }, decision.decision || decision.description),
    decision.rationale && React.createElement('p', {
      className: 'text-gray-500 italic'
    }, decision.rationale)
  );
}

/**
 * AssignmentPane component - collapsible right sidebar showing assignment details + job chain
 * @param {Object} props
 * @param {Object} props.assignment - Assignment data
 * @param {Array} props.jobs - Jobs for this assignment
 * @param {boolean} props.isOpen - Whether the pane is open
 * @param {Function} props.onClose - Callback to close the pane
 * @param {Function} props.onJobSelect - Callback when a job is selected
 */
export function AssignmentPane({ assignment, jobs = [], isOpen, onClose, onJobSelect }) {
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);

  // Parse artifacts and decisions from JSON strings
  const artifactList = useMemo(() => parseJson(assignment?.artifacts), [assignment?.artifacts]);
  const decisionList = useMemo(() => parseJson(assignment?.decisions), [assignment?.decisions]);

  if (!assignment) return null;

  const {
    _id,
    northStar,
    status,
    blockedReason,
    independent
  } = assignment;

  const shortId = _id ? _id.slice(-8) : 'unknown';

  return React.createElement('div', {
    className: `assignment-pane flex-shrink-0 border-l border-gray-700 bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out ${
      isOpen ? 'w-80' : 'w-0'
    }`
  },
    React.createElement('div', {
      className: 'w-80 h-full flex flex-col overflow-hidden'
    },
      // Header with close button
      React.createElement('div', {
        className: 'flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-850 flex-shrink-0'
      },
        React.createElement('div', { className: 'flex items-center gap-2 min-w-0' },
          React.createElement('h2', { className: 'text-sm font-semibold text-white truncate' }, 'Assignment Details'),
          React.createElement('code', { className: 'text-xs text-gray-500 font-mono' }, shortId)
        ),
        React.createElement('button', {
          type: 'button',
          onClick: onClose,
          className: 'p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors flex-shrink-0',
          title: 'Close pane'
        }, React.createElement(CloseIcon))
      ),

      // Scrollable content
      React.createElement('div', {
        className: 'flex-1 overflow-y-auto p-4 space-y-4'
      },
        // Status badges
        React.createElement('div', { className: 'flex items-center gap-2 flex-wrap' },
          React.createElement(StatusBadge, { status, size: 'sm' }),
          independent && React.createElement('span', {
            className: 'text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full'
          }, 'Independent')
        ),

        // North Star
        React.createElement('div', { className: 'space-y-1' },
          React.createElement('h3', {
            className: 'text-xs font-semibold text-gray-500 uppercase tracking-wide'
          }, 'North Star'),
          React.createElement('p', {
            className: 'text-sm text-gray-200 whitespace-pre-wrap leading-relaxed'
          }, northStar || 'No description provided')
        ),

        // Blocked reason
        status === 'blocked' && blockedReason && React.createElement('div', {
          className: 'p-3 bg-red-500/10 border border-red-500/30 rounded-lg'
        },
          React.createElement('h3', {
            className: 'text-xs font-semibold text-red-400 uppercase tracking-wide mb-1'
          }, 'Blocked Reason'),
          React.createElement('p', { className: 'text-sm text-red-300' }, blockedReason)
        ),

        // Job Chain
        jobs.length > 0 && React.createElement('div', { className: 'space-y-2' },
          React.createElement('h3', {
            className: 'text-xs font-semibold text-gray-500 uppercase tracking-wide'
          }, `Job Chain (${jobs.length})`),
          React.createElement(JobChain, {
            jobs,
            onJobSelect,
            layout: 'vertical'
          })
        ),

        // Artifacts (collapsible)
        artifactList.length > 0 && React.createElement('div', null,
          React.createElement(SectionHeader, {
            title: 'Artifacts',
            count: artifactList.length,
            isOpen: artifactsOpen,
            onToggle: () => setArtifactsOpen(!artifactsOpen)
          }),
          artifactsOpen && React.createElement('div', { className: 'space-y-2 mt-2' },
            artifactList.map((artifact, i) =>
              React.createElement(ArtifactItem, { key: i, artifact })
            )
          )
        ),

        // Decisions (collapsible)
        decisionList.length > 0 && React.createElement('div', null,
          React.createElement(SectionHeader, {
            title: 'Decisions',
            count: decisionList.length,
            isOpen: decisionsOpen,
            onToggle: () => setDecisionsOpen(!decisionsOpen)
          }),
          decisionsOpen && React.createElement('div', { className: 'space-y-2 mt-2' },
            decisionList.map((decision, i) =>
              React.createElement(DecisionItem, { key: i, decision, index: i })
            )
          )
        )
      )
    )
  );
}

export default AssignmentPane;
