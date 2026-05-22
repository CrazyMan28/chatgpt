package com.kizek.phoneagent.tools

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import java.io.File

data class FileToolResult(
    val ok: Boolean,
    val path: String,
    val content: String = "",
    val entries: List<String> = emptyList(),
    val error: String? = null
)

class FileTools(private val context: Context, val workspaceManager: WorkspaceManager) {
    val workspace: File = workspaceManager.privateWorkspace

    fun list(relativePath: String = ""): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val target = findDocument(relativePath, uri)
                ?: return FileToolResult(false, uri, error = "Folder or file does not exist in selected SAF workspace.")
            return FileToolResult(
                ok = true,
                path = target.uri.toString(),
                entries = target.listFiles().map { if (it.isDirectory) "${it.name}/" else it.name.orEmpty() }.sorted()
            )
        }
        val target = safeFile(relativePath)
        if (!target.exists()) return FileToolResult(false, target.absolutePath, error = "Path does not exist.")
        return FileToolResult(
            ok = true,
            path = target.absolutePath,
            entries = target.listFiles()?.map { if (it.isDirectory) "${it.name}/" else it.name }.orEmpty().sorted()
        )
    }

    fun read(relativePath: String): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val target = findDocument(relativePath, uri)
                ?: return FileToolResult(false, uri, error = "File does not exist in selected SAF workspace.")
            if (!target.isFile) {
                return FileToolResult(false, target.uri.toString(), error = "Selected path is not a file.")
            }
            val content = context.contentResolver.openInputStream(target.uri)?.bufferedReader()?.use { it.readText() }.orEmpty()
            return FileToolResult(true, target.uri.toString(), content = content)
        }
        val target = safeFile(relativePath)
        if (!target.exists() || !target.isFile) {
            return FileToolResult(false, target.absolutePath, error = "File does not exist.")
        }
        return FileToolResult(true, target.absolutePath, content = target.readText())
    }

    fun write(relativePath: String, content: String): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val target = ensureDocument(relativePath, uri)
                ?: return FileToolResult(false, uri, error = "Unable to create file in selected SAF workspace.")
            context.contentResolver.openOutputStream(target.uri, "wt")?.use { stream ->
                stream.write(content.toByteArray(Charsets.UTF_8))
            } ?: return FileToolResult(false, target.uri.toString(), error = "Unable to open output stream.")
            return FileToolResult(true, target.uri.toString(), content = content)
        }
        val target = safeFile(relativePath)
        target.parentFile?.mkdirs()
        target.writeText(content)
        return FileToolResult(true, target.absolutePath, content = content)
    }

    fun mkdir(relativePath: String): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val root = DocumentFile.fromTreeUri(context, Uri.parse(uri))
                ?: return FileToolResult(false, uri, error = "Selected SAF workspace is unavailable.")
            val dir = ensureDirectory(root, relativePath)
                ?: return FileToolResult(false, uri, error = "Unable to create folder.")
            return FileToolResult(true, dir.uri.toString())
        }
        val target = safeFile(relativePath)
        target.mkdirs()
        return FileToolResult(true, target.absolutePath)
    }

    fun deleteSafe(relativePath: String): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val target = findDocument(relativePath, uri)
                ?: return FileToolResult(false, uri, error = "Path does not exist in selected SAF workspace.")
            if (relativePath.isBlank()) {
                return FileToolResult(false, target.uri.toString(), error = "Cannot delete selected workspace root.")
            }
            val deleted = target.delete()
            return FileToolResult(deleted, target.uri.toString(), error = if (deleted) null else "Delete failed.")
        }
        val target = safeFile(relativePath)
        if (!target.exists()) return FileToolResult(false, target.absolutePath, error = "Path does not exist.")
        if (target == workspace) return FileToolResult(false, target.absolutePath, error = "Cannot delete workspace root.")
        val deleted = if (target.isDirectory) target.deleteRecursively() else target.delete()
        return FileToolResult(deleted, target.absolutePath, error = if (deleted) null else "Delete failed.")
    }

    fun search(query: String): FileToolResult {
        workspaceManager.status().uri?.let { uri ->
            val root = DocumentFile.fromTreeUri(context, Uri.parse(uri))
                ?: return FileToolResult(false, uri, error = "Selected SAF workspace is unavailable.")
            val matches = mutableListOf<String>()
            searchDocument(root, query, "", matches)
            return FileToolResult(true, uri, entries = matches.take(100))
        }
        val matches = workspace.walkTopDown()
            .filter { file ->
                file.isFile && (
                    file.name.contains(query, ignoreCase = true) ||
                        runCatching { file.readText().contains(query, ignoreCase = true) }.getOrDefault(false)
                    )
            }
            .map { it.relativeTo(workspace).path }
            .take(100)
            .toList()
        return FileToolResult(true, workspace.absolutePath, entries = matches)
    }

    fun pickFolderStatus(): WorkspaceStatus = workspaceManager.status()

    private fun safeFile(relativePath: String): File {
        val target = File(workspace, relativePath).canonicalFile
        require(target.path.startsWith(workspace.canonicalPath)) {
            "Path escapes the app-private workspace."
        }
        return target
    }

    private fun findDocument(relativePath: String, treeUri: String): DocumentFile? {
        val root = DocumentFile.fromTreeUri(context, Uri.parse(treeUri)) ?: return null
        if (relativePath.isBlank()) return root
        return relativePath.split('/').filter { it.isNotBlank() }.fold(root as DocumentFile?) { current, segment ->
            current?.findFile(segment)
        }
    }

    private fun ensureDocument(relativePath: String, treeUri: String): DocumentFile? {
        val root = DocumentFile.fromTreeUri(context, Uri.parse(treeUri)) ?: return null
        val segments = relativePath.split('/').filter { it.isNotBlank() }
        if (segments.isEmpty()) return null
        val parent = ensureDirectory(root, segments.dropLast(1).joinToString("/")) ?: return null
        val name = segments.last()
        return parent.findFile(name) ?: parent.createFile("text/plain", name)
    }

    private fun ensureDirectory(root: DocumentFile, relativePath: String): DocumentFile? {
        return relativePath.split('/').filter { it.isNotBlank() }.fold(root as DocumentFile?) { current, segment ->
            current?.findFile(segment) ?: current?.createDirectory(segment)
        }
    }

    private fun searchDocument(root: DocumentFile, query: String, prefix: String, matches: MutableList<String>) {
        root.listFiles().forEach { child ->
            val name = child.name.orEmpty()
            val path = if (prefix.isBlank()) name else "$prefix/$name"
            if (name.contains(query, ignoreCase = true)) {
                matches += if (child.isDirectory) "$path/" else path
            }
            if (child.isFile && matches.size < 100) {
                val contains = runCatching {
                    context.contentResolver.openInputStream(child.uri)?.bufferedReader()?.use {
                        it.readText().contains(query, ignoreCase = true)
                    } == true
                }.getOrDefault(false)
                if (contains && path !in matches) matches += path
            }
            if (child.isDirectory && matches.size < 100) {
                searchDocument(child, query, path, matches)
            }
        }
    }
}
