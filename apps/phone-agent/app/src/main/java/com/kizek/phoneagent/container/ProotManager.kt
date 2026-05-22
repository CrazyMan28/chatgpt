package com.kizek.phoneagent.container

import android.content.Context
import android.net.Uri
import android.os.Build
import java.io.File
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

data class ProotStatus(
    val architecture: String,
    val prootPath: String,
    val prootPresent: Boolean,
    val prootExecutable: Boolean,
    val rootfsPath: String,
    val rootfsPresent: Boolean,
    val rootfsShellPresent: Boolean,
    val rootfsShellPath: String,
    val lastTestPassed: Boolean,
    val lastTestDetail: String,
    val installed: Boolean,
    val detail: String
)

class ProotManager(context: Context) {
    private val context = context.applicationContext
    private val filesDir = context.filesDir
    private val rootfsManager = RootfsManager(context)
    val containerDir: File = File(filesDir, "containers/default").apply { mkdirs() }
    private val binDir: File = File(containerDir, "bin").apply { mkdirs() }
    private val prootBinary = File(binDir, "proot")
    private var activeProcess: Process? = null
    private val prefs = context.getSharedPreferences("phone_agent_container", Context.MODE_PRIVATE)

    fun status(): ProotStatus {
        migrateLegacyProot()
        val rootfs = rootfsManager.status()
        val exists = prootBinary.exists()
        val executable = exists && prootBinary.canExecute()
        val lastTestPassed = prefs.getBoolean(KEY_LAST_TEST_PASSED, false)
        val lastTestDetail = prefs.getString(KEY_LAST_TEST_DETAIL, "No container test has run yet.").orEmpty()
        val assetsReady = executable && rootfs.installed
        return ProotStatus(
            architecture = Build.SUPPORTED_ABIS.firstOrNull().orEmpty().ifBlank { Build.CPU_ABI },
            prootPath = prootBinary.absolutePath,
            prootPresent = exists,
            prootExecutable = executable,
            rootfsPath = rootfs.rootfsPath,
            rootfsPresent = rootfs.rootfsPresent,
            rootfsShellPresent = rootfs.shellPresent,
            rootfsShellPath = rootfs.shellPath,
            lastTestPassed = lastTestPassed,
            lastTestDetail = lastTestDetail,
            installed = assetsReady && lastTestPassed,
            detail = when {
                !exists -> "PRoot binary is missing. Import or download an ABI-matched binary first."
                !executable -> "PRoot binary exists, but Android did not allow execute permission."
                !rootfs.rootfsPresent -> "Rootfs is missing. Import or download a Linux rootfs tarball."
                !rootfs.shellPresent -> "Rootfs is present, but no /bin/sh-compatible shell was found."
                !lastTestPassed -> "Container assets are present, but container_exec is disabled until the test command passes. Android may block executing imported binaries. Last test: $lastTestDetail"
                else -> "Container runtime is ready."
            }
        )
    }

    fun importProot(uri: Uri): ContainerInstallResult {
        return runCatching {
            binDir.mkdirs()
            context.contentResolver.openInputStream(uri)?.use { input ->
                prootBinary.outputStream().use { output -> input.copyTo(output) }
            } ?: return ContainerInstallResult(false, "Unable to open selected proot binary.", error = "open_failed")
            val chmod = chmodProot()
            val present = prootBinary.exists() && prootBinary.canExecute()
            ContainerInstallResult(
                success = present,
                summary = if (present) {
                    "Imported proot binary to ${prootBinary.absolutePath}."
                } else {
                    "Copied proot, but Android did not mark it executable."
                },
                stderr = chmod.stderr,
                exitCode = chmod.exitCode,
                error = if (present) null else "chmod_or_exec_blocked",
                details = "path=${prootBinary.absolutePath}\ncanExecute=${prootBinary.canExecute()}"
            )
        }.getOrElse { error ->
            ContainerInstallResult(false, "PRoot import failed: ${error.message}", error = error::class.java.simpleName)
        }
    }

    fun importRootfs(uri: Uri): ContainerInstallResult = rootfsManager.importRootfs(uri)

    fun extractRootfs(): ContainerInstallResult = rootfsManager.extractImportedRootfs()

