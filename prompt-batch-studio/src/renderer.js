'use strict';

(function () {
const api = window.api;
const $ = (sel, root) => (root || document).querySelector(sel);

const state = {
  projects: [],
  settings: null,
  selectedId: null,
  run: {
    active: false,
    paused: false,
    finished: false,
    total: 0,
    done: 0,
    failed: 0,
    index: 0,
    currentId: null,
    currentTitle: '',
    phase: '',
    message: '',
    remaining: null,
    startedAt: 0,
    elapsed: 0
  },
  logs: []
};

let settingsDraft = null;
let previewTimer = null;
let clockTimer = null;

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mediaUrl(p) {
  return 'media://local/' + encodeURI(String(p).replace(/\\/g, '/'));
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function statusText(s) {
  return { pending: '待执行', running: '执行中', done: '已完成', failed: '失败' }[s] || '待执行';
}

let toastTimer = null;
function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ------------------------------------------------------------------ */
/* 项目保存（防抖）                                                     */
/* ------------------------------------------------------------------ */

const pendingPatch = new Map();
let saveTimer = null;

function queueSave(id, patch) {
  const merged = Object.assign(pendingPatch.get(id) || {}, patch);
  pendingPatch.set(id, merged);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 350);
}

async function flushSave() {
  if (!pendingPatch.size) return;
  const entries = Array.from(pendingPatch.entries());
  pendingPatch.clear();
  for (const [id, patch] of entries) {
    await api.updateProject(id, patch);
  }
}

/* ------------------------------------------------------------------ */
/* 渲染：项目列表                                                       */
/* ------------------------------------------------------------------ */

async function deleteProjectById(id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  if (state.run.active) {
    toast('批量执行中，先停止再删除', true);
    return;
  }
  if (!confirm(`确定删除「${p.title || '未命名项目'}」？\n磁盘上的项目文件夹不会被删除。`)) return;

  await api.deleteProject(id);
  const idx = state.projects.findIndex((x) => x.id === id);
  if (idx < 0) return;
  state.projects.splice(idx, 1);

  if (state.selectedId === id) {
    const next = state.projects[Math.min(idx, state.projects.length - 1)];
    state.selectedId = next ? next.id : null;
  }
  renderList();
  renderEditor();
  toast('项目已删除');
}

function renderList() {
  const list = $('#projectList');
  $('#projectCount').textContent = state.projects.length;
  if (!state.projects.length) {
    list.innerHTML = '<div style="color:#5f6779;font-size:12px;text-align:center;padding:26px 10px;">还没有项目<br/>点击下方「新建项目」开始</div>';
    return;
  }

  list.innerHTML = '';
  state.projects.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'project-item';
    if (p.id === state.selectedId) el.classList.add('active');
    if (p.status === 'running') el.classList.add('running');

    const att = p.attachments || [];
    el.innerHTML = `
      <div class="pi-check ${p.enabled ? 'on' : ''}">✓</div>
      <div class="pi-body">
        <div class="pi-title">${esc(p.title || '未命名项目')}</div>
        <div class="pi-meta">
          <span class="dot ${p.status}"></span>
          <span>${statusText(p.status)}</span>
          ${att.length ? `<span>· ${att.length} 个附件</span>` : ''}
        </div>
      </div>
      <div class="pi-index">${i + 1}</div>
      <button class="pi-del" title="删除项目">✕</button>
    `;

    el.querySelector('.pi-check').addEventListener('click', async (e) => {
      e.stopPropagation();
      p.enabled = !p.enabled;
      renderList();
      await api.updateProject(p.id, { enabled: p.enabled });
    });

    el.querySelector('.pi-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteProjectById(p.id);
    });

    el.addEventListener('click', () => {
      state.selectedId = p.id;
      renderList();
      renderEditor();
    });

    list.appendChild(el);
  });
}

/* ------------------------------------------------------------------ */
/* 渲染：编辑器                                                        */
/* ------------------------------------------------------------------ */

function getSelected() {
  return state.projects.find((p) => p.id === state.selectedId) || null;
}

function applyProject(updated) {
  if (!updated) return;
  const idx = state.projects.findIndex((p) => p.id === updated.id);
  if (idx >= 0) state.projects[idx] = updated;
  renderList();
  renderEditor();
}

