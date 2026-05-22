package com.kizek.phoneagent.tools

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit

data class ShellResult(
    val command: String,
    val exitCode: Int?,
    val stdout: String,
    val stderr: String,
    val timedOut: Boolean
)

class ShellTools(context: Context) {
    private val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
    private val logs = mutableListOf<String>()
    private var process: Process? = null

    suspend fun exec(command: String, timeoutSeconds: Long = 20): ShellResult = withContext(Dispatchers.IO) {
        logs += "$ $command"
        val builder = ProcessBuilder("/system/bin/sh", "-c", command)
            .directory(workspace)
            .redirectErrorStream(false)
        val running = builder.start()
        process = running
        val finished = running.waitFor(timeoutSeconds, TimeUnit.SECONDS)
        if (!finished) {
            running.destroyForcibly()
        }
        val stdout = running.inputStream.bufferedReader().readText()
        val stderr = running.errorStream.bufferedReader().readText()
        stdout.takeIf { it.isNotBlank() }?.let { logs += it.trimEnd() }
        stderr.takeIf { it.isNotBlank() }?.let { logs += "stderr: ${it.trimEnd()}" }
        ShellResult(
            command = command,
            exitCode = if (finished) running.exitValue() else null,
            stdout = stdout,
            stderr = stderr,
            timedOut = !finished
        )
    }

    fun stop() {
        process?.destroyForcibly()
        logs += "process stopped"
        process = null
    }

    fun status(): String = if (process?.isAlive == true) "running" else "idle"

    fun logs(): List<String> = logs.toList()

    fun clearLogs() {
        logs.clear()
    }
}
