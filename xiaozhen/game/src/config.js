/**
 * 设备与画质档位。
 * 手机优先：默认降到 low 档，像素比、阴影、地面贴图、植被数量都按档位收敛。
 */

const ua = navigator.userAgent || '';
const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
const touch = coarse || 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 1;
const shortSide = Math.min(window.screen?.width || 1920, window.screen?.height || 1080);

export const IS_MOBILE = touch && shortSide < 1000;
export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && touch);

const LOW_END = /Android [4-7]\.|SM-J|GT-I9|Redmi 4|Redmi 5/i.test(ua);

export const QUALITY_TIERS = {
  low: {
    pixelRatio: 1.4,
    antialias: false,
    shadows: 1024,
    shadowSpan: 28,
    groundTex: 1280,
    trees: 96,
    undergrowth: 78,
    animals: 4,
    animalView: 36,
    sway: true,
    dust: 90,
    leafShadows: false,
    far: 150,
  },
  mid: {
    pixelRatio: 1.75,
    antialias: true,
    shadows: 1536,
    shadowSpan: 34,
    groundTex: 1600,
    trees: 140,
    undergrowth: 120,
    animals: 5,
    animalView: 46,
    sway: true,
    dust: 150,
    leafShadows: true,
    far: 165,
  },
  high: {
    pixelRatio: 2,
    antialias: true,
    shadows: 2048,
    shadowSpan: 40,
    groundTex: 2048,
    trees: 180,
    undergrowth: 160,
    animals: 6,
    animalView: 58,
    sway: true,
    dust: 200,
    leafShadows: true,
    far: 180,
  },
};

function pickTier() {
  if (LOW_END) return 'low';
  if (IS_MOBILE) return shortSide > 720 ? 'mid' : 'low';
  const dpr = window.devicePixelRatio || 1;
  return dpr > 1.4 ? 'high' : 'mid';
}

export const TIER = pickTier();
export const QUALITY = QUALITY_TIERS[TIER];

export function maxPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatio);
}