function renderEditor() {
  const editor = $('#editor');
  const p = getSelected();

  if (!p) {
    editor.innerHTML = `
      <div class="editor-empty">
        <div class="big">◈</div>
        <div>${state.projects.length ? '选择左侧项目开始编辑' : '还没有项目，先建一个吧'}</div>
        <button class="primary-btn" id="btnEmptyAdd" style="margin-top:6px;">＋ 新建项目</button>
      </div>`;
    $('#btnEmptyAdd').addEventListener('click', createProject);
    return;
  }

  const index = state.projects.findIndex((x) => x.id === p.id) + 1;

  editor.innerHTML = `
    <div class="editor-head">
      <input class="title-input" id="pTitle" value="${esc(p.title)}" placeholder="项目名称" />
      <div class="icon-actions">
        <button id="pUp" title="上移">↑</button>
        <button id="pDown" title="下移">↓</button>
        <button id="pDup" title="复制项目">⧉</button>
        <button id="pDel" class="danger" title="删除项目">✕</button>
      </div>
    </div>

    <div class="dir-bar">
      <span class="dir-label">工作目录</span>
      <code class="dir-path" id="pDir" title="${esc(p.folder || '')}">${esc(p.folder || '（未分配）')}</code>
      <button class="dir-btn" id="btnOpenDir">打开文件夹</button>
      <button class="dir-btn" id="btnCopyDir">复制路径</button>
    </div>

    <div class="field">
      <div class="field-label">
        <span>需求详情</span>
        <span class="hint">这一段就是发送给 AI 的提示词主体</span>
      </div>
      <textarea class="details" id="pDetails" placeholder="用中文描述这个项目要做什么，越具体越好…">${esc(p.details)}</textarea>
    </div>

    <div class="field">
      <div class="field-label">
        <span>图片与附件</span>
        <span class="hint">图片会粘贴进输入框；其他文件会把本机路径写进提示词</span>
      </div>
      <div class="drop-zone" id="dropZone">拖拽文件到这里 · 或点击选择图片 / 附件</div>
      <div class="attach-grid" id="attachGrid"></div>
    </div>

    <div class="row-2">
      <div class="field">
        <div class="field-label"><span>本项目单独等待时长</span><span class="hint">留空用全局设置</span></div>
        <input class="input" id="pWait" type="number" min="0" placeholder="秒，例如 180"
               value="${p.waitSeconds || ''}" />
      </div>
      <div class="field">
        <div class="field-label"><span>当前状态</span><span class="hint">第 ${index} 个执行</span></div>
        <input class="input" value="${statusText(p.status)}${p.note ? ' · ' + esc(p.note) : ''}" disabled />
      </div>
    </div>

    <div class="field">
      <div class="field-label"><span>最终提示词预览</span><span class="hint">实际发送内容</span></div>
      <div class="preview-box" id="pPreview">生成中…</div>
    </div>
  `;

  const titleEl = $('#pTitle');
  titleEl.addEventListener('input', () => {
    p.title = titleEl.value;
    queueSave(p.id, { title: p.title });
    const item = $('#projectList').children[state.projects.indexOf(p)];
    if (item) item.querySelector('.pi-title').textContent = p.title || '未命名项目';
    schedulePreview();
  });

  const dirEl = $('#pDir');
  if (dirEl && p.id) {
    api.projectDir(p.id).then((dir) => {
      const el = $('#pDir');
      if (el && dir) {
        el.textContent = dir;
        el.title = dir;
      }
    });
  }
  $('#btnOpenDir').addEventListener('click', () => api.openProjectFolder(p.id));
  $('#btnCopyDir').addEventListener('click', async () => {
    const dir = await api.projectDir(p.id);
    if (!dir) return;
    await api.copyText(dir);
    toast('工作目录路径已复制');
  });

  const detailsEl = $('#pDetails');
  detailsEl.addEventListener('input', () => {
    p.details = detailsEl.value;
    queueSave(p.id, { details: p.details });
    schedulePreview();
  });

  $('#pWait').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    p.waitSeconds = Number.isFinite(v) && v > 0 ? v : null;
    queueSave(p.id, { waitSeconds: p.waitSeconds });
  });

  $('#pUp').addEventListener('click', () => moveProject(p, -1));
  $('#pDown').addEventListener('click', () => moveProject(p, 1));
  $('#pDup').addEventListener('click', async () => {
    await flushSave();
    const copy = await api.duplicateProject(p.id);
    if (copy) {
      await reloadProjects(copy.id);
      toast('已复制项目');
    }
  });
  $('#pDel').addEventListener('click', () => deleteProjectById(p.id));

  renderAttachments(p);

  const dz = $('#dropZone');
  dz.addEventListener('click', async () => {
    const updated = await api.pickAttachments(p.id);
    applyProject(updated);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove('drag');
    })
  );
  dz.addEventListener('drop', async (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    const paths = files.map((f) => api.getPathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    const updated = await api.addAttachmentPaths(p.id, paths);
    applyProject(updated);
  });

  schedulePreview();
}

function renderAttachments(p) {
  const grid = $('#attachGrid');
  if (!grid) return;
  const list = p.attachments || [];
  if (!list.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = '';
  list.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'attach-item';
    el.title = `${a.name}\n${a.path}\n${fmtSize(a.size)}`;
    el.innerHTML = `
      <div class="attach-thumb">
        ${a.isImage ? `<img src="${mediaUrl(a.path)}" />` : '<span>📄</span>'}
      </div>
      <div class="attach-name">${esc(a.name)}</div>
      <button class="attach-del" title="移除">✕</button>
    `;
    el.addEventListener('click', () => api.openAttachment(a.path));
    el.querySelector('.attach-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      const updated = await api.removeAttachment(p.id, a.id);
      applyProject(updated);
    });
    grid.appendChild(el);
  });
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 220);
}

async function refreshPreview() {
  const p = getSelected();
  const box = $('#pPreview');
  if (!p || !box) return;
  const index = state.projects.findIndex((x) => x.id === p.id) + 1;
  const text = await api.previewPrompt(
    { title: p.title, details: p.details, attachments: p.attachments, folder: p.folder },
    index,
    state.projects.length
  );
  box.textContent = text || '（空）';
}

