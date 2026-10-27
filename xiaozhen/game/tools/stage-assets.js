// 只从原始素材包中拷贝游戏实际用到的模块（gltf + bin + 贴图），
// 使 game/ 目录可以独立运行。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TOWN_SRC = path.join(ROOT, 'Medieval Village MegaKit[Standard]/Medieval Village MegaKit[Standard]/glTF');
const TOWN_OUT = path.join(ROOT, 'game/assets/town');
const CHAR_SRC = path.join(
  ROOT,
  'Modular Character Outfits - Fantasy[Standard]/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits'
);
const CHAR_OUT = path.join(ROOT, 'game/assets/character');

const TOWN_PIECES = [
  // 墙体
  'Wall_Plaster_Straight',
  'Wall_Plaster_Straight_Base',
  'Wall_Plaster_Door_Flat',
  'Wall_Plaster_Window_Wide_Flat',
  'Wall_Plaster_Window_Thin_Round',
  'Wall_Plaster_WoodGrid',
  'Wall_UnevenBrick_Straight',
  'Wall_UnevenBrick_Door_Round',
  'Wall_UnevenBrick_Window_Wide_Flat',
  'Wall_Arch',
  'Wall_BottomCover',
  // 转角装饰
  'Corner_Exterior_Wood',
  'Corner_Exterior_Brick',
  'Corner_Interior_Big',
  // 门与门框
  'DoorFrame_Flat_WoodDark',
  'DoorFrame_Round_WoodDark',
  'Door_1_Flat',
  'Door_2_Flat',
  'Door_2_Round',
  'Door_4_Flat',
  // 窗与百叶
  'Window_Wide_Flat1',
  'Window_Thin_Flat1',
  'Window_Wide_Round1',
  'WindowShutters_Wide_Flat_Open',
  'WindowShutters_Thin_Round_Open',
  // 屋顶
  'Roof_RoundTiles_4x4',
  'Roof_RoundTiles_4x6',
  'Roof_RoundTiles_6x6',
  'Roof_RoundTiles_6x8',
  'Roof_RoundTiles_8x8',
  'Roof_Tower_RoundTiles',
  'Roof_Front_Brick4',
  'Roof_Dormer_RoundTile',
  // 地板（广场与台阶）
  'Floor_Brick',
  'Floor_RedBrick',
  'Floor_UnevenBrick',
  'Floor_WoodDark',
  // 楼梯
  'Stairs_Exterior_Straight',
  'Stairs_Exterior_Platform',
  // 道具
  'Prop_Chimney',
  'Prop_Chimney2',
  'Prop_Crate',
  'Prop_Wagon',
  'Prop_Support',
  'Prop_WoodenFence_Single',
  'Prop_WoodenFence_Extension1',
  'Prop_WoodenFence_Extension2',
  'Prop_Brick1',
  'Prop_Brick2',
  'Prop_Brick3',
  'Prop_Brick4',
  'Prop_Vine1',
  'Prop_Vine2',
  'Prop_Vine4',
  'Prop_Vine5',
  'Prop_Vine6',
  'Prop_Vine9',
  'Prop_ExteriorBorder_Straight1',
  'Prop_ExteriorBorder_Straight2',
  'Prop_ExteriorBorder_Corner',
  'Prop_MetalFence_Simple',
  'Balcony_Cross_Straight',
  'Balcony_Simple_Straight',
];

const CHAR_FILES = [
  'Male_Ranger.gltf',
  'Male_Ranger.bin',
  'T_Ranger_BaseColor.png',
  'T_Ranger_Normal.png',
  'T_Ranger_ORM.png',
  'T_Regular_Male_Dark_BaseColor.png',
  'T_Regular_Male_Normal.png',
  'T_Regular_Male_Roughness.png',
];

fs.mkdirSync(TOWN_OUT, { recursive: true });
fs.mkdirSync(CHAR_OUT, { recursive: true });

const copied = new Set();
function copy(srcDir, outDir, name) {
  const src = path.join(srcDir, name);
  const dst = path.join(outDir, name);
  if (!fs.existsSync(src)) {
    console.warn('  [缺失]', name);
    return false;
  }
  if (copied.has(dst)) return true;
  fs.copyFileSync(src, dst);
  copied.add(dst);
  return true;
}

let count = 0;
for (const piece of TOWN_PIECES) {
  const src = path.join(TOWN_SRC, `${piece}.gltf`);
  if (!fs.existsSync(src)) {
    console.warn('  [缺失模块]', piece);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(src, 'utf8'));
  copy(TOWN_SRC, TOWN_OUT, `${piece}.gltf`);
  for (const buf of json.buffers || []) {
    if (buf.uri && !buf.uri.startsWith('data:')) copy(TOWN_SRC, TOWN_OUT, decodeURIComponent(buf.uri));
  }
  for (const img of json.images || []) {
    if (img.uri && !img.uri.startsWith('data:')) copy(TOWN_SRC, TOWN_OUT, decodeURIComponent(img.uri));
  }
  count++;
}

for (const file of CHAR_FILES) copy(CHAR_SRC, CHAR_OUT, file);

const manifest = TOWN_PIECES.filter((p) => fs.existsSync(path.join(TOWN_OUT, `${p}.gltf`)));
fs.writeFileSync(path.join(TOWN_OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`小镇模块 ${count} 个，角色文件 ${CHAR_FILES.length} 个，素材已就位。`);
