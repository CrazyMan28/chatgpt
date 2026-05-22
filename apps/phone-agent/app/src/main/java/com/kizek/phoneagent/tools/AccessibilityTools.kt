package com.kizek.phoneagent.tools

import android.content.Context
import android.graphics.Rect
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import com.kizek.phoneagent.accessibility.AccessibilityControlMode
import com.kizek.phoneagent.accessibility.AccessibilityActionExecutor
import com.kizek.phoneagent.accessibility.AccessibilityNodeSerializer
import com.kizek.phoneagent.accessibility.AccessibilitySafetyMode
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService

data class AccessibilitySearchResult(
    val success: Boolean,
    val summary: String,
    val details: String = "",
    val error: String? = null
)

class AccessibilityTools(context: Context) {
    private val safetyMode = AccessibilitySafetyMode(context)

    fun status(): String {
        val service = PhoneAccessibilityService.instance
        val nodes = AccessibilityNodeSerializer.countNodes(service?.rootInActiveWindow)
        return if (service == null) {
            "disabled"
        } else {
            "enabled / mode=${safetyMode.mode.name.lowercase()} / app=${service.activePackage} / nodes=$nodes"
        }
    }

    fun treeSummary(): String {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow
            ?: return "Accessibility service is not enabled."
        return AccessibilityNodeSerializer.serialize(root, maxDepth = 4)
    }

    fun find(text: String): String {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow
        return AccessibilityNodeSerializer.summarizeMatches(root, text)
    }

    fun focus(text: String, path: String = ""): Boolean {
        return if (path.isNotBlank()) {
            AccessibilityActionExecutor.focusNodeByPath(path)
        } else {
            AccessibilityActionExecutor.focusNodeByText(text)
        }
    }

    fun tapNode(text: String, path: String = ""): Boolean {
        if (!canPerformAction()) return false
        if (isBlockedSensitiveApp()) return false
        return if (path.isNotBlank()) {
            AccessibilityActionExecutor.tapNodeByPath(path)
        } else {
            tapNodeByText(text)
        }
    }

    fun typeText(text: String): Boolean {
        if (!canPerformAction()) return false
        if (isBlockedSensitiveApp()) return false
        return typeIntoFocusedOrFirstEditable(text)
    }

    fun submitFocusedInput(): Boolean {
        if (!canPerformAction()) return false
        if (isBlockedSensitiveApp()) return false
        return AccessibilityActionExecutor.submitFocusedInput() || tapSubmitButton(PhoneAccessibilityService.instance?.rootInActiveWindow)
    }

