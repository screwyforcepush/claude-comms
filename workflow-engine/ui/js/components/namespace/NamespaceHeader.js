// NamespaceHeader - Header for selected namespace
import React from 'react';
import { StatusBadge } from '../shared/StatusBadge.js';

/**
 * Metric card for status counts
 */
function MetricCard({ label, count, status }) {
  const colors = {
    pending: 'border-yellow-500/30 text-yellow-400',
    active: 'border-blue-500/30 text-blue-400',
    blocked: 'border-red-500/30 text-red-400',
    complete: 'border-green-500/30 text-green-400'
  };

  return React.createElement('div', {
    className: `bg-gray-800 border ${colors[status]?.split(' ')[0] || 'border-gray-700'} rounded-lg p-3 text-center min-w-[80px]`
  },
    React.createElement('div', {
      className: `text-2xl font-bold ${colors[status]?.split(' ')[1] || 'text-gray-300'}`
    }, count),
    React.createElement('div', { className: 'text-xs text-gray-500 capitalize' }, label)
  );
}

/**
 * NamespaceHeader component - displays header for selected namespace
 * @param {Object} props
 * @param {Object} props.namespace - Namespace data { name, counts }
 */
export function NamespaceHeader({ namespace }) {
  if (!namespace) {
    return React.createElement('div', { className: 'p-6 text-center text-gray-500' },
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

  return React.createElement('div', { className: 'bg-gray-800 border-b border-gray-700 p-6' },
    // Top row: namespace name, status, actions
    React.createElement('div', { className: 'flex items-center justify-between mb-4' },
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('h1', { className: 'text-2xl font-bold text-white' }, name),
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
      // Total assignments
      React.createElement('div', {
        className: 'bg-gray-800 border border-gray-700 rounded-lg p-3 text-center min-w-[80px]'
      },
        React.createElement('div', { className: 'text-2xl font-bold text-gray-300' }, total),
        React.createElement('div', { className: 'text-xs text-gray-500' }, 'Total')
      )
    )
  );
}

export default NamespaceHeader;
