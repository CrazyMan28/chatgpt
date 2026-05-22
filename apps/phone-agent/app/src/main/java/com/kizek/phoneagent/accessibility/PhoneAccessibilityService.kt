package com.kizek.phoneagent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class PhoneAccessibilityService : AccessibilityService() {
    var activePackage: String = "unknown"
        private set
    var activeWindow: String = "unknown"
        private set

    override fun onServiceConnected() {
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        activePackage = event.packageName?.toString().orEmpty().ifBlank { "unknown" }
        activeWindow = event.className?.toString().orEmpty().ifBlank { "unknown" }
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    companion object {
        @Volatile var instance: PhoneAccessibilityService? = null
    }
}
