// ModeToggle - Runic dimension tabs for Jam/Cook/Guardian modes
import React from 'react';

/**
 * ModeToggle component - Runic tab selector for switching between Jam, Cook, and Guardian modes
 * Styled as dimension tabs following the Claude Comms III brandkit pattern
 * @param {Object} props
 * @param {'jam' | 'cook' | 'guardian'} props.mode - Current mode
 * @param {Function} props.onChange - Callback when mode changes
 * @param {boolean} props.disabled - Whether the toggle is disabled
 * @param {boolean} props.hasAssignment - Whether thread has linked assignment (enables guardian)
 */
export function ModeToggle({ mode, onChange, disabled = false, hasAssignment = false }) {
  const handleModeChange = (newMode) => {
    if (!disabled && newMode !== mode && onChange) {
      onChange(newMode);
    }
  };

  // Mode accent colors mapping
  const modeAccents = {
    jam: 'var(--q-teleport-bright)',
    cook: 'var(--q-torch)',
    guardian: 'var(--q-slime1)'
  };

  // Get button style based on mode and active state
  const getButtonStyle = (buttonMode, isActive, isButtonDisabled) => {
    const baseStyle = {
      fontFamily: 'var(--font-display)',
      fontSize: '10px',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      padding: '9px 18px',
      border: 'none',
      borderRadius: '0',
      borderBottom: '2px solid transparent',
      borderTop: '1px solid transparent',
      marginBottom: '-2px',
      transition: 'all 0.1s',
      cursor: isButtonDisabled ? 'not-allowed' : 'pointer'
    };

    if (isButtonDisabled) {
      return {
        ...baseStyle,
        background: 'var(--q-void1)',
        color: 'var(--q-iron1)',
        cursor: 'not-allowed'
      };
    }

    if (isActive) {
      const accentColor = modeAccents[buttonMode];
      return {
        ...baseStyle,
        background: 'linear-gradient(180deg, var(--q-stone2), var(--q-stone1))',
        color: accentColor,
        borderBottom: `2px solid ${accentColor}`,
        borderTop: '1px solid var(--q-stone3)'
      };
    }

    // Inactive state
    return {
      ...baseStyle,
      background: 'var(--q-void1)',
      color: 'var(--q-bone0)'
    };
  };

  // Hover handler for inactive buttons
  const handleMouseEnter = (e, isActive, isButtonDisabled) => {
    if (!isActive && !isButtonDisabled) {
      e.currentTarget.style.color = 'var(--q-bone2)';
    }
  };

  const handleMouseLeave = (e, isActive, isButtonDisabled) => {
    if (!isActive && !isButtonDisabled) {
      e.currentTarget.style.color = 'var(--q-bone0)';
    }
  };

  // Container style - runic dimension tabs container
  const containerStyle = {
    display: 'flex',
    gap: '1px',
    background: 'var(--q-void0)',
    borderBottom: '2px solid var(--q-stone3)'
  };

  // Icon style - inherits color from parent
  const iconStyle = {
    width: '16px',
    height: '16px'
  };

  // Content wrapper style
  const contentStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const isJamActive = mode === 'jam';
  const isCookActive = mode === 'cook';
  const isGuardianActive = mode === 'guardian';
  const isGuardianDisabled = disabled || !hasAssignment;

  return React.createElement('div', { style: containerStyle },
    // Jam button
    React.createElement('button', {
      type: 'button',
      onClick: () => handleModeChange('jam'),
      disabled: disabled,
      style: getButtonStyle('jam', isJamActive, disabled),
      onMouseEnter: (e) => handleMouseEnter(e, isJamActive, disabled),
      onMouseLeave: (e) => handleMouseLeave(e, isJamActive, disabled),
      title: 'Jam mode: Read-only ideation - helps spec out ideas'
    },
      React.createElement('span', { style: contentStyle },
        React.createElement('svg', {
          style: iconStyle,
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
      style: getButtonStyle('cook', isCookActive, disabled),
      onMouseEnter: (e) => handleMouseEnter(e, isCookActive, disabled),
      onMouseLeave: (e) => handleMouseLeave(e, isCookActive, disabled),
      title: 'Cook mode: Full autonomy - can create assignments and insert jobs'
    },
      React.createElement('span', { style: contentStyle },
        React.createElement('svg', {
          style: iconStyle,
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
    ),

    // Guardian button (only enabled when assignment is linked)
    React.createElement('button', {
      type: 'button',
      onClick: () => handleModeChange('guardian'),
      disabled: isGuardianDisabled,
      style: getButtonStyle('guardian', isGuardianActive, isGuardianDisabled),
      onMouseEnter: (e) => handleMouseEnter(e, isGuardianActive, isGuardianDisabled),
      onMouseLeave: (e) => handleMouseLeave(e, isGuardianActive, isGuardianDisabled),
      title: hasAssignment
        ? 'Guardian mode: PO monitors alignment during assignment execution'
        : 'Guardian mode requires a linked assignment'
    },
      React.createElement('span', { style: contentStyle },
        React.createElement('svg', {
          style: iconStyle,
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '2'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
          })
        ),
        'Guardian'
      )
    )
  );
}

export default ModeToggle;
