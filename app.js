/* GDScript Tutor — loads outline.json, hash routing, bootcamp progress, service worker. */

const OUTLINE_URL = "lessons/outline.json";
const BEST_SCORE_KEY_PREFIX = "gdscript-tutor:best-score:lesson-";
const PROGRESS_KEY = "gdscript-tutor:progress";
const PASS_SCORE = 3;
const PERFECT_SCORE = 4;
const QUIZ_QUESTION_COUNT = 4;
const XP_PER_CORRECT = 25;
const XP_PERFECT_BONUS = 50;
const XP_MISSION = 150;
const XP_PER_DRILL = 10;
const DRILLS_PER_LESSON = 5;
const QUIZ_MODULE_COUNT = 5;
const TOTAL_MODULE_COUNT = 7;
const TOTAL_DRILL_COUNT = QUIZ_MODULE_COUNT * DRILLS_PER_LESSON;
const MAX_XP =
  QUIZ_MODULE_COUNT * (QUIZ_QUESTION_COUNT * XP_PER_CORRECT + XP_PERFECT_BONUS) +
  TOTAL_DRILL_COUNT * XP_PER_DRILL +
  2 * XP_MISSION;
const REVIEW_DECK_SIZE = 5;
const REVIEW_MISS_LIMIT = 2;
const LEITNER_INTERVALS_MS = [
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
];
const LEITNER_MAX_BOX = 4;

const RANKS = [
  { id: "recruit", name: "Recruit", shortName: "Recruit", xp: 0, icon: "🕯️" },
  { id: "private", name: "Private", shortName: "Private", xp: 150, icon: "🔦" },
  { id: "corporal", name: "Corporal", shortName: "Corporal", xp: 300, icon: "📻" },
  { id: "sergeant", name: "Sergeant", shortName: "Sergeant", xp: 450, icon: "🎖️" },
  { id: "lieutenant", name: "Lieutenant", shortName: "Lieutenant", xp: 600, icon: "📡" },
  { id: "captain", name: "Captain", shortName: "Captain", xp: 750, icon: "🛡️" },
  { id: "operative", name: "Operative", shortName: "Operative", xp: 900, icon: "👁️" },
  { id: "cable", name: "Cable-Level Operative", shortName: "Cable", xp: 1300, icon: "💀" },
];

const ACHIEVEMENTS = [
  {
    id: "first-blood",
    name: "First Blood",
    icon: "🩸",
    description: "Finish any quiz.",
  },
  {
    id: "flawless",
    name: "Flawless",
    icon: "💎",
    description: "Score 4 out of 4 on a quiz.",
  },
  {
    id: "fresh-battery",
    name: "Fresh Battery",
    icon: "🔋",
    description: "Pass Lesson 1 (score at least 3 out of 4).",
  },
  {
    id: "survivor",
    name: "Survivor",
    icon: "🫀",
    description: "Pass lessons 1 through 5.",
  },
  {
    id: "comeback",
    name: "Comeback",
    icon: "↩️",
    description: "Improve a failed quiz to a passing score.",
  },
  {
    id: "night-owl",
    name: "Night Owl",
    icon: "🦉",
    description: "Complete a quiz between 12 a.m. and 5 a.m. local time.",
  },
  {
    id: "lights-out",
    name: "Lights Out",
    icon: "💡",
    description: "Score a perfect 4 out of 4 on every quiz.",
  },
  {
    id: "signal-received",
    name: "Signal Received",
    icon: "📶",
    description: "Mark the Signals mission complete.",
  },
  {
    id: "completionist",
    name: "Completionist",
    icon: "🏆",
    description: "Pass all seven modules.",
  },
  {
    id: "keyboard-warrior",
    name: "Keyboard Warrior",
    icon: "⌨️",
    description: "Complete every typing drill in a lesson.",
  },
  {
    id: "on-a-roll",
    name: "On a Roll",
    icon: "🔥",
    description: "Keep a 3-day streak.",
  },
  {
    id: "seven-nights",
    name: "Seven Nights",
    icon: "🌙",
    description: "Keep a 7-day streak.",
  },
];

const navList = document.getElementById("lesson-list");
const nav = document.getElementById("site-nav");
const navToggle = document.getElementById("nav-toggle");
const navBackdrop = document.getElementById("nav-backdrop");
const main = document.getElementById("main");
const rankChip = document.getElementById("rank-chip");
const streakChip = document.getElementById("streak-chip");
const toastRegion = document.getElementById("toast-region");
const resetDialog = document.getElementById("reset-dialog");

let outline = null;
let progressCache = null;
let reviewSession = null;
const quizCache = new Map();
const drillCache = new Map();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

function emptyStreak() {
  return { current: 0, best: 0, lastActiveDate: null };
}

function emptyProgress() {
  return {
    version: 2,
    bestScores: {},
    missions: {},
    everFailed: {},
    achievements: {},
    drillsCompleted: {},
    review: {},
    streak: emptyStreak(),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.max(0, Math.min(QUIZ_QUESTION_COUNT, Math.round(number)));
}

function sanitizeStreak(raw) {
  const streak = emptyStreak();
  if (!isPlainObject(raw)) {
    return streak;
  }
  const current = Number(raw.current);
  const best = Number(raw.best);
  if (Number.isFinite(current) && current >= 0) {
    streak.current = Math.round(current);
  }
  if (Number.isFinite(best) && best >= 0) {
    streak.best = Math.round(best);
  }
  if (typeof raw.lastActiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastActiveDate)) {
    streak.lastActiveDate = raw.lastActiveDate;
  }
  if (streak.best < streak.current) {
    streak.best = streak.current;
  }
  return streak;
}

function sanitizeReview(raw) {
  const review = {};
  if (!isPlainObject(raw)) {
    return review;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!isPlainObject(value)) {
      continue;
    }
    const type = value.type === "drill" ? "drill" : value.type === "quiz" ? "quiz" : null;
    const lessonId = Number(value.lessonId);
    if (!type || !Number.isFinite(lessonId)) {
      continue;
    }
    const box = Math.max(1, Math.min(LEITNER_MAX_BOX, Math.round(Number(value.box) || 1)));
    const due = Number(value.due);
    const item = {
      id: String(value.id || key),
      type,
      lessonId,
      box,
      due: Number.isFinite(due) ? due : Date.now(),
    };
    if (type === "quiz") {
      const questionId = Number(value.questionId);
      if (!Number.isFinite(questionId)) {
        continue;
      }
      item.questionId = questionId;
    } else {
      const drillId = Number(value.drillId);
      if (!Number.isFinite(drillId)) {
        continue;
      }
      item.drillId = drillId;
    }
    review[item.id] = item;
  }
  return review;
}

function sanitizeProgress(raw) {
  const progress = emptyProgress();
  if (!isPlainObject(raw)) {
    return progress;
  }
  if (isPlainObject(raw.bestScores)) {
    for (const [key, value] of Object.entries(raw.bestScores)) {
      const score = clampScore(value);
      if (score !== null) {
        progress.bestScores[String(key)] = score;
      }
    }
  }
  if (isPlainObject(raw.missions)) {
    for (const [key, value] of Object.entries(raw.missions)) {
      if (value) {
        progress.missions[String(key)] = true;
      }
    }
  }
  if (isPlainObject(raw.everFailed)) {
    for (const [key, value] of Object.entries(raw.everFailed)) {
      if (value) {
        progress.everFailed[String(key)] = true;
      }
    }
  }
  if (isPlainObject(raw.achievements)) {
    for (const [key, value] of Object.entries(raw.achievements)) {
      if (typeof value === "string" && value.trim()) {
        progress.achievements[String(key)] = value;
      }
    }
  }
  if (isPlainObject(raw.drillsCompleted)) {
    for (const [key, value] of Object.entries(raw.drillsCompleted)) {
      if (value) {
        progress.drillsCompleted[String(key)] =
          typeof value === "string" && value.trim() ? value : new Date().toISOString();
      }
    }
  }
  progress.review = sanitizeReview(raw.review);
  progress.streak = sanitizeStreak(raw.streak);
  return progress;
}

function migrateLegacyScores(progress) {
  let changed = false;
  try {
    for (let lessonId = 1; lessonId <= QUIZ_MODULE_COUNT; lessonId += 1) {
      const raw = localStorage.getItem(`${BEST_SCORE_KEY_PREFIX}${lessonId}`);
      if (raw === null) {
        continue;
      }
      const score = clampScore(raw);
      if (score === null) {
        continue;
      }
      const key = String(lessonId);
      const current = progress.bestScores[key];
      if (current === undefined || score > current) {
        progress.bestScores[key] = score;
        changed = true;
      }
    }
  } catch (error) {
    console.warn("Could not migrate saved quiz scores:", error);
  }
  return changed;
}

function writeLegacyBestScore(lessonId, score) {
  try {
    localStorage.setItem(`${BEST_SCORE_KEY_PREFIX}${lessonId}`, String(score));
  } catch (error) {
    console.warn("Could not save quiz score:", error);
  }
}

function persistProgress(progress) {
  progress.version = 2;
  progressCache = progress;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    for (const [key, score] of Object.entries(progress.bestScores)) {
      writeLegacyBestScore(key, score);
    }
  } catch (error) {
    console.warn("Could not save bootcamp progress:", error);
  }
}

function loadProgress() {
  if (progressCache) {
    return progressCache;
  }
  let progress = emptyProgress();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      progress = sanitizeProgress(JSON.parse(raw));
    }
  } catch (error) {
    console.warn("Could not read bootcamp progress:", error);
    progress = emptyProgress();
  }
  const migrated = migrateLegacyScores(progress);
  const unlocked = evaluateAchievements(progress, { silent: true });
  if (migrated || unlocked.length) {
    persistProgress(progress);
  } else {
    progressCache = progress;
  }
  return progress;
}

function xpForScore(score) {
  const value = Number(score) || 0;
  if (value <= 0) {
    return 0;
  }
  return value * XP_PER_CORRECT + (value >= PERFECT_SCORE ? XP_PERFECT_BONUS : 0);
}

function getBestScore(lessonId, progress = loadProgress()) {
  const value = progress.bestScores[String(lessonId)];
  return value === undefined ? null : value;
}

function isMissionModule(moduleOrId) {
  const id = typeof moduleOrId === "object" ? moduleOrId.id : moduleOrId;
  return Number(id) >= 6;
}

