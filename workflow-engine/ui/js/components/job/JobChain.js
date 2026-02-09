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
 * Format duration in human-readable form (Xm XXs or Xh Xm)
 * WP-7: AgentHUD duration display for HP bar
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms) {
  if (ms === null || ms === undefined || ms < 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Status rune configuration for AgentHUD pattern
 * Maps job status to visual configuration with Q palette colors
 * WP-7: Status indicator with fullbright dot
 */
const statusRuneConfig = {
  pending: { color: 'var(--q-iron1)', label: 'PENDING', pulse: false },
  running: { color: 'var(--q-teleport-bright)', label: 'RUNNING', pulse: true },
  complete: { color: 'var(--q-slime1)', label: 'DONE', pulse: false },
  failed: { color: 'var(--q-lava1)', label: 'GIBBED', pulse: false },
  blocked: { color: 'var(--q-torch)', label: 'BLOCKED', pulse: false }
};

/**
 * Fullbright indicator dot - glowing status dot from brandkit
 * WP-7: Status indicator with radial gradient and glow layers
 * @param {Object} props
 * @param {string} props.color - CSS color value
 * @param {boolean} props.pulse - Whether to animate with pulse
 * @param {number} props.size - Dot size in pixels
 */
function Fullbright({ color, pulse = false, size = 5 }) {
  return React.createElement('span', {
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}, ${color}88)`,
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px ${color}88, 0 0 ${size * 2}px ${color}44`,
      animation: pulse ? 'fbPulse 2.5s ease-in-out infinite' : 'none'
    }
  });
}

/**
 * StatusRune component - displays status with fullbright dot and label
 * WP-7: AgentHUD pattern status indicator
 * @param {Object} props
 * @param {string} props.status - Job status (pending/running/complete/failed/blocked)
 */
function StatusRune({ status }) {
  const config = statusRuneConfig[status] || statusRuneConfig.pending;
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--t-type-size-badge)',
      letterSpacing: 'var(--t-type-tracking-normal)',
      color: config.color,
      background: `${config.color}12`,
      border: `1px solid ${config.color}33`,
      padding: '3px 8px',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px'
    }
  },
    React.createElement(Fullbright, { color: config.color, pulse: config.pulse, size: 5 }),
    config.label
  );
}

/**
 * RollupBadge component - StatusRune-style badge for chain summary statistics
 * WP-7: Phase 2 polish - displays count with fullbright dot in branded badge
 * @param {Object} props
 * @param {number} props.count - Number to display
 * @param {string} props.label - Status label (DONE, RUNNING, PENDING, FAILED)
 * @param {string} props.color - CSS color value (Q palette variable)
 * @param {boolean} props.pulse - Whether to animate the fullbright dot
 */
function RollupBadge({ count, label, color, pulse = false }) {
  if (count === 0) return null;
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '8px',
      letterSpacing: '2px',
      color: color,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
      padding: '3px 8px',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px'
    }
  },
    // Fullbright dot
    React.createElement('span', {
      style: {
        display: 'inline-block',
        width: 5,
        height: 5,
        background: `radial-gradient(circle, ${color}, ${color}88)`,
        borderRadius: '50%',
        boxShadow: `0 0 5px ${color}88, 0 0 10px ${color}44`,
        animation: pulse ? 'fbPulse 2.5s ease-in-out infinite' : 'none'
      }
    }),
    `${count} ${label}`
  );
}

/**
 * StatBar component - Quake-style meter bar (HP/ARM/DMG)
 * WP-7: AgentHUD pattern health/armor/damage bars
 * @param {Object} props
 * @param {string} props.label - Bar label (HP, ARM, DMG)
 * @param {number} props.fill - Fill percentage (0-100)
 * @param {string} props.value - Display value text
 * @param {string} props.color - Bar color
 */
