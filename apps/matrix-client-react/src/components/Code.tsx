import React, { useState, useEffect } from 'react';
import Symbol from './Symbol';
import { getRandomNumber, getRandomInt } from '../utils/characters';

const SYMBOL_HEIGHT = 35;
const SYMBOL_WIDTH = 18;

const Code: React.FC = () => {
  const [state, setState] = useState({
    codeLength: 0,
    yPosition: 0,
    xPosition: 0,
    transition: '',
    transform: '',
    isAnimating: false
  });

  useEffect(() => {
    // Some lines are zoomed-in, some zoomed-out
    const scaleRatio = getRandomNumber(0.8, 1.4);
    
    // Min code height is height of screen
    const minCodeHeight = Math.round(window.innerHeight / SYMBOL_HEIGHT);
    const codeLength = getRandomInt(minCodeHeight, minCodeHeight * 2);
    
    // Hacky solution to get the line above top=0 at start
    const yPosition = (codeLength + 1) * SYMBOL_HEIGHT * scaleRatio * 1.5;
    
    // Create columns to prevent overlapping
    const stepCount = Math.round((window.innerWidth - 20) / SYMBOL_WIDTH);
    const xPosition = getRandomInt(0, stepCount) * SYMBOL_WIDTH;
    
    // Scale ratio affects speed - smaller = farther = slower
    const transition = `top linear ${getRandomNumber(5, 10) / scaleRatio}s`;
    const transform = `scale(${scaleRatio})`;

    setState({
      codeLength,
      yPosition,
      xPosition,
      transition,
      transform,
      isAnimating: false
    });

    // Start animation after random delay
    const startTime = getRandomInt(300, 10000);
    setTimeout(() => {
      const newHeight = window.innerHeight + yPosition;
      setState(prev => ({
        ...prev,
        yPosition: -newHeight,
        isAnimating: true
      }));
    }, startTime);
  }, []);

  const symbols = Array.from({ length: state.codeLength }, (_, i) => (
    <Symbol 
      key={i} 
      opacity={i <= 5 ? i / 5 : 1} 
    />
  ));

  return (
    <div
      className="code"
      style={{
        position: 'absolute',
        left: state.xPosition,
        top: -state.yPosition,
        transition: state.isAnimating ? state.transition : '',
        transform: state.transform,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {symbols}
      <Symbol primary={true} />
    </div>
  );
};

export default Code;