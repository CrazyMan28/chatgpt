package com.kizek.phoneagent.tools

class ScreenTools(
    private val screenCaptureManager: ScreenCaptureManager,
    private val accessibilityTools: AccessibilityTools
) {
    fun status(): ScreenCaptureStatus = screenCaptureManager.status()

    fun screenshot(): ScreenCaptureStatus = screenCaptureManager.status()

    fun observation(): ScreenObservation {
        val status = screenCaptureManager.status()
        val accessibilityStatus = accessibilityTools.status()
        val accessibilityEnabled = accessibilityStatus.startsWith("enabled", ignoreCase = true)
        val activeApp = accessibilityTools.activeApp()
        val tree = accessibilityTools.treeSummary()
        return ScreenObservation(
            screenCaptureConfigured = status.configured,
            screenCaptureActive = status.active,
            screenshotPath = status.lastScreenshotPath,
            screenshotWidth = status.width,
            screenshotHeight = status.height,
            screenshotTimestamp = status.timestamp,
            screenCaptureDetail = status.detail,
            accessibilityStatus = accessibilityStatus,
            accessibilityEnabled = accessibilityEnabled,
            activeApp = activeApp,
            accessibilityTree = tree,
            visibleLabels = extractVisibleLabels(tree)
        )
    }

    fun observe(): String {
        return observation().rawDetails()
    }

    fun describe(): String {
        val status = screenCaptureManager.status()
        return if (status.lastScreenshotPath != null) {
            "Screenshot is available at ${status.lastScreenshotPath} (${status.width}x${status.height}). Vision upload is not automatic; configure a vision-capable remote/Mistral flow before sending image data."
        } else {
            "No screenshot is available. Capture requires the Android MediaProjection prompt. Accessibility summary: ${accessibilityTools.status()}"
        }
    }

    fun watch(): String {
        return "Continuous screen watch is not running. This build supports explicit one-shot screenshots only after the Android system prompt."
    }

    private fun extractVisibleLabels(tree: String): List<String> {
        val values = linkedSetOf<String>()
        val textPattern = Regex("\\b(?:text|desc)=\"([^\"]+)\"")
        tree.lineSequence().take(120).forEach { line ->
            textPattern.findAll(line).forEach { match ->
                val value = match.groupValues[1].trim()
                if (value.isNotBlank()) values += value
            }
        }
        return values.take(40)
    }
}

data class ScreenObservation(
    val screenCaptureConfigured: Boolean,
    val screenCaptureActive: Boolean,
    val screenshotPath: String?,
    val screenshotWidth: Int?,
    val screenshotHeight: Int?,
    val screenshotTimestamp: Long?,
    val screenCaptureDetail: String,
    val accessibilityStatus: String,
    val accessibilityEnabled: Boolean,
    val activeApp: String,
    val accessibilityTree: String,
    val visibleLabels: List<String>
) {
    val hasScreenshot: Boolean = screenshotPath != null
    val hasAccessibilityTree: Boolean = accessibilityEnabled && !accessibilityTree.startsWith("Accessibility service is not enabled", ignoreCase = true)
    val hasAnyObservation: Boolean = hasScreenshot || hasAccessibilityTree

    fun compactSummary(): String {
        return buildString {
            appendLine("screenCaptureConfigured=$screenCaptureConfigured")
            appendLine("screenCaptureActive=$screenCaptureActive")
            appendLine("screenshot=${screenshotPath ?: "none"}")
            appendLine("size=${screenshotWidth ?: "?"}x${screenshotHeight ?: "?"}")
            appendLine("timestamp=${screenshotTimestamp ?: "none"}")
            appendLine("accessibility=$accessibilityStatus")
            appendLine("activeApp=${activeApp.replace("\n", " / ")}")
            if (visibleLabels.isNotEmpty()) {
                appendLine("visibleLabels=${visibleLabels.joinToString(" | ")}")
            }
        }.trim()
    }

    fun modelContext(): String {
        return buildString {
            appendLine("SCREEN OBSERVATION SUMMARY")
            appendLine(compactSummary())
            appendLine()
            appendLine("VISION STATUS")
            appendLine("visualImageAnalysisConfigured=false")
            if (hasScreenshot) {
                appendLine("A screenshot file exists, but this Android model interface is text-only and does not upload images.")
            } else {
                appendLine("No screenshot file is available from MediaProjection.")
            }
            appendLine()
            appendLine("ACCESSIBILITY TREE SUMMARY")
            if (hasAccessibilityTree) {
                appendLine(accessibilityTree.lineSequence().take(60).joinToString("\n"))
            } else {
                appendLine("Accessibility service is not enabled.")
            }
        }.trim()
    }

    fun rawDetails(): String {
        return buildString {
            appendLine(compactSummary())
            appendLine("screenCaptureDetail=$screenCaptureDetail")
            appendLine("tree:")
            appendLine(accessibilityTree.lineSequence().take(120).joinToString("\n"))
        }.trim()
    }

    fun missingPermissionMessage(): String {
        val missing = buildList {
            if (!hasScreenshot) add("screen capture not enabled")
            if (!hasAccessibilityTree) add("accessibility service not enabled")
        }
        return "I cannot inspect this screen yet: ${missing.joinToString(", ")}."
    }
}
