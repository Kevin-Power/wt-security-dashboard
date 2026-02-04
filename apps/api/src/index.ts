import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/index.js';
import { startSyncJobs, manualSync } from './jobs/sync-job.js';
import { prisma } from './services/db.js';

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
});

// Plugins
await app.register(cors, {
  origin: env.NODE_ENV === 'development' ? '*' : ['http://localhost:3000'],
});

// Health check
app.get('/health', async () => ({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  database: await prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected'),
}));

// API info
app.get('/api', async () => ({
  name: 'WT Security Dashboard API',
  version: '1.0.0',
  modules: {
    auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me', 'GET /api/auth/users', 'PUT /api/auth/users/:id', 'POST /api/auth/change-password'],
    dashboard: ['GET /api/dashboard', 'GET /api/dashboard/summary'],
    kb4: ['GET /api/kb4/users', 'GET /api/kb4/stats', 'GET /api/kb4/by-department', 'GET /api/kb4/high-risk'],
    ncm: ['GET /api/ncm/devices', 'GET /api/ncm/stats', 'GET /api/ncm/by-priority', 'GET /api/ncm/critical'],
    edr: ['GET /api/edr/alerts', 'GET /api/edr/stats', 'PATCH /api/edr/alerts/:id', 'GET /api/edr/pending'],
    hibp: ['GET /api/hibp/breaches', 'GET /api/hibp/stats', 'PATCH /api/hibp/breaches/:id', 'GET /api/hibp/pending'],
    trends: ['GET /api/trends/daily', 'POST /api/trends/snapshot', 'GET /api/trends/comparison'],
    sync: ['POST /api/sync', 'GET /api/sync/logs'],
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

// 手動觸發同步 API
app.post('/api/sync', async (request) => {
  const { source = 'all' } = request.query as { source?: string };
  
  if (source in manualSync) {
    const syncFn = manualSync[source as keyof typeof manualSync];
    const result = await syncFn();
    return { source, result, timestamp: new Date().toISOString() };
  }
  
  return { error: `Invalid source: ${source}. Valid: all, kb4, ncm, edr, hibp` };
});

// 取得同步日誌
app.get('/api/sync/logs', async (request) => {
  const { limit = '50' } = request.query as { limit?: string };
  
  const logs = await prisma.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  });
  
  return { logs, count: logs.length };
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
