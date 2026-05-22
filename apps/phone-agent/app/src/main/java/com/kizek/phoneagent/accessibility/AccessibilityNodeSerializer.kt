package com.kizek.phoneagent.accessibility

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo

object AccessibilityNodeSerializer {
    fun serialize(root: AccessibilityNodeInfo, maxDepth: Int = 4): String {
        val builder = StringBuilder()
        appendNode(root, builder, depth = 0, maxDepth = maxDepth, path = "0")
        return builder.toString()
    }

    private fun appendNode(
        node: AccessibilityNodeInfo,
        builder: StringBuilder,
        depth: Int,
        maxDepth: Int,
        path: String
    ) {
        if (depth > maxDepth) return
        val indent = "  ".repeat(depth)
        val text = node.text?.toString().orEmpty()
        val description = node.contentDescription?.toString().orEmpty()
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        builder.append(indent)
            .append("- ")
            .append("path=").append(path)
            .append(" text=\"").append(text.take(80).replace("\n", " ")).append("\"")
            .append(" desc=\"").append(description.take(80).replace("\n", " ")).append("\"")
            .append(" class=").append(node.className?.toString().orEmpty())
            .append(" package=").append(node.packageName?.toString().orEmpty())
            .append(" bounds=").append("${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}")
            .append(" clickable=").append(node.isClickable)
            .append(" editable=").append(node.isEditable)
            .append(" enabled=").append(node.isEnabled)
            .append(" focused=").append(node.isFocused)
            .append(" focusable=").append(node.isFocusable)
            .append(" scrollable=").append(node.isScrollable)
            .append("\n")

        for (index in 0 until node.childCount) {
            node.getChild(index)?.let { child ->
                appendNode(child, builder, depth + 1, maxDepth, "$path.$index")
            }
        }
    }

    fun countNodes(root: AccessibilityNodeInfo?): Int {
        root ?: return 0
        var count = 1
        for (index in 0 until root.childCount) {
            count += countNodes(root.getChild(index))
        }
        return count
    }

    fun findByPath(root: AccessibilityNodeInfo?, path: String): AccessibilityNodeInfo? {
        if (root == null) return null
        val parts = path.split('.').filter { it.isNotBlank() }
        if (parts.isEmpty() || parts.first() != "0") return null
        return parts.drop(1).fold(root as AccessibilityNodeInfo?) { current, part ->
            val index = part.toIntOrNull() ?: return null
            current?.getChild(index)
        }
    }

    fun summarizeMatches(root: AccessibilityNodeInfo?, query: String, max: Int = 20): String {
        root ?: return "Accessibility service is not enabled."
        val needle = query.lowercase()
        val matches = mutableListOf<String>()
        walk(root, "0", matches, max) { node, path ->
            val text = node.text?.toString().orEmpty()
            val desc = node.contentDescription?.toString().orEmpty()
            val klass = node.className?.toString().orEmpty()
            if (text.lowercase().contains(needle) || desc.lowercase().contains(needle) || klass.lowercase().contains(needle)) {
                val bounds = Rect().also { node.getBoundsInScreen(it) }
                "path=$path text=\"${text.take(80)}\" desc=\"${desc.take(80)}\" class=$klass bounds=${bounds.left},${bounds.top},${bounds.right},${bounds.bottom} clickable=${node.isClickable} editable=${node.isEditable}"
            } else {
                null
            }
        }
        return if (matches.isEmpty()) "0 match(es) for \"$query\"." else matches.joinToString("\n")
    }

    private fun walk(
        node: AccessibilityNodeInfo,
        path: String,
        out: MutableList<String>,
        max: Int,
        visit: (AccessibilityNodeInfo, String) -> String?
    ) {
        if (out.size >= max) return
        visit(node, path)?.let { out += it }
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            walk(child, "$path.$index", out, max, visit)
            if (out.size >= max) return
        }
    }
}
