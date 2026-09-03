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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import com.claudecomms.voiceloop.core.FeedRow
import com.claudecomms.voiceloop.core.NotificationPayload
import com.claudecomms.voiceloop.core.PayloadMapper

class NotificationPoster(private val context: Context) {
    private val appContext = context.applicationContext
    private val notificationManager = appContext.getSystemService(NotificationManager::class.java)
    private val notificationManagerCompat = NotificationManagerCompat.from(appContext)
    private val localUser = Person.Builder().setName(PayloadMapper.LOCAL_USER_NAME).build()
    private val assistant = Person.Builder().setName(PayloadMapper.INCOMING_SENDER_NAME).build()

    init {
        ensureMessageChannel()
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
        val incoming = Person.Builder().setName(payload.incomingMessage.sender.name).build()
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
    ): Boolean {
        if (!canPostMessages()) return false
        val style = styleFor(threadId, title)
            .addMessage(body, timestampMillis, localUser)
        return notify(
            threadId,
            MESSAGE_NOTIFICATION_ID,
            notification(threadId, title, body, style, onlyAlertOnce = true),
        )
    }

    fun appendReplyFailure(threadId: String, title: String): Boolean {
        if (!canPostMessages()) return false
        val failureText = "Reply failed - open the app"
        val style = styleFor(threadId, title)
            .addMessage(failureText, System.currentTimeMillis(), assistant)
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
    ): Notification {
        return NotificationCompat.Builder(appContext, MESSAGE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .setOnlyAlertOnce(onlyAlertOnce)
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

    private fun tapPendingIntent(threadId: String): PendingIntent {
        val intent = Intent(appContext, MainActivity::class.java)
            .setAction(ACTION_OPEN_THREAD)
            .setData(threadUri("open", threadId))
            .putExtra(EXTRA_THREAD_ID, threadId)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)

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
                description = "Claude Comms voice-loop messages"
                setShowBadge(true)
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
        const val MESSAGE_CHANNEL_ID = "voice_loop_messages"
        val MESSAGE_NOTIFICATION_ID: Int = PayloadMapper.MESSAGE_NOTIFICATION_ID
        const val KEY_TEXT_REPLY = "voice_loop_inline_reply"
        const val EXTRA_THREAD_ID = "com.claudecomms.voiceloop.THREAD_ID"
        const val EXTRA_THREAD_TITLE = "com.claudecomms.voiceloop.THREAD_TITLE"
        const val ACTION_REPLY = "com.claudecomms.voiceloop.REPLY"
        const val ACTION_OPEN_THREAD = "com.claudecomms.voiceloop.OPEN_THREAD"
    }
}
