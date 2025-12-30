package com.example.smuthub.modules

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import android.app.Activity
import com.lynx.jsbridge.LynxModule
import com.lynx.jsbridge.LynxMethod

class NativeHapticModule(private val context: Context) : LynxModule(context) {

    @LynxMethod
    fun vibrate(effect: String) {
        val activity = context as? Activity ?: return
        activity.runOnUiThread {
            val view = activity.window.decorView
            when (effect.lowercase()) {
                "light" -> view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                "medium" -> view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                "heavy" -> view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                "success" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                    } else {
                        view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    }
                }
                "error" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        view.performHapticFeedback(HapticFeedbackConstants.REJECT)
                    } else {
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    }
                }
            }
        }
    }
}
