import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { db, publicUser } from './db.js';
import { sendCodeMail } from './mailer.js';

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOKIE = 'zg_token';

function signToken(user) {
  return jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '7d' });
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export function optionalAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    req.user = row && !row.banned ? row : null;
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

const codeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '发送太频繁，请稍后再试' }
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '尝试次数过多，请稍后再试' }
});

const lastCodeAt = new Map();

router.post('/send-code', codeLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) return res.status(409).json({ error: '这个邮箱已经注册过了，直接登录即可' });

  const now = Date.now();
  const last = lastCodeAt.get(email) || 0;
  if (now - last < 55 * 1000) {
    return res.status(429).json({ error: '验证码已发送，请 1 分钟后再试' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare(
    'INSERT INTO email_codes (email, code, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(email, code, 'register', now + 10 * 60 * 1000, now);
  lastCodeAt.set(email, now);

  try {
    const result = await sendCodeMail(email, code);
    res.json({ ok: true, dev: result.dev, devCode: result.dev && !config.isProd ? code : undefined });
  } catch (error) {
    console.error('send code failed', error);
    res.status(500).json({ error: '验证码发送失败，请检查邮件配置' });
  }
});

router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '验证码是 6 位数字' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: '昵称需要 2–20 个字符' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: '这个邮箱已经注册过了' });
  }

  const record = db
    .prepare(
      `SELECT * FROM email_codes
       WHERE email = ? AND purpose = 'register' AND used = 0 AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(email, Date.now());
  if (!record || record.code !== code) {
    return res.status(400).json({ error: '验证码不正确或已过期' });
  }

  const hash = await bcrypt.hash(password, 10);
  const role = config.adminEmail && email === config.adminEmail ? 'admin' : 'user';
  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(record.id);
    return db
      .prepare('INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(email, hash, name, role, now).lastInsertRowid;
  });
  const uid = tx();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  setAuthCookie(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: '请输入邮箱和密码' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: '邮箱或密码不正确' });
  if (user.banned) return res.status(403).json({ error: '这个账号已被拉黑，无法登录' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: '邮箱或密码不正确' });

  setAuthCookie(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
