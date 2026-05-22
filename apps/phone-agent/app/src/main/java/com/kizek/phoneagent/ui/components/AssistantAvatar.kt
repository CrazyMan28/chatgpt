package com.kizek.phoneagent.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

enum class AssistantVisualState {
    IDLE,
    LISTENING,
    THINKING,
    RUNNING_TOOL,
    BLOCKED,
    SPEAKING
}

@Composable
fun AssistantAvatar(
    state: AssistantVisualState,
    modifier: Modifier = Modifier
) {
    AnimatedAssistantOrb(state = state, modifier = modifier)
}
