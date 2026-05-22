package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.ToolCard

@Composable
fun McpScreen(
    app: PhoneAgentApplication,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    var remoteStatus by remember { mutableStateOf("checking") }
    val mcpTools = remember { app.mcpTools }
    val container = app.prootManager.status()
    LaunchedEffect(Unit) {
        remoteStatus = mcpTools.remoteStatus()
    }
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item { Text("MCP is optional. Phone core tools are built in and do not depend on MCP.") }
            item { ToolCard("mcp_remote_status", if (remoteStatus.startsWith("Remote MCP unavailable")) "offline" else "available", remoteStatus, onDetails) }
            item { ToolCard("mcp_list", "built-in phone tools", app.runtime.toolRegistry.builtInTools().joinToString("\n"), onDetails) }
            item { ToolCard("mcp_call", "remote only", "MCP calls should route through the laptop/server orchestrator until a local container MCP runner exists.", onDetails) }
            item {
                ToolCard(
                    "mcp_start_local",
                    if (container.installed) "container ready" else "blocked",
                    mcpTools.localStatus(),
                    onDetails
                )
            }
            item { ToolCard("mcp_stop_local", "available", "No local MCP process is running unless a future JSON-RPC bridge starts one.", onDetails) }
        }
    }
}
