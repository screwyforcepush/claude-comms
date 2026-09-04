package com.claudecomms.voiceloop.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class ReplyMarshalerTest {
    @Test
    fun trimsReplyTextAndRejectsBlankReplies() {
        val descriptors = ReplyMarshaler.mutationSequence(
            password = "pw",
            threadId = "thread-1",
            rawText = "  dictated reply  ",
            triggerMessageId = "message-1",
        )

        assertEquals(
            "${ReplyMarshaler.PROVENANCE_PREFIX}\ndictated reply",
            descriptors[0].args["content"],
        )
        assertThrows(IllegalArgumentException::class.java) {
            ReplyMarshaler.mutationSequence(
                password = "pw",
                threadId = "thread-1",
                rawText = " \n\t ",
                triggerMessageId = "message-1",
            )
        }
    }

    @Test
    fun emitsExactlyAddMessageThenTriggerJobDescriptors() {
        val descriptors = ReplyMarshaler.mutationSequence(
            password = "pw",
            threadId = "thread-1",
            rawText = "reply",
            triggerMessageId = "message-1",
        )

        assertEquals(listOf("chatMessages:add", "chatJobs:trigger"), descriptors.map { it.name })
        assertEquals(
            mapOf(
                "password" to "pw",
                "threadId" to "thread-1",
                "role" to "user",
                "content" to "${ReplyMarshaler.PROVENANCE_PREFIX}\nreply",
            ),
            descriptors[0].args,
        )
        assertEquals(
            mapOf(
                "password" to "pw",
                "threadId" to "thread-1",
                "triggerMessageId" to "message-1",
            ),
            descriptors[1].args,
        )
    }

    @Test
    fun triggerDescriptorCarriesNoHarnessOrModelArguments() {
        val trigger = ReplyMarshaler.mutationSequence(
            password = "pw",
            threadId = "thread-1",
            rawText = "reply",
            triggerMessageId = "message-1",
        )[1]

        assertFalse(trigger.args.containsKey("harness"))
        assertFalse(trigger.args.containsKey("model"))
        assertEquals(setOf("password", "threadId", "triggerMessageId"), trigger.args.keys)
    }

    @Test
    fun createThreadDescriptorCarriesOnlyPasswordAndNamespaceId() {
        val descriptor = ReplyMarshaler.createThread(
            password = "pw",
            namespaceId = "ns-1",
        )

        assertEquals("chatThreads:create", descriptor.name)
        // No title/mode: the server defaults a fresh thread to jam mode and the
        // Steward retitles it on first message.
        assertEquals(mapOf("password" to "pw", "namespaceId" to "ns-1"), descriptor.args)
    }

    @Test
    fun neverEmitsMarkReadDescriptor() {
        val descriptors = ReplyMarshaler.mutationSequence(
            password = "pw",
            threadId = "thread-1",
            rawText = "reply",
            triggerMessageId = "message-1",
        )

        assertFalse(descriptors.any { it.name == "chatThreads:markRead" })
        assertFalse(descriptors.any { it.name.contains("markRead") })
    }
}
