import { prisma } from './db.js';
import { googleSheetsService } from './google-sheets.js';
import { onSyncComplete } from './cache.js';
import type { KB4RawRow, NCMRawRow, EDRRawRow, HIBPRawRow } from '../types/sheets.js';

type SyncSource = 'kb4' | 'ncm' | 'edr' | 'hibp';

interface SyncResult {
  success: boolean;
  count: number;
  duration: number;
  error?: string;
}

// 批量操作大小
const BATCH_SIZE = 100;

async function logSync(
  source: SyncSource,
  status: 'success' | 'error',
  recordCount: number,
  duration: number,
  error?: string
): Promise<void> {
  await prisma.syncLog.create({
    data: { source, status, recordCount, duration, error },
  });
}

// 批量處理輔助函數
async function processBatch<T>(
  items: T[],
  processor: (batch: T[]) => Promise<void>,
  batchSize = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
  }
}

// ==================== KB4 同步 ====================
export async function syncKB4(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getKB4Data();

    // 過濾有效數據
    const validData = rawData.filter(row => row.user_id && row.email);

    // 批量 upsert
    let count = 0;
    await processBatch(validData, async (batch) => {
      await prisma.$transaction(
        batch.map(row =>
          prisma.kB4User.upsert({
            where: { userId: row.user_id },
            create: {
              userId: row.user_id,
              email: row.email,
              firstName: row.first_name || '',
              lastName: row.last_name || '',
              department: row.department || null,
              division: row.division || null,
              location: row.location || null,
              jobTitle: row.job_title || null,
              managerName: row.manager_name || null,
              managerEmail: row.manager_email || null,
              employeeNumber: row.employee_number || null,
              status: row.status || 'active',
              organization: row.organization || null,
              currentRiskScore: parseFloat(row.current_risk_score) || 0,
              phishPronePercentage: parseFloat(row.phish_prone_percentage) || 0,
              lastSignIn: row.last_sign_in ? new Date(row.last_sign_in) : null,
              syncedAt: new Date(),
            },
            update: {
              email: row.email,
              firstName: row.first_name || '',
              lastName: row.last_name || '',
              department: row.department || null,
              division: row.division || null,
              status: row.status || 'active',
              currentRiskScore: parseFloat(row.current_risk_score) || 0,
              phishPronePercentage: parseFloat(row.phish_prone_percentage) || 0,
              lastSignIn: row.last_sign_in ? new Date(row.last_sign_in) : null,
              syncedAt: new Date(),
            },
          })
        )
      );
      count += batch.length;
    });

    const duration = Date.now() - startTime;
    await logSync('kb4', 'success', count, duration);

    // 使緩存失效
    onSyncComplete('kb4');

    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('kb4', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== NCM 同步 (優化版) ====================
export async function syncNCM(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getNCMData();

    // 解析所有設備數據
    const devices: Array<{
      deviceName: string;
      deviceIp: string | null;
      hwModel: string | null;
      fwSeries: string | null;
      fwVersion: string | null;
      updatePriority: string;
      totalCveInstances: number;
      maxKevActiveExploit: number;
      maxCriticalCve: number;
      maxCvss: number;
      actionRequired: string | null;
    }> = [];

    for (const row of rawData) {
      if (!row.AllDeviceNames) continue;

      const deviceNames = row.AllDeviceNames.split('; ');
      const deviceIps = row.AllDeviceIPs?.split('; ') || [];

      for (let i = 0; i < deviceNames.length; i++) {
        const deviceName = deviceNames[i]?.trim();
        if (!deviceName) continue;

        const ipMatch = deviceIps[i]?.match(/\(([^)]+)\)/);
        const deviceIp = ipMatch ? ipMatch[1] : null;

        devices.push({
          deviceName,
          deviceIp,
          hwModel: row.HW_Models || null,
          fwSeries: row.FW_Series || null,
          fwVersion: row.FW_Version || null,
          updatePriority: row.UpdatePriority || 'P3-Monitor',
          totalCveInstances: parseInt(row.TotalCVEInstances) || 0,
          maxKevActiveExploit: parseInt(row.MaxKEV_ActiveExploit) || 0,
          maxCriticalCve: parseInt(row.MaxCriticalCVE) || 0,
          maxCvss: parseFloat(row.MaxCVSS) || 0,
          actionRequired: row.ActionRequired || null,
        });
      }
    }

    // 使用事務進行批量操作
    await prisma.$transaction(async (tx) => {
      // 獲取現有設備的唯一標識
      const existingDevices = await tx.nCMDevice.findMany({
        select: { id: true, deviceName: true, deviceIp: true },
      });

      const existingMap = new Map(
        existingDevices.map(d => [`${d.deviceName}|${d.deviceIp || ''}`, d.id])
      );

      const newDeviceKeys = new Set(
        devices.map(d => `${d.deviceName}|${d.deviceIp || ''}`)
      );

      // 刪除不再存在的設備
      const idsToDelete = existingDevices
        .filter(d => !newDeviceKeys.has(`${d.deviceName}|${d.deviceIp || ''}`))
        .map(d => d.id);

      if (idsToDelete.length > 0) {
        await tx.nCMDevice.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // 批量 upsert
      for (const device of devices) {
        const key = `${device.deviceName}|${device.deviceIp || ''}`;
        const existingId = existingMap.get(key);

        if (existingId) {
          await tx.nCMDevice.update({
            where: { id: existingId },
            data: {
              ...device,
              syncedAt: new Date(),
            },
          });
        } else {
          await tx.nCMDevice.create({
            data: {
              ...device,
              syncedAt: new Date(),
            },
          });
        }
      }
    });

    const duration = Date.now() - startTime;
    await logSync('ncm', 'success', devices.length, duration);

    // 使緩存失效
    onSyncComplete('ncm');

    return { success: true, count: devices.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('ncm', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== EDR 同步 (優化版) ====================
export async function syncEDR(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getEDRData();

    // 解析有效數據
    const alerts: Array<{
      hostname: string;
      detectedAt: Date;
      fileSha256: string | null;
      severity: string;
      ioaName: string;
      domain: string | null;
      filePath: string | null;
      vtVerdict: string | null;
    }> = [];

    for (const row of rawData) {
      const hostname = row['主機名稱'];
      const detectedAtStr = row['偵測時間'];
      if (!hostname || !detectedAtStr) continue;

      alerts.push({
        hostname,
        detectedAt: new Date(detectedAtStr),
        fileSha256: row['可疑檔案的 SHA256'] || null,
        severity: row['伺服器性'] || 'Low',
        ioaName: row['IOA 名稱'] || '',
        domain: row['針對此偵測的特定資料'] || null,
        filePath: row['檔案路徑'] || null,
        vtVerdict: row['VT verdict'] || null,
      });
    }

    // 批量查詢現有記錄
    const existingAlerts = await prisma.eDRAlert.findMany({
      select: { id: true, hostname: true, detectedAt: true, fileSha256: true },
    });

    // 建立查找映射
    const existingMap = new Map(
      existingAlerts.map(a => [
        `${a.hostname}|${a.detectedAt.toISOString()}|${a.fileSha256 || ''}`,
        a.id,
      ])
    );

    let count = 0;

    // 批量處理
    await processBatch(alerts, async (batch) => {
      await prisma.$transaction(async (tx) => {
        for (const alert of batch) {
          const key = `${alert.hostname}|${alert.detectedAt.toISOString()}|${alert.fileSha256 || ''}`;
          const existingId = existingMap.get(key);

          if (existingId) {
            await tx.eDRAlert.update({
              where: { id: existingId },
              data: {
                vtVerdict: alert.vtVerdict,
                syncedAt: new Date(),
              },
            });
          } else {
            await tx.eDRAlert.create({
              data: {
                severity: alert.severity,
                detectedAt: alert.detectedAt,
                hostname: alert.hostname,
                ioaName: alert.ioaName,
                domain: alert.domain,
                fileSha256: alert.fileSha256,
                filePath: alert.filePath,
                vtVerdict: alert.vtVerdict,
                status: 'new',
                syncedAt: new Date(),
              },
            });
          }
          count++;
        }
      });
    });

    const duration = Date.now() - startTime;
    await logSync('edr', 'success', count, duration);

    // 使緩存失效
    onSyncComplete('edr');

    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('edr', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== HIBP 同步 (優化版) ====================
export async function syncHIBP(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getHIBPData();

    // 過濾有效數據
    const validData = rawData.filter(row => row.Email && row.BreachName);

    // 批量 upsert
    let count = 0;
    await processBatch(validData, async (batch) => {
      await prisma.$transaction(
        batch.map(row =>
          prisma.hIBPBreach.upsert({
            where: {
              email_breachName: {
                email: row.Email,
                breachName: row.BreachName,
              },
            },
            create: {
              domain: row.Domain || '',
              email: row.Email,
              alias: row.Alias || null,
              breachName: row.BreachName,
              breachDate: row.BreachDate ? new Date(row.BreachDate) : null,
              discoveredAt: row.Timestamp ? new Date(row.Timestamp) : new Date(),
              status: 'new',
              syncedAt: new Date(),
            },
            update: {
              syncedAt: new Date(),
            },
          })
        )
      );
      count += batch.length;
    });

    const duration = Date.now() - startTime;
    await logSync('hibp', 'success', count, duration);

    // 使緩存失效
    onSyncComplete('hibp');

    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('hibp', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== 同步所有來源 ====================
export interface SyncAllResult {
  kb4: SyncResult;
  ncm: SyncResult;
  edr: SyncResult;
  hibp: SyncResult;
  totalDuration: number;
}

export async function syncAll(): Promise<SyncAllResult> {
  const startTime = Date.now();

  // 並行同步所有來源
  const [kb4, ncm, edr, hibp] = await Promise.all([
    syncKB4(),
    syncNCM(),
    syncEDR(),
    syncHIBP(),
  ]);

  const totalDuration = Date.now() - startTime;

  // 使所有緩存失效
  onSyncComplete('all');

  return {
    kb4,
    ncm,
    edr,
    hibp,
    totalDuration,
  };
}

// ==================== 創建每日快照 ====================
export async function createDailySnapshot(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 檢查今天是否已經有快照
  const existing = await prisma.dailySnapshot.findUnique({
    where: { date: today },
  });

  if (existing) {
    console.log('Daily snapshot already exists for today');
    return;
  }

  // 收集各模塊統計數據
  const [kb4Stats, ncmStats, edrStats, hibpStats] = await Promise.all([
    getKB4SnapshotData(),
    getNCMSnapshotData(),
    getEDRSnapshotData(),
    getHIBPSnapshotData(),
  ]);

  // 計算整體風險分數 (簡化版)
  const overallRiskScore = calculateSnapshotRiskScore(kb4Stats, ncmStats, edrStats, hibpStats);

  await prisma.dailySnapshot.create({
    data: {
      date: today,
      ...kb4Stats,
      ...ncmStats,
      ...edrStats,
      ...hibpStats,
      overallRiskScore,
    },
  });

  console.log(`Daily snapshot created for ${today.toISOString().split('T')[0]}`);
}

// 快照數據收集輔助函數
async function getKB4SnapshotData() {
  const [total, highRisk, avgStats] = await Promise.all([
    prisma.kB4User.count({ where: { status: 'active' } }),
    prisma.kB4User.count({
      where: {
        status: 'active',
        OR: [
          { currentRiskScore: { gte: 50 } },
          { phishPronePercentage: { gte: 20 } },
        ],
      },
    }),
    prisma.kB4User.aggregate({
      where: { status: 'active' },
      _avg: { currentRiskScore: true, phishPronePercentage: true },
    }),
  ]);

  return {
    kb4TotalUsers: total,
    kb4HighRiskUsers: highRisk,
    kb4AvgRiskScore: avgStats._avg.currentRiskScore || 0,
    kb4AvgPhishProneRate: avgStats._avg.phishPronePercentage || 0,
  };
}

async function getNCMSnapshotData() {
  const [total, p0, p1, cveSum] = await Promise.all([
    prisma.nCMDevice.count(),
    prisma.nCMDevice.count({ where: { updatePriority: 'P0-Immediate' } }),
    prisma.nCMDevice.count({ where: { updatePriority: 'P1-NextCycle' } }),
    prisma.nCMDevice.aggregate({ _sum: { totalCveInstances: true } }),
  ]);

  return {
    ncmTotalDevices: total,
    ncmP0Devices: p0,
    ncmP1Devices: p1,
    ncmTotalCves: cveSum._sum.totalCveInstances || 0,
  };
}

async function getEDRSnapshotData() {
  const [total, highAlerts, pending, resolved] = await Promise.all([
    prisma.eDRAlert.count(),
    prisma.eDRAlert.count({
      where: { severity: { in: ['Critical', 'High'] } },
    }),
    prisma.eDRAlert.count({
      where: { status: { in: ['new', 'investigating'] } },
    }),
    prisma.eDRAlert.count({ where: { status: 'resolved' } }),
  ]);

  return {
    edrTotalAlerts: total,
    edrHighAlerts: highAlerts,
    edrPendingAlerts: pending,
    edrResolvedAlerts: resolved,
  };
}

async function getHIBPSnapshotData() {
  const [total, newBreaches, pending] = await Promise.all([
    prisma.hIBPBreach.count(),
    prisma.hIBPBreach.count({
      where: {
        discoveredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.hIBPBreach.count({ where: { status: 'new' } }),
  ]);

  return {
    hibpTotalBreaches: total,
    hibpNewBreaches: newBreaches,
    hibpPendingBreaches: pending,
  };
}

function calculateSnapshotRiskScore(
  kb4: Awaited<ReturnType<typeof getKB4SnapshotData>>,
  ncm: Awaited<ReturnType<typeof getNCMSnapshotData>>,
  edr: Awaited<ReturnType<typeof getEDRSnapshotData>>,
  hibp: Awaited<ReturnType<typeof getHIBPSnapshotData>>
): number {
  const weights = { kb4: 0.2, ncm: 0.35, edr: 0.3, hibp: 0.15 };

  const kb4Score = kb4.kb4TotalUsers > 0
    ? Math.min(100, (kb4.kb4HighRiskUsers / kb4.kb4TotalUsers) * 200 + kb4.kb4AvgRiskScore)
    : 0;

  const ncmScore = ncm.ncmTotalDevices > 0
    ? Math.min(100, (ncm.ncmP0Devices / ncm.ncmTotalDevices) * 300)
    : 0;

  const edrScore = edr.edrTotalAlerts > 0
    ? Math.min(100, (edr.edrPendingAlerts / edr.edrTotalAlerts) * 100 +
        (edr.edrHighAlerts / edr.edrTotalAlerts) * 100)
    : 0;

  const hibpScore = Math.min(100, hibp.hibpPendingBreaches * 10);

  return Math.round(
    kb4Score * weights.kb4 +
    ncmScore * weights.ncm +
    edrScore * weights.edr +
    hibpScore * weights.hibp
  );
}
