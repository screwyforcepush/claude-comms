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
        val idsToAck = mutableListOf<String>()
        var hadPostFailure = false

        for (row in page.rows) {
            if (row.deliveredAt != null) {
                idsToAck += row.id
                continue
            }

            if (!effects.post(row)) {
                hadPostFailure = true
                continue
            }

            postedIds += row.id
            idsToAck += row.id
        }

        if (idsToAck.isNotEmpty() && !effects.markDelivered(idsToAck)) {
            return LivePageResult(
                advancedCursor = null,
                postedIds = postedIds.toList(),
                acknowledgedIds = emptyList(),
                shouldResubscribe = false,
                blockedReason = BlockedReason.MARK_DELIVERED_FAILED,
            )
        }

        if (hadPostFailure) {
            return LivePageResult(
                advancedCursor = null,
                postedIds = postedIds.toList(),
                acknowledgedIds = idsToAck.toList(),
                shouldResubscribe = false,
                blockedReason = BlockedReason.POST_FAILED,
            )
        }

        effects.persistCursor(nextCursor)

        return LivePageResult(
            advancedCursor = nextCursor,
            postedIds = postedIds.toList(),
            acknowledgedIds = idsToAck.toList(),
            shouldResubscribe = page.rows.size.toDouble() >= limit,
            blockedReason = null,
        )
    }

    fun drainFreshInstall(
        password: String,
        fetchPage: (Map<String, Any?>) -> FeedPage,
        persistCursor: (Double) -> Unit,
    ): FreshInstallDrainResult {
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

        return FreshInstallDrainResult(
            cursorToPersist = lastNonNullCursor,
            pagesRead = pagesRead,
        )
    }

    enum class BlockedReason {
        POST_FAILED,
        MARK_DELIVERED_FAILED,
    }

    interface LiveEffects {
        fun post(row: FeedRow): Boolean

        fun markDelivered(ids: List<String>): Boolean

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
)
