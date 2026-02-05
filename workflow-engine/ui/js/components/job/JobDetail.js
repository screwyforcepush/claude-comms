// JobDetail - Expanded job view with modal support (D3)
// WP-7: Transformed to Q palette brandkit styling
import React, { useEffect, useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';
import { JsonViewer } from '../shared/JsonViewer.js';

/**
 * Close icon
 */
function CloseIcon() {
  return React.createElement('svg', {
    style: {
      width: '20px',
      height: '20px'
    },
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
 * Harness badge component - Q palette styling
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
      padding: '4px 12px',
      fontSize: '14px',
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
  const getJobTypeStyles = (type) => {
    switch (type) {
      case 'plan':
        return {
          backgroundColor: 'rgba(92, 60, 124, 0.15)',
          color: 'var(--q-teleport-bright)'
        };
      case 'implement':
        return {
          backgroundColor: 'var(--q-copper1-08)',
          color: 'var(--q-copper2)'
        };
      case 'review':
        return {
          backgroundColor: 'var(--q-torch-08)',
          color: 'var(--q-torch)'
        };
      case 'uat':
        return {
          backgroundColor: 'var(--q-slime0-08)',
          color: 'var(--q-slime1)'
        };
      case 'document':
        return {
          backgroundColor: 'var(--q-copper1-08)',
          color: 'var(--q-copper3)'
        };
      default:
        return {
          backgroundColor: 'rgba(80, 76, 64, 0.08)',
          color: 'var(--q-bone1)'
        };
    }
  };

  const styles = getJobTypeStyles(jobType);

  return React.createElement('span', {
    style: {
      ...styles,
      padding: '4px 12px',
      fontSize: '14px',
      fontFamily: 'var(--font-display)',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      fontWeight: 500,
      borderRadius: 0
    }
  }, jobType || 'unknown');
}

/**
 * Copy icon (clipboard)
 */
function CopyIcon() {
  return React.createElement('svg', {
    style: { width: '14px', height: '14px' },
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
    })
  );
}

/**
 * Check icon (for copy success feedback)
 */
function CheckIcon() {
  return React.createElement('svg', {
    style: { width: '14px', height: '14px' },
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
 * Try to parse content as JSON for better display
 * Q palette styling for content boxes
 */
function ContentViewer({ content, label, isError = false }) {
  const [copied, setCopied] = React.useState(false);
  const [copyHovered, setCopyHovered] = React.useState(false);

  if (!content) return null;

  // Try to parse as JSON
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Not JSON, display as text
  }

  const handleCopy = useCallback(() => {
    // For JSON, stringify with formatting; for text, use as-is
    const textToCopy = parsed ? JSON.stringify(parsed, null, 2) : content;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content, parsed]);

  return React.createElement('div', {
    style: { marginBottom: '16px' }
  },
    // Header with label and copy button
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }
    },
      React.createElement('h4', {
        style: {
          fontSize: '10px',
          fontFamily: 'var(--font-display)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: isError ? 'var(--q-lava1)' : 'var(--q-bone0)',
          fontWeight: 600,
          margin: 0
        }
      }, label),
      // Copy button
      React.createElement('button', {
        onClick: handleCopy,
        onMouseEnter: () => setCopyHovered(true),
        onMouseLeave: () => setCopyHovered(false),
        title: copied ? 'Copied!' : 'Copy to clipboard',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          fontSize: '10px',
          fontFamily: 'var(--font-display)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: copied ? 'var(--q-slime1)' : (copyHovered ? 'var(--q-copper2)' : 'var(--q-bone0)'),
          backgroundColor: copyHovered ? 'var(--q-stone2)' : 'transparent',
          border: '1px solid ' + (copied ? 'var(--q-slime1-44)' : (copyHovered ? 'var(--q-stone3)' : 'transparent')),
          borderRadius: 0,
          cursor: 'pointer',
          transition: 'all var(--t-anim-transition-fast)'
        }
      },
        copied ? React.createElement(CheckIcon) : React.createElement(CopyIcon),
        copied ? 'Copied' : 'Copy'
      )
    ),
    parsed
      ? React.createElement(JsonViewer, {
          data: parsed,
          collapsed: false,
          maxHeight: 400
        })
      : React.createElement('div', {
          style: {
            padding: '16px',
            borderRadius: 0,
            overflow: 'auto',
            maxHeight: '384px',
            backgroundColor: isError ? 'var(--q-lava0-08)' : 'var(--q-void1)',
            border: isError ? '1px solid var(--q-lava1-44)' : '1px solid var(--q-stone3)'
          }
        },
          React.createElement('pre', {
            style: {
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-console)',
              color: isError ? 'var(--q-bone3)' : 'var(--q-bone2)',
              margin: 0
            }
          }, content)
        )
  );
}

