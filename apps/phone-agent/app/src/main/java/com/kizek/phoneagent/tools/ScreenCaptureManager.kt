package com.kizek.phoneagent.tools

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

data class ScreenCaptureStatus(
    val configured: Boolean,
    val active: Boolean,
    val detail: String,
    val lastScreenshotPath: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val timestamp: Long? = null
)

class ScreenCaptureManager(context: Context) {
    private val context = context.applicationContext
    private val prefs = context.getSharedPreferences("phone_agent_screen_capture", Context.MODE_PRIVATE)

    fun markPermissionResult(granted: Boolean) {
        prefs.edit()
            .putBoolean(KEY_CONFIGURED, granted)
            .putBoolean(KEY_ACTIVE, false)
            .apply()
    }

    fun captureOnce(resultCode: Int, data: Intent) {
        markPermissionResult(true)
        val serviceIntent = Intent(context, ScreenCaptureForegroundService::class.java)
            .putExtra(ScreenCaptureForegroundService.EXTRA_RESULT_CODE, resultCode)
            .putExtra(ScreenCaptureForegroundService.EXTRA_RESULT_DATA, data)
        ContextCompat.startForegroundService(context, serviceIntent)
    }

    fun stopCapture() {
        context.startService(
            Intent(context, ScreenCaptureForegroundService::class.java)
                .setAction(ScreenCaptureForegroundService.ACTION_STOP)
        )
    }

    fun status(): ScreenCaptureStatus {
        val configured = prefs.getBoolean(KEY_CONFIGURED, false)
        val lastPath = prefs.getString(KEY_LAST_PATH, null)
        val width = prefs.getInt(KEY_WIDTH, 0).takeIf { it > 0 }
        val height = prefs.getInt(KEY_HEIGHT, 0).takeIf { it > 0 }
        val timestamp = prefs.getLong(KEY_TIMESTAMP, 0L).takeIf { it > 0L }
        val error = prefs.getString(KEY_LAST_ERROR, null)
        return ScreenCaptureStatus(
            configured = configured,
            active = prefs.getBoolean(KEY_ACTIVE, false),
            detail = if (configured) {
                if (lastPath != null) {
                    "Last screenshot captured at $lastPath (${width ?: "?"}x${height ?: "?"})."
                } else {
                    error ?: "Screen capture permission was granted. Use Capture screenshot to create a fresh image; Android requires a visible system prompt."
                }
            } else {
                "Screen capture is not configured. Accessibility tree observation works without screenshots."
            },
            lastScreenshotPath = lastPath,
            width = width,
            height = height,
            timestamp = timestamp
        )
    }

    companion object {
        const val KEY_CONFIGURED = "configured"
        const val KEY_ACTIVE = "active"
        const val KEY_LAST_PATH = "last_path"
        const val KEY_WIDTH = "width"
        const val KEY_HEIGHT = "height"
        const val KEY_TIMESTAMP = "timestamp"
        const val KEY_LAST_ERROR = "last_error"
    }
}
