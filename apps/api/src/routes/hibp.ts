import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['new', 'notified', 'password_reset', 'resolved']).optional(),
  domain: z.string().optional(),
  breachName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['discoveredAt', 'breachDate', 'email', 'status']).default('discoveredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const updateStatusSchema = z.object({
  status: z.enum(['new', 'notified', 'password_reset', 'resolved']),
});

export async function hibpRoutes(app: FastifyInstance) {

  // GET /api/hibp/breaches - 外洩列表
  app.get('/api/hibp/breaches', async (request) => {
    const query = querySchema.parse(request.query);
    const { page, limit, status, domain, breachName, startDate, endDate, search, sortBy, sortOrder } = query;

    const where: any = {};
    if (status) where.status = status;
    if (domain) where.domain = { contains: domain, mode: 'insensitive' };
    if (breachName) where.breachName = { contains: breachName, mode: 'insensitive' };
    if (startDate || endDate) {
      where.discoveredAt = {};
      if (startDate) where.discoveredAt.gte = new Date(startDate);
      if (endDate) where.discoveredAt.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { breachName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [breaches, total] = await Promise.all([
      prisma.hIBPBreach.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.hIBPBreach.count({ where }),
    ]);

    return {
      data: breaches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // GET /api/hibp/breaches/:id - 單一外洩記錄
  app.get('/api/hibp/breaches/:id', async (request) => {
    const { id } = request.params as { id: string };
    const breach = await prisma.hIBPBreach.findUnique({ where: { id } });
    if (!breach) return { error: 'Breach not found', statusCode: 404 };
    return breach;
  });

  // PATCH /api/hibp/breaches/:id - 更新狀態
  app.patch('/api/hibp/breaches/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = updateStatusSchema.parse(request.body);

    const breach = await prisma.hIBPBreach.update({
      where: { id },
      data: { status: body.status },
    });

    return breach;
  });

  // POST /api/hibp/breaches/bulk-update - 批次更新狀態
  app.post('/api/hibp/breaches/bulk-update', async (request) => {
    const { ids, status } = request.body as { ids: string[]; status: string };

    const result = await prisma.hIBPBreach.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return { updated: result.count };
  });

  // GET /api/hibp/stats - 統計
  app.get('/api/hibp/stats', async () => {
    const [total, byStatus, byDomain, uniqueEmails, recentCount] = await Promise.all([
      prisma.hIBPBreach.count(),
      prisma.hIBPBreach.groupBy({ by: ['status'], _count: true }),
      prisma.hIBPBreach.groupBy({
        by: ['domain'],
        _count: true,
        orderBy: { _count: { domain: 'desc' } },
        take: 10,
      }),
      prisma.hIBPBreach.findMany({ select: { email: true }, distinct: ['email'] }),
      prisma.hIBPBreach.count({
        where: { discoveredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return {
      totalBreaches: total,
      uniqueEmailsAffected: uniqueEmails.length,
      recentBreaches30d: recentCount,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      topDomains: byDomain.map(d => ({ domain: d.domain, count: d._count })),
    };
  });

  // GET /api/hibp/by-breach - 按外洩事件分析
  app.get('/api/hibp/by-breach', async () => {
    const breaches = await prisma.hIBPBreach.groupBy({
      by: ['breachName'],
      _count: true,
      orderBy: { _count: { breachName: 'desc' } },
      take: 20,
    });

    return breaches.map(b => ({
      breachName: b.breachName,
      affectedCount: b._count,
    }));
  });

  // GET /api/hibp/by-email - 按 Email 分析 (查看哪些帳號有多筆外洩)
  app.get('/api/hibp/by-email', async () => {
    const emails = await prisma.hIBPBreach.groupBy({
      by: ['email'],
      _count: true,
      having: { email: { _count: { gt: 1 } } },
      orderBy: { _count: { email: 'desc' } },
      take: 20,
    });

    return emails.map(e => ({
      email: e.email,
      breachCount: e._count,
    }));
  });

  // GET /api/hibp/pending - 待處理外洩
  app.get('/api/hibp/pending', async (request) => {
    const { limit = '50' } = request.query as { limit?: string };

    const breaches = await prisma.hIBPBreach.findMany({
      where: { status: 'new' },
      orderBy: { discoveredAt: 'desc' },
      take: parseInt(limit, 10),
    });

    return { data: breaches, count: breaches.length };
  });

  // GET /api/hibp/timeline - 時間線
  app.get('/api/hibp/timeline', async () => {
    const days = 30;
    const results = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.hIBPBreach.count({
        where: { discoveredAt: { gte: date, lt: nextDate } },
      });

      results.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return results.reverse();
  });
}
