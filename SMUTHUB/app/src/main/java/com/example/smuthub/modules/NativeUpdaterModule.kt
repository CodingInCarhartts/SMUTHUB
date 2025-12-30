package com.example.smuthub.modules

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.core.content.FileProvider
import com.lynx.jsbridge.LynxModule
import com.lynx.jsbridge.LynxMethod
import java.io.File

class NativeUpdaterModule(private val context: Context) : LynxModule(context) {

    private val TAG = "NativeUpdaterModule"

    @LynxMethod
    fun getNativeVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    @LynxMethod
    fun setOtaUrl(url: String) {
        Log.d(TAG, "Setting OTA URL to: $url")
        val prefs = context.getSharedPreferences("smuthub_ota", Context.MODE_PRIVATE)
        prefs.edit().putString("current_bundle_url", url).apply()
    }

    @LynxMethod
    fun triggerOtaReload() {
        Log.d(TAG, "Triggering OTA Reload broadcast")
        val intent = Intent("${context.packageName}.RELOAD_BUNDLE")
        intent.setPackage(context.packageName)
        context.sendBroadcast(intent)
    }

    @LynxMethod
    fun clearOta() {
        Log.d(TAG, "Clearing OTA settings")
        val prefs = context.getSharedPreferences("smuthub_ota", Context.MODE_PRIVATE)
        prefs.edit().remove("current_bundle_url").apply()
    }

    @LynxMethod
    fun installUpdate(url: String) {
        Log.d(TAG, "Starting installUpdate from URL: $url")
        
        try {
            val dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val oldFile = File(dlDir, "smuthub-update.apk")
            if (oldFile.exists()) {
                oldFile.delete()
                Log.d(TAG, "Deleted old update file")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up old file: ${e.message}")
        }

        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("SmutHub Update")
            .setDescription("Version update in progress...")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "smuthub-update.apk")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = manager.enqueue(request)
        Log.d(TAG, "Download enqueued with ID: $downloadId")

        val onComplete = object : BroadcastReceiver() {
            override fun onReceive(ctxt: Context, intent: Intent) {
                val downloadedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (downloadedId == downloadId) {
                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor = manager.query(query)
                    if (cursor.moveToFirst()) {
                        val status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS))
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            val dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            val file = File(dlDir, "smuthub-update.apk")
                            if (file.exists() && file.length() > 1000) {
                                installAPK(file)
                            }
                        }
                    }
                    cursor.close()
                    try {
                        context.unregisterReceiver(this)
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
            }
        }

        registerResilientReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
    }

    private fun registerResilientReceiver(receiver: BroadcastReceiver, filter: IntentFilter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } catch (e: SecurityException) {
                try {
                    context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
                } catch (e2: Exception) {
                    context.registerReceiver(receiver, filter)
                }
            }
        } else {
            context.registerReceiver(receiver, filter)
        }
    }

    private fun installAPK(file: File) {
        Log.d(TAG, "installAPK called for file: ${file.absolutePath}")
        try {
            val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start installation: ${e.message}", e)
        }
    }
}
