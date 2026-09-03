package com.claudecomms.voiceloop.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlinx.serialization.json.Json

class FeedProtocolTest {
    @Test
    fun advancesOnlyWhenNextCursorIsNonNull() {
        val effects = RecordingLiveEffects()
        val page = FeedPage(
            rows = listOf(row(id = "note-1", creationTime = 123.4567)),
            nextCursor = 123.4567,
        )

        val result = FeedProtocol.processLivePage(page, effects = effects)

        assertEquals(123.4567, result.advancedCursor)
        assertFalse(result.blocked)
        assertEquals(listOf("post:note-1", "ack:note-1", "persist:123.4567"), effects.events)
    }

    @Test
    fun emptyPageNeverAdvancesCursor() {
        val effects = RecordingLiveEffects()

        val result = FeedProtocol.processLivePage(
            page = FeedPage(rows = emptyList(), nextCursor = null),
            effects = effects,
        )

        assertNull(result.advancedCursor)
        assertFalse(result.shouldResubscribe)
        assertTrue(effects.events.isEmpty())
    }

    @Test
    fun feedArgumentsKeepCursorAndLimitAsDoubles() {
        val cursor = 1717430400123.4567

        val liveArgs = FeedProtocol.feedArgs(password = "pw", cursor = cursor)
        val drainArgs = FeedProtocol.feedArgs(
            password = "pw",
            cursor = cursor,
            limit = FeedProtocol.FRESH_INSTALL_DRAIN_LIMIT,
        )

        assertTrue(liveArgs["cursor"] is Double)
        assertTrue(liveArgs["limit"] is Double)
        assertEquals(FeedProtocol.LIVE_LIMIT, liveArgs["limit"])
        assertTrue(drainArgs["cursor"] is Double)
        assertTrue(drainArgs["limit"] is Double)
        assertEquals(200.0, drainArgs["limit"])
    }

    @Test
    fun feedDtoDecodesCreationTimeAndNextCursorAsFractionalDoubles() {
        val page = Json.decodeFromString<FeedPage>(
            """
                {
                  "rows": [
                    {
                      "_id": "note-1",
                      "namespaceId": "namespace-1",
                      "threadId": "thread-1",
                      "title": "Namespace - Thread",
                      "body": "Body",
                      "createdAt": 1717430400123.25,
                      "_creationTime": 1717430400123.4567
                    }
                  ],
                  "nextCursor": 1717430400123.4567
                }
            """.trimIndent(),
        )

        val row = page.rows.single()
        assertEquals(
            java.lang.Double.doubleToRawLongBits(1717430400123.4567),
            java.lang.Double.doubleToRawLongBits(row.creationTime),
        )
        assertEquals(
            java.lang.Double.doubleToRawLongBits(1717430400123.25),
            java.lang.Double.doubleToRawLongBits(row.createdAt),
        )
        assertEquals(
            java.lang.Double.doubleToRawLongBits(1717430400123.4567),
            java.lang.Double.doubleToRawLongBits(page.nextCursor!!),
        )
    }

    @Test
    fun fractionalCursorRoundTripsThroughRawLongBits() {
        val cursor = 1717430400123.4567

        val bits = FeedProtocol.encodeCursorForStorage(cursor)
        val restored = FeedProtocol.decodeCursorFromStorage(bits)

        assertEquals(java.lang.Double.doubleToRawLongBits(cursor), bits)
        assertEquals(
            java.lang.Double.doubleToRawLongBits(cursor),
            java.lang.Double.doubleToRawLongBits(restored),
        )
    }

    @Test
    fun freshInstallDrainKeepsLastNonNullCursorAndPostsNothing() {
        val pages = ArrayDeque(
            listOf(
                FeedPage(
                    rows = listOf(row(id = "old-1", creationTime = 10.25)),
                    nextCursor = 10.25,
                ),
                FeedPage(
                    rows = listOf(row(id = "old-2", creationTime = 20.5)),
                    nextCursor = 20.5,
                ),
                FeedPage(rows = emptyList(), nextCursor = null),
            ),
        )
        val fetchArgs = mutableListOf<Map<String, Any?>>()
        val persisted = mutableListOf<Double>()

        val result = FeedProtocol.drainFreshInstall(
            password = "pw",
            fetchPage = { args ->
                fetchArgs += args
                pages.removeFirst()
            },
            persistCursor = { persisted += it },
        )

        assertEquals(20.5, result.cursorToPersist)
        assertEquals(3, result.pagesRead)
        assertEquals(listOf(20.5), persisted)
        assertNull(fetchArgs[0]["cursor"])
        assertEquals(10.25, fetchArgs[1]["cursor"])
        assertEquals(20.5, fetchArgs[2]["cursor"])
        assertTrue(fetchArgs.all { it["limit"] is Double && it["limit"] == 200.0 })
    }

    @Test
    fun emptyTableFreshInstallLeavesCursorNull() {
        var persistCalled = false

        val result = FeedProtocol.drainFreshInstall(
            password = "pw",
            fetchPage = { FeedPage(rows = emptyList(), nextCursor = null) },
            persistCursor = {
                persistCalled = true
            },
        )

        assertNull(result.cursorToPersist)
        assertEquals(1, result.pagesRead)
        assertFalse(persistCalled)
    }

