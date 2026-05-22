package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.storage.SessionEntity
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.EmptyStateCard
import com.kizek.phoneagent.ui.components.GlassCard

@Composable
fun SessionsScreen(
    snapshot: RuntimeSnapshot,
    onCreate: () -> Unit,
    onRefreshRemote: () -> Unit,
    onOpen: (String) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    AppBackground(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onCreate) { Text("New session") }
                OutlinedButton(onClick = onRefreshRemote) { Text("Sync laptop") }
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (snapshot.sessions.isEmpty()) {
                    item { EmptyStateCard("No sessions", "Create a local session or sync from the laptop/server orchestrator.") }
                }
                items(snapshot.sessions, key = { it.id }) { session ->
                    SessionRow(
                        session = session,
                        selected = session.id == snapshot.selectedSessionId,
                        onOpen = { onOpen(session.id) },
                        onDetails = onDetails
                    )
                }
            }
        }
    }
}

@Composable
private fun SessionRow(
    session: SessionEntity,
    selected: Boolean,
    onOpen: () -> Unit,
    onDetails: (String, String) -> Unit
) {
    GlassCard(
        title = session.title,
        subtitle = if (session.remote) "Cached from laptop/server orchestrator" else "Stored on this phone",
        icon = if (session.remote) "NET" else "PH",
        status = if (selected) "Open" else session.mode,
        onClick = onOpen,
        actions = {
            OutlinedButton(onClick = { onDetails(session.id, "worker=${session.worker}\nmode=${session.mode}\nupdatedAt=${session.updatedAt}") }) {
                Text("Details")
            }
        }
    ) {
        Text("${session.mode} / ${session.worker}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
    }
}
