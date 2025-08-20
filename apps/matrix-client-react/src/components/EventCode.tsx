import React, { useState, useEffect } from 'react';
import EventSymbol from './EventSymbol';
import { getRandomNumber, getRandomInt } from '../utils/characters';

const SYMBOL_HEIGHT = 35;
const SYMBOL_WIDTH = 18;

interface EventCodeProps {
  eventData: string;
  columnIndex: number;
}

const EventCode: React.FC<EventCodeProps> = ({ eventData, columnIndex }) => {
  const [state, setState] = useState({
    yPosition: 0,
    xPosition: 0,
    transition: '',
    transform: '',
    isAnimating: false,
    speed: 5,
    totalHeight: 0
  });

  useEffect(() => {
    // Some lines are zoomed-in, some zoomed-out for depth
    const scaleRatio = getRandomNumber(0.6, 1.8);
    
    // Better column spacing - add randomization to spread them out
    const stepCount = Math.round((window.innerWidth - 40) / (SYMBOL_WIDTH * 1.5));
    const baseColumn = columnIndex % stepCount;
    const randomOffset = getRandomInt(-20, 20); // Add some randomness
    const xPosition = (baseColumn * SYMBOL_WIDTH * 1.5) + randomOffset;
    
    // Calculate total height needed for all characters
    const totalHeight = eventData.length * SYMBOL_HEIGHT * scaleRatio;
    
    // Start position - entire string above viewport
    const yPosition = -(totalHeight + getRandomInt(100, 300));
    
    // Much faster and more varied speeds
    const baseSpeed = getRandomNumber(3, 8); // Faster base speed
    const speedVariation = eventData.length * 0.02; // Less penalty for long strings
    const speed = (baseSpeed + speedVariation) / scaleRatio;
    const transition = `top linear ${speed}s`;
    const transform = `scale(${scaleRatio})`;

    setState({
      yPosition,
      xPosition,
      transition,
      transform,
      isAnimating: false,
      speed,
      totalHeight
    });

    // Start animation with more varied delays
    const startTime = getRandomInt(0, 2000);
    setTimeout(() => {
      // Move to bottom of screen plus extra to ensure it goes off screen
      const newPosition = window.innerHeight + 300;
      setState(prev => ({
        ...prev,
        yPosition: newPosition,
        isAnimating: true
      }));
    }, startTime);
  }, [columnIndex, eventData]);

  // Convert event data to array of characters - keep normal order so first char leads
  const chars = eventData.split('');
  
  // Determine color theme based on event content or randomize
  const getColorTheme = () => {
    if (eventData.includes('error') || eventData.includes('ERROR')) return 'red';
    if (eventData.includes('warning') || eventData.includes('WARN')) return 'yellow';
    if (eventData.includes('priority') || eventData.includes('PRIORITY')) return 'cyan';
    if (Math.random() > 0.8) return 'blue'; // 20% chance for blue
    if (Math.random() > 0.9) return 'white'; // 10% chance for white
    return 'green'; // Default Matrix green
  };
  
  const colorTheme = getColorTheme();
  
  const symbols = chars.map((char, i) => {
    // Better opacity gradient - brightest at the top (leading edge)
    const totalChars = chars.length;
    const fadeLength = Math.min(15, Math.floor(totalChars * 0.7)); // Fade over 15 chars or 70% of length
    
    let opacity;
    if (i === 0) {
      opacity = 1; // Brightest leading character (first char, at top)
    } else if (i <= 3) {
      opacity = 0.9 - (i * 0.1); // Next few chars stay bright
    } else if (i <= fadeLength) {
      opacity = Math.max(0.1, 0.7 - ((i - 3) * 0.08)); // Gradual fade
    } else {
      opacity = Math.max(0.05, 0.2 - ((i - fadeLength) * 0.02)); // Very dim tail
    }
    
    return (
      <EventSymbol 
        key={i} 
        char={char}
        opacity={opacity} 
        isPrimary={i === 0} // First character (top) is primary/brightest
        colorTheme={colorTheme}
      />
    );
  });

  return (
    <div
      className="event-code"
      style={{
        position: 'absolute',
        left: state.xPosition,
        top: state.yPosition,
        transition: state.isAnimating ? state.transition : '',
        transform: state.transform,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 100 - columnIndex // Newer events on top
      }}
    >
      {symbols}
    </div>
  );
};

export default EventCode;