function isLessonPassed(lessonId, progress = loadProgress()) {
  const id = Number(lessonId);
  if (isMissionModule(id)) {
    return Boolean(progress.missions[String(id)]);
  }
  const best = getBestScore(id, progress);
  return best !== null && best >= PASS_SCORE;
}

function isLessonUnlocked(lessonId, progress = loadProgress()) {
  const id = Number(lessonId);
  if (id <= 1) {
    return true;
  }
  if (id >= 6) {
    return isLessonPassed(5, progress);
  }
  return isLessonPassed(id - 1, progress);
}

function unlockRequirement(lessonId) {
  const id = Number(lessonId);
  if (id >= 6) {
    return 5;
  }
  return id - 1;
}

function passedLessonCount(progress = loadProgress()) {
  let count = 0;
  for (let id = 1; id <= TOTAL_MODULE_COUNT; id += 1) {
    if (isLessonPassed(id, progress)) {
      count += 1;
    }
  }
  return count;
}

function getDrillXp(progress = loadProgress()) {
  return Object.keys(progress.drillsCompleted || {}).length * XP_PER_DRILL;
}

function getTotalXp(progress = loadProgress()) {
  let xp = 0;
  for (let id = 1; id <= QUIZ_MODULE_COUNT; id += 1) {
    xp += xpForScore(getBestScore(id, progress) || 0);
  }
  xp += getDrillXp(progress);
  if (progress.missions["6"]) {
    xp += XP_MISSION;
  }
  if (progress.missions["7"]) {
    xp += XP_MISSION;
  }
  return xp;
}

function getRankInfo(xp) {
  let current = RANKS[0];
  let next = RANKS[1] || null;
  for (let index = 0; index < RANKS.length; index += 1) {
    if (xp >= RANKS[index].xp) {
      current = RANKS[index];
      next = RANKS[index + 1] || null;
    }
  }
  return { current, next, xp };
}

function isNightOwlHour(date) {
  const hour = date.getHours();
  return hour >= 0 && hour < 5;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function shiftLocalDateString(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return localDateString(copy);
}

function getDisplayStreak(progress = loadProgress(), now = new Date()) {
  const last = progress.streak && progress.streak.lastActiveDate;
  const current = (progress.streak && progress.streak.current) || 0;
  const today = localDateString(now);
  const yesterday = shiftLocalDateString(now, -1);
  if (last === today || last === yesterday) {
    return current;
  }
  return 0;
}

function recordActivity(progress, now = new Date()) {
  if (!progress.streak) {
    progress.streak = emptyStreak();
  }
  const today = localDateString(now);
  const last = progress.streak.lastActiveDate;
  if (last === today) {
    return false;
  }
  if (last === shiftLocalDateString(now, -1)) {
    progress.streak.current += 1;
  } else {
    progress.streak.current = 1;
  }
  progress.streak.lastActiveDate = today;
  if (progress.streak.current > (progress.streak.best || 0)) {
    progress.streak.best = progress.streak.current;
  }
  return true;
}

function reviewItemId(type, lessonId, itemId) {
  return `${type}:${lessonId}:${itemId}`;
}

function enqueueReviewItem(progress, partial, now = Date.now()) {
  if (!progress.review) {
    progress.review = {};
  }
  const id = partial.id || reviewItemId(partial.type, partial.lessonId, partial.questionId || partial.drillId);
  const existing = progress.review[id];
  if (existing) {
    existing.box = 1;
    existing.due = now;
    return existing;
  }
  const item = {
    id,
    type: partial.type,
    lessonId: Number(partial.lessonId),
    box: 1,
    due: now,
  };
  if (item.type === "quiz") {
    item.questionId = Number(partial.questionId);
  } else {
    item.drillId = Number(partial.drillId);
  }
  progress.review[id] = item;
  return item;
}

function graduateReviewItem(progress, id) {
  if (progress.review && progress.review[id]) {
    delete progress.review[id];
  }
}

function applyReviewResult(progress, item, isCorrect, now = Date.now()) {
  if (!item || !item.id) {
    return;
  }
  if (!isCorrect) {
    enqueueReviewItem(progress, item, now + LEITNER_INTERVALS_MS[0]);
    return;
  }
  const existing = progress.review && progress.review[item.id];
  if (!existing) {
    return;
  }
  const nextBox = (existing.box || 1) + 1;
  if (nextBox > LEITNER_MAX_BOX) {
    graduateReviewItem(progress, item.id);
    return;
  }
  existing.box = nextBox;
  existing.due = now + LEITNER_INTERVALS_MS[nextBox - 1];
}

function getDueReviewItems(progress = loadProgress(), now = Date.now()) {
  return Object.values(progress.review || {})
    .filter((item) => Number(item.due) <= now)
    .sort((a, b) => Number(a.due) - Number(b.due) || String(a.id).localeCompare(String(b.id)));
}

function lessonDrillsComplete(lessonId, progress = loadProgress()) {
  const completed = progress.drillsCompleted || {};
  for (let drillId = 1; drillId <= DRILLS_PER_LESSON; drillId += 1) {
    if (!completed[`${lessonId}:${drillId}`]) {
      return false;
    }
  }
  return true;
}

function evaluateAchievements(progress, context = {}) {
  const unlocked = [];
  const stamp = context.now ? context.now.toISOString() : new Date().toISOString();

  function award(id) {
    if (progress.achievements[id]) {
      return;
    }
    progress.achievements[id] = stamp;
    unlocked.push(id);
  }

  const finishedQuiz = Boolean(context.quizFinished);
  const score = context.score;
  const lessonId = context.lessonId;

  if (finishedQuiz || Object.keys(progress.bestScores).length > 0) {
    award("first-blood");
  }

  const anyPerfect = Object.values(progress.bestScores).some((value) => value >= PERFECT_SCORE);
  if (anyPerfect || (finishedQuiz && score >= PERFECT_SCORE)) {
    award("flawless");
  }

  if (isLessonPassed(1, progress)) {
    award("fresh-battery");
  }

  const quizzesPassed = [1, 2, 3, 4, 5].every((id) => isLessonPassed(id, progress));
  if (quizzesPassed) {
    award("survivor");
  }

  const allPerfect = [1, 2, 3, 4, 5].every((id) => (getBestScore(id, progress) || 0) >= PERFECT_SCORE);
  if (allPerfect) {
    award("lights-out");
  }

  if (progress.missions["6"]) {
    award("signal-received");
  }

  if (passedLessonCount(progress) >= TOTAL_MODULE_COUNT) {
    award("completionist");
  }

  if (
    finishedQuiz &&
    lessonId &&
    progress.everFailed[String(lessonId)] &&
    score >= PASS_SCORE &&
    !context.previouslyPassed
  ) {
    award("comeback");
  }

  if (finishedQuiz && context.now && isNightOwlHour(context.now)) {
    award("night-owl");
  }

  for (let id = 1; id <= QUIZ_MODULE_COUNT; id += 1) {
    if (lessonDrillsComplete(id, progress)) {
      award("keyboard-warrior");
      break;
    }
  }

  const bestStreak = (progress.streak && progress.streak.best) || 0;
  if (bestStreak >= 3) {
    award("on-a-roll");
  }
  if (bestStreak >= 7) {
    award("seven-nights");
  }

  return unlocked;
}

function showToast({ title, body, icon, type = "achievement" }) {
  if (!toastRegion) {
    return;
  }
  toastRegion.querySelectorAll(".toast").forEach((el) => el.remove());
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.dataset.toast = "combined";
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icon || "★"}</span>
    <span class="toast-copy">
      <strong class="toast-title">${escapeHtml(title)}</strong>
      ${body ? `<span class="toast-body">${escapeHtml(body)}</span>` : ""}
    </span>
  `;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 280);
  }, 5200);
}

function announceUnlocks(unlockedIds, oldRank, newRank, extra = "") {
  const promoted = Boolean(newRank && oldRank && newRank.id !== oldRank.id);
  const achievements = (unlockedIds || [])
    .map((id) => ACHIEVEMENTS.find((item) => item.id === id))
    .filter(Boolean);
  if (!promoted && !achievements.length && !extra) {
    return;
  }

  const parts = [];
  if (extra) {
    parts.push(extra);
  }
  if (achievements.length === 1) {
    parts.push(`${achievements[0].name} unlocked`);
  } else if (achievements.length > 1) {
    parts.push(`${achievements.length} badges unlocked`);
  }
  if (promoted) {
    parts.push(`promoted to ${newRank.name}`);
  }

  let icon = "★";
  let type = "achievement";
  if (promoted) {
    icon = newRank.icon;
    type = "rank";
  } else if (achievements[0]) {
    icon = achievements[0].icon;
  }

  const bodyParts = [];
  if (achievements.length > 1) {
    bodyParts.push(achievements.map((item) => item.name).join(", "));
  } else if (achievements.length === 1) {
    bodyParts.push(achievements[0].description);
  }
  if (promoted && !achievements.length) {
    bodyParts.push("New rank unlocked.");
  }

  showToast({
    type,
    icon,
    title: parts.join(" + "),
    body: bodyParts.join(" · "),
  });
}

function updateRankChip(progress = loadProgress()) {
  if (!rankChip) {
    return;
  }
  const { current, xp } = getRankInfo(getTotalXp(progress));
  rankChip.hidden = false;
  rankChip.innerHTML = `
    <span class="rank-chip-icon" aria-hidden="true">${current.icon}</span>
    <span class="rank-chip-text">
      <span class="rank-chip-name">${escapeHtml(current.shortName)}</span>
      <span class="rank-chip-xp">${xp} XP</span>
    </span>
  `;
  rankChip.setAttribute("aria-label", `${current.name}, ${xp} XP. Back to dashboard.`);
}

function updateStreakChip(progress = loadProgress()) {
  if (!streakChip) {
    return;
  }
  const streak = getDisplayStreak(progress);
  streakChip.hidden = false;
  const label = streak === 1 ? "1 day streak" : `${streak} day streak`;
  streakChip.innerHTML = `
    <span class="streak-chip-icon" aria-hidden="true">🔥</span>
    <span class="streak-chip-text">${streak}</span>
  `;
  streakChip.setAttribute("aria-label", `${label}. Open Daily Review.`);
}

function updateUtilityNav(route) {
  const view = route && route.view;
  const home = document.getElementById("nav-home");
  const review = document.getElementById("nav-review");
  const cheatsheet = document.getElementById("nav-cheatsheet");
  const dueEl = document.getElementById("nav-review-count");
  if (home) {
    if (view === "home") {
      home.setAttribute("aria-current", "page");
    } else {
      home.removeAttribute("aria-current");
    }
  }
  if (review) {
    if (view === "review") {
      review.setAttribute("aria-current", "page");
    } else {
      review.removeAttribute("aria-current");
    }
  }
  if (cheatsheet) {
    if (view === "cheatsheet") {
      cheatsheet.setAttribute("aria-current", "page");
    } else {
      cheatsheet.removeAttribute("aria-current");
    }
  }
  if (dueEl) {
    const due = getDueReviewItems().length;
    if (due > 0) {
      dueEl.hidden = false;
      dueEl.textContent = String(due);
    } else {
      dueEl.hidden = true;
      dueEl.textContent = "";
    }
  }
}

function refreshChrome(route) {
  const current = route || parseHash();
  renderNav(current);
  updateUtilityNav(current);
  updateRankChip();
  updateStreakChip();
}

function getContinueModule(progress = loadProgress()) {
  if (!outline) {
    return null;
  }
  return outline.modules.find((module) => isLessonUnlocked(module.id, progress) && !isLessonPassed(module.id, progress)) || null;
}

function recordQuizResult(lessonId, score, extras = {}) {
  const progress = loadProgress();
  const key = String(lessonId);
  const previousBest = getBestScore(lessonId, progress);
  const previouslyPassed = previousBest !== null && previousBest >= PASS_SCORE;
  const oldXp = getTotalXp(progress);
  const oldRank = getRankInfo(oldXp).current;

  if (score < PASS_SCORE) {
    progress.everFailed[key] = true;
  }
  if (previousBest === null || score > previousBest) {
    progress.bestScores[key] = score;
  }

  (extras.missed || []).forEach((item) => {
    enqueueReviewItem(progress, item);
  });

  recordActivity(progress, extras.now || new Date());

  const unlocked = evaluateAchievements(progress, {
    quizFinished: true,
    lessonId,
    score,
    previousBest,
    previouslyPassed,
    now: extras.now || new Date(),
  });
  persistProgress(progress);

  const newXp = getTotalXp(progress);
  const newRank = getRankInfo(newXp).current;
  announceUnlocks(unlocked, oldRank, newRank);
  refreshChrome();

  return {
    previousBest,
    best: getBestScore(lessonId, progress),
    xpGained: newXp - oldXp,
    totalXp: newXp,
    passed: score >= PASS_SCORE,
    unlocked,
    newRank,
  };
}

function recordDrillResult(lessonId, drill, isCorrect) {
  const progress = loadProgress();
  const oldXp = getTotalXp(progress);
  const oldRank = getRankInfo(oldXp).current;
  const key = `${lessonId}:${drill.id}`;
  const already = Boolean(progress.drillsCompleted[key]);
  let xpGained = 0;

  if (isCorrect) {
    if (!already) {
      progress.drillsCompleted[key] = new Date().toISOString();
    }
    recordActivity(progress);
    const existing = progress.review && progress.review[reviewItemId("drill", lessonId, drill.id)];
    if (existing) {
      applyReviewResult(progress, existing, true);
    }
  } else {
    enqueueReviewItem(progress, { type: "drill", lessonId, drillId: drill.id });
  }

  const unlocked = evaluateAchievements(progress, { now: new Date() });
  persistProgress(progress);
  const newXp = getTotalXp(progress);
  const newRank = getRankInfo(newXp).current;
  xpGained = newXp - oldXp;
  announceUnlocks(unlocked, oldRank, newRank, xpGained > 0 ? `+${xpGained} XP` : "");
  refreshChrome();

  return {
    already,
    firstCompletion: isCorrect && !already,
    xpGained,
    totalXp: newXp,
    unlocked,
  };
}

function markMissionComplete(lessonId) {
  const progress = loadProgress();
  const key = String(lessonId);
  if (progress.missions[key]) {
    return null;
  }
  const oldXp = getTotalXp(progress);
  const oldRank = getRankInfo(oldXp).current;
  progress.missions[key] = true;
  recordActivity(progress);
  const unlocked = evaluateAchievements(progress, { now: new Date() });
  persistProgress(progress);
  const newXp = getTotalXp(progress);
  const newRank = getRankInfo(newXp).current;
  announceUnlocks(unlocked, oldRank, newRank, `Mission complete · +${newXp - oldXp} XP`);
  return { xpGained: newXp - oldXp, totalXp: newXp };
}

function clearAllProgress() {
  progressCache = emptyProgress();
  reviewSession = null;
  try {
    localStorage.removeItem(PROGRESS_KEY);
    for (let id = 1; id <= QUIZ_MODULE_COUNT; id += 1) {
      localStorage.removeItem(`${BEST_SCORE_KEY_PREFIX}${id}`);
    }
  } catch (error) {
    console.warn("Could not clear bootcamp progress:", error);
  }
}

function exportProgress() {
  const payload = {
    app: "gdscript-tutor",
    version: 2,
    exportedAt: new Date().toISOString(),
    progress: loadProgress(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gdscript-tutor-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importProgressFile(file) {
  return file.text().then((text) => {
    const parsed = JSON.parse(text);
    const raw = isPlainObject(parsed) && isPlainObject(parsed.progress) ? parsed.progress : parsed;
    const progress = sanitizeProgress(raw);
    evaluateAchievements(progress, { silent: true });
    persistProgress(progress);
    reviewSession = null;
    return progress;
  });
}

function bestScoreKey(lessonId) {
  return `${BEST_SCORE_KEY_PREFIX}${lessonId}`;
}

function readBestScore(lessonId) {
  return getBestScore(lessonId);
}

function setNavOpen(isOpen) {
  nav.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close lesson menu" : "Open lesson menu");
  if (navBackdrop) {
    navBackdrop.hidden = !isOpen;
  }
}

function closeNav() {
  setNavOpen(false);
}

function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "lesson" && parts[1]) {
    const moduleId = Number(parts[1]);
    const subtopicId = parts[2] ? Number(parts[2]) : null;
    return { view: "lesson", moduleId, subtopicId };
  }
  if (parts[0] === "review") {
    return { view: "review" };
  }
  if (parts[0] === "cheatsheet" || parts[0] === "cheat-sheet") {
    return { view: "cheatsheet" };
  }
  return { view: "home" };
}

function getModule(id) {
  return outline.modules.find((module) => module.id === id);
}

function getSubtopic(module, id) {
  return module.subtopics.find((item) => item.id === id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeUrl(href) {
  const trimmed = String(href).trim();
  if (/^(https?:|mailto:|#|\/|\.\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return "#";
  }
  return trimmed;
}

function formatInlineCode(text) {
  return renderInline(text);
}

function renderInline(text) {
  const parts = [];
  const stash = (html) => {
    const token = `%%I${parts.length}%%`;
    parts.push(html);
    return token;
  };

  let output = String(text);
  output = output.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = sanitizeUrl(href);
    return stash(`<a href="${escapeHtml(safeHref)}">${renderInline(label)}</a>`);
  });
  output = escapeHtml(output);
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/%%I(\d+)%%/g, (_, index) => parts[Number(index)]);
  return output;
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
}

function stripHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

function stripQuizSection(markdown) {
  return markdown.replace(/^##[ \t]+Quiz[ \t]*\r?\n[\s\S]*?(?=^##[ \t]+)/m, "");
}

function isHeadingLine(line) {
  return /^#{1,6}\s+\S/.test(line);
}

function isListLine(line) {
  return /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines) {
  const headers = splitTableRow(lines[0]);
  const bodyRows = lines.slice(2).map(splitTableRow);
  const thead = `<thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
}

