package com.kizek.phoneagent.tools

import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.SystemClock
import android.provider.Settings
import com.kizek.phoneagent.accessibility.AccessibilityActionExecutor
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService
import com.kizek.phoneagent.core.PhoneCommandParser
import kotlin.math.min

data class LaunchableApp(
    val label: String,
    val packageName: String
)

data class OpenAppResult(
    val opened: Boolean,
    val summary: String,
    val packageName: String? = null,
    val suggestions: List<LaunchableApp> = emptyList(),
    val error: String? = null,
    val requestedApp: String = "",
    val parsedApp: String = ""
)

data class PhoneAppSearchResult(
    val success: Boolean,
    val summary: String,
    val details: String = "",
    val method: String = "failed",
    val error: String? = null,
    val suggestions: List<LaunchableApp> = emptyList()
)

class AndroidDeviceTools(private val context: Context) {
    private val aliases = mapOf(
        "youtube" to listOf("com.google.android.youtube"),
        "yt" to listOf("com.google.android.youtube"),
        "youtuber" to listOf("com.google.android.youtube"),
        "yotube" to listOf("com.google.android.youtube"),
        "yoitube" to listOf("com.google.android.youtube"),
        "chrome" to listOf("com.android.chrome"),
        "chrom" to listOf("com.android.chrome"),
        "crome" to listOf("com.android.chrome"),
        "google chrome" to listOf("com.android.chrome"),
        "browser" to listOf("com.android.chrome", "org.mozilla.firefox", "com.microsoft.emmx", "com.brave.browser"),
        "firefox" to listOf("org.mozilla.firefox"),
        "edge" to listOf("com.microsoft.emmx"),
        "brave" to listOf("com.brave.browser"),
        "google" to listOf("com.google.android.googlequicksearchbox", "com.android.chrome"),
        "maps" to listOf("com.google.android.apps.maps"),
        "google maps" to listOf("com.google.android.apps.maps"),
        "discord" to listOf("com.discord"),
        "discrod" to listOf("com.discord"),
        "gmail" to listOf("com.google.android.gm"),
        "gmal" to listOf("com.google.android.gm"),
        "messages" to listOf("com.google.android.apps.messaging", "com.android.messaging"),
        "sms" to listOf("com.google.android.apps.messaging", "com.android.messaging"),
        "mesages" to listOf("com.google.android.apps.messaging", "com.android.messaging"),
        "files" to listOf("com.google.android.documentsui", "com.android.documentsui"),
        "file manager" to listOf("com.google.android.documentsui", "com.android.documentsui"),
        "calculator" to listOf("com.google.android.calculator", "com.android.calculator2"),
        "calc" to listOf("com.google.android.calculator", "com.android.calculator2"),
        "camera" to listOf("com.google.android.GoogleCamera", "com.android.camera", "com.sec.android.app.camera"),
        "play store" to listOf("com.android.vending"),
        "google play" to listOf("com.android.vending"),
        "termux" to listOf("com.termux")
    )
    private val settingsAliases = setOf("settings", "android settings", "setings")
    private val displayAliases = mapOf(
        "youtube" to "YouTube",
        "yt" to "YouTube",
        "youtuber" to "YouTube",
        "yotube" to "YouTube",
        "yoitube" to "YouTube",
        "chrome" to "Chrome",
        "chrom" to "Chrome",
        "crome" to "Chrome",
        "google chrome" to "Chrome",
        "browser" to "Browser",
        "firefox" to "Firefox",
        "edge" to "Edge",
        "brave" to "Brave",
        "google" to "Google",
        "maps" to "Maps",
        "google maps" to "Maps",
        "settings" to "Android Settings",
        "android settings" to "Android Settings",
        "setings" to "Android Settings",
        "discord" to "Discord",
        "discrod" to "Discord",
        "gmail" to "Gmail",
        "gmal" to "Gmail",
        "messages" to "Messages",
        "sms" to "Messages",
        "mesages" to "Messages",
        "files" to "Files",
        "file manager" to "Files",
        "calculator" to "Calculator",
        "calc" to "Calculator",
        "camera" to "Camera",
        "maps" to "Maps",
        "google maps" to "Maps",
        "play store" to "Google Play Store",
        "termux" to "Termux"
    )

    fun status(): String {
        return if (PhoneAccessibilityService.instance != null) {
            "accessibility enabled"
        } else {
            "accessibility disabled"
        }
    }

