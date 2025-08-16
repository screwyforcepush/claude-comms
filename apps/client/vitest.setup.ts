/**
 * Vitest Setup File
 * 
 * Sets up test environment mocks and configurations
 */

import { vi } from 'vitest'

// Mock Canvas API for JSDOM environment
class MockCanvasContext {
  fillStyle = '#000000'
  strokeStyle = '#000000'
  globalAlpha = 1
  font = '14px Arial'
  textAlign = 'left'
  textBaseline = 'top'

  fillRect = vi.fn()
  strokeRect = vi.fn()
  clearRect = vi.fn()
  fillText = vi.fn()
  strokeText = vi.fn()
  measureText = vi.fn(() => ({ width: 10 }))
  save = vi.fn()
  restore = vi.fn()
  translate = vi.fn()
  rotate = vi.fn()
  scale = vi.fn()
  beginPath = vi.fn()
  closePath = vi.fn()
  moveTo = vi.fn()
  lineTo = vi.fn()
  arc = vi.fn()
  fill = vi.fn()
  stroke = vi.fn()
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1
  }))
  putImageData = vi.fn()
  createImageData = vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1
  }))
}

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => new MockCanvasContext()),
  writable: true
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id))

// Mock window.matchMedia for reduced motion tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock performance.now
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now())
}

// Suppress console warnings for tests
const originalConsoleWarn = console.warn
console.warn = (...args: any[]) => {
  // Suppress Vue lifecycle warnings in tests
  if (args[0]?.includes?.('onUnmounted') || args[0]?.includes?.('lifecycle')) {
    return
  }
  originalConsoleWarn(...args)
}