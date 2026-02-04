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
 * WP-7: Added status-based glow wrapper with Q palette colors
 */
function ProviderLogo({ harness, status }) {
  const provider = providerConfig[harness] || providerConfig.claude;

  // Status-based glow class
  const glowClass = status ? `provider-logo-glow provider-logo-glow--${status}` : 'provider-logo-glow';

  return React.createElement('div', {
    className: glowClass
  },
    React.createElement('img', {
      src: provider.logoSrc,
      alt: `${provider.name} logo`,
      className: 'w-6 h-6 object-contain',
      draggable: false
    })
  );
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
 * WP-7: AgentHUD-style riveted card with status glow bar
 */
function JobNode({ job, isSelected, isCurrent, onClick, now }) {
  const { _id, jobType, harness, status, toolCallCount, subagentCount, totalTokens, lastEventAt, startedAt } = job;

  // Q palette type colors for job type badge
  const typeColors = {
    plan: 'var(--q-teleport-bright)',
    implement: 'var(--q-copper2)',
    review: 'var(--q-torch)',
    uat: 'var(--q-slime1)',
    document: 'var(--q-copper3)'
  };

  // Build HUD class with status modifier
  const hudStatusClass = `job-node-hud--${status || 'pending'}`;
  const selectedClass = isSelected ? 'job-node-hud--selected' : '';

  const idleBase = lastEventAt || startedAt || null;
  const idleMs = idleBase ? Math.max(0, now - idleBase) : null;
  const idleValue = status === 'running' ? formatIdleDuration(idleMs) : null;

  const subagentTotal = typeof subagentCount === 'number' ? subagentCount : 0;

  // AgentHUD riveted card pattern via inline styles + CSS class
  const hudBaseStyle = {
    background: 'radial-gradient(circle at 8px 8px, var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at calc(100% - 8px) 8px, var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at 8px calc(100% - 8px), var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at calc(100% - 8px) calc(100% - 8px), var(--q-iron0) 2px, transparent 2px), linear-gradient(180deg, var(--q-stone2), var(--q-stone1))',
    border: '1px solid var(--q-stone3)',
    borderTopColor: 'var(--q-iron1-33)',
    borderBottom: '2px solid var(--q-void0)',
    borderRadius: 0,
    padding: 0,
    overflow: 'hidden'
  };

  // Status-based glow
  const glowStyles = {
    running: { boxShadow: 'inset 0 0 30px var(--q-slime0-08), 0 0 20px var(--q-slime0-10)' },
    complete: {},
    failed: { boxShadow: 'inset 0 0 30px var(--q-lava0-08), 0 0 20px var(--q-lava0-10)' },
    blocked: { boxShadow: 'inset 0 0 30px var(--q-lava0-08), 0 0 20px var(--q-lava0-10)' },
    pending: { opacity: 0.7 }
  };

  // Selected glow
  const selectedStyle = isSelected ? {
    boxShadow: '0 0 0 2px var(--q-copper3), 0 0 12px var(--q-copper1-44)'
  } : {};

  // Glow bar color based on status
  const glowBarColors = {
    running: 'var(--q-slime1-44)',
    complete: 'var(--q-slime1-44)',
    failed: 'var(--q-lava1-44)',
    blocked: 'var(--q-lava1-44)',
    pending: 'var(--q-iron1-44)'
  };

  return React.createElement('button', {
    onClick: () => onClick && onClick(job),
    className: `job-node flex flex-col cursor-pointer transition-all ${hudStatusClass} ${selectedClass}`,
    style: {
      ...hudBaseStyle,
      ...glowStyles[status] || glowStyles.pending,
      ...selectedStyle
    }
  },
    // Status glow bar at top (3px)
    React.createElement('div', {
      className: 'job-node-hud__glow-bar',
      style: {
        height: '3px',
        background: `linear-gradient(90deg, transparent, ${glowBarColors[status] || glowBarColors.pending}, transparent)`
      }
    }),
    // Content area
    React.createElement('div', {
      className: 'flex items-center gap-2 px-3 py-2'
    },
      // Provider logo with status glow
      React.createElement(ProviderLogo, { harness, status }),
      React.createElement('div', { className: 'flex flex-col items-start gap-1 min-w-0' },
        // Job type badge with Q palette color
        React.createElement('span', {
          className: 'text-xs font-medium uppercase',
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-label)',
            letterSpacing: 'var(--t-type-tracking-normal)',
            color: typeColors[jobType] || 'var(--q-bone1)'
          }
        }, jobType || 'job'),
        // Stats display with Q palette bone colors
        React.createElement('div', {
          className: 'flex items-center gap-2',
          style: {
            fontSize: 'var(--t-type-size-label)',
            color: 'var(--q-bone0)'
          }
        },
          status === 'running' && React.createElement('span', {
            className: 'flex items-center gap-1',
            title: 'Idle time',
            style: { color: 'var(--q-bone0)' }
          },
            React.createElement(ClockIcon),
            React.createElement('span', { style: { color: 'var(--q-bone1)' } }, idleValue)
          ),
          React.createElement('span', {
            className: 'flex items-center gap-1',
            title: 'Tool calls',
            style: { color: 'var(--q-bone0)' }
          },
            React.createElement(ToolIcon),
            React.createElement('span', { style: { color: 'var(--q-bone1)' } }, formatCount(toolCallCount))
          ),
          React.createElement('span', {
            className: 'flex items-center gap-1',
            title: 'Total tokens',
            style: { color: 'var(--q-bone0)' }
          },
            React.createElement(TokenIcon),
            React.createElement('span', { style: { color: 'var(--q-bone1)' } }, formatCount(totalTokens))
          )
        ),
        // Subagent indicators
        subagentTotal > 0 && React.createElement('div', {
          className: 'flex items-center gap-1',
          title: 'Subagents',
          style: {
            fontSize: 'var(--t-type-size-label)',
            color: 'var(--q-bone0)'
          }
        },
          subagentTotal > 5
            ? React.createElement(React.Fragment, null,
                React.createElement(MiniProviderLogo, { harness }),
                React.createElement('span', {
                  className: 'ml-0.5',
                  style: { color: 'var(--q-bone1)' }
                }, `x ${subagentTotal}`)
              )
            : Array.from({ length: subagentTotal }).map((_, index) =>
                React.createElement(MiniProviderLogo, { key: index, harness })
              )
        )
      )
    )
  );
}

