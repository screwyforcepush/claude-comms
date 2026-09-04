package com.claudecomms.voiceloop.core

object PayloadMapper {
    const val MESSAGE_NOTIFICATION_ID: Int = 1001
    const val LOCAL_USER_NAME: String = "You"
    const val TITLE_SEPARATOR: String = " · "
    const val TOPIC_BODY_SEPARATOR: String = " — "

    // Row titles are engine-composed as "<namespace> · <thread topic>" and
    // namespace names are slugs that never contain the separator, so the first
    // occurrence splits reliably. The phone assistant voices only sender + body
    // (never the title): the sender is the namespace — one stable "contact" per
    // project — and the thread topic is prepended to the body so it still
    // reaches the audio surface.
    fun senderNameFrom(title: String): String {
        val index = title.indexOf(TITLE_SEPARATOR)
        return if (index >= 0) title.substring(0, index) else title
    }

    fun topicFrom(title: String): String {
        val index = title.indexOf(TITLE_SEPARATOR)
        return if (index >= 0) title.substring(index + TITLE_SEPARATOR.length) else ""
    }

    fun toNotificationPayload(row: FeedRow): NotificationPayload {
        val topic = topicFrom(row.title)
        val body = if (topic.isBlank()) row.body else "$topic$TOPIC_BODY_SEPARATOR${row.body}"
        return NotificationPayload(
            identity = NotificationIdentity(
                tag = row.threadId,
                id = MESSAGE_NOTIFICATION_ID,
            ),
            conversationTitle = row.title,
            localUser = NotificationPerson(LOCAL_USER_NAME),
            incomingMessage = NotificationMessage(
                sender = NotificationPerson(senderNameFrom(row.title)),
                body = body,
                timestamp = row.createdAt,
            ),
        )
    }
}

data class NotificationIdentity(
    val tag: String,
    val id: Int,
)

data class NotificationPerson(
    val name: String,
)

data class NotificationMessage(
    val sender: NotificationPerson,
    val body: String,
    val timestamp: Double,
)

data class NotificationPayload(
    val identity: NotificationIdentity,
    val conversationTitle: String,
    val localUser: NotificationPerson,
    val incomingMessage: NotificationMessage,
)
