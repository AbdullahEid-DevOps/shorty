import express from 'express';
import client from 'prom-client';
import crypto from 'node:crypto';

// buildApp receives a redis client, so tests can pass a fake one.
export function buildApp(redis) {
  const app = express();
  app.use(express.json());

  // Prometheus metrics
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const created = new client.Counter({
    name: 'shorty_links_created_total',
    help: 'Short links created',
    registers: [register],
  });
  const redirects = new client.Counter({
    name: 'shorty_redirects_total',
    help: 'Redirects served',
    registers: [register],
  });

  app.get('/health', async (req, res) => {
    try {
      await redis.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'redis_down' });
    }
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.post('/shorten', async (req, res) => {
    const { url } = req.body ?? {};
    if (!url || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: 'url must start with http:// or https://' });
    }
    const code = crypto.randomBytes(4).toString('hex');
    await redis.set(`link:${code}`, url);
    created.inc();
    res.status(201).json({ code, short: `/${code}` });
  });

  // Keep this route LAST: "/:code" would otherwise also match /health and /metrics.
  app.get('/:code', async (req, res) => {
    const url = await redis.get(`link:${req.params.code}`);
    if (!url) return res.status(404).json({ error: 'not found' });
    redirects.inc();
    res.redirect(302, url);
  });

  return app;
}
