package com.kizek.phoneagent.ui.screens

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone

@Composable
fun FilesScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var path by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var output by remember { mutableStateOf("") }
    var workspaceStatus by remember { mutableStateOf(app.workspaceManager.status()) }
    val folderLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            app.workspaceManager.useTree(uri)
            workspaceStatus = app.workspaceManager.status()
            output = "External workspace selected."
        }
    }
    val fileLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            output = "Picked file preview:\n" + context.contentResolver.openInputStream(uri)
                ?.bufferedReader()
                ?.use { it.readText().take(20_000) }
                .orEmpty()
        }
    }

    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Files",
                subtitle = "Browse and edit the active workspace without exposing raw paths unless you open details.",
                icon = "FILE",
                status = if (workspaceStatus.ready) "Ready" else "Setup needed"
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatusPill(workspaceStatus.label, if (workspaceStatus.ready) StatusTone.READY else StatusTone.SETUP)
                    StatusPill(if (workspaceStatus.label.contains("private", true)) "App-private" else "External", StatusTone.NEUTRAL)
                }
                Text(workspaceStatus.detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    Button(onClick = { folderLauncher.launch(null) }) { Text("Pick folder") }
                    OutlinedButton(onClick = { fileLauncher.launch(arrayOf("*/*")) }) { Text("Pick file") }
                    OutlinedButton(onClick = {
                        app.workspaceManager.usePrivateWorkspace()
                        workspaceStatus = app.workspaceManager.status()
                        output = "Using app-private workspace."
                    }) { Text("Use app workspace") }
                }
            }
            OutlinedTextField(
                value = path,
                onValueChange = { path = it },
                label = { Text("Workspace path") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                label = { Text("File content") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 8
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.horizontalScroll(rememberScrollState())
            ) {
                Button(onClick = {
                    val result = app.fileTools.list(path)
                    output = result.entries.joinToString("\n").ifBlank { result.error.orEmpty().ifBlank { "Folder is empty." } }
                }) { Text("List") }
                OutlinedButton(onClick = {
                    val result = app.fileTools.read(path)
                    output = result.content.ifBlank { result.error.orEmpty() }
                }) { Text("Read") }
                OutlinedButton(onClick = {
                    val result = app.fileTools.write(path, content)
                    output = if (result.ok) "Wrote ${result.path}" else result.error.orEmpty()
                }) { Text("Write") }
                OutlinedButton(onClick = {
                    output = app.fileTools.search(path).entries.joinToString("\n").ifBlank { "No matches." }
                }) { Text("Search") }
            }
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(output.lines().ifEmpty { listOf("No file output yet.") }) { line ->
                    GlassCard(title = null, subtitle = null, status = null) {
                        Text(
                            line,
                            fontFamily = if (line.contains("/") || line.contains(".")) FontFamily.Monospace else FontFamily.Default,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}
