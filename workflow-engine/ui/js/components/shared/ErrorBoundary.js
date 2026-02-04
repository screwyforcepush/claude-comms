// ErrorBoundary - Error handling wrapper component
// WP-4: Transformed to Q palette lava/danger colors
import React from 'react';

/**
 * ErrorBoundary component - catches render errors and displays fallback UI
 * Uses Q palette lava colors for error styling
 * This is a class component because error boundaries require lifecycle methods
 * that aren't available in function components.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI with Q palette lava/danger colors
      return React.createElement('div', {
        className: `error-boundary-q p-6 ${this.props.className || ''}`,
        style: {
          backgroundColor: 'var(--q-stone1)',
          border: '1px solid var(--q-lava1-44)',
          borderRadius: 'var(--t-border-radius)'
        }
      },
        // Error icon and title row
        React.createElement('div', { className: 'flex items-center gap-3 mb-4' },
          React.createElement('svg', {
            className: 'error-icon w-8 h-8',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24',
            strokeWidth: '1.5',
            style: { color: 'var(--q-lava1)' }
          },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              d: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
            })
          ),
          React.createElement('h3', {
            className: 'error-title text-lg font-semibold',
            style: {
              color: 'var(--q-lava1)',
              fontFamily: 'var(--font-display)',
              letterSpacing: 'var(--t-type-tracking-normal)',
              textTransform: 'uppercase'
            }
          }, 'Something went wrong')
        ),

        // Error message
        React.createElement('p', {
          className: 'error-message mb-4',
          style: {
            color: 'var(--q-bone1)',
            fontFamily: 'var(--font-body)'
          }
        }, this.state.error?.message || 'An unexpected error occurred'),

        // Error details (collapsed by default for dev mode)
        this.state.errorInfo && React.createElement('details', {
          className: 'error-details mb-4'
        },
          React.createElement('summary', {
            className: 'text-sm cursor-pointer',
            style: { color: 'var(--q-bone0)' }
          }, 'Technical details'),
          React.createElement('pre', {
            className: 'mt-2 p-3 rounded text-xs overflow-auto max-h-40',
            style: {
              backgroundColor: 'var(--q-void1)',
              border: '1px solid var(--q-stone3)',
              color: 'var(--q-bone0)',
              fontFamily: 'var(--font-console)'
            }
          }, this.state.errorInfo.componentStack)
        ),

        // Retry button with Q palette lava styling
        React.createElement('button', {
          onClick: this.handleRetry,
          className: 'q-btn q-btn--lava q-btn--md'
        },
          React.createElement('svg', {
            className: 'w-4 h-4 mr-2',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24',
            strokeWidth: '2'
          },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            })
          ),
          'Try again'
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with error boundary
 * @param {React.Component} WrappedComponent
 * @param {Object} boundaryProps - Props to pass to ErrorBoundary
 */
export function withErrorBoundary(WrappedComponent, boundaryProps = {}) {
  return function WithErrorBoundaryWrapper(props) {
    return React.createElement(ErrorBoundary, boundaryProps,
      React.createElement(WrappedComponent, props)
    );
  };
}

export default ErrorBoundary;
