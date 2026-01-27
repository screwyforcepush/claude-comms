// ErrorBoundary - Error handling wrapper component
import React from 'react';

/**
 * ErrorBoundary component - catches render errors and displays fallback UI
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

      // Default error UI
      return React.createElement('div', {
        className: `bg-gray-800 border border-red-500/30 rounded-lg p-6 ${this.props.className || ''}`
      },
        // Error icon
        React.createElement('div', { className: 'flex items-center gap-3 mb-4' },
          React.createElement('svg', {
            className: 'w-8 h-8 text-red-500',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24',
            strokeWidth: '1.5'
          },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              d: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
            })
          ),
          React.createElement('h3', {
            className: 'text-lg font-semibold text-red-400'
          }, 'Something went wrong')
        ),

        // Error message
        React.createElement('p', {
          className: 'text-gray-400 mb-4'
        }, this.state.error?.message || 'An unexpected error occurred'),

        // Error details (collapsed by default for dev mode)
        this.state.errorInfo && React.createElement('details', {
          className: 'mb-4'
        },
          React.createElement('summary', {
            className: 'text-sm text-gray-500 cursor-pointer hover:text-gray-400'
          }, 'Technical details'),
          React.createElement('pre', {
            className: 'mt-2 p-3 bg-gray-900 rounded text-xs text-gray-400 overflow-auto max-h-40'
          }, this.state.errorInfo.componentStack)
        ),

        // Retry button
        React.createElement('button', {
          onClick: this.handleRetry,
          className: 'btn btn-primary'
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
