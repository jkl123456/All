import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const SERVER_DIR = __dirname;
export const DATA_DIR = path.join(__dirname, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  isProd: process.env.NODE_ENV === 'production',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
  }
};

export const smtpReady = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
