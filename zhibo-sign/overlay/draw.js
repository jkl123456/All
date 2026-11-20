/* 沙画笔迹播放器。
 *
 * 为什么不是"用粗线把笔画描一遍"：
 * 矢量粗线在任何分辨率下都是同样的实心色块，一眼就是电脑画的。沙子是有颗粒的，
 * 所以这里每往前推进一点，都同时做两件事——
 *   1) 用一条实心路径铺"沙芯"，保证字形结实、不会淡成一团雾；
 *   2) 在笔尖周围撒一把小颗粒，颜色和透明度都在抖动，边缘就毛掉了。
 * 颗粒会永久留在 #sand 图层上（沙子落下去不会自己消失），
 * #fx 只画会消失的东西：光晕、飞散的沙粒。
 *
 * 时间用 performance.now() 墙钟，而不是累加 dt：标签页被后台节流时 dt 会被卡到
 * 几十毫秒，累加会让 8 秒的动画写成好几分钟。
 */

// 墨绿笔迹的颗粒色（海报上原本「智纪元」就是这个色系：BGR 72,84,6 -> #06544a）
const SAND = ['#0d5f52', '#0a4f45', '#12705f', '#06544a', '#0f6455'];

// 画布坐标系。笔画模式固定 1000x420（后端给出的笔迹坐标），
// AI 笔迹模式按抠出来的框动态改成框的 2 倍（2 倍是为了在 1080 下面不发虚）。
let BOARD_W = 1000, BOARD_H = 420;

const sand = document.getElementById('sand');
const fx = document.getElementById('fx');
const sctx = sand.getContext('2d');
const fctx = fx.getContext('2d');
const penEl = document.getElementById('pen');
const shotEl = document.getElementById('shot');

let cur = null;          // 当前播放任务
let lastFrame = 0;
let rafId = 0;

/* ------------------------------------------------------------ 缩放适配 */
function fit() {
  const st = document.getElementById('stage');
  const k = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  st.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

/* ------------------------------------------------------------ 画布准备 */
function placeArt(box) {
  // box 是 1080x1920 播放坐标里的 [x0,y0,x1,y1]；不传就回到默认字位
  const b = box || [193, 851, 893, 1151];
  const el = document.getElementById('art');
  el.style.left = b[0] + 'px';
  el.style.top = b[1] + 'px';
  el.style.width = (b[2] - b[0]) + 'px';
  el.style.height = (b[3] - b[1]) + 'px';
  return b;
}

function setBoard(w, h, cssW, cssH) {
  BOARD_W = w;
  BOARD_H = h;
  [sand, fx].forEach(c => {
    c.width = w;
    c.height = h;
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
  });
}

function clearCanvas() {
  sctx.clearRect(0, 0, BOARD_W, BOARD_H);
  fctx.clearRect(0, 0, BOARD_W, BOARD_H);
}

// 板内坐标 -> #art 自己的 CSS 坐标。笔尖（.brush 的底边中点）就钉在这一点上。
//
// 注意别用 getBoundingClientRect 相减：那个拿到的是 stage 缩放之后的视觉像素，
// 而 left/top 是未缩放的 CSS 像素。窗口不是整 1080×1920 时（k≠1），位移会被放大
// 1/k 倍，笔尖就跑到字外面去了——OBS 改个分辨率就能看到。
// offsetLeft/offsetWidth 都是"没缩放过的布局值"，怎么缩放都对得上。
function penTo(x, y) {
  const sx = sand.offsetWidth / BOARD_W;
  const sy = sand.offsetHeight / BOARD_H;
  penEl.style.left = (sand.offsetLeft + x * sx) + 'px';
  penEl.style.top = (sand.offsetTop + y * sy) + 'px';
}

/* ------------------------------------------------------------ 沙子绘制 */
function grain(x, y, w, alpha, fast) {
  // 一颗沙：半径、颜色、透明度都抖一下，靠抖动骗过眼睛。
  // fast = 相对书写速度（0=慢，1=很快）：走得快 = 提笔 = 墨少、沙往外散，
  // 这就是书法里"飞白"的来源；慢的地方沙压得实。
  fast = fast || 0;
  const n = 3 + ((Math.random() * 3) | 0) + (fast > 0.55 ? 2 : 0);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spread = 1 + fast * 1.5;
    const rad = Math.pow(Math.random(), 0.6) * (w * 0.62 + 1.4) * spread;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad * 0.9;
    const r = 0.5 + Math.random() * Math.min(1.7, w * 0.24);
    sctx.globalAlpha = alpha * (0.18 + Math.random() * 0.5) * (1 - fast * 0.5);
    sctx.fillStyle = SAND[(Math.random() * SAND.length) | 0];
    sctx.beginPath();
    sctx.arc(px, py, r, 0, 6.2832);
    sctx.fill();
  }
  sctx.globalAlpha = 1;
}

function coreSegment(x0, y0, x1, y1, w, baseW) {
  // 沙芯：略窄于笔宽，边缘留给颗粒去毛化。
  // 粗细（w/baseW）同时决定浓淡：粗的地方墨压得实、细的地方淡淡地提过去，
  // 于是同一笔里面就有墨色层次，而不是一条均匀的色带。
  const r = Math.min(1.3, Math.max(0.5, w / (baseW || w || 1)));
  sctx.strokeStyle = `rgba(9,80,68,${(0.78 + 0.18 * r).toFixed(3)})`;
  sctx.lineWidth = Math.max(1.2, w * 0.78);
  sctx.lineCap = 'round';
  sctx.beginPath();
  sctx.moveTo(x0, y0);
  sctx.lineTo(x1, y1);
  sctx.stroke();
}

