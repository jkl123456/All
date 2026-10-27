import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, mapProject, isMuted } from './db.js';
import { requireAuth } from './auth.js';
import { UPLOAD_DIR } from './config.js';

const router = express.Router();
const PAGE_SIZE = 8;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 6);
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error('只支持 JPG / PNG / WebP / GIF'));
    }
    cb(null, true);
  }
});

function isVisible(row, user) {
  if (!row) return false;
  if (row.status === 'approved') return true;
  if (!user) return false;
  return user.role === 'admin' || user.id === row.user_id;
}

function loadAllApproved() {
  return db
    .prepare(
      `SELECT p.*, u.name AS author_name FROM projects p
       JOIN users u ON u.id = p.user_id
       WHERE p.status = 'approved'
       ORDER BY p.created_at DESC`
    )
    .all();
}

function matches(row, category, q) {
  const categories = JSON.parse(row.categories || '[]');
  if (category && category !== '全部' && !categories.includes(category)) return false;
  if (!q) return true;
  const haystack = [
    row.name,
    row.tagline,
    row.description,
    row.stack,
    row.categories,
    row.gameplay,
    row.author_name
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

/* ---------------- 公开列表 ---------------- */
router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const category = String(req.query.category || '').trim();
  const q = String(req.query.q || '').trim();

  const all = loadAllApproved().filter((row) => matches(row, category, q));
  const boosted = all.filter((row) => row.boost);
  const normal = all.filter((row) => !row.boost);

  const boostedPages = Math.ceil(boosted.length / PAGE_SIZE);
  const normalPages = Math.ceil(normal.length / PAGE_SIZE);
  const totalPages = Math.max(1, boostedPages + normalPages);

  let rows = [];
  let section = 'all';
  if (page <= boostedPages) {
    rows = boosted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    section = 'boost';
  } else {
    const normalPage = page - boostedPages;
    rows = normal.slice((normalPage - 1) * PAGE_SIZE, normalPage * PAGE_SIZE);
  }

  res.json({
    items: rows.map((row) => mapProject(row, req.user?.id || 0)),
    page,
    totalPages,
    total: all.length,
    boostedCount: boosted.length,
    pageSize: PAGE_SIZE,
    section
  });
});

/* ---------------- 详情 ---------------- */
router.get('/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, u.name AS author_name FROM projects p
       JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!row || !isVisible(row, req.user)) return res.status(404).json({ error: '作品不存在或尚未通过审核' });
  res.json({ project: mapProject(row, req.user?.id || 0) });
});

/* ---------------- 发布 / 编辑 / 删除 ---------------- */
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .slice(0, 8)
    .map((img) => ({
      src: String(img?.src || '').slice(0, 500),
      label: img?.label === 'mobile' ? 'mobile' : 'pc'
    }))
    .filter((img) => img.src.startsWith('/uploads/') || /^https?:\/\//i.test(img.src));
}

router.post('/', requireAuth, (req, res) => {
  if (req.user.banned) return res.status(403).json({ error: '账号已被拉黑' });
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const tagline = String(body.tagline || '').trim();
  const description = String(body.description || '').trim();
  const categories = Array.isArray(body.categories) ? body.categories.slice(0, 3).map(String) : [];
  const images = normalizeImages(body.images);

  if (name.length < 2) return res.status(400).json({ error: '作品名称太短' });
  if (!tagline) return res.status(400).json({ error: '请填写一句话简介' });
  if (description.length < 20) return res.status(400).json({ error: '介绍至少 20 个字' });
  if (!categories.length) return res.status(400).json({ error: '至少选择一个分类' });
  if (!images.length) return res.status(400).json({ error: '至少上传一张截图' });

  const id = 'p-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  db.prepare(
    `INSERT INTO projects
      (id, user_id, name, tagline, categories, platforms, description, gameplay, stack, repo, contact_name, contact, qq, cover, images, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    id,
    req.user.id,
    name,
    tagline,
    JSON.stringify(categories),
    JSON.stringify(Array.isArray(body.platforms) && body.platforms.length ? body.platforms.map(String) : ['Web']),
    description,
    JSON.stringify(Array.isArray(body.gameplay) ? body.gameplay.map(String).slice(0, 20) : []),
    JSON.stringify(Array.isArray(body.stack) ? body.stack.map(String).slice(0, 20) : []),
    String(body.repo || '').trim(),
    String(body.contactName || '').trim(),
    String(body.contact || '').trim(),
    String(body.qq || '').trim(),
    images[0].src,
    JSON.stringify(images),
    Date.now()
  );

  const row = db
    .prepare(`SELECT p.*, u.name AS author_name FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(id);
  res.json({ ok: true, project: mapProject(row, req.user.id) });
});

