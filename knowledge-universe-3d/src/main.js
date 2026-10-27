import { ALL_POINTS, POINT_BY_ID, SUBJECTS, SUBJECT_BY_ID, relatedPoints } from './data/subjects.js';
import { TIER_BY_LEVEL } from './data/tiers.js';
import { GraphScene } from './graph/graphScene.js';
import { loadProgress, isLearned, starsOf } from './game/progress.js';
import { GameHud } from './game/hud.js';
import { LessonOverlay } from './game/lesson.js';
import { ChallengeOverlay } from './game/challenge.js';

const $ = (id) => document.getElementById(id);
const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const dom = {
  loader: $('loader'),
  intro: $('intro'),
  graphCanvas: $('graph-canvas'),
  rail: $('rail'),
  panel: $('panel'),
  panelContent: $('panel-content'),
  tooltip: $('tooltip'),
  tooltipKind: $('tooltip-kind'),
  tooltipTitle: $('tooltip-title'),
  tooltipSub: $('tooltip-sub'),
  searchShell: $('search-shell'),
  searchInput: $('search-input'),
  searchResults: $('search-results'),
  filters: $('filters'),
  btnTour: $('btn-tour'),
  btnResetView: $('btn-reset-view'),
  btnEnter: $('btn-enter'),
  brandHome: $('brand-home'),
  hudStats: $('hud-stats'),
  tierTrack: $('tier-track'),
  continueCta: $('continue-cta'),
  boardRoot: $('board-root'),
  lessonRoot: $('lesson-root'),
  challengeRoot: $('challenge-root'),
};

const state = {
  filter: 'all',
  selectedSubjectId: null,
  expandedPointId: null,
  lastPointer: { x: 0, y: 0 },
  searchHits: [],
  searchActive: -1,
};

let graph = null;
let hud = null;
let lesson = null;
let challenge = null;
let tourEnabled = true;

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"></path></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7V5z"></path></svg>';

/* ---------------------------------- boot ---------------------------------- */
function boot() {
  try {
    graph = new GraphScene(dom.graphCanvas, {
      onHover: (node) => showTooltip(node),
      onHoverPosition: (position) => {
        state.lastPointer = position;
        if (nodeHovered()) placeTooltip(position);
      },
      onPickSubject: (subject) => openSubject(subject),
      onPickPoint: (point) => openLesson(point),
      onEmpty: () => {
        if (state.selectedSubjectId) closePanel();
        else graph.resetView();
      },
    });

    loadProgress();

    lesson = new LessonOverlay({
      root: dom.lessonRoot,
      onClose: () => {
        graph?.setPaused(false);
        refreshPanel();
      },
      onStartPoint: (point) => openLesson(point),
    });

    challenge = new ChallengeOverlay({
      root: dom.challengeRoot,
      onClose: () => graph?.setPaused(false),
    });

    hud = new GameHud({
      tierTrack: dom.tierTrack,
      statsHost: dom.hudStats,
      boardHost: dom.boardRoot,
      ctaHost: dom.continueCta,
      onStartPoint: (point) => openLesson(point),
      onChallenge: () => openChallenge(),
      onSelectTier: (level) => {
        graph?.setTierFocus(level);
        if (level) stopTour();
        else graph?.resetView();
      },
    });

    buildRail();
    bindEvents();
    updateTourButton();
    renderCounts();
    handleHash();
    window.addEventListener('hashchange', handleHash);
    // 调试 / 分享用入口
    window.__zhiyu = { openLesson, openChallenge, hud, lesson, challenge, graph, ALL_POINTS, POINT_BY_ID };

    requestAnimationFrame(() => {
      setTimeout(() => dom.loader.classList.add('is-done'), 450);
    });
  } catch (error) {
    console.error(error);
    dom.loader.innerHTML = '<p style="max-width:320px;text-align:center;line-height:1.9">当前浏览器无法启动 WebGL。请开启硬件加速，或使用最新版 Chrome / Edge / Safari 重试。</p>';
  }
}

function nodeHovered() {
  return !dom.tooltip.hidden;
}

/* ---------------------------------- rail ---------------------------------- */
function buildRail() {
  dom.rail.innerHTML = SUBJECTS.map(
    (subject) =>
      `<button class="rail-item" data-subject-id="${subject.id}" type="button">
        <i style="background:${subject.color};box-shadow:0 0 8px ${subject.color}"></i>
        <span>${subject.name}</span>
      </button>`
  ).join('');

  dom.rail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-subject-id]');
    if (!button) return;
    const subject = SUBJECT_BY_ID[button.dataset.subjectId];
    if (subject) openSubject(subject);
  });
}

