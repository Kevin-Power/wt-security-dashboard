import { prisma } from './db.js';
import { googleSheetsService } from './google-sheets.js';
import type { KB4RawRow, NCMRawRow, EDRRawRow, HIBPRawRow } from '../types/sheets.js';

type SyncSource = 'kb4' | 'ncm' | 'edr' | 'hibp';

interface SyncResult {
  success: boolean;
  count: number;
  duration: number;
  error?: string;
}

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

// ==================== KB4 同步 ====================
export async function syncKB4(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getKB4Data();
    
    let count = 0;
    for (const row of rawData) {
      if (!row.user_id || !row.email) continue;
      
      await prisma.kB4User.upsert({
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
      });
      count++;
    }
    
    const duration = Date.now() - startTime;
    await logSync('kb4', 'success', count, duration);
    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('kb4', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== NCM 同步 ====================
export async function syncNCM(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getNCMData();
    
    // 先清除舊資料（因為 NCM 是整批更新）
    await prisma.nCMDevice.deleteMany({});
    
    let count = 0;
    for (const row of rawData) {
      if (!row.AllDeviceNames) continue;
      
      // NCM 一行可能包含多個設備
      const deviceNames = row.AllDeviceNames.split('; ');
      const deviceIps = row.AllDeviceIPs?.split('; ') || [];
      
      for (let i = 0; i < deviceNames.length; i++) {
        const deviceName = deviceNames[i]?.trim();
        if (!deviceName) continue;
        
        // 從 IP 字串中提取 IP (格式: "DeviceName(IP)")
        const ipMatch = deviceIps[i]?.match(/\(([^)]+)\)/);
        const deviceIp = ipMatch ? ipMatch[1] : null;
        
        await prisma.nCMDevice.create({
          data: {
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
            syncedAt: new Date(),
          },
        });
        count++;
      }
    }
    
    const duration = Date.now() - startTime;
    await logSync('ncm', 'success', count, duration);
    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('ncm', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== EDR 同步 ====================
export async function syncEDR(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getEDRData();
    
    let count = 0;
    for (const row of rawData) {
      const hostname = row['主機名稱'];
      const detectedAtStr = row['偵測時間'];
      if (!hostname || !detectedAtStr) continue;
      
      const detectedAt = new Date(detectedAtStr);
      const fileSha256 = row['可疑檔案的 SHA256'] || null;
      
      // 使用 hostname + detected_at + file_sha256 作為唯一識別
      const existing = await prisma.eDRAlert.findFirst({
        where: {
          hostname,
          detectedAt,
          fileSha256,
        },
      });
      
      if (existing) {
        // 更新現有記錄
        await prisma.eDRAlert.update({
          where: { id: existing.id },
          data: {
            vtVerdict: row['VT verdict'] || null,
            syncedAt: new Date(),
          },
        });
      } else {
        // 建立新記錄
        await prisma.eDRAlert.create({
          data: {
            severity: row['伺服器性'] || 'Low',
            detectedAt,
            hostname,
            ioaName: row['IOA 名稱'] || '',
            domain: row['針對此偵測的特定資料'] || null,
            fileSha256,
            filePath: row['檔案路徑'] || null,
            vtVerdict: row['VT verdict'] || null,
            status: 'new',
            syncedAt: new Date(),
          },
        });
      }
      count++;
    }
    
    const duration = Date.now() - startTime;
    await logSync('edr', 'success', count, duration);
    return { success: true, count, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logSync('edr', 'error', 0, duration, errorMsg);
    return { success: false, count: 0, duration, error: errorMsg };
  }
}

// ==================== HIBP 同步 ====================
export async function syncHIBP(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const rawData = await googleSheetsService.getHIBPData();
    
    let count = 0;
    for (const row of rawData) {
      if (!row.Email || !row.BreachName) continue;
      
      await prisma.hIBPBreach.upsert({
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
      });
      count++;
    }
    
    const duration = Date.now() - startTime;
    await logSync('hibp', 'success', count, duration);
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
}

export async function syncAll(): Promise<SyncAllResult> {
  const results: SyncAllResult = {
    kb4: { success: false, count: 0, duration: 0 },
    ncm: { success: false, count: 0, duration: 0 },
    edr: { success: false, count: 0, duration: 0 },
    hibp: { success: false, count: 0, duration: 0 },
  };
  
  results.kb4 = await syncKB4();
  results.ncm = await syncNCM();
  results.edr = await syncEDR();
  results.hibp = await syncHIBP();
  
  return results;
}
