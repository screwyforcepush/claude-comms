package com.claudecomms.voiceloop.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class FeedRow(
    @SerialName("_id")
    val id: String,
    val namespaceId: String? = null,
    val threadId: String,
    val title: String,
    val body: String,
    val createdAt: Double,
    @SerialName("_creationTime")
    val creationTime: Double,
    val deliveredAt: Double? = null,
    // Absent = message row. "read" = read receipt: the thread was read somewhere
    // (phone or desk), so its notification is retired instead of posted.
    val kind: String? = null,
) {
    val isReadReceipt: Boolean
        get() = kind == FeedProtocol.READ_RECEIPT_KIND
}

@Serializable
data class FeedPage(
    val rows: List<FeedRow>,
    val nextCursor: Double?,
)

object FeedProtocol {
    const val LIVE_LIMIT: Double = 50.0
    const val FRESH_INSTALL_DRAIN_LIMIT: Double = 200.0
    const val READ_RECEIPT_KIND: String = "read"

    fun feedArgs(
        password: String,
        cursor: Double?,
        limit: Double = LIVE_LIMIT,
    ): Map<String, Any?> = mapOf(
        "password" to password,
        "cursor" to cursor,
        "limit" to limit,
    )

    fun encodeCursorForStorage(cursor: Double): Long = java.lang.Double.doubleToRawLongBits(cursor)

    fun decodeCursorFromStorage(bits: Long): Double = java.lang.Double.longBitsToDouble(bits)

    fun processLivePage(
        page: FeedPage,
        limit: Double = LIVE_LIMIT,
        effects: LiveEffects,
    ): LivePageResult {
        val nextCursor = page.nextCursor ?: return LivePageResult(
            advancedCursor = null,
            postedIds = emptyList(),
            acknowledgedIds = emptyList(),
            shouldResubscribe = false,
            blockedReason = null,
        )

        val postedIds = mutableListOf<String>()
        val idsToAck = linkedSetOf<String>()
        val postedButUnackedIds = effects.postedButUnackedIds().toMutableSet()
        var hadPostFailure = false
        val lastReadReceiptIndex = lastReadReceiptIndexByThread(page.rows)

        for ((index, row) in page.rows.withIndex()) {
            if (row.deliveredAt != null) {
                idsToAck += row.id
                continue
            }

            // A notification lives exactly as long as the thread is unread: a read
            // receipt retires the thread's shade entry. Only an undelivered receipt
            // cancels — a replayed, already-acked one must not wipe a newer message.
            // @see docs/project/spec/mental-model.md#mm-hands-free-voice-loop
            if (row.isReadReceipt) {
                effects.cancel(row.threadId)
                idsToAck += row.id
                continue
            }

            if (row.id in postedButUnackedIds) {
                idsToAck += row.id
                continue
            }

            // Catch-up collapse: a message whose thread was read later in the same
            // page is never posted — no alert-then-cancel flicker.
            val retiredLater = lastReadReceiptIndex[row.threadId]?.let { it > index } ?: false
            if (retiredLater) {
                idsToAck += row.id
                continue
            }

            if (!effects.post(row)) {
                hadPostFailure = true
                continue
            }

            effects.rememberPostedButUnacked(listOf(row.id))
            postedButUnackedIds += row.id
            postedIds += row.id
            idsToAck += row.id
        }

        val idsToAckList = idsToAck.toList()
        if (idsToAckList.isNotEmpty() && !effects.markDelivered(idsToAckList)) {
            return LivePageResult(
                advancedCursor = null,
                postedIds = postedIds.toList(),
                acknowledgedIds = emptyList(),
                shouldResubscribe = false,
                blockedReason = BlockedReason.MARK_DELIVERED_FAILED,
            )
        }

        if (idsToAckList.isNotEmpty()) {
            effects.clearPostedButUnacked(idsToAckList)
        }

        if (hadPostFailure) {
            return LivePageResult(
                advancedCursor = null,
                postedIds = postedIds.toList(),
                acknowledgedIds = idsToAckList,
                shouldResubscribe = false,
                blockedReason = BlockedReason.POST_FAILED,
            )
        }

        effects.persistCursor(nextCursor)

        return LivePageResult(
            advancedCursor = nextCursor,
            postedIds = postedIds.toList(),
            acknowledgedIds = idsToAckList,
            shouldResubscribe = page.rows.size.toDouble() >= limit,
            blockedReason = null,
        )
    }

    private fun lastReadReceiptIndexByThread(rows: List<FeedRow>): Map<String, Int> {
        val byThread = mutableMapOf<String, Int>()
        rows.forEachIndexed { index, row ->
            if (row.isReadReceipt) byThread[row.threadId] = index
        }
        return byThread
    }

    suspend fun drainFreshInstall(
        password: String,
        feedInitialized: Boolean = false,
        fetchPage: suspend (Map<String, Any?>) -> FeedPage,
        persistCursor: (Double) -> Unit,
        markFeedInitialized: () -> Unit = {},
    ): FreshInstallDrainResult {
        if (feedInitialized) {
            return FreshInstallDrainResult(
                cursorToPersist = null,
                pagesRead = 0,
                drainRan = false,
            )
        }

        var cursor: Double? = null
        var lastNonNullCursor: Double? = null
        var pagesRead = 0

        while (true) {
            val page = fetchPage(feedArgs(password, cursor, FRESH_INSTALL_DRAIN_LIMIT))
            pagesRead += 1
            val nextCursor = page.nextCursor ?: break
            lastNonNullCursor = nextCursor
            cursor = nextCursor
        }

        if (lastNonNullCursor != null) {
            persistCursor(lastNonNullCursor)
        }
        markFeedInitialized()

        return FreshInstallDrainResult(
            cursorToPersist = lastNonNullCursor,
            pagesRead = pagesRead,
            drainRan = true,
        )
    }

    enum class BlockedReason {
        POST_FAILED,
        MARK_DELIVERED_FAILED,
    }

    interface LiveEffects {
        fun postedButUnackedIds(): Set<String> = emptySet()

        fun post(row: FeedRow): Boolean

        fun cancel(threadId: String) {}

        fun rememberPostedButUnacked(ids: List<String>) {}

        fun markDelivered(ids: List<String>): Boolean

        fun clearPostedButUnacked(ids: List<String>) {}

        fun persistCursor(cursor: Double)
    }
}

data class LivePageResult(
    val advancedCursor: Double?,
    val postedIds: List<String>,
    val acknowledgedIds: List<String>,
    val shouldResubscribe: Boolean,
    val blockedReason: FeedProtocol.BlockedReason?,
) {
    val blocked: Boolean
        get() = blockedReason != null
}

data class FreshInstallDrainResult(
    val cursorToPersist: Double?,
    val pagesRead: Int,
    val drainRan: Boolean,
)
