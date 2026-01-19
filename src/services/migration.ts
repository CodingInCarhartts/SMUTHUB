import { StorageService } from './storage';
import { SupabaseService } from './supabase';
import { SyncEngine } from './sync';

const MIGRATION_FLAG = 'batoto:migration_complete';
const SOURCE_MIGRATION_FLAG = 'batoto:source_migration_complete';

/**
 * Migration Service: Legacy -> Cloud
 */
export const MigrationService = {
  /**
   * Run the main legacy -> cloud migration process if not already completed
   */
  async run(): Promise<void> {
    await this.runSourceMigration();

    const mainMigrationComplete =
      await StorageService.getNativeItemSync(MIGRATION_FLAG);
    if (mainMigrationComplete === 'true') {
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
        const payload = favorites.map((m) => ({
          device_id: deviceId,
          manga_id: m.id,
          manga_data: m,
          created_at: new Date().toISOString(),
        }));
        await SupabaseService.upsert(
          'favorites',
          payload,
          'device_id,manga_id',
        );
      }

      // 2. Migrate History
      const history = await StorageService.getHistory();
      if (history.length > 0) {
        console.log(`[Migration] Migrating ${history.length} history items...`);
        const payload = history.map((h) => ({
          device_id: deviceId,
          manga_id: h.manga.id,
          manga_data: h.manga,
          chapter_id: h.lastChapterId,
          chapter_title: h.lastChapterTitle,
          page_index: h.lastPageIndex,
          timestamp: h.timestamp,
          updated_at: h.viewedAt,
        }));
        await SupabaseService.upsert('history', payload, 'device_id,manga_id');
      }

      // 3. Migrate Settings
      const settings = await StorageService.getSettings();
      if (settings) {
        console.log('[Migration] Migrating settings...');
        await SupabaseService.upsert(
          'settings',
          {
            device_id: deviceId,

            dark_mode: settings.darkMode,
            dev_mode: settings.devMode,
            scroll_speed: settings.scrollSpeed,
            updated_at: new Date().toISOString(),
          },
          'device_id',
        );
      }

      // 4. Mark as complete
      await StorageService.setNativeItemSync(MIGRATION_FLAG, 'true');
      console.log('[Migration] Successfully completed');

      // Note: Per user feedback, we don't strictly need to clear legacy keys immediately,
      // but they will be ignored by the new StorageService anyway.
    } catch (e) {
      console.error('[Migration] Failed:', e);
    }
  },

  /**
   * Migrate existing favorites and history to include 'source' field
   */
  async runSourceMigration(): Promise<void> {
    const isComplete = await StorageService.getNativeItemSync(
      SOURCE_MIGRATION_FLAG,
    );
    if (isComplete === 'true') {
      console.log('[Migration] Source migration already complete');
      return;
    }

    console.log('[Migration] Starting source field migration...');

    try {
      // 1. Migrate Favorites
      const favorites = await StorageService.getFavorites();
      let migratedFavorites = false;

      if (favorites.length > 0) {
        console.log(
          `[Migration] Checking ${favorites.length} favorites for source field...`,
        );

        const updatedFavorites = favorites.map((fav) => {
          if (!(fav as any).source) {
            migratedFavorites = true;
            return {
              ...fav,
              source: 'batoto',
            };
          }
          return fav;
        });

        if (migratedFavorites) {
          // Update storage with migrated favorites
          const deviceId = await StorageService.getDeviceId();
          const payload = updatedFavorites.map((m) => ({
            device_id: deviceId,
            manga_id: m.id,
            manga_data: m,
            created_at: new Date().toISOString(),
          }));
          await SupabaseService.upsert(
            'favorites',
            payload,
            'device_id,manga_id',
          );
          console.log('[Migration] Migrated favorites with source field');
        }
      }

      // 2. Migrate History
      const history = await StorageService.getHistory();
      let migratedHistory = false;

      if (history.length > 0) {
        console.log(
          `[Migration] Checking ${history.length} history items for source field...`,
        );

        const updatedHistory = history.map((h) => {
          if (!(h.manga as any).source) {
            migratedHistory = true;
            return {
              ...h,
              manga: {
                ...h.manga,
                source: 'batoto',
              },
            };
          }
          return h;
        });

        if (migratedHistory) {
          // Update storage with migrated history
          const deviceId = await StorageService.getDeviceId();
          const payload = updatedHistory.map((h) => ({
            device_id: deviceId,
            manga_id: h.manga.id,
            manga_data: h.manga,
            chapter_id: h.lastChapterId,
            chapter_title: h.lastChapterTitle,
            page_index: h.lastPageIndex,
            timestamp: h.timestamp,
            updated_at: h.viewedAt,
          }));
          await SupabaseService.upsert(
            'history',
            payload,
            'device_id,manga_id',
          );
          console.log('[Migration] Migrated history with source field');
        }
      }

      // 3. Mark as complete
      await StorageService.setNativeItemSync(SOURCE_MIGRATION_FLAG, 'true');
      console.log('[Migration] Source migration successfully completed');
    } catch (e) {
      console.error('[Migration] Source migration failed:', e);
    }
  },
};
