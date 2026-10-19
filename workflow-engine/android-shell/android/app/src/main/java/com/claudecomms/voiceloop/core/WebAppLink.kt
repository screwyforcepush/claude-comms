package com.claudecomms.voiceloop.core

import java.net.URLEncoder

/**
 * Pure URL builder for handing a notification tap off to the installed web
 * app (PWA). Headless-shell contract: Slipgate owns the notification, the PWA
 * owns reading, so a tap lands on the web UI's `?thread=<id>` deep link.
 */
object WebAppLink {
    const val THREAD_PARAM = "thread"

    fun threadUrl(uiUrl: String, threadId: String?): String {
        val base = uiUrl.trim().trimEnd('/')
        val id = threadId?.trim()?.takeIf { it.isNotEmpty() } ?: return base
        val encoded = URLEncoder.encode(id, "UTF-8")
        val separator = if (base.contains('?')) "&" else "?"
        return "$base$separator$THREAD_PARAM=$encoded"
    }
}
