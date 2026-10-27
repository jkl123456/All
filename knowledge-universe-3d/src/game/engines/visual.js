/**
 * 科学 / 行业引擎组：函数曲线、几何、比例、运动、环绕、流体、阵列、版式、热、结构。
 * 每个引擎都有一个「主变量」，滑杆一动，画面立刻给出不同的答案。
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
const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, monospace';
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function backdrop(ctx, top = '#070c16', bottom = '#04070d') {
  const { bg, defs } = ctx;
  linearGradient(defs, 'vz-bg', [[0, top], [1, bottom]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  rect(bg, 0, 0, W, H, { fill: 'url(#vz-bg)' });
}

function readout(parent, x, y, label, tone, width = 168) {
  const g = group(parent, {});
  rect(g, x, y, width, 52, { rx: 10, fill: 'rgba(6,11,20,0.78)', stroke: alpha(tone, 0.28) });
  textEl(g, label, {
    x: x + 12, y: y + 20, 'font-size': 10.5, 'font-family': SANS, fill: 'rgba(166,188,218,0.72)', 'letter-spacing': 1.6,
  });
  const value = textEl(g, '—', {
    x: x + 12, y: y + 42, 'font-size': 17, 'font-family': MONO, fill: '#eaf4ff',
  });
  return { g, value };
}

/* ---------------------------------- curve ---------------------------------- */
function buildCurve(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'parabola';
  const box = { x0: 130, y0: 100, x1: 880, y1: 520 };
  const grid = group(root, {});
  for (let i = 0; i <= 10; i += 1) {
    const x = lerp(box.x0, box.x1, i / 10);
    line(grid, x, box.y0, x, box.y1, { stroke: 'rgba(120,160,210,0.09)', 'stroke-width': 1 });
  }
  for (let i = 0; i <= 8; i += 1) {
    const y = lerp(box.y0, box.y1, i / 8);
    line(grid, box.x0, y, box.x1, y, { stroke: 'rgba(120,160,210,0.09)', 'stroke-width': 1 });
  }
  const ox = lerp(box.x0, box.x1, 0.18);
  const oy = lerp(box.y1, box.y0, 0.16);
  line(root, box.x0, oy, box.x1, oy, { stroke: 'rgba(160,190,230,0.35)', 'stroke-width': 1.2 });
  line(root, ox, box.y0, ox, box.y1, { stroke: 'rgba(160,190,230,0.35)', 'stroke-width': 1.2 });
  textEl(root, spec.xLabel || 'x', { x: box.x1 - 4, y: oy + 22, 'text-anchor': 'end', 'font-size': 12, 'font-family': MONO, fill: 'rgba(160,190,230,0.6)' });
  textEl(root, spec.yLabel || 'y', { x: ox - 10, y: box.y0 + 12, 'text-anchor': 'end', 'font-size': 12, 'font-family': MONO, fill: 'rgba(160,190,230,0.6)' });

  const curve = pathEl(root, '', {
    fill: 'none', stroke: tone, 'stroke-width': 2.6, 'stroke-linecap': 'round',
    style: `filter: drop-shadow(0 0 10px ${alpha(tone, 0.55)})`,
  });
  const area = pathEl(root, '', { fill: alpha(tone, 0.1), stroke: 'none' });
  const secant = pathEl(root, '', { stroke: '#FFB86B', 'stroke-width': 1.8, 'stroke-dasharray': '7 6', fill: 'none' });
  const tangent = pathEl(root, '', { stroke: '#6BE7FF', 'stroke-width': 1.8, fill: 'none', opacity: 0.9 });
  const dot = circle(root, 0, 0, 6.5, { fill: '#fffef4', stroke: tone, 'stroke-width': 2 });
  const dotHalo = circle(root, 0, 0, 16, { fill: tone, opacity: 0.18 });
  const guideX = line(root, 0, 0, 0, 0, { stroke: 'rgba(200,220,245,0.3)', 'stroke-width': 1, 'stroke-dasharray': '3 5' });
  const guideY = line(root, 0, 0, 0, 0, { stroke: 'rgba(200,220,245,0.3)', 'stroke-width': 1, 'stroke-dasharray': '3 5' });

  const r1 = readout(root, 700, 74, mode === 'tangent' ? '割线斜率' : '当前取值', tone);
  const r2 = readout(root, 512, 74, mode === 'tangent' ? '切点横坐标' : '变量', tone, 168);

  const state = { a: mode === 'tangent' ? 0.5 : 1, b: 3, t: 0.5, h: 0.8 };

  function f(x) {
    if (mode === 'tangent') return 0.32 * x * x - 0.4 * x + 1.2;
    if (mode === 'growth') return Math.exp(clamp(x, -6, 3) * 0.5);
    return -state.a * (x - state.b) ** 2 * 0.28 + 6.4;
  }
  function df(x) {
    if (mode === 'tangent') return 0.64 * x - 0.4;
    return -state.a * (x - state.b) * 0.56;
  }

  const X = (x) => lerp(box.x0, box.x1, (x + 4) / 12);
  const Y = (y) => lerp(box.y1, box.y0, clamp(y / 8, -0.4, 1.3));

  return {
    defaults: state,
    render(s) {
      state.a = s.a;
      state.b = s.b;
      state.t = s.t;
      state.h = s.h;
      const pts = [];
      for (let i = 0; i <= 140; i += 1) {
        const x = -4 + (i / 140) * 12;
        pts.push([X(x), Y(f(x))]);
      }
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      curve.setAttribute('d', d);
      area.setAttribute('d', `${d} L${pts[pts.length - 1][0]} ${box.y1} L${pts[0][0]} ${box.y1} Z`);

      const cx = lerp(-4, 8, clamp(s.t));
      const px = X(cx);
      const py = Y(mode === 'tangent' ? f(cx) : mode === 'growth' ? f(cx) : -state.a * (cx - state.b) ** 2 * 0.28 + 6.4);
      dot.setAttribute('cx', px);
      dot.setAttribute('cy', py);
      dotHalo.setAttribute('cx', px);
      dotHalo.setAttribute('cy', py);
      guideX.setAttribute('x1', px); guideX.setAttribute('x2', px); guideX.setAttribute('y1', py); guideX.setAttribute('y2', oy);
      guideY.setAttribute('x1', px); guideY.setAttribute('x2', ox); guideY.setAttribute('y1', py); guideY.setAttribute('y2', py);

      if (mode === 'tangent') {
        const k = df(cx);
        const span = 2.6;
        tangent.setAttribute('d', `M${X(cx - span)} ${Y(f(cx) - k * span)} L${X(cx + span)} ${Y(f(cx) + k * span)}`);
        tangent.setAttribute('opacity', clamp(1 - s.h * 0.8));
        const h = Math.max(0.02, s.h);
        const k2 = (f(cx + h) - f(cx)) / h;
        secant.setAttribute('d', `M${X(cx - span)} ${Y(f(cx) - k2 * span)} L${X(cx + h + span)} ${Y(f(cx) + k2 * (h + span))}`);
        secant.setAttribute('opacity', 1);
        r1.value.textContent = `k = ${k2.toFixed(3)}`;
        r2.value.textContent = `Δx = ${h.toFixed(2)}`;
      } else {
        tangent.setAttribute('opacity', 0);
        secant.setAttribute('opacity', 0);
        const yv = mode === 'growth' ? f(cx) : -state.a * (cx - state.b) ** 2 * 0.28 + 6.4;
        r1.value.textContent = `y = ${yv.toFixed(2)}`;
        r2.value.textContent = `x = ${cx.toFixed(2)}`;
      }
      fg.setAttribute('opacity', 1);
    },
  };
}

