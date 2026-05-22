package com.kizek.phoneagent.sync

class SessionApi(
    private val orchestratorClient: OrchestratorClient
) {
    suspend fun refreshSessions(): Result<List<RemoteSessionSummary>> {
        return orchestratorClient.listSessions()
    }

    suspend fun createRemoteSession(): Result<RemoteSessionSummary> {
        return orchestratorClient.createSession()
    }

    suspend fun send(sessionId: String, prompt: String, mode: String): Result<String> {
        return orchestratorClient.sendMessage(sessionId, prompt, mode)
    }
}
