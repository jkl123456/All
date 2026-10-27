import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, UPLOAD_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const raw = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

/** 把 node:sqlite 的语句包一层，补齐 better-sqlite3 风格的返回类型 */
function wrapStatement(statement) {
  return {
    run: (...args) => {
      const result = statement.run(...args);
      return {
        changes: Number(result.changes ?? 0),
        lastInsertRowid: Number(result.lastInsertRowid ?? 0)
      };
    },
    get: (...args) => statement.get(...args) ?? undefined,
    all: (...args) => statement.all(...args)
  };
}

export const db = {
  prepare: (sql) => wrapStatement(raw.prepare(sql)),
  exec: (sql) => raw.exec(sql),
  pragma: (statement) => raw.exec('PRAGMA ' + statement),
  transaction: (fn) => (...args) => {
    raw.exec('BEGIN');
    try {
      const result = fn(...args);
      raw.exec('COMMIT');
      return result;
    } catch (error) {
      raw.exec('ROLLBACK');
      throw error;
    }
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  muted_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'register',
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  categories TEXT NOT NULL DEFAULT '[]',
  platforms TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  gameplay TEXT NOT NULL DEFAULT '[]',
  stack TEXT NOT NULL DEFAULT '[]',
  repo TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  qq TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT NOT NULL DEFAULT '',
  boost INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, boost, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id, created_at DESC);
`);

/* 老库迁移：补上降低优先级字段 */
const projectColumns = db.prepare('PRAGMA table_info(projects)').all();
if (!projectColumns.some((column) => column.name === 'demote')) {
  db.exec('ALTER TABLE projects ADD COLUMN demote INTEGER NOT NULL DEFAULT 0');
}

export function parseJson(text, fallback) {
  try {
    const value = JSON.parse(text);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    banned: Boolean(row.banned),
    mutedUntil: row.muted_until || 0,
    muted: (row.muted_until || 0) > Date.now(),
    createdAt: row.created_at
  };
}

export function isMuted(row) {
  return Boolean(row && row.muted_until && row.muted_until > Date.now());
}

/** 把数据库行转换成前端使用的作品对象 */
export function mapProject(row, viewerId = 0) {
  if (!row) return null;
  const likes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE project_id = ?').get(row.id).n;
  const favorites = db.prepare('SELECT COUNT(*) AS n FROM favorites WHERE project_id = ?').get(row.id).n;
  const comments = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE project_id = ? AND deleted = 0').get(row.id).n;
  const liked = viewerId
    ? Boolean(db.prepare('SELECT 1 FROM likes WHERE project_id = ? AND user_id = ?').get(row.id, viewerId))
    : false;
  const favorited = viewerId
    ? Boolean(db.prepare('SELECT 1 FROM favorites WHERE project_id = ? AND user_id = ?').get(row.id, viewerId))
    : false;
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    categories: parseJson(row.categories, []),
    platforms: parseJson(row.platforms, []),
    description: row.description,
    gameplay: parseJson(row.gameplay, []),
    stack: parseJson(row.stack, []),
    repo: row.repo,
    contactName: row.contact_name,
    contact: row.contact,
    qq: row.qq,
    cover: row.cover,
    images: parseJson(row.images, []),
    status: row.status,
    rejectReason: row.reject_reason,
    boost: Boolean(row.boost),
    demote: Boolean(row.demote),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    date: new Date(row.created_at).toISOString().slice(0, 10),
    author: { id: row.user_id, name: row.author_name || '匿名' },
    counts: { likes, favorites, comments },
    liked,
    favorited
  };
}
