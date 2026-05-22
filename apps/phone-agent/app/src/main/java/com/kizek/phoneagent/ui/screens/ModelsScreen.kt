package com.kizek.phoneagent.ui.screens

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.models.ModelProviderState
import com.kizek.phoneagent.models.ModelRoute
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import kotlinx.coroutines.launch

@Composable
fun ModelsScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var apiKey by remember { mutableStateOf("") }
    var model by remember { mutableStateOf(app.modelRouter.selectedMistralModel) }
    var customModel by remember { mutableStateOf("") }
    var visionModel by remember { mutableStateOf(app.modelRouter.mistral.selectedVisionModel) }
    var status by remember { mutableStateOf("") }
    var states by remember { mutableStateOf<List<ModelProviderState>>(emptyList()) }
    var localModels by remember { mutableStateOf(app.localModelManager.listModels()) }
    fun refresh() {
        scope.launch { states = app.modelRouter.states() }
    }
    val importModelLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            app.localModelManager.importModel(uri)
            localModels = app.localModelManager.listModels()
            refresh()
        }
    }
    LaunchedEffect(Unit) { states = app.modelRouter.states() }
    AppBackground(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GlassCard(title = "Models", subtitle = "Mistral, local model files, remote routing, and hybrid selection.", icon = "AI", status = app.modelRouter.selectedRoute.name) {
            StatusPill("Selected route: ${app.modelRouter.selectedRoute}")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ModelRoute.entries.forEach { route ->
                FilterChip(
                    selected = app.modelRouter.selectedRoute == route,
                    onClick = {
                        app.modelRouter.selectedRoute = route
                        refresh()
                    },
                    label = { Text(route.name.lowercase()) }
                )
            }
        }
        OutlinedTextField(
            value = apiKey,
            onValueChange = { apiKey = it },
            label = { Text("Mistral API key") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            app.modelRouter.mistral.modelOptions.forEach { option ->
                FilterChip(
                    selected = model == option,
                    onClick = {
                        model = option
                        app.modelRouter.selectedMistralModel = option
                        refresh()
                    },
                    label = { Text(option.removeSuffix("-latest")) }
                )
            }
        }
        OutlinedTextField(
            value = customModel,
            onValueChange = {
                customModel = it
                if (it.isNotBlank()) {
                    model = it
                    app.modelRouter.selectedMistralModel = it
                }
            },
            label = { Text("Custom Mistral model") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = visionModel,
            onValueChange = {
                visionModel = it
                app.modelRouter.mistral.selectedVisionModel = it
            },
            label = { Text("Optional vision model (not auto-uploaded)") },
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                enabled = apiKey.isNotBlank(),
                onClick = {
                    app.modelRouter.selectedMistralModel = model
                    app.modelRouter.mistral.saveApiKey(apiKey)
                    apiKey = ""
                    status = "Mistral key saved."
                    refresh()
                }
            ) { Text("Save key") }
            OutlinedButton(onClick = {
                scope.launch {
                    status = app.modelRouter.mistral.testConnection(model).fold(
                        onSuccess = { it },
                        onFailure = { "Mistral test failed: ${it.message}" }
                    )
                    refresh()
                }
            }) { Text("Test") }
            OutlinedButton(onClick = {
                app.modelRouter.mistral.removeApiKey()
                status = "Mistral key removed."
                refresh()
            }) { Text("Remove") }
            OutlinedButton(onClick = { refresh() }) { Text("Refresh") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { importModelLauncher.launch(arrayOf("*/*")) }) { Text("Import local model") }
            OutlinedButton(onClick = {
                localModels = app.localModelManager.listModels()
                status = "Local runtime is not installed; model files are tracked only."
            }) { Text("Local status") }
        }
        if (status.isNotBlank()) {
            Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(localModels, key = { it.uri }) { record ->
                GlassCard(
                    title = record.name,
                    subtitle = if (record.active) "Active local model file; runtime not installed" else "Imported local model file",
                    icon = "LOCAL",
                    status = if (record.active) "Active" else "Imported",
                    actions = {
                        OutlinedButton(onClick = {
                                app.localModelManager.setActive(record.uri)
                                localModels = app.localModelManager.listModels()
                                refresh()
                            }) { Text("Set active") }
                            OutlinedButton(onClick = {
                                app.localModelManager.deleteModel(record.uri)
                                localModels = app.localModelManager.listModels()
                                refresh()
                            }) { Text("Delete") }
                    }
                ) {
                    }
            }
            items(states, key = { it.id }) { state ->
                GlassCard(
                    title = state.label,
                    subtitle = state.detail,
                    icon = "AI",
                    status = if (state.available) "Available" else "Setup needed"
                ) {
                    Text(state.selectedModel, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        }
    }
}
