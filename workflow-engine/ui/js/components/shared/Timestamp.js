// Timestamp - Relative time display component
import React, { useState, useEffect } from 'react';

/**
 * Format a date to relative time string
 * @param {number|string} date - Unix timestamp (ms) or ISO string
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
  if (!date) return 'Unknown';

  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date;
  const now = Date.now();
  const diff = now - timestamp;

  // Future date
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return 'in a moment';
    if (absDiff < 3600000) return `in ${Math.floor(absDiff / 60000)}m`;
    if (absDiff < 86400000) return `in ${Math.floor(absDiff / 3600000)}h`;
    return `in ${Math.floor(absDiff / 86400000)}d`;
  }

  // Past date
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'yesterday';
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  // Format as date for older times
  const dateObj = new Date(timestamp);
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date to absolute time string
 * @param {number|string} date - Unix timestamp (ms) or ISO string
 * @returns {string} Formatted date string
 */
function formatAbsoluteTime(date) {
  if (!date) return 'Unknown';

  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date;
  const dateObj = new Date(timestamp);

  return dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Timestamp component - displays time in relative or absolute format
 * @param {Object} props
 * @param {number|string} props.date - Unix timestamp (ms) or ISO string
 * @param {string} props.format - Display format: 'relative' | 'absolute' | 'both'
 * @param {string} props.className - Additional CSS classes
 */
export function Timestamp({ date, format = 'relative', className = '' }) {
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(date));

  // Update relative time periodically
  useEffect(() => {
    if (format === 'absolute') return;

    // Update interval based on how old the timestamp is
    const timestamp = typeof date === 'string' ? new Date(date).getTime() : date;
    const age = Date.now() - timestamp;

    // Update more frequently for recent times
    let interval;
    if (age < 60000) {
      interval = 10000; // Every 10s for <1min
    } else if (age < 3600000) {
      interval = 60000; // Every 1min for <1hr
    } else {
      interval = 300000; // Every 5min for older
    }

    const timer = setInterval(() => {
      setRelativeTime(formatRelativeTime(date));
    }, interval);

    return () => clearInterval(timer);
  }, [date, format]);

  // Update when date changes
  useEffect(() => {
    setRelativeTime(formatRelativeTime(date));
  }, [date]);

  if (!date) {
    return React.createElement('span', { className: `text-gray-500 ${className}` }, '-');
  }

  const absoluteTime = formatAbsoluteTime(date);

  if (format === 'absolute') {
    return React.createElement('span', {
      className: `text-gray-400 ${className}`
    }, absoluteTime);
  }

  if (format === 'both') {
    return React.createElement('span', {
      className: `text-gray-400 ${className}`,
      title: absoluteTime
    },
      relativeTime,
      React.createElement('span', { className: 'text-gray-600 ml-1' }, `(${absoluteTime})`)
    );
  }

  // Default: relative with absolute tooltip
  return React.createElement('span', {
    className: `text-gray-400 cursor-default tooltip ${className}`
  },
    relativeTime,
    React.createElement('span', { className: 'tooltip-content' }, absoluteTime)
  );
}

export default Timestamp;
