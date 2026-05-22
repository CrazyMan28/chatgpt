package com.kizek.phoneagent.assistant

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

data class AssistantModeStatus(
    val defaultAssistantCandidate: Boolean,
    val overlayPermission: Boolean,
    val bubbleEnabled: Boolean,
    val wakePhraseEnabled: Boolean,
    val detail: String
)

class AssistantManager(context: Context) {
    private val context = context.applicationContext
    private val prefs = context.getSharedPreferences("phone_agent_assistant", Context.MODE_PRIVATE)

    var bubbleEnabled: Boolean
        get() = prefs.getBoolean(KEY_BUBBLE_ENABLED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_BUBBLE_ENABLED, value).apply()
        }

    var wakePhraseEnabled: Boolean
        get() = prefs.getBoolean(KEY_WAKE_ENABLED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_WAKE_ENABLED, value).apply()
        }

    fun status(): AssistantModeStatus {
        val overlay = canDrawOverlays()
        return AssistantModeStatus(
            defaultAssistantCandidate = true,
            overlayPermission = overlay,
            bubbleEnabled = bubbleEnabled,
            wakePhraseEnabled = wakePhraseEnabled,
            detail = buildString {
                appendLine("AssistantActivity is available for launcher, share sheet, selected text, and ACTION_ASSIST.")
                appendLine("VoiceInteractionService is declared so Android/OEM settings may show Phone Agent as a default assistant candidate.")
                appendLine("Default assistant availability depends on Android version and OEM settings.")
                appendLine(if (overlay) "Overlay permission is granted for the visible bubble." else "Overlay permission is not granted; bubble cannot be shown.")
                appendLine("Always-on wake phrase is not active. Stock Android does not allow hidden hotword capture for this app.")
            }.trim()
        )
    }

    fun openAssistant(initialText: String = ""): String {
        val intent = Intent(context, AssistantActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(AssistantActivity.EXTRA_INITIAL_TEXT, initialText)
        context.startActivity(intent)
        return "Opened AssistantActivity."
    }

    fun openDefaultAssistantSettings(): String {
        val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return "Opened Android default-app settings. On some devices, choose Digital assistant app and select Phone Agent if listed."
    }

    fun openOverlaySettings(): String {
        val intent = if (Build.VERSION.SDK_INT >= 23) {
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        } else {
            Intent(Settings.ACTION_SETTINGS)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return "Opened overlay permission settings."
    }

    fun showBubble(): String {
        if (!canDrawOverlays()) {
            bubbleEnabled = false
            return "Overlay permission is missing. Open Assistant Mode settings and grant Display over other apps first."
        }
        bubbleEnabled = true
        ContextCompat.startForegroundService(context, Intent(context, AssistantBubbleService::class.java))
        return "Visible assistant bubble started."
    }

    fun hideBubble(): String {
        bubbleEnabled = false
        context.stopService(Intent(context, AssistantBubbleService::class.java))
        return "Assistant bubble stopped."
    }

    fun setWakePhraseEnabled(enabled: Boolean): String {
        wakePhraseEnabled = enabled
        return if (enabled) {
            "Wake phrase mode is marked experimental/unavailable in this build. Use push-to-talk; hidden microphone listening is not started."
        } else {
            "Wake phrase mode disabled."
        }
    }

    private fun canDrawOverlays(): Boolean {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context)
    }

    companion object {
        private const val KEY_BUBBLE_ENABLED = "bubble_enabled"
        private const val KEY_WAKE_ENABLED = "wake_enabled"
    }
}
