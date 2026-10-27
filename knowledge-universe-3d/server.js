import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4280;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http
  .createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const safePath = normalize(urlPath).replace(/^([/\\])+/, '');
      const file = join(root, safePath === '' ? 'index.html' : safePath);
      if (!file.startsWith(root)) throw new Error('Forbidden');
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`\n  知域 · 3D 知识宇宙\n  http://127.0.0.1:${port}\n`);
  });