/* ------------------------------------------------------------ 路径准备 */
function buildPath(strokes, widths, wps) {
  const items = [];
  let total = 0;
  strokes.forEach((s, i) => {
    const w = (widths && widths[i]) || 5;
    const cum = [0];
    for (let k = 1; k < s.length; k++) {
      const dx = s[k][0] - s[k - 1][0], dy = s[k][1] - s[k - 1][1];
      cum.push(cum[k - 1] + Math.hypot(dx, dy));
    }
    const len = cum[cum.length - 1];
    // 逐点笔宽：后端给了 wps 就用它（一笔之内自带顿笔/收尖），
    // 没有就和点一一对齐不了，退回常数宽度——老 payload 照样能播。
    const wp = (wps && wps[i] && wps[i].length === s.length) ? wps[i] : null;
    items.push({ pts: s, cum, len, w, wp, start: total });
    total += len;
  });
  return { items, total: Math.max(1, total) };
}

function pointAt(item, d) {
  // 在一条折线上按弧长取点
  const { pts, cum } = item;
  if (d <= 0) return [pts[0][0], pts[0][1]];
  if (d >= item.len) { const p = pts[pts.length - 1]; return [p[0], p[1]]; }
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const seg = Math.max(1e-6, cum[hi] - cum[lo]);
  const t = (d - cum[lo]) / seg;
  return [
    pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t,
    pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t,
  ];
}

/* ------------------------------------------------------------ 成图背景 */
/* 豆包给的整张海报就是这块直播画面。写字的时候先藏起来（露出擦过字的底板），
 * 收笔那一刻再淡进来——框外像素和底板几乎一致，所以这一步在画面上是"看不见"的，
 * 只有中间的字从"正在写"变成"写好了"。 */
function showShot(url) {
  shotEl.style.transition = 'none';
  shotEl.classList.remove('on');
  shotEl.style.backgroundImage = url ? `url("${url}")` : 'none';
  void shotEl.offsetWidth;          // 强制回流，让 transition:none 立刻生效
  shotEl.style.transition = '';
}

function restoreShot(url) {
  if (!url) return;
  shotEl.style.transition = 'none';
  shotEl.style.backgroundImage = `url("${url}")`;
  shotEl.classList.add('on');
  void shotEl.offsetWidth;
  shotEl.style.transition = '';
  clearCanvas();
}

// 收笔之后的交接：铺成图 -> 等淡入结束 -> 把画布上的笔迹收掉
// 返回"成图完全显出来"要等多久（毫秒），没有成图可淡入就返回 0。
// 后端拿 done 之后才开始算停留时间，所以这个时间要一起报上去，
// 否则停留的 3 秒里有 1 秒还在淡入，截到的图是半透明的。
const SETTLE_DELAY = 200;   // 先让笔抬起来，再铺成图
const SETTLE_FADE = 700;    // 和 style.css 里 .shot 的 transition: opacity .7s 对齐
const SETTLE_CLEAR = 780;   // 淡入彻底结束之后再擦画布，早一帧会闪

function settle() {
  if (!shotEl.style.backgroundImage || shotEl.style.backgroundImage === 'none') return 0;
  setTimeout(() => {
    shotEl.classList.add('on');
    setTimeout(() => {
      if (cur && cur.done) clearCanvas();
    }, SETTLE_CLEAR);
  }, SETTLE_DELAY);
  return SETTLE_DELAY + SETTLE_FADE;
}

/* ------------------------------------------------------------ 播放 */
function startStrokes(payload) {
  cancel();
  showShot("");          // 本地兜底：回到擦干净的底板，别留着上一个人的字
  placeArt(null);
  setBoard(1000, 420, 700, 300);
  clearCanvas();
  const path = buildPath(payload.strokes || [], payload.widths || [],
                         payload.wps || []);
  const duration = Math.max(600, payload.duration_ms || 8000);
  // 整幅字的平均行笔速度（像素/毫秒），给 drawRange 判断"这一帧算不算快"用
  path.avg = path.total / duration;
  cur = {
    mode: 'strokes', path, drawn: 0, total: path.total,
    duration, t0: 0, done: false,
  };
  penEl.classList.add('on');
  penEl.style.setProperty('--s', '1');
  penEl.style.setProperty('--lift', '0');
  const p0 = pointAt(path.items[0], 0);
  penTo(p0[0], p0[1]);
  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
}

function loop(now) {
  if (!cur) return;
  if (!cur.t0) cur.t0 = now;
  const dt = Math.min(80, now - lastFrame) / 1000;
  lastFrame = now;

  if (cur.mode === 'strokes') {
    const progress = Math.min(1, (now - cur.t0) / cur.duration);
    const target = cur.total * progress;
    drawRange(cur.drawn, target, cur.path, dt);
    cur.drawn = target;
    const [tx, ty] = pointAt(cur.path.items[cur.path.items.length - 1], 0);
    const at = pointAtByGlobal(cur.path, target) || [tx, ty];
    penTo(at[0], at[1]);
    if (progress >= 1 && !cur.done) {
      cur.done = true;
      stopVoice();                 // 写完就闭嘴，剩下的展示时间留给画面
      hideBless(1600);             // 字幕多留一会儿，截图上带着这句祝福
      // 收笔：把笔提起来
      setTimeout(() => penEl.classList.remove('on'), 260);
      report();
    }
  } else if (cur.mode === 'reveal') {
    const progress = Math.min(1, (now - cur.t0) / cur.duration);
    revealTo(progress);
    if (progress >= 1 && !cur.done) {
      cur.done = true;
      stopVoice();
      hideBless(1600);
      penEl.classList.remove('on');
      report();
    }
  } else if (cur.mode === 'ink') {
    const elapsed = now - cur.t0;
    inkFrame(elapsed);
    if (elapsed >= cur.total && !cur.done) {
      cur.done = true;
      stopVoice();
      hideBless(1600);
      setTimeout(() => penEl.classList.remove('on'), 200);
      // 等成图淡入完成再报 done：后端的 hold_seconds 从这一刻开始算，
      // 所以停留的那几秒里画面已经是完整的成图，随时可以截图。
      report(settle() + 80);
    }
  }

  if (!cur.done) rafId = requestAnimationFrame(loop);
}

