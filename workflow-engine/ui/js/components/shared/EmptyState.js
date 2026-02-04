// EmptyState - Empty list placeholder component
// WP-4: Transformed to Q palette bone colors
import React from 'react';

/**
 * Default icons for common empty states
 * Icon colors will be inherited from parent via currentColor
 */
const icons = {
  // Inbox/empty list icon
  inbox: () => React.createElement('svg', {
    className: 'w-16 h-16',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z'
    })
  ),

  // Search/not found icon
  search: () => React.createElement('svg', {
    className: 'w-16 h-16',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z'
    })
  ),

  // Folder icon
  folder: () => React.createElement('svg', {
    className: 'w-16 h-16',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
    })
  ),

  // Document/file icon
  document: () => React.createElement('svg', {
    className: 'w-16 h-16',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
    })
  ),

  // Error/warning icon
  error: () => React.createElement('svg', {
    className: 'w-16 h-16',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.5'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'
    })
  )
};

/**
 * EmptyState component - displays a placeholder when a list is empty
 * Uses Q palette bone colors for text hierarchy
 * @param {Object} props
 * @param {string} props.icon - Icon type: 'inbox' | 'search' | 'folder' | 'document' | 'error'
 * @param {string} props.title - Main heading text
 * @param {string} props.description - Descriptive text
 * @param {Object} props.action - Optional action button { label: string, onClick: function }
 * @param {string} props.className - Additional CSS classes
 */
export function EmptyState({
  icon = 'inbox',
  title = 'No items',
  description = '',
  action,
  className = ''
}) {
  const IconComponent = icons[icon] || icons.inbox;

  return React.createElement('div', {
    className: `empty-state empty-state-q fade-in ${className}`
  },
    // Icon - Q palette bone0 (muted)
    React.createElement('div', {
      className: 'empty-state-icon mb-4',
      style: { color: 'var(--q-bone0)' }
    }, React.createElement(IconComponent)),

    // Title - Q palette bone3 (bright text)
    React.createElement('h3', {
      className: 'empty-state-title text-lg font-medium mb-2',
      style: {
        color: 'var(--q-bone3)',
        fontFamily: 'var(--font-display)',
        letterSpacing: 'var(--t-type-tracking-normal)',
        textTransform: 'uppercase'
      }
    }, title),

    // Description - Q palette bone0 (muted text)
    description && React.createElement('p', {
      className: 'empty-state-description text-sm max-w-sm',
      style: {
        color: 'var(--q-bone0)',
        fontFamily: 'var(--font-body)'
      }
    }, description),

    // Action button - Q palette button
    action && React.createElement('button', {
      onClick: action.onClick,
      className: 'mt-4 q-btn q-btn--primary q-btn--md'
    }, action.label)
  );
}

export default EmptyState;
