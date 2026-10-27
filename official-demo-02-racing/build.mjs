import { build as esbuild, context } from 'esbuild';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const started = Date.now();

await mkdir(dist, { recursive: true });

// file:// 下浏览器不能 fetch 本地 GLB，构建时把两台车体打成 base64 内联资源。
async function buildCarAssets() {
  const entries = [
    ['gt3', 'assets/models/car-gt3.glb'],
    ['lm', 'assets/models/car-lm.glb'],
  ];
  const payload = {};
  for (const [key, file] of entries) {
    try {
      const buf = await readFile(path.join(root, file));
      payload[key] = buf.toString('base64');
    } catch (err) {
      console.warn(`[car-assets] 跳过 ${file}: ${err.message}`);
    }
  }
  if (!Object.keys(payload).length) return;
  const out = path.join(dist, 'car-assets.js');
  await writeFile(out, `window.__APEX_CAR_GLB = ${JSON.stringify(payload)};\n`);
  const size = (await stat(out)).size / 1024 / 1024;
  console.log(`[car-assets] dist/car-assets.js ${size.toFixed(1)} MB`);
}

const options = {
  entryPoints: [path.join(root, 'src/main.js')],
  outfile: path.join(dist, 'game.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'safari16', 'firefox115'],
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
};

await buildCarAssets();

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching src/ ...');
} else {
  await esbuild(options);
  const bytes = (await stat(options.outfile)).size / 1024;
  console.log(`  dist\\game.js  ${bytes.toFixed(1)}kb`);
  console.log(`Done in ${Date.now() - started}ms`);
}
