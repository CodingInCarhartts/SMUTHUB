import { SYNC_HEARTBEAT_INTERVAL_MS } from '../config';
import { getNativeItemSync, setNativeItemSync } from './nativeStorage';
import { PerformanceService } from './perf';
import { SupabaseService } from './supabase';

export type OperationType = 'UPSERT' | 'DELETE';

export interface Operation {
  type: OperationType;
  table: string;
  payload: any;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'batoto:sync_queue';
let isSyncing = false;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Background Sync Engine & Operation Queue
 */
export const SyncEngine = {
  listeners: new Set<() => void>(),

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notify() {
    this.listeners.forEach((l) => l());
  },

  isSyncing(): boolean {
    return isSyncing;
  },

  /**
   * Add an operation to the persistent queue
   */
  async enqueue(op: Operation): Promise<void> {
    console.log(
      `[SyncEngine] Enqueueing ${op.type} for ${op.table}:`,
      JSON.stringify(op.payload).substring(0, 200),
    );
    const queue = await this.getQueue();
    queue.push(op);
    await this.saveQueue(queue);
    console.log(`[SyncEngine] Queue size after enqueue: ${queue.length}`);
    this.notify();

    // Trigger background sync attempt
    this.processQueue();
  },

  /**
   * Process the pending operations in the queue
   */
  async processQueue(): Promise<void> {
    if (isSyncing) {
      console.log('[SyncEngine] Already syncing, skipping...');
      return;
    }

    const queue = await this.getQueue();
    if (queue.length === 0) {
      console.log('[SyncEngine] Queue is empty, nothing to process');
      return;
    }

    console.log(`[SyncEngine] Processing queue (${queue.length} items)...`);
    isSyncing = true;
    this.notify();

    PerformanceService.startTimer('SyncEngine.processQueue');

    try {
      // Processes operations sequentially to maintain order and validity
      while (queue.length > 0) {
        const op = queue[0];
        console.log(`[SyncEngine] Executing: ${op.type} on ${op.table}...`);

        let success = false;
        let lastError = null;

        // Retry logic: try up to MAX_RETRIES times
        for (let retry = 0; retry < MAX_RETRIES; retry++) {
          success = await this.executeOperation(op);

          if (success) {
            break;
          }

          lastError = `Attempt ${retry + 1}/${MAX_RETRIES} failed`;
          console.warn(
            `[SyncEngine] Retry ${retry + 1}/${MAX_RETRIES} for ${op.type} on ${op.table}`,
          );

          if (retry < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }

        if (success) {
          console.log(`[SyncEngine] SUCCESS: ${op.type} on ${op.table}`);
          queue.shift(); // Remove processed
          await this.saveQueue(queue);
          this.notify();
        } else {
          // Operation failed after all retries - skip this item and continue with next
          console.error(
            `[SyncEngine] FAILED after ${MAX_RETRIES} attempts: ${op.type} on ${op.table}`,
            lastError,
          );
          queue.shift(); // Remove failed item to unblock the queue
          await this.saveQueue(queue);
          this.notify();
          // Continue processing remaining items
        }
      }
    } catch (e: any) {
      console.error(
        '[SyncEngine] Critical error during queue processing:',
        e?.message || e,
      );
    } finally {
      PerformanceService.endTimer('SyncEngine.processQueue');
      isSyncing = false;
      this.notify();
      console.log(
        `[SyncEngine] Finished processing. Remaining: ${queue.length}`,
      );
    }
  },

  /**
   * Internal executor for Supabase operations
   */
  async executeOperation(op: Operation): Promise<boolean> {
    try {
      if (op.type === 'UPSERT') {
        // Find conflict column based on table
        let conflictColumn = 'id';
        if (op.table === 'settings') conflictColumn = 'device_id';
        if (
          op.table === 'favorites' ||
          op.table === 'history' ||
          op.table === 'reader_positions'
        ) {
          conflictColumn = 'device_id,manga_id';
        }

        const success = await SupabaseService.upsert(
          op.table,
          op.payload,
          conflictColumn,
        );
        return success;
      } else if (op.type === 'DELETE') {
        const deviceId = op.payload.device_id;
        const column = op.table === 'settings' ? 'device_id' : 'manga_id';
        const value = op.table === 'settings' ? deviceId : op.payload.manga_id;

        // For table-specific deletes (favorites/history), we usually need both ID filters
        // but our current SupabaseService.delete is a bit simplified.
        // If it's a many-to-many style table, we need complex filters.
        if (op.table === 'favorites' || op.table === 'history') {
          const mangaId = op.payload.manga_id;
          const query = mangaId
            ? `/${op.table}?device_id=eq.${deviceId}&manga_id=eq.${mangaId}`
            : `/${op.table}?device_id=eq.${deviceId}`;
          const success = await SupabaseService.request(query, {
            method: 'DELETE',
            // Ensure we get a response body to confirm success vs error
            headers: { Prefer: 'return=representation' },
          });
          return success !== null;
        }

        const success = await SupabaseService.delete(op.table, column, value);
        return success;
      }
      return true;
    } catch (e) {
      console.error('[SyncEngine] Execution failed:', e);
      return false;
    }
  },

  /**
   * Persistent storage access
   */
  async getQueue(): Promise<Operation[]> {
    const raw = await getNativeItemSync(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    try {
      // Zombie Check: If raw string is massive, we might have a corrupt or clogged queue
      if (raw.length > 500000) {
        // 500kb safety limit
        console.warn(
          '[SyncEngine] ZOMBIE QUEUE DETECTED (Size > 500kb). PURGING QUEUE TO RESTORE SYNC.',
        );
        await this.saveQueue([]);
        return [];
      }

      const queue = JSON.parse(raw);

      // Secondary safety check for item count
      if (Array.isArray(queue) && queue.length > 500) {
        console.warn(
          '[SyncEngine] ZOMBIE QUEUE DETECTED (Count > 500). PURGING QUEUE TO RESTORE SYNC.',
        );
        await this.saveQueue([]);
        return [];
      }

      return queue;
    } catch {
      return [];
    }
  },

  async saveQueue(queue: Operation[]): Promise<void> {
    await setNativeItemSync(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  },

  /**
   * Get a set of IDs that are pending deletion in the queue
   */
  async getPendingDeletions(table: string): Promise<Set<string>> {
    const queue = await this.getQueue();
    const deletions = new Set<string>();
    queue.forEach((op) => {
      if (op.type === 'DELETE' && op.table === table && op.payload.manga_id) {
        deletions.add(op.payload.manga_id);
      }
    });
    return deletions;
  },
};

// Initialize network heartbeat for background sync
if (typeof lynx !== 'undefined' || typeof globalThis !== 'undefined') {
  // Attempt sync at configured interval if queue is not empty
  setInterval(() => {
    SyncEngine.processQueue();
  }, SYNC_HEARTBEAT_INTERVAL_MS);
}
