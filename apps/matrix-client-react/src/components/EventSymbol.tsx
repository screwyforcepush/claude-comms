import React, { useState, useEffect } from 'react';
import { getRandomChar } from '../utils/characters';

interface EventSymbolProps {
  char: string;
  isPrimary?: boolean;
  opacity?: number;
  colorTheme?: 'green' | 'red' | 'blue' | 'yellow' | 'cyan' | 'white';
}

const EventSymbol: React.FC<EventSymbolProps> = ({ char, isPrimary = false, opacity = 1, colorTheme = 'green' }) => {
  const [displayChar, setDisplayChar] = useState<string>(char);
  const [isGlowing, setIsGlowing] = useState<boolean>(isPrimary);
  const [isGlitching, setIsGlitching] = useState<boolean>(false);

  useEffect(() => {
    setDisplayChar(char);
    
    // Make the character glow briefly when it changes
    if (isPrimary) {
      setIsGlowing(true);
      const timer = setTimeout(() => setIsGlowing(false), 500);
      return () => clearTimeout(timer);
    }
  }, [char, isPrimary]);

  useEffect(() => {
    // Create glitchy effect - some characters occasionally flicker to random chars
    if (isPrimary || Math.random() > 0.95) {
      const glitchInterval = setInterval(() => {
        setIsGlitching(true);
        setDisplayChar(getRandomChar());
        
        // Return to original character after brief glitch
        setTimeout(() => {
          setDisplayChar(char);
          setIsGlitching(false);
        }, 150);
      }, 550);

      return () => clearInterval(glitchInterval);
    }
  }, [char, isPrimary]);

  // Just return the character as-is for readability
  const getMatrixChar = (originalChar: string): string => {
    return originalChar;
  };

  // Get colors based on theme
  const getColors = () => {
    const colors = {
      green: { primary: '#00ff41', glow: '#00ff41' },
      red: { primary: '#ff4444', glow: '#ff4444' },
      blue: { primary: '#4488ff', glow: '#4488ff' },
      yellow: { primary: '#ffff44', glow: '#ffff44' },
      cyan: { primary: '#44ffff', glow: '#44ffff' },
      white: { primary: '#ffffff', glow: '#ffffff' }
    };
    return colors[colorTheme] || colors.green;
  };

  const { primary: primaryColor, glow: glowColor } = getColors();

  return (
    <div
      className={`event-symbol ${isPrimary ? 'primary' : ''} ${isGlowing ? 'glowing' : ''}`}
      style={{ 
        opacity,
        fontSize: '24px',
        lineHeight: '35px',
        height: '35px',
        width: '18px',
        textAlign: 'center',
        fontFamily: 'Courier New, monospace',
        color: isPrimary || isGlowing ? '#ffffff' : primaryColor,
        textShadow: isPrimary || isGlowing 
          ? `0 0 5px #ffffff, 0 0 10px ${glowColor}, 0 0 15px ${glowColor}, 0 0 20px ${glowColor}, 0 0 25px ${glowColor}` 
          : `0 0 3px ${glowColor}, 0 0 6px ${glowColor}, 0 0 9px ${glowColor}`,
        display: 'block',
        transition: isGlitching ? 'none' : 'all 0.1s ease',
        transform: (isPrimary || isGlowing) ? 'scale(1.1)' : 'scale(1)',
        filter: isPrimary || isGlowing ? 'brightness(1.8)' : 'brightness(1.2)',
        animation: isPrimary ? 'primaryGlow 1.5s ease-in-out infinite alternate' : 'none'
      }}
    >
      {getMatrixChar(displayChar)}
    </div>
  );
};

export default EventSymbol;