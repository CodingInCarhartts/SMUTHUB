// Type declarations for Lynx Native Modules
// These interfaces define the bridge between JavaScript and native platform code

declare let NativeModules: {
  /**
   * Native local storage module using platform-specific persistent storage:
   * - Android: SharedPreferences
   * - iOS: NSUserDefaults
   * - HarmonyOS: Preferences
   */
  NativeLocalStorageModule: {
    setStorageItem(key: string, value: string): void;
    getStorageItem(key: string, callback: (value: string | null) => void): void;
    clearStorage(): void;
  };

  /**
   * System UI controls (Immersive mode, Brightness, Orientation)
   */
  NativeUIModule: {
    setImmersiveMode(enabled: boolean): void;
    setBrightness(brightness: number): void;
    setOrientation(
      orientation: 'portrait' | 'landscape' | 'sensor' | 'unspecified',
    ): void;
  };

  /**
   * Native Android Toast messages
   */
  NativeToastModule: {
    show(message: string, duration: 0 | 1): void;
  };

  /**
   * Haptic feedback (vibrations)
   */
  NativeHapticModule: {
    vibrate(effect: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void;
  };

  /**
   * System utilities (Clipboard, Sharing, Performance)
   */
  NativeUtilsModule: {
    copyToClipboard(text: string): void;
    shareText(text: string, title: string): void;
    getDeviceId(callback: (id: string) => void): void;
    exitApp(): void;
    /**
     * Get battery status as JSON string
     * Returns: {"level": number, "isCharging": boolean, "temperature": number}
     */
    getBatteryStatus(callback: (json: string) => void): void;
    /**
     * Get memory info as JSON string
     * Returns: {"usedMb": number, "maxMb": number, "pssMb": number}
     */
    getMemoryInfo(callback: (json: string) => void): void;
  };

  /**
   * Native APK Updater
   */
  NativeUpdaterModule: {
    getNativeVersion(): string;
    installUpdate(url: string): void;
    setOtaUrl(url: string): void;
    triggerOtaReload(): void;
    clearOta(): void;
  };
};
