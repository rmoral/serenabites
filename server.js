/*
 * Serena Bites — backend Express
 * ---------------------------------------------------------------
 * Sirve dos endpoints detrás de Apache (mod_proxy):
 *   POST /api/create-checkout-session  → Stripe Checkout Session
 *   POST /api/stripe-webhook           → Confirmación de pago + WhatsApp
 *
 * Apache hace ProxyPass /api/ → http://127.0.0.1:3000/api/
 * (ver deploy/serenabites.conf)
 *
 * En producción el proceso lo gestiona systemd:
 *   /etc/systemd/system/serenabites.service
 *   (ver deploy/serenabites.service)
 *
 * Las variables de entorno se cargan desde:
 *   - systemd EnvironmentFile=/var/www/serenabites/.env (producción)
 *   - .env en local (vía dotenv) si existe
 */

import express from 'express';
import createCheckoutSession from './api/create-checkout-session.js';
import stripeWebhook from './api/stripe-webhook.js';

// Carga .env en local (en producción systemd ya pasa las variables).
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (_) { /* dotenv no instalado o ya cargado: ignorar */ }

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // confiamos en Apache delante

// Health check (útil para systemd / monitoring)
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ──────────────────────────────────────────────────────────────
// Stripe webhook: REQUIERE el body crudo para verificar la firma.
// Por eso lo registramos ANTES del express.json().
// ──────────────────────────────────────────────────────────────
app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  stripeWebhook
);

// Resto de endpoints: JSON normal
app.use(express.json({ limit: '32kb' }));

app.post('/api/create-checkout-session', createCheckoutSession);

// 404 para cualquier otra ruta /api
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// Manejador de errores final (capa de seguridad)
app.use((err, _req, res, _next) => {
  console.error('[serenabites] unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[serenabites] listening on http://${HOST}:${PORT}`);
});

// Cierre limpio para que systemd no tarde en reiniciar
function shutdown(sig) {
  console.log(`[serenabites] received ${sig}, closing…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
