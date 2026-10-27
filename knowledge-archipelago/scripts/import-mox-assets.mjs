/**
 * 把 mox/ 里的 OBJ 模型转成游戏用的 GLB。
 *
 *  - cartoon_beach_prop_pack：沙滩阳伞、躺椅、浮圈、皮球、冰桶……（OBJ + PNG）
 *  - mayflower：一艘停在海上的老帆船（OBJ + PNG）
 *
 * OBJ 本身不带材质，贴图在运行时按同名 PNG 挂上去，所以这里只转几何。
 *
 * 用法：node scripts/import-mox-assets.mjs
 */
import { mkdir, readdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import obj2gltf from 'obj2gltf';

const BEACH_SRC = 'mox/cartoon_beach_prop_pack/cartoon_beach_prop_pack';
const BEACH_OUT = 'public/models/beach';
const SHIP_SRC = 'mox/mayflower/model.obj';
const SHIP_OUT = 'public/models/beach/mayflower.glb';

async function convert(input, output) {
  const glb = await obj2gltf(input, {
    binary: true,
    separate: false,
    checkTransparency: false,
    optimizeFloatPrecision: false,
  });
  await writeFile(output, glb);
  return glb.length;
}

await mkdir(join(BEACH_OUT, 'textures'), { recursive: true });

const models = (await readdir(join(BEACH_SRC, 'models'))).filter((file) => file.endsWith('.obj'));
for (const file of models) {
  const name = file.replace(/\.obj$/, '');
  const size = await convert(join(BEACH_SRC, 'models', file), join(BEACH_OUT, `${name}.glb`));
  console.log(`beach/${name}.glb`, Math.round(size / 1024), 'KB');
}

const textures = (await readdir(join(BEACH_SRC, 'textures'))).filter((file) => file.endsWith('.png'));
for (const file of textures) {
  await copyFile(join(BEACH_SRC, 'textures', file), join(BEACH_OUT, 'textures', file));
}
console.log('textures copied:', textures.length);

const shipSize = await convert(SHIP_SRC, SHIP_OUT);
await copyFile('mox/mayflower/texture.png', join(BEACH_OUT, 'textures', 'mayflower.png'));
console.log('beach/mayflower.glb', Math.round(shipSize / 1024), 'KB');
