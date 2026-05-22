package com.kizek.phoneagent.sync

import android.content.Context

class PairingManager(context: Context) {
    private val prefs = context.getSharedPreferences("phone_agent_pairing", Context.MODE_PRIVATE)

    var orchestratorUrl: String
        get() = prefs.getString("orchestrator_url", DEFAULT_URL) ?: DEFAULT_URL
        set(value) {
            prefs.edit().putString("orchestrator_url", normalize(value)).apply()
        }

    var deviceLabel: String
        get() = prefs.getString("device_label", "Android phone") ?: "Android phone"
        set(value) {
            prefs.edit().putString("device_label", value.ifBlank { "Android phone" }).apply()
        }

    fun normalize(value: String): String {
        val trimmed = value.trim().trimEnd('/')
        return when {
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
            trimmed.isBlank() -> DEFAULT_URL
            else -> "http://$trimmed"
        }
    }

    companion object {
        const val DEFAULT_URL = "http://127.0.0.1:4017"
    }
}
