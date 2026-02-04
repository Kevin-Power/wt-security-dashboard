import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';

export async function trendsRoutes(app: FastifyInstance) {

  // GET /api/trends/daily - 取得每日快照
  app.get('/api/trends/daily', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

    return {
      data: snapshots,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        days: daysNum,
      },
    };
  });

  // POST /api/trends/snapshot - 建立今日快照
  app.post('/api/trends/snapshot', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 收集各來源指標
    const [kb4Stats, ncmStats, edrStats, hibpStats] = await Promise.all([
      collectKB4Stats(),
      collectNCMStats(),
      collectEDRStats(),
      collectHIBPStats(),
    ]);

    // 計算整體風險分數
    const overallRiskScore = calculateRiskScore(kb4Stats, ncmStats, edrStats, hibpStats);

    // 建立或更新快照
    const snapshot = await prisma.dailySnapshot.upsert({
      where: { date: today },
      create: {
        date: today,
        ...kb4Stats,
        ...ncmStats,
        ...edrStats,
        ...hibpStats,
        overallRiskScore,
      },
      update: {
        ...kb4Stats,
        ...ncmStats,
        ...edrStats,
        ...hibpStats,
        overallRiskScore,
      },
    });

    return snapshot;
  });

  // GET /api/trends/risk-score - 風險分數趨勢
  app.get('/api/trends/risk-score', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        overallRiskScore: true,
      },
    });

    return snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      riskScore: s.overallRiskScore,
    }));
  });

  // GET /api/trends/kb4 - KB4 趨勢
  app.get('/api/trends/kb4', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        kb4TotalUsers: true,
        kb4HighRiskUsers: true,
        kb4AvgRiskScore: true,
        kb4AvgPhishProneRate: true,
      },
    });

    return snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      totalUsers: s.kb4TotalUsers,
      highRiskUsers: s.kb4HighRiskUsers,
      avgRiskScore: s.kb4AvgRiskScore,
      avgPhishProneRate: s.kb4AvgPhishProneRate,
    }));
  });

  // GET /api/trends/ncm - NCM 趨勢
  app.get('/api/trends/ncm', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        ncmTotalDevices: true,
        ncmP0Devices: true,
        ncmP1Devices: true,
        ncmTotalCves: true,
      },
    });

    return snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      totalDevices: s.ncmTotalDevices,
      p0Devices: s.ncmP0Devices,
      p1Devices: s.ncmP1Devices,
      totalCves: s.ncmTotalCves,
    }));
  });

  // GET /api/trends/edr - EDR 趨勢
  app.get('/api/trends/edr', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        edrTotalAlerts: true,
        edrHighAlerts: true,
        edrPendingAlerts: true,
        edrResolvedAlerts: true,
      },
    });

    return snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      totalAlerts: s.edrTotalAlerts,
      highAlerts: s.edrHighAlerts,
      pendingAlerts: s.edrPendingAlerts,
      resolvedAlerts: s.edrResolvedAlerts,
    }));
  });

  // GET /api/trends/hibp - HIBP 趨勢
  app.get('/api/trends/hibp', async (request) => {
    const { days = '30' } = request.query as { days?: string };
    const daysNum = Math.min(parseInt(days, 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        hibpTotalBreaches: true,
        hibpNewBreaches: true,
        hibpPendingBreaches: true,
      },
    });

    return snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      totalBreaches: s.hibpTotalBreaches,
      newBreaches: s.hibpNewBreaches,
      pendingBreaches: s.hibpPendingBreaches,
    }));
  });

  // GET /api/trends/comparison - 與上週比較
  app.get('/api/trends/comparison', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const [todaySnapshot, lastWeekSnapshot] = await Promise.all([
      prisma.dailySnapshot.findUnique({ where: { date: today } }),
      prisma.dailySnapshot.findUnique({ where: { date: lastWeek } }),
    ]);

    if (!todaySnapshot || !lastWeekSnapshot) {
      return { error: 'Insufficient data for comparison' };
    }

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      riskScore: {
        current: todaySnapshot.overallRiskScore,
        previous: lastWeekSnapshot.overallRiskScore,
        change: calcChange(todaySnapshot.overallRiskScore, lastWeekSnapshot.overallRiskScore),
      },
      kb4HighRisk: {
        current: todaySnapshot.kb4HighRiskUsers,
        previous: lastWeekSnapshot.kb4HighRiskUsers,
        change: calcChange(todaySnapshot.kb4HighRiskUsers, lastWeekSnapshot.kb4HighRiskUsers),
      },
      ncmP0: {
        current: todaySnapshot.ncmP0Devices,
        previous: lastWeekSnapshot.ncmP0Devices,
        change: calcChange(todaySnapshot.ncmP0Devices, lastWeekSnapshot.ncmP0Devices),
      },
      edrPending: {
        current: todaySnapshot.edrPendingAlerts,
        previous: lastWeekSnapshot.edrPendingAlerts,
        change: calcChange(todaySnapshot.edrPendingAlerts, lastWeekSnapshot.edrPendingAlerts),
      },
      hibpNew: {
        current: todaySnapshot.hibpNewBreaches,
        previous: lastWeekSnapshot.hibpNewBreaches,
        change: calcChange(todaySnapshot.hibpNewBreaches, lastWeekSnapshot.hibpNewBreaches),
      },
    };
  });
}