async function moveProject(p, dir) {
  await api.moveProject(p.id, dir);
  const idx = state.projects.findIndex((x) => x.id === p.id);
  const next = idx + dir;
  if (next < 0 || next >= state.projects.length) return;
  const [item] = state.projects.splice(idx, 1);
  state.projects.splice(next, 0, item);
  renderList();
  renderEditor();
}

async function createProject() {
  await flushSave();
  const p = await api.createProject();
  state.projects.push(p);
  state.selectedId = p.id;
  renderList();
  renderEditor();
  setTimeout(() => {
    const t = $('#pTitle');
    if (t) {
      t.focus();
      t.select();
    }
  }, 30);
}

async function reloadProjects(selectId) {
  const data = await api.getStore();
  state.projects = data.projects;
  state.settings = data.settings;
  if (selectId) state.selectedId = selectId;
  renderList();
  renderEditor();
}

/* ------------------------------------------------------------------ */
/* 渲染：执行面板                                                       */
/* ------------------------------------------------------------------ */

function renderRun() {
  const r = state.run;
  const total = r.total || 0;
  const finished = r.done + r.failed;
  const pct = total ? Math.min(100, (finished / total) * 100) : 0;

  let badge = '空闲';
  let badgeCls = '';
  if (r.active) {
    badge = r.paused ? '已暂停' : '运行中';
    badgeCls = r.paused ? 'paused' : 'running';
  } else if (r.finished) {
    badge = '已完成';
    badgeCls = 'done';
  }

  let main = '准备就绪';
  let sub = '勾选左侧项目后，点击开始批量执行';
  if (r.active || r.finished) {
    if (r.currentTitle) {
      main = `${r.index}/${total} · ${r.currentTitle}`;
    }
    if (r.message) sub = r.message;
    else if (r.active) sub = '正在处理…';
  }

  $('#runStatus').innerHTML = `
    <div class="status-top">
      <span class="status-badge ${badgeCls}">${badge}</span>
      ${r.remaining != null && r.active ? `<span class="status-sub">倒计时 ${r.remaining}s</span>` : ''}
    </div>
    <div class="status-main" title="${esc(main)}">${esc(main)}</div>
    <div class="status-sub">${esc(sub)}</div>
    <div class="progress-bar"><i style="width:${pct}%"></i></div>
    <div class="progress-meta">
      <span>已处理 ${finished}/${total || '—'}</span>
      <span>${r.active || r.finished ? fmtDur(r.elapsed) : '—'}</span>
    </div>
  `;

  const box = $('#runButtons');
  if (!r.active) {
    box.innerHTML = `<button class="primary-btn" id="btnRun" style="grid-column: span 2">▶ 开始批量执行</button>`;
    $('#btnRun').addEventListener('click', startRun);
  } else {
    box.innerHTML = `
      <button class="sec-btn" id="btnPauseResume">${r.paused ? '▶ 继续' : '⏸ 暂停'}</button>
      <button class="sec-btn" id="btnSkip">⏭ 跳过当前</button>
      <button class="sec-btn danger" id="btnStop" style="grid-column: span 2">■ 停止批量执行</button>
    `;
    $('#btnPauseResume').addEventListener('click', async () => {
      if (state.run.paused) await api.resumeRun();
      else await api.pauseRun();
    });
    $('#btnSkip').addEventListener('click', () => api.skipRun());
    $('#btnStop').addEventListener('click', () => api.stopRun());
  }
}

