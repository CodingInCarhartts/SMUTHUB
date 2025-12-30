import { StorageService } from './storage';
import { SupabaseService } from './supabase';
import { SYNC_HEARTBEAT_INTERVAL_MS } from '../config';

export type OperationType = 'UPSERT' | 'DELETE';

export interface Operation {
  type: OperationType;
  table: string;
  payload: any;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'batoto:sync_queue';
let isSyncing = false;

/**
 * Background Sync Engine & Operation Queue
 */
export const SyncEngine = {
  /**
   * Add an operation to the persistent queue
   */
  async enqueue(op: Operation): Promise<void> {
    console.log(`[SyncEngine] Enqueueing ${op.type} for ${op.table}:`, JSON.stringify(op.payload).substring(0, 200));
    const queue = await this.getQueue();
    queue.push(op);
    await this.saveQueue(queue);
    console.log(`[SyncEngine] Queue size after enqueue: ${queue.length}`);
    
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

    try {
      // Processes operations sequentially to maintain order and validity
      while (queue.length > 0) {
        const op = queue[0];
        console.log(`[SyncEngine] Executing: ${op.type} on ${op.table}...`);
        const success = await this.executeOperation(op);
        
        if (success) {
          console.log(`[SyncEngine] SUCCESS: ${op.type} on ${op.table}`);
          queue.shift(); // Remove processed
          await this.saveQueue(queue);
        } else {
          // If execution fails (e.g., network error), stop and retry later
          console.warn('[SyncEngine] Operation failed, stopping queue processing');
          break;
        }
      }
    } catch (e: any) {
      console.error('[SyncEngine] Critical error during queue processing:', e?.message || e);
    } finally {
      isSyncing = false;
      console.log(`[SyncEngine] Finished processing. Remaining: ${queue.length}`);
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
        if (op.table === 'favorites' || op.table === 'history' || op.table === 'reader_positions') {
          conflictColumn = 'device_id,manga_id';
        }

        return await SupabaseService.upsert(op.table, op.payload, conflictColumn);
      } else if (op.type === 'DELETE') {
        const deviceId = op.payload.device_id;
        const column = op.table === 'settings' ? 'device_id' : 'manga_id';
        const value = op.table === 'settings' ? deviceId : op.payload.manga_id;
        
        // For table-specific deletes (favorites/history), we usually need both ID filters
        // but our current SupabaseService.delete is a bit simplified.
        // If it's a many-to-many style table, we need complex filters.
        if (op.table === 'favorites' || op.table === 'history') {
           return await SupabaseService.request(`/${op.table}?device_id=eq.${deviceId}&manga_id=eq.${op.payload.manga_id}`, {
             method: 'DELETE'
           }) !== null;
        }

        return await SupabaseService.delete(op.table, column, value);
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
    const raw = await StorageService.getNativeItemSync(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async saveQueue(queue: Operation[]): Promise<void> {
    await StorageService.setNativeItemSync(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }
};

// Initialize network heartbeat for background sync
if (typeof lynx !== 'undefined' || typeof globalThis !== 'undefined') {
  // Attempt sync at configured interval if queue is not empty
  setInterval(() => {
    SyncEngine.processQueue();
  }, SYNC_HEARTBEAT_INTERVAL_MS);
}
