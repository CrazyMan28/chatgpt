package com.kizek.phoneagent.runtime

import android.content.Context
import android.net.Uri
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import com.kizek.phoneagent.models.SecureApiKeyStore
import java.io.ByteArrayOutputStream
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

data class SshTarget(
    val id: String,
    val name: String,
    val host: String,
    val port: Int,
    val username: String,
    val authType: String,
    val knownHostFingerprint: String,
    val workingDirectory: String,
    val defaultShell: String,
    val capabilities: Set<String>,
    val fallbackEnabled: Boolean
)

data class SshStatus(
    val configuredTargets: Int,
    val fallbackTargets: Int,
    val lastStatus: String,
    val lastError: String
)

data class SshCommandResult(
    val targetId: String,
    val targetName: String,
    val command: String,
    val success: Boolean,
    val stdout: String,
    val stderr: String,
    val exitCode: Int?,
    val timedOut: Boolean,
    val fingerprint: String,
    val warning: String
)

class SshAgentManager(context: Context) {
    private val context = context.applicationContext
    private val prefs = context.getSharedPreferences("phone_agent_ssh_targets", Context.MODE_PRIVATE)
    private val secrets = SecureApiKeyStore(context)
    private val client = SshClient()
    private val logLines = mutableListOf<String>()

    fun listTargets(): List<SshTarget> {
        val array = JSONArray(prefs.getString(KEY_TARGETS, "[]"))
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val id = item.optString("id")
                if (id.isBlank()) continue
                val caps = item.optJSONArray("capabilities")
                add(
                    SshTarget(
                        id = id,
                        name = item.optString("name", "SSH target"),
                        host = item.optString("host"),
                        port = item.optInt("port", 22).coerceIn(1, 65_535),
                        username = item.optString("username"),
                        authType = item.optString("authType", AUTH_PASSWORD),
                        knownHostFingerprint = item.optString("knownHostFingerprint"),
                        workingDirectory = item.optString("workingDirectory"),
                        defaultShell = item.optString("defaultShell", "/bin/sh").ifBlank { "/bin/sh" },
                        capabilities = buildSet {
                            if (caps != null) {
                                for (capIndex in 0 until caps.length()) {
                                    caps.optString(capIndex).takeIf { it.isNotBlank() }?.let { add(it) }
                                }
                            }
                        },
                        fallbackEnabled = item.optBoolean("fallbackEnabled", false)
                    )
                )
            }
        }
    }

    fun target(id: String): SshTarget? = listTargets().firstOrNull { it.id == id }

    fun fallbackTarget(): SshTarget? = listTargets().firstOrNull { it.fallbackEnabled } ?: listTargets().firstOrNull()

    fun saveTarget(target: SshTarget, password: String = "", privateKey: String = ""): SshTarget {
        val id = target.id.ifBlank { UUID.randomUUID().toString() }
        val sanitized = target.copy(
            id = id,
            host = target.host.trim(),
            username = target.username.trim(),
            knownHostFingerprint = target.knownHostFingerprint.trim(),
            defaultShell = target.defaultShell.ifBlank { "/bin/sh" }
        )
        val next = (listTargets().filterNot { it.id == id } + sanitized)
        saveTargets(next)
        if (password.isNotBlank()) secrets.save(secretName(id, "password"), password)
        if (privateKey.isNotBlank()) secrets.save(secretName(id, "private_key"), privateKey)
        log("Saved SSH target ${sanitized.name} at ${sanitized.host}:${sanitized.port}.")
        return sanitized
    }

    fun importPrivateKey(targetId: String, uri: Uri): String {
        val target = target(targetId) ?: return "Save the SSH target before importing a private key."
        val text = context.contentResolver.openInputStream(uri)?.use { input ->
            input.bufferedReader().readText()
        }.orEmpty()
        if (text.isBlank()) return "Selected private key was empty."
        secrets.save(secretName(target.id, "private_key"), text)
        log("Imported private key for ${target.name}.")
        return "Private key imported for ${target.name}."
    }

    fun deleteTarget(id: String) {
        val target = target(id)
        saveTargets(listTargets().filterNot { it.id == id })
        secrets.remove(secretName(id, "password"))
        secrets.remove(secretName(id, "private_key"))
        log("Deleted SSH target ${target?.name ?: id}.")
    }

    fun setFallback(id: String) {
        saveTargets(listTargets().map { it.copy(fallbackEnabled = it.id == id) })
        log("Set SSH fallback target to ${target(id)?.name ?: id}.")
    }

    suspend fun testConnection(id: String): SshCommandResult {
        val target = target(id) ?: return missingTarget(id, "pwd && uname -a")
        return exec(target, "pwd && uname -a")
    }

    suspend fun exec(id: String, command: String): SshCommandResult {
        val target = target(id) ?: return missingTarget(id, command)
        return exec(target, command)
    }

    suspend fun execFallback(command: String): SshCommandResult {
        val target = fallbackTarget() ?: return missingTarget("", command)
        return exec(target, command)
    }

    suspend fun readFile(id: String, path: String): SshCommandResult {
        return exec(id, "cat ${shellQuote(path)}")
    }

    suspend fun writeFile(id: String, path: String, content: String): SshCommandResult {
        val encoded = android.util.Base64.encodeToString(content.toByteArray(Charsets.UTF_8), android.util.Base64.NO_WRAP)
        val command = "printf %s ${shellQuote(encoded)} | base64 -d > ${shellQuote(path)}"
        return exec(id, command)
    }

    fun status(): SshStatus {
        val targets = listTargets()
        return SshStatus(
            configuredTargets = targets.size,
            fallbackTargets = targets.count { it.fallbackEnabled },
            lastStatus = prefs.getString(KEY_LAST_STATUS, "not configured").orEmpty(),
            lastError = prefs.getString(KEY_LAST_ERROR, "").orEmpty()
        )
    }

    fun logs(): List<String> = logLines.toList()

    private suspend fun exec(target: SshTarget, command: String): SshCommandResult {
        if (target.host.isBlank() || target.username.isBlank()) {
            return SshCommandResult(target.id, target.name, command, false, "", "Host and username are required.", null, false, "", "")
        }
        val result = withContext(Dispatchers.IO) {
            client.exec(
                target = target,
                password = secrets.read(secretName(target.id, "password")),
                privateKey = secrets.read(secretName(target.id, "private_key")),
                command = command
            )
        }
        prefs.edit()
            .putString(KEY_LAST_STATUS, if (result.success) "connected" else "failed")
            .putString(KEY_LAST_ERROR, if (result.success) "" else result.stderr.ifBlank { "SSH command failed." })
            .apply()
        log("SSH ${target.name}: exit=${result.exitCode} success=${result.success}")
        return result
    }

    private fun saveTargets(targets: List<SshTarget>) {
        val array = JSONArray()
        targets.forEach { target ->
            array.put(
                JSONObject()
                    .put("id", target.id)
                    .put("name", target.name)
                    .put("host", target.host)
                    .put("port", target.port)
                    .put("username", target.username)
                    .put("authType", target.authType)
                    .put("knownHostFingerprint", target.knownHostFingerprint)
                    .put("workingDirectory", target.workingDirectory)
                    .put("defaultShell", target.defaultShell)
                    .put("capabilities", JSONArray(target.capabilities.toList()))
                    .put("fallbackEnabled", target.fallbackEnabled)
            )
        }
        prefs.edit().putString(KEY_TARGETS, array.toString()).apply()
    }

    private fun missingTarget(id: String, command: String): SshCommandResult {
        return SshCommandResult(id, "SSH target", command, false, "", "No configured SSH target matched this request.", null, false, "", "")
    }

    private fun log(line: String) {
        logLines += line
        if (logLines.size > 200) logLines.removeAt(0)
    }

    private fun secretName(id: String, kind: String): String = "ssh_${id}_$kind"

    companion object {
        const val AUTH_PASSWORD = "password"
        const val AUTH_PRIVATE_KEY = "private_key"
        const val AUTH_NONE = "no_auth"
        private const val KEY_TARGETS = "targets"
        private const val KEY_LAST_STATUS = "last_status"
        private const val KEY_LAST_ERROR = "last_error"
    }
}

