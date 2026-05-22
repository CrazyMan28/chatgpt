package com.kizek.phoneagent.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.kizek.phoneagent.storage.EventEntity

@Composable
fun MessageBubble(
    event: EventEntity,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    AssistantBubble(event = event, onDetails = onDetails, modifier = modifier)
}
