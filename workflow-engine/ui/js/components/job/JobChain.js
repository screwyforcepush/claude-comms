// JobChain - Visual job chain showing group-based parallel job execution
import React, { useState, useCallback, useMemo } from 'react';
import { JobCard } from './JobCard.js';
import { JobDetail } from './JobDetail.js';

/**
 * Provider logo mapping: harness -> provider info
 * D1: Provider logos replace StatusDot+shortId
 * D3: Preserve harness border colors
 *
 * Logos use actual provider brand assets from public/ directory
 * - anthropic.svg: Anthropic's stylized "A" logo (orange)
 * - openaidark.svg: OpenAI's hexagonal logo (works on dark backgrounds)
 * - gemini.png: Google's Gemini star logo
 */
const providerConfig = {
  claude: {
    name: 'Anthropic',
    logoSrc: './public/anthropic.svg',
    color: 'text-orange-400'
  },
  codex: {
    name: 'OpenAI',
    logoSrc: './public/openai.svg',
    color: 'text-green-400'
  },
  gemini: {
    name: 'Google',
    logoSrc: './public/gemini.png',
    color: 'text-blue-400'
  }
};

/**
 * ProviderLogo component - displays provider logo with status glow
 * D2: Status via glow (muted=pending, pulse=running, green=complete, red=failed)
 * D15: Provider logo glow uses CSS pseudo-element (::before) positioned behind the image
 */
function ProviderLogo({ harness }) {
  const provider = providerConfig[harness] || providerConfig.claude;

  return React.createElement('img', {
    src: provider.logoSrc,
    alt: `${provider.name} logo`,
    className: 'w-6 h-6 object-contain',
    draggable: false
  });
}

function MiniProviderLogo({ harness }) {
  const provider = providerConfig[harness] || providerConfig.claude;

  return React.createElement('img', {
    src: provider.logoSrc,
    alt: `${provider.name} logo`,
    className: 'w-3 h-3 object-contain',
    draggable: false
  });
}

function ClockIcon() {
  return React.createElement('svg', {
    className: 'w-3 h-3',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M12 8v4l2 2m6-2a8 8 0 11-16 0 8 8 0 0116 0z'
    })
  );
}

function ToolIcon() {
  return React.createElement('svg', {
    className: 'w-3 h-3',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M10.325 4.317a1 1 0 011.15-.747 8 8 0 016.691 6.69 1 1 0 01-.748 1.15l-2.79.697a1 1 0 01-1.073-.517l-1.1-1.913-4.243 4.243a2 2 0 01-1.415.586H5a1 1 0 01-1-1v-1.797a2 2 0 01.586-1.414l4.243-4.243-1.913-1.1a1 1 0 01-.517-1.074l.697-2.79z'
    })
  );
}

function TokenIcon() {
  return React.createElement('svg', {
    className: 'w-3 h-3',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M4 7h16M4 12h16M4 17h16'
    })
  );
}

