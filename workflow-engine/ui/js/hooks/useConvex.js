// Convex client context and hook
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ConvexClient } from 'convex/browser';
import { usePassword } from '../components/auth/PasswordContext.js';

// Context for Convex client
const ConvexContext = createContext(null);

/**
 * Provider component that initializes and manages the Convex client
 * @param {Object} props
 * @param {string} props.url - Convex deployment URL
 * @param {React.ReactNode} props.children
 */
export function ConvexProvider({ url, children }) {
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setConnecting(false);
      setError('No Convex URL provided');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const newClient = new ConvexClient(url);
      setClient(newClient);

      // The client will attempt to connect automatically
      // We set connected to true after a brief delay to allow connection
      const connectionTimeout = setTimeout(() => {
        setConnected(true);
        setConnecting(false);
      }, 1000);

      return () => {
        clearTimeout(connectionTimeout);
        newClient.close();
      };
    } catch (err) {
      setError(err.message || 'Failed to create Convex client');
      setConnecting(false);
    }
  }, [url]);

  const value = {
    client,
    connected,
    connecting,
    error,
    url
  };

  return React.createElement(ConvexContext.Provider, { value }, children);
}

/**
 * Hook to access the Convex client and connection state
 * @returns {{ client: ConvexClient | null, connected: boolean, connecting: boolean, error: string | null }}
 */
export function useConvex() {
  const context = useContext(ConvexContext);
  if (!context) {
    throw new Error('useConvex must be used within a ConvexProvider');
  }
  return context;
}

/**
 * Hook to subscribe to a Convex query
 * Auto-injects password from PasswordContext into args.
 * @param {string} queryName - The query function reference (e.g., "scheduler:getQueueStatus")
 * @param {object} args - Query arguments
 * @returns {{ data: any, loading: boolean, error: string | null }}
 */
export function useQuery(queryName, args = {}) {
  const { client, connected } = useConvex();
  const password = usePassword();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // Inject password into args
  const argsWithPassword = password ? { ...args, password } : args;

  // Serialize args for dependency comparison
  const argsKey = JSON.stringify(argsWithPassword);

  useEffect(() => {
    if (!client || !connected) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      unsubscribeRef.current = client.onUpdate(
        queryName,
        argsWithPassword,
        (result) => {
          setData(result);
          setLoading(false);
        },
        (err) => {
          console.error(`Query ${queryName} error:`, err);
          setError(err.message || 'Query failed');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to subscribe');
      setLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [client, connected, queryName, argsKey]);

  return { data, loading, error };
}

/**
 * Hook to call a Convex mutation
 * Auto-injects password from PasswordContext into args.
 * @param {string} mutationName - The mutation function reference
 * @returns {Function} - Function to call the mutation with args
 */
export function useMutation(mutationName) {
  const { client } = useConvex();
  const password = usePassword();

  const mutate = useCallback(async (args = {}) => {
    if (!client) {
      throw new Error('Convex client not available');
    }
    const argsWithPassword = password ? { ...args, password } : args;
    return await client.mutation(mutationName, argsWithPassword);
  }, [client, mutationName, password]);

  return mutate;
}

/**
 * Hook to call a Convex action
 * @param {string} actionName - The action function reference
 * @returns {Function} - Function to call the action with args
 */
export function useAction(actionName) {
  const { client } = useConvex();

  const run = useCallback(async (args = {}) => {
    if (!client) {
      throw new Error('Convex client not available');
    }
    return await client.action(actionName, args);
  }, [client, actionName]);

  return run;
}
