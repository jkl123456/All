import { build, context } from 'esbuild';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outdir = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const started = Date.now();

await mkdir(outdir, { recursive: true });

const options = {
  entryPoints: [path.join(root, 'src/main.js')],
  outfile: path.join(outdir, 'app.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'safari16', 'firefox115'],
  minify: !watch,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching src/ ...');
} else {
  await build(options);
  const bytes = (await stat(options.outfile)).size / 1024;
  console.log(`  dist/app.js  ${bytes.toFixed(1)} kb`);
  console.log(`Done in ${Date.now() - started} ms`);
}
