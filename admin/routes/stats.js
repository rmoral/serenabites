/*
 * Stats — admin only
 * KPIs y series simples calculados con SQL agregado.
 * Todo en céntimos en la DB; convertimos a euros aquí para el front.
 */

import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeKpis(fromTs, toTs) {
  const row = db.prepare(`
    SELECT
      COUNT(*)                                  AS orders,
      COALESCE(SUM(total_cents), 0)             AS revenue_cents,
      COALESCE(SUM(subtotal_cents), 0)          AS subtotal_cents,
      COALESCE(SUM(delivery_fee_cents), 0)      AS delivery_cents,
      COALESCE(AVG(total_cents), 0)             AS avg_ticket_cents
    FROM orders
    WHERE status != 'cancelled' AND paid_at >= ? AND paid_at < ?
  `).get(fromTs, toTs);
  return row;
}

r.get('/', (req, res) => {
  const today = startOfDay();
  const yesterday = today - DAY_MS;
  const last7 = today - 6 * DAY_MS;
  const last7Prev = today - 13 * DAY_MS;
  const last30 = today - 29 * DAY_MS;

  const tomorrow = today + DAY_MS;
  const todayK     = rangeKpis(today, tomorrow);
  const yesterdayK = rangeKpis(yesterday, today);
  const week       = rangeKpis(last7, tomorrow);
  const weekPrev   = rangeKpis(last7Prev, last7);
  const month      = rangeKpis(last30, tomorrow);

  // Ingresos por día (últimos 14)
  const seriesRows = db.prepare(`
    SELECT
      CAST((paid_at - ?) / ? AS INTEGER) AS day_idx,
      SUM(total_cents) AS revenue_cents,
      COUNT(*)         AS orders
    FROM orders
    WHERE status != 'cancelled' AND paid_at >= ? AND paid_at < ?
    GROUP BY day_idx
    ORDER BY day_idx
  `).all(today - 13 * DAY_MS, DAY_MS, today - 13 * DAY_MS, tomorrow);

  const series = [];
  for (let i = 0; i < 14; i++) {
    const found = seriesRows.find(r => r.day_idx === i);
    series.push({
      day: today - (13 - i) * DAY_MS,
      revenue_cents: found?.revenue_cents || 0,
      orders: found?.orders || 0,
    });
  }

  // Top productos (últimos 30 días)
  const topProducts = db.prepare(`
    SELECT
      oi.product_id    AS product_id,
      oi.product_name  AS product_name,
      SUM(oi.quantity)    AS units,
      SUM(oi.total_cents) AS revenue_cents
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled' AND o.paid_at >= ?
    GROUP BY oi.product_id, oi.product_name
    ORDER BY units DESC
    LIMIT 5
  `).all(last30);

  // Mix delivery / pickup (últimos 30 días)
  const mix = db.prepare(`
    SELECT delivery_mode, COUNT(*) AS n, SUM(total_cents) AS revenue_cents
    FROM orders
    WHERE status != 'cancelled' AND paid_at >= ?
    GROUP BY delivery_mode
  `).all(last30);

  // Top clientes (por gasto, últimos 90 días)
  const topCustomers = db.prepare(`
    SELECT id, name, phone, total_orders, total_spent_cents
    FROM customers
    WHERE last_order_at >= ?
    ORDER BY total_spent_cents DESC
    LIMIT 5
  `).all(today - 90 * DAY_MS);

  // Pendientes ahora mismo
  const pending = db.prepare(`
    SELECT status, COUNT(*) AS n
    FROM orders
    WHERE status IN ('paid','preparing','ready','out_for_delivery')
    GROUP BY status
  `).all();

  res.json({
    today: todayK,
    yesterday: yesterdayK,
    week,
    weekPrev,
    month,
    series,
    topProducts,
    mix,
    topCustomers,
    pending,
  });
});

export default r;
