package com.claudecomms.voiceloop.core

import org.junit.Assert.assertEquals
import org.junit.Test

class WebAppLinkTest {
    @Test
    fun appendsThreadParamToUiRoot() {
        assertEquals(
            "https://cc3.example.app?thread=jh7abc",
            WebAppLink.threadUrl("https://cc3.example.app", "jh7abc"),
        )
    }

    @Test
    fun stripsTrailingSlashBeforeAppending() {
        assertEquals(
            "https://cc3.example.app?thread=jh7abc",
            WebAppLink.threadUrl("https://cc3.example.app/", "jh7abc"),
        )
    }

    @Test
    fun usesAmpersandWhenUiUrlAlreadyHasQuery() {
        assertEquals(
            "https://cc3.example.app/?x=1&thread=jh7abc",
            WebAppLink.threadUrl("https://cc3.example.app/?x=1", "jh7abc"),
        )
    }

    @Test
    fun nullOrBlankThreadOpensRoot() {
        assertEquals("https://cc3.example.app", WebAppLink.threadUrl("https://cc3.example.app/", null))
        assertEquals("https://cc3.example.app", WebAppLink.threadUrl("https://cc3.example.app", "  "))
    }

    @Test
    fun encodesThreadId() {
        assertEquals(
            "https://cc3.example.app?thread=a%26b",
            WebAppLink.threadUrl("https://cc3.example.app", "a&b"),
        )
    }
}
