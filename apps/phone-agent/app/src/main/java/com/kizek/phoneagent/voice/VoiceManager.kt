package com.kizek.phoneagent.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.UUID

data class VoiceStatus(
    val voiceEnabled: Boolean,
    val sttProvider: String,
    val ttsProvider: String,
    val speechRecognizerAvailable: Boolean,
    val micPermissionGranted: Boolean,
    val ttsReady: Boolean,
    val speaking: Boolean,
    val listening: Boolean,
    val autoSendTranscript: Boolean,
    val detail: String
)

class VoiceManager(context: Context) {
    private val context = context.applicationContext
    private val prefs = context.getSharedPreferences("phone_agent_voice", Context.MODE_PRIVATE)
    private val handler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var speaking = false
    private var listening = false

    init {
        handler.post {
            tts = TextToSpeech(context) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    tts?.language = Locale.getDefault()
                    tts?.setSpeechRate(speechRate)
                    tts?.setPitch(speechPitch)
                }
            }
        }
    }

    var voiceEnabled: Boolean
        get() = prefs.getBoolean(KEY_VOICE_ENABLED, true)
        set(value) {
            prefs.edit().putBoolean(KEY_VOICE_ENABLED, value).apply()
        }

    var speakAssistantReplies: Boolean
        get() = prefs.getBoolean(KEY_SPEAK_REPLIES, false)
        set(value) {
            prefs.edit().putBoolean(KEY_SPEAK_REPLIES, value).apply()
        }

    var autoSendTranscript: Boolean
        get() = prefs.getBoolean(KEY_AUTO_SEND, false)
        set(value) {
            prefs.edit().putBoolean(KEY_AUTO_SEND, value).apply()
        }

    var sttProvider: String
        get() = prefs.getString(KEY_STT_PROVIDER, PROVIDER_ANDROID_STT) ?: PROVIDER_ANDROID_STT
        set(value) {
            prefs.edit().putString(KEY_STT_PROVIDER, value).apply()
        }

    var ttsProvider: String
        get() = prefs.getString(KEY_TTS_PROVIDER, PROVIDER_ANDROID_TTS) ?: PROVIDER_ANDROID_TTS
        set(value) {
            prefs.edit().putString(KEY_TTS_PROVIDER, value).apply()
        }

    var customSttEndpoint: String
        get() = prefs.getString(KEY_CUSTOM_STT, "").orEmpty()
        set(value) {
            prefs.edit().putString(KEY_CUSTOM_STT, value).apply()
        }

    var customTtsEndpoint: String
        get() = prefs.getString(KEY_CUSTOM_TTS, "").orEmpty()
        set(value) {
            prefs.edit().putString(KEY_CUSTOM_TTS, value).apply()
        }

    var speechRate: Float
        get() = prefs.getFloat(KEY_RATE, 1.0f)
        set(value) {
            prefs.edit().putFloat(KEY_RATE, value.coerceIn(0.5f, 1.8f)).apply()
            tts?.setSpeechRate(value.coerceIn(0.5f, 1.8f))
        }

    var speechPitch: Float
        get() = prefs.getFloat(KEY_PITCH, 1.0f)
        set(value) {
            prefs.edit().putFloat(KEY_PITCH, value.coerceIn(0.5f, 1.8f)).apply()
            tts?.setPitch(value.coerceIn(0.5f, 1.8f))
        }

    fun status(): VoiceStatus {
        val recognizerAvailable = SpeechRecognizer.isRecognitionAvailable(context)
        val micPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val sttDetail = when (sttProvider) {
            PROVIDER_ANDROID_STT -> if (recognizerAvailable) "Android SpeechRecognizer available." else "Android SpeechRecognizer is not available on this device."
            PROVIDER_CUSTOM -> if (customSttEndpoint.isBlank()) "Custom STT endpoint is not configured." else "Custom STT endpoint configured."
            PROVIDER_MISTRAL -> "Mistral STT is not wired because no verified Mistral audio endpoint is implemented in this app."
            else -> "Unknown STT provider."
        }
        val ttsDetail = when (ttsProvider) {
            PROVIDER_ANDROID_TTS -> if (ttsReady) "Android TextToSpeech ready." else "Android TextToSpeech is initializing or unavailable."
            PROVIDER_CUSTOM -> if (customTtsEndpoint.isBlank()) "Custom TTS endpoint is not configured." else "Custom TTS endpoint configured."
            PROVIDER_MISTRAL -> "Mistral TTS is not wired because no verified Mistral audio endpoint is implemented in this app."
            else -> "Unknown TTS provider."
        }
        return VoiceStatus(
            voiceEnabled = voiceEnabled,
            sttProvider = sttProvider,
            ttsProvider = ttsProvider,
            speechRecognizerAvailable = recognizerAvailable,
            micPermissionGranted = micPermission,
            ttsReady = ttsReady,
            speaking = speaking,
            listening = listening,
            autoSendTranscript = autoSendTranscript,
            detail = "$sttDetail $ttsDetail"
        )
    }

    fun setProviders(stt: String, tts: String) {
        sttProvider = stt
        ttsProvider = tts
    }

    fun transcribeOnce(
        onPartial: (String) -> Unit,
        onFinal: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!voiceEnabled) {
            onError("Voice mode is disabled in Settings > Voice.")
            return
        }
        if (sttProvider != PROVIDER_ANDROID_STT) {
            onError("STT provider \"$sttProvider\" is not implemented as a local Android one-shot recognizer.")
            return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            onError("Microphone permission is not granted.")
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Android SpeechRecognizer is not available on this device.")
            return
        }
        handler.post {
            stopListening()
            val current = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer = current
            listening = true
            current.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() {
                    listening = false
                }

                override fun onError(error: Int) {
                    listening = false
                    recognizer?.destroy()
                    recognizer = null
                    onError("Speech recognition failed: ${errorName(error)}")
                }

                override fun onResults(results: Bundle?) {
                    listening = false
                    val text = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        .orEmpty()
                    recognizer?.destroy()
                    recognizer = null
                    if (text.isBlank()) onError("Speech recognition returned no transcript.") else onFinal(text)
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        ?.takeIf { it.isNotBlank() }
                        ?.let(onPartial)
                }

                override fun onEvent(eventType: Int, params: Bundle?) = Unit
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            current.startListening(intent)
        }
    }

    fun stopListening() {
        handler.post {
            listening = false
            recognizer?.stopListening()
            recognizer?.destroy()
            recognizer = null
        }
    }

    fun speak(text: String): String {
        if (!voiceEnabled) return "Voice mode is disabled."
        if (ttsProvider != PROVIDER_ANDROID_TTS) {
            return "TTS provider \"$ttsProvider\" is not implemented locally. Configure Android TextToSpeech or a custom endpoint."
        }
        if (!ttsReady) return "Android TextToSpeech is not ready yet."
        val trimmed = text.trim()
        if (trimmed.isBlank()) return "No text was provided for speech."
        speaking = true
        tts?.speak(trimmed.take(4_000), TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
        return "Speaking with Android TextToSpeech."
    }

    fun speakAssistantReply(text: String) {
        if (speakAssistantReplies) {
            speak(text)
        }
    }

    fun stopSpeaking() {
        speaking = false
        tts?.stop()
    }

    fun voiceNames(): List<String> {
        return tts?.voices?.map { it.name }?.sorted().orEmpty()
    }

    private fun errorName(error: Int): String {
        return when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "audio error"
            SpeechRecognizer.ERROR_CLIENT -> "client error"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "insufficient permissions"
            SpeechRecognizer.ERROR_NETWORK -> "network error"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network timeout"
            SpeechRecognizer.ERROR_NO_MATCH -> "no match"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "recognizer busy"
            SpeechRecognizer.ERROR_SERVER -> "server error"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speech timeout"
            else -> "code $error"
        }
    }

    companion object {
        const val PROVIDER_ANDROID_STT = "android_speech_recognizer"
        const val PROVIDER_ANDROID_TTS = "android_text_to_speech"
        const val PROVIDER_CUSTOM = "custom_api"
        const val PROVIDER_MISTRAL = "mistral_audio_unavailable"

        private const val KEY_VOICE_ENABLED = "voice_enabled"
        private const val KEY_SPEAK_REPLIES = "speak_replies"
        private const val KEY_AUTO_SEND = "auto_send"
        private const val KEY_STT_PROVIDER = "stt_provider"
        private const val KEY_TTS_PROVIDER = "tts_provider"
        private const val KEY_CUSTOM_STT = "custom_stt_endpoint"
        private const val KEY_CUSTOM_TTS = "custom_tts_endpoint"
        private const val KEY_RATE = "speech_rate"
        private const val KEY_PITCH = "speech_pitch"
    }
}