function renderList(lines) {
  const ordered = /^\d+\.\s+/.test(lines[0]);
  const tag = ordered ? "ol" : "ul";
  const items = lines
    .map((line) => {
      const text = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
      return `<li>${renderInline(text)}</li>`;
    })
    .join("");
  return `<${tag}>${items}</${tag}>`;
}

function renderCodeLines(code) {
  const normalized = String(code).replace(/\t/g, "    ").replace(/\n$/, "");
  return normalized
    .split("\n")
    .map((line) => `<span class="code-line">${line === "" ? "&nbsp;" : escapeHtml(line)}</span>`)
    .join("");
}

function renderCodeBlock(code, language = "gdscript") {
  if (!code && code !== "") {
    return "";
  }
  const raw = String(code).replace(/\t/g, "    ").replace(/\n$/, "");
  const label = language
    ? `<figcaption class="code-label">${escapeHtml(language)}</figcaption>`
    : `<span class="code-label-spacer"></span>`;
  const classAttr = language ? ` class="language-${escapeHtml(language)}"` : "";
  return `<figure class="code-block">
    <div class="code-toolbar">
      ${label}
      <button type="button" class="copy-btn" data-code="${escapeHtml(raw)}">Copy</button>
    </div>
    <pre><code${classAttr}>${renderCodeLines(raw)}</code></pre>
  </figure>`;
}