/* -------------------------------- geometry -------------------------------- */
function buildGeometry(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const unit = 46;
  const originX = 300;
  const originY = 470;

  const tri = pathEl(root, '', {
    fill: alpha(tone, 0.1),
    stroke: tone,
    'stroke-width': 2.4,
    'stroke-linejoin': 'round',
    style: `filter: drop-shadow(0 0 12px ${alpha(tone, 0.4)})`,
  });
  const sqA = rect(root, 0, 0, 1, 1, { fill: alpha('#FFB86B', 0.16), stroke: '#FFB86B', 'stroke-width': 1.4 });
  const sqB = rect(root, 0, 0, 1, 1, { fill: alpha('#6BE7FF', 0.16), stroke: '#6BE7FF', 'stroke-width': 1.4 });
  const sqC = poly(root, [[0, 0], [0, 0], [0, 0], [0, 0]], { fill: alpha('#B08BFF', 0.2), stroke: '#B08BFF', 'stroke-width': 1.6 });
  const labA = textEl(root, 'a', { 'font-size': 16, 'font-family': MONO, fill: '#FFB86B' });
  const labB = textEl(root, 'b', { 'font-size': 16, 'font-family': MONO, fill: '#6BE7FF' });
  const labC = textEl(root, 'c', { 'font-size': 16, 'font-family': MONO, fill: '#B08BFF' });
  const formula = textEl(root, '', {
    x: 640, y: 170, 'text-anchor': 'middle', 'font-size': 30, 'font-family': MONO, fill: '#eef5ff', 'letter-spacing': 2,
  });
  const formula2 = textEl(root, '', {
    x: 640, y: 214, 'text-anchor': 'middle', 'font-size': 17, 'font-family': MONO, fill: alpha(tone, 0.85),
  });
  const hint = textEl(root, spec.note || '直角边平方和 = 斜边平方', {
    x: 640, y: 250, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS, fill: 'rgba(180,200,230,0.6)', 'letter-spacing': 2,
  });
  const squareLabelA = textEl(root, '', { 'text-anchor': 'middle', 'font-size': 14, 'font-family': MONO, fill: '#FFB86B' });
  const squareLabelB = textEl(root, '', { 'text-anchor': 'middle', 'font-size': 14, 'font-family': MONO, fill: '#6BE7FF' });
  const squareLabelC = textEl(root, '', { 'text-anchor': 'middle', 'font-size': 14, 'font-family': MONO, fill: '#B08BFF' });

  return {
    defaults: { a: 4.2, b: 3, squares: 0.4, spin: 0 },
    render(s) {
      const a = clamp(s.a, 1.2, 7) * unit;
      const b = clamp(s.b, 1.2, 6) * unit;
      const A = [originX, originY];
      const B = [originX + b, originY];
      const C = [originX, originY - a];
      tri.setAttribute('d', `M${A[0]} ${A[1]} L${B[0]} ${B[1]} L${C[0]} ${C[1]} Z`);

      const sq = clamp(s.squares);
      // a 边（竖直直角边）的正方形，向外侧展开
      sqA.setAttribute('x', originX - a);
      sqA.setAttribute('y', originY - a);
      sqA.setAttribute('width', a);
      sqA.setAttribute('height', a);
      sqA.setAttribute('opacity', sq);

      sqB.setAttribute('x', originX);
      sqB.setAttribute('y', originY);
      sqB.setAttribute('width', b);
      sqB.setAttribute('height', b);
      sqB.setAttribute('opacity', sq);

      // 斜边正方形：沿 BC 旋转
      const dx = B[0] - C[0];
      const dy = B[1] - C[1];
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const p1 = [B[0], B[1]];
      const p2 = [B[0] + nx * len, B[1] + ny * len];
      const p3 = [C[0] + nx * len, C[1] + ny * len];
      const p4 = [C[0], C[1]];
      sqC.setAttribute('points', [p1, p2, p3, p4].map((p) => p.join(',')).join(' '));
      sqC.setAttribute('opacity', sq);

      labA.setAttribute('x', originX - a / 2 - 18);
      labA.setAttribute('y', originY - a / 2 + 6);
      labB.setAttribute('x', originX + b / 2);
      labB.setAttribute('y', originY + 22);
      labC.setAttribute('x', (B[0] + C[0]) / 2 + 14);
      labC.setAttribute('y', (B[1] + C[1]) / 2 - 6);

      squareLabelA.setAttribute('x', originX - a / 2);
      squareLabelA.setAttribute('y', originY - a / 2 + 5);
      squareLabelA.setAttribute('opacity', sq * 0.9);
      squareLabelA.textContent = `a² = ${(a / unit).toFixed(1)}²`;
      squareLabelB.setAttribute('x', originX + b / 2);
      squareLabelB.setAttribute('y', originY + b / 2 + 5);
      squareLabelB.setAttribute('opacity', sq * 0.9);
      squareLabelB.textContent = `b² = ${(b / unit).toFixed(1)}²`;
      squareLabelC.setAttribute('x', (p2[0] + p3[0]) / 2);
      squareLabelC.setAttribute('y', (p2[1] + p3[1]) / 2 + 5);
      squareLabelC.setAttribute('opacity', sq * 0.9);
      squareLabelC.textContent = `c² = ${(len / unit).toFixed(1)}²`;

      formula.textContent = `${(a / unit).toFixed(1)}² + ${(b / unit).toFixed(1)}² = ${(len / unit).toFixed(1)}²`;
      formula2.textContent = `${((a / unit) ** 2).toFixed(1)} + ${((b / unit) ** 2).toFixed(1)} = ${((len / unit) ** 2).toFixed(1)}`;
      hint.setAttribute('opacity', 0.9);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- ratio ---------------------------------- */
function buildRatio(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'rectangle';
  const PHI = 1.6180339887;

  if (mode === 'phyllotaxis') {
    const dots = [];
    const spiral = pathEl(root, '', { fill: 'none', stroke: alpha(tone, 0.4), 'stroke-width': 1 });
    for (let i = 0; i < 240; i += 1) {
      const d = circle(root, 0, 0, 3.6, { fill: alpha(tone, 0.85), opacity: 0 });
      dots.push(d);
    }
    const label = textEl(root, '', {
      x: 500, y: 566, 'text-anchor': 'middle', 'font-size': 15, 'font-family': MONO, fill: 'rgba(210,226,248,0.7)',
    });
    return {
      defaults: { count: 90, angle: 137.5 },
      render(s) {
        const n = Math.round(clamp(s.count, 10, 240));
        const golden = 137.50776405;
        const angle = lerp(golden, clamp(s.angle, 90, 180), 0);
        dots.forEach((dot, i) => {
          const on = i < n;
          const r = Math.sqrt(i) * 15.2;
          const a = (i * (spec.fixedAngle ? angle : s.angle)) * (Math.PI / 180);
          dot.setAttribute('cx', 500 + Math.cos(a) * r);
          dot.setAttribute('cy', 306 + Math.sin(a) * r);
          dot.setAttribute('r', String(3.2 + (i / n) * 1.8));
          dot.setAttribute('opacity', on ? String(0.35 + (i / 240) * 0.6) : 0);
        });
        let d = '';
        for (let i = 0; i < n; i += 1) {
          const r = Math.sqrt(i) * 15.2;
          const a = (i * s.angle) * (Math.PI / 180);
          d += `${i ? 'L' : 'M'}${(500 + Math.cos(a) * r).toFixed(1)} ${(306 + Math.sin(a) * r).toFixed(1)} `;
        }
        spiral.setAttribute('d', d);
        label.textContent = `${n} 粒种子 · 相邻夹角 ${s.angle.toFixed(1)}°`;
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // 黄金矩形与螺旋
  const spiral = pathEl(root, '', {
    fill: 'none', stroke: tone, 'stroke-width': 2.2, opacity: 0.85,
    style: `filter: drop-shadow(0 0 10px ${alpha(tone, 0.45)})`,
  });
  const label = textEl(root, '', { x: 500, y: 574, 'text-anchor': 'middle', 'font-size': 15, 'font-family': MONO, fill: 'rgba(210,226,248,0.7)' });
  textEl(root, 'φ = (1 + √5) / 2 ≈ 1.618', {
    x: 500, y: 92, 'text-anchor': 'middle', 'font-size': 22, 'font-family': MONO, fill: '#eef6ff', 'letter-spacing': 1,
  });
  const squares = [];
  for (let i = 0; i < 9; i += 1) {
    squares.push(rect(root, 0, 0, 10, 10, {
      fill: alpha(tone, 0.05 + i * 0.014),
      stroke: alpha(tone, 0.36),
      'stroke-width': 1.2,
      opacity: 0,
    }));
  }

  return {
    defaults: { depth: 0.55, spiral: 0.7 },
    render(s) {
      const base = 476;
      let w = base;
      let h = base / PHI;
      let x = 500 - base / 2;
      let y = 322 - h / 2;
      const list = [];
      for (let i = 0; i < 9; i += 1) {
        const size = Math.min(w, h);
        if (size < 3) break;
        const dir = i % 4;
        let sx = x;
        let sy = y;
        if (dir === 0) {
          sx = x;
          sy = y;
          x += size;
          w -= size;
        } else if (dir === 1) {
          sx = x;
          sy = y;
          y += size;
          h -= size;
        } else if (dir === 2) {
          sx = x + w - size;
          sy = y;
          w -= size;
        } else {
          sx = x;
          sy = y + h - size;
          h -= size;
        }
        list.push({ x: sx, y: sy, s: size, dir });
      }
      const depth = clamp(s.depth) * list.length;
      list.forEach((sq, i) => {
        const r = squares[i];
        r.setAttribute('x', sq.x.toFixed(1));
        r.setAttribute('y', sq.y.toFixed(1));
        r.setAttribute('width', sq.s.toFixed(1));
        r.setAttribute('height', sq.s.toFixed(1));
        r.setAttribute('opacity', i < depth ? 1 : 0);
      });

      // 对数螺线：每一圈缩放 φ，视觉上与黄金矩形自然贴合
      const last = list[Math.min(list.length - 1, Math.round(depth) - 1)] || list[0];
      const eyeX = last.x + last.s / 2;
      const eyeY = last.y + last.s / 2;
      const b = Math.log(PHI) / (Math.PI / 2);
      const r0 = Math.max(2.4, last.s * 0.34);
      let d = '';
      const turns = 3.6 * Math.PI;
      for (let i = 0; i <= 220; i += 1) {
        const th = (i / 220) * turns;
        const r = r0 * Math.exp(b * th);
        const px = eyeX + Math.cos(th + Math.PI) * r;
        const py = eyeY + Math.sin(th + Math.PI) * r;
        d += `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)} `;
      }
      spiral.setAttribute('d', d);
      spiral.setAttribute('opacity', clamp(s.spiral) * 0.9);
      label.textContent = `不断切掉正方形，剩下的矩形依然是 ${PHI.toFixed(4)} : 1`;
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- motion --------------------------------- */
function buildMotion(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'pendulum';

  if (mode === 'pendulum') {
    const pivot = [500, 96];
    const ROD = 232;
    const pivotDot = circle(root, pivot[0], pivot[1], 6, { fill: '#dfeaff' });
    const rod = line(root, pivot[0], pivot[1], pivot[0], pivot[1] + ROD, { stroke: 'rgba(210,228,250,0.7)', 'stroke-width': 2 });
    const bob = circle(root, pivot[0], pivot[1] + ROD, 22, { fill: alpha(tone, 0.9) });
    const bobRing = circle(root, pivot[0], pivot[1] + ROD, 22, { fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 1.2 });
    const bobGlow = circle(root, pivot[0], pivot[1] + ROD, 40, { fill: tone, opacity: 0.2 });
    const arc = pathEl(root, '', { fill: 'none', stroke: alpha(tone, 0.25), 'stroke-width': 1, 'stroke-dasharray': '4 7' });
    const trail = [];
    for (let i = 0; i < 26; i += 1) {
      trail.push(circle(root, 0, 0, 2.4, { fill: tone, opacity: 0 }));
    }
    const rT = readout(root, 700, 76, '周期 T', tone);
    const rL = readout(root, 700, 142, '摆长 L', tone);
    const rG = readout(root, 700, 208, '重力 g', tone);
    const formula = textEl(root, 'T = 2π√(L / g)', {
      x: 700, y: 300, 'font-size': 19, 'font-family': MONO, fill: 'rgba(226,238,255,0.85)',
    });
    const note = textEl(root, '摆球质量不影响周期 —— 这就是等时性', {
      x: 700, y: 334, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.6)',
    });

    return {
      defaults: { length: 1.0, gravity: 9.8, amp: 24 },
      render(s, t) {
        const L = clamp(s.length, 0.2, 1.8);
        const g = clamp(s.gravity, 1.6, 25);
        const T = 2 * Math.PI * Math.sqrt(L / g);
        const theta = (s.amp * Math.PI) / 180 * Math.cos((t / T) * Math.PI * 2);
        const px = lerp(pivot[0], 800, 0) + Math.sin(theta) * ROD * L;
        const py = pivot[1] + Math.cos(theta) * ROD * L;
        rod.setAttribute('x2', px);
        rod.setAttribute('y2', py);
        bob.setAttribute('cx', px);
        bob.setAttribute('cy', py);
        bobGlow.setAttribute('cx', px);
        bobGlow.setAttribute('cy', py);
        bobRing.setAttribute('cx', px);
        bobRing.setAttribute('cy', py);
        arc.setAttribute('d', `M${pivot[0] - Math.sin((s.amp * Math.PI) / 180) * ROD * L} ${pivot[1] + Math.cos((s.amp * Math.PI) / 180) * ROD * L} A ${ROD * L} ${ROD * L} 0 0 1 ${pivot[0] + Math.sin((s.amp * Math.PI) / 180) * ROD * L} ${pivot[1] + Math.cos((s.amp * Math.PI) / 180) * ROD * L}`);
        trail.forEach((dot, i) => {
          const tt = t - i * 0.055;
          const th = (s.amp * Math.PI) / 180 * Math.cos((tt / T) * Math.PI * 2);
          dot.setAttribute('cx', pivot[0] + Math.sin(th) * ROD * L);
          dot.setAttribute('cy', pivot[1] + Math.cos(th) * ROD * L);
          dot.setAttribute('opacity', 0.32 * (1 - i / 26));
        });
        rT.value.textContent = `${T.toFixed(2)} s`;
        rL.value.textContent = `${L.toFixed(2)} m`;
        rG.value.textContent = `${g.toFixed(1)} m/s²`;
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'refraction') {
    const surfaceY = 330;
    const originX = 480;
    const water = rect(root, 0, surfaceY, W, H - surfaceY, { fill: '#08202c' });
    const waterGlow = rect(root, 0, surfaceY, W, 2, { fill: alpha('#6BE7FF', 0.5) });
    const normal = line(root, originX, 90, originX, 560, { stroke: 'rgba(200,220,245,0.28)', 'stroke-width': 1, 'stroke-dasharray': '5 7' });
    const incident = line(root, 0, 0, 0, 0, { stroke: '#FFD98A', 'stroke-width': 2.4 });
    const refracted = line(root, 0, 0, 0, 0, { stroke: '#6BE7FF', 'stroke-width': 2.4 });
    const reflected = line(root, 0, 0, 0, 0, { stroke: 'rgba(255,217,138,0.55)', 'stroke-width': 1.6, 'stroke-dasharray': '6 6' });
    const angleArc1 = pathEl(root, '', { fill: 'none', stroke: '#FFD98A', 'stroke-width': 1.2, opacity: 0.8 });
    const angleArc2 = pathEl(root, '', { fill: 'none', stroke: '#6BE7FF', 'stroke-width': 1.2, opacity: 0.8 });
    const label1 = textEl(root, '', { 'font-size': 12.5, 'font-family': MONO, fill: '#FFD98A' });
    const label2 = textEl(root, '', { 'font-size': 12.5, 'font-family': MONO, fill: '#6BE7FF' });
    const formula = textEl(root, 'n₁ sinθ₁ = n₂ sinθ₂', {
      x: 500, y: 82, 'text-anchor': 'middle', 'font-size': 22, 'font-family': MONO, fill: '#eef5ff',
    });
    const t1 = textEl(root, '空气 n₁ = 1.00', { x: 90, y: 118, 'font-size': 13, 'font-family': SANS, fill: 'rgba(200,216,240,0.7)' });
    const t2 = textEl(root, '', { x: 90, y: 480, 'font-size': 13, 'font-family': SANS, fill: alpha('#6BE7FF', 0.8) });
    const crit = textEl(root, '', { x: 880, y: 500, 'text-anchor': 'end', 'font-size': 12.5, 'font-family': SANS, fill: '#FF9E7A' });

    return {
      defaults: { n2: 1.33, angle: 42 },
      render(s) {
        const n2 = clamp(s.n2, 1.01, 2.4);
        const a1 = (clamp(s.angle, 1, 88) * Math.PI) / 180;
        const sin2 = (1 * Math.sin(a1)) / n2;
        const total = sin2 > 1;
        const a2 = Math.asin(clamp(sin2, -1, 1));
        const len = 210;
        const ix = originX - Math.sin(a1) * len;
        const iy = surfaceY - Math.cos(a1) * len;
        incident.setAttribute('x1', ix); incident.setAttribute('y1', iy);
        incident.setAttribute('x2', originX); incident.setAttribute('y2', surfaceY);
        reflected.setAttribute('x1', originX); reflected.setAttribute('y1', surfaceY);
        reflected.setAttribute('x2', originX + Math.sin(a1) * len * 0.8);
        reflected.setAttribute('y2', surfaceY - Math.cos(a1) * len * 0.8);
        reflected.setAttribute('opacity', total ? 1 : 0.25);
        refracted.setAttribute('x1', originX); refracted.setAttribute('y1', surfaceY);
        refracted.setAttribute('x2', originX + Math.sin(a2) * len);
        refracted.setAttribute('y2', surfaceY + Math.cos(a2) * len);
        refracted.setAttribute('opacity', total ? 0 : 1);
        angleArc1.setAttribute('d', `M${originX} ${surfaceY - 60} A60 60 0 0 0 ${originX - Math.sin(a1) * 60} ${surfaceY - Math.cos(a1) * 60}`);
        angleArc2.setAttribute('d', `M${originX} ${surfaceY + 66} A66 66 0 0 1 ${originX + Math.sin(a2) * 66} ${surfaceY + Math.cos(a2) * 66}`);
        label1.setAttribute('x', originX - 96);
        label1.setAttribute('y', surfaceY - 34);
        label1.textContent = `θ₁ ${s.angle.toFixed(0)}°`;
        label2.setAttribute('x', originX + 66);
        label2.setAttribute('y', surfaceY + 58);
        label2.textContent = `θ₂ ${((a2 * 180) / Math.PI).toFixed(0)}°`;
        t2.textContent = `介质 n₂ = ${n2.toFixed(2)}`;
        crit.textContent = total ? '超过临界角：全反射，光回不到空气里' : '';
        water.setAttribute('opacity', 0.9);
        waterGlow.setAttribute('opacity', 1);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // projectile
  const ground = line(root, 80, 520, 940, 520, { stroke: 'rgba(180,205,240,0.28)', 'stroke-width': 1.4 });
  const path = pathEl(root, '', { fill: 'none', stroke: alpha(tone, 0.9), 'stroke-width': 2.4, 'stroke-dasharray': '7 6' });
  const ball = circle(root, 0, 0, 11, { fill: '#fffdf4', stroke: tone, 'stroke-width': 2 });
  const ballGlow = circle(root, 0, 0, 26, { fill: tone, opacity: 0.22 });
  const apex = line(root, 0, 0, 0, 0, { stroke: 'rgba(255,217,138,0.4)', 'stroke-width': 1, 'stroke-dasharray': '3 5' });
  const apexLabel = textEl(root, '', { 'font-size': 12, 'font-family': MONO, fill: '#FFD98A' });
  const launch = line(root, 140, 520, 0, 0, { stroke: 'rgba(107,231,255,0.7)', 'stroke-width': 2 });
  const angleArc = pathEl(root, '', { fill: 'none', stroke: '#6BE7FF', 'stroke-width': 1.2, opacity: 0.8 });
  const hoop = group(root, { transform: 'translate(830 470)' });
  line(hoop, 0, 50, 0, -60, { stroke: 'rgba(200,220,245,0.5)', 'stroke-width': 4 });
  circle(hoop, 0, -60, 19, { fill: 'none', stroke: '#FF8E6B', 'stroke-width': 3 });
  const rRange = readout(root, 700, 80, '射程 R', tone);
  const rMax = readout(root, 700, 146, '最大高度 H', tone);
  const rT = readout(root, 700, 212, '飞行时间', tone);
  const optimal = textEl(root, '45° 给出最远射程', {
    x: 700, y: 300, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.6)',
  });

  return {
    defaults: { angle: 52, speed: 12 },
    render(s) {
      const v = clamp(s.speed, 4, 22);
      const a = (clamp(s.angle, 8, 82) * Math.PI) / 180;
      const g = 9.8;
      const scale = 22;
      const vx = v * Math.cos(a);
      const vy = v * Math.sin(a);
      const tf = (2 * vy) / g;
      const pts = [];
      for (let i = 0; i <= 80; i += 1) {
        const tt = (i / 80) * tf;
        const x = 140 + vx * tt * scale;
        const y = 520 - (vy * tt - 0.5 * g * tt * tt) * scale;
        pts.push([x, y]);
      }
      path.setAttribute('d', pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '));
      const idx = Math.round((Math.sin(performance.now() / 1400) * 0.5 + 0.5) * 80);
      const p = pts[Math.min(80, idx)];
      ball.setAttribute('cx', p[0]);
      ball.setAttribute('cy', p[1]);
      ballGlow.setAttribute('cx', p[0]);
      ballGlow.setAttribute('cy', p[1]);
      const hMax = (vy * vy) / (2 * g);
      apex.setAttribute('x1', 140 + (vx * vy) / g * scale);
      apex.setAttribute('x2', 140 + (vx * vy) / g * scale);
      apex.setAttribute('y1', 520 - hMax * scale);
      apex.setAttribute('y2', 520);
      apexLabel.setAttribute('x', 140 + (vx * vy) / g * scale + 6);
      apexLabel.setAttribute('y', 520 - hMax * scale - 8);
      apexLabel.textContent = `H = ${hMax.toFixed(1)} m`;
      launch.setAttribute('x2', 140 + Math.cos(a) * 88);
      launch.setAttribute('y2', 520 - Math.sin(a) * 88);
      angleArc.setAttribute('d', `M${140 + 52} 520 A52 52 0 0 0 ${140 + Math.cos(a) * 52} ${520 - Math.sin(a) * 52}`);
      rRange.value.textContent = `${(v * v * Math.sin(2 * a) / g).toFixed(1)} m`;
      rMax.value.textContent = `${hMax.toFixed(1)} m`;
      rT.value.textContent = `${tf.toFixed(2)} s`;
      optimal.setAttribute('opacity', Math.abs(s.angle - 45) < 3 ? 1 : 0.5);
      ground.setAttribute('opacity', 1);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- orbit ---------------------------------- */
function buildOrbit(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'molecule';

  if (mode === 'molecule') {
    const center = [430, 320];
    const o = circle(root, center[0], center[1], 46, { fill: alpha('#FF8E6B', 0.9) });
    const oLabel = textEl(root, 'O', { x: center[0], y: center[1] + 10, 'text-anchor': 'middle', 'font-size': 30, 'font-family': MONO, fill: '#2a1108' });
    const h1 = circle(root, 0, 0, 27, { fill: alpha('#EAF6FF', 0.92) });
    const h2 = circle(root, 0, 0, 27, { fill: alpha('#EAF6FF', 0.92) });
    const b1 = line(root, 0, 0, 0, 0, { stroke: 'rgba(230,245,255,0.7)', 'stroke-width': 5 });
    const b2 = line(root, 0, 0, 0, 0, { stroke: 'rgba(230,245,255,0.7)', 'stroke-width': 5 });
    const dipole1 = line(root, 0, 0, 0, 0, { stroke: '#6BE7FF', 'stroke-width': 2.4, 'stroke-dasharray': '6 5' });
    const dipole2 = line(root, 0, 0, 0, 0, { stroke: '#6BE7FF', 'stroke-width': 2.4, 'stroke-dasharray': '6 5' });
    const angleArc = pathEl(root, '', { fill: 'none', stroke: '#FFD98A', 'stroke-width': 1.4 });
    const angleLabel = textEl(root, '', { 'font-size': 15, 'font-family': MONO, fill: '#FFD98A' });
    const rAngle = readout(root, 690, 100, '键角 H–O–H', tone);
    const rPolar = textEl(root, '', { x: 690, y: 210, 'font-size': 13, 'font-family': SANS, fill: 'rgba(198,216,240,0.75)' });
    const rPolar2 = textEl(root, '', { x: 690, y: 232, 'font-size': 13, 'font-family': SANS, fill: 'rgba(198,216,240,0.55)' });
    const bondLabel = textEl(root, '共价键：共享电子对', { x: 690, y: 286, 'font-size': 12.5, 'font-family': SANS, fill: alpha(tone, 0.75) });

    return {
      defaults: { angle: 104.5, glow: 0.6 },
      render(s) {
        const half = ((clamp(s.angle, 60, 180) / 2) * Math.PI) / 180;
        const r = 132;
        const p1 = [center[0] - Math.sin(half) * r, center[1] + Math.cos(half) * r];
        const p2 = [center[0] + Math.sin(half) * r, center[1] + Math.cos(half) * r];
        b1.setAttribute('x1', center[0]); b1.setAttribute('y1', center[1]);
        b1.setAttribute('x2', p1[0]); b1.setAttribute('y2', p1[1]);
        b2.setAttribute('x1', center[0]); b2.setAttribute('y1', center[1]);
        b2.setAttribute('x2', p2[0]); b2.setAttribute('y2', p2[1]);
        h1.setAttribute('cx', p1[0]); h1.setAttribute('cy', p1[1]);
        h2.setAttribute('cx', p2[0]); h2.setAttribute('cy', p2[1]);
        dipole1.setAttribute('x1', p1[0]); dipole1.setAttribute('y1', p1[1]);
        dipole1.setAttribute('x2', center[0] - Math.sin(half) * 40); dipole1.setAttribute('y2', center[1] + Math.cos(half) * 40);
        dipole2.setAttribute('x1', p2[0]); dipole2.setAttribute('y1', p2[1]);
        dipole2.setAttribute('x2', center[0] + Math.sin(half) * 40); dipole2.setAttribute('y2', center[1] + Math.cos(half) * 40);
        angleArc.setAttribute('d', `M${center[0]} ${center[1] - 82} A82 82 0 0 ${half > Math.PI / 2 ? 1 : 0} ${center[0] + Math.sin(half) * 82} ${center[1] - Math.cos(half) * 82}`);
        angleLabel.setAttribute('x', center[0] + 96);
        angleLabel.setAttribute('y', center[1] - 52);
        angleLabel.textContent = `${s.angle.toFixed(1)}°`;
        rAngle.value.textContent = `${s.angle.toFixed(1)}°`;
        const bent = s.angle < 150;
        rPolar.textContent = bent ? 'V 形 → 极性分子' : '接近直线 → 非极性';
        rPolar2.textContent = bent ? '正负电荷中心不重合，能形成氢键' : '正负电荷中心重合';
        bondLabel.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'cell') {
    const cx = 400;
    const cy = 320;
    const membrane = circle(root, cx, cy, 210, { fill: alpha('#79E86B', 0.05), stroke: alpha('#79E86B', 0.6), 'stroke-width': 3 });
    const membrane2 = circle(root, cx, cy, 198, { fill: 'none', stroke: alpha('#79E86B', 0.25), 'stroke-width': 1.4 });
    const nucleus = circle(root, cx + 30, cy - 20, 74, { fill: alpha('#B08BFF', 0.22), stroke: '#B08BFF', 'stroke-width': 2 });
    const nucleolus = circle(root, cx + 48, cy - 36, 22, { fill: alpha('#B08BFF', 0.55) });
    const nucLabel = textEl(root, '细胞核', { x: cx + 30, y: cy + 56, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS, fill: '#cfb6ff' });
    const mitos = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const mx = cx + Math.cos(a) * 140;
      const my = cy + Math.sin(a) * 140;
      const g = group(root, { transform: `translate(${mx} ${my}) rotate(${a * 57})` });
      pathEl(g, 'M-20 0 q10 -14 20 0 q10 14 20 0', { fill: 'none', stroke: '#FFB86B', 'stroke-width': 7, 'stroke-linecap': 'round' });
      mitos.push(g);
    }
    const labels = [
      ['细胞膜', cx - 214, cy - 190, '选择透过性'],
      ['线粒体', cx - 30, cy + 230, '供能'],
      ['细胞质', cx + 150, cy + 170, '代谢场所'],
    ].map(([name, x, y, sub]) => {
      const g = group(root, {});
      line(g, x + 30, y - 6, x + 30, y - 6, { stroke: 'rgba(150,190,230,0.4)' });
      textEl(g, name, { x, y, 'font-size': 14, 'font-family': SANS, fill: '#dceeff' });
      textEl(g, sub, { x, y: y + 19, 'font-size': 11, 'font-family': SANS, fill: 'rgba(170,195,225,0.6)' });
      return g;
    });
    const rSize = readout(root, 760, 90, '细胞直径', tone);
    const note = textEl(root, '结构决定功能：需要能量的地方，线粒体更多', {
      x: 760, y: 190, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.65)',
    });

    return {
      defaults: { nucleus: 1, mito: 0.8, pulse: 0 },
      render(s, t) {
        nucleus.setAttribute('opacity', 0.4 + s.nucleus * 0.6);
        nucleolus.setAttribute('opacity', 0.4 + s.nucleus * 0.6);
        nucLabel.setAttribute('opacity', s.nucleus);
        mitos.forEach((g, i) => {
          g.setAttribute('opacity', s.mito);
          const a = (i / 6) * Math.PI * 2 + 0.4 + t * 0.06;
          const mx = cx + Math.cos(a) * 140;
          const my = cy + Math.sin(a) * 140;
          g.setAttribute('transform', `translate(${mx} ${my}) rotate(${a * 57})`);
        });
        const scale = 1 + Math.sin(t * 1.2) * 0.006;
        membrane.setAttribute('r', String(210 * scale));
        membrane2.setAttribute('r', String(198 * scale));
        rSize.value.textContent = '10 – 30 μm';
        labels.forEach((g) => g.setAttribute('opacity', 0.9));
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // helix
  const strands = [];
  for (let i = 0; i < 26; i += 1) {
    const a = circle(root, 0, 0, 5, { fill: alpha(tone, 0.9) });
    const b = circle(root, 0, 0, 5, { fill: alpha('#FFB86B', 0.9) });
    const rung = line(root, 0, 0, 0, 0, { stroke: 'rgba(200,220,245,0.25)', 'stroke-width': 2 });
    strands.push({ a, b, rung });
  }
  const label = textEl(root, 'A — T · G — C', {
    x: 500, y: 96, 'text-anchor': 'middle', 'font-size': 18, 'font-family': MONO, fill: 'rgba(226,238,255,0.8)', 'letter-spacing': 4,
  });
  return {
    defaults: { twist: 0.4, speed: 0.6 },
    render(s, t) {
      strands.forEach((item, i) => {
        const u = i / 25;
        const y = 130 + u * 380;
        const phase = u * Math.PI * 3.2 + t * clamp(s.speed) * 1.2;
        const x1 = 500 + Math.sin(phase) * 120;
        const x2 = 500 + Math.sin(phase + Math.PI) * 120;
        item.a.setAttribute('cx', x1);
        item.a.setAttribute('cy', y);
        item.b.setAttribute('cx', x2);
        item.b.setAttribute('cy', y);
        item.rung.setAttribute('x1', x1); item.rung.setAttribute('y1', y);
        item.rung.setAttribute('x2', x2); item.rung.setAttribute('y2', y);
        item.a.setAttribute('opacity', 0.55 + Math.cos(phase) * 0.35);
        item.b.setAttribute('opacity', 0.55 - Math.cos(phase) * 0.35);
      });
      label.setAttribute('opacity', 0.9);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- fluid ---------------------------------- */
function buildFluid(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx, '#060d16', '#04070d');
  const mode = spec.mode || 'buoy';
  const waterY = 330;

  const water = rect(root, 0, waterY, W, H - waterY, { fill: 'rgba(30,90,130,0.34)' });
  const waves = [];
  for (let i = 0; i < 4; i += 1) {
    waves.push(pathEl(root, '', { fill: 'none', stroke: 'rgba(140,215,255,0.4)', 'stroke-width': 1.2, opacity: 0.5 - i * 0.1 }));
  }
  const body = rect(root, 0, 0, 120, 90, { rx: 6, fill: alpha(tone, 0.22), stroke: tone, 'stroke-width': 2 });
  const bodyLabel = textEl(root, '', { 'text-anchor': 'middle', 'font-size': 12, 'font-family': SANS, fill: '#dff2ff' });
  const arrowUp = group(root, {});
  const arrowDown = group(root, {});
  pathEl(arrowUp, 'M0 0 l0 -60 M-9 -50 l9 -12 l9 12', { stroke: '#6BE7FF', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  pathEl(arrowDown, 'M0 0 l0 60 M-9 50 l9 12 l9 -12', { stroke: '#FF8E6B', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  const upLabel = textEl(root, 'F浮', { 'font-size': 13, 'font-family': MONO, fill: '#6BE7FF' });
  const downLabel = textEl(root, 'G', { 'font-size': 13, 'font-family': MONO, fill: '#FF8E6B' });
  const rDensity = readout(root, 720, 86, '物体密度', tone);
  const rRatio = readout(root, 720, 152, '浸没比例', tone);
  const verdict = textEl(root, '', { x: 720, y: 246, 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(210,228,248,0.85)' });
  const formula = textEl(root, 'F浮 = ρ液 · g · V排', {
    x: 720, y: 292, 'font-size': 16, 'font-family': MONO, fill: alpha(tone, 0.85),
  });
  const moon = circle(root, 850, 120, 0, { fill: '#fff4d8', opacity: 0 });
  const tideline = pathEl(root, '', { fill: 'none', stroke: '#8fd7ff', 'stroke-width': 1.4, opacity: 0 });
  const currentDots = [];
  for (let i = 0; i < 26; i += 1) {
    currentDots.push(circle(root, 0, 0, 1.8, { fill: '#9fdcff', opacity: 0 }));
  }

  return {
    defaults: { density: 0.6, wave: 0.5, moon: 0 },
    render(s, t) {
      const density = clamp(s.density, 0.1, 1.4);
      waves.forEach((w, i) => {
        let d = `M-40 ${waterY + i * 3}`;
        for (let x = -40; x <= W + 40; x += 24) {
          d += ` L${x} ${waterY + i * 3 + wobble(t * (0.6 + i * 0.15), i + 1, 3.2 * s.wave)}`;
        }
        w.setAttribute('d', d);
      });

      if (mode === 'tide') {
        body.setAttribute('opacity', 0);
        bodyLabel.setAttribute('opacity', 0);
        arrowUp.setAttribute('opacity', 0);
        arrowDown.setAttribute('opacity', 0);
        upLabel.setAttribute('opacity', 0);
        downLabel.setAttribute('opacity', 0);
        moon.setAttribute('r', 42);
        moon.setAttribute('opacity', 0.9);
        const phase = t * 0.5 + s.moon * 6;
        const level = waterY + Math.sin(phase) * 46;
        water.setAttribute('y', level);
        water.setAttribute('height', H - level);
        tideline.setAttribute('d', `M0 ${level} L${W} ${level}`);
        tideline.setAttribute('opacity', 0.7);
        rDensity.value.textContent = Math.sin(phase) > 0 ? '涨潮' : '落潮';
        rRatio.value.textContent = `${(level - waterY + 46).toFixed(0)} cm`;
        verdict.textContent = '月球与太阳的引潮力，每天两次高潮';
        fg.setAttribute('opacity', 1);
        return;
      }

      if (mode === 'current') {
        body.setAttribute('opacity', 0);
        bodyLabel.setAttribute('opacity', 0);
        arrowUp.setAttribute('opacity', 0);
        arrowDown.setAttribute('opacity', 0);
        upLabel.setAttribute('opacity', 0);
        downLabel.setAttribute('opacity', 0);
        moon.setAttribute('opacity', 0);
        currentDots.forEach((dot, i) => {
          const speed = 30 + s.wave * 120;
          const x = ((t * speed + i * 43) % (W + 120)) - 60;
          const y = 380 + Math.sin(i * 1.7) * 90;
          dot.setAttribute('cx', x);
          dot.setAttribute('cy', y + Math.sin(t * 0.8 + i) * 6);
          dot.setAttribute('opacity', 0.25 + s.wave * 0.6);
        });
        rDensity.value.textContent = '暖流 ↑ 寒流 ↓';
        rRatio.value.textContent = `${(s.wave * 3).toFixed(1)} 节`;
        verdict.textContent = '风推着表层水走，陆地让它拐弯';
        fg.setAttribute('opacity', 1);
        return;
      }

      // buoy
      moon.setAttribute('opacity', 0);
      tideline.setAttribute('opacity', 0);
      currentDots.forEach((d) => d.setAttribute('opacity', 0));
      const submerged = clamp(density / 1.0);
      const h = 90;
      const bw = 130;
      const top = waterY - h * (1 - submerged);
      body.setAttribute('x', 430 - bw / 2);
      body.setAttribute('y', top);
      body.setAttribute('width', bw);
      body.setAttribute('height', h);
      body.setAttribute('opacity', 1);
      bodyLabel.setAttribute('x', 430);
      bodyLabel.setAttribute('y', top + h / 2 + 4);
      bodyLabel.textContent = density < 1 ? '漂浮' : '下沉';
      arrowUp.setAttribute('transform', `translate(360 ${top + h / 2})`);
      arrowUp.setAttribute('opacity', 0.9);
      arrowDown.setAttribute('transform', `translate(500 ${top + h / 2})`);
      arrowDown.setAttribute('opacity', 0.9);
      upLabel.setAttribute('x', 330);
      upLabel.setAttribute('y', top + h / 2 - 66);
      downLabel.setAttribute('x', 514);
      downLabel.setAttribute('y', top + h / 2 + 76);
      rDensity.value.textContent = `${density.toFixed(2)} g/cm³`;
      rRatio.value.textContent = `${Math.round(submerged * 100)}%`;
      verdict.textContent = density < 1 ? '浮力 = 排开水的重力' : density > 1 ? '重力大于同体积水的重' : '悬浮：上下相等';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- grid ---------------------------------- */
function buildGrid(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'probability';

  if (mode === 'probability') {
    const cells = [];
    const cols = 16;
    for (let i = 0; i < 96; i += 1) {
      const g = group(root, {});
      const r = rect(g, 0, 0, 40, 40, { rx: 6, fill: 'rgba(120,170,230,0.08)', stroke: 'rgba(140,180,235,0.16)' });
      const face = textEl(g, '', { 'text-anchor': 'middle', 'font-size': 18, 'font-family': MONO, fill: '#dceafe' });
      cells.push({ g, r, face, i });
    }
    const bars = [];
    for (let i = 0; i < 6; i += 1) {
      bars.push(rect(root, 0, 0, 26, 10, { fill: alpha(tone, 0.7), rx: 3 }));
    }
    const barLabels = [];
    for (let i = 0; i < 6; i += 1) {
      barLabels.push(textEl(root, String(i + 1), { 'text-anchor': 'middle', 'font-size': 12, 'font-family': MONO, fill: 'rgba(190,210,240,0.7)' }));
    }
    const rTrials = readout(root, 690, 86, '试验次数', tone);
    const rFreq = readout(root, 690, 152, '出现 6 的频率', tone);
    const note = textEl(root, '次数越多，频率越贴近 1/6', {
      x: 690, y: 244, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    const counts = new Array(6).fill(0);
    let lastTrials = 0;

    return {
      defaults: { trials: 0, speed: 0.5 },
      render(s, t) {
        const n = Math.round(clamp(s.trials, 0, 1) * 600);
        if (n !== lastTrials) {
          for (let i = 0; i < 6 && n > 6; i += 1) counts[i] = Math.round(n / 6 + Math.sin(i * 7.3) * n * 0.035);
          lastTrials = n;
        }
        const total = Math.max(1, n);
        cells.forEach((cell, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          cell.g.setAttribute('transform', `translate(${70 + col * 44} ${110 + row * 44})`);
          const on = i < n / 7;
          cell.g.setAttribute('opacity', on ? 1 : 0.25);
          const value = ((i * 7 + Math.floor(t * 6)) % 6) + 1;
          cell.face.setAttribute('x', 20);
          cell.face.setAttribute('y', 27);
          cell.face.textContent = on ? String(value) : '';
          cell.r.setAttribute('fill', on ? alpha(tone, 0.16) : 'rgba(120,170,230,0.05)');
        });
        const maxCount = Math.max(...counts, 1);
        counts.forEach((c, i) => {
          const h = (c / maxCount) * 150;
          const bar = bars[i];
          bar.setAttribute('x', 150 + i * 78);
          bar.setAttribute('y', 520 - h);
          bar.setAttribute('height', Math.max(4, h));
          bar.setAttribute('opacity', 0.35 + (i === 5 ? 0.5 : 0.2));
          bar.setAttribute('fill', i === 5 ? '#FFD98A' : alpha(tone, 0.65));
          barLabels[i].setAttribute('x', 163 + i * 78);
          barLabels[i].setAttribute('y', 542);
        });
        rTrials.value.textContent = `${n} 次`;
        rFreq.value.textContent = n ? `${(counts[5] / total).toFixed(3)}` : '—';
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'periodic') {
    const cells = [];
    const cols = 18;
    const rand = seeded(12);
    const category = ['#FF8E6B', '#FFD98A', '#6BE7FF', '#79E86B', '#B08BFF', '#9AA3B5'];
    for (let i = 0; i < 54; i += 1) {
      const g = group(root, {});
      const r = rect(g, 0, 0, 38, 38, { rx: 4, fill: 'rgba(120,170,230,0.06)', stroke: 'rgba(150,190,235,0.18)' });
      const num = textEl(g, '', { x: 19, y: 26, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: '#dbeaff' });
      cells.push({ g, r, num, i, cat: Math.floor(rand() * 6) });
    }
    const rGroup = readout(root, 700, 104, '当前族', tone);
    const rPeriod = readout(root, 700, 170, '当前周期', tone);
    const hint = textEl(root, '同一族，最外层电子数相同', {
      x: 700, y: 262, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    const legend = category.map((c, i) => {
      const g = group(root, {});
      rect(g, 92 + i * 96, 566, 14, 8, { rx: 2, fill: c });
      textEl(g, ['碱金属', '过渡', '非金属', '卤素', '稀有气体', '其他'][i], {
        x: 112 + i * 96, y: 575, 'font-size': 10.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.6)',
      });
      return g;
    });

    return {
      defaults: { focus: 26 },
      render(s) {
        const focus = Math.round(clamp(s.focus, 0, 53));
        const focusRow = Math.floor(focus / 9);
        const focusCol = focus % 9;
        cells.forEach((cell) => {
          const row = Math.floor(cell.i / 9);
          const col = cell.i % 9;
          cell.g.setAttribute('transform', `translate(${112 + col * 46} ${120 + row * 46})`);
          const on = row === focusRow || col === focusCol;
          cell.r.setAttribute('fill', alpha(category[cell.cat], on ? 0.32 : 0.08));
          cell.r.setAttribute('stroke', on ? alpha(category[cell.cat], 0.9) : 'rgba(150,190,235,0.16)');
          cell.num.textContent = String(cell.i + 1);
          cell.g.setAttribute('opacity', on ? 1 : 0.55);
        });
        rGroup.value.textContent = `第 ${focusCol + 1} 列`;
        rPeriod.value.textContent = `第 ${focusRow + 1} 周期`;
        hint.setAttribute('opacity', 0.9);
        legend.forEach((g) => g.setAttribute('opacity', 0.85));
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // lattice
  const dots = [];
  const bonds = [];
  for (let i = 0; i < 60; i += 1) {
    bonds.push(line(root, 0, 0, 0, 0, { stroke: 'rgba(150,200,245,0.2)', 'stroke-width': 1 }));
  }
  for (let i = 0; i < 40; i += 1) {
    dots.push(circle(root, 0, 0, 5, { fill: alpha('#9B7BFF', 0.9) }));
  }
  const symmetry = pathEl(root, '', { fill: 'none', stroke: alpha('#FFD98A', 0.7), 'stroke-width': 1.6, 'stroke-dasharray': '6 6' });
  const rTemp = readout(root, 720, 100, '温度', tone);
  const rSym = readout(root, 720, 166, '对称性', tone);
  return {
    defaults: { temp: 0.35, rotate: 0 },
    render(s, t) {
      const heat = clamp(s.temp);
      const cols = 7;
      const rows = 5;
      const spacing = 52 + heat * 16;
      const jitter = heat * 8;
      const pts = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const idx = r * cols + c;
          const x = 300 + (c - (cols - 1) / 2) * spacing + Math.sin(t * 3 + idx) * jitter;
          const y = 190 + r * spacing * 0.9 + Math.cos(t * 2.4 + idx * 1.3) * jitter;
          pts.push([x, y]);
        }
      }
      pts.forEach((p, i) => {
        if (dots[i]) {
          dots[i].setAttribute('cx', p[0]);
          dots[i].setAttribute('cy', p[1]);
          dots[i].setAttribute('opacity', 0.4 + (1 - heat) * 0.6);
        }
      });
      for (let i = pts.length; i < dots.length; i += 1) dots[i].setAttribute('opacity', 0);
      let bi = 0;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const i = r * cols + c;
          if (c < cols - 1 && bi < bonds.length) {
            bonds[bi].setAttribute('x1', pts[i][0]); bonds[bi].setAttribute('y1', pts[i][1]);
            bonds[bi].setAttribute('x2', pts[i + 1][0]); bonds[bi].setAttribute('y2', pts[i + 1][1]);
            bonds[bi].setAttribute('opacity', (1 - heat * 0.7) * 0.7);
            bi += 1;
          }
          if (r < rows - 1 && bi < bonds.length) {
            bonds[bi].setAttribute('x1', pts[i][0]); bonds[bi].setAttribute('y1', pts[i][1]);
            bonds[bi].setAttribute('x2', pts[i + cols][0]); bonds[bi].setAttribute('y2', pts[i + cols][1]);
            bonds[bi].setAttribute('opacity', (1 - heat * 0.7) * 0.7);
            bi += 1;
          }
        }
      }
      symmetry.setAttribute('d', `M${300 - 120} ${320 - 120} l240 0 l0 240 l-240 0 z`);
      symmetry.setAttribute('opacity', (1 - heat) * 0.6);
      rTemp.value.textContent = `${Math.round(heat * 1200)} K`;
      rSym.value.textContent = heat > 0.7 ? '正在熔化' : heat > 0.4 ? '振动加剧' : '六重对称';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- layout --------------------------------- */
function buildLayout(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx, '#080d18', '#05080f');
  const mode = spec.mode || 'contrast';

  if (mode === 'typescale') {
    const block = [];
    const lines = 8;
    for (let i = 0; i < lines; i += 1) {
      const t = textEl(root, '把知识放回它诞生的地方，让每一行都读得下去。', {
        x: 140, y: 0, 'font-size': 18, 'font-family': '"PingFang SC", "Microsoft YaHei", sans-serif',
        fill: 'rgba(228,238,252,0.92)',
      });
      block.push(t);
    }
    const guide = group(root, {});
    const rLh = readout(root, 700, 90, '行高', tone);
    const rTrack = readout(root, 700, 156, '字距', tone);
    const rWidth = readout(root, 700, 222, '每行字数', tone);
    const note = textEl(root, '30–40 字一行，1.5 倍行高，最容易读', {
      x: 700, y: 310, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { lh: 1.55, tracking: 0, width: 0.62 },
      render(s) {
        const fs = 18;
        const lh = clamp(s.lh, 1.05, 2.4) * fs;
        const width = clamp(s.width, 0.35, 0.92) * 560;
        block.forEach((t, i) => {
          t.setAttribute('y', String(150 + i * lh));
          t.setAttribute('letter-spacing', String(s.tracking));
          t.setAttribute('opacity', i < 6 ? 1 - i * 0.04 : 0);
        });
        // 宽度框
        while (guide.firstChild) guide.firstChild.remove();
        rect(guide, 140, 110, width, 6 * lh + 20, { fill: 'none', stroke: alpha(tone, 0.35), 'stroke-dasharray': '6 6' });
        textEl(guide, `${Math.round(width / fs)} 字`, {
          x: 140 + width + 12, y: 126, 'font-size': 11, 'font-family': MONO, fill: alpha(tone, 0.8),
        });
        rLh.value.textContent = `${s.lh.toFixed(2)} ×`;
        rTrack.value.textContent = `${s.tracking.toFixed(1)} px`;
        rWidth.value.textContent = `${Math.round(width / fs)} 字`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'grid') {
    const blocks = [];
    for (let i = 0; i < 9; i += 1) {
      const g = group(root, {});
      rect(g, 0, 0, 10, 10, { rx: 6, fill: 'rgba(120,170,230,0.1)', stroke: 'rgba(150,190,235,0.18)' });
      blocks.push(g);
    }
    const colLines = [];
    for (let i = 0; i <= 12; i += 1) {
      colLines.push(line(root, 0, 90, 0, 520, { stroke: alpha(tone, 0.14), 'stroke-width': 1 }));
    }
    const rCols = readout(root, 720, 100, '栅格列数', tone);
    const rGutter = readout(root, 720, 166, '槽宽', tone);
    const note = textEl(root, '内容落在栅格上，页面才有秩序', {
      x: 720, y: 262, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { cols: 12, gutter: 0.3 },
      render(s) {
        const cols = Math.round(clamp(s.cols, 2, 12));
        const areaX = 90;
        const areaW = 560;
        const gutter = lerp(6, 34, clamp(s.gutter));
        const colW = (areaW - gutter * (cols - 1)) / cols;
        colLines.forEach((l, i) => {
          l.setAttribute('opacity', i <= cols ? 0.14 : 0);
          l.setAttribute('x1', areaX + i * (colW + gutter));
          l.setAttribute('x2', areaX + i * (colW + gutter));
        });
        const half = Math.max(1, Math.floor(cols / 2));
        const spans = [[0, cols], [0, half], [half, cols - half], [0, 1], [1, Math.max(1, cols - 1)]];
        blocks.forEach((g, i) => {
          const span = spans[i % spans.length];
          const row = Math.floor(i / 2);
          const x = areaX + span[0] * (colW + gutter);
          const w = Math.max(8, span[1] * colW + (span[1] - 1) * gutter);
          g.setAttribute('transform', `translate(${x} ${120 + row * 130})`);
          g.firstChild.setAttribute('width', w);
          g.firstChild.setAttribute('height', i % 2 === 0 ? 96 : 60);
          g.setAttribute('opacity', i < 6 ? 1 : 0);
        });
        rCols.value.textContent = `${cols} 列`;
        rGutter.value.textContent = `${gutter.toFixed(0)} px`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // contrast
  const panels = [group(root, {}), group(root, {})];
  const titleA = textEl(panels[0], '标题', { 'font-size': 48, 'font-family': SANS, fill: '#f2f7ff' });
  const bodyA = textEl(panels[0], '正文文字', { 'font-size': 18, 'font-family': SANS, fill: 'rgba(200,215,238,0.55)' });
  const titleB = textEl(panels[1], '标题', { 'font-size': 48, 'font-family': SANS, fill: '#f2f7ff' });
  const bodyB = textEl(panels[1], '正文文字', { 'font-size': 18, 'font-family': SANS, fill: 'rgba(200,215,238,0.55)' });
  const frameA = rect(panels[0], 0, 0, 360, 300, { rx: 16, fill: 'rgba(10,16,28,0.6)', stroke: 'rgba(150,190,235,0.2)' });
  const frameB = rect(panels[1], 0, 0, 360, 300, { rx: 16, fill: 'rgba(10,16,28,0.6)', stroke: 'rgba(150,190,235,0.2)' });
  const rScale = readout(root, 700, 90, '标题／正文字号比', tone);
  const rContrast = readout(root, 700, 156, '正文对比度', tone);
  const note = textEl(root, '层级 = 大小 × 粗细 × 明度', {
    x: 700, y: 250, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
  });

  return {
    defaults: { scale: 0.55, contrast: 0.4 },
    render(s) {
      panels.forEach((g, i) => {
        g.setAttribute('transform', `translate(${90 + i * 400} 150)`);
      });
      const ratio = lerp(1.05, 2.4, clamp(s.scale));
      const titleSize = 20 * ratio;
      const bodySize = 20;
      const bodyOpacity = lerp(0.3, 0.92, clamp(s.contrast));
      titleA.setAttribute('font-size', String(titleSize));
      titleB.setAttribute('font-size', String(titleSize));
      titleA.setAttribute('x', 30); titleA.setAttribute('y', 76);
      titleB.setAttribute('x', 30); titleB.setAttribute('y', 76);
      bodyA.setAttribute('x', 30); bodyA.setAttribute('y', 130);
      bodyB.setAttribute('x', 30); bodyB.setAttribute('y', 130);
      bodyA.setAttribute('font-size', String(bodySize));
      bodyB.setAttribute('font-size', String(bodySize));
      bodyA.setAttribute('opacity', String(lerp(0.34, 0.95, clamp(s.contrast))));
      bodyB.setAttribute('opacity', 0.42);
      titleB.setAttribute('opacity', 0.42);
      rScale.value.textContent = `${ratio.toFixed(2)} ×`;
      rContrast.value.textContent = `${Math.round(bodyOpacity * 100)}%`;
      note.setAttribute('opacity', 0.9);
      fg.setAttribute('opacity', 1);
      frameA.setAttribute('opacity', 1);
      frameB.setAttribute('opacity', 1);
    },
  };
}

function i0() {
  return 0.4;
}
/* ---------------------------------- heat ---------------------------------- */
function buildHeat(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx, '#0a0a0e', '#060508');
  const mode = spec.mode || 'pan';

  if (mode === 'ferment') {
    const bubbles = [];
    for (let i = 0; i < 40; i += 1) {
      bubbles.push(circle(root, 0, 0, 4, { fill: 'rgba(255,236,200,0.55)', stroke: 'rgba(255,220,170,0.35)' }));
    }
    const dough = svgEl('ellipse', { cx: 430, cy: 400, rx: 150, ry: 100, fill: '#d9b98d' }, root);
    const doughTop = svgEl('ellipse', { cx: 430, cy: 350, rx: 150, ry: 60, fill: '#e6cba2' }, root);
    const rTemp = readout(root, 700, 100, '温度', tone);
    const rRise = readout(root, 700, 166, '体积倍率', tone);
    const note = textEl(root, '酵母产气，被面筋网络困住', {
      x: 700, y: 268, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { temp: 28, time: 0.3 },
      render(s, t) {
        const temp = clamp(s.temp, 4, 60);
        const rate = Math.exp((temp - 20) / 12);
        const rise = 0.7 + clamp(s.time) * 0.7 * rate * 0.3;
        dough.setAttribute('ry', String(100 * rise));
        dough.setAttribute('cy', String(400 - (100 * rise - 100)));
        doughTop.setAttribute('cy', String(350 - (100 * rise - 100)));
        doughTop.setAttribute('rx', String(150 * (0.96 + rise * 0.04)));
        bubbles.forEach((b, i) => {
          const phase = (t * 0.22 * rate + i * 0.11) % 1;
          const x = 340 + ((i * 37) % 200);
          const y = 420 - phase * (140 * rise);
          b.setAttribute('cx', x + Math.sin(t + i) * 4);
          b.setAttribute('cy', y);
          b.setAttribute('r', String(3 + (i % 4) * 1.6));
          b.setAttribute('opacity', temp > 50 ? 0.12 : clamp((1 - phase) * 0.7));
        });
        rTemp.value.textContent = `${Math.round(temp)} °C`;
        rRise.value.textContent = `${rise.toFixed(2)} ×`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'emulsion') {
    const drops = [];
    for (let i = 0; i < 26; i += 1) {
      const g = group(root, {});
      circle(g, 0, 0, 12, { fill: 'rgba(255,214,120,0.85)' });
      circle(g, -4, -4, 3.4, { fill: 'rgba(255,255,220,0.8)' });
      const shell = circle(g, 0, 0, 17, { fill: 'none', stroke: 'rgba(120,235,210,0.7)', 'stroke-width': 2.4, 'stroke-dasharray': '4 4' });
      drops.push({ g, shell });
    }
    const rAgitate = readout(root, 700, 110, '搅拌强度', tone);
    const rSize = readout(root, 700, 176, '油滴直径', tone);
    const note = textEl(root, '乳化剂把油滴包住，油水就不再分层', {
      x: 700, y: 276, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { agitation: 0.5 },
      render(s, t) {
        const ag = clamp(s.agitation);
        drops.forEach((d, i) => {
          const a = (i / drops.length) * Math.PI * 2 + t * 0.25;
          const r = 60 + (1 - ag) * 150 + Math.sin(i * 2.1) * 30;
          const x = 430 + Math.cos(a) * r;
          const y = 330 + Math.sin(a) * r * 0.7;
          d.g.setAttribute('transform', `translate(${x} ${y}) scale(${1.4 - ag * 0.7})`);
          d.g.setAttribute('opacity', 0.55 + ag * 0.45);
          d.shell.setAttribute('opacity', ag);
        });
        rAgitate.value.textContent = `${Math.round(ag * 100)}%`;
        rSize.value.textContent = `${(28 - ag * 18).toFixed(1)} μm`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'flame') {
    const flames = [];
    for (let i = 0; i < 5; i += 1) {
      flames.push(pathEl(root, '', { fill: 'none', stroke: '#6BE7FF', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.7 }));
    }
    const burner = group(root, { transform: 'translate(430 470)' });
    rect(burner, -90, 20, 180, 26, { rx: 8, fill: '#1b232e' });
    rect(burner, -18, 0, 36, 22, { fill: '#2a3542' });
    const rAir = readout(root, 700, 120, '进风量', tone);
    const rTemp = readout(root, 700, 186, '火焰温度', tone);
    const note = textEl(root, '', { x: 700, y: 288, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)' });
    return {
      defaults: { air: 0.5 },
      render(s, t) {
        const air = clamp(s.air);
        const color = air > 0.55 ? '#6BE7FF' : air > 0.3 ? '#FFB86B' : '#FF8E6B';
        flames.forEach((f, i) => {
          const h = 70 + air * 40 + Math.sin(t * 6 + i) * 8;
          f.setAttribute('d', `M${400 + i * 15} 470 q${10 - i * 4} ${-h * 0.6} ${5 + Math.sin(t * 4 + i) * 4} ${-h}`);
          f.setAttribute('stroke', color);
          f.setAttribute('opacity', 0.3 + air * 0.4);
        });
        rAir.value.textContent = `${Math.round(air * 100)}%`;
        rTemp.value.textContent = `${Math.round(600 + air * 600)} °C`;
        note.textContent = air < 0.4 ? '进风不足 → 黄焰 + 一氧化碳' : '充分燃烧 → 蓝焰，温度最高';
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // pan
  const pan = group(root, { transform: 'translate(430 400)' });
  svgEl('ellipse', { cx: 0, cy: 0, rx: 190, ry: 56, fill: '#1a1d22', stroke: '#3a4048', 'stroke-width': 3 }, pan);
  svgEl('ellipse', { cx: 0, cy: -4, rx: 168, ry: 44, fill: '#0e1014' }, pan);
  const steak = rect(pan, -78, -34, 156, 70, { rx: 18, fill: '#7a2f2a' });
  const sear = rect(pan, -78, -34, 156, 70, { rx: 18, fill: '#3b1a12', opacity: 0 });
  const handle = rect(pan, 180, -6, 120, 14, { rx: 6, fill: '#2a2f36' });
  const smoke = [];
  for (let i = 0; i < 14; i += 1) {
    smoke.push(circle(root, 0, 0, 5, { fill: 'rgba(220,230,245,0.16)' }));
  }
  const rHeat = readout(root, 700, 110, '锅温', tone);
  const rTime = readout(root, 700, 176, '加热时间', tone);
  const note = textEl(root, '', { x: 700, y: 278, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)' });
  return {
    defaults: { heat: 0.5, time: 0.2 },
    render(s, t) {
      const heat = clamp(s.heat);
      const time = clamp(s.time);
      const brown = clamp(heat * 0.7 + time * 0.5);
      sear.setAttribute('opacity', brown * 0.9);
      sear.setAttribute('fill', `rgb(${Math.round(lerp(122, 58, brown))},${Math.round(lerp(47, 26, brown))},${Math.round(lerp(42, 16, brown))})`);
      steak.setAttribute('fill', `rgb(${Math.round(lerp(150, 84, brown))},${Math.round(lerp(60, 40, brown))},${Math.round(lerp(52, 24, brown))})`);
      smoke.forEach((c, i) => {
        const p = (t * 0.25 + i * 0.09) % 1;
        c.setAttribute('cx', 380 + i * 12 + Math.sin(t + i) * 10);
        c.setAttribute('cy', 360 - p * 150);
        c.setAttribute('r', String(4 + p * 16));
        c.setAttribute('opacity', (1 - p) * 0.28 * (0.4 + heat));
      });
      rHeat.value.textContent = `${Math.round(120 + heat * 140)} °C`;
      rTime.value.textContent = `${(time * 8).toFixed(1)} min`;
      note.textContent = heat > 0.62 ? '美拉德反应：氨基酸 + 糖 → 褐色香气' : '温度不够，只是在脱水，不会变香';
      note.setAttribute('opacity', 0.9);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- mech ---------------------------------- */
function buildMech(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx, '#080c15', '#04060b');
  const mode = spec.mode || 'lever';

  if (mode === 'lever') {
    const beam = group(root, {});
    rect(beam, -260, -10, 520, 20, { rx: 8, fill: '#4a3a28' });
    const fulcrum = poly(root, [[500, 470], [455, 545], [545, 545]], { fill: '#2a3340', stroke: 'rgba(150,190,235,0.4)' });
    const w1 = group(root, {});
    rect(w1, -34, -68, 68, 58, { rx: 5, fill: alpha('#FF8E6B', 0.9) });
    textEl(w1, '', { 'text-anchor': 'middle', 'font-size': 15, 'font-family': MONO, fill: '#2a1108' });
    const w1Label = textEl(w1, 'F₁', { x: 0, y: -78, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: '#FF8E6B' });
    const w2 = group(root, {});
    rect(w2, -26, -46, 52, 40, { rx: 5, fill: alpha('#6BE7FF', 0.9) });
    const w2Label = textEl(w2, 'F₂', { x: 0, y: -56, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: '#6BE7FF' });
    const arm1 = line(root, 500, 500, 0, 500, { stroke: 'rgba(255,142,107,0.5)', 'stroke-width': 2, 'stroke-dasharray': '5 5' });
    const arm2 = line(root, 500, 500, 0, 500, { stroke: 'rgba(107,231,255,0.5)', 'stroke-width': 2, 'stroke-dasharray': '5 5' });
    const l1 = textEl(root, '', { 'font-size': 13, 'font-family': MONO, fill: '#FF8E6B', 'text-anchor': 'middle' });
    const l2 = textEl(root, '', { 'font-size': 13, 'font-family': MONO, fill: '#6BE7FF', 'text-anchor': 'middle' });
    const r1 = readout(root, 720, 92, '左力臂 / 右力臂', tone);
    const r2 = readout(root, 720, 158, '所需力', tone);
    const formula = textEl(root, 'F₁ · L₁ = F₂ · L₂', {
      x: 720, y: 250, 'font-size': 17, 'font-family': MONO, fill: 'rgba(226,238,255,0.85)',
    });
    const note = textEl(root, '省力，但要多走距离', {
      x: 720, y: 288, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { ratio: 0.5 },
      render(s) {
        const left = lerp(1.4, 4.2, clamp(s.ratio)) * 100;
        const right = 120;
        const force = 100 * (right / left);
        const tilt = clamp((right - left) / 260) * 6;
        beam.setAttribute('transform', `translate(500 440) rotate(${tilt})`);
        w1.setAttribute('transform', `translate(${500 - left} ${440 - 10 - Math.abs(tilt) * 0.2})`);
        w2.setAttribute('transform', `translate(${500 + right} ${440 - 10})`);
        arm1.setAttribute('x1', 500); arm1.setAttribute('y1', 520); arm1.setAttribute('x2', 500 - left); arm1.setAttribute('y2', 520);
        arm2.setAttribute('x1', 500); arm2.setAttribute('y1', 520); arm2.setAttribute('x2', 500 + right); arm2.setAttribute('y2', 520);
        l1.setAttribute('x', 500 - left / 2); l1.setAttribute('y', 512);
        l1.textContent = `${(left / 100).toFixed(1)} m`;
        l2.setAttribute('x', 500 + right / 2); l2.setAttribute('y', 512);
        l2.textContent = `${(right / 100).toFixed(1)} m`;
        r1.value.textContent = `${(left / 100).toFixed(1)} : ${(right / 100).toFixed(1)}`;
        r2.value.textContent = `${(force / 100).toFixed(2)} F`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'sun') {
    const sky = rect(root, 0, 0, W, 470, { fill: '#0b1220' });
    const groundLine = rect(root, 0, 470, W, H - 470, { fill: '#10151c' });
    const house = group(root, { transform: 'translate(430 470)' });
    rect(house, -90, -150, 180, 150, { fill: '#1a2230', stroke: 'rgba(150,190,235,0.3)' });
    rect(house, -24, -100, 48, 48, { fill: 'rgba(255,217,138,0.18)', stroke: 'rgba(255,217,138,0.5)' });
    const eave = rect(house, -130, -160, 260, 12, { fill: '#2a3444' });
    const sunG = group(root, {});
    const sunDot = circle(sunG, 0, 0, 26, { fill: '#FFE7A8' });
    const rays = [];
    for (let i = 0; i < 6; i += 1) rays.push(line(sunG, 0, 0, 0, 0, { stroke: 'rgba(255,231,168,0.45)', 'stroke-width': 1.6 }));
    const shadow = poly(root, [[430, 470], [430, 470], [430, 470], [430, 470]], { fill: 'rgba(0,0,0,0.5)' });
    const rAlt = readout(root, 700, 92, '太阳高度角', tone);
    const rShadow = readout(root, 700, 158, '影长', tone);
    const note = textEl(root, '冬至正午最低，屋檐正好挡住夏天', {
      x: 700, y: 250, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { altitude: 0.5, season: 0.35 },
      render(s) {
        const alt = lerp(12, 78, clamp(s.altitude));
        const rad = (alt * Math.PI) / 180;
        const sx = 430 - Math.cos(rad) * 470;
        const sy = 470 - Math.sin(rad) * 470;
        sunG.setAttribute('transform', `translate(${sx} ${sy})`);
        rays.forEach((r, i) => {
          const a = (i / 6) * Math.PI * 2;
          r.setAttribute('x1', Math.cos(a) * 34);
          r.setAttribute('y1', Math.sin(a) * 34);
          r.setAttribute('x2', Math.cos(a) * 52);
          r.setAttribute('y2', Math.sin(a) * 52);
        });
        const shadowLen = 150 / Math.tan(rad);
        shadow.setAttribute('points', `430,470 ${430 + Math.min(520, shadowLen)},470 ${430 + Math.min(520, shadowLen) * 0.7},486 430,486`);
        rAlt.value.textContent = `${alt.toFixed(0)}°`;
        rShadow.value.textContent = `${(shadowLen / 100).toFixed(1)} m`;
        note.setAttribute('opacity', 0.9);
        sky.setAttribute('fill', `rgb(${Math.round(lerp(10, 40, s.altitude))},${Math.round(lerp(18, 48, s.altitude))},${Math.round(lerp(32, 70, s.altitude))})`);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'wind') {
    const tower = group(root, { transform: 'translate(500 540)' });
    rect(tower, -46, -400, 92, 400, { rx: 6, fill: '#161d28', stroke: 'rgba(150,190,235,0.28)' });
    for (let i = 1; i < 10; i += 1) {
      line(tower, -46, -i * 40, 46, -i * 40, { stroke: 'rgba(150,190,235,0.1)' });
    }
    const top = circle(tower, 0, -410, 8, { fill: '#FF8E6B' });
    const streaks = [];
    for (let i = 0; i < 22; i += 1) {
      streaks.push(pathEl(root, '', { fill: 'none', stroke: 'rgba(150,210,255,0.35)', 'stroke-width': 1.4 }));
    }
    const vortices = [];
    for (let i = 0; i < 10; i += 1) {
      vortices.push(circle(root, 0, 0, 4, { fill: 'none', stroke: 'rgba(180,220,255,0.35)', 'stroke-width': 1 }));
    }
    const rWind = readout(root, 720, 100, '风速', tone);
    const rSway = readout(root, 720, 166, '顶点位移', tone);
    const note = textEl(root, '风涡交替脱落，塔身被推着摆', {
      x: 720, y: 262, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
    });
    return {
      defaults: { wind: 0.4 },
      render(s, t) {
        const w = clamp(s.wind);
        const sway = Math.sin(t * 1.6) * w * 11;
        tower.setAttribute('transform', `translate(${500 + sway} 540) rotate(${sway * 0.05})`);
        streaks.forEach((p, i) => {
          const y = 90 + ((i * 47) % 420);
          const x = ((t * (30 + w * 220) + i * 90) % (W + 200)) - 100;
          const len = 40 + w * 130;
          p.setAttribute('d', `M${x} ${y} q${len * 0.5} ${Math.sin(i) * 6} ${len} 0`);
          p.setAttribute('opacity', 0.12 + w * 0.4);
        });
        vortices.forEach((v, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const phase = (t * (0.6 + w) + i * 0.13) % 1;
          v.setAttribute('cx', 500 + side * 60 + Math.sin(phase * 6.28) * 14);
          v.setAttribute('cy', 540 - 120 - i * 36 - phase * 20);
          v.setAttribute('r', String(6 + phase * 18));
          v.setAttribute('opacity', (1 - phase) * 0.35 * w);
        });
        rWind.value.textContent = `${Math.round(w * 45)} m/s`;
        rSway.value.textContent = `${(Math.abs(sway) * 2.2).toFixed(1)} cm`;
        note.setAttribute('opacity', 0.9);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // arch / truss 共用一条石拱或钢架
  const stones = [];
  const N = 11;
  for (let i = 0; i < N; i += 1) {
    stones.push(poly(root, [[0, 0], [0, 0], [0, 0], [0, 0]], {
      fill: i === Math.floor(N / 2) ? alpha('#FFD98A', 0.85) : 'rgba(120,150,190,0.22)',
      stroke: 'rgba(170,200,240,0.4)',
      'stroke-width': 1.2,
    }));
  }
  const loadArrow = pathEl(root, 'M500 110 l0 120 M488 216 l12 16 l12 -16', { stroke: '#FF8E6B', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  const spreadL = pathEl(root, 'M330 470 l-40 40 M330 470 l-46 8', { stroke: '#6BE7FF', 'stroke-width': 2.4, fill: 'none' });
  const spreadR = pathEl(root, 'M670 470 l40 40 M670 470 l46 8', { stroke: '#6BE7FF', 'stroke-width': 2.4, fill: 'none' });
  const rLoad = readout(root, 720, 110, '荷载', tone);
  const rSpan = readout(root, 720, 176, '跨度', tone);
  const note = textEl(root, '压力沿拱石传下去，石头只受挤压', {
    x: 720, y: 276, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(180,200,230,0.62)',
  });
  const trussLines = [];
  if (mode === 'truss') {
    for (let i = 0; i < 12; i += 1) {
      trussLines.push(line(root, 0, 0, 0, 0, { stroke: 'rgba(107,231,255,0.7)', 'stroke-width': 2.4 }));
    }
  }

  return {
    defaults: { load: 0.5 },
    render(s, t) {
      const load = clamp(s.load);
      if (mode === 'truss') {
        stones.forEach((st) => st.setAttribute('opacity', 0));
        const span = 620;
        const height = 150;
        const x0 = 500 - span / 2;
        const y0 = 460;
        const nodes = [
          [x0, y0], [x0 + span / 2, y0], [x0 + span, y0],
          [x0 + span / 4, y0 - height], [x0 + (span * 3) / 4, y0 - height],
        ];
        const edges = [[0, 3], [3, 1], [3, 4], [1, 4], [4, 2], [0, 1], [1, 2]];
        edges.forEach((e, i) => {
          if (!trussLines[i]) return;
          trussLines[i].setAttribute('x1', nodes[e[0]][0]);
          trussLines[i].setAttribute('y1', nodes[e[0]][1]);
          trussLines[i].setAttribute('x2', nodes[e[1]][0]);
          trussLines[i].setAttribute('y2', nodes[e[1]][1]);
          trussLines[i].setAttribute('stroke', e[0] === 1 && e[1] === 4 ? '#FF8E6B' : '#6BE7FF');
          trussLines[i].setAttribute('stroke-width', 2 + load * 1.6);
        });
        loadArrow.setAttribute('d', `M${x0 + span / 4} ${y0 - height - 90} l0 80 M${x0 + span / 4 - 12} ${y0 - height - 24} l12 16 l12 -16`);
        spreadL.setAttribute('d', `M${x0} ${y0} l-40 40 M${x0} ${y0} l-46 8`);
        spreadR.setAttribute('d', `M${x0 + span} ${y0} l40 40 M${x0 + span} ${y0} l46 8`);
        rSpan.value.textContent = '20 m';
      } else {
        const cx = 500;
        const cy = 470;
        const R = 190;
        for (let i = 0; i < N; i += 1) {
          const a0 = Math.PI + (i / N) * Math.PI;
          const a1 = Math.PI + ((i + 1) / N) * Math.PI;
          const inner = R - 46;
          const pts = [
            [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R],
            [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R],
            [cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner],
            [cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner],
          ];
          const st = stones[i];
          st.setAttribute('points', pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
          st.setAttribute('opacity', 1);
          st.setAttribute('fill', i === Math.floor(N / 2) ? alpha('#FFD98A', 0.3 + load * 0.5) : 'rgba(120,150,190,0.18)');
        }
        loadArrow.setAttribute('d', `M${cx} ${cy - R - 60 - load * 30} l0 ${70} M${cx - 12} ${cy - R + 4} l12 16 l12 -16`);
        spreadL.setAttribute('d', `M${cx - R} ${cy} l-46 42 M${cx - R} ${cy} l-52 6`);
        spreadR.setAttribute('d', `M${cx + R} ${cy} l46 42 M${cx + R} ${cy} l52 6`);
        rSpan.value.textContent = `${(R * 2 / 100).toFixed(1)} m`;
      }
      rLoad.value.textContent = `${(load * 120).toFixed(0)} t`;
      note.setAttribute('opacity', 0.9);
      fg.setAttribute('opacity', 1);
    },
  };
}

export const visualEngines = {
  curve: buildCurve,
  geometry: buildGeometry,
  ratio: buildRatio,
  motion: buildMotion,
  orbit: buildOrbit,
  fluid: buildFluid,
  grid: buildGrid,
  layout: buildLayout,
  heat: buildHeat,
  mech: buildMech,
};
