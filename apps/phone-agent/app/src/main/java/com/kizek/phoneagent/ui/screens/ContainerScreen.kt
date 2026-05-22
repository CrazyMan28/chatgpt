package com.kizek.phoneagent.ui.screens

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ContainerScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var statusText by remember { mutableStateOf(app.prootManager.status().detail) }
    var prootUrl by remember { mutableStateOf("") }
    var rootfsUrl by remember { mutableStateOf("") }
    var prootSha by remember { mutableStateOf("") }
    var rootfsSha by remember { mutableStateOf("") }
    var refreshKey by remember { mutableStateOf(0) }
    val status = remember(refreshKey) { app.prootManager.status() }
    fun refresh(message: String = app.prootManager.status().detail) {
        refreshKey += 1
        statusText = message
    }
    val prootLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importProot(uri)
            refresh(result.summary + result.stderr.takeIf { it.isNotBlank() }?.let { "\n$it" }.orEmpty())
        }
    }
    val rootfsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importRootfs(uri)
            refresh(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
        }
    }
    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Container",
                subtitle = "Import PRoot and a rootfs to enable local Linux commands.",
                icon = "RUN",
                status = if (status.installed) "Ready" else "Missing assets"
            ) {
                StatusPill(if (status.lastTestPassed) "Last test passed" else "Test needed", if (status.lastTestPassed) StatusTone.READY else StatusTone.SETUP)
                Text("ABI: ${status.architecture}")
                Text("PRoot present: ${status.prootPresent} / executable: ${status.prootExecutable}")
                Text("Rootfs present: ${status.rootfsPresent} / shell: ${status.rootfsShellPresent}")
                Text(status.detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            GlassCard(title = "Install assets", subtitle = app.prootManager.installRootfsInstructions(), icon = "SET", status = "Manual import") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(onClick = { prootLauncher.launch(arrayOf("*/*")) }, modifier = Modifier.weight(1f)) { Text("Import PRoot") }
                    Button(onClick = { rootfsLauncher.launch(arrayOf("*/*")) }, modifier = Modifier.weight(1f)) { Text("Import rootfs") }
                }
                OutlinedTextField(value = prootUrl, onValueChange = { prootUrl = it }, label = { Text("PRoot binary URL") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = prootSha, onValueChange = { prootSha = it }, label = { Text("PRoot SHA-256 optional") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = rootfsUrl, onValueChange = { rootfsUrl = it }, label = { Text("Rootfs tarball URL") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = rootfsSha, onValueChange = { rootfsSha = it }, label = { Text("Rootfs SHA-256 optional") }, modifier = Modifier.fillMaxWidth())
                Text("Only use trusted sources and licenses. The app does not hardcode or endorse container asset URLs.")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = {
                    scope.launch {
                        statusText = "Downloading container assets..."
                        val result = withContext(Dispatchers.IO) {
                            app.containerTools.downloadAssets(prootUrl, rootfsUrl, prootSha, rootfsSha)
                        }
                        refresh(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
                    }
                }, modifier = Modifier.weight(1f)) { Text("Download") }
                OutlinedButton(onClick = {
                    val result = app.containerTools.extractRootfs()
                    refresh(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
                }, modifier = Modifier.weight(1f)) { Text("Extract") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = {
                    val result = app.containerTools.test()
                    refresh("exit=${result.exitCode}\n${result.output.ifBlank { result.error.orEmpty() }}")
                }, modifier = Modifier.weight(1f)) { Text("Run test") }
                OutlinedButton(onClick = {
                    val result = app.containerTools.clear()
                    refresh(result.summary)
                }, modifier = Modifier.weight(1f)) { Text("Clear") }
            }
            GlassCard(title = "Container output", icon = "INFO", status = "Details") {
                Text(statusText, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
