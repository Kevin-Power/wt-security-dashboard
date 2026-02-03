import cron from 'node-cron';
import { syncAll, syncKB4, syncNCM, syncEDR, syncHIBP } from '../services/sync.js';
import { env } from '../config/index.js';

export function startSyncJobs(): void {
  // 每 N 分鐘同步一次
  const cronExpression = `*/${env.SYNC_INTERVAL} * * * *`;
  
  cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled sync...`);
    try {
      const results = await syncAll();
      console.log(`[${new Date().toISOString()}] Sync completed:`, JSON.stringify(results, null, 2));
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Sync failed:`, error);
    }
  });

  console.log(`Sync job scheduled to run every ${env.SYNC_INTERVAL} minutes`);
}

// 手動觸發同步的函數匯出
export const manualSync = {
  all: syncAll,
  kb4: syncKB4,
  ncm: syncNCM,
  edr: syncEDR,
  hibp: syncHIBP,
};
