package com.kizek.phoneagent.core

import kotlin.math.max
import kotlin.math.min

object PhoneCommandParser {
    enum class PhoneIntent(val id: String) {
        OPEN_APP("open_app"),
        APP_SEARCH("app_search"),
        APP_TYPE("app_type"),
        APP_TAP("app_tap"),
        APP_FIND_TEXT("app_find_text"),
        APP_BACK("app_back"),
        APP_HOME("app_home"),
        APP_RECENTS("app_recents"),
        APP_SUBMIT("app_submit"),
        UNKNOWN("unknown")
    }

    enum class FollowUpType {
        SEARCH,
        TYPE,
        TAP,
        FIND
    }

    data class PhonePlanStep(
        val tool: String,
        val args: Map<String, String> = emptyMap()
    ) {
        fun compact(): String {
            return if (args.isEmpty()) {
                tool
            } else {
                "$tool ${args.entries.joinToString(" ") { "${it.key}=${it.value}" }}"
            }
        }
    }

    data class AppNormalization(
        val raw: String,
        val normalized: String,
        val packageCandidate: String?,
        val confidence: Double,
        val needsQuestion: Boolean
    )

    data class ParsedPhoneCommand(
        val originalText: String,
        val normalizedText: String,
        val intent: PhoneIntent,
        val appNameRaw: String = "",
        val appNameNormalized: String = "",
        val appPackageCandidate: String? = null,
        val action: String = "",
        val query: String = "",
        val textToType: String = "",
        val targetText: String = "",
        val confidence: Double = 0.0,
        val needsQuestion: Boolean = false,
        val steps: List<PhonePlanStep> = emptyList()
    ) {
        val verb: String get() = action.ifBlank { intent.id }
        val app: String get() = appNameNormalized.ifBlank { appNameRaw }
        val followUpType: FollowUpType?
            get() = when (intent) {
                PhoneIntent.APP_SEARCH -> FollowUpType.SEARCH
                PhoneIntent.APP_TYPE -> FollowUpType.TYPE
                PhoneIntent.APP_TAP -> FollowUpType.TAP
                PhoneIntent.APP_FIND_TEXT -> FollowUpType.FIND
                else -> null
            }
        val hasFollowUp: Boolean
            get() = when (intent) {
                PhoneIntent.APP_SEARCH -> query.isNotBlank()
                PhoneIntent.APP_TYPE -> textToType.isNotBlank()
                PhoneIntent.APP_TAP, PhoneIntent.APP_FIND_TEXT -> targetText.isNotBlank()
                else -> false
            }

        fun approvalSummary(): String {
            val display = if (app.isBlank()) "the current app" else PhoneCommandParser.displayName(app)
            return when (intent) {
                PhoneIntent.APP_SEARCH -> if (app.isBlank()) "Search $display for $query" else "Open $display, then search for $query"
                PhoneIntent.APP_TYPE -> if (app.isBlank()) "Type $textToType in $display" else "Open $display, then type $textToType"
                PhoneIntent.APP_TAP -> if (app.isBlank()) "Tap $targetText in $display" else "Open $display, then tap $targetText"
                PhoneIntent.APP_FIND_TEXT -> if (app.isBlank()) "Find $targetText in $display" else "Open $display, then find $targetText"
                PhoneIntent.OPEN_APP -> "Open $display"
                PhoneIntent.APP_BACK -> "Press Back"
                PhoneIntent.APP_HOME -> "Press Home"
                PhoneIntent.APP_RECENTS -> "Show recent apps"
                PhoneIntent.APP_SUBMIT -> "Submit current input"
                PhoneIntent.UNKNOWN -> "Clarify phone command"
            }
        }

        fun successSummary(): String {
            val display = if (app.isBlank()) "the current app" else PhoneCommandParser.displayName(app)
            return when (intent) {
                PhoneIntent.APP_SEARCH -> if (app.isBlank()) "Searched $display for \"$query\"." else "Opened $display and searched for \"$query\"."
                PhoneIntent.APP_TYPE -> if (app.isBlank()) "Typed \"$textToType\" in $display." else "Opened $display and typed \"$textToType\"."
                PhoneIntent.APP_TAP -> if (app.isBlank()) "Tapped \"$targetText\" in $display." else "Opened $display and tapped \"$targetText\"."
                PhoneIntent.APP_FIND_TEXT -> if (app.isBlank()) "Searched visible text in $display for \"$targetText\"." else "Opened $display and searched visible text for \"$targetText\"."
                PhoneIntent.OPEN_APP -> "Opened $display."
                PhoneIntent.APP_BACK -> "Pressed Back."
                PhoneIntent.APP_HOME -> "Pressed Home."
                PhoneIntent.APP_RECENTS -> "Opened Recents."
                PhoneIntent.APP_SUBMIT -> "Submitted current input."
                PhoneIntent.UNKNOWN -> "Phone command needs clarification."
            }
        }
    }

