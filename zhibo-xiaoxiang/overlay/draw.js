/* Live overlay: receives ordered pen strokes, draws them in real time with a
   pencil that follows the tip exactly (no CSS guessing).

   Payload per order:
     strokes  main line art
     hatch    pencil shading strokes (素描 / 精致画)
     fills    flat colour regions painted under the ink (彩色 / 精致画)
   Phases: lines -> shading (same pen timeline) -> colour wash -> score. */
(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), cv = $('ink'), ctx = cv.getContext('2d');
  const wash = $('wash'), wctx = wash.getContext('2d');
  const pen = $('pen'), elNick = $('nick'), elSub = $('sub'), elAv = $('av');
  const elScore = $('score'), elScoreBox = $('scorebox'), elDone = $('done');
  const elQlen = $('qlen'), elQlist = $('qlist'), elHint = $('hint'), elToast = $('toast');
  const elTier = $('tier'), elStampName = $('stampName');

  /* ---------------------------------------------------------- stage fit */
  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ------------------------------------------------------------ drawing */
  let segs = [], totalLen = 0, drawn = 0, idx = 0;
  let speed = 300, playing = false, lastT = 0, width = 3.4;
  let fills = [], fi = 0, coloring = false, drawSeq = 0;
  const FILL_MS = 190;                 // one colour block sweep

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, wash.width, wash.height);
  }

  function build(strokes, hatch) {
    segs = []; totalLen = 0;
    const push = (st, shade) => {
      for (let j = 1; j < st.length; j++) {
        const [x1, y1] = st[j - 1], [x2, y2] = st[j];
        const len = Math.hypot(x2 - x1, y2 - y1) || 0.001;
        segs.push({ x1, y1, x2, y2, len, start: totalLen, end: totalLen + len,
                    i: segs.length, shade });
        totalLen += len;
      }
    };
    (strokes || []).forEach((st) => push(st, false));
    (hatch || []).forEach((st) => push(st, true));
  }

  function strokeW(i) { return width * (1 + 0.07 * Math.sin(i * 1.7)); }

  function styleFor(s) {
    if (s.shade) {
      ctx.strokeStyle = 'rgba(42,33,26,.40)';
      ctx.lineWidth = Math.max(1, width * 0.40);
    } else {
      ctx.strokeStyle = '#171310';
      ctx.lineWidth = strokeW(s.i);
    }
  }

  function paint() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    while (idx < segs.length && segs[idx].end <= drawn) {
      const s = segs[idx];
      styleFor(s);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      idx++;
    }

    let tx = 0, ty = 0;
    if (idx < segs.length) {
      const s = segs[idx];
      const t = Math.max(0, Math.min(1, (drawn - s.start) / s.len));
      tx = s.x1 + (s.x2 - s.x1) * t;
      ty = s.y1 + (s.y2 - s.y1) * t;
      if (t > 0.01) {
        styleFor(s);
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    } else if (segs.length) {
      tx = segs[segs.length - 1].x2;
      ty = segs[segs.length - 1].y2;
    }
    pen.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  /* ------------------------------------------------------------- colour */
  function prepareFills(list) {
    return (list || []).map((f) => {
      const pts = f.points;
      let cx = 0, cy = 0;
      for (const [x, y] of pts) { cx += x; cy += y; }
      cx /= pts.length; cy /= pts.length;
      let maxR = 0;
      for (const [x, y] of pts) maxR = Math.max(maxR, Math.hypot(x - cx, y - cy));
      return { pts, color: f.color, cx, cy, maxR: maxR || 1, r: 0 };
    });
  }

  /* Paint one block, clipped to a circle growing from its centre, so the
     colour spreads like a brush instead of popping in. */
  function paintFill(f) {
    wctx.save();
    wctx.beginPath();
    wctx.arc(f.cx, f.cy, Math.max(1, f.r), 0, Math.PI * 2);
    wctx.clip();
    wctx.fillStyle = f.color;
    wctx.beginPath();
    wctx.moveTo(f.pts[0][0], f.pts[0][1]);
    for (let i = 1; i < f.pts.length; i++) wctx.lineTo(f.pts[i][0], f.pts[i][1]);
    wctx.closePath();
    wctx.fill();
    wctx.restore();
  }

  /* ------------------------------------------------------- reveal mode
     A finished AI sketch is a real pencil drawing, not a set of thin lines.
     Tracing it into strokes broke the shading into hundreds of dashes, so for
     that kind of order we show the picture itself and wipe a paper-coloured
     mask away under a moving pencil: dark areas first (face, hair), the pale
     background last. */
  let rv = null, rvToken = 0;

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  function paperMask(c2, S) {
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalCompositeOperation = 'source-over';
    c2.clearRect(0, 0, S, S);
    const g = c2.createLinearGradient(0, 0, S * 0.5, S);
    g.addColorStop(0, '#fffdf8');
    g.addColorStop(0.62, '#fdf7ec');
    g.addColorStop(1, '#f7efe0');
    c2.fillStyle = g;
    c2.fillRect(0, 0, S, S);
  }

  /* ------------------------------------------------------- pencil passes
     A real sketch is built with diagonal strokes, one body part at a time:
     hair, then the face, the neck, the clothes, and the blank paper last.
     So instead of sweeping the canvas row by row (which read as a printer),
     we lay parallel diagonal passes across the whole frame, cut each pass
     where it crosses into another body part, and play the parts in order. */
  const BAND_GAP = 26;        // px between parallel passes
  // Negative angle: the passes, and the order they are played in, run from
  // the top-left corner down to the bottom-right. Flip the sign to get the
  // mirrored hatching (top-right -> bottom-left).
  const BAND_ANGLE = -38;     // degrees
  const BAND_STEP = 7;        // sample spacing along a pass
  const PART_ORDER = ['hair', 'face', 'neck', 'clothes'];
  // Time per sampled point. The face carries the detail, blank paper is
  // swept almost for free at the end.
  const PART_WEIGHT = { hair: 1, face: 1.35, neck: .8, clothes: 1,
                        bg: .22 };
  const PART_NAME = { hair: '头发', face: '脸部', neck: '脖子', clothes: '衣服',
                      bg: '背景' };
  const partName = (p) => PART_NAME[p] || p;

  function partAt(x, y, dx, dy, dw, dh, reg, lum) {
    const rx = (x - dx) / dw, ry = (y - dy) / dh;
    if (!reg || rx < 0 || rx > 1 || ry < 0 || ry > 1) return 'bg';
    let best = 'bg', area = 9;
    // Boxes overlap (the hair box contains the face, the clothes box contains
    // the neck), so the smallest matching box wins.
    for (const p of PART_ORDER) {
      const b = reg[p];
      if (!b || rx < b[0] || rx > b[2] || ry < b[1] || ry > b[3]) continue;
      const a = (b[2] - b[0]) * (b[3] - b[1]);
      if (a < area) { area = a; best = p; }
    }
    // The hair box contains the forehead and the cheeks. Drawing the whole box
    // first leaves a rectangular hole where the face will go, which looks like
    // a bug rather than like an unfinished drawing. So a pale sample inside the
    // hair box (skin, a highlight) is handed to the face pass: the hair comes
    // out as a hairline-shaped mass and the face fills in afterwards, the way
    // somebody would actually block in a portrait.
    if (best === 'hair' && lum(x, y) > 208) return 'face';
    return best;
  }

  function buildBands(S, dx, dy, dw, dh, reg, data) {
    const lum = (x, y) => {
      const i = (((y | 0) * S) + (x | 0)) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    /* Classify on a coarse grid, not per sample. Part borders are fuzzy, so a
       per-pixel test flipped hair/face several times along one diagonal pass;
       every flip cut the stroke and runs shorter than three samples were
       dropped, which left chains of unconnected pencil blobs instead of lines.
       A 12 px grid plus a mode filter gives contiguous regions, so one pass
       through the hair really is one stroke. */
    const G = 12;
    const gn = Math.ceil(S / G);
    const grid = new Uint8Array(gn * gn);
    const NAME = ['bg', 'hair', 'face', 'neck', 'clothes'];
    const CODE = { bg: 0, hair: 1, face: 2, neck: 3, clothes: 4 };
    for (let r = 0; r < gn; r++) {
      for (let c = 0; c < gn; c++) {
        grid[r * gn + c] = CODE[partAt((c + 0.5) * G, (r + 0.5) * G,
                                       dx, dy, dw, dh, reg, lum)];
      }
    }
    const clean = new Uint8Array(grid);
    for (let r = 1; r < gn - 1; r++) {
      for (let c = 1; c < gn - 1; c++) {
        const hist = [0, 0, 0, 0, 0];
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) hist[grid[(r + j) * gn + c + i]]++;
        }
        let best = grid[r * gn + c], bn = hist[best];
        for (let k = 0; k < 5; k++) if (hist[k] > bn) { bn = hist[k]; best = k; }
        clean[r * gn + c] = best;
      }
    }
    const partOf = (x, y) => {
      const c = Math.min(gn - 1, Math.max(0, Math.floor(x / G)));
      const r = Math.min(gn - 1, Math.max(0, Math.floor(y / G)));
      return NAME[clean[r * gn + c]];
    };

    const a = BAND_ANGLE * Math.PI / 180;
    const cs = Math.cos(a), sn = Math.sin(a);
    const cx = S / 2, cy = S / 2, span = S * 1.8;
    const bands = [];
    let flip = false;
    for (let v = -S * 0.92; v <= S * 0.92; v += BAND_GAP) {
      const pts = [];
      const n = Math.floor(span / BAND_STEP);
      for (let k = 0; k <= n; k++) {
        // Alternate passes run the other way so the hand zig-zags down the
        // paper instead of flying back to the left edge every row.
        const u = flip ? span / 2 - k * BAND_STEP : -span / 2 + k * BAND_STEP;
        const x = cx + cs * u - sn * v;
        const y = cy + sn * u + cs * v;
        if (x < -2 || x > S + 2 || y < -2 || y > S + 2) continue;
        pts.push({ x, y, p: partOf(x, y) });
      }
      flip = !flip;
      // Cut the pass at every part boundary: a stroke that starts in the hair
      // and ends on the cheek must not drag the pencil across both parts.
      let run = null;
      for (const pt of pts) {
        if (!run || run.p !== pt.p) {
          if (run && run.pts.length >= 2) bands.push(run);
          run = { p: pt.p, pts: [] };
        }
        run.pts.push({ x: pt.x, y: pt.y });
      }
      if (run && run.pts.length >= 2) bands.push(run);
    }
    return bands;
  }

  function orderBands(bands, reg) {
    const order = (reg && Array.isArray(reg.order) && reg.order.length === 4
      ? reg.order : PART_ORDER).concat(['bg']);
    const rank = (p) => { const i = order.indexOf(p); return i < 0 ? 9 : i; };
    return bands.map((b, i) => ({ ...b, i }))
      .sort((A, B) => (rank(A.p) - rank(B.p)) || (A.i - B.i));
  }

  /* Wipe the paper mask along one pass, up to `frac` of its length. Redrawing
     the finished head of the same stroke is idempotent, so no bookkeeping. */
  function eraseBand(b, frac) {
    const n = Math.max(2, Math.ceil(b.pts.length * frac));
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = b.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    // A blurred halo turns the mask edge from a hard stencil cut into a soft
    // graphite smudge, which is what a pencil front actually looks like.
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let k = 1; k < n; k++) ctx.lineTo(b.pts[k].x, b.pts[k].y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.globalCompositeOperation = 'source-over';
    return b.pts[Math.min(n, b.pts.length) - 1];
  }

  function updateReveal() {
    if (!rv || !rv.playing) return;
    // Wall clock, not accumulated frame deltas: a backgrounded or throttled tab
    // drops to a few fps and the capped dt made a 20 s drawing take minutes.
    rv.t = performance.now() - rv.t0;
    let tip = rv.tip;
    while (rv.i < rv.bands.length && rv.t >= rv.bands[rv.i].end) {
      tip = eraseBand(rv.bands[rv.i], 1);
      rv.i++;
    }
    if (rv.i >= rv.bands.length) {
      // finish the last uncovered slivers, then bow out
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      rv.playing = false;
      rv = null;
      finish();
      return;
    }
    const b = rv.bands[rv.i];
    const f = Math.max(0, Math.min(1, (rv.t - b.start) /
                                   Math.max(1, b.end - b.start)));
    tip = eraseBand(b, f);
    rv.tip = tip;
    pen.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
  }

  async function revealStart(p) {
    const my = ++rvToken;
    const S = (p.size && p.size[0]) || 900;
    cv.width = S; cv.height = S; wash.width = S; wash.height = S;
    clear();
    playing = false; coloring = false; fills = []; segs = []; totalLen = 0;

    let img;
    try {
      img = await loadImage(p.art_url);
    } catch (e) {
      console.warn('[draw] art load failed', p.art_url, e);
      return;
    }
    if (my !== rvToken) return;      // superseded by another order

    const sc = Math.max(S / img.width, S / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    const dx = (S - dw) / 2, dy = (S - dh) / 2;

    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, S, S);
    wctx.drawImage(img, dx, dy, dw, dh);

    // Pixel data feeds the pale-sample test in partAt.
    const tmp = document.createElement('canvas');
    tmp.width = S; tmp.height = S;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(img, dx, dy, dw, dh);
    const data = tctx.getImageData(0, 0, S, S).data;

    const reg = p.regions || null;
    const bands = orderBands(buildBands(S, dx, dy, dw, dh, reg, data), reg);
    if (!bands.length) { console.warn('[draw] empty reveal path'); return; }

    paperMask(ctx, S);

    // Hand out the clock by sampled length × part weight: the face gets the
    // lion's share, the blank margin is a quick final sweep.
    const ms = Math.max(1000, p.duration_ms || 20000);
    const units = bands.reduce((s, b) =>
      s + b.pts.length * (PART_WEIGHT[b.p] || 1), 0) || 1;
    let acc = 0;
    for (const b of bands) {
      const w = b.pts.length * (PART_WEIGHT[b.p] || 1) / units * ms;
      b.start = acc; acc += w; b.end = acc;
      // Uneven pressure: a pencil does not leave a ruler-straight band.
      b.width = BAND_GAP * (0.90 + Math.random() * 0.18);
    }

    rv = { bands, i: 0, t: 0, t0: performance.now(), S, tip: bands[0].pts[0],
           playing: true };
    drawSeq++;
    pen.classList.remove('hidden');
    pen.style.transform = `translate(${bands[0].pts[0].x}px, ${bands[0].pts[0].y}px)`;
    const parts = [...new Set(bands.map((b) => b.p))]
      .filter((x) => x !== 'bg').map(partName);
    elHint.textContent = `${parts.join(' → ') || '落笔'} · 约 ${Math.round(ms / 1000)} 秒`;
    console.log('[draw] reveal', bands.length, 'passes',
                parts.join('>'), 'regions', reg && reg.src);
  }

  function frame(t) {
    const dt = lastT ? Math.min(0.06, (t - lastT) / 1000) : 0;
    lastT = t;
    window.__d = { seq: drawSeq, playing, coloring, fi, n: fills.length, idx,
                   segs: segs.length, drawn: Math.round(drawn),
                   total: Math.round(totalLen),
                   reveal: rv ? { i: rv.i, n: rv.bands.length,
                                  part: (rv.bands[rv.i] || {}).p } : null };
    if (rv && rv.playing) updateReveal();
    if (playing) {
      drawn = Math.min(totalLen, drawn + speed * dt);
      paint();
      if (drawn >= totalLen) {
        playing = false;
        if (fills.length) {
          coloring = true; fi = 0;
          pen.classList.add('hidden');
          elHint.textContent = '上色中…';
          console.log('[draw] colour phase', fills.length,
                      'areas', fills.map((f) => Math.round(f.maxR)).join(','));
        } else {
          finish();
        }
      }
    } else if (coloring) {
      const f = fills[fi];
      if (!f) {
        coloring = false;
        finish();
      } else {
        f.r += (f.maxR / (FILL_MS / 1000)) * dt;
        if (f.r >= f.maxR) { f.r = f.maxR; paintFill(f); fi++;
          if (fi % 5 === 0 || fi === fills.length)
            console.log('[draw] fill', fi, '/', fills.length,
                        'r', Math.round(f.maxR), 'pts', f.pts.length,
                        'alpha', wctx.globalAlpha); }
        else paintFill(f);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------- states */
  function idle(msg) {
    playing = false; coloring = false;
    rvToken++;                      // cancel any reveal still loading its image
    rv = null;
    pen.classList.add('hidden');
    elTier.classList.remove('on');
    elHint.textContent = msg || '扣 1 排队（简单档）· 送礼物升级画法';
  }

  function setHeader(p) {
    elNick.textContent = '@' + p.nickname;
    if (elStampName) elStampName.textContent = '@' + p.nickname;
    const tierName = p.tier_name || '简单';
    elTier.textContent = tierName;
    elTier.className = 'tier on t-' + (p.tier || 'simple');
    elSub.textContent = p.kind === 'gift'
      ? `送出「${p.gift || '礼物'}」· ${tierName}档`
      : (p.kind === 'manual' ? '主播手动接单'
        : (p.kind === 'virtual' ? '新观众 · 刚刚进入直播间' : '扣 1 排队成功'));
    // Stand-in viewers have no photo, so the tile falls back to a letter.
    const wrap = elAv.parentElement;
    if (p.avatar_url) {
      elAv.src = p.avatar_url;
      if (wrap) wrap.classList.remove('no-photo');
    } else {
      elAv.removeAttribute('src');
      if (wrap) wrap.classList.add('no-photo');
      const init = $('avInit');
      if (init) init.textContent = (p.nickname || '?').trim().slice(0, 1);
    }
    elScoreBox.classList.remove('on');
    elScore.textContent = '--';
  }

  function start(p) {
    lastT = 0;
    setHeader(p);
    if (p.mode === 'reveal' && p.art_url) {
      pen.classList.remove('hidden');
      revealStart(p);
      return;
    }

    const w = (p.size && p.size[0]) || 900;
    cv.width = w; cv.height = (p.size && p.size[1]) || w;
    wash.width = cv.width; wash.height = cv.height;
    clear();
    build(p.strokes, p.hatch);
    width = p.stroke_width || 3.4;
    fills = prepareFills(p.fills);
    drawn = 0; idx = 0; fi = 0; coloring = false; drawSeq++;
    speed = totalLen / Math.max(1, (p.duration_ms || 60000) / 1000);

    const bits = [`共 ${(p.strokes || []).length} 笔`];
    if (p.hatch && p.hatch.length) bits.push(`阴影 ${p.hatch.length} 笔`);
    if (fills.length) bits.push(`上色 ${fills.length} 块`);
    bits.push(`约 ${Math.round((p.duration_ms || 0) / 1000)} 秒`);
    elHint.textContent = bits.join(' · ');

    pen.classList.remove('hidden');
    playing = true;
    console.log('[draw] start', p.tier, 'strokes', (p.strokes || []).length,
                'fills', (p.fills || []).length);
  }

  function finish() {
    pen.classList.add('hidden');
    console.log('[draw] finish after', fi, '/', fills.length, 'fills');
    const score = window.__score || 95;
    const step = Math.max(1, Math.round(score / 6));
    let n = score - step * 5;
    elScore.textContent = n;
    const timer = setInterval(() => {
      n += step;
      if (n >= score) { n = score; clearInterval(timer); }
      elScore.textContent = n;
    }, 30);
    elScoreBox.classList.add('on');
    elDone.textContent = (parseInt(elDone.textContent || '0', 10) + 1);
    send({ type: 'done' });
  }

  /* Top five waiting, numbered. Rebuilt only when the list actually changes,
     otherwise the entry animation replays on every queue broadcast and the
     whole panel flickers. */
  let lastQSig = '';
  function showQueue(s) {
    if (!s) return;
    const q = s.queue || [];
    elQlen.textContent = q.length;
    elDone.textContent = s.done || 0;
    showRecent(s);
    const sig = q.slice(0, 5).map((o) => `${o.seq}:${o.nickname}`).join('|');
    if (sig === lastQSig) return;
    lastQSig = sig;

    elQlist.innerHTML = '';
    if (!q.length) {
      const d = document.createElement('div');
      d.className = 'qempty';
      d.textContent = '暂时没人排队，扣 1 就能上';
      elQlist.appendChild(d);
      return;
    }
    q.slice(0, 5).forEach((o, i) => {
      const row = document.createElement('div');
      row.className = 'qitem';
      const no = document.createElement('span');
      no.className = 'qno';
      no.textContent = i + 1;
      const nm = document.createElement('span');
      nm.className = 'qname';
      nm.textContent = (o.kind === 'gift' ? '🎁 ' : '') + '@' + o.nickname;
      const tg = document.createElement('span');
      tg.className = 'qtag' + (o.kind === 'gift' ? ' t-gift' : '');
      tg.textContent = (o.tier_name || '简单') + '档';
      row.append(no, nm, tg);
      elQlist.appendChild(row);
    });
  }

  /* Finished drawings pinned to the desk, top-left: the last three, newest on
     top. Rebuilt only when the set changes, otherwise the drop-in animation
     would replay on every queue broadcast. */
  const elStack = $('stack');
  let lastRSig = '';
  function showRecent(s) {
    const list = (s.recent || []).slice(0, 3);
    const sig = list.map((r) => r.url + '|' + r.nickname).join(',');
    if (sig === lastRSig) return;
    lastRSig = sig;
    elStack.innerHTML = '';
    const rows = list.length ? list : [null, null];
    rows.forEach((r) => {
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      const shot = document.createElement('div');
      shot.className = 'shot';
      if (r && r.url) shot.style.backgroundImage = `url("${r.url}")`;
      const cap = document.createElement('div');
      cap.className = 'cap';
      const cn = document.createElement('span');
      cn.className = 'cn';
      cn.textContent = r ? '@' + r.nickname : '等第一张';
      const cs = document.createElement('span');
      cs.className = 'cs';
      cs.textContent = r && r.score ? r.score : '';
      cap.append(cn, cs);
      sheet.append(shot, cap);
      elStack.appendChild(sheet);
    });
  }

  let toastTimer = 0;
  function toast(text) {
    elToast.textContent = text;
    elToast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('on'), 2600);
  }

  /* ----------------------------------------------------------- websocket */
  let ws = null, retry = 600;
  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/overlay`);
    ws.onopen = () => { retry = 600; idle(); };
    ws.onclose = () => { setTimeout(connect, retry); retry = Math.min(retry * 1.6, 8000); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      const p = m.payload || {};
      switch (m.type) {
        case 'hello':
        case 'queue': showQueue(p); break;
        case 'processing':
          window.__score = p.score;
          elNick.textContent = '@' + p.nickname;
          elSub.textContent = '正在生成简笔画…';
          elHint.textContent = '读头像 → 提取线条 → 排笔顺';
          break;
        case 'draw_start':
          window.__score = p.score || 95;
          start(p); break;
        case 'draw_end':
          idle('下一位准备中…'); break;
        case 'toast':
          toast(p.text || ''); break;
        case 'member':
          break;
      }
    };
  }
  connect();
  setInterval(() => send({ type: 'ping' }), 20000);
  idle();
})();
