/**
 * 初始化：创建管理员与系统作者，并把 data/projects.js 里的 6 件预置作品写入数据库。
 * 用法：npm run seed
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config, ROOT_DIR } from './config.js';

const SEED_FILE = path.join(ROOT_DIR, 'data', 'projects.js');
const source = fs.readFileSync(SEED_FILE, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const projects = sandbox.window.SEED_PROJECTS || [];

const adminEmail = config.adminEmail || 'admin@zhijiyuan.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

function ensureUser(email, name, role, password) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, existing.id);
    return existing.id;
  }
  const hash = bcrypt.hashSync(password, 10);
  const id = db
    .prepare('INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(email, hash, name, role, Date.now()).lastInsertRowid;
  console.log(`创建用户 ${email} / ${password}`);
  return id;
}

const adminId = ensureUser(adminEmail, '智纪元AD', 'admin', adminPassword);
const authorId = ensureUser('showcase@zhijiyuan.local', '智纪元AD', 'user', adminPassword);

const insert = db.prepare(`
  INSERT INTO projects
    (id, user_id, name, tagline, categories, platforms, description, gameplay, stack, repo,
     contact_name, contact, qq, cover, images, status, boost, created_at, reviewed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, tagline=excluded.tagline, categories=excluded.categories, platforms=excluded.platforms,
    description=excluded.description, gameplay=excluded.gameplay, stack=excluded.stack, repo=excluded.repo,
    cover=excluded.cover, images=excluded.images, status='approved'
`);

let index = 0;
for (const project of projects) {
  const created = project.date ? new Date(`${project.date}T10:00:00+08:00`).getTime() : Date.now();
  insert.run(
    project.id,
    authorId,
    project.name,
    project.tagline || '',
    JSON.stringify(project.categories || []),
    JSON.stringify(project.platforms || []),
    project.description || '',
    JSON.stringify(project.gameplay || []),
    JSON.stringify(project.stack || []),
    project.repo || '',
    project.contactName || '智纪元AD',
    project.contact || '',
    project.qq || '993739647',
    project.cover || project.images?.[0]?.src || '',
    JSON.stringify(project.images || []),
    index < 2 ? 1 : 0,
    created,
    created
  );
  index += 1;
  console.log(`写入作品：${project.name}`);
}

console.log(`\n完成：${projects.length} 件预置作品已入库。`);
console.log(`管理员：${adminEmail} / ${adminPassword}`);
console.log('请登录后台 http://127.0.0.1:3000/admin.html 审核、助推与用户管理。');
void adminId;
