import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePlanRequest, EVENT_TYPES } from './validate.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Build the Express app. The planner function is injected for testability.
 * @param {{ plan: (input: object) => Promise<object> }} deps
 */
export function createApp({ plan }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Cloud Run sits behind Google's front end
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(publicDir, { maxAge: '1h', etag: true }));

  const planLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/event-types', (_req, res) => res.json({ eventTypes: EVENT_TYPES }));

  app.post('/api/plan', planLimiter, async (req, res, next) => {
    const result = validatePlanRequest(req.body);
    if (!result.ok) return res.status(400).json({ error: 'Invalid input', details: result.errors });
    try {
      res.json(await plan(result.value));
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message }));
    res.status(500).json({ error: 'Something went wrong. Please try again shortly.' });
  });

  return app;
}
