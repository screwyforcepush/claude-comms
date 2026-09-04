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
import com.claudecomms.voiceloop.core.LobbyRoster
import com.claudecomms.voiceloop.core.LobbyTarget
import dev.convex.android.ConvexClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement

class FeedListenerService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: AppPrefs
    private lateinit var poster: NotificationPoster
    private lateinit var connectivityManager: ConnectivityManager
    private var listenerJob: Job? = null
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
        val shouldRestart = listenerJob?.isActive == true &&
            (intent?.action == ACTION_PERMISSION_UPDATED || prefs.areNotificationsBlocked())

        if (shouldRestart) {
            restartListener(intent?.action ?: "service start while blocked")
        } else if (listenerJob?.isActive != true) {
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
        var retryDelayMs = INITIAL_RETRY_DELAY_MS
        while (serviceScope.isActive) {
            try {
                coroutineScope {
                    // Lobby reconcile rides the live namespaces:list
                    // subscription: a lobbyEnabled toggle flip reposts or
                    // cancels lobbies within seconds — no service restart
                    // needed. Each fresh pass also resurrects dismissed
                    // lobbies via its first emission.
                    val lobbies = launch { watchLobbies(client, config.password) }
                    try {
                        if (!prefs.isFeedInitialized()) {
                            drainFreshInstall(client, config.password)
                        }
                        collectFeed(client, config.password)
                    } finally {
                        lobbies.cancel()
                    }
                }
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

    // Best-effort per emission: lobbies are shade furniture and must never
    // break the feed. Emission failures are logged and skipped; if the
    // subscription itself dies it takes the pass down with it and the retry
    // loop relaunches both.
    private suspend fun watchLobbies(client: ConvexClient, password: String) {
        client
            .subscribe<JsonElement>("namespaces:list", mapOf("password" to password))
            .collect { result ->
                result
                    .onSuccess { rows ->
                        runCatching { reconcileLobbies(LobbyRoster.parse(rows)) }
                            .onFailure { error -> Log.w(TAG, "Lobby reconcile failed", error) }
                    }
                    .onFailure { error ->
                        Log.w(TAG, "Lobby subscription emission failed", error)
                    }
            }
    }

    private fun reconcileLobbies(targets: List<LobbyTarget>) {
        for (target in targets) {
            // Standing lobbies are opt-in per namespace (lobbyEnabled,
            // default off). Cancelling on the disabled path is what
            // clears a standing lobby after its toggle flips off.
            if (target.enabled) {
                if (!poster.isLobbyPosted(target.namespaceId)) {
                    poster.postLobby(target.namespaceId, target.name)
                }
            } else if (poster.isLobbyPosted(target.namespaceId)) {
                poster.cancelLobby(target.namespaceId)
            }
        }
    }

    private suspend fun drainFreshInstall(client: ConvexClient, password: String) {
        FeedProtocol.drainFreshInstall(
            password = password,
            feedInitialized = prefs.isFeedInitialized(),
            fetchPage = { args ->
                client
                    .subscribe<FeedPage>("notifications:feed", args)
                    .first()
                    .getOrThrow()
            },
            persistCursor = { cursor -> prefs.setFeedCursor(cursor) },
            markFeedInitialized = { prefs.setFeedInitialized(true) },
        )
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
                        val result = processLivePage(client, password, page)
                        if (result.advancedCursor != null) {
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
    ): com.claudecomms.voiceloop.core.LivePageResult {
        if (page.rows.isEmpty()) {
            return FeedProtocol.processLivePage(page, effects = liveEffects(client, password))
        }

        if (!poster.canPostMessages()) {
            updateBlockedState(blocked = true)
            return FeedProtocol.processLivePage(
                page = FeedPage(rows = emptyList(), nextCursor = null),
                effects = liveEffects(client, password),
            )
        }
        updateBlockedState(blocked = false)

        return FeedProtocol.processLivePage(
            page = page,
            effects = liveEffects(client, password),
        )
    }

    private fun liveEffects(client: ConvexClient, password: String): FeedProtocol.LiveEffects =
        object : FeedProtocol.LiveEffects {
            override fun postedButUnackedIds(): Set<String> = prefs.postedButUnackedIds()

            override fun post(row: com.claudecomms.voiceloop.core.FeedRow): Boolean =
                poster.post(row)

            override fun rememberPostedButUnacked(ids: List<String>) {
                prefs.rememberPostedButUnacked(ids)
            }

            override fun markDelivered(ids: List<String>): Boolean =
                runBlocking { this@FeedListenerService.markDelivered(client, password, ids) }

            override fun clearPostedButUnacked(ids: List<String>) {
                prefs.clearPostedButUnacked(ids)
            }

            override fun persistCursor(cursor: Double) {
                prefs.setFeedCursor(cursor)
            }
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

        val tapIntent = if (blocked) {
            Intent(this, ConfigActivity::class.java)
        } else {
            packageManager.getLaunchIntentForPackage(packageName)
                ?: Intent(this, MainActivity::class.java)
        }
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

    // Thrown only inside collection and caught before CancellationException to force a clean resubscribe.
    private class CursorAdvanced : CancellationException()

    companion object {
        const val ACTION_PERMISSION_UPDATED = "com.claudecomms.voiceloop.PERMISSION_UPDATED"

        private const val TAG = "FeedListenerService"
        private const val SERVICE_CHANNEL_ID = "voice_loop_feed_service"
        private const val SERVICE_NOTIFICATION_ID = 9001
        private const val INITIAL_RETRY_DELAY_MS = 1_000L
        private const val MAX_RETRY_DELAY_MS = 30_000L
    }
}
