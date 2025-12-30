package com.example.smuthub.modules

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.lynx.jsbridge.LynxModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.tasm.behavior.LynxContext
import com.lynx.react.bridge.Callback
import java.util.UUID
import kotlin.system.exitProcess

class NativeUtilsModule(context: Context) : LynxModule(context) {

    private val TAG = "NativeUtilsModule"

    private fun getContext(): Context {
        return (mContext as LynxContext).context
    }

    @LynxMethod
    fun copyToClipboard(text: String) {
        val clipboard = getContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("smuthub", text)
        clipboard.setPrimaryClip(clip)
    }

    @LynxMethod
    fun shareText(text: String, title: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            putExtra(Intent.EXTRA_TITLE, title)
        }
        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        getContext().startActivity(chooser)
    }

    @LynxMethod
    fun getDeviceId(callback: Callback) {
        try {
            val androidId = Settings.Secure.getString(getContext().contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
            // Convert to stable UUID format
            val stableUuid = UUID.nameUUIDFromBytes(androidId.toByteArray()).toString()
            Log.d(TAG, "getDeviceId returning stable UUID: $stableUuid (from $androidId)")
            callback.invoke(stableUuid)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting device ID: ${e.message}")
            callback.invoke("")
        }
    }

    @LynxMethod
    fun exitApp() {
        val activity = getContext() as? Activity
        activity?.runOnUiThread {
            activity.finishAffinity()
            exitProcess(0)
        } ?: run {
            exitProcess(0)
        }
    }
}
