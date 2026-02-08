import React, { useState, useCallback } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { LoginForm } from './LoginForm.js';
import { PasswordProvider } from './PasswordContext.js';

const SESSION_KEY = 'adminPassword';

export function LoginGate({ convexUrl, children }) {
  const [password, setPassword] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback(async (pwd) => {
    // Validate password by calling a lightweight query
    const httpClient = new ConvexHttpClient(convexUrl);
    try {
      await httpClient.query("namespaces:list", { password: pwd });
    } catch (err) {
      throw new Error('Unauthorized');
    }

    // Password is valid - store and proceed
    try {
      sessionStorage.setItem(SESSION_KEY, pwd);
    } catch {
      // Ignore storage errors
    }
    setPassword(pwd);
  }, [convexUrl]);

  if (!password) {
    return React.createElement(LoginForm, { onSuccess: handleLogin });
  }

  return React.createElement(PasswordProvider, { password }, children);
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
  window.location.reload();
}
