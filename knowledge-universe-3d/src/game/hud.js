/**
 * 顶部段位轨道 + 积分 HUD + 段位关卡看板。
 * 段位是「难度选择器」，也是「进度条」：星数够了才解锁下一段。
 */
import { ALL_POINTS } from '../data/subjects.js';
import { TIERS, TIER_BY_LEVEL, tierFor } from '../data/tiers.js';
import { CURRICULUM, curriculumIndex, nextLessonPoint } from '../data/lessons.js';
import {
  currentTierLevel,
  isLearned,
  starsOf,
  starsToNextTier,
  subscribe,
  summary,
  tierStats,
  totalStars,
} from './progress.js';

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class GameHud {
  constructor({ tierTrack, statsHost, boardHost, ctaHost, onStartPoint, onChallenge, onSelectTier } = {}) {
    this.$track = tierTrack;
    this.$stats = statsHost;
    this.$boardHost = boardHost;
    this.$cta = ctaHost;
    this.onStartPoint = onStartPoint || (() => {});
    this.onChallenge = onChallenge || (() => {});
    this.onSelectTier = onSelectTier || (() => {});
    this.selectedTier = null;
    this.boardTier = null;
    this.lastXp = 0;
    this.buildBoard();
    this.bind();
    this.refresh();
    subscribe(() => this.refresh());
  }

  buildBoard() {
    this.$board = document.createElement('div');
    this.$board.className = 'board';
    this.$board.setAttribute('aria-hidden', 'true');
    this.$board.innerHTML = '<div class="board-shell" id="board-shell"></div>';
    this.$boardHost.appendChild(this.$board);
    this.$shell = this.$board.querySelector('#board-shell');
  }

  bind() {
    this.$track.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tier]');
      if (!btn) return;
      const level = Number(btn.dataset.tier);
      if (this.selectedTier === level) {
        this.closeBoard();
        return;
      }
      this.openBoard(level);
    });

    this.$board.addEventListener('click', (event) => {
      if (event.target.closest('[data-board-close]') || event.target === this.$board) {
        this.closeBoard();
        return;
      }
      const card = event.target.closest('[data-point]');
      if (card) {
        const point = ALL_POINTS.find((p) => p.id === card.dataset.point);
        if (point) {
          this.closeBoard();
          this.onStartPoint(point);
        }
        return;
      }
      if (event.target.closest('[data-board-challenge]')) {
        this.closeBoard();
        this.onChallenge();
      }
      if (event.target.closest('[data-board-next]')) {
        const next = TIER_BY_LEVEL[(this.boardTier || 1) + 1];
        if (next) this.openBoard(next.level);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.$board.classList.contains('open')) this.closeBoard();
    });
  }

  /* --------------------------------- 轨道 --------------------------------- */
  refreshTrack() {
    const stars = totalStars();
    const activeLevel = this.selectedTier || currentTierLevel();
    this.$track.innerHTML = TIERS.map((tier, i) => {
      const stats = tierStats(tier.level);
      const isCurrent = tier.level === currentTierLevel();
      return `
        <button class="tier-node unlocked ${tier.level === activeLevel ? 'active' : ''} ${isCurrent ? 'current' : ''}"
          data-tier="${tier.level}" type="button" style="--tc:${tier.color};--td:${tier.deep}" title="${tier.name} · 已通关 ${stats.done}/${stats.total}">
          <span class="tn-glow"></span>
          <span class="tn-badge"><b>${tier.level}</b></span>
          <span class="tn-name">${tier.name}</span>
          <span class="tn-sub">${stats.done}/${stats.total}</span>
          ${i < TIERS.length - 1 ? '<span class="tn-link"></span>' : ''}
        </button>`;
    }).join('');
    const ratio = Math.min(1, stars / TIERS[TIERS.length - 1].stars);
    this.$track.style.setProperty('--fill', `${ratio * 100}%`);
  }

  /* --------------------------------- HUD --------------------------------- */
  refresh() {
    this.refreshTrack();
    const s = summary();
    const tier = tierFor(s.tier);
    const nextStars = starsToNextTier();
    const nextTierObj = TIER_BY_LEVEL[Math.min(8, s.tier + 1)];
    this.$stats.innerHTML = `
      <div class="hud-chip tier-chip" style="--tc:${tier.color}">
        <i></i><span>${tier.name}</span>
      </div>
      <div class="hud-chip">
        <small>积分</small><strong data-hud-xp>${s.xp}</strong>
      </div>
      <div class="hud-chip">
        <small>星</small><strong>${s.stars}<em>/${s.maxStars}</em></strong>
      </div>
      <div class="hud-chip">
        <small>通关</small><strong>${s.learned}<em>/${s.total}</em></strong>
      </div>
      <button class="hud-action" type="button" data-hud-challenge>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
        挑战
      </button>
    `;
    this.$stats.querySelector('[data-hud-challenge]').addEventListener('click', () => this.onChallenge());

    const xpNode = this.$stats.querySelector('[data-hud-xp]');
    if (xpNode && this.lastXp !== s.xp) {
      xpNode.parentElement.classList.remove('bump');
      void xpNode.offsetWidth;
      xpNode.parentElement.classList.add('bump');
      this.lastXp = s.xp;
    }

    this.refreshCta(nextTierObj, nextStars);
    if (this.$board.classList.contains('open') && this.boardTier) this.renderBoard(this.boardTier);
  }

  refreshCta(nextTierObj, nextStars) {
    const next = nextLessonPoint(this._lastPointId || '') || this.nextPoint();
    const nextId = isLearned(next?.id) ? this.nextPoint() : next;
    const label = nextId ? nextId.title : '复看已通关卡';
    this.$cta.innerHTML = `
      <button class="cta-card" type="button" data-cta>
        <span class="cta-main">
          <small>继续闯关 · ${nextId ? `${tierFor(nextId.tier).name}` : '已完成'}</small>
          <strong>${esc(label)}</strong>
        </span>
        <span class="cta-arrow">→</span>
      </button>
      <span class="cta-progress">${nextTierObj && nextStars > 0 ? `再得 ${nextStars} 星晋级 ${nextTierObj.name}` : '已达最高段位'}</span>
    `;
    this.$cta.querySelector('[data-cta]').addEventListener('click', () => {
      if (nextId) this.onStartPoint(nextId);
      else this.onChallenge();
    });
  }

  nextPoint() {
    for (const point of CURRICULUM) {
      if (!isLearned(point.id)) return point;
    }
    return CURRICULUM[0];
  }

  setLastPoint(id) {
    this._lastPointId = id;
    this.refresh();
  }

  /* -------------------------------- 看板 -------------------------------- */
  openBoard(level) {
    this.boardTier = level;
    this.selectedTier = level;
    this.renderBoard(level);
    this.refreshTrack();
    this.$board.classList.add('open');
    this.$board.setAttribute('aria-hidden', 'false');
    this.onSelectTier(level);
  }

  selectTier(level) {
    if (!TIER_BY_LEVEL[level]) return;
    this.openBoard(level);
  }

  closeBoard() {
    this.$board.classList.remove('open');
    this.$board.setAttribute('aria-hidden', 'true');
    if (this.selectedTier) {
      this.selectedTier = null;
      this.refreshTrack();
      this.onSelectTier(null);
    }
  }

  renderBoard(level) {
    const tier = TIER_BY_LEVEL[level];
    const stats = tierStats(level);
    const points = ALL_POINTS.filter((p) => p.tier === level).sort((a, b) => {
      return curriculumIndex(a.id) - curriculumIndex(b.id);
    });
    const pct = stats.total ? stats.done / stats.total : 0;
    const nextTierObj = TIER_BY_LEVEL[level + 1];
    this.$shell.innerHTML = `
      <header class="board-head" style="--tc:${tier.color};--td:${tier.deep}">
        <div class="board-emblem">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dasharray:${2 * Math.PI * 52};stroke-dashoffset:${2 * Math.PI * 52 * (1 - pct)}"></circle>
          </svg>
          <b>${level}</b>
        </div>
        <div class="board-title">
          <p class="board-kicker">TIER ${level} / 8 · ${tier.en}</p>
          <h2>${tier.name}</h2>
          <p class="board-motto">${tier.motto}</p>
          <p class="board-brief">${tier.brief}</p>
        </div>
        <div class="board-stats">
          <div><strong>${stats.done}<em>/${stats.total}</em></strong><span>已通关</span></div>
          <div><strong>${stats.stars}<em>/${stats.maxStars}</em></strong><span>星</span></div>
          <button class="board-close" type="button" data-board-close aria-label="关闭">✕</button>
        </div>
      </header>
      <div class="board-grid">
        ${points
          .map((point, i) => {
            const learned = isLearned(point.id);
            const stars = starsOf(point.id);
            return `
            <button class="level-card ${learned ? 'done' : ''}" data-point="${point.id}" type="button"
              style="--sc:${point.subject.color}">
              <span class="lc-index">${String(i + 1).padStart(2, '0')}</span>
              <span class="lc-body">
                <span class="lc-subject"><i></i>${esc(point.subject.name)}</span>
                <strong>${esc(point.title)}</strong>
                <small>${esc(point.hook)}</small>
              </span>
              <span class="lc-stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}">★</i>`).join('')}</span>
              <span class="lc-go">${learned ? '复习' : '闯关'} →</span>
            </button>`;
          })
          .join('')}
      </div>
      <footer class="board-foot">
        <div class="board-tip">${
          stats.complete
            ? `本段全部通关。${nextTierObj ? `再得 ${Math.max(0, nextTierObj.stars - totalStars())} 星，段位徽章会升到 ${nextTierObj.name}。` : '你已经在最高处了。'}`
            : '所有关卡都可以直接进入；星星只影响段位徽章与积分，不影响解锁。'
        }</div>
        <div class="board-actions">
          <button class="ghost-btn" type="button" data-board-challenge>挑战本段知识</button>
          ${
            nextTierObj
              ? `<button class="ghost-btn" type="button" data-board-next>前往 ${nextTierObj.name} →</button>`
              : ''
          }
        </div>
      </footer>
    `;
  }

  toast(text) {
    let node = document.querySelector('.game-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'game-toast';
      document.body.appendChild(node);
    }
    node.textContent = text;
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
  }
}
