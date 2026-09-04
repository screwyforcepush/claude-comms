package com.claudecomms.voiceloop.core

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class LobbyRosterTest {
    @Test
    fun parsesEnabledFlagWithAbsentAndNullMeaningOff() {
        val rows = Json.parseToJsonElement(
            """
            [
              {"_id": "ns1", "name": "claude-comms", "lobbyEnabled": true},
              {"_id": "ns2", "name": "webtrack", "lobbyEnabled": false},
              {"_id": "ns3", "name": "sparchub"},
              {"_id": "ns4", "name": "crankshaft", "lobbyEnabled": null}
            ]
            """,
        )

        val targets = LobbyRoster.parse(rows)

        assertEquals(
            listOf(
                LobbyTarget("ns1", "claude-comms", enabled = true),
                LobbyTarget("ns2", "webtrack", enabled = false),
                LobbyTarget("ns3", "sparchub", enabled = false),
                LobbyTarget("ns4", "crankshaft", enabled = false),
            ),
            targets,
        )
    }

    @Test
    fun skipsRowsMissingIdOrName() {
        val rows = Json.parseToJsonElement(
            """
            [
              {"name": "no-id", "lobbyEnabled": true},
              {"_id": "no-name", "lobbyEnabled": true},
              "not-an-object",
              {"_id": "ns1", "name": "kept", "lobbyEnabled": true, "extraField": {"nested": 1}}
            ]
            """,
        )

        assertEquals(
            listOf(LobbyTarget("ns1", "kept", enabled = true)),
            LobbyRoster.parse(rows),
        )
    }
}
