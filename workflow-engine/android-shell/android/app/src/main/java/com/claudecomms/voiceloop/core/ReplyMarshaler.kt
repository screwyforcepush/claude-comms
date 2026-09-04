package com.claudecomms.voiceloop.core

object ReplyMarshaler {
    const val ADD_MESSAGE_MUTATION: String = "chatMessages:add"
    const val TRIGGER_JOB_MUTATION: String = "chatJobs:trigger"
    const val CREATE_THREAD_MUTATION: String = "chatThreads:create"

    // Notification replies are a mediated channel (dictation, sometimes phone-
    // assistant co-drafting by a zero-repo-context agent). The prefix rides on
    // the outgoing mutation only — never on the local notification echo, which
    // shows the user their own words verbatim.
    const val PROVENANCE_PREFIX: String =
        "[transcribed/co-drafted with phone assistant — possible transcription errors; assistant has no repo context]"

    fun mutationSequence(
        password: String,
        threadId: String,
        rawText: String,
        triggerMessageId: String,
    ): List<ConvexMutationDescriptor> = listOf(
        addMessage(password, threadId, rawText),
        triggerJob(password, threadId, triggerMessageId),
    )

    // Lobby replies spawn a fresh thread. No title/mode: the server defaults to
    // jam mode and the Steward retitles on first message, same as a web-created
    // thread.
    fun createThread(
        password: String,
        namespaceId: String,
    ): ConvexMutationDescriptor = ConvexMutationDescriptor(
        name = CREATE_THREAD_MUTATION,
        args = mapOf(
            "password" to password,
            "namespaceId" to namespaceId,
        ),
    )

    fun addMessage(
        password: String,
        threadId: String,
        rawText: String,
    ): ConvexMutationDescriptor {
        val content = normalizeReply(rawText)
        return ConvexMutationDescriptor(
            name = ADD_MESSAGE_MUTATION,
            args = mapOf(
                "password" to password,
                "threadId" to threadId,
                "role" to "user",
                "content" to "$PROVENANCE_PREFIX\n$content",
            ),
        )
    }

    fun triggerJob(
        password: String,
        threadId: String,
        triggerMessageId: String,
    ): ConvexMutationDescriptor = ConvexMutationDescriptor(
        name = TRIGGER_JOB_MUTATION,
        args = mapOf(
            "password" to password,
            "threadId" to threadId,
            "triggerMessageId" to triggerMessageId,
        ),
    )

    fun normalizeReply(rawText: String): String {
        val content = rawText.trim()
        require(content.isNotEmpty()) { "reply must be non-empty" }
        return content
    }
}

data class ConvexMutationDescriptor(
    val name: String,
    val args: Map<String, Any>,
)
