// JobCard - Individual job card component
// WP-7: Transformed to Q palette brandkit styling
import React, { useState, useCallback, useMemo } from 'react';
import { StatusBadge, StatusDot } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';

/**
 * Harness icon/badge component - Q palette styling
 * claude: copper palette (brand color)
 * codex: slime palette (green)
 * gemini: teleport palette (purple)
 * default: iron palette (muted)
 */
function HarnessBadge({ harness }) {
  // Q palette color mappings for each harness provider
  const getHarnessStyles = (h) => {
    switch (h) {
      case 'claude':
        return {
          backgroundColor: 'var(--q-copper1-08)',
          color: 'var(--q-copper3)',
          border: '1px solid var(--q-copper1-44)'
        };
      case 'codex':
        return {
          backgroundColor: 'var(--q-slime0-08)',
          color: 'var(--q-slime1)',
          border: '1px solid var(--q-slime1-44)'
        };
      case 'gemini':
        return {
          backgroundColor: 'rgba(92, 60, 124, 0.08)',
          color: 'var(--q-teleport-bright)',
          border: '1px solid rgba(124, 88, 160, 0.44)'
        };
      default:
        return {
          backgroundColor: 'rgba(80, 76, 64, 0.08)',
          color: 'var(--q-iron2)',
          border: '1px solid var(--q-iron1-44)'
        };
    }
  };

  const styles = getHarnessStyles(harness);

  return React.createElement('span', {
    style: {
      ...styles,
      padding: '2px 8px',
      fontSize: '12px',
      fontFamily: 'var(--font-console)',
      borderRadius: 0,
      textTransform: 'uppercase',
      letterSpacing: '1px'
    }
  }, harness || 'unknown');
}

/**
 * Job type badge component - Q palette styling
 * plan: teleport-bright (purple)
 * implement: copper2 (orange)
 * review: torch (gold)
 * uat: slime1 (green)
 * document: copper3 (light copper)
 */
