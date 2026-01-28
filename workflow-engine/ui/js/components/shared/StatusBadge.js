// StatusBadge - Reusable status indicator component
import React from 'react';
import { statusColors, statusTextColors, statusBorderColors } from '../../api.js';

/**
 * StatusBadge component - displays a status indicator with appropriate styling
 * @param {Object} props
 * @param {string} props.status - Status value (pending|active|blocked|complete|running|failed)
 * @param {string} props.size - Badge size (sm|md|lg), defaults to 'md'
 */
export function StatusBadge({ status, size = 'md' }) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base'
  };

  // Get background color class or fallback to gray
  const bgColor = statusColors[status] || 'bg-gray-500';

  // Format status text - capitalize first letter
  const statusText = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return React.createElement('span', {
    className: `inline-flex items-center font-medium rounded-full text-white ${bgColor} ${sizeClasses[size] || sizeClasses.md}`
  }, statusText);
}

/**
 * StatusDot - A small circular status indicator
 * @param {Object} props
 * @param {string} props.status - Status value
 * @param {boolean} props.pulse - Whether to animate the dot
 */
export function StatusDot({ status, pulse = false }) {
  const bgColor = statusColors[status] || 'bg-gray-500';
  const pulseClass = pulse ? 'pulse-animation' : '';

  return React.createElement('span', {
    className: `status-dot ${bgColor} ${pulseClass}`
  });
}

/**
 * StatusText - Text-only status display with color
 * @param {Object} props
 * @param {string} props.status - Status value
 */
export function StatusText({ status }) {
  const textColor = statusTextColors[status] || 'text-gray-400';
  const statusText = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return React.createElement('span', {
    className: `font-medium ${textColor}`
  }, statusText);
}

export default StatusBadge;