function updateRail() {
  dom.rail.querySelectorAll('.rail-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.subjectId === state.selectedSubjectId);
  });
}

function renderCounts() {
  const total = SUBJECTS.length;
  const academic = SUBJECTS.filter((s) => s.kind === 'academic').length;
  const industry = SUBJECTS.filter((s) => s.kind === 'industry').length;
  const filters = dom.filters.querySelectorAll('.filter');
  filters.forEach((button) => {
    const kind = button.dataset.filter;
    const span = button.querySelector('span');
    if (!span) return;
    span.textContent = kind === 'all' ? String(total) : kind === 'academic' ? String(academic) : String(industry);
  });
}

/* --------------------------------- panel ---------------------------------- */
function openSubject(subject, options = {}) {
  if (!subject) return;
  hideTooltip();
  const previous = state.selectedSubjectId;
  state.selectedSubjectId = subject.id;
  if (options.expandedPointId !== undefined) {
    state.expandedPointId = options.expandedPointId;
  } else if (previous !== subject.id) {
    state.expandedPointId = null;
  }

  dom.panelContent.innerHTML = subjectPanelHTML(subject, state.expandedPointId);
  dom.panel.classList.add('open');
  dom.panel.setAttribute('aria-hidden', 'false');
  updateRail();

  if (graph.focusId !== subject.id) graph.setFocus(subject.id);
  if (tourEnabled) stopTour();
}

function subjectPanelHTML(subject, expandedId) {
  const points = subject.points
    .map((point, index) => {
      const expanded = point.id === expandedId;
      const tier = TIER_BY_LEVEL[point.tier];
      const learned = isLearned(point.id);
      const stars = starsOf(point.id);
      return `<div class="point-card ${expanded ? 'expanded' : ''} ${learned ? 'learned' : ''}" data-point-id="${point.id}" role="button" tabindex="0" aria-expanded="${expanded}" style="--subject-color:${subject.color};--tc:${tier.color}">
        <div class="point-card-main">
          <span class="point-index">${String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>${esc(point.title)}</h3>
            <p class="point-hook">${esc(point.hook)}</p>
          </div>
          <span class="card-arrow">${expanded ? '−' : '→'}</span>
        </div>
        <div class="point-tags">
          <span class="point-tier">${tier.name}</span>
          ${point.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}
          ${learned ? `<span class="point-stars" title="已获 ${stars} 星">${'★'.repeat(stars)}<em>${'★'.repeat(3 - stars)}</em></span>` : ''}
        </div>
        <div class="point-detail">
          <p>${esc(point.summary)}</p>
          <p class="case-inline">${esc(point.case)}</p>
          <ul class="principle-list">${point.principles.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          <code class="inline-formula">${esc(point.formula)}</code>
          <div class="point-actions">
            <button class="enter-lesson" data-start-lesson="${point.id}" type="button">
              <span><i class="play-dot"></i>${learned ? '再闯一次' : '开始闯关'}</span><em>→</em>
            </button>
          </div>
        </div>
      </div>`;
    })
    .join('');

  const tierMin = subject.points[0]?.tier || 1;
  const tierMax = subject.points[subject.points.length - 1]?.tier || 1;
  const learnedCount = subject.points.filter((p) => isLearned(p.id)).length;

  return `<button class="panel-close" data-close-panel type="button" aria-label="关闭面板">✕</button>
    <header class="subject-head" style="--subject-color:${subject.color}">
      <div class="subject-kicker"><i></i>${subject.kind === 'academic' ? '学科' : '行业'} / ${subject.en}</div>
      <div class="subject-glyph">${subject.glyph}</div>
      <h2>${subject.name}</h2>
      <p class="subject-en">${subject.en}</p>
      <p class="subject-tagline">${esc(subject.tagline)}</p>
      <p class="subject-intro">${esc(subject.intro)}</p>
      <div class="subject-meta">
        <div><strong>${String(subject.points.length).padStart(2, '0')}</strong>知识点</div>
        <div><strong>${learnedCount}</strong>已通关</div>
        <div><strong>${tierMin}–${tierMax}</strong>段位</div>
      </div>
    </header>
    <div class="points-head"><span>选择知识点 · 按段位由浅入深</span><span>CLICK TO PLAY</span></div>
    ${points}
    <p class="panel-footnote">点开一张卡片，先读案例，再进入分幕闯关；每一关都可以拖动变量，看结果怎么变。</p>`;
}

