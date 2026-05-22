package com.kizek.phoneagent.tools

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.io.File

class ScreenCaptureForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var projection: MediaProjection? = null
    private var imageReader: ImageReader? = null
    private var virtualDisplay: android.hardware.display.VirtualDisplay? = null
    private var releasing = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            recordError("Screen capture stopped by user.")
            stopSelf(startId)
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, notification("Screen capture active"))
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        val data = if (Build.VERSION.SDK_INT >= 33) {
            intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent?.getParcelableExtra(EXTRA_RESULT_DATA)
        }
        if (resultCode == 0 || data == null) {
            recordError("MediaProjection permission data was missing.")
            stopSelf(startId)
            return START_NOT_STICKY
        }
        capture(resultCode, data, startId)
        return START_NOT_STICKY
    }

    private fun capture(resultCode: Int, data: Intent, startId: Int) {
        runCatching {
            prefs().edit().putBoolean(ScreenCaptureManager.KEY_ACTIVE, true).apply()
            val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            projection = manager.getMediaProjection(resultCode, data)
            val metrics = if (Build.VERSION.SDK_INT >= 30) {
                val bounds = getSystemService(WindowManager::class.java).currentWindowMetrics.bounds
                Triple(bounds.width().coerceAtLeast(1), bounds.height().coerceAtLeast(1), resources.displayMetrics.densityDpi)
            } else {
                @Suppress("DEPRECATION")
                Triple(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels, resources.displayMetrics.densityDpi)
            }
            imageReader = ImageReader.newInstance(metrics.first, metrics.second, PixelFormat.RGBA_8888, 2)
            projection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    release()
                }
            }, handler)
            virtualDisplay = projection?.createVirtualDisplay(
                "PhoneAgentScreenshot",
                metrics.first,
                metrics.second,
                metrics.third,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                handler
            )
            handler.postDelayed({
                saveLatestImage(metrics.first, metrics.second)
                stopSelf(startId)
            }, 650)
        }.onFailure { error ->
            recordError("Screenshot capture failed: ${error.message}")
            stopSelf(startId)
        }
    }

    private fun saveLatestImage(expectedWidth: Int, expectedHeight: Int) {
        val reader = imageReader ?: return recordError("ImageReader was not available.")
        val image = reader.acquireLatestImage() ?: return recordError("No screenshot frame was produced.")
        image.use { current ->
            val plane = current.planes.firstOrNull() ?: return recordError("Screenshot frame had no image plane.")
            val pixelStride = plane.pixelStride
            val rowStride = plane.rowStride
            val rowPadding = rowStride - pixelStride * expectedWidth
            val paddedWidth = expectedWidth + rowPadding / pixelStride
            val padded = Bitmap.createBitmap(paddedWidth, expectedHeight, Bitmap.Config.ARGB_8888)
            padded.copyPixelsFromBuffer(plane.buffer)
            val bitmap = Bitmap.createBitmap(padded, 0, 0, expectedWidth, expectedHeight)
            val dir = File(cacheDir, "screenshots").apply { mkdirs() }
            val file = File(dir, "screen-${System.currentTimeMillis()}.png")
            file.outputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output) }
            prefs().edit()
                .putBoolean(ScreenCaptureManager.KEY_CONFIGURED, true)
                .putBoolean(ScreenCaptureManager.KEY_ACTIVE, false)
                .putString(ScreenCaptureManager.KEY_LAST_PATH, file.absolutePath)
                .putInt(ScreenCaptureManager.KEY_WIDTH, expectedWidth)
                .putInt(ScreenCaptureManager.KEY_HEIGHT, expectedHeight)
                .putLong(ScreenCaptureManager.KEY_TIMESTAMP, System.currentTimeMillis())
                .remove(ScreenCaptureManager.KEY_LAST_ERROR)
                .apply()
        }
        release()
    }

    private fun recordError(message: String) {
        prefs().edit()
            .putBoolean(ScreenCaptureManager.KEY_ACTIVE, false)
            .putString(ScreenCaptureManager.KEY_LAST_ERROR, message)
            .apply()
        release()
    }

    private fun release() {
        if (releasing) return
        releasing = true
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        projection?.stop()
        projection = null
        prefs().edit().putBoolean(ScreenCaptureManager.KEY_ACTIVE, false).apply()
        releasing = false
    }

    private fun notification(text: String): android.app.Notification {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Screen capture", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Phone Agent")
            .setContentText(text)
            .setOngoing(true)
            .build()
    }

    private fun prefs() = getSharedPreferences("phone_agent_screen_capture", MODE_PRIVATE)

    companion object {
        const val ACTION_STOP = "com.kizek.phoneagent.STOP_SCREEN_CAPTURE"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        private const val CHANNEL_ID = "phone_agent_screen_capture"
        private const val NOTIFICATION_ID = 4242
    }
}
