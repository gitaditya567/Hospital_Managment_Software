import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDbConnected } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { pharmacyRouter } from './routes/pharmacy.js';
import { hospitalRouter } from './routes/hospital.js';
import { superadminRouter } from './routes/superadmin.js';
import { publicRouter } from './routes/public.js';
import { requireAuth, requireRole, requireActiveSubscription } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Behind nginx/aaPanel: trust the first proxy so req.ip is the real client IP (not 127.0.0.1 for everyone)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Rate Limiting & Anti-Spam API Protection Middleware
const ipRequestMap = new Map();
const rateLimiterMiddleware = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 1000; // 1-second rolling window
  const maxRequestsPerSec = Number(process.env.RATE_LIMIT_PER_SEC) || 25;

  const record = ipRequestMap.get(ip) || { count: 0, startTime: now };
  if (now - record.startTime > windowMs) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count += 1;
  }

  ipRequestMap.set(ip, record);

  if (record.count > maxRequestsPerSec) {
    return res.status(429).json({
      message: 'Too many requests. Please slow down and try again in a moment.'
    });
  }

  next();
};

// Drop stale rate-limit records so the map does not grow forever
setInterval(() => {
  const cutoff = Date.now() - 60 * 1000;
  for (const [ip, record] of ipRequestMap) {
    if (record.startTime < cutoff) ipRequestMap.delete(ip);
  }
}, 60 * 1000).unref();

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api', rateLimiterMiddleware);
// High-capacity body parser limit for hospital logos & signatures
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes mounting
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/pharmacy', requireAuth, requireRole('HOSPITAL_ADMIN', 'PHARMACY', 'DOCTOR', 'RECEPTIONIST'), requireActiveSubscription, pharmacyRouter);
app.use('/api/hospital', requireAuth, requireRole('HOSPITAL_ADMIN', 'PHARMACY', 'DOCTOR', 'RECEPTIONIST'), requireActiveSubscription, hospitalRouter);
app.use('/api/superadmin', requireAuth, requireRole('SUPER_ADMIN'), superadminRouter);

const healthPayload = () => ({
  status: 'Smart Hospital Management REST Server Online 🟢',
  db_status: isDbConnected() ? 'Connected 🟢' : 'Reconnecting 🟡',
  version: '2.0.0',
  copyright: 'Copyright © twinsCloud',
  timestamp: new Date().toISOString()
});

app.get('/api/health', (req, res) => res.json(healthPayload()));

app.use('/api', (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Serve the built React app when it exists (single-process deployment); otherwise keep the JSON status root
const clientDist = process.env.CLIENT_DIST || path.resolve(__dirname, '../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json(healthPayload()));
}

// Malformed JSON bodies and any other unhandled error
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON request body.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request payload is too large.' });
  }
  console.error('Unhandled request error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});
