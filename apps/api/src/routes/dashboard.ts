import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { cache, CacheKeys, CacheTTL } from '../services/cache.js';
import {
  riskConfig,
  getRiskLevel,
  getRiskColor,
  getRiskConfig,
  updateRiskWeights,
  type RiskWeights,
} from '../config/risk-weights.js';

// 統計結果類型
interface KB4Stats {
  totalUsers: number;
  highRiskUsers: number;
  avgRiskScore: number;
  avgPhishProneRate: number;
  riskPercentage: number;
  score: number;
}

interface NCMStats {
  totalDevices: number;
  byPriority: {
    p0_immediate: number;
    p1_next_cycle: number;
    p3_monitor: number;
  };
  avgMaxCvss: number;
  totalCveInstances: number;
  criticalPercentage: number;
  score: number;
}

interface EDRStats {
  totalAlerts: number;
  byStatus: {
    new: number;
    investigating: number;
    resolved: number;
    false_positive: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  pendingCount: number;
  pendingPercentage: number;
  highSeverityPercentage: number;
  score: number;
}

interface HIBPStats {
  totalBreaches: number;
  byStatus: {
    new: number;
    notified: number;
    password_reset: number;
    resolved: number;
  };
  recentBreaches: number;
  pendingCount: number;
  score: number;
}

interface DashboardData {
  timestamp: string;
  overallRiskScore: number;
  riskLevel: string;
  riskColor: string;
  weights: RiskWeights;
  sources: {
    kb4: KB4Stats;
    ncm: NCMStats;
    edr: EDRStats;
    hibp: HIBPStats;
  };
  dataQuality: {
    hasData: boolean;
    warnings: string[];
  };
}

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard - 總覽儀表板 (帶緩存)
  app.get('/api/dashboard', async (): Promise<DashboardData> => {
    return cache.wrap(
      CacheKeys.DASHBOARD,
      async () => {
        const [kb4Stats, ncmStats, edrStats, hibpStats] = await Promise.all([
          getKB4Stats(),
          getNCMStats(),
          getEDRStats(),
          getHIBPStats(),
        ]);

        // 計算整體風險分數
        const overallRiskScore = calculateOverallRisk(kb4Stats, ncmStats, edrStats, hibpStats);
        const riskLevel = getRiskLevel(overallRiskScore);

        // 數據品質檢查
        const dataQuality = checkDataQuality(kb4Stats, ncmStats, edrStats, hibpStats);

        return {
          timestamp: new Date().toISOString(),
          overallRiskScore,
          riskLevel,
          riskColor: getRiskColor(riskLevel),
          weights: riskConfig.weights,
          sources: {
            kb4: kb4Stats,
            ncm: ncmStats,
            edr: edrStats,
            hibp: hibpStats,
          },
          dataQuality,
        };
      },
      CacheTTL.DASHBOARD
    );
  });

  // GET /api/dashboard/summary - 簡化摘要 (帶緩存)
  app.get('/api/dashboard/summary', async () => {
    return cache.wrap(
      CacheKeys.DASHBOARD_SUMMARY,
      async () => {
        const [kb4, ncm, edrNew, edrInvestigating, hibp, lastSync] = await Promise.all([
          prisma.kB4User.count({ where: { status: 'active' } }),
          prisma.nCMDevice.count(),
          prisma.eDRAlert.count({ where: { status: 'new' } }),
          prisma.eDRAlert.count({ where: { status: 'investigating' } }),
          prisma.hIBPBreach.count({ where: { status: 'new' } }),
          prisma.syncLog.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, status: true },
          }),
        ]);

        return {
          timestamp: new Date().toISOString(),
          counts: {
            kb4_users: kb4,
            ncm_devices: ncm,
            edr_pending_alerts: edrNew + edrInvestigating,
            edr_new_alerts: edrNew,
            hibp_new_breaches: hibp,
          },
          lastSync: lastSync
            ? {
                at: lastSync.createdAt.toISOString(),
                status: lastSync.status,
              }
            : null,
        };
      },
      CacheTTL.SUMMARY
    );
  });

  // GET /api/dashboard/config - 獲取風險配置
  app.get('/api/dashboard/config', async () => {
    return {
      timestamp: new Date().toISOString(),
      config: getRiskConfig(),
    };
  });

  // PUT /api/dashboard/weights - 更新風險權重 (需要管理員權限)
  app.put<{ Body: Partial<RiskWeights> }>('/api/dashboard/weights', async (request) => {
    const newWeights = request.body;
    const updated = updateRiskWeights(newWeights);

    // 清除儀表板緩存
    await cache.del(CacheKeys.DASHBOARD);

    return {
      timestamp: new Date().toISOString(),
      weights: updated,
      message: 'Risk weights updated successfully',
    };
  });

  // GET /api/dashboard/breakdown - 風險分解詳情
  app.get('/api/dashboard/breakdown', async () => {
    const [kb4Stats, ncmStats, edrStats, hibpStats] = await Promise.all([
      getKB4Stats(),
      getNCMStats(),
      getEDRStats(),
      getHIBPStats(),
    ]);

    const { weights, factors } = riskConfig;

    return {
      timestamp: new Date().toISOString(),
      breakdown: {
        kb4: {
          weight: weights.kb4,
          rawScore: kb4Stats.score,
          weightedScore: kb4Stats.score * weights.kb4,
          factors: {
            riskPercentage: kb4Stats.riskPercentage,
            avgRiskScore: kb4Stats.avgRiskScore,
          },
        },
        ncm: {
          weight: weights.ncm,
          rawScore: ncmStats.score,
          weightedScore: ncmStats.score * weights.ncm,
          factors: {
            criticalPercentage: ncmStats.criticalPercentage,
            avgMaxCvss: ncmStats.avgMaxCvss,
          },
        },
        edr: {
          weight: weights.edr,
          rawScore: edrStats.score,
          weightedScore: edrStats.score * weights.edr,
          factors: {
            pendingPercentage: edrStats.pendingPercentage,
            highSeverityPercentage: edrStats.highSeverityPercentage,
          },
        },
        hibp: {
          weight: weights.hibp,
          rawScore: hibpStats.score,
          weightedScore: hibpStats.score * weights.hibp,
          factors: {
            pendingCount: hibpStats.pendingCount,
          },
        },
      },
      calculationFactors: factors,
    };
  });
}

