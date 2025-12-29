import { useCallback, useEffect, useState } from '@lynx-js/react';
import {
  type AppUpdate,
  type NativeAppUpdate,
  UpdateService,
} from '../services/update';

export function useAppUpdates() {
  const [pendingUpdate, setPendingUpdate] = useState<AppUpdate | null>(null);
  const [pendingNativeUpdate, setPendingNativeUpdate] =
    useState<NativeAppUpdate | null>(null);

  const triggerUpdateCheck = useCallback(async () => {
    console.log('[useAppUpdates] Checking for OTA updates...');
    const update = await UpdateService.checkUpdate();
    if (update) {
      console.log('[useAppUpdates] OTA Update found:', update.version);
      setPendingUpdate(update);
    }
    console.log('[useAppUpdates] Checking for Native updates...');
    const nativeUpdate = await UpdateService.checkNativeUpdate();
    if (nativeUpdate) {
      console.log('[useAppUpdates] Native Update found:', nativeUpdate.version);
      setPendingNativeUpdate(nativeUpdate);
    }
  }, []);

  useEffect(() => {
    // 1. Check on mount (with small delay)
    const initialTimeout = setTimeout(() => {
      triggerUpdateCheck();
    }, 3000);

    // 2. Check on app resume/foreground
    const handleAppShow = () => {
      console.log('[useAppUpdates] App resumed, checking for updates...');
      triggerUpdateCheck();
    };

    const runtime =
      typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime && runtime.on) {
      runtime.on('appshow', handleAppShow);
    }

    return () => {
      clearTimeout(initialTimeout);
      if (runtime && runtime.off) {
        runtime.off('appshow', handleAppShow);
      }
    };
  }, [triggerUpdateCheck]);

  const dismissOtaUpdate = useCallback(() => {
    if (pendingUpdate) {
      UpdateService.skipVersion(pendingUpdate.version);
      setPendingUpdate(null);
    }
  }, [pendingUpdate]);

  const dismissNativeUpdate = useCallback(() => {
    if (pendingNativeUpdate) {
      UpdateService.skipVersion(pendingNativeUpdate.version);
      setPendingNativeUpdate(null);
    }
  }, [pendingNativeUpdate]);

  return {
    pendingUpdate,
    setPendingUpdate,
    pendingNativeUpdate,
    setPendingNativeUpdate,
    triggerUpdateCheck,
    dismissOtaUpdate,
    dismissNativeUpdate,
  };
}
