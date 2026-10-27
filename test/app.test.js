import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;
const received = [];

before(async () => {
  const app = createApp({
    plan: async (input) => {
      received.push(input);
      return { source: 'test', summary: 'ok', budget: [] };
    },
  });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const post = (body, raw) =>
  fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(body) });

test('health check responds', async () => {
  const r = await fetch(`${base}/healthz`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
});

test('serves the accessible frontend with security headers', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Skip to main content/);
  assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('returns a plan for valid input with sanitised fields', async () => {
  const r = await post({ eventType: 'Birthday', guests: '40', budget: '50000', honoree: '<b>Aarav</b>' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).summary, 'ok');
  const last = received.at(-1);
  assert.equal(last.guests, 40);
  assert.ok(!last.honoree.includes('<'));
});

test('rejects invalid input with 400 and details', async () => {
  const r = await post({ eventType: 'Birthday', guests: -1, budget: 50000 });
  assert.equal(r.status, 400);
  assert.ok((await r.json()).details.length > 0);
});

test('rejects malformed JSON with 400', async () => {
  const r = await post(null, '{bad json');
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'Malformed JSON');
});

test('rejects oversized bodies with 413', async () => {
  const r = await post({ eventType: 'Birthday', notes: 'x'.repeat(20000) });
  assert.equal(r.status, 413);
});

test('unknown API routes return JSON 404', async () => {
  const r = await fetch(`${base}/api/nope`);
  assert.equal(r.status, 404);
});

test('rate limits excessive planning requests', async () => {
  let limited = false;
  for (let i = 0; i < 15; i += 1) {
    const r = await post({ eventType: 'Birthday', guests: 10, budget: 5000 });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited);
});
