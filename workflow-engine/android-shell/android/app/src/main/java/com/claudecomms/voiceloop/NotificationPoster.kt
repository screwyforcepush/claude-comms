package com.claudecomms.voiceloop

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.LocusIdCompat
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.claudecomms.voiceloop.core.FeedRow
import com.claudecomms.voiceloop.core.NotificationPayload
import com.claudecomms.voiceloop.core.PayloadMapper

class NotificationPoster(private val context: Context) {
    private val appContext = context.applicationContext
    private val notificationManager = appContext.getSystemService(NotificationManager::class.java)
    private val notificationManagerCompat = NotificationManagerCompat.from(appContext)
    private val localUser = Person.Builder().setName(PayloadMapper.LOCAL_USER_NAME).build()

    init {
        ensureMessageChannel()
        ensureLobbyChannel()
    }

    fun canPostMessages(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = appContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }

        if (!notificationManagerCompat.areNotificationsEnabled()) {
            return false
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = notificationManager.getNotificationChannel(MESSAGE_CHANNEL_ID)
            if (channel?.importance == NotificationManager.IMPORTANCE_NONE) {
                return false
            }
        }

        return true
    }

    fun post(row: FeedRow): Boolean {
        if (!canPostMessages()) return false
        val payload = PayloadMapper.toNotificationPayload(row)
        val incoming = personFor(payload.incomingMessage.sender.name)
        val style = styleFor(payload.identity.tag, payload.conversationTitle)
            .addMessage(
                payload.incomingMessage.body,
                payload.incomingMessage.timestamp.toLong(),
                incoming,
            )
        return notify(
            payload.identity.tag,
            payload.identity.id,
            notification(payload, payload.incomingMessage.body, style),
        )
    }

    fun appendLocalReply(
        threadId: String,
        title: String,
        body: String,
        timestampMillis: Long,
        silent: Boolean = false,
    ): Boolean {
        if (!canPostMessages()) return false
        val style = styleFor(threadId, title)
            .addMessage(body, timestampMillis, localUser)
        return notify(
            threadId,
            MESSAGE_NOTIFICATION_ID,
            notification(threadId, title, body, style, onlyAlertOnce = true, silent = silent),
        )
    }

    fun appendReplyFailure(threadId: String, title: String): Boolean {
        if (!canPostMessages()) return false
        val failureText = REPLY_FAILURE_TEXT
        val sender = personFor(PayloadMapper.senderNameFrom(title))
        val style = styleFor(threadId, title)
            .addMessage(failureText, System.currentTimeMillis(), sender)
        return notify(
            threadId,
            MESSAGE_NOTIFICATION_ID,
            notification(threadId, title, failureText, style, onlyAlertOnce = true),
        )
    }

    private fun notification(
        payload: NotificationPayload,
        contentText: String,
        style: NotificationCompat.MessagingStyle,
    ): Notification = notification(
        threadId = payload.identity.tag,
        title = payload.conversationTitle,
        contentText = contentText,
        style = style,
    )

    private fun notification(
        threadId: String,
        title: String,
        contentText: String,
        style: NotificationCompat.MessagingStyle,
        onlyAlertOnce: Boolean = false,
        silent: Boolean = false,
    ): Notification {
        // Long-lived conversation shortcut + shortcutId give the thread a real
        // conversation identity (Person, icon, conversation-space treatment)
        // instead of the raw sender-string fallback.
        pushConversationShortcut(
            tag = threadId,
            label = title,
            person = personFor(PayloadMapper.senderNameFrom(title)),
            intent = openThreadIntent(threadId),
        )
        return NotificationCompat.Builder(appContext, MESSAGE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .setOnlyAlertOnce(onlyAlertOnce)
            .setSilent(silent)
            .setShortcutId(threadId)
            .setLocusId(LocusIdCompat(threadId))
            .setContentIntent(tapPendingIntent(threadId))
            .addAction(replyAction(threadId, title))
            .build()
    }

    private fun styleFor(threadId: String, title: String): NotificationCompat.MessagingStyle {
        val existing = existingStyle(threadId)
        return (existing ?: NotificationCompat.MessagingStyle(localUser))
            .setConversationTitle(title)
    }

    private fun existingStyle(threadId: String): NotificationCompat.MessagingStyle? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null
        val active = notificationManager.activeNotifications
            .firstOrNull { notification ->
                notification.tag == threadId && notification.id == MESSAGE_NOTIFICATION_ID
            }
            ?.notification
            ?: return null
        return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(active)
    }

    private fun replyAction(threadId: String, title: String): NotificationCompat.Action {
        val remoteInput = RemoteInput.Builder(KEY_TEXT_REPLY)
            .setLabel("Reply")
            .build()

        return NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send,
            "Reply",
            replyPendingIntent(threadId, title),
        )
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .build()
    }

    private fun openThreadIntent(threadId: String): Intent =
        Intent(appContext, MainActivity::class.java)
            .setAction(ACTION_OPEN_THREAD)
            .setData(threadUri("open", threadId))
            .putExtra(EXTRA_THREAD_ID, threadId)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    private fun tapPendingIntent(threadId: String): PendingIntent {
        val intent = openThreadIntent(threadId)

        return PendingIntent.getActivity(
            appContext,
            requestCode("open", threadId),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private fun replyPendingIntent(threadId: String, title: String): PendingIntent {
        val intent = Intent(appContext, ReplyReceiver::class.java)
            .setAction(ACTION_REPLY)
            .setData(threadUri("reply", threadId))
            .putExtra(EXTRA_THREAD_ID, threadId)
            .putExtra(EXTRA_THREAD_TITLE, title)

        return PendingIntent.getBroadcast(
            appContext,
            requestCode("reply", threadId),
            intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    /**
     * Standing per-namespace lobby: a silent conversation titled "Lobby" whose
     * inline reply spawns a fresh thread. Always posts a fresh style (never
     * appends), which is also how the lobby re-arms after each use. [note]
     * appends one extra line from the namespace sender (used for reply
     * failures on the lobby itself).
     */
    fun postLobby(namespaceId: String, namespaceName: String, note: String? = null): Boolean {
        if (!canPostMessages()) return false
        val payload = PayloadMapper.toLobbyPayload(
            namespaceId = namespaceId,
            namespaceName = namespaceName,
            timestamp = System.currentTimeMillis().toDouble(),
        )
        val tag = payload.identity.tag
        val sender = personFor(namespaceName)
        val style = NotificationCompat.MessagingStyle(localUser)
            .setConversationTitle(payload.conversationTitle)
            .addMessage(
                payload.incomingMessage.body,
                payload.incomingMessage.timestamp.toLong(),
                sender,
            )
        if (note != null) {
            style.addMessage(note, System.currentTimeMillis(), sender)
        }

        pushConversationShortcut(
            tag = tag,
            label = payload.conversationTitle,
            person = sender,
            intent = Intent(appContext, MainActivity::class.java)
                .setAction(Intent.ACTION_MAIN)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )

        val notification = NotificationCompat.Builder(appContext, LOBBY_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(payload.conversationTitle)
            .setContentText(note ?: payload.incomingMessage.body)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .setShowWhen(false)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setShortcutId(tag)
            .setLocusId(LocusIdCompat(tag))
            .setContentIntent(lobbyTapPendingIntent(tag))
            .addAction(lobbyReplyAction(tag, namespaceName))
            .build()
        return notify(tag, payload.identity.id, notification)
    }

    fun isLobbyPosted(namespaceId: String): Boolean {
        val tag = PayloadMapper.lobbyTag(namespaceId)
        return notificationManager.activeNotifications.any { active ->
            active.tag == tag && active.id == MESSAGE_NOTIFICATION_ID
        }
    }

    private fun lobbyTapPendingIntent(tag: String): PendingIntent {
        // The lobby has no thread yet — tapping just opens the app.
        val intent = Intent(appContext, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            appContext,
            requestCode("open", tag),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private fun lobbyReplyAction(tag: String, namespaceName: String): NotificationCompat.Action {
        val remoteInput = RemoteInput.Builder(KEY_TEXT_REPLY)
            .setLabel("Reply")
            .build()
        val intent = Intent(appContext, ReplyReceiver::class.java)
            .setAction(ACTION_REPLY)
            .setData(threadUri("reply", tag))
            .putExtra(EXTRA_THREAD_ID, tag)
            .putExtra(EXTRA_THREAD_TITLE, PayloadMapper.LOBBY_TITLE)
            .putExtra(EXTRA_NAMESPACE_NAME, namespaceName)
        val pendingIntent = PendingIntent.getBroadcast(
            appContext,
            requestCode("reply", tag),
            intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send,
            "Reply",
            pendingIntent,
        )
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .build()
    }

    // Namespace names are stable slugs (engine-composed), so the name doubles
    // as the Person's stable key across lobby and thread conversations.
    private fun personFor(name: String): Person =
        Person.Builder()
            .setName(name)
            .setKey("ns:$name")
            .setIcon(IconCompat.createWithResource(appContext, R.mipmap.ic_launcher))
            .build()

    private fun pushConversationShortcut(
        tag: String,
        label: String,
        person: Person,
        intent: Intent,
    ) {
        // Best-effort: a shortcut failure must never block a post.
        runCatching {
            val shortcut = ShortcutInfoCompat.Builder(appContext, tag)
                .setShortLabel(label)
                .setLongLived(true)
                .setPerson(person)
                .setIcon(IconCompat.createWithResource(appContext, R.mipmap.ic_launcher))
                .setLocusId(LocusIdCompat(tag))
                .setIntent(intent)
                .build()
            ShortcutManagerCompat.pushDynamicShortcut(appContext, shortcut)
        }.onFailure { error ->
            Log.w(TAG, "Conversation shortcut push failed for $tag", error)
        }
    }

    private fun notify(threadId: String, notificationId: Int, notification: Notification): Boolean {
        return runCatching {
            notificationManagerCompat.notify(threadId, notificationId, notification)
        }.isSuccess
    }

    private fun ensureMessageChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (notificationManager.getNotificationChannel(MESSAGE_CHANNEL_ID) != null) return
        notificationManager.createNotificationChannel(
            NotificationChannel(
                MESSAGE_CHANNEL_ID,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Slipgate voice-loop messages"
                setShowBadge(true)
            },
        )
    }

    private fun ensureLobbyChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (notificationManager.getNotificationChannel(LOBBY_CHANNEL_ID) != null) return
        notificationManager.createNotificationChannel(
            NotificationChannel(
                LOBBY_CHANNEL_ID,
                "Lobby",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Standing new-thread lobbies (silent)"
                setShowBadge(false)
            },
        )
    }

    private fun threadUri(action: String, threadId: String): Uri {
        return Uri.Builder()
            .scheme("voiceloop")
            .authority(action)
            .appendPath(threadId)
            .build()
    }

    private fun requestCode(action: String, threadId: String): Int {
        return 31 * action.hashCode() + threadId.hashCode()
    }

    companion object {
        private const val TAG = "NotificationPoster"
        const val MESSAGE_CHANNEL_ID = "voice_loop_messages"
        const val LOBBY_CHANNEL_ID = "voice_loop_lobby"
        val MESSAGE_NOTIFICATION_ID: Int = PayloadMapper.MESSAGE_NOTIFICATION_ID
        const val KEY_TEXT_REPLY = "voice_loop_inline_reply"
        const val EXTRA_THREAD_ID = "com.claudecomms.voiceloop.THREAD_ID"
        const val EXTRA_THREAD_TITLE = "com.claudecomms.voiceloop.THREAD_TITLE"
        const val EXTRA_NAMESPACE_NAME = "com.claudecomms.voiceloop.NAMESPACE_NAME"
        const val ACTION_REPLY = "com.claudecomms.voiceloop.REPLY"
        const val ACTION_OPEN_THREAD = "com.claudecomms.voiceloop.OPEN_THREAD"
        const val REPLY_FAILURE_TEXT = "Reply failed - open the app"
    }
}
