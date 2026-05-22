package com.kizek.phoneagent.sync

import org.json.JSONArray

class WorkerRegistryClient(
    private val orchestratorClient: OrchestratorClient
) {
    suspend fun listRemoteWorkers(): Result<JSONArray> = orchestratorClient.listWorkers()
}
