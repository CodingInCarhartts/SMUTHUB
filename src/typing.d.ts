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
    /**
     * Store a key-value pair in persistent storage
     */
    setStorageItem(key: string, value: string): void;
    
    /**
     * Retrieve a value from persistent storage
     * Uses callback because native module calls are async
     */
    getStorageItem(key: string, callback: (value: string | null) => void): void;
    
    /**
     * Clear all data from persistent storage
     */
    clearStorage(): void;
  };
};
