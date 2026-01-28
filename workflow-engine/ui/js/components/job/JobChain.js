// JobChain - Visual job chain showing parent-child relationships
import React, { useState, useCallback, useMemo } from 'react';
import { StatusDot } from '../shared/StatusBadge.js';
import { JobCard } from './JobCard.js';
import { JobDetail } from './JobDetail.js';

/**
 * Arrow connector between jobs
 */
function ChainConnector({ isLast }) {
  if (isLast) return null;

  return React.createElement('div', {
    className: 'flex flex-col items-center py-1'
  },
    React.createElement('div', {
      className: 'w-0.5 h-4 bg-gray-600'
    }),
    React.createElement('svg', {
      className: 'w-4 h-4 text-gray-600',
      fill: 'currentColor',
      viewBox: '0 0 24 24'
    },
      React.createElement('path', {
        d: 'M12 16l-6-6h12l-6 6z'
      })
    )
  );
}

/**
 * Compact job node for chain visualization
 */
function JobNode({ job, isSelected, isCurrent, onClick }) {
  const { _id, jobType, harness, status } = job;
  const shortId = _id ? _id.slice(-6) : '?';

  const harnessColors = {
    claude: 'border-orange-500/50',
    codex: 'border-green-500/50',
    gemini: 'border-blue-500/50'
  };

  const typeColors = {
    plan: 'text-purple-400',
    implement: 'text-blue-400',
    refine: 'text-cyan-400',
    uat: 'text-green-400',
    verify: 'text-yellow-400',
    research: 'text-pink-400'
  };

  const selectedClass = isSelected
    ? 'ring-2 ring-blue-500'
    : '';

  const currentClass = isCurrent && status === 'running'
    ? 'animate-pulse'
    : '';

  return React.createElement('button', {
    onClick: () => onClick && onClick(job),
    className: `flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer hover:bg-gray-750 ${
      harnessColors[harness] || 'border-gray-600'
    } ${selectedClass} ${currentClass} bg-gray-800`
  },
    React.createElement(StatusDot, { status, pulse: status === 'running' }),
    React.createElement('span', {
      className: `text-xs font-medium uppercase ${typeColors[jobType] || 'text-gray-400'}`
    }, jobType || 'job'),
    React.createElement('span', {
      className: 'text-xs text-gray-500 font-mono'
    }, shortId)
  );
}

/**
 * Timeline view of job chain
 */
function ChainTimeline({ jobs, selectedJobId, onJobSelect }) {
  return React.createElement('div', { className: 'flex flex-col items-center' },
    jobs.map((job, index) =>
      React.createElement(React.Fragment, { key: job._id },
        React.createElement(JobNode, {
          job,
          isSelected: selectedJobId === job._id,
          isCurrent: job.status === 'running',
          onClick: onJobSelect
        }),
        React.createElement(ChainConnector, { isLast: index === jobs.length - 1 })
      )
    )
  );
}

/**
 * Horizontal flow view of job chain (compact)
 */
function ChainFlow({ jobs, selectedJobId, onJobSelect }) {
  return React.createElement('div', {
    className: 'flex items-center gap-1 overflow-x-auto pb-2'
  },
    jobs.map((job, index) =>
      React.createElement(React.Fragment, { key: job._id },
        React.createElement(JobNode, {
          job,
          isSelected: selectedJobId === job._id,
          isCurrent: job.status === 'running',
          onClick: onJobSelect
        }),
        index < jobs.length - 1 && React.createElement('svg', {
          className: 'w-4 h-4 text-gray-600 flex-shrink-0',
          fill: 'currentColor',
          viewBox: '0 0 24 24'
        },
          React.createElement('path', {
            d: 'M10 6l6 6-6 6V6z'
          })
        )
      )
    )
  );
}

/**
 * JobChain component - visual job chain with parent-child relationships
 * @param {Object} props
 * @param {Array} props.jobs - Array of jobs in chain order (head first)
 * @param {string} props.selectedJobId - Currently selected job ID
 * @param {Function} props.onJobSelect - Callback when job is selected
 * @param {string} props.layout - Layout mode: 'vertical' | 'horizontal' | 'auto'
 */
export function JobChain({ jobs = [], selectedJobId, onJobSelect, layout = 'auto' }) {
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Determine layout based on job count if auto
  const effectiveLayout = useMemo(() => {
    if (layout !== 'auto') return layout;
    return jobs.length > 4 ? 'horizontal' : 'vertical';
  }, [layout, jobs.length]);

  // Find selected job for detail view
  const selectedJob = useMemo(() => {
    return jobs.find(j => j._id === selectedJobId);
  }, [jobs, selectedJobId]);

  const handleJobClick = useCallback((job) => {
    if (onJobSelect) onJobSelect(job);
    setExpandedJobId(job._id);
  }, [onJobSelect]);

  const handleShowModal = useCallback((job) => {
    setExpandedJobId(job._id);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  if (jobs.length === 0) {
    return React.createElement('div', {
      className: 'text-center py-8 text-gray-500'
    }, 'No jobs in this assignment');
  }

  // Calculate chain statistics
  const stats = useMemo(() => {
    const completed = jobs.filter(j => j.status === 'complete').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    return { completed, running, pending, failed, total: jobs.length };
  }, [jobs]);

  return React.createElement('div', { className: 'space-y-4' },
    // Chain summary
    React.createElement('div', {
      className: 'flex items-center gap-4 text-xs text-gray-500'
    },
      React.createElement('span', null, `${stats.total} jobs`),
      stats.completed > 0 && React.createElement('span', { className: 'text-green-400' },
        `${stats.completed} complete`
      ),
      stats.running > 0 && React.createElement('span', { className: 'text-purple-400' },
        `${stats.running} running`
      ),
      stats.pending > 0 && React.createElement('span', { className: 'text-yellow-400' },
        `${stats.pending} pending`
      ),
      stats.failed > 0 && React.createElement('span', { className: 'text-red-400' },
        `${stats.failed} failed`
      )
    ),

    // Chain visualization
    React.createElement('div', {
      className: `p-4 bg-gray-850 rounded-lg border border-gray-700 ${
        effectiveLayout === 'horizontal' ? 'overflow-x-auto' : ''
      }`
    },
      effectiveLayout === 'vertical'
        ? React.createElement(ChainTimeline, {
            jobs,
            selectedJobId,
            onJobSelect: handleJobClick
          })
        : React.createElement(ChainFlow, {
            jobs,
            selectedJobId,
            onJobSelect: handleJobClick
          })
    ),

    // Inline job detail (D3: inline expansion)
    selectedJob && expandedJobId === selectedJob._id && React.createElement('div', {
      className: 'border-l-2 border-blue-500 pl-4'
    },
      React.createElement(JobCard, {
        job: selectedJob,
        isSelected: true,
        onExpand: handleShowModal
      })
    ),

    // Modal for large content (D3: modal option for large content)
    showModal && selectedJob && React.createElement(JobDetail, {
      job: selectedJob,
      onClose: handleCloseModal
    })
  );
}

export default JobChain;