router.put('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只能编辑自己的作品' });
  }
  const body = req.body || {};
  const images = normalizeImages(body.images);
  db.prepare(
    `UPDATE projects SET name=?, tagline=?, categories=?, platforms=?, description=?, gameplay=?, stack=?,
       repo=?, contact_name=?, contact=?, qq=?, cover=?, images=?, status='pending', reject_reason='', reviewed_at=NULL
     WHERE id=?`
  ).run(
    String(body.name || row.name).trim(),
    String(body.tagline || row.tagline).trim(),
    JSON.stringify(Array.isArray(body.categories) ? body.categories.slice(0, 3).map(String) : JSON.parse(row.categories)),
    JSON.stringify(Array.isArray(body.platforms) ? body.platforms.map(String) : JSON.parse(row.platforms)),
    String(body.description || row.description).trim(),
    JSON.stringify(Array.isArray(body.gameplay) ? body.gameplay.map(String) : JSON.parse(row.gameplay)),
    JSON.stringify(Array.isArray(body.stack) ? body.stack.map(String) : JSON.parse(row.stack)),
    String(body.repo ?? row.repo).trim(),
    String(body.contactName ?? row.contact_name).trim(),
    String(body.contact ?? row.contact).trim(),
    String(body.qq ?? row.qq).trim(),
    images[0]?.src || row.cover,
    JSON.stringify(images.length ? images : JSON.parse(row.images)),
    row.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '作品不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只能删除自己的作品' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

/* ---------------- 点赞 / 收藏 ---------------- */
function toggleRelation(table, projectId, userId) {
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE project_id = ? AND user_id = ?`).get(projectId, userId);
  if (exists) {
    db.prepare(`DELETE FROM ${table} WHERE project_id = ? AND user_id = ?`).run(projectId, userId);
  } else {
    db.prepare(`INSERT INTO ${table} (project_id, user_id, created_at) VALUES (?, ?, ?)`).run(projectId, userId, Date.now());
  }
  const count = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE project_id = ?`).get(projectId).n;
  return { active: !exists, count };
}

router.post('/:id/like', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row || !isVisible(row, req.user)) return res.status(404).json({ error: '作品不存在' });
  const result = toggleRelation('likes', row.id, req.user.id);
  res.json({ ok: true, liked: result.active, count: result.count });
});

router.post('/:id/favorite', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row || !isVisible(row, req.user)) return res.status(404).json({ error: '作品不存在' });
  const result = toggleRelation('favorites', row.id, req.user.id);
  res.json({ ok: true, favorited: result.active, count: result.count });
});

/* ---------------- 评论 ---------------- */
router.get('/:id/comments', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row || !isVisible(row, req.user)) return res.status(404).json({ error: '作品不存在' });
  const rows = db
    .prepare(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.project_id = ? AND c.deleted = 0
       ORDER BY c.created_at DESC LIMIT 200`
    )
    .all(row.id);
  res.json({
    items: rows.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: { id: c.user_id, name: c.author_name },
      mine: req.user ? c.user_id === req.user.id : false
    }))
  });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row || !isVisible(row, req.user)) return res.status(404).json({ error: '作品不存在' });
  if (isMuted(req.user)) {
    const until = new Date(req.user.muted_until).toLocaleString('zh-CN');
    return res.status(403).json({ error: `你已被禁言，解除时间：${until}` });
  }
  const content = String(req.body?.content || '').trim();
  if (content.length < 2) return res.status(400).json({ error: '评论至少 2 个字' });
  if (content.length > 500) return res.status(400).json({ error: '评论最多 500 字' });

  const now = Date.now();
  const id = db
    .prepare('INSERT INTO comments (project_id, user_id, content, created_at) VALUES (?, ?, ?, ?)')
    .run(row.id, req.user.id, content, now).lastInsertRowid;
  res.json({
    ok: true,
    comment: { id, content, createdAt: now, author: { id: req.user.id, name: req.user.name }, mine: true }
  });
});

router.delete('/comments/:commentId', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只能删除自己的评论' });
  }
  db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').run(comment.id);
  res.json({ ok: true });
});

/* ---------------- 图片上传 ---------------- */
router.post('/upload/images', requireAuth, upload.array('images', 8), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: '没有收到图片' });
  res.json({ ok: true, urls: files.map((file) => `/uploads/${file.filename}`) });
});

export default router;
