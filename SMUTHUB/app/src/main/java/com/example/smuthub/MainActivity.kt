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

        // Keys to ALWAYS consume in remote mode (to prevent system conflict)
        val keysToConsume = setOf(
            24, 25, // Volume Up/Down
            19, 20, 21, 22, // DPAD
            23, 66, 62 // Center/Enter/Space
        )

        if (keysToConsume.contains(keyCode)) {
            return true
        }

        return super.dispatchKeyEvent(event)
    }

    override fun dispatchGenericMotionEvent(event: android.view.MotionEvent): Boolean {
        val action = event.action
        val axisX = event.getAxisValue(android.view.MotionEvent.AXIS_X)
        val axisY = event.getAxisValue(android.view.MotionEvent.AXIS_Y)
        val vScroll = event.getAxisValue(android.view.MotionEvent.AXIS_VSCROLL)
        val hScroll = event.getAxisValue(android.view.MotionEvent.AXIS_HSCROLL)

        Log.d(TAG, "Generic Motion: act=$action, X=$axisX, Y=$axisY, V=$vScroll, H=$hScroll")
        
        if (action != android.view.MotionEvent.ACTION_HOVER_MOVE) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Motion: $action (V:$vScroll)", Toast.LENGTH_SHORT).show()
            }
        }
        return super.dispatchGenericMotionEvent(event)
    }

    override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
        // Only log touch down to avoid spam
        if (event.action == android.view.MotionEvent.ACTION_DOWN) {
            Log.d(TAG, "Touch Down at: ${event.x}, ${event.y}")
        }
        return super.dispatchTouchEvent(event)
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
