import { createClient } from 'redis';
import { buildApp } from './app.js';

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('redis error:', err.message));
await redis.connect();

const app = buildApp(redis);
const server = app.listen(PORT, () => console.log(`shorty listening on ${PORT}`));

// Graceful shutdown: finish in-flight requests, close Redis, then exit.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await redis.quit();
      process.exit(0);
    });
  });
}

