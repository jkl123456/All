/**
 * 关卡（Lesson）覆盖层
 * 一幕一幕往下走；每一幕只改几个变量，画面自己过渡。
 * 走完所有幕 → 一道检查点 → 星级结算 → 下一关。
 */
import { Stage } from './stage.js';
import { installEngines } from './engines/index.js';
import { buildLesson, nextLessonPoint, CURRICULUM, curriculumIndex } from '../data/lessons.js';
import { TIER_BY_LEVEL } from '../data/tiers.js';
import { completeLesson, isLearned, starsOf, currentTierLevel } from './progress.js';

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let enginesInstalled = false;

export class LessonOverlay {
  constructor({ root, onClose, onStartPoint, onOpenLab } = {}) {
    if (!enginesInstalled) {
      installEngines();
      enginesInstalled = true;
    }
    this.root = root;
    this.onClose = onClose || (() => {});
    this.onStartPoint = onStartPoint || (() => {});
    this.onOpenLab = onOpenLab || (() => {});
    this.point = null;
    this.lesson = null;
    this.index = 0;
    this.mode = 'beats';
    this.hintUsed = false;
    this.quizIndex = 0;
    this.quizCorrect = 0;
    this.quizAnswered = false;
    this.stage = null;
    this.result = null;
    this.build();
    this.bind();
  }

