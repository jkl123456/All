/* 首页：从 API 拉取已审核作品，静态预览时降级到 data/projects.js */
(() => {
  'use strict';

  const SEED = Array.isArray(window.SEED_PROJECTS) ? window.SEED_PROJECTS : [];
  const CATEGORIES = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : [];
  const PAGE_SIZE = 8;

  const state = {
    category: '全部',
    query: '',
    page: 1,
    items: [],
    total: 0,
    totalPages: 1,
    online: true
  };

  const $ = (sel) => document.querySelector(sel);
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

  function seedFiltered() {
    const q = state.query.trim().toLowerCase();
    return SEED.filter((p) => {
      if (state.category !== '全部' && !(p.categories || []).includes(state.category)) return false;
      if (!q) return true;
      return [p.name, p.tagline, p.description, ...(p.categories || []), ...(p.stack || []), ...(p.gameplay || [])]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }

  async function loadStats() {
    try {
      const site = await API.site();
      $('#statProjects').textContent = site.projects;
      $('#statUsers').textContent = site.users;
      $('#statComments').textContent = site.comments;
      $('#footerCount').textContent = `${site.projects} 件作品 · ${site.users} 位创作者`;
    } catch {
      $('#statProjects').textContent = SEED.length;
      $('#statUsers').textContent = '—';
      $('#statComments').textContent = '—';
      $('#footerCount').textContent = `${SEED.length} 件作品（静态预览）`;
    }
  }

  function renderFilters() {
    const cats = ['全部', ...CATEGORIES];
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

  function renderPagination() {
    const nav = $('#pagination');
    if (state.totalPages <= 1) {
      nav.innerHTML = '';
      return;
    }
    const buttons = [
      `<button class="page-btn" type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="上一页">‹</button>`
    ];
    for (let i = 1; i <= state.totalPages; i += 1) {
      buttons.push(
        `<button class="page-btn ${i === state.page ? 'active' : ''}" type="button" data-page="${i}" aria-current="${i === state.page ? 'page' : 'false'}">${i}</button>`
      );
    }
    buttons.push(
      `<button class="page-btn" type="button" data-page="${state.page + 1}" ${state.page === state.totalPages ? 'disabled' : ''} aria-label="下一页">›</button>`
    );
    nav.innerHTML = buttons.join('');
  }

  async function loadPage() {
    try {
      const data = await API.listProjects({
        page: state.page,
        category: state.category === '全部' ? '' : state.category,
        q: state.query
      });
      state.online = true;
      state.items = data.items;
      state.total = data.total;
      state.totalPages = data.totalPages;
      $('#offlineBanner').classList.add('hidden');
    } catch {
      state.online = false;
      const list = seedFiltered();
      state.total = list.length;
      state.totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      if (state.page > state.totalPages) state.page = state.totalPages;
      state.items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      $('#offlineBanner').classList.remove('hidden');
    }

    $('#projectGrid').innerHTML = state.items.map(cardTemplate).join('');
    $('#emptyState').classList.toggle('hidden', state.items.length > 0);
    $('#resultCount').textContent = state.query
      ? `找到 ${state.total} 件作品`
      : `共 ${state.total} 件作品`;
    renderPagination();
  }

  function goPage(page) {
    state.page = page;
    loadPage();
    const top = $('#gallery').offsetTop - 70;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function bindEvents() {
    $('#categoryFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.dataset.category;
      state.page = 1;
      renderFilters();
      loadPage();
    });

    let timer = 0;
    $('#searchInput').addEventListener('input', (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.query = event.target.value;
        state.page = 1;
        loadPage();
      }, 220);
    });

    $('#resetFilters').addEventListener('click', () => {
      state.category = '全部';
      state.query = '';
      state.page = 1;
      $('#searchInput').value = '';
      renderFilters();
      loadPage();
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

  async function init() {
    renderFilters();
    bindEvents();
    window.mountUserBar?.();
    await Promise.all([loadStats(), loadPage()]);
  }

  init();
})();
