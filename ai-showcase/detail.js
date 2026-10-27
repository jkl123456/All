/* 作品详情页：4 张 PC + 2 张手机截图平铺、介绍与玩法折叠、发布日期、公众号 */
(() => {
  'use strict';

  const SEED = Array.isArray(window.SEED_PROJECTS) ? window.SEED_PROJECTS : [];
  const SITE = window.SITE || { qq: '993739647', wechat: '智纪元AD' };
  const DB_NAME = 'ai-maker-gallery';
  const STORE = 'projects';

  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function formatDate(project) {
    if (project.date) return project.date;
    if (project.createdAt) {
      const d = new Date(project.createdAt);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return '';
  }

  async function loadCustom() {
    try {
      const database = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  function renderNotFound() {
    document.title = '没有找到这件作品 · AI 造物馆·智纪元';
    $('#dCats').innerHTML = '';
    $('#dName').textContent = '没有找到这件作品';
    $('#dTagline').textContent = '链接可能不完整，或者作品存放在另一台设备的浏览器里。';
    $('#dShots').innerHTML = '';
    $('#dDesc').innerHTML = '<p>回到作品墙重新选择一件作品。</p>';
    $('#dDesc').classList.remove('clamped');
    $('#dActions').innerHTML = '<a class="btn primary" href="index.html">返回作品墙</a>';
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
    parts.push(`<span>QQ <b>${escapeHtml(project.qq || SITE.qq)}</b></span>`);
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

  function render(project, all) {
    document.title = `${project.name} · AI 造物馆·智纪元`;

    $('#dCats').innerHTML = (project.categories || []).map((c) => `<span>${escapeHtml(c)}</span>`).join('');
    $('#dName').textContent = project.name;
    $('#dTagline').textContent = project.tagline || '';

    const date = formatDate(project);
    $('#dDate').textContent = date ? `${date} 发布` : '';
    if (!date) $('.publish-line').style.display = 'none';

    $('#dPlatforms').innerHTML = (project.platforms || []).map((p) => `<span>${escapeHtml(p)}</span>`).join('');
    $('#dStack').innerHTML = (project.stack || []).map((s) => `<span>${escapeHtml(s)}</span>`).join('');

    const actions = [];
    if (project.repo) {
      actions.push(`<a class="btn primary" href="${escapeHtml(project.repo)}" target="_blank" rel="noopener">打开开源地址 ↗</a>`);
    }
    actions.push('<a class="btn ghost" href="index.html">返回作品墙</a>');
    $('#dActions').innerHTML = actions.join('');

    renderShots(project);

    $('#dDesc').innerHTML = String(project.description || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');
    setupCollapse($('#dDesc'), $('#descToggle'), '展开全文 ↓', '收起 ↑');

    $('#dGameplay').innerHTML = (project.gameplay || []).map((g) => `<li>${escapeHtml(g)}</li>`).join('') || '<li>作者没有填写玩法说明。</li>';
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

    renderPager(project, all);
    bindLightbox();
  }

  function bindLightbox() {
    const lightbox = $('#lightbox');
    const img = $('#lightboxImg');

    function open(src, caption) {
      img.src = src;
      img.alt = caption || '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

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
    const id = new URLSearchParams(location.search).get('id');
    const custom = await loadCustom();
    const all = [...custom.map((p) => ({ ...p, custom: true })), ...SEED];
    const project = all.find((p) => p.id === id);

    if (!project) {
      renderNotFound();
      return;
    }
    render(project, all);
  }

  init();
})();
