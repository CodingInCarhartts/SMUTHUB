package com.example.smuthub.modules

import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.view.View
import com.lynx.jsbridge.LynxModule
import com.lynx.jsbridge.LynxMethod

class NativeUIModule(private val context: Context) : LynxModule(context) {

    @LynxMethod
    fun setImmersiveMode(enabled: Boolean) {
        val activity = context as? Activity ?: return
        activity.runOnUiThread {
            val decorView = activity.window.decorView
            if (enabled) {
                decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_FULLSCREEN)
            } else {
                decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
            }
        }
    }

    @LynxMethod
    fun setBrightness(brightness: Float) {
        val activity = context as? Activity ?: return
        activity.runOnUiThread {
            val layoutParams = activity.window.attributes
            layoutParams.screenBrightness = brightness.coerceAtLeast(0.0f).coerceAtMost(1.0f)
            activity.window.attributes = layoutParams
        }
    }

    @LynxMethod
    fun setOrientation(orientation: String) {
        val activity = context as? Activity ?: return
        activity.runOnUiThread {
            when (orientation.lowercase()) {
                "portrait" -> activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                "landscape" -> activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                "sensor" -> activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR
                else -> activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
    }
}
