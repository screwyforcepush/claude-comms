// JsonViewer - Collapsible JSON display component
import React, { useState, useCallback } from 'react';

/**
 * Check if a string contains newlines
 */
function isMultiLine(value) {
  return typeof value === 'string' && value.includes('\n');
}

/**
 * Syntax highlight JSON value based on type
 * @param {any} value - Value to render
 * @param {boolean} block - Whether to render as block element
 * @returns {React.Element}
 */
function renderValue(value, block = false) {
  if (value === null) {
    return React.createElement('span', { className: 'json-null' }, 'null');
  }
  if (typeof value === 'boolean') {
    return React.createElement('span', { className: 'json-boolean' }, String(value));
  }
  if (typeof value === 'number') {
    return React.createElement('span', { className: 'json-number' }, String(value));
  }
  if (typeof value === 'string') {
    // For multi-line strings, use pre to preserve formatting
    if (value.includes('\n')) {
      return React.createElement('pre', {
        className: 'json-string whitespace-pre-wrap m-0',
        style: { display: block ? 'block' : 'inline', fontFamily: 'inherit' }
      }, `"${value}"`);
    }
    return React.createElement('span', { className: 'json-string' }, `"${value}"`);
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
        keyName && React.createElement('span', { className: 'json-key' }, `"${keyName}": `),
        renderValue(data, true)
      );
    }
    return React.createElement('div', {
      className: 'flex',
      style: { paddingLeft: depth > 0 ? '1rem' : 0 }
    },
      keyName && React.createElement('span', { className: 'json-key mr-1' }, `"${keyName}":`),
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
      keyName && React.createElement('span', { className: 'json-key mr-1' }, `"${keyName}":`),
      React.createElement('span', { className: 'text-gray-500' }, `${bracketOpen}${bracketClose}`)
    );
  }

  return React.createElement('div', {
    style: { paddingLeft: depth > 0 ? '1rem' : 0 }
  },
    // Header row with toggle
    React.createElement('div', {
      className: 'flex items-center cursor-pointer hover:bg-gray-700/50 rounded -ml-1 pl-1',
      onClick: toggleCollapse
    },
      // Collapse indicator
      React.createElement('span', {
        className: `text-gray-500 text-xs w-4 chevron ${collapsed ? '' : 'rotated'}`
      }, collapsed ? '\u25B6' : '\u25BC'),
      keyName && React.createElement('span', { className: 'json-key mr-1' }, `"${keyName}":`),
      React.createElement('span', { className: 'text-gray-400' },
        bracketOpen,
        collapsed && React.createElement('span', { className: 'text-gray-500 mx-1' },
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
      className: 'text-gray-400',
      style: { paddingLeft: '0.5rem' }
    }, bracketClose)
  );
}

/**
 * JsonViewer component - displays JSON data with syntax highlighting and collapsing
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
        className: 'json-viewer bg-gray-900 p-3 rounded border border-gray-700 overflow-auto',
        style: maxHeight ? { maxHeight } : {}
      }, data);
    }
  }

  return React.createElement('div', { className: 'relative' },
    // Copy button
    React.createElement('button', {
      onClick: handleCopy,
      className: 'absolute top-2 right-2 text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-1 rounded z-10',
      title: 'Copy to clipboard'
    }, copied ? 'Copied!' : 'Copy'),

    // JSON content
    React.createElement('div', {
      className: 'json-viewer bg-gray-900 p-3 rounded border border-gray-700 overflow-auto',
      style: maxHeight ? { maxHeight } : {}
    },
      React.createElement(JsonNode, {
        data: parsedData,
        defaultCollapsed: collapsed
      })
    )
  );
}

export default JsonViewer;