    fun parse(input: String): ParsedPhoneCommand? {
        return parseStructured(input).takeIf { it.intent != PhoneIntent.UNKNOWN }
    }

    fun parseStructured(input: String): ParsedPhoneCommand {
        val original = input.trim()
        val actionNormalized = normalizeActionWords(original)
        val normalized = normalizeText(original)
        if (actionNormalized.isBlank()) {
            return unknown(input, normalized)
        }

        parseNavigation(original, actionNormalized, normalized)?.let { return it }
        parseInAppPrefix(original, actionNormalized, normalized)?.let { return it }
        parseSearchTypeTapFindWithTrailingApp(original, actionNormalized, normalized)?.let { return it }
        parseUseAppToSearch(original, actionNormalized, normalized)?.let { return it }
        parseOpenCommand(original, actionNormalized, normalized)?.let { return it }
        parseActiveAppCommand(original, actionNormalized, normalized)?.let { return it }
        return unknown(input, normalized)
    }

    /**
     * Split a compound multi-intent command into individual intent segments.
     * For example: "look at my screen and open youtube" → ["look at my screen", "open youtube"]
     * Splitting is performed on conjunctions "and", "then", "also", and "after that"
     * only when they appear between actionable segments.
     */
    fun splitCompoundIntents(input: String): List<String> {
        val trimmed = input.trim()
        if (trimmed.isBlank()) return listOf(trimmed)
        val splitter = Regex("""\s+(?:and\s+then|then|and\s+also|and|also|after\s+that)\s+""", RegexOption.IGNORE_CASE)
        val segments = trimmed.split(splitter).map { it.trim() }.filter { it.isNotBlank() }
        if (segments.size <= 1) return listOf(trimmed)
        return segments
    }

    fun stripFollowUpFromAppName(input: String): String {
        val parsed = parseStructured("open $input")
        return if (parsed.appNameNormalized.isNotBlank()) {
            parsed.appNameNormalized
        } else {
            cleanSegment(stopAtAction(normalizeActionWords(input)))
        }
    }

    fun normalizeText(value: String): String {
        val lower = normalizePunctuation(value).lowercase()
        val actionFixed = normalizeActionWords(lower)
        val tokens = actionFixed.split(" ").map { token ->
            commonTypos[token] ?: token
        }
        return tokens.joinToString(" ").replace(Regex("\\s+"), " ").trim()
    }

    fun normalizeAppName(input: String): String {
        return normalizeApp(input).normalized
    }

    fun normalizeApp(input: String): AppNormalization {
        val raw = cleanSegment(input)
        val lower = normalizeText(raw)
        if (lower.isBlank()) {
            return AppNormalization(raw, "", null, 0.0, needsQuestion = true)
        }
        if (lower in genericAppRefs) {
            return AppNormalization(raw, "", null, 0.15, needsQuestion = true)
        }

        appAliases[lower]?.let { canonical ->
            return appResult(raw, canonical, 0.98)
        }
        canonicalPackages[lower]?.let {
            return appResult(raw, lower, 1.0)
        }

        val tokenAlias = lower.split(" ").firstOrNull { appAliases.containsKey(it) }
        if (tokenAlias != null && lower.split(" ").size == 1) {
            return appResult(raw, appAliases.getValue(tokenAlias), 0.92)
        }

        val candidates = (canonicalPackages.keys + appAliases.keys).distinct()
        val scored = candidates.map { candidate ->
            val canonical = appAliases[candidate] ?: candidate
            val distance = levenshtein(lower, candidate)
            val prefix = candidate.startsWith(lower) || lower.startsWith(candidate)
            val token = lower.split(" ").any { it == candidate } || candidate.split(" ").any { it == lower }
            val score = when {
                lower == candidate -> 1.0
                prefix -> 0.84
                token -> 0.82
                distance <= fuzzyThreshold(lower) -> 0.76 - (distance * 0.04)
                else -> 0.0
            }
            canonical to score
        }
            .filter { it.second > 0.0 }
            .groupBy { it.first }
            .mapValues { (_, values) -> values.maxOf { it.second } }
            .toList()
            .sortedByDescending { it.second }

        val best = scored.firstOrNull()
        if (best != null && best.second >= 0.64) {
            return appResult(raw, best.first, best.second)
        }
        return AppNormalization(raw, lower, canonicalPackages[lower], 0.42, needsQuestion = false)
    }

