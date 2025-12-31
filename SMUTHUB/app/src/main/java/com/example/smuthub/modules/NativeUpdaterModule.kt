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
        
        val fileName = "smuthub-update.apk"
        
        // Clean up old update if possible
        try {
            val oldFile = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fileName)
            if (oldFile.exists()) {
                val deleted = oldFile.delete()
                Log.d(TAG, "Old update file found and deleted: $deleted")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up old file: ${e.message}")
        }

        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("SmutHub Update")
            .setDescription("Downloading version update...")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = try {
            manager.enqueue(request)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enqueue download: ${e.message}")
            return
        }
        
        Log.d(TAG, "Download enqueued with ID: $downloadId")

        val onComplete = object : BroadcastReceiver() {
            override fun onReceive(ctxt: Context, intent: Intent) {
                val downloadedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (downloadedId == downloadId) {
                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor = manager.query(query)
                    if (cursor != null && cursor.moveToFirst()) {
                        val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                        val status = if (statusIdx != -1) cursor.getInt(statusIdx) else -1
                        
                        Log.d(TAG, "Download status for $downloadId: $status")
                        
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            val uri = manager.getUriForDownloadedFile(downloadId)
                            if (uri != null) {
                                installAPK(uri)
                            } else {
                                Log.e(TAG, "Download successful but URI is null")
                            }
                        } else {
                            val reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)
                            val reason = if (reasonIdx != -1) cursor.getInt(reasonIdx) else -1
                            Log.e(TAG, "Download failed with status $status, reason: $reason")
                        }
                        cursor.close()
                    }
                    
                    try {
                        context.unregisterReceiver(this)
                    } catch (e: Exception) {
                        // Already unregistered or other issue
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

    private fun installAPK(uri: Uri) {
        Log.d(TAG, "installAPK called for URI: $uri")
        try {
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