function closePanel() {
  dom.panel.classList.remove('open');
  dom.panel.setAttribute('aria-hidden', 'true');
  state.selectedSubjectId = null;
  state.expandedPointId = null;
  updateRail();
  if (graph) graph.setFocus(null);
  hideTooltip();
}

function refreshPanel() {
  if (!state.selectedSubjectId) return;
  const subject = SUBJECT_BY_ID[state.selectedSubjectId];
  if (!subject) return;
  dom.panelContent.innerHTML = subjectPanelHTML(subject, state.expandedPointId);
}

/* --------------------------------- 闯关入口 -------------------------------- */
function openLesson(point) {
  if (!point) return;
  hideTooltip();
  hideSearch();
  const subject = point.subject || SUBJECT_BY_ID[point.subjectId];
  if (subject && state.selectedSubjectId !== subject.id) {
    openSubject(subject, { expandedPointId: point.id });
  }
  graph?.setPaused(true);
  lesson.open(point.id);
  hud?.setLastPoint(point.id);
}

function openChallenge() {
  hideTooltip();
  hideSearch();
  graph?.setPaused(true);
  challenge.open();
}

function togglePointCard(card) {
  if (!card) return;
  const wasExpanded = card.classList.contains('expanded');
  dom.panelContent.querySelectorAll('.point-card.expanded').forEach((item) => {
    item.classList.remove('expanded');
    item.setAttribute('aria-expanded', 'false');
    const arrow = item.querySelector('.card-arrow');
    if (arrow) arrow.textContent = '→';
  });
  if (!wasExpanded) {
    card.classList.add('expanded');
    card.setAttribute('aria-expanded', 'true');
    const arrow = card.querySelector('.card-arrow');
    if (arrow) arrow.textContent = '−';
    state.expandedPointId = card.dataset.pointId;
  } else {
    state.expandedPointId = null;
  }
}

/* --------------------------------- tooltip -------------------------------- */
function showTooltip(node) {
  if (!node) {
    hideTooltip();
    return;
  }
  if (node.type === 'subject') {
    const subject = node.data;
    dom.tooltipKind.textContent = subject.kind === 'academic' ? '学科' : '行业';
    dom.tooltipTitle.textContent = subject.name;
    dom.tooltipSub.textContent = subject.tagline;
  } else {
    const point = node.data;
    dom.tooltipKind.textContent = `${point.subject.name} · 知识点`;
    dom.tooltipTitle.textContent = point.title;
    dom.tooltipSub.textContent = point.hook;
  }
  dom.tooltip.hidden = false;
  placeTooltip(state.lastPointer);
}

function hideTooltip() {
  dom.tooltip.hidden = true;
}

function placeTooltip(position) {
  if (!position || dom.tooltip.hidden) return;
  const pad = 14;
  const rect = dom.tooltip.getBoundingClientRect();
  let left = position.x + 18;
  let top = position.y + 18;
  if (left + rect.width > window.innerWidth - pad) left = position.x - rect.width - 18;
  if (top + rect.height > window.innerHeight - pad) top = position.y - rect.height - 18;
  dom.tooltip.style.left = `${Math.max(pad, left)}px`;
  dom.tooltip.style.top = `${Math.max(pad, top)}px`;
}

/* --------------------------------- search --------------------------------- */
function updateSearch() {
  hideTooltip();
  const query = dom.searchInput.value.trim().toLowerCase();
  if (!query) {
    hideSearch();
    return;
  }
  state.searchHits = ALL_POINTS.filter((point) => {
    const haystack = [point.title, point.hook, point.tags.join(' '), point.subject.name, point.subject.en, point.subject.tagline]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }).slice(0, 9);
  state.searchActive = state.searchHits.length ? 0 : -1;

  if (!state.searchHits.length) {
    dom.searchResults.innerHTML = '<div class="search-empty">没有找到匹配的知识点</div>';
  } else {
    dom.searchResults.innerHTML = state.searchHits
      .map(
        (point, index) =>
          `<button class="search-result ${index === 0 ? 'active' : ''}" type="button" data-search-id="${point.id}">
            <span class="dot" style="background:${point.subject.color};color:${point.subject.color}"></span>
            <span class="sr-main"><strong>${esc(point.title)}</strong><small>${esc(point.hook)}</small></span>
            <span class="sr-subject">${esc(point.subject.name)}</span>
          </button>`
      )
      .join('');
  }
  dom.searchResults.hidden = false;
}

function hideSearch() {
  dom.searchResults.hidden = true;
  dom.searchResults.innerHTML = '';
  state.searchHits = [];
  state.searchActive = -1;
}

