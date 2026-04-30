// Imperative in-page confirm dialog. Replaces window.confirm() to avoid
// Chrome suppressing dialogs from backgrounded tabs.
//
// Usage:
//   const confirm = useConfirm();
//   if (!(await confirm({ message: 'Retry this group?', danger: true }))) return;
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ConfirmDialogContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  }
  return ctx;
}

function ConfirmDialog({ open, options, onResolve }) {
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [cancelHovered, setCancelHovered] = useState(false);

  const danger = !!options?.danger;
  const title = options?.title;
  const message = options?.message ?? 'Are you sure?';
  const confirmLabel = options?.confirmLabel ?? (danger ? 'CONFIRM' : 'OK');
  const cancelLabel = options?.cancelLabel ?? 'CANCEL';

  // Focus the safer button (cancel) when opening to prevent accidental Enter
  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
  }, [open]);

  // Keyboard: Enter = confirm, Escape = cancel
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onResolve(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onResolve]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const confirmColor = danger ? 'var(--q-lava1)' : 'var(--q-copper3)';
  const confirmBg = danger
    ? (confirmHovered ? 'var(--q-lava0-08)' : 'transparent')
    : (confirmHovered ? 'var(--q-stone2)' : 'transparent');

  return React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }
  },
    // Backdrop
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(6, 5, 4, 0.85)',
        backdropFilter: 'blur(4px)'
      },
      onClick: () => onResolve(false)
    }),
    // Modal panel
    React.createElement('div', {
      role: 'dialog',
      'aria-modal': 'true',
      style: {
        position: 'relative',
        background: 'linear-gradient(135deg, var(--q-stone2) 0%, var(--q-stone1) 100%)',
        border: '1px solid var(--q-stone3)',
        borderTop: '1px solid var(--q-iron1-44)',
        borderBottom: '2px solid var(--q-void0)',
        borderRadius: 0,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxWidth: '480px',
        width: '100%',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }
    },
      title && React.createElement('div', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          letterSpacing: 'var(--t-type-tracking-tight)',
          color: danger ? 'var(--q-lava1)' : 'var(--q-torch-hot)',
          textTransform: 'uppercase'
        }
      }, title),
      React.createElement('div', {
        style: {
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          lineHeight: 1.5,
          color: 'var(--q-bone1)'
        }
      }, message),
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '4px'
        }
      },
        React.createElement('button', {
          ref: cancelBtnRef,
          type: 'button',
          onClick: () => onResolve(false),
          onMouseEnter: () => setCancelHovered(true),
          onMouseLeave: () => setCancelHovered(false),
          style: {
            padding: '6px 14px',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            letterSpacing: 'var(--t-type-tracking-tight)',
            color: 'var(--q-bone0)',
            backgroundColor: cancelHovered ? 'var(--q-stone2)' : 'transparent',
            border: '1px solid var(--q-stone3)',
            borderRadius: 0,
            cursor: 'pointer'
          }
        }, cancelLabel),
        React.createElement('button', {
          ref: confirmBtnRef,
          type: 'button',
          onClick: () => onResolve(true),
          onMouseEnter: () => setConfirmHovered(true),
          onMouseLeave: () => setConfirmHovered(false),
          style: {
            padding: '6px 14px',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            letterSpacing: 'var(--t-type-tracking-tight)',
            color: confirmColor,
            backgroundColor: confirmBg,
            border: `1px solid ${confirmColor}`,
            borderRadius: 0,
            cursor: 'pointer'
          }
        }, confirmLabel)
      )
    )
  );
}

export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState({ open: false, options: null, resolver: null });

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolver: resolve });
    });
  }, []);

  const handleResolve = useCallback((value) => {
    setState((prev) => {
      if (prev.resolver) prev.resolver(value);
      return { open: false, options: null, resolver: null };
    });
  }, []);

  return React.createElement(ConfirmDialogContext.Provider, { value: confirm },
    children,
    React.createElement(ConfirmDialog, {
      open: state.open,
      options: state.options,
      onResolve: handleResolve
    })
  );
}