    private fun parseNavigation(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        return when (actionNormalized) {
            "go back", "press back", "back" -> parsedNoApp(original, normalized, PhoneIntent.APP_BACK, "back")
            "go home", "press home", "home" -> parsedNoApp(original, normalized, PhoneIntent.APP_HOME, "home")
            "show recent apps", "show recents", "recent apps", "recents" -> parsedNoApp(original, normalized, PhoneIntent.APP_RECENTS, "recents")
            "submit", "press search", "press enter", "search", "enter", "send it" -> parsedNoApp(original, normalized, PhoneIntent.APP_SUBMIT, "submit")
            else -> null
        }
    }

    private fun parseOpenCommand(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        val match = Regex("""^(open|launch|start|go to)\s+(.+)$""").find(actionNormalized) ?: return null
        val verb = match.groupValues[1]
        val remainder = cleanSegment(match.groupValues[2])
        if (remainder.isBlank()) return null
        splitFollowUp(remainder)?.let { split ->
            return buildAppAction(
                original = original,
                normalized = normalized,
                appRaw = split.app,
                intent = split.intent,
                action = split.action,
                value = split.value
            )
        }
        val app = normalizeApp(remainder)
        return ParsedPhoneCommand(
            originalText = original,
            normalizedText = normalized,
            intent = PhoneIntent.OPEN_APP,
            appNameRaw = app.raw,
            appNameNormalized = app.normalized,
            appPackageCandidate = app.packageCandidate,
            action = verb,
            confidence = app.confidence,
            needsQuestion = app.needsQuestion,
            steps = if (app.normalized.isBlank()) emptyList() else listOf(PhonePlanStep("phone_open_app", mapOf("app" to app.normalized)))
        )
    }

    private fun parseInAppPrefix(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        val patterns = listOf(
            Regex("""^in\s+(.+?)\s+search(?:\s+for)?\s+(.+)$""") to PhoneIntent.APP_SEARCH,
            Regex("""^in\s+(.+?)\s+type\s+(.+)$""") to PhoneIntent.APP_TYPE,
            Regex("""^in\s+(.+?)\s+enter\s+(.+)$""") to PhoneIntent.APP_TYPE,
            Regex("""^in\s+(.+?)\s+tap\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^in\s+(.+?)\s+press\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^in\s+(.+?)\s+click\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^in\s+(.+?)\s+find\s+(.+)$""") to PhoneIntent.APP_FIND_TEXT,
            Regex("""^in\s+(.+?)\s+look for\s+(.+)$""") to PhoneIntent.APP_FIND_TEXT
        )
        for ((regex, intent) in patterns) {
            val match = regex.find(actionNormalized) ?: continue
            return buildAppAction(
                original = original,
                normalized = normalized,
                appRaw = match.groupValues[1],
                intent = intent,
                action = actionFor(intent),
                value = match.groupValues[2]
            )
        }
        return null
    }

