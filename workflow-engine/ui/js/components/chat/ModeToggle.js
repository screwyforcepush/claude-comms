// ModeToggle - Binary segmented control for Jam/Cook mode
import React from 'react';

/**
 * ModeToggle component - Binary segmented control for switching between Jam and Cook modes
 * @param {Object} props
 * @param {'jam' | 'cook'} props.mode - Current mode
 * @param {Function} props.onChange - Callback when mode changes
 * @param {boolean} props.disabled - Whether the toggle is disabled
 */
export function ModeToggle({ mode, onChange, disabled = false }) {
  const handleModeChange = (newMode) => {
    if (!disabled && newMode !== mode && onChange) {
      onChange(newMode);
    }
  };

  return React.createElement('div', {
    className: 'inline-flex rounded-lg bg-gray-800 p-1'
  },
    // Jam button
    React.createElement('button', {
      type: 'button',
      onClick: () => handleModeChange('jam'),
      disabled: disabled,
      className: `px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
        mode === 'jam'
          ? 'bg-blue-500 text-white shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`,
      title: 'Jam mode: Read-only ideation - helps spec out ideas'
    },
      React.createElement('span', { className: 'flex items-center gap-1.5' },
        React.createElement('svg', {
          className: 'w-4 h-4',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '2'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
          })
        ),
        'Jam'
      )
    ),

    // Cook button
    React.createElement('button', {
      type: 'button',
      onClick: () => handleModeChange('cook'),
      disabled: disabled,
      className: `px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
        mode === 'cook'
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`,
      title: 'Cook mode: Full autonomy - can create assignments and insert jobs'
    },
      React.createElement('span', { className: 'flex items-center gap-1.5' },
        React.createElement('svg', {
          className: 'w-4 h-4',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '2'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z'
          }),
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z'
          })
        ),
        'Cook'
      )
    )
  );
}

export default ModeToggle;
