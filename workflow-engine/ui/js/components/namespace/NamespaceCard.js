// NamespaceCard - Individual namespace card in the sidebar list
import React from 'react';
import { StatusDot } from '../shared/StatusBadge.js';
import { Timestamp } from '../shared/Timestamp.js';

/**
 * Count badge for status counts
 */
function CountBadge({ count, status }) {
  if (count === 0) return null;

  const colors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    active: 'bg-blue-500/20 text-blue-400',
    blocked: 'bg-red-500/20 text-red-400',
    complete: 'bg-green-500/20 text-green-400'
  };

  return React.createElement('span', {
    className: `text-xs px-1.5 py-0.5 rounded-full ${colors[status] || 'bg-gray-600 text-gray-400'}`
  }, count);
}

/**
 * NamespaceCard component - displays a single namespace in the sidebar
 * @param {Object} props
 * @param {Object} props.namespace - Namespace data { name, counts, lastActivity }
 * @param {boolean} props.isSelected - Whether this namespace is currently selected
 * @param {Function} props.onClick - Click handler
 */
export function NamespaceCard({ namespace, isSelected = false, onClick }) {
  const { name, counts = {}, lastActivity } = namespace;

  // Calculate total active items (pending + active + blocked)
  const activeCount = (counts.pending || 0) + (counts.active || 0) + (counts.blocked || 0);

  // Determine primary status for indicator
  let primaryStatus = 'complete';
  if (counts.blocked > 0) primaryStatus = 'blocked';
  else if (counts.active > 0) primaryStatus = 'active';
  else if (counts.pending > 0) primaryStatus = 'pending';

  const selectedClass = isSelected
    ? 'bg-gray-700 border-l-2 border-blue-500'
    : 'border-l-2 border-transparent hover:bg-gray-800';

  return React.createElement('button', {
    onClick: () => onClick && onClick(namespace),
    className: `w-full text-left p-3 transition-colors ${selectedClass} focus:outline-none focus:bg-gray-700`
  },
    // Header row: name + active indicator
    React.createElement('div', { className: 'flex items-center justify-between mb-2' },
      React.createElement('span', {
        className: `font-medium truncate ${isSelected ? 'text-white' : 'text-gray-200'}`
      }, name),
      activeCount > 0 && React.createElement(StatusDot, {
        status: primaryStatus,
        pulse: primaryStatus === 'active'
      })
    ),

    // Status counts row
    React.createElement('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
      React.createElement(CountBadge, { count: counts.pending, status: 'pending' }),
      React.createElement(CountBadge, { count: counts.active, status: 'active' }),
      React.createElement(CountBadge, { count: counts.blocked, status: 'blocked' }),
      React.createElement(CountBadge, { count: counts.complete, status: 'complete' })
    ),

    // Last activity timestamp
    lastActivity && React.createElement('div', { className: 'text-xs' },
      React.createElement(Timestamp, { date: lastActivity, format: 'relative' })
    )
  );
}

export default NamespaceCard;
