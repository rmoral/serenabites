import { Router } from 'express';
import db, { now } from '../db.js';
import { requireAuth, requireRole, hashPassword } from '../auth.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

const ROLES = ['admin', 'staff'];

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    is_active: u.is_active, last_login_at: u.last_login_at, created_at: u.created_at,
  };
}

r.get('/', (req, res) => {
  const users = db.prepare('SELECT id,email,name,role,is_active,last_login_at,created_at FROM users ORDER BY created_at').all();
  res.json({ users });
});

r.post('/', async (req, res) => {
  const { email, name, role, password } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, nombre y contraseña requeridos' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rol no válido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const dup = db.prepare('SELECT 1 FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (dup) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

  const hash = await hashPassword(password);
  const r2 = db.prepare(`INSERT INTO users (email,name,password_hash,role,is_active,created_at)
                         VALUES (?,?,?,?,1,?)`)
    .run(String(email).toLowerCase().trim(), String(name).trim(), hash, role, now());
  res.json({ id: r2.lastInsertRowid });
});

r.patch('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { name, role, is_active, password } = req.body || {};

  // Salvaguarda: no se puede des-administrar al último admin
  if (role && role !== cur.role && cur.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND is_active=1").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'No puedes degradar al último administrador' });
  }
  if (is_active === false && cur.is_active === 1 && cur.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND is_active=1").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'No puedes desactivar al último administrador' });
  }

  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(String(name).trim()); }
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rol no válido' });
    fields.push('role = ?'); params.push(role);
  }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    fields.push('password_hash = ?'); params.push(await hashPassword(String(password)));
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
  params.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'No puedes borrarte a ti mismo' });
  const cur = db.prepare('SELECT role,is_active FROM users WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (cur.role === 'admin' && cur.is_active) {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND is_active=1").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'No puedes borrar al último administrador' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default r;