    @Test
    fun deliveredRowsAreSkippedForPostingButAdvancedPast() {
        val effects = RecordingLiveEffects()
        val page = FeedPage(
            rows = listOf(row(id = "already-delivered", creationTime = 44.75, deliveredAt = 55.0)),
            nextCursor = 44.75,
        )

        val result = FeedProtocol.processLivePage(page, effects = effects)

        assertEquals(44.75, result.advancedCursor)
        assertEquals(emptyList<String>(), result.postedIds)
        assertEquals(listOf("already-delivered"), result.acknowledgedIds)
        assertEquals(listOf("ack:already-delivered", "persist:44.75"), effects.events)
    }

    @Test
    fun failedOrUnpermittedPostBlocksAckAndCursorPersistence() {
        val effects = RecordingLiveEffects(postResults = mapOf("note-1" to false))
        val page = FeedPage(
            rows = listOf(row(id = "note-1", creationTime = 99.5)),
            nextCursor = 99.5,
        )

        val result = FeedProtocol.processLivePage(page, effects = effects)

        assertTrue(result.blocked)
        assertEquals(FeedProtocol.BlockedReason.POST_FAILED, result.blockedReason)
        assertNull(result.advancedCursor)
        assertEquals(listOf("post:note-1"), effects.events)
    }

    @Test
    fun partialPostFailureAcksConfirmedPostsButDoesNotPersistCursor() {
        val effects = RecordingLiveEffects(postResults = mapOf("note-2" to false))
        val page = FeedPage(
            rows = listOf(
                row(id = "note-1", creationTime = 98.5),
                row(id = "note-2", creationTime = 99.5),
            ),
            nextCursor = 99.5,
        )

        val result = FeedProtocol.processLivePage(page, effects = effects)

        assertTrue(result.blocked)
        assertEquals(FeedProtocol.BlockedReason.POST_FAILED, result.blockedReason)
        assertNull(result.advancedCursor)
        assertEquals(listOf("note-1"), result.acknowledgedIds)
        assertEquals(listOf("post:note-1", "post:note-2", "ack:note-1"), effects.events)
    }

    @Test
    fun markDeliveredFailureBlocksCursorPersistence() {
        val effects = RecordingLiveEffects(markDeliveredSucceeds = false)
        val page = FeedPage(
            rows = listOf(row(id = "note-1", creationTime = 101.25)),
            nextCursor = 101.25,
        )

        val result = FeedProtocol.processLivePage(page, effects = effects)

        assertTrue(result.blocked)
        assertEquals(FeedProtocol.BlockedReason.MARK_DELIVERED_FAILED, result.blockedReason)
        assertNull(result.advancedCursor)
        assertEquals(listOf("post:note-1", "ack:note-1"), effects.events)
    }

    @Test
    fun fullPageSignalsResubscribeAfterSuccessfulPersistence() {
        val effects = RecordingLiveEffects()
        val page = FeedPage(
            rows = listOf(
                row(id = "note-1", creationTime = 1.0),
                row(id = "note-2", creationTime = 2.0),
            ),
            nextCursor = 2.0,
        )

        val result = FeedProtocol.processLivePage(page, limit = 2.0, effects = effects)

        assertTrue(result.shouldResubscribe)
        assertEquals(2.0, result.advancedCursor)
    }

    @Test
    fun liveBatchActionOrderIsPostThenAckThenPersist() {
        val effects = RecordingLiveEffects()
        val page = FeedPage(
            rows = listOf(
                row(id = "note-1", creationTime = 1.0),
                row(id = "note-2", creationTime = 2.0),
            ),
            nextCursor = 2.0,
        )

        FeedProtocol.processLivePage(page, limit = 2.0, effects = effects)

        assertEquals(listOf("post:note-1", "post:note-2", "ack:note-1,note-2", "persist:2.0"), effects.events)
    }

    private fun row(
        id: String,
        creationTime: Double,
        deliveredAt: Double? = null,
    ): FeedRow = FeedRow(
        id = id,
        threadId = "thread-$id",
        title = "Thread $id",
        body = "Body $id",
        createdAt = creationTime - 1.0,
        creationTime = creationTime,
        deliveredAt = deliveredAt,
    )

    private class RecordingLiveEffects(
        private val postResults: Map<String, Boolean> = emptyMap(),
        private val markDeliveredSucceeds: Boolean = true,
    ) : FeedProtocol.LiveEffects {
        val events = mutableListOf<String>()

        override fun post(row: FeedRow): Boolean {
            events += "post:${row.id}"
            return postResults[row.id] ?: true
        }

        override fun markDelivered(ids: List<String>): Boolean {
            events += "ack:${ids.joinToString(",")}"
            return markDeliveredSucceeds
        }

        override fun persistCursor(cursor: Double) {
            events += "persist:$cursor"
        }
    }
}
