/* 自动视频图文工坊 · 前端逻辑 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const S = {
    mode: 'image_text',
    settings: {},
    rows: [],
    runtime: { rows: {}, global: {}, browser: {} },
    result: null,
    seq: 0,
    videoAuto: false,
    videoOneShot: true,
    aiGuide: false,
    characters: [],
    charSig: '',
    hoverPaste: null,
    episodeFiles: [],
    ttsReady: false,
    sig: '',
    refs: new Map(),
    pending: new Set(),
    logCount: 0,
    lastProgress: -1,
    settingsTouched: 0,
    fonts: [],
  };

  /* ---------------------------------------------------------------- 基础 */
  function toast(msg, kind = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast ' + kind;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hide'), 2600);
  }

  async function api(path, options = {}) {
    const opts = { headers: {}, ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    let data = {};
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(path, { ...opts, signal: ctrl.signal });
      data = await res.json();
    } catch (err) {
      setOffline(true);
      toast('后端服务没有响应，请重新双击 启动.bat', 'error');
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (data && data.ok === false) {
      toast(data.error || '操作失败', 'error');
      throw new Error(data.error || 'failed');
    }
    return data;
  }

  function pickFile(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) cb(file);
      setTimeout(() => input.remove(), 100);
    });
    input.click();
  }

  /* ---------------------------------------------------------------- 状态 */
  async function poll() {
    try {
      const res = await fetch(`/api/state?seq=${S.seq}`);
      const data = await res.json();
      S.failCount = 0;
      setOffline(false);
      applyState(data);
      setBrowserDot(data.runtime && data.runtime.browser);
    } catch (err) {
      S.failCount = (S.failCount || 0) + 1;
      // 连续两次拿不到状态才判定后端已退出，避免偶发超时误报
      if (S.failCount >= 2) setOffline(true);
      setBrowserDot({ connected: false, message: '后端未响应' }, true);
    } finally {
      setTimeout(poll, 1500);
    }
  }

  function setOffline(off) {
    const bar = $('#offlineBar');
    if (!bar) return;
    bar.classList.toggle('hide', !off);
    document.body.classList.toggle('is-offline', off);
  }

  function applyState(d) {
    S.mode = d.mode;
    S.settings = d.settings || {};
    S.rows = d.rows || [];
    S.runtime = d.runtime || { rows: {}, global: {}, browser: {} };
    S.result = d.result || null;
    S.seq = d.seq || S.seq;
    if (Array.isArray(d.characters)) S.characters = d.characters;
    if (typeof d.videoAuto === 'boolean') S.videoAuto = d.videoAuto;
    if (typeof d.videoOneShot === 'boolean') S.videoOneShot = d.videoOneShot;
    if (typeof d.aiGuide === 'boolean') S.aiGuide = d.aiGuide;
    if (typeof d.ttsReady === 'boolean') S.ttsReady = d.ttsReady;

    renderMode();
    renderSettings();
    renderCharacters();
    renderRows();
    renderRuntime();
    renderResult();
    renderGlobal();
    appendLogs(d.logs || []);
  }

  /* ---------------------------------------------------------------- 模式 */
  function renderMode() {
    $$('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === S.mode);
    });
    $('#modeHint').textContent = S.mode === 'video'
      ? '每行为：文案 + 图片 + 视频 + 音频。先用图片生成视频，再合成；没有视频的行会用图片兜底。'
      : '每行为：文案 + 图片 + 音频；图片按音频时长合成，自动拼成成片。';
    $('#btnVideos').classList.toggle('hide', S.mode !== 'video');
    $('#btnScanVideos').classList.toggle('hide', S.mode !== 'video');
    $('#btnEpisodes').classList.toggle('hide', S.mode !== 'video');
  }

  /* ---------------------------------------------------------------- 设置 */
  function setValue(el, value) {
    if (!el || document.activeElement === el) return;
    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else if (String(el.value) !== String(value ?? '')) {
      el.value = value ?? '';
    }
  }

  function renderSettings() {
    const s = S.settings || {};
    if (Date.now() - (S.settingsTouched || 0) < 2500) return;
    setValue($('#imageStyle'), s.imageStyle);
    setValue($('#freshChat'), s.freshChat !== false);
    setValue($('#reuseChat'), s.reuseChat !== false);
    setValue($('#chatUrl'), s.chatUrl || '');
    const chatHint = $('#chatUrlHint');
    if (chatHint) chatHint.textContent = s.chatUrl ? '已记录' : '未记录';
    setValue($('#videoAuto'), S.videoAuto);
    setValue($('#videoOneShot'), S.videoOneShot);
    setValue($('#videoNoImage'), !!s.videoNoImage);
    setValue($('#aiGuide'), S.aiGuide);
    setValue($('#voice'), s.voice);
    setValue($('#speed'), s.speed);
    setValue($('#volume'), s.volume);
    setValue($('#canvas'), s.canvas);
    setValue($('#fill'), s.fill);
    setValue($('#zoom'), s.zoom);
    setValue($('#useOriginalAudio'), !!s.useOriginalAudio);
    setValue($('#defaultDur'), s.defaultDur);
    setValue($('#videoSeconds'), s.videoSeconds ?? 10);
    setValue($('#outName'), s.outName);
    setValue($('#bgmVolume'), Math.round((s.bgmVolume ?? 0.2) * 100));
    $('#volumeVal').textContent = s.volume ?? 80;
    $('#bgmVolVal').textContent = Math.round((s.bgmVolume ?? 0.2) * 100) + '%';
    $('#bgmName').textContent = s.bgm ? String(s.bgm).split(/[\\/]/).pop() : '未选择';

    const sub = s.subtitle || {};
    setValue($('#subEnabled'), sub.enabled !== false);
    setValue($('#subFont'), sub.font);
    setValue($('#subSize'), sub.size);
    setValue($('#subColor'), sub.color || '#FFFFFF');
    setValue($('#subStrokeColor'), sub.strokeColor || '#000000');
    setValue($('#subStrokeWidth'), sub.strokeWidth);
    setValue($('#subPosition'), sub.position || 'bottom');
    setValue($('#subMargin'), sub.margin);
    setValue($('#subSplit'), sub.split !== false);
    const subOn = sub.enabled !== false;
    $('#subHint').textContent = subOn ? '开' : '关';
    $('#subHint').classList.toggle('on', subOn);

    const ti = s.title || {};
    setValue($('#titleEnabled'), !!ti.enabled);
    setValue($('#titleOverlay'), ti.overlay !== false);
    setValue($('#titleText'), ti.text);
    setValue($('#titleDuration'), ti.duration);
    setValue($('#titleBg'), ti.bg || '#101522');
    setValue($('#titleFont'), ti.font);
    setValue($('#titleSize'), ti.size);
    setValue($('#titleColor'), ti.color || '#FFFFFF');
    setValue($('#titleStrokeColor'), ti.strokeColor || '#000000');
    setValue($('#titleStrokeWidth'), ti.strokeWidth);
    setValue($('#titlePosition'), ti.position || 'center');
    $('#titleHint').textContent = ti.enabled ? '开' : '关';
    $('#titleHint').classList.toggle('on', !!ti.enabled);
    syncTitleOverlay();
  }

  function syncTitleOverlay() {
    const on = $('#titleOverlay').checked;
    const bg = $('#titleBg');
    if (!bg) return;
    bg.disabled = on;
    const field = bg.closest('.field');
    if (field) field.classList.toggle('dim', on);
  }

  const numOf = (sel, fallback) => {
    const v = parseFloat($(sel).value);
    return Number.isFinite(v) ? v : fallback;
  };

  function collectSettings() {
    return {
      imageStyle: $('#imageStyle').value,
      freshChat: $('#freshChat').checked,
      reuseChat: $('#reuseChat').checked,
      chatUrl: ($('#chatUrl').value || '').trim(),
      voice: $('#voice').value,
      speed: parseFloat($('#speed').value) || 1,
      volume: parseInt($('#volume').value, 10),
      canvas: $('#canvas').value,
      fill: $('#fill').value,
      zoom: $('#zoom').checked,
      videoNoImage: $('#videoNoImage').checked,
      useOriginalAudio: $('#useOriginalAudio').checked,
      defaultDur: parseFloat($('#defaultDur').value) || 3,
      videoSeconds: Math.round(numOf('#videoSeconds', 10)),
      outName: $('#outName').value || '成片',
      bgmVolume: (parseInt($('#bgmVolume').value, 10) || 0) / 100,
      subtitle: {
        enabled: $('#subEnabled').checked,
        font: $('#subFont').value,
        size: numOf('#subSize', 54),
        color: $('#subColor').value,
        strokeColor: $('#subStrokeColor').value,
        strokeWidth: numOf('#subStrokeWidth', 0),
        position: $('#subPosition').value,
        margin: numOf('#subMargin', 0),
        split: $('#subSplit').checked,
      },
      title: {
        enabled: $('#titleEnabled').checked,
        text: $('#titleText').value,
        duration: numOf('#titleDuration', 3),
        overlay: $('#titleOverlay').checked,
        bg: $('#titleBg').value,
        font: $('#titleFont').value,
        size: numOf('#titleSize', 82),
        color: $('#titleColor').value,
        strokeColor: $('#titleStrokeColor').value,
        strokeWidth: numOf('#titleStrokeWidth', 0),
        position: $('#titlePosition').value,
      },
    };
  }

  let settingsTimer = null;
  function pushSettings() {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(async () => {
      try {
        const data = await api('/api/settings', { method: 'POST', body: { settings: collectSettings() } });
        S.settings = data.settings || S.settings;
      } catch (e) { /* 已提示 */ }
    }, 350);
  }

  async function flushSettings() {
    clearTimeout(settingsTimer);
    try {
      const data = await api('/api/settings', { method: 'POST', body: { settings: collectSettings() } });
      S.settings = data.settings || S.settings;
    } catch (e) { /* 已提示 */ }
  }

  /* ---------------------------------------------------------------- 人物 */
  // 只传一张图，里面同时包含正面、侧面、背面三视图
  const CHAR_SLOTS = [
    ['front', '三视图（正/侧/背）'],
  ];

  function renderCharacters() {
    const list = $('#charList');
    if (!list) return;
    const chars = S.characters || [];
    const sig = chars.map(c => c.id).join('|');
    if (sig !== S.charSig) {
      list.innerHTML = '';
      chars.forEach(c => list.appendChild(buildCharCard(c)));
      S.charSig = sig;
    } else {
      chars.forEach(c => patchCharCard(c));
    }
    const hint = $('#charHint');
    if (hint) {
      hint.textContent = chars.length
        ? `${chars.length} 个角色 · 一张三视图`
        : '可添加多个，一张三视图即可';
    }
  }

  function buildCharCard(c) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="char-head">
        <input class="char-name" placeholder="名字（如：小明 / 大黄）" />
        <button class="btn tiny ghost" data-act="del-char">删除</button>
      </div>
      <textarea class="char-desc" rows="2" placeholder="描述：年龄、发型、脸型、服装、体型、气质…"></textarea>
      <input class="char-alias" placeholder="别名（逗号分隔，文案里怎么称呼它，如：母亲, 妈妈）" />
      <div class="char-shots">
        ${CHAR_SLOTS.map(([slot, label]) => `
          <div class="char-shot" data-slot="${slot}">
            <div class="thumb" data-paste="char" data-slot="${slot}"><div class="ph">${label}</div></div>
            <div class="char-shot-ops">
              <button class="btn tiny" data-act="up">上传</button>
              <button class="btn tiny ghost" data-act="clear">×</button>
            </div>
          </div>`).join('')}
      </div>`;

    const nameEl = card.querySelector('.char-name');
    const descEl = card.querySelector('.char-desc');
    const aliasEl = card.querySelector('.char-alias');
    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const data = await api(`/api/characters/${c.id}`, {
            method: 'PATCH',
            body: {
              name: nameEl.value,
              desc: descEl.value,
              aliases: aliasEl.value,
            },
          });
          S.characters = data.characters || S.characters;
        } catch (e) { /* 已提示 */ }
      }, 500);
    };
    nameEl.addEventListener('input', save);
    descEl.addEventListener('input', save);
    aliasEl.addEventListener('input', save);

    card.addEventListener('click', async ev => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'del-char') {
        if (!confirm('删除这个人物设定？')) return;
        try {
          const data = await api(`/api/characters/${c.id}`, { method: 'DELETE' });
          S.characters = data.characters || [];
          S.charSig = '';
          renderCharacters();
        } catch (e) { /* 已提示 */ }
        return;
      }
      const slotEl = btn.closest('.char-shot');
      if (!slotEl) return;
      const slot = slotEl.dataset.slot;
      if (act === 'up') {
        pickFile('image/*', async file => {
          const form = new FormData();
          form.append('file', file);
          slotEl.classList.add('busy');
          try {
            const data = await api(`/api/characters/${c.id}/images/${slot}`, {
              method: 'POST', body: form,
            });
            S.characters = data.characters || [];
            S.charSig = '';
            renderCharacters();
            toast('已上传', 'ok');
          } finally {
            slotEl.classList.remove('busy');
          }
        });
      } else if (act === 'clear') {
        try {
          const data = await api(`/api/characters/${c.id}/images/${slot}`, { method: 'DELETE' });
          S.characters = data.characters || [];
          S.charSig = '';
          renderCharacters();
        } catch (e) { /* 已提示 */ }
      }
    });

    patchCharCard(c, card);
    return card;
  }

  function patchCharCard(c, root) {
    const card = root || $(`.char-card[data-id="${c.id}"]`);
    if (!card) return;
    const nameEl = card.querySelector('.char-name');
    const descEl = card.querySelector('.char-desc');
    if (nameEl && document.activeElement !== nameEl && nameEl.value !== (c.name || '')) {
      nameEl.value = c.name || '';
    }
    if (descEl && document.activeElement !== descEl && descEl.value !== (c.desc || '')) {
      descEl.value = c.desc || '';
    }
    const aliasEl = card.querySelector('.char-alias');
    if (aliasEl && document.activeElement !== aliasEl
        && aliasEl.value !== (c.aliases || '')) {
      aliasEl.value = c.aliases || '';
    }
    CHAR_SLOTS.forEach(([slot, label]) => {
      const box = card.querySelector(`.char-shot[data-slot="${slot}"]`);
      if (!box) return;
      const url = c[slot] || '';
      const thumb = box.querySelector('.thumb');
      if (thumb.dataset.src === url) return;
      thumb.dataset.src = url;
      thumb.innerHTML = url
        ? `<img src="${url}" alt="" />`
        : `<div class="ph">${label}</div>`;
    });
  }

  /* ---------------------------------------------------------------- 分镜 */
  function renderRows() {
    const sig = S.rows.map(r => r.id).join('|') + '::' + S.mode;
    if (sig !== S.sig) {
      rebuildRows();
      S.sig = sig;
    } else {
      patchRows();
    }
    $('#rowCount').textContent = `${S.rows.length} 条`;
  }

  function rebuildRows() {
    const wrap = $('#rows');
    wrap.innerHTML = '';
    S.refs.clear();
    if (!S.rows.length) {
      wrap.innerHTML = `<div class="empty" id="emptyState">
        <div class="empty-ico">▤</div>
        <h3>还没有分镜</h3>
        <p>点击右上角「批量导入文案」，每行文案会自动生成一条分镜；<br />每行可单独生成/替换图片、视频、音频。</p>
      </div>`;
      return;
    }
    S.rows.forEach((row, idx) => wrap.appendChild(buildRow(row, idx)));
    patchRows();
  }

  const KIND_LABEL = { image: '图片', video: '视频', audio: '音频' };
  const KIND_ACCEPT = { image: 'image/*', video: 'video/*', audio: 'audio/*' };
  const KIND_ACTION = { image: '生成', video: '生成', audio: '配音' };

  function buildRow(row, idx) {
    const el = document.createElement('div');
    el.className = 'row-card';
    el.dataset.id = row.id;
    el.innerHTML = `
      <div class="row-top">
        <span class="idx">${String(idx + 1).padStart(2, '0')}</span>
        ${row.episode ? `<span class="ep-badge">第 ${row.episode} 集</span>` : ''}
        <div class="spacer"></div>
        <button class="icon-btn" data-act="up" title="上移">↑</button>
        <button class="icon-btn" data-act="down" title="下移">↓</button>
        <button class="icon-btn" data-act="dup" title="复制">⧉</button>
        <button class="icon-btn del" data-act="del" title="删除">✕</button>
      </div>
      <div class="row-body">
        <textarea class="row-text" placeholder="输入这一段文案…"></textarea>
        <div class="slots"></div>
      </div>`;

    const textarea = $('.row-text', el);
    textarea.value = row.text || '';
    autoSize(textarea);
    textarea.addEventListener('input', () => {
      autoSize(textarea);
      scheduleTextSave(row.id, textarea.value);
    });
    textarea.addEventListener('blur', () => {
      const id = row.id;
      // 失焦立即保存，避免轮询覆盖
      if (S.pending.has(id)) {
        clearTimeout(S['_t_' + id]);
        saveText(id, textarea.value);
      }
    });

    const slotsWrap = $('.slots', el);
    const refs = { el, textarea, slots: {} };
    const kinds = S.mode === 'video' ? ['image', 'video', 'audio'] : ['image', 'audio'];
    kinds.forEach(kind => {
      const slot = buildSlot(row.id, kind);
      refs.slots[kind] = slot;
      slotsWrap.appendChild(slot.root);
    });

    S.refs.set(row.id, refs);
    return el;
  }

  function buildSlot(rowId, kind) {
    const root = document.createElement('div');
    root.className = 'slot';
    root.dataset.kind = kind;
    const showGen = kind !== 'video' || S.videoAuto;
    root.innerHTML = `
      <div class="slot-head">
        <span>${KIND_LABEL[kind]}</span>
        <span class="slot-state">待生成</span>
      </div>
      <div class="thumb"><div class="ph">暂无${KIND_LABEL[kind]}</div></div>
      <div class="slot-actions">
        ${showGen ? `<button class="btn" data-a="gen">${KIND_ACTION[kind]}</button>` : ''}
        <button class="btn" data-a="up">上传</button>
        <button class="btn x" data-a="del" title="移除">×</button>
      </div>
      <div class="slot-overlay"><div class="spinner"></div><span>处理中…</span></div>`;

    const refs = {
      root,
      state: $('.slot-state', root),
      thumb: $('.thumb', root),
      overlayText: $('.slot-overlay span', root),
    };
    if (kind === 'image') {
      // 鼠标悬停在缩略图上时，Ctrl+V 可以直接把剪贴板里的图片贴进来
      refs.thumb.dataset.paste = 'row-image';
      refs.thumb.dataset.row = rowId;
    }

    root.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-a]');
      if (!btn) {
        const media = refs.thumb.querySelector('img, video');
        if (media && media.dataset.full) openModal(kind, media.dataset.full);
        return;
      }
      const action = btn.dataset.a;
      try {
        if (action === 'gen') await genOne(rowId, kind);
        else if (action === 'up') {
          pickFile(KIND_ACCEPT[kind], file => uploadMedia(rowId, kind, file));
        } else if (action === 'del') {
          if (!confirm(`确定移除这一段的${KIND_LABEL[kind]}吗？`)) return;
          await api(`/api/rows/${rowId}/media/${kind}`, { method: 'DELETE' });
          toast('已移除', 'ok');
        }
      } catch (e) { /* 已提示 */ }
    });

    return refs;
  }

  function autoSize(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(108, el.scrollHeight) + 'px';
  }

  function scheduleTextSave(id, value) {
    S.pending.add(id);
    clearTimeout(S['_t_' + id]);
    S['_t_' + id] = setTimeout(() => saveText(id, value), 700);
  }

  async function saveText(id, value) {
    try {
      await api(`/api/rows/${id}`, { method: 'PATCH', body: { text: value } });
    } catch (e) { /* 已提示 */ }
    finally {
      S.pending.delete(id);
      const ref = S.refs.get(id);
      if (ref && ref.textarea.value === value) { /* 同步完成 */ }
    }
  }

  function patchRows() {
    S.rows.forEach((row, idx) => {
      const ref = S.refs.get(row.id);
      if (!ref) return;
      const card = ref.el;
      card.querySelector('.idx').textContent = String(idx + 1).padStart(2, '0');

      if (!S.pending.has(row.id) && document.activeElement !== ref.textarea
          && ref.textarea.value !== (row.text || '')) {
        ref.textarea.value = row.text || '';
        autoSize(ref.textarea);
      }

      Object.keys(ref.slots).forEach(kind => {
        const status = (S.runtime.rows?.[row.id] || {})[kind];
        applySlot(ref.slots[kind], kind, row[kind], status);
      });
    });
  }

  function applySlot(slot, kind, url, status) {
    const next = url || '';
    if (slot.root.dataset.src !== next) {
      slot.root.dataset.src = next;
      renderThumb(slot, kind, next);
    }

    const st = status && status.state;
    slot.root.classList.remove('busy');
    slot.state.className = 'slot-state';

    if (st === 'running') {
      slot.root.classList.add('busy');
      slot.state.textContent = '处理中';
      slot.state.classList.add('running');
      slot.overlayText.textContent = (status.msg || '处理中') + '…';
    } else if (st === 'error') {
      slot.state.textContent = '失败';
      slot.state.classList.add('error');
      slot.state.title = status.msg || '';
    } else if (st === 'cancelled') {
      slot.state.textContent = '已取消';
      slot.state.title = '已取消，可重新生成';
    } else if (next) {
      slot.state.textContent = st === 'done' ? '已生成' : '已就绪';
      slot.state.classList.add('done');
      slot.state.title = '';
    } else {
      slot.state.textContent = '待生成';
      slot.state.title = '';
    }
  }

  function renderThumb(slot, kind, url) {
    const thumb = slot.thumb;
    if (!url) {
      thumb.innerHTML = `<div class="ph">暂无${KIND_LABEL[kind]}</div>`;
      return;
    }
    if (kind === 'image') {
      thumb.innerHTML = `<img src="${url}" alt="" />`;
      const img = thumb.querySelector('img');
      img.dataset.full = url;
    } else if (kind === 'video') {
      thumb.innerHTML = `<video src="${url}" preload="metadata" muted playsinline></video>
        <div class="play-badge"><span>▶</span></div>`;
      thumb.querySelector('video').dataset.full = url;
    } else {
      thumb.innerHTML = `<div class="audio-inline"><audio controls preload="metadata" src="${url}"></audio></div>`;
    }
  }

  /* ---------------------------------------------------------------- 生成 */
  async function genOne(rowId, kind) {
    const path = kind === 'image' ? `/api/generate/images/${rowId}`
      : kind === 'video' ? `/api/generate/videos/${rowId}`
        : `/api/generate/audios/${rowId}`;
    await api(path, { method: 'POST' });
    toast('任务已提交，进度见分镜状态', 'ok');
  }

  async function pasteUpload(target, file) {
    const kind = target.dataset.paste;
    if (kind === 'row-image') {
      const rowId = target.dataset.row;
      if (!rowId) return;
      await uploadMedia(rowId, 'image', file);
      return;
    }
    if (kind === 'char') {
      const card = target.closest('.char-card');
      if (!card) return;
      const box = target.closest('.char-shot') || target;
      const form = new FormData();
      form.append('file', file, 'paste.png');
      box.classList.add('busy');
      try {
        const data = await api(`/api/characters/${card.dataset.id}/images/${target.dataset.slot}`, {
          method: 'POST', body: form,
        });
        S.characters = data.characters || [];
        S.charSig = '';
        renderCharacters();
        toast('已粘贴三视图', 'ok');
      } finally {
        box.classList.remove('busy');
      }
    }
  }

  async function uploadMedia(rowId, kind, file) {
    const ref = S.refs.get(rowId);
    if (ref && ref.slots[kind]) {
      ref.slots[kind].root.classList.add('busy');
      ref.slots[kind].overlayText.textContent = '上传中…';
    }
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    try {
      await api(`/api/rows/${rowId}/media`, { method: 'POST', body: form });
      toast('上传成功', 'ok');
    } finally {
      if (ref && ref.slots[kind]) ref.slots[kind].root.classList.remove('busy');
    }
  }

  async function importEpisodes(start) {
    const text = $('#episodeText').value.trim();
    const files = S.episodeFiles || [];
    if (!text && !files.length) {
      toast('请先选择分集文件，或粘贴剧集内容', 'error');
      return;
    }
    try {
      const per = parseInt($('#episodePer').value, 10) || 6;
      const body = {
        per,
        replace: $('#episodeReplace').checked,
        keep_first: $('#episodeKeepFirst').checked,
      };
      if (files.length) body.files = files;
      else body.text = text;
      const data = await api('/api/episodes/import', { method: 'POST', body });
      S.episodeFiles = [];
      const fileInput = $('#episodeFiles');
      if (fileInput) fileInput.value = '';
      const fileHint = $('#episodeFileHint');
      if (fileHint) {
        fileHint.textContent = '未选择文件（支持一次选多个 txt，按文件名识别集号）';
      }
      S.sig = '';
      const st = await (await fetch('/api/state?seq=' + S.seq)).json();
      applyState(st);
      const eps = data.episodes || [];
      const rows = data.rows || [];
      toast(`已导入 ${eps.length} 集，共 ${rows.length} 条分镜`, 'ok');
      $('#episodePanel').classList.add('hide');
      if (start) {
        await api('/api/generate/episodes', { method: 'POST' });
        toast('已开始逐集生成，进度见左侧日志', 'ok');
      }
    } catch (e) { /* 已提示 */ }
  }

  /* ---------------------------------------------------------------- 全局 */
  function isAnyBusy() {
    const g = S.runtime.global || {};
    const task = S.runtime.task || {};
    if (g.running || task.running) return true;
    return Object.values(S.runtime.rows || {}).some(
      k => k.image?.state === 'running' || k.audio?.state === 'running' || k.video?.state === 'running'
    );
  }

  function renderRuntime() {
    const busy = isAnyBusy();
    ['#btnRunAll', '#btnImages', '#btnAudios', '#btnVideos', '#btnScanImages', '#btnScanVideos',
      '#btnStitch', '#btnAddRow', '#btnClear', '#btnToggleImport', '#btnEpisodes',
      '#btnToggleEpisode', '#btnImportEpisodes', '#btnImportEpisodesRun',
      '#btnPickEpisodes', '#episodeReplace', '#episodeKeepFirst'].forEach(sel => {
      const el = $(sel);
      if (el) el.disabled = busy;
    });
    $('#btnStop').classList.toggle('hide', !busy);
  }

  function renderGlobal() {
    const g = S.runtime.global || {};
    const task = S.runtime.task || {};
    const running = !!g.running || !!task.running;
    const bar = $('#globalProgress');
    bar.classList.toggle('hide', !running && !(g.progress > 0));

    const pct = Math.round((g.progress || 0) * 100);
    const fill = $('.progress-bar i', bar);
    if (running && !g.running) {
      fill.classList.add('indeterminate');
      fill.style.width = '38%';
    } else {
      fill.classList.remove('indeterminate');
      fill.style.width = pct + '%';
    }

    let label = '';
    if (g.running) label = `${g.label || ''} ${pct ? pct + '%' : ''}`;
    else if (task.running) label = `${task.kind || '任务'} 进行中…（可点「停止任务」取消）`;
    $('.progress-label', bar).textContent = label.trim();
  }

  function setBrowserDot(info, error = false) {
    const dot = $('#browserDot');
    const text = $('#browserText');
    if (!info) return;
    const connected = !!info.connected;
    dot.className = 'dot' + (error ? ' err' : connected ? ' on' : '');
    text.textContent = info.message || (connected ? '已连接' : '未启动');
    $('#btnBrowser').textContent = connected ? '打开豆包' : '启动浏览器';
  }

  function renderResult() {
    const card = $('#resultCard');
    const res = S.result;
    if (!res || !res.url) {
      card.classList.add('hide');
      return;
    }
    card.classList.remove('hide');
    const video = $('#resultVideo');
    if (video.dataset.src !== res.url) {
      video.dataset.src = res.url;
      video.src = res.url;
      video.load();
    }
    $('#resultMeta').textContent =
      `${res.segments || 0} 段 · ${res.duration || 0} 秒 · ${res.created || ''}`;
    $('#resultDownload').href = res.url;
    $('#resultDownload').download = res.file || '成片.mp4';
  }

  function appendLogs(items) {
    if (!items.length) return;
    const box = $('#logBox');
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    items.forEach(item => {
      const line = document.createElement('div');
      line.className = 'log-line ' + (item.level || 'info');
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = item.t;
      const m = document.createElement('span');
      m.className = 'm';
      m.textContent = item.msg;
      line.append(t, m);
      box.appendChild(line);
      S.logCount += 1;
    });
    while (box.children.length > 400) box.removeChild(box.firstChild);
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  /* ---------------------------------------------------------------- 弹层 */
  function openModal(kind, url) {
    const modal = $('#modal');
    const content = $('#modalContent');
    content.innerHTML = kind === 'video'
      ? `<video src="${url}" controls autoplay playsinline></video>`
      : `<img src="${url}" alt="" />`;
    modal.classList.remove('hide');
  }

  function closeModal() {
    $('#modal').classList.add('hide');
    $('#modalContent').innerHTML = '';
  }

  /* ---------------------------------------------------------------- 事件 */
  function bind() {
    $$('.mode-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (btn.dataset.mode === S.mode) return;
      try {
        await api('/api/mode', { method: 'POST', body: { mode: btn.dataset.mode } });
        S.mode = btn.dataset.mode;
        S.sig = '';
        renderMode();
        renderRows();
        toast(btn.dataset.mode === 'video' ? '已切换到视频成片' : '已切换到图文成片', 'ok');
      } catch (e) { /* 已提示 */ }
    }));

    $('#btnBrowser').addEventListener('click', async () => {
      const wasConnected = !!(S.runtime.browser && S.runtime.browser.connected);
      try {
        await api('/api/browser/start', { method: 'POST' });
        toast(wasConnected ? '正在打开豆包页面…' : '正在启动浏览器，约需 10 秒…', 'ok');
      } catch (e) { /* api 已提示并标记离线 */ }
    });

    $('#videoAuto').addEventListener('change', async ev => {
      try {
        await api('/api/config', { method: 'POST', body: { video_auto_enabled: ev.target.checked } });
        S.videoAuto = ev.target.checked;
        S.sig = '';
        renderRows();
        toast(ev.target.checked ? '已启用豆包自动生视频（需先在浏览器登录豆包）' : '已关闭自动生视频', 'ok');
      } catch (e) { /* 已提示 */ }
    });

    $('#videoOneShot').addEventListener('change', async ev => {
      try {
        await api('/api/config', { method: 'POST', body: { video_one_shot: ev.target.checked } });
        S.videoOneShot = ev.target.checked;
        toast(ev.target.checked
          ? '批量生视频会一次性上传全部图片，用一条 @文件名 文案提交'
          : '已改回逐条提交视频', 'ok');
      } catch (e) { /* 已提示 */ }
    });

    $('#aiGuide').addEventListener('change', async ev => {
      try {
        await api('/api/config', { method: 'POST', body: { ai_guide_enabled: ev.target.checked } });
        S.aiGuide = ev.target.checked;
        toast(ev.target.checked ? '已启用 AI 自动推进' : '已关闭 AI 自动推进', 'ok');
      } catch (e) { /* 已提示 */ }
    });

    ['#imageStyle', '#freshChat', '#reuseChat', '#chatUrl', '#voice', '#speed', '#volume', '#canvas', '#fill',
      '#zoom', '#useOriginalAudio', '#videoNoImage', '#defaultDur', '#videoSeconds', '#outName', '#bgmVolume',
      '#subEnabled', '#subFont', '#subSize', '#subColor', '#subStrokeColor',
      '#subStrokeWidth', '#subPosition', '#subMargin', '#subSplit',
      '#titleEnabled', '#titleOverlay', '#titleText', '#titleDuration', '#titleBg', '#titleFont',
      '#titleSize', '#titleColor', '#titleStrokeColor', '#titleStrokeWidth',
      '#titlePosition'].forEach(sel => {
      const el = $(sel);
      el.addEventListener('change', () => {
        S.settingsTouched = Date.now();
        if (sel === '#titleOverlay') syncTitleOverlay();
        pushSettings();
      });
      if (el.type === 'range' || el.type === 'color' || el.tagName === 'TEXTAREA') {
        el.addEventListener('input', () => {
          S.settingsTouched = Date.now();
          if (sel === '#volume') $('#volumeVal').textContent = el.value;
          if (sel === '#bgmVolume') $('#bgmVolVal').textContent = el.value + '%';
          pushSettings();
        });
      }
    });

    $('#btnBgm').addEventListener('click', () => {
      pickFile('audio/*', async file => {
        const form = new FormData();
        form.append('file', file);
        try {
          const data = await api('/api/settings/bgm', { method: 'POST', body: form });
          S.settings = data.settings;
          renderSettings();
          toast('背景音乐已设置', 'ok');
        } catch (e) { /* 已提示 */ }
      });
    });

    $('#btnBgmClear').addEventListener('click', async () => {
      try {
        const data = await api('/api/settings/bgm', { method: 'DELETE' });
        S.settings = data.settings;
        renderSettings();
      } catch (e) { /* 已提示 */ }
    });

    // 鼠标悬停在图片槽 / 三视图槽上时，Ctrl+V 直接粘贴剪贴板里的图片
    document.addEventListener('mouseover', ev => {
      const el = ev.target.closest && ev.target.closest('[data-paste]');
      if (el) S.hoverPaste = el;
    });
    document.addEventListener('mouseout', ev => {
      const el = ev.target.closest && ev.target.closest('[data-paste]');
      if (!el || S.hoverPaste !== el) return;
      const to = ev.relatedTarget && ev.relatedTarget.closest
        ? ev.relatedTarget.closest('[data-paste]') : null;
      if (to !== el) S.hoverPaste = null;
    });
    document.addEventListener('paste', async ev => {
      const target = S.hoverPaste;
      if (!target) return;
      const items = Array.from((ev.clipboardData && ev.clipboardData.items) || []);
      const item = items.find(it => it.type && it.type.indexOf('image/') === 0);
      if (!item) return;
      ev.preventDefault();
      const file = item.getAsFile();
      if (file) await pasteUpload(target, file);
    });

    $('#btnAddChar').addEventListener('click', async () => {
      try {
        const data = await api('/api/characters', {
          method: 'POST', body: { name: '', desc: '' },
        });
        S.characters = data.characters || [];
        S.charSig = '';
        renderCharacters();
        const cards = $$('.char-card');
        const last = cards[cards.length - 1];
        if (last) last.querySelector('.char-name').focus();
      } catch (e) { /* 已提示 */ }
    });

    $('#btnToggleEpisode').addEventListener('click', () => {
      const panel = $('#episodePanel');
      panel.classList.toggle('hide');
      if (!panel.classList.contains('hide')) $('#episodeText').focus();
    });
    $('#btnEpisodeCancel').addEventListener('click', () => {
      $('#episodePanel').classList.add('hide');
    });
    $('#episodeReplace').addEventListener('change', ev => {
      if (ev.target.checked) $('#episodeKeepFirst').checked = false;
    });
    $('#episodeKeepFirst').addEventListener('change', ev => {
      if (ev.target.checked) $('#episodeReplace').checked = false;
    });
    $('#btnPickEpisodes').addEventListener('click', () => $('#episodeFiles').click());
    $('#episodeFiles').addEventListener('change', async ev => {
      const picked = Array.from(ev.target.files || []);
      S.episodeFiles = [];
      for (const file of picked) {
        try {
          S.episodeFiles.push({ name: file.name, text: await file.text() });
        } catch (e) { /* 跳过读不了的文件 */ }
      }
      const hint = $('#episodeFileHint');
      if (hint) {
        hint.textContent = S.episodeFiles.length
          ? `已选择 ${S.episodeFiles.length} 个分集文件`
          : '未选择文件（支持一次选多个 txt，按文件名识别集号）';
      }
    });
    $('#btnImportEpisodes').addEventListener('click', () => importEpisodes(false));
    $('#btnImportEpisodesRun').addEventListener('click', () => importEpisodes(true));

    $('#btnToggleImport').addEventListener('click', () => {
      const panel = $('#importPanel');
      panel.classList.toggle('hide');
      if (!panel.classList.contains('hide')) $('#importText').focus();
    });
    $('#btnImportCancel').addEventListener('click', () => $('#importPanel').classList.add('hide'));

    $('#btnImport').addEventListener('click', async () => {
      const text = $('#importText').value.trim();
      if (!text) return toast('请先粘贴文案', 'error');
      try {
        await api('/api/rows/import', {
          method: 'POST',
          body: { text, replace: $('#replaceAll').checked },
        });
        $('#importText').value = '';
        $('#importPanel').classList.add('hide');
        S.sig = '';
        toast('文案已导入', 'ok');
        const st = await (await fetch('/api/state?seq=' + S.seq)).json();
        applyState(st);
      } catch (e) { /* 已提示 */ }
    });

    $('#importText').addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') $('#btnImport').click();
    });

    $('#btnAddRow').addEventListener('click', async () => {
      try {
        await api('/api/rows', { method: 'POST', body: { text: '' } });
        S.sig = '';
        const st = await (await fetch('/api/state?seq=' + S.seq)).json();
        applyState(st);
        const cards = $$('.row-card');
        const last = cards[cards.length - 1];
        if (last) { last.querySelector('.row-text').focus(); last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } catch (e) { /* 已提示 */ }
    });

    $('#btnClear').addEventListener('click', async () => {
      if (!confirm('确定清空所有分镜吗？已生成的媒体文件仍保留在 data 目录。')) return;
      try {
        await api('/api/rows', { method: 'DELETE' });
        S.sig = '';
        const st = await (await fetch('/api/state?seq=' + S.seq)).json();
        applyState(st);
      } catch (e) { /* 已提示 */ }
    });

    // 行内按钮
    $('#rows').addEventListener('click', async ev => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const card = btn.closest('.row-card');
      if (!card) return;
      const id = card.dataset.id;
      const act = btn.dataset.act;
      try {
        if (act === 'del') {
          if (!confirm('删除这一条分镜？')) return;
          await api(`/api/rows/${id}`, { method: 'DELETE' });
        } else if (act === 'dup') {
          await api(`/api/rows/${id}/duplicate`, { method: 'POST' });
        } else if (act === 'up' || act === 'down') {
          await api(`/api/rows/${id}/move`, {
            method: 'POST', body: { offset: act === 'up' ? -1 : 1 },
          });
        }
        S.sig = '';
        const st = await (await fetch('/api/state?seq=' + S.seq)).json();
        applyState(st);
      } catch (e) { /* 已提示 */ }
    });

    // 顶部动作
    const post = path => async () => {
      try {
        if (path === '/api/stitch' || path === '/api/run') {
          await flushSettings();
        }
        await api(path, { method: 'POST' });
        toast('任务已提交，请查看日志与分镜状态', 'ok');
      } catch (e) { /* 已提示 */ }
    };
    $('#btnImages').addEventListener('click', post('/api/generate/images'));
    $('#btnAudios').addEventListener('click', post('/api/generate/audios'));
    $('#btnVideos').addEventListener('click', post('/api/generate/videos'));
    $('#btnScanImages').addEventListener('click', post('/api/scan/images'));
    $('#btnScanVideos').addEventListener('click', post('/api/scan/videos'));
    $('#btnEpisodes').addEventListener('click', post('/api/generate/episodes'));
    $('#btnStitch').addEventListener('click', post('/api/stitch'));
    $('#btnRunAll').addEventListener('click', post('/api/run'));
    $('#btnStop').addEventListener('click', async () => {
      const btn = $('#btnStop');
      btn.disabled = true;
      btn.textContent = '正在停止…';
      try {
        await api('/api/stop', { method: 'POST' });
        toast('已发送停止指令，稍候即可重试', 'ok');
      } catch (e) { /* 已提示 */ }
      setTimeout(() => { btn.disabled = false; btn.textContent = '停止任务'; }, 1500);
    });
    $('#btnOpenFolder').addEventListener('click', async () => {
      try { await api('/api/output/open', { method: 'POST' }); } catch (e) { /* 已提示 */ }
    });

    $('#btnClearLog').addEventListener('click', () => {
      $('#logBox').innerHTML = '';
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', ev => {
      if (ev.target.id === 'modal') closeModal();
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') closeModal();
    });
  }

  /* ---------------------------------------------------------------- 启动 */
  async function loadFonts() {
    try {
      const res = await fetch('/api/fonts');
      const data = await res.json();
      const fonts = data.fonts || [];
      S.fonts = fonts;
      ['#subFont', '#titleFont'].forEach(sel => {
        const el = $(sel);
        if (!el) return;
        el.innerHTML = '';
        fonts.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.file || '';
          opt.textContent = f.name;
          el.appendChild(opt);
        });
      });
    } catch (e) {
      S.fonts = [];
    }
  }

  bind();
  loadFonts().finally(() => poll());
})();