    private fun parseSearchTypeTapFindWithTrailingApp(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        val patterns = listOf(
            Regex("""^search(?:\s+for)?\s+(.+?)\s+(?:in|on)\s+(.+)$""") to PhoneIntent.APP_SEARCH,
            Regex("""^type\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_TYPE,
            Regex("""^enter\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_TYPE,
            Regex("""^tap\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^press\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^click\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_TAP,
            Regex("""^find\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_FIND_TEXT,
            Regex("""^look for\s+(.+?)\s+in\s+(.+)$""") to PhoneIntent.APP_FIND_TEXT
        )
        for ((regex, intent) in patterns) {
            val match = regex.find(actionNormalized) ?: continue
            val value = match.groupValues[1]
            val app = match.groupValues[2]
            return buildAppAction(
                original = original,
                normalized = normalized,
                appRaw = app,
                intent = intent,
                action = actionFor(intent),
                value = value
            )
        }
        return null
    }

    private fun parseUseAppToSearch(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        val match = Regex("""^use\s+(.+?)\s+to\s+search(?:\s+for)?\s+(.+)$""").find(actionNormalized) ?: return null
        return buildAppAction(
            original = original,
            normalized = normalized,
            appRaw = match.groupValues[1],
            intent = PhoneIntent.APP_SEARCH,
            action = "search",
            value = match.groupValues[2]
        )
    }

    private fun parseActiveAppCommand(original: String, actionNormalized: String, normalized: String): ParsedPhoneCommand? {
        Regex("""^search(?:\s+for)?\s+(.+)$""").find(actionNormalized)?.let { match ->
            val query = cleanSegment(match.groupValues[1])
            return ParsedPhoneCommand(
                originalText = original,
                normalizedText = normalized,
                intent = PhoneIntent.APP_SEARCH,
                action = "search",
                query = query,
                confidence = 0.78,
                needsQuestion = query.isBlank(),
                steps = if (query.isBlank()) emptyList() else listOf(PhonePlanStep("phone_app_search", mapOf("query" to query)))
            )
        }
        Regex("""^(?:tap|press|click)\s+(.+)$""").find(actionNormalized)?.let { match ->
            val target = cleanSegment(match.groupValues[1])
            if (target in setOf("back", "home", "enter", "search")) return null
            return ParsedPhoneCommand(
                originalText = original,
                normalizedText = normalized,
                intent = PhoneIntent.APP_TAP,
                action = "tap",
                targetText = target,
                confidence = 0.8,
                steps = listOf(PhonePlanStep("phone_app_tap_text", mapOf("text" to target)))
            )
        }
        Regex("""^(?:type|enter)\s+(.+)$""").find(actionNormalized)?.let { match ->
            val text = cleanSegment(match.groupValues[1])
            return ParsedPhoneCommand(
                originalText = original,
                normalizedText = normalized,
                intent = PhoneIntent.APP_TYPE,
                action = "type",
                textToType = text,
                confidence = 0.8,
                steps = listOf(PhonePlanStep("phone_app_type", mapOf("text" to text)))
            )
        }
        Regex("""^(?:find|look for)\s+(.+)$""").find(actionNormalized)?.let { match ->
            val target = cleanSegment(match.groupValues[1])
            return ParsedPhoneCommand(
                originalText = original,
                normalizedText = normalized,
                intent = PhoneIntent.APP_FIND_TEXT,
                action = "find",
                targetText = target,
                confidence = 0.78,
                steps = listOf(PhonePlanStep("phone_app_find_text", mapOf("text" to target)))
            )
        }
        return null
    }

    private fun splitFollowUp(remainder: String): FollowUpSplit? {
        val patterns = listOf(
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+search(?:\s+for)?\s+(.+)$"""), PhoneIntent.APP_SEARCH, "search"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+look for\s+(.+)$"""), PhoneIntent.APP_FIND_TEXT, "find"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+find\s+(.+)$"""), PhoneIntent.APP_FIND_TEXT, "find"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+type\s+(.+)$"""), PhoneIntent.APP_TYPE, "type"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+enter\s+(.+)$"""), PhoneIntent.APP_TYPE, "type"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+tap\s+(.+)$"""), PhoneIntent.APP_TAP, "tap"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+press\s+(.+)$"""), PhoneIntent.APP_TAP, "tap"),
            FollowUpPattern(Regex("""^(.+?)\s+(?:and|then)\s+click\s+(.+)$"""), PhoneIntent.APP_TAP, "tap"),
            FollowUpPattern(Regex("""^(.+?)\s+search(?:\s+for)?\s+(.+)$"""), PhoneIntent.APP_SEARCH, "search"),
            FollowUpPattern(Regex("""^(.+?)\s+look for\s+(.+)$"""), PhoneIntent.APP_FIND_TEXT, "find"),
            FollowUpPattern(Regex("""^(.+?)\s+find\s+(.+)$"""), PhoneIntent.APP_FIND_TEXT, "find"),
            FollowUpPattern(Regex("""^(.+?)\s+type\s+(.+)$"""), PhoneIntent.APP_TYPE, "type"),
            FollowUpPattern(Regex("""^(.+?)\s+tap\s+(.+)$"""), PhoneIntent.APP_TAP, "tap"),
            FollowUpPattern(Regex("""^(.+?)\s+press\s+(.+)$"""), PhoneIntent.APP_TAP, "tap"),
            FollowUpPattern(Regex("""^(.+?)\s+click\s+(.+)$"""), PhoneIntent.APP_TAP, "tap")
        )
        for (pattern in patterns) {
            val match = pattern.regex.find(remainder) ?: continue
            return FollowUpSplit(
                app = match.groupValues[1],
                intent = pattern.intent,
                action = pattern.action,
                value = match.groupValues[2]
            )
        }
        return null
    }

    private fun buildAppAction(
        original: String,
        normalized: String,
        appRaw: String,
        intent: PhoneIntent,
        action: String,
        value: String
    ): ParsedPhoneCommand {
        val app = normalizeApp(appRaw)
        val cleanValue = cleanSegment(value)
        val openStep = if (app.normalized.isBlank()) emptyList() else listOf(PhonePlanStep("phone_open_app", mapOf("app" to app.normalized)))
        val followUp = when (intent) {
            PhoneIntent.APP_SEARCH -> PhonePlanStep("phone_app_search", mapOf("app" to app.normalized, "query" to cleanValue))
            PhoneIntent.APP_TYPE -> PhonePlanStep("phone_app_type", mapOf("text" to cleanValue))
            PhoneIntent.APP_TAP -> PhonePlanStep("phone_app_tap_text", mapOf("text" to cleanValue))
            PhoneIntent.APP_FIND_TEXT -> PhonePlanStep("phone_app_find_text", mapOf("text" to cleanValue))
            else -> null
        }
        return ParsedPhoneCommand(
            originalText = original,
            normalizedText = normalized,
            intent = intent,
            appNameRaw = cleanSegment(appRaw),
            appNameNormalized = app.normalized,
            appPackageCandidate = app.packageCandidate,
            action = action,
            query = if (intent == PhoneIntent.APP_SEARCH) cleanValue else "",
            textToType = if (intent == PhoneIntent.APP_TYPE) cleanValue else "",
            targetText = if (intent == PhoneIntent.APP_TAP || intent == PhoneIntent.APP_FIND_TEXT) cleanValue else "",
            confidence = min(0.99, max(0.0, app.confidence)),
            needsQuestion = app.needsQuestion || cleanValue.isBlank(),
            steps = openStep + listOfNotNull(followUp).filter { step ->
                step.args.values.none { it.isBlank() }
            }
        )
    }

    private fun parsedNoApp(original: String, normalized: String, intent: PhoneIntent, action: String): ParsedPhoneCommand {
        val tool = when (intent) {
            PhoneIntent.APP_BACK -> "phone_app_back"
            PhoneIntent.APP_HOME -> "phone_home"
            PhoneIntent.APP_RECENTS -> "phone_recents"
            PhoneIntent.APP_SUBMIT -> "phone_app_submit"
            else -> ""
        }
        return ParsedPhoneCommand(
            originalText = original,
            normalizedText = normalized,
            intent = intent,
            action = action,
            confidence = 0.95,
            steps = if (tool.isBlank()) emptyList() else listOf(PhonePlanStep(tool))
        )
    }

    private fun unknown(original: String, normalized: String): ParsedPhoneCommand {
        return ParsedPhoneCommand(
            originalText = original,
            normalizedText = normalized,
            intent = PhoneIntent.UNKNOWN,
            confidence = 0.0,
            needsQuestion = true
        )
    }

    private fun appResult(raw: String, canonical: String, confidence: Double): AppNormalization {
        return AppNormalization(
            raw = raw,
            normalized = canonical,
            packageCandidate = canonicalPackages[canonical],
            confidence = confidence,
            needsQuestion = false
        )
    }

    private fun actionFor(intent: PhoneIntent): String {
        return when (intent) {
            PhoneIntent.APP_SEARCH -> "search"
            PhoneIntent.APP_TYPE -> "type"
            PhoneIntent.APP_TAP -> "tap"
            PhoneIntent.APP_FIND_TEXT -> "find"
            else -> intent.id
        }
    }

    private fun stopAtAction(input: String): String {
        return input
            .replace(Regex("""\s+(?:and|then)\s+(?:search(?:\s+for)?|look for|find|type|enter|tap|press|click)\b.*$"""), "")
            .replace(Regex("""\s+(?:search(?:\s+for)?|look for|find|type|enter|tap|press|click)\b.*$"""), "")
    }

    private fun normalizeActionWords(value: String): String {
        val lower = normalizePunctuation(value).lowercase()
        val tokenFixed = lower.split(" ").map { token ->
            actionTypos[token] ?: token
        }.joinToString(" ")
        return tokenFixed.replace(Regex("\\s+"), " ").trim()
    }

    private fun normalizePunctuation(value: String): String {
        return value
            .trim()
            .replace(Regex("""[“”]"""), "\"")
            .replace(Regex("""[‘’]"""), "'")
            .replace(Regex("""[,:;]+"""), " ")
            .replace(Regex("""\s+"""), " ")
    }

    private fun cleanSegment(value: String): String {
        return value
            .trim()
            .trim('"', '\'', '.', ',', ';', ':')
            .replace(Regex("""^the\s+""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }

