/*
 * Serena Bites — backend Express
 * ---------------------------------------------------------------
 * Sirve detrás de Apache (mod_proxy):
 *   POST /api/create-checkout-session  → Stripe Checkout Session
 *   POST /api/stripe-webhook           → Confirmación de pago
 *   /api/admin/*                       → Back-office (auth + CRUD)
 *
 * Apache hace ProxyPass /api/ → http://127.0.0.1:3000/api/
 * (ver deploy/serenabites.conf)
 *
 * Las variables de entorno se cargan desde:
 *   - systemd EnvironmentFile=/var/www/html/serenabites/.env (producción)
 *   - .env en local (vía dotenv) si existe
 */

import express from 'express';
import cookieParser from 'cookie-parser';

import createCheckoutSession from './api/create-checkout-session.js';
import stripeWebhook from './api/stripe-webhook.js';

import { init as initDB } from './admin/db.js';
import authRoutes      from './admin/routes/auth.js';
import ordersRoutes    from './admin/routes/orders.js';
import productsRoutes  from './admin/routes/products.js';
import customersRoutes from './admin/routes/customers.js';
import usersRoutes     from './admin/routes/users.js';
import statsRoutes     from './admin/routes/stats.js';

// dotenv en local; en producción systemd inyecta EnvironmentFile
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (_) { /* sin dotenv: ignorar */ }

// Init DB y migraciones (sembramos admin si no existe)
initDB();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ──────────────────────────────────────────────────────────────
// Stripe webhook: REQUIERE el body crudo para verificar la firma.
// Va ANTES del express.json().
// ──────────────────────────────────────────────────────────────
app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  stripeWebhook
);

// Resto: JSON + cookies
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

// Public API
app.post('/api/create-checkout-session', createCheckoutSession);

// Admin API
app.use('/api/admin/auth',      authRoutes);
app.use('/api/admin/orders',    ordersRoutes);
app.use('/api/admin/products',  productsRoutes);
app.use('/api/admin/customers', customersRoutes);
app.use('/api/admin/users',     usersRoutes);
app.use('/api/admin/stats',     statsRoutes);

// 404 final
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[serenabites] unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[serenabites] listening on http://${HOST}:${PORT}`);
});

function shutdown(sig) {
  console.log(`[serenabites] received ${sig}, closing…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
