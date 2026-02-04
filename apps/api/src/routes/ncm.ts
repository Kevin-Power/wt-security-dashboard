import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  priority: z.enum(['P0-Immediate', 'P1-NextCycle', 'P3-Monitor']).optional(),
  hwModel: z.string().optional(),
  fwSeries: z.string().optional(),
  minCvss: z.coerce.number().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['maxCvss', 'totalCveInstances', 'deviceName', 'updatePriority']).default('maxCvss'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function ncmRoutes(app: FastifyInstance) {

  // GET /api/ncm/devices - 設備列表
  app.get('/api/ncm/devices', async (request) => {
    const query = querySchema.parse(request.query);
    const { page, limit, priority, hwModel, fwSeries, minCvss, search, sortBy, sortOrder } = query;

    const where: any = {};
    if (priority) where.updatePriority = priority;
    if (hwModel) where.hwModel = { contains: hwModel };
    if (fwSeries) where.fwSeries = { contains: fwSeries };
    if (minCvss) where.maxCvss = { gte: minCvss };
    if (search) {
      where.OR = [
        { deviceName: { contains: search, mode: 'insensitive' } },
        { deviceIp: { contains: search } },
      ];
    }

    const [devices, total] = await Promise.all([
      prisma.nCMDevice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.nCMDevice.count({ where }),
    ]);

    return {
      data: devices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // GET /api/ncm/devices/:id - 單一設備
  app.get('/api/ncm/devices/:id', async (request) => {
    const { id } = request.params as { id: string };
    const device = await prisma.nCMDevice.findUnique({ where: { id } });
    if (!device) return { error: 'Device not found', statusCode: 404 };
    return device;
  });

  // GET /api/ncm/stats - 統計
  app.get('/api/ncm/stats', async () => {
    const [total, byPriority, avgStats] = await Promise.all([
      prisma.nCMDevice.count(),
      prisma.nCMDevice.groupBy({
        by: ['updatePriority'],
        _count: true,
      }),
      prisma.nCMDevice.aggregate({
        _avg: { maxCvss: true },
        _sum: { totalCveInstances: true, maxKevActiveExploit: true },
        _max: { maxCvss: true },
      }),
    ]);

    const priorityMap = Object.fromEntries(
      byPriority.map(p => [p.updatePriority, p._count])
    );

    return {
      totalDevices: total,
      byPriority: {
        p0_immediate: priorityMap['P0-Immediate'] || 0,
        p1_next_cycle: priorityMap['P1-NextCycle'] || 0,
        p3_monitor: priorityMap['P3-Monitor'] || 0,
      },
      cvss: {
        average: Math.round((avgStats._avg.maxCvss || 0) * 10) / 10,
        maximum: avgStats._max.maxCvss || 0,
      },
      totals: {
        cveInstances: avgStats._sum.totalCveInstances || 0,
        kevExploits: avgStats._sum.maxKevActiveExploit || 0,
      },
    };
  });

  // GET /api/ncm/by-priority - 按優先級分組
  app.get('/api/ncm/by-priority', async () => {
    const priorities = ['P0-Immediate', 'P1-NextCycle', 'P3-Monitor'];
    const results = await Promise.all(
      priorities.map(async (priority) => {
        const [count, devices] = await Promise.all([
          prisma.nCMDevice.count({ where: { updatePriority: priority } }),
          prisma.nCMDevice.findMany({
            where: { updatePriority: priority },
            orderBy: { maxCvss: 'desc' },
            take: 10,
            select: {
              id: true,
              deviceName: true,
              deviceIp: true,
              hwModel: true,
              fwVersion: true,
              maxCvss: true,
              totalCveInstances: true,
              actionRequired: true,
            },
          }),
        ]);
        return { priority, count, topDevices: devices };
      })
    );
    return results;
  });

  // GET /api/ncm/by-model - 按型號分析
  app.get('/api/ncm/by-model', async () => {
    const models = await prisma.nCMDevice.groupBy({
      by: ['hwModel'],
      where: { hwModel: { not: null } },
      _count: true,
      _avg: { maxCvss: true },
      _sum: { totalCveInstances: true },
    });

    return models
      .filter(m => m.hwModel)
      .map(m => ({
        hwModel: m.hwModel,
        deviceCount: m._count,
        avgMaxCvss: Math.round((m._avg.maxCvss || 0) * 10) / 10,
        totalCves: m._sum.totalCveInstances || 0,
      }))
      .sort((a, b) => b.deviceCount - a.deviceCount);
  });

  // GET /api/ncm/by-firmware - 按韌體版本分析
  app.get('/api/ncm/by-firmware', async () => {
    const firmwares = await prisma.nCMDevice.groupBy({
      by: ['fwSeries', 'fwVersion'],
      _count: true,
      _avg: { maxCvss: true },
    });

    return firmwares
      .map(f => ({
        fwSeries: f.fwSeries || 'Unknown',
        fwVersion: f.fwVersion || 'Unknown',
        deviceCount: f._count,
        avgMaxCvss: Math.round((f._avg.maxCvss || 0) * 10) / 10,
      }))
      .sort((a, b) => b.avgMaxCvss - a.avgMaxCvss);
  });

  // GET /api/ncm/critical - 需立即處理的設備
  app.get('/api/ncm/critical', async (request) => {
    const { limit = '50' } = request.query as { limit?: string };

    const devices = await prisma.nCMDevice.findMany({
      where: { updatePriority: 'P0-Immediate' },
      orderBy: { maxCvss: 'desc' },
      take: parseInt(limit, 10),
    });

    return { data: devices, count: devices.length };
  });
}
