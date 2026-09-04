package com.claudecomms.voiceloop.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PayloadMapperTest {
    @Test
    fun keepsFullTitleAsConversationTitleAndPrependsTopicToFiveThousandCharBody() {
        val body = "x".repeat(5000)
        val row = row(title = "claude-comms · Voice Loop", body = body)

        val payload = PayloadMapper.toNotificationPayload(row)

        assertEquals("claude-comms · Voice Loop", payload.conversationTitle)
        assertEquals("Voice Loop — $body", payload.incomingMessage.body)
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
    fun sendsAsNamespaceWithTopicPrefixedBody() {
        val payload = PayloadMapper.toNotificationPayload(
            row(title = "claude-comms · Mobile Voice Workflow", body = "verbatim incoming body"),
        )

        assertEquals("You", payload.localUser.name)
        assertEquals("claude-comms", payload.incomingMessage.sender.name)
        assertNotEquals(payload.localUser, payload.incomingMessage.sender)
        assertEquals("Mobile Voice Workflow — verbatim incoming body", payload.incomingMessage.body)
    }

    @Test
    fun fallsBackToWholeTitleAsSenderAndVerbatimBodyWhenSeparatorAbsent() {
        val payload = PayloadMapper.toNotificationPayload(
            row(title = "claude-comms", body = "verbatim incoming body"),
        )

        assertEquals("claude-comms", payload.incomingMessage.sender.name)
        assertEquals("verbatim incoming body", payload.incomingMessage.body)
    }

    @Test
    fun lobbyPayloadSpeaksAsNamespaceUnderTheLobbyTitle() {
        val payload = PayloadMapper.toLobbyPayload(
            namespaceId = "ns-1",
            namespaceName = "claude-comms",
            timestamp = 1717430400000.0,
        )

        assertEquals("lobby:ns-1", payload.identity.tag)
        assertEquals(PayloadMapper.MESSAGE_NOTIFICATION_ID, payload.identity.id)
        assertEquals(PayloadMapper.LOBBY_TITLE, payload.conversationTitle)
        assertEquals("claude-comms", payload.incomingMessage.sender.name)
        assertEquals(PayloadMapper.LOBBY_PROMPT, payload.incomingMessage.body)
        assertEquals(1717430400000.0, payload.incomingMessage.timestamp, 0.0)
    }

    @Test
    fun lobbyTagRoundTripsAndNeverCollidesWithThreadTags() {
        val tag = PayloadMapper.lobbyTag("ns-1")

        assertEquals(true, PayloadMapper.isLobbyTag(tag))
        assertEquals(false, PayloadMapper.isLobbyTag("thread-1"))
        assertEquals("ns-1", PayloadMapper.namespaceIdFromLobbyTag(tag))
        assertNotEquals("ns-1", tag)
    }

    private fun row(
        id: String = "note-1",
        threadId: String = "thread-1",
        title: String = "claude-comms · Thread Topic",
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
