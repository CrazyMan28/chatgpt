package com.kizek.phoneagent.tools

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context

class ClipboardTools(private val context: Context) {
    private val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    fun readText(): String = clipboard.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()

    fun writeText(text: String) {
        clipboard.setPrimaryClip(ClipData.newPlainText("Phone Agent", text))
    }
}
