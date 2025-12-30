package com.example.smuthub

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.provider.AbsTemplateProvider
import com.lynx.xelement.XElementBehaviors
import java.io.InputStream
import java.net.URL

class MainActivity : AppCompatActivity() {
    private val TAG = "SMUTHUB"
    private var lynxView: LynxView? = null
    
    private val reloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.i(TAG, "Reload signal received, re-rendering template...")
            renderTemplate()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val viewBuilder = LynxViewBuilder()
        
        // Add XElement behaviors for advanced UI components
        viewBuilder.addBehaviors(XElementBehaviors().create())
        
        // Provisioning a simple provider for remote/asset loading
        viewBuilder.setTemplateProvider(object : AbsTemplateProvider() {
            override fun loadTemplate(url: String, callback: Callback) {
                Log.d(TAG, "Attempting to load template from: $url")
                if (url.startsWith("http")) {
                    Thread {
                        try {
                            val connection = URL(url).openConnection()
                            connection.connectTimeout = 10000
                            connection.readTimeout = 10000
                            val inputStream = connection.getInputStream()
                            val bytes = inputStream.readBytes()
                            Log.d(TAG, "Successfully downloaded bundle: ${bytes.size} bytes")
                            callback.onSuccess(bytes)
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to download bundle: ${e.message}")
                            runOnUiThread {
                                Toast.makeText(this@MainActivity, "Load Failed: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                            callback.onFailed(e.message)
                        }
                    }.start()
                } else {
                    try {
                        val inputStream = assets.open(url)
                        val bytes = inputStream.readBytes()
                        Log.d(TAG, "Successfully loaded bundle from assets (size: ${bytes.size})")
                        callback.onSuccess(bytes)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to load from assets: ${e.message}")
                        callback.onFailed(e.message)
                    }
                }
            }
        })
        
        lynxView = viewBuilder.build(this)
        setContentView(lynxView)
        
        renderTemplate()
        
        // Register reload receiver
        val filter = IntentFilter("${packageName}.RELOAD_BUNDLE")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(reloadReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(reloadReceiver, filter)
        }
    }

    private fun renderTemplate() {
        val prefs = getSharedPreferences("smuthub_ota", Context.MODE_PRIVATE)
        val bundleUrl = prefs.getString("current_bundle_url", "main.lynx.bundle") ?: "main.lynx.bundle"
        
        Log.i(TAG, "Rendering template: $bundleUrl")
        runOnUiThread {
            lynxView?.renderTemplateUrl(bundleUrl, "")
        }
    }

    override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
        val keyCode = event.keyCode
        val action = event.action

        if (action == android.view.KeyEvent.ACTION_DOWN) {
            Log.d(TAG, "Any KeyDown: $keyCode")
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Key: $keyCode", Toast.LENGTH_SHORT).show()
            }
            
            val map = com.lynx.react.bridge.JavaOnlyMap()
            map.putInt("keyCode", keyCode)
            
            val array = com.lynx.react.bridge.JavaOnlyArray()
            array.pushMap(map)
            
            lynxView?.sendGlobalEvent("GlobalKeyEvent", array)
        }

        // Only consume specific keys to avoid breaking system navigation entirely
        val keysToConsume = setOf(
            android.view.KeyEvent.KEYCODE_VOLUME_UP,
            android.view.KeyEvent.KEYCODE_VOLUME_DOWN,
            android.view.KeyEvent.KEYCODE_DPAD_UP,
            android.view.KeyEvent.KEYCODE_DPAD_DOWN,
            android.view.KeyEvent.KEYCODE_DPAD_LEFT,
            android.view.KeyEvent.KEYCODE_DPAD_RIGHT,
            android.view.KeyEvent.KEYCODE_DPAD_CENTER,
            android.view.KeyEvent.KEYCODE_ENTER,
            android.view.KeyEvent.KEYCODE_SPACE
        )

        if (keysToConsume.contains(keyCode)) {
            return true
        }

        return super.dispatchKeyEvent(event)
    }

    override fun dispatchGenericMotionEvent(event: android.view.MotionEvent): Boolean {
        Log.d(TAG, "Generic Motion: ${event.action}")
        runOnUiThread {
          Toast.makeText(this@MainActivity, "Motion: ${event.action}", Toast.LENGTH_SHORT).show()
        }
        return super.dispatchGenericMotionEvent(event)
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(reloadReceiver)
        } catch (e: Exception) {
            // Ignore
        }
    }
}
