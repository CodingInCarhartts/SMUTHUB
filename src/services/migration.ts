import { StorageService } from './storage';
import { SyncEngine } from './sync';
import { SupabaseService } from './supabase';

const MIGRATION_FLAG = 'batoto:migration_complete';

/**
 * Migration Service: Legacy -> Cloud
 */
export const MigrationService = {
  /**
   * Run the migration process if not already completed
   */
  async run(): Promise<void> {
    const isComplete = await StorageService.getNativeItemSync(MIGRATION_FLAG);
    if (isComplete === 'true') {
      console.log('[Migration] Already complete');
      return;
    }

    console.log('[Migration] Starting legacy data migration...');

    try {
      const deviceId = await StorageService.getDeviceId();
      if (!deviceId) {
        console.warn('[Migration] No device ID, skipping migration');
        return;
      }

      // 1. Migrate Favorites
      const favorites = await StorageService.getFavorites();
      if (favorites.length > 0) {
        console.log(`[Migration] Migrating ${favorites.length} favorites...`);
        const payload = favorites.map(m => ({
          device_id: deviceId,
          manga_id: m.id,
          manga_data: m,
          created_at: new Date().toISOString()
        }));
        await SupabaseService.upsert('favorites', payload, 'device_id,manga_id');
      }

      // 2. Migrate History
      const history = await StorageService.getHistory();
      if (history.length > 0) {
        console.log(`[Migration] Migrating ${history.length} history items...`);
        const payload = history.map(h => ({
          device_id: deviceId,
          manga_id: h.manga.id,
          manga_data: h.manga,
          chapter_id: h.lastChapterId,
          chapter_title: h.lastChapterTitle,
          page_index: h.lastPageIndex,
          timestamp: h.timestamp,
          updated_at: h.viewedAt
        }));
        await SupabaseService.upsert('history', payload, 'device_id,manga_id');
      }

      // 3. Migrate Settings
      const settings = await StorageService.getSettings();
      if (settings) {
        console.log('[Migration] Migrating settings...');
        await SupabaseService.upsert('settings', {
          device_id: deviceId,
          reading_mode: settings.readingMode,
          dark_mode: settings.darkMode,
          dev_mode: settings.devMode,
          scroll_speed: settings.scrollSpeed,
          updated_at: new Date().toISOString()
        }, 'device_id');
      }

      // 4. Mark as complete
      await StorageService.setNativeItemSync(MIGRATION_FLAG, 'true');
      console.log('[Migration] Successfully completed');

      // Note: Per user feedback, we don't strictly need to clear legacy keys immediately, 
      // but they will be ignored by the new StorageService anyway.
    } catch (e) {
      console.error('[Migration] Failed:', e);
    }
  }
};
