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
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.ApprovalCard
import com.kizek.phoneagent.ui.components.EmptyStateCard

@Composable
fun ApprovalsScreen(
    snapshot: RuntimeSnapshot,
    onApprove: (String, String) -> Unit,
    onReject: (String) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (snapshot.approvals.isEmpty()) {
                item { EmptyStateCard("No approval requests", "Risky tool calls will appear here and in Chat.") }
            }
            items(snapshot.approvals, key = { it.id }) { approval ->
                ApprovalCard(
                    approval = approval,
                    onApprove = { scope -> onApprove(approval.id, scope) },
                    onReject = { onReject(approval.id) },
                    onDetails = onDetails
                )
            }
        }
    }
}