function pointAtByGlobal(path, d) {
  for (const it of path.items) {
    if (d >= it.start && d <= it.start + it.len) return pointAt(it, d - it.start);
  }
  return null;
}

function drawRange(from, to, path, dt) {
  if (to <= from) return;
  // 这一帧的行笔速度（画布像素/毫秒），再跟整幅字的平均速度比——"快"是相对的：
  // 收尾那一甩比横画快得多，那一段就该带飞白。用绝对值会随名字长短漂。
  const speed = (to - from) / Math.max(0.5, dt * 1000);
  const fast = Math.max(0, Math.min(1, (speed / Math.max(0.05, path.avg || 0.45)
                                        - 0.9) * 0.9));
  const STEP = 5;
  for (const it of path.items) {
    const a = it.start, b = it.start + it.len;
    if (to < a || from > b) continue;
    const s = Math.max(from, a) - a;
    const e = Math.min(to, b) - a;
    if (e <= s) continue;
    // 逐点推进：宽度要按"逐点轮廓"插值，只按总弧长取点不知道该用哪个点的宽度。
    // 所以按折线段走，段内再细分——这样宽窄过渡和原来一样密（STEP 一档）。
    for (let i = 0; i < it.pts.length - 1; i++) {
      const c0 = it.cum[i], c1 = it.cum[i + 1];
      if (c1 <= s || c0 >= e) continue;
      const d0 = Math.max(s, c0), d1 = Math.min(e, c1);
      if (d1 <= d0) continue;
      const span = Math.max(1e-6, c1 - c0);
      const n = Math.max(1, Math.ceil((d1 - d0) / STEP));
      let prev = pointAt(it, d0);
      for (let k = 1; k <= n; k++) {
        const d = d0 + (d1 - d0) * k / n;
        const p = pointAt(it, d);
        const t = (d - c0) / span;
        const w = it.wp
          ? it.wp[i] + (it.wp[i + 1] - it.wp[i]) * t
          : it.w;
        coreSegment(prev[0], prev[1], p[0], p[1], w, it.w);
        grain(p[0], p[1], w, 0.95, fast);
        prev = p;
      }
    }
  }
}

/* ------------------------------------------------------- AI 成图渐显 */
function startReveal(payload) {
  cancel();
  showShot("");
  placeArt(null);
  setBoard(1000, 420, 700, 300);
  clearCanvas();
  const img = new Image();
  img.onload = () => {
    cur = { mode: 'reveal', img, revealed: 0,
            duration: Math.max(800, payload.duration_ms || 12000),
            t0: 0, done: false, path: sShapePath() };
    penEl.classList.add('on');
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  };
  img.src = payload.art_url;
}

// 蛇形走位，像用刷子把沙一层层铺开
function sShapePath() {
  const rows = 16, pts = [];
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) * BOARD_H / rows;
    const leftToRight = r % 2 === 0;
    for (let c = 0; c <= 10; c++) {
      const t = c / 10;
      pts.push([leftToRight ? t * BOARD_W : (1 - t) * BOARD_W, y]);
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { items: [{ pts, cum, len: cum[cum.length - 1], w: 90, start: 0 }],
           total: cum[cum.length - 1] };
}

function revealTo(progress) {
  const target = cur.path.total * progress;
  const R = 78;
  let d = cur.revealed;
  while (d < target) {
    d = Math.min(target, d + 26);
    const at = pointAtByGlobal(cur.path, d);
    if (!at) break;
    sctx.save();
    sctx.beginPath();
    sctx.arc(at[0], at[1], R, 0, 6.2832);
    sctx.clip();
    const iw = cur.img.width, ih = cur.img.height;
    const k = Math.min(BOARD_W / iw, BOARD_H / ih);
    const dw = iw * k, dh = ih * k;
    sctx.drawImage(cur.img, (BOARD_W - dw) / 2, (BOARD_H - dh) / 2, dw, dh);
    sctx.restore();
    penTo(at[0], at[1]);
  }
  cur.revealed = d;
}

/* -------------------------------------- AI 笔迹：一支毛笔一笔一划写出来 */
/* 后端除了"抠干净的透明笔迹 PNG + 它在海报上的框"，还会给 `writes`：
 * 从笔迹图里反推出来的运笔路径（每一笔的点、每一点的笔画半径），见 app/pipeline/brush.py。
 *
 * 这里的画法：
 *   1) 字形永远是 AI 那版书法——我们只控制"哪一块先露出来"，所以怎么画都不走形；
 *   2) maskBuf 累积已经写到的地方，一笔写完就整条刷进去、永久保留；
 *   3) 当前这一笔按弧长推进，笔尖到哪儿墨就露到哪儿，笔画宽窄跟着 ws 走；
 *   4) 笔与笔之间抬笔（笔杆抬起 + 快速移到下一笔起笔），落笔再压回去。
 * 这样看起来是毛笔在写，而不是整张图被扫描出来。
 */
const inkBuf = document.createElement('canvas');
const ictx = inkBuf.getContext('2d');
const maskBuf = document.createElement('canvas');
const mctx = maskBuf.getContext('2d');

