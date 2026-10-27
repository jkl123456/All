import express from 'express';
import { db, mapProject } from './db.js';
import { requireAuth } from './auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/projects', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS author_name FROM projects p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ? ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json({ items: rows.map((row) => mapProject(row, req.user.id)) });
});

router.get('/favorites', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS author_name FROM favorites f
       JOIN projects p ON p.id = f.project_id
       JOIN users u ON u.id = p.user_id
       WHERE f.user_id = ? AND p.status = 'approved'
       ORDER BY f.created_at DESC`
    )
    .all(req.user.id);
  res.json({ items: rows.map((row) => mapProject(row, req.user.id)) });
});

router.get('/comments', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, p.name AS project_name FROM comments c
       JOIN projects p ON p.id = c.project_id
       WHERE c.user_id = ? AND c.deleted = 0
       ORDER BY c.created_at DESC LIMIT 100`
    )
    .all(req.user.id);
  res.json({
    items: rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      content: row.content,
      createdAt: row.created_at
    }))
  });
});

export default router;
