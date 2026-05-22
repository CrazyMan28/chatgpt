package com.kizek.phoneagent.container

import android.content.Context
import android.net.Uri
import java.io.File
import java.util.concurrent.TimeUnit

data class RootfsStatus(
    val rootfsPath: String,
    val tarballPath: String,
    val rootfsPresent: Boolean,
    val shellPresent: Boolean,
    val shellPath: String,
    val installed: Boolean,
    val version: String,
    val diskUsageBytes: Long
)

class RootfsManager(context: Context) {
    private val context = context.applicationContext
    val workspaceDir: File = File(context.filesDir, "workspace").apply { mkdirs() }
    val containerDir: File = File(context.filesDir, "containers/default").apply { mkdirs() }
    val rootfsDir: File = File(containerDir, "rootfs")
    val importTarball: File = File(containerDir, "rootfs.tar")

    fun status(): RootfsStatus {
        val shell = shellFile()
        val rootfsPresent = rootfsDir.exists() && rootfsDir.list()?.isNotEmpty() == true
        return RootfsStatus(
            rootfsPath = rootfsDir.absolutePath,
            tarballPath = importTarball.absolutePath,
            rootfsPresent = rootfsPresent,
            shellPresent = shell?.exists() == true,
            shellPath = shell?.absolutePath ?: File(rootfsDir, "bin/sh").absolutePath,
            installed = rootfsPresent && shell?.exists() == true,
            version = readVersion(),
            diskUsageBytes = sizeOf(rootfsDir)
        )
    }

    fun importRootfs(uri: Uri): ContainerInstallResult {
        return runCatching {
            containerDir.mkdirs()
            context.contentResolver.openInputStream(uri)?.use { input ->
                importTarball.outputStream().use { output -> input.copyTo(output) }
            } ?: return ContainerInstallResult(false, "Unable to open selected rootfs tarball.", error = "open_failed")
            extractImportedRootfs(uri.lastPathSegment.orEmpty())
        }.getOrElse { error ->
            ContainerInstallResult(false, "Rootfs import failed: ${error.message}", error = error::class.java.simpleName)
        }
    }

    fun extractImportedRootfs(originalName: String = importTarball.name): ContainerInstallResult {
        return runCatching {
            if (!importTarball.exists()) {
                return ContainerInstallResult(
                    success = false,
                    summary = "No rootfs tarball has been imported or downloaded yet.",
                    error = "missing_tarball",
                    details = "Expected tarball at ${importTarball.absolutePath}."
                )
            }
            rootfsDir.deleteRecursively()
            rootfsDir.mkdirs()
            val name = originalName.lowercase()
            val tarFlag = if (name.endsWith(".gz") || name.endsWith(".tgz")) "-xzf" else "-xf"
            val command = "tar $tarFlag '${importTarball.absolutePath}' -C '${rootfsDir.absolutePath}'"
            val process = ProcessBuilder("/system/bin/sh", "-c", command)
                .redirectErrorStream(false)
                .start()
            val finished = process.waitFor(120, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                return ContainerInstallResult(false, "Rootfs extraction timed out after 120 seconds.", error = "timeout")
            }
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()
            normalizeSingleTopLevelDirectory()
            val shell = shellFile()
            if (process.exitValue() != 0 || rootfsDir.list()?.isNotEmpty() != true || shell?.exists() != true) {
                return ContainerInstallResult(
                    success = false,
                    summary = if (process.exitValue() == 0) {
                        "Rootfs extracted, but no compatible /bin/sh was found."
                    } else {
                        "Rootfs extraction failed. Android toybox tar may not support this archive."
                    },
                    stdout = stdout,
                    stderr = stderr,
                    exitCode = process.exitValue(),
                    error = if (process.exitValue() == 0) "shell_missing" else "extract_failed",
                    details = "Checked ${File(rootfsDir, "bin/sh").absolutePath}."
                )
            }
            File(rootfsDir, ".phone-agent-rootfs-version").writeText("imported:${System.currentTimeMillis()}")
            ContainerInstallResult(
                success = true,
                summary = "Extracted rootfs into ${rootfsDir.absolutePath}.",
                stdout = stdout,
                stderr = stderr,
                exitCode = process.exitValue(),
                details = "shell=${shell.absolutePath}"
            )
        }.getOrElse { error ->
            ContainerInstallResult(false, "Rootfs extraction failed: ${error.message}", error = error::class.java.simpleName)
        }
    }

    fun clear(): Boolean {
        importTarball.delete()
        return rootfsDir.deleteRecursively()
    }

    private fun readVersion(): String {
        val versionFile = File(rootfsDir, ".phone-agent-rootfs-version")
        return versionFile.takeIf { it.exists() }?.readText()?.trim().orEmpty().ifBlank { "not-installed" }
    }

    private fun shellFile(): File? {
        return listOf(
            File(rootfsDir, "bin/sh"),
            File(rootfsDir, "usr/bin/sh")
        ).firstOrNull { it.exists() }
    }

    private fun normalizeSingleTopLevelDirectory() {
        if (File(rootfsDir, "bin/sh").exists()) return
        val children = rootfsDir.listFiles().orEmpty().filter { it.name != ".phone-agent-rootfs-version" }
        val onlyDir = children.singleOrNull()?.takeIf { it.isDirectory } ?: return
        if (!File(onlyDir, "bin/sh").exists()) return
        onlyDir.listFiles().orEmpty().forEach { child ->
            child.renameTo(File(rootfsDir, child.name))
        }
        onlyDir.deleteRecursively()
    }

    private fun sizeOf(file: File): Long {
        if (!file.exists()) return 0L
        if (file.isFile) return file.length()
        return file.listFiles()?.sumOf { sizeOf(it) } ?: 0L
    }
}
