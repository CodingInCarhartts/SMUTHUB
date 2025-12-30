package com.example.smuthub.modules

import android.content.Context
import android.content.SharedPreferences
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.tasm.behavior.LynxContext
import com.lynx.react.bridge.Callback

/**
 * Native module for persistent local storage using Android SharedPreferences.
 * This provides localStorage-like functionality for the Lynx JavaScript runtime.
 */
class NativeLocalStorageModule(context: Context) : LynxModule(context) {
    
    companion object {
        private const val PREF_NAME = "SmutHubStorage"
    }
    
    private fun getContext(): Context {
        return (mContext as LynxContext).context
    }
    
    private fun getPrefs(): SharedPreferences {
        return getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }
    
    @LynxMethod
    fun setStorageItem(key: String, value: String) {
        getPrefs().edit().putString(key, value).apply()
    }
    
    @LynxMethod
    fun getStorageItem(key: String, callback: Callback) {
        val value = getPrefs().getString(key, null)
        callback.invoke(value)
    }
    
    @LynxMethod
    fun clearStorage() {
        getPrefs().edit().clear().apply()
    }
}
