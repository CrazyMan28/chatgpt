package com.kizek.phoneagent.core

import org.json.JSONObject

object SafeJsonExtractor {
    data class Candidate(
        val text: String,
        val start: Int,
        val endExclusive: Int
    )

    fun sanitizeText(value: String, maxChars: Int = 12_000): String {
        if (value.isBlank()) return value.trim()
        val cleaned = buildString(value.length.coerceAtMost(maxChars)) {
            for (char in value) {
                if (length >= maxChars) break
                when {
                    char == '\n' || char == '\r' || char == '\t' -> append(char)
                    !char.isISOControl() -> append(char)
                    else -> append(' ')
                }
            }
        }.trim()
        return if (value.length > maxChars) "$cleaned\n[truncated]" else cleaned
    }

    fun extractObjects(raw: String, maxObjects: Int = 8): List<Candidate> {
        val source = sanitizeText(raw, maxChars = 40_000)
        if (source.isBlank()) return emptyList()
        val objects = mutableListOf<Candidate>()
        var index = 0
        while (index < source.length && objects.size < maxObjects) {
            if (source[index] != '{') {
                index += 1
                continue
            }
            scanObject(source, index)?.let { candidate ->
                objects += candidate
                index = candidate.endExclusive
            } ?: run {
                index += 1
            }
        }
        return objects
    }

    fun extractFirstObject(raw: String): String? = extractObjects(raw, maxObjects = 1).firstOrNull()?.text

    fun parseObjects(raw: String, maxObjects: Int = 8): List<JSONObject> {
        return extractObjects(raw, maxObjects).mapNotNull { candidate ->
            runCatching { JSONObject(candidate.text) }.getOrNull()
        }
    }

    fun isJsonOnly(raw: String): Boolean {
        val trimmed = sanitizeText(raw)
        val objects = extractObjects(trimmed, maxObjects = 2)
        return objects.size == 1 && objects.first().start == 0 && objects.first().endExclusive == trimmed.length
    }

    private fun scanObject(source: String, start: Int): Candidate? {
        var depth = 0
        var inString = false
        var escaped = false
        var index = start
        while (index < source.length) {
            val char = source[index]
            if (inString) {
                when {
                    escaped -> escaped = false
                    char == '\\' -> escaped = true
                    char == '"' -> inString = false
                }
            } else {
                when (char) {
                    '"' -> inString = true
                    '{' -> depth += 1
                    '}' -> {
                        depth -= 1
                        if (depth == 0) {
                            val end = index + 1
                            return Candidate(source.substring(start, end), start, end)
                        }
                    }
                }
            }
            index += 1
        }
        return null
    }
}
