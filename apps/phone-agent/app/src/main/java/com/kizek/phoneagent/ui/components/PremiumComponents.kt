package com.kizek.phoneagent.ui.components

import android.text.format.DateFormat
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.WorkerMode
import com.kizek.phoneagent.core.SafeJsonExtractor
import com.kizek.phoneagent.storage.ApprovalEntity
import com.kizek.phoneagent.storage.EventEntity
import com.kizek.phoneagent.storage.QuestionEntity
import org.json.JSONObject

private val GlassShape = RoundedCornerShape(14.dp)
private val CompactShape = RoundedCornerShape(10.dp)

object PhoneUiDensity {
    val screenPadding = 10.dp
    val compactPadding = 8.dp
    val cardPadding = 10.dp
    val chipHorizontalPadding = 8.dp
    val chipVerticalPadding = 3.dp
    val iconButton = 36.dp
    val toolIcon = 24.dp
    val composerInputMin = 32.dp
    val composerInputMax = 96.dp
}

enum class StatusTone {
    READY,
    THINKING,
    TOOL,
    APPROVAL,
    QUESTION,
    ERROR,
    OFFLINE,
    SETUP,
    NEUTRAL
}

@Composable
fun AppBackground(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier.background(
            Brush.verticalGradient(
                listOf(
                    Color(0xFF080A10),
                    Color(0xFF0D121B),
                    Color(0xFF10131A)
                )
            )
        )
    ) {
        content()
    }
}

@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    shape: RoundedCornerShape = GlassShape,
    tonalAlpha: Float = 0.72f,
    contentPadding: Dp = 1.dp,
    content: @Composable () -> Unit
) {
    val border = Brush.linearGradient(
        listOf(
            Color.White.copy(alpha = 0.36f),
            MaterialTheme.colorScheme.primary.copy(alpha = 0.32f),
            MaterialTheme.colorScheme.tertiary.copy(alpha = 0.22f),
            Color.White.copy(alpha = 0.08f)
        )
    )
    Box(
        modifier = modifier
            .clip(shape)
            .background(
                Brush.linearGradient(
                    listOf(
                        Color.White.copy(alpha = 0.12f),
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.22f),
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.06f)
                    )
                )
            )
            .border(1.dp, border, shape)
            .padding(contentPadding)
    ) {
        Box(
            Modifier
                .clip(shape)
                .background(MaterialTheme.colorScheme.surface.copy(alpha = tonalAlpha))
        ) {
            content()
        }
    }
}

