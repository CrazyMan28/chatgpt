package com.kizek.phoneagent.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun ToolCard(
    name: String,
    status: String,
    detail: String,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    GlassCard(
        title = name,
        subtitle = detail,
        icon = "RUN",
        status = status,
        tone = statusToneFor(status),
        modifier = modifier,
        onClick = { onDetails(name, detail) }
    )
}
