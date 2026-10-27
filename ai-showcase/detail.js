/* 作品详情：API 数据、点赞收藏、评论、作者可见的审核状态 */
(() => {
  'use strict';

  const SEED = Array.isArray(window.SEED_PROJECTS) ? window.SEED_PROJECTS : [];
  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const state = {
    project: null,
    user: null,
    online: true,
    comments: [],
    busy: false
  };

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function formatDate(project) {
    if (project.createdAt) {
      const d = new Date(project.createdAt);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return project.date || '';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function gotoLogin() {
    location.href = 'auth.html?next=' + encodeURIComponent(location.pathname + location.search);
  }

  function renderNotFound(message) {
    document.title = '没有找到这件作品 · AI 造物馆·智纪元';
    $('#dName').textContent = '没有找到这件作品';
    $('#dTagline').textContent = message || '链接可能不完整，或者作品还没有通过审核。';
    $('#dShots').innerHTML = '';
    $('#dDesc').innerHTML = '<p>回到作品墙重新选择一件作品。</p>';
    $('#dDesc').classList.remove('clamped');
    $('#dActions').innerHTML = '<a class="btn primary" href="index.html">返回作品墙</a>';
    $('#actionBar').style.display = 'none';
    $('#comments').style.display = 'none';
  }

  function renderShots(project) {
    const images = project.images || [];
    const pc = images.filter((img) => img.label !== 'mobile');
    const mobile = images.filter((img) => img.label === 'mobile');

    const figure = (img, i) => `
      <figure data-src="${img.src}" data-caption="${escapeHtml(project.name)} · ${img.label === 'mobile' ? '手机端' : 'PC 端'} ${i + 1}" tabindex="0" role="button" aria-label="放大查看">
        <img src="${img.src}" alt="${escapeHtml(project.name)} ${img.label === 'mobile' ? '手机端' : 'PC 端'}截图 ${i + 1}" loading="lazy">
      </figure>`;

    const sections = [];
    if (pc.length) {
      sections.push(`
      <section class="shot-section">
        <h2 class="shot-title">PC 端 <small>桌面分辨率下的界面</small> <i>${pc.length} 张</i></h2>
        <div class="pc-grid">${pc.map(figure).join('')}</div>
      </section>`);
    }
    if (mobile.length) {
      sections.push(`
      <section class="shot-section">
        <h2 class="shot-title">手机端 <small>移动视口与横屏布局</small> <i>${mobile.length} 张</i></h2>
        <div class="mobile-grid">${mobile.map(figure).join('')}</div>
      </section>`);
    }
    $('#dShots').innerHTML = sections.join('');
  }

  function renderContact(project) {
    const parts = [];
    if (project.contactName) parts.push(`<span>联系人 <b>${escapeHtml(project.contactName)}</b></span>`);
    if (project.contact) {
      const isUrl = /^https?:\/\//i.test(project.contact) || /^mailto:/i.test(project.contact);
      parts.push(
        `<span>联系方式 ${isUrl ? `<a href="${escapeHtml(project.contact)}" target="_blank" rel="noopener">${escapeHtml(project.contact)}</a>` : `<b>${escapeHtml(project.contact)}</b>`}</span>`
      );
    }
    parts.push(`<span>QQ <b>${escapeHtml(project.qq || '993739647')}</b></span>`);
    if (project.author?.name) parts.push(`<span>发布者 <b>${escapeHtml(project.author.name)}</b></span>`);
    return parts.join('');
  }

  function renderPager(project, all) {
    const index = all.findIndex((p) => p.id === project.id);
    const prev = index > 0 ? all[index - 1] : all[all.length - 1];
    const next = index < all.length - 1 ? all[index + 1] : all[0];
    if (all.length < 2) {
      $('#dPager').innerHTML = '';
      return;
    }
    $('#dPager').innerHTML = `
      <a class="prev" href="detail.html?id=${encodeURIComponent(prev.id)}">
        <small>上一件作品</small><strong>← ${escapeHtml(prev.name)}</strong>
      </a>
      <a class="next" href="detail.html?id=${encodeURIComponent(next.id)}">
        <small>下一件作品</small><strong>${escapeHtml(next.name)} →</strong>
      </a>`;
  }

  function setupCollapse(content, button, openText, closeText) {
    content.classList.add('clamped');
    button.classList.add('hidden');
    button.textContent = openText;
    requestAnimationFrame(() => {
      const overflowing = content.scrollHeight > content.clientHeight + 4;
      if (!overflowing) {
        content.classList.remove('clamped');
        button.classList.add('hidden');
        return;
      }
      button.classList.remove('hidden');
    });
    button.onclick = () => {
      const isClamped = content.classList.toggle('clamped');
      button.textContent = isClamped ? openText : closeText;
      if (isClamped) {
        const top = content.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };
  }

  function updateCounts() {
    const project = state.project;
    if (!project) return;
    const counts = project.counts || { likes: 0, favorites: 0, comments: 0 };
    $('#likeCount').textContent = counts.likes || 0;
    $('#favCount').textContent = counts.favorites || 0;
    $('#commentCount').textContent = counts.comments || 0;
    $('#commentCountBar').textContent = counts.comments || 0;

    const likeBtn = $('[data-action="like"]');
    const favBtn = $('[data-action="favorite"]');
    likeBtn.classList.toggle('active', Boolean(project.liked));
    favBtn.classList.toggle('active', Boolean(project.favorited));
    likeBtn.setAttribute('aria-pressed', String(Boolean(project.liked)));
    favBtn.setAttribute('aria-pressed', String(Boolean(project.favorited)));
    likeBtn.querySelector('.ico').textContent = project.liked ? '♥' : '♡';
    favBtn.querySelector('.ico').textContent = project.favorited ? '★' : '☆';
  }

  function renderStatus(project) {
    const banner = $('#statusBanner');
    if (project.status === 'pending') {
      banner.className = 'status-banner pending';
      banner.textContent = '审核中：这件作品目前只有你自己和管理员能看到，审核通过后会出现在作品墙。';
    } else if (project.status === 'rejected') {
      banner.className = 'status-banner rejected';
      banner.textContent = '未通过审核' + (project.rejectReason ? `：${project.rejectReason}` : '') + '。修改后可重新提交。';
    } else {
      banner.className = 'status-banner hidden';
      banner.textContent = '';
    }
  }

  function render(project, all) {
    state.project = project;
    document.title = `${project.name} · AI 造物馆·智纪元`;

    $('#dCats').innerHTML = (project.categories || []).map((c) => `<span>${escapeHtml(c)}</span>`).join('');
    $('#dName').textContent = project.name;
    $('#dTagline').textContent = project.tagline || '';
    const date = formatDate(project);
    $('#dDate').textContent = date ? `${date} 发布` : '';

    $('#dPlatforms').innerHTML = (project.platforms || []).map((p) => `<span>${escapeHtml(p)}</span>`).join('');
    $('#dStack').innerHTML = (project.stack || []).map((s) => `<span>${escapeHtml(s)}</span>`).join('');

    const actions = [];
    if (project.repo) {
      actions.push(`<a class="btn primary" href="${escapeHtml(project.repo)}" target="_blank" rel="noopener">打开开源地址 ↗</a>`);
    }
    actions.push('<a class="btn ghost" href="index.html">返回作品墙</a>');
    $('#dActions').innerHTML = actions.join('');

    renderStatus(project);
    renderShots(project);

    $('#dDesc').innerHTML = String(project.description || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');
    setupCollapse($('#dDesc'), $('#descToggle'), '展开全文 ↓', '收起 ↑');

    $('#dGameplay').innerHTML =
      (project.gameplay || []).map((g) => `<li>${escapeHtml(g)}</li>`).join('') || '<li>作者没有填写玩法说明。</li>';
    setupCollapse($('#gameplayWrap'), $('#gameplayToggle'), '展开全部 ↓', '收起 ↑');

    $('#dSideStack').innerHTML = (project.stack || []).map((s) => `<span>${escapeHtml(s)}</span>`).join('');
    $('#dSidePlatforms').innerHTML = (project.platforms || []).map((p) => `<span>${escapeHtml(p)}</span>`).join('');
    $('#dContact').innerHTML = renderContact(project);

    const repo = $('#dRepo');
    if (project.repo) {
      repo.href = project.repo;
      repo.style.opacity = '';
      repo.style.pointerEvents = '';
    } else {
      repo.removeAttribute('href');
      repo.textContent = '未提供开源地址';
      repo.style.opacity = '0.55';
      repo.style.pointerEvents = 'none';
    }

    updateCounts();
    renderPager(project, all);
    bindLightbox();
  }

  /* ---------------- 互动 ---------------- */
  function bindActions() {
    $('#actionBar').addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'comment') {
        $('#comments').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (!state.online) {
        toast('静态预览无法互动，请先启动后端');
        return;
      }
      if (!state.user) {
        toast('登录后才能点赞和收藏');
        setTimeout(gotoLogin, 600);
        return;
      }
      if (state.busy) return;
      state.busy = true;
      try {
        if (action === 'like') {
          const result = await API.like(state.project.id);
          state.project.liked = result.liked;
          state.project.counts.likes = result.count;
        } else {
          const result = await API.favorite(state.project.id);
          state.project.favorited = result.favorited;
          state.project.counts.favorites = result.count;
        }
        updateCounts();
      } catch (error) {
        toast(error.message);
        if (error.status === 401) gotoLogin();
      } finally {
        state.busy = false;
      }
    });
  }

  /* ---------------- 评论 ---------------- */
  function renderEditor() {
    const box = $('#commentEditor');
    const hint = document.querySelector('.comments-hint');
    if (state.user) hint.textContent = `以 ${state.user.name} 的身份评论`;
    else hint.textContent = '登录后可以留言';
    if (!state.online) {
      box.innerHTML = '<p class="comment-tip">静态预览模式，启动后端后可以评论。</p>';
      return;
    }
    if (!state.user) {
      box.innerHTML = '<p class="comment-tip">登录后可以发表评论。<button class="btn primary" type="button" id="loginToComment">登录</button></p>';
      $('#loginToComment')?.addEventListener('click', gotoLogin);
      return;
    }
    if (state.user.muted) {
      const until = state.user.mutedUntil ? formatTime(state.user.mutedUntil) : '稍后';
      box.innerHTML = `<p class="comment-tip muted">你已被禁言，${escapeHtml(until)} 之后才能评论。</p>`;
      return;
    }
    box.innerHTML = `
      <form class="comment-form" id="commentForm">
        <textarea id="commentInput" maxlength="500" rows="2" placeholder="说点什么…（最多 500 字）"></textarea>
        <button class="btn primary" type="submit">发表评论</button>
      </form>`;
    $('#commentForm').addEventListener('submit', submitComment);
  }

  async function submitComment(event) {
    event.preventDefault();
    const input = $('#commentInput');
    const content = input.value.trim();
    if (content.length < 2) return toast('评论至少 2 个字');
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '发布中…';
    try {
      const { comment } = await API.addComment(state.project.id, content);
      state.comments.unshift(comment);
      state.project.counts.comments += 1;
      input.value = '';
      renderComments();
      updateCounts();
      toast('评论已发布');
    } catch (error) {
      toast(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '发表评论';
    }
  }

  function renderComments() {
    const list = $('#commentList');
    if (!state.comments.length) {
      list.innerHTML = '<p class="comment-empty">还没有评论，来做第一个。</p>';
      return;
    }
    list.innerHTML = state.comments
      .map(
        (c) => `
        <article class="comment" data-id="${c.id}">
          <div class="comment-head">
            <span class="avatar">${escapeHtml(c.author.name).slice(0, 1)}</span>
            <b>${escapeHtml(c.author.name)}</b>
            <time>${formatTime(c.createdAt)}</time>
            ${c.mine || state.user?.role === 'admin' ? '<button class="comment-del" type="button" data-del="' + c.id + '">删除</button>' : ''}
          </div>
          <p>${escapeHtml(c.content)}</p>
        </article>`
      )
      .join('');
  }

  async function loadComments() {
    try {
      const { items } = await API.comments(state.project.id);
      state.comments = items;
      state.project.counts.comments = items.length;
      renderComments();
      updateCounts();
    } catch (error) {
      console.warn(error);
    }
  }

  function bindCommentList() {
    $('#commentList').addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-del]');
      if (!btn) return;
      if (!confirm('删除这条评论？')) return;
      try {
        await API.deleteComment(btn.dataset.del);
        state.comments = state.comments.filter((c) => String(c.id) !== btn.dataset.del);
        state.project.counts.comments = Math.max(0, state.project.counts.comments - 1);
        renderComments();
        updateCounts();
      } catch (error) {
        toast(error.message);
      }
    });
  }

  function bindLightbox() {
    const lightbox = $('#lightbox');
    const img = $('#lightboxImg');
    const open = (src, caption) => {
      img.src = src;
      img.alt = caption || '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    $('#dShots').addEventListener('click', (event) => {
      const figure = event.target.closest('figure[data-src]');
      if (figure) open(figure.dataset.src, figure.dataset.caption);
    });
    $('#dShots').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const figure = event.target.closest('figure[data-src]');
      if (!figure) return;
      event.preventDefault();
      open(figure.dataset.src, figure.dataset.caption);
    });
    lightbox.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    $('#copyLink').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        toast('已复制本页链接');
      } catch {
        toast('复制失败，请手动复制地址栏');
      }
    });
  }

  async function init() {
    bindActions();
    bindCommentList();
    state.user = await window.mountUserBar?.() || null;

    const id = new URLSearchParams(location.search).get('id');
    if (!id) return renderNotFound('链接里没有作品 id。');

    try {
      const data = await API.getProject(id);
      state.online = true;
      render(data.project, [data.project]);
      // 上下篇：取公开列表定位
      try {
        const list = await API.listProjects({ page: 1 });
        const items = list.items || [];
        const idx = items.findIndex((p) => p.id === id);
        if (idx >= 0) renderPager(data.project, items);
      } catch {
        /* 忽略 */
      }
      renderEditor();
      await loadComments();
    } catch (error) {
      if (error.status === 404 && state.online) {
        renderNotFound(error.message);
        return;
      }
      const project = SEED.find((p) => p.id === id);
      if (!project) return renderNotFound('链接可能不完整，或者作品还没有通过审核。');
      state.online = false;
      render(project, SEED);
      renderEditor();
      renderComments();
      $('#offlineBanner')?.classList.remove('hidden');
    }
  }

  init();
})();
