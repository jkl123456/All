import * as THREE from 'three';

/**
 * 每条赛道一套「主题」：天空、光照、雾、地面与周边造景类型。
 * 所有颜色都是 sRGB 十六进制，直接喂给 three 的 Color。
 */
const BASE = {
  urban: true,
  palms: true,
  seaside: true,
  promenade: true,
  market: false,
  port: false,
  forest: false,
  valley: false,
  ground: 'city',
  sun: { az: -0.59, el: 0.136 },
  light: { az: -0.59, el: 0.5, color: 0xffbd86, intensity: 4.35 },
  sky: { turbidity: 2.8, rayleigh: 3.8, mie: 0.0026, mieG: 0.82, cloud: 1 },
  glow: { color: 0xffd6a3, opacity: 0.55 },
  moon: 0,
  stars: 0,
  lamp: { color: 0xffc48b, intensity: 2.4, pool: 0.4 },
  fog: { color: 0xc29578, density: 0.00028 },
  exposure: 0.98,
  envIntensity: 0.88,
  hemi: { sky: 0xc8def0, ground: 0x3a2b21, intensity: 0.82 },
  fill: { color: 0x7fa4c9, intensity: 0.55 },
  bounce: { color: 0xff9c62, intensity: 0.2 },
  land: { color: 0x8a7d6a, flat: false },
  water: { color: 0x1d4c5c, visible: true },
  ridge: { far: 0x6a655f, near: 0x8c8174 },
};

