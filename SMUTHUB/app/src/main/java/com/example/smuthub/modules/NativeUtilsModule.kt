package com.example.smuthub.modules

import android.app.Activity
import android.app.ActivityManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Debug
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

    /**
     * Get battery status: percentage and charging state
     * Returns JSON string: {"level": 85, "isCharging": true, "temperature": 30.5}
     */
    @LynxMethod
    fun getBatteryStatus(callback: Callback) {
        try {
            val batteryIntent = getContext().registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            
            val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val percentage = if (level >= 0 && scale > 0) (level * 100) / scale else -1
            
            val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || 
                             status == BatteryManager.BATTERY_STATUS_FULL
            
            val temperature = (batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0
            
            val result = """{"level":$percentage,"isCharging":$isCharging,"temperature":$temperature}"""
            Log.d(TAG, "getBatteryStatus: $result")
            callback.invoke(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting battery status: ${e.message}")
            callback.invoke("""{"level":-1,"isCharging":false,"temperature":0}""")
        }
    }

    /**
     * Get memory info: app memory usage
     * Returns JSON string: {"usedMb": 128.5, "totalMb": 256.0, "heapMb": 64.2}
     */
    @LynxMethod
    fun getMemoryInfo(callback: Callback) {
        try {
            val runtime = Runtime.getRuntime()
            val usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / (1024.0 * 1024.0)
            val maxMemory = runtime.maxMemory() / (1024.0 * 1024.0)
            
            val memoryInfo = Debug.MemoryInfo()
            Debug.getMemoryInfo(memoryInfo)
            val totalPss = memoryInfo.totalPss / 1024.0 // KB to MB
            
            val result = """{"usedMb":${"%.2f".format(usedMemory)},"maxMb":${"%.2f".format(maxMemory)},"pssMb":${"%.2f".format(totalPss)}}"""
            Log.d(TAG, "getMemoryInfo: $result")
            callback.invoke(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting memory info: ${e.message}")
            callback.invoke("""{"usedMb":0,"maxMb":0,"pssMb":0}""")
        }
    }
}