    fun listApps(query: String = "", limit: Int = 200): List<LaunchableApp> {
        val apps = allLaunchableApps()
        val parsedQuery = stripFollowUp(query)
        if (parsedQuery.isBlank()) return apps.take(limit)
        val needle = parsedQuery.lowercase()
        return apps.filter {
            it.label.lowercase().contains(needle) || it.packageName.lowercase().contains(needle)
        }.take(limit)
    }

    fun openApp(query: String): OpenAppResult {
        val parsed = stripFollowUp(query)
        val normalized = parsed.lowercase()
        if (normalized.isBlank()) {
            return OpenAppResult(
                opened = false,
                summary = "No app name or package was provided.",
                error = "missing_query",
                requestedApp = query,
                parsedApp = parsed
            )
        }
        resolveApp(parsed).let { resolution ->
            if (resolution.settings) {
                context.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return OpenAppResult(
                    opened = true,
                    summary = "Opened Android Settings.",
                    packageName = "android.settings",
                    requestedApp = query,
                    parsedApp = parsed
                )
            }
            resolution.app?.let { app ->
                val launch = context.packageManager.getLaunchIntentForPackage(app.packageName)
                if (launch != null) {
                    context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return OpenAppResult(
                        opened = true,
                        summary = "Opened ${app.label}.",
                        packageName = app.packageName,
                        requestedApp = query,
                        parsedApp = parsed
                    )
                }
            }
            if (resolution.ambiguous) {
                return OpenAppResult(
                    opened = false,
                    summary = "Multiple launchable apps matched \"$parsed\". Choose the app to open.",
                    suggestions = resolution.suggestions,
                    error = "app_ambiguous",
                    requestedApp = query,
                    parsedApp = parsed
                )
            }
            val display = displayName(parsed)
            val suggestions = if (normalized in setOf("youtube", "yt")) {
                (resolution.suggestions + webFallbackApps()).distinctBy { it.packageName }.take(5)
            } else {
                resolution.suggestions
            }
            return OpenAppResult(
                opened = false,
                summary = if (normalized in aliases.keys || normalized in settingsAliases) {
                    if (normalized in setOf("youtube", "yt") && webFallbackApps().isNotEmpty()) {
                        "I could not find YouTube. I found ${webFallbackApps().joinToString(" and ") { it.label }}. Do you want me to search on the web instead?"
                    } else {
                        "I could not find $display."
                    }
                } else {
                    "No launchable app matched \"$parsed\"."
                },
                suggestions = suggestions,
                error = "app_not_found",
                requestedApp = query,
                parsedApp = parsed
            )
        }
    }