function renderMarkdown(markdown) {
  let source = markdown.replace(/\r\n/g, "\n");
  source = stripFrontMatter(source);
  source = stripHtmlComments(source);
  source = stripQuizSection(source);
  source = source.trim();

  const codeBlocks = [];
  source = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang.trim();
    const html = renderCodeBlock(code, language);
    const token = `%%BLOCK${codeBlocks.length}%%`;
    codeBlocks.push(html);
    return `\n${token}\n`;
  });

  const lines = source.split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const blockMatch = line.trim().match(/^%%BLOCK(\d+)%%$/);
    if (blockMatch) {
      html.push(codeBlocks[Number(blockMatch[1])]);
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.trim().startsWith("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }

    if (isListLine(line)) {
      const listLines = [];
      while (index < lines.length && isListLine(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }
      html.push(renderList(listLines));
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !isHeadingLine(lines[index]) &&
      !isListLine(lines[index]) &&
      !lines[index].trim().match(/^%%BLOCK\d+%%$/) &&
      !(lines[index].trim().startsWith("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }
  }

  return html.join("\n");
}

function extractMarkdownTitle(markdown) {
  const withoutFrontMatter = stripFrontMatter(markdown.replace(/\r\n/g, "\n"));
  const match = withoutFrontMatter.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function renderCode(example) {
  if (!example) {
    return "";
  }
  return renderCodeBlock(example, "gdscript");
}

function isStarter(item) {
  return item && item.delivery === "starter-project";
}

function starterBadge(item) {
  return isStarter(item) ? '<span class="nav-badge">Godot project</span>' : "";
}

function moduleTitle(id) {
  const module = outline ? getModule(id) : null;
  return module ? module.title : `Lesson ${id}`;
}

function navLockBadge(moduleId, progress) {
  if (!isLessonUnlocked(moduleId, progress)) {
    return '<span class="nav-lock" title="Locked" aria-hidden="true">🔒</span>';
  }
  if (isLessonPassed(moduleId, progress)) {
    return '<span class="nav-check" title="Passed" aria-hidden="true">✓</span>';
  }
  return "";
}

function renderNav(route) {
  const progress = loadProgress();
  const items = outline.modules.map((module) => {
    const unlocked = isLessonUnlocked(module.id, progress);
    const moduleCurrent =
      route.view === "lesson" && route.moduleId === module.id && !route.subtopicId
        ? ' aria-current="page"'
        : "";
    const lockedClass = unlocked ? "" : " is-locked";
    const lockedAttr = unlocked ? "" : ' aria-disabled="true"';
    const subs = module.subtopics
      .map((sub) => {
        const current =
          route.view === "lesson" &&
          route.moduleId === module.id &&
          route.subtopicId === sub.id
            ? ' aria-current="page"'
            : "";
        return `<li>
          <a href="#/lesson/${module.id}/${sub.id}" class="${unlocked ? "" : "is-locked"}"${current}${lockedAttr}>${escapeHtml(sub.title)}${starterBadge(sub)}</a>
        </li>`;
      })
      .join("");
    return `<li class="nav-module${lockedClass}">
      <a href="#/lesson/${module.id}"${moduleCurrent}${lockedAttr}>${module.id}. ${escapeHtml(module.title)}${starterBadge(module)}${navLockBadge(module.id, progress)}</a>
      <ul class="subtopic-list">${subs}</ul>
    </li>`;
  }).join("");
  navList.innerHTML = items;
}

function renderBadgeGrid(progress) {
  const items = ACHIEVEMENTS.map((achievement) => {
    const unlockedAt = progress.achievements[achievement.id];
    const unlocked = Boolean(unlockedAt);
    let dateLabel = "";
    if (unlockedAt) {
      const date = new Date(unlockedAt);
      if (!Number.isNaN(date.getTime())) {
        dateLabel = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      }
    }
    return `<li class="achievement-card ${unlocked ? "is-unlocked" : "is-locked"}">
      <span class="achievement-icon" aria-hidden="true">${achievement.icon}</span>
      <span class="achievement-name">${escapeHtml(achievement.name)}</span>
      <span class="achievement-desc">${escapeHtml(achievement.description)}</span>
      <span class="achievement-date">${unlocked ? escapeHtml(dateLabel) : "Locked"}</span>
    </li>`;
  }).join("");
  return `<ul class="badge-grid">${items}</ul>`;
}

function renderDashboard(progress) {
  const xp = getTotalXp(progress);
  const { current, next } = getRankInfo(xp);
  const passed = passedLessonCount(progress);
  const streak = getDisplayStreak(progress);
  const bestStreak = (progress.streak && progress.streak.best) || 0;
  const dueCount = getDueReviewItems(progress).length;
  const drillCount = Object.keys(progress.drillsCompleted || {}).length;
  let barPercent = 100;
  let barLabel = "Max rank reached";
  let nextText = "You are at the top of the roster.";
  if (next) {
    const span = next.xp - current.xp;
    const into = xp - current.xp;
    barPercent = span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((into / span) * 100)));
    barLabel = `${into} / ${span} XP`;
    nextText = `${next.xp - xp} XP to ${next.name}`;
  }
  const continueModule = getContinueModule(progress);
  const continueHtml = continueModule
    ? `<a class="btn btn-primary" id="continue-lesson" href="#/lesson/${continueModule.id}">Continue: ${continueModule.id}. ${escapeHtml(continueModule.title)}</a>`
    : `<p class="continue-done" id="continue-lesson">All missions complete.</p>`;
  const streakLabel = streak === 1 ? "1 day" : `${streak} days`;
  const dueLabel = dueCount === 1 ? "1 item due" : `${dueCount} items due`;

  return `
    <section class="dashboard" aria-label="Bootcamp progress">
      <div class="dashboard-rank">
        <span class="dashboard-rank-icon" aria-hidden="true">${current.icon}</span>
        <div>
          <p class="kicker">Current rank</p>
          <h2 class="dashboard-rank-name">${escapeHtml(current.name)}</h2>
          <p class="dashboard-xp-total">${xp} XP</p>
        </div>
      </div>
      <div class="xp-bar-block">
        <div class="xp-bar-meta">
          <span>${escapeHtml(next ? nextText : barLabel)}</span>
          <span>${escapeHtml(barLabel)}</span>
        </div>
        <div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${next ? next.xp : current.xp}" aria-valuenow="${xp}" aria-label="XP progress to next rank">
          <div class="xp-bar-fill" style="width: ${barPercent}%"></div>
        </div>
      </div>
      <div class="dashboard-stats">
        <p class="lessons-passed">Lessons passed <strong>${passed} / ${TOTAL_MODULE_COUNT}</strong></p>
        <p class="dashboard-streak" data-streak="${streak}">Streak <strong>🔥 ${escapeHtml(streakLabel)}</strong>${bestStreak ? ` · best ${bestStreak}` : ""}</p>
        <p class="dashboard-drills">Drills <strong>${drillCount} / ${TOTAL_DRILL_COUNT}</strong></p>
      </div>
      <div class="dashboard-actions">
        ${continueHtml}
        <a class="btn" href="#/review">Daily Review${dueCount ? ` · ${dueLabel}` : ""}</a>
        <a class="btn" href="#/cheatsheet">Cheat sheet</a>
      </div>
      <h3>Achievements</h3>
      ${renderBadgeGrid(progress)}
    </section>
  `;
}

function bindProgressSettings() {
  const importFile = document.getElementById("import-progress");
  document.addEventListener("click", (event) => {
    if (event.target.closest("#reset-progress") && resetDialog) {
      resetDialog.showModal();
    }
    if (event.target.closest("#export-progress")) {
      exportProgress();
    }
    if (event.target.closest("#import-progress-btn") && importFile) {
      importFile.click();
    }
  });
  if (importFile) {
    importFile.addEventListener("change", async () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) {
        return;
      }
      try {
        await importProgressFile(file);
        showToast({
          type: "rank",
          icon: "💾",
          title: "Progress imported",
          body: "Your bootcamp data is now on this device.",
        });
        await render();
      } catch (error) {
        console.warn("Progress import failed:", error);
        showToast({
          type: "achievement",
          icon: "⚠️",
          title: "Import failed",
          body: "That file is not valid tutor progress.",
        });
      }
    });
  }
}

function renderHome() {
  const progress = loadProgress();
  const cards = outline.modules
    .map((module) => {
      const unlocked = isLessonUnlocked(module.id, progress);
      const passed = isLessonPassed(module.id, progress);
      const badge = isStarter(module)
        ? '<span class="badge badge-download">Download a Godot project</span>'
        : "";
      const status = !unlocked
        ? '<span class="module-status">🔒 Locked</span>'
        : passed
          ? '<span class="module-status is-passed">✓ Passed</span>'
          : '<span class="module-status">In progress</span>';
      const lockedClass = unlocked ? "" : " is-locked";
      return `<a class="module-card${lockedClass}" href="#/lesson/${module.id}">
        <h2>${module.id}. ${escapeHtml(module.title)} ${badge}</h2>
        <p>${escapeHtml(module.summary)}</p>
        ${status}
      </a>`;
    })
    .join("");

  main.innerHTML = `
    <article class="content">
      <p class="kicker">Godot 4 · GDScript · Bootcamp</p>
      <h1>${escapeHtml(outline.title)}</h1>
      <p class="lead">${escapeHtml(outline.subtitle)}</p>
      ${renderDashboard(progress)}
      <p>${escapeHtml(outline.notes.purpose)}</p>
      <div class="callout">
        <p>${escapeHtml(outline.notes.noSandbox)}</p>
      </div>
      <h2>Lesson outline</h2>
      <div class="module-grid">${cards}</div>
      <div class="callout callout-download">
        <p>${escapeHtml(outline.notes.starterProjects)}</p>
      </div>
      <section class="settings-panel" aria-label="Progress settings">
        <h2>Progress settings</h2>
        <p>Your rank, XP, badges, typing drills, review queue, streak, and quiz scores are saved on this device only. Export a file to copy progress from your laptop to your phone, or the other way around.</p>
        <div class="settings-actions">
          <button type="button" class="btn" id="export-progress">Export progress</button>
          <button type="button" class="btn" id="import-progress-btn">Import progress</button>
          <button type="button" class="btn btn-danger" id="reset-progress">Reset progress</button>
        </div>
      </section>
    </article>
  `;
  document.title = "GDScript Tutor";
}

function renderSubtopicBlock(module, sub) {
  const downloadNote =
    isStarter(sub) || isStarter(module)
      ? `<div class="callout callout-download">
          <p><strong>Game section:</strong> Download a starter Godot 4 project (.zip) and run it in the Godot editor. There is no in-browser code execution in version 1.</p>
        </div>`
      : "";
  return `
    <section class="subtopic-card" id="subtopic-${module.id}-${sub.id}">
      <h2>${module.id}.${sub.id} ${escapeHtml(sub.title)}</h2>
      ${downloadNote}
      <p class="label">Plain language</p>
      <p>${formatInlineCode(sub.plainLanguage)}</p>
      <p class="label">Godot 4 angle</p>
      <p>${formatInlineCode(sub.godotAngle)}</p>
      ${renderCode(sub.example)}
    </section>
  `;
}

function pager(prev, next) {
  const prevLink = prev
    ? `<a href="${prev.href}">← ${escapeHtml(prev.label)}</a>`
    : "<span></span>";
  let nextLink = "<span></span>";
  if (next && next.locked) {
    nextLink = `<span class="pager-locked">🔒 ${escapeHtml(next.label)}</span>`;
  } else if (next) {
    nextLink = `<a href="${next.href}">${escapeHtml(next.label)} →</a>`;
  }
  return `<nav class="pager" aria-label="Lesson pager">${prevLink}${nextLink}</nav>`;
}

function neighbors(module, subtopicId) {
  const modules = outline.modules;
  const moduleIndex = modules.findIndex((item) => item.id === module.id);
  const progress = loadProgress();

  function linkForModule(target, labelPrefix) {
    if (!target) {
      return null;
    }
    return {
      href: `#/lesson/${target.id}`,
      label: labelPrefix ? `${labelPrefix}${target.title}` : target.title,
      locked: !isLessonUnlocked(target.id, progress),
    };
  }

  if (!subtopicId) {
    const prevModule = modules[moduleIndex - 1];
    const nextModule = modules[moduleIndex + 1];
    return {
      prev: prevModule
        ? { href: `#/lesson/${prevModule.id}`, label: prevModule.title, locked: !isLessonUnlocked(prevModule.id, progress) }
        : { href: "#/", label: "Home" },
      next: linkForModule(nextModule),
    };
  }

  const index = module.subtopics.findIndex((item) => item.id === subtopicId);
  const prevSub = module.subtopics[index - 1];
  const nextSub = module.subtopics[index + 1];
  const nextModule = modules[moduleIndex + 1];

  const prev = prevSub
    ? { href: `#/lesson/${module.id}/${prevSub.id}`, label: prevSub.title }
    : { href: `#/lesson/${module.id}`, label: module.title };
  const next = nextSub
    ? { href: `#/lesson/${module.id}/${nextSub.id}`, label: nextSub.title }
    : linkForModule(nextModule);
  return { prev, next };
}

function renderLockedLesson(moduleId) {
  const requiredId = unlockRequirement(moduleId);
  const requiredTitle = moduleTitle(requiredId);
  const current = outline ? getModule(moduleId) : null;
  const title = current ? current.title : `Lesson ${moduleId}`;
  const needQuiz = requiredId <= QUIZ_MODULE_COUNT;
  const requirement = needQuiz
    ? `Pass Lesson ${requiredId} (${escapeHtml(requiredTitle)}) with at least ${PASS_SCORE} out of ${QUIZ_QUESTION_COUNT} on the quiz to unlock this module.`
    : `Pass Lesson ${requiredId} (${escapeHtml(requiredTitle)}) to unlock this module.`;
  main.innerHTML = `
    <article class="content locked-lesson">
      <p class="kicker">Locked</p>
      <h1>🔒 ${escapeHtml(title)} is locked</h1>
      <p>${requirement}</p>
      <p><a class="btn btn-primary" href="#/lesson/${requiredId}">Go to Lesson ${requiredId}</a></p>
    </article>
  `;
  document.title = `${title} locked · GDScript Tutor`;
}

function renderMissionPanel(module) {
  if (!isMissionModule(module)) {
    return "";
  }
  const complete = isLessonPassed(module.id);
  if (complete) {
    return `<section class="mission-panel is-complete">
      <h2>Mission status</h2>
      <p>This mission is marked complete. You can still use the starter project as a reference.</p>
      <p class="mission-complete-label">✓ Mission complete</p>
    </section>`;
  }
  return `<section class="mission-panel">
    <h2>Mission status</h2>
    <p>This module has no quiz yet. When you have finished the Godot starter project, mark the mission complete to record the XP and unlock credit toward your rank.</p>
    <button type="button" class="btn btn-primary" id="mark-mission-complete" data-lesson-id="${module.id}">Mark mission complete</button>
  </section>`;
}

function bindMissionButton(module) {
  const button = document.getElementById("mark-mission-complete");
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    const result = markMissionComplete(module.id);
    if (!result) {
      return;
    }
    const panel = main.querySelector(".mission-panel");
    if (panel) {
      panel.classList.add("is-complete");
      panel.innerHTML = `
        <h2>Mission status</h2>
        <p>This mission is marked complete. You can still use the starter project as a reference.</p>
        <p class="mission-complete-label">✓ Mission complete · +${result.xpGained} XP</p>
      `;
    }
    const pagerEl = main.querySelector(".pager");
    if (pagerEl) {
      const links = neighbors(module, null);
      pagerEl.outerHTML = pager(links.prev, links.next);
    }
    refreshChrome();
  });
}

