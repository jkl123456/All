/**
 * 系统引擎组：结构图、循环、地图、时间轴。
 * 用来讲程序、生态、地理与历史 —— 它们都不是一条公式，而是一张关系网。
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
  linearGradient(defs, 'sy-bg', [[0, top], [1, bottom]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  rect(bg, 0, 0, W, H, { fill: 'url(#sy-bg)' });
}

function waterLine(y, amp, phase, width = W) {
  let d = `M-40 ${y}`;
  for (let x = -40; x <= width + 40; x += 26) {
    d += ` Q ${x + 13} ${y + Math.sin(x * 0.02 + phase) * amp} ${x + 26} ${y + Math.sin((x + 26) * 0.014 + phase * 1.3) * amp * 0.7}`;
  }
  return d;
}

function chip(parent, x, y, w, h, text, color, options = {}) {
  const g = group(parent, {});
  rect(g, x, y, w, h, {
    rx: options.rx ?? 10,
    fill: options.fill ?? 'rgba(10,17,29,0.86)',
    stroke: alpha(color, options.strokeAlpha ?? 0.45),
    'stroke-width': options.strokeWidth ?? 1.2,
  });
  textEl(g, text, {
    x: x + w / 2,
    y: y + h / 2 + (options.dy ?? 5),
    'text-anchor': 'middle',
    'font-size': options.fontSize ?? 13,
    'font-family': options.mono ? MONO : SANS,
    fill: options.textColor ?? '#e6f1ff',
    'letter-spacing': options.spacing ?? 0.5,
  });
  return g;
}

function arrowHead(parent, x, y, angle, color, size = 9) {
  const g = group(parent, { transform: `translate(${x} ${y}) rotate(${(angle * 180) / Math.PI})` });
  poly(g, [[0, 0], [-size, -size * 0.55], [-size, size * 0.55]], { fill: color });
  return g;
}

/* ---------------------------------- graph ---------------------------------- */
function buildGraph(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'tree';

  if (mode === 'tree') {
    const nodes = [];
    const edges = [];
    const positions = [
      [500, 130], [330, 240], [670, 240], [250, 350], [410, 350], [590, 350], [750, 350],
      [200, 460], [300, 460], [370, 460], [450, 460], [540, 460], [640, 460], [700, 460], [800, 460],
    ];
    for (let i = 0; i < 15; i += 1) {
      const p = positions[i];
      const g = group(root, {});
      const c = circle(g, p[0], p[1], 26, { fill: 'rgba(10,18,30,0.9)', stroke: alpha(tone, 0.4), 'stroke-width': 1.6 });
      const t = textEl(g, '', { x: p[0], y: p[1] + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-family': MONO, fill: '#e8f2ff' });
      nodes.push({ g, c, t, x: p[0], y: p[1] });
    }
    for (let i = 1; i < 15; i += 1) {
      const child = positions[i];
      const parent = positions[Math.floor((i - 1) / 2)];
      edges.push(line(root, parent[0], parent[1] + 26, child[0], child[1] - 26, {
        stroke: alpha(tone, 0.22), 'stroke-width': 1.4,
      }));
    }
    const values = [50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 55, 65, 75, 90];
    const label = textEl(root, '', {
      x: 500, y: 552, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)',
    });
    const depthLabel = textEl(root, '', {
      x: 500, y: 96, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: alpha(tone, 0.8), 'letter-spacing': 3,
    });
    return {
      defaults: { step: 0.4 },
      render(s, t) {
        const step = clamp(s.step);
        const visible = Math.max(1, Math.round(step * 15));
        values.forEach((v, i) => {
          const node = nodes[i];
          node.t.textContent = String(v);
          const on = i < visible;
          node.g.setAttribute('opacity', on ? 1 : 0.12);
          const active = i === visible - 1;
          node.c.setAttribute('fill', active ? alpha(tone, 0.32) : 'rgba(10,18,30,0.9)');
          node.c.setAttribute('stroke', active ? '#FFD98A' : alpha(tone, 0.4));
          node.c.setAttribute('r', String(active ? 30 + Math.sin(t * 4) * 2 : 26));
        });
        edges.forEach((e, i) => {
          const on = i < Math.max(0, visible - 1);
          e.setAttribute('opacity', on ? 0.6 : 0.08);
        });
        label.textContent = '每个节点最多两个孩子，查找一次就砍掉一半';
        depthLabel.textContent = `层数 ${Math.max(1, Math.floor(Math.log2(visible)) + 1)} · 节点 ${visible}`;
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'network') {
    const layers = ['应用层', '传输层', '网络层', '链路层'];
    const boxes = layers.map((name, i) => {
      const y = 130 + i * 104;
      const g = group(root, {});
      rect(g, 330, y, 340, 68, { rx: 12, fill: 'rgba(10,18,30,0.85)', stroke: alpha(tone, 0.35) });
      textEl(g, name, { x: 500, y: y + 30, 'text-anchor': 'middle', 'font-size': 16, 'font-family': SANS, fill: '#e6f1ff' });
      textEl(g, spec.labels?.[i] || '', { x: 500, y: y + 51, 'text-anchor': 'middle', 'font-size': 11, 'font-family': MONO, fill: 'rgba(170,195,225,0.65)' });
      return g;
    });
    const packets = [];
    for (let i = 0; i < 5; i += 1) {
      const g = group(root, {});
      rect(g, -62, -11, 124, 22, { rx: 6, fill: alpha('#FFD98A', 0.92) });
      const t = textEl(g, '', { x: 0, y: 4, 'text-anchor': 'middle', 'font-size': 10, 'font-family': MONO, fill: '#2a1f0a', 'letter-spacing': 1 });
      packets.push({ g, t });
    }
    const label = textEl(root, '', { x: 500, y: 566, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.7)' });
    return {
      defaults: { flow: 0.4 },
      render(s, t) {
        const speed = 0.25 + clamp(s.flow) * 0.9;
        packets.forEach((p, i) => {
          const u = ((t * speed + i * 0.2) % 1);
          const y = 108 + u * 430;
          p.g.setAttribute('transform', `translate(500 ${y})`);
          p.g.setAttribute('opacity', 0.35 + Math.sin(u * Math.PI) * 0.65);
          p.t.textContent = ['GET /index.html', 'TCP :443', 'IP 10.0.0.7', 'ETH 帧', 'ACK'][i];
        });
        boxes.forEach((b, i) => {
          b.setAttribute('opacity', 0.55 + Math.abs(Math.sin(t * 0.8 + i)) * 0.45);
        });
        label.textContent = '每一层只关心自己的那一件事，加一层头，交给下一层';
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'hash') {
    const buckets = [];
    const cols = 8;
    for (let i = 0; i < cols; i += 1) {
      const x = 120 + i * 96;
      const g = group(root, {});
      rect(g, x, 158, 78, 292, { rx: 10, fill: 'rgba(10,17,29,0.7)', stroke: alpha(tone, 0.22) });
      textEl(g, String(i), { x: x + 39, y: 144, 'text-anchor': 'middle', 'font-size': 12, 'font-family': MONO, fill: 'rgba(170,195,225,0.7)' });
      buckets.push({ g, x });
    }
    const keys = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((k) => {
      const g = group(root, {});
      rect(g, 0, 0, 70, 28, { rx: 6, fill: alpha('#FFD98A', 0.2), stroke: '#FFD98A' });
      textEl(g, k, { x: 35, y: 19, 'text-anchor': 'middle', 'font-size': 12, 'font-family': MONO, fill: '#ffe9bd' });
      return { g, key: k };
    });
    const label = textEl(root, '', { x: 500, y: 118, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
    const collide = textEl(root, '', { x: 500, y: 92, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: '#FF9E7A' });
    return {
      defaults: { fill: 0.6 },
      render(s) {
        const n = Math.round(clamp(s.fill) * keys.length);
        const slots = {};
        let collisions = 0;
        keys.forEach((item, i) => {
          const h = [...item.key].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 7);
          const idx = h % cols;
          slots[idx] = (slots[idx] || 0) + 1;
          if (slots[idx] > 1) collisions += 1;
          const x = buckets[idx].x;
          const y = 178 + (slots[idx] - 1) * 40;
          const on = i < n;
          item.g.setAttribute('opacity', on ? 1 : 0);
          item.g.setAttribute('transform', `translate(${x + 4} ${y})`);
          item.g.setAttribute('stroke-width', on ? 1 : 0);
        });
        label.textContent = 'index = hash(key) mod 8 —— 冲突就挂在同一个桶里';
        collide.textContent = collisions > 0 ? `发生 ${collisions} 次冲突，链地址法兜住` : '没有冲突';
        collide.setAttribute('opacity', n > 3 ? 0.9 : 0);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'lock') {
    const t1 = chip(root, 170, 130, 240, 62, '线程 A · 取 100 元', tone, { mono: false, fontSize: 14 });
    const t2 = chip(root, 590, 130, 240, 62, '线程 B · 取 100 元', tone, { fontSize: 14 });
    const steps = [];
    for (let i = 0; i < 4; i += 1) {
      steps.push(textEl(root, '', { x: 500, y: 0, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: 'rgba(220,234,252,0.85)' }));
    }
    const balance = textEl(root, '¥ 100', { x: 500, y: 470, 'text-anchor': 'middle', 'font-size': 46, 'font-family': MONO, fill: '#eaf4ff' });
    const lockBox = group(root, { transform: 'translate(420 220)' });
    rect(lockBox, 0, 0, 160, 54, { rx: 10, fill: 'rgba(10,17,29,0.9)', stroke: alpha('#FFD98A', 0.7) });
    textEl(lockBox, '互斥锁', { x: 80, y: 34, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: '#ffe9bd' });
    const verdict = textEl(root, '', { x: 500, y: 540, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: '#FF9E7A' });
    return {
      defaults: { locked: 0, phase: 0 },
      render(s, t) {
        const locked = clamp(s.locked);
        lockBox.setAttribute('opacity', 0.3 + locked * 0.7);
        lockBox.setAttribute('transform', `translate(420 ${lerp(260, 220, locked)})`);
        const order = ['A 读到 100', 'B 读到 100', 'A 写回 0', 'B 写回 0'];
        steps.forEach((node, i) => {
          node.setAttribute('x', i % 2 === 0 ? 290 : 710);
          node.setAttribute('y', 232 + Math.floor(i / 2) * 54);
          node.textContent = order[i];
          node.setAttribute('opacity', 0.35 + locked * 0.5);
        });
        balance.textContent = locked > 0.5 ? '¥ 0' : '¥ 0';
        verdict.textContent = locked > 0.6 ? '加锁之后：只有一个线程能进临界区，结果仍然正确' : '没有锁：两次取款，只扣了一次';
        verdict.setAttribute('fill', locked > 0.6 ? '#79E86B' : '#FF9E7A');
        t1.setAttribute('opacity', 0.75 + Math.sin(t * 2) * 0.1);
        t2.setAttribute('opacity', 0.75 + Math.cos(t * 2) * 0.1);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'compiler') {
    const stages = ['源码', '词法', '语法树', '优化', '目标码'];
    const boxes = stages.map((name, i) => {
      const x = 80 + i * 180;
      const g = group(root, {});
      rect(g, x, 140, 132, 56, { rx: 10, fill: 'rgba(10,18,30,0.85)', stroke: alpha(tone, 0.4) });
      textEl(g, name, { x: x + 66, y: 173, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: '#e6f1ff' });
      return g;
    });
    const src = textEl(root, 'a = b + c * 2', {
      x: 500, y: 96, 'text-anchor': 'middle', 'font-size': 20, 'font-family': MONO, fill: alpha(tone, 0.9),
    });
    const tokens = ['a', '=', 'b', '+', 'c', '*', '2'].map((tk, i) => chip(root, 100 + i * 76, 232, 62, 34, tk, '#FFD98A', { mono: true, fontSize: 15 }));
    const astNodes = [
      ['=', 500, 350],
      ['a', 400, 430],
      ['+', 600, 430],
      ['b', 540, 510],
      ['*', 660, 510],
      ['c', 630, 580],
      ['2', 700, 580],
    ].map(([label, x, y]) => {
      const g = group(root, { opacity: 0 });
      circle(g, x, y, 22, { fill: 'rgba(10,18,30,0.9)', stroke: alpha(tone, 0.5) });
      textEl(g, label, { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-family': MONO, fill: '#eaf4ff' });
      return g;
    });
    const astEdges = [[0, 1], [0, 2], [2, 3], [2, 4], [4, 5], [4, 6]].map(([a, b]) => {
      const A = astNodes[a];
      const B = astNodes[b];
      return line(root, 500, 350, 500, 430, { stroke: alpha(tone, 0.25), 'stroke-width': 1.4, opacity: 0 });
    });
    const label = textEl(root, '', { x: 500, y: 596, 'text-anchor': 'middle', 'font-size': 13, 'font-family': SANS, fill: 'rgba(200,218,242,0.7)' });
    return {
      defaults: { stage: 0.3 },
      render(s, t) {
        const stage = clamp(s.stage) * 4;
        boxes.forEach((b, i) => {
          const on = i <= stage;
          b.setAttribute('opacity', on ? 1 : 0.28);
        });
        tokens.forEach((tk, i) => {
          tk.setAttribute('opacity', stage >= 1 || i < stage * 8 ? 1 : 0.15);
        });
        const astOn = clamp((stage - 1.4) * 2);
        astNodes.forEach((g) => g.setAttribute('opacity', astOn));
        astEdges.forEach((l, i) => {
          const A = [[500, 350], [500, 350], [600, 430], [600, 430], [660, 510], [660, 510]][i];
          const B = [[400, 430], [600, 430], [540, 510], [660, 510], [630, 580], [700, 580]][i];
          l.setAttribute('x1', A[0]); l.setAttribute('y1', A[1] + 22);
          l.setAttribute('x2', B[0]); l.setAttribute('y2', B[1] - 22);
          l.setAttribute('opacity', astOn * 0.5);
        });
        label.textContent = stage > 2.4 ? '先算乘法，再算加法 —— 优先级是树的结构，不是书写顺序' : '词法 → 语法 → 语义 → 优化 → 代码生成';
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // hanoi
  const pegs = [170, 500, 830];
  const disks = [];
  for (let i = 0; i < 6; i += 1) {
    disks.push(rect(root, 0, 0, 10, 22, { rx: 6, fill: alpha(tone, 0.25 + i * 0.1), stroke: alpha(tone, 0.7) }));
  }
  pegs.forEach((x) => {
    rect(root, x - 5, 230, 10, 260, { fill: 'rgba(150,190,235,0.25)' });
    rect(root, x - 120, 492, 240, 12, { rx: 6, fill: 'rgba(150,190,235,0.2)' });
  });
  const rN = textEl(root, '', { x: 500, y: 108, 'text-anchor': 'middle', 'font-size': 15, 'font-family': MONO, fill: alpha(tone, 0.85) });
  const rMoves = textEl(root, '', { x: 500, y: 566, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
  return {
    defaults: { n: 3, progress: 0.5 },
    render(s, t) {
      const n = Math.round(clamp(s.n, 1, 6));
      const total = 2 ** n - 1;
      const step = clamp(s.progress) * Math.min(total, 63);
      // 简化演示：按解的正确分布，把前 k 个盘子分配到柱子上
      const frame = Math.floor(step) % 63;
      const state = [[], [], []];
      for (let i = n; i >= 1; i -= 1) state[0].push(i);
      const moves = [];
      const hanoi = (k, a, b, c) => {
        if (k === 0) return;
        hanoi(k - 1, a, c, b);
        moves.push([a, c]);
        hanoi(k - 1, b, a, c);
      };
      hanoi(n, 0, 1, 2);
      const applied = Math.min(frame, moves.length);
      for (let i = 0; i < applied; i += 1) {
        const [from, to] = moves[i];
        const disk = state[from].pop();
        if (disk !== undefined) state[to].push(disk);
      }
      const visible = disks.slice(0, n);
      visible.forEach((d, i) => {
        const disk = i + 1;
        const peg = state.findIndex((p) => p.includes(disk));
        const stack = state[peg] || [];
        const height = stack.indexOf(disk);
        const w = 70 + disk * 34;
        d.setAttribute('width', w);
        d.setAttribute('height', 22);
        d.setAttribute('x', pegs[peg] - w / 2);
        d.setAttribute('y', 470 - height * 24 + Math.sin(t * 2 + disk) * 0.6);
        d.setAttribute('opacity', 1);
      });
      disks.slice(n).forEach((d) => d.setAttribute('opacity', 0));
      rN.textContent = `${n} 个盘子 · 最少 ${total} 步`;
      rMoves.textContent = applied >= moves.length ? '把 n-1 个先挪走，再挪最大的，最后把 n-1 个挪回来' : `当前第 ${applied} 步`;
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ---------------------------------- cycle ---------------------------------- */
function buildCycle(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const nodes = (spec.nodes || []).map((item) => (typeof item === 'string' ? { label: item } : item));
  const cx = 500;
  const cy = 316;
  const R = 186;
  const made = nodes.map((node, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const g = group(root, {});
    circle(g, x, y, 58, { fill: 'rgba(10,18,30,0.86)', stroke: alpha(node.color || tone, 0.45), 'stroke-width': 1.6 });
    textEl(g, node.label, { x, y: y + 6, 'text-anchor': 'middle', 'font-size': node.label.length > 3 ? 13 : 17, 'font-family': SANS, fill: '#e9f2ff' });
    if (node.sub) {
      textEl(g, node.sub, { x, y: y + 26, 'text-anchor': 'middle', 'font-size': 10, 'font-family': MONO, fill: 'rgba(170,195,225,0.65)' });
    }
    return { g, x, y };
  });
  const arrows = made.map((node, i) => {
    const next = made[(i + 1) % made.length];
    const mx = (node.x + next.x) / 2;
    const my = (node.y + next.y) / 2;
    const ctrlX = cx + (mx - cx) * 1.22;
    const ctrlY = cy + (my - cy) * 1.22;
    const a1 = Math.atan2(ctrlY - node.y, ctrlX - node.x);
    const a2 = Math.atan2(next.y - ctrlY, next.x - ctrlX);
    const sx = node.x + Math.cos(a1) * 60;
    const sy = node.y + Math.sin(a1) * 60;
    const ex = next.x - Math.cos(a2) * 64;
    const ey = next.y - Math.sin(a2) * 64;
    const line = pathEl(root, `M${sx} ${sy} Q${ctrlX} ${ctrlY} ${ex} ${ey}`, {
      fill: 'none', stroke: alpha(tone, 0.34), 'stroke-width': 1.6,
    });
    const head = poly(root, [
      [ex, ey],
      [ex - 10 * Math.cos(a2 - 0.42), ey - 10 * Math.sin(a2 - 0.42)],
      [ex - 10 * Math.cos(a2 + 0.42), ey - 10 * Math.sin(a2 + 0.42)],
    ], { fill: alpha(tone, 0.55) });
    return { line, head };
  });
  const particles = [];
  for (let i = 0; i < nodes.length * 2; i += 1) {
    particles.push(circle(root, 0, 0, 3.6, { fill: alpha('#FFD98A', 0.9) }));
  }
  const centerLabel = textEl(root, spec.center || '', {
    x: cx, y: cy + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: 'rgba(220,236,255,0.75)', 'letter-spacing': 2,
  });
  const explain = textEl(root, '', { x: 500, y: 584, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.7)' });

  return {
    defaults: { focus: 0, speed: 0.4 },
    render(s, t) {
      const focus = Math.round(clamp(s.focus, 0, nodes.length - 1));
      made.forEach((node, i) => {
        const on = i === focus;
        node.g.setAttribute('opacity', on ? 1 : 0.66);
        node.g.setAttribute('transform', `translate(0 ${on ? Math.sin(t * 2.4) * 2 : 0})`);
        node.g.firstChild.setAttribute('stroke', on ? alpha(tone, 0.95) : alpha(tone, 0.3));
        node.g.firstChild.setAttribute('stroke-width', on ? 2.6 : 1.4);
      });
      arrows.forEach((a, i) => {
        a.line.setAttribute('opacity', i === focus ? 1 : 0.48);
        a.line.setAttribute('stroke-width', i === focus ? 2.4 : 1.4);
        a.line.setAttribute('stroke', i === focus ? alpha(tone, 0.9) : alpha(tone, 0.3));
        a.head.setAttribute('opacity', i === focus ? 1 : 0.42);
      });
      particles.forEach((p, i) => {
        const seg = i % nodes.length;
        const u = (t * clamp(s.speed) + i / particles.length) % 1;
        const from = made[seg];
        const to = made[(seg + 1) % made.length];
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const ctrlX = cx + (mx - cx) * 1.18;
        const ctrlY = cy + (my - cy) * 1.18;
        const x = (1 - u) ** 2 * from.x + 2 * (1 - u) * u * ctrlX + u ** 2 * to.x;
        const y = (1 - u) ** 2 * from.y + 2 * (1 - u) * u * ctrlY + u ** 2 * to.y;
        p.setAttribute('cx', x);
        p.setAttribute('cy', y);
        p.setAttribute('opacity', 0.25 + Math.sin(u * Math.PI) * 0.6);
      });
      explain.textContent = spec.notes?.[focus] || '';
      centerLabel.setAttribute('opacity', 0.8);
      fg.setAttribute('opacity', 1);
    },
  };
}

/* ----------------------------------- map ----------------------------------- */
function buildMap(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx, '#060d16', '#03070c');
  const mode = spec.mode || 'terrain';

  /* ------------------------------ 共用：制图底纹 ------------------------------ */
  const chart = group(root, { opacity: 0.55 });
  for (let x = 60; x < W; x += 96) {
    line(chart, x, 60, x, H - 40, { stroke: 'rgba(120,170,220,0.05)', 'stroke-width': 1 });
  }
  for (let y = 80; y < H - 40; y += 74) {
    line(chart, 30, y, W - 30, y, { stroke: 'rgba(120,170,220,0.05)', 'stroke-width': 1 });
  }
  // 抽象陆块
  pathEl(chart, 'M-40 420 q140 -90 300 -40 q120 40 190 -20 q90 -70 220 -10 q120 60 70 160 q-60 110 -300 96 q-240 -14 -330 24 q-90 38 -150 -50 z', {
    fill: 'rgba(90,130,150,0.07)', stroke: 'rgba(130,180,210,0.12)', 'stroke-width': 1,
  });
  // 罗盘
  const compass = group(root, { transform: 'translate(846 108)', opacity: 0.45 });
  circle(compass, 0, 0, 26, { fill: 'none', stroke: 'rgba(150,195,230,0.3)' });
  poly(compass, [[0, -22], [6, 0], [0, 22], [-6, 0]], { fill: alpha(tone, 0.7) });
  poly(compass, [[-22, 0], [0, 5], [22, 0], [0, -5]], { fill: 'rgba(150,195,230,0.22)' });
  textEl(compass, 'N', { x: 0, y: -32, 'text-anchor': 'middle', 'font-size': 9, 'font-family': MONO, fill: 'rgba(170,205,235,0.7)' });

  /* --------------------------------- 板块 --------------------------------- */
  if (mode === 'plates') {
    const left = group(root, {});
    const right = group(root, {});
    pathEl(left, 'M-40 70 L370 118 L402 300 L336 540 L-40 580 Z', { fill: 'rgba(90,130,110,0.3)', stroke: 'rgba(150,200,175,0.4)', 'stroke-width': 1.4 });
    pathEl(right, 'M1040 50 L636 108 L596 300 L660 540 L1040 580 Z', { fill: 'rgba(120,110,150,0.28)', stroke: 'rgba(180,168,225,0.4)', 'stroke-width': 1.4 });
    for (let i = 0; i < 9; i += 1) {
      line(left, 40 + i * 40, 150 + i * 8, 60 + i * 40, 520 - i * 6, { stroke: 'rgba(150,200,175,0.08)' });
      line(right, 960 - i * 40, 140 + i * 8, 940 - i * 40, 520 - i * 6, { stroke: 'rgba(180,168,225,0.08)' });
    }
    const mantle = pathEl(root, '', { fill: 'none', stroke: '#FF8E6B', 'stroke-width': 3, opacity: 0.75 });
    const arrowL = pathEl(root, '', { fill: 'none', stroke: '#6BE7FF', 'stroke-width': 3, 'stroke-linecap': 'round' });
    const arrowR = pathEl(root, '', { fill: 'none', stroke: '#6BE7FF', 'stroke-width': 3, 'stroke-linecap': 'round' });
    const headL = poly(root, [[0, 0], [0, 0], [0, 0]], { fill: '#6BE7FF' });
    const headR = poly(root, [[0, 0], [0, 0], [0, 0]], { fill: '#6BE7FF' });
    const ridge = pathEl(root, '', { fill: 'none', stroke: 'rgba(255,217,138,0.7)', 'stroke-width': 2, 'stroke-linecap': 'round' });
    const labels = [
      textEl(root, '板块 A', { x: 180, y: 300, 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,230,220,0.78)' }),
      textEl(root, '板块 B', { x: 820, y: 300, 'font-size': 14, 'font-family': SANS, fill: 'rgba(220,210,245,0.8)' }),
      textEl(root, '俯冲带', { x: 500, y: 566, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': SANS, fill: 'rgba(255,160,120,0.85)' }),
      textEl(root, '海沟', { x: 500, y: 210, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': SANS, fill: 'rgba(150,215,255,0.8)' }),
    ];
    const rSpeed = textEl(root, '', { x: 500, y: 92, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: alpha(tone, 0.85) });
    const note = textEl(root, '', { x: 500, y: 592, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
    return {
      defaults: { move: 0.5, subduct: 0.3 },
      render(s, t) {
        const m = clamp(s.move) * 52;
        left.setAttribute('transform', `translate(${m} 0)`);
        right.setAttribute('transform', `translate(${-m} 0)`);
        const depth = clamp(s.subduct) * 130;
        mantle.setAttribute('d', `M${468 + m} 470 Q520 ${520 + depth * 0.4} ${520} ${566 + depth}`);
        arrowL.setAttribute('d', `M${268 + m} 356 l64 0`);
        arrowR.setAttribute('d', `M${732 - m} 356 l-64 0`);
        headL.setAttribute('points', `${332 + m},346 ${348 + m},356 ${332 + m},366`);
        headR.setAttribute('points', `${668 - m},346 ${652 - m},356 ${668 - m},366`);
        const ridgeH = 18 + clamp(s.subduct) * 54;
        ridge.setAttribute('d', `M${520 - 90} 470 Q${520 - 40} ${470 - ridgeH} ${520} 452 Q${520 + 24} ${470 - ridgeH * 0.7} ${520 + 70} 470`);
        rSpeed.textContent = `${(m / 4).toFixed(1)} cm / 年`;
        note.textContent = '密度大的板块俯冲下去，边缘隆起山脉、撕开海沟';
        labels.forEach((l) => l.setAttribute('opacity', 0.9));
        chart.setAttribute('opacity', 0.4);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  /* --------------------------------- 圈层 --------------------------------- */
  if (mode === 'layers') {
    const bands = [
      ['地壳', '#5a7f8f', '0–35 km'],
      ['上地幔', '#8a6a4a', '35–660 km'],
      ['下地幔', '#6d4a3a', '660–2900 km'],
      ['外核', '#c46a3a', '2900–5150 km'],
      ['内核', '#e8b06a', '5150–6371 km'],
    ];
    const made = bands.map(([name, color, depth], i) => {
      const y = 120 + i * 84;
      const g = group(root, {});
      rect(g, 240, y, 520, 82, { fill: alpha(color, 0.24), stroke: alpha(color, 0.45) });
      textEl(g, name, { x: 500, y: y + 36, 'text-anchor': 'middle', 'font-size': 16, 'font-family': SANS, fill: '#eef6ff' });
      textEl(g, depth, { x: 500, y: y + 58, 'text-anchor': 'middle', 'font-size': 10.5, 'font-family': MONO, fill: 'rgba(200,218,242,0.55)' });
      return g;
    });
    const rDepth = textEl(root, '', { x: 500, y: 96, 'text-anchor': 'middle', 'font-size': 12.5, 'font-family': MONO, fill: alpha(tone, 0.85) });
    const note = textEl(root, '', { x: 500, y: 588, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
    return {
      defaults: { focus: 0.2 },
      render(s, t) {
        const f = clamp(s.focus, 0, 1) * 4;
        made.forEach((g, i) => {
          const on = Math.abs(i - f) < 0.6;
          g.setAttribute('opacity', on ? 1 : 0.45);
          g.setAttribute('transform', `translate(${on ? Math.sin(t * 3) * 2 : 0} 0)`);
        });
        rDepth.textContent = bands[Math.min(4, Math.round(f))][2];
        note.textContent = '地震波速度在地幔与地核之间突变，圈层就是这样被「听」出来的';
        chart.setAttribute('opacity', 0.3);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  /* --------------------------------- 路线 --------------------------------- */
  if (mode === 'route') {
    const pts = spec.points || [];
    // 海陆剪影
    pathEl(root, 'M40 470 C 180 430, 260 500, 380 470 C 470 448, 540 470, 620 456 C 740 436, 840 470, 980 440 L980 600 L40 600 Z', {
      fill: 'rgba(56,78,66,0.32)', stroke: 'rgba(130,175,150,0.28)', 'stroke-width': 1.2,
    });
    pathEl(root, 'M20 236 C 120 196, 200 256, 300 222 C 400 188, 500 228, 600 202 C 700 176, 800 210, 980 182', {
      fill: 'none', stroke: 'rgba(120,170,200,0.12)', 'stroke-width': 1.4, 'stroke-dasharray': '3 7',
    });
    pathEl(root, 'M20 250 C 120 212, 200 272, 300 238 C 400 204, 500 244, 600 218 C 700 192, 800 226, 980 198', {
      fill: 'none', stroke: 'rgba(120,170,200,0.08)', 'stroke-width': 1.2, 'stroke-dasharray': '3 9',
    });
    const dashed = pathEl(root, '', { fill: 'none', stroke: alpha(tone, 0.2), 'stroke-width': 2, 'stroke-dasharray': '6 9' });
    const solid = pathEl(root, '', {
      fill: 'none', stroke: alpha(tone, 0.95), 'stroke-width': 2.6,
      style: `filter: drop-shadow(0 0 8px ${alpha(tone, 0.5)})`,
    });
    const markers = pts.map((p) => {
      const g = group(root, {});
      circle(g, 0, 0, 12, { fill: 'none', stroke: 'rgba(255,217,138,0.35)' });
      circle(g, 0, 0, 4.4, { fill: '#FFD98A' });
      textEl(g, p.name, { x: 0, y: -20, 'text-anchor': 'middle', 'font-size': 12, 'font-family': SANS, fill: 'rgba(238,246,255,0.9)' });
      return g;
    });
    const moverHalo = circle(root, 0, 0, 16, { fill: '#FFD98A', opacity: 0.16 });
    const mover = poly(root, [[0, -7], [9, 0], [0, 7], [-9, 0]], { fill: '#fffdf4', stroke: alpha(tone, 1), 'stroke-width': 1.4 });
    const note = textEl(root, '', { x: 500, y: 586, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(200,218,242,0.75)' });
    const counter = textEl(root, '', { x: 500, y: 96, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': MONO, fill: alpha(tone, 0.75), 'letter-spacing': 2 });

    return {
      defaults: { progress: 0.35 },
      render(s, t) {
        let d = '';
        pts.forEach((p, i) => {
          d += `${i ? 'L' : 'M'}${p.x} ${p.y} `;
        });
        dashed.setAttribute('d', d);
        const total = pts.length - 1;
        const prog = clamp(s.progress) * total;
        const idx = Math.min(total - 1, Math.floor(prog));
        const frac = prog - idx;
        const a = pts[idx];
        const b = pts[idx + 1] || pts[idx];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 26;
        let sd = `M${pts[0].x} ${pts[0].y} `;
        for (let i = 1; i <= idx; i += 1) sd += `L${pts[i].x} ${pts[i].y} `;
        const qx = (1 - frac) ** 2 * a.x + 2 * (1 - frac) * frac * mx + frac ** 2 * b.x;
        const qy = (1 - frac) ** 2 * a.y + 2 * (1 - frac) * frac * my + frac ** 2 * b.y;
        sd += `L${qx} ${qy}`;
        solid.setAttribute('d', sd);
        mover.setAttribute('transform', `translate(${qx} ${qy}) rotate(${Math.sin(t * 1.4) * 8})`);
        moverHalo.setAttribute('cx', qx);
        moverHalo.setAttribute('cy', qy);
        markers.forEach((g, i) => {
          const p = pts[i];
          g.setAttribute('transform', `translate(${p.x} ${p.y})`);
          g.setAttribute('opacity', i <= idx + 1 ? 1 : 0.32);
          g.firstChild.setAttribute('r', String(i === idx + 1 ? 14 + Math.sin(t * 3) * 2 : 12));
        });
        note.textContent = spec.notes?.[Math.min(spec.notes.length - 1, idx)] || '';
        counter.textContent = `第 ${Math.min(pts.length, idx + 2)} 站 / 共 ${pts.length} 站`;
        chart.setAttribute('opacity', 0.5);
        fg.setAttribute('opacity', 1);
      },
    };
  }

  /* --------------------------- 季风 / 喀斯特 · 剖面 --------------------------- */
  const isKarst = spec.variant === 'karst';
  linearGradient(ctx.defs, 'mp-sea', [
    [0, 'rgba(40,110,150,0.55)'],
    [1, 'rgba(10,40,60,0.7)'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 });

  const sea = rect(root, 0, 424, 560, H - 424, { fill: 'url(#mp-sea)' });
  const seaSurface = pathEl(root, '', { fill: 'none', stroke: 'rgba(140,215,255,0.5)', 'stroke-width': 1.6 });
  const land = pathEl(root, 'M470 620 L470 430 Q560 424 640 396 Q720 366 776 300 Q820 246 900 250 Q960 254 1000 300 L1000 620 Z', {
    fill: 'rgba(30,42,34,0.92)', stroke: 'rgba(140,180,140,0.28)', 'stroke-width': 1.2,
  });
  const landHi = pathEl(root, 'M640 396 Q720 366 776 300 Q820 246 900 250', {
    fill: 'none', stroke: 'rgba(180,220,170,0.3)', 'stroke-width': 1.4,
  });
  // 喀斯特：溶洞与石笋
  const cave = group(root, { opacity: 0 });
  pathEl(cave, 'M700 470 q20 -58 76 -58 q56 0 70 58 z', { fill: 'rgba(6,10,12,0.9)', stroke: 'rgba(150,190,170,0.35)' });
  for (let i = 0; i < 4; i += 1) {
    pathEl(cave, `M${716 + i * 22} ${428} l4 18 l4 -18`, { fill: 'none', stroke: 'rgba(190,220,200,0.5)', 'stroke-width': 2 });
    pathEl(cave, `M${722 + i * 22} 470 l4 -14 l4 14`, { fill: 'none', stroke: 'rgba(190,220,200,0.4)', 'stroke-width': 2 });
  }
  // 云
  const cloudBlur = svgEl('filter', { id: 'mp-cloud', x: '-40%', y: '-40%', width: '180%', height: '180%' }, ctx.defs);
  svgEl('feGaussianBlur', { stdDeviation: 11 }, cloudBlur);
  const clouds = [];
  for (let i = 0; i < 5; i += 1) {
    const g = group(root, { filter: 'url(#mp-cloud)' });
    for (let k = 0; k < 3; k += 1) {
      svgEl('ellipse', { cx: k * 42, cy: Math.sin(k * 1.4) * 10, rx: 46 + (k % 2) * 12, ry: 22, fill: 'rgba(176,204,228,0.26)' }, g);
    }
    clouds.push(g);
  }
  const arrows = [];
  const arrowHeads = [];
  for (let i = 0; i < 5; i += 1) {
    arrows.push(pathEl(root, '', { fill: 'none', stroke: alpha(tone, 0.75), 'stroke-width': 2, 'stroke-linecap': 'round' }));
    arrowHeads.push(poly(root, [[0, 0], [0, 0], [0, 0]], { fill: alpha(tone, 0.9) }));
  }
  const drops = [];
  for (let i = 0; i < 70; i += 1) {
    drops.push(line(root, 0, 0, 0, 0, { stroke: 'rgba(150,210,255,0.55)', 'stroke-width': 1.3 }));
  }
  const labels = [
    textEl(root, '海洋', { x: 366, y: 556, 'font-size': 13, 'font-family': SANS, fill: 'rgba(150,205,235,0.7)', 'letter-spacing': 4 }),
    textEl(root, '陆地', { x: 862, y: 556, 'font-size': 13, 'font-family': SANS, fill: 'rgba(180,215,170,0.7)', 'letter-spacing': 4 }),
    textEl(root, isKarst ? '石灰岩' : '山脉', { x: 796, y: 288, 'font-size': 12, 'font-family': SANS, fill: 'rgba(210,230,240,0.7)', 'letter-spacing': 3 }),
  ];
  const rWind = textEl(root, '', { x: 660, y: 92, 'font-size': 12.5, 'font-family': MONO, fill: alpha(tone, 0.85) });
  const rRain = textEl(root, '', { x: 716, y: 116, 'font-size': 12.5, 'font-family': MONO, fill: alpha(tone, 0.7) });
  const note = textEl(root, '', { x: 500, y: 592, 'text-anchor': 'middle', 'font-size': 13.5, 'font-family': SANS, fill: 'rgba(200,218,242,0.75)' });

  return {
    defaults: { wind: 0.35, rain: 0.2, lift: 0 },
    render(s, t) {
      const wind = clamp(s.wind);
      const rain = clamp(s.rain);
      seaSurface.setAttribute('d', waterLine(430, 3.4, t * 0.8, 620));
      arrows.forEach((p, i) => {
        const baseY = isKarst ? 470 + i * 8 : 330 + i * 24;
        const x0 = 60 + i * 26;
        const x1 = 470 + ((t * (26 + wind * 130) + i * 90) % 380);
        const len = 70 + wind * 90;
        const sx = x1 - len;
        const sy = baseY - (x1 - 470 > 0 ? (x1 - 470) * 0.12 : 0);
        const ey = baseY - 26 - (i % 2) * 12;
        p.setAttribute('d', `M${sx} ${sy} q${len * 0.55} ${-18 - wind * 26} ${len} ${-6}`);
        const ang = Math.atan2(-18 - wind * 26, len * 0.55);
        const hx = sx + len;
        const hy = sy - 6;
        arrowHeads[i].setAttribute('points', `${hx},${hy} ${hx - 11 * Math.cos(ang - 0.5)},${hy - 11 * Math.sin(ang - 0.5)} ${hx - 11 * Math.cos(ang + 0.5)},${hy - 11 * Math.sin(ang + 0.5)}`);
        p.setAttribute('opacity', 0.15 + wind * 0.75);
        arrowHeads[i].setAttribute('opacity', 0.15 + wind * 0.75);
        void ey;
      });
      drops.forEach((d, i) => {
        const x = 560 + ((i * 71 + t * (30 + wind * 180)) % 420);
        const y = 220 + ((i * 53 + t * (330 + wind * 200)) % 330);
        d.setAttribute('x1', x);
        d.setAttribute('y1', y);
        d.setAttribute('x2', x + 6 + wind * 16);
        d.setAttribute('y2', y + 20 + wind * 6);
        d.setAttribute('opacity', rain * (0.25 + (i % 5) * 0.12));
      });
      clouds.forEach((g, i) => {
        g.setAttribute('transform', `translate(${((t * (8 + wind * 34) + i * 190) % (W + 260)) - 130} ${180 + (i % 3) * 62})`);
        g.setAttribute('opacity', 0.45 + rain * 0.4);
      });
      cave.setAttribute('opacity', isKarst ? 1 : 0);
      rWind.textContent = isKarst ? `水流 ${Math.round(wind * 100)}%` : `风 ${Math.round(wind * 100)}%`;
      rRain.textContent = `降水 ${Math.round(rain * 100)}%`;
      note.textContent = spec.note || '';
      labels.forEach((l) => l.setAttribute('opacity', 0.85));
      chart.setAttribute('opacity', 0.25);
      sea.setAttribute('opacity', 1);
      land.setAttribute('opacity', 1);
      landHi.setAttribute('opacity', 1);
      fg.setAttribute('opacity', 1);
    },
  };
}

function buildTimeline(ctx) {
  const { root, fg, spec, tone } = ctx;
  backdrop(ctx);
  const mode = spec.mode || 'era';
  const axisY = 330;
  line(root, 90, axisY, 910, axisY, { stroke: 'rgba(150,185,230,0.35)', 'stroke-width': 1.6 });
  arrowHead(root, 916, axisY, 0, 'rgba(150,185,230,0.5)', 8);

  if (mode === 'tense') {
    const rows = spec.rows || [];
    const lanes = rows.map((row, i) => {
      const y = 170 + i * 96;
      line(root, 90, y, 910, y, { stroke: 'rgba(150,185,230,0.14)', 'stroke-width': 1, 'stroke-dasharray': '4 6' });
      const g = group(root, {});
      textEl(g, row.label, { x: 96, y: y - 12, 'font-size': 13, 'font-family': SANS, fill: 'rgba(190,210,238,0.72)' });
      const markers = (row.points || []).map((p) => {
        const mg = group(root, {});
        circle(mg, 0, y, 8, { fill: alpha(p.color || tone, 0.85) });
        textEl(mg, p.text, { x: 0, y: y + 28, 'text-anchor': 'middle', 'font-size': 12, 'font-family': SANS, fill: 'rgba(226,238,255,0.85)' });
        return { g: mg, x: p.x };
      });
      return { g, markers, y };
    });
    const cursor = line(root, 0, 120, 0, 520, { stroke: 'rgba(255,217,138,0.7)', 'stroke-width': 1.4 });
    const nowLabel = textEl(root, 'now', { 'font-size': 11, 'font-family': MONO, fill: '#FFD98A' });
    const note = textEl(root, '', { x: 500, y: 570, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: 'rgba(200,218,242,0.72)' });
    return {
      defaults: { cursor: 0.5 },
      render(s, t) {
        const cx = lerp(110, 900, clamp(s.cursor));
        cursor.setAttribute('x1', cx);
        cursor.setAttribute('x2', cx);
        nowLabel.setAttribute('x', cx - 12);
        nowLabel.setAttribute('y', 112);
        lanes.forEach((lane, li) => {
          lane.markers.forEach((m) => {
            m.g.setAttribute('transform', `translate(${m.x} ${0})`);
            const past = m.x <= cx;
            m.g.setAttribute('opacity', past ? 1 : 0.28);
          });
        });
        note.textContent = spec.note || '';
        fg.setAttribute('opacity', 1);
      },
    };
  }

  if (mode === 'press') {
    const stages = spec.stages || [];
    const boxes = stages.map((label, i) => {
      const x = 110 + i * 200;
      const g = group(root, {});
      rect(g, x, 240, 150, 92, { rx: 12, fill: 'rgba(10,18,30,0.85)', stroke: alpha(tone, 0.35) });
      textEl(g, String(i + 1), { x: x + 22, y: 272, 'font-size': 13, 'font-family': MONO, fill: alpha(tone, 0.9) });
      textEl(g, label, { x: x + 75, y: 298, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: '#e9f2ff' });
      return g;
    });
    const arrows = stages.slice(1).map((_, i) => line(root, 110 + i * 200 + 150, 286, 110 + (i + 1) * 200, 286, {
      stroke: alpha(tone, 0.3), 'stroke-width': 1.6, 'stroke-dasharray': '5 6',
    }));
    const note = textEl(root, '', { x: 500, y: 420, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: 'rgba(210,226,248,0.8)' });
    const sub = textEl(root, '', { x: 500, y: 452, 'text-anchor': 'middle', 'font-size': 13, 'font-family': MONO, fill: alpha(tone, 0.75) });
    return {
      defaults: { step: 0.3 },
      render(s) {
        const step = clamp(s.step) * stages.length;
        boxes.forEach((b, i) => {
          const on = i < step;
          b.setAttribute('opacity', on ? 1 : 0.3);
          b.setAttribute('transform', `translate(0 ${on ? 0 : 6})`);
        });
        arrows.forEach((a, i) => a.setAttribute('opacity', i + 1.5 < step ? 0.85 : 0.15));
        note.textContent = spec.notes?.[Math.min(stages.length - 1, Math.floor(step))] || '';
        sub.textContent = spec.formula || '';
        fg.setAttribute('opacity', 1);
      },
    };
  }

  // era
  const eras = spec.eras || [];
  const total = eras.reduce((n, e) => n + (e.span || 1), 0);
  const made = [];
  let acc = 0;
  eras.forEach((era) => {
    const w = ((era.span || 1) / total) * 800;
    const x = 100 + acc;
    const g = group(root, {});
    rect(g, x, 300, w - 4, 60, { rx: 8, fill: alpha(era.color || tone, 0.18), stroke: alpha(era.color || tone, 0.5) });
    textEl(g, era.name, { x: x + (w - 4) / 2, y: 336, 'text-anchor': 'middle', 'font-size': 14, 'font-family': SANS, fill: '#eaf4ff' });
    made.push({ g, x, w, era });
    acc += w;
  });
  const events = (spec.events || []).map((ev) => {
    const g = group(root, {});
    line(g, 0, 360, 0, 392, { stroke: alpha(tone, 0.6), 'stroke-width': 1.4 });
    circle(g, 0, 392, 5, { fill: '#FFD98A' });
    textEl(g, ev.year, { x: 0, y: 414, 'text-anchor': 'middle', 'font-size': 11, 'font-family': MONO, fill: 'rgba(255,217,138,0.9)' });
    textEl(g, ev.text, { x: 0, y: 434, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': SANS, fill: 'rgba(214,230,250,0.75)' });
    return { g, ev };
  });
  const note = textEl(root, '', { x: 500, y: 520, 'text-anchor': 'middle', 'font-size': 15, 'font-family': SANS, fill: 'rgba(210,226,248,0.8)' });

  return {
    defaults: { focus: 0.4 },
    render(s) {
      const f = clamp(s.focus) * 800 + 100;
      made.forEach((m) => {
        const on = f >= m.x && f <= m.x + m.w;
        m.g.setAttribute('opacity', on ? 1 : 0.55);
      });
      events.forEach((item) => {
        const x = item.ev.x;
        item.g.setAttribute('transform', `translate(${x} 0)`);
        item.g.setAttribute('opacity', x <= f + 20 ? 1 : 0.22);
      });
      note.textContent = spec.note || '';
      fg.setAttribute('opacity', 1);
    },
  };
}

let nextTick = 0;

export const systemEngines = {  graph: buildGraph,
  cycle: buildCycle,
  map: buildMap,
  timeline: buildTimeline,
};
