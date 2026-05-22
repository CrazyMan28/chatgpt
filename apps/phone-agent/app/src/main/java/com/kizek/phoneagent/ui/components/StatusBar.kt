package com.kizek.phoneagent.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.WorkerMode

@Composable
fun StatusBar(
    title: String,
    remoteStatus: String,
    workerMode: WorkerMode,
    modelProvider: String = "",
    voiceStatus: String = "",
    deviceStatus: String = "",
    modifier: Modifier = Modifier
) {
    GlassSurface(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 12.dp, end = 12.dp, top = 32.dp, bottom = 8.dp),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(26.dp),
        tonalAlpha = 0.78f
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AnimatedAssistantOrb(AssistantVisualState.IDLE, size = 34.dp)
                Column(Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                    Text(
                        remoteStatus,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                StatusPill(workerMode.label, StatusTone.NEUTRAL, modifier = Modifier.widthIn(max = 118.dp))
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (modelProvider.isNotBlank()) StatusPill(modelProvider, StatusTone.THINKING)
                if (voiceStatus.isNotBlank()) StatusPill(voiceStatus, statusToneFor(voiceStatus))
                if (deviceStatus.isNotBlank()) StatusPill(deviceStatus, statusToneFor(deviceStatus))
                StatusPill(remoteStatus.substringBefore(":").ifBlank { "Ready" }, statusToneFor(remoteStatus))
            }
        }
    }
}