function renderQuizHtml(module, quiz) {
  if (!quiz) {
    return "";
  }
  try {
    const questions = (quiz.questions || [])
      .map((question, qIndex) => {
        const choices = question.choices
          .map((choice, cIndex) => {
            const letter = String.fromCharCode(65 + cIndex);
            return `<li>
              <button type="button" data-quiz="${qIndex}" data-choice="${cIndex}">
                <span class="choice-letter">${letter})</span>
                <span class="choice-text">${renderInline(choice)}</span>
              </button>
            </li>`;
          })
          .join("");
        return `<div class="quiz-question" data-answer="${question.answer}" data-question-id="${question.id || qIndex + 1}">
          <p><strong>${qIndex + 1}.</strong> ${renderInline(question.prompt)}</p>
          <ul class="quiz-choices">${choices}</ul>
          <p class="quiz-explain" hidden></p>
        </div>`;
      })
      .join("");
    const lessonId = quiz.lessonId || module.id;
    const total = (quiz.questions || []).length;
    const best = readBestScore(lessonId);
    const bestLabel = best === null ? "" : `Best score so far: ${best} / ${total}`;
    return `<section class="quiz" aria-label="Practice quiz" data-lesson-id="${lessonId}">
      <h2>${escapeHtml(quiz.title)}</h2>
      <p>${escapeHtml(quiz.description || `This is a short check on Module ${module.id}. It runs in this page; it does not execute GDScript.`)}</p>
      <p class="quiz-best"${best === null ? " hidden" : ""}>${bestLabel}</p>
      ${questions}
      <div class="quiz-results" hidden>
        <p class="quiz-score" aria-live="polite"></p>
        <p class="quiz-xp" hidden></p>
        <button type="button" class="quiz-retry">Try again</button>
      </div>
    </section>`;
  } catch (error) {
    console.warn("Quiz failed to load:", error);
    return "";
  }
}

async function loadQuizData(moduleOrId) {
  const module = typeof moduleOrId === "object" ? moduleOrId : outline && getModule(moduleOrId);
  if (!module || !module.quiz) {
    return null;
  }
  if (quizCache.has(module.id)) {
    return quizCache.get(module.id);
  }
  try {
    const response = await fetch(module.quiz);
    const data = response.ok ? await response.json() : null;
    quizCache.set(module.id, data);
    return data;
  } catch (error) {
    console.warn("Quiz failed to load:", error);
    quizCache.set(module.id, null);
    return null;
  }
}

async function loadDrillData(moduleOrId) {
  const module = typeof moduleOrId === "object" ? moduleOrId : outline && getModule(moduleOrId);
  if (!module || !module.drills) {
    return null;
  }
  if (drillCache.has(module.id)) {
    return drillCache.get(module.id);
  }
  try {
    const response = await fetch(module.drills);
    const data = response.ok ? await response.json() : null;
    drillCache.set(module.id, data);
    return data;
  } catch (error) {
    console.warn("Drills failed to load:", error);
    drillCache.set(module.id, null);
    return null;
  }
}

function bindQuiz(quiz) {
  const root = main.querySelector(".quiz");
  if (!root || !quiz) {
    return;
  }

  const questions = root.querySelectorAll(".quiz-question");
  const results = root.querySelector(".quiz-results");
  const scoreEl = root.querySelector(".quiz-score");
  const xpEl = root.querySelector(".quiz-xp");
  const bestEl = root.querySelector(".quiz-best");
  const retryBtn = root.querySelector(".quiz-retry");
  const lessonId = quiz.lessonId || Number(root.getAttribute("data-lesson-id"));
  const total = questions.length;
  const explains = (quiz.questions || []).map((question) => question.explain || "");
  let missed = [];

  function updateBestLabel(score) {
    if (!bestEl || score === null) {
      return;
    }
    bestEl.hidden = false;
    bestEl.textContent = `Best score so far: ${score} / ${total}`;
  }

  function checkComplete() {
    const answered = root.querySelectorAll(".quiz-question[data-answered]");
    if (answered.length !== total || !results || !scoreEl) {
      return;
    }
    let correct = 0;
    answered.forEach((block) => {
      if (block.getAttribute("data-correct") === "true") {
        correct += 1;
      }
    });
    const result = recordQuizResult(lessonId, correct, { missed });
    scoreEl.textContent = `You scored ${correct} out of ${total}. Your best is ${result.best} out of ${total}.`;
    if (xpEl) {
      xpEl.hidden = false;
      xpEl.textContent = result.xpGained > 0
        ? `+${result.xpGained} XP (total ${result.totalXp} XP)`
        : `No new XP — retakes only add the difference when you beat your best score. Total ${result.totalXp} XP.`;
    }
    results.hidden = false;
    updateBestLabel(result.best);
    const pagerEl = main.querySelector(".pager");
    const module = getModule(lessonId);
    if (pagerEl && module) {
      const links = neighbors(module, null);
      pagerEl.outerHTML = pager(links.prev, links.next);
    }
    results.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function resetQuiz() {
    missed = [];
    questions.forEach((block) => {
      block.removeAttribute("data-answered");
      block.removeAttribute("data-correct");
      const explainEl = block.querySelector(".quiz-explain");
      if (explainEl) {
        explainEl.hidden = true;
        explainEl.textContent = "";
        explainEl.classList.remove("is-correct", "is-wrong");
      }
      block.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
        button.classList.remove("is-correct", "is-wrong");
        button.removeAttribute("aria-pressed");
      });
    });
    if (results) {
      results.hidden = true;
    }
    if (scoreEl) {
      scoreEl.textContent = "";
    }
    if (xpEl) {
      xpEl.hidden = true;
      xpEl.textContent = "";
    }
  }

  questions.forEach((block, qIndex) => {
    const answer = Number(block.getAttribute("data-answer"));
    const questionId = Number(block.getAttribute("data-question-id")) || (quiz.questions[qIndex] && quiz.questions[qIndex].id) || qIndex + 1;
    const explainEl = block.querySelector(".quiz-explain");
    block.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (block.hasAttribute("data-answered")) {
          return;
        }
        const choice = Number(button.getAttribute("data-choice"));
        const isCorrect = choice === answer;
        block.setAttribute("data-answered", "true");
        block.setAttribute("data-correct", String(isCorrect));
        block.querySelectorAll("button").forEach((item) => {
          item.disabled = true;
          item.classList.remove("is-correct", "is-wrong");
          item.setAttribute("aria-pressed", "false");
        });
        button.setAttribute("aria-pressed", "true");
        button.classList.add(isCorrect ? "is-correct" : "is-wrong");
        const correctBtn = block.querySelector(`[data-choice="${answer}"]`);
        if (correctBtn) {
          correctBtn.classList.add("is-correct");
        }
        if (!isCorrect) {
          missed.push({ type: "quiz", lessonId, questionId });
        }
        if (explainEl) {
          const prefix = isCorrect ? "Correct. " : "Not quite. ";
          explainEl.hidden = false;
          explainEl.classList.toggle("is-correct", isCorrect);
          explainEl.classList.toggle("is-wrong", !isCorrect);
          explainEl.innerHTML = prefix + renderInline(explains[qIndex] || "");
        }
        checkComplete();
      });
    });
  });

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      resetQuiz();
      root.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
}