@Composable
fun GlassCard(
    title: String? = null,
    subtitle: String? = null,
    icon: String? = null,
    status: String? = null,
    tone: StatusTone = statusToneFor(status.orEmpty()),
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit = {}
) {
    val clickable = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    GlassSurface(modifier = modifier.then(clickable).fillMaxWidth(), shape = GlassShape) {
        Column(
            Modifier
                .fillMaxWidth()
                .animateContentSize()
                .padding(PhoneUiDensity.cardPadding),
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            if (title != null || subtitle != null || icon != null || status != null) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (icon != null) {
                        Box(
                            Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(statusColor(tone).copy(alpha = 0.18f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(icon, color = statusColor(tone), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (title != null) {
                            Text(
                                title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        if (subtitle != null) {
                            Text(
                                subtitle,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    if (status != null) {
                        StatusPill(text = status, tone = tone)
                    }
                }
            }
            content()
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
                content = actions
            )
        }
    }
}

@Composable
fun GradientBorderCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    GlassSurface(modifier = modifier.fillMaxWidth(), shape = GlassShape, tonalAlpha = 0.66f) {
        Column(Modifier.padding(PhoneUiDensity.cardPadding), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
fun StatusPill(
    text: String,
    tone: StatusTone = statusToneFor(text),
    modifier: Modifier = Modifier
) {
    val color = statusColor(tone)
    val label = text.ifBlank { "Ready" }
    Box(
        modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.34f), RoundedCornerShape(999.dp))
            .padding(horizontal = PhoneUiDensity.chipHorizontalPadding, vertical = PhoneUiDensity.chipVerticalPadding)
            .semantics { contentDescription = "Status: $label" }
    ) {
        Text(
            label,
            color = color,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun WorkerChip(
    workerMode: WorkerMode,
    selected: Boolean = true,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    FilterChip(
        selected = selected,
        onClick = { onClick?.invoke() },
        label = { Text(workerMode.label, maxLines = 1) },
        modifier = modifier
    )
}

@Composable
fun ModelChip(
    label: String,
    modifier: Modifier = Modifier
) {
    AssistChip(onClick = {}, label = { Text(label, maxLines = 1) }, modifier = modifier)
}

@Composable
fun AnimatedAssistantOrb(
    state: AssistantVisualState,
    modifier: Modifier = Modifier,
    size: Dp = 58.dp
) {
    val transition = rememberInfiniteTransition(label = "assistant-orb")
    val pulse by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = when (state) {
            AssistantVisualState.IDLE -> 1.0f
            AssistantVisualState.BLOCKED -> 1.04f
            else -> 1.09f
        },
        animationSpec = infiniteRepeatable(tween(980), RepeatMode.Reverse),
        label = "orb-pulse"
    )
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(3600, easing = LinearEasing)),
        label = "orb-rotation"
    )
    val wave by transition.animateFloat(
        initialValue = 0.15f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(tween(760), RepeatMode.Reverse),
        label = "orb-wave"
    )
    val colors = when (state) {
        AssistantVisualState.LISTENING -> listOf(Color(0xFF7EF5B8), Color(0xFF31A9FF), Color(0xFF7EF5B8))
        AssistantVisualState.THINKING -> listOf(Color(0xFFC7B9FF), Color(0xFF8DEBD5), Color(0xFFFFC86B))
        AssistantVisualState.RUNNING_TOOL -> listOf(Color(0xFFFFC86B), Color(0xFF8DEBD5), Color(0xFFFFF3CF))
        AssistantVisualState.BLOCKED -> listOf(Color(0xFFFFB86B), Color(0xFFFF6B6B), Color(0xFFFFE0A8))
        AssistantVisualState.SPEAKING -> listOf(Color(0xFFC7B9FF), Color(0xFFFF8BC7), Color(0xFF8DEBD5))
        else -> listOf(Color(0xFF8DEBD5), Color(0xFFC7B9FF), Color(0xFF86B7FF))
    }
    Box(
        modifier = modifier
            .size(size)
            .scale(pulse)
            .rotate(if (state == AssistantVisualState.IDLE || state == AssistantVisualState.BLOCKED) 0f else rotation)
            .clip(CircleShape)
            .background(Brush.sweepGradient(colors)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            Modifier
                .size(size * 0.72f)
                .clip(CircleShape)
                .background(Color(0xFF111821).copy(alpha = 0.82f))
        )
        Canvas(Modifier.size(size * 0.78f)) {
            val stroke = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
            drawArc(
                color = colors.first().copy(alpha = 0.72f),
                startAngle = 20f,
                sweepAngle = 120f + wave * 90f,
                useCenter = false,
                style = stroke
            )
            drawArc(
                color = colors.last().copy(alpha = 0.62f),
                startAngle = 210f,
                sweepAngle = 80f + wave * 80f,
                useCenter = false,
                style = stroke
            )
        }
        if (state == AssistantVisualState.RUNNING_TOOL || state == AssistantVisualState.SPEAKING || state == AssistantVisualState.LISTENING) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat(3) { index ->
                    Box(
                        Modifier
                            .width(4.dp)
                            .height((10 + (wave * 13) + index * 3).dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(colors[index % colors.size])
                    )
                }
            }
        }
    }
}

@Composable
fun ThinkingCard(
    status: String,
    state: AssistantVisualState = AssistantVisualState.THINKING,
    modifier: Modifier = Modifier
) {
    GlassSurface(modifier = modifier.fillMaxWidth(), shape = CompactShape, tonalAlpha = 0.72f) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            AnimatedAssistantOrb(state = state, size = 30.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(visibleReasoningSummary(status), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = statusColor(StatusTone.THINKING),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                )
            }
        }
    }
}

@Composable
fun AssistantBubble(
    event: EventEntity,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val fromUser = event.author == "user"
    val isSystem = event.author == "system"
    val bubbleColor = when {
        fromUser -> MaterialTheme.colorScheme.primary.copy(alpha = 0.94f)
        isSystem -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.62f)
        else -> MaterialTheme.colorScheme.surface.copy(alpha = 0.74f)
    }
    val contentColor = if (fromUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (fromUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 320.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(bubbleColor)
                .border(
                    1.dp,
                    if (fromUser) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.08f),
                    RoundedCornerShape(18.dp)
                )
                .clickable { onDetails(event.type, event.payload.ifBlank { event.summary }) }
                .padding(10.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    when {
                        fromUser -> "You"
                        event.author == "assistant" -> "Assistant"
                        else -> event.type.labelize()
                    },
                    color = contentColor.copy(alpha = 0.72f),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    visibleEventText(event),
                    color = contentColor,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
fun ToolCallCard(
    event: EventEntity,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val tool = remember(event.id, event.payload) { toolEventFrom(event) }
    val tone = when {
        tool.approvalId.isNotBlank() || event.type == "ToolBlocked" -> StatusTone.APPROVAL
        tool.success -> StatusTone.READY
        else -> StatusTone.ERROR
    }
    GlassSurface(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onDetails(tool.name, event.payload.ifBlank { event.summary }) },
        shape = CompactShape,
        tonalAlpha = 0.72f
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                    .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(PhoneUiDensity.toolIcon)
                    .clip(CircleShape)
                    .background(statusColor(tone).copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Text(if (tool.success) "OK" else if (tool.approvalId.isNotBlank()) "!" else "ERR", color = statusColor(tone), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Tool · ${tool.name}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (tool.stepLabel.isNotBlank()) {
                    Text(tool.stepLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text(tool.summary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            StatusPill(tool.status, tone, modifier = Modifier.widthIn(max = 96.dp))
            TextButton(onClick = { onDetails(tool.name, event.payload.ifBlank { event.summary }) }) {
                Text("Details")
            }
        }
    }
}

@Composable
fun ApprovalActionCard(
    approval: ApprovalEntity,
    onApprove: (String) -> Unit,
    onReject: () -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val tone = when (approval.status) {
        "approved" -> StatusTone.READY
        "rejected" -> StatusTone.ERROR
        else -> StatusTone.APPROVAL
    }
    GlassCard(
        title = "Approval required",
        subtitle = approval.action.take(180),
        icon = "!",
        status = "${approval.risk} risk",
        tone = tone,
        modifier = modifier,
        onClick = { onDetails("Approval · ${approval.tool}", approvalDetails(approval)) },
        actions = {
            Button(onClick = { onApprove("once") }) { Text("Approve once") }
            OutlinedButton(onClick = { onApprove("task") }) { Text("Task") }
            OutlinedButton(onClick = { onApprove("session") }) { Text("Session") }
            OutlinedButton(onClick = { onApprove("safe-medium") }) { Text("Safe/medium") }
            OutlinedButton(onClick = { onApprove("full-session") }) { Text("Full") }
            OutlinedButton(onClick = onReject, colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                Text("Reject")
            }
        }
    ) {
        Text(approval.reason, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            StatusPill("Tool: ${approval.tool}", StatusTone.TOOL)
            StatusPill("Worker: ${approval.worker}", StatusTone.NEUTRAL)
            StatusPill("Grant: ${approval.scope.ifBlank { "No grant" }}", StatusTone.APPROVAL)
        }
        Text("Target: ${approval.target}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun ErrorMessageCard(
    event: EventEntity,
    onDetails: (String, String) -> Unit,
    onSetup: () -> Unit,
    modifier: Modifier = Modifier
) {
    val body = event.payload.ifBlank { event.summary }
    val setupUseful = event.summary.contains("Mistral", ignoreCase = true) ||
        event.summary.contains("model", ignoreCase = true) ||
        event.summary.contains("permission", ignoreCase = true) ||
        event.summary.contains("configured", ignoreCase = true) ||
        event.summary.contains("setup", ignoreCase = true)
    GlassCard(
        title = if (setupUseful) "Needs setup" else "Task stopped",
        subtitle = event.summary.ifBlank { "Something failed." },
        icon = "ERR",
        status = "Error",
        tone = StatusTone.ERROR,
        modifier = modifier,
        onClick = { onDetails(event.type, body) },
        actions = {
            if (setupUseful) {
                Button(onClick = onSetup) { Text("Setup") }
            }
            OutlinedButton(onClick = { onDetails(event.type, body) }) { Text("Details") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuestionBottomSheet(
    question: QuestionEntity,
    index: Int,
    total: Int,
    onAnswer: (String) -> Unit,
    onSkip: () -> Unit,
    onDismiss: () -> Unit = {}
) {
    var freeText by rememberSaveable(question.id) { mutableStateOf(question.answer.orEmpty()) }
    var selectedOptions by rememberSaveable(question.id) { mutableStateOf<List<String>>(emptyList()) }
    val options = remember(question.optionsCsv) { question.optionsCsv.split("|").filter { it.isNotBlank() } }
    val type = question.type.lowercase()
    val multi = type.contains("multi")
    val free = type.contains("free") || options.isEmpty()
    val showCustom = question.allowCustom || free || options.any { it.contains("something else", ignoreCase = true) }
    val title = question.title.ifBlank { question.prompt.substringBefore('\n').ifBlank { "Question" } }
    val description = question.description.ifBlank { question.prompt.substringAfter('\n', "").trim() }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        AnimatedVisibility(
            visible = true,
            enter = slideInVertically(initialOffsetY = { it / 3 }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it / 3 }) + fadeOut()
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 620.dp)
                    .padding(start = 14.dp, end = 14.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        if (description.isNotBlank()) {
                            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusPill("${index + 1} of $total", StatusTone.QUESTION)
                        if (question.allowSkip) {
                            IconButton(onClick = onSkip) {
                                Icon(Icons.Filled.Close, contentDescription = "Skip question")
                            }
                        }
                    }
                }
                if (options.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        options.forEachIndexed { optionIndex, option ->
                            OutlinedButton(
                                onClick = {
                                    if (multi) {
                                        selectedOptions = if (selectedOptions.contains(option)) {
                                            selectedOptions - option
                                        } else {
                                            selectedOptions + option
                                        }
                                    } else {
                                        selectedOptions = listOf(option)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                border = BorderStroke(
                                    1.dp,
                                    if (selectedOptions.contains(option)) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.45f)
                                )
                            ) {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text("${optionIndex + 1}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                                    Text(if (optionIndex == 0) "$option  · recommended" else option, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
                if (showCustom) {
                    OutlinedTextField(
                        value = freeText,
                        onValueChange = { freeText = it },
                        label = { Text("Custom answer") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        maxLines = 5
                    )
                }
                if (options.isNotEmpty()) {
                    Text(
                        "Recommended: ${options.first()}",
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelLarge
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (question.allowSkip) {
                        OutlinedButton(onClick = onSkip, modifier = Modifier.weight(1f)) { Text("Skip") }
                    }
                    Button(
                        onClick = {
                            val answer = when {
                                selectedOptions.isNotEmpty() && selectedOptions.none { it.contains("something else", ignoreCase = true) } -> selectedOptions.joinToString(", ")
                                freeText.isNotBlank() -> freeText
                                !showCustom && options.isNotEmpty() -> options.first()
                                else -> ""
                            }
                            if (answer.isNotBlank()) onAnswer(answer)
                        },
                        enabled = freeText.isNotBlank() ||
                            selectedOptions.any { !it.contains("something else", ignoreCase = true) } ||
                            (!showCustom && options.isNotEmpty()),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Continue")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailsBottomSheet(
    title: String,
    body: String,
    onDismiss: () -> Unit
) {
    val parsed = remember(body) { detailsFrom(body) }
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Summary", "Args", "Output", "Error", "Approval", "Retry", "Logs", "Raw")
    val clipboard = LocalClipboardManager.current
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(bottom = 26.dp)) {
            Column(Modifier.padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title.ifBlank { parsed.tool.ifBlank { "Details" } }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(parsed.statusLine, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = { clipboard.setText(AnnotatedString(parsed.raw.ifBlank { body })) }) {
                        Text("Copy raw")
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            ScrollableTabRow(selectedTabIndex = tab, modifier = Modifier.fillMaxWidth(), edgePadding = 8.dp) {
                tabs.forEachIndexed { index, label ->
                    Tab(selected = tab == index, onClick = { tab = index }, text = { Text(label, maxLines = 1) })
                }
            }
            val selectedText = when (tabs[tab]) {
                    "Summary" -> parsed.summary
                    "Args" -> parsed.args
                    "Output" -> parsed.output
                    "Error" -> parsed.error
                    "Approval" -> parsed.approval
                    "Retry" -> parsed.retry
                    "Logs" -> parsed.logs
                    else -> parsed.raw
                }.ifBlank { "No details." }
            SelectionContainer {
                Text(
                    selectedText,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 120.dp, max = 360.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(14.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontFamily = if (tabs[tab] == "Summary") FontFamily.Default else FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
fun ChatInputBar(
    input: String,
    onInputChange: (String) -> Unit,
    enabled: Boolean,
    workerMode: WorkerMode,
    onWorkerClick: () -> Unit,
    onSend: (String) -> Unit,
    onMic: () -> Unit,
    onTools: () -> Unit,
    onAttach: () -> Unit,
    onScreenObserve: (String) -> Unit,
    voiceLine: String,
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current
    val trimmedInput = input.trim()
    val canSend = enabled && trimmedInput.isNotBlank()
    fun submit(text: String = input) {
        val trimmed = text.trim()
        if (trimmed.isBlank() || !enabled) return
        focusManager.clearFocus()
        onSend(trimmed)
    }
    GlassSurface(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), tonalAlpha = 0.9f) {
        Column(Modifier.padding(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (voiceLine.isNotBlank()) {
                StatusPill(voiceLine.take(80), if (voiceLine.contains("denied", true) || voiceLine.contains("error", true)) StatusTone.ERROR else StatusTone.THINKING)
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF171B22))
                    .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(20.dp))
                    .padding(start = 12.dp, end = 5.dp, top = 5.dp, bottom = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = { next ->
                        if (!enabled) return@BasicTextField
                        if (next.contains('\n') && next.trim().isNotBlank()) {
                            val singleLine = next.replace("\n", " ").trim()
                            onInputChange(singleLine)
                            submit(singleLine)
                        } else {
                            onInputChange(next)
                        }
                    },
                    enabled = enabled,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = PhoneUiDensity.composerInputMin, max = PhoneUiDensity.composerInputMax),
                    maxLines = 5,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = { submit() },
                        onDone = { submit() }
                    ),
                    decorationBox = { innerTextField ->
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
                            if (input.isBlank()) {
                                Text(
                                    "Message Phone Agent",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                            innerTextField()
                        }
                    }
                )
                AnimatedVisibility(visible = trimmedInput.isNotBlank()) {
                    FilledIconButton(
                        enabled = canSend,
                        onClick = { submit() },
                        modifier = Modifier.size(34.dp)
                    ) {
                        Icon(Icons.Filled.ArrowUpward, contentDescription = "Send")
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(onClick = onTools, enabled = enabled, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Tools")
                }
                OutlinedButton(onClick = onAttach, enabled = enabled, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)) {
                    Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("File")
                }
                OutlinedButton(
                    onClick = {
                        val draft = input
                        onInputChange("")
                        onScreenObserve(draft)
                    },
                    enabled = enabled,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)
                ) {
                    Icon(Icons.Filled.Visibility, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Screen")
                }
                OutlinedButton(onClick = onMic, enabled = enabled, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)) {
                    Icon(Icons.Filled.Mic, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Mic")
                }
                WorkerChip(workerMode = workerMode, onClick = onWorkerClick)
            }
        }
    }
}

@Composable
fun PermissionStatusCard(
    title: String,
    status: String,
    detail: String,
    icon: String = statusIcon(status),
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    onDetails: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    GlassCard(
        title = title,
        subtitle = detail,
        icon = icon,
        status = status,
        tone = statusToneFor(status),
        modifier = modifier,
        onClick = onDetails,
        actions = {
            if (actionLabel != null && onAction != null) {
                OutlinedButton(onClick = onAction) { Text(actionLabel) }
            }
        }
    )
}

@Composable
fun SubsystemStatusCard(
    title: String,
    status: String,
    detail: String,
    icon: String = statusIcon(status),
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    onDetails: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    PermissionStatusCard(title, status, detail, icon, actionLabel, onAction, onDetails, modifier)
}

@Composable
fun EmptyStateCard(
    title: String,
    detail: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    GlassCard(title = title, subtitle = detail, icon = "AI", status = "Ready", modifier = modifier, actions = {
        if (actionLabel != null && onAction != null) {
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }) {
        AnimatedAssistantOrb(state = AssistantVisualState.IDLE, size = 42.dp)
    }
}

fun statusToneFor(status: String): StatusTone {
    val lower = status.lowercase()
    return when {
        lower.contains("error") || lower.contains("fail") || lower.contains("denied") || lower.contains("rejected") -> StatusTone.ERROR
        lower.contains("approval") || lower.contains("risk") || lower.contains("blocked") -> StatusTone.APPROVAL
        lower.contains("question") || lower.contains("waiting") -> StatusTone.QUESTION
        lower.contains("thinking") || lower.contains("planning") || lower.contains("listening") || lower.contains("speaking") -> StatusTone.THINKING
        lower.contains("tool") || lower.contains("running") || lower.contains("command") -> StatusTone.TOOL
        lower.contains("offline") || lower.contains("missing") || lower.contains("disabled") || lower.contains("not configured") || lower.contains("not installed") -> StatusTone.OFFLINE
        lower.contains("setup") || lower.contains("scaffold") || lower.contains("later") -> StatusTone.SETUP
        lower.contains("ready") || lower.contains("online") || lower.contains("configured") || lower.contains("enabled") || lower.contains("installed") || lower.contains("connected") || lower == "done" -> StatusTone.READY
        else -> StatusTone.NEUTRAL
    }
}

@Composable
fun statusColor(tone: StatusTone): Color {
    return when (tone) {
        StatusTone.READY -> Color(0xFF8DEBD5)
        StatusTone.THINKING -> Color(0xFFC7B9FF)
        StatusTone.TOOL -> Color(0xFF86B7FF)
        StatusTone.APPROVAL -> Color(0xFFFFC86B)
        StatusTone.QUESTION -> Color(0xFFFF9CCB)
        StatusTone.ERROR -> MaterialTheme.colorScheme.error
        StatusTone.OFFLINE -> Color(0xFF9AA4B2)
        StatusTone.SETUP -> Color(0xFFFFD28A)
        StatusTone.NEUTRAL -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

fun visibleReasoningSummary(status: String): String {
    val lower = status.lowercase()
    return when {
        lower.contains("observing screen") || lower.contains("screen") -> "Observing screen"
        lower.contains("asking model") || lower.contains("model") -> "Waiting for model"
        lower.contains("approval") -> "Waiting for approval"
        lower.contains("question") -> "Waiting for your answer"
        lower.contains("command") || lower.contains("shell") -> "Running command"
        lower.contains("file") || lower.contains("workspace") -> "Reading workspace"
        lower.contains("tool") -> "Using tool"
        lower.contains("agent step") || lower.contains("planning") -> "Planning next step"
        lower.contains("queued") -> "Starting"
        else -> status.ifBlank { "Working" }.take(64)
    }
}

private data class ToolEventUi(
    val name: String,
    val success: Boolean,
    val status: String,
    val summary: String,
    val worker: String,
    val exitCode: String,
    val approvalId: String,
    val stepLabel: String
)

private data class DetailUi(
    val tool: String,
    val statusLine: String,
    val summary: String,
    val args: String,
    val output: String,
    val error: String,
    val approval: String,
    val retry: String,
    val logs: String,
    val raw: String
)

private fun toolEventFrom(event: EventEntity): ToolEventUi {
    val json = runCatching { JSONObject(event.payload) }.getOrNull()
    val name = json?.cleanString("tool").orEmpty().ifBlank { event.type }
    val success = json?.optBoolean("success", event.type != "ToolBlocked") ?: (event.type != "ToolBlocked")
    val approvalId = json?.cleanString("approvalId").orEmpty()
    val status = when {
        approvalId.isNotBlank() || event.type == "ToolBlocked" -> "Waiting approval"
        success -> "Done"
        else -> "Error"
    }
    return ToolEventUi(
        name = name,
        success = success,
        status = status,
        summary = json?.cleanString("summary").orEmpty().ifBlank { event.summary },
        worker = json?.cleanString("workerUsed").orEmpty(),
        exitCode = json?.cleanString("exitCode").orEmpty(),
        approvalId = approvalId,
        stepLabel = json?.cleanString("stepLabel").orEmpty()
    )
}

private fun detailsFrom(body: String): DetailUi {
    val json = runCatching { JSONObject(body) }.getOrNull()
    if (json != null) {
        val summary = json.cleanString("summary")
        val success = if (json.has("success")) json.optBoolean("success") else null
        val tool = json.cleanString("tool")
        val worker = json.cleanString("workerUsed")
        val timestamp = json.optLong("timestamp", 0L).takeIf { it > 0L }?.let { DateFormat.format("HH:mm:ss", it).toString() }.orEmpty()
        val args = json.optJSONObject("args")?.toString(2).orEmpty()
        val stdout = json.cleanString("stdout")
        val stderr = json.cleanString("stderr")
        val details = json.cleanString("details")
        val compactDetails = compactDetailsForOutput(details)
        val rawTree = detailsLooksRaw(details)
        val exit = json.cleanString("exitCode")
        val errorType = json.cleanString("errorType")
        val errorMessage = json.cleanString("errorMessage")
        val approvalId = json.cleanString("approvalId")
        return DetailUi(
            tool = tool,
            statusLine = listOfNotNull(
                success?.let { if (it) "Success" else "Needs attention" },
                worker.takeIf { it.isNotBlank() }?.let { "Worker $it" },
                timestamp.takeIf { it.isNotBlank() }?.let { "At $it" }
            ).joinToString(" · ").ifBlank { "Details" },
            summary = buildString {
                appendLine(summary.ifBlank { "No summary." })
                if (tool.isNotBlank()) appendLine("tool: $tool")
                if (worker.isNotBlank()) appendLine("worker: $worker")
                if (timestamp.isNotBlank()) appendLine("timestamp: $timestamp")
            }.trimEnd(),
            args = args,
            output = listOf(
                compactDetails.takeIf { it.isNotBlank() }?.let { "details:\n$it" },
                if (rawTree) "Raw accessibility tree is available under Logs and Raw." else null,
                stdout.takeIf { it.isNotBlank() }?.let { "stdout:\n$it" },
                stderr.takeIf { it.isNotBlank() }?.let { "stderr:\n$it" },
                exit.takeIf { it.isNotBlank() }?.let { "exitCode: $it" }
            ).filterNotNull().joinToString("\n\n"),
            error = listOf(
                errorType.takeIf { it.isNotBlank() }?.let { "errorType: $it" },
                errorMessage.takeIf { it.isNotBlank() }?.let { "errorMessage: $it" }
            ).filterNotNull().joinToString("\n").ifBlank { if (success == false) "Tool did not report a structured error." else "No error reported." },
            approval = approvalId.ifBlank { "No approval linked." },
            retry = "Retry is intentionally not faked here. Re-run the original chat request or use the relevant Developer Test when available.",
            logs = listOf(
                details.takeIf { it.isNotBlank() },
                stdout.takeIf { it.isNotBlank() }?.let { "stdout:\n$it" },
                stderr.takeIf { it.isNotBlank() }?.let { "stderr:\n$it" }
            ).filterNotNull().joinToString("\n\n").ifBlank { "No logs." },
            raw = json.toString(2)
        )
    }
    return DetailUi(
        tool = "",
        statusLine = "Text details",
        summary = compactTextSummary(body),
        args = "",
        output = body.take(8_000),
        error = "",
        approval = "",
        retry = "Retry from the original command, tool card, or Developer Tests.",
        logs = body.take(12_000),
        raw = body
    )
}

private fun detailsLooksRaw(details: String): Boolean {
    return details.contains("\ntree:", ignoreCase = true) ||
        details.lineSequence().any { it.contains("path=0") && it.contains("bounds=") }
}

private fun compactDetailsForOutput(details: String): String {
    if (details.isBlank()) return ""
    val linesBeforeTree = details.lineSequence()
        .takeWhile { it.trim() != "tree:" }
        .take(24)
        .joinToString("\n")
        .trim()
    return if (linesBeforeTree.isNotBlank()) {
        linesBeforeTree
    } else {
        details.lineSequence().take(24).joinToString("\n").take(2_000)
    }
}

private fun compactTextSummary(body: String): String {
    if (body.isBlank()) return "No summary."
    return body.lineSequence()
        .takeWhile { it.trim() != "tree:" }
        .take(12)
        .joinToString("\n")
        .ifBlank { body.lineSequence().take(8).joinToString("\n") }
        .take(1_500)
}

private fun visibleEventText(event: EventEntity): String {
    if (event.type == "TaskFailed") return event.summary.ifBlank { "Task failed." }
    if (event.type == "ApprovalRequested") return event.summary.ifBlank { "Waiting for approval." }
    if (event.type == "QuestionRequested") return event.summary.ifBlank { "Waiting for an answer." }
    if (event.type == "WorkerRoute") return event.summary.ifBlank { "Worker route changed." }
    if (SafeJsonExtractor.isJsonOnly(event.summary)) {
        val json = SafeJsonExtractor.parseObjects(event.summary, maxObjects = 1).firstOrNull()
        val kind = json?.optString("tool", json.optString("type")).orEmpty()
        return if (kind.isNotBlank()) "Tool action prepared: $kind" else "Structured response is available in Details."
    }
    return event.summary.ifBlank { event.type.labelize() }
}

private fun approvalDetails(approval: ApprovalEntity): String {
    return buildString {
        appendLine("action: ${approval.action}")
        appendLine("tool: ${approval.tool}")
        appendLine("target: ${approval.target}")
        appendLine("risk: ${approval.risk}")
        appendLine("reason: ${approval.reason}")
        appendLine("worker: ${approval.worker}")
        appendLine("scope: ${approval.scope.ifBlank { "No grant" }}")
        appendLine("status: ${approval.status}")
        appendLine("createdAt: ${approval.createdAt}")
    }.trimEnd()
}

private fun JSONObject.cleanString(key: String): String {
    if (!has(key) || isNull(key)) return ""
    return optString(key).takeIf { it != "null" }.orEmpty()
}

private fun statusIcon(status: String): String {
    return when (statusToneFor(status)) {
        StatusTone.READY -> "OK"
        StatusTone.THINKING -> "AI"
        StatusTone.TOOL -> "RUN"
        StatusTone.APPROVAL -> "!"
        StatusTone.QUESTION -> "?"
        StatusTone.ERROR -> "ERR"
        StatusTone.OFFLINE -> "OFF"
        StatusTone.SETUP -> "SET"
        StatusTone.NEUTRAL -> "INFO"
    }
}

private fun String.labelize(): String {
    return replace("_", " ")
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .trim()
        .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}
