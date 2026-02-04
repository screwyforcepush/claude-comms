// WP-3: Effects Layer Components
// Grain overlay and scanline sweep for Quake-inspired atmosphere
import React from 'react';

/**
 * GrainOverlay - Canvas-based film grain effect
 * Renders once on mount, applies as fixed overlay
 * Respects prefers-reduced-motion
 *
 * Spec: 512x512 canvas, intensity 25, alpha 35, warm copper tint
 * RGB multipliers: R=v, G=v*0.9, B=v*0.7
 */
export function GrainOverlay() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.display = 'none';
      return;
    }

    const ctx = canvas.getContext('2d');
    // 512x512 prevents visible tiling on large displays
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 25; // T.fx.grain.intensity
      imageData.data[i] = v;           // R
      imageData.data[i + 1] = v * 0.9; // G (warm tint)
      imageData.data[i + 2] = v * 0.7; // B (warm tint)
      imageData.data[i + 3] = 35;      // A (T.fx.grain.alpha)
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return React.createElement('canvas', {
    ref: canvasRef,
    className: 'grain-overlay',
    'aria-hidden': 'true'
  });
}

/**
 * ScanlineSweep - CSS-animated horizontal scanline
 * Sweeps vertically from top to bottom via transform: translateY
 * Respects prefers-reduced-motion
 */
export function ScanlineSweep() {
  // Check reduced motion on mount
  const [shouldRender, setShouldRender] = React.useState(true);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShouldRender(false);
    }
  }, []);

  if (!shouldRender) return null;

  return React.createElement('div', {
    className: 'scanline-sweep',
    'aria-hidden': 'true'
  });
}
