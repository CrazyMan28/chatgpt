package com.kizek.phoneagent.accessibility

import android.content.Context

enum class AccessibilityControlMode {
    READONLY,
    APPROVE,
    AUTOPILOT
}

class AccessibilitySafetyMode(context: Context) {
    private val prefs = context.getSharedPreferences("phone_agent_accessibility", Context.MODE_PRIVATE)

    var mode: AccessibilityControlMode
        get() = runCatching {
            AccessibilityControlMode.valueOf(
                prefs.getString(KEY_MODE, AccessibilityControlMode.READONLY.name) ?: AccessibilityControlMode.READONLY.name
            )
        }.getOrDefault(AccessibilityControlMode.READONLY)
        set(value) {
            prefs.edit().putString(KEY_MODE, value.name).apply()
        }

    fun canActWithoutNewApproval(): Boolean = mode == AccessibilityControlMode.AUTOPILOT

    companion object {
        private const val KEY_MODE = "mode"
    }
}
