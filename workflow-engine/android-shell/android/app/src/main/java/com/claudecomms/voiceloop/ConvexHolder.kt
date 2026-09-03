package com.claudecomms.voiceloop

import android.content.Context
import dev.convex.android.ConvexClient

object ConvexHolder {
    @Volatile
    private var configuredUrl: String? = null

    @Volatile
    private var sharedClient: ConvexClient? = null

    @Synchronized
    fun configure(config: ShellConfig): ConvexClient = clientFor(config.convexUrl)

    @Synchronized
    fun configureFromPrefs(context: Context): ConvexClient? =
        AppPrefs.getConfig(context)?.let(::configure)

    @Synchronized
    fun getClient(context: Context): ConvexClient =
        configure(AppPrefs.requireConfig(context))

    @Synchronized
    fun clientFor(convexUrl: String): ConvexClient {
        val normalizedUrl = convexUrl.trim().trimEnd('/')
        val existing = sharedClient
        if (existing != null && configuredUrl == normalizedUrl) {
            return existing
        }

        return ConvexClient(normalizedUrl).also { client ->
            configuredUrl = normalizedUrl
            sharedClient = client
        }
    }

    @Synchronized
    fun currentClient(): ConvexClient? = sharedClient
}