function JobTypeBadge({ jobType }) {
  const getJobTypeColor = (type) => {
    switch (type) {
      case 'plan':
        return 'var(--q-teleport-bright)';
      case 'implement':
        return 'var(--q-copper2)';
      case 'review':
        return 'var(--q-torch)';
      case 'uat':
        return 'var(--q-slime1)';
      case 'document':
        return 'var(--q-copper3)';
      default:
        return 'var(--q-bone1)';
    }
  };

  return React.createElement('span', {
    style: {
      color: getJobTypeColor(jobType),
      fontSize: '12px',
      fontFamily: 'var(--font-display)',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      fontWeight: 500
    }
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
    style: {
      width: '16px',
      height: '16px',
      transition: 'transform var(--t-anim-transition-normal)',
      transform: expanded ? 'rotate(180deg)' : 'none'
    },
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
 * WP-7: Transformed to Q palette with riveted panel styling
 * @param {Object} props
 * @param {Object} props.job - Job data
 * @param {boolean} props.isSelected - Whether this job is selected
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.compact - Compact display mode for chain view
 * @param {Function} props.onExpand - Callback for inline expansion (D3)
 */
export function JobCard({ job, isSelected = false, onClick, compact = false, onExpand }) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Q palette card styles
  const getCardStyles = () => {
    const baseStyles = {
      backgroundColor: 'var(--q-stone1)',
      border: '1px solid var(--q-stone3)',
      borderTop: '1px solid var(--q-iron1-44)',
      borderBottom: '2px solid var(--q-void0)',
      borderRadius: 0,
      transition: 'all var(--t-anim-transition-normal)'
    };

    if (isSelected) {
      return {
        ...baseStyles,
        backgroundColor: 'var(--q-stone2)',
        border: '2px solid var(--q-torch)',
        borderTop: '2px solid var(--q-torch)',
        borderBottom: '2px solid var(--q-torch)',
        boxShadow: '0 0 var(--t-fx-glow-sm) var(--q-torch-33)'
      };
    }

    if (isHovered) {
      return {
        ...baseStyles,
        backgroundColor: 'var(--q-stone2)'
      };
    }

    return baseStyles;
  };

  // Compact view for chain visualization
  if (compact) {
    return React.createElement('div', {
      onClick: handleClick,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        cursor: 'pointer',
        ...getCardStyles()
      }
    },
      React.createElement(StatusDot, {
        status,
        pulse: status === 'running'
      }),
      React.createElement(JobTypeBadge, { jobType }),
      React.createElement(HarnessBadge, { harness }),
      React.createElement('code', {
        style: {
          fontSize: '12px',
          color: 'var(--q-bone0)',
          fontFamily: 'var(--font-console)',
          marginLeft: 'auto'
        }
      }, shortId)
    );
  }

  // Full card view
  return React.createElement('div', {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    style: {
      padding: '16px',
      ...getCardStyles()
    }
  },
    // Header row
    React.createElement('div', {
      onClick: handleClick,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
        cursor: 'pointer'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        React.createElement(StatusDot, { status, pulse: status === 'running' }),
        React.createElement(JobTypeBadge, { jobType }),
        React.createElement(HarnessBadge, { harness }),
        React.createElement('code', {
          style: {
            fontSize: '12px',
            color: 'var(--q-bone0)',
            fontFamily: 'var(--font-console)'
          }
        }, shortId)
      ),
      React.createElement(StatusBadge, { status, size: 'sm' })
    ),

    // Context preview
    context && React.createElement('div', {
      style: { marginBottom: '12px' }
    },
      React.createElement('p', {
        style: {
          fontSize: '10px',
          color: 'var(--q-bone0)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: '4px',
          fontFamily: 'var(--font-display)'
        }
      }, 'Context/Instructions'),
      React.createElement('p', {
        style: {
          fontSize: '14px',
          color: 'var(--q-bone2)',
          fontFamily: 'var(--font-body)',
          lineHeight: 'var(--t-type-leading-normal)'
        }
      }, expanded ? context : contextPreview)
    ),

    // Result preview (only if completed)
    (status === 'complete' || status === 'failed') && result && React.createElement('div', {
      style: { marginBottom: '12px' }
    },
      React.createElement('p', {
        style: {
          fontSize: '10px',
          color: status === 'failed' ? 'var(--q-lava1)' : 'var(--q-bone0)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: '4px',
          fontFamily: 'var(--font-display)'
        }
      }, status === 'failed' ? 'Error' : 'Result'),
      React.createElement('div', {
        style: status === 'failed'
          ? {
              fontSize: '14px',
              padding: '8px',
              backgroundColor: 'var(--q-lava0-08)',
              border: '1px solid var(--q-lava1-44)',
              color: 'var(--q-bone3)',
              fontFamily: 'var(--font-body)',
              borderRadius: 0
            }
          : {
              fontSize: '14px',
              padding: '8px',
              backgroundColor: 'var(--q-void1)',
              border: '1px solid var(--q-stone3)',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)',
              borderRadius: 0
            }
      }, expanded ? result : resultPreview)
    ),

    // Expand/collapse button for long content (D3: inline expansion)
    ((context && context.length > 100) || (result && result.length > 150)) && React.createElement('button', {
      onClick: handleExpand,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color: 'var(--q-bone0)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        marginBottom: '12px',
        fontFamily: 'var(--font-console)',
        transition: 'color var(--t-anim-transition-fast)'
      },
      onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-bone2)'; },
      onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-bone0)'; }
    },
      React.createElement(ExpandIcon, { expanded }),
      expanded ? 'Show less' : 'Show more'
    ),

    // Footer: Timestamps and duration
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '12px',
        borderTop: '1px solid var(--q-stone3)',
        fontSize: '12px',
        color: 'var(--q-bone0)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }
      },
        createdAt && React.createElement('div', null,
          React.createElement('span', {
            style: { color: 'var(--q-iron1)' }
          }, 'Created: '),
          React.createElement(Timestamp, { date: createdAt, format: 'relative' })
        ),
        startedAt && React.createElement('div', null,
          React.createElement('span', {
            style: { color: 'var(--q-iron1)' }
          }, 'Started: '),
          React.createElement(Timestamp, { date: startedAt, format: 'relative' })
        )
      ),
      duration && React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }
      },
        React.createElement('span', {
          style: { color: 'var(--q-iron1)' }
        }, 'Duration:'),
        React.createElement('span', {
          style: { color: 'var(--q-bone1)' }
        }, duration)
      )
    )
  );
}

export default JobCard;
