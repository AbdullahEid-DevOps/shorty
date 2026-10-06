import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

// A fake Redis that keeps data in memory, so tests need no real database.
function fakeRedis() {
  const store = new Map();
  return {
    ping: async () => 'PONG',
    set: async (key, value) => { store.set(key, value); return 'OK'; },
    get: async (key) => store.get(key) ?? null,
  };
}

async function start() {
  const server = buildApp(fakeRedis()).listen(0); // port 0 = any free port
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('GET /health returns ok', async () => {
  const { server, base } = await start();
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
  server.close();
});

test('POST /shorten then GET /:code redirects', async () => {
  const { server, base } = await start();
  const res = await fetch(`${base}/shorten`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  assert.equal(res.status, 201);
  const { code } = await res.json();
  const hop = await fetch(`${base}/${code}`, { redirect: 'manual' });
  assert.equal(hop.status, 302);
  assert.equal(hop.headers.get('location'), 'https://example.com');
  server.close();
});

test('POST /shorten rejects a bad url', async () => {
  const { server, base } = await start();
  const res = await fetch(`${base}/shorten`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'not-a-url' }),
  });
  assert.equal(res.status, 400);
  server.close();
});
