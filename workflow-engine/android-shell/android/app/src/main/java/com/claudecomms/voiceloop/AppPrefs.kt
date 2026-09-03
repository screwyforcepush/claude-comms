package com.claudecomms.voiceloop

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import org.json.JSONObject

data class ShellConfig(
    val convexUrl: String,
    val password: String,
    val uiUrl: String,
) {
    val adminPassword: String
        get() = password
}

class AppPrefs(context: Context) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getConfig(): ShellConfig? {
        val convexUrl = prefs.getString(KEY_CONVEX_URL, null)?.takeIf { it.isNotBlank() }
        val password = prefs.getString(KEY_ADMIN_PASSWORD, null)?.takeIf { it.isNotBlank() }
        val uiUrl = prefs.getString(KEY_UI_URL, null)?.takeIf { it.isNotBlank() }

        return if (convexUrl == null || password == null || uiUrl == null) {
            null
        } else {
            ShellConfig(convexUrl = convexUrl, password = password, uiUrl = uiUrl)
        }
    }

    fun requireConfig(): ShellConfig =
        getConfig() ?: error("Voice Loop shell is not configured")

    fun saveConfig(
        convexUrl: String,
        password: String,
        uiUrl: String,
    ): ShellConfig {
        val config = ShellConfig(
            convexUrl = normalizeHttpUrl(convexUrl, "Convex URL"),
            password = password.trim(),
            uiUrl = normalizeHttpUrl(uiUrl, "Web UI URL"),
        )

        require(config.password.isNotEmpty()) { "Admin password is required" }

        prefs.edit()
            .putString(KEY_CONVEX_URL, config.convexUrl)
            .putString(KEY_ADMIN_PASSWORD, config.password)
            .putString(KEY_UI_URL, config.uiUrl)
            .apply()

        return config
    }

    fun getFeedCursor(): Double? =
        if (prefs.contains(KEY_FEED_CURSOR_BITS)) {
            java.lang.Double.longBitsToDouble(prefs.getLong(KEY_FEED_CURSOR_BITS, 0L))
        } else {
            null
        }

    fun setFeedCursor(cursor: Double) {
        prefs.edit()
            .putLong(KEY_FEED_CURSOR_BITS, java.lang.Double.doubleToRawLongBits(cursor))
            .apply()
    }

    fun clearFeedCursor() {
        prefs.edit().remove(KEY_FEED_CURSOR_BITS).apply()
    }

    fun setNotificationsBlocked(blocked: Boolean, reason: String? = null) {
        prefs.edit()
            .putBoolean(KEY_NOTIFICATIONS_BLOCKED, blocked)
            .putString(KEY_NOTIFICATIONS_BLOCKED_REASON, reason.orEmpty())
            .apply()
    }

    fun areNotificationsBlocked(): Boolean =
        prefs.getBoolean(KEY_NOTIFICATIONS_BLOCKED, false)

    fun notificationsBlockedReason(): String? =
        prefs.getString(KEY_NOTIFICATIONS_BLOCKED_REASON, null)?.takeIf { it.isNotBlank() }

    companion object {
        const val PREFS_NAME = "claude_comms_voice_loop"
        const val KEY_CONVEX_URL = "convexUrl"
        const val KEY_ADMIN_PASSWORD = "adminPassword"
        const val KEY_UI_URL = "uiUrl"
        const val KEY_FEED_CURSOR_BITS = "feedCursorBits"
        const val KEY_NOTIFICATIONS_BLOCKED = "notificationsBlocked"
        const val KEY_NOTIFICATIONS_BLOCKED_REASON = "notificationsBlockedReason"
        const val DEFAULT_CONVEX_URL = "https://utmost-vulture-618.convex.cloud"

        fun getConfig(context: Context): ShellConfig? = AppPrefs(context).getConfig()

        fun requireConfig(context: Context): ShellConfig = AppPrefs(context).requireConfig()

        fun saveConfig(
            context: Context,
            convexUrl: String,
            password: String,
            uiUrl: String,
        ): ShellConfig = AppPrefs(context).saveConfig(
            convexUrl = convexUrl,
            password = password,
            uiUrl = uiUrl,
        )

        fun localStorageScript(config: ShellConfig): String {
            val convexUrl = JSONObject.quote(config.convexUrl)
            val adminPassword = JSONObject.quote(config.password)
            return """
                (function() {
                  try {
                    localStorage.setItem('$KEY_CONVEX_URL', $convexUrl);
                    localStorage.setItem('$KEY_ADMIN_PASSWORD', $adminPassword);
                  } catch (error) {}
                })();
            """.trimIndent()
        }

        private fun normalizeHttpUrl(raw: String, label: String): String {
            val trimmed = raw.trim().trimEnd('/')
            require(trimmed.isNotEmpty()) { "$label is required" }

            val uri = Uri.parse(trimmed)
            val scheme = uri.scheme?.lowercase()
            require((scheme == "https" || scheme == "http") && !uri.host.isNullOrBlank()) {
                "$label must be an http or https URL"
            }

            return trimmed
        }
    }
}
