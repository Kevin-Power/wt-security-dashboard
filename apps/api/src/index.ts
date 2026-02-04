import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/index.js';
import { startSyncJobs, manualSync, getSyncStatus } from './jobs/sync-job.js';
import { prisma } from './services/db.js';
import { cache } from './services/cache.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { kb4Routes } from './routes/kb4.js';
import { ncmRoutes } from './routes/ncm.js';
import { edrRoutes } from './routes/edr.js';
import { hibpRoutes } from './routes/hibp.js';
import { trendsRoutes } from './routes/trends.js';
import { createInitialAdmin } from './services/auth.js';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  },
  trustProxy: true,
});

// Security: Helmet for HTTP headers
await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production',
});

// Security: Rate limiting
await app.register(rateLimit, {
  global: true,
  max: 100, // 100 requests per minute
  timeWindow: '1 minute',
  // 登入端點更嚴格的限制
  keyGenerator: (request) => {
    return request.ip;
  },
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.round(context.ttl / 1000)} seconds.`,
    retryAfter: Math.round(context.ttl / 1000),
  }),
});

// CORS
await app.register(cors, {
  origin: env.NODE_ENV === 'development'
    ? '*'
    : process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// 簡單健康檢查
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// 詳細健康檢查
app.get('/health/detailed', async () => {
  const startTime = Date.now();

  // 檢查數據庫連接
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  // 獲取同步狀態
  const syncStatus = getSyncStatus();

  // 獲取緩存統計
  const cacheStats = cache.stats();

  // 獲取最後同步日誌
  const lastSyncLogs = await prisma.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: {
      source: true,
      status: true,
      recordCount: true,
      duration: true,
      createdAt: true,
    },
  });

  // 獲取數據統計
  const [kb4Count, ncmCount, edrCount, hibpCount] = await Promise.all([
    prisma.kB4User.count(),
    prisma.nCMDevice.count(),
    prisma.eDRAlert.count(),
    prisma.hIBPBreach.count(),
  ]);

  const totalLatency = Date.now() - startTime;

  return {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: env.NODE_ENV,
    checks: {
      database: {
        status: dbStatus,
        latency: dbLatency,
      },
      sync: {
        isRunning: syncStatus.isSyncing,
        lastRun: syncStatus.lastSyncTime,
        lastResult: syncStatus.lastSyncResult,
      },
      cache: {
        entries: cacheStats.size,
      },
    },
    data: {
      kb4Users: kb4Count,
      ncmDevices: ncmCount,
      edrAlerts: edrCount,
      hibpBreaches: hibpCount,
    },
    lastSyncLogs,
    responseTime: totalLatency,
  };
});

// API info
app.get('/api', async () => ({
  name: 'WT Security Dashboard API',
  version: '1.0.0',
  environment: env.NODE_ENV,
  modules: {
    auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me', 'GET /api/auth/users', 'PUT /api/auth/users/:id', 'POST /api/auth/change-password'],
    dashboard: ['GET /api/dashboard', 'GET /api/dashboard/summary', 'GET /api/dashboard/config', 'PUT /api/dashboard/weights', 'GET /api/dashboard/breakdown'],
    kb4: ['GET /api/kb4/users', 'GET /api/kb4/stats', 'GET /api/kb4/by-department', 'GET /api/kb4/high-risk'],
    ncm: ['GET /api/ncm/devices', 'GET /api/ncm/stats', 'GET /api/ncm/by-priority', 'GET /api/ncm/critical'],
    edr: ['GET /api/edr/alerts', 'GET /api/edr/stats', 'PATCH /api/edr/alerts/:id', 'GET /api/edr/pending'],
    hibp: ['GET /api/hibp/breaches', 'GET /api/hibp/stats', 'PATCH /api/hibp/breaches/:id', 'GET /api/hibp/pending'],
    trends: ['GET /api/trends/daily', 'POST /api/trends/snapshot', 'GET /api/trends/comparison'],
    sync: ['POST /api/sync', 'GET /api/sync/logs', 'GET /api/sync/status'],
  },
}));

// Register routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(dashboardRoutes);
await app.register(kb4Routes);
await app.register(ncmRoutes);
await app.register(edrRoutes);
await app.register(hibpRoutes);
await app.register(trendsRoutes);

// 手動觸發同步 API (需要更嚴格的速率限制)
app.post('/api/sync', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '5 minute',
    },
  },
}, async (request) => {
  const { source = 'all' } = request.query as { source?: string };

  const validSources = ['all', 'kb4', 'ncm', 'edr', 'hibp', 'snapshot'] as const;
  type ValidSource = (typeof validSources)[number];

  if (!validSources.includes(source as ValidSource)) {
    return { error: `Invalid source: ${source}. Valid: ${validSources.join(', ')}` };
  }

  const syncFn = manualSync[source as ValidSource];
  const result = await syncFn();

  return { source, result, timestamp: new Date().toISOString() };
});

// 取得同步日誌
app.get('/api/sync/logs', async (request) => {
  const { limit = '50', source } = request.query as { limit?: string; source?: string };

  const logs = await prisma.syncLog.findMany({
    where: source ? { source } : undefined,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  });

  return { logs, count: logs.length };
});

// 取得同步狀態
app.get('/api/sync/status', async () => {
  return getSyncStatus();
});

// 緩存管理 API
app.get('/api/cache/stats', async () => {
  return cache.stats();
});

app.post('/api/cache/clear', async () => {
  await cache.flush();
  return { message: 'Cache cleared', timestamp: new Date().toISOString() };
});

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...');
  await prisma.$disconnect();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Server running on http://localhost:${env.PORT}`);
  app.log.info(`Environment: ${env.NODE_ENV}`);

  // 建立初始管理員帳號
  await createInitialAdmin();

  // 啟動排程任務
  startSyncJobs();

  // 生產環境：啟動時執行一次同步和建立快照
  if (env.NODE_ENV === 'production') {
    setTimeout(async () => {
      app.log.info('Running initial sync...');
      try {
        await manualSync.all();
        app.log.info('Initial sync completed');
      } catch (error) {
        app.log.error({ err: error }, 'Initial sync failed');
      }
    }, 5000);
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
