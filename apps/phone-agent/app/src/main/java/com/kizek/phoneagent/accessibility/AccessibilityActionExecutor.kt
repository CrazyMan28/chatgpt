package com.kizek.phoneagent.accessibility

import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

object AccessibilityActionExecutor {
    fun globalBack(): Boolean {
        return PhoneAccessibilityService.instance
            ?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK) == true
    }

    fun globalHome(): Boolean {
        return PhoneAccessibilityService.instance
            ?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME) == true
    }

    fun globalRecents(): Boolean {
        return PhoneAccessibilityService.instance
            ?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS) == true
    }

    fun tapNodeByText(text: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val node = root.findAccessibilityNodeInfosByText(text).firstOrNull() ?: return false
        return clickableAncestor(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    fun tapNodeByPath(path: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val node = AccessibilityNodeSerializer.findByPath(root, path) ?: return false
        return clickableAncestor(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    fun tapNode(node: AccessibilityNodeInfo): Boolean {
        return clickableAncestor(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    fun focusNodeByText(text: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val node = root.findAccessibilityNodeInfosByText(text).firstOrNull() ?: return false
        return node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
    }

    fun focusNodeByPath(path: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val node = AccessibilityNodeSerializer.findByPath(root, path) ?: return false
        return node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
    }

    fun focusNode(node: AccessibilityNodeInfo): Boolean {
        return node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) ||
            clickableAncestor(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    fun typeText(text: String): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        if (!focused.isEditable) return false
        return setText(focused, text)
    }

    fun setText(node: AccessibilityNodeInfo, text: String): Boolean {
        if (!node.isEditable) return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    fun submitFocusedInput(): Boolean {
        val root = PhoneAccessibilityService.instance?.rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        val submitAction = focused.actionList.firstOrNull { action ->
            val label = action.label?.toString().orEmpty().lowercase()
            label.contains("enter") || label.contains("search") || label.contains("go") || label.contains("done")
        }
        return submitAction?.let { focused.performAction(it.id) } == true
    }

    fun tap(x: Float, y: Float): Boolean {
        val service = PhoneAccessibilityService.instance ?: return false
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 80))
            .build()
        return service.dispatchGesture(gesture, null, null)
    }

    fun swipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long = 350): Boolean {
        val service = PhoneAccessibilityService.instance ?: return false
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
        return service.dispatchGesture(gesture, null, null)
    }

    private fun clickableAncestor(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }
}
