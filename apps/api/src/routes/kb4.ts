import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  department: z.string().optional(),
  organization: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
  minRiskScore: z.coerce.number().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['currentRiskScore', 'phishPronePercentage', 'email', 'department']).default('currentRiskScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function kb4Routes(app: FastifyInstance) {

  // GET /api/kb4/users - 用戶列表
  app.get('/api/kb4/users', async (request) => {
    const query = querySchema.parse(request.query);
    const { page, limit, department, organization, status, minRiskScore, search, sortBy, sortOrder } = query;

    const where: any = {};
    if (department) where.department = { contains: department };
    if (organization) where.organization = { contains: organization };
    if (status) where.status = status;
    if (minRiskScore) where.currentRiskScore = { gte: minRiskScore };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.kB4User.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          division: true,
          organization: true,
          jobTitle: true,
          status: true,
          currentRiskScore: true,
          phishPronePercentage: true,
          lastSignIn: true,
          syncedAt: true,
        },
      }),
      prisma.kB4User.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // GET /api/kb4/users/:id - 單一用戶
  app.get('/api/kb4/users/:id', async (request) => {
    const { id } = request.params as { id: string };
    const user = await prisma.kB4User.findUnique({ where: { id } });
    if (!user) {
      return { error: 'User not found', statusCode: 404 };
    }
    return user;
  });

  // GET /api/kb4/stats - 統計
  app.get('/api/kb4/stats', async () => {
    const [total, active, highRisk, avgStats] = await Promise.all([
      prisma.kB4User.count(),
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
        _max: { currentRiskScore: true, phishPronePercentage: true },
      }),
    ]);

    return {
      totalUsers: total,
      activeUsers: active,
      highRiskUsers: highRisk,
      averages: {
        riskScore: Math.round((avgStats._avg.currentRiskScore || 0) * 100) / 100,
        phishProneRate: Math.round((avgStats._avg.phishPronePercentage || 0) * 100) / 100,
      },
      maximums: {
        riskScore: avgStats._max.currentRiskScore || 0,
        phishProneRate: avgStats._max.phishPronePercentage || 0,
      },
    };
  });

  // GET /api/kb4/by-department - 按部門分析
  app.get('/api/kb4/by-department', async () => {
    const departments = await prisma.kB4User.groupBy({
      by: ['department'],
      where: { status: 'active', department: { not: null } },
      _count: true,
      _avg: { currentRiskScore: true, phishPronePercentage: true },
    });

    return departments
      .filter(d => d.department)
      .map(d => ({
        department: d.department,
        userCount: d._count,
        avgRiskScore: Math.round((d._avg.currentRiskScore || 0) * 100) / 100,
        avgPhishProneRate: Math.round((d._avg.phishPronePercentage || 0) * 100) / 100,
      }))
      .sort((a, b) => b.avgRiskScore - a.avgRiskScore);
  });

  // GET /api/kb4/by-organization - 按組織分析
  app.get('/api/kb4/by-organization', async () => {
    const orgs = await prisma.kB4User.groupBy({
      by: ['organization'],
      where: { status: 'active', organization: { not: null } },
      _count: true,
      _avg: { currentRiskScore: true, phishPronePercentage: true },
    });

    return orgs
      .filter(o => o.organization)
      .map(o => ({
        organization: o.organization,
        userCount: o._count,
        avgRiskScore: Math.round((o._avg.currentRiskScore || 0) * 100) / 100,
        avgPhishProneRate: Math.round((o._avg.phishPronePercentage || 0) * 100) / 100,
      }))
      .sort((a, b) => b.userCount - a.userCount);
  });

  // GET /api/kb4/high-risk - 高風險用戶
  app.get('/api/kb4/high-risk', async (request) => {
    const { limit = '20' } = request.query as { limit?: string };

    const users = await prisma.kB4User.findMany({
      where: {
        status: 'active',
        OR: [
          { currentRiskScore: { gte: 50 } },
          { phishPronePercentage: { gte: 20 } },
        ],
      },
      orderBy: { currentRiskScore: 'desc' },
      take: parseInt(limit, 10),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        department: true,
        organization: true,
        currentRiskScore: true,
        phishPronePercentage: true,
      },
    });

    return { data: users, count: users.length };
  });
}
