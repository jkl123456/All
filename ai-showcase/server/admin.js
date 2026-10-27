import express from 'express';
import { db, mapProject, publicUser, parseJson } from './db.js';
import { requireAdmin } from './auth.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/stats', (_req, res) => {
  const count = (sql, ...args) => db.prepare(sql).get(...args).n;
  res.json({
    users: count('SELECT COUNT(*) AS n FROM users'),
    banned: count('SELECT COUNT(*) AS n FROM users WHERE banned = 1'),
    projects: count('SELECT COUNT(*) AS n FROM projects'),
    pending: count("SELECT COUNT(*) AS n FROM projects WHERE status = 'pending'"),
    approved: count("SELECT COUNT(*) AS n FROM projects WHERE status = 'approved'"),
    rejected: count("SELECT COUNT(*) AS n FROM projects WHERE status = 'rejected'"),
    boosted: count('SELECT COUNT(*) AS n FROM projects WHERE boost = 1 AND status = \'approved\''),
    demoted: count('SELECT COUNT(*) AS n FROM projects WHERE demote = 1 AND status = \'approved\''),
    comments: count('SELECT COUNT(*) AS n FROM comments WHERE deleted = 0'),
    likes: count('SELECT COUNT(*) AS n FROM likes'),
    favorites: count('SELECT COUNT(*) AS n FROM favorites')
  });
});

router.get('/projects', (req, res) => {
  const status = String(req.query.status || 'pending');
  const q = String(req.query.q || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 12;

  const where = status === 'all' ? '' : 'WHERE p.status = ?';
  const args = status === 'all' ? [] : [status];
  let rows = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.email AS author_email
       FROM projects p JOIN users u ON u.id = p.user_id
       ${where} ORDER BY p.created_at DESC`
    )
    .all(...args);

  if (q) {
    rows = rows.filter((row) =>
      [row.name, row.tagline, row.author_name, row.author_email, row.id].join(' ').toLowerCase().includes(q)
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  res.json({
    items: rows.slice(start, start + pageSize).map((row) => ({
      ...mapProject(row),
      author: { id: row.user_id, name: row.author_name, email: row.author_email }
    })),
    total: rows.length,
    page,
    totalPages
  });
});

router.post('/projects/:id/review', (req, res) => {
  const action = String(req.body?.action || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: '未知操作' });
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });

  const status = action === 'approve' ? 'approved' : 'rejected';
  db.prepare('UPDATE projects SET status = ?, reject_reason = ?, reviewed_at = ? WHERE id = ?').run(
    status,
    action === 'reject' ? reason : '',
    Date.now(),
    row.id
  );
  res.json({ ok: true, status });
});

router.post('/projects/:id/boost', (req, res) => {
  const boost = req.body?.boost ? 1 : 0;
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });
  if (boost && row.status !== 'approved') {
    return res.status(400).json({ error: '只有已通过审核的作品才能助推' });
  }
  db.prepare('UPDATE projects SET boost = ? WHERE id = ?').run(boost, row.id);
  res.json({ ok: true, boost: Boolean(boost) });
});

router.post('/projects/:id/demote', (req, res) => {
  const demote = req.body?.demote ? 1 : 0;
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });
  db.prepare('UPDATE projects SET demote = ? WHERE id = ?').run(demote, row.id);
  res.json({ ok: true, demote: Boolean(demote) });
});

router.delete('/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  let rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  if (q) {
    rows = rows.filter((row) => [row.email, row.name, String(row.id)].join(' ').toLowerCase().includes(q));
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize).map((row) => {
    const projects = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').get(row.id).n;
    const comments = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND deleted = 0').get(row.id).n;
    const likes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE user_id = ?').get(row.id).n;
    return { ...publicUser(row), counts: { projects, comments, likes } };
  });
  res.json({ items, total: rows.length, page, totalPages });
});

router.get('/users/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '用户不存在' });
  const projects = db
    .prepare('SELECT id, name, status, boost, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC')
    .all(row.id);
  const comments = db
    .prepare('SELECT id, project_id, content, created_at FROM comments WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 20')
    .all(row.id);
  res.json({
    user: { ...publicUser(row), counts: { projects: projects.length, comments: comments.length } },
    projects,
    comments
  });
});

router.post('/users/:id/ban', (req, res) => {
  const banned = req.body?.banned ? 1 : 0;
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '用户不存在' });
  if (row.role === 'admin') return res.status(400).json({ error: '不能拉黑管理员' });
  db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned, row.id);
  res.json({ ok: true, banned: Boolean(banned) });
});

router.post('/users/:id/mute', (req, res) => {
  const minutes = Math.max(0, Math.min(60 * 24 * 30, Number(req.body?.minutes) || 0));
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '用户不存在' });
  if (row.role === 'admin') return res.status(400).json({ error: '不能禁言管理员' });
  const until = minutes ? Date.now() + minutes * 60 * 1000 : 0;
  db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, row.id);
  res.json({ ok: true, mutedUntil: until });
});

export default router;