/* 后端坐标是 glyph 像素，这里按 drawImage 的同一套 k/offset 换算到画布坐标 */
function prepWrites(writes, k, ox, oy) {
  const out = [];
  for (const w of writes) {
    const src = w.pts || [];
    if (src.length < 2) continue;
    const p = src.map(([x, y]) => [ox + x * k, oy + y * k]);
    // ws 是半径（glyph 像素）-> 画布半径。稍微放大一点，保证笔画边缘被完全揭开
    // 1.22 是量出来的：1.12 时字身只覆盖 91%（笔画边缘和端点一直缺），1.22 到 97.6%。
    // 遮罩比字宽是安全的——合成是 image × mask，不会露出字外面的东西。
    const rs = (w.ws && w.ws.length === src.length ? w.ws : src.map(() => 3))
      .map(r => Math.max(2.2, r * k * 1.22 + 1.5));
    const cum = [0];
    for (let i = 1; i < p.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    }
    const len = cum[cum.length - 1];
    if (len < 1) continue;
    out.push({ p, rs, cum, len, t0: 0, dur: 1 });
  }
  return out;
}

/* 排时间：每笔按长度分时长，笔与笔之间留一个抬笔的空当 */
function prepSchedule(writes, duration) {
  const n = writes.length;
  const gap = Math.min(62, Math.max(16, (duration * 0.2) / Math.max(1, n - 1)));
  const drawMs = Math.max(500, duration - gap * (n - 1));
  const totalLen = writes.reduce((s, w) => s + w.len, 0) || 1;
  // 短笔也要看得见，所以每笔保底一点权重
  const weight = writes.map(w => Math.max(0.06, w.len / totalLen));
  const sumW = weight.reduce((s, x) => s + x, 0);
  let acc = 0;
  writes.forEach((w, i) => {
    w.t0 = acc;
    w.dur = Math.max(50, (drawMs * weight[i]) / sumW);
    w.gap = i < n - 1 ? gap : 0;     // 收笔到下一笔起笔之间"抬笔赶路"的时间
    acc += w.dur + (i < n - 1 ? gap : 0);
  });
  return acc;                       // 整幅写完的时刻
}

/* 把某一笔画到 dist（弧长）处为止，刷进遮罩。反复刷同一段是安全的：
   遮罩是纯白不透明的，重叠不会叠出更亮。 */
function paintStroke(w, dist) {
  const { p, rs, cum } = w;
  const d = Math.min(dist, w.len);
  mctx.strokeStyle = '#fff';
  mctx.fillStyle = '#fff';
  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  for (let i = 0; i < p.length - 1; i++) {
    if (d <= cum[i]) break;
    const span = cum[i + 1] - cum[i] || 1;
    const t = Math.min(1, (d - cum[i]) / span);
    const x1 = p[i][0] + (p[i + 1][0] - p[i][0]) * t;
    const y1 = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
    const r1 = rs[i] + (rs[i + 1] - rs[i]) * t;
    mctx.lineWidth = Math.max(2, rs[i] + r1);      // 直径 = 2 × 平均半径
    mctx.beginPath();
    mctx.moveTo(p[i][0], p[i][1]);
    mctx.lineTo(x1, y1);
    mctx.stroke();
    if (t < 1) break;
  }
  /* 收笔端点补一个圆。
     骨架（Zhang-Suen 细化）到不了笔画最尖的那一小截，而且短骨架段会被当成
     碎笔过滤掉——这些墨不在任何一笔的覆盖范围里，只能等最后那次整块填充才出现。
     观众看到的就是"这一笔还没写全，笔已经抬起来去下一笔了"。
     在收笔处盖一个半径 = 该点笔宽 的圆，正好把那截补上。 */
  if (d >= w.len - 0.5 && p.length) {
    const n = p.length - 1;
    mctx.beginPath();
    mctx.arc(p[n][0], p[n][1], Math.max(2, rs[n]), 0, 6.2832);
    mctx.fill();
  }
}

/* 这一笔第 dist 处在哪、笔锋朝哪（角度给毛笔调倾角用） */
function pointAtWrite(w, dist) {
  const { p, cum } = w;
  const d = Math.max(0, Math.min(dist, w.len));
  for (let i = 0; i < p.length - 1; i++) {
    if (d <= cum[i + 1] || i === p.length - 2) {
      const span = cum[i + 1] - cum[i] || 1;
      const t = Math.max(0, Math.min(1, (d - cum[i]) / span));
      const x = p[i][0] + (p[i + 1][0] - p[i][0]) * t;
      const y = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
      const ang = Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]) * 180 / Math.PI;
      return [x, y, ang];
    }
  }
  return [p[0][0], p[0][1], 0];
}

/* 摆笔：位置 + 倾角 + 提/落 */
function setBrush(x, y, ang, lifted) {
  penTo(x, y);
  const rot = 30 + Math.max(-9, Math.min(9, (ang || 0) * 0.12));
  penEl.style.setProperty('--rot', rot.toFixed(1) + 'deg');
  penEl.style.setProperty('--lift', lifted ? '1' : '0');
}

