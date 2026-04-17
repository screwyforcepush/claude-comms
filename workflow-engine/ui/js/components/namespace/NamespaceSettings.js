// NamespaceSettings - Modal for editing namespace harnessDefaults
// Q palette styling, React.createElement (no JSX)
import React, { useState, useEffect, useCallback } from 'react';
import { useNamespaceSettings } from '../../hooks/useNamespaceSettings.js';
import { QIcon } from '../shared/index.js';

const VALID_HARNESSES = ['claude', 'codex', 'gemini'];

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Harness dropdown select
 */
function HarnessSelect({ value, onChange }) {
  const [focused, setFocused] = useState(false);

  return React.createElement('select', {
    value: value,
    onChange: (e) => onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      backgroundColor: 'var(--q-stone2)',
      border: `1px solid ${focused ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
      borderRadius: 0,
      color: 'var(--q-bone3)',
      fontFamily: 'var(--font-console)',
      fontSize: '12px',
      padding: '6px 8px',
      outline: 'none',
      cursor: 'pointer',
      minWidth: '90px',
      transition: 'border-color 0.1s',
      appearance: 'none',
      WebkitAppearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23908474' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 8px center',
      paddingRight: '24px',
    }
  },
    VALID_HARNESSES.map(h =>
      React.createElement('option', { key: h, value: h }, h)
    )
  );
}

/**
 * Model text input
 */
function ModelInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);

  return React.createElement('input', {
    type: 'text',
    value: value || '',
    onChange: (e) => onChange(e.target.value || undefined),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    placeholder: placeholder || 'default',
    style: {
      backgroundColor: 'var(--q-stone2)',
      border: `1px solid ${focused ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
      borderRadius: 0,
      color: 'var(--q-bone3)',
      fontFamily: 'var(--font-console)',
      fontSize: '12px',
      padding: '6px 8px',
      outline: 'none',
      flex: 1,
      minWidth: '120px',
      transition: 'border-color 0.1s',
    }
  });
}

/**
 * Single entry row: harness dropdown + model input
 */
function EntryRow({ entry, onChange, onRemove, showRemove }) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }
  },
    React.createElement(HarnessSelect, {
      value: entry.harness,
      onChange: (harness) => onChange({ ...entry, harness }),
    }),
    React.createElement(ModelInput, {
      value: entry.model,
      onChange: (model) => onChange({ ...entry, model }),
    }),
    showRemove && React.createElement('button', {
      type: 'button',
      onClick: onRemove,
      title: 'Remove entry',
      style: {
        background: 'none',
        border: 'none',
        color: 'var(--q-lava0)',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        transition: 'color 0.1s',
      },
      onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-lava1)'; },
      onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-lava0)'; },
    },
      React.createElement(QIcon, { name: 'close', size: 14, color: 'currentColor' })
    )
  );
}

/**
 * Job type config row — single entry or fan-out array
 */
