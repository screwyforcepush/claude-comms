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

  const { data: defaults, loading, error } = useQuery(
    namespaceId ? api.namespaces.getHarnessDefaults : null,
    namespaceId ? { namespaceId } : {}
  );

  const updateMutation = useMutation(api.namespaces.updateHarnessDefaults);

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

  return { defaults, loading, error, saving, saveError, save, saveToNamespace };
}