function stripLineCommentAndSemicolon(line) {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inSingle) {
      out += ch;
      if (ch === "\\" && i + 1 < line.length) {
        out += line[i + 1];
        i += 1;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      out += ch;
      if (ch === "\\" && i + 1 < line.length) {
        out += line[i + 1];
        i += 1;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      continue;
    }
    if (ch === "#") {
      break;
    }
    if (ch === "/" && line[i + 1] === "/") {
      break;
    }
    out += ch;
  }
  return out.replace(/;+\s*$/, "").trim();
}

function normalizeQuotes(value) {
  let out = "";
  let i = 0;
  const s = String(value);
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      out += ch;
      i += 1;
      while (i < s.length) {
        out += s[i];
        if (s[i] === "\\" && i + 1 < s.length) {
          out += s[i + 1];
          i += 2;
          continue;
        }
        if (s[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === "'") {
      let content = "";
      let closed = false;
      i += 1;
      while (i < s.length) {
        if (s[i] === "\\" && i + 1 < s.length) {
          content += s[i] + s[i + 1];
          i += 2;
          continue;
        }
        if (s[i] === "'") {
          closed = true;
          i += 1;
          break;
        }
        content += s[i];
        i += 1;
      }
      if (closed && !content.includes('"')) {
        out += `"${content}"`;
      } else {
        out += `'${content}${closed ? "'" : ""}`;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function normalizeCode(input) {
  const cleaned = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => stripLineCommentAndSemicolon(line.replace(/\t/g, " ")))
    .filter((line) => line.length > 0)
    .join("\n");
  let s = normalizeQuotes(cleaned).replace(/\s+/g, " ").trim();
  s = s.replace(/\s*\(\s*/g, "(");
  s = s.replace(/\s*\)\s*/g, ")");
  s = s.replace(/\s*\[\s*/g, "[");
  s = s.replace(/\s*\]\s*/g, "]");
  s = s.replace(/\s*\{\s*/g, "{");
  s = s.replace(/\s*\}\s*/g, "}");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/:(?=\s*[A-Za-z_])/g, ": ");
  s = s.replace(/:\s+/g, ": ");
  s = s.replace(/\s*:=\s*/g, "\0COLONEQ\0");
  s = s.replace(/\s*==\s*/g, "\0EQ\0");
  s = s.replace(/\s*!=\s*/g, "\0NE\0");
  s = s.replace(/\s*<=\s*/g, "\0LE\0");
  s = s.replace(/\s*>=\s*/g, "\0GE\0");
  s = s.replace(/\s*->\s*/g, "\0ARROW\0");
  s = s.replace(/\s*\+=\s*/g, "\0PE\0");
  s = s.replace(/\s*-=\s*/g, "\0ME\0");
  s = s.replace(/\s*>\s*/g, "\0GT\0");
  s = s.replace(/\s*<\s*/g, "\0LT\0");
  s = s.replace(/\s*=\s*/g, " = ");
  s = s.replace(/\0COLONEQ\0/g, " := ");
  s = s.replace(/\0EQ\0/g, " == ");
  s = s.replace(/\0NE\0/g, " != ");
  s = s.replace(/\0LE\0/g, " <= ");
  s = s.replace(/\0GE\0/g, " >= ");
  s = s.replace(/\0GT\0/g, " > ");
  s = s.replace(/\0LT\0/g, " < ");
  s = s.replace(/\0ARROW\0/g, " -> ");
  s = s.replace(/\0PE\0/g, " += ");
  s = s.replace(/\0ME\0/g, " -= ");
  s = s.replace(/!\s*/g, "!");
  s = s.replace(/\b(if|elif|while|for|match|return|await|and|or|not)\(/g, "$1 (");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\)\s*:/g, "):");
  s = s.replace(/\s+:(?!=)/g, ":");
  return s;
}

function answersMatch(input, accepted) {
  const normalized = normalizeCode(input);
  if (!normalized) {
    return false;
  }
  return (accepted || []).some((item) => normalizeCode(item) === normalized);
}

function expectedAnswer(drill) {
  return (drill.accepted && drill.accepted[0]) || "";
}

function renderDrillsHtml(module, drills) {
  if (!drills || !drills.drills || !drills.drills.length) {
    return "";
  }
  const progress = loadProgress();
  const items = drills.drills
    .map((drill, index) => {
      const key = `${module.id}:${drill.id}`;
      const done = Boolean(progress.drillsCompleted[key]);
      return `<div class="drill${done ? " is-complete" : ""}" data-drill-id="${drill.id}">
        <p class="drill-prompt"><strong>${index + 1}.</strong> ${renderInline(drill.prompt)}${done ? ' <span class="drill-done-flag">Completed</span>' : ""}</p>
        <label class="visually-hidden" for="drill-input-${module.id}-${drill.id}">Your answer for drill ${index + 1}</label>
        <textarea id="drill-input-${module.id}-${drill.id}" class="drill-input" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
        <div class="drill-actions">
          <button type="button" class="btn btn-primary drill-check">Check</button>
          <button type="button" class="btn drill-hint">Hint</button>
        </div>
        <p class="drill-hint-text" hidden></p>
        <p class="drill-feedback" hidden></p>
      </div>`;
    })
    .join("");
  const completed = drills.drills.filter((drill) => progress.drillsCompleted[`${module.id}:${drill.id}`]).length;
  return `<section class="drills" aria-label="Typing drills" data-lesson-id="${module.id}">
    <h2>${escapeHtml(drills.title || "Typing drills")}</h2>
    <p>${escapeHtml(drills.description || "Type the GDScript. Spacing is flexible, and a trailing semicolon is fine.")}</p>
    <p class="drill-progress">${completed} / ${drills.drills.length} completed · ${XP_PER_DRILL} XP each, first time only</p>
    ${items}
  </section>`;
}

function bindTabInsertion(textarea) {
  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const insert = event.shiftKey ? "" : "\t";
    if (event.shiftKey && start === end) {
      return;
    }
    textarea.value = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const cursor = start + insert.length;
    textarea.selectionStart = cursor;
    textarea.selectionEnd = cursor;
  });
}