function JobTypeRow({ jobType, config, onChange, onRemove, isDefault }) {
  const isArray = Array.isArray(config);
  const entries = isArray ? config : [config];

  const handleEntryChange = useCallback((index, newEntry) => {
    if (isArray) {
      const newArr = [...entries];
      newArr[index] = newEntry;
      onChange(newArr);
    } else {
      onChange(newEntry);
    }
  }, [entries, isArray, onChange]);

  const handleRemoveEntry = useCallback((index) => {
    if (!isArray || entries.length <= 1) return;
    const newArr = entries.filter((_, i) => i !== index);
    onChange(newArr.length === 1 ? newArr[0] : newArr);
  }, [entries, isArray, onChange]);

  const handleAddEntry = useCallback(() => {
    const newArr = isArray ? [...entries] : [entries[0]];
    newArr.push({ harness: 'claude' });
    onChange(newArr);
  }, [entries, isArray, onChange]);

  const handleConvertToFanout = useCallback(() => {
    onChange([entries[0], { harness: 'claude' }]);
  }, [entries, onChange]);

  return React.createElement('div', {
    style: {
      padding: '10px 0',
      borderBottom: '1px solid var(--q-stone2)',
    }
  },
    // Header row: job type label + controls
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: entries.length > 1 ? '8px' : '0',
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '100px',
        }
      },
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            color: isDefault ? 'var(--q-torch)' : 'var(--q-bone2)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            minWidth: '80px',
          }
        }, jobType),
        isArray && React.createElement('span', {
          style: {
            fontFamily: 'var(--font-console)',
            fontSize: '9px',
            color: 'var(--q-copper1)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }
        }, 'fan-out'),
      ),
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px' }
      },
        // Fan-out toggle (only for non-default, non-array entries)
        !isDefault && !isArray && React.createElement('button', {
          type: 'button',
          onClick: handleConvertToFanout,
          title: 'Convert to fan-out (multiple harnesses)',
          style: {
            background: 'none',
            border: '1px solid var(--q-stone3)',
            borderRadius: 0,
            color: 'var(--q-bone0)',
            cursor: 'pointer',
            padding: '2px 6px',
            fontFamily: 'var(--font-console)',
            fontSize: '9px',
            transition: 'all 0.1s',
          },
          onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-copper2)'; e.currentTarget.style.borderColor = 'var(--q-copper1)'; },
          onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-bone0)'; e.currentTarget.style.borderColor = 'var(--q-stone3)'; },
        }, 'fan-out'),
        // Remove job type button (not for default)
        !isDefault && React.createElement('button', {
          type: 'button',
          onClick: onRemove,
          title: `Remove ${jobType}`,
          style: {
            background: 'none',
            border: 'none',
            color: 'var(--q-lava0)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.1s',
          },
          onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-lava1)'; },
          onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-lava0)'; },
        },
          React.createElement(QIcon, { name: 'skull', size: 14, color: 'currentColor' })
        ),
      ),
    ),

    // Entry rows
    entries.length === 1
      // Single entry: inline with the header
      ? React.createElement('div', {
          style: { marginTop: '6px' }
        },
          React.createElement(EntryRow, {
            entry: entries[0],
            onChange: (e) => handleEntryChange(0, e),
            showRemove: false,
          })
        )
      // Multiple entries: stacked below header
      : React.createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingLeft: '12px',
            borderLeft: '2px solid var(--q-stone3)',
            marginLeft: '4px',
          }
        },
          entries.map((entry, i) =>
            React.createElement(EntryRow, {
              key: i,
              entry: entry,
              onChange: (e) => handleEntryChange(i, e),
              onRemove: () => handleRemoveEntry(i),
              showRemove: entries.length > 1,
            })
          ),
          // Add entry button
          React.createElement('button', {
            type: 'button',
            onClick: handleAddEntry,
            style: {
              background: 'none',
              border: '1px dashed var(--q-stone3)',
              borderRadius: 0,
              color: 'var(--q-bone0)',
              cursor: 'pointer',
              padding: '4px 8px',
              fontFamily: 'var(--font-console)',
              fontSize: '10px',
              transition: 'all 0.1s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            },
            onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-copper2)'; e.currentTarget.style.borderColor = 'var(--q-copper1)'; },
            onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-bone0)'; e.currentTarget.style.borderColor = 'var(--q-stone3)'; },
          },
            React.createElement(QIcon, { name: 'add', size: 12, color: 'currentColor' }),
            'Add entry'
          )
        ),
  );
}

/**
 * Add job type input row
 */
function AddJobTypeRow({ onAdd }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmed = value.trim().toLowerCase();
    if (trimmed && trimmed !== 'default') {
      onAdd(trimmed);
      setValue('');
    }
  }, [value, onAdd]);

  return React.createElement('form', {
    onSubmit: handleSubmit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      paddingTop: '10px',
    }
  },
    React.createElement('input', {
      type: 'text',
      value: value,
      onChange: (e) => setValue(e.target.value),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      placeholder: 'job type name',
      style: {
        backgroundColor: 'var(--q-stone2)',
        border: `1px dashed ${focused ? 'var(--q-copper1)' : 'var(--q-stone3)'}`,
        borderRadius: 0,
        color: 'var(--q-bone3)',
        fontFamily: 'var(--font-console)',
        fontSize: '12px',
        padding: '6px 8px',
        outline: 'none',
        flex: 1,
        transition: 'border-color 0.1s',
      }
    }),
    React.createElement('button', {
      type: 'submit',
      disabled: !value.trim(),
      style: {
        background: 'none',
        border: '1px solid var(--q-stone3)',
        borderRadius: 0,
        color: value.trim() ? 'var(--q-copper2)' : 'var(--q-bone0)',
        cursor: value.trim() ? 'pointer' : 'default',
        padding: '5px 10px',
        fontFamily: 'var(--font-display)',
        fontSize: '10px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        transition: 'all 0.1s',
        opacity: value.trim() ? 1 : 0.5,
      }
    }, '+ Add')
  );
}

