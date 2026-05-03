import { Router } from 'express';
import db, { now } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();

const ALLOWED_STATUS = ['paid','preparing','ready','out_for_delivery','delivered','cancelled'];

r.use(requireAuth);

// GET /api/admin/orders?status=&mode=&q=&from=&to=&limit=&offset=
r.get('/', (req, res) => {
  const where = [];
  const params = [];
  const { status, mode, q, from, to } = req.query;
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (mode) { where.push('o.delivery_mode = ?'); params.push(mode); }
  if (from) { where.push('o.paid_at >= ?'); params.push(parseInt(from, 10)); }
  if (to)   { where.push('o.paid_at <= ?'); params.push(parseInt(to, 10)); }
  if (q) {
    where.push('(o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.id = ?)');
    params.push(`%${q}%`, `%${q}%`, isNaN(+q) ? -1 : +q);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  const rows = db.prepare(`
    SELECT o.id, o.stripe_session_id, o.customer_name, o.customer_phone,
           o.delivery_mode, o.delivery_postcode, o.subtotal_cents,
           o.delivery_fee_cents, o.total_cents, o.status, o.paid_at, o.fulfilled_at
    FROM orders o
    ${whereSql}
    ORDER BY o.paid_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${whereSql}`).get(...params).n;
  res.json({ orders: rows, total });
});

// GET /api/admin/orders/:id
r.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  res.json({ order, items });
});

// PATCH /api/admin/orders/:id  { status }
r.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body || {};
  if (!ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'Estado no válido' });

  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  const ts = now();
  const fulfilledAt = status === 'delivered' ? ts : null;
  db.prepare(`UPDATE orders SET status = ?, fulfilled_at = COALESCE(?, fulfilled_at), updated_at = ? WHERE id = ?`)
    .run(status, fulfilledAt, ts, id);

  res.json({ ok: true });
});

export default r;
