import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config, ROOT_DIR, UPLOAD_DIR } from './config.js';
import { db } from './db.js';
import { optionalAuth } from './auth.js';
import authRoutes from './auth.js';
import projectRoutes from './projects.js';
import adminRoutes from './admin.js';
import myRoutes from './my.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(optionalAuth);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/my', myRoutes);

app.get('/api/site', (_req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.json({
    name: 'AI 造物馆·智纪元',
    wechat: '智纪元AD',
    qq: '993739647',
    projects: count("SELECT COUNT(*) AS n FROM projects WHERE status = 'approved'"),
    users: count('SELECT COUNT(*) AS n FROM users'),
    comments: count('SELECT COUNT(*) AS n FROM comments WHERE deleted = 0')
  });
});

app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

app.use((req, res, next) => {
  if (/^\/(server|node_modules|\.git)(\/|$)/.test(req.path)) return res.status(404).end();
  if (req.path === '/package.json' || req.path === '/.env' || req.path === '/package-lock.json') {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(ROOT_DIR, { extensions: ['html'], maxAge: config.isProd ? '1h' : 0 }));

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '单张图片不能超过 6MB' });
  if (err?.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '最多一次上传 8 张' });
  if (err?.message?.includes('只支持')) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: '服务器开小差了，请稍后再试' });
});

const port = config.port;
app.listen(port, () => {
  const hasAdmin = config.adminEmail
    ? db.prepare('SELECT id FROM users WHERE email = ?').get(config.adminEmail)
    : null;
  console.log(`\nAI 造物馆·智纪元 已启动`);
  console.log(`  本地地址: http://127.0.0.1:${port}`);
  console.log(`  管理入口: http://127.0.0.1:${port}/admin.html`);
  console.log(`  管理员邮箱: ${config.adminEmail || '未配置（可用 npm run seed 创建）'}`);
  if (config.adminEmail && !hasAdmin) {
    console.log(`  提示: 用 ${config.adminEmail} 注册后会自动成为管理员`);
  }
  console.log(`  邮件服务: ${process.env.SMTP_HOST ? '已配置 SMTP' : '未配置（验证码打印在控制台）'}\n`);
});
