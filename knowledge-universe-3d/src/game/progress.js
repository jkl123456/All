/**
 * 学习进度：积分、星级、通关记录、挑战成绩。
 * 全部存在 localStorage，换一台设备就从零开始 —— 知识图谱不该需要账号。
 */
import { ALL_POINTS, POINT_BY_ID } from '../data/subjects.js';
import { TIERS, TIER_BY_LEVEL, lessonXp, tierFor } from '../data/tiers.js';
import { CURRICULUM } from '../data/lessons.js';

const KEY = 'zhiyu.progress.v2';

const blank = () => ({
  xp: 0,
  lessons: {},
  answers: {},
  challenge: { best: 0, plays: 0, bestCombo: 0, bestAccuracy: 0, lastAt: 0 },
  history: [],
  lastPointId: null,
  createdAt: Date.now(),
});

let state = blank();
const listeners = new Set();

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...blank(), ...parsed, lessons: parsed.lessons || {}, answers: parsed.answers || {} };
  } catch {
    return null;
  }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = safeParse(raw);
      if (parsed) state = parsed;
    }
  } catch {
    /* 隐私模式下 localStorage 不可用，降级为内存态 */
  }
  return state;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function lessonRecord(pointId) {
  return state.lessons[pointId] || null;
}

export function starsOf(pointId) {
  return state.lessons[pointId]?.stars || 0;
}

export function isLearned(pointId) {
  return Boolean(state.lessons[pointId]);
}

export function learnedPoints() {
  return ALL_POINTS.filter((p) => state.lessons[p.id]);
}

export function totalStars() {
  return Object.values(state.lessons).reduce((n, item) => n + (item.stars || 0), 0);
}

export function totalPossibleStars() {
  return ALL_POINTS.length * 3;
}

export function tierStats(level) {
  const points = ALL_POINTS.filter((p) => p.tier === level);
  const done = points.filter((p) => state.lessons[p.id]);
  const stars = done.reduce((n, p) => n + state.lessons[p.id].stars, 0);
  const tier = TIER_BY_LEVEL[level];
  return {
    tier,
    total: points.length,
    done: done.length,
    stars,
    maxStars: points.length * 3,
    // 段位只是难度标签与徽章，不再限制进入
    unlocked: true,
    complete: done.length === points.length,
  };
}

export function currentTierLevel() {
  const stars = totalStars();
  let level = 1;
  for (const tier of TIERS) if (stars >= tier.stars) level = tier.level;
  return level;
}

export function nextTier() {
  const level = currentTierLevel();
  return level < 8 ? TIER_BY_LEVEL[level + 1] : null;
}

export function starsToNextTier() {
  const next = nextTier();
  if (!next) return 0;
  return Math.max(0, next.stars - totalStars());
}

/** 下一关：按主线顺序，取第一个还没通关的 */
export function suggestNextPoint() {
  for (const point of CURRICULUM) {
    if (!state.lessons[point.id]) return point;
  }
  return CURRICULUM[0] || null;
}

/* -------------------------------- 结算入口 -------------------------------- */

export function completeLesson(point, { stars, correct, total, hintUsed }) {
  if (!point) return null;
  const prev = state.lessons[point.id];
  const clamped = Math.max(1, Math.min(3, stars));
  const gainedStars = Math.max(0, clamped - (prev?.stars || 0));
  const xp = Math.round(lessonXp(point.tier, clamped) * (hintUsed ? 0.8 : 1));
  const beforeTier = currentTierLevel();
  const beforeStars = totalStars();

  state.lessons[point.id] = {
    stars: Math.max(clamped, prev?.stars || 0),
    best: Math.max(clamped, prev?.best || 0),
    plays: (prev?.plays || 0) + 1,
    correct,
    total,
    at: Date.now(),
  };
  state.xp += xp;
  state.lastPointId = point.id;
  state.history.unshift({ type: 'lesson', id: point.id, xp, stars: clamped, at: Date.now() });
  state.history = state.history.slice(0, 40);
  const answerRec = state.answers[point.id] || { correct: 0, total: 0 };
  state.answers[point.id] = { correct: answerRec.correct + correct, total: answerRec.total + total };

  persist();

  const afterTier = currentTierLevel();
  return {
    xp,
    stars: clamped,
    gainedStars,
    firstClear: !prev,
    starGain: totalStars() - beforeStars,
    tierUp: afterTier > beforeTier ? tierFor(afterTier) : null,
    totalXp: state.xp,
  };
}

export function addXp(amount, meta = {}) {
  state.xp += Math.max(0, Math.round(amount));
  state.history.unshift({ type: 'xp', xp: Math.round(amount), ...meta, at: Date.now() });
  state.history = state.history.slice(0, 40);
  persist();
}

export function recordChallenge(result) {
  const { score, combo, correct, total } = result;
  const accuracy = total ? correct / total : 0;
  state.challenge.plays += 1;
  state.challenge.best = Math.max(state.challenge.best, score);
  state.challenge.bestCombo = Math.max(state.challenge.bestCombo, combo);
  state.challenge.bestAccuracy = Math.max(state.challenge.bestAccuracy, accuracy);
  state.challenge.lastAt = Date.now();
  state.xp += Math.max(0, Math.round(score / 6));
  persist();
  return state.challenge;
}

export function resetProgress() {
  state = blank();
  persist();
}

export function knownQuestionPoints() {
  const learned = learnedPoints();
  return learned.length ? learned : ALL_POINTS.filter((p) => p.tier === 1);
}

export function summary() {
  const learned = learnedPoints();
  return {
    xp: state.xp,
    stars: totalStars(),
    maxStars: totalPossibleStars(),
    learned: learned.length,
    total: ALL_POINTS.length,
    tier: currentTierLevel(),
    challenge: state.challenge,
    accuracy: (() => {
      const vals = Object.values(state.answers);
      const c = vals.reduce((n, v) => n + v.correct, 0);
      const t = vals.reduce((n, v) => n + v.total, 0);
      return t ? c / t : 0;
    })(),
  };
}

export function pointTitle(id) {
  return POINT_BY_ID[id]?.title || id;
}