function bindDrills(module, drills) {
  const root = main.querySelector(".drills");
  if (!root || !drills) {
    return;
  }
  const lessonId = module.id;
  const progressEl = root.querySelector(".drill-progress");

  function updateProgressLabel() {
    const progress = loadProgress();
    const completed = drills.drills.filter((drill) => progress.drillsCompleted[`${lessonId}:${drill.id}`]).length;
    if (progressEl) {
      progressEl.textContent = `${completed} / ${drills.drills.length} completed · ${XP_PER_DRILL} XP each, first time only`;
    }
  }

  root.querySelectorAll(".drill").forEach((block) => {
    const drillId = Number(block.getAttribute("data-drill-id"));
    const drill = drills.drills.find((item) => item.id === drillId);
    if (!drill) {
      return;
    }
    const input = block.querySelector(".drill-input");
    const checkBtn = block.querySelector(".drill-check");
    const hintBtn = block.querySelector(".drill-hint");
    const hintEl = block.querySelector(".drill-hint-text");
    const feedbackEl = block.querySelector(".drill-feedback");
    let misses = 0;

    if (input) {
      bindTabInsertion(input);
    }

    if (hintBtn && hintEl) {
      hintBtn.addEventListener("click", () => {
        hintEl.hidden = false;
        hintEl.textContent = drill.hint || "Look back at the lesson example and try again.";
      });
    }

    if (checkBtn) {
      checkBtn.addEventListener("click", () => {
        const value = input ? input.value : "";
        const isCorrect = answersMatch(value, drill.accepted);
        const result = recordDrillResult(lessonId, drill, isCorrect);
        if (feedbackEl) {
          feedbackEl.hidden = false;
          feedbackEl.classList.toggle("is-correct", isCorrect);
          feedbackEl.classList.toggle("is-wrong", !isCorrect);
        }
        if (isCorrect) {
          block.classList.add("is-complete");
          const xpNote = result.firstCompletion
            ? ` +${result.xpGained} XP.`
            : " Already completed, so no new XP.";
          if (feedbackEl) {
            feedbackEl.innerHTML = `Correct. ${renderInline(drill.explain || "")}${escapeHtml(xpNote)}`;
          }
          if (!block.querySelector(".drill-done-flag")) {
            const prompt = block.querySelector(".drill-prompt");
            if (prompt) {
              prompt.insertAdjacentHTML("beforeend", ' <span class="drill-done-flag">Completed</span>');
            }
          }
          updateProgressLabel();
          return;
        }
        misses += 1;
        let message = "Not quite. ";
        if (misses >= REVIEW_MISS_LIMIT) {
          message += `A valid answer is <code>${escapeHtml(expectedAnswer(drill))}</code>. `;
        } else {
          message += "Check the name, punctuation, and quotes, then try again. ";
        }
        if (drill.explain && misses >= REVIEW_MISS_LIMIT) {
          message += renderInline(drill.explain);
        }
        if (feedbackEl) {
          feedbackEl.innerHTML = message;
        }
      });
    }
  });
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

async function resolveReviewContent(item) {
  if (item.type === "quiz") {
    const quiz = await loadQuizData(item.lessonId);
    const question = quiz && (quiz.questions || []).find((entry) => Number(entry.id) === Number(item.questionId));
    if (!question) {
      return null;
    }
    return { kind: "quiz", lessonId: item.lessonId, question, item };
  }
  const drills = await loadDrillData(item.lessonId);
  const drill = drills && (drills.drills || []).find((entry) => Number(entry.id) === Number(item.drillId));
  if (!drill) {
    return null;
  }
  return { kind: "drill", lessonId: item.lessonId, drill, item };
}

async function collectFillerItems(excludeIds, progress) {
  const fillers = [];
  for (let lessonId = 1; lessonId <= QUIZ_MODULE_COUNT; lessonId += 1) {
    if (!isLessonPassed(lessonId, progress)) {
      continue;
    }
    const quiz = await loadQuizData(lessonId);
    (quiz && quiz.questions ? quiz.questions : []).forEach((question) => {
      const id = reviewItemId("quiz", lessonId, question.id);
      if (!excludeIds.has(id)) {
        fillers.push({ type: "quiz", lessonId, questionId: question.id, id, filler: true });
      }
    });
    const drills = await loadDrillData(lessonId);
    (drills && drills.drills ? drills.drills : []).forEach((drill) => {
      const id = reviewItemId("drill", lessonId, drill.id);
      if (!excludeIds.has(id)) {
        fillers.push({ type: "drill", lessonId, drillId: drill.id, id, filler: true });
      }
    });
  }
  return shuffle(fillers);
}

async function buildReviewSession() {
  const progress = loadProgress();
  const due = getDueReviewItems(progress);
  const selected = [];
  const exclude = new Set();
  for (const item of due) {
    if (selected.length >= REVIEW_DECK_SIZE) {
      break;
    }
    const resolved = await resolveReviewContent(item);
    if (!resolved) {
      continue;
    }
    selected.push(resolved);
    exclude.add(item.id);
  }
  if (selected.length < REVIEW_DECK_SIZE) {
    const fillers = await collectFillerItems(exclude, progress);
    for (const filler of fillers) {
      if (selected.length >= REVIEW_DECK_SIZE) {
        break;
      }
      const resolved = await resolveReviewContent(filler);
      if (!resolved) {
        continue;
      }
      resolved.item = filler;
      selected.push(resolved);
      exclude.add(filler.id);
    }
  }
  reviewSession = {
    items: selected,
    index: 0,
    results: [],
    startedAt: Date.now(),
  };
  return reviewSession;
}

function renderReviewQuizCard(entry, index, total) {
  const question = entry.question;
  const choices = question.choices
    .map((choice, cIndex) => {
      const letter = String.fromCharCode(65 + cIndex);
      return `<li>
        <button type="button" data-choice="${cIndex}">
          <span class="choice-letter">${letter})</span>
          <span class="choice-text">${renderInline(choice)}</span>
        </button>
      </li>`;
    })
    .join("");
  const source = entry.item && entry.item.filler ? "Practice from a passed lesson" : "Due from your review queue";
  return `<section class="review-card quiz" data-kind="quiz">
    <p class="review-meta">${index + 1} / ${total} · ${escapeHtml(source)} · Lesson ${entry.lessonId}</p>
    <p class="drill-prompt">${renderInline(question.prompt)}</p>
    <ul class="quiz-choices">${choices}</ul>
    <p class="quiz-explain" hidden></p>
    <div class="review-advance" hidden>
      <button type="button" class="btn btn-primary review-next">Next</button>
    </div>
  </section>`;
}

function renderReviewDrillCard(entry, index, total) {
  const drill = entry.drill;
  const source = entry.item && entry.item.filler ? "Practice from a passed lesson" : "Due from your review queue";
  return `<section class="review-card drills" data-kind="drill">
    <p class="review-meta">${index + 1} / ${total} · ${escapeHtml(source)} · Lesson ${entry.lessonId}</p>
    <p class="drill-prompt">${renderInline(drill.prompt)}</p>
    <label class="visually-hidden" for="review-drill-input">Your answer</label>
    <textarea id="review-drill-input" class="drill-input" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
    <div class="drill-actions">
      <button type="button" class="btn btn-primary drill-check">Check</button>
      <button type="button" class="btn drill-hint">Hint</button>
    </div>
    <p class="drill-hint-text" hidden></p>
    <p class="drill-feedback" hidden></p>
    <div class="review-advance" hidden>
      <button type="button" class="btn btn-primary review-next">Next</button>
    </div>
  </section>`;
}

function finishReviewSession() {
  const session = reviewSession;
  const correct = session.results.filter((item) => item.correct).length;
  const total = session.results.length;
  main.querySelector(".review-stage").innerHTML = `
    <section class="review-summary">
      <h2>Review complete</h2>
      <p>You reviewed ${total} item${total === 1 ? "" : "s"} and got ${correct} right.</p>
      <p>Missed items return tomorrow, then after 3, 7, and 14 days if you keep getting them right.</p>
      <div class="dashboard-actions">
        <button type="button" class="btn btn-primary" id="review-again">Review again</button>
        <a class="btn" href="#/">Back to dashboard</a>
      </div>
    </section>
  `;
  const again = document.getElementById("review-again");
  if (again) {
    again.addEventListener("click", async () => {
      reviewSession = null;
      await renderReviewPage();
    });
  }
}

function bindReviewCard(entry) {
  const card = main.querySelector(".review-card");
  if (!card) {
    return;
  }
  const advance = card.querySelector(".review-advance");
  const nextBtn = card.querySelector(".review-next");

  function completeItem(isCorrect) {
    const progress = loadProgress();
    const fromQueue = progress.review && entry.item && progress.review[entry.item.id];
    if (fromQueue || !isCorrect) {
      if (isCorrect && fromQueue) {
        applyReviewResult(progress, fromQueue, true);
      } else if (!isCorrect) {
        enqueueReviewItem(
          progress,
          entry.item,
          Date.now() + (fromQueue ? LEITNER_INTERVALS_MS[0] : 0)
        );
      }
    }
    recordActivity(progress);
    const unlocked = evaluateAchievements(progress, { now: new Date() });
    persistProgress(progress);
    announceUnlocks(unlocked, getRankInfo(getTotalXp(progress)).current, getRankInfo(getTotalXp(progress)).current);
    refreshChrome();
    reviewSession.results.push({ id: entry.item.id, correct: isCorrect });
    if (advance) {
      advance.hidden = false;
    }
    if (nextBtn) {
      nextBtn.textContent = reviewSession.index + 1 >= reviewSession.items.length ? "See results" : "Next";
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      reviewSession.index += 1;
      if (reviewSession.index >= reviewSession.items.length) {
        finishReviewSession();
      } else {
        paintReviewCard();
      }
    });
  }

  if (entry.kind === "quiz") {
    const answer = Number(entry.question.answer);
    const explainEl = card.querySelector(".quiz-explain");
    card.querySelectorAll(".quiz-choices button").forEach((button) => {
      button.addEventListener("click", () => {
        if (card.hasAttribute("data-answered")) {
          return;
        }
        const choice = Number(button.getAttribute("data-choice"));
        const isCorrect = choice === answer;
        card.setAttribute("data-answered", "true");
        button.classList.add(isCorrect ? "is-correct" : "is-wrong");
        const correctBtn = card.querySelector(`[data-choice="${answer}"]`);
        if (correctBtn) {
          correctBtn.classList.add("is-correct");
        }
        card.querySelectorAll(".quiz-choices button").forEach((item) => {
          item.disabled = true;
        });
        if (explainEl) {
          explainEl.hidden = false;
          explainEl.classList.toggle("is-correct", isCorrect);
          explainEl.classList.toggle("is-wrong", !isCorrect);
          explainEl.innerHTML = `${isCorrect ? "Correct. " : "Not quite. "}${renderInline(entry.question.explain || "")}`;
        }
        completeItem(isCorrect);
      });
    });
    return;
  }

  const input = card.querySelector(".drill-input");
  const checkBtn = card.querySelector(".drill-check");
  const hintBtn = card.querySelector(".drill-hint");
  const hintEl = card.querySelector(".drill-hint-text");
  const feedbackEl = card.querySelector(".drill-feedback");
  let misses = 0;
  if (input) {
    bindTabInsertion(input);
  }
  if (hintBtn && hintEl) {
    hintBtn.addEventListener("click", () => {
      hintEl.hidden = false;
      hintEl.textContent = entry.drill.hint || "Look back at the lesson example and try again.";
    });
  }
  if (checkBtn) {
    checkBtn.addEventListener("click", () => {
      if (card.hasAttribute("data-answered")) {
        return;
      }
      const isCorrect = answersMatch(input ? input.value : "", entry.drill.accepted);
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.classList.toggle("is-correct", isCorrect);
        feedbackEl.classList.toggle("is-wrong", !isCorrect);
      }
      if (isCorrect) {
        if (feedbackEl) {
          feedbackEl.innerHTML = `Correct. ${renderInline(entry.drill.explain || "")}`;
        }
        card.setAttribute("data-answered", "true");
        if (input) {
          input.disabled = true;
        }
        checkBtn.disabled = true;
        completeItem(true);
        return;
      }
      misses += 1;
      let message = "Not quite. ";
      if (misses >= REVIEW_MISS_LIMIT) {
        message += `A valid answer is <code>${escapeHtml(expectedAnswer(entry.drill))}</code>. `;
        message += renderInline(entry.drill.explain || "");
        if (feedbackEl) {
          feedbackEl.innerHTML = message;
        }
        card.setAttribute("data-answered", "true");
        if (input) {
          input.disabled = true;
        }
        checkBtn.disabled = true;
        completeItem(false);
        return;
      }
      if (feedbackEl) {
        feedbackEl.textContent = `${message}Check the name, punctuation, and quotes, then try again.`;
      }
    });
  }
}

function paintReviewCard() {
  const session = reviewSession;
  const entry = session.items[session.index];
  const stage = main.querySelector(".review-stage");
  if (!stage || !entry) {
    finishReviewSession();
    return;
  }
  stage.innerHTML =
    entry.kind === "quiz"
      ? renderReviewQuizCard(entry, session.index, session.items.length)
      : renderReviewDrillCard(entry, session.index, session.items.length);
  bindReviewCard(entry);
}