    fun searchApp(
        app: String,
        query: String,
        preferIntent: Boolean = true,
        fallbackToAccessibility: Boolean = true,
        accessibilityTools: AccessibilityTools
    ): PhoneAppSearchResult {
        val parsedApp = stripFollowUp(app)
        val cleanedQuery = query.trim().trim('"', '\'')
        if (cleanedQuery.isBlank()) {
            return PhoneAppSearchResult(
                success = false,
                summary = "App search needs a query.",
                details = "parsedApp=$parsedApp\nquery=$cleanedQuery",
                error = "invalid_args"
            )
        }
        if (parsedApp.isBlank()) {
            return searchCurrentApp(cleanedQuery, accessibilityTools)
        }

        val resolution = resolveApp(parsedApp)
        if (resolution.ambiguous) {
            return PhoneAppSearchResult(
                success = false,
                summary = "Multiple launchable apps matched \"$parsedApp\". Choose the app to search.",
                details = appSuggestionsDetails(parsedApp, resolution.suggestions),
                method = "question_needed",
                error = "app_ambiguous",
                suggestions = resolution.suggestions
            )
        }
        val resolved = resolution.app
        if (!resolution.settings && resolved == null) {
            return missingSearchAppResult(parsedApp, resolution.suggestions)
        }

        if (preferIntent && resolved != null) {
            val intentResult = tryDirectSearchIntent(parsedApp, resolved, cleanedQuery)
            if (intentResult.success) return intentResult
        }

        if (!fallbackToAccessibility) {
            return PhoneAppSearchResult(
                success = false,
                summary = "Direct search intent failed and accessibility fallback is disabled.",
                details = "app=${displayName(parsedApp)}\nquery=$cleanedQuery\nmethod=failed",
                method = "failed",
                error = "direct_intent_failed"
            )
        }

        val open = openApp(parsedApp)
        if (!open.opened) {
            return PhoneAppSearchResult(
                success = false,
                summary = open.summary,
                details = openAppFailureDetails(open, parsedApp, cleanedQuery),
                method = "failed",
                error = open.error ?: "app_open_failed",
                suggestions = open.suggestions
            )
        }
        SystemClock.sleep(700L)
        val accessibility = accessibilityTools.findAndUseSearchField(cleanedQuery)
        return if (accessibility.success) {
            PhoneAppSearchResult(
                success = true,
                summary = "Searched ${displayName(parsedApp)} for \"$cleanedQuery\" using accessibility.",
                details = buildString {
                    appendLine("app=${displayName(parsedApp)}")
                    appendLine("package=${open.packageName.orEmpty()}")
                    appendLine("query=$cleanedQuery")
                    appendLine("method=accessibility_search_field")
                    appendLine()
                    append(accessibility.details)
                }.trimEnd(),
                method = "accessibility_search_field"
            )
        } else {
            PhoneAppSearchResult(
                success = false,
                summary = "I opened ${displayName(parsedApp)}, but I could not find the search field through accessibility. You can tap the search icon, then I can type the query.",
                details = buildString {
                    appendLine("app=${displayName(parsedApp)}")
                    appendLine("package=${open.packageName.orEmpty()}")
                    appendLine("query=$cleanedQuery")
                    appendLine("method=question_needed")
                    appendLine("accessibilityError=${accessibility.error.orEmpty()}")
                    appendLine()
                    append(accessibility.details)
                }.trimEnd(),
                method = "question_needed",
                error = accessibility.error ?: "search_field_not_found"
            )
        }
    }

    private fun searchCurrentApp(query: String, accessibilityTools: AccessibilityTools): PhoneAppSearchResult {
        val accessibility = accessibilityTools.findAndUseSearchField(query)
        return if (accessibility.success) {
            PhoneAppSearchResult(
                success = true,
                summary = "Searched the current app for \"$query\" using accessibility.",
                details = buildString {
                    appendLine("app=current")
                    appendLine("query=$query")
                    appendLine("method=accessibility_search_field")
                    appendLine()
                    append(accessibility.details)
                }.trimEnd(),
                method = "accessibility_search_field"
            )
        } else {
            PhoneAppSearchResult(
                success = false,
                summary = "I could not find a search field in the current app. Tap the search field, then I can type the query.",
                details = buildString {
                    appendLine("app=current")
                    appendLine("query=$query")
                    appendLine("method=question_needed")
                    appendLine("accessibilityError=${accessibility.error.orEmpty()}")
                    appendLine()
                    append(accessibility.details)
                }.trimEnd(),
                method = "question_needed",
                error = accessibility.error ?: "search_field_not_found"
            )
        }
    }

    fun appStatus(query: String): String {
        val parsed = stripFollowUp(query)
        val matches = listApps(parsed, 8)
        return if (matches.isEmpty()) {
            "No launchable app matched \"$parsed\"."
        } else {
            matches.joinToString("\n") { "${it.label} (${it.packageName})" }
        }
    }

    fun back(): Boolean = AccessibilityActionExecutor.globalBack()
    fun home(): Boolean = AccessibilityActionExecutor.globalHome()
    fun recents(): Boolean = AccessibilityActionExecutor.globalRecents()

