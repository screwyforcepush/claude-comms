package com.claudecomms.voiceloop

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.getcapacitor.BridgeActivity
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    private var started = false
    private var needsRuntimeLoad = false
    private var pendingThreadId: String? = null
    private var fallbackInjectionPending = false
    private var documentStartScript: ScriptHandler? = null
    private var runtimeConfig: ShellConfig? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        val config = AppPrefs.getConfig(this)
        if (config == null) {
            startActivity(Intent(this, ConfigActivity::class.java))
            finish()
            return
        }

        runtimeConfig = config
        ConvexHolder.configure(config)

        if (!notificationsAvailable()) {
            startFeedListenerService()
            startConfigActivity()
            finish()
            return
        }

        pendingThreadId = extractThreadId(intent)
        needsRuntimeLoad = true

        super.onCreate(savedInstanceState)

        installCredentialInjection(config)
        startFeedListenerService(permissionRecoveryActionIfBlocked())
    }

    override fun onStart() {
        super.onStart()
        started = true
        bridge?.webView?.onResume()
        bridge?.webView?.resumeTimers()
        flushPendingRuntimeLoad()
    }

    override fun onStop() {
        bridge?.webView?.onPause()
        bridge?.webView?.pauseTimers()
        started = false
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)

        val config = AppPrefs.getConfig(this)
        if (config == null) {
            startConfigActivity()
            finish()
            return
        }

        runtimeConfig = config
        ConvexHolder.configure(config)
        if (!notificationsAvailable()) {
            startFeedListenerService()
            startConfigActivity()
            finish()
            return
        }

        startFeedListenerService(permissionRecoveryActionIfBlocked())
        pendingThreadId = extractThreadId(intent)
        needsRuntimeLoad = true
        if (started) {
            bridge?.webView?.onResume()
            bridge?.webView?.resumeTimers()
            flushPendingRuntimeLoad()
        }
    }

    private fun installCredentialInjection(config: ShellConfig) {
        val webView = bridge?.webView ?: return
        val script = AppPrefs.localStorageScript(config)

        documentStartScript?.remove()
        documentStartScript = null
        fallbackInjectionPending = false

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            documentStartScript = WebViewCompat.addDocumentStartJavaScript(
                webView,
                script,
                setOf(originRule(config.uiUrl)),
            )
            return
        }

        fallbackInjectionPending = true
    }

    private fun flushPendingRuntimeLoad() {
        if (!needsRuntimeLoad) return
        val config = runtimeConfig ?: AppPrefs.getConfig(this) ?: return

        val targetUrl = buildRuntimeUrl(config.uiUrl, pendingThreadId)
        needsRuntimeLoad = false
        pendingThreadId = null
        val webView = bridge?.webView ?: return
        if (fallbackInjectionPending) {
            fallbackInjectionPending = false
            webView.loadDataWithBaseURL(
                config.uiUrl,
                fallbackBootstrapHtml(config, targetUrl),
                "text/html",
                "UTF-8",
                null,
            )
            return
        }

        webView.loadUrl(targetUrl)
    }

    private fun startConfigActivity() {
        startActivity(Intent(this, ConfigActivity::class.java))
    }

    private fun startFeedListenerService(action: String? = null) {
        val serviceIntent = Intent(this, FeedListenerService::class.java).apply {
            action?.let { setAction(it) }
        }

        try {
            ContextCompat.startForegroundService(this, serviceIntent)
        } catch (error: RuntimeException) {
            Log.w(TAG, "Feed listener service could not be started", error)
        }
    }

    private fun permissionRecoveryActionIfBlocked(): String? =
        if (AppPrefs(this).areNotificationsBlocked()) {
            FeedListenerService.ACTION_PERMISSION_UPDATED
        } else {
            null
        }

    private fun notificationsAvailable(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }

        return NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    private fun extractThreadId(intent: Intent?): String? =
        intent?.getStringExtra(EXTRA_THREAD_ID)
            ?: intent?.getStringExtra(LEGACY_EXTRA_THREAD_ID)
            ?: intent?.data?.getQueryParameter("thread")

    private fun buildRuntimeUrl(uiUrl: String, threadId: String?): String {
        val builder = Uri.parse(uiUrl).buildUpon()
        if (!threadId.isNullOrBlank()) {
            builder.appendQueryParameter("thread", threadId)
        }
        return builder.build().toString()
    }

    private fun originRule(rawUrl: String): String =
        Uri.parse(rawUrl).let { uri ->
            val port = if (uri.port == -1) "" else ":${uri.port}"
            "${uri.scheme}://${uri.host}$port"
        }

    private fun fallbackBootstrapHtml(config: ShellConfig, targetUrl: String): String {
        val quotedTargetUrl = JSONObject.quote(targetUrl)
        return """
            <!doctype html>
            <html>
              <head>
                <meta charset="utf-8">
                <script>
                  ${AppPrefs.localStorageScript(config)}
                  window.location.replace($quotedTargetUrl);
                </script>
              </head>
              <body></body>
            </html>
        """.trimIndent()
    }

    companion object {
        const val EXTRA_THREAD_ID = "com.claudecomms.voiceloop.THREAD_ID"
        const val LEGACY_EXTRA_THREAD_ID = "threadId"
        private const val TAG = "VoiceLoopMain"
    }
}
