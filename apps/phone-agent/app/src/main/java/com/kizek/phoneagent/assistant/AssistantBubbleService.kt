package com.kizek.phoneagent.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat

class AssistantBubbleService : Service() {
    private var windowManager: WindowManager? = null
    private var bubble: TextView? = null
    private var params: WindowManager.LayoutParams? = null
    private var lastX = 0
    private var lastY = 0
    private var touchX = 0f
    private var touchY = 0f

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, notification())
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 180
        }
        bubble = TextView(this).apply {
            text = "PA"
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
            setBackgroundColor(android.graphics.Color.rgb(54, 93, 226))
            setPadding(28, 22, 28, 22)
            setOnClickListener {
                startActivity(
                    Intent(this@AssistantBubbleService, AssistantActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            setOnLongClickListener {
                AssistantManager(this@AssistantBubbleService).hideBubble()
                true
            }
            setOnTouchListener { _, event ->
                val currentParams = params ?: return@setOnTouchListener false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        lastX = currentParams.x
                        lastY = currentParams.y
                        touchX = event.rawX
                        touchY = event.rawY
                        false
                    }
                    MotionEvent.ACTION_MOVE -> {
                        currentParams.x = lastX + (event.rawX - touchX).toInt()
                        currentParams.y = lastY + (event.rawY - touchY).toInt()
                        windowManager?.updateViewLayout(bubble, currentParams)
                        true
                    }
                    else -> false
                }
            }
        }
        windowManager?.addView(bubble, params)
    }

    override fun onDestroy() {
        bubble?.let { view ->
            runCatching { windowManager?.removeView(view) }
        }
        bubble = null
        super.onDestroy()
    }

    private fun notification(): Notification {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Assistant bubble", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Phone Agent bubble")
            .setContentText("Visible assistant bubble is active. Long press the bubble to hide it.")
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "phone_agent_bubble"
        private const val NOTIFICATION_ID = 4343
    }
}
