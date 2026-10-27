/* AI 造物馆·智纪元 —— 首页：筛选、搜索、分页（预置数据来自 data/projects.js，访客提交存 IndexedDB） */
(() => {
  'use strict';

  const SEED = Array.isArray(window.SEED_PROJECTS) ? window.SEED_PROJECTS : [];
  const CATEGORIES = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : [];
  const PAGE_SIZE = 8;
  const DB_NAME = 'ai-maker-gallery';
  const STORE = 'projects';

  const state = {
    custom: [],
    category: '全部',
    query: '',
    page: 1
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function formatDate(project) {
    if (project.date) return project.date;
    if (project.createdAt) {
      const d = new Date(project.createdAt);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return '';
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
      console.warn('IndexedDB 不可用', error);
      state.custom = [];
    }
  }

  /* ---------------- 数据 ---------------- */
  function allProjects() {
    return [...state.custom.map((item) => ({ ...item, custom: true })), ...SEED];
  }

  function categoriesWithItems() {
    return CATEGORIES.filter((cat) => allProjects().some((p) => (p.categories || []).includes(cat)));
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return allProjects().filter((p) => {
      if (state.category !== '全部' && !(p.categories || []).includes(state.category)) return false;
      if (!q) return true;
      const haystack = [
        p.name,
        p.tagline,
        p.description,
        p.contactName,
        ...(p.categories || []),
        ...(p.stack || []),
        ...(p.gameplay || [])
      ]
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
    $('#statCats').textContent = categoriesWithItems().length;
    $('#footerCount').textContent = projects.length + ' 件作品 · ' + shots + ' 张截图';
  }

  function renderFilters() {
    const cats = ['全部', ...categoriesWithItems()];
    $('#categoryFilters').innerHTML = cats
      .map(
        (cat) =>
          `<button class="chip ${state.category === cat ? 'active' : ''}" type="button" role="tab" aria-selected="${state.category === cat}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
      )
      .join('');
  }

  function cardTemplate(project, index) {
    const shots = project.images || [];
    const cover = project.cover || (shots[0] && shots[0].src) || '';
    const stack = (project.stack || []).slice(0, 3);
    const cat = (project.categories || [])[0] || '其他';
    const date = formatDate(project);
    return `
      <article class="card" tabindex="0" role="link" data-id="${escapeHtml(project.id)}" style="animation-delay:${Math.min(index * 35, 280)}ms" aria-label="查看 ${escapeHtml(project.name)}">
        <div class="card-cover">
          ${cover ? `<img src="${cover}" alt="${escapeHtml(project.name)} 截图" loading="lazy">` : ''}
          <span class="card-badge">${escapeHtml(cat)}</span>
          <span class="card-shots">${shots.length} 图</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(project.name)}</h3>
          <p>${escapeHtml(project.tagline || '')}</p>
          <div class="card-stack">${stack.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>
          <div class="card-foot">
            <span class="date">${date}</span>
            <span class="open">详情 →</span>
          </div>
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = filtered();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    $('#projectGrid').innerHTML = pageItems.map(cardTemplate).join('');
    $('#emptyState').classList.toggle('hidden', list.length > 0);
    $('#resultCount').textContent = state.query
      ? `找到 ${list.length} 件作品`
      : `共 ${list.length} 件作品`;

    renderPagination(totalPages, list.length);
  }

  function renderPagination(totalPages, total) {
    const nav = $('#pagination');
    if (total <= PAGE_SIZE) {
      nav.innerHTML = '';
      return;
    }
    const buttons = [];
    buttons.push(`<button class="page-btn" type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="上一页">‹</button>`);
    for (let i = 1; i <= totalPages; i += 1) {
      buttons.push(`<button class="page-btn ${i === state.page ? 'active' : ''}" type="button" data-page="${i}" aria-current="${i === state.page ? 'page' : 'false'}">${i}</button>`);
    }
    buttons.push(`<button class="page-btn" type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''} aria-label="下一页">›</button>`);
    nav.innerHTML = buttons.join('');
  }

  function renderAll() {
    renderStats();
    renderFilters();
    renderGrid();
  }

  function goPage(page) {
    state.page = page;
    renderGrid();
    const top = $('#gallery').offsetTop - 70;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  /* ---------------- 事件 ---------------- */
  function bindEvents() {
    $('#categoryFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.dataset.category;
      state.page = 1;
      renderFilters();
      renderGrid();
    });

    let searchTimer = 0;
    $('#searchInput').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = event.target.value;
        state.page = 1;
        renderGrid();
      }, 110);
    });

    $('#resetFilters').addEventListener('click', () => {
      state.category = '全部';
      state.query = '';
      state.page = 1;
      $('#searchInput').value = '';
      renderAll();
    });

    $('#pagination').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      const page = Number(btn.dataset.page);
      if (!page || page < 1 || page === state.page) return;
      goPage(page);
    });

    $('#projectGrid').addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (card) location.href = 'detail.html?id=' + encodeURIComponent(card.dataset.id);
    });
    $('#projectGrid').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.card');
      if (!card) return;
      event.preventDefault();
      location.href = 'detail.html?id=' + encodeURIComponent(card.dataset.id);
    });
  }

  /* ---------------- 启动 ---------------- */
  async function init() {
    bindEvents();
    await loadCustom();
    renderAll();
  }

  init();
})();
