import { Vector3 } from 'three';

export const WORLD_SCALE = 2.2;

// 赛道布局。坐标是「原始单位」，乘 WORLD_SCALE 得到米；startPoint 直接用世界坐标。
export const TRACK_LAYOUTS = {
  dockyard: {
    id: 'dockyard',
    theme: 'harbor',
    name: '港湾环道',
    en: 'DOCKYARD LOOP',
    note: '紧凑慢弯 + 连续起伏',
    km: 1.41,
    width: 15.5,
    startWorld: [330, 150],
    heading: [-0.3, 0, 0.954],
    raw: [
      [150, 68], [122, 108], [68, 124], [8, 121], [-42, 100], [-66, 62],
      [-62, 14], [-34, -30], [20, -54], [80, -50], [126, -22], [150, 22],
    ],
  },
  seabreeze: {
    id: 'seabreeze',
    theme: 'coast',
    name: '海风高速',
    en: 'SEABREEZE RUN',
    note: '高速连续弯 · 长背直道',
    km: 1.5,
    width: 17,
    // 贴着沙滩走：整条赛道向南平移，最后一弯直接压在滨海沙丘旁
    startWorld: [17.6, 189.2],
    heading: [0.95, 0, 0.311],
    raw: [
      [-40, 60], [8, 86], [66, 94], [122, 80], [162, 50], [184, 4],
      [176, -46], [142, -82], [92, -100], [38, -94], [-8, -70], [-38, -34], [-52, 8],
    ],
  },
  midtown: {
    id: 'midtown',
    theme: 'market',
    name: '中环夜街',
    en: 'MIDTOWN NIGHTS',
    note: '窄街组合弯 · 贴墙飞行',
    km: 1.31,
    width: 15,
    startWorld: [-373.8, 130],
    heading: [0.943, 0, 0.332],
    raw: [
      [-284, 12], [-244, 39], [-200, 44], [-167, 60], [-121, 63], [-80, 39],
      [-64, -7], [-80, -55], [-124, -84], [-179, -91], [-232, -72], [-270, -33],
    ],
  },
  forest: {
    id: 'forest',
    theme: 'forest',
    name: '林间山道',
    en: 'FOREST PASS',
    note: '松林夹道 · 盲弯连发',
    km: 1.74,
    width: 15.5,
    startWorld: [1752.4, -573.5],
    heading: [-0.863, 0, 0.504],
    raw: [
      [836.2, -289.6], [794.5, -259.5], [752.2, -238.8], [704.4, -247.2],
      [656.6, -233.4], [596, -238], [568.9, -280.4], [590.9, -326.2],
      [595.7, -360.9], [605.9, -400.2], [644.2, -427.4], [693.4, -455],
      [744.4, -428.8], [769.2, -391.2], [801, -368.2], [846.7, -335.1],
    ],
  },
};

/** 当前生效的赛道定义（只读，用于 UI 文案）。 */
export function trackLayout(id = TRACK.layoutId) {
  return TRACK_LAYOUTS[id] || TRACK_LAYOUTS.dockyard;
}

export const TRACK_POINTS = [];

export const TRACK = {
  layoutId: 'dockyard',
  width: 18,
  runoff: 1.1,
  barrierOffset: 10.4,
  sidewalk: 6.5,
  startPoint: new Vector3(0, 0, 245),
  startHeading: new Vector3(1, 0, 0.02).normalize(),
  laps: 3,
  gridGap: 9.5,
  gridRows: 3,
};

/** 切换赛道布局（必须在构造 Track 之前调用）。 */
export function setTrackLayout(id) {
  const def = TRACK_LAYOUTS[id] || TRACK_LAYOUTS.dockyard;
  TRACK_POINTS.length = 0;
  for (const [x, z] of def.raw) {
    TRACK_POINTS.push(new Vector3(x * WORLD_SCALE, 0, z * WORLD_SCALE));
  }
  TRACK.layoutId = def.id;
  TRACK.width = def.width ?? 18;
  TRACK.barrierOffset = (def.width ?? 18) * 0.58;
  TRACK.startPoint.set(def.startWorld[0], 0, def.startWorld[1]);
  TRACK.startHeading.set(def.heading[0], 0, def.heading[1]).normalize();
  return def;
}

export const SETTINGS_KEY = 'apex-city-settings-v1';
export const MAP_PREVIEW_KEY = 'apex-city-map-preview-v1';

/** 进入全屏赛道地图时暂存的赛道 id（只影响本次标签页）。 */
export function readMapPreview() {
  try {
    const id = sessionStorage.getItem(MAP_PREVIEW_KEY);
    return TRACK_LAYOUTS[id] ? id : null;
  } catch {
    return null;
  }
}

export function setMapPreview(id) {
  try { sessionStorage.setItem(MAP_PREVIEW_KEY, id); } catch { /* ignored */ }
}

