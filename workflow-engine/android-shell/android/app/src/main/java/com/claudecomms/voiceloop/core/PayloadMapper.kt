package com.claudecomms.voiceloop.core

object PayloadMapper {
    const val MESSAGE_NOTIFICATION_ID: Int = 1001
    const val LOCAL_USER_NAME: String = "You"
    const val INCOMING_SENDER_NAME: String = "Assistant"

    fun toNotificationPayload(row: FeedRow): NotificationPayload = NotificationPayload(
        identity = NotificationIdentity(
            tag = row.threadId,
            id = MESSAGE_NOTIFICATION_ID,
        ),
        conversationTitle = row.title,
        localUser = NotificationPerson(LOCAL_USER_NAME),
        incomingMessage = NotificationMessage(
            sender = NotificationPerson(INCOMING_SENDER_NAME),
            body = row.body,
            timestamp = row.createdAt,
        ),
    )
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