function renderLog() {
  const box = $('#logList');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = state.logs
    .map(
      (l) =>
        `<div class="log-line"><span class="log-time">${l.time}</span><span class="log-text ${l.level || ''}">${esc(
          l.message
        )}</span></div>`
    )
    .join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function pushLog(message, level) {
  state.logs.push({ time: new Date().toTimeString().slice(0, 8), message, level: level || '' });
  if (state.logs.length > 400) state.logs.shift();
  renderLog();
}

/* ------------------------------------------------------------------ */
/* 执行                                                                */
/* ------------------------------------------------------------------ */

async function startRun() {
  await flushSave();

  const targets = state.projects.filter((p) => p.enabled);
  if (!targets.length) {
    toast('请先勾选要执行的项目', true);
    return;
  }

  state.run = {
    active: true,
    paused: false,
    finished: false,
    total: targets.length,
    done: 0,
    failed: 0,
    index: 0,
    currentId: null,
    currentTitle: '',
    phase: '',
    message: '正在连接目标窗口…',
    remaining: null,
    startedAt: Date.now(),
    elapsed: 0
  };
  renderRun();

  const res = await api.startRun(targets.map((p) => p.id));
  if (!res || res.ok === false) {
    if (res && res.error) pushLog(res.error, 'error');
  }
}

function handleRunEvent(ev) {
  const r = state.run;
  switch (ev.type) {
    case 'log':
      pushLog(ev.message, ev.level);
      break;

    case 'start':
      r.total = ev.total;
      renderRun();
      break;

    case 'project-start':
      r.index = ev.index;
      r.currentId = ev.id;
      r.currentTitle = ev.title;
      r.remaining = null;
      r.message = '正在发送提示词…';
      markProject(ev.id, 'running');
      renderRun();
      break;

    case 'phase':
      r.message = ev.message || '';
      r.remaining = null;
      renderRun();
      break;

    case 'countdown':
      r.remaining = ev.remaining;
      r.message = `等待 AI 输出（${ev.mode === 'fixed' ? '固定等待' : '画面检测'}）`;
      renderRun();
      break;

    case 'idle':
      r.remaining = null;
      r.message = ev.message || '';
      renderRun();
      break;

    case 'project-done':
      if (ev.status === 'done') r.done += 1;
      else r.failed += 1;
      markProject(ev.id, ev.status);
      renderRun();
      break;

    case 'paused':
      r.paused = true;
      if (ev.reason === 'consecutive-busy') {
        r.message = '连续发送失败，已暂停。确认目标软件空闲后点「继续」';
      }
      renderRun();
      break;

    case 'resumed':
      r.paused = false;
      renderRun();
      break;

    case 'finish':
      r.active = false;
      r.finished = true;
      r.remaining = null;
      r.message = ev.stopped
        ? '已手动停止'
        : `执行结束：成功 ${ev.done} 个${ev.failed ? `，失败 ${ev.failed} 个` : ''}`;
      r.elapsed = ev.elapsedMs || Date.now() - r.startedAt;
      renderRun();
      setTimeout(reloadProjects, 300);
      break;

    default:
      break;
  }
}

function markProject(id, status) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  p.status = status;
  renderList();
  if (id === state.selectedId) renderEditor();
}

/* ------------------------------------------------------------------ */
/* 设置                                                                */
/* ------------------------------------------------------------------ */

function settingsRow(label, inner, desc) {
  return `<div class="setting-row"><label>${label}</label><div>${inner}${
    desc ? `<div class="desc">${desc}</div>` : ''
  }</div></div>`;
}

function ensureCandidates(s) {
  if (!Array.isArray(s.candidates) || s.candidates.length < 1) {
    s.candidates = [
      { x: 60, y: 49 },
      { x: 60, y: 89 }
    ];
  }
  return s.candidates;
}

function openSettings() {
  settingsDraft = JSON.parse(JSON.stringify(state.settings));
  ensureCandidates(settingsDraft);
  renderSettings();
  $('#settingsModal').classList.remove('hidden');
}

function closeSettings() {
  $('#settingsModal').classList.add('hidden');
  settingsDraft = null;
}

