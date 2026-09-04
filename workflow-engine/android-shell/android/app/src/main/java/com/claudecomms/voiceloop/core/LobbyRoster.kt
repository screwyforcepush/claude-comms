package com.claudecomms.voiceloop.core

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray

data class LobbyTarget(
    val namespaceId: String,
    val name: String,
    val enabled: Boolean,
)

object LobbyRoster {
    // Parsed leniently from raw JSON so namespace-record fields can evolve
    // without coupling the shell to their schema; malformed rows are skipped.
    // Standing lobbies are opt-in per namespace: absent/null lobbyEnabled
    // means off.
    fun parse(namespaces: JsonElement): List<LobbyTarget> =
        namespaces.jsonArray.mapNotNull { element ->
            val row = element as? JsonObject ?: return@mapNotNull null
            val id = (row["_id"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
            val name = (row["name"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
            LobbyTarget(
                namespaceId = id,
                name = name,
                enabled = (row["lobbyEnabled"] as? JsonPrimitive)?.booleanOrNull == true,
            )
        }
}