/**
 * Modal backdrop and container - Q palette styling
 * Preserves escape key handling and body scroll prevention
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
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }
  },
    // Backdrop - void0 with 85% opacity
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(6, 5, 4, 0.85)',
        backdropFilter: 'blur(4px)'
      },
      onClick: onClose
    }),
    // Modal content - copper texture gradient
    React.createElement('div', {
      style: {
        position: 'relative',
        background: 'linear-gradient(135deg, var(--q-stone2) 0%, var(--q-stone1) 100%)',
        border: '1px solid var(--q-stone3)',
        borderTop: '1px solid var(--q-iron1-44)',
        borderBottom: '2px solid var(--q-void0)',
        borderRadius: 0,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxWidth: '896px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }
    }, children)
  );
}

/**
 * JobDetail component - expanded job view with full details
 * D3: Inline expansion with modal option for large content
 * WP-7: Transformed to Q palette with copper texture modal
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
    prompt,
    status,
    result,
    nextJobId,
    startedAt,
    completedAt,
    createdAt,
    toolCallCount,
    subagentCount,
    totalTokens,
    lastEventAt
  } = job;

  const shortId = _id ? _id.slice(-12) : 'unknown';
  const shortAssignmentId = assignmentId ? assignmentId.slice(-8) : 'unknown';
  const shortNextJobId = nextJobId ? nextJobId.slice(-8) : null;
  const [now, setNow] = React.useState(Date.now());
  const [closeHovered, setCloseHovered] = React.useState(false);

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

  const idleTime = React.useMemo(() => {
    if (status !== 'running') return null;
    const idleBase = lastEventAt || startedAt || null;
    if (!idleBase) return null;
    const idleMs = Math.max(0, now - idleBase);
    if (idleMs < 1000) return `${idleMs}ms`;
    if (idleMs < 60000) return `${Math.floor(idleMs / 1000)}s`;
    if (idleMs < 3600000) return `${Math.floor(idleMs / 60000)}m ${Math.floor((idleMs % 60000) / 1000)}s`;
    return `${Math.floor(idleMs / 3600000)}h ${Math.floor((idleMs % 3600000) / 60000)}m`;
  }, [lastEventAt, startedAt, status, now]);

  React.useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const content = React.createElement(React.Fragment, null,
    // Header - copper accent line at top
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid var(--q-stone3)',
        background: 'linear-gradient(180deg, var(--q-copper0-15) 0%, transparent 100%)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }
      },
        React.createElement(JobTypeBadge, { jobType }),
        React.createElement(HarnessBadge, { harness }),
        React.createElement(StatusBadge, { status, size: 'md' })
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }
      },
        React.createElement('code', {
          style: {
            fontSize: '14px',
            color: 'var(--q-bone0)',
            fontFamily: 'var(--font-console)'
          }
        }, shortId),
        isModal && React.createElement('button', {
          onClick: onClose,
          onMouseEnter: () => setCloseHovered(true),
          onMouseLeave: () => setCloseHovered(false),
          style: {
            padding: '8px',
            color: closeHovered ? 'var(--q-copper2)' : 'var(--q-bone1)',
            backgroundColor: closeHovered ? 'var(--q-stone2)' : 'transparent',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'all var(--t-anim-transition-fast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }
        },
          React.createElement(CloseIcon)
        )
      )
    ),

    // Body (scrollable)
    React.createElement('div', {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }
    },
      // Metadata grid
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }
      },
        React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Assignment'),
          React.createElement('code', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-console)'
            }
          }, shortAssignmentId)
        ),
        shortNextJobId && React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Next Job'),
          React.createElement('code', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-console)'
            }
          }, shortNextJobId)
        ),
        duration && React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Duration'),
          React.createElement('p', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)'
            }
          }, duration)
        ),
        status === 'running' && React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Idle Time'),
          React.createElement('p', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)'
            }
          }, idleTime || '—')
        ),
        React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Tool Calls'),
          React.createElement('p', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)'
            }
          }, toolCallCount ?? '—')
        ),
        React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Subagents'),
          React.createElement('p', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)'
            }
          }, subagentCount ?? '—')
        ),
        React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Tokens'),
          React.createElement('p', {
            style: {
              fontSize: '14px',
              color: 'var(--q-bone2)',
              fontFamily: 'var(--font-body)'
            }
          }, totalTokens ?? '—')
        ),
        React.createElement('div', null,
          React.createElement('p', {
            style: {
              fontSize: '10px',
              color: 'var(--q-bone0)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px'
            }
          }, 'Status'),
          React.createElement(StatusBadge, { status, size: 'sm' })
        )
      ),

      // Prompt
      React.createElement(ContentViewer, {
        content: prompt,
        label: 'Prompt'
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
      style: {
        padding: '16px',
        borderTop: '1px solid var(--q-stone3)',
        backgroundColor: 'var(--q-stone1)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          fontSize: '12px',
          color: 'var(--q-bone0)'
        }
      },
        createdAt && React.createElement('div', null,
          React.createElement('span', {
            style: { color: 'var(--q-iron1)' }
          }, 'Created: '),
          React.createElement(Timestamp, { date: createdAt, format: 'both' })
        ),
        startedAt && React.createElement('div', null,
          React.createElement('span', {
            style: { color: 'var(--q-iron1)' }
          }, 'Started: '),
          React.createElement(Timestamp, { date: startedAt, format: 'both' })
        ),
        completedAt && React.createElement('div', null,
          React.createElement('span', {
            style: { color: 'var(--q-iron1)' }
          }, 'Completed: '),
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
    style: {
      background: 'linear-gradient(135deg, var(--q-stone2) 0%, var(--q-stone1) 100%)',
      border: '1px solid var(--q-stone3)',
      borderTop: '1px solid var(--q-iron1-44)',
      borderBottom: '2px solid var(--q-void0)',
      borderRadius: 0,
      overflow: 'hidden'
    }
  }, content);
}

export default JobDetail;
