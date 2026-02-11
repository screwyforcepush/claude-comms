import React, { useState, useCallback } from 'react';

export function LoginForm({ onSuccess, initialConvexUrl }) {
  const [convexUrl, setConvexUrl] = useState(initialConvexUrl || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!convexUrl.trim()) {
      setError('Convex URL is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSuccess(convexUrl.trim(), password.trim());
    } catch (err) {
      setError(err.message === 'Unauthorized' ? 'Unauthorized' : 'Connection failed — check URL');
      setLoading(false);
    }
  }, [convexUrl, password, onSuccess]);

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    backgroundColor: 'var(--q-stone0)',
    color: 'var(--q-bone2)',
    border: '1px solid var(--q-stone3)',
    outline: 'none',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    marginBottom: '1rem',
  };

  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--q-void1)',
    }
  },
    React.createElement('form', {
      onSubmit: handleSubmit,
      style: {
        padding: '2rem',
        border: '1px solid var(--q-stone3)',
        backgroundColor: 'var(--q-stone1)',
        width: '100%',
        maxWidth: '360px',
      }
    },
      React.createElement('h1', {
        style: {
          fontFamily: 'var(--font-display)',
          color: 'var(--q-bone3)',
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }
      }, 'Workflow Engine'),

      React.createElement('input', {
        type: 'url',
        value: convexUrl,
        onChange: (e) => setConvexUrl(e.target.value),
        placeholder: 'https://your-project.convex.cloud',
        autoFocus: !initialConvexUrl,
        disabled: loading,
        style: inputStyle
      }),

      React.createElement('input', {
        type: 'password',
        value: password,
        onChange: (e) => setPassword(e.target.value),
        placeholder: 'Admin password',
        autoFocus: !!initialConvexUrl,
        disabled: loading,
        style: inputStyle
      }),

      error && React.createElement('p', {
        style: {
          color: 'var(--q-lava1)',
          fontSize: '0.875rem',
          marginBottom: '0.75rem',
        }
      }, error),

      React.createElement('button', {
        type: 'submit',
        disabled: loading,
        style: {
          width: '100%',
          padding: '0.625rem',
          backgroundColor: 'var(--q-copper1)',
          color: 'var(--q-bone3)',
          border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: '600',
          opacity: loading ? 0.7 : 1,
        }
      }, loading ? 'Verifying...' : 'Login')
    )
  );
}
