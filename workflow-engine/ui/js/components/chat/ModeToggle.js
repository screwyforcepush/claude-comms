// ModeToggle - Runic dimension tabs for Jam/Cook/Guardian modes
import React from 'react';
import { QIcon } from '../shared/index.js';

/**
 * ModeToggle component - Runic tab selector for switching between Jam, Cook, and Guardian modes
 * Styled as dimension tabs following the Claude Comms III brandkit pattern
 * @param {Object} props
 * @param {'jam' | 'cook' | 'guardian'} props.mode - Current mode
 * @param {Function} props.onChange - Callback when mode changes
 * @param {boolean} props.disabled - Whether the toggle is disabled
 * @param {boolean} props.hasAssignment - Whether thread has linked assignment (enables guardian)
 */
export function ModeToggle({ mode, onChange, disabled = false, hasAssignment = false, compact = false }) {
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
      padding: compact ? '7px 10px' : '9px 18px',
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

  // Content wrapper style
  const contentStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? '0' : '6px'
  };

  const isJamActive = mode === 'jam';
  const isCookActive = mode === 'cook';
  const isGuardianActive = mode === 'guardian';
  const isGuardianDisabled = disabled || !hasAssignment;

  return React.createElement('div', { style: containerStyle },
    // Jam button - eye icon (watching/observing)
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
        React.createElement(QIcon, {
          name: 'eye',
          size: compact ? 14 : 16,
          color: 'currentColor'
        }),
        !compact && 'Jam'
      )
    ),

    // Cook button - axe icon (action/building)
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
        React.createElement(QIcon, {
          name: 'axe',
          size: compact ? 14 : 16,
          color: 'currentColor'
        }),
        !compact && 'Cook'
      )
    ),

    // Guardian button - armor icon (protection)
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
        React.createElement(QIcon, {
          name: 'armor',
          size: compact ? 14 : 16,
          color: 'currentColor'
        }),
        !compact && 'Guardian'
      )
    )
  );
}

export default ModeToggle;
