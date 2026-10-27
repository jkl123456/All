/**
 * 文字引擎 —— 语文的另一种舞台：竖排诗行、字形拆解、对仗镜像、通感映射、文言断句。
 * 诗句逐字浮现，焦点行会亮起，其余淡下去。
 */
import {
  VIEW,
  alpha,
  circle,
  clamp,
  group,
  lerp,
  line,
  linearGradient,
  pathEl,
  rect,
  svgEl,
  textEl,
} from '../stage.js';

const W = VIEW.w;
const H = VIEW.h;
const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "SimSun", serif';
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function seal(parent, text, x, y, size = 44, color = '#c8443c') {
  const g = group(parent, { transform: `translate(${x} ${y})` });
  rect(g, 0, 0, size, size, { rx: 4, fill: color, opacity: 0.9 });
  textEl(g, text, {
    x: size / 2,
    y: size / 2 + size * 0.18,
    'text-anchor': 'middle',
    'font-size': size * 0.5,
    'font-family': SERIF,
    fill: '#fff3e6',
    'letter-spacing': -1,
  });
  return g;
}

function backPlate(ctx) {
  const { bg, defs, tone } = ctx;
  linearGradient(defs, 'tx-bg', [
    [0, '#080b14'],
    [0.5, '#0a101c'],
    [1, '#05070d'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  rect(bg, 0, 0, W, H, { fill: 'url(#tx-bg)' });
  const glow = circle(bg, 500, 300, 380, { fill: tone, opacity: 0.05 });
  glow.setAttribute('filter', 'blur(60px)');
  return glow;
}

/* ---------------------------------- verse ---------------------------------- */
function buildVerse(ctx) {
  const { root, fg, defs, spec, tone } = ctx;
  const lines = spec.lines || [];
  const vertical = spec.vertical !== false;
  const fontSize = spec.fontSize || (vertical ? 42 : 40);
  const columns = [];
  const chars = [];

  backPlate(ctx);

  if (vertical) {
    const colGap = spec.colGap || 118;
    const startX = 500 + ((lines.length - 1) * colGap) / 2;
    lines.forEach((lineText, li) => {
      const x = startX - li * colGap;
      const g = group(root, {});
      columns.push(g);
      // 竖线
      line(g, x + 22, 96, x + 22, 96 + lineText.length * (fontSize + 16) + 20, {
        stroke: alpha(tone, 0.12),
        'stroke-width': 1,
      });
      [...lineText].forEach((ch, ci) => {
        const t = textEl(g, ch, {
          x,
          y: 132 + ci * (fontSize + 18),
          'text-anchor': 'middle',
          'font-size': fontSize,
          'font-family': SERIF,
          fill: '#eef4ff',
          'letter-spacing': 0,
        });
        chars.push({ node: t, li, ci, count: lineText.length });
      });
    });
  } else {
    lines.forEach((lineText, li) => {
      const g = group(root, {});
      columns.push(g);
      const t = textEl(g, lineText, {
        x: 500,
        y: 250 + li * (fontSize + 34),
        'text-anchor': 'middle',
        'font-size': fontSize,
        'font-family': SERIF,
        fill: '#eef4ff',
        'letter-spacing': 4,
      });
      chars.push({ node: t, li, ci: 0, count: 1, whole: true });
    });
  }

  // 标题与印章
  const title = textEl(root, spec.title || '', {
    x: vertical ? 160 : 500,
    y: vertical ? 140 : 120,
    'text-anchor': vertical ? 'start' : 'middle',
    'font-size': 22,
    'font-family': SERIF,
    fill: alpha(tone, 0.9),
    'letter-spacing': 4,
  });
  const subtitle = textEl(root, spec.subtitle || '', {
    x: vertical ? 160 : 500,
    y: vertical ? 172 : 152,
    'text-anchor': vertical ? 'start' : 'middle',
    'font-size': 13,
    'font-family': SANS,
    fill: 'rgba(190,208,235,0.55)',
    'letter-spacing': 3,
  });
  const stamp = seal(root, spec.seal || '知', vertical ? 160 : 640, vertical ? 206 : 108, 40, alpha(tone, 1));

  // 副注（横排小字，用于解释）
  const note = textEl(root, spec.note || '', {
    x: 500,
    y: 566,
    'text-anchor': 'middle',
    'font-size': 16,
    'font-family': SANS,
    fill: 'rgba(196,214,238,0.6)',
    'letter-spacing': 2,
  });

  const vign = rect(fg, 0, 0, W, H, { fill: 'url(#tx-vign)' });
  const grad = svgEl('radialGradient', { id: 'tx-vign', cx: '50%', cy: '45%', r: '70%' }, defs);
  svgEl('stop', { offset: '55%', 'stop-color': '#000', 'stop-opacity': 0 }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.55 }, grad);

  return {
    defaults: { reveal: 0, focus: 0, glow: 0.6 },
    render(s, t) {
      const reveal = clamp(s.reveal) * lines.length;
      chars.forEach((item) => {
        const local = reveal - item.li;
        if (item.whole) {
          item.node.setAttribute('opacity', String(clamp(local * 2.2) * (item.li === Math.round(s.focus) ? 1 : 0.5)));
          return;
        }
        const p = clamp(local * 2.4 - item.ci * 0.18);
        item.node.setAttribute('opacity', String(p));
        item.node.setAttribute('transform', `translate(0 ${(1 - p) * 10})`);
        const focused = Math.round(s.focus) === item.li;
        item.node.setAttribute('fill', focused ? '#fffdf4' : 'rgba(214,228,248,0.62)');
        item.node.setAttribute('font-size', String(fontSize + (focused ? 1.5 : 0)));
        item.node.style.filter = focused ? `drop-shadow(0 0 ${8 + s.glow * 10}px ${alpha(tone, 0.75)})` : 'none';
      });
      columns.forEach((col, i) => {
        const on = Math.round(s.focus) === i;
        col.setAttribute('opacity', on ? 1 : 0.78);
      });
      title.setAttribute('opacity', String(clamp(s.reveal * 3)));
      subtitle.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.8));
      stamp.setAttribute('opacity', String(clamp(s.reveal * 2 - 0.2)));
      stamp.setAttribute('transform', `translate(${vertical ? 160 : 640} ${vertical ? 206 : 108}) scale(${lerp(1.3, 1, clamp(s.reveal * 2))})`);
      note.setAttribute('opacity', String(clamp(s.reveal * 2 - 0.5) * 0.9));
      vign.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- mirror ---------------------------------- */
function buildMirror(ctx) {
  const { root, fg, defs, spec, tone } = ctx;
  backPlate(ctx);
  const rows = spec.rows || [];
  const rowY = [250, 380];
  const madeRows = [];
  const links = [];

  const labelA = textEl(root, spec.labelA || '出句', {
    x: 96, y: rowY[0] + 8, 'font-size': 13, 'font-family': SANS, fill: 'rgba(180,200,230,0.5)', 'letter-spacing': 3,
  });
  const labelB = textEl(root, spec.labelB || '对句', {
    x: 96, y: rowY[1] + 8, 'font-size': 13, 'font-family': SANS, fill: 'rgba(180,200,230,0.5)', 'letter-spacing': 3,
  });

  rows.forEach((row, ri) => {
    const total = row.reduce((n, seg) => n + seg.text.length, 0);
    const charW = 74;
    const startX = 500 - (total * charW) / 2 + charW / 2;
    let cursor = startX;
    const segs = [];
    row.forEach((seg) => {
      const segChars = [];
      [...seg.text].forEach((ch) => {
        const node = textEl(root, ch, {
          x: cursor,
          y: rowY[ri],
          'text-anchor': 'middle',
          'font-size': 46,
          'font-family': SERIF,
          fill: '#eef4ff',
        });
        segChars.push(node);
        cursor += charW;
      });
      segs.push({ ...seg, chars: segChars, x: (segChars[0]?.getAttribute('x') ?? cursor) });
    });
    madeRows.push(segs);
  });

  // 对仗连线：同位置的词性对应
  const maxPairs = Math.max(...madeRows.map((r) => r.length));
  for (let i = 0; i < maxPairs; i += 1) {
    const a = madeRows[0]?.[i];
    const b = madeRows[1]?.[i];
    if (!a || !b) continue;
    const ax = Number(a.x) + ((a.text.length - 1) * 74) / 2;
    const bx = Number(b.x) + ((b.text.length - 1) * 74) / 2;
    const l = pathEl(root, `M${ax} ${rowY[0] + 22} C ${ax} ${rowY[0] + 74}, ${bx} ${rowY[1] - 74}, ${bx} ${rowY[1] - 26}`, {
      fill: 'none',
      stroke: alpha(tone, 0.35),
      'stroke-width': 1.2,
      'stroke-dasharray': '4 6',
      opacity: 0,
    });
    const tag = textEl(root, a.role || '', {
      x: (ax + bx) / 2 + 8,
      y: (rowY[0] + rowY[1]) / 2 + 4,
      'font-size': 12,
      'font-family': SANS,
      fill: alpha(tone, 0.75),
      opacity: 0,
    });
    links.push({ line: l, tag, ax, bx, index: i });
  }

  const note = textEl(root, spec.note || '字数相等 · 词性相对 · 结构相同 · 平仄相谐', {
    x: 500, y: 528, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS,
    fill: 'rgba(196,214,238,0.56)', 'letter-spacing': 3,
  });

  const vign = rect(fg, 0, 0, W, H, { fill: 'url(#tx-mirror-vign)' });
  const grad = svgEl('radialGradient', { id: 'tx-mirror-vign', cx: '50%', cy: '45%', r: '72%' }, defs);
  svgEl('stop', { offset: '58%', 'stop-color': '#000', 'stop-opacity': 0 }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.5 }, grad);

  return {
    defaults: { reveal: 0, focus: 0 },
    render(s) {
      const reveal = clamp(s.reveal) * 2;
      madeRows.forEach((segs, ri) => {
        segs.forEach((seg, si) => {
          const p = clamp(reveal - ri - si * 0.12);
          const focused = Math.round(s.focus) === si;
          seg.chars.forEach((node) => {
            node.setAttribute('opacity', String(p));
            node.setAttribute('fill', focused ? '#fffdf3' : 'rgba(216,229,248,0.86)');
            node.style.filter = focused ? `drop-shadow(0 0 12px ${alpha(tone, 0.7)})` : 'none';
          });
        });
      });
      links.forEach((link) => {
        const p = clamp((s.reveal - 0.55) * 3);
        const on = Math.round(s.focus) === link.index;
        link.line.setAttribute('opacity', String(on ? 0.85 : p * 0.35));
        link.line.setAttribute('stroke-width', on ? 1.8 : 1);
        link.tag.setAttribute('opacity', String(on ? 1 : p * 0.4));
      });
      labelA.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.9));
      labelB.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.9));
      note.setAttribute('opacity', String(clamp((s.reveal - 0.5) * 3) * 0.9));
      vign.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- mapping --------------------------------- */
function buildMapping(ctx) {
  const { root, fg, defs, spec, tone } = ctx;
  backPlate(ctx);
  const left = spec.left || [];
  const right = spec.right || [];

  const colX = [300, 700];
  const headL = textEl(root, spec.headLeft || '感官', {
    x: colX[0], y: 126, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS,
    fill: 'rgba(180,200,230,0.55)', 'letter-spacing': 4,
  });
  const headR = textEl(root, spec.headRight || '被唤醒的另一种感官', {
    x: colX[1], y: 126, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS,
    fill: 'rgba(180,200,230,0.55)', 'letter-spacing': 4,
  });

  const nodes = [[], []];
  [left, right].forEach((items, col) => {
    items.forEach((item, i) => {
      const y = 210 + i * 92;
      const g = group(root, {});
      const w = 300;
      const box = rect(g, colX[col] - w / 2, y - 30, w, 60, {
        rx: 14,
        fill: 'rgba(12,20,34,0.85)',
        stroke: alpha(tone, col === 0 ? 0.35 : 0.55),
        'stroke-width': 1,
      });
      const word = textEl(g, item.word, {
        x: colX[col], y: y + 8, 'text-anchor': 'middle', 'font-size': 32, 'font-family': SERIF, fill: '#f2f7ff',
      });
      const role = textEl(g, item.role || '', {
        x: colX[col], y: y + 30, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': SANS,
        fill: 'rgba(170,192,224,0.66)', 'letter-spacing': 2,
      });
      nodes[col].push({ g, box, word, role, y });
    });
  });

  const arcs = [];
  const count = Math.min(left.length, right.length);
  for (let i = 0; i < count; i += 1) {
    const y1 = nodes[0][i].y;
    const y2 = nodes[1][i].y;
    const arc = pathEl(root, `M${colX[0] + 156} ${y1} C 480 ${y1}, 520 ${y2}, ${colX[1] - 156} ${y2}`, {
      fill: 'none',
      stroke: alpha(tone, 0.5),
      'stroke-width': 1.4,
      'stroke-dasharray': '5 7',
      opacity: 0,
    });
    const label = textEl(root, '', {
      x: 500, y: (y1 + y2) / 2, 'text-anchor': 'middle', 'font-size': 12, 'font-family': SANS,
      fill: alpha(tone, 0.8), opacity: 0,
    });
    arcs.push({ arc, label, index: i });
  }

  const note = textEl(root, spec.note || '', {
    x: 500, y: 566, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS,
    fill: 'rgba(196,214,238,0.58)', 'letter-spacing': 2,
  });

  const vign = rect(fg, 0, 0, W, H, { fill: '#000', opacity: 0.18 });

  return {
    defaults: { reveal: 0, focus: 0 },
    render(s) {
      [0, 1].forEach((col) => {
        nodes[col].forEach((node, i) => {
          const p = clamp((s.reveal - (col === 0 ? 0 : 0.35) - i * 0.14) * 3.4);
          node.g.setAttribute('opacity', String(p));
          node.g.setAttribute('transform', `translate(${(1 - p) * (col === 0 ? -24 : 24)} 0)`);
          const on = Math.round(s.focus) === i;
          node.box.setAttribute('stroke', on ? alpha(tone, 0.95) : alpha(tone, col === 0 ? 0.3 : 0.45));
          node.box.setAttribute('fill', on ? alpha(tone, 0.12) : 'rgba(12,20,34,0.85)');
        });
      });
      arcs.forEach((item) => {
        const p = clamp((s.reveal - 0.5) * 3);
        const on = Math.round(s.focus) === item.index;
        item.arc.setAttribute('opacity', String(on ? 0.95 : p * 0.28));
        item.label.setAttribute('opacity', String(on ? 1 : 0));
      });
      headL.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.9));
      headR.setAttribute('opacity', String(clamp((s.reveal - 0.3) * 3) * 0.9));
      note.setAttribute('opacity', String(clamp((s.reveal - 0.6) * 3)));
      vign.setAttribute('opacity', 1);
    },
  };
}

