package com.example.smuthub

import android.app.Application
import com.facebook.drawee.backends.pipeline.Fresco
import com.lynx.service.http.LynxHttpService
import com.lynx.service.image.LynxImageService
import com.lynx.service.log.LynxLogService
import com.lynx.tasm.LynxEnv
import com.lynx.tasm.service.LynxServiceCenter
import com.example.smuthub.modules.*

import com.lynx.jsbridge.network.HttpRequest
import com.lynx.jsbridge.network.HttpStreamingDelegate
import com.lynx.tasm.service.ILynxHttpService
import com.lynx.tasm.service.IServiceProvider
import com.lynx.tasm.service.LynxHttpRequestCallback

class SmutHubApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // 1. Initialize Fresco for Image Service
        Fresco.initialize(this)

        // 2. Register Lynx Services
        LynxServiceCenter.inst().registerService(LynxImageService.getInstance())
        LynxServiceCenter.inst().registerService(LynxLogService)
        // Fix for AbstractMethodError: Use a safe wrapper that explicitly implements getServiceClass
        LynxServiceCenter.inst().registerService(SafeHttpService())

        // 3. Initialize Lynx Environment
        LynxEnv.inst().init(this, null, null, null)
        
        // 4. Register Native Modules
        LynxEnv.inst().registerModule("NativeLocalStorageModule", NativeLocalStorageModule::class.java)
        LynxEnv.inst().registerModule("NativeUIModule", NativeUIModule::class.java)
        LynxEnv.inst().registerModule("NativeToastModule", NativeToastModule::class.java)
        LynxEnv.inst().registerModule("NativeHapticModule", NativeHapticModule::class.java)
        LynxEnv.inst().registerModule("NativeUtilsModule", NativeUtilsModule::class.java)
        LynxEnv.inst().registerModule("NativeUpdaterModule", NativeUpdaterModule::class.java)
    }
}

class SafeHttpService : ILynxHttpService {
    override fun request(request: HttpRequest, callback: LynxHttpRequestCallback) {
        LynxHttpService.request(request, callback)
    }

    override fun requestStreaming(request: HttpRequest, callback: LynxHttpRequestCallback, delegate: HttpStreamingDelegate) {
        LynxHttpService.requestStreaming(request, callback, delegate)
    }

    override fun getServiceClass(): Class<out IServiceProvider> {
        return ILynxHttpService::class.java
    }
}
