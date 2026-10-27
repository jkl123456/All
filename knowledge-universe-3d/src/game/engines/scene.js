/**
 * 场景引擎 —— 语文类知识点的分幕演出。
 * 三种舞台：room（室内夜读）、river（江上夜泊）、field（田间）、tower（登楼）。
 * 每个元素都由 0~1 的权重控制，于是「下一幕」只是把几个权重推上去。
 */
import {
  VIEW,
  alpha,
  circle,
  clamp,
  glowFilter,
  group,
  lerp,
  line,
  linearGradient,
  pathEl,
  poly,
  radialGradient,
  rect,
  seeded,
  svgEl,
  textEl,
  wobble,
} from '../stage.js';

const W = VIEW.w;
const H = VIEW.h;

function mountain(seed, baseY, height, color, opacity) {
  const rand = seeded(seed);
  const pts = [[-40, H]];
  let x = -40;
  while (x < W + 40) {
    const step = 80 + rand() * 110;
    const peak = baseY - height * (0.45 + rand() * 0.75);
    pts.push([x + step * 0.5, peak]);
    pts.push([x + step, baseY - height * (0.15 + rand() * 0.3)]);
    x += step;
  }
  pts.push([W + 40, baseY]);
  pts.push([W + 40, H]);
  return poly(null, pts, { fill: color, opacity });
}

function waterLine(y, amp, phase, width = W) {
  let d = `M-40 ${y}`;
  for (let x = -40; x <= width + 40; x += 26) {
    d += ` Q ${x + 13} ${y + Math.sin(x * 0.02 + phase) * amp} ${x + 26} ${y + Math.sin((x + 26) * 0.014 + phase * 1.3) * amp * 0.7}`;
  }
  return d;
}

function birdShape(parent, color, opacity) {
  const g = group(parent, { opacity });
  pathEl(g, 'M-11 0 Q-5 -7 0 0 Q5 -7 11 0', {
    fill: 'none',
    stroke: color,
    'stroke-width': 2.2,
    'stroke-linecap': 'round',
  });
  return g;
}

function hareShape(parent) {
  const g = group(parent, { opacity: 0 });
  const body = svgEl('ellipse', { cx: 0, cy: 0, rx: 17, ry: 11, fill: '#e9e4da' }, g);
  const head = circle(g, 15, -8, 6.4, { fill: '#f2ede4' });
  const earA = svgEl('ellipse', { cx: 13, cy: -22, rx: 2.6, ry: 11, fill: '#e5dfd4', transform: 'rotate(-16 13 -22)' }, g);
  const earB = svgEl('ellipse', { cx: 18, cy: -21, rx: 2.4, ry: 10, fill: '#d9d2c6', transform: 'rotate(-4 18 -21)' }, g);
  const tail = circle(g, -16, -2, 3.4, { fill: '#f6f1e8' });
  const legF = svgEl('ellipse', { cx: 9, cy: 9, rx: 7, ry: 2.6, fill: '#ded6c9' }, g);
  g.userData = { body, head, earA, earB, tail, legF };
  return g;
}