function renderSettings() {
  const s = settingsDraft;
  const body = $('#settingsBody');

  body.innerHTML = `
    <div class="section-title">目标软件</div>
    ${settingsRow(
      '程序路径',
      `<div class="inline">
         <input class="input" id="sAppPath" value="${esc(s.appPath)}" placeholder="C:\\...\\WorkBuddy.exe" />
         <button class="sec-btn" id="btnPickExe" style="white-space:nowrap">选择</button>
       </div>`,
      '未打开目标软件时，批量执行会自动启动它'
    )}
    ${settingsRow(
      '窗口标题关键字',
      `<input class="input" id="sTitleKeyword" value="${esc(s.windowTitleKeyword)}" />`,
      '在窗口标题里匹配这段文字来定位目标窗口'
    )}
    ${settingsRow(
      '进程名关键字',
      `<input class="input" id="sProcessName" value="${esc(s.processName)}" />`,
      '标题匹配不到时，用进程名兜底（如 WorkBuddy）'
    )}

    <div class="section-title">输入框定位</div>
    ${settingsRow(
      '定位方式',
      `<select id="sFocusStrategy">
         <option value="auto"${s.focusStrategy === 'auto' ? ' selected' : ''}>自动（定位点没命中会自己重新找）</option>
         <option value="click"${s.focusStrategy === 'click' ? ' selected' : ''}>只用定位点（不做自动扫描）</option>
       </select>`,
      '自动模式：先按无障碍坐标找输入框，界面分栏（右侧弹出预览面板）时会自己换算位置；都不行就按当前布局横向扫描，只在确认能打字的位置才粘贴'
    )}
    ${settingsRow(
      '定位点 1',
      `<div class="inline">
         <input class="input" id="sCx0" type="number" step="0.5" placeholder="X%" value="${s.candidates[0].x}" />
         <input class="input" id="sCy0" type="number" step="0.5" placeholder="Y%" value="${s.candidates[0].y}" />
         <button class="sec-btn" data-sample="0" style="white-space:nowrap">取样</button>
       </div>`,
      '兜底用的窗口百分比坐标。点「取样」后 3 秒内把鼠标移到 AI 的输入框上（自动定位失败时才会用到）'
    )}
    ${settingsRow(
      '定位点 2',
      `<div class="inline">
         <input class="input" id="sCx1" type="number" step="0.5" placeholder="X%" value="${s.candidates[1] ? s.candidates[1].x : 60}" />
         <input class="input" id="sCy1" type="number" step="0.5" placeholder="Y%" value="${s.candidates[1] ? s.candidates[1].y : 89}" />
         <button class="sec-btn" data-sample="1" style="white-space:nowrap">取样</button>
       </div>`,
      '首页和会话页输入框位置不同时，会自动依次尝试'
    )}
    ${settingsRow(
      '发送快捷键',
      `<select id="sSendKey">
         <option value="enter"${s.sendKey === 'enter' ? ' selected' : ''}>Enter</option>
         <option value="ctrl+enter"${s.sendKey === 'ctrl+enter' ? ' selected' : ''}>Ctrl + Enter</option>
         <option value="shift+enter"${s.sendKey === 'shift+enter' ? ' selected' : ''}>Shift + Enter</option>
         <option value="none"${s.sendKey === 'none' ? ' selected' : ''}>不自动发送（仅填入输入框）</option>
       </select>`
    )}

    <div class="section-title">完成判定</div>
    ${settingsRow(
      '判定方式',
      `<select id="sMode">
         <option value="idle"${s.completionMode === 'idle' ? ' selected' : ''}>画面静止检测（推荐）</option>
         <option value="fixed"${s.completionMode === 'fixed' ? ' selected' : ''}>固定时长等待</option>
         <option value="manual"${s.completionMode === 'manual' ? ' selected' : ''}>手动确认（点“跳过当前”继续）</option>
       </select>`
    )}
    ${settingsRow('固定等待秒数', `<input class="input" id="sFixedWait" type="number" value="${s.fixedWaitSeconds}" />`)}
    ${settingsRow(
      '最短等待秒数',
      `<input class="input" id="sMinWait" type="number" value="${s.idleMinWaitSeconds}" />`,
      '刚发送时 AI 可能还在思考，这段时间内不会判定为完成'
    )}
    ${settingsRow(
      '画面静止判定',
      `<input class="input" id="sStable" type="number" value="${s.idleStableSeconds}" />`,
      '检测到 AI 开始输出后，画面连续静止多少秒才认为写完（建议 20 秒以上）'
    )}
    ${settingsRow(
      '无输出兜底（秒）',
      `<input class="input" id="sNoActivity" type="number" value="${s.idleNoActivitySeconds || 300}" />`,
      '画面始终没有任何变化时，等这么久也判定完成，避免干等'
    )}
    ${settingsRow(
      '采样间隔（毫秒）',
      `<input class="input" id="sInterval" type="number" value="${s.idleIntervalMs}" />`
    )}
    ${settingsRow(
      '变化阈值（%）',
      `<input class="input" id="sThreshold" type="number" step="0.1" value="${s.idleThresholdPercent}" />`,
      '每秒画面变化低于该比例视为“静止”。数值越小越灵敏'
    )}
    ${settingsRow(
      '单项目超时（秒）',
      `<input class="input" id="sTimeout" type="number" value="${s.idleTimeoutSeconds}" />`,
      '超过这个时间仍未完成，就自动进入下一个项目'
    )}
    ${settingsRow(
      '空闲监测宽度（%）',
      `<input class="input" id="sMonitorW" type="number" min="0" max="100" value="${
        s.idleMonitorWidthPercent === 0 ? 0 : s.idleMonitorWidthPercent || 0
      }" />`,
      '填 0 = 自动：从画面里识别右侧预览面板的边界，只监测左侧对话区（面板里的动画不会干扰判断）。也可以手填 10-100 固定宽度'
    )}

    <div class="section-title">发送行为</div>
    <label class="checkline"><input type="checkbox" id="sAttachImages" ${
      s.attachImages ? 'checked' : ''
    } /> 把图片作为剪贴板图片粘贴进输入框</label>
    <label class="checkline"><input type="checkbox" id="sClearFirst" ${
      s.clearInputFirst ? 'checked' : ''
    } /> 发送前先清空输入框已有内容</label>
    <label class="checkline"><input type="checkbox" id="sContinue" ${
      s.continueOnError ? 'checked' : ''
    } /> 单个项目失败后继续执行后面的项目</label>

    <div class="section-title">项目工作目录</div>
    ${settingsRow(
      '根目录',
      `<div class="inline">
         <input class="input" id="sWorkspaceRoot" value="${esc(s.workspaceRoot || '')}" />
         <button class="sec-btn" id="btnPickRoot" style="white-space:nowrap">选择</button>
         <button class="sec-btn" id="btnOpenRoot" style="white-space:nowrap">打开</button>
       </div>`,
      '每个项目会在这里自动创建一个独立文件夹，提示词里会告诉 AI 把代码写进去'
    )}
    <label class="checkline"><input type="checkbox" id="sFolderHint" ${
      s.withFolderHint !== false ? 'checked' : ''
    } /> 提示词开头自动带上「工作目录」说明</label>

    <div class="section-title">提示词模板</div>
    <div class="desc" style="margin-bottom:8px;color:#5f6779;font-size:11px;">
      可用占位符：<span class="tag">{{title}}</span> <span class="tag">{{details}}</span>
      <span class="tag">{{folder}}</span> <span class="tag">{{attachments}}</span>
      <span class="tag">{{index}}</span> <span class="tag">{{total}}</span>
    </div>
    <textarea class="tpl" id="sTemplate">${esc(s.promptTemplate)}</textarea>
  `;

  $('#btnPickExe').addEventListener('click', async () => {
    const p = await api.pickExe();
    if (p) $('#sAppPath').value = p;
  });

  $('#btnPickRoot').addEventListener('click', async () => {
    const dir = await api.pickDir();
    if (dir) $('#sWorkspaceRoot').value = dir;
  });

  $('#btnOpenRoot').addEventListener('click', () => {
    const dir = $('#sWorkspaceRoot').value.trim();
    if (dir) api.openDir(dir);
  });

  body.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '3 秒…';
      const res = await api.sampleCursor();
      btn.disabled = false;
      btn.textContent = '取样';
      if (!res || !res.ok) {
        toast((res && res.error) || '取样失败，请确认目标窗口已打开', true);
        return;
      }
      const i = btn.dataset.sample;
      $('#sCx' + i).value = res.percentX;
      $('#sCy' + i).value = res.percentY;
      toast(`已取样：${res.percentX}% , ${res.percentY}%`);
    });
  });
}

function collectSettings() {
  const s = settingsDraft;
  s.appPath = $('#sAppPath').value.trim();
  s.windowTitleKeyword = $('#sTitleKeyword').value.trim();
  s.processName = $('#sProcessName').value.trim();
  s.focusStrategy = $('#sFocusStrategy').value;
  s.candidates = [
    { x: parseFloat($('#sCx0').value) || 60, y: parseFloat($('#sCy0').value) || 49 },
    { x: parseFloat($('#sCx1').value) || 60, y: parseFloat($('#sCy1').value) || 89 }
  ];
  s.sendKey = $('#sSendKey').value;
  s.completionMode = $('#sMode').value;
  s.fixedWaitSeconds = parseInt($('#sFixedWait').value, 10) || 90;
  s.idleMinWaitSeconds = parseInt($('#sMinWait').value, 10) || 25;
  s.idleStableSeconds = parseFloat($('#sStable').value) || 20;
  s.idleNoActivitySeconds = parseInt($('#sNoActivity').value, 10) || 300;
  s.idleIntervalMs = parseInt($('#sInterval').value, 10) || 1200;
  s.idleThresholdPercent = parseFloat($('#sThreshold').value) || 0.3;
  s.idleTimeoutSeconds = parseInt($('#sTimeout').value, 10) || 1800;
  s.idleMonitorWidthPercent = parseFloat($('#sMonitorW').value) || 0;
  s.attachImages = $('#sAttachImages').checked;
  s.clearInputFirst = $('#sClearFirst').checked;
  s.continueOnError = $('#sContinue').checked;
  s.workspaceRoot = $('#sWorkspaceRoot').value.trim();
  s.withFolderHint = $('#sFolderHint').checked;
  s.promptTemplate = $('#sTemplate').value;
  return s;
}

/* ------------------------------------------------------------------ */
/* 自动生成项目（模板库）                                               */
/* ------------------------------------------------------------------ */

const PRESETS = window.PBS_PRESETS || { groups: [], commonRules: '' };
const presetState = {
  groupId: PRESETS.groups[0] ? PRESETS.groups[0].id : null,
  count: 10,
  orderFor: null,
  order: [],
  previewId: null,
  // 勾选状态：存条目标题，避免下标漂移
  checked: new Set(),
  checkedFor: null
};

function currentGroup() {
  return PRESETS.groups.find((g) => g.id === presetState.groupId) || null;
}

function shuffleOrder(group) {
  const arr = group.items.map((_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function ensureOrder(group) {
  if (presetState.orderFor !== group.id || !presetState.order.length) {
    presetState.order = shuffleOrder(group);
    presetState.orderFor = group.id;
  }
}

function clampCount(group) {
  const max = group ? group.items.length : 1;
  const n = parseInt(presetState.count, 10);
  presetState.count = Math.max(1, Math.min(Number.isFinite(n) ? n : 10, max));
  return presetState.count;
}

/** 换方向 / 换一批之后，默认勾上前 N 个；手动勾选过的不会被覆盖 */
function ensureChecked(group) {
  ensureOrder(group);
  const sig = `${group.id}|${presetState.order.join(',')}`;
  if (presetState.checkedFor === sig) return;
  presetState.checkedFor = sig;
  presetState.checked = new Set(
    presetState.order.slice(0, clampCount(group)).map((i) => group.items[i].title)
  );
}

/** 按当前顺序返回勾选的条目（生成就按这个顺序） */
function checkedItems() {
  const group = currentGroup();
  if (!group) return [];
  ensureChecked(group);
  return presetState.order
    .filter((i) => presetState.checked.has(group.items[i].title))
    .map((i) => group.items[i]);
}

function checkedCount() {
  const group = currentGroup();
  if (!group) return 0;
  ensureChecked(group);
  return group.items.filter((it) => presetState.checked.has(it.title)).length;
}

/** 把勾选重置成「前 N 个」，数量输入框和快捷按钮都走这里 */
function checkTopN(group, n) {
  ensureOrder(group);
  const k = Math.max(0, Math.min(Number(n) || 0, group.items.length));
  presetState.checked = new Set(presetState.order.slice(0, k).map((i) => group.items[i].title));
  presetState.checkedFor = `${group.id}|${presetState.order.join(',')}`;
  updatePresetCount();
}

function buildPresetDetails(item, group) {
  const parts = [item.body || ''];
  const extra = group && group.rules ? PRESETS[group.rules + 'Rules'] : null;
  const common = PRESETS.commonRules || '';

  if (group && group.rules === 'large') {
    // 大型项目：通用规范放前面，专项规范放最后（权重更高）
    if (common) parts.push(common);
    if (extra) parts.push(extra);
  } else {
    if (extra) parts.push(extra);
    if (common) parts.push(common);
  }
  return parts.filter(Boolean).join('\n\n').trim();
}

function openPresets() {
  renderPresets();
  $('#presetModal').classList.remove('hidden');
}

function closePresets() {
  $('#presetModal').classList.add('hidden');
}

function renderPresets() {
  const group = currentGroup();

  const tabs = $('#presetTabs');
  tabs.innerHTML = PRESETS.groups
    .map(
      (g) => `
      <button class="preset-tab ${g.id === presetState.groupId ? 'active' : ''}" data-group="${g.id}">
        <span>${g.icon}</span><span>${esc(g.name)}</span>
        <span class="n">${g.items.length}</span>
      </button>`
    )
    .join('');

  tabs.querySelectorAll('.preset-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (presetState.groupId === btn.dataset.group) return;
      presetState.groupId = btn.dataset.group;
      presetState.orderFor = null;
      presetState.order = [];
      presetState.previewId = null;
      renderPresets();
    });
  });

  const body = $('#presetBody');
  if (!group) {
    body.innerHTML = '<div class="preset-group-head">模板库为空</div>';
    updatePresetCount();
    return;
  }

  ensureChecked(group);
  $('#presetCountInput').value = clampCount(group);

  const all = presetState.order.map((i) => group.items[i]);
  const picked = checkedCount();

  body.innerHTML =
    `<div class="preset-group-head">
       ${group.icon} ${esc(group.tagline)}
       <span class="preset-pool">池子共 ${group.items.length} 个 · 已勾选 <b>${picked}</b> 个</span>
       <span class="preset-bulk">
         <button class="preset-mini" data-bulk="all">全选</button>
         <button class="preset-mini" data-bulk="none">清空</button>
       </span>
     </div>` +
    all
      .map((it, i) => {
        const open = presetState.previewId === it.title;
        const on = presetState.checked.has(it.title);
        return `
        <div class="preset-row ${on ? 'is-checked' : ''}" data-key="${esc(it.title)}">
          <input type="checkbox" class="preset-check" data-check="${esc(it.title)}" ${on ? 'checked' : ''} />
          <span class="preset-num">${String(i + 1).padStart(2, '0')}</span>
          <div class="preset-row-main">
            <div class="preset-row-title">${esc(it.title)}
              ${it.tags && it.tags[0] ? `<span class="preset-badge">${esc(it.tags[0])}</span>` : ''}
            </div>
            <div class="preset-row-sum">${esc(it.summary)}</div>
            ${open ? `<div class="preset-detail">${esc(buildPresetDetails(it, group))}</div>` : ''}
          </div>
          <button class="preset-peek" data-peek="${esc(it.title)}">${open ? '收起' : '预览'}</button>
        </div>`;
      })
      .join('');

  body.querySelectorAll('.preset-peek').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.peek;
      presetState.previewId = presetState.previewId === key ? null : key;
      renderPresets();
    });
  });

  body.querySelectorAll('.preset-check').forEach((box) => {
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => {
      const key = box.dataset.check;
      const row = box.closest('.preset-row');
      if (box.checked) presetState.checked.add(key);
      else presetState.checked.delete(key);
      if (row) row.classList.toggle('is-checked', box.checked);
      updatePresetCount();
    });
  });

  // 点整行也能勾选/取消，不用非得点中小方框（预览区里点不算，免得看需求时误勾）
  body.querySelectorAll('.preset-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.preset-peek') || e.target.closest('.preset-check') || e.target.closest('.preset-detail')) {
        return;
      }
      const box = row.querySelector('.preset-check');
      if (!box) return;
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change'));
    });
  });

  body.querySelectorAll('[data-bulk]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.bulk === 'all') {
        presetState.checked = new Set(all.map((it) => it.title));
        presetState.checkedFor = `${group.id}|${presetState.order.join(',')}`;
        renderPresets();
      } else {
        presetState.checked = new Set();
        presetState.checkedFor = `${group.id}|${presetState.order.join(',')}`;
        renderPresets();
      }
    });
  });

  updatePresetCount();
}

function updatePresetCount() {
  const group = currentGroup();
  const n = group ? checkedCount() : 0;
  const unit = group ? group.unit : '个项目';
  const pool = group ? group.items.length : 0;
  const head = document.querySelector('.preset-pool');
  if (head && group) head.innerHTML = `池子共 ${pool} 个 · 已勾选 <b>${n}</b> 个`;
  // 数量框跟着勾选数走，手动增减也同步，免得两个数字对不上
  const input = $('#presetCountInput');
  if (input && document.activeElement !== input) input.value = n;
  if (n > 0) presetState.count = n;
  $('#presetCount').textContent = n ? `将生成 ${n} ${unit}` : '还没有勾选项目';
  $('#btnGenerateProjects').disabled = n === 0;
}

async function generateProjects() {
  const group = currentGroup();
  const picked = checkedItems();
  if (!group || !picked.length) {
    toast('请先勾选要生成的项目', true);
    return;
  }

  await flushSave();
  const btn = $('#btnGenerateProjects');
  btn.disabled = true;
  btn.textContent = '生成中…';

  const payloads = picked.map((it) => ({
    title: it.title,
    details: buildPresetDetails(it, group),
    waitSeconds: group.waitSeconds || 600,
    enabled: true
  }));

  const created = await api.createProjects(payloads);

  btn.disabled = false;
  btn.textContent = '生成项目';

  if (!created || !created.length) {
    toast('生成失败', true);
    return;
  }

  state.projects.push(...created);
  state.selectedId = created[0].id;

  // 生成后自动换一批，避免重复生成同样的项目
  presetState.orderFor = null;
  presetState.order = [];
  presetState.previewId = null;
  presetState.checkedFor = null;
  presetState.checked = new Set();

  renderList();
  renderEditor();
  closePresets();
  toast(`已生成 ${created.length} ${group.unit}，确认后即可批量执行`);
}

/* ------------------------------------------------------------------ */
/* 初始化                                                              */
/* ------------------------------------------------------------------ */

function bindGlobal() {
  $('#btnAddProject').addEventListener('click', createProject);

  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnCloseSettings').addEventListener('click', closeSettings);
  $('#btnCancelSettings').addEventListener('click', closeSettings);

  $('#btnOpenPresets').addEventListener('click', openPresets);
  $('#btnClosePresets').addEventListener('click', closePresets);
  $('#btnCancelPresets').addEventListener('click', closePresets);
  $('#btnGenerateProjects').addEventListener('click', generateProjects);
  $('#presetModal').addEventListener('click', (e) => {
    if (e.target.id === 'presetModal') closePresets();
  });

  // 数量输入 = 「按当前顺序勾上前 N 个」，勾完还能手动增减
  $('#presetCountInput').addEventListener('change', (e) => {
    presetState.count = parseInt(e.target.value, 10) || 1;
    const group = currentGroup();
    if (!group) return;
    clampCount(group);
    checkTopN(group, presetState.count);
    renderPresets();
  });

  $('#presetQuick').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = currentGroup();
      if (!group) return;
      presetState.count = btn.dataset.n === 'all' ? group.items.length : parseInt(btn.dataset.n, 10);
      clampCount(group);
      checkTopN(group, presetState.count);
      renderPresets();
    });
  });

  $('#btnReshuffle').addEventListener('click', () => {
    const group = currentGroup();
    if (!group) return;
    presetState.order = shuffleOrder(group);
    presetState.orderFor = group.id;
    presetState.checkedFor = null; // 重新洗牌后按数量重新勾前 N 个
    presetState.previewId = null;
    renderPresets();
  });

  $('#btnSaveSettings').addEventListener('click', async () => {
    const s = collectSettings();
    state.settings = await api.updateSettings(s);
    closeSettings();
    toast('设置已保存');
    schedulePreview();
  });

  $('#btnTestTarget').addEventListener('click', async () => {
    await api.updateSettings(collectSettings());
    const el = $('#btnTestTarget');
    el.textContent = '检测中…';
    const res = await api.testTarget();
    el.textContent = '测试连接目标窗口';
    toast(
      res && res.ok
        ? res.found
          ? `已找到窗口：${res.title}`
          : '没有找到目标窗口，请检查标题/进程名'
        : (res && res.error) || '检测失败',
      !(res && res.ok && res.found)
    );
  });

  $('#btnOpenData').addEventListener('click', () => api.openDataDir());

  $('#btnResetStatus').addEventListener('click', async () => {
    await api.resetStatus();
    await reloadProjects(state.selectedId);
    toast('状态已重置');
  });

  $('#btnClearLog').addEventListener('click', () => {
    state.logs = [];
    renderLog();
  });

  $('#btnMin').addEventListener('click', () => api.minimize());
  $('#btnMax').addEventListener('click', () => api.maximize());
  $('#btnClose').addEventListener('click', () => api.close());

  $('#settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#settingsModal').classList.contains('hidden')) closeSettings();
    else if (!$('#presetModal').classList.contains('hidden')) closePresets();
  });

  setInterval(() => {
    if (state.run.active) {
      state.run.elapsed = Date.now() - state.run.startedAt;
      const meta = document.querySelector('#runStatus .progress-meta');
      if (meta) meta.lastElementChild.textContent = fmtDur(state.run.elapsed);
    }
  }, 1000);
}

async function init() {
  const data = await api.getStore();
  state.projects = data.projects || [];
  state.settings = data.settings || {};
  state.selectedId = state.projects[0]?.id || null;

  bindGlobal();
  renderList();
  renderEditor();
  renderRun();
  renderLog();

  api.onRunEvent(handleRunEvent);

  const st = await api.runStatus();
  if (st && st.running) {
    state.run.active = true;
    state.run.paused = st.paused;
    state.run.startedAt = Date.now();
    renderRun();
  }
}

init();

})();
