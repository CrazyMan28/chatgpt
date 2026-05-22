package com.kizek.phoneagent.ui.components

import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.kizek.phoneagent.storage.TaskEntity

@Composable
fun TaskCard(
    task: TaskEntity,
    onAction: (String, TaskEntity) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    GlassCard(
        title = task.title,
        subtitle = task.step,
        icon = "RUN",
        status = task.state,
        tone = statusToneFor(task.state),
        modifier = modifier,
        onClick = { onDetails(task.title, task.step) },
        actions = {
            OutlinedButton(onClick = { onAction("pause", task) }) { Text("Pause") }
            OutlinedButton(onClick = { onAction("resume", task) }) { Text("Resume") }
            Button(onClick = { onAction("retry", task) }) { Text("Retry") }
            OutlinedButton(onClick = { onAction("cancel", task) }) { Text("Cancel") }
        }
    ) {
        StatusPill("Worker: ${task.worker}")
    }
}
