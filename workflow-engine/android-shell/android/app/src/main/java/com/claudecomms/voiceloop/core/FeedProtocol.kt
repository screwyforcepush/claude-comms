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
)

@Serializable
data class FeedPage(
    val rows: List<FeedRow>,
    val nextCursor: Double?,
)

object FeedProtocol {
    const val LIVE_LIMIT: Double = 50.0
    const val FRESH_INSTALL_DRAIN_LIMIT: Double = 200.0

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

        for (row in page.rows) {
            if (row.deliveredAt != null) {
                idsToAck += row.id
                continue
            }

            if (row.id in postedButUnackedIds) {
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