function startInk(payload) {
  cancel();
  showShot(payload.full_url || "");
  const box = placeArt(payload.box);
  const w = box[2] - box[0], h = box[3] - box[1];
  setBoard(w * 2, h * 2, w, h);
  inkBuf.width = w * 2;
  inkBuf.height = h * 2;
  maskBuf.width = w * 2;
  maskBuf.height = h * 2;
  clearCanvas();
  mctx.clearRect(0, 0, maskBuf.width, maskBuf.height);
  mctx.globalCompositeOperation = 'source-over';

  // 笔的大小跟着字框走：字框 400 宽时是标称大小（字框一般 600~900）
  penEl.style.setProperty('--s', Math.max(0.85, Math.min(2.3, w / 400)).toFixed(2));

  const img = new Image();
  img.onload = () => {
    const W = BOARD_W, H = BOARD_H;
    const k = Math.min(W / img.width, H / img.height);
    const dw = img.width * k, dh = img.height * k;
    const ox = (W - dw) / 2, oy = (H - dh) / 2;
    const writes = prepWrites(payload.writes || [], k, ox, oy);
    const duration = Math.max(1200, payload.duration_ms || 9000);
    const total = writes.length ? prepSchedule(writes, duration) : duration;
    cur = {
      mode: 'ink', img, writes, k, ox, oy, dw, dh,
      duration, total, t0: 0, done: false, maskDone: 0, filled: false,
    };
    penEl.classList.add('on');
    if (writes.length) {
      const p0 = writes[0].p[0];
      setBrush(p0[0], p0[1], 0, true);
    } else {
      // 没提取出笔顺（极少见）：整张笔迹直接铺上，别空着
      mctx.fillStyle = '#fff';
      mctx.fillRect(0, 0, W, H);
      cur.filled = true;
      penEl.classList.remove('on');
    }
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  };
  img.onerror = () => {
    console.warn('笔迹图没加载出来', payload.art_url);
  };
  img.src = payload.art_url;
}

/* 墨比笔尖多露这么一点（画布像素）。笔毫的尖是一个"点"，字帖的笔画末端又会飞白收细，
 * 正好齐平的时候，屏幕上看到的就是"笔尖悬在空白纸上"。让墨抢在笔尖前面一小段，
 * 笔锋就始终压在墨里——这才是毛笔写字该有的样子。 */
const INK_LEAD = 7;

function inkFrame(elapsed) {
  const W = BOARD_W, H = BOARD_H;
  const ws = cur.writes;

  // 1) 已经写完的笔：整条刷进遮罩，之后不再重画
  while (cur.maskDone < ws.length &&
         elapsed >= ws[cur.maskDone].t0 + ws[cur.maskDone].dur) {
    paintStroke(ws[cur.maskDone], ws[cur.maskDone].len);
    cur.maskDone++;
  }

  // 2) 正在写的这一笔：从起笔刷到当前进度（多刷 INK_LEAD，让墨压住笔尖）
  const idx = cur.maskDone;
  let part = 0;
  if (idx < ws.length) {
    const w = ws[idx];
    const e = elapsed - w.t0;
    if (e > 0) {
      part = w.len * Math.min(1, e / w.dur);
      paintStroke(w, Math.min(w.len, part + INK_LEAD));
    }
  }

  // 3) 收尾：骨架覆盖不到的飞白碎点一次补齐（紧接着就淡入成图，看不出来）
  if (!cur.filled && elapsed >= cur.total) {
    mctx.fillStyle = '#fff';
    mctx.fillRect(0, 0, W, H);
    cur.filled = true;
  }

  // 4) 合成：墨色永远是 AI 那版笔迹，遮罩只决定露出多少
  ictx.clearRect(0, 0, W, H);
  ictx.drawImage(cur.img, cur.ox, cur.oy, cur.dw, cur.dh);
  ictx.globalCompositeOperation = 'destination-in';
  ictx.drawImage(maskBuf, 0, 0);
  ictx.globalCompositeOperation = 'source-over';

  sctx.clearRect(0, 0, W, H);
  sctx.drawImage(inkBuf, 0, 0);

  // 5) 笔尖跟着墨走：写完的那一笔停不住，笔会从收笔处滑到下一笔起笔，
  //    滑的路上把笔抬起来一点，落下时正好压在墨上。
  if (!ws.length) return;
  if (idx >= ws.length) {
    penEl.classList.remove('on');
    return;
  }
  const w = ws[idx];
  const e = elapsed - w.t0;
  if (e < 0) {
    const from = idx > 0 ? ws[idx - 1].p[ws[idx - 1].p.length - 1] : w.p[0];
    const g = Math.max(24, w.gap || 40);
    const u = Math.max(0, Math.min(1, 1 + e / g));
    const s = u * u * (3 - 2 * u);                     // 起步慢、中间快、落下慢
    const x = from[0] + (w.p[0][0] - from[0]) * s;
    const y = from[1] + (w.p[0][1] - from[1]) * s;
    const ang = Math.atan2(w.p[0][1] - from[1], w.p[0][0] - from[0]) * 180 / Math.PI;
    setBrush(x, y, ang, s < 0.88);
  } else {
    const at = pointAtWrite(w, part);
    setBrush(at[0], at[1], at[2], false);
  }
}

/* ------------------------------------------------------------ 背景 */
/* 背景图（海报底板）以前写死在 style.css 里，换一次要改 CSS 再重启。
 * 现在后台上传新背景会广播一条 `background`，这里直接把 .poster 的
 * background-image 换掉——OBS 里不用重新加载源。
 * 文件名不变，所以后端给了 `?v=时间戳` 强制绕过浏览器缓存。 */
function setPoster(url) {
  const el = document.querySelector('.poster');
  if (!el || !url) return;
  el.style.backgroundImage = `url("${url}")`;
  console.log('[bg] 背景已换成', url);
}

async function syncPoster() {
  // CSS 里那份是老的（可能被缓存），连上来时主动要一次最新地址
  try {
    const d = await (await fetch('/api/background')).json();
    if (d && d.ok && d.url) setPoster(d.url);
  } catch (e) { /* 拿不到就用 CSS 里那张，不影响开播 */ }
}

