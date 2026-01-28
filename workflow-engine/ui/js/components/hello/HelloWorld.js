// HelloWorld - Simple test page demonstrating basic page structure
import React from 'react';

/**
 * HelloWorld component - A simple test page displaying centered text
 * Demonstrates the basic page structure and routing pattern for the workflow-engine UI
 */
export function HelloWorld() {
  return React.createElement('div', {
    className: 'flex-1 flex items-center justify-center bg-gray-900'
  },
    React.createElement('div', { className: 'text-center p-8' },
      // Sparkle icon
      React.createElement('svg', {
        className: 'w-16 h-16 text-yellow-400 mx-auto mb-6',
        fill: 'none',
        stroke: 'currentColor',
        viewBox: '0 0 24 24',
        strokeWidth: '1.5'
      },
        React.createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          d: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z'
        })
      ),
      // Hello World text
      React.createElement('h1', {
        className: 'text-4xl font-bold text-white mb-4'
      }, 'Hello World'),
      React.createElement('p', {
        className: 'text-gray-400 max-w-md'
      }, 'This is a test page demonstrating the basic page structure and routing pattern.')
    )
  );
}

export default HelloWorld;