function StatBar({ label, fill, value, color }) {
  const clampedFill = Math.max(0, Math.min(100, fill));
  return React.createElement('div', {
    style: { flex: 1, minWidth: 0 }
  },
    // Label + value row
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2px'
      }
    },
      React.createElement('span', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--t-type-size-badge)',
          color: 'var(--q-bone0)',
          letterSpacing: 'var(--t-type-tracking-tight)'
        }
      }, label),
      React.createElement('span', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--t-type-size-stat-small)',
          color: color,
          textShadow: `0 0 6px ${color}44`
        }
      }, value)
    ),
    // Bar container
    React.createElement('div', {
      style: {
        height: 'var(--t-bar-height-health)',
        background: 'var(--q-void1)',
        border: '1px solid var(--q-stone3)'
      }
    },
      // Bar fill
      React.createElement('div', {
        style: {
          height: '100%',
          width: `${clampedFill}%`,
          transition: 'width 0.5s ease',
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} 53%, transparent), ${color})`,
          boxShadow: `0 0 6px color-mix(in srgb, ${color} 20%, transparent)`
        }
      })
    )
  );
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
 * AgentHUD-style job node for chain visualization
 * WP-7 Phase 2: Full AgentHUD pattern with HP/ARM bars and FRAGS/DMG stats
 *
 * Layout:
 * +-----------------------------------------+
 * | [Provider Logo]  JOB_TYPE   [StatusRune]|
 * | subhead: subagent mini icons            |
 * +-----------------------------------------+
 * | HP  ████████░░░░  2m 34s                | <- Duration (1hr max countdown)
 * | ARM ██████████░░  0s                    | <- Idle (running only)
 * +-----------------------------------------+
 * | FRAGS 47                      DMG 1.2k  | <- Tool calls + Tokens
 * +-----------------------------------------+
 */
function JobNode({ job, isSelected, isCurrent, onClick, now }) {
  const { _id, jobType, harness, status, toolCallCount, subagentCount, totalTokens, lastEventAt, startedAt, completedAt } = job;

  // Q palette type colors for job type badge
  const typeColors = {
    plan: 'var(--q-teleport-bright)',
    implement: 'var(--q-copper2)',
    review: 'var(--q-torch)',
    uat: 'var(--q-slime1)',
    document: 'var(--q-copper3)',
    pm: 'var(--q-copper2)'
  };

  // Map internal job types to on-brand display names
  const typeDisplayNames = {
    document: 'SCRIBE',
    implement: 'BUILD',
    pm: 'DISPATCH'
  };

  // Build HUD class with status modifier
  const hudStatusClass = `job-node-hud--${status || 'pending'}`;
  const selectedClass = isSelected ? 'job-node-hud--selected' : '';

  const subagentTotal = typeof subagentCount === 'number' ? subagentCount : 0;

  // Determine if job is finished (complete or failed)
  const isFinished = status === 'complete' || status === 'failed';

  // --- Calculate HP (Duration) ---
  // HP bar counts DOWN: full bar = job just started, empty = 1 hour elapsed
  // Max = 1 hour (3600 seconds)
  // For finished jobs: use static duration (completedAt - startedAt), timer stops
  // For running jobs: use live duration (now - startedAt), timer ticks
  // For pending jobs: show full bar (100%), no duration yet
  let durationMs = 0;
  if (isFinished && completedAt && startedAt) {
    // Finished job: static duration (timer stopped)
    durationMs = Math.max(0, completedAt - startedAt);
  } else if (startedAt) {
    // Running job: live duration (timer ticking)
    durationMs = Math.max(0, now - startedAt);
  }
  // else: pending job, durationMs stays 0 (full bar)

  const durationSeconds = Math.floor(durationMs / 1000);
  const hpFill = Math.max(0, ((3600 - durationSeconds) / 3600) * 100);
  const durationDisplay = formatDuration(durationMs);

  // HP color based on remaining time (health metaphor)
  const hpColor = hpFill > 60 ? 'var(--q-slime1)' : hpFill > 25 ? 'var(--q-torch)' : 'var(--q-lava1)';

  // --- Calculate ARM (Idle) ---
  // ARM bar counts DOWN: full bar = just active, empty = 10 min idle
  // Max = 10 minutes (600 seconds)
  // For finished jobs, show full bar (100%) and static display
  const idleBase = lastEventAt || startedAt || null;
  const idleMs = idleBase && !isFinished ? Math.max(0, now - idleBase) : 0;
  const idleSeconds = Math.floor(idleMs / 1000);
  const armFill = isFinished ? 100 : Math.max(0, ((600 - idleSeconds) / 600) * 100);
  const idleDisplay = isFinished ? '--' : formatIdleDuration(idleMs);

  // --- DMG (Tokens) ---
  const tokenCount = typeof totalTokens === 'number' ? totalTokens : 0;
  const tokenDisplay = formatCount(tokenCount);

  // --- FRAGS (Tool calls) ---
  const fragCount = typeof toolCallCount === 'number' ? toolCallCount : 0;

  // AgentHUD riveted card pattern via inline styles + CSS class
  const hudBaseStyle = {
    background: 'radial-gradient(circle at 8px 8px, var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at calc(100% - 8px) 8px, var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at 8px calc(100% - 8px), var(--q-iron0) 2px, transparent 2px), radial-gradient(circle at calc(100% - 8px) calc(100% - 8px), var(--q-iron0) 2px, transparent 2px), linear-gradient(180deg, var(--q-stone2), var(--q-stone1))',
    border: '1px solid var(--q-stone3)',
    borderTopColor: 'var(--q-iron1-33)',
    borderBottom: '2px solid var(--q-void0)',
    borderRadius: 0,
    padding: 0,
    overflow: 'hidden',
    minWidth: '180px'
  };

  // Status-based glow
  const glowStyles = {
    running: { boxShadow: 'inset 0 0 30px var(--q-teleport-08), 0 0 20px var(--q-teleport-10)' },
    complete: { boxShadow: 'inset 0 0 30px var(--q-slime0-08), 0 0 20px var(--q-slime0-10)' },
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
    running: 'var(--q-teleport-bright-44)',
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
    // Header: Provider Logo + JOB_TYPE + StatusRune
    React.createElement('div', {
      style: {
        padding: '8px 12px 6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    },
      // Left side: Logo + Type + Subagents
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px' } },
        React.createElement(ProviderLogo, { harness, status }),
        React.createElement('div', null,
          // Job type badge
          React.createElement('div', {
            style: {
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--t-type-size-subheading)',
              letterSpacing: 'var(--t-type-tracking-normal)',
              color: typeColors[jobType] || 'var(--q-bone1)',
              textTransform: 'uppercase'
            }
          }, typeDisplayNames[jobType] || (jobType ? jobType.toUpperCase() : 'JOB')),
          // Subhead: subagent mini icons
          subagentTotal > 0 && React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              marginTop: '2px'
            }
          },
            subagentTotal > 5
              ? React.createElement(React.Fragment, null,
                  React.createElement(MiniProviderLogo, { harness }),
                  React.createElement('span', {
                    style: {
                      fontFamily: 'var(--font-console)',
                      fontSize: 'var(--t-type-size-label-small)',
                      color: 'var(--q-bone0)',
                      marginLeft: '2px'
                    }
                  }, `x${subagentTotal}`)
                )
              : Array.from({ length: subagentTotal }).map((_, index) =>
                  React.createElement(MiniProviderLogo, { key: index, harness })
                )
          )
        )
      ),
      // Right side: StatusRune
      React.createElement(StatusRune, { status })
    ),
    // Stat Bars Section: HP (+ ARM when running)
    React.createElement('div', {
      style: {
        padding: '4px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }
    },
      // HP Bar (Duration - countdown from 1hr)
      React.createElement(StatBar, {
        label: 'HP',
        fill: hpFill,
        value: durationDisplay,
        color: hpColor
      }),
      // ARM Bar (Idle - countdown from 10min) - only shown when running
      status === 'running' && React.createElement(StatBar, {
        label: 'ARM',
        fill: armFill,
        value: idleDisplay,
        color: 'var(--q-copper3)'
      })
    ),
    // FRAGS + DMG Section (Tool calls + Tokens)
    React.createElement('div', {
      style: {
        padding: '6px 12px',
        borderTop: '1px solid var(--q-stone3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    },
      // FRAGS (left)
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px' }
      },
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-badge)',
            color: 'var(--q-bone0)',
            letterSpacing: 'var(--t-type-tracking-tight)'
          }
        }, 'FRAGS'),
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-stat-medium)',
            color: 'var(--q-torch-hot)',
            lineHeight: '1',
            textShadow: '0 0 12px var(--q-torch-33)'
          }
        }, fragCount)
      ),
      // DMG (right) - Tokens in red
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px' }
      },
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-badge)',
            color: 'var(--q-bone0)',
            letterSpacing: 'var(--t-type-tracking-tight)'
          }
        }, 'DMG'),
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-stat-medium)',
            color: 'var(--q-lava1)',
            lineHeight: '1',
            textShadow: '0 0 12px var(--q-lava1-44)'
          }
        }, tokenDisplay)
      )
    )
  );
}

/**
 * Vertical connector line between groups
 * Phase 2 Redesign: Clean minimal vertical line with crisp arrow
 * Uses Q palette iron colors for professional appearance
 * Arrow design: 2px line with 6x6 chevron arrow at bottom
 */
function VerticalConnector() {
  const lineColor = 'var(--q-iron2)';
  const arrowColor = 'var(--q-iron1)';

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0'
    }
  },
    // Clean vertical line - 2px wide for crispness
    React.createElement('div', {
      style: {
        width: '2px',
        height: '20px',
        backgroundColor: lineColor
      }
    }),
    // Chevron arrow - clean CSS triangle with proper proportions
    React.createElement('div', {
      style: {
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid ' + arrowColor,
        marginTop: '-1px' // Slight overlap for seamless connection
      }
    })
  );
}

/**
 * Fan-out connector: single input to multiple outputs
 * Phase 2 Redesign: Clean T-junction with vertical drops
 * Structure: stem -> horizontal bar -> parallel drops with arrows
 * Uses consistent 2px lines and 5x6 arrow proportions
 */
function FanOutConnector({ outputCount }) {
  const displayCount = Math.min(outputCount, 4);
  const lineColor = 'var(--q-iron2)';
  const arrowColor = 'var(--q-iron1)';

  // Calculate width based on output count (responsive) - use fixed px for consistency
  const barWidth = displayCount === 2 ? 100 : displayCount === 3 ? 150 : 200;

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0'
    }
  },
    // Single vertical stem from source - 2px wide
    React.createElement('div', {
      style: {
        width: '2px',
        height: '12px',
        backgroundColor: lineColor
      }
    }),
    // Horizontal distribution bar - 2px tall
    React.createElement('div', {
      style: {
        width: barWidth + 'px',
        height: '2px',
        backgroundColor: lineColor
      }
    }),
    // Parallel vertical drops with arrows
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: barWidth + 'px'
      }
    },
      Array.from({ length: displayCount }).map((_, i) =>
        React.createElement('div', {
          key: i,
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }
        },
          // Vertical drop line - 2px wide
          React.createElement('div', {
            style: {
              width: '2px',
              height: '12px',
              backgroundColor: lineColor
            }
          }),
          // CSS chevron arrow - consistent 5x6 proportions
          React.createElement('div', {
            style: {
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '6px solid ' + arrowColor,
              marginTop: '-1px'
            }
          })
        )
      )
    )
  );
}

/**
 * Fan-in connector: multiple inputs to single output
 * Phase 2 Redesign: Clean inverted T-junction
 * Structure: parallel stems -> horizontal bar -> single drop with arrow
 * Uses consistent 2px lines and 5x6 arrow proportions
 */
function FanInConnector({ inputCount }) {
  const displayCount = Math.min(inputCount, 4);
  const lineColor = 'var(--q-iron2)';
  const arrowColor = 'var(--q-iron1)';

  // Calculate width based on input count (responsive) - use fixed px for consistency
  const barWidth = displayCount === 2 ? 100 : displayCount === 3 ? 150 : 200;

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0'
    }
  },
    // Parallel vertical stems from multiple sources - 2px wide
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: barWidth + 'px'
      }
    },
      Array.from({ length: displayCount }).map((_, i) =>
        React.createElement('div', {
          key: i,
          style: {
            width: '2px',
            height: '12px',
            backgroundColor: lineColor
          }
        })
      )
    ),
    // Horizontal collection bar - 2px tall
    React.createElement('div', {
      style: {
        width: barWidth + 'px',
        height: '2px',
        backgroundColor: lineColor
      }
    }),
    // Single vertical stem to target - 2px wide
    React.createElement('div', {
      style: {
        width: '2px',
        height: '12px',
        backgroundColor: lineColor
      }
    }),
    // CSS chevron arrow - consistent 5x6 proportions
    React.createElement('div', {
      style: {
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid ' + arrowColor,
        marginTop: '-1px'
      }
    })
  );
}

/**
 * Parallel-to-parallel connector: multiple to multiple
 * Phase 2 Redesign: Clean H-junction with balanced stems
 * Structure: input stems -> horizontal bar -> output stems with arrows
 * Uses consistent 2px lines and 5x6 arrow proportions
 */
function ParallelConnector({ inputCount, outputCount }) {
  const inputDisplay = Math.min(inputCount, 4);
  const outputDisplay = Math.min(outputCount, 4);
  const maxDisplay = Math.max(inputDisplay, outputDisplay);
  const lineColor = 'var(--q-iron2)';
  const arrowColor = 'var(--q-iron1)';

  // Calculate width based on max count (responsive) - use fixed px for consistency
  const barWidth = maxDisplay === 2 ? 100 : maxDisplay === 3 ? 150 : 200;

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0'
    }
  },
    // Input stems from top - 2px wide
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: barWidth + 'px'
      }
    },
      Array.from({ length: inputDisplay }).map((_, i) =>
        React.createElement('div', {
          key: i,
          style: {
            width: '2px',
            height: '10px',
            backgroundColor: lineColor
          }
        })
      )
    ),
    // Central horizontal bar - 2px tall
    React.createElement('div', {
      style: {
        width: barWidth + 'px',
        height: '2px',
        backgroundColor: lineColor
      }
    }),
    // Output stems with arrows
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: barWidth + 'px'
      }
    },
      Array.from({ length: outputDisplay }).map((_, i) =>
        React.createElement('div', {
          key: i,
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }
        },
          // Vertical stem - 2px wide
          React.createElement('div', {
            style: {
              width: '2px',
              height: '10px',
              backgroundColor: lineColor
            }
          }),
          // CSS chevron arrow - consistent 5x6 proportions
          React.createElement('div', {
            style: {
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '6px solid ' + arrowColor,
              marginTop: '-1px'
            }
          })
        )
      )
    )
  );
}

/**
 * Group connector that picks the right type based on job counts
 * Phase 2 Redesign: Routes to clean connector variants based on topology
 * - 1:1 = Vertical (simple flow)
 * - 1:N = FanOut (distribution)
 * - N:1 = FanIn (aggregation)
 * - N:M = Parallel (pass-through)
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

  // Both have multiple jobs - show parallel flow
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

  // Calculate chain statistics (must be before early return to preserve hook order)
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

  if (groups.length === 0 || allJobs.length === 0) {
    return React.createElement('div', {
      className: 'text-center py-8',
      style: { color: 'var(--q-bone0)' }
    }, 'No jobs in this assignment');
  }

  return React.createElement('div', { className: 'space-y-4' },
    // Chain summary with StatusRune-style RollupBadge components
    React.createElement('div', {
      className: 'flex items-center gap-4 text-xs flex-wrap',
      style: { color: 'var(--q-bone0)' }
    },
      React.createElement(RollupBadge, {
        count: stats.completed,
        label: 'DONE',
        color: 'var(--q-slime1)',
        pulse: false
      }),
      React.createElement(RollupBadge, {
        count: stats.running,
        label: 'RUNNING',
        color: 'var(--q-teleport-bright)',
        pulse: true
      }),
      React.createElement(RollupBadge, {
        count: stats.pending,
        label: 'PENDING',
        color: 'var(--q-torch)',
        pulse: false
      }),
      React.createElement(RollupBadge, {
        count: stats.failed,
        label: 'FAILED',
        color: 'var(--q-lava1)',
        pulse: false
      })
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