// 收集 KB4 指標
async function collectKB4Stats() {
  const [total, highRisk, avgStats] = await Promise.all([
    prisma.kB4User.count({ where: { status: 'active' } }),
    prisma.kB4User.count({
      where: {
        status: 'active',
        OR: [{ currentRiskScore: { gte: 50 } }, { phishPronePercentage: { gte: 20 } }],
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
    kb4AvgRiskScore: Math.round((avgStats._avg.currentRiskScore || 0) * 100) / 100,
    kb4AvgPhishProneRate: Math.round((avgStats._avg.phishPronePercentage || 0) * 100) / 100,
  };
}

// 收集 NCM 指標
async function collectNCMStats() {
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

// 收集 EDR 指標
async function collectEDRStats() {
  const [total, high, pending, resolved] = await Promise.all([
    prisma.eDRAlert.count(),
    prisma.eDRAlert.count({ where: { severity: { in: ['High', 'Critical'] } } }),
    prisma.eDRAlert.count({ where: { status: { in: ['new', 'investigating'] } } }),
    prisma.eDRAlert.count({ where: { status: 'resolved' } }),
  ]);

  return {
    edrTotalAlerts: total,
    edrHighAlerts: high,
    edrPendingAlerts: pending,
    edrResolvedAlerts: resolved,
  };
}

// 收集 HIBP 指標
async function collectHIBPStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, newToday, pending] = await Promise.all([
    prisma.hIBPBreach.count(),
    prisma.hIBPBreach.count({ where: { discoveredAt: { gte: today } } }),
    prisma.hIBPBreach.count({ where: { status: 'new' } }),
  ]);

  return {
    hibpTotalBreaches: total,
    hibpNewBreaches: newToday,
    hibpPendingBreaches: pending,
  };
}

// 計算風險分數
function calculateRiskScore(
  kb4: Awaited<ReturnType<typeof collectKB4Stats>>,
  ncm: Awaited<ReturnType<typeof collectNCMStats>>,
  edr: Awaited<ReturnType<typeof collectEDRStats>>,
  hibp: Awaited<ReturnType<typeof collectHIBPStats>>
): number {
  const kb4Score = Math.min(100, (kb4.kb4HighRiskUsers / Math.max(kb4.kb4TotalUsers, 1)) * 200 + kb4.kb4AvgRiskScore);
  const ncmScore = Math.min(100, (ncm.ncmP0Devices / Math.max(ncm.ncmTotalDevices, 1)) * 300);
  const edrScore = Math.min(100, (edr.edrPendingAlerts / Math.max(edr.edrTotalAlerts, 1)) * 100 + (edr.edrHighAlerts / Math.max(edr.edrTotalAlerts, 1)) * 100);
  const hibpScore = Math.min(100, hibp.hibpPendingBreaches * 10);

  return Math.round(kb4Score * 0.2 + ncmScore * 0.35 + edrScore * 0.3 + hibpScore * 0.15);
}
