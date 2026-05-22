package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.storage.TaskEntity
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.EmptyStateCard
import com.kizek.phoneagent.ui.components.TaskCard

@Composable
fun TasksScreen(
    snapshot: RuntimeSnapshot,
    onTaskAction: (String, TaskEntity) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (snapshot.tasks.isEmpty()) {
                item { EmptyStateCard("No active tasks", "Running, waiting, failed, and paused tasks will appear here.") }
            }
            items(snapshot.tasks, key = { it.id }) { task ->
                TaskCard(task = task, onAction = onTaskAction, onDetails = onDetails)
            }
        }
    }
}