/* 祝福语音：和后端运笔同时开始，写完立刻停。
   写完就停是有意的——展示的那几秒是给观众看字的，不需要还在念。
   OBS 里要在浏览器源属性勾"控制音频"，否则这里播了也不进直播混音。 */
let voiceEl = null;
let blessTimer = 0;
let voiceBlocked = false;   // 整页发不出声（自动播放策略），不是"这单没语音"
let pendingVoice = null;    // 被拦的那句，等一次点击再补播
let hintShown = false;

function playVoice(url) {
  stopVoice();
  if (!url) return;
  pendingVoice = url;
  try {
    voiceEl = new Audio(url);
    voiceEl.volume = 0.92;
    const p = voiceEl.play();
    if (p && p.then) {
      p.then(() => {
        // 出声了：把实际时长回报给后台，日志里能看到"确实响了"，不用靠猜。
        voiceAck({ ok: true, ms: Math.round((voiceEl.duration || 0) * 1000) });
      }).catch((err) => {
        const name = (err && err.name) || 'Error';
        // 失败必须上报。以前这里静默吞掉，结果是"画面正常、就是没声"，
        // 现场根本没法判断到底卡在哪一层。
        voiceAck({ ok: false, err: name, msg: String((err && err.message) || '').slice(0, 80) });
        // NotAllowedError = 浏览器自动播放策略拦的：页面从没被点过，一声都发不出来。
        // 这不是"这一单失败"，是整条链路哑了——必须让人看见，不能像以前那样吞掉。
        if (name === 'NotAllowedError') {
          voiceBlocked = true;
          armUnlock();
        }
      });
    }
  } catch (e) {
    voiceAck({ ok: false, err: 'throw', msg: String(e).slice(0, 80) });
    voiceEl = null;
  }
}

/* 把播放结果回报给后端（后台日志可见）。只在本单真的出问题时才有价值，
   但成功的也报一条，才能区分"没下发语音"和"下发了没播出来"。 */
function voiceAck(info) {
  info.url = pendingVoice || '';
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'voice_ack', payload: info }));
  } catch (e) { /* 回报失败不影响写字 */ }
}

/* 只在"页面一声都发不出来"时才提示，正常路径（run.py 带的 Chrome 启动参数）
   根本走不到这里；手动用普通浏览器窗口打开这个地址才会撞上。 */
function armUnlock() {
  if (hintShown) return;
  hintShown = true;
  toast('浏览器拦了自动播放，点一下画面才有声音');
  const unlock = () => {
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    if (!voiceBlocked) return;
    voiceBlocked = false;
    if (pendingVoice && cur && !cur.done) playVoice(pendingVoice);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

function stopVoice() {
  if (!voiceEl) return;
  try { voiceEl.pause(); voiceEl.currentTime = 0; } catch (e) { /* ignore */ }
  voiceEl = null;
}

/* 祝福语字幕：念的就是这一句。
   写完不立刻撤，留 1.6 秒——那几秒正好是"成品展示"，截图里能带上这句话；
   下一位进来时 cancel() 会立刻换掉，不会串行。 */
const blessEl = document.getElementById('bless');
const blessText = document.getElementById('blessText');

function showBless(text) {
  if (!blessEl) return;
  clearTimeout(blessTimer);
  if (!text) { hideBless(0); return; }
  blessText.textContent = text;
  blessEl.classList.add('on');
}

function hideBless(delay) {
  if (!blessEl) return;
  clearTimeout(blessTimer);
  if (delay > 0) {
    blessTimer = setTimeout(() => blessEl.classList.remove('on'), delay);
  } else {
    blessEl.classList.remove('on');
  }
}

/* ------------------------------------------------------------ 其他 UI */
function cancel() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  cur = null;
  stopVoice();
  hideBless(0);          // 下一位进来：上一句立刻撤，别串行
  penEl.classList.remove('on');
  penEl.style.setProperty('--lift', '0');
  fctx.clearRect(0, 0, BOARD_W, BOARD_H);
}

// 回报"写完了"。delay > 0 时推迟一点，让成图先淡入（见 ink 分支）。
function report(delay) {
  const fire = () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'done' }));
  };
  if (delay > 0) setTimeout(fire, delay);
  else fire();
}

const qWrap = document.getElementById('queue');
const qList = document.getElementById('qList');
const qCount = document.getElementById('qCount');
let lastQSig = '';

