package com.claudecomms.voiceloop

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import com.claudecomms.voiceloop.core.PayloadMapper
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
                ?: "Slipgate"
            val namespaceName = intent?.getStringExtra(NotificationPoster.EXTRA_NAMESPACE_NAME)

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
                    replyFailed(poster, threadId, title, namespaceName)
                    return@launch
                }

                val prefs = AppPrefs(appContext)
                val config = prefs.getConfig()
                if (config == null) {
                    replyFailed(poster, threadId, title, namespaceName)
                    return@launch
                }

                val client = convexClient(appContext, config)
                if (PayloadMapper.isLobbyTag(threadId)) {
                    handleLobbyReply(client, poster, config.password, threadId, namespaceName, content)
                } else {
                    val messageId = addReplyMessage(client, config.password, threadId, content)
                    triggerReplyJob(client, config.password, threadId, messageId)
                    poster.appendLocalReply(
                        threadId = threadId,
                        title = title,
                        body = content,
                        timestampMillis = System.currentTimeMillis(),
                    )
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Inline reply failed", error)
                if (!threadId.isNullOrBlank()) {
                    replyFailed(poster, threadId, title, namespaceName)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    // A lobby reply spawns a fresh thread: create → add message → trigger job,
    // in that order so the dictated text can never land without a thread to
    // hold it. The new thread echoes as its own conversation; the lobby then
    // re-arms fresh for the next voice-initiated thread.
    private suspend fun handleLobbyReply(
        client: ConvexClient,
        poster: NotificationPoster,
        password: String,
        lobbyTag: String,
        namespaceName: String?,
        content: String,
    ) {
        val namespaceId = PayloadMapper.namespaceIdFromLobbyTag(lobbyTag)
        val create = ReplyMarshaler.createThread(password, namespaceId)
        val newThreadId = client.mutation<String>(create.name, create.args)
        val messageId = addReplyMessage(client, password, newThreadId, content)
        triggerReplyJob(client, password, newThreadId, messageId)

        val echoTitle = if (namespaceName.isNullOrBlank()) {
            "New Chat"
        } else {
            "$namespaceName${PayloadMapper.TITLE_SEPARATOR}New Chat"
        }
        // Silent: the user's own dictated words must never alert them — the
        // card exists only as the anchor the assistant's response appends to.
        poster.appendLocalReply(
            threadId = newThreadId,
            title = echoTitle,
            body = content,
            timestampMillis = System.currentTimeMillis(),
            silent = true,
        )
        if (!namespaceName.isNullOrBlank()) {
            poster.postLobby(namespaceId, namespaceName)
        }
    }

    private fun replyFailed(
        poster: NotificationPoster,
        threadId: String,
        title: String,
        namespaceName: String?,
    ) {
        if (PayloadMapper.isLobbyTag(threadId) && !namespaceName.isNullOrBlank()) {
            poster.postLobby(
                namespaceId = PayloadMapper.namespaceIdFromLobbyTag(threadId),
                namespaceName = namespaceName,
                note = NotificationPoster.REPLY_FAILURE_TEXT,
            )
        } else {
            poster.appendReplyFailure(threadId, title)
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