async function renderReviewPage() {
  const progress = loadProgress();
  const dueCount = getDueReviewItems(progress).length;
  if (!reviewSession || reviewSession.index >= (reviewSession.items || []).length) {
    await buildReviewSession();
  }
  const session = reviewSession;
  const empty = !session.items.length;
  main.innerHTML = `
    <article class="content review-page">
      <p class="kicker">Daily Review</p>
      <h1>Daily Review</h1>
      <p class="lead">Five quick checks. Due review items come first, then a mix from lessons you have already passed.</p>
      <p class="review-streak">Streak <strong>🔥 ${getDisplayStreak(progress)}</strong> · ${dueCount} item${dueCount === 1 ? "" : "s"} waiting in your queue.</p>
      <div class="review-stage"></div>
    </article>
  `;
  if (empty) {
    main.querySelector(".review-stage").innerHTML = `
      <section class="review-empty">
        <h2>Nothing to review yet</h2>
        <p>Pass a lesson quiz or complete a typing drill, then come back for a mixed five-question deck. Missed questions and drills will also show up here.</p>
        <p><a class="btn btn-primary" href="#/lesson/1">Start Lesson 1</a></p>
      </section>
    `;
  } else if (session.index >= session.items.length) {
    finishReviewSession();
  } else {
    paintReviewCard();
  }
  document.title = "Daily Review · GDScript Tutor";
}

function renderCheatSheet() {
  const sections = [
    {
      title: "Variables, const, and @export",
      code: `var fear := 0.0
var fear: float = 0.0
@export var max_fear := 100.0
const MAX_INVENTORY_SLOTS := 8
flashlight_battery = 80.0`,
    },
    {
      title: "Types",
      code: `var health: int = 100
var fear: float = 0.0
var current_room: String = "Basement"
var is_flashlight_on: bool = false
# null means nothing is here yet
if monster != null:
    pass`,
    },
    {
      title: "Arrays",
      code: `var inventory: Array[String] = ["flashlight", "key"]
inventory[0]  # "flashlight"
inventory.append("keycard")`,
    },
    {
      title: "Dictionaries",
      code: `var stats := {"fear": 0.0, "stamina": 100.0}
stats["fear"]
# Godot also allows: {fear = 0.0, stamina = 100.0}`,
    },
    {
      title: "if / elif / else / match",
      code: `if fear > 80.0:
    print("panic")
elif fear > 40.0:
    print("uneasy")
else:
    print("calm")

if mic_volume > threshold and distance <= hear_distance:
    player_spotted.emit()

if not is_flashlight_on:
    pass

match state:
    "idle":
        pass
    _:
        pass`,
    },
    {
      title: "for / while / break / continue",
      code: `for i in range(3):
    print(i)  # 0, 1, 2

for item in inventory:
    if item == "empty":
        continue
    if item == "key":
        break

while fear < max_fear:
    raise_fear(1.0)`,
    },
    {
      title: "func / return / await",
      code: `func raise_fear(amount: float) -> void:
    fear = clampf(fear + amount, 0.0, max_fear)

func get_fear() -> float:
    return fear

await get_tree().create_timer(0.5).timeout`,
    },
    {
      title: "Signals preview",
      code: `signal flashlight_toggled(is_on: bool)
flashlight_toggled.emit(is_flashlight_on)
flashlight_toggled.connect(_on_flashlight_toggled)`,
    },
  ];

  const body = sections
    .map(
      (section) => `<section class="cheatsheet-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${renderCodeBlock(section.code, "gdscript")}
    </section>`
    )
    .join("");

  main.innerHTML = `
    <article class="content cheatsheet-page">
      <p class="kicker">Reference</p>
      <h1>Cheat sheet</h1>
      <p class="lead">The syntax from lessons 1 through 5, plus a short signals preview for the Godot missions. Use the Copy button on any block while you work in the editor.</p>
      ${body}
    </article>
  `;
  document.title = "Cheat sheet · GDScript Tutor";
}

async function loadLessonMarkdown(module) {
  if (!module.content) {
    return null;
  }
  const response = await fetch(module.content);
  if (!response.ok) {
    throw new Error(`Could not load lesson (${response.status})`);
  }
  return response.text();
}

async function renderLesson(moduleId, subtopicId) {
  const module = getModule(moduleId);
  if (!module) {
    main.innerHTML = `<article class="content"><div class="error-banner"><p>That lesson was not found. <a href="#/">Back to the outline</a>.</p></div></article>`;
    document.title = "Lesson not found · GDScript Tutor";
    return;
  }

  if (!isLessonUnlocked(module.id)) {
    renderLockedLesson(module.id);
    return;
  }

  const starterCallout = isStarter(module)
    ? `<div class="callout callout-download"><p><strong>Game section:</strong> ${escapeHtml(module.deliveryNote || "Download a starter Godot 4 project (.zip) and run it in the Godot editor.")}</p></div>`
    : "";

  if (subtopicId) {
    const sub = getSubtopic(module, subtopicId);
    if (!sub) {
      main.innerHTML = `<article class="content"><div class="error-banner"><p>That section was not found. <a href="#/lesson/${module.id}">Back to ${escapeHtml(module.title)}</a>.</p></div></article>`;
      return;
    }
    const links = neighbors(module, sub.id);
    main.innerHTML = `
      <article class="content">
        <p class="kicker">Module ${module.id} · ${escapeHtml(module.title)}</p>
        <h1>${escapeHtml(sub.title)}</h1>
        ${renderSubtopicBlock(module, sub)}
        ${pager(links.prev, links.next)}
      </article>
    `;
    document.title = `${sub.title} · GDScript Tutor`;
    return;
  }

  const links = neighbors(module, null);
  let title = module.title;
  let lessonBody = "";
  let usedMarkdown = false;

  if (module.content) {
    try {
      const markdown = await loadLessonMarkdown(module);
      const extracted = extractMarkdownTitle(markdown);
      if (extracted) {
        title = extracted;
      }
      const bodySource = stripFrontMatter(markdown.replace(/\r\n/g, "\n")).replace(/^#\s+.+$/m, "").trim();
      lessonBody = `<div class="lesson-body">${renderMarkdown(bodySource)}</div>`;
      usedMarkdown = true;
    } catch (error) {
      console.warn("Lesson markdown failed to load:", error);
      usedMarkdown = false;
    }
  }

  if (!usedMarkdown) {
    const sections = module.subtopics.map((sub) => renderSubtopicBlock(module, sub)).join("");
    lessonBody = `
      <p class="lead">${escapeHtml(module.summary)}</p>
      ${starterCallout}
      <p>${escapeHtml(module.horrorHook)}</p>
      ${sections}
    `;
  }

  let quiz = null;
  let quizHtml = "";
  if (module.quiz) {
    try {
      quiz = await loadQuizData(module);
      quizHtml = renderQuizHtml(module, quiz);
    } catch (error) {
      console.warn("Quiz failed to load:", error);
    }
  }

  let drills = null;
  let drillsHtml = "";
  if (module.drills) {
    try {
      drills = await loadDrillData(module);
      drillsHtml = renderDrillsHtml(module, drills);
    } catch (error) {
      console.warn("Drills failed to load:", error);
    }
  }

  const titleHtml = `<h1>${escapeHtml(title)}</h1>`;

  main.innerHTML = `
    <article class="content">
      <p class="kicker">Module ${module.id}</p>
      ${titleHtml}
      <div class="meta-row">
        <span class="badge badge-godot">Godot 4 · GDScript</span>
        ${isStarter(module) ? '<span class="badge badge-download">Download a Godot project</span>' : ""}
        ${isLessonPassed(module.id) ? '<span class="badge badge-passed">Passed</span>' : ""}
      </div>
      ${lessonBody}
      ${quizHtml}
      ${drillsHtml}
      ${renderMissionPanel(module)}
      ${pager(links.prev, links.next)}
    </article>
  `;
  bindQuiz(quiz);
  bindDrills(module, drills);
  bindMissionButton(module);
  document.title = `${title} · GDScript Tutor`;
}

function dismissToasts() {
  if (!toastRegion) {
    return;
  }
  toastRegion.querySelectorAll(".toast").forEach((el) => el.remove());
}

async function render() {
  const route = parseHash();
  dismissToasts();
  refreshChrome(route);
  if (route.view === "home") {
    renderHome();
  } else if (route.view === "review") {
    await renderReviewPage();
  } else if (route.view === "cheatsheet") {
    renderCheatSheet();
  } else {
    await renderLesson(route.moduleId, route.subtopicId);
  }
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  closeNav();
}

function bindResetDialog() {
  if (!resetDialog) {
    return;
  }
  const confirmBtn = document.getElementById("confirm-reset");
  const cancelBtn = document.getElementById("cancel-reset");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      clearAllProgress();
      resetDialog.close();
      showToast({
        type: "rank",
        icon: "🕯️",
        title: "Progress reset",
        body: "You are a Recruit again. Lesson 1 is still open.",
      });
      await render();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => resetDialog.close());
  }
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function bindCopyButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".copy-btn");
    if (!button) {
      return;
    }
    const text = button.getAttribute("data-code") || "";
    const previous = button.textContent;
    try {
      await copyText(text);
      button.textContent = "Copied";
      button.classList.add("is-copied");
    } catch (error) {
      console.warn("Copy failed:", error);
      button.textContent = "Copy failed";
    }
    window.setTimeout(() => {
      button.textContent = previous;
      button.classList.remove("is-copied");
    }, 1600);
  });
}

async function init() {
  registerServiceWorker();
  bindResetDialog();
  bindProgressSettings();
  bindCopyButtons();
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") !== "true";
    setNavOpen(open);
  });
  navBackdrop.addEventListener("click", closeNav);
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a") && window.matchMedia("(max-width: 799px)").matches) {
      closeNav();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
      if (resetDialog && resetDialog.open) {
        resetDialog.close();
      }
    }
  });

  try {
    const response = await fetch(OUTLINE_URL);
    if (!response.ok) {
      throw new Error(`Could not load lessons (${response.status})`);
    }
    outline = await response.json();
    loadProgress();
    window.addEventListener("hashchange", () => {
      render();
    });
    await render();
  } catch (error) {
    main.innerHTML = `<article class="content"><div class="error-banner"><p>The lesson outline could not be loaded. If you opened this file directly from disk, try serving the folder with <code>python3 -m http.server</code> instead.</p><p>${escapeHtml(error.message)}</p></div></article>`;
    navList.innerHTML = `<li class="nav-loading">Lessons unavailable.</li>`;
  }
}

init();
