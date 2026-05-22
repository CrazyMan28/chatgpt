package com.kizek.phoneagent.runtime

import android.content.Context
import android.net.Uri
import com.kizek.phoneagent.models.SecureApiKeyStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class TermuxBridgeSettings(
    val host: String,
    val port: Int,
    val username: String,
    val authType: String,
    val fallbackEnabled: Boolean
)

data class TermuxBridgeStatus(
    val installed: Boolean,
    val configured: Boolean,
    val connected: Boolean,
    val detail: String,
    val lastError: String
)

class TermuxBridgeManager(context: Context) {
    private val context = context.applicationContext
    private val prefs = context.getSharedPreferences("phone_agent_termux_bridge", Context.MODE_PRIVATE)
    private val secrets = SecureApiKeyStore(context)
    private val client = SshClient()
    private val logLines = mutableListOf<String>()

    var host: String
        get() = prefs.getString("host", "127.0.0.1") ?: "127.0.0.1"
        set(value) {
            prefs.edit().putString("host", value.trim().ifBlank { "127.0.0.1" }).apply()
        }

    var port: Int
        get() = prefs.getInt("port", 8022)
        set(value) {
            prefs.edit().putInt("port", value.coerceIn(1, 65_535)).apply()
        }

    var username: String
        get() = prefs.getString("username", "").orEmpty()
        set(value) {
            prefs.edit().putString("username", value.trim()).apply()
        }

    var authType: String
        get() = prefs.getString("auth_type", SshAgentManager.AUTH_PASSWORD) ?: SshAgentManager.AUTH_PASSWORD
        set(value) {
            prefs.edit().putString("auth_type", value).apply()
        }

    var fallbackEnabled: Boolean
        get() = prefs.getBoolean("fallback_enabled", false)
        set(value) {
            prefs.edit().putBoolean("fallback_enabled", value).apply()
        }

    fun settings(): TermuxBridgeSettings = TermuxBridgeSettings(host, port, username, authType, fallbackEnabled)

    fun save(settings: TermuxBridgeSettings, password: String = "", privateKey: String = "") {
        host = settings.host
        port = settings.port
        username = settings.username
        authType = settings.authType
        fallbackEnabled = settings.fallbackEnabled
        if (password.isNotBlank()) secrets.save(SECRET_PASSWORD, password)
        if (privateKey.isNotBlank()) secrets.save(SECRET_PRIVATE_KEY, privateKey)
        log("Saved Termux SSH bridge ${settings.host}:${settings.port}.")
    }

    fun importPrivateKey(uri: Uri): String {
        val text = context.contentResolver.openInputStream(uri)?.use { input ->
            input.bufferedReader().readText()
        }.orEmpty()
        if (text.isBlank()) return "Selected private key was empty."
        secrets.save(SECRET_PRIVATE_KEY, text)
        log("Imported Termux SSH private key.")
        return "Termux private key imported."
    }

    fun status(): TermuxBridgeStatus {
        val installed = isTermuxInstalled()
        val configured = host.isNotBlank() && port > 0 && username.isNotBlank()
        val connected = prefs.getBoolean("last_connected", false)
        val lastError = prefs.getString("last_error", "").orEmpty()
        return TermuxBridgeStatus(
            installed = installed,
            configured = configured,
            connected = connected,
            lastError = lastError,
            detail = when {
                !installed -> "Termux is not installed or is not visible to this APK. Setup instructions are still available."
                !configured -> "Termux SSH is not configured. Add localhost, port, username, and auth."
                connected -> "Last Termux SSH test succeeded at $host:$port."
                lastError.isNotBlank() -> "Termux SSH configured, but last test failed: $lastError"
                else -> "Termux SSH configured; run Test connection."
            }
        )
    }

    suspend fun testConnection(): SshCommandResult = exec("pwd && uname -a")

    suspend fun exec(command: String): SshCommandResult {
        val target = SshTarget(
            id = TERMUX_TARGET_ID,
            name = "Termux phone shell",
            host = host,
            port = port,
            username = username,
            authType = authType,
            knownHostFingerprint = prefs.getString("known_host_fingerprint", "").orEmpty(),
            workingDirectory = prefs.getString("working_directory", "").orEmpty(),
            defaultShell = prefs.getString("default_shell", "/data/data/com.termux/files/usr/bin/bash") ?: "/data/data/com.termux/files/usr/bin/bash",
            capabilities = setOf("shell", "files", "container/proot", "build jobs", "long tasks"),
            fallbackEnabled = fallbackEnabled
        )
        if (target.username.isBlank()) {
            return SshCommandResult(target.id, target.name, command, false, "", "Termux username is required.", null, false, "", "")
        }
        val result = withContext(Dispatchers.IO) {
            client.exec(
                target = target,
                password = secrets.read(SECRET_PASSWORD),
                privateKey = secrets.read(SECRET_PRIVATE_KEY),
                command = command
            )
        }
        prefs.edit()
            .putBoolean("last_connected", result.success)
            .putString("last_error", if (result.success) "" else result.stderr.ifBlank { "Termux SSH command failed." })
            .putString("known_host_fingerprint", result.fingerprint.ifBlank { prefs.getString("known_host_fingerprint", "").orEmpty() })
            .apply()
        log("Termux SSH exit=${result.exitCode} success=${result.success}")
        return result
    }

    fun installHint(): String {
        return """
            Termux SSH setup:
            Install Termux, then open Termux and run:
            pkg update
            pkg install openssh
            passwd
            sshd

            Then in Phone Agent settings use:
            host: 127.0.0.1
            port: 8022
            username: your Termux username
            auth: password or SSH key
        """.trimIndent()
    }

    fun logs(): List<String> = logLines.toList()

    private fun isTermuxInstalled(): Boolean {
        return context.packageManager.getLaunchIntentForPackage("com.termux") != null
    }

    private fun log(line: String) {
        logLines += line
        if (logLines.size > 200) logLines.removeAt(0)
    }

    companion object {
        const val TERMUX_TARGET_ID = "termux-localhost"
        private const val SECRET_PASSWORD = "termux_ssh_password"
        private const val SECRET_PRIVATE_KEY = "termux_ssh_private_key"
    }
}
