/* 管理后台：统计、审核、助推、用户封禁与禁言 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const state = { tab: 'overview', stats: null, search: '' };

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function fmt(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------------- 概览 ---------------- */
  async function renderOverview() {
    const panel = $('#panel');
    panel.innerHTML = '<p class="console-empty">加载统计…</p>';
    try {
      const s = await API.adminStats();
      state.stats = s;
      const pendingBadge = $('#pendingCount');
      pendingBadge.textContent = s.pending;
      pendingBadge.classList.toggle('hidden', !s.pending);
      panel.innerHTML = `
        <div class="stat-grid">
          <dl class="stat-card"><dt>作品总数</dt><dd>${s.projects}</dd></dl>
          <dl class="stat-card"><dt>待审核</dt><dd>${s.pending}</dd></dl>
          <dl class="stat-card"><dt>已通过</dt><dd>${s.approved}<small>· 精选 ${s.boosted}</small></dd></dl>
          <dl class="stat-card"><dt>用户</dt><dd>${s.users}<small>· 拉黑 ${s.banned}</small></dd></dl>
          <dl class="stat-card"><dt>评论</dt><dd>${s.comments}</dd></dl>
          <dl class="stat-card"><dt>点赞</dt><dd>${s.likes}</dd></dl>
          <dl class="stat-card"><dt>收藏</dt><dd>${s.favorites}</dd></dl>
          <dl class="stat-card"><dt>已驳回</dt><dd>${s.rejected}</dd></dl>
        </div>
        <p class="console-sub">排序规则：推荐作品只占第 1 页（最多 8 个，不足用普通作品补满）；被挤出首页后与普通作品一样按时间排序；降低优先级的作品不出现在前两页，从第 3 页开始参与时间排序。</p>`;
    } catch (error) {
      panel.innerHTML = `<p class="console-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  /* ---------------- 作品列表 ---------------- */
  function projectRow(project, mode) {
    const cover = project.cover || project.images?.[0]?.src || '';
    const status =
      project.status === 'approved'
        ? '<span class="badge ok">已通过</span>'
        : project.status === 'rejected'
          ? '<span class="badge bad">已驳回</span>'
          : '<span class="badge wait">待审核</span>';
    const boost = project.boost ? '<span class="badge boost">推荐首页</span>' : '';
    const demote = project.demote ? '<span class="badge bad">已降级</span>' : '';
    return `
      <article class="row" data-id="${escapeHtml(project.id)}">
        <a class="row-cover" href="detail.html?id=${encodeURIComponent(project.id)}">
          <img src="${cover}" alt="">
        </a>
        <div class="row-main">
          <div class="row-title">
            <a href="detail.html?id=${encodeURIComponent(project.id)}">${escapeHtml(project.name)}</a>
            ${status}${boost}${demote}
          </div>
          <p class="row-desc">${escapeHtml(project.tagline || '')}</p>
          <div class="row-meta">
            <span>${escapeHtml(project.author?.name || '匿名')} · ${escapeHtml(project.author?.email || '')}</span>
            <span>${fmt(project.createdAt)}</span>
            <span>${(project.categories || []).join(' / ')}</span>
          </div>
          ${project.rejectReason ? `<p class="row-reason">驳回原因：${escapeHtml(project.rejectReason)}</p>` : ''}
        </div>
        <div class="row-actions">
          ${mode === 'pending'
            ? `<button class="btn primary" type="button" data-approve="${escapeHtml(project.id)}">通过</button>
               <button class="btn danger" type="button" data-reject="${escapeHtml(project.id)}">驳回</button>`
            : `<button class="btn ghost" type="button" data-boost="${escapeHtml(project.id)}" data-on="${project.boost ? '1' : '0'}">${project.boost ? '取消推荐' : '推荐首页'}</button>
               <button class="btn ghost" type="button" data-demote="${escapeHtml(project.id)}" data-on="${project.demote ? '1' : '0'}">${project.demote ? '取消降级' : '降低优先级'}</button>
               <a class="btn ghost" href="detail.html?id=${encodeURIComponent(project.id)}">查看</a>
               <button class="btn danger" type="button" data-del="${escapeHtml(project.id)}">删除</button>`}
        </div>
      </article>`;
  }

  async function renderProjects(mode) {
    const panel = $('#panel');
    panel.innerHTML = '<p class="console-empty">加载作品…</p>';
    try {
      const status = mode === 'pending' ? 'pending' : 'all';
      const data = await API.adminProjects({ status, q: state.search, page: 1 });
      if (mode === 'pending') {
        const badge = $('#pendingCount');
        badge.textContent = data.total;
        badge.classList.toggle('hidden', !data.total);
      }
      panel.innerHTML = `
        <div class="console-toolbar">
          <label class="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path></svg>
            <input type="search" id="adminSearch" placeholder="搜索作品名 / 作者 / 邮箱" value="${escapeHtml(state.search)}">
          </label>
          <span class="console-sub">共 ${data.total} 件</span>
        </div>
        ${data.items.length ? data.items.map((p) => projectRow(p, mode)).join('') : '<p class="console-empty">没有符合条件的作品。</p>'}`;

      $('#adminSearch')?.addEventListener('input', (event) => {
        clearTimeout(renderProjects._t);
        renderProjects._t = setTimeout(() => {
          state.search = event.target.value.trim();
          renderProjects(mode);
        }, 260);
      });
    } catch (error) {
      panel.innerHTML = `<p class="console-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  /* ---------------- 用户 ---------------- */
  async function renderUsers() {
    const panel = $('#panel');
    panel.innerHTML = '<p class="console-empty">加载用户…</p>';
    try {
      const data = await API.adminUsers({ q: state.search, page: 1 });
      panel.innerHTML = `
        <div class="console-toolbar">
          <label class="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path></svg>
            <input type="search" id="userSearch" placeholder="搜索邮箱 / 昵称 / ID" value="${escapeHtml(state.search)}">
          </label>
          <span class="console-sub">共 ${data.total} 位</span>
        </div>
        ${data.items.map((u) => userRow(u)).join('') || '<p class="console-empty">没有匹配的用户。</p>'}`;

      $('#userSearch')?.addEventListener('input', (event) => {
        clearTimeout(renderUsers._t);
        renderUsers._t = setTimeout(() => {
          state.search = event.target.value.trim();
          renderUsers();
        }, 260);
      });
    } catch (error) {
      panel.innerHTML = `<p class="console-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function userRow(user) {
    const muted = user.muted ? `<span class="badge wait">禁言至 ${fmt(user.mutedUntil)}</span>` : '';
    const banned = user.banned ? '<span class="badge bad">已拉黑</span>' : '';
    const role = user.role === 'admin' ? '<span class="badge ok">管理员</span>' : '';
    return `
      <article class="user-row" data-uid="${user.id}">
        <div class="user-main">
          <div class="user-name-line">${escapeHtml(user.name)} ${role}${banned}${muted}</div>
          <div class="user-email">${escapeHtml(user.email)} · ID ${user.id} · 注册于 ${fmt(user.createdAt)}</div>
          <div class="user-stats">
            <span>作品 ${user.counts.projects}</span>
            <span>评论 ${user.counts.comments}</span>
            <span>点赞 ${user.counts.likes}</span>
          </div>
        </div>
        <div class="user-actions">
          <button class="btn ghost" type="button" data-detail="${user.id}">详情</button>
          ${user.role === 'admin' ? '' : `
          <button class="btn ghost" type="button" data-ban="${user.id}" data-on="${user.banned ? '1' : '0'}">${user.banned ? '解除拉黑' : '拉黑'}</button>
          <button class="btn ghost" type="button" data-mute="${user.id}">禁言</button>
          ${user.muted ? `<button class="btn ghost" type="button" data-unmute="${user.id}">解除禁言</button>` : ''}`}
        </div>
      </article>`;
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('#tabs').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.dataset.tab;
      state.search = '';
      document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el === btn));
      route();
    });

    $('#panel').addEventListener('click', async (event) => {
      const target = event.target;
      const id = target.dataset.approve || target.dataset.reject || target.dataset.boost || target.dataset.demote || target.dataset.del;
      try {
        if (target.dataset.approve) {
          await API.review(target.dataset.approve, 'approve');
          toast('已通过审核');
          renderProjects('pending');
        } else if (target.dataset.reject) {
          const reason = prompt('驳回原因（会展示给作者）：', '内容不完整，请补充介绍与截图');
          if (reason === null) return;
          await API.review(target.dataset.reject, 'reject', reason);
          toast('已驳回');
          renderProjects('pending');
        } else if (target.dataset.boost) {
          const on = target.dataset.on === '1';
          await API.boost(target.dataset.boost, !on);
          toast(on ? '已取消推荐' : '已设为首页推荐');
          renderProjects('projects');
        } else if (target.dataset.demote) {
          const on = target.dataset.on === '1';
          await API.demote(target.dataset.demote, !on);
          toast(on ? '已取消降级' : '已降低优先级，作品排到第 3 页之后');
          renderProjects('projects');
        } else if (target.dataset.del) {
          if (!confirm('删除这件作品？无法恢复。')) return;
          await API.adminDeleteProject(target.dataset.del);
          toast('已删除');
          renderProjects('projects');
        } else if (target.dataset.ban) {
          const on = target.dataset.on === '1';
          if (!confirm(on ? '解除拉黑这个用户？' : '拉黑后该用户无法登录，确定？')) return;
          await API.banUser(target.dataset.ban, !on);
          toast(on ? '已解除拉黑' : '已拉黑');
          renderUsers();
        } else if (target.dataset.mute) {
          const minutes = prompt('禁言多少分钟？（60 = 1 小时，1440 = 1 天）', '60');
          if (minutes === null) return;
          const value = Number(minutes);
          if (!Number.isFinite(value) || value <= 0) return toast('请输入大于 0 的分钟数');
          await API.muteUser(target.dataset.mute, value);
          toast(`已禁言 ${value} 分钟`);
          renderUsers();
        } else if (target.dataset.unmute) {
          await API.muteUser(target.dataset.unmute, 0);
          toast('已解除禁言');
          renderUsers();
        } else if (target.dataset.detail) {
          const data = await API.adminUser(target.dataset.detail);
          const list = data.projects
            .map((p) => `<div class="row-meta"><span>${escapeHtml(p.name)}</span><span>${p.status}</span><span>${fmt(p.created_at || p.createdAt)}</span></div>`)
            .join('');
          const comments = data.comments
            .map((c) => `<div class="row-meta"><span>${escapeHtml(c.content).slice(0, 60)}</span><span>${fmt(c.created_at || c.createdAt)}</span></div>`)
            .join('');
          alert(
            `${data.user.name}（${data.user.email}）\n作品 ${data.projects.length} 件、评论 ${data.comments.length} 条\n\n作品：\n${list || '无'}\n\n最近评论：\n${comments || '无'}`
          );
        }
      } catch (error) {
        toast(error.message);
      }
      void id;
    });
  }

  function route() {
    if (state.tab === 'overview') renderOverview();
    if (state.tab === 'pending') renderProjects('pending');
    if (state.tab === 'projects') renderProjects('projects');
    if (state.tab === 'users') renderUsers();
  }

  async function init() {
    const user = await window.mountUserBar?.() || null;
    if (!user) {
      location.href = 'auth.html?next=' + encodeURIComponent('admin.html');
      return;
    }
    if (user.role !== 'admin') {
      document.querySelector('#panel').innerHTML =
        '<p class="console-empty">需要管理员权限。请用管理员邮箱登录，或运行 <code>npm run seed</code> 创建管理员。</p>';
      return;
    }
    bind();
    route();
  }

  init();
})();
