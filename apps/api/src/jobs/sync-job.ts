import cron from 'node-cron';
import { syncAll, syncKB4, syncNCM, syncEDR, syncHIBP, createDailySnapshot } from '../services/sync.js';
import { env } from '../config/index.js';

// 同步狀態追蹤
let isSyncing = false;
let lastSyncResult: Awaited<ReturnType<typeof syncAll>> | null = null;
let lastSyncTime: Date | null = null;

export function startSyncJobs(): void {
  // 每 N 分鐘同步一次數據
  const syncExpression = `*/${env.SYNC_INTERVAL} * * * *`;

  cron.schedule(syncExpression, async () => {
    if (isSyncing) {
      console.log(`[${new Date().toISOString()}] Sync already in progress, skipping...`);
      return;
    }

    isSyncing = true;
    console.log(`[${new Date().toISOString()}] Starting scheduled sync...`);

    try {
      const results = await syncAll();
      lastSyncResult = results;
      lastSyncTime = new Date();

      console.log(`[${new Date().toISOString()}] Sync completed in ${results.totalDuration}ms`);
      console.log(`  KB4: ${results.kb4.count} records (${results.kb4.duration}ms)`);
      console.log(`  NCM: ${results.ncm.count} records (${results.ncm.duration}ms)`);
      console.log(`  EDR: ${results.edr.count} records (${results.edr.duration}ms)`);
      console.log(`  HIBP: ${results.hibp.count} records (${results.hibp.duration}ms)`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Sync failed:`, error);
    } finally {
      isSyncing = false;
    }
  });

  // 每天 00:05 創建快照
  cron.schedule('5 0 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Creating daily snapshot...`);
    try {
      await createDailySnapshot();
      console.log(`[${new Date().toISOString()}] Daily snapshot created`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to create daily snapshot:`, error);
    }
  });

  console.log(`Sync job scheduled to run every ${env.SYNC_INTERVAL} minutes`);
  console.log('Daily snapshot scheduled at 00:05');
}

// 手動觸發同步的函數匯出
export const manualSync = {
  all: syncAll,
  kb4: syncKB4,
  ncm: syncNCM,
  edr: syncEDR,
  hibp: syncHIBP,
  snapshot: createDailySnapshot,
};

// 獲取同步狀態
export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncTime: lastSyncTime?.toISOString() || null,
    lastSyncResult: lastSyncResult
      ? {
          kb4: { success: lastSyncResult.kb4.success, count: lastSyncResult.kb4.count },
          ncm: { success: lastSyncResult.ncm.success, count: lastSyncResult.ncm.count },
          edr: { success: lastSyncResult.edr.success, count: lastSyncResult.edr.count },
          hibp: { success: lastSyncResult.hibp.success, count: lastSyncResult.hibp.count },
          totalDuration: lastSyncResult.totalDuration,
        }
      : null,
  };
}
