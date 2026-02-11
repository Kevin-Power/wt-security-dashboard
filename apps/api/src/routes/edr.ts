import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['new', 'investigating', 'resolved', 'false_positive']).optional(),
  hostname: z.string().optional(),
  vtVerdict: z.enum(['malicious', 'suspicious', 'clean', 'not_found']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['detectedAt', 'severity', 'hostname', 'status']).default('detectedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const updateStatusSchema = z.object({
  status: z.enum(['new', 'investigating', 'resolved', 'false_positive']),
  assignedTo: z.string().optional(),
});

export async function edrRoutes(app: FastifyInstance) {

  // GET /api/edr/alerts - 警示列表
  app.get('/api/edr/alerts', async (request) => {
    const query = querySchema.parse(request.query);
    const { page, limit, severity, status, hostname, vtVerdict, startDate, endDate, search, sortBy, sortOrder } = query;

    const where: any = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (hostname) where.hostname = { contains: hostname, mode: 'insensitive' };
    if (vtVerdict) where.vtVerdict = vtVerdict;
    if (startDate || endDate) {
      where.detectedAt = {};
      if (startDate) where.detectedAt.gte = new Date(startDate);
      if (endDate) where.detectedAt.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { hostname: { contains: search, mode: 'insensitive' } },
        { ioaName: { contains: search, mode: 'insensitive' } },
        { filePath: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [alerts, total] = await Promise.all([
      prisma.eDRAlert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.eDRAlert.count({ where }),
    ]);

    return {
      data: alerts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // GET /api/edr/alerts/:id - 單一警示
  app.get('/api/edr/alerts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = await prisma.eDRAlert.findUnique({ where: { id } });
    if (!alert) {
      reply.code(404).send({ error: 'Alert not found' });
      return;
    }
    return alert;
  });

  // PATCH /api/edr/alerts/:id - 更新警示狀態
  app.patch('/api/edr/alerts/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = updateStatusSchema.parse(request.body);

    const updateData: any = { status: body.status };
    if (body.assignedTo) updateData.assignedTo = body.assignedTo;
    if (body.status === 'resolved' || body.status === 'false_positive') {
      updateData.resolvedAt = new Date();
    }

    const alert = await prisma.eDRAlert.update({
      where: { id },
      data: updateData,
    });

    return alert;
  });

  // POST /api/edr/alerts/bulk-update - 批次更新狀態
  app.post('/api/edr/alerts/bulk-update', async (request) => {
    const bulkUpdateSchema = z.object({
      ids: z.array(z.string()).min(1),
      status: z.enum(['new', 'investigating', 'resolved', 'false_positive']),
      assignedTo: z.string().optional(),
    });
    const { ids, status, assignedTo } = bulkUpdateSchema.parse(request.body);

    const updateData: any = { status };
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (status === 'resolved' || status === 'false_positive') {
      updateData.resolvedAt = new Date();
    }

    const result = await prisma.eDRAlert.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return { updated: result.count };
  });

  // GET /api/edr/stats - 統計
  app.get('/api/edr/stats', async () => {
    const [total, byStatus, bySeverity, byVtVerdict, recent24h] = await Promise.all([
      prisma.eDRAlert.count(),
      prisma.eDRAlert.groupBy({ by: ['status'], _count: true }),
      prisma.eDRAlert.groupBy({ by: ['severity'], _count: true }),
      prisma.eDRAlert.groupBy({ by: ['vtVerdict'], _count: true }),
      prisma.eDRAlert.count({
        where: { detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return {
      totalAlerts: total,
      recent24h,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count])),
      byVtVerdict: Object.fromEntries(byVtVerdict.map(v => [v.vtVerdict || 'unknown', v._count])),
    };
  });

  // GET /api/edr/by-hostname - 按主機分析
  app.get('/api/edr/by-hostname', async () => {
    const hostnames = await prisma.eDRAlert.groupBy({
      by: ['hostname'],
      _count: true,
      orderBy: { _count: { hostname: 'desc' } },
      take: 20,
    });

    return hostnames.map(h => ({
      hostname: h.hostname,
      alertCount: h._count,
    }));
  });

  // GET /api/edr/by-ioa - 按 IOA 類型分析
  app.get('/api/edr/by-ioa', async () => {
    const ioas = await prisma.eDRAlert.groupBy({
      by: ['ioaName'],
      _count: true,
      orderBy: { _count: { ioaName: 'desc' } },
      take: 20,
    });

    return ioas.map(i => ({
      ioaName: i.ioaName,
      count: i._count,
    }));
  });

  // GET /api/edr/pending - 待處理警示
  app.get('/api/edr/pending', async (request) => {
    const { limit = '50' } = request.query as { limit?: string };

    const alerts = await prisma.eDRAlert.findMany({
      where: { status: { in: ['new', 'investigating'] } },
      orderBy: [
        { severity: 'desc' },
        { detectedAt: 'desc' },
      ],
      take: parseInt(limit, 10),
    });

    return { data: alerts, count: alerts.length };
  });

  // GET /api/edr/timeline - 時間線 (最近 7 天每日統計)
  app.get('/api/edr/timeline', async () => {
    const days = 7;
    const results = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.eDRAlert.count({
        where: {
          detectedAt: { gte: date, lt: nextDate },
        },
      });

      results.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return results.reverse();
  });
}
