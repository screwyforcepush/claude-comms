// Config loader module
// Loads configuration from config.json

let configCache = null;

/**
 * Load configuration from config.json
 * @returns {Promise<{convexUrl: string}>}
 */
export async function loadConfig() {
  if (configCache) {
    return configCache;
  }

  try {
    const response = await fetch('./config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    configCache = await response.json();
    return configCache;
  } catch (error) {
    console.error('Error loading config:', error);
    // Return empty config on error
    return { convexUrl: '' };
  }
}

/**
 * Get the cached config synchronously (returns null if not loaded)
 * @returns {{convexUrl: string} | null}
 */
export function getConfig() {
  return configCache;
}

/**
 * Check if config is valid (has required fields)
 * @param {object} config
 * @returns {boolean}
 */
export function isConfigValid(config) {
  return config && typeof config.convexUrl === 'string' && config.convexUrl.length > 0;
}
