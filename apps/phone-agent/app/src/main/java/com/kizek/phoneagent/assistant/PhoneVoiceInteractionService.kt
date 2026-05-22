package com.kizek.phoneagent.assistant

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class PhoneVoiceInteractionService : VoiceInteractionService()

class PhoneVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return PhoneVoiceInteractionSession(this)
    }
}

class PhoneVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        context.startActivity(
            Intent(context, AssistantActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(AssistantActivity.EXTRA_INITIAL_TEXT, args?.getString("query").orEmpty())
        )
    }
}
