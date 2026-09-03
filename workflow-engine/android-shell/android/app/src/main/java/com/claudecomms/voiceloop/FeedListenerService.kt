package com.claudecomms.voiceloop

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.claudecomms.voiceloop.core.FeedPage
import com.claudecomms.voiceloop.core.FeedProtocol
import dev.convex.android.ConvexClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement

class FeedListenerService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: AppPrefs
    private lateinit var poster: NotificationPoster
    private lateinit var connectivityManager: ConnectivityManager
    private var listenerJob: Job? = null
    private var initialDrainAttempted = false
    private var networkCallbackRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            restartListener("network available")
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = AppPrefs(applicationContext)
        poster = NotificationPoster(applicationContext)
        connectivityManager = getSystemService(ConnectivityManager::class.java)
        ensureServiceChannel()
        startForeground(SERVICE_NOTIFICATION_ID, serviceNotification(blocked = false))
        runCatching {
            connectivityManager.registerDefaultNetworkCallback(networkCallback)
            networkCallbackRegistered = true
        }.onFailure { error ->
            Log.w(TAG, "Network callback unavailable", error)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (listenerJob?.isActive != true) {
            listenerJob = serviceScope.launch {
                runListener()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (networkCallbackRegistered) {
            runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
        }
        listenerJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun restartListener(reason: String) {
        Log.i(TAG, "Restarting feed listener: $reason")
        listenerJob?.cancel()
        listenerJob = serviceScope.launch {
            runListener()
        }
    }

    private suspend fun runListener() {
        val config = prefs.getConfig()
        if (config == null) {
            updateBlockedState(blocked = true)
            Log.w(TAG, "Feed listener cannot start without shell config")
            return
        }

        val client = convexClient(config)
        if (!initialDrainAttempted && prefs.getFeedCursor() == null) {
            drainFreshInstall(client, config.password)
            initialDrainAttempted = true
        }

        var retryDelayMs = INITIAL_RETRY_DELAY_MS
        while (serviceScope.isActive) {
            try {
                collectFeed(client, config.password)
                retryDelayMs = INITIAL_RETRY_DELAY_MS
            } catch (advanced: CursorAdvanced) {
                retryDelayMs = INITIAL_RETRY_DELAY_MS
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                Log.e(TAG, "Feed listener failed; retrying", error)
                delay(retryDelayMs)
                retryDelayMs = (retryDelayMs * 2).coerceAtMost(MAX_RETRY_DELAY_MS)
            }
        }
    }

    private suspend fun drainFreshInstall(client: ConvexClient, password: String) {
        var cursor: Double? = null
        var latestCursor: Double? = null

        while (serviceScope.isActive) {
            val page = client
                .subscribe<FeedPage>(
                    "notifications:feed",
                    FeedProtocol.feedArgs(
                        password = password,
                        cursor = cursor,
                        limit = FeedProtocol.FRESH_INSTALL_DRAIN_LIMIT,
                    ),
                )
                .first()
                .getOrThrow()

            val nextCursor = page.nextCursor
            if (nextCursor == null) {
                break
            }
            latestCursor = nextCursor
            cursor = nextCursor
        }

        latestCursor?.let { prefs.setFeedCursor(it) }
    }

    private suspend fun collectFeed(client: ConvexClient, password: String) {
        val cursor = prefs.getFeedCursor()
        client
            .subscribe<FeedPage>(
                "notifications:feed",
                FeedProtocol.feedArgs(
                    password = password,
                    cursor = cursor,
                    limit = FeedProtocol.LIVE_LIMIT,
                ),
            )
            .collect { result ->
                result
                    .onSuccess { page ->
                        if (processLivePage(client, password, page)) {
                            throw CursorAdvanced()
                        }
                    }
                    .onFailure { error ->
                        Log.w(TAG, "Feed emission failed", error)
                    }
            }
    }

    private suspend fun processLivePage(
        client: ConvexClient,
        password: String,
        page: FeedPage,
    ): Boolean {
        if (page.rows.isEmpty()) {
            return false
        }

        if (!poster.canPostMessages()) {
            updateBlockedState(blocked = true)
            return false
        }
        updateBlockedState(blocked = false)

        val ackIds = mutableListOf<String>()
        var hadPostFailure = false

        for (row in page.rows) {
            if (row.deliveredAt != null) {
                ackIds += row.id
                continue
            }

            if (poster.post(row)) {
                ackIds += row.id
            } else {
                hadPostFailure = true
            }
        }

        if (ackIds.isNotEmpty()) {
            val acked = markDelivered(client, password, ackIds)
            if (!acked) {
                return false
            }
        }

        if (hadPostFailure) {
            return false
        }

        val nextCursor = page.nextCursor ?: return false
        prefs.setFeedCursor(nextCursor)
        return true
    }

    private suspend fun markDelivered(
        client: ConvexClient,
        password: String,
        ids: List<String>,
    ): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            client.mutation<JsonElement>(
                "notifications:markDelivered",
                mapOf(
                    "password" to password,
                    "ids" to ids,
                ),
            )
        }
            .onFailure { error -> Log.e(TAG, "markDelivered failed", error) }
            .isSuccess
    }

    private fun updateBlockedState(blocked: Boolean) {
        prefs.setNotificationsBlocked(blocked)
        val notification = serviceNotification(blocked = blocked)
        startForeground(SERVICE_NOTIFICATION_ID, notification)
    }

    private fun serviceNotification(blocked: Boolean): Notification {
        val text = if (blocked) {
            "Notifications disabled - open the app"
        } else {
            "Feed listener active"
        }

        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(this, MainActivity::class.java)
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            SERVICE_NOTIFICATION_ID,
            tapIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
        )

        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Claude Comms")
            .setContentText(text)
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun ensureServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(SERVICE_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                SERVICE_CHANNEL_ID,
                "Feed listener",
                NotificationManager.IMPORTANCE_MIN,
            ).apply {
                description = "Keeps the notification feed connected"
                setShowBadge(false)
            },
        )
    }

    private fun convexClient(config: ShellConfig): ConvexClient {
        val app = applicationContext as ShellApplication
        return app.convexHolder.clientFor(config.convexUrl)
    }

    private class CursorAdvanced : CancellationException()

    private companion object {
        private const val TAG = "FeedListenerService"
        private const val SERVICE_CHANNEL_ID = "voice_loop_feed_service"
        private const val SERVICE_NOTIFICATION_ID = 9001
        private const val INITIAL_RETRY_DELAY_MS = 1_000L
        private const val MAX_RETRY_DELAY_MS = 30_000L
    }
}
