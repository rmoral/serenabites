/*
 * Auth layer
 * ---------------------------------------------------------------
 * Login con bcrypt, sesiones en SQLite, cookie HttpOnly.
 * No usamos JWT ni express-session — un token aleatorio simple es
 * más que suficiente y permite revocar al instante.
 *
 * Cookie:   sb_admin=<token>; HttpOnly; SameSite=Strict; Path=/
 *           Secure añadido en producción (NODE_ENV=production)
 * Duración: 7 días, renovada en cada request si está cerca de expirar.
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import db from './db.js';

const COOKIE = 'sb_admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const RENEW_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // renueva si quedan <2 días

const isProd = () => process.env.NODE_ENV === 'production';

function newToken() {
  return randomBytes(32).toString('base64url');
}

function setSessionCookie(res, token, expiresAt) {
  const parts = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (isProd()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [
    `${COOKIE}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isProd()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function login(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  const token = newToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .run(token, user.id, expiresAt, now);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);
  return { user: publicUser(user), token, expiresAt };
}

export function logout(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role, u.is_active
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  if (!row.is_active) return null;
  return { user: publicUser(row), expiresAt: row.expires_at };
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

// ─── Express middleware ────────────────────────────────────────
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  const sess = userFromToken(token);
  if (!sess) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sess.user;
  req.sessionToken = token;

  // Renovación deslizante
  if (sess.expiresAt - Date.now() < RENEW_THRESHOLD_MS) {
    const newExp = Date.now() + SESSION_TTL_MS;
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExp, token);
    setSessionCookie(res, token, newExp);
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!u) throw new Error('Usuario no encontrado');
  const ok = await bcrypt.compare(currentPassword, u.password_hash);
  if (!ok) throw new Error('Contraseña actual incorrecta');
  if (!newPassword || newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export { setSessionCookie, clearSessionCookie, COOKIE };
