// NamespaceHeader - Header for selected namespace
// WP-5: Transformed to Q palette brandkit styling with riveted panel aesthetic
import React from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';

/**
 * Status color mappings for MetricCard using Q palette CSS variables
 * - pending: torch (warning/attention)
 * - active: slime (success/running)
 * - blocked: lava (danger/error)
 * - complete: slime (success)
 */
const statusColors = {
  pending: {
    border: 'var(--q-torch-33)',
    text: 'var(--q-torch)'
  },
  active: {
    border: 'var(--q-slime1-44)',
    text: 'var(--q-slime1)'
  },
  blocked: {
    border: 'var(--q-lava1-44)',
    text: 'var(--q-lava1)'
  },
  complete: {
    border: 'var(--q-slime1-44)',
    text: 'var(--q-slime1)'
  }
};

/**
 * Metric card for status counts - Q palette HUDStat pattern
 * Uses riveted panel aesthetic with status-specific glow colors
 */
function MetricCard({ label, count, status }) {
  const colors = statusColors[status] || {
    border: 'var(--q-stone3)',
    text: 'var(--q-bone1)'
  };

  return React.createElement('div', {
    className: 'rounded-lg p-3 text-center min-w-[80px]',
    style: {
      background: 'var(--q-stone1)',
      border: `1px solid ${colors.border}`,
      borderRadius: 'var(--t-border-radius)'
    }
  },
    // Count number - display font, stat-medium size
    React.createElement('div', {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--t-type-size-stat-medium)',
        color: colors.text,
        lineHeight: 'var(--t-type-leading-tight)',
        textShadow: `0 0 var(--t-fx-glow-sm) ${colors.text}33`
      }
    }, count),
    // Label - console font, label-small size
    React.createElement('div', {
      className: 'capitalize',
      style: {
        fontFamily: 'var(--font-console)',
        fontSize: 'var(--t-type-size-label-small)',
        color: 'var(--q-bone0)',
        letterSpacing: 'var(--t-type-tracking-tight)'
      }
    }, label)
  );
}

/**
 * NamespaceHeader component - displays header for selected namespace
 * WP-5: Q palette brandkit transformation with riveted panel aesthetic
 * @param {Object} props
 * @param {Object} props.namespace - Namespace data { name, counts }
 */
export function NamespaceHeader({ namespace }) {
  if (!namespace) {
    return React.createElement('div', {
      className: 'p-6 text-center',
      style: {
        color: 'var(--q-bone0)',
        fontFamily: 'var(--font-console)',
        fontSize: 'var(--t-type-size-body)'
      }
    },
      'Select a namespace to view details'
    );
  }

  const { name, counts = {} } = namespace;
  const total = (counts.pending || 0) + (counts.active || 0) + (counts.blocked || 0) + (counts.complete || 0);

  // Determine overall status
  let overallStatus = 'complete';
  if (counts.blocked > 0) overallStatus = 'blocked';
  else if (counts.active > 0) overallStatus = 'active';
  else if (counts.pending > 0) overallStatus = 'pending';

  return React.createElement('div', {
    className: 'p-6',
    style: {
      background: 'var(--q-stone1)',
      borderBottom: '1px solid var(--q-stone3)'
    }
  },
    // Top row: namespace name, status, actions
    React.createElement('div', { className: 'flex items-center justify-between mb-4' },
      React.createElement('div', { className: 'flex items-center gap-3' },
        // Namespace name - h1 with display font and bone4 color
        React.createElement('h1', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-title)',
            color: 'var(--q-bone4)',
            letterSpacing: 'var(--t-type-tracking-wide)',
            textShadow: '0 0 var(--t-fx-glow-sm) var(--q-torch-22)',
            margin: 0
          }
        }, name),
        React.createElement(StatusBadge, { status: overallStatus, size: 'md' })
      )
    ),

    // Metrics row
    React.createElement('div', { className: 'flex flex-wrap gap-3' },
      React.createElement(MetricCard, {
        label: 'Pending',
        count: counts.pending || 0,
        status: 'pending'
      }),
      React.createElement(MetricCard, {
        label: 'Active',
        count: counts.active || 0,
        status: 'active'
      }),
      React.createElement(MetricCard, {
        label: 'Blocked',
        count: counts.blocked || 0,
        status: 'blocked'
      }),
      React.createElement(MetricCard, {
        label: 'Complete',
        count: counts.complete || 0,
        status: 'complete'
      }),
      // Total assignments - neutral Q palette styling
      React.createElement('div', {
        className: 'rounded-lg p-3 text-center min-w-[80px]',
        style: {
          background: 'var(--q-stone1)',
          border: '1px solid var(--q-stone3)',
          borderRadius: 'var(--t-border-radius)'
        }
      },
        // Total count - display font, bone3 color
        React.createElement('div', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--t-type-size-stat-medium)',
            color: 'var(--q-bone3)',
            lineHeight: 'var(--t-type-leading-tight)'
          }
        }, total),
        // Total label - console font, bone0 color
        React.createElement('div', {
          style: {
            fontFamily: 'var(--font-console)',
            fontSize: 'var(--t-type-size-label-small)',
            color: 'var(--q-bone0)',
            letterSpacing: 'var(--t-type-tracking-tight)'
          }
        }, 'Total')
      )
    )
  );
}

export default NamespaceHeader;
