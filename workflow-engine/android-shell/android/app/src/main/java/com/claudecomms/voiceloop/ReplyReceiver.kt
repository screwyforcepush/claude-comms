package com.claudecomms.voiceloop

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import com.claudecomms.voiceloop.core.ReplyMarshaler
import dev.convex.android.ConvexClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement

class ReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val poster = NotificationPoster(appContext)
            val threadId = threadIdFrom(intent)
            val title = intent?.getStringExtra(NotificationPoster.EXTRA_THREAD_TITLE)
                ?: threadId
                ?: "Claude Comms"

            try {
                if (threadId.isNullOrBlank()) {
                    Log.w(TAG, "Inline reply missing thread id")
                    return@launch
                }

                val content = intent
                    ?.let { replyIntent -> RemoteInput.getResultsFromIntent(replyIntent) }
                    ?.getCharSequence(NotificationPoster.KEY_TEXT_REPLY)
                    ?.toString()
                    ?.let { raw -> runCatching { ReplyMarshaler.normalizeReply(raw) }.getOrNull() }

                if (content.isNullOrBlank()) {
                    poster.appendReplyFailure(threadId, title)
                    return@launch
                }

                val prefs = AppPrefs(appContext)
                val config = prefs.getConfig()
                if (config == null) {
                    poster.appendReplyFailure(threadId, title)
                    return@launch
                }

                val client = convexClient(appContext, config)
                val messageId = addReplyMessage(client, config.password, threadId, content)
                triggerReplyJob(client, config.password, threadId, messageId)
                poster.appendLocalReply(
                    threadId = threadId,
                    title = title,
                    body = content,
                    timestampMillis = System.currentTimeMillis(),
                )
            } catch (error: Throwable) {
                Log.e(TAG, "Inline reply failed", error)
                if (!threadId.isNullOrBlank()) {
                    poster.appendReplyFailure(threadId, title)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun addReplyMessage(
        client: ConvexClient,
        password: String,
        threadId: String,
        content: String,
    ): String {
        val mutation = ReplyMarshaler.addMessage(password, threadId, content)
        return client.mutation<String>(mutation.name, mutation.args)
    }

    private suspend fun triggerReplyJob(
        client: ConvexClient,
        password: String,
        threadId: String,
        messageId: String,
    ) {
        val mutation = ReplyMarshaler.triggerJob(password, threadId, messageId)
        client.mutation<JsonElement>(mutation.name, mutation.args)
    }

    private fun convexClient(context: Context, config: ShellConfig): ConvexClient {
        val app = context.applicationContext as ShellApplication
        return app.convexHolder.clientFor(config.convexUrl)
    }

    private fun threadIdFrom(intent: Intent?): String? {
        return intent?.getStringExtra(NotificationPoster.EXTRA_THREAD_ID)
            ?: intent?.data?.lastPathSegment
    }

    private companion object {
        private const val TAG = "ReplyReceiver"
    }
}
