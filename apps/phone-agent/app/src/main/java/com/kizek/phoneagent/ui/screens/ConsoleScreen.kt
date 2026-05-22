package com.kizek.phoneagent.ui.screens

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
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.EmptyStateCard
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import kotlinx.coroutines.launch

@Composable
fun ConsoleScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var command by remember { mutableStateOf("pwd") }
    var mode by remember { mutableStateOf("app") }
    var running by remember { mutableStateOf(false) }
    var lines by remember { mutableStateOf(app.shellTools.logs()) }
    val containerStatus = app.containerTools.status()
    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Console",
                subtitle = "Run commands in app shell, container shell, or remote shell when connected.",
                icon = "RUN",
                status = if (running) "Running command" else "Ready"
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("app" to "App shell", "container" to "Container", "remote" to "Remote").forEach { (id, label) ->
                        FilterChip(selected = mode == id, onClick = {
                            mode = id
                            lines = when (id) {
                                "container" -> app.containerTools.logs()
                                else -> app.shellTools.logs()
                            }
                        }, label = { Text(label) })
                    }
                }
                StatusPill(
                    when (mode) {
                        "container" -> if (containerStatus.installed) "Container ready" else "Container not ready"
                        "remote" -> "Remote routes through orchestrator"
                        else -> app.shellTools.status()
                    },
                    when (mode) {
                        "container" -> if (containerStatus.installed) StatusTone.READY else StatusTone.SETUP
                        "remote" -> StatusTone.OFFLINE
                        else -> StatusTone.READY
                    }
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = command,
                    onValueChange = { command = it },
                    label = { Text("Command") },
                    modifier = Modifier.weight(1f),
                    maxLines = 3
                )
                Button(enabled = command.isNotBlank() && !running, onClick = {
                    when (mode) {
                        "container" -> {
                            running = true
                            val result = app.containerTools.exec(command)
                            lines = app.containerTools.logs() + listOf(result.error ?: result.output)
                            running = false
                        }
                        "remote" -> {
                            lines = lines + "Remote shell is not faked. Connect a remote worker and route shell tasks from chat."
                        }
                        else -> {
                            running = true
                            scope.launch {
                                val result = app.shellTools.exec(command)
                                app.runtime.appendConsole(result.stdout.ifBlank { result.stderr }.ifBlank { "exit=${result.exitCode}" })
                                lines = app.shellTools.logs()
                                running = false
                            }
                        }
                    }
                }) { Text("Run") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                OutlinedButton(onClick = {
                    if (mode == "container") {
                        app.containerTools.stop()
                        lines = app.containerTools.logs() + listOf("container stop requested")
                    } else {
                        app.shellTools.stop()
                        lines = app.shellTools.logs()
                    }
                    running = false
                }) { Text("Stop") }
                OutlinedButton(onClick = {
                    if (mode != "container") app.shellTools.clearLogs()
                    lines = emptyList()
                }) { Text("Clear") }
                OutlinedButton(onClick = { lines = app.containerTools.logs() }) { Text("Container logs") }
            }
            if (mode == "container" && !containerStatus.installed) {
                EmptyStateCard(
                    title = "Container not ready",
                    detail = "Import PRoot and a rootfs to enable local Linux commands."
                )
            }
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(lines.ifEmpty { listOf("No console output yet.") }) { line ->
                    GlassCard(title = null, subtitle = null, status = null) {
                        Text(line, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