    private fun tryDirectSearchIntent(app: String, resolved: LaunchableApp, query: String): PhoneAppSearchResult {
        val normalized = app.lowercase()
        val packageName = resolved.packageName
        val label = displayName(app).ifBlank { resolved.label }
        val youtubeLike = normalized in setOf("youtube", "yt") || packageName == "com.google.android.youtube"
        val chromeLike = normalized.contains("chrome") || packageName == "com.android.chrome"
        val googleLike = normalized == "google" || packageName == "com.google.android.googlequicksearchbox"
        val mapsLike = normalized in setOf("maps", "google maps") || packageName == "com.google.android.apps.maps"

        if (youtubeLike) {
            val searchIntent = Intent(Intent.ACTION_SEARCH)
                .setPackage(packageName)
                .putExtra(SearchManager.QUERY, query)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStart(searchIntent)) {
                return directIntentSuccess(label, packageName, query, "ACTION_SEARCH")
            }
            val urlIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://www.youtube.com/results?search_query=${Uri.encode(query)}")
            )
                .setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStart(urlIntent)) {
                return directIntentSuccess(label, packageName, query, "YouTube results URL")
            }
        }

        if (chromeLike) {
            val urlIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://www.google.com/search?q=${Uri.encode(query)}")
            )
                .setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStart(urlIntent)) {
                return directIntentSuccess(label, packageName, query, "browser search URL")
            }
        }

        if (googleLike) {
            val webSearch = Intent(Intent.ACTION_WEB_SEARCH)
                .setPackage(packageName)
                .putExtra(SearchManager.QUERY, query)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStart(webSearch)) {
                return directIntentSuccess(label, packageName, query, "ACTION_WEB_SEARCH")
            }
        }

        if (mapsLike) {
            val mapsIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("geo:0,0?q=${Uri.encode(query)}")
            )
                .setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStart(mapsIntent)) {
                return directIntentSuccess(label, packageName, query, "geo query")
            }
        }

        val genericSearch = Intent(Intent.ACTION_SEARCH)
            .setPackage(packageName)
            .putExtra(SearchManager.QUERY, query)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (tryStart(genericSearch)) {
            return directIntentSuccess(label, packageName, query, "ACTION_SEARCH")
        }

        return PhoneAppSearchResult(
            success = false,
            summary = "No direct search intent matched ${resolved.label}.",
            details = "app=$label\npackage=$packageName\nquery=$query\nmethod=failed",
            method = "failed",
            error = "direct_intent_unavailable"
        )
    }

    private fun directIntentSuccess(label: String, packageName: String, query: String, intentName: String): PhoneAppSearchResult {
        return PhoneAppSearchResult(
            success = true,
            summary = "Searched $label for \"$query\" using a direct intent.",
            details = "app=$label\npackage=$packageName\nquery=$query\nmethod=direct_intent\nintent=$intentName",
            method = "direct_intent"
        )
    }

    private fun tryStart(intent: Intent): Boolean {
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        } catch (_: IllegalStateException) {
            false
        }
    }

    private fun resolveApp(query: String): AppResolution {
        val parsed = stripFollowUp(query)
        val normalized = PhoneCommandParser.normalizeAppName(parsed).ifBlank { parsed.lowercase() }
        val apps = allLaunchableApps()
        if (normalized in settingsAliases) {
            return AppResolution(settings = true, suggestions = apps.take(5))
        }

        aliases[normalized]?.forEach { packageName ->
            apps.firstOrNull { it.packageName.equals(packageName, ignoreCase = true) }?.let {
                return AppResolution(app = it, suggestions = listOf(it))
            }
            context.packageManager.getLaunchIntentForPackage(packageName)?.let {
                return AppResolution(app = LaunchableApp(displayName(parsed), packageName), suggestions = emptyList())
            }
        }

        apps.firstOrNull { it.packageName.equals(parsed, ignoreCase = true) || it.packageName.equals(normalized, ignoreCase = true) }?.let {
            return AppResolution(app = it, suggestions = listOf(it))
        }

        val exactLabels = apps.filter { it.label.equals(parsed, ignoreCase = true) || it.label.equals(normalized, ignoreCase = true) }
        if (exactLabels.size == 1) {
            return AppResolution(app = exactLabels.first(), suggestions = exactLabels)
        }
        if (exactLabels.size > 1) {
            return AppResolution(ambiguous = true, suggestions = exactLabels.take(5))
        }

        val fuzzy = fuzzyMatches(normalized.ifBlank { parsed }, apps)
        if (fuzzy.size == 1) {
            return AppResolution(app = fuzzy.first().app, suggestions = listOf(fuzzy.first().app))
        }
        if (fuzzy.size > 1) {
            return AppResolution(ambiguous = true, suggestions = fuzzy.map { it.app }.take(5))
        }
        return AppResolution(suggestions = nearestSuggestions(normalized.ifBlank { parsed }, apps))
    }

    private fun allLaunchableApps(): List<LaunchableApp> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
            .map { info ->
                LaunchableApp(
                    label = info.loadLabel(context.packageManager).toString(),
                    packageName = info.activityInfo.packageName
                )
            }
            .distinctBy { it.packageName }
            .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.label })
    }

    private fun stripFollowUp(input: String): String {
        return try {
            PhoneCommandParser.stripFollowUpFromAppName(input)
        } catch (_: RuntimeException) {
            input.trim().trim('"', '\'', '.', ',', ';', ':')
        }
    }

    private fun fuzzyMatches(query: String, apps: List<LaunchableApp>): List<ScoredApp> {
        val needle = query.lowercase()
        if (needle.isBlank()) return emptyList()
        val scored = apps.mapNotNull { app ->
            val label = app.label.lowercase()
            val pkg = app.packageName.lowercase()
            val score = when {
                label == needle || pkg == needle -> 0
                label.startsWith(needle) -> 1
                label.split(Regex("""\s+""")).any { it == needle } -> 2
                label.contains(needle) -> 3
                pkg.contains(needle) -> 4
                levenshtein(label, needle) <= fuzzyThreshold(needle) -> 10 + levenshtein(label, needle)
                else -> null
            }
            score?.let { ScoredApp(app, it) }
        }.sortedWith(compareBy<ScoredApp> { it.score }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.app.label })
        val best = scored.firstOrNull()?.score ?: return emptyList()
        return scored.filter { it.score == best }.take(5)
    }

    private fun nearestSuggestions(query: String, apps: List<LaunchableApp>): List<LaunchableApp> {
        val needle = query.lowercase()
        if (needle.isBlank()) return emptyList()
        return apps.map { app ->
            ScoredApp(app, min(levenshtein(app.label.lowercase(), needle), levenshtein(app.packageName.lowercase(), needle)))
        }
            .sortedWith(compareBy<ScoredApp> { it.score }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.app.label })
            .take(5)
            .map { it.app }
    }

    private fun displayName(app: String): String {
        val normalized = app.lowercase()
        return displayAliases[normalized] ?: app.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

    private fun missingSearchAppResult(app: String, suggestions: List<LaunchableApp>): PhoneAppSearchResult {
        val availableWeb = (suggestions + webFallbackApps())
            .filter { it.packageName == "com.android.chrome" || it.packageName == "com.google.android.googlequicksearchbox" }
            .distinctBy { it.packageName }
        val summary = if (app.lowercase() in setOf("youtube", "yt") && availableWeb.isNotEmpty()) {
            "I could not find YouTube. I found ${availableWeb.joinToString(" and ") { it.label }}. Do you want me to search on the web instead?"
        } else {
            "I could not find ${displayName(app)}."
        }
        return PhoneAppSearchResult(
            success = false,
            summary = summary,
            details = appSuggestionsDetails(app, (suggestions + availableWeb).distinctBy { it.packageName }.take(5)),
            method = "question_needed",
            error = "app_not_found",
            suggestions = (suggestions + availableWeb).distinctBy { it.packageName }.take(5)
        )
    }

    private fun webFallbackApps(): List<LaunchableApp> {
        return allLaunchableApps().filter {
            it.packageName == "com.android.chrome" || it.packageName == "com.google.android.googlequicksearchbox"
        }
    }

    private fun appSuggestionsDetails(app: String, suggestions: List<LaunchableApp>): String {
        return buildString {
            appendLine("parsedApp=${displayName(app)}")
            appendLine("method=failed")
            if (suggestions.isNotEmpty()) {
                appendLine("suggestions:")
                suggestions.forEach { appendLine("${it.label} (${it.packageName})") }
            }
        }.trimEnd()
    }

    private fun openAppFailureDetails(open: OpenAppResult, app: String, query: String): String {
        return buildString {
            appendLine("requestedApp=${open.requestedApp}")
            appendLine("parsedApp=${open.parsedApp.ifBlank { app }}")
            appendLine("searchQuery=$query")
            appendLine("toolFailedAt=open")
            appendLine("reason=${open.summary}")
            if (open.suggestions.isNotEmpty()) {
                appendLine("suggestions:")
                open.suggestions.forEach { appendLine("${it.label} (${it.packageName})") }
            }
        }.trimEnd()
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

    private data class AppResolution(
        val app: LaunchableApp? = null,
        val settings: Boolean = false,
        val ambiguous: Boolean = false,
        val suggestions: List<LaunchableApp> = emptyList()
    )

    private data class ScoredApp(
        val app: LaunchableApp,
        val score: Int
    )
}