/* -------------------------------- sentence -------------------------------- */
function buildSentence(ctx) {
  const { root, fg, defs, spec, tone } = ctx;
  backPlate(ctx);
  const raw = spec.text || '';
  const parts = raw.split('|');
  const chars = [];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const charW = Math.min(64, 880 / Math.max(total, 1));
  const startX = 500 - (total * charW) / 2 + charW / 2;
  let cursor = startX;
  let index = 0;
  const groupsMade = [];

  parts.forEach((part, pi) => {
    const isMark = spec.marks?.includes(part) || (part.length === 1 && spec.markChars?.includes(part));
    const g = group(root, {});
    const charsOfPart = [];
    [...part].forEach((ch) => {
      const node = textEl(g, ch, {
        x: cursor,
        y: 300,
        'text-anchor': 'middle',
        'font-size': 44,
        'font-family': SERIF,
        fill: '#eef4ff',
      });
      charsOfPart.push(node);
      const under = rect(g, cursor - charW * 0.36, 322, charW * 0.72, 2.4, { rx: 1.2, fill: alpha(tone, 0.9), opacity: 0 });
      g.dataset = g.dataset || {};
      chars.push({ node, under, partIndex: pi, isMark });
      cursor += charW;
      index += 1;
    });
    groupsMade.push({ g, pi, isMark, charsOfPart });
  });

  const tags = (spec.tags || []).map((tag, i) => {
    const g = group(root, { opacity: 0 });
    const x = 120 + i * 210;
    rect(g, x, 440, 180, 54, { rx: 12, fill: 'rgba(12,20,34,0.8)', stroke: alpha(tone, 0.4) });
    textEl(g, tag[0], {
      x: x + 16, y: 464, 'font-size': 15, 'font-family': SANS, fill: alpha(tone, 0.95),
    });
    textEl(g, tag[1], {
      x: x + 16, y: 484, 'font-size': 11.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return g;
  });

  const gloss = textEl(root, spec.gloss || '', {
    x: 500, y: 552, 'text-anchor': 'middle', 'font-size': 16, 'font-family': SANS,
    fill: 'rgba(198,216,240,0.62)', 'letter-spacing': 1,
  });

  const vign = rect(fg, 0, 0, W, H, { fill: '#000', opacity: 0.2 });

  return {
    defaults: { reveal: 0, focus: 0 },
    render(s, t) {
      chars.forEach((item, i) => {
        const p = clamp((s.reveal - i / Math.max(1, chars.length) * 0.75) * 5);
        item.node.setAttribute('opacity', String(p));
        item.node.setAttribute('transform', `translate(0 ${(1 - p) * 12})`);
        const markOn = item.isMark && Math.round(s.focus) === item.partIndex;
        item.node.setAttribute('fill', markOn ? '#ffd9a0' : item.isMark ? alpha(tone, 0.95) : 'rgba(224,234,250,0.9)');
        item.node.style.filter = markOn ? `drop-shadow(0 0 14px ${alpha('#ffd9a0', 0.7)})` : 'none';
        item.under.setAttribute('opacity', String(markOn ? 0.9 : 0));
      });
      tags.forEach((g, i) => {
        g.setAttribute('opacity', String(clamp((s.reveal - 0.45 - i * 0.1) * 3)));
        g.setAttribute('transform', `translate(0 ${Math.sin(t * 0.8 + i) * 2})`);
      });
      gloss.setAttribute('opacity', String(clamp((s.reveal - 0.6) * 3) * 0.95));
      vign.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- glyph ---------------------------------- */
/* 手绘的象形字形，用极简线条还原「日、山、人、木、休」的甲骨文形态 */
const PICTO = {
  日: (g, color) => {
    circle(g, 0, 0, 46, { fill: 'none', stroke: color, 'stroke-width': 5 });
    circle(g, 0, 0, 9, { fill: color });
  },
  月: (g, color) => {
    pathEl(g, 'M14 -46 q-46 20 -46 46 q0 26 46 46 q-28 -22 -28 -46 q0 -24 28 -46 z', { fill: 'none', stroke: color, 'stroke-width': 5 });
    pathEl(g, 'M2 -22 l0 44', { stroke: color, 'stroke-width': 3.4, fill: 'none' });
  },
  山: (g, color) => {
    pathEl(g, 'M-48 40 l0 -34 l20 0 l0 -22 l28 0 l0 22 l20 0 l0 -30 l22 0 l0 64 z', { fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linejoin': 'round' });
  },
  人: (g, color) => {
    pathEl(g, 'M-30 46 q18 -46 30 -92 q12 46 30 92', { fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' });
  },
  木: (g, color) => {
    pathEl(g, 'M0 -52 l0 104 M0 -8 l-34 44 M0 -8 l34 44 M0 -34 l-28 -26 M0 -34 l28 -26', {
      fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round',
    });
  },
  休: (g, color) => {
    pathEl(g, 'M-34 -50 l0 100 M-34 -10 l-22 34 M-34 -10 l-22 -26', { fill: 'none', stroke: color, 'stroke-width': 4.4, 'stroke-linecap': 'round' });
    pathEl(g, 'M10 -46 l0 92 M10 -6 l30 40 M10 -6 l30 -34', { fill: 'none', stroke: color, 'stroke-width': 4.4, 'stroke-linecap': 'round' });
  },
};

function buildGlyph(ctx) {
  const { root, fg, defs, spec, tone } = ctx;
  backPlate(ctx);
  const char = spec.char || '日';
  const stages = spec.stages || ['甲骨文', '金文', '小篆', '隶书', '楷书'];

  const big = textEl(root, char, {
    x: 500, y: 356, 'text-anchor': 'middle', 'font-size': 230, 'font-family': SERIF, fill: '#f4f8ff',
  });
  big.style.filter = `drop-shadow(0 0 26px ${alpha(tone, 0.5)})`;

  const boxes = stages.map((label, i) => {
    const x = 500 - ((stages.length - 1) * 132) / 2 + i * 132;
    const g = group(root, { opacity: 0 });
    rect(g, x - 54, 448, 108, 96, { rx: 12, fill: 'rgba(10,17,29,0.8)', stroke: 'rgba(140,170,215,0.22)' });
    const pict = group(g, { transform: `translate(${x} ${490}) scale(0.52)` });
    PICTO[char]?.(pict, i === stages.length - 1 ? tone : 'rgba(198,216,240,0.8)');
    textEl(g, label, {
      x, y: 574, 'text-anchor': 'middle', 'font-size': 12, 'font-family': SANS,
      fill: 'rgba(178,198,226,0.7)', 'letter-spacing': 2,
    });
    if (i === stages.length - 1) {
      textEl(g, char, { x, y: 512, 'text-anchor': 'middle', 'font-size': 62, 'font-family': SERIF, fill: '#f4f8ff', opacity: 0 });
    }
    return g;
  });

  const parts = (spec.parts || []).map((part, i) => {
    const g = group(root, { opacity: 0 });
    const x = 138;
    const y = 168 + i * 84;
    textEl(g, part[0], { x, y, 'text-anchor': 'middle', 'font-size': 40, 'font-family': SERIF, fill: alpha(tone, 0.95) });
    textEl(g, part[1], { x: x + 34, y: y - 6, 'font-size': 14, 'font-family': SANS, fill: 'rgba(196,214,240,0.75)' });
    textEl(g, part[2], { x: x + 34, y: y + 14, 'font-size': 11.5, 'font-family': SANS, fill: 'rgba(170,190,218,0.55)' });
    return g;
  });

  const note = textEl(root, spec.note || '象形 → 指事 → 会意 → 形声', {
    x: 500, y: 108, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS,
    fill: alpha(tone, 0.75), 'letter-spacing': 5,
  });

  const vign = rect(fg, 0, 0, W, H, { fill: '#000', opacity: 0.2 });

  return {
    defaults: { reveal: 0, focus: 0 },
    render(s) {
      big.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.96));
      big.setAttribute('font-size', String(230 + Math.sin(clamp(s.focus) * 1.4) * 6));
      boxes.forEach((g, i) => {
        const p = clamp((s.reveal - 0.35 - i * 0.09) * 3.4);
        g.setAttribute('opacity', String(p));
        g.setAttribute('transform', `translate(0 ${(1 - p) * 14})`);
      });
      parts.forEach((g, i) => {
        g.setAttribute('opacity', String(clamp((s.reveal - 0.55 - i * 0.1) * 3.2)));
      });
      note.setAttribute('opacity', String(clamp(s.reveal * 3) * 0.9));
      vign.setAttribute('opacity', 1);
    },
  };
}

export const textEngines = {
  verse: buildVerse,
  mirror: buildMirror,
  mapping: buildMapping,
  sentence: buildSentence,
  glyph: buildGlyph,
};