const THEMES = {
  // 黄金时刻的市中心
  city: { id: 'city' },

  // 港湾：市中心偏水岸，雾更薄、光更暖
  harbor: {
    id: 'harbor',
    sun: { az: -0.44, el: 0.15 },
    light: { az: -0.44, el: 0.5, color: 0xffc08a, intensity: 4.2 },
    fog: { color: 0xbf967a, density: 0.0003 },
    exposure: 0.99,
  },

  // 工业港：更冷、更灰的晨光，龙门吊与集装箱
  port: {
    id: 'port',
    port: true,
    sun: { az: -0.25, el: 0.24 },
    light: { az: -0.25, el: 0.45, color: 0xffd0a0, intensity: 4.0 },
    fog: { color: 0xaeb7ba, density: 0.00033 },
    exposure: 1.0,
    hemi: { sky: 0xd2e2ef, ground: 0x38302a, intensity: 0.86 },
    fill: { color: 0x8fb2d4, intensity: 0.58 },
    land: { color: 0x8d8375, flat: false },
  },

  // 海边：高日照、干净的海雾、白沙
  coast: {
    id: 'coast',
    urban: false,
    promenade: false,
    ground: 'dry',
    sun: { az: 0.52, el: 0.52 },
    light: { az: 0.52, el: 0.62, color: 0xfff1da, intensity: 3.9 },
    sky: { turbidity: 1.7, rayleigh: 1.9, mie: 0.0012, mieG: 0.86, cloud: 1.15 },
    glow: { color: 0xfff2c8, opacity: 0.36 },
    fog: { color: 0xc2d5de, density: 0.0001 },
    exposure: 0.82,
    envIntensity: 0.58,
    hemi: { sky: 0xdcecff, ground: 0x6a5b42, intensity: 0.62 },
    fill: { color: 0x9ec3e8, intensity: 0.5 },
    bounce: { color: 0xffd9a8, intensity: 0.24 },
    land: { color: 0xa2977f, flat: false },
    water: { color: 0x1f6a78, visible: true },
    ridge: { far: 0x7f8a92, near: 0x9aa3a6 },
    lamp: { color: 0xffe0b0, intensity: 2.0, pool: 0.26 },
  },

  // 夜市：蓝调夜晚 + 暖色灯笼
  market: {
    id: 'market',
    market: true,
    sun: { az: 0.8, el: -0.1 },
    light: { az: -0.55, el: 0.78, color: 0xa9c0e8, intensity: 1.5 },
    sky: { turbidity: 8.5, rayleigh: 0.55, mie: 0.004, mieG: 0.9, cloud: 0.2 },
    glow: null,
    moon: 0.9,
    stars: 1,
    lamp: { color: 0xffb066, intensity: 3.2, pool: 0.55 },
    fog: { color: 0x0b1420, density: 0.00055 },
    exposure: 1.2,
    envIntensity: 0.34,
    hemi: { sky: 0x2b3d5c, ground: 0x100d0b, intensity: 0.58 },
    fill: { color: 0x2c4a7a, intensity: 0.3 },
    bounce: { color: 0xff8a45, intensity: 0.18 },
    land: { color: 0x3a322b, flat: true },
    water: { color: 0x0d1b26, visible: true },
    ridge: { far: 0x1a2331, near: 0x232d3a },
  },

  // 林间：湿润的绿色调、浓一点的雾
  forest: {
    id: 'forest',
    urban: false,
    palms: false,
    seaside: false,
    forest: true,
    ground: 'grass',
    sun: { az: 1.85, el: 0.62 },
    light: { az: 1.85, el: 0.74, color: 0xfff2d6, intensity: 3.35 },
    sky: { turbidity: 2.4, rayleigh: 2.2, mie: 0.0016, mieG: 0.8, cloud: 0.55 },
    glow: { color: 0xe9f2c8, opacity: 0.22 },
    fog: { color: 0x93a48d, density: 0.00034 },
    exposure: 0.92,
    envIntensity: 0.72,
    hemi: { sky: 0xc9e0d2, ground: 0x2b3a22, intensity: 0.92 },
    fill: { color: 0x9db9a8, intensity: 0.46 },
    bounce: { color: 0x9fae6a, intensity: 0.2 },
    land: { color: 0x5c6a45, flat: true },
    water: { color: 0x1d4c5c, visible: false },
    ridge: { far: 0x5a6b55, near: 0x74856a },
  },

  // 山谷：干热岩壁、金色尘埃
  valley: {
    id: 'valley',
    urban: false,
    palms: false,
    seaside: false,
    valley: true,
    ground: 'dry',
    sun: { az: 0.82, el: 0.28 },
    light: { az: 0.82, el: 0.44, color: 0xffcf9c, intensity: 4.1 },
    sky: { turbidity: 4.2, rayleigh: 3.1, mie: 0.0032, mieG: 0.84, cloud: 0.8 },
    glow: { color: 0xffd9a8, opacity: 0.5 },
    fog: { color: 0xc4a67e, density: 0.00042 },
    exposure: 0.97,
    envIntensity: 0.84,
    hemi: { sky: 0xd8d2b8, ground: 0x4a3a26, intensity: 0.88 },
    fill: { color: 0x86a0c0, intensity: 0.46 },
    land: { color: 0x8a7a55, flat: true },
    water: { color: 0x1d4c5c, visible: false },
    ridge: { far: 0x7d6a52, near: 0xa08866 },
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function getTheme(id) {
  const def = THEMES[id] || THEMES.city;
  return {
    ...BASE,
    ...def,
    sun: { ...BASE.sun, ...(def.sun || {}) },
    light: { ...BASE.light, ...(def.light || {}) },
    sky: { ...BASE.sky, ...(def.sky || {}) },
    fog: { ...BASE.fog, ...(def.fog || {}) },
    hemi: { ...BASE.hemi, ...(def.hemi || {}) },
    fill: { ...BASE.fill, ...(def.fill || {}) },
    bounce: { ...BASE.bounce, ...(def.bounce || {}) },
    land: { ...BASE.land, ...(def.land || {}) },
    water: { ...BASE.water, ...(def.water || {}) },
    ridge: { ...BASE.ridge, ...(def.ridge || {}) },
    lamp: { ...BASE.lamp, ...(def.lamp || {}) },
    glow: def.glow === null ? null : { ...BASE.glow, ...(def.glow || {}) },
  };
}

/** 方位角 az 从 +Z 转向 +X，仰角 el 向上；返回单位向量。 */
export function dirFrom(az, el) {
  const c = Math.cos(el);
  return new THREE.Vector3(Math.sin(az) * c, Math.sin(el), Math.cos(az) * c).normalize();
}

export { THEMES };
