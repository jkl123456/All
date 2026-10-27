/** 板书脚本的小工具：所有坐标基于 1000 × 620 的白板 */

export const BLUE = '#2f5d8f';
export const RED = '#b6412f';
export const GRAY = '#5d6470';
export const GOLD = '#b4831f';
export const GREEN = '#2c7355';

export const P = (type, x, y, o = {}) => ({ k: 'clay', type, x, y, ...o });
export const T = (t, x, y, o = {}) => ({ k: 'text', t, x, y, ...o });
export const A = (from, to, o = {}) => ({ k: 'arrow', from, to, ...o });
export const L = (x, y, rx, ry, o = {}) => ({ k: 'loop', x, y, rx, ry, ...o });
export const U = (x, y, w, o = {}) => ({ k: 'underline', x, y, w, ...o });
export const S = (x, y, o = {}) => ({ k: 'star', x, y, ...o });
export const TAG = (t, x, y, o = {}) => ({ k: 'tag', t, x, y, ...o });
export const NOTE = (x, y, w, h, lines, o = {}) => ({ k: 'note', x, y, w, h, lines, ...o });
export const PATH = (d, o = {}) => ({ k: 'path', d, ...o });

/** 按字符数硬切，中文足够用 */
export function wrap(str, n = 20, max = 4) {
  const text = String(str || '').replace(/\s+/g, '');
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out.slice(0, max);
}

/** 取第一句，作为一句话结论 */
export function firstSentence(str, fallback = '') {
  const t = String(str || '').trim();
  const i = t.indexOf('。');
  return (i > 0 ? t.slice(0, i) : t) || fallback;
}
