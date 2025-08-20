import React, { useState, useEffect } from 'react';
import { getRandomChar } from '../utils/characters';

interface SymbolProps {
  primary?: boolean;
  opacity?: number;
}

const Symbol: React.FC<SymbolProps> = ({ primary = false, opacity = 1 }) => {
  const [char, setChar] = useState<string>(getRandomChar());

  useEffect(() => {
    if (primary || Math.random() > 0.95) {
      const interval = setInterval(() => {
        setChar(getRandomChar());
      }, 550);

      return () => clearInterval(interval);
    }
  }, [primary]);

  return (
    <div
      className={`symbol ${primary ? 'primary' : ''}`}
      style={{ 
        opacity,
        fontSize: '20px',
        lineHeight: '35px',
        height: '35px',
        width: '18px',
        textAlign: 'center',
        color: primary ? '#ffffff' : '#00ff00',
        textShadow: primary ? '0 0 10px #ffffff' : '0 0 5px #00ff00',
        display: 'block'
      }}
    >
      {char}
    </div>
  );
};

export default Symbol;