  build() {
    this.el = document.createElement('section');
    this.el.className = 'lesson';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <header class="lesson-top">
        <button class="lesson-back" type="button" data-close>
          <span class="back-arrow">←</span><span>返回图谱</span>
        </button>
        <div class="lesson-head">
          <div class="lesson-tier" id="lesson-tier"></div>
          <h2 id="lesson-heading">知识点</h2>
        </div>
        <div class="lesson-meta">
          <div class="beat-dots" id="lesson-dots"></div>
          <div class="lesson-xp" id="lesson-xp"><small>本关可得</small><strong>+0</strong></div>
        </div>
      </header>
      <div class="lesson-body">
        <div class="lesson-stage" id="lesson-stage">
          <div class="stage-hud">
            <span class="stage-live"><i></i>实时演算</span>
            <span class="stage-scale" id="lesson-scale"></span>
          </div>
          <div class="stage-vars" id="lesson-vars"></div>
          <div class="stage-reward" id="lesson-reward" hidden></div>
        </div>
        <aside class="lesson-side" id="lesson-side"></aside>
      </div>
      <footer class="lesson-foot">
        <button class="ghost-btn lesson-hint" type="button" id="lesson-hint">提示</button>
        <div class="lesson-track"><div class="lesson-track-fill" id="lesson-track-fill"></div></div>
        <div class="lesson-actions">
          <button class="ghost-btn" type="button" id="lesson-prev">上一步</button>
          <button class="primary-btn lesson-next" type="button" id="lesson-next">下一步<span class="arrow">→</span></button>
        </div>
      </footer>
    `;
    this.root.appendChild(this.el);

    this.$tier = this.el.querySelector('#lesson-tier');
    this.$heading = this.el.querySelector('#lesson-heading');
    this.$dots = this.el.querySelector('#lesson-dots');
    this.$xp = this.el.querySelector('#lesson-xp');
    this.$stageHost = this.el.querySelector('#lesson-stage');
    this.$vars = this.el.querySelector('#lesson-vars');
    this.$reward = this.el.querySelector('#lesson-reward');
    this.$side = this.el.querySelector('#lesson-side');
    this.$scale = this.el.querySelector('#lesson-scale');
    this.$prev = this.el.querySelector('#lesson-prev');
    this.$next = this.el.querySelector('#lesson-next');
    this.$hint = this.el.querySelector('#lesson-hint');
    this.$track = this.el.querySelector('#lesson-track-fill');
  }

  bind() {
    this.el.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        this.close();
        return;
      }
      if (event.target.closest('#lesson-next')) {
        this.advance();
        return;
      }
      if (event.target.closest('#lesson-prev')) {
        this.back();
        return;
      }
      if (event.target.closest('#lesson-hint')) {
        this.revealHint();
        return;
      }
      const option = event.target.closest('[data-option]');
      if (option) {
        this.answerQuiz(Number(option.dataset.option));
        return;
      }
      const nextAction = event.target.closest('[data-action]');
      if (nextAction) {
        this.rewardAction(nextAction.dataset.action);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!this.isOpen()) return;
      if (event.key === 'Escape') {
        this.close();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        if (!event.target.closest('input')) this.advance();
      } else if (event.key === 'ArrowLeft') {
        this.back();
      }
    });
  }

  isOpen() {
    return this.el.classList.contains('open');
  }

  open(pointId) {
    const lesson = buildLesson(
      typeof pointId === 'string' ? CURRICULUM.find((p) => p.id === pointId) || null : pointId
    );
    if (!lesson) return;
    this.point = lesson.point;
    this.lesson = lesson;
    this.index = 0;
    this.mode = 'beats';
    this.hintUsed = false;
    this.quizIndex = 0;
    this.quizCorrect = 0;
    this.quizAnswered = false;
    this.result = null;

    this.el.classList.add('open');
    this.el.classList.remove('is-reward');
    this.el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lesson-open');

    if (!this.stage) {
      this.stage = new Stage(this.$stageHost);
      this.stage.svg.classList.add('lesson-svg');
    }
    this.mountBoard();

    const tier = TIER_BY_LEVEL[this.point.tier];
    this.$tier.innerHTML = `<i style="background:${tier.color};box-shadow:0 0 10px ${tier.color}"></i>${tier.name} · 第 ${this.point.tier} 段<span class="dot-sep"></span>${esc(this.point.subject.name)}`;
    this.$heading.textContent = this.point.title;
    this.$reward.hidden = true;
    this.$side.hidden = false;
    this.$vars.hidden = false;

    this.renderVars();
    this.renderDots();
    this.renderBeat();
    this.updateXpPreview();
  }

  close() {
    if (!this.isOpen()) return;
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lesson-open');
    this.stage?.teardown();
    this.onClose(this.point);
  }

  /* --------------------------------- 渲染 --------------------------------- */
  mountBoard() {
    this.stage.mount('board', this.lesson.boardSpec || this.lesson.spec, { step: this.index });
    this.el.classList.add('is-board');
    this.$scale.textContent = `${this.point.subject.en} · BOARD`;
  }

  renderDots() {
    const total = this.lesson.beats.length + 2;
    this.$dots.innerHTML = Array.from({ length: total })
      .map((_, i) => {
        const cls = i < this.index ? 'done' : i === this.index ? 'active' : '';
        return `<i class="${cls}"></i>`;
      })
      .join('');
  }

  renderVars() {
    const vars = this.lesson.vars || [];
    if (!vars.length || true) {
      this.$vars.hidden = true;
      this.$vars.innerHTML = '';
      return;
    }
    this.$vars.hidden = false;
    this.$vars.innerHTML = `<div class="vars-head"><span>变量控制</span><small>拖动会实时演算</small></div>${vars
      .map(
        (v) => `
        <label class="var-row">
          <span class="var-label">${esc(v.label)}</span>
          <span class="var-value" data-var-value="${v.key}"></span>
          <input type="range" min="${v.min}" max="${v.max}" step="${v.step}" value="${this.stage.state[v.key] ?? v.min}"
            data-var="${v.key}" aria-label="${esc(v.label)}" />
        </label>`
      )
      .join('')}`;

    const inputs = this.$vars.querySelectorAll('input[data-var]');
    const sync = (input) => {
      const key = input.dataset.var;
      const spec = vars.find((v) => v.key === key);
      const value = Number(input.value);
      this.stage.setVar(key, value);
      const out = this.$vars.querySelector(`[data-var-value="${key}"]`);
      if (out && spec) out.textContent = `${value.toFixed(spec.digits ?? 2)}${spec.unit || ''}`;
    };
    inputs.forEach((input) => {
      sync(input);
      input.addEventListener('input', () => {
        sync(input);
        this.markTouched();
      });
    });
  }

  markTouched() {
    if (this.touched) return;
    this.touched = true;
    this.el.classList.add('has-touched');
  }

  renderBeat() {
    this.el.classList.remove('is-reward');
    const beat = this.lesson.beats[this.index];
    if (!beat) return;
    this.mode = 'beats';
    this.stage.jump(beat.state || { step: this.index });
    this.$vars.hidden = true;
    this.$reward.hidden = true;
    this.$side.hidden = false;

    const bullets = beat.bullets?.length
      ? `<ul class="beat-bullets">${beat.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    const chips = beat.chips?.length
      ? `<div class="beat-chips">${beat.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`
      : '';
    const quote = beat.quote
      ? `<blockquote class="beat-quote"><i>“</i>${esc(beat.quote)}<i>”</i></blockquote>`
      : '';
    const note = beat.note
      ? `<p class="beat-note"><span class="note-mark">＊</span>${esc(beat.note)}</p>`
      : '';

    this.$side.className = 'lesson-side';
    this.$side.innerHTML = `
      <div class="beat-head">
        <span class="beat-label">${esc(beat.label || `第 ${this.index + 1} 幕`)}</span>
        <span class="beat-count">${String(this.index + 1).padStart(2, '0')} / ${String(this.lesson.beats.length).padStart(2, '0')}</span>
      </div>
      <h3 class="beat-title">${esc(beat.title)}</h3>
      <p class="beat-text">${esc(beat.text)}</p>
      ${quote}
      ${bullets}
      ${chips}
      ${note}
      <div class="beat-formula">${esc(this.point.formula)}</div>
      <p class="beat-source">${esc(this.point.subject.name)} · ${esc(this.point.title)}</p>
    `;
    this.$side.scrollTop = 0;

    this.$prev.disabled = false;
    this.$next.innerHTML =
      this.index === this.lesson.beats.length - 1
        ? '进入检查点<span class="arrow">→</span>'
        : '下一步<span class="arrow">→</span>';
    this.$hint.disabled = !(beat.note || beat.text);
    this.updateTrack();
    this.renderDots();
  }

  updateTrack() {
    const total = this.lesson.beats.length + 2;
    this.$track.style.width = `${((this.index + 1) / total) * 100}%`;
  }

  updateXpPreview() {
    const tier = TIER_BY_LEVEL[this.point.tier];
    const base = Math.round(40 * (1 + (tier.level - 1) * 0.35) * 1.12);
    this.$xp.querySelector('strong').textContent = `+${base}`;
    const learned = isLearned(this.point.id);
    this.$xp.classList.toggle('replay', learned);
    if (learned) {
      this.$xp.querySelector('small').textContent = `已通关 · ${'★'.repeat(starsOf(this.point.id))}`;
    } else {
      this.$xp.querySelector('small').textContent = '本关可得';
    }
  }

  /* --------------------------------- 交互 --------------------------------- */
  advance() {
    if (this.mode === 'beats') {
      if (this.index < this.lesson.beats.length - 1) {
        this.index += 1;
        this.renderBeat();
        this.updateXpPreview();
      } else {
        this.startQuiz();
      }
      return;
    }
    if (this.mode === 'quiz') {
      if (this.quizIndex < this.lesson.quiz.length - 1) {
        this.quizIndex += 1;
        this.renderQuiz();
      } else {
        this.finish();
      }
      return;
    }
    if (this.mode === 'reward') {
      this.rewardAction('next');
    }
  }

  back() {
    if (this.mode === 'reward') return;
    if (this.mode === 'quiz') {
      if (this.quizIndex > 0) {
        this.quizIndex -= 1;
        this.renderQuiz();
      } else {
        this.mode = 'beats';
        this.index = this.lesson.beats.length - 1;
        this.renderBeat();
        this.updateXpPreview();
      }
      return;
    }
    if (this.mode === 'beats' && this.index > 0) {
      this.index -= 1;
      this.renderBeat();
      this.updateXpPreview();
    }
  }

  revealHint() {
    const beat = this.lesson.beats[this.index];
    if (!beat) return;
    const hint = beat.note || `${beat.title}：${(beat.text || '').slice(0, 42)}……`;
    if (this.$side.querySelector('.beat-hint')) return;
    this.hintUsed = true;
    const node = document.createElement('p');
    node.className = 'beat-hint';
    node.innerHTML = `<span>提示</span>${esc(hint)}`;
    this.$side.appendChild(node);
    this.$hint.textContent = '已用提示';
    this.$hint.disabled = true;
    this.updateXpPreview();
  }

  /* --------------------------------- 检查点 --------------------------------- */
  startQuiz() {
    this.mode = 'quiz';
    this.quizIndex = 0;
    this.renderQuiz();
  }

  renderQuiz() {
    const q = this.lesson.quiz[this.quizIndex];
    if (!q) {
      this.finish();
      return;
    }
    this.quizAnswered = false;
    this.$prev.disabled = false;
    this.$next.disabled = false;
    this.$next.innerHTML = this.quizAnswered ? '下一题<span class="arrow">→</span>' : '跳过这题<span class="arrow">→</span>';
    this.$side.className = 'lesson-side quiz';
    this.$side.innerHTML = `
      <div class="beat-head">
        <span class="beat-label">检查点 ${this.quizIndex + 1}</span>
        <span class="beat-count">答对 1 题即可带走这关的星</span>
      </div>
      <h3 class="beat-title">${esc(q.q)}</h3>
      <div class="quiz-options">
        ${q.options
          .map(
            (opt, i) =>
              `<button class="quiz-option" type="button" data-option="${i}"><span class="q-index">${String.fromCharCode(65 + i)}</span><span>${esc(opt)}</span></button>`
          )
          .join('')}
      </div>
      <div class="quiz-feedback" hidden></div>
    `;
    this.$side.scrollTop = 0;
    this.updateTrack();
    this.renderDots();
  }

  answerQuiz(choice) {
    if (this.quizAnswered) return;
    const q = this.lesson.quiz[this.quizIndex];
    const correct = choice === q.answer;
    this.quizAnswered = true;
    if (correct) this.quizCorrect += 1;

    const options = this.$side.querySelectorAll('.quiz-option');
    options.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
      if (i === choice && !correct) btn.classList.add('wrong');
    });
    const feedback = this.$side.querySelector('.quiz-feedback');
    feedback.hidden = false;
    feedback.className = `quiz-feedback ${correct ? 'ok' : 'no'}`;
    feedback.innerHTML = `<strong>${correct ? '答对了' : '正确答案是 ' + String.fromCharCode(65 + q.answer)}</strong><p>${esc(q.why)}</p>`;
    this.$next.disabled = false;
    this.$next.innerHTML =
      this.quizIndex === this.lesson.quiz.length - 1 ? '结算<span class="arrow">→</span>' : '下一题<span class="arrow">→</span>';
    this.updateTrack();
  }

  /* --------------------------------- 结算 --------------------------------- */
  finish() {
    const total = this.lesson.quiz.length;
    const stars = 1 + (this.quizCorrect > 0 ? 1 : 0) + (this.hintUsed ? 0 : 1);
    this.result = completeLesson(this.point, {
      stars,
      correct: this.quizCorrect,
      total,
      hintUsed: this.hintUsed,
    });
    this.mode = 'reward';
    this.el.classList.add('is-reward');
    this.renderReward();
    this.onCompleteResult = this.result;
  }

  renderReward() {
    const result = this.result;
    const next = nextLessonPoint(this.point.id);
    const tier = TIER_BY_LEVEL[this.point.tier];
    this.$side.hidden = true;
    this.$vars.hidden = true;
    this.$reward.hidden = false;
    this.$reward.innerHTML = `
      <div class="reward-inner">
        <p class="reward-kicker">${result.firstClear ? 'LEVEL CLEAR' : 'REPLAY CLEAR'}</p>
        <div class="reward-stars">
          ${[0, 1, 2]
            .map((i) => `<i class="${i < result.stars ? 'on' : ''}" style="--d:${i * 0.14}s">★</i>`)
            .join('')}
        </div>
        <h3>${esc(this.point.title)}</h3>
        <p class="reward-tier" style="--tier:${tier.color}"><i></i>${tier.name} · ${esc(this.point.subject.name)}</p>
        <div class="reward-xp"><span>+<b data-count="${result.xp}">0</b></span><small>积分</small></div>
        <div class="reward-stats">
          <div><strong>${this.quizCorrect}/${this.lesson.quiz.length}</strong><span>检查点</span></div>
          <div><strong>${result.starGain > 0 ? `+${result.starGain}` : '0'}</strong><span>新星</span></div>
          <div><strong>${this.hintUsed ? '用了' : '没用'}</strong><span>提示</span></div>
        </div>
        ${result.tierUp ? `<p class="reward-tierup">晋级 <b>${result.tierUp.name}</b> · ${result.tierUp.motto}</p>` : ''}
        <div class="reward-actions">
          ${
            next
              ? `<button class="primary-btn" type="button" data-action="next">下一关 · ${esc(next.title)}<span class="arrow">→</span></button>`
              : `<button class="primary-btn" type="button" data-action="next">回到图谱<span class="arrow">→</span></button>`
          }
          <button class="ghost-btn" type="button" data-action="replay">${result.stars < 3 ? '再挑战一次' : '重看一遍'}</button>
          <button class="ghost-btn" type="button" data-action="close">返回图谱</button>
        </div>
        <p class="reward-note">${esc(this.point.formula)}</p>
      </div>
    `;
    this.$reward.classList.add('show');
    this.$reward.querySelectorAll('.confetti').forEach((n) => n.remove());
    const colors = [tier.color, '#FFD98A', '#6BE7FF', '#FFFDF4'];
    for (let i = 0; i < 26; i += 1) {
      const bit = document.createElement('i');
      bit.className = 'confetti';
      bit.style.cssText = `--x:${Math.random() * 100}%;--r:${Math.random() * 360}deg;--d:${0.2 + Math.random() * 0.9}s;--c:${colors[i % colors.length]};--s:${4 + Math.random() * 6}px`;
      this.$reward.appendChild(bit);
    }
    // 数字滚动
    const counter = this.$reward.querySelector('[data-count]');
    const target = Number(counter?.dataset.count || 0);
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - start) / 900);
      if (counter) counter.textContent = String(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    this.$prev.disabled = true;
    this.$next.innerHTML = '下一关<span class="arrow">→</span>';
    this.$dots.querySelectorAll('i').forEach((d) => d.classList.add('done'));
    this.$track.style.width = '100%';
    this.$hint.disabled = true;
  }

  rewardAction(action) {
    if (action === 'close') {
      this.close();
      return;
    }
    if (action === 'replay') {
      this.open(this.point.id);
      return;
    }
    if (action === 'next') {
      const next = nextLessonPoint(this.point.id);
      if (next) {
        this.onStartPoint(next);
      } else {
        this.close();
      }
    }
  }
}

export function nextUnlearnedPoint(afterId) {
  const start = curriculumIndex(afterId);
  const ordered = [...CURRICULUM.slice(start + 1), ...CURRICULUM.slice(0, start + 1)];
  return ordered.find((p) => p.tier <= currentTierLevel() && !isLearned(p.id)) || ordered.find((p) => !isLearned(p.id)) || null;
}