class SshClient {
    fun exec(
        target: SshTarget,
        password: String?,
        privateKey: String?,
        command: String,
        timeoutMs: Int = 20_000
    ): SshCommandResult {
        val jsch = JSch()
        if (target.authType == SshAgentManager.AUTH_PRIVATE_KEY && !privateKey.isNullOrBlank()) {
            jsch.addIdentity("phone-agent-${target.id}", privateKey.toByteArray(Charsets.UTF_8), null, null)
        }
        var session: Session? = null
        return runCatching {
            session = jsch.getSession(target.username, target.host, target.port).apply {
                if (target.authType == SshAgentManager.AUTH_PASSWORD && !password.isNullOrBlank()) {
                    setPassword(password)
                }
                setConfig("StrictHostKeyChecking", "no")
                setConfig(
                    "PreferredAuthentications",
                    when (target.authType) {
                        SshAgentManager.AUTH_PASSWORD -> "password,keyboard-interactive"
                        SshAgentManager.AUTH_PRIVATE_KEY -> "publickey"
                        else -> "none,publickey"
                    }
                )
                connect(timeoutMs)
            }
            val connected = requireNotNull(session)
            val fingerprint = connected.hostKey?.getFingerPrint(jsch).orEmpty()
            val expected = target.knownHostFingerprint.trim()
            if (expected.isNotBlank() && !fingerprint.equals(expected, ignoreCase = true)) {
                connected.disconnect()
                return SshCommandResult(
                    target.id,
                    target.name,
                    command,
                    false,
                    "",
                    "Known host fingerprint mismatch. Expected $expected but received $fingerprint.",
                    null,
                    false,
                    fingerprint,
                    ""
                )
            }
            val warning = if (expected.isBlank()) {
                "Known host fingerprint is not pinned; verify and save it before trusting this target."
            } else {
                ""
            }
            val wrapped = wrapCommand(target, command)
            val channel = connected.openChannel("exec") as ChannelExec
            val stderr = ByteArrayOutputStream()
            channel.setCommand(wrapped)
            channel.setErrStream(stderr)
            val stdout = channel.inputStream
            channel.connect(timeoutMs)
            val start = System.currentTimeMillis()
            while (!channel.isClosed && System.currentTimeMillis() - start < timeoutMs) {
                Thread.sleep(50)
            }
            val timedOut = !channel.isClosed
            if (timedOut) channel.disconnect()
            val output = stdout.bufferedReader().readText()
            val error = stderr.toString(Charsets.UTF_8.name())
            val exit = if (timedOut) null else channel.exitStatus
            channel.disconnect()
            connected.disconnect()
            SshCommandResult(
                target.id,
                target.name,
                command,
                success = exit == 0 && !timedOut,
                stdout = output,
                stderr = error,
                exitCode = exit,
                timedOut = timedOut,
                fingerprint = fingerprint,
                warning = warning
            )
        }.getOrElse { error ->
            session?.disconnect()
            SshCommandResult(
                target.id,
                target.name,
                command,
                false,
                "",
                error.message ?: "SSH command failed.",
                null,
                false,
                "",
                ""
            )
        }
    }

    private fun wrapCommand(target: SshTarget, command: String): String {
        val workdir = target.workingDirectory.trim()
        val body = if (workdir.isBlank()) command else "cd ${shellQuote(workdir)} && $command"
        val shell = target.defaultShell.ifBlank { "/bin/sh" }
        return "$shell -lc ${shellQuote(body)}"
    }
}

fun shellQuote(value: String): String = "'" + value.replace("'", "'\"'\"'") + "'"
