package com.kizek.phoneagent.core

import com.kizek.phoneagent.models.ModelMessage
import com.kizek.phoneagent.models.ModelRouter

class LocalAgentWorker(
    private val modelRouter: ModelRouter
) {
    suspend fun respond(prompt: String): String {
        return respond(
            listOf(
                ModelMessage(
                    role = "system",
                    content = "You are the phone-local worker for Phone Agent. Be concise and only claim capabilities that are installed."
                ),
                ModelMessage(role = "user", content = prompt)
            )
        )
    }

    suspend fun respond(messages: List<ModelMessage>): String {
        val request = if (messages.any { it.role == "system" }) messages else listOf(
            ModelMessage(
                role = "system",
                content = "You are the phone-local worker for Phone Agent. Be concise and only claim capabilities that are installed."
            )
        ) + messages
        return modelRouter.chat(request).fold(
            onSuccess = { it.content },
            onFailure = {
                it.message ?: "MODEL_ERROR_CLASS=unknown Model chat failed. Local phone commands still work."
            }
        )
    }
}