// ============================================================================
// Main modal component
// ============================================================================

/**
 * NamespaceSettings modal
 * Displays and edits namespace harnessDefaults config
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {string} namespaceId - The namespace to configure
 * @param {string} namespaceName - Display name for the namespace
 */
export function NamespaceSettings({ isOpen, onClose, namespaceId, namespaceName, allNamespaceIds }) {
  const { defaults, loading, saving, saveError, save, saveToNamespace } = useNamespaceSettings(namespaceId);
  const [localConfig, setLocalConfig] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Sync from server when defaults load or change
  useEffect(() => {
    if (defaults && !dirty) {
      setLocalConfig(structuredClone(defaults));
    }
  }, [defaults, dirty]);

  // Reset dirty state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDirty(false);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleConfigChange = useCallback((jobType, value) => {
    setLocalConfig(prev => {
      const next = { ...prev };
      next[jobType] = value;
      return next;
    });
    setDirty(true);
  }, []);

  const handleRemoveJobType = useCallback((jobType) => {
    setLocalConfig(prev => {
      const next = { ...prev };
      delete next[jobType];
      return next;
    });
    setDirty(true);
  }, []);

  const handleAddJobType = useCallback((jobType) => {
    setLocalConfig(prev => {
      if (prev[jobType]) return prev; // Already exists
      return { ...prev, [jobType]: { harness: 'claude' } };
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!localConfig) return;
    try {
      await save(localConfig);
      setDirty(false);
      onClose();
    } catch {
      // saveError is set by the hook
    }
  }, [localConfig, save, onClose]);

  const handleSaveAll = useCallback(async () => {
    if (!localConfig || !allNamespaceIds || allNamespaceIds.length === 0) return;
    setSavingAll(true);
    try {
      for (const nsId of allNamespaceIds) {
        await saveToNamespace(nsId, localConfig);
      }
      setDirty(false);
      onClose();
    } catch (err) {
      // saveError won't be set by the hook for saveToNamespace, handle inline
    } finally {
      setSavingAll(false);
    }
  }, [localConfig, allNamespaceIds, saveToNamespace, onClose]);

  const handleCancel = useCallback(() => {
    setDirty(false);
    setLocalConfig(defaults ? structuredClone(defaults) : null);
    onClose();
  }, [defaults, onClose]);

  if (!isOpen) return null;

  // Ordered job types: "default" first, then alphabetical
  const jobTypes = localConfig ? Object.keys(localConfig) : [];
  const orderedJobTypes = ['default', ...jobTypes.filter(k => k !== 'default').sort()];
  const uniqueJobTypes = [...new Set(orderedJobTypes)];

  return React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }
  },
    // Backdrop
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(6, 5, 4, 0.85)',
        backdropFilter: 'blur(4px)',
      },
      onClick: handleCancel,
    }),

    // Modal content
    React.createElement('div', {
      style: {
        position: 'relative',
        background: 'linear-gradient(135deg, var(--q-stone2) 0%, var(--q-stone1) 100%)',
        border: '1px solid var(--q-stone3)',
        borderTop: '1px solid rgba(80, 76, 64, 0.44)',
        borderBottom: '2px solid var(--q-void0)',
        borderRadius: 0,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--q-stone3)',
        }
      },
        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px' }
        },
          React.createElement(QIcon, { name: 'config', size: 18, color: 'var(--q-copper2)' }),
          React.createElement('span', {
            style: {
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              color: 'var(--q-bone3)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }
          }, 'Harness Config'),
          namespaceName && React.createElement('span', {
            style: {
              fontFamily: 'var(--font-console)',
              fontSize: '11px',
              color: 'var(--q-bone0)',
              marginLeft: '4px',
            }
          }, namespaceName),
        ),
        React.createElement('button', {
          type: 'button',
          onClick: handleCancel,
          style: {
            background: 'none',
            border: 'none',
            color: 'var(--q-bone0)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.1s',
          },
          onMouseEnter: (e) => { e.currentTarget.style.color = 'var(--q-bone3)'; },
          onMouseLeave: (e) => { e.currentTarget.style.color = 'var(--q-bone0)'; },
        },
          React.createElement(QIcon, { name: 'close', size: 18, color: 'currentColor' })
        ),
      ),

      // Column headers
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: '1px solid var(--q-stone2)',
        }
      },
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '9px',
            color: 'var(--q-bone0)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            minWidth: '80px',
          }
        }, 'Job Type'),
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '9px',
            color: 'var(--q-bone0)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            minWidth: '90px',
          }
        }, 'Harness'),
        React.createElement('span', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '9px',
            color: 'var(--q-bone0)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            flex: 1,
          }
        }, 'Model'),
      ),

      // Body — scrollable
      React.createElement('div', {
        style: {
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
        }
      },
        loading && React.createElement('div', {
          style: {
            padding: '24px',
            textAlign: 'center',
            color: 'var(--q-bone0)',
            fontFamily: 'var(--font-console)',
            fontSize: '12px',
          }
        }, 'Loading...'),

        localConfig && uniqueJobTypes.map(jobType =>
          localConfig[jobType] && React.createElement(JobTypeRow, {
            key: jobType,
            jobType: jobType,
            config: localConfig[jobType],
            onChange: (val) => handleConfigChange(jobType, val),
            onRemove: () => handleRemoveJobType(jobType),
            isDefault: jobType === 'default',
          })
        ),

        // Add job type
        localConfig && React.createElement(AddJobTypeRow, {
          onAdd: handleAddJobType,
        }),
      ),

      // Footer
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--q-stone3)',
        }
      },
        // Error message
        saveError
          ? React.createElement('span', {
              style: {
                fontFamily: 'var(--font-console)',
                fontSize: '11px',
                color: 'var(--q-lava1)',
              }
            }, saveError)
          : React.createElement('span'),

        // Buttons
        React.createElement('div', {
          style: { display: 'flex', gap: '8px' }
        },
          React.createElement('button', {
            type: 'button',
            onClick: handleCancel,
            style: {
              background: 'none',
              border: '1px solid var(--q-stone3)',
              borderRadius: 0,
              color: 'var(--q-bone2)',
              cursor: 'pointer',
              padding: '7px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 0.1s',
            },
            onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'var(--q-bone0)'; },
            onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'var(--q-stone3)'; },
          }, 'Cancel'),
          allNamespaceIds && allNamespaceIds.length > 1 && React.createElement('button', {
            type: 'button',
            onClick: handleSaveAll,
            disabled: !dirty || saving || savingAll,
            style: {
              background: dirty && !saving && !savingAll
                ? 'linear-gradient(180deg, var(--q-teleport-bright) 0%, var(--q-teleport) 100%)'
                : 'var(--q-stone2)',
              border: `1px solid ${dirty && !saving && !savingAll ? 'var(--q-teleport-bright)' : 'var(--q-stone3)'}`,
              borderBottom: `2px solid ${dirty && !saving && !savingAll ? 'var(--q-void0)' : 'var(--q-stone3)'}`,
              borderRadius: 0,
              color: dirty && !saving && !savingAll ? 'var(--q-bone4)' : 'var(--q-bone0)',
              cursor: dirty && !saving && !savingAll ? 'pointer' : 'default',
              padding: '7px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 0.1s',
              opacity: dirty && !saving && !savingAll ? 1 : 0.5,
            }
          }, savingAll ? 'Saving...' : 'Save All'),
          React.createElement('button', {
            type: 'button',
            onClick: handleSave,
            disabled: !dirty || saving || savingAll,
            style: {
              background: dirty && !saving && !savingAll
                ? 'linear-gradient(180deg, var(--q-copper1) 0%, var(--q-copper0) 100%)'
                : 'var(--q-stone2)',
              border: `1px solid ${dirty && !saving && !savingAll ? 'var(--q-copper2)' : 'var(--q-stone3)'}`,
              borderBottom: `2px solid ${dirty && !saving && !savingAll ? 'var(--q-void0)' : 'var(--q-stone3)'}`,
              borderRadius: 0,
              color: dirty && !saving && !savingAll ? 'var(--q-void0)' : 'var(--q-bone0)',
              cursor: dirty && !saving && !savingAll ? 'pointer' : 'default',
              padding: '7px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 0.1s',
              opacity: dirty && !saving && !savingAll ? 1 : 0.5,
            }
          }, saving ? 'Saving...' : 'Save'),
        ),
      ),
    ),
  );
}

export default NamespaceSettings;
