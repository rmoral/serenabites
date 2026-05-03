import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  let where = '';
  const params = [];
  if (q) {
    where = 'WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const customers = db.prepare(`
    SELECT * FROM customers ${where}
    ORDER BY last_order_at DESC NULLS LAST, name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM customers ${where}`).get(...params).n;

  res.json({ customers, total });
});

r.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

  const orders = db.prepare(`
    SELECT id, total_cents, status, delivery_mode, paid_at
    FROM orders WHERE customer_id = ? ORDER BY paid_at DESC LIMIT 50
  `).all(id);
  res.json({ customer, orders });
});

r.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const cur = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Cliente no encontrado' });
  const { notes } = req.body || {};
  if (notes === undefined) return res.status(400).json({ error: 'Nada que actualizar' });
  db.prepare('UPDATE customers SET notes = ? WHERE id = ?').run(String(notes), id);
  res.json({ ok: true });
});

export default r;