function updateSearchActive(next) {
  if (!state.searchHits.length) return;
  state.searchActive = (next + state.searchHits.length) % state.searchHits.length;
  dom.searchResults.querySelectorAll('.search-result').forEach((item, index) => {
    item.classList.toggle('active', index === state.searchActive);
  });
}

function chooseSearch(index) {
  const point = state.searchHits[index];
  if (!point) return;
  hideSearch();
  dom.searchInput.value = '';
  dom.searchInput.blur();
  openLesson(point);
}

/* ---------------------------------- tour ---------------------------------- */
function setTour(enabled) {
  tourEnabled = enabled;
  graph.setAutoRotate(enabled);
  updateTourButton();
}

function stopTour() {
  if (!tourEnabled) return;
  setTour(false);
}

function updateTourButton() {
  dom.btnTour.setAttribute('aria-pressed', String(tourEnabled));
}

/* ------------------------------- 深链接入口 ------------------------------- */
function enterUniverse() {
  dom.intro.classList.add('is-gone');
  graph?.enter();
}

function handleHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return;
  const [key, value] = hash.split('=');
  if (key === 'enter') {
    setTimeout(enterUniverse, 500);
    return;
  }
  if (key === 'lesson' && value && POINT_BY_ID[value]) {
    setTimeout(() => {
      enterUniverse();
      openLesson(POINT_BY_ID[value]);
    }, 650);
    return;
  }
  if (key === 'tier') {
    const level = Math.max(1, Math.min(8, Number(value) || 1));
    setTimeout(() => {
      enterUniverse();
      stopTour();
      hud?.selectTier(level);
    }, 650);
    return;
  }
  if (key === 'challenge') {
    setTimeout(() => {
      enterUniverse();
      openChallenge();
    }, 650);
  }
}

/* --------------------------------- events --------------------------------- */
function bindEvents() {
  dom.btnEnter.addEventListener('click', () => {
    dom.intro.classList.add('is-gone');
    graph.enter();
  });

  dom.brandHome.addEventListener('click', (event) => {
    event.preventDefault();
    closePanel();
  });

  dom.panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-panel]')) {
      closePanel();
      return;
    }
    const start = event.target.closest('[data-start-lesson]');
    if (start) {
      openLesson(POINT_BY_ID[start.dataset.startLesson]);
      return;
    }
    const card = event.target.closest('.point-card');
    if (card) togglePointCard(card);
  });

  dom.panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.point-card');
    if (!card || event.target !== card) return;
    event.preventDefault();
    togglePointCard(card);
  });

  dom.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    const kind = button.dataset.filter;
    state.filter = kind;
    hideTooltip();
    dom.filters.querySelectorAll('.filter').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    graph.setFilter(kind);
    if (state.selectedSubjectId) {
      const subject = SUBJECT_BY_ID[state.selectedSubjectId];
      if (kind !== 'all' && subject.kind !== kind) closePanel();
    }
  });

  dom.btnTour.addEventListener('click', () => setTour(!tourEnabled));

  dom.btnResetView.addEventListener('click', () => {
    closePanel();
    graph.resetView();
  });

  dom.searchInput.addEventListener('input', updateSearch);
  dom.searchInput.addEventListener('focus', () => {
    if (dom.searchInput.value.trim()) updateSearch();
  });
  dom.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateSearchActive(state.searchActive + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateSearchActive(state.searchActive - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseSearch(state.searchActive >= 0 ? state.searchActive : 0);
    } else if (event.key === 'Escape') {
      hideSearch();
      dom.searchInput.blur();
    }
  });

  dom.searchResults.addEventListener('click', (event) => {
    const item = event.target.closest('[data-search-id]');
    if (!item) return;
    chooseSearch(state.searchHits.findIndex((point) => point.id === item.dataset.searchId));
  });

  document.addEventListener('pointerdown', (event) => {
    if (!dom.searchShell.contains(event.target)) hideSearch();
    if (event.target !== dom.graphCanvas) hideTooltip();
  });

  document.addEventListener('keydown', (event) => {
    if (document.body.classList.contains('lesson-open') || document.body.classList.contains('challenge-open')) return;
    if (event.key === 'Escape') {
      if (!dom.searchResults.hidden) {
        hideSearch();
        return;
      }
      if (state.selectedSubjectId) {
        closePanel();
        return;
      }
    }
    if (event.key === '/') {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      dom.searchInput.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (!dom.tooltip.hidden) placeTooltip(state.lastPointer);
  });
}

boot();
