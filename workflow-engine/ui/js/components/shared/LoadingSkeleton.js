// LoadingSkeleton - Loading placeholder component
// WP-4: Transformed to Q palette stone colors
import React from 'react';

/**
 * LoadingSkeleton component - displays animated loading placeholders
 * Uses Q palette stone colors via skeleton-q CSS class
 * @param {Object} props
 * @param {string} props.variant - Type of skeleton: 'text' | 'card' | 'list' | 'badge' | 'avatar'
 * @param {number} props.count - Number of skeletons to render (for lists)
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingSkeleton({ variant = 'text', count = 1, className = '' }) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  const renderSkeleton = (index) => {
    switch (variant) {
      case 'text':
        return React.createElement('div', {
          key: index,
          className: `skeleton-q h-4 rounded ${className || 'w-full'}`,
          style: { minWidth: '60px' }
        });

      case 'badge':
        return React.createElement('div', {
          key: index,
          className: `skeleton-q h-5 w-16 rounded-full ${className}`
        });

      case 'avatar':
        return React.createElement('div', {
          key: index,
          className: `skeleton-q h-10 w-10 rounded-full ${className}`
        });

      case 'card':
        // Card uses Q palette stone colors via CSS variables
        return React.createElement('div', {
          key: index,
          className: `p-4 ${className}`,
          style: {
            backgroundColor: 'var(--q-stone1)',
            border: '1px solid var(--q-stone3)',
            borderRadius: 'var(--t-border-radius)'
          }
        },
          // Header
          React.createElement('div', { className: 'flex items-center justify-between mb-3' },
            React.createElement('div', { className: 'skeleton-q h-5 w-32 rounded' }),
            React.createElement('div', { className: 'skeleton-q h-5 w-16 rounded-full' })
          ),
          // Body lines
          React.createElement('div', { className: 'space-y-2' },
            React.createElement('div', { className: 'skeleton-q h-4 w-full rounded' }),
            React.createElement('div', { className: 'skeleton-q h-4 w-3/4 rounded' })
          ),
          // Footer
          React.createElement('div', { className: 'mt-4 flex items-center gap-2' },
            React.createElement('div', { className: 'skeleton-q h-3 w-20 rounded' }),
            React.createElement('div', { className: 'skeleton-q h-3 w-24 rounded' })
          )
        );

      case 'list':
        return React.createElement('div', {
          key: index,
          className: `flex items-center gap-3 p-3 ${className}`
        },
          // Icon/avatar placeholder
          React.createElement('div', { className: 'skeleton-q h-8 w-8 rounded-full flex-shrink-0' }),
          // Content
          React.createElement('div', { className: 'flex-1 space-y-2' },
            React.createElement('div', { className: 'skeleton-q h-4 w-2/3 rounded' }),
            React.createElement('div', { className: 'skeleton-q h-3 w-1/2 rounded' })
          )
        );

      case 'namespace':
        // Specialized skeleton for namespace cards - Q palette borders
        return React.createElement('div', {
          key: index,
          className: `p-3 ${className}`,
          style: {
            borderBottom: '1px solid var(--q-stone3)'
          }
        },
          React.createElement('div', { className: 'flex items-center justify-between mb-2' },
            React.createElement('div', { className: 'skeleton-q h-5 w-28 rounded' }),
            React.createElement('div', { className: 'skeleton-q h-4 w-4 rounded-full' })
          ),
          React.createElement('div', { className: 'flex gap-2' },
            React.createElement('div', { className: 'skeleton-q h-4 w-10 rounded-full' }),
            React.createElement('div', { className: 'skeleton-q h-4 w-10 rounded-full' }),
            React.createElement('div', { className: 'skeleton-q h-4 w-10 rounded-full' })
          ),
          React.createElement('div', { className: 'mt-2 skeleton-q h-3 w-20 rounded' })
        );

      default:
        return React.createElement('div', {
          key: index,
          className: `skeleton-q h-4 w-full rounded ${className}`
        });
    }
  };

  if (count === 1) {
    return renderSkeleton(0);
  }

  return React.createElement('div', { className: 'space-y-2' },
    skeletons.map(renderSkeleton)
  );
}

/**
 * Inline loading spinner
 * Uses Q palette copper accent for spinner
 * @param {Object} props
 * @param {string} props.size - Size: 'sm' | 'md' | 'lg'
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return React.createElement('div', {
    className: `spin-animation ${sizeClasses[size]} rounded-full ${className}`,
    style: {
      border: '2px solid var(--q-stone3)',
      borderTopColor: 'var(--q-copper2)'
    }
  });
}

export default LoadingSkeleton;