    private fun displayName(app: String): String {
        return when (app.lowercase()) {
            "youtube" -> "YouTube"
            "chrome" -> "Chrome"
            "google" -> "Google"
            "settings", "android settings" -> "Settings"
            "discord" -> "Discord"
            "gmail" -> "Gmail"
            "messages" -> "Messages"
            "files" -> "Files"
            "calculator" -> "Calculator"
            "camera" -> "Camera"
            "maps" -> "Maps"
            "play store" -> "Google Play Store"
            "termux" -> "Termux"
            else -> app.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
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
                current[j + 1] = minOf(
                    current[j] + 1,
                    previous[j + 1] + 1,
                    previous[j] + cost
                )
            }
            for (j in previous.indices) previous[j] = current[j]
        }
        return previous[b.length]
    }

    private val actionTypos = mapOf(
        "serch" to "search",
        "searh" to "search",
        "serach" to "search",
        "seach" to "search",
        "sreach" to "search",
        "srch" to "search",
        "sarch" to "search",
        "clik" to "click",
        "pres" to "press"
    )

    private val commonTypos = actionTypos + mapOf(
        "youtuber" to "youtube",
        "youtub" to "youtube",
        "yotube" to "youtube",
        "yoitube" to "youtube",
        "yuotube" to "youtube",
        "yt" to "youtube",
        "chrom" to "chrome",
        "crome" to "chrome",
        "setings" to "settings",
        "discrod" to "discord",
        "gmal" to "gmail",
        "mesages" to "messages"
    )

    private val appAliases = mapOf(
        "youtube" to "youtube",
        "yt" to "youtube",
        "youtuber" to "youtube",
        "youtub" to "youtube",
        "yotube" to "youtube",
        "yoitube" to "youtube",
        "yuotube" to "youtube",
        "chrome" to "chrome",
        "chrom" to "chrome",
        "crome" to "chrome",
        "google chrome" to "chrome",
        "browser" to "chrome",
        "google" to "google",
        "settings" to "settings",
        "setings" to "settings",
        "android settings" to "settings",
        "discord" to "discord",
        "discrod" to "discord",
        "gmail" to "gmail",
        "gmal" to "gmail",
        "messages" to "messages",
        "mesages" to "messages",
        "sms" to "messages",
        "files" to "files",
        "file manager" to "files",
        "calculator" to "calculator",
        "calc" to "calculator",
        "camera" to "camera",
        "maps" to "maps",
        "google maps" to "maps",
        "play store" to "play store",
        "google play" to "play store",
        "google play store" to "play store",
        "termux" to "termux"
    )

    private val canonicalPackages = mapOf(
        "youtube" to "com.google.android.youtube",
        "chrome" to "com.android.chrome",
        "google" to "com.google.android.googlequicksearchbox",
        "settings" to "android.settings",
        "discord" to "com.discord",
        "gmail" to "com.google.android.gm",
        "messages" to "com.google.android.apps.messaging",
        "files" to "com.google.android.documentsui",
        "calculator" to "com.google.android.calculator",
        "camera" to "com.google.android.GoogleCamera",
        "maps" to "com.google.android.apps.maps",
        "play store" to "com.android.vending",
        "termux" to "com.termux"
    )

    private val genericAppRefs = setOf(
        "app",
        "application",
        "an app",
        "any app",
        "some app",
        "this app",
        "current app",
        "that app",
        "the app"
    )

    private data class FollowUpPattern(
        val regex: Regex,
        val intent: PhoneIntent,
        val action: String
    )

    private data class FollowUpSplit(
        val app: String,
        val intent: PhoneIntent,
        val action: String,
        val value: String
    )
}
