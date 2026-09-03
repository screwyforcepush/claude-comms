package com.claudecomms.voiceloop.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PayloadMapperTest {
    @Test
    fun mapsTitleAndBodyVerbatimIncludingFiveThousandCharacters() {
        val body = "x".repeat(5000)
        val row = row(title = "Namespace - Thread", body = body)

        val payload = PayloadMapper.toNotificationPayload(row)

        assertEquals("Namespace - Thread", payload.conversationTitle)
        assertEquals(body, payload.incomingMessage.body)
        assertEquals(5000, payload.incomingMessage.body.length)
    }

    @Test
    fun usesThreadIdAsTagWithConstantNotificationId() {
        val first = PayloadMapper.toNotificationPayload(row(threadId = "thread-a"))
        val second = PayloadMapper.toNotificationPayload(row(threadId = "thread-b"))

        assertEquals("thread-a", first.identity.tag)
        assertEquals("thread-b", second.identity.tag)
        assertEquals(PayloadMapper.MESSAGE_NOTIFICATION_ID, first.identity.id)
        assertEquals(PayloadMapper.MESSAGE_NOTIFICATION_ID, second.identity.id)
        assertEquals(first.identity.id, second.identity.id)
    }

    @Test
    fun modelsLocalUserAsYouAndIncomingMessageBodyAsSenderContent() {
        val payload = PayloadMapper.toNotificationPayload(row(body = "verbatim incoming body"))

        assertEquals("You", payload.localUser.name)
        assertEquals("Assistant", payload.incomingMessage.sender.name)
        assertNotEquals(payload.localUser, payload.incomingMessage.sender)
        assertEquals("verbatim incoming body", payload.incomingMessage.body)
    }

    private fun row(
        id: String = "note-1",
        threadId: String = "thread-1",
        title: String = "Namespace - Thread",
        body: String = "body",
    ): FeedRow = FeedRow(
        id = id,
        threadId = threadId,
        title = title,
        body = body,
        createdAt = 1717430400000.0,
        creationTime = 1717430400123.4567,
        deliveredAt = null,
    )
}
