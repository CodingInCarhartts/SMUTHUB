package com.example.smuthub.modules

import android.content.Context
import android.widget.Toast
import com.lynx.jsbridge.LynxModule
import com.lynx.jsbridge.LynxMethod

class NativeToastModule(private val context: Context) : LynxModule(context) {

    @LynxMethod
    fun show(message: String, duration: Int) {
        val toastDuration = if (duration == 1) Toast.LENGTH_LONG else Toast.LENGTH_SHORT
        Toast.makeText(context, message, toastDuration).show()
    }
}