    fun downloadAssets(
        prootUrl: String,
        rootfsUrl: String,
        prootSha256: String = "",
        rootfsSha256: String = ""
    ): ContainerInstallResult {
        return runCatching {
            val details = mutableListOf<String>()
            var success = false
            if (prootUrl.isNotBlank()) {
                binDir.mkdirs()
                downloadToFile(prootUrl, prootBinary)
                val actual = sha256(prootBinary)
                if (prootSha256.isNotBlank() && !actual.equals(prootSha256.trim(), ignoreCase = true)) {
                    prootBinary.delete()
                    return ContainerInstallResult(
                        false,
                        "Downloaded proot checksum did not match.",
                        error = "checksum_mismatch",
                        details = "expected=$prootSha256\nactual=$actual"
                    )
                }
                val chmod = chmodProot()
                details += "proot=${prootBinary.absolutePath}"
                details += "prootSha256=$actual"
                details += "chmodExit=${chmod.exitCode}"
                if (chmod.stderr.isNotBlank()) details += "chmodStderr=${chmod.stderr.trim()}"
                success = prootBinary.canExecute()
            }
            if (rootfsUrl.isNotBlank()) {
                containerDir.mkdirs()
                downloadToFile(rootfsUrl, rootfsManager.importTarball)
                val actual = sha256(rootfsManager.importTarball)
                if (rootfsSha256.isNotBlank() && !actual.equals(rootfsSha256.trim(), ignoreCase = true)) {
                    rootfsManager.importTarball.delete()
                    return ContainerInstallResult(
                        false,
                        "Downloaded rootfs checksum did not match.",
                        error = "checksum_mismatch",
                        details = "expected=$rootfsSha256\nactual=$actual"
                    )
                }
                details += "rootfsTarball=${rootfsManager.importTarball.absolutePath}"
                details += "rootfsSha256=$actual"
                val extract = rootfsManager.extractImportedRootfs(rootfsUrl.substringAfterLast('/'))
                details += extract.details
                success = success || extract.success
                if (!extract.success) {
                    return extract.copy(details = details.filter { it.isNotBlank() }.joinToString("\n"))
                }
            }
            if (prootUrl.isBlank() && rootfsUrl.isBlank()) {
                ContainerInstallResult(
                    false,
                    "No download URLs were provided.",
                    error = "missing_url",
                    details = "Provide a trusted proot URL, rootfs URL, or both. No URLs are hardcoded by the app."
                )
            } else {
                ContainerInstallResult(
                    success = success,
                    summary = "Downloaded requested container asset(s). Run the container test next.",
                    error = if (success) null else "download_incomplete",
                    details = details.filter { it.isNotBlank() }.joinToString("\n")
                )
            }
        }.getOrElse { error ->
            ContainerInstallResult(false, "Container asset download failed: ${error.message}", error = error::class.java.simpleName)
        }
    }

    fun clearContainer(): ContainerInstallResult {
        stopCommand()
        val prootDeleted = !prootBinary.exists() || prootBinary.delete()
        val rootfsDeleted = rootfsManager.clear()
        prefs.edit().clear().apply()
        return ContainerInstallResult(
            success = prootDeleted && rootfsDeleted,
            summary = "Cleared container assets from ${containerDir.absolutePath}.",
            error = if (prootDeleted && rootfsDeleted) null else "delete_failed"
        )
    }

    fun startSession(): ContainerSession {
        return ContainerSession(status(), this)
    }

    fun runCommand(command: String, timeoutMs: Long = 30_000): ContainerCommandResult {
        return runCommandInternal(command, timeoutMs, requirePassedTest = true)
    }

    private fun runCommandInternal(command: String, timeoutMs: Long = 30_000, requirePassedTest: Boolean): ContainerCommandResult {
        val currentStatus = status()
        val assetsReady = currentStatus.prootExecutable && currentStatus.rootfsPresent && currentStatus.rootfsShellPresent
        if (!assetsReady || (requirePassedTest && !currentStatus.lastTestPassed)) {
            return ContainerCommandResult(command, null, "", currentStatus.detail, invocation = "blocked")
        }
        return runCatching {
            val primary = runProotInvocation(command, timeoutMs, useCapitalRoot = true)
            if (primary.exitCode == 0 || primary.timedOut) {
                primary
            } else {
                val fallback = runProotInvocation(command, timeoutMs, useCapitalRoot = false)
                if (fallback.exitCode == 0) {
                    fallback.copy(
                        error = fallback.error,
                        output = fallback.output.ifBlank { primary.output }
                    )
                } else {
                    fallback.copy(
                        error = listOf(
                            "Primary -R failed:",
                            primary.error.orEmpty(),
                            "Fallback -r failed:",
                            fallback.error.orEmpty()
                        ).joinToString("\n").trim()
                    )
                }
            }
        }.getOrElse { error ->
            ContainerCommandResult(command, null, "", error.message ?: "Container command failed.", invocation = "exception")
        }.also {
            activeProcess = null
        }
    }