    fun findAndUseSearchField(query: String): AccessibilitySearchResult {
        val service = PhoneAccessibilityService.instance
            ?: return AccessibilitySearchResult(
                success = false,
                summary = "Accessibility service is not enabled.",
                error = "accessibility_disabled"
            )
        if (!canPerformAction()) {
            return AccessibilitySearchResult(
                success = false,
                summary = "Accessibility control is in readonly mode.",
                details = "Enable approved control or autopilot mode before tapping or typing.",
                error = "accessibility_readonly"
            )
        }
        if (isBlockedSensitiveApp()) {
            return AccessibilitySearchResult(
                success = false,
                summary = "Sensitive app control is blocked.",
                error = "sensitive_app_blocked"
            )
        }

        val initialRoot = service.rootInActiveWindow
            ?: return AccessibilitySearchResult(
                success = false,
                summary = "No active accessibility window is available.",
                error = "no_accessibility_root"
            )
        val log = mutableListOf<String>()
        var root = initialRoot
        var editable = findEditableField(root)

        if (editable == null) {
            val searchButton = findSearchButton(root)
            if (searchButton != null) {
                log += "searchButton=${nodeLine(searchButton)}"
                if (!AccessibilityActionExecutor.tapNode(searchButton)) {
                    return AccessibilitySearchResult(
                        success = false,
                        summary = "Found a search control, but Android did not accept the tap.",
                        details = searchDebug(log, root),
                        error = "search_tap_failed"
                    )
                }
                SystemClock.sleep(450L)
                root = service.rootInActiveWindow ?: root
                editable = findEditableField(root)
            }
        }

        if (editable == null) {
            return AccessibilitySearchResult(
                success = false,
                summary = "I could not find a search field through accessibility.",
                details = searchDebug(log, root),
                error = "search_field_not_found"
            )
        }

        log += "editable=${nodeLine(editable)}"
        AccessibilityActionExecutor.focusNode(editable)
        SystemClock.sleep(150L)
        val refreshedRoot = service.rootInActiveWindow ?: root
        val focusedEditable = refreshedRoot.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }
        val target = focusedEditable ?: editable
        val typed = AccessibilityActionExecutor.setText(target, query)
        if (!typed) {
            return AccessibilitySearchResult(
                success = false,
                summary = "Found a search field, but Android did not accept the typed query.",
                details = searchDebug(log, refreshedRoot),
                error = "search_type_failed"
            )
        }
        SystemClock.sleep(250L)
        val submitted = AccessibilityActionExecutor.submitFocusedInput() || tapSubmitButton(service.rootInActiveWindow)
        log += "typed=true"
        log += "submitted=$submitted"
        return AccessibilitySearchResult(
            success = true,
            summary = if (submitted) {
                "Typed the query and submitted search."
            } else {
                "Typed the query into the search field. Android did not confirm a submit action."
            },
            details = searchDebug(log, service.rootInActiveWindow ?: refreshedRoot)
        )
    }

    fun back(): Boolean = AccessibilityActionExecutor.globalBack()
    fun home(): Boolean = AccessibilityActionExecutor.globalHome()
    fun recents(): Boolean = AccessibilityActionExecutor.globalRecents()

    fun activeApp(): String {
        val service = PhoneAccessibilityService.instance
        return if (service == null) {
            "Accessibility service is not enabled."
        } else {
            "package=${service.activePackage}\nwindow=${service.activeWindow}"
        }
    }

    fun swipe(startX: Float, startY: Float, endX: Float, endY: Float): Boolean {
        if (!canPerformAction()) return false
        if (isBlockedSensitiveApp()) return false
        return AccessibilityActionExecutor.swipe(startX, startY, endX, endY)
    }

    private fun canPerformAction(): Boolean {
        return safetyMode.mode != AccessibilityControlMode.READONLY
    }

    private fun isBlockedSensitiveApp(): Boolean {
        val pkg = PhoneAccessibilityService.instance?.activePackage.orEmpty().lowercase()
        return listOf("bank", "wallet", "pay", "password", "authenticator", "1password", "bitwarden").any { pkg.contains(it) }
    }

    private fun findEditableField(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }?.let { return it }
        var best: AccessibilityNodeInfo? = null
        walk(root) { node ->
            if (best != null) return@walk
            val klass = node.className?.toString().orEmpty().lowercase()
            val text = node.text?.toString().orEmpty().lowercase()
            val desc = node.contentDescription?.toString().orEmpty().lowercase()
            val looksSearch = text.contains("search") ||
                desc.contains("search") ||
                desc.contains("type url") ||
                desc.contains("type a url") ||
                desc.contains("search or type") ||
                klass.contains("edittext")
            if (node.isEditable && node.isEnabled && (looksSearch || best == null)) {
                best = node
            }
        }
        return best
    }

    private fun findSearchButton(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var best: AccessibilityNodeInfo? = null
        walk(root) { node ->
            if (best != null) return@walk
            val text = node.text?.toString().orEmpty().lowercase()
            val desc = node.contentDescription?.toString().orEmpty().lowercase()
            val klass = node.className?.toString().orEmpty().lowercase()
            val label = "$text $desc $klass"
            val isSearch = label.contains("search") ||
                label.contains("search youtube") ||
                label.contains("search field") ||
                label.contains("search or type url")
            if (isSearch && node.isEnabled && (node.isClickable || clickableAncestorExists(node))) {
                best = node
            }
        }
        return best
    }

    private fun tapNodeByText(text: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val target = findTextNode(root, text) ?: return false
        return AccessibilityActionExecutor.tapNode(target)
    }

    private fun typeIntoFocusedOrFirstEditable(text: String): Boolean {
        val service = PhoneAccessibilityService.instance ?: return false
        val root = service.rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable && it.isEnabled }
        val target = focused ?: findEditableField(root) ?: return false
        AccessibilityActionExecutor.focusNode(target)
        SystemClock.sleep(120L)
        val refreshed = service.rootInActiveWindow ?: root
        val refreshedFocused = refreshed.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable && it.isEnabled }
        return AccessibilityActionExecutor.setText(refreshedFocused ?: target, text)
    }

    private fun findTextNode(root: AccessibilityNodeInfo, query: String): AccessibilityNodeInfo? {
        val needle = normalizeLabel(query)
        if (needle.isBlank()) return null
        var best: AccessibilityNodeInfo? = null
        var bestScore = 0
        walk(root) { node ->
            val text = normalizeLabel(node.text?.toString().orEmpty())
            val desc = normalizeLabel(node.contentDescription?.toString().orEmpty())
            val labels = listOf(text, desc).filter { it.isNotBlank() }
            val score = labels.maxOfOrNull { labelScore(it, needle) } ?: 0
            if (score > bestScore && node.isEnabled && (node.isClickable || clickableAncestorExists(node))) {
                best = node
                bestScore = score
            }
        }
        return best.takeIf { bestScore >= 70 }
    }

    private fun tapSubmitButton(root: AccessibilityNodeInfo?): Boolean {
        if (root == null) return false
        var submit: AccessibilityNodeInfo? = null
        walk(root) { node ->
            if (submit != null) return@walk
            val text = node.text?.toString().orEmpty().lowercase()
            val desc = node.contentDescription?.toString().orEmpty().lowercase()
            val label = "$text $desc".trim()
            val matches = label == "search" ||
                label == "go" ||
                label.contains("submit search") ||
                label.contains("search")
            if (matches && node.isEnabled && (node.isClickable || clickableAncestorExists(node))) {
                submit = node
            }
        }
        return submit?.let { AccessibilityActionExecutor.tapNode(it) } == true
    }

    private fun clickableAncestorExists(node: AccessibilityNodeInfo): Boolean {
        var current: AccessibilityNodeInfo? = node
        while (current != null) {
            if (current.isClickable) return true
            current = current.parent
        }
        return false
    }

    private fun normalizeLabel(value: String): String {
        return value.lowercase()
            .replace(Regex("""[^\p{L}\p{N}\s]+"""), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun labelScore(label: String, needle: String): Int {
        return when {
            label == needle -> 100
            label.startsWith(needle) || needle.startsWith(label) -> 88
            label.contains(needle) || needle.contains(label) -> 80
            levenshtein(label, needle) <= fuzzyThreshold(needle) -> 74
            label.split(" ").any { token -> token == needle || levenshtein(token, needle) <= fuzzyThreshold(needle) } -> 72
            else -> 0
        }
    }

    private fun fuzzyThreshold(value: String): Int = when {
        value.length <= 4 -> 1
        value.length <= 8 -> 2
        else -> 3
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a == b) return 0
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        val previous = IntArray(b.length + 1) { it }
        val current = IntArray(b.length + 1)
        for (i in a.indices) {
            current[0] = i + 1
            for (j in b.indices) {
                val cost = if (a[i] == b[j]) 0 else 1
                current[j + 1] = minOf(current[j] + 1, previous[j + 1] + 1, previous[j] + cost)
            }
            for (j in previous.indices) previous[j] = current[j]
        }
        return previous[b.length]
    }

    private fun walk(node: AccessibilityNodeInfo, visit: (AccessibilityNodeInfo) -> Unit) {
        visit(node)
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            walk(child, visit)
        }
    }

    private fun nodeLine(node: AccessibilityNodeInfo): String {
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        return "text=\"${node.text?.toString().orEmpty().take(60)}\" desc=\"${node.contentDescription?.toString().orEmpty().take(60)}\" class=${node.className} bounds=${bounds.left},${bounds.top},${bounds.right},${bounds.bottom} clickable=${node.isClickable} editable=${node.isEditable}"
    }

    private fun searchDebug(log: List<String>, root: AccessibilityNodeInfo): String {
        return buildString {
            appendLine("steps:")
            if (log.isEmpty()) appendLine("no matching search nodes found before failure")
            log.forEach { appendLine(it) }
            appendLine()
            appendLine("treeSummary:")
            append(AccessibilityNodeSerializer.serialize(root, maxDepth = 4).lineSequence().take(90).joinToString("\n"))
        }.trimEnd()
    }
}
