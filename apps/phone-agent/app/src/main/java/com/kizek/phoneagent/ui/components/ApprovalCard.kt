package com.kizek.phoneagent.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.kizek.phoneagent.storage.ApprovalEntity

@Composable
fun ApprovalCard(
    approval: ApprovalEntity,
    onApprove: (String) -> Unit,
    onReject: () -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    ApprovalActionCard(
        approval = approval,
        onApprove = onApprove,
        onReject = onReject,
        onDetails = onDetails,
        modifier = modifier
    )
}
