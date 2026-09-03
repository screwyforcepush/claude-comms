package com.claudecomms.voiceloop.core

object ReplyMarshaler {
    const val ADD_MESSAGE_MUTATION: String = "chatMessages:add"
    const val TRIGGER_JOB_MUTATION: String = "chatJobs:trigger"

    fun mutationSequence(
        password: String,
        threadId: String,
        rawText: String,
        triggerMessageId: String,
    ): List<ConvexMutationDescriptor> = listOf(
        addMessage(password, threadId, rawText),
        triggerJob(password, threadId, triggerMessageId),
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
                "content" to content,
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
