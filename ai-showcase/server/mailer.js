import nodemailer from 'nodemailer';
import { config, smtpReady } from './config.js';

let transporter = null;
if (smtpReady) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
}

export async function sendCodeMail(email, code) {
  if (!transporter) {
    console.log(`\n[mail:dev] 发送到 ${email} 的验证码：${code}（未配置 SMTP，仅打印到控制台）\n`);
    return { dev: true };
  }
  await transporter.sendMail({
    from: `"AI 造物馆·智纪元" <${config.smtp.from}>`,
    to: email,
    subject: '注册验证码 · AI 造物馆·智纪元',
    text: `你的注册验证码是 ${code}，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    html: `
      <div style="font-family:system-ui,-apple-system,'PingFang SC',sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#f6f7fb;border-radius:16px">
        <h2 style="margin:0 0 6px;color:#0f1222">AI 造物馆·智纪元</h2>
        <p style="margin:0 0 20px;color:#5f6579;font-size:14px">注册验证码</p>
        <div style="background:#fff;border:1px solid #e5e8f1;border-radius:12px;padding:20px;text-align:center">
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#4f46e5">${code}</div>
          <p style="margin:10px 0 0;color:#8b90a3;font-size:12px">10 分钟内有效</p>
        </div>
        <p style="margin:20px 0 0;color:#8b90a3;font-size:12px">如果不是你本人操作，请忽略这封邮件。</p>
      </div>`
  });
  return { dev: false };
}
