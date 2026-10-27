/**
 * 专用小引擎：一个知识点一个画面，但都遵守同一条规则 —— 滑杆就是自变量。
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
  linearGradient(defs, 'mc-bg', [[0, top], [1, bottom]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  rect(bg, 0, 0, W, H, { fill: 'url(#mc-bg)' });
}

function readout(parent, x, y, label, tone, width = 176) {
  const g = group(parent, {});
  rect(g, x, y, width, 50, { rx: 10, fill: 'rgba(6,11,20,0.8)', stroke: alpha(tone, 0.28) });
  textEl(g, label, { x: x + 12, y: y + 19, 'font-size': 10.5, 'font-family': SANS, fill: 'rgba(166,188,218,0.72)', 'letter-spacing': 1.4 });
  const value = textEl(g, '—', { x: x + 12, y: y + 40, 'font-size': 16, 'font-family': MONO, fill: '#eaf4ff' });
  return { g, value };
}

/* ---------------------------------- space ---------------------------------- */
function buildSpace(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx);
  const tableTop = 400;
  const table = group(root, {});
  rect(table, 250, tableTop, 500, 18, { rx: 4, fill: '#3a2a1d' });
  rect(table, 292, tableTop + 18, 18, 130, { fill: '#2a1e14' });
  rect(table, 690, tableTop + 18, 18, 130, { fill: '#2a1e14' });
  const drawer = rect(table, 560, tableTop + 30, 130, 84, { rx: 6, fill: 'rgba(90,66,42,0.65)', stroke: 'rgba(190,150,100,0.5)' });
  textEl(table, 'drawer', { x: 625, y: tableTop + 78, 'text-anchor': 'middle', 'font-size': 11, 'font-family': MONO, fill: 'rgba(255,220,180,0.6)' });
  const ball = circle(root, 520, 300, 26, { fill: alpha(tone, 0.95), stroke: '#fff', 'stroke-width': 1 });
  const ballGlow = circle(root, 520, 300, 46, { fill: tone, opacity: 0.2 });
  const word = textEl(root, '', { x: 500, y: 130, 'text-anchor': 'middle', 'font-size': 46, 'font-family': MONO, fill: '#f2f8ff' });
  const phrase = textEl(root, '', { x: 500, y: 176, 'text-anchor': 'middle', 'font-size': 18, 'font-family': SANS, fill: 'rgba(212,228,250,0.75)' });
  const zh = textEl(root, '', { x: 500, y: 552, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: alpha(tone, 0.85) });
  return {
    defaults: { pos: 0 },
    render(s, t) {
      const p = clamp(s.pos, 0, 2.999);
      let x = 520;
      let y = 330;
      let label = '';
      let cn = '';
      if (p < 1) {
        x = lerp(410, 480, p);
        y = tableTop - 26;
        label = 'on the table';
        cn = 'on：与表面接触';
      } else if (p < 2) {
        x = 625;
        y = tableTop + 56;
        label = 'in the drawer';
        cn = 'in：在内部、被包围';
      } else {
        x = 520;
        y = tableTop + 52;
        label = 'under the table';
        cn = 'under：在正下方';
      }
      ball.setAttribute('cx', x);
      ball.setAttribute('cy', y + Math.sin(t * 2) * 1.6);
      ballGlow.setAttribute('cx', x);
      ballGlow.setAttribute('cy', y + Math.sin(t * 2) * 1.6);
      word.textContent = label;
      phrase.textContent = 'The ball is …';
      zh.textContent = cn;
      drawer.setAttribute('opacity', p >= 1 && p < 2 ? 1 : 0.55);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ----------------------------------- ph ----------------------------------- */
function buildPh(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#0a0b12', '#05060a');
  const colors = ['#FF4D4D', '#FF7A3D', '#FFB03D', '#E8D84D', '#8FE05A', '#4FD1C5', '#4F9BFF', '#7A6BFF'];
  const bar = group(root, {});
  const stops = colors.map((c, i) => {
    const x = 110 + i * 97;
    return rect(bar, x, 300, 96, 54, { fill: c, opacity: 0.75 });
  });
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
  labels.forEach((l, i) => {
    textEl(bar, l, { x: 110 + (i * 780) / 14, y: 380, 'text-anchor': 'middle', 'font-size': 11, 'font-family': MONO, fill: 'rgba(200,220,245,0.6)' });
  });
  const marker = group(root, {});
  poly(marker, [[0, 0], [-9, -14], [9, -14]], { fill: '#fffdf4' });
  const markerLabel = textEl(marker, '', { x: 0, y: -22, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: '#fffdf4' });
  const beaker = group(root, { transform: 'translate(500 470)' });
  pathEl(beaker, 'M-90 -80 l0 120 q0 22 22 22 l136 0 q22 0 22 -22 l0 -120', { fill: 'none', stroke: 'rgba(190,215,245,0.55)', 'stroke-width': 2 });
  const liquid = pathEl(beaker, '', { fill: alpha(tone, 0.5) });
  const drops = [];
  for (let i = 0; i < 12; i += 1) drops.push(circle(root, 0, 0, 3, { fill: 'rgba(150,230,255,0.7)', opacity: 0 }));
  const rPh = readout(root, 720, 92, 'pH', tone);
  const verdict = textEl(root, '', { x: 500, y: 128, 'text-anchor': 'middle', 'font-size': 16, 'font-family': SANS, fill: 'rgba(220,236,255,0.85)' });
  return {
    defaults: { ph: 6.5, base: 0 },
    render(s, t) {
      const ph = clamp(s.ph, 0, 14);
      const x = 110 + (ph / 14) * 780;
      marker.setAttribute('transform', `translate(${x} 300) translate(0 0)`);
      markerLabel.textContent = `pH ${ph.toFixed(1)}`;
      const color = ph < 5 ? '#FF6B5C' : ph > 8 ? '#4F9BFF' : '#8FE05A';
      liquid.setAttribute('d', `M-88 ${-78 + (14 - ph) * 4} l0 ${118 - (14 - ph) * 4} q0 20 20 20 l136 0 q20 0 20 -20 l0 -${118 - (14 - ph) * 4}`);
      liquid.setAttribute('fill', alpha(color, 0.5 + s.base * 0.2));
      drops.forEach((d, i) => {
        const u = (t * 0.6 + i / 12) % 1;
        d.setAttribute('cx', 500 + Math.sin(i * 2) * 46);
        d.setAttribute('cy', 300 + u * 150);
        d.setAttribute('opacity', s.base * (1 - u) * 0.8);
      });
      rPh.value.textContent = ph.toFixed(1);
      verdict.textContent = ph < 6 ? '酸性：H⁺ 多，pH 每降 1 就浓 10 倍' : ph > 8 ? '碱性：OH⁻ 多' : '接近中性';
      verdict.setAttribute('fill', color);
      stops.forEach((s2, i) => {
        s2.setAttribute('opacity', i === Math.round((ph / 14) * 7) ? 1 : 0.5);
      });
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- sonar ---------------------------------- */
function buildSonar(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#04101a', '#02070c');
  const waterY = 150;
  const sea = rect(root, 0, waterY, W, H - waterY, { fill: 'rgba(8,40,60,0.55)' });
  for (let i = 0; i < 5; i += 1) {
    line(root, 0, waterY + 8 + i * 12, W, waterY + 4 + i * 12, { stroke: 'rgba(120,190,230,0.08)', 'stroke-width': 1 });
  }
  const boat = group(root, { transform: 'translate(300 148)' });
  pathEl(boat, 'M-80 0 q16 26 80 26 q64 0 80 -26 q-80 10 -160 0 z', { fill: '#1b2b38' });
  rect(boat, -26, -26, 52, 26, { fill: '#233746' });
  const seabed = pathEl(root, 'M0 520 q120 -60 260 -20 q120 34 240 -30 q140 -50 260 10 q80 30 240 6 l0 140 l-1000 0 z', {
    fill: 'rgba(26,40,48,0.9)',
  });
  const rocks = [];
  const rand = seeded(31);
  for (let i = 0; i < 7; i += 1) {
    const x = 60 + rand() * 860;
    const y = 470 + rand() * 70;
    rocks.push(circle(root, x, y, 8 + rand() * 26, { fill: 'rgba(36,52,60,0.9)' }));
  }
  const fish = [];
  for (let i = 0; i < 12; i += 1) {
    fish.push(item());
  }
  function item() {
    const g = group(root, {});
    pathEl(g, 'M-9 0 q6 -6 14 0 q-8 6 -14 0 z', { fill: 'rgba(150,220,250,0.55)' });
    poly(g, [[-9, 0], [-16, -5], [-16, 5]], { fill: 'rgba(150,220,250,0.45)' });
    return g;
  }
  const waves = [];
  for (let i = 0; i < 4; i += 1) {
    waves.push(circle(root, 300, 176, 10, { fill: 'none', stroke: alpha(tone, 0.55), 'stroke-width': 1.4 }));
  }
  const beam = line(root, 300, 176, 300, 500, { stroke: alpha(tone, 0.25), 'stroke-width': 1.4, 'stroke-dasharray': '6 8' });
  const depthLabel = readout(root, 700, 96, '回波时间', tone);
  const depthVal = readout(root, 700, 162, '水深', tone);
  const note = textEl(root, '', { x: 700, y: 256, 'font-size': 12.5, 'font-family': SANS, fill: 'rgba(190,212,238,0.7)' });
  return {
    defaults: { depth: 0.5, pulse: 0.4 },
    render(s, t) {
      const depth = clamp(s.depth, 0.1, 1);
      const bottom = lerp(300, 560, depth);
      seabed.setAttribute('transform', `translate(0 ${bottom - 520})`);
      rocks.forEach((r) => r.setAttribute('transform', `translate(0 ${bottom - 520})`));
      const speed = 300;
      waves.forEach((w, i) => {
        const u = (t * 0.9 + i * 0.25) % 1;
        w.setAttribute('r', String(10 + u * 260));
        w.setAttribute('opacity', (1 - u) * 0.5 * s.pulse);
      });
      beam.setAttribute('y2', bottom);
      fish.forEach((g, i) => {
        const y = 260 + ((i * 37) % 240) * depth;
        const x = ((t * (18 + (i % 4) * 8) + i * 83) % (W + 80)) - 40;
        g.setAttribute('transform', `translate(${x} ${y}) scale(${(i % 3) * 0.2 + 0.7})`);
        g.setAttribute('opacity', 0.5);
      });
      depthLabel.value.textContent = `${((bottom - 176) * 0.018).toFixed(2)} s`;
      depthVal.value.textContent = `${Math.round((bottom - 176) * 2.6)} m`;
      note.textContent = '声波在水里比在空气里快 4 倍多，来回一趟就是水深';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* -------------------------------- pressure -------------------------------- */
function buildPressure(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#071019', '#03070b');
  const gauge = group(root, { transform: 'translate(280 300)' });
  circle(gauge, 0, 0, 128, { fill: 'rgba(8,16,26,0.9)', stroke: 'rgba(150,190,235,0.35)', 'stroke-width': 2 });
  for (let i = 0; i <= 20; i += 1) {
    const a = Math.PI * (0.75 + (i / 20) * 1.5);
    line(gauge, Math.cos(a) * 104, Math.sin(a) * 104, Math.cos(a) * 118, Math.sin(a) * 118, {
      stroke: 'rgba(170,200,235,0.45)', 'stroke-width': i % 5 === 0 ? 2 : 1,
    });
  }
  const needle = line(gauge, 0, 0, 0, -104, { stroke: '#FF8E6B', 'stroke-width': 3, 'stroke-linecap': 'round' });
  textEl(gauge, 'hPa', { x: 0, y: 42, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: 'rgba(180,205,235,0.6)' });
  const pressureVal = textEl(gauge, '', { x: 0, y: 78, 'text-anchor': 'middle', 'font-size': 26, 'font-family': MONO, fill: '#eaf4ff' });

  const tank = group(root, { transform: 'translate(690 260)' });
  rect(tank, -140, -100, 280, 320, { rx: 16, fill: 'rgba(20,60,86,0.5)', stroke: 'rgba(130,200,240,0.4)' });
  const surface = line(tank, -140, -80, 140, -80, { stroke: 'rgba(160,225,255,0.6)', 'stroke-width': 2 });
  const oxy = [];
  for (let i = 0; i < 34; i += 1) {
    oxy.push(circle(tank, 0, 0, 2.6, { fill: 'rgba(150,235,255,0.8)' }));
  }
  const fish = [];
  for (let i = 0; i < 5; i += 1) {
    const g = group(tank, {});
    pathEl(g, 'M-11 0 q7 -7 17 0 q-9 7 -17 0 z', { fill: 'rgba(190,235,255,0.7)' });
    poly(g, [[-11, 0], [-19, -6], [-19, 6]], { fill: 'rgba(190,235,255,0.55)' });
    fish.push(g);
  }
  const rOxy = readout(root, 700, 100, '溶解氧', tone, 150);
  const note = textEl(root, '', { x: 500, y: 580, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { pressure: 0.6 },
    render(s, t) {
      const p = clamp(s.pressure, 0, 1);
      const hpa = lerp(985, 1035, p);
      const a = Math.PI * (0.75 + p * 1.5);
      needle.setAttribute('x2', Math.cos(a) * 104);
      needle.setAttribute('y2', Math.sin(a) * 104);
      pressureVal.textContent = String(Math.round(hpa));
      const oxyLevel = 0.35 + p * 0.65;
      oxy.forEach((o, i) => {
        const x = -128 + ((i * 53 + t * 20 * oxyLevel) % 256);
        const y = -70 + ((i * 37 + t * 12) % 270);
        o.setAttribute('cx', x);
        o.setAttribute('cy', y);
        o.setAttribute('opacity', oxyLevel * (0.4 + Math.sin(i + t) * 0.3));
      });
      fish.forEach((g2, i) => {
        const depth = 0.25 + (i / 5) * 0.6;
        const y = lerp(-40, 190, depth * (1.25 - oxyLevel * 0.6));
        const x = Math.sin(t * (0.5 + i * 0.16) + i) * 96;
        g2.setAttribute('transform', `translate(${x} ${y}) scale(${1 - i * 0.06})`);
        g2.setAttribute('opacity', 0.55 + oxyLevel * 0.35);
      });
      surface.setAttribute('y1', -80 + (1 - oxyLevel) * 6);
      surface.setAttribute('y2', -80 + (1 - oxyLevel) * 6);
      rOxy.value.textContent = `${(oxyLevel * 9 + 2).toFixed(1)} mg/L`;
      note.textContent = p < 0.4 ? '气压低 → 溶氧少 → 鱼上浮、不开口' : '气压高 → 溶氧足 → 鱼在底层觅食';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- induction --------------------------------- */
function buildInduction(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx);
  const coilX = 500;
  const coilY = 320;
  const coil = group(root, {});
  for (let i = 0; i < 7; i += 1) {
    svgEl('ellipse', {
      cx: coilX,
      cy: coilY - 60 + i * 20,
      rx: 92,
      ry: 16,
      fill: 'none',
      stroke: 'rgba(255,183,107,0.75)',
      'stroke-width': 4,
    }, coil);
  }
  const magnet = group(root, {});
  rect(magnet, -50, -26, 46, 52, { fill: '#4F9BFF' });
  rect(magnet, 4, -26, 46, 52, { fill: '#FF6B5C' });
  textEl(magnet, 'N', { x: -27, y: 8, 'text-anchor': 'middle', 'font-size': 18, 'font-family': MONO, fill: '#eaf4ff' });
  textEl(magnet, 'S', { x: 27, y: 8, 'text-anchor': 'middle', 'font-size': 18, 'font-family': MONO, fill: '#eaf4ff' });
  const field = [];
  for (let i = 0; i < 6; i += 1) {
    field.push(pathEl(root, '', { fill: 'none', stroke: 'rgba(120,180,255,0.22)', 'stroke-width': 1.4 }));
  }
  const current = [];
  for (let i = 0; i < 14; i += 1) {
    current.push(circle(root, 0, 0, 3.4, { fill: '#FFD98A', opacity: 0 }));
  }
  const meter = group(root, { transform: 'translate(838 470)' });
  circle(meter, 0, 0, 54, { fill: 'rgba(8,16,26,0.9)', stroke: 'rgba(150,190,235,0.35)' });
  const needle = line(meter, 0, 8, 0, -40, { stroke: '#FF8E6B', 'stroke-width': 2.4 });
  textEl(meter, 'A', { x: 0, y: 30, 'text-anchor': 'middle', 'font-size': 12, 'font-family': MONO, fill: 'rgba(180,205,235,0.6)' });
  const rSpeed = readout(root, 700, 96, '磁铁速度', tone);
  const rEmf = readout(root, 700, 162, '感应电动势', tone);
  const note = textEl(root, '', { x: 500, y: 592, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { speed: 0.6, direction: 1 },
    render(s, t) {
      const speed = clamp(s.speed, 0, 1);
      const phase = Math.sin(t * (0.6 + speed * 1.8)) * (140 + speed * 60);
      magnet.setAttribute('transform', `translate(${coilX - 210 + Math.abs(phase)} ${coilY})`);
      const emf = Math.abs(Math.cos(t * (0.6 + speed * 1.8))) * speed;
      needle.setAttribute('transform', `rotate(${lerp(-42, 42, emf)})`);
      field.forEach((p, i) => {
        const y = coilY - 70 + i * 26;
        p.setAttribute('d', `M${coilX - 150} ${y} q150 ${i % 2 ? -26 : 26} 300 0`);
        p.setAttribute('opacity', 0.2 + speed * 0.3);
      });
      current.forEach((c, i) => {
        const u = (t * (0.4 + speed) + i / current.length) % 1;
        const a = u * Math.PI * 2;
        c.setAttribute('cx', coilX + Math.cos(a) * 92);
        c.setAttribute('cy', coilY + Math.sin(a) * 62);
        c.setAttribute('opacity', emf * 0.9);
      });
      rSpeed.value.textContent = `${(speed * 4).toFixed(1)} m/s`;
      rEmf.value.textContent = `${(emf * 6).toFixed(2)} V`;
      note.textContent = '磁通量变化才有电流；磁铁停下，电流就消失';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* -------------------------------- dissolve -------------------------------- */
function buildDissolve(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#071019', '#03070b');
  const glass = group(root, { transform: 'translate(500 340)' });
  pathEl(glass, 'M-130 -120 l0 220 q0 30 30 30 l200 0 q30 0 30 -30 l0 -220', {
    fill: 'none', stroke: 'rgba(190,215,245,0.5)', 'stroke-width': 2.4,
  });
  const water = pathEl(glass, 'M-126 -80 l0 180 q0 26 26 26 l200 0 q26 0 26 -26 l0 -180 z', { fill: 'rgba(60,140,190,0.35)' });
  const cube = rect(glass, -34, 100, 68, 62, { rx: 6, fill: 'rgba(255,255,255,0.85)' });
  const grains = [];
  const rand = seeded(88);
  for (let i = 0; i < 70; i += 1) {
    grains.push(circle(root, 0, 0, 1.6 + rand() * 2, { fill: 'rgba(255,255,255,0.75)', opacity: 0 }));
  }
  const heatWaves = [];
  for (let i = 0; i < 5; i += 1) {
    heatWaves.push(pathEl(root, '', { fill: 'none', stroke: 'rgba(255,183,107,0.35)', 'stroke-width': 2 }));
  }
  const rTemp = readout(root, 700, 96, '水温', tone);
  const rConc = readout(root, 700, 162, '溶解程度', tone);
  const note = textEl(root, '', { x: 500, y: 592, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { temp: 0.4, dissolve: 0.2 },
    render(s, t) {
      const temp = clamp(s.temp);
      const d = clamp(s.dissolve);
      const size = lerp(68, 6, d);
      cube.setAttribute('width', String(size));
      cube.setAttribute('height', String(size * 0.92));
      cube.setAttribute('x', String(-size / 2));
      cube.setAttribute('y', String(150 - size * 0.92 + d * 24));
      cube.setAttribute('opacity', 1 - d * 0.75);
      grains.forEach((g2, i) => {
        const seed = rand;
        const speed = 12 + temp * 60;
        const x = 500 + Math.sin(i * 2.4 + t * (0.3 + temp * 0.8) * (i % 3 + 1)) * (30 + (i % 7) * 22) * (0.3 + d);
        const y = 420 + Math.cos(i * 1.7 + t * (0.2 + temp * 0.4)) * (40 + (i % 5) * 24) * (0.3 + d) - d * 40;
        g2.setAttribute('cx', x);
        g2.setAttribute('cy', y);
        g2.setAttribute('opacity', d * (0.25 + (i % 5) * 0.12));
        g2.setAttribute('r', String(1.4 + (i % 4) * 0.8 + temp));
      });
      heatWaves.forEach((p, i) => {
        const y = 300 + i * 26;
        p.setAttribute('d', `M${430 + i * 10} ${y} q30 ${-10 - temp * 12} 60 0 q30 ${10 + temp * 12} 60 0`);
        p.setAttribute('opacity', temp * 0.5 * (0.5 + Math.sin(t * 2 + i) * 0.3));
      });
      rTemp.value.textContent = `${Math.round(10 + temp * 80)} °C`;
      rConc.value.textContent = `${Math.round(d * 100)}%`;
      note.textContent = temp > 0.6 ? '水温越高，分子运动越快，糖散得越快' : '冷水里，糖沉在杯底慢慢化';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- wheel ---------------------------------- */
function buildWheel(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx);
  const cx = 430;
  const cy = 316;
  const R = 196;
  const segments = 12;
  const hues = [];
  const wedges = [];
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const hue = (i / segments) * 360;
    hues.push(hue);
    const p = [
      [cx, cy],
      [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R],
      [cx + Math.cos((a0 + a1) / 2) * R * 1.06, cy + Math.sin((a0 + a1) / 2) * R * 1.06],
      [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R],
    ];
    wedges.push(poly(root, p, { fill: `hsl(${hue} 78% 58%)`, opacity: 0.28 }));
  }
  const chords = [];
  const dots = [];
  for (let i = 0; i < 3; i += 1) {
    const g = group(root, {});
    dots.push({ g, dot: circle(g, 0, 0, 13, { fill: '#fff' }) });
    chords.push(line(root, cx, cy, cx, cy, { stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.4, 'stroke-dasharray': '4 6' }));
  }
  const centerLabel = textEl(root, '', { x: cx, y: cy + 6, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS, fill: 'rgba(12,18,28,0.85)' });
  const rHarmony = readout(root, 700, 100, '配色方案', tone);
  const swatches = [0, 1, 2].map((i) => rect(root, 700, 190 + i * 54, 176, 44, { rx: 8, fill: '#fff' }));
  const swatchLabels = [0, 1, 2].map((i) => textEl(root, '', { x: 712, y: 218 + i * 54, 'font-size': 12, 'font-family': MONO, fill: 'rgba(16,22,32,0.85)' }));
  const note = textEl(root, '', { x: 500, y: 582, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { base: 0.1, scheme: 1 },
    render(s, t) {
      const scheme = Math.round(clamp(s.scheme, 0, 2));
      const baseHue = clamp(s.base) * 360;
      const offsets = scheme === 0 ? [0, 0, 0] : scheme === 1 ? [0, 180, 0] : [0, 120, 240];
      const spread = scheme === 0 ? [0, 28, -28] : [0, 0, 0];
      wedges.forEach((w, i) => {
        const active = offsets.some((o, k) => Math.abs(((hues[i] - baseHue - o - spread[k]) % 360 + 360) % 360) < 18);
        w.setAttribute('opacity', active ? 1 : 0.22);
      });
      dots.forEach((item, i) => {
        const hue = (baseHue + offsets[i] + spread[i] + 360) % 360;
        const rad = (hue / 360) * Math.PI * 2;
        const x = cx + Math.cos(rad) * (R - 16);
        const y = cy + Math.sin(rad) * (R - 16);
        item.g.setAttribute('transform', `translate(${x} ${y})`);
        item.dot.setAttribute('fill', `hsl(${hue} 82% 60%)`);
        item.dot.setAttribute('r', String(13 + Math.sin(t * 2 + i) * 1.2));
        chords[i].setAttribute('x1', cx);
        chords[i].setAttribute('y1', cy);
        chords[i].setAttribute('x2', x);
        chords[i].setAttribute('y2', y);
        swatches[i].setAttribute('fill', `hsl(${hue} 82% 60%)`);
        swatchLabels[i].textContent = `H ${Math.round(hue)}`;
      });
      centerLabel.textContent = ['同色系', '互补色', '三分色'][scheme];
      rHarmony.value.textContent = ['SAME', 'COMPLEMENT', 'TRIAD'][scheme];
      note.textContent = scheme === 1 ? '色轮正对面：最强对比，也最难平衡' : scheme === 2 ? '三等分：三个主色，画面最活泼' : '同一色相，只改明度与饱和度';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- seasons --------------------------------- */
function buildSeasons(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#040814', '#02040a');
  const sun = circle(root, 500, 320, 34, { fill: '#FFD98A', opacity: 0.95 });
  const sunGlow = circle(root, 500, 320, 96, { fill: '#FFD98A', opacity: 0.12 });
  const orbit = svgEl('ellipse', { cx: 500, cy: 320, rx: 300, ry: 190, fill: 'none', stroke: 'rgba(150,190,235,0.18)', 'stroke-dasharray': '5 8' }, root);
  const earth = group(root, {});
  circle(earth, 0, 0, 22, { fill: '#4F9BFF' });
  pathEl(earth, 'M-8 -12 q10 6 6 14 q-8 8 -14 0 q-4 -10 8 -14 z', { fill: 'rgba(120,220,150,0.85)' });
  const axis = line(earth, 0, -44, 0, 44, { stroke: '#FFD98A', 'stroke-width': 2 });
  const equator = line(earth, -26, 0, 26, 0, { stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1 });
  const rayGroup = group(root, {});
  const rays = [];
  for (let i = 0; i < 5; i += 1) rays.push(line(rayGroup, 0, 0, 0, 0, { stroke: 'rgba(255,231,168,0.35)', 'stroke-width': 1.2 }));
  const rMonth = readout(root, 720, 96, '节气', tone);
  const rAngle = readout(root, 720, 162, '太阳直射点', tone);
  const note = textEl(root, '', { x: 500, y: 590, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  const months = ['春分', '夏至', '秋分', '冬至'];
  return {
    defaults: { month: 0.25, tilt: 0.55 },
    render(s, t) {
      const m = clamp(s.month);
      const a = m * Math.PI * 2 - Math.PI / 2;
      const x = 500 + Math.cos(a) * 300;
      const y = 320 + Math.sin(a) * 190;
      earth.setAttribute('transform', `translate(${x} ${y})`);
      axis.setAttribute('transform', `rotate(${23.5 * clamp(s.tilt)})`);
      equator.setAttribute('transform', `rotate(${23.5 * clamp(s.tilt)})`);
      const ra = Math.atan2(320 - y, 500 - x);
      rayGroup.setAttribute('transform', `translate(${x} ${y})`);
      rays.forEach((r, i) => {
        const off = (i - 2) * 14;
        const ex = Math.cos(ra) * 200 + Math.cos(ra + Math.PI / 2) * off;
        const ey = Math.sin(ra) * 200 + Math.sin(ra + Math.PI / 2) * off;
        r.setAttribute('x1', Math.cos(ra) * 22);
        r.setAttribute('y1', Math.sin(ra) * 22);
        r.setAttribute('x2', ex);
        r.setAttribute('y2', ey);
        r.setAttribute('opacity', 0.35);
      });
      const seasonIdx = Math.round(m * 3) % 4;
      const decl = Math.sin(a + Math.PI / 2) * 23.5;
      rMonth.value.textContent = months[seasonIdx];
      rAngle.value.textContent = `${decl > 0 ? '北纬' : '南纬'} ${Math.abs(decl).toFixed(1)}°`;
      note.textContent = Math.abs(decl) < 3 ? '直射赤道 → 昼夜等长' : decl > 0 ? '直射北半球 → 北半球夏季' : '直射南半球 → 北半球冬季';
      sun.setAttribute('r', String(34 + Math.sin(t * 1.4) * 2));
      sunGlow.setAttribute('r', String(96 + Math.sin(t * 1.4) * 6));
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- terrace --------------------------------- */
function buildTerrace(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx, '#08111a', '#04080d');
  const steps = 7;
  const bands = [];
  for (let i = 0; i < steps; i += 1) {
    bands.push(pathEl(root, '', { fill: 'rgba(60,90,60,0.28)', stroke: 'rgba(150,200,160,0.3)', 'stroke-width': 1 }));
  }
  const water = [];
  for (let i = 0; i < steps; i += 1) {
    water.push(pathEl(root, '', { fill: 'none', stroke: 'rgba(120,210,255,0.65)', 'stroke-width': 2 }));
  }
  const drops = [];
  for (let i = 0; i < 18; i += 1) drops.push(circle(root, 0, 0, 2.4, { fill: 'rgba(150,225,255,0.8)' }));
  const rLevel = readout(root, 720, 100, '水位', tone);
  const rFlow = readout(root, 720, 166, '流速', tone);
  const note = textEl(root, '', { x: 500, y: 590, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { level: 0.5, flow: 0.4 },
    render(s, t) {
      bands.forEach((b, i) => {
        const y = 180 + i * 52;
        const inset = i * 24;
        b.setAttribute('d', `M${80 + inset} ${y} L${920 - inset * 0.6} ${y - 16} L${920 - inset * 0.6} ${y + 22} L${80 + inset} ${y + 38} Z`);
        b.setAttribute('opacity', 0.55 + i * 0.05);
      });
      water.forEach((w, i) => {
        const y = 190 + i * 52;
        const inset = i * 24;
        const lift = clamp(s.level) * 6;
        w.setAttribute('d', `M${86 + inset} ${y + 6 - lift * (1 - i * 0.1)} L${912 - inset * 0.6} ${y - 10 - lift} `);
        w.setAttribute('opacity', 0.25 + clamp(s.level) * 0.6);
      });
      drops.forEach((d, i) => {
        const stepIdx = Math.floor(((t * (40 + s.flow * 160) + i * 40) % 400) / 52);
        const local = ((t * (40 + s.flow * 160) + i * 40) % 52) / 52;
        const y = 190 + stepIdx * 52 + local * 52;
        const x = 140 + ((i * 47 + t * (10 + s.flow * 60)) % 700);
        d.setAttribute('cx', x);
        d.setAttribute('cy', y);
        d.setAttribute('opacity', 0.3 + s.flow * 0.6);
      });
      rLevel.value.textContent = `${Math.round(20 + s.level * 60)} cm`;
      rFlow.value.textContent = `${(s.flow * 1.2).toFixed(2)} m³/s`;
      note.textContent = '每一层都拦住水，也拦住土；水从上一层流到下一层';
      fg.setAttribute('opacity', 1);
    },
  };
}

/* --------------------------------- bezier --------------------------------- */
function buildBezier(ctx) {
  const { root, fg, tone } = ctx;
  backdrop(ctx);
  const box = { x: 190, y: 110, w: 620, h: 400 };
  rect(root, box.x, box.y, box.w, box.h, { fill: 'rgba(10,17,29,0.6)', stroke: 'rgba(150,190,235,0.25)' });
  for (let i = 1; i < 4; i += 1) {
    line(root, box.x, box.y + (box.h * i) / 4, box.x + box.w, box.y + (box.h * i) / 4, { stroke: 'rgba(150,190,235,0.08)' });
    line(root, box.x + (box.w * i) / 4, box.y, box.x + (box.w * i) / 4, box.y + box.h, { stroke: 'rgba(150,190,235,0.08)' });
  }
  const curve = pathEl(root, '', {
    fill: 'none', stroke: tone, 'stroke-width': 3,
    style: `filter: drop-shadow(0 0 12px ${alpha(tone, 0.5)})`,
  });
  const handles = [0, 1].map(() => {
    const g = group(root, {});
    const h = line(g, 0, 0, 0, 0, { stroke: 'rgba(255,217,138,0.65)', 'stroke-width': 1.4, 'stroke-dasharray': '5 5' });
    const d = circle(g, 0, 0, 7, { fill: '#FFD98A' });
    return { g, h, d };
  });
  const p0 = circle(root, 0, 0, 6, { fill: '#fff' });
  const p3 = circle(root, 0, 0, 6, { fill: '#fff' });
  const progress = circle(root, 0, 0, 9, { fill: '#fffdf4', stroke: tone, 'stroke-width': 2 });
  const rEase = textEl(root, '', { x: 500, y: 560, 'text-anchor': 'middle', 'font-size': 14, 'font-family': MONO, fill: 'rgba(210,228,248,0.8)' });
  const note = textEl(root, '', { x: 500, y: 588, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(190,210,235,0.66)' });
  return {
    defaults: { p1: 0.42, p2: 0.58, sharp: 0.6 },
    render(s, t) {
      const x0 = box.x + 10;
      const y0 = box.y + box.h - 10;
      const x3 = box.x + box.w - 10;
      const y3 = box.y + 10;
      const sharp = clamp(s.sharp);
      const c1x = x0 + (x3 - x0) * lerp(0.15, 0.95, clamp(s.p1));
      const c1y = y0 - (y0 - y3) * lerp(0.1, 0.9, sharp);
      const c2x = x0 + (x3 - x0) * lerp(0.05, 0.85, clamp(s.p2));
      const c2y = y0 - (y0 - y3) * lerp(0.1, 0.95, 1 - sharp * 0.4);
      curve.setAttribute('d', `M${x0} ${y0} C${c1x} ${c1y} ${c2x} ${c2y} ${x3} ${y3}`);
      handles[0].d.setAttribute('cx', c1x);
      handles[0].d.setAttribute('cy', c1y);
      handles[0].h.setAttribute('x1', x0);
      handles[0].h.setAttribute('y1', y0);
      handles[0].h.setAttribute('x2', c1x);
      handles[0].h.setAttribute('y2', c1y);
      handles[1].d.setAttribute('cx', c2x);
      handles[1].d.setAttribute('cy', c2y);
      handles[1].h.setAttribute('x1', x3);
      handles[1].h.setAttribute('y1', y3);
      handles[1].h.setAttribute('x2', c2x);
      handles[1].h.setAttribute('y2', c2y);
      p0.setAttribute('cx', x0);
      p0.setAttribute('cy', y0);
      p3.setAttribute('cx', x3);
      p3.setAttribute('cy', y3);
      const u = (Math.sin(t * 0.9) * 0.5 + 0.5);
      const px = (1 - u) ** 3 * x0 + 3 * (1 - u) ** 2 * u * c1x + 3 * (1 - u) * u ** 2 * c2x + u ** 3 * x3;
      const py = (1 - u) ** 3 * y0 + 3 * (1 - u) ** 2 * u * c1y + 3 * (1 - u) * u ** 2 * c2y + u ** 3 * y3;
      progress.setAttribute('cx', px);
      progress.setAttribute('cy', py);
      rEase.textContent = `控制点 P1(${s.p1.toFixed(2)}) · P2(${s.p2.toFixed(2)})`;
      note.textContent = '拖控制点，曲线自己会让开；四个点决定一条最顺的路';
      fg.setAttribute('opacity', 1);
    },
  };
}

export const miscEngines = {
  space: buildSpace,
  ph: buildPh,
  sonar: buildSonar,
  pressure: buildPressure,
  induction: buildInduction,
  dissolve: buildDissolve,
  wheel: buildWheel,
  seasons: buildSeasons,
  terrace: buildTerrace,
  bezier: buildBezier,
};
