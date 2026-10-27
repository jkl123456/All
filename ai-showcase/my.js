/* 我的：作品（含审核状态）、收藏、评论 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const state = { tab: 'projects', user: null, projects: [], favorites: [], comments: [] };

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function statusBadge(project) {
    if (project.status === 'approved') {
      return `<span class="badge ok">已通过${project.boost ? ' · 精选' : ''}</span>`;
    }
    if (project.status === 'rejected') {
      return `<span class="badge bad">已驳回</span>`;
    }
    return '<span class="badge wait">审核中</span>';
  }

  function rowTemplate(project) {
    const cover = project.cover || project.images?.[0]?.src || '';
    return `
      <article class="row" data-id="${escapeHtml(project.id)}">
        <a class="row-cover" href="detail.html?id=${encodeURIComponent(project.id)}">
          <img src="${cover}" alt="${escapeHtml(project.name)}">
        </a>
        <div class="row-main">
          <div class="row-title">
            <a href="detail.html?id=${encodeURIComponent(project.id)}">${escapeHtml(project.name)}</a>
            ${statusBadge(project)}
          </div>
          <p class="row-desc">${escapeHtml(project.tagline || '')}</p>
          <div class="row-meta">
            <span>${fmtDate(project.createdAt)}</span>
            <span>${(project.categories || []).join(' / ')}</span>
            <span>${project.counts?.likes || 0} 赞 · ${project.counts?.favorites || 0} 收藏 · ${project.counts?.comments || 0} 评论</span>
          </div>
          ${project.status === 'rejected' && project.rejectReason ? `<p class="row-reason">驳回原因：${escapeHtml(project.rejectReason)}</p>` : ''}
        </div>
        <div class="row-actions">
          <a class="btn ghost" href="detail.html?id=${encodeURIComponent(project.id)}">查看</a>
          <button class="btn danger" type="button" data-del="${escapeHtml(project.id)}">删除</button>
        </div>
      </article>`;
  }

  function renderProjects() {
    if (!state.projects.length) {
      return '<p class="console-empty">还没有发布作品。<a href="submit.html">去发布第一件 →</a></p>';
    }
    return state.projects.map(rowTemplate).join('');
  }

  function renderFavorites() {
    if (!state.favorites.length) {
      return '<p class="console-empty">还没有收藏作品。<a href="index.html">去作品墙看看 →</a></p>';
    }
    return state.favorites
      .map(
        (p) => `
      <article class="row">
        <a class="row-cover" href="detail.html?id=${encodeURIComponent(p.id)}"><img src="${p.cover || p.images?.[0]?.src || ''}" alt=""></a>
        <div class="row-main">
          <div class="row-title"><a href="detail.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></div>
          <p class="row-desc">${escapeHtml(p.tagline || '')}</p>
          <div class="row-meta"><span>作者 ${escapeHtml(p.author?.name || '匿名')}</span><span>${p.counts?.likes || 0} 赞</span></div>
        </div>
        <div class="row-actions"><a class="btn ghost" href="detail.html?id=${encodeURIComponent(p.id)}">查看</a></div>
      </article>`
      )
      .join('');
  }

  function renderComments() {
    if (!state.comments.length) {
      return '<p class="console-empty">还没有发表过评论。</p>';
    }
    return state.comments
      .map(
        (c) => `
      <article class="comment-row">
        <p>${escapeHtml(c.content)}</p>
        <div class="row-meta">
          <a href="detail.html?id=${encodeURIComponent(c.projectId)}">${escapeHtml(c.projectName)}</a>
          <span>${fmtDate(c.createdAt)}</span>
        </div>
      </article>`
      )
      .join('');
  }

  function render() {
    const panel = $('#panel');
    if (state.tab === 'projects') panel.innerHTML = renderProjects();
    if (state.tab === 'favorites') panel.innerHTML = renderFavorites();
    if (state.tab === 'comments') panel.innerHTML = renderComments();
  }

  async function loadAll() {
    try {
      const [projects, favorites, comments] = await Promise.all([
        API.myProjects(),
        API.myFavorites(),
        API.myComments()
      ]);
      state.projects = projects.items;
      state.favorites = favorites.items;
      state.comments = comments.items;
      render();
    } catch (error) {
      if (error.status === 401) {
        location.href = 'auth.html?next=' + encodeURIComponent('my.html');
        return;
      }
      toast(error.message);
    }
  }

  function bind() {
    $('#tabs').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el === btn));
      render();
    });

    $('#panel').addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-del]');
      if (!btn) return;
      if (!confirm('删除这件作品？删除后无法恢复。')) return;
      try {
        await API.deleteProject(btn.dataset.del);
        state.projects = state.projects.filter((p) => p.id !== btn.dataset.del);
        render();
        toast('已删除');
      } catch (error) {
        toast(error.message);
      }
    });
  }

  async function init() {
    state.user = await window.mountUserBar?.() || null;
    if (!state.user) {
      location.href = 'auth.html?next=' + encodeURIComponent('my.html');
      return;
    }
    $('#welcome').textContent = `${state.user.name}，作品审核状态、收藏与评论都在这。`;
    if (state.user.muted) {
      $('#welcome').textContent += ' 当前处于禁言状态。';
    }
    bind();
    await loadAll();
    const params = new URLSearchParams(location.search);
    if (params.get('new')) {
      state.tab = 'projects';
      render();
      toast('已提交审核，管理员通过后会出现在作品墙');
    }
  }

  init();
})();
