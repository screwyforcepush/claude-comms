// ChatSidebar - Thread list sidebar with new chat button
// WP-5: Added namespace filter accordion above thread list
import React, { useCallback, useState } from 'react';
import { ThreadList } from './ThreadList.js';
import { LoadingSpinner, QIcon } from '../shared/index.js';

/**
 * Chevron icon for accordion toggle
 * Points down when expanded, right when collapsed
 */
function AccordionChevron({ expanded }) {
  return React.createElement('svg', {
    className: `w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M9 5l7 7-7 7'
    })
  );
}

/**
 * Namespace filter chip component
 * Toggle chip for filtering threads by namespace
 * Uses Q palette: stone2/stone3 inactive, copper/torch active
 */
function NamespaceFilterChip({ name, isActive, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  const activeStyle = {
    backgroundColor: 'rgba(212, 160, 48, 0.15)',
    border: '1px solid var(--q-copper1)',
    color: 'var(--q-torch)',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: '9px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 0,
    transition: 'all 0.1s',
    whiteSpace: 'nowrap'
  };

  const inactiveStyle = {
    backgroundColor: isHovered ? 'var(--q-stone3)' : 'var(--q-stone2)',
    border: '1px solid var(--q-stone3)',
    color: 'var(--q-bone0)',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: '9px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 0,
    transition: 'all 0.1s',
    whiteSpace: 'nowrap'
  };

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    style: isActive ? activeStyle : inactiveStyle,
    title: isActive ? `Remove ${name} filter` : `Filter by ${name}`
  }, name);
}

/**
 * Namespace filter accordion component
 * WP-5: Collapsible section above thread list for namespace multi-select filtering
 * Collapsed by default. 0 selected = all namespaces shown.
 */
function NamespaceFilterAccordion({ namespaces, selectedNamespaceIds, onToggleNamespace }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  if (!namespaces || namespaces.length === 0) {
    return null;
  }

  const activeCount = selectedNamespaceIds ? selectedNamespaceIds.size : 0;

  return React.createElement('div', {
    style: {
      borderBottom: '1px solid var(--q-stone3)'
    }
  },
    // Accordion header — clickable toggle
    React.createElement('button', {
      type: 'button',
      onClick: toggleExpanded,
      className: 'w-full flex items-center justify-between px-3 py-2',
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer'
      }
    },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement(AccordionChevron, { expanded }),
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            color: 'var(--q-copper2)',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }
        }, 'Namespaces')
      ),
      // Active filter count badge
      activeCount > 0 && React.createElement('span', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: '9px',
          color: 'var(--q-torch)',
          backgroundColor: 'rgba(212, 160, 48, 0.15)',
          padding: '1px 6px',
          borderRadius: 0,
          letterSpacing: '1px'
        }
      }, activeCount)
    ),

    // Accordion body — chips grid
    expanded && React.createElement('div', {
      className: 'px-3 pb-2',
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px'
      }
    },
      namespaces.map(ns =>
        React.createElement(NamespaceFilterChip, {
          key: ns._id,
          name: ns.name,
          isActive: selectedNamespaceIds && selectedNamespaceIds.has(ns._id),
          onClick: () => onToggleNamespace && onToggleNamespace(ns._id)
        })
      )
    )
  );
}

/**
 * New Chat split button with namespace dropdown
 * Left segment: creates thread in default namespace
 * Right segment: opens dropdown to pick a namespace
 * Uses Q palette: copper gradient background, void0 text, copper2 border
 */
function NewChatButton({ onClick, onCreateInNamespace, creating, namespaces }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = React.useRef(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const hasNamespaces = namespaces && namespaces.length > 1;

  const gradientBg = creating
    ? 'var(--q-stone2)'
    : isHovered
      ? 'linear-gradient(180deg, var(--q-copper2) 0%, var(--q-copper0) 100%)'
      : 'linear-gradient(180deg, var(--q-copper1) 0%, var(--q-copper0) 100%)';

  const baseStyle = {
    background: gradientBg,
    border: '1px solid var(--q-copper2)',
    borderTop: '1px solid rgba(148, 98, 50, 0.53)',
    borderBottom: '2px solid var(--q-void0)',
    borderRadius: 'var(--t-border-radius)',
    color: creating ? 'var(--q-bone0)' : 'var(--q-void0)',
    cursor: creating ? 'not-allowed' : 'pointer',
    boxShadow: isHovered && !creating ? '0 0 12px rgba(212, 160, 48, 0.2)' : 'none',
    textShadow: creating ? 'none' : '0 1px 0 rgba(176, 120, 64, 0.27)',
    transition: 'all 0.1s',
    opacity: creating ? 0.5 : 1,
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    letterSpacing: '2px',
    textTransform: 'uppercase'
  };

  return React.createElement('div', {
    ref: containerRef,
    style: { position: 'relative' }
  },
    React.createElement('div', {
      className: 'flex w-full',
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => { setIsHovered(false); setIsPressed(false); }
    },
      // Main button
      React.createElement('button', {
        type: 'button',
        onClick: onClick,
        disabled: creating,
        onMouseDown: () => setIsPressed(true),
        onMouseUp: () => setIsPressed(false),
        className: 'flex-1 flex items-center justify-center gap-2',
        style: {
          ...baseStyle,
          padding: '10px 16px',
          transform: isPressed ? 'translateY(1px)' : 'none',
          borderRight: hasNamespaces ? '1px solid rgba(0,0,0,0.2)' : baseStyle.border,
          borderTopRightRadius: hasNamespaces ? 0 : 'var(--t-border-radius)',
          borderBottomRightRadius: hasNamespaces ? 0 : 'var(--t-border-radius)'
        }
      },
        creating
          ? React.createElement(LoadingSpinner, { size: 'sm' })
          : React.createElement(QIcon, {
              name: 'spawn',
              size: 20,
              color: 'currentColor'
            }),
        React.createElement('span', null,
          creating ? 'Creating...' : 'New Chat'
        )
      ),

      // Dropdown segment (only when multiple namespaces)
      hasNamespaces && React.createElement('button', {
        type: 'button',
        onClick: () => setDropdownOpen(prev => !prev),
        disabled: creating,
        className: 'flex items-center justify-center',
        style: {
          ...baseStyle,
          padding: '10px 8px',
          borderLeft: 'none',
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0
        },
        title: 'Choose namespace'
      },
        React.createElement('svg', {
          width: 12,
          height: 12,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '2.5',
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        },
          React.createElement('path', {
            d: dropdownOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'
          })
        )
      )
    ),

    // Dropdown menu
    dropdownOpen && React.createElement('div', {
      style: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: '2px',
        backgroundColor: 'var(--q-stone1)',
        border: '1px solid var(--q-stone3)',
        borderRadius: 0,
        zIndex: 50,
        maxHeight: '200px',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }
    },
      namespaces.map(ns =>
        React.createElement(NamespaceDropdownItem, {
          key: ns._id,
          name: ns.name,
          onClick: () => {
            onCreateInNamespace(ns._id);
            setDropdownOpen(false);
          }
        })
      )
    )
  );
}

/**
 * Single item in the namespace dropdown
 */
function NamespaceDropdownItem({ name, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: 'w-full text-left px-3 py-2',
    style: {
      background: isHovered ? 'rgba(212, 160, 48, 0.1)' : 'transparent',
      border: 'none',
      borderBottom: '1px solid var(--q-stone2)',
      color: isHovered ? 'var(--q-torch)' : 'var(--q-bone2)',
      cursor: 'pointer',
      fontFamily: 'var(--font-display)',
      fontSize: '10px',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      transition: 'all 0.1s'
    }
  }, name);
}

/**
 * Delete button with lava styling for danger action
 * Uses Q palette: lava colors with hover states
 */
function DeleteChatButton({ onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return React.createElement('button', {
    type: 'button',
    onClick: onClick,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: 'w-full flex items-center justify-center gap-2 text-sm',
    style: {
      padding: '8px 12px',
      backgroundColor: isHovered ? 'rgba(140, 40, 20, 0.1)' : 'transparent',  // lava0 with alpha
      border: 'none',
      borderRadius: 'var(--t-border-radius)',
      color: isHovered ? 'var(--q-lava1)' : 'var(--q-lava0)',
      cursor: 'pointer',
      transition: 'all 0.15s'
    }
  },
    React.createElement(QIcon, {
      name: 'skull',
      size: 16,
      color: 'currentColor'
    }),
    React.createElement('span', null, 'Delete Chat')
  );
}

/**
 * ChatSidebar component - Sidebar with thread list and new chat button
 * WP-5: Added namespace filter accordion and namespaceMap pass-through
 * @param {Object} props
 * @param {Array} props.threads - Array of thread objects
 * @param {string} props.selectedThreadId - Currently selected thread ID
 * @param {Function} props.onSelectThread - Callback when thread is selected
 * @param {Function} props.onCreateThread - Callback to create new thread (default namespace)
 * @param {Function} props.onCreateInNamespace - Callback to create thread in specific namespace
 * @param {Function} props.onDeleteThread - Callback to delete a thread
 * @param {boolean} props.loading - Whether threads are loading
 * @param {boolean} props.creating - Whether a new thread is being created
 * @param {Array} props.namespaces - All namespace objects (WP-5)
 * @param {Set} props.selectedNamespaceIds - Set of selected namespace IDs for filtering (WP-5)
 * @param {Function} props.onToggleNamespace - Callback to toggle namespace filter (WP-5)
 * @param {Object} props.namespaceMap - Map of namespace ID to name (WP-5)
 */
export function ChatSidebar({
  threads = [],
  selectedThreadId,
  onSelectThread,
  onCreateThread,
  onCreateInNamespace,
  onDeleteThread,
  loading = false,
  creating = false,
  namespaces,
  selectedNamespaceIds,
  onToggleNamespace,
  namespaceMap,
  hasMore = false,
  onLoadMore
}) {
  const handleCreateThread = useCallback(() => {
    if (!creating && onCreateThread) {
      onCreateThread();
    }
  }, [creating, onCreateThread]);

  const handleCreateInNamespace = useCallback((nsId) => {
    if (!creating && onCreateInNamespace) {
      onCreateInNamespace(nsId);
    }
  }, [creating, onCreateInNamespace]);

  return React.createElement('div', {
    className: 'chat-sidebar flex flex-col flex-1 min-h-0',
    style: {
      backgroundColor: 'var(--q-stone0)'
    }
  },
    // WP-5: Namespace filter accordion — above New Chat button
    React.createElement(NamespaceFilterAccordion, {
      namespaces: namespaces,
      selectedNamespaceIds: selectedNamespaceIds,
      onToggleNamespace: onToggleNamespace
    }),

    // Header with new chat button - Q palette: stone3 border
    React.createElement('div', {
      className: 'p-3',
      style: {
        borderBottom: '1px solid var(--q-stone3)'
      }
    },
      React.createElement(NewChatButton, {
        onClick: handleCreateThread,
        onCreateInNamespace: handleCreateInNamespace,
        creating: creating,
        namespaces: namespaces
      })
    ),

    // Thread list header - Q palette: stone3 border, bone0 muted text
    React.createElement('div', {
      className: 'px-3 py-2',
      style: {
        borderBottom: '1px solid var(--q-stone3)'
      }
    },
      React.createElement('div', {
        className: 'flex items-center justify-between'
      },
        React.createElement('span', {
          className: 'text-xs font-semibold uppercase tracking-wide',
          style: {
            color: 'var(--q-bone0)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '2px'
          }
        }, 'Conversations'),
        threads.length > 0 && React.createElement('span', {
          className: 'text-xs',
          style: {
            color: 'var(--q-bone0)'
          }
        }, threads.length)
      )
    ),

    // Thread list — WP-5: pass namespaceMap for namespace badges
    React.createElement(ThreadList, {
      threads: threads,
      selectedThreadId: selectedThreadId,
      onSelectThread: onSelectThread,
      loading: loading,
      namespaceMap: namespaceMap
    }),

    // Load more button — shown when server returned a full page
    hasMore && onLoadMore && React.createElement('div', {
      className: 'px-3 py-2',
      style: { borderTop: '1px solid var(--q-stone2)' }
    },
      React.createElement('button', {
        type: 'button',
        onClick: onLoadMore,
        className: 'w-full text-center py-1',
        style: {
          background: 'none',
          border: '1px solid var(--q-stone3)',
          borderRadius: 0,
          color: 'var(--q-bone0)',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          transition: 'color 0.1s'
        }
      }, 'Load more')
    ),

    // Delete button for selected thread (if any) - Q palette: stone3 border, lava colors
    selectedThreadId && onDeleteThread && React.createElement('div', {
      className: 'p-3',
      style: {
        borderTop: '1px solid var(--q-stone3)'
      }
    },
      React.createElement(DeleteChatButton, {
        onClick: () => onDeleteThread(selectedThreadId)
      })
    )
  );
}

export default ChatSidebar;
