package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.EmptyStateCard
import com.kizek.phoneagent.ui.components.QuestionCard

@Composable
fun QuestionsScreen(
    snapshot: RuntimeSnapshot,
    onAnswer: (String, String) -> Unit,
    onSkip: (String) -> Unit,
    onRefreshRemote: () -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onRefreshRemote) { Text("Sync remote questions") }
                }
            }
            if (snapshot.questions.isEmpty()) {
                item { EmptyStateCard("No question cards", "Questions appear as a bottom sheet in Chat and remain available here.") }
            }
            items(snapshot.questions, key = { it.id }) { question ->
                QuestionCard(
                    question = question,
                    onAnswer = { answer -> onAnswer(question.id, answer) },
                    onSkip = { onSkip(question.id) },
                    onDetails = onDetails
                )
            }
        }
    }
}
