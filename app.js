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
const QUIZ_MODULE_COUNT = 5;
const TOTAL_MODULE_COUNT = 7;

const RANKS = [
  { id: "recruit", name: "Recruit", shortName: "Recruit", xp: 0, icon: "🕯️" },
  { id: "private", name: "Private", shortName: "Private", xp: 150, icon: "🔦" },
  { id: "corporal", name: "Corporal", shortName: "Corporal", xp: 300, icon: "📻" },
  { id: "sergeant", name: "Sergeant", shortName: "Sergeant", xp: 450, icon: "🎖️" },
  { id: "lieutenant", name: "Lieutenant", shortName: "Lieutenant", xp: 600, icon: "📡" },
  { id: "captain", name: "Captain", shortName: "Captain", xp: 750, icon: "🛡️" },
  { id: "operative", name: "Operative", shortName: "Operative", xp: 900, icon: "👁️" },
  { id: "cable", name: "Cable-Level Operative", shortName: "Cable", xp: 1050, icon: "💀" },
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
];

const navList = document.getElementById("lesson-list");
const nav = document.getElementById("site-nav");
const navToggle = document.getElementById("nav-toggle");
const navBackdrop = document.getElementById("nav-backdrop");
const main = document.getElementById("main");
const rankChip = document.getElementById("rank-chip");
const toastRegion = document.getElementById("toast-region");
const resetDialog = document.getElementById("reset-dialog");

let outline = null;
let progressCache = null;

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

function emptyProgress() {
  return {
    version: 1,
    bestScores: {},
    missions: {},
    everFailed: {},
    achievements: {},
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

function getTotalXp(progress = loadProgress()) {
  let xp = 0;
  for (let id = 1; id <= QUIZ_MODULE_COUNT; id += 1) {
    xp += xpForScore(getBestScore(id, progress) || 0);
  }
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

  return unlocked;
}

function showToast({ title, body, icon, type = "achievement" }) {
  if (!toastRegion) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
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
  }, 4800);
}

function announceUnlocks(unlockedIds, oldRank, newRank) {
  if (newRank && oldRank && newRank.id !== oldRank.id) {
    showToast({
      type: "rank",
      icon: newRank.icon,
      title: `Promoted to ${newRank.name}`,
      body: "New rank unlocked.",
    });
  }
  unlockedIds.forEach((id) => {
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) {
      return;
    }
    showToast({
      type: "achievement",
      icon: achievement.icon,
      title: "Achievement unlocked",
      body: `${achievement.name} — ${achievement.description}`,
    });
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

function refreshChrome(route) {
  const current = route || parseHash();
  renderNav(current);
  updateRankChip();
}

function getContinueModule(progress = loadProgress()) {
  if (!outline) {
    return null;
  }
  return outline.modules.find((module) => isLessonUnlocked(module.id, progress) && !isLessonPassed(module.id, progress)) || null;
}

function recordQuizResult(lessonId, score) {
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

  const unlocked = evaluateAchievements(progress, {
    quizFinished: true,
    lessonId,
    score,
    previousBest,
    previouslyPassed,
    now: new Date(),
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

function markMissionComplete(lessonId) {
  const progress = loadProgress();
  const key = String(lessonId);
  if (progress.missions[key]) {
    return null;
  }
  const oldXp = getTotalXp(progress);
  const oldRank = getRankInfo(oldXp).current;
  progress.missions[key] = true;
  const unlocked = evaluateAchievements(progress, { now: new Date() });
  persistProgress(progress);
  const newXp = getTotalXp(progress);
  const newRank = getRankInfo(newXp).current;
  announceUnlocks(unlocked, oldRank, newRank);
  showToast({
    type: "rank",
    icon: "📻",
    title: "Mission complete",
    body: `+${newXp - oldXp} XP`,
  });
  return { xpGained: newXp - oldXp, totalXp: newXp };
}

function clearAllProgress() {
  progressCache = emptyProgress();
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
    version: 1,
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

function renderMarkdown(markdown) {
  let source = markdown.replace(/\r\n/g, "\n");
  source = stripFrontMatter(source);
  source = stripHtmlComments(source);
  source = stripQuizSection(source);
  source = source.trim();

  const codeBlocks = [];
  source = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang.trim();
    const normalized = code.replace(/\t/g, "    ").replace(/\n$/, "");
    const label = language
      ? `<figcaption class="code-label">${escapeHtml(language)}</figcaption>`
      : "";
    const classAttr = language ? ` class="language-${escapeHtml(language)}"` : "";
    const html = `<figure class="code-block">${label}<pre><code${classAttr}>${escapeHtml(normalized)}</code></pre></figure>`;
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
  return `<pre><code>${escapeHtml(String(example).replace(/\t/g, "    "))}</code></pre>`;
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
      <p class="lessons-passed">Lessons passed <strong>${passed} / ${TOTAL_MODULE_COUNT}</strong></p>
      ${continueHtml}
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
        <p>Your rank, XP, badges, and quiz scores are saved on this device only. Export a file to copy progress from your laptop to your phone, or the other way around.</p>
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
        return `<div class="quiz-question" data-answer="${question.answer}">
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

async function loadQuizData(module) {
  if (!module.quiz) {
    return null;
  }
  const response = await fetch(module.quiz);
  if (!response.ok) {
    return null;
  }
  return response.json();
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
    const result = recordQuizResult(lessonId, correct);
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
      ${renderMissionPanel(module)}
      ${pager(links.prev, links.next)}
    </article>
  `;
  bindQuiz(quiz);
  bindMissionButton(module);
  document.title = `${title} · GDScript Tutor`;
}

async function render() {
  const route = parseHash();
  refreshChrome(route);
  if (route.view === "home") {
    renderHome();
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

async function init() {
  registerServiceWorker();
  bindResetDialog();
  bindProgressSettings();
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
