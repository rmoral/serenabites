import { Router } from 'express';
import { login, logout, requireAuth, setSessionCookie, clearSessionCookie, changePassword } from '../auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  try {
    const result = await login(String(email).trim().toLowerCase(), String(password));
    if (!result) return res.status(401).json({ error: 'Credenciales no válidas' });
    setSessionCookie(res, result.token, result.expiresAt);
    res.json({ user: result.user });
  } catch (e) {
    console.error('[auth] login error', e);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

r.post('/logout', requireAuth, (req, res) => {
  logout(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

r.post('/change-password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  try {
    await changePassword(req.user.id, String(current || ''), String(next || ''));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
