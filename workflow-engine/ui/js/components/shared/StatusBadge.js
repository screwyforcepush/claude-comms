// StatusBadge - Reusable status indicator component
// WP-4: Transformed to Q palette StatusRune pattern
import React from 'react';

/**
 * Map statuses to Q palette CSS modifier classes
 * active/running -> slime (success)
 * pending/idle -> torch (warning)
 * blocked/failed/error -> lava (danger)
 * complete -> slime (success)
 * offline/unknown -> iron (muted)
 */
const statusModifiers = {
  active: 'status-rune--active',
  running: 'status-rune--running',
  pending: 'status-rune--pending',
  idle: 'status-rune--idle',
  blocked: 'status-rune--blocked',
  failed: 'status-rune--failed',
  error: 'status-rune--error',
  complete: 'status-rune--complete',
  offline: 'status-rune--offline',
  unknown: 'status-rune--unknown',
  warp: 'status-rune--warp',
};

/**
 * StatusBadge component - displays a status indicator with Q palette styling
 * Uses the StatusRune pattern with fullbright dot and display font
 * @param {Object} props
 * @param {string} props.status - Status value (pending|active|blocked|complete|running|failed|idle|error|offline|warp)
 * @param {string} props.size - Badge size (sm|md|lg), defaults to 'md'
 * @param {string} props.label - Optional custom label override
 */
export function StatusBadge({ status, size = 'md', label }) {
  // Get modifier class or fallback to unknown
  const modifierClass = statusModifiers[status] || 'status-rune--unknown';

  // Format status text - uppercase for display font
  const statusText = label || (status ? status.toUpperCase() : 'UNKNOWN');

  // Determine if we should show pulsing dot (active/running states)
  const shouldPulse = status === 'active' || status === 'running';

  return React.createElement('span', {
    className: `status-rune ${modifierClass}`
  },
    // Fullbright dot with glow
    React.createElement('span', {
      className: `fullbright-dot${size === 'sm' ? ' fullbright-dot--sm' : size === 'lg' ? ' fullbright-dot--lg' : ''}${shouldPulse ? ' fullbright-pulse' : ''}`
    }),
    statusText
  );
}

/**
 * StatusDot - A small circular status indicator with fullbright glow
 * @param {Object} props
 * @param {string} props.status - Status value
 * @param {boolean} props.pulse - Whether to animate the dot
 * @param {string} props.size - Size: 'sm' | 'md' | 'lg'
 */
export function StatusDot({ status, pulse = false, size = 'md' }) {
  const modifierClass = statusModifiers[status] || 'status-rune--unknown';
  const sizeClass = size === 'sm' ? 'fullbright-dot--sm' : size === 'lg' ? 'fullbright-dot--lg' : '';
  const pulseClass = pulse ? 'fullbright-pulse' : '';

  // We need to extract just the color from the status-rune for the dot
  // Apply the parent status-rune class to inherit the color
  return React.createElement('span', {
    className: `status-rune ${modifierClass}`,
    style: {
      padding: 0,
      background: 'none',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
    }
  },
    React.createElement('span', {
      className: `fullbright-dot ${sizeClass} ${pulseClass}`
    })
  );
}

/**
 * StatusText - Text-only status display with Q palette color
 * @param {Object} props
 * @param {string} props.status - Status value
 * @param {string} props.label - Optional custom label override
 */
export function StatusText({ status, label }) {
  const modifierClass = statusModifiers[status] || 'status-rune--unknown';
  const statusText = label || (status ? status.toUpperCase() : 'UNKNOWN');

  // Use status-rune class just for color inheritance, override other styles
  return React.createElement('span', {
    className: `status-rune ${modifierClass}`,
    style: {
      padding: 0,
      background: 'none',
      border: 'none',
    }
  }, statusText);
}

export default StatusBadge;
