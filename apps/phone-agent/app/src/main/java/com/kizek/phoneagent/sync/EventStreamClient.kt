package com.kizek.phoneagent.sync

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class EventStreamClient(
    private val pairingManager: PairingManager,
    private val client: OkHttpClient = OkHttpClient()
) {
    private var socket: WebSocket? = null

    fun connect(
        onEvent: (JSONObject) -> Unit,
        onState: (String) -> Unit
    ) {
        disconnect()
        val wsUrl = pairingManager.orchestratorUrl
            .replaceFirst("https://", "wss://")
            .replaceFirst("http://", "ws://") + "/events"
        val request = Request.Builder().url(wsUrl).build()
        socket = client.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    onState("connected")
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    runCatching { JSONObject(text) }.onSuccess(onEvent)
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    onState("offline: ${t.message ?: "event stream failed"}")
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    onState("closed: $code $reason")
                }
            }
        )
    }

    fun disconnect() {
        socket?.close(1000, "Phone Agent closing")
        socket = null
    }
}