function stumpShape(parent) {
  const g = group(parent, { opacity: 0 });
  rect(g, -26, -34, 52, 34, { rx: 4, fill: '#3a2a1d' });
  svgEl('ellipse', { cx: 0, cy: -34, rx: 26, ry: 10, fill: '#6b4d32' }, g);
  svgEl('ellipse', { cx: 0, cy: -34, rx: 18, ry: 6.6, fill: 'none', stroke: '#8b6a45', 'stroke-width': 1.6, opacity: 0.8 }, g);
  svgEl('ellipse', { cx: 0, cy: -34, rx: 9, ry: 3.4, fill: 'none', stroke: '#8b6a45', 'stroke-width': 1.4, opacity: 0.7 }, g);
  pathEl(g, 'M12 0 q6 10 2 20', { stroke: '#2e2216', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  return g;
}

function farmerShape(parent, color = '#0d1119') {
  const g = group(parent, { opacity: 0 });
  circle(g, 0, -78, 10, { fill: color });
  pathEl(g, 'M-14 -66 q14 -8 28 0 l4 34 q-18 6 -36 0 z', { fill: color });
  pathEl(g, 'M-10 -32 l-3 32 M10 -32 l4 32', { stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round' });
  pathEl(g, 'M-12 -58 q-16 10 -14 34', { stroke: color, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' });
  pathEl(g, 'M12 -58 q14 12 12 30', { stroke: color, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' });
  // 锄头
  pathEl(g, 'M24 -46 l16 70', { stroke: '#4a3a28', 'stroke-width': 3.4, 'stroke-linecap': 'round' });
  pathEl(g, 'M36 22 l16 2 l-2 8 l-14 -2 z', { fill: '#6d6f74' });
  return g;
}

function boatShape(parent) {
  const g = group(parent, { opacity: 0 });
  const hull = group(g, {});
  pathEl(hull, 'M-96 0 q22 30 96 30 q74 0 96 -30 q-96 14 -192 0 z', { fill: '#2a1c13' });
  pathEl(hull, 'M-96 0 q96 12 192 0', { stroke: '#6d4a2c', 'stroke-width': 4, fill: 'none' });
  pathEl(hull, 'M-38 -2 q38 -46 76 0', { fill: '#1a1410', opacity: 0.85 });
  pathEl(hull, 'M-34 -2 q34 -40 68 0', { fill: 'none', stroke: '#4c3520', 'stroke-width': 2.4 });
  rect(hull, -8, -46, 3.2, 46, { fill: '#5a3f26' });
  // 船头记号
  const notch = group(hull, { opacity: 0 });
  line(notch, 52, -6, 52, 12, { stroke: '#ffd98a', 'stroke-width': 3, 'stroke-linecap': 'round' });
  line(notch, 46, 3, 58, 3, { stroke: '#ffd98a', 'stroke-width': 2, 'stroke-linecap': 'round' });
  return { g, hull, notch, lanternAnchor: [0, -52] };
}

function figurePose(parent, color = '#05070c') {
  const g = group(parent, { opacity: 0 });
  const body = pathEl(g, 'M-30 0 q6 -46 30 -46 q24 0 30 46 z', { fill: color });
  const neck = rect(g, -5, -56, 10, 12, { fill: color });
  const head = group(g, {});
  circle(head, 0, -68, 13, { fill: color });
  const bun = circle(head, 0, -80, 5, { fill: color });
  // 衣袖
  pathEl(body, 'M-26 -30 q-16 14 -12 32', { stroke: color, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' });
  pathEl(body, 'M26 -30 q16 14 12 32', { stroke: color, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' });
  return { g, head, body, neck, bun };
}

function towerShape(parent, tone) {
  const g = group(parent, { opacity: 0 });
  const tiers = 4;
  const tierH = 54;
  for (let i = 0; i < tiers; i += 1) {
    const y = -i * tierH;
    const halfW = 88 - i * 14;
    rect(g, -halfW * 0.62, y - tierH, halfW * 1.24, tierH, { fill: '#221619' });
    for (let k = -1; k <= 1; k += 1) {
      rect(g, k * 24 - 7, y - tierH + 12, 14, 22, { fill: alpha('#ffd9a0', 0.2 + i * 0.02) });
    }
    const rw = halfW + 22;
    pathEl(
      g,
      `M${-rw} ${y - tierH + 8} Q${-rw * 0.4} ${y - tierH - 16} 0 ${y - tierH - 22} Q${rw * 0.4} ${y - tierH - 16} ${rw} ${y - tierH + 8} Q0 ${y - tierH + 2} ${-rw} ${y - tierH + 8} Z`,
      { fill: '#3a2226', stroke: alpha(tone, 0.32), 'stroke-width': 1 }
    );
  }
  // 塔刹
  rect(g, -3, -tiers * tierH - 40, 6, 30, { fill: '#3a2a22' });
  circle(g, 0, -tiers * tierH - 44, 6, { fill: '#4d3628' });
  // 台基
  rect(g, -96, 0, 192, 16, { fill: '#191216' });
  rect(g, -84, -6, 168, 8, { fill: '#241a1c' });
  return g;
}

/* ------------------------------- room · 静夜思 ------------------------------- */
function buildRoom(ctx) {
  const { bg, root, fg, defs, tone } = ctx;
  linearGradient(defs, 'room-wall', [
    [0, '#070a14'],
    [0.6, '#0a0f1c'],
    [1, '#05070e'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  linearGradient(defs, 'room-sky', [
    [0, '#0a1730'],
    [1, '#1a2a4a'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  radialGradient(defs, 'room-moon', [
    [0, '#fffdf2'],
    [0.55, '#ffe9b8'],
    [1, 'rgba(255,233,184,0)'],
  ]);
  linearGradient(defs, 'room-beam', [
    [0, 'rgba(206,228,255,0.72)'],
    [0.55, 'rgba(196,220,255,0.26)'],
    [1, 'rgba(196,220,255,0)'],
  ], { x1: 0, y1: 0, x2: 0.35, y2: 1 });

  rect(bg, 0, 0, W, H, { fill: 'url(#room-wall)' });

  // 窗外夜景
  const win = group(root, {});
  rect(win, 604, 74, 336, 322, { fill: 'url(#room-sky)' });
  const starField = group(win, {});
  const rand = seeded(77);
  for (let i = 0; i < 26; i += 1) {
    circle(starField, 612 + rand() * 320, 84 + rand() * 200, 0.7 + rand() * 1.3, { fill: '#dce9ff', opacity: 0.2 + rand() * 0.5 });
  }
  const moonGlow = circle(win, 0, 0, 58, { fill: 'url(#room-moon)', opacity: 0.85 });
  const moonCore = circle(win, 0, 0, 17, { fill: '#fff8e2' });
  const crater1 = circle(win, 0, 0, 4.4, { fill: 'rgba(214,198,166,0.5)' });
  const crater2 = circle(win, 0, 0, 2.6, { fill: 'rgba(214,198,166,0.42)' });
  const frame = group(win, {});
  rect(frame, 604, 74, 336, 322, { fill: 'none', stroke: '#101725', 'stroke-width': 16 });
  rect(frame, 604, 74, 336, 322, { fill: 'none', stroke: '#2a3546', 'stroke-width': 2 });
  line(frame, 772, 74, 772, 396, { stroke: '#101725', 'stroke-width': 8 });
  line(frame, 604, 235, 940, 235, { stroke: '#101725', 'stroke-width': 8 });
  for (let i = 0; i < 3; i += 1) {
    line(frame, 604 + i * 112, 74, 604 + i * 112, 396, { stroke: 'rgba(30,42,60,0.5)', 'stroke-width': 1 });
  }
  const sill = rect(win, 588, 396, 368, 14, { fill: '#111a28' });

  // 地面
  const floor = rect(root, 0, 410, W, H - 410, { fill: '#080c14' });
  for (let i = 0; i < 9; i += 1) {
    line(root, 0, 418 + i * 24, W, 414 + i * 24, { stroke: 'rgba(120,150,200,0.05)', 'stroke-width': 1 });
  }

  // 月光光柱
  const beam = poly(root, [[706, 106], [858, 106], [640, 470], [352, 470]], {
    fill: 'url(#room-beam)',
    opacity: 0.1,
    style: 'mix-blend-mode: screen',
  });
  const patch = svgEl('ellipse', { cx: 496, cy: 468, rx: 176, ry: 40, fill: '#cfe4ff', opacity: 0.06 }, root);

  // 床榻
  const bed = group(root, {});
  rect(bed, 40, 402, 320, 26, { fill: '#171d29' });
  rect(bed, 56, 428, 288, 76, { fill: '#0d121b' });
  rect(bed, 56, 428, 288, 8, { fill: '#1f2836' });
  rect(bed, 60, 380, 74, 26, { rx: 4, fill: '#202939' });
  line(bed, 96, 470, 96, 504, { stroke: '#151b26', 'stroke-width': 6 });

  const person = figurePose(root, '#04060b');
  person.g.setAttribute('transform', 'translate(150 424)');
  person.g.setAttribute('opacity', 0.96);

  // 霜（地面反光颗粒）
  const frostGroup = group(root, { opacity: 0 });
  const frand = seeded(913);
  for (let i = 0; i < 40; i += 1) {
    circle(frostGroup, 330 + frand() * 470, 440 + frand() * 150, 0.6 + frand() * 1.4, {
      fill: '#dbe9ff',
      opacity: 0.2 + frand() * 0.5,
    });
  }
  const frostWash = svgEl('ellipse', { cx: 560, cy: 500, rx: 340, ry: 96, fill: '#e8f2ff', opacity: 0.05 }, frostGroup);

  // 前景暗角
  const vign = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#room-vign)' }, fg);
  radialGradient(defs, 'room-vign', [
    [0.45, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.55)'],
  ], { cx: 0.45, cy: 0.45, r: 0.75 });

  return {
    defaults: {
      moon: 0.6,
      beam: 0.55,
      frost: 0.15,
      pose: 0,
      stars: 0.8,
      glow: 0.5,
    },
    render(s) {
      const mx = 770;
      const my = lerp(330, 150, clamp(s.moon));
      moonCore.setAttribute('cx', mx);
      moonCore.setAttribute('cy', my);
      moonGlow.setAttribute('cx', mx);
      moonGlow.setAttribute('cy', my);
      moonGlow.setAttribute('opacity', 0.55 + s.glow * 0.4);
      moonCore.setAttribute('opacity', 0.85 + s.moon * 0.15);
      crater1.setAttribute('cx', mx - 5.5);
      crater1.setAttribute('cy', my + 4.5);
      crater2.setAttribute('cx', mx + 6.5);
      crater2.setAttribute('cy', my - 5);
      starField.setAttribute('opacity', s.stars);
      beam.setAttribute('opacity', 0.02 + s.beam * 0.4);
      patch.setAttribute('opacity', 0.02 + s.beam * 0.1 + s.frost * 0.04);
      frostGroup.setAttribute('opacity', s.frost * 0.9);
      frostWash.setAttribute('opacity', 0.02 + s.frost * 0.05);
      // 抬头 / 低头：头部上移 + 身体微微后仰
      person.head.setAttribute('transform', `translate(0 ${-lerp(0, 5, s.pose)})`);
      person.body.setAttribute('transform', `rotate(${lerp(0, -3, s.pose)} 0 0)`);
      person.neck.setAttribute('opacity', 1 - s.pose * 0.3);
      vign.setAttribute('opacity', 0.9);
    },
  };
}

/* --------------------------- river · 江上 / 刻舟求剑 --------------------------- */
function buildRiver(ctx) {
  const { bg, root, fg, defs } = ctx;
  linearGradient(defs, 'rv-sky-night', [
    [0, '#050a18'],
    [0.55, '#0c1a30'],
    [1, '#1b3350'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  linearGradient(defs, 'rv-sky-dusk', [
    [0, '#101a35'],
    [0.5, '#2b3358'],
    [1, '#5c4a5f'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  linearGradient(defs, 'rv-water', [
    [0, '#0a2033'],
    [0.4, '#061724'],
    [1, '#030a12'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  radialGradient(defs, 'rv-moon', [
    [0, 'rgba(255,250,232,1)'],
    [0.4, 'rgba(255,236,188,0.85)'],
    [1, 'rgba(255,236,188,0)'],
  ]);

  const night = rect(bg, 0, 0, W, H, { fill: 'url(#rv-sky-night)' });
  const dusk = rect(bg, 0, 0, W, H, { fill: 'url(#rv-sky-dusk)', opacity: 0 });

  const starField = group(bg, {});
  const rand = seeded(451);
  for (let i = 0; i < 70; i += 1) {
    const star = circle(starField, rand() * W, rand() * 380, 0.6 + rand() * 1.2, { fill: '#d7e7ff', opacity: 0.2 + rand() * 0.6 });
    star.dataset.phase = String(rand() * 6.28);
  }

  const moonGlow = circle(bg, 190, 120, 92, { fill: 'url(#rv-moon)', opacity: 0.7 });
  const moon = circle(bg, 190, 120, 26, { fill: '#fff6dd' });

  const farM = mountain(21, 402, 150, '#0a1524', 0.95);
  const nearM = mountain(66, 430, 96, '#060d18', 1);
  bg.append(farM, nearM);

  const water = rect(root, 0, 424, W, H - 424, { fill: 'url(#rv-water)' });
  const waves = [];
  for (let i = 0; i < 7; i += 1) {
    const w = pathEl(root, '', {
      fill: 'none',
      stroke: '#5f9bc4',
      'stroke-width': 1.1,
      opacity: 0.06 + i * 0.02,
    });
    waves.push({ node: w, y: 442 + i * 24, amp: 2 + i * 0.7, speed: 0.3 + i * 0.08 });
  }
  const reflection = svgEl('ellipse', { cx: 190, cy: 470, rx: 24, ry: 100, fill: '#ffeec2', opacity: 0.12 }, root);
  const reflection2 = svgEl('ellipse', { cx: 190, cy: 500, rx: 64, ry: 60, fill: '#ffeec2', opacity: 0.05 }, root);

  // 岸与树
  const bank = group(root, {});
  pathEl(bank, 'M-40 470 q120 -46 300 -30 q80 8 130 40 l0 200 l-430 0 z', { fill: '#080f14' });
  pathEl(bank, 'M-40 482 q140 -36 300 -22', { stroke: '#12202a', 'stroke-width': 3, fill: 'none', opacity: 0.8 });
  const tree = group(bank, { transform: 'translate(120 448)' });
  pathEl(tree, 'M0 0 q-10 -60 4 -110 q6 -32 -2 -58', { stroke: '#20150f', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' });
  pathEl(tree, 'M2 -78 q-38 -16 -56 -44', { stroke: '#20150f', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' });
  pathEl(tree, 'M4 -104 q34 -18 52 -48', { stroke: '#20150f', 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round' });
  const leaves = group(tree, {});
  const lrand = seeded(303);
  for (let i = 0; i < 16; i += 1) {
    const a = lrand() * Math.PI * 2;
    const rr = 22 + lrand() * 34;
    circle(leaves, Math.cos(a) * rr + 4, -120 + Math.sin(a) * rr * 0.6, 8 + lrand() * 9, {
      fill: i % 3 === 0 ? '#4a2a2a' : i % 3 === 1 ? '#3d2a22' : '#5a3330',
      opacity: 0.75,
    });
  }

  const boats = boatShape(root);
  boats.g.setAttribute('transform', 'translate(300 470)');
  const lampGlow = circle(boats.g, 30, -30, 26, { fill: '#ffbf66', opacity: 0.16 }, boats.g);
  const lamp = circle(boats.g, 30, -30, 3.4, { fill: '#ffd89a' });

  // 剑与记号
  const swordG = group(root, { opacity: 0 });
  const blade = group(swordG, {});
  rect(blade, -2.4, -46, 4.8, 62, { fill: '#cfd8e6', opacity: 0.9 });
  pathEl(blade, 'M-2.4 -46 l2.4 -10 l2.4 10 z', { fill: '#eef4ff' });
  line(blade, -12, 16, 12, 16, { stroke: '#c8a25a', 'stroke-width': 4 });
  rect(blade, -2, 16, 4, 12, { fill: '#5b4326' });
  const swordRipple = circle(swordG, 0, 0, 26, { fill: 'none', stroke: '#9fd7ff', 'stroke-width': 1.2, opacity: 0.35 });

  const driftLine = pathEl(root, '', {
    stroke: '#ffd98a',
    'stroke-width': 1.2,
    'stroke-dasharray': '6 7',
    fill: 'none',
    opacity: 0,
  });
  const driftLabel = textEl(root, '', {
    fill: '#ffd98a',
    'font-size': 15,
    'font-family': '"Cascadia Code", monospace',
    opacity: 0,
    'text-anchor': 'middle',
  });

  const birds = [];
  for (let i = 0; i < 3; i += 1) {
    const b = birdShape(root, '#0a1520', 0);
    b.dataset.phase = String(i * 1.7);
    birds.push(b);
  }

  const frostOverlay = rect(root, 0, 0, W, H, { fill: '#cfe3ff', opacity: 0 });
  const vign = rect(fg, 0, 0, W, H, { fill: 'url(#rv-vign)' });
  radialGradient(defs, 'rv-vign', [
    [0.4, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.6)'],
  ], { cx: 0.5, cy: 0.45, r: 0.78 });

  return {
    defaults: {
      night: 0.85,
      moon: 0.6,
      boat: 1,
      drift: 0,
      sword: 0,
      notch: 0,
      tree: 1,
      birds: 0.4,
      frost: 0,
      lamp: 0.7,
    },
    render(s, t) {
      night.setAttribute('opacity', 0.35 + s.night * 0.65);
      dusk.setAttribute('opacity', 1 - s.night);
      starField.setAttribute('opacity', s.night);
      for (const star of starField.children) {
        const phase = Number(star.dataset.phase || 0);
        star.setAttribute('opacity', String(0.25 + Math.abs(Math.sin(t * 1.4 + phase)) * 0.6 * s.night));
      }
      moon.setAttribute('opacity', 0.45 + s.moon * 0.55);
      moonGlow.setAttribute('opacity', s.moon * 0.8);
      farM.setAttribute('opacity', 0.55 + s.night * 0.4);
      nearM.setAttribute('opacity', 0.8);
      water.setAttribute('opacity', 1);
      waves.forEach((w, i) => {
        w.node.setAttribute('d', waterLine(w.y, w.amp, t * w.speed + i));
      });
      reflection.setAttribute('opacity', s.moon * 0.16);
      reflection2.setAttribute('opacity', s.moon * 0.07);
      reflection.setAttribute('cx', 190);
      reflection2.setAttribute('cx', 190);
      bank.setAttribute('opacity', 0.85);
      tree.setAttribute('opacity', 0.2 + s.tree * 0.8);
      leaves.setAttribute('opacity', 0.5 + s.tree * 0.5);

      const bx = lerp(260, 720, clamp(s.drift));
      const bob = Math.sin(t * 1.1) * 3.2;
      boats.g.setAttribute('transform', `translate(${bx} ${468 + bob}) rotate(${Math.sin(t * 0.8) * 1.4})`);
      boats.g.setAttribute('opacity', s.boat);
      boats.notch.setAttribute('opacity', s.notch);
      lamp.setAttribute('opacity', s.lamp);
      lampGlow.setAttribute('opacity', s.lamp * (0.12 + Math.abs(Math.sin(t * 2.2)) * 0.06));

      // 剑落水点固定在 x=470
      const sy = lerp(452, 556, clamp(s.sword));
      swordG.setAttribute('opacity', s.sword);
      blade.setAttribute('transform', `translate(470 ${sy}) rotate(${lerp(-18, 8, s.sword)})`);
      swordRipple.setAttribute('cx', 470);
      swordRipple.setAttribute('cy', 470);
      swordRipple.setAttribute('r', 22 + Math.abs(wobble(t * 0.8, 2, 10)));
      swordRipple.setAttribute('opacity', 0.3 * (1 - s.sword));

      const notchX = bx + 52;
      const notchY = 462 + bob;
      const showLine = s.notch > 0.2 && s.sword > 0.2;
      driftLine.setAttribute('opacity', showLine ? 0.7 : 0);
      driftLine.setAttribute('d', `M${notchX} ${notchY} q ${(470 - notchX) * 0.4} ${-40} 470 ${lerp(452, 556, clamp(s.sword))}`);
      driftLabel.setAttribute('opacity', showLine ? 0.9 : 0);
      driftLabel.setAttribute('x', (notchX + 470) / 2);
      driftLabel.setAttribute('y', Math.min(notchY, sy) - 22);
      driftLabel.textContent = `水平距离 ${Math.round(Math.abs(470 - notchX) / 10)} 丈`;

      birds.forEach((b, i) => {
        b.setAttribute('opacity', s.birds * 0.8);
        const dir = 1;
        b.setAttribute('transform', `translate(${620 + i * 62 + Math.sin(t * 0.5 + i) * 30} ${118 + i * 26 + Math.sin(t * 0.9 + i) * 12}) scale(${0.7 + i * 0.12}) scale(${dir} 1)`);
        b.setAttribute('opacity', s.birds * (0.35 + i * 0.2));
      });

      frostOverlay.setAttribute('opacity', s.frost * 0.07);
      vign.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------- field · 守株待兔 ---------------------------- */
function buildField(ctx) {
  const { bg, root, fg, defs } = ctx;
  linearGradient(defs, 'fd-sky', [
    [0, '#101b2f'],
    [0.42, '#2b3c52'],
    [0.78, '#6d6a5c'],
    [1, '#a58a63'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  linearGradient(defs, 'fd-ground', [
    [0, '#2a3320'],
    [0.35, '#1a2417'],
    [1, '#080d07'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  radialGradient(defs, 'fd-sun', [
    [0, 'rgba(255,243,214,0.98)'],
    [0.28, 'rgba(255,223,160,0.66)'],
    [0.62, 'rgba(255,193,120,0.2)'],
    [1, 'rgba(255,193,120,0)'],
  ]);

  rect(bg, 0, 0, W, H, { fill: 'url(#fd-sky)' });
  const sunGlow = circle(bg, 742, 164, 180, { fill: 'url(#fd-sun)', opacity: 0.85 });
  const sun = circle(bg, 742, 168, 32, { fill: '#ffe3a4', opacity: 0.96 });
  const hillFar = mountain(12, 400, 74, '#1b2622', 0.75);
  const hillNear = mountain(29, 414, 40, '#121a16', 0.9);
  bg.append(hillFar, hillNear);

  rect(root, 0, 388, W, H - 388, { fill: 'url(#fd-ground)' });

  // 田垄：近疏远密，做出纵深
  const rows = group(root, {});
  for (let i = 0; i < 12; i += 1) {
    const k = i / 11;
    const y = 392 + 210 * k ** 1.55;
    pathEl(rows, `M-30 ${y} q250 ${-4 - i * 0.8} 520 ${1 + i * 0.8} q260 ${5} 520 ${-2}`, {
      stroke: i % 2 ? '#39482a' : '#24301b',
      'stroke-width': 2 + k * 5,
      fill: 'none',
      opacity: 0.5 + k * 0.35,
    });
  }
  // 禾苗：越近越高
  const crops = group(root, { opacity: 0.85 });
  const crand = seeded(808);
  for (let i = 0; i < 150; i += 1) {
    const x = crand() * W;
    const depth = crand();
    const y = 396 + depth ** 1.4 * 214;
    const h = 6 + depth * 34;
    pathEl(crops, `M${x} ${y} q${-4 + crand() * 8} ${-h * 0.6} ${-2 + crand() * 5} ${-h}`, {
      stroke: depth > 0.5 ? '#4e6b34' : '#3a5228',
      'stroke-width': 1 + depth * 1.2,
      fill: 'none',
      opacity: 0.35 + depth * 0.55,
    });
    pathEl(crops, `M${x + 1} ${y} q${4 - crand() * 8} ${-h * 0.5} ${3 - crand() * 6} ${-h * 0.85}`, {
      stroke: '#3f5a2c',
      'stroke-width': 1 + depth * 0.8,
      fill: 'none',
      opacity: 0.3 + depth * 0.45,
    });
  }

  const stump = stumpShape(root);
  stump.setAttribute('transform', 'translate(408 520) scale(1.16)');

  const hare = hareShape(root);
  const farmer = farmerShape(root);
  farmer.setAttribute('transform', 'translate(776 528) scale(1.02)');

  const dust = group(root, { opacity: 0 });
  const drand = seeded(55);
  const dustDots = [];
  for (let i = 0; i < 14; i += 1) {
    const d = circle(dust, 0, 0, 1.2 + drand() * 2.2, { fill: '#b9a98c', opacity: 0.5 });
    d.dataset.speed = String(0.4 + drand() * 0.9);
    dustDots.push(d);
  }

  const vign = rect(fg, 0, 0, W, H, { fill: 'url(#fd-vign)' });
  radialGradient(defs, 'fd-vign', [
    [0.4, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.55)'],
  ], { cx: 0.5, cy: 0.45, r: 0.8 });

  return {
    defaults: {
      hare: 0,
      farmer: 1,
      stump: 1,
      sun: 0.6,
      dust: 0,
    },
    render(s, t) {
      sunGlow.setAttribute('opacity', 0.35 + s.sun * 0.5);
      sun.setAttribute('opacity', 0.4 + s.sun * 0.6);
      stump.setAttribute('opacity', s.stump);
      farmer.setAttribute('opacity', s.farmer);
      crops.setAttribute('opacity', 0.5 + s.farmer * 0.3);

      // 兔子沿抛物线撞向树桩，之后消失
      const k = clamp(s.hare);
      const startX = 110;
      const endX = 384;
      const hx = lerp(startX, endX, k);
      const hy = 520 - Math.sin(k * Math.PI) * 66 - k * 4;
      hare.setAttribute('opacity', k > 0.02 && k < 0.99 ? 1 : k >= 0.99 ? 0 : 0);
      hare.setAttribute('transform', `translate(${hx} ${hy}) scale(${lerp(1.05, 0.85, k)})`);
      const body = hare.userData?.body;
      if (body) body.setAttribute('cy', Math.abs(Math.sin(t * 14)) * 2);

      dust.setAttribute('opacity', s.dust * 0.7);
      dustDots.forEach((d, i) => {
        const speed = Number(d.dataset.speed || 1);
        const x = 120 + ((t * 40 * speed + i * 37) % 340);
        const y = 508 - Math.sin((t * 0.8 + i) % 3) * 10 - i * 0.6;
        d.setAttribute('cx', x);
        d.setAttribute('cy', y);
        d.setAttribute('opacity', (0.2 + Math.abs(Math.sin(t * 2 + i)) * 0.6) * s.dust);
      });
      vign.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------- tower · 登鹳雀楼 --------------------------- */
function buildTower(ctx) {
  const { bg, root, fg, defs, tone } = ctx;
  linearGradient(defs, 'tw-sky', [
    [0, '#0e1830'],
    [0.36, '#33314b'],
    [0.64, '#7b5450'],
    [0.85, '#c07f52'],
    [1, '#e2a76b'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  linearGradient(defs, 'tw-water', [
    [0, '#b98a53'],
    [0.16, '#a3794f'],
    [0.5, '#4a3a36'],
    [1, '#171317'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });
  radialGradient(defs, 'tw-sun', [
    [0, 'rgba(255,253,240,1)'],
    [0.3, 'rgba(255,240,190,0.78)'],
    [0.62, 'rgba(255,205,140,0.22)'],
    [1, 'rgba(255,190,120,0)'],
  ]);
  radialGradient(defs, 'tw-haze', [
    [0, 'rgba(255,214,160,0)'],
    [0.5, 'rgba(255,214,160,0.26)'],
    [1, 'rgba(255,214,160,0)'],
  ], { cx: 0.5, cy: 0.5, r: 0.55 });
  radialGradient(defs, 'tw-vign', [
    [0.42, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.58)'],
  ], { cx: 0.5, cy: 0.45, r: 0.8 });

  rect(bg, 0, 0, W, H, { fill: 'url(#tw-sky)' });

  const farM = mountain(9, 430, 172, '#3c3348', 0.72);
  const midM = mountain(41, 442, 120, '#241f33', 0.92);
  bg.append(farM, midM);

  const sunGlow = circle(bg, 588, 300, 196, { fill: 'url(#tw-sun)', opacity: 0.85 });
  const sun = circle(bg, 588, 300, 32, { fill: '#fffbe8', opacity: 0.95 });

  const world = group(root, {});
  const water = rect(world, 0, 430, W, H - 430, { fill: 'url(#tw-water)' });
  const waves = [];
  for (let i = 0; i < 8; i += 1) {
    waves.push(pathEl(world, '', {
      fill: 'none',
      stroke: '#ffd9a0',
      'stroke-width': 1.4,
      opacity: 0.26 - i * 0.022,
    }));
  }
  const reflection = svgEl('ellipse', { cx: 588, cy: 512, rx: 17, ry: 82, fill: '#ffe6b8', opacity: 0.2 }, world);
  const reflection2 = svgEl('ellipse', { cx: 588, cy: 540, rx: 58, ry: 66, fill: '#ffe6b8', opacity: 0.05 }, world);

  const haze = rect(bg, 0, 386, W, 56, { fill: 'url(#tw-haze)', opacity: 0.9 });

  const towerGlow = circle(root, 806, 452, 150, { fill: tone, opacity: 0.03 });
  const tower = towerShape(root, tone);
  tower.setAttribute('transform', 'translate(806 566)');

  rect(root, 0, 612, W, 12, { fill: '#0b0810' });

  const birds = [];
  for (let i = 0; i < 4; i += 1) {
    const b = birdShape(world, '#2a2028', 0);
    birds.push(b);
  }

  const vign = rect(fg, 0, 0, W, H, { fill: 'url(#tw-vign)' });

  return {
    defaults: { sun: 0.75, lift: 0, river: 0.9, birds: 0.3, haze: 0.5 },
    render(s, t) {
      const lift = clamp(s.lift);
      sunGlow.setAttribute('opacity', 0.4 + s.sun * 0.55);
      sun.setAttribute('cy', lerp(318, 268, clamp(s.sun)));
      sunGlow.setAttribute('cy', lerp(318, 268, clamp(s.sun)));
      world.setAttribute('transform', `translate(0 ${lift * 62})`);
      farM.setAttribute('transform', `translate(0 ${lift * 26})`);
      midM.setAttribute('transform', `translate(0 ${lift * 46})`);
      haze.setAttribute('opacity', s.haze);
      waves.forEach((w, i) => {
        const y = 442 + i * 22;
        w.setAttribute('d', waterLine(y, 2 + i * 0.6, t * (0.35 + i * 0.06) + i));
        w.setAttribute('opacity', (0.2 - i * 0.018) * (0.3 + s.river));
      });
      reflection.setAttribute('opacity', 0.1 + s.river * 0.16);
      reflection2.setAttribute('opacity', 0.05 + s.river * 0.06);
      tower.setAttribute('opacity', 0.96);
      tower.setAttribute('transform', `translate(806 ${566 + lift * 8}) scale(${1 + lift * 0.05})`);
      towerGlow.setAttribute('opacity', 0.05 + lift * 0.04);
      birds.forEach((b, i) => {
        const speed = 14 + i * 7;
        const x = ((t * speed + i * 230) % (W + 260)) - 130;
        b.setAttribute('transform', `translate(${x} ${132 + i * 36 + Math.sin(t * 0.8 + i) * 10}) scale(${0.6 + i * 0.1})`);
        b.setAttribute('opacity', s.birds * (0.35 + i * 0.16));
      });
      vign.setAttribute('opacity', 1);
    },
  };
}

const BUILDERS = {
  room: buildRoom,
  river: buildRiver,
  field: buildField,
  tower: buildTower,
};

export function scene(ctx) {
  const key = ctx.spec?.scene || 'river';
  return (BUILDERS[key] || buildRiver)(ctx);
}
