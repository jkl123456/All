/**
 * 挑战模式：限时、连击、三颗心。
 * 题库来自「学过的知识点」——没学过就考不过，这不是 bug，是设计。
 */
import { ALL_POINTS } from '../data/subjects.js';
import { buildLesson } from '../data/lessons.js';
import { TIER_BY_LEVEL, tierFor } from '../data/tiers.js';
import { currentTierLevel, isLearned, learnedPoints, recordChallenge, getState } from './progress.js';

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const QUESTION_TIME = 13;
const TOTAL_QUESTIONS = 8;
const HEARTS = 3;

function shuffle(arr, seed = Date.now()) {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.5 3.2C20.5 15 12 20.5 12 20.5z"/></svg>';

export class ChallengeOverlay {
  constructor({ root, onClose } = {}) {
    this.root = root;
    this.onClose = onClose || (() => {});
    this.scope = 'tier';
    this.queue = [];
    this.index = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hearts = HEARTS;
    this.correct = 0;
    this.wrong = [];
    this.answered = false;
    this.timer = null;
    this.remaining = QUESTION_TIME;
    this.build();
    this.bind();
  }

  build() {
    this.el = document.createElement('section');
    this.el.className = 'challenge';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="challenge-shell">
        <header class="challenge-top">
          <button class="lesson-back" type="button" data-close><span class="back-arrow">←</span><span>退出挑战</span></button>
          <div class="challenge-live" id="challenge-live" hidden>
            <div class="hearts" id="challenge-hearts"></div>
            <div class="challenge-score"><small>SCORE</small><strong id="challenge-score">0</strong></div>
            <div class="combo" id="challenge-combo"><b>x1</b><span>连击</span></div>
          </div>
          <div class="challenge-timer" id="challenge-timer" hidden>
            <svg viewBox="0 0 44 44"><circle class="t-bg" cx="22" cy="22" r="19"></circle><circle class="t-fg" id="challenge-ring" cx="22" cy="22" r="19"></circle></svg>
            <b id="challenge-count">13</b>
          </div>
        </header>
        <div class="challenge-body" id="challenge-body"></div>
      </div>
    `;
    this.root.appendChild(this.el);
    this.$body = this.el.querySelector('#challenge-body');
    this.$live = this.el.querySelector('#challenge-live');
    this.$hearts = this.el.querySelector('#challenge-hearts');
    this.$score = this.el.querySelector('#challenge-score');
    this.$combo = this.el.querySelector('#challenge-combo');
    this.$timer = this.el.querySelector('#challenge-timer');
    this.$ring = this.el.querySelector('#challenge-ring');
    this.$count = this.el.querySelector('#challenge-count');
  }

  bind() {
    this.el.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this.close();
        return;
      }
      const scope = event.target.closest('[data-scope]');
      if (scope) {
        this.scope = scope.dataset.scope;
        this.el.querySelectorAll('[data-scope]').forEach((btn) => btn.classList.toggle('active', btn === scope));
        this.renderSetup();
        return;
      }
      if (event.target.closest('[data-start]')) {
        this.start();
        return;
      }
      const option = event.target.closest('[data-option]');
      if (option) {
        this.answer(Number(option.dataset.option));
        return;
      }
      if (event.target.closest('[data-next]')) {
        this.next();
        return;
      }
      if (event.target.closest('[data-retry]')) {
        this.renderSetup();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (!this.isOpen()) return;
      if (event.key === 'Escape') this.close();
      if (this.answered && (event.key === 'Enter' || event.key === ' ')) this.next();
      const n = Number(event.key);
      if (!this.answered && n >= 1 && n <= 4) this.answer(n - 1);
    });
  }

  isOpen() {
    return this.el.classList.contains('open');
  }

  open() {
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('challenge-open');
    this.renderSetup();
  }

  close() {
    if (!this.isOpen()) return;
    this.stopTimer();
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('challenge-open');
    this.onClose();
  }

  /* --------------------------------- 选择范围 -------------------------------- */
  poolForScope() {
    const learned = learnedPoints();
    const tier = currentTierLevel();
    if (this.scope === 'learned') return learned.length >= 4 ? learned : ALL_POINTS;
    if (this.scope === 'tier') return ALL_POINTS.filter((p) => p.tier === tier);
    return ALL_POINTS;
  }

  renderSetup() {
    const pool = this.poolForScope();
    const learned = learnedPoints();
    const learnedCount = learned.length;
    const tier = tierFor(currentTierLevel());
    const best = getState().challenge.best;
    this.$live.hidden = true;
    this.$timer.hidden = true;
    this.$body.innerHTML = `
      <div class="challenge-setup">
        <p class="setup-kicker">CHALLENGE MODE</p>
        <h2>检验你真正记住了什么</h2>
        <p class="setup-desc">限时抢答，连击加倍。全局都不设门槛，想考哪一段就考哪一段。</p>
        <div class="scope-row">
          <button class="scope-card ${this.scope === 'tier' ? 'active' : ''}" data-scope="tier">
            <span class="scope-name">本段 · ${tier.name}</span>
            <span class="scope-sub">第 ${currentTierLevel()} 段全部 ${ALL_POINTS.filter((p) => p.tier === currentTierLevel()).length} 个知识点</span>
          </button>
          <button class="scope-card ${this.scope === 'learned' ? 'active' : ''}" data-scope="learned">
            <span class="scope-name">已学过的</span>
            <span class="scope-sub">${learnedCount} 个知识点 · ${learnedCount >= 4 ? `${Math.round(learnedCount * 2.2)} 道题` : '不足 4 个时自动用全部题库'}</span>
          </button>
          <button class="scope-card ${this.scope === 'all' ? 'active' : ''}" data-scope="all">
            <span class="scope-name">全体知识点</span>
            <span class="scope-sub">${ALL_POINTS.length} 个知识点 · 没学过也能考</span>
          </button>
        </div>
        <div class="setup-meta">
          <div><strong>${TOTAL_QUESTIONS}</strong><span>题</span></div>
          <div><strong>${HEARTS}</strong><span>颗心</span></div>
          <div><strong>${QUESTION_TIME}s</strong><span>每题</span></div>
          <div><strong>${best}</strong><span>最高分</span></div>
        </div>
        <div class="setup-actions">
          <button class="primary-btn" type="button" data-start ${pool.length < 4 ? 'disabled' : ''}>
            开始挑战<span class="arrow">→</span>
          </button>
          ${pool.length < 4 ? '<p class="setup-warn">这个范围里的知识点太少，先去闯几关再来。</p>' : ''}
        </div>
      </div>
    `;
  }

  /* ---------------------------------- 开局 ---------------------------------- */
  start() {
    const pool = this.poolForScope();
    const bank = [];
    for (const point of pool) {
      const lesson = buildLesson(point);
      if (!lesson?.quiz?.length) continue;
      for (const q of lesson.quiz) {
        bank.push({ ...q, point, tier: point.tier });
      }
    }
    this.queue = shuffle(bank).slice(0, TOTAL_QUESTIONS);
    if (this.queue.length < 4) return;
    this.index = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hearts = HEARTS;
    this.correct = 0;
    this.wrong = [];
    this.$live.hidden = false;
    this.$timer.hidden = false;
    this.renderHud();
    this.renderQuestion();
  }

  renderHud() {
    this.$hearts.innerHTML = Array.from({ length: HEARTS })
      .map((_, i) => `<i class="${i < this.hearts ? 'on' : ''}">${HEART_SVG}</i>`)
      .join('');
    this.$score.textContent = String(this.score);
    const mult = this.multiplier();
    this.$combo.querySelector('b').textContent = `x${mult.toFixed(1)}`;
    this.$combo.classList.toggle('hot', this.combo >= 3);
  }

  multiplier() {
    return Math.min(2.4, 1 + this.combo * 0.15);
  }

  renderQuestion() {
    const q = this.queue[this.index];
    if (!q) {
      this.finish();
      return;
    }
    this.answered = false;
    const tier = TIER_BY_LEVEL[q.point.tier];
    this.$body.innerHTML = `
      <div class="quiz-progress"><i style="width:${(this.index / this.queue.length) * 100}%"></i></div>
      <div class="quiz-stage">
        <div class="quiz-meta">
          <span class="quiz-index">${String(this.index + 1).padStart(2, '0')} / ${String(this.queue.length).padStart(2, '0')}</span>
          <span class="quiz-tier" style="--tier:${tier.color}"><i></i>${tier.name} · ${esc(q.point.subject.name)}</span>
        </div>
        <h2 class="quiz-q">${esc(q.q)}</h2>
        <div class="quiz-grid">
          ${q.options
            .map(
              (opt, i) =>
                `<button class="quiz-card" type="button" data-option="${i}">
                  <span class="qc-key">${String.fromCharCode(65 + i)}</span>
                  <span class="qc-text">${esc(opt)}</span>
                </button>`
            )
            .join('')}
        </div>
        <div class="quiz-explain" id="quiz-explain" hidden></div>
      </div>
    `;
    this.startTimer();
  }

  startTimer() {
    this.stopTimer();
    this.remaining = QUESTION_TIME;
    this.updateRing();
    this.timer = setInterval(() => {
      this.remaining -= 0.1;
      this.updateRing();
      if (this.remaining <= 0) {
        this.stopTimer();
        this.answer(-1);
      }
    }, 100);
  }

  updateRing() {
    const k = Math.max(0, this.remaining / QUESTION_TIME);
    const len = 2 * Math.PI * 19;
    this.$ring.style.strokeDasharray = `${len}`;
    this.$ring.style.strokeDashoffset = `${len * (1 - k)}`;
    this.$ring.style.stroke = k > 0.5 ? '#6BE7FF' : k > 0.25 ? '#FFD98A' : '#FF8E6B';
    this.$count.textContent = String(Math.max(0, Math.ceil(this.remaining)));
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  answer(choice) {
    if (this.answered) return;
    this.answered = true;
    this.stopTimer();
    const q = this.queue[this.index];
    const ok = choice === q.answer;
    const cards = this.$body.querySelectorAll('.quiz-card');
    cards.forEach((card, i) => {
      card.disabled = true;
      if (i === q.answer) card.classList.add('correct');
      if (i === choice && !ok) card.classList.add('wrong');
    });

    let gained = 0;
    if (ok) {
      this.correct += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      gained = Math.round((100 + Math.max(0, this.remaining) * 9) * this.multiplier());
      this.score += gained;
      this.el.classList.add('flash-ok');
      setTimeout(() => this.el.classList.remove('flash-ok'), 320);
    } else {
      this.hearts -= 1;
      this.combo = 0;
      this.wrong.push(q);
      this.el.classList.add('flash-no');
      setTimeout(() => this.el.classList.remove('flash-no'), 320);
    }
    this.renderHud();

    const explain = this.$body.querySelector('#quiz-explain');
    explain.hidden = false;
    explain.className = `quiz-explain ${ok ? 'ok' : 'no'}`;
    explain.innerHTML = `
      <div class="ex-head">
        <strong>${ok ? `+${gained} 分` : choice === -1 ? '超时了' : '答错了'}</strong>
        <span>${ok ? (this.combo > 1 ? `${this.combo} 连击 · x${this.multiplier().toFixed(1)}` : '继续保持') : `正确答案：${String.fromCharCode(65 + q.answer)}`}</span>
      </div>
      <p>${esc(q.why)}</p>
      <button class="primary-btn small" type="button" data-next>${this.hearts <= 0 ? '查看成绩' : '下一题'}<span class="arrow">→</span></button>
    `;
  }

  next() {
    if (!this.answered) return;
    if (this.hearts <= 0) {
      this.finish();
      return;
    }
    this.index += 1;
    if (this.index >= this.queue.length) {
      this.finish();
    } else {
      this.renderQuestion();
    }
  }

  finish() {
    this.stopTimer();
    const total = this.index + (this.answered ? 1 : 0);
    const accuracy = total ? this.correct / total : 0;
    const grade = accuracy >= 0.95 ? 'S' : accuracy >= 0.82 ? 'A' : accuracy >= 0.66 ? 'B' : 'C';
    const result = recordChallenge({ score: this.score, combo: this.maxCombo, correct: this.correct, total });
    this.$live.hidden = true;
    this.$timer.hidden = true;
    this.$body.innerHTML = `
      <div class="challenge-result">
        <p class="result-kicker">RUN COMPLETE</p>
        <div class="grade grade-${grade}"><span>${grade}</span></div>
        <div class="result-score"><b>${this.score}</b><span>本次得分</span></div>
        <div class="result-stats">
          <div><strong>${this.correct}/${total || 0}</strong><span>正确</span></div>
          <div><strong>${Math.round(accuracy * 100)}%</strong><span>正确率</span></div>
          <div><strong>${this.maxCombo}</strong><span>最高连击</span></div>
          <div><strong>${result.best}</strong><span>历史最高</span></div>
        </div>
        ${
          this.wrong.length
            ? `<div class="result-wrong">
                <h3>这些还没记牢</h3>
                <ul>${this.wrong
                  .slice(0, 4)
                  .map((q) => `<li><span>${esc(q.point.title)}</span>${esc(q.q)}</li>`)
                  .join('')}</ul>
              </div>`
            : '<p class="result-perfect">全部答对。这个段位对你来说已经太简单了。</p>'
        }
        <div class="setup-actions">
          <button class="primary-btn" type="button" data-retry>再来一局<span class="arrow">→</span></button>
          <button class="ghost-btn" type="button" data-close>返回图谱</button>
        </div>
      </div>
    `;
  }
}