// 右上角固定挂 8 行（`queue.panel_slots`）：空场全是虚拟观众，真人从最后一行
// 进队，前面虚拟每播完一个他就往上顶一格，队尾同时补新的进来。
// 后端 queue_view 已经把 ghosts 和真人行拼成一个 panel，这里直接渲染就好。
// 队列广播很密（每 400ms 一次），只有内容真的变了才重建 DOM，
// 否则每一行都在重放入场动画。
function renderQueue(p) {
  // panel = 虚拟占位 + 正在写 + 正在出图 + 排队（后端已经按 panel_rows 裁好）。
  // 只挂 queue 的话，单子一被拿去生成就从面板上消失，观众找不到自己。
  const rows = p.panel || (p.queue || []).filter(o => o.kind !== 'virtual');
  if (!rows.length) {
    qWrap.hidden = true;
    lastQSig = '';
    return;
  }
  qWrap.hidden = false;
  const more = p.more || {};
  const total = more.total || rows.length;
  // 人数只数真人：panel 前面 8 行是虚拟观众，算进去会让"共 N 人"虚高
  const people = (p.people != null) ? p.people : total;
  const sig = rows.map(o => `${o.seq}:${o.name || o.nickname}:${o.state || ''}:${o.jump ? 'g' : ''}`)
    .join('|') + '/' + total + '/' + (more.last_pos || '') + '/' + people;
  if (sig === lastQSig) return;
  lastQSig = sig;
  if (qCount) qCount.textContent = people + ' 人';

  let html = rows.map((o, i) => {
    const tag = o.state === 'writing' ? '正在写'
              : o.state === 'gen' ? '出字中'
              : o.state === 'ghost' ? '排队'
              : (o.jump ? '礼物插队' : '弹幕');
    const cls = o.jump ? ' gift'
              // 空场那张"正在写"的幽灵不加金框：每换一张都闪一下太吵
              : (o.state === 'writing' && o.kind !== 'ghost') ? ' writing'
              : o.state === 'gen' ? ' gen'
              : o.kind === 'ghost' ? ' ghost' : '';
    return `
    <div class="q-row${cls}">
      <span class="q-no">${i + 1}</span>
      <span class="q-nm">${esc(o.name || o.nickname)}</span>
      <span class="q-tag">${tag}</span>
    </div>`;
  }).join('');

  /* 队列比面板长的时候，中间折一行"…"，最后单独挂队尾那一行。
     队尾就是**刚打完名字的那个人**——所以这一行的序号，等于告诉他"你排第几"。
     连刷礼物时队列能到二十几个，全渲染会把画面顶出去。
     只有 1 行被折掉时不画省略行（画了反而多占一行）。 */
  const cut = (more.cut != null) ? more.cut : (more.hidden || 0);
  if (cut > 0) {
    if (more.hidden > 0) {
      html += `
    <div class="q-row more">
      <span class="q-no">…</span>
      <span class="q-nm">还有 ${more.hidden} 人在等</span>
    </div>`;
    }
    html += `
    <div class="q-row tail${more.last_gift ? ' gift' : ''}">
      <span class="q-no">${more.last_pos}</span>
      <span class="q-nm">@${esc(more.last_nick)} ${esc(more.last_name)}</span>
      <span class="q-tag">刚进来</span>
    </div>`;
  }
  qList.innerHTML = html;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function setCurrent(p) {
  const o = p.current;
  const nick = document.getElementById('whoNick');
  nick.textContent = o ? '@' + (o.nickname || '') : '';
  const badge = document.getElementById('whoTier');
  if (o && o.tier_name) { badge.hidden = false; badge.textContent = o.tier_name; }
  else badge.hidden = true;
}

let toastTimer = 0;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ------------------------------------------------------------ 实时 HUD */
/* 左下角那个秒级时钟存在的唯一理由：让画面**每秒都有像素变化**。
 * 抖音判"录播/挂机"看的是实时性——画面一圈一圈重复、或者长时间静帧，
 * 是最容易被机审命中的特征。一个一直在走的钟，成本最低、效果最直接。
 *
 * 用 250ms 一校而不是 1000ms：定时器本身有抖动（尤其帧率不稳的时候），
 * 1 秒一校偶尔会让某一位数字晚 200ms 才跳，看起来像卡了一下。
 * 后台节流不用管——run.py 起窗口时带了 --disable-background-timer-throttling。
 */
const HUD_DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const hudPad = n => String(n).padStart(2, '0');

function tickHud() {
  const d = new Date();
  const t = document.getElementById('hudTime');
  if (t) {
    const s = `${hudPad(d.getHours())}:${hudPad(d.getMinutes())}:${hudPad(d.getSeconds())}`;
    if (t.textContent !== s) t.textContent = s;
  }
  const dt = document.getElementById('hudDate');
  if (dt) {
    const s = `${d.getMonth() + 1}月${d.getDate()}日 ${HUD_DOW[d.getDay()]}`;
    if (dt.textContent !== s) dt.textContent = s;
  }
}
tickHud();
setInterval(tickHud, 250);

/* ------------------------------------------------------------ 真人小窗 */
/* 左下角播放后台上传的真人录像。
 * 存在的意义不是好看：平台判"录播 / 挂机"要看画面里有没有**会动的人**，
 * 一张海报加一段字迹动画说服不了机审。
 *
 * 三条实现上的硬规矩：
 *   1) 必须静音。Chrome 只给 muted 视频自动播放的许可，不静音整块就是黑的；
 *      而且真出声会和祝福语音抢同一路音频（同一个浏览器源）。
 *   2) 多段视频挨个播、不开 loop。同一段反复循环本身就是"周期性重复"，
 *      只是比整屏循环轻一点。
 *   3) 时钟（.hud）的 bottom 跟着小窗高度走，永远在小窗上方，不被压住。
 */
let camState = null;
let camIdx = 0;
let camCur = '';

function camEls() {
  return { box: document.getElementById('cam'), v: document.getElementById('camV') };
}

/* 按视频真实比例内接到 maxW×maxH。9:16 竖屏 640 高就是 360 宽，
 * 16:9 横屏 520 宽只有 293 高——两种都不会顶到字框（851~1151）上。 */
function camFit(maxW, maxH, vw, vh) {
  if (!vw || !vh) return [maxW, Math.round(maxH * 0.75)];
  const k = Math.min(maxW / vw, maxH / vh);
  return [Math.round(vw * k), Math.round(vh * k)];
}

function camPlace() {
  const { box, v } = camEls();
  if (!box || !v) return;
  const o = (camState && camState.opt) || {};
  const x = o.x == null ? 40 : o.x;
  const y = o.y == null ? 58 : o.y;
  const right = o.pos !== 'bl';                 // 默认右下
  const [w, h] = camFit(o.w || 440, o.h || 340, v.videoWidth, v.videoHeight);
  box.style.width = w + 'px';
  box.style.height = h + 'px';
  box.style.bottom = y + 'px';
  box.style.borderRadius = (o.k == null ? 26 : o.k) + 'px';
  // left / right 必须成对地写：只改一个的话，另一个还留在旧值上，
  // 元素会同时被两边约束，宽度就被拉变形了。
  box.style.left = right ? 'auto' : x + 'px';
  box.style.right = right ? x + 'px' : 'auto';

  // 时钟让到小窗上方 16px，跟着小窗同一边。直接写 bottom 而不是 CSS 变量：
  // 变量那条路在 CEF / headless 里实测偶尔不重算，肉眼看到的就是时钟被压在小窗里。
  const hud = document.getElementById('hud');
  if (hud) {
    hud.style.bottom = (y + h + 16) + 'px';
    hud.style.left = right ? 'auto' : x + 'px';
    hud.style.right = right ? x + 'px' : 'auto';
  }
}

function camResetHud() {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const o = (camState && camState.opt) || {};
  const x = o.x == null ? 40 : o.x;
  hud.style.bottom = '';                        // 回到底边（CSS 默认 58）
  if (o.pos === 'bl') { hud.style.right = 'auto'; hud.style.left = x + 'px'; }
  else { hud.style.left = 'auto'; hud.style.right = x + 'px'; }
}

function camLoad(i) {
  const { v } = camEls();
  const items = (camState && camState.items) || [];
  if (!v || !items.length) return;
  camIdx = ((i % items.length) + items.length) % items.length;
  const it = items[camIdx];
  v.loop = items.length < 2;
  if (v.dataset.url !== it.url) {
    v.dataset.url = it.url;
    v.src = it.url;                        // 换 src 会重置 currentTime，正是要的
  }
  v.muted = true;                          // 属性写死了，但 CEF 偶尔会丢，再压一遍
  camPlace();
  const p = v.play();
  if (p && p.catch) p.catch(() => { /* 被自动播放策略拦了，5 秒后的兜底会再试 */ });
}

function camApply(st) {
  camState = st || null;
  const { box, v } = camEls();
  if (!box || !v) return;
  const o = (camState && camState.opt) || {};
  if (!camState || !camState.on || !(camState.items || []).length) {
    box.hidden = true;
    v.pause();
    camResetHud();
    return;
  }
  box.hidden = false;
  box.classList.toggle('mirror', !!o.mirror);
  if (camState.cur && camState.cur !== camCur) {
    camCur = camState.cur;
    const k = camState.items.findIndex(x => x.id === camCur);
    camIdx = k < 0 ? 0 : k;
    camLoad(camIdx);
  } else {
    camPlace();                            // 只改了尺寸/边距，重新摆一下就行
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
}

async function syncCam() {
  try {
    const d = await (await fetch('/api/cam')).json();
    if (d && d.ok) camApply(d);
  } catch (e) { /* 拿不到就别显示，不影响写字 */ }
}

(function camBind() {
  const v = document.getElementById('camV');
  if (!v) return;
  // 真实尺寸要等元数据到，到了重排一次（首次是拿默认比例摆的）
  v.addEventListener('loadedmetadata', camPlace);
  // 解不出来（比如 mov 里是 HEVC，浏览器不认）就藏起来。
  // 不自动跳下一段：如果所有段都是同一种编码，跳来跳去就是死循环。
  v.addEventListener('error', () => {
    console.warn('[cam] 视频加载失败，检查编码（要 H.264 的 mp4 / VP9 的 webm）');
    const b = camEls().box;
    if (b) b.hidden = true;
    camResetHud();
  });
  // 多段：播完换下一段。单段走 loop，永远走不到这里
  v.addEventListener('ended', () => {
    const n = ((camState && camState.items) || []).length;
    if (n > 1) camLoad(camIdx + 1);
  });
  // 兜底：自动播放真被拦过的话画面会一直停着，5 秒补一次
  setInterval(() => {
    const { box: b, v: el } = camEls();
    if (!b || !el || b.hidden || !camState || !camState.on) return;
    if (el.paused && !el.ended && el.readyState >= 2) {
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }, 5000);
})();

/* ------------------------------------------------------------ WebSocket */
let ws = null;
let pingTimer = 0;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/overlay`);

  ws.onopen = () => {
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
    }, 20000);
  };

  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    const p = m.payload || {};
    if (m.type === 'hello' || m.type === 'queue') {
      renderQueue(p);
      setCurrent(p);
      // OBS 重连：直接把上一张成图铺回去，别让观众看到擦空了的底板
      if (m.type === 'hello' && p.stage && !cur) restoreShot(p.stage);
      // hello 里不带小窗信息（它在 opt 里，和队列无关），连上来单独要一次
      if (m.type === 'hello') { syncPoster(); syncCam(); }
    } else if (m.type === 'background') {
      setPoster(p.url);
    } else if (m.type === 'cam') {
      camApply(p);
    } else if (m.type === 'draw_start') {
      document.getElementById('whoNick').textContent = '@' + (p.nickname || '');
      const badge = document.getElementById('whoTier');
      if (p.tier_name) { badge.hidden = false; badge.textContent = p.tier_name; }
      else badge.hidden = true;
      // 先起笔，再出声。三个 start*() 开头都会 cancel()，而 cancel() 里带 stopVoice()——
      // 顺序反过来的话，语音刚 play() 就被 pause()，浏览器报 AbortError，一声都没有。
      if (p.mode === 'ink') startInk(p);
      else if (p.mode === 'reveal') startReveal(p);
      else startStrokes(p);
      playVoice(p.voice_url);          // 和第一笔同时起
      showBless(p.voice_text);         // 字幕和语音同步：念的就是这一句
    } else if (m.type === 'toast') {
      toast(p.text || '');
    }
  };

  ws.onclose = () => {
    clearInterval(pingTimer);
    cancel();
    setTimeout(connect, 1500);
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

connect();
