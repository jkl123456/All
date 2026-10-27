/**
 * 从苔溪镇（xiǎozhèn）搬过来的缓动小工具。
 * 角色的加速度、转向与步态都靠这几个函数，数值保持一致，手感才一样。
 */

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 帧率无关的指数逼近 */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** 角度版 damp，自动走最短的那一边 */
export function dampAngle(current, target, lambda, dt) {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-lambda * dt));
}

export function range(rng, min, max) {
  return min + (max - min) * rng();
}
