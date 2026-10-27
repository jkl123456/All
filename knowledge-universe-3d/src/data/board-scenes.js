/**
 * 分步手绘板书的登记处。
 * 每个知识点给出 N 幅「一层一层加上去」的画面，与板书的幕数一一对应。
 * 没有登记的知识点会退回自动生成的板书（board-gen.js）。
 */
import { MATH_SCENES } from './scene-math.js';
import { SCIENCE_SCENES } from './scene-science.js';
import { WORLD_SCENES } from './scene-world.js';
import { WORD_SCENES } from './scene-words.js';
import { CODE_SCENES } from './scene-code.js';
import { TRADE_SCENES } from './scene-trade.js';

export const SCENES = {
  ...MATH_SCENES,
  ...SCIENCE_SCENES,
  ...WORLD_SCENES,
  ...WORD_SCENES,
  ...CODE_SCENES,
  ...TRADE_SCENES,
};
