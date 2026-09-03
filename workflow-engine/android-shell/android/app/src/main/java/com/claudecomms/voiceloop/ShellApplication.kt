package com.claudecomms.voiceloop

import android.app.Application

class ShellApplication : Application() {
    val convexHolder: ConvexHolder = ConvexHolder

    override fun onCreate() {
        super.onCreate()
        convexHolder.configureFromPrefs(this)
    }
}
