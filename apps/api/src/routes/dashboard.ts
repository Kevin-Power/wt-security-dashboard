import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';

// 風險等級定義
const RISK_THRESHOLDS = {
  HIGH_RISK_SCORE: 50,      // KB4 高風險分數門檻
  HIGH_PHISH_RATE: 20,      // 釣魚易受騙率門檻 (%)
};

export async function dashboardRoutes(app: FastifyInstance) {
  
  // GET /api/dashboard - 總覽儀表板
  app.get('/api/dashboard', async () => {
    const [kb4Stats, ncmStats, edrStats, hibpStats] = await Promise.all([
      getKB4Stats(),
      getNCMStats(),
      getEDRStats(),
      getHIBPStats(),
    ]);

    // 計算整體風險分數 (0-100)
    const overallRiskScore = calculateOverallRisk(kb4Stats, ncmStats, edrStats, hibpStats);

    return {
      timestamp: new Date().toISOString(),
      overallRiskScore,
      riskLevel: getRiskLevel(overallRiskScore),
      sources: {
        kb4: kb4Stats,
        ncm: ncmStats,
        edr: edrStats,
        hibp: hibpStats,
      },
    };
  });

  // GET /api/dashboard/summary - 簡化摘要
  app.get('/api/dashboard/summary', async () => {
    const [kb4, ncm, edr, hibp] = await Promise.all([
      prisma.kB4User.count({ where: { status: 'active' } }),
      prisma.nCMDevice.count(),
      prisma.eDRAlert.count({ where: { status: 'new' } }),
      prisma.hIBPBreach.count({ where: { status: 'new' } }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      counts: {
        kb4_users: kb4,
        ncm_devices: ncm,
        edr_pending_alerts: edr,
        hibp_new_breaches: hibp,
      },
    };
  });
}

// KB4 統計
async function getKB4Stats() {
  const [total, highRisk, avgStats] = await Promise.all([
    prisma.kB4User.count({ where: { status: 'active' } }),
    prisma.kB4User.count({
      where: {
        status: 'active',
        OR: [
          { currentRiskScore: { gte: RISK_THRESHOLDS.HIGH_RISK_SCORE } },
          { phishPronePercentage: { gte: RISK_THRESHOLDS.HIGH_PHISH_RATE } },
        ],
      },
    }),
    prisma.kB4User.aggregate({
      where: { status: 'active' },
      _avg: {
        currentRiskScore: true,
        phishPronePercentage: true,
      },
    }),
  ]);

  return {
    totalUsers: total,
    highRiskUsers: highRisk,
    avgRiskScore: Math.round((avgStats._avg.currentRiskScore || 0) * 100) / 100,
    avgPhishProneRate: Math.round((avgStats._avg.phishPronePercentage || 0) * 100) / 100,
    riskPercentage: total > 0 ? Math.round((highRisk / total) * 100) : 0,
  };
}

// NCM 統計
async function getNCMStats() {
  const [total, p0, p1, p3, avgCvss] = await Promise.all([
    prisma.nCMDevice.count(),
    prisma.nCMDevice.count({ where: { updatePriority: 'P0-Immediate' } }),
    prisma.nCMDevice.count({ where: { updatePriority: 'P1-NextCycle' } }),
    prisma.nCMDevice.count({ where: { updatePriority: 'P3-Monitor' } }),
    prisma.nCMDevice.aggregate({
      _avg: { maxCvss: true },
      _sum: { totalCveInstances: true },
    }),
  ]);

  return {
    totalDevices: total,
    byPriority: {
      p0_immediate: p0,
      p1_next_cycle: p1,
      p3_monitor: p3,
    },
    avgMaxCvss: Math.round((avgCvss._avg.maxCvss || 0) * 10) / 10,
    totalCveInstances: avgCvss._sum.totalCveInstances || 0,
    criticalPercentage: total > 0 ? Math.round((p0 / total) * 100) : 0,
  };
}

// EDR 統計
async function getEDRStats() {
  const [total, byStatus, bySeverity] = await Promise.all([
    prisma.eDRAlert.count(),
    prisma.eDRAlert.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.eDRAlert.groupBy({
      by: ['severity'],
      _count: true,
    }),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map(s => [s.status, s._count])
  );
  const severityMap = Object.fromEntries(
    bySeverity.map(s => [s.severity, s._count])
  );

  const pendingCount = (statusMap['new'] || 0) + (statusMap['investigating'] || 0);

  return {
    totalAlerts: total,
    byStatus: {
      new: statusMap['new'] || 0,
      investigating: statusMap['investigating'] || 0,
      resolved: statusMap['resolved'] || 0,
      false_positive: statusMap['false_positive'] || 0,
    },
    bySeverity: {
      critical: severityMap['Critical'] || 0,
      high: severityMap['High'] || 0,
      medium: severityMap['Medium'] || 0,
      low: severityMap['Low'] || 0,
    },
    pendingCount,
    pendingPercentage: total > 0 ? Math.round((pendingCount / total) * 100) : 0,
  };
}

// HIBP 統計
async function getHIBPStats() {
  const [total, byStatus, recentCount] = await Promise.all([
    prisma.hIBPBreach.count(),
    prisma.hIBPBreach.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.hIBPBreach.count({
      where: {
        discoveredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      },
    }),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map(s => [s.status, s._count])
  );

  return {
    totalBreaches: total,
    byStatus: {
      new: statusMap['new'] || 0,
      notified: statusMap['notified'] || 0,
      password_reset: statusMap['password_reset'] || 0,
      resolved: statusMap['resolved'] || 0,
    },
    recentBreaches: recentCount,
    pendingCount: statusMap['new'] || 0,
  };
}

// 計算整體風險分數 (0-100)
function calculateOverallRisk(
  kb4: Awaited<ReturnType<typeof getKB4Stats>>,
  ncm: Awaited<ReturnType<typeof getNCMStats>>,
  edr: Awaited<ReturnType<typeof getEDRStats>>,
  hibp: Awaited<ReturnType<typeof getHIBPStats>>
): number {
  // 權重分配
  const weights = {
    kb4: 0.20,   // 20% 人員風險
    ncm: 0.35,   // 35% 基礎設施風險
    edr: 0.30,   // 30% 威脅偵測
    hibp: 0.15,  // 15% 帳號外洩
  };

  // KB4 風險分數 (基於高風險用戶比例和平均風險分數)
  const kb4Score = Math.min(100, kb4.riskPercentage * 2 + kb4.avgRiskScore);

  // NCM 風險分數 (基於 P0 設備比例和平均 CVSS)
  const ncmScore = Math.min(100, ncm.criticalPercentage * 3 + ncm.avgMaxCvss * 8);

  // EDR 風險分數 (基於待處理警示和高嚴重性比例)
  const highSeverityRatio = edr.totalAlerts > 0 
    ? ((edr.bySeverity.critical + edr.bySeverity.high) / edr.totalAlerts) * 100 
    : 0;
  const edrScore = Math.min(100, edr.pendingPercentage + highSeverityRatio);

  // HIBP 風險分數 (基於待處理外洩數)
  const hibpScore = Math.min(100, hibp.pendingCount * 10);

  // 加權總分
  const totalScore = 
    kb4Score * weights.kb4 +
    ncmScore * weights.ncm +
    edrScore * weights.edr +
    hibpScore * weights.hibp;

  return Math.round(totalScore);
}

// 風險等級判定
function getRiskLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'minimal';
}
