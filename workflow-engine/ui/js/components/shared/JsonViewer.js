// JsonViewer - Collapsible JSON display component
// WP-4: Transformed to Q palette syntax highlighting colors
import React, { useState, useCallback } from 'react';

/**
 * Check if a string contains newlines
 */
function isMultiLine(value) {
  return typeof value === 'string' && value.includes('\n');
}

/**
 * Syntax highlight JSON value based on type
 * Uses Q palette colors:
 * - json-key: --q-copper3 (was blue-300)
 * - json-string: --q-slime1 (was green-300)
 * - json-number: --q-torch (was amber-200)
 * - json-boolean: --q-teleport-bright (was violet-300)
 * - json-null: --q-bone0 (was gray-400)
 * @param {any} value - Value to render
 * @param {boolean} block - Whether to render as block element
 * @returns {React.Element}
 */
function renderValue(value, block = false) {
  if (value === null) {
    return React.createElement('span', {
      className: 'json-null-q',
      style: { color: 'var(--q-bone0)' }
    }, 'null');
  }
  if (typeof value === 'boolean') {
    return React.createElement('span', {
      className: 'json-boolean-q',
      style: { color: 'var(--q-teleport-bright)' }
    }, String(value));
  }
  if (typeof value === 'number') {
    return React.createElement('span', {
      className: 'json-number-q',
      style: { color: 'var(--q-torch)' }
    }, String(value));
  }
  if (typeof value === 'string') {
    // For multi-line strings, use pre to preserve formatting
    if (value.includes('\n')) {
      return React.createElement('pre', {
        className: 'json-string-q whitespace-pre-wrap m-0',
        style: {
          display: block ? 'block' : 'inline',
          fontFamily: 'inherit',
          color: 'var(--q-slime1)'
        }
      }, `"${value}"`);
    }
    return React.createElement('span', {
      className: 'json-string-q',
      style: { color: 'var(--q-slime1)' }
    }, `"${value}"`);
  }
  return React.createElement('span', null, String(value));
}

/**
 * Recursive JSON node renderer
 * @param {Object} props
 * @param {any} props.data - Data to render
 * @param {string} props.keyName - Key name (for object properties)
 * @param {boolean} props.defaultCollapsed - Whether to start collapsed
 * @param {number} props.depth - Current nesting depth
 */
function JsonNode({ data, keyName, defaultCollapsed = false, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed && depth > 0);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  // Primitive values
  if (!isObject) {
    // Multi-line strings need block layout to display properly
    if (isMultiLine(data)) {
      return React.createElement('div', {
        style: { paddingLeft: depth > 0 ? '1rem' : 0 }
      },
        keyName && React.createElement('span', {
          className: 'json-key-q',
          style: { color: 'var(--q-copper3)' }
        }, `"${keyName}": `),
        renderValue(data, true)
      );
    }
    return React.createElement('div', {
      className: 'flex',
      style: { paddingLeft: depth > 0 ? '1rem' : 0 }
    },
      keyName && React.createElement('span', {
        className: 'json-key-q mr-1',
        style: { color: 'var(--q-copper3)' }
      }, `"${keyName}":`),
      React.createElement('span', { className: 'ml-1' }, renderValue(data))
    );
  }

  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
  const isEmpty = entries.length === 0;
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  // Empty object/array
  if (isEmpty) {
    return React.createElement('div', {
      className: 'flex',
      style: { paddingLeft: depth > 0 ? '1rem' : 0 }
    },
      keyName && React.createElement('span', {
        className: 'json-key-q mr-1',
        style: { color: 'var(--q-copper3)' }
      }, `"${keyName}":`),
      React.createElement('span', {
        style: { color: 'var(--q-bone0)' }
      }, `${bracketOpen}${bracketClose}`)
    );
  }

  return React.createElement('div', {
    style: { paddingLeft: depth > 0 ? '1rem' : 0 }
  },
    // Header row with toggle
    React.createElement('div', {
      className: 'flex items-center cursor-pointer rounded -ml-1 pl-1',
      onClick: toggleCollapse,
      style: {
        ':hover': { backgroundColor: 'var(--q-stone2)' }
      },
      onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--q-stone2)',
      onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent'
    },
      // Collapse indicator
      React.createElement('span', {
        className: `text-xs w-4 chevron ${collapsed ? '' : 'rotated'}`,
        style: { color: 'var(--q-bone0)' }
      }, collapsed ? '\u25B6' : '\u25BC'),
      keyName && React.createElement('span', {
        className: 'json-key-q mr-1',
        style: { color: 'var(--q-copper3)' }
      }, `"${keyName}":`),
      React.createElement('span', {
        style: { color: 'var(--q-bone1)' }
      },
        bracketOpen,
        collapsed && React.createElement('span', {
          className: 'mx-1',
          style: { color: 'var(--q-bone0)' }
        },
          `${entries.length} ${isArray ? 'items' : 'keys'}`
        ),
        collapsed && bracketClose
      )
    ),
    // Children (if not collapsed)
    !collapsed && React.createElement('div', { className: 'pl-2' },
      entries.map(([key, value]) =>
        React.createElement(JsonNode, {
          key: key,
          keyName: isArray ? null : key,
          data: value,
          defaultCollapsed: defaultCollapsed,
          depth: depth + 1
        })
      )
    ),
    !collapsed && React.createElement('div', {
      style: {
        paddingLeft: '0.5rem',
        color: 'var(--q-bone1)'
      }
    }, bracketClose)
  );
}

/**
 * JsonViewer component - displays JSON data with Q palette syntax highlighting
 * @param {Object} props
 * @param {any} props.data - JSON data to display
 * @param {boolean} props.collapsed - Whether to start collapsed
 * @param {number} props.maxHeight - Maximum height in pixels (scrollable)
 */
export function JsonViewer({ data, collapsed = false, maxHeight }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  // Parse string data if needed
  let parsedData = data;
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch {
      // If not valid JSON, display as plain string
      return React.createElement('pre', {
        className: 'json-viewer-q p-3 overflow-auto',
        style: {
          backgroundColor: 'var(--q-void1)',
          border: '1px solid var(--q-stone3)',
          borderRadius: 'var(--t-border-radius)',
          fontFamily: 'var(--font-console)',
          fontSize: 'var(--t-type-size-console)',
          color: 'var(--q-bone2)',
          ...(maxHeight ? { maxHeight } : {})
        }
      }, data);
    }
  }

  return React.createElement('div', { className: 'relative' },
    // Copy button with Q palette styling
    React.createElement('button', {
      onClick: handleCopy,
      className: 'absolute top-2 right-2 text-xs px-2 py-1 rounded z-10',
      title: 'Copy to clipboard',
      style: {
        backgroundColor: 'var(--q-stone2)',
        color: copied ? 'var(--q-slime1)' : 'var(--q-bone0)',
        border: '1px solid var(--q-stone3)',
        fontFamily: 'var(--font-console)'
      }
    }, copied ? 'Copied!' : 'Copy'),

    // JSON content with Q palette
    React.createElement('div', {
      className: 'json-viewer-q p-3 overflow-auto',
      style: {
        backgroundColor: 'var(--q-void1)',
        border: '1px solid var(--q-stone3)',
        borderRadius: 'var(--t-border-radius)',
        fontFamily: 'var(--font-console)',
        fontSize: 'var(--t-type-size-console)',
        lineHeight: 'var(--t-type-leading-console-line)',
        ...(maxHeight ? { maxHeight } : {})
      }
    },
      React.createElement(JsonNode, {
        data: parsedData,
        defaultCollapsed: collapsed
      })
    )
  );
}

export default JsonViewer;
