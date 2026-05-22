package com.kizek.phoneagent.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.storage.QuestionEntity

@Composable
fun QuestionCard(
    question: QuestionEntity,
    onAnswer: (String) -> Unit,
    onSkip: () -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    var freeText by rememberSaveable(question.id) { mutableStateOf(question.answer.orEmpty()) }
    val options = question.optionsCsv.split("|").filter { it.isNotBlank() }
    val isFree = question.type.contains("free", ignoreCase = true) || options.isEmpty()
    GlassCard(
        title = question.title.ifBlank { question.prompt.substringBefore('\n').ifBlank { "Question" } },
        subtitle = question.description.ifBlank { question.prompt.substringAfter('\n', "").ifBlank { "Waiting for your answer." } },
        icon = "?",
        status = question.status,
        tone = StatusTone.QUESTION,
        modifier = modifier,
        onClick = { onDetails(question.type, question.prompt) },
        actions = {
            if (!isFree) {
                options.take(4).forEach { option ->
                    OutlinedButton(onClick = { onAnswer(option) }) { Text(option) }
                }
            }
            if (question.allowSkip) {
                OutlinedButton(onClick = onSkip) { Text("Skip") }
            }
            if (isFree) {
                Button(onClick = { onAnswer(freeText) }, enabled = freeText.isNotBlank()) { Text("Answer") }
            }
        }
    ) {
        if (isFree) {
            OutlinedTextField(
                value = freeText,
                onValueChange = { freeText = it },
                label = { Text("Answer") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
        } else {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                options.forEachIndexed { index, option ->
                    StatusPill(if (index == 0) "$option · recommended" else option, StatusTone.QUESTION)
                }
            }
        }
    }
}
