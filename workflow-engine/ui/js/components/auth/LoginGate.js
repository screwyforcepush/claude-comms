import React, { useState, useCallback } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { LoginForm } from './LoginForm.js';
import { PasswordProvider } from './PasswordContext.js';
import { ConvexProvider } from '../../hooks/useConvex.js';

const PASSWORD_KEY = 'adminPassword';
const CONVEX_URL_KEY = 'convexUrl';

export function LoginGate({ children }) {
  const [password, setPassword] = useState(() => {
    try {
      return sessionStorage.getItem(PASSWORD_KEY);
    } catch {
      return null;
    }
  });

  const [convexUrl, setConvexUrl] = useState(() => {
    try {
      return localStorage.getItem(CONVEX_URL_KEY);
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback(async (url, pwd) => {
    // Validate password by calling a lightweight query against the provided URL
    const httpClient = new ConvexHttpClient(url);
    try {
      await httpClient.query("namespaces:list", { password: pwd });
    } catch (err) {
      throw new Error('Unauthorized');
    }

    // Credentials valid — persist
    try {
      localStorage.setItem(CONVEX_URL_KEY, url);
      sessionStorage.setItem(PASSWORD_KEY, pwd);
    } catch {
      // Ignore storage errors
    }
    setConvexUrl(url);
    setPassword(pwd);
  }, []);

  // Pre-fill URL from localStorage for returning users
  const storedUrl = (() => {
    try { return localStorage.getItem(CONVEX_URL_KEY) || ''; } catch { return ''; }
  })();

  if (!password || !convexUrl) {
    return React.createElement(LoginForm, {
      onSuccess: handleLogin,
      initialConvexUrl: storedUrl
    });
  }

  // Wrap children with both providers
  return React.createElement(PasswordProvider, { password },
    React.createElement(ConvexProvider, { url: convexUrl }, children)
  );
}

export function logout() {
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // Ignore
  }
  window.location.reload();
}