export function clearMapPreview() {
  try { sessionStorage.removeItem(MAP_PREVIEW_KEY); } catch { /* ignored */ }
}

export function savedTrackId() {
  const preview = readMapPreview();
  if (preview) return preview;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const id = raw ? JSON.parse(raw).track : null;
    return TRACK_LAYOUTS[id] ? id : 'dockyard';
  } catch {
    return 'dockyard';
  }
}

setTrackLayout('dockyard');

export const CARS = [
  {
    id: 'vireo',
    index: '01',
    brand: 'STRADALE',
    name: 'Vireo GT3',
    className: 'GT3 · RWD · 650 HP',
    tagline: '四视图重建 · 蓝红 GT3 厂队涂装',
    description: '参照四视图重建的 GT3 赛车：宽体、天鹅颈大尾翼与前置 V8。前桥指向利落，尾部稳定，适合在街道护栏间贴弯飞行。',
    hp: 650,
    topSpeed: 318,
    accelTime: 2.9,
    stats: { speed: 84, grip: 90, accel: 82, brake: 90 },
    paint: '#1d34a4',
    paintName: 'COBALT RACING',
    palette: ['#1d34a4', '#e9e4d8', '#14161a', '#cf2032'],
    model: { style: 'gt3', wing: 'swan', number: '33', livery: 'gt3' },
    physics: { maxSpeed: 88.5, accel: 21.8, brake: 38, grip: 9.5, driftGrip: 2.3, steer: 1.95, nitro: 1.16 },
  },
  {
    id: 'nocturne',
    index: '02',
    brand: 'AURELIA',
    name: 'Nocturne LM',
    className: 'LM · AWD · 720 HP',
    tagline: '四视图重建 · 白蓝红耐力赛原型',
    description: '低矮的封闭式座舱、巨大后翼子板与空力轮盖。四驱系统在出弯时把 720 匹马力完整压进柏油，极速与稳定性兼备。',
    hp: 720,
    topSpeed: 332,
    accelTime: 2.7,
    stats: { speed: 86, grip: 88, accel: 89, brake: 91 },
    paint: '#e7e3d8',
    paintName: 'MARTINI WHITE',
    palette: ['#e7e3d8', '#c7c5bd', '#17191b', '#21346d'],
    model: { style: 'lm', wing: 'duck', number: '12', livery: 'lm' },
    physics: { maxSpeed: 92.2, accel: 23.0, brake: 39, grip: 9.7, driftGrip: 2.4, steer: 1.88, nitro: 1.15 },
  },
];

export const AI_DRIVERS = [
  { id: 'moreau', name: 'R. MOREAU', short: 'MOR', number: '07', color: '#d9d5cc', carId: 'vireo', skill: 0.922, aggression: 0.7 },
  { id: 'tanaka', name: 'K. TANAKA', short: 'TAN', number: '23', color: '#2b6b62', carId: 'nocturne', skill: 0.936, aggression: 0.55 },
  { id: 'voss', name: 'M. VOSS', short: 'VOS', number: '31', color: '#f06a2b', carId: 'vireo', skill: 0.906, aggression: 0.8 },
  { id: 'alvarez', name: 'C. ALVAREZ', short: 'ALV', number: '21', color: '#4f7fb8', carId: 'nocturne', skill: 0.948, aggression: 0.45 },
  { id: 'keaton', name: 'J. KEATON', short: 'KEA', number: '88', color: '#7a6ad8', carId: 'vireo', skill: 0.915, aggression: 0.65 },
];

export const MODES = {
  gp: {
    id: 'gp', name: '城市大奖赛', en: 'GRAND PRIX', laps: 3, opponents: true,
    description: '六车同场，静态发车。三圈定胜负。',
  },
  tt: {
    id: 'tt', name: '计时挑战', en: 'TIME ATTACK', laps: 3, opponents: false,
    description: '独自上场，挑战赛道与自己的最快圈。',
  },
  free: {
    id: 'free', name: '自由驾驶', en: 'FREE DRIVE', laps: 0, opponents: false,
    description: '没有计时，没有对手。沿着海岸线自由驾驶。',
  },
};

export const HUD_COLORS = ['#ff5a1f', '#8df0b6', '#ffd25a', '#7fb5ff', '#c79bff', '#f5f0e6'];

export const START_OFFSETS = [-49, -39.5, -29.5, -20, -10.5, -1.5];

export const DEFAULT_SETTINGS = {
  quality: 'high',
  camera: 'chase',
  volume: 70,
  sound: true,
  motion: true,
  fps: false,
  selectedCar: 'vireo',
  paint: '#1d34a4',
  mode: 'gp',
  // 车体比例（每台车一份，按车型存）
  stance: {},
  track: 'dockyard',
  // 手柄 / 转向手感
  padSensitivity: 100,
  padDeadzone: 12,
  padInvert: false,
  rumble: true,
};
