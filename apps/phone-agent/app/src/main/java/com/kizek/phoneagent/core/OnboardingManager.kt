package com.kizek.phoneagent.core

import android.content.Context

data class OnboardingStatus(
    val firstRunCompleted: Boolean,
    val mistralConfigured: Boolean,
    val orchestratorConfigured: Boolean,
    val accessibilityEnabled: Boolean,
    val notificationsAllowed: Boolean,
    val workspaceSelected: Boolean,
    val containerInstalled: Boolean,
    val localModelConfigured: Boolean,
    val screenCaptureConfigured: Boolean
)

class OnboardingManager(context: Context) {
    private val prefs = context.getSharedPreferences("phone_agent_onboarding", Context.MODE_PRIVATE)

    fun status(
        mistralConfigured: Boolean,
        orchestratorConfigured: Boolean,
        accessibilityEnabled: Boolean,
        notificationsAllowed: Boolean,
        workspaceSelected: Boolean,
        containerInstalled: Boolean,
        localModelConfigured: Boolean,
        screenCaptureConfigured: Boolean
    ): OnboardingStatus {
        return OnboardingStatus(
            firstRunCompleted = prefs.getBoolean(KEY_COMPLETED, false),
            mistralConfigured = mistralConfigured,
            orchestratorConfigured = orchestratorConfigured,
            accessibilityEnabled = accessibilityEnabled,
            notificationsAllowed = notificationsAllowed,
            workspaceSelected = workspaceSelected,
            containerInstalled = containerInstalled,
            localModelConfigured = localModelConfigured,
            screenCaptureConfigured = screenCaptureConfigured
        )
    }

    fun complete() {
        prefs.edit().putBoolean(KEY_COMPLETED, true).apply()
    }

    fun reset() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_COMPLETED = "firstRunCompleted"
    }
}