function formatCount(value) {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatIdleDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h`;
}

/**
 * Helper: chunk array into rows of specified size
 */
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Compact job node for chain visualization
 * D1: Provider logos replace StatusDot+shortId
 * D3: Preserve harness border colors
 */
function JobNode({ job, isSelected, isCurrent, onClick, now }) {
  const { _id, jobType, harness, status, toolCallCount, subagentCount, totalTokens, lastEventAt, startedAt } = job;

  // Status-based border colors
  const statusBorderColors = {
    pending: 'border-yellow-500/50',
    running: 'border-purple-500',
    complete: 'border-green-500',
    failed: 'border-red-500',
    blocked: 'border-red-500'
  };

  const typeColors = {
    plan: 'text-purple-400',
    implement: 'text-blue-400',
    review: 'text-yellow-400',
    uat: 'text-green-400',
    document: 'text-teal-400'
  };

  const selectedClass = isSelected
    ? 'ring-2 ring-blue-500'
    : '';

  const pulseClass = status === 'running' ? 'running-border-pulse' : '';

  const idleBase = lastEventAt || startedAt || null;
  const idleMs = idleBase ? Math.max(0, now - idleBase) : null;
  const idleValue = status === 'running' ? formatIdleDuration(idleMs) : null;

  const subagentTotal = typeof subagentCount === 'number' ? subagentCount : 0;

  return React.createElement('button', {
    onClick: () => onClick && onClick(job),
    className: `job-node flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer hover:bg-gray-750 ${
      statusBorderColors[status] || 'border-gray-600'
    } ${selectedClass} ${pulseClass} bg-gray-800`
  },
    // Provider logo (no status prop needed)
    React.createElement(ProviderLogo, { harness }),
    React.createElement('div', { className: 'flex flex-col items-start gap-1 min-w-0' },
      React.createElement('span', {
        className: `text-xs font-medium uppercase ${typeColors[jobType] || 'text-gray-400'}`
      }, jobType || 'job'),
      React.createElement('div', { className: 'flex items-center gap-2 text-[10px] text-gray-500' },
        status === 'running' && React.createElement('span', {
          className: 'flex items-center gap-1',
          title: 'Idle time'
        },
          React.createElement(ClockIcon),
          React.createElement('span', null, idleValue)
        ),
        React.createElement('span', {
          className: 'flex items-center gap-1',
          title: 'Tool calls'
        },
          React.createElement(ToolIcon),
          React.createElement('span', null, formatCount(toolCallCount))
        ),
        React.createElement('span', {
          className: 'flex items-center gap-1',
          title: 'Total tokens'
        },
          React.createElement(TokenIcon),
          React.createElement('span', null, formatCount(totalTokens))
        )
      ),
      subagentTotal > 0 && React.createElement('div', {
        className: 'flex items-center gap-1 text-[10px] text-gray-500',
        title: 'Subagents'
      },
        subagentTotal > 5
          ? React.createElement(React.Fragment, null,
              React.createElement(MiniProviderLogo, { harness }),
              React.createElement('span', { className: 'ml-0.5' }, `x ${subagentTotal}`)
            )
          : Array.from({ length: subagentTotal }).map((_, index) =>
              React.createElement(MiniProviderLogo, { key: index, harness })
            )
      )
    )
  );
}

/**
 * Vertical connector line between groups
 */
function VerticalConnector() {
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
 * Fan-out connector: single input to multiple outputs
 * Used when previous group has 1 job and current group has multiple
 */
function FanOutConnector({ outputCount }) {
  const maxVisible = Math.min(outputCount, 4);

  return React.createElement('div', {
    className: 'flex flex-col items-center py-2'
  },
    // Vertical stem from single source
    React.createElement('div', {
      className: 'w-0.5 h-3 bg-gray-600'
    }),
    // Horizontal line with branches
    React.createElement('div', {
      className: 'relative w-full flex justify-center'
    },
      // Horizontal bar
      React.createElement('div', {
        className: 'h-0.5 bg-gray-600',
        style: { width: `${Math.max(60, maxVisible * 30)}%` }
      }),
      // Branch indicators
      React.createElement('div', {
        className: 'absolute top-0 left-0 right-0 flex justify-around',
        style: { marginLeft: '15%', marginRight: '15%' }
      },
        Array.from({ length: maxVisible }).map((_, i) =>
          React.createElement('div', {
            key: i,
            className: 'flex flex-col items-center'
          },
            React.createElement('div', {
              className: 'w-0.5 h-3 bg-gray-600 mt-0.5'
            }),
            React.createElement('svg', {
              className: 'w-3 h-3 text-gray-600',
              fill: 'currentColor',
              viewBox: '0 0 24 24'
            },
              React.createElement('path', {
                d: 'M12 16l-5-5h10l-5 5z'
              })
            )
          )
        )
      )
    )
  );
}

/**
 * Fan-in connector: multiple inputs to single output
 * Used when previous group has multiple jobs and current group has 1
 */
function FanInConnector({ inputCount }) {
  const maxVisible = Math.min(inputCount, 4);

  return React.createElement('div', {
    className: 'flex flex-col items-center py-2'
  },
    // Converging branches
    React.createElement('div', {
      className: 'relative w-full flex justify-center'
    },
      // Branch indicators going down
      React.createElement('div', {
        className: 'flex justify-around',
        style: { width: `${Math.max(60, maxVisible * 30)}%` }
      },
        Array.from({ length: maxVisible }).map((_, i) =>
          React.createElement('div', {
            key: i,
            className: 'w-0.5 h-3 bg-gray-600'
          })
        )
      )
    ),
    // Horizontal bar
    React.createElement('div', {
      className: 'h-0.5 bg-gray-600',
      style: { width: `${Math.max(60, maxVisible * 30)}%` }
    }),
    // Vertical stem to single target
    React.createElement('div', {
      className: 'w-0.5 h-3 bg-gray-600'
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
 * Parallel-to-parallel connector: multiple to multiple
 * Used when both groups have multiple jobs
 */
function ParallelConnector({ inputCount, outputCount }) {
  const maxVisible = Math.max(Math.min(inputCount, 4), Math.min(outputCount, 4));

  return React.createElement('div', {
    className: 'flex flex-col items-center py-2'
  },
    // Converging branches from top
    React.createElement('div', {
      className: 'flex justify-around',
      style: { width: `${Math.max(60, maxVisible * 30)}%` }
    },
      Array.from({ length: Math.min(inputCount, 4) }).map((_, i) =>
        React.createElement('div', {
          key: i,
          className: 'w-0.5 h-2 bg-gray-600'
        })
      )
    ),
    // Central horizontal bar
    React.createElement('div', {
      className: 'h-0.5 bg-gray-600 my-1',
      style: { width: `${Math.max(60, maxVisible * 30)}%` }
    }),
    // Diverging branches to bottom
    React.createElement('div', {
      className: 'flex justify-around',
      style: { width: `${Math.max(60, maxVisible * 30)}%` }
    },
      Array.from({ length: Math.min(outputCount, 4) }).map((_, i) =>
        React.createElement('div', {
          key: i,
          className: 'flex flex-col items-center'
        },
          React.createElement('div', {
            className: 'w-0.5 h-2 bg-gray-600'
          }),
          React.createElement('svg', {
            className: 'w-3 h-3 text-gray-600',
            fill: 'currentColor',
            viewBox: '0 0 24 24'
          },
            React.createElement('path', {
              d: 'M12 14l-4-4h8l-4 4z'
            })
          )
        )
      )
    )
  );
}

/**
 * Group connector that picks the right type based on job counts
 */
function GroupConnector({ prevJobCount, nextJobCount }) {
  if (prevJobCount === 1 && nextJobCount === 1) {
    return React.createElement(VerticalConnector);
  }

  if (prevJobCount === 1 && nextJobCount > 1) {
    return React.createElement(FanOutConnector, { outputCount: nextJobCount });
  }

  if (prevJobCount > 1 && nextJobCount === 1) {
    return React.createElement(FanInConnector, { inputCount: prevJobCount });
  }

  // Both have multiple jobs
  return React.createElement(ParallelConnector, {
    inputCount: prevJobCount,
    outputCount: nextJobCount
  });
}

/**
 * Horizontal row of parallel jobs
 */
function ParallelJobRow({ jobs, selectedJobId, onJobSelect, now }) {
  return React.createElement('div', {
    className: 'flex flex-wrap justify-center gap-2'
  },
    jobs.map(job =>
      React.createElement(JobNode, {
        key: job._id,
        job,
        isSelected: selectedJobId === job._id,
        isCurrent: job.status === 'running',
        onClick: onJobSelect,
        now
      })
    )
  );
}

/**
 * Render a single group - handles wrapping for 5+ jobs
 */
function GroupRow({ group, selectedJobId, onJobSelect, now }) {
  const jobs = group.jobs || [];

  // Single job: render as single node (unchanged behavior)
  if (jobs.length === 1) {
    return React.createElement('div', {
      className: 'flex justify-center'
    },
      React.createElement(JobNode, {
        job: jobs[0],
        isSelected: selectedJobId === jobs[0]._id,
        isCurrent: jobs[0].status === 'running',
        onClick: onJobSelect,
        now
      })
    );
  }

  // 2-4 jobs: single horizontal row
  if (jobs.length <= 4) {
    return React.createElement(ParallelJobRow, {
      jobs,
      selectedJobId,
      onJobSelect,
      now
    });
  }

  // 5+ jobs: wrap into rows of 4 max
  const rows = chunkArray(jobs, 4);

  return React.createElement('div', {
    className: 'flex flex-col items-center gap-2'
  },
    rows.map((rowJobs, rowIndex) =>
      React.createElement(React.Fragment, { key: rowIndex },
        React.createElement(ParallelJobRow, {
          jobs: rowJobs,
          selectedJobId,
          onJobSelect,
          now
        }),
        // Add subtle row connector between wrapped rows
        rowIndex < rows.length - 1 && React.createElement('div', {
          className: 'w-px h-2 bg-gray-700'
        })
      )
    )
  );
}

/**
 * Main group chain - renders groups vertically with connectors between
 */
function GroupChain({ groups, selectedJobId, onJobSelect, now }) {
  return React.createElement('div', {
    className: 'flex flex-col items-center'
  },
    groups.map((group, index) => {
      const prevGroup = groups[index - 1];
      const prevJobCount = prevGroup?.jobs?.length || 0;
      const currentJobCount = group.jobs?.length || 0;

      return React.createElement(React.Fragment, { key: group._id },
        // Connector from previous group (if not first)
        index > 0 && React.createElement(GroupConnector, {
          prevJobCount,
          nextJobCount: currentJobCount
        }),
        // The group row
        React.createElement(GroupRow, {
          group,
          selectedJobId,
          onJobSelect,
          now
        })
      );
    })
  );
}

/**
 * JobChain component - visual job chain with group-based parallel execution
 * @param {Object} props
 * @param {Array} props.groups - Array of groups, each containing jobs array
 * @param {string} props.selectedJobId - Currently selected job ID
 * @param {Function} props.onJobSelect - Callback when job is selected
 * @param {string} props.layout - Layout mode: 'vertical' | 'horizontal' | 'auto' (reserved for future)
 */
export function JobChain({ groups = [], selectedJobId, onJobSelect, layout = 'vertical' }) {
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Flatten all jobs for stats and lookup
  const allJobs = useMemo(() => {
    return groups.flatMap(g => g.jobs || []);
  }, [groups]);

  // Find selected job for detail view
  const selectedJob = useMemo(() => {
    return allJobs.find(j => j._id === selectedJobId);
  }, [allJobs, selectedJobId]);

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

  if (groups.length === 0 || allJobs.length === 0) {
    return React.createElement('div', {
      className: 'text-center py-8 text-gray-500'
    }, 'No jobs in this assignment');
  }

  // Calculate chain statistics
  const stats = useMemo(() => {
    const completed = allJobs.filter(j => j.status === 'complete').length;
    const running = allJobs.filter(j => j.status === 'running').length;
    const pending = allJobs.filter(j => j.status === 'pending').length;
    const failed = allJobs.filter(j => j.status === 'failed').length;
    return { completed, running, pending, failed, total: allJobs.length, groupCount: groups.length };
  }, [allJobs, groups.length]);

  React.useEffect(() => {
    if (stats.running === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stats.running]);

  return React.createElement('div', { className: 'space-y-4' },
    // Chain summary
    React.createElement('div', {
      className: 'flex items-center gap-4 text-xs text-gray-500 flex-wrap'
    },
      React.createElement('span', null, `${stats.total} jobs in ${stats.groupCount} groups`),
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
      className: 'p-4 bg-gray-850 rounded-lg border border-gray-700 overflow-x-auto'
    },
      React.createElement(GroupChain, {
        groups,
        selectedJobId,
        onJobSelect: handleJobClick,
        now
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
