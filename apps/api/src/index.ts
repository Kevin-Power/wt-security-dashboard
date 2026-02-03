import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/index.js';

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
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// API info
app.get('/api', async () => ({
  name: 'WT Security Dashboard API',
  version: '1.0.0',
  endpoints: ['/health', '/api/sync', '/api/sync/logs'],
}));

// Start server
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Server running on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
