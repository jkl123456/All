/* AI 造物馆 —— 纯静态作品展示站
 * 预置作品来自 data/projects.js；用户提交存 IndexedDB。
 */
(() => {
  'use strict';

  const SEED = Array.isArray(window.SEED_PROJECTS) ? window.SEED_PROJECTS : [];
  const CATEGORIES = ['游戏', '知识教育', '开发工具', '自动化', '其他'];
  const PLATFORMS = ['Web', '移动端', 'Windows', 'macOS', 'Linux'];
  const MAX_SHOTS = 8;
  const DB_NAME = 'ai-maker-gallery';
  const STORE = 'projects';

  const state = {
    custom: [],
    category: '全部',
    platform: '全部',
    query: '',
    detail: null,
    shotIndex: 0,
    draftShots: []
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const uid = () => 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------- IndexedDB ---------------- */
  let dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function loadCustom() {
    try {
      const database = await db();
      const items = await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      state.custom = items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      console.warn('IndexedDB 不可用，提交仅保存在当前页面', error);
      state.custom = [];
    }
  }

  async function saveCustom(project) {
    const database = await db();
    await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(project);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function removeCustom(id) {
    const database = await db();
    await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------------- 数据合并 ---------------- */
  function allProjects() {
    const custom = state.custom.map((item) => ({ ...item, custom: true }));
    return [...custom, ...SEED];
  }

  function categories() {
    const set = new Set(['全部']);
    allProjects().forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }

  function platformList() {
    const set = new Set(['全部']);
    allProjects().forEach((p) => (p.platforms || []).forEach((x) => set.add(x)));
    return Array.from(set);
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return allProjects().filter((p) => {
      if (state.category !== '全部' && p.category !== state.category) return false;
      if (state.platform !== '全部' && !(p.platforms || []).includes(state.platform)) return false;
      if (!q) return true;
      const haystack = [p.name, p.tagline, p.description, p.category, p.contactName, ...(p.stack || []), ...(p.gameplay || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  /* ---------------- 渲染 ---------------- */
  function renderStats() {
    const projects = allProjects();
    const shots = projects.reduce((sum, p) => sum + (p.images || []).length, 0);
    $('#statProjects').textContent = projects.length;
    $('#statShots').textContent = shots;
    $('#statCats').textContent = new Set(projects.map((p) => p.category).filter(Boolean)).size;
    $('#footerCount').textContent = projects.length + ' 件作品 · ' + shots + ' 张截图';
  }

  function renderFilters() {
    const catWrap = $('#categoryFilters');
    catWrap.innerHTML = categories()
      .map(
        (cat) =>
          `<button class="chip ${state.category === cat ? 'active' : ''}" type="button" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
      )
      .join('');

    const platWrap = $('#platformFilters');
    platWrap.innerHTML = platformList()
      .map(
        (plat) =>
          `<button class="chip ${state.platform === plat ? 'active' : ''}" type="button" data-platform="${escapeHtml(plat)}">${plat === '全部' ? '全部平台' : escapeHtml(plat)}</button>`
      )
      .join('');
  }

  function cardTemplate(project, index) {
    const shots = project.images || [];
    const cover = project.cover || (shots[0] && shots[0].src) || '';
    const stack = (project.stack || []).slice(0, 4);
    const platforms = (project.platforms || []).slice(0, 3);
    return `
      <article class="card" tabindex="0" role="button" data-id="${escapeHtml(project.id)}" style="animation-delay:${Math.min(index * 40, 320)}ms" aria-label="查看 ${escapeHtml(project.name)}">
        <div class="card-cover">
          ${cover ? `<img src="${cover}" alt="${escapeHtml(project.name)} 截图" loading="lazy">` : ''}
          <span class="card-badge">${escapeHtml(project.category || '其他')}</span>
          <span class="card-shots">${shots.length} 张</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(project.name)}</h3>
          <p>${escapeHtml(project.tagline || '')}</p>
          <div class="card-stack">${stack.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>
          <div class="card-foot">
            <div class="platforms">${platforms.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>
            <span class="open">查看详情 →</span>
          </div>
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = filtered();
    const grid = $('#projectGrid');
    grid.innerHTML = list.map(cardTemplate).join('');
    $('#emptyState').classList.toggle('hidden', list.length > 0);
    $('#resultCount').textContent = state.query
      ? `找到 ${list.length} 件作品`
      : `共 ${list.length} 件作品`;
  }

  function renderAll() {
    renderStats();
    renderFilters();
    renderGrid();
  }

  /* ---------------- 详情 ---------------- */
  function openDetail(id) {
    const project = allProjects().find((p) => p.id === id);
    if (!project) return;
    state.detail = project;
    state.shotIndex = 0;

    $('#detailCat').textContent = project.category || '其他';
    $('#detailName').textContent = project.name;
    $('#detailTagline').textContent = project.tagline || '';
    $('#detailPlatforms').innerHTML = (project.platforms || [])
      .map((p) => `<span>${escapeHtml(p)}</span>`)
      .join('');
    $('#detailDesc').textContent = project.description || '';
    $('#detailGameplay').innerHTML = (project.gameplay || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('') || '<li>作者没有填写玩法说明。</li>';
    $('#detailStack').innerHTML = (project.stack || [])
      .map((s) => `<span>${escapeHtml(s)}</span>`)
      .join('');

    const contactParts = [];
    if (project.contactName) contactParts.push(`<span>联系人 <b>${escapeHtml(project.contactName)}</b></span>`);
    if (project.contact) {
      const isUrl = /^https?:\/\//i.test(project.contact) || /^mailto:/i.test(project.contact);
      contactParts.push(
        `<span>联系方式 ${isUrl ? `<a href="${escapeHtml(project.contact)}" target="_blank" rel="noopener">${escapeHtml(project.contact)}</a>` : `<b>${escapeHtml(project.contact)}</b>`}</span>`
      );
    }
    $('#detailContact').innerHTML = contactParts.join('') || '<span>作者未留下联系方式</span>';

    const actions = [];
    if (project.repo) {
      actions.push(`<a class="btn primary" href="${escapeHtml(project.repo)}" target="_blank" rel="noopener">打开开源地址 ↗</a>`);
    } else {
      actions.push('<span class="btn ghost" style="cursor:default;opacity:.6">未提供开源地址</span>');
    }
    if (project.custom) {
      actions.push('<button class="btn danger" type="button" id="deleteProject">删除</button>');
    }
    $('#detailActions').innerHTML = actions.join('');

    renderShots();
    openModal('#detailModal');
  }

  function renderShots() {
    const project = state.detail;
    if (!project) return;
    const images = project.images || [];
    const current = images[state.shotIndex] || images[0];
    if (!current) return;
    $('#detailMain').src = current.src;
    $('#detailMain').alt = `${project.name} 截图 ${state.shotIndex + 1}`;
    $('#detailLabel').textContent = current.label === 'mobile' ? '手机端' : 'PC 端';
    $('#detailThumbs').innerHTML = images
      .map(
        (img, i) =>
          `<button type="button" class="${i === state.shotIndex ? 'active' : ''}" data-shot="${i}" aria-label="第 ${i + 1} 张"><img src="${img.src}" alt=""></button>`
      )
      .join('');
    const many = images.length > 1;
    $('#prevShot').style.display = many ? '' : 'none';
    $('#nextShot').style.display = many ? '' : 'none';
  }

  function stepShot(delta) {
    if (!state.detail) return;
    const total = (state.detail.images || []).length;
    if (!total) return;
    state.shotIndex = (state.shotIndex + delta + total) % total;
    renderShots();
  }

  /* ---------------- 弹层 ---------------- */
  function openModal(selector) {
    const modal = $(selector);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const focusable = modal.querySelector('button, [href], input, select, textarea');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
  }

  function closeModals() {
    $$('.modal.open').forEach((modal) => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
    state.detail = null;
  }

  /* ---------------- 提交表单 ---------------- */
  function renderPlatformChecks() {
    $('#platformChecks').innerHTML = PLATFORMS.map(
      (p) => `<label><input type="checkbox" name="platform" value="${p}">${p}</label>`
    ).join('');
  }

  function renderCategoryOptions() {
    $('#fCategory').innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function resetForm() {
    $('#submitForm').reset();
    state.draftShots = [];
    renderShotsDraft();
    renderPlatformChecks();
  }

  function renderShotsDraft() {
    const grid = $('#shotGrid');
    grid.innerHTML = state.draftShots
      .map(
        (shot, i) => `
        <div class="shot" data-index="${i}">
          <img src="${shot.src}" alt="截图 ${i + 1}">
          <button class="remove" type="button" data-remove="${i}" aria-label="删除这张">✕</button>
          <button class="tag ${shot.label === 'mobile' ? 'mobile' : ''}" type="button" data-toggle="${i}">
            ${shot.label === 'mobile' ? '手机端' : 'PC 端'}
          </button>
        </div>`
      )
      .join('');
    $('#uploadCount').textContent = `${state.draftShots.length} / ${MAX_SHOTS}`;
  }

  function fileToShot(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('不是图片'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0b0d18';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({
            src: canvas.toDataURL('image/jpeg', 0.82),
            label: img.height > img.width ? 'mobile' : 'pc'
          });
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const room = MAX_SHOTS - state.draftShots.length;
    if (room <= 0) {
      toast(`最多只能上传 ${MAX_SHOTS} 张截图`);
      return;
    }
    const slice = images.slice(0, room);
    if (images.length > room) toast(`只添加了前 ${room} 张，最多 ${MAX_SHOTS} 张`);
    try {
      const shots = await Promise.all(slice.map(fileToShot));
      state.draftShots.push(...shots);
      renderShotsDraft();
    } catch (error) {
      toast('图片处理失败：' + error.message);
    }
  }

  function collectProject() {
    const form = $('#submitForm');
    const data = new FormData(form);
    const platforms = $$('input[name="platform"]:checked', form).map((el) => el.value);
    const stack = String(data.get('stack') || '')
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const gameplay = String(data.get('gameplay') || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!state.draftShots.length) throw new Error('至少上传 1 张截图');
    if (!platforms.length) platforms.push('Web');

    return {
      id: uid(),
      name: String(data.get('name') || '').trim(),
      tagline: String(data.get('tagline') || '').trim(),
      category: String(data.get('category') || '其他').trim(),
      description: String(data.get('description') || '').trim(),
      gameplay,
      stack,
      platforms,
      repo: String(data.get('repo') || '').trim(),
      contactName: String(data.get('contactName') || '').trim(),
      contact: String(data.get('contact') || '').trim(),
      cover: state.draftShots[0].src,
      images: state.draftShots.map((s) => ({ ...s })),
      createdAt: Date.now()
    };
  }

  /* ---------------- 导入导出 ---------------- */
  function exportProjects() {
    if (!state.custom.length) {
      toast('还没有自己提交的作品');
      return;
    }
    const payload = { version: 1, exportedAt: new Date().toISOString(), projects: state.custom };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-gallery-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`已导出 ${state.custom.length} 件作品`);
  }

  async function importProjects(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.projects;
      if (!Array.isArray(list)) throw new Error('JSON 里没有 projects 数组');
      let added = 0;
      for (const item of list) {
        if (!item || !item.name || !Array.isArray(item.images) || !item.images.length) continue;
        const project = {
          ...item,
          id: item.id && !allProjects().some((p) => p.id === item.id) ? item.id : uid(),
          platforms: Array.isArray(item.platforms) && item.platforms.length ? item.platforms : ['Web'],
          cover: item.cover || item.images[0].src,
          createdAt: item.createdAt || Date.now()
        };
        await saveCustom(project);
        added += 1;
      }
      await loadCustom();
      renderAll();
      toast(`已导入 ${added} 件作品`);
    } catch (error) {
      toast('导入失败：' + error.message);
    }
  }

  /* ---------------- 事件 ---------------- */
  function bindEvents() {
    $('#navSubmit').addEventListener('click', () => openModal('#submitModal'));
    $('#heroSubmit').addEventListener('click', () => openModal('#submitModal'));

    $('#categoryFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.dataset.category;
      renderFilters();
      renderGrid();
    });

    $('#platformFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-platform]');
      if (!btn) return;
      state.platform = btn.dataset.platform;
      renderFilters();
      renderGrid();
    });

    let searchTimer = 0;
    $('#searchInput').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = event.target.value;
        renderGrid();
      }, 120);
    });

    $('#resetFilters').addEventListener('click', () => {
      state.category = '全部';
      state.platform = '全部';
      state.query = '';
      $('#searchInput').value = '';
      renderAll();
    });

    $('#projectGrid').addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });
    $('#projectGrid').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.card');
      if (!card) return;
      event.preventDefault();
      openDetail(card.dataset.id);
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) closeModals();
    });

    $('#detailThumbs').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-shot]');
      if (!btn) return;
      state.shotIndex = Number(btn.dataset.shot);
      renderShots();
    });
    $('#prevShot').addEventListener('click', () => stepShot(-1));
    $('#nextShot').addEventListener('click', () => stepShot(1));

    $('#detailActions').addEventListener('click', async (event) => {
      if (!event.target.closest('#deleteProject')) return;
      const project = state.detail;
      if (!project) return;
      if (!confirm(`删除「${project.name}」？只删除浏览器里的这份提交。`)) return;
      await removeCustom(project.id);
      await loadCustom();
      closeModals();
      renderAll();
      toast('已删除');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModals();
      if (!$('#detailModal').classList.contains('open')) return;
      if (event.key === 'ArrowLeft') stepShot(-1);
      if (event.key === 'ArrowRight') stepShot(1);
    });

    $('#pickImages').addEventListener('click', () => $('#imageInput').click());
    $('#imageInput').addEventListener('change', (event) => {
      addFiles(event.target.files);
      event.target.value = '';
    });

    const dropZone = $('#dropZone');
    ['dragenter', 'dragover'].forEach((type) =>
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.add('dragover');
      })
    );
    ['dragleave', 'drop'].forEach((type) =>
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
      })
    );
    dropZone.addEventListener('drop', (event) => {
      if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
    });
    dropZone.addEventListener('click', (event) => {
      if (event.target.closest('.shot')) return;
      if (event.target === $('#imageInput')) return;
      if (event.target.closest('#pickImages')) return;
      $('#imageInput').click();
    });

    $('#shotGrid').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        state.draftShots.splice(Number(remove.dataset.remove), 1);
        renderShotsDraft();
        return;
      }
      const toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        const i = Number(toggle.dataset.toggle);
        state.draftShots[i].label = state.draftShots[i].label === 'mobile' ? 'pc' : 'mobile';
        renderShotsDraft();
      }
    });

    $('#submitForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const project = collectProject();
        await saveCustom(project);
        await loadCustom();
        resetForm();
        closeModals();
        renderAll();
        toast('作品已发布，保存在本机浏览器');
        const first = document.querySelector(`.card[data-id="${project.id}"]`);
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        toast(error.message || '提交失败');
      }
    });

    $('#exportBtn').addEventListener('click', exportProjects);
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#importInput').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) importProjects(file);
      event.target.value = '';
    });
    $('#clearMine').addEventListener('click', async () => {
      if (!state.custom.length) {
        toast('还没有自己提交的作品');
        return;
      }
      if (!confirm(`清空 ${state.custom.length} 件自己提交的作品？预置作品不受影响。`)) return;
      for (const project of state.custom) await removeCustom(project.id);
      await loadCustom();
      renderAll();
      toast('已清空');
    });
  }

  /* ---------------- 启动 ---------------- */
  async function init() {
    renderPlatformChecks();
    renderCategoryOptions();
    bindEvents();
    await loadCustom();
    renderAll();
  }

  init();
})();
