export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

export function formatNumber(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.floor(Number(value) || 0));
}

export function formatTime(minutes) {
  const total = Math.floor(minutes) % (24 * 60);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function timePeriod(minutes) {
  const hour = (Math.floor(minutes) / 60) % 24;
  if (hour < 5) return '深夜';
  if (hour < 8) return '清晨';
  if (hour < 11) return '上午';
  if (hour < 14) return '正午';
  if (hour < 17) return '午后';
  if (hour < 19) return '黄昏';
  if (hour < 22) return '入夜';
  return '深夜';
}

export const SEASONS = ['春潮', '长夏', '风秋', '静冬'];
export const SEASON_NAMES = ['春潮', '长夏', '风秋', '静冬'];

export function getSeason(day) {
  return SEASONS[Math.floor((Math.max(1, day) - 1) / 28) % SEASONS.length];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(string) {
  let hash = 2166136261;
  for (let i = 0; i < string.length; i += 1) {
    hash ^= string.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomRange(min, max, rng = Math.random) {
  return min + (max - min) * rng();
}

export function pick(array, rng = Math.random) {
  return array[Math.floor(rng() * array.length)];
}

export function pickMany(array, count, rng = Math.random) {
  const copy = [...array];
  const output = [];
  while (copy.length && output.length < count) {
    const index = Math.floor(rng() * copy.length);
    output.push(copy.splice(index, 1)[0]);
  }
  return output;
}

export function shuffle(array, rng = Math.random) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)} 秒`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  return `${hours} 小时 ${mins % 60} 分`;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function arraysEqual(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