    fun testCommand(): ContainerCommandResult {
        val result = runCommandInternal("uname -a || cat /etc/os-release || echo ok", timeoutMs = 20_000, requirePassedTest = false)
        prefs.edit()
            .putBoolean(KEY_LAST_TEST_PASSED, result.exitCode == 0)
            .putString(
                KEY_LAST_TEST_DETAIL,
                buildString {
                    appendLine("exit=${result.exitCode}")
                    appendLine("durationMs=${result.durationMs}")
                    appendLine("invocation=${result.invocation}")
                    if (result.output.isNotBlank()) appendLine(result.output.trimEnd())
                    if (!result.error.isNullOrBlank()) appendLine(result.error.trimEnd())
                }.trimEnd()
            )
            .apply()
        return result
    }

    fun stopCommand() {
        activeProcess?.destroyForcibly()
        activeProcess = null
    }

    fun installRootfsInstructions(): String {
        return "Import an ABI-matched proot binary to ${prootBinary.absolutePath} and a Linux rootfs tarball into ${rootfsManager.rootfsDir.absolutePath}. When both are present, container_exec runs proot -R <rootfs> -w /root -b <workspace>:/workspace /bin/sh -lc <command>, then retries with -r if -R fails. Some stock Android builds block executing imported binaries; the test command reports the exact kernel/permission error."
    }

    private fun runProotInvocation(command: String, timeoutMs: Long, useCapitalRoot: Boolean): ContainerCommandResult {
        val currentStatus = status()
        val args = mutableListOf(
            currentStatus.prootPath,
            if (useCapitalRoot) "-R" else "-r",
            currentStatus.rootfsPath,
            "-w",
            "/root"
        )
        if (rootfsManager.workspaceDir.exists()) {
            args += listOf("-b", "${rootfsManager.workspaceDir.absolutePath}:/workspace")
        }
        args += listOf("/bin/sh", "-lc", command)
        val start = System.currentTimeMillis()
        val process = ProcessBuilder(args)
            .redirectErrorStream(false)
            .start()
        activeProcess = process
        val finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
        if (!finished) {
            process.destroyForcibly()
        }
        val stdout = process.inputStream.bufferedReader().readText()
        val stderr = process.errorStream.bufferedReader().readText()
        return ContainerCommandResult(
            command = command,
            exitCode = if (finished) process.exitValue() else null,
            output = stdout,
            error = stderr.ifBlank { if (finished) null else "Container command timed out." },
            durationMs = System.currentTimeMillis() - start,
            timedOut = !finished,
            invocation = args.joinToString(" ")
        )
    }

    private fun chmodProot(): ChmodResult {
        val chmodProcess = ProcessBuilder("/system/bin/chmod", "700", prootBinary.absolutePath)
            .redirectErrorStream(false)
            .start()
        val finished = chmodProcess.waitFor(10, TimeUnit.SECONDS)
        if (!finished) chmodProcess.destroyForcibly()
        prootBinary.setExecutable(true, true)
        return ChmodResult(
            exitCode = if (finished) chmodProcess.exitValue() else null,
            stderr = chmodProcess.errorStream.bufferedReader().readText()
        )
    }

    private fun migrateLegacyProot() {
        val legacy = File(containerDir, "proot")
        if (legacy.exists() && !prootBinary.exists()) {
            binDir.mkdirs()
            legacy.copyTo(prootBinary, overwrite = true)
            chmodProot()
        }
    }

    private fun downloadToFile(url: String, target: File) {
        require(url.startsWith("https://") || url.startsWith("http://")) {
            "Only http(s) download URLs are supported."
        }
        target.parentFile?.mkdirs()
        URL(url).openStream().use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private data class ChmodResult(val exitCode: Int?, val stderr: String)

    companion object {
        private const val KEY_LAST_TEST_PASSED = "last_test_passed"
        private const val KEY_LAST_TEST_DETAIL = "last_test_detail"
    }
}
