// Hook for namespace harness defaults (settings)
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from './useConvex.js';
import { api } from '../api.js';

/**
 * Hook to read and update namespace harnessDefaults
 * @param {string|null} namespaceId - The namespace ID to manage settings for
 * @returns {{ defaults, loading, error, saving, saveError, save }}
 */
export function useNamespaceSettings(namespaceId) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [reflectionsSaving, setReflectionsSaving] = useState(false);
  const [reflectionsError, setReflectionsError] = useState(null);
  const [lobbySaving, setLobbySaving] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  const { data: defaults, loading, error } = useQuery(
    namespaceId ? api.namespaces.getHarnessDefaults : null,
    namespaceId ? { namespaceId } : {}
  );
  const { data: namespace, loading: namespaceLoading, error: namespaceError } = useQuery(
    namespaceId ? api.namespaces.get : null,
    namespaceId ? { id: namespaceId } : {}
  );

  const updateMutation = useMutation(api.namespaces.updateHarnessDefaults);
  const setReflectionsMutation = useMutation(api.namespaces.setReflectionsEnabled);
  const setLobbyMutation = useMutation(api.namespaces.setLobbyEnabled);

  const save = useCallback(async (harnessDefaults) => {
    if (!namespaceId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateMutation({
        namespaceId,
        harnessDefaults: JSON.stringify(harnessDefaults),
      });
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [namespaceId, updateMutation]);

  const saveToNamespace = useCallback(async (targetNamespaceId, harnessDefaults) => {
    await updateMutation({
      namespaceId: targetNamespaceId,
      harnessDefaults: JSON.stringify(harnessDefaults),
    });
  }, [updateMutation]);

  const setReflectionsEnabled = useCallback(async (enabled) => {
    if (!namespaceId) return;
    setReflectionsSaving(true);
    setReflectionsError(null);
    try {
      await setReflectionsMutation({
        namespaceId,
        enabled,
      });
    } catch (err) {
      setReflectionsError(err.message || 'Failed to update reflections');
      throw err;
    } finally {
      setReflectionsSaving(false);
    }
  }, [namespaceId, setReflectionsMutation]);

  const setLobbyEnabled = useCallback(async (enabled) => {
    if (!namespaceId) return;
    setLobbySaving(true);
    setLobbyError(null);
    try {
      await setLobbyMutation({
        namespaceId,
        enabled,
      });
    } catch (err) {
      setLobbyError(err.message || 'Failed to update lobby');
      throw err;
    } finally {
      setLobbySaving(false);
    }
  }, [namespaceId, setLobbyMutation]);

  return {
    defaults,
    namespace,
    reflectionsEnabled: namespace?.reflectionsEnabled !== false,
    // Opt-in (default off), unlike reflections' default-on
    lobbyEnabled: namespace?.lobbyEnabled === true,
    loading: loading || namespaceLoading,
    error: error || namespaceError,
    saving,
    saveError,
    save,
    saveToNamespace,
    reflectionsSaving,
    reflectionsError,
    setReflectionsEnabled,
    lobbySaving,
    lobbyError,
    setLobbyEnabled,
  };
}
