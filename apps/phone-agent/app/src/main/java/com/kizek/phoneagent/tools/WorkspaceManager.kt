package com.kizek.phoneagent.tools

import android.content.Context
import android.net.Uri
import java.io.File

enum class WorkspaceMode {
    APP_PRIVATE,
    SAF_TREE,
    ALL_FILES_ADVANCED
}

data class WorkspaceStatus(
    val mode: WorkspaceMode,
    val label: String,
    val uri: String?,
    val ready: Boolean,
    val detail: String
)

class WorkspaceManager(private val context: Context) {
    private val prefs = context.getSharedPreferences("phone_agent_workspace", Context.MODE_PRIVATE)
    val privateWorkspace: File = File(context.filesDir, "workspace").apply { mkdirs() }

    fun usePrivateWorkspace() {
        prefs.edit()
            .putString(KEY_MODE, WorkspaceMode.APP_PRIVATE.name)
            .remove(KEY_TREE_URI)
            .apply()
    }

    fun useTree(uri: Uri) {
        prefs.edit()
            .putString(KEY_MODE, WorkspaceMode.SAF_TREE.name)
            .putString(KEY_TREE_URI, uri.toString())
            .apply()
    }

    fun markAllFilesAdvancedRequested() {
        prefs.edit().putString(KEY_MODE, WorkspaceMode.ALL_FILES_ADVANCED.name).apply()
    }

    fun status(): WorkspaceStatus {
        val mode = runCatching {
            WorkspaceMode.valueOf(prefs.getString(KEY_MODE, WorkspaceMode.APP_PRIVATE.name) ?: WorkspaceMode.APP_PRIVATE.name)
        }.getOrDefault(WorkspaceMode.APP_PRIVATE)
        val uri = prefs.getString(KEY_TREE_URI, null)
        return when (mode) {
            WorkspaceMode.APP_PRIVATE -> WorkspaceStatus(
                mode = mode,
                label = privateWorkspace.absolutePath,
                uri = null,
                ready = true,
                detail = "App-private workspace is ready. Other apps cannot read it."
            )
            WorkspaceMode.SAF_TREE -> WorkspaceStatus(
                mode = mode,
                label = uri ?: "No folder selected",
                uri = uri,
                ready = uri != null,
                detail = "Storage Access Framework folder selected. Access is limited to the folder you grant."
            )
            WorkspaceMode.ALL_FILES_ADVANCED -> WorkspaceStatus(
                mode = mode,
                label = "Advanced all-files mode",
                uri = null,
                ready = false,
                detail = "All-files access is not requested by default and is not implemented as an automatic permission."
            )
        }
    }

    companion object {
        private const val KEY_MODE = "mode"
        private const val KEY_TREE_URI = "tree_uri"
    }
}