// KB4 統計 - 優化查詢
async function getKB4Stats(): Promise<KB4Stats> {
  const { thresholds, factors } = riskConfig;

  // 使用單一聚合查詢減少數據庫往返
  const [counts, avgStats] = await Promise.all([
    prisma.$queryRaw<
      Array<{ total: bigint; high_risk: bigint }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as total,
        COUNT(*) FILTER (
          WHERE status = 'active'
          AND (current_risk_score >= ${thresholds.kb4HighRiskScore}
               OR phish_prone_percentage >= ${thresholds.kb4HighPhishRate})
        ) as high_risk
      FROM kb4_users
    `,
    prisma.kB4User.aggregate({
      where: { status: 'active' },
      _avg: {
        currentRiskScore: true,
        phishPronePercentage: true,
      },
    }),
  ]);

  const total = Number(counts[0]?.total ?? 0);
  const highRisk = Number(counts[0]?.high_risk ?? 0);
  const avgRiskScore = Math.round((avgStats._avg.currentRiskScore || 0) * 100) / 100;
  const avgPhishProneRate = Math.round((avgStats._avg.phishPronePercentage || 0) * 100) / 100;
  const riskPercentage = total > 0 ? Math.round((highRisk / total) * 100) : 0;

  // 計算 KB4 風險分數
  const score = Math.min(
    100,
    riskPercentage * factors.kb4RiskPercentageMultiplier +
      avgRiskScore * factors.kb4AvgScoreWeight
  );

  return {
    totalUsers: total,
    highRiskUsers: highRisk,
    avgRiskScore,
    avgPhishProneRate,
    riskPercentage,
    score,
  };
}

// NCM 統計 - 優化查詢
async function getNCMStats(): Promise<NCMStats> {
  const { factors } = riskConfig;

  // 使用單一聚合查詢
  const [priorityCounts, cvssStats] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        total: bigint;
        p0: bigint;
        p1: bigint;
        p3: bigint;
      }>
    >`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE update_priority = 'P0-Immediate') as p0,
        COUNT(*) FILTER (WHERE update_priority = 'P1-NextCycle') as p1,
        COUNT(*) FILTER (WHERE update_priority = 'P3-Monitor') as p3
      FROM ncm_devices
    `,
    prisma.nCMDevice.aggregate({
      _avg: { maxCvss: true },
      _sum: { totalCveInstances: true },
    }),
  ]);

  const total = Number(priorityCounts[0]?.total ?? 0);
  const p0 = Number(priorityCounts[0]?.p0 ?? 0);
  const p1 = Number(priorityCounts[0]?.p1 ?? 0);
  const p3 = Number(priorityCounts[0]?.p3 ?? 0);
  const avgMaxCvss = Math.round((cvssStats._avg.maxCvss || 0) * 10) / 10;
  const totalCveInstances = cvssStats._sum.totalCveInstances || 0;
  const criticalPercentage = total > 0 ? Math.round((p0 / total) * 100) : 0;

  // 計算 NCM 風險分數
  const score = Math.min(
    100,
    criticalPercentage * factors.ncmCriticalPercentageMultiplier +
      avgMaxCvss * factors.ncmCvssMultiplier
  );

  return {
    totalDevices: total,
    byPriority: {
      p0_immediate: p0,
      p1_next_cycle: p1,
      p3_monitor: p3,
    },
    avgMaxCvss,
    totalCveInstances,
    criticalPercentage,
    score,
  };
}

// EDR 統計 - 優化查詢
async function getEDRStats(): Promise<EDRStats> {
  const { factors } = riskConfig;

  // 使用單一聚合查詢
  const result = await prisma.$queryRaw<
    Array<{
      total: bigint;
      new_count: bigint;
      investigating: bigint;
      resolved: bigint;
      false_positive: bigint;
      critical_count: bigint;
      high_count: bigint;
      medium_count: bigint;
      low_count: bigint;
    }>
  >`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_count,
      COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'false_positive') as false_positive,
      COUNT(*) FILTER (WHERE severity = 'Critical') as critical_count,
      COUNT(*) FILTER (WHERE severity = 'High') as high_count,
      COUNT(*) FILTER (WHERE severity = 'Medium') as medium_count,
      COUNT(*) FILTER (WHERE severity = 'Low') as low_count
    FROM edr_alerts
  `;

  const data = result[0];
  const total = Number(data?.total ?? 0);
  const newCount = Number(data?.new_count ?? 0);
  const investigating = Number(data?.investigating ?? 0);
  const resolved = Number(data?.resolved ?? 0);
  const falsePositive = Number(data?.false_positive ?? 0);
  const critical = Number(data?.critical_count ?? 0);
  const high = Number(data?.high_count ?? 0);
  const medium = Number(data?.medium_count ?? 0);
  const low = Number(data?.low_count ?? 0);

  const pendingCount = newCount + investigating;
  const pendingPercentage = total > 0 ? Math.round((pendingCount / total) * 100) : 0;
  const highSeverityPercentage =
    total > 0 ? Math.round(((critical + high) / total) * 100) : 0;

  // 計算 EDR 風險分數
  const score = Math.min(
    100,
    pendingPercentage * factors.edrPendingWeight +
      highSeverityPercentage * factors.edrHighSeverityWeight
  );

  return {
    totalAlerts: total,
    byStatus: {
      new: newCount,
      investigating,
      resolved,
      false_positive: falsePositive,
    },
    bySeverity: {
      critical,
      high,
      medium,
      low,
    },
    pendingCount,
    pendingPercentage,
    highSeverityPercentage,
    score,
  };
}

// HIBP 統計 - 優化查詢
async function getHIBPStats(): Promise<HIBPStats> {
  const { factors } = riskConfig;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 使用單一聚合查詢
  const result = await prisma.$queryRaw<
    Array<{
      total: bigint;
      new_count: bigint;
      notified: bigint;
      password_reset: bigint;
      resolved: bigint;
      recent: bigint;
    }>
  >`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_count,
      COUNT(*) FILTER (WHERE status = 'notified') as notified,
      COUNT(*) FILTER (WHERE status = 'password_reset') as password_reset,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE discovered_at >= ${sevenDaysAgo}) as recent
    FROM hibp_breaches
  `;

  const data = result[0];
  const total = Number(data?.total ?? 0);
  const newCount = Number(data?.new_count ?? 0);
  const notified = Number(data?.notified ?? 0);
  const passwordReset = Number(data?.password_reset ?? 0);
  const resolved = Number(data?.resolved ?? 0);
  const recent = Number(data?.recent ?? 0);

  // 計算 HIBP 風險分數
  const score = Math.min(100, newCount * factors.hibpPendingMultiplier);

  return {
    totalBreaches: total,
    byStatus: {
      new: newCount,
      notified,
      password_reset: passwordReset,
      resolved,
    },
    recentBreaches: recent,
    pendingCount: newCount,
    score,
  };
}

// 計算整體風險分數
function calculateOverallRisk(
  kb4: KB4Stats,
  ncm: NCMStats,
  edr: EDRStats,
  hibp: HIBPStats
): number {
  const { weights } = riskConfig;

  const totalScore =
    kb4.score * weights.kb4 +
    ncm.score * weights.ncm +
    edr.score * weights.edr +
    hibp.score * weights.hibp;

  return Math.round(totalScore);
}

// 數據品質檢查
function checkDataQuality(
  kb4: KB4Stats,
  ncm: NCMStats,
  edr: EDRStats,
  hibp: HIBPStats
): { hasData: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (kb4.totalUsers === 0) {
    warnings.push('No KB4 user data available');
  }
  if (ncm.totalDevices === 0) {
    warnings.push('No NCM device data available');
  }
  if (edr.totalAlerts === 0) {
    warnings.push('No EDR alert data available');
  }
  if (hibp.totalBreaches === 0) {
    warnings.push('No HIBP breach data available');
  }

  // 檢查數據是否太舊
  // 這可以通過檢查最後同步時間來實現

  return {
    hasData: kb4.totalUsers > 0 || ncm.totalDevices > 0 || edr.totalAlerts > 0 || hibp.totalBreaches > 0,
    warnings,
  };
}
