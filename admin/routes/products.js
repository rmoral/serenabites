import { Router } from 'express';
import db, { now } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

const CATEGORIES = ['bowls', 'wraps', 'brunch', 'dulces'];

function slugify(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function validate(p, { partial = false } = {}) {
  const errs = [];
  if (!partial || p.name !== undefined) {
    if (!p.name || String(p.name).trim().length < 2) errs.push('Nombre requerido (mín. 2 caracteres)');
  }
  if (!partial || p.category !== undefined) {
    if (!CATEGORIES.includes(p.category)) errs.push(`Categoría debe ser una de: ${CATEGORIES.join(', ')}`);
  }
  if (!partial || p.price_cents !== undefined) {
    const pc = parseInt(p.price_cents, 10);
    if (!Number.isFinite(pc) || pc < 100 || pc > 10000) errs.push('Precio debe estar entre 1,00 € y 100,00 €');
  }
  return errs;
}

r.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT * FROM products ORDER BY category, sort_order, name
  `).all();
  res.json({ products });
});

r.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ product });
});

r.post('/', (req, res) => {
  const p = req.body || {};
  const errs = validate(p);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  const id = p.id?.trim() || slugify(p.name);
  if (!id || id.length < 3) return res.status(400).json({ error: 'ID inválido' });

  const exists = db.prepare('SELECT 1 FROM products WHERE id = ?').get(id);
  if (exists) return res.status(409).json({ error: 'Ya existe un producto con ese ID' });

  const ts = now();
  db.prepare(`INSERT INTO products
    (id,name,category,price_cents,description,image_url,is_active,is_signature,is_veg,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, p.name.trim(), p.category, parseInt(p.price_cents, 10),
      p.description || '', p.image_url || '',
      p.is_active === false ? 0 : 1,
      p.is_signature ? 1 : 0,
      p.is_veg ? 1 : 0,
      parseInt(p.sort_order, 10) || 999,
      ts, ts
    );
  res.json({ id });
});

r.patch('/:id', (req, res) => {
  const id = req.params.id;
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Producto no encontrado' });

  const p = req.body || {};
  const errs = validate(p, { partial: true });
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  const next = {
    name:         p.name !== undefined ? String(p.name).trim() : cur.name,
    category:     p.category !== undefined ? p.category : cur.category,
    price_cents:  p.price_cents !== undefined ? parseInt(p.price_cents, 10) : cur.price_cents,
    description:  p.description !== undefined ? String(p.description) : cur.description,
    image_url:    p.image_url !== undefined ? String(p.image_url) : cur.image_url,
    is_active:    p.is_active !== undefined ? (p.is_active ? 1 : 0) : cur.is_active,
    is_signature: p.is_signature !== undefined ? (p.is_signature ? 1 : 0) : cur.is_signature,
    is_veg:       p.is_veg !== undefined ? (p.is_veg ? 1 : 0) : cur.is_veg,
    sort_order:   p.sort_order !== undefined ? parseInt(p.sort_order, 10) : cur.sort_order,
  };
  db.prepare(`UPDATE products SET
    name=?, category=?, price_cents=?, description=?, image_url=?,
    is_active=?, is_signature=?, is_veg=?, sort_order=?, updated_at=?
    WHERE id=?`).run(
      next.name, next.category, next.price_cents, next.description, next.image_url,
      next.is_active, next.is_signature, next.is_veg, next.sort_order, now(), id
    );
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  // Soft-delete: marcamos inactivo. Mantiene la integridad histórica.
  const id = req.params.id;
  const r2 = db.prepare('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?').run(now(), id);
  if (r2.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ok: true });
});

export default r;
