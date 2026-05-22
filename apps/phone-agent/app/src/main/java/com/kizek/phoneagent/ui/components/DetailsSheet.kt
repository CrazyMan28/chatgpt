package com.kizek.phoneagent.ui.components

import androidx.compose.runtime.Composable

@Composable
fun DetailsSheet(
    title: String,
    body: String,
    onDismiss: () -> Unit
) {
    DetailsBottomSheet(title = title, body = body, onDismiss = onDismiss)
}
