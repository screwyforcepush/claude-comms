package com.claudecomms.voiceloop

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.util.Log
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class ConfigActivity : AppCompatActivity() {
    private lateinit var convexUrlInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var uiUrlInput: EditText
    private lateinit var notificationStatus: TextView
    private lateinit var batteryStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildContentView()
        populateExistingConfig()
        requestNotificationsIfNeeded()
    }

    override fun onResume() {
        super.onResume()
        updateStatusText()
        val prefs = AppPrefs(this)
        if (notificationsAvailable() && prefs.areNotificationsBlocked()) {
            prefs.setNotificationsBlocked(blocked = false)
            nudgeFeedListenerAfterPermissionUpdate()
        }
    }

    private fun buildContentView() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 48, 40, 40)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        root.addView(TextView(this).apply {
            text = "Claude Comms Voice Loop"
            textSize = 22f
        })

        convexUrlInput = EditText(this).apply {
            hint = "Convex URL"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
        }
        root.addView(convexUrlInput)

        passwordInput = EditText(this).apply {
            hint = "Admin password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }
        root.addView(passwordInput)

        uiUrlInput = EditText(this).apply {
            hint = "Web UI URL"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
        }
        root.addView(uiUrlInput)

        notificationStatus = TextView(this)
        root.addView(notificationStatus)

        batteryStatus = TextView(this)
        root.addView(batteryStatus)

        root.addView(Button(this).apply {
            text = "Save"
            setOnClickListener { saveConfig() }
        })

        root.addView(Button(this).apply {
            text = "Enable notifications"
            setOnClickListener { requestNotificationsIfNeeded(force = true) }
        })

        root.addView(Button(this).apply {
            text = "Battery unrestricted"
            setOnClickListener { requestBatteryOptimizationExemption() }
        })

        setContentView(root)
    }

    private fun populateExistingConfig() {
        val config = AppPrefs.getConfig(this)
        convexUrlInput.setText(config?.convexUrl.orEmpty())
        passwordInput.setText(config?.password.orEmpty())
        uiUrlInput.setText(config?.uiUrl.orEmpty())
    }

    private fun saveConfig() {
        try {
            val config = AppPrefs.saveConfig(
                context = this,
                convexUrl = convexUrlInput.text.toString(),
                password = passwordInput.text.toString(),
                uiUrl = uiUrlInput.text.toString(),
            )
            ConvexHolder.configure(config)
            if (notificationsAvailable()) {
                AppPrefs(this).setNotificationsBlocked(blocked = false)
                nudgeFeedListenerAfterPermissionUpdate()
            } else {
                AppPrefs(this).setNotificationsBlocked(blocked = true)
            }
            startActivity(Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            })
            finish()
        } catch (error: IllegalArgumentException) {
            Toast.makeText(this, error.message ?: "Invalid configuration", Toast.LENGTH_LONG).show()
        }
    }

    private fun requestNotificationsIfNeeded(force: Boolean = false) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            updateStatusText()
            return
        }

        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED

        val shouldAsk = !granted && (force || !ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ))

        if (shouldAsk) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_POST_NOTIFICATIONS,
            )
        } else {
            updateStatusText()
        }
    }

    private fun requestBatteryOptimizationExemption() {
        val packageUri = Uri.parse("package:$packageName")
        val requestIntent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = packageUri
        }
        val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)

        try {
            startActivity(requestIntent)
        } catch (_: Exception) {
            startActivity(fallbackIntent)
        }
    }

    private fun updateStatusText() {
        val notificationsEnabled = notificationsAvailable()
        notificationStatus.text = if (notificationsEnabled) {
            "Notifications enabled"
        } else {
            "Notifications disabled; feed rows remain pending"
        }

        val powerManager = getSystemService(PowerManager::class.java)
        val ignoringOptimizations = powerManager?.isIgnoringBatteryOptimizations(packageName) == true
        batteryStatus.text = if (ignoringOptimizations) {
            "Battery unrestricted"
        } else {
            "Battery optimization may stop the listener"
        }
    }

    private fun notificationsAvailable(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }

        return NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    private fun nudgeFeedListenerAfterPermissionUpdate() {
        val config = AppPrefs.getConfig(this) ?: return
        ConvexHolder.configure(config)
        startFeedListenerService(FeedListenerService.ACTION_PERMISSION_UPDATED)
    }

    private fun startFeedListenerService(action: String) {
        val serviceIntent = Intent(this, FeedListenerService::class.java).setAction(action)

        try {
            ContextCompat.startForegroundService(this, serviceIntent)
        } catch (error: RuntimeException) {
            Log.w(TAG, "Feed listener service could not be nudged", error)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            updateStatusText()
            val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
            if (granted && notificationsAvailable()) {
                AppPrefs(this).setNotificationsBlocked(blocked = false)
                nudgeFeedListenerAfterPermissionUpdate()
            }
        }
    }

    private companion object {
        private const val TAG = "VoiceLoopConfig"
        const val REQUEST_POST_NOTIFICATIONS = 20_001
    }
}