/**
 * Vertical connector line between groups
 * WP-7: Updated to Q palette iron colors
 */
function VerticalConnector() {
  return React.createElement('div', {
    className: 'flex flex-col items-center py-1'
  },
    React.createElement('div', {
      className: 'w-0.5 h-4',
      style: { backgroundColor: 'var(--q-iron1)' }
    }),
    React.createElement('svg', {
      className: 'w-4 h-4',
      fill: 'currentColor',
      viewBox: '0 0 24 24',
      style: { color: 'var(--q-iron1)' }
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
 * WP-7: Updated to Q palette iron colors
 */
function FanOutConnector({ outputCount }) {
  const maxVisible = Math.min(outputCount, 4);
  const ironStyle = { backgroundColor: 'var(--q-iron1)' };
  const ironSvgStyle = { color: 'var(--q-iron1)' };

  return React.createElement('div', {
    className: 'flex flex-col items-center py-2'
  },
    // Vertical stem from single source
    React.createElement('div', {
      className: 'w-0.5 h-3',
      style: ironStyle
    }),
    // Horizontal line with branches
    React.createElement('div', {
      className: 'relative w-full flex justify-center'
    },
      // Horizontal bar
      React.createElement('div', {
        className: 'h-0.5',
        style: { ...ironStyle, width: `${Math.max(60, maxVisible * 30)}%` }
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
              className: 'w-0.5 h-3 mt-0.5',
              style: ironStyle
            }),
            React.createElement('svg', {
              className: 'w-3 h-3',
              fill: 'currentColor',
              viewBox: '0 0 24 24',
              style: ironSvgStyle
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
 * WP-7: Updated to Q palette iron colors
 */
function FanInConnector({ inputCount }) {
  const maxVisible = Math.min(inputCount, 4);
  const ironStyle = { backgroundColor: 'var(--q-iron1)' };
  const ironSvgStyle = { color: 'var(--q-iron1)' };

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
            className: 'w-0.5 h-3',
            style: ironStyle
          })
        )
      )
    ),
    // Horizontal bar
    React.createElement('div', {
      className: 'h-0.5',
      style: { ...ironStyle, width: `${Math.max(60, maxVisible * 30)}%` }
    }),
    // Vertical stem to single target
    React.createElement('div', {
      className: 'w-0.5 h-3',
      style: ironStyle
    }),
    React.createElement('svg', {
      className: 'w-4 h-4',
      fill: 'currentColor',
      viewBox: '0 0 24 24',
      style: ironSvgStyle
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
 * WP-7: Updated to Q palette iron colors
 */
function ParallelConnector({ inputCount, outputCount }) {
  const maxVisible = Math.max(Math.min(inputCount, 4), Math.min(outputCount, 4));
  const ironStyle = { backgroundColor: 'var(--q-iron1)' };
  const ironSvgStyle = { color: 'var(--q-iron1)' };

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
          className: 'w-0.5 h-2',
          style: ironStyle
        })
      )
    ),
    // Central horizontal bar
    React.createElement('div', {
      className: 'h-0.5 my-1',
      style: { ...ironStyle, width: `${Math.max(60, maxVisible * 30)}%` }
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
            className: 'w-0.5 h-2',
            style: ironStyle
          }),
          React.createElement('svg', {
            className: 'w-3 h-3',
            fill: 'currentColor',
            viewBox: '0 0 24 24',
            style: ironSvgStyle
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
        // Add subtle row connector between wrapped rows (Q palette iron)
        rowIndex < rows.length - 1 && React.createElement('div', {
          className: 'w-px h-2',
          style: { backgroundColor: 'var(--q-iron1)' }
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
      className: 'text-center py-8',
      style: { color: 'var(--q-bone0)' }
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
    // Chain summary with Q palette colors
    React.createElement('div', {
      className: 'flex items-center gap-4 text-xs flex-wrap',
      style: { color: 'var(--q-bone0)' }
    },
      React.createElement('span', null, `${stats.total} jobs in ${stats.groupCount} groups`),
      stats.completed > 0 && React.createElement('span', {
        style: { color: 'var(--q-slime1)' }
      }, `${stats.completed} complete`),
      stats.running > 0 && React.createElement('span', {
        style: { color: 'var(--q-slime1)' }
      }, `${stats.running} running`),
      stats.pending > 0 && React.createElement('span', {
        style: { color: 'var(--q-torch)' }
      }, `${stats.pending} pending`),
      stats.failed > 0 && React.createElement('span', {
        style: { color: 'var(--q-lava1)' }
      }, `${stats.failed} failed`)
    ),

    // Chain visualization container with Q palette stone colors
    React.createElement('div', {
      className: 'p-4 overflow-x-auto job-chain-container',
      style: {
        backgroundColor: 'var(--q-stone1)',
        border: '1px solid var(--q-stone3)',
        borderRadius: 0
      }
    },
      React.createElement(GroupChain, {
        groups,
        selectedJobId,
        onJobSelect: handleJobClick,
        now
      })
    ),

    // Inline job detail (D3: inline expansion) with Q palette torch accent
    selectedJob && expandedJobId === selectedJob._id && React.createElement('div', {
      className: 'pl-4',
      style: {
        borderLeft: '2px solid var(--q-torch)'
      }
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
