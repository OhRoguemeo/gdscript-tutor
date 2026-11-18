/* GDScript Tutor — loads outline.json, hash routing, service worker. */

const OUTLINE_URL = "lessons/outline.json";
const BEST_SCORE_KEY_PREFIX = "gdscript-tutor:best-score:lesson-";

const navList = document.getElementById("lesson-list");
const nav = document.getElementById("site-nav");
const navToggle = document.getElementById("nav-toggle");
const navBackdrop = document.getElementById("nav-backdrop");
const main = document.getElementById("main");

let outline = null;

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

function renderNav(route) {
  const items = outline.modules.map((module) => {
    const moduleCurrent =
      route.view === "lesson" && route.moduleId === module.id && !route.subtopicId
        ? ' aria-current="page"'
        : "";
    const subs = module.subtopics
      .map((sub) => {
        const current =
          route.view === "lesson" &&
          route.moduleId === module.id &&
          route.subtopicId === sub.id
            ? ' aria-current="page"'
            : "";
        return `<li>
          <a href="#/lesson/${module.id}/${sub.id}"${current}>${escapeHtml(sub.title)}${starterBadge(sub)}</a>
        </li>`;
      })
      .join("");
    return `<li class="nav-module">
      <a href="#/lesson/${module.id}"${moduleCurrent}>${module.id}. ${escapeHtml(module.title)}${starterBadge(module)}</a>
      <ul class="subtopic-list">${subs}</ul>
    </li>`;
  }).join("");
  navList.innerHTML = items;
}

function renderHome() {
  const cards = outline.modules
    .map((module) => {
      const badge = isStarter(module)
        ? '<span class="badge badge-download">Download a Godot project</span>'
        : "";
      return `<a class="module-card" href="#/lesson/${module.id}">
        <h2>${module.id}. ${escapeHtml(module.title)} ${badge}</h2>
        <p>${escapeHtml(module.summary)}</p>
      </a>`;
    })
    .join("");

  main.innerHTML = `
    <article class="content">
      <p class="kicker">Godot 4 · GDScript</p>
      <h1>${escapeHtml(outline.title)}</h1>
      <p class="lead">${escapeHtml(outline.subtitle)}</p>
      <p>${escapeHtml(outline.notes.purpose)}</p>
      <div class="callout">
        <p>${escapeHtml(outline.notes.noSandbox)}</p>
      </div>
      <h2>Lesson outline</h2>
      <div class="module-grid">${cards}</div>
      <div class="callout callout-download">
        <p>${escapeHtml(outline.notes.starterProjects)}</p>
      </div>
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
  const nextLink = next
    ? `<a href="${next.href}">${escapeHtml(next.label)} →</a>`
    : "<span></span>";
  return `<nav class="pager" aria-label="Lesson pager">${prevLink}${nextLink}</nav>`;
}

function neighbors(module, subtopicId) {
  const modules = outline.modules;
  const moduleIndex = modules.findIndex((item) => item.id === module.id);

  if (!subtopicId) {
    const prevModule = modules[moduleIndex - 1];
    const nextModule = modules[moduleIndex + 1];
    return {
      prev: prevModule
        ? { href: `#/lesson/${prevModule.id}`, label: prevModule.title }
        : { href: "#/", label: "Home" },
      next: nextModule
        ? { href: `#/lesson/${nextModule.id}`, label: nextModule.title }
        : null,
    };
  }

  const index = module.subtopics.findIndex((item) => item.id === subtopicId);
  const prevSub = module.subtopics[index - 1];
  const nextSub = module.subtopics[index + 1];
  const prevModule = modules[moduleIndex - 1];
  const nextModule = modules[moduleIndex + 1];

  const prev = prevSub
    ? { href: `#/lesson/${module.id}/${prevSub.id}`, label: prevSub.title }
    : { href: `#/lesson/${module.id}`, label: module.title };
  const next = nextSub
    ? { href: `#/lesson/${module.id}/${nextSub.id}`, label: nextSub.title }
    : nextModule
      ? { href: `#/lesson/${nextModule.id}`, label: nextModule.title }
      : null;

  void prevModule;
  return { prev, next };
}

function bestScoreKey(lessonId) {
  return `${BEST_SCORE_KEY_PREFIX}${lessonId}`;
}

function readBestScore(lessonId) {
  try {
    const raw = localStorage.getItem(bestScoreKey(lessonId));
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    console.warn("Could not read saved quiz score:", error);
    return null;
  }
}

function writeBestScore(lessonId, score) {
  try {
    const current = readBestScore(lessonId);
    if (current === null || score > current) {
      localStorage.setItem(bestScoreKey(lessonId), String(score));
      return score;
    }
    return current;
  } catch (error) {
    console.warn("Could not save quiz score:", error);
    return score;
  }
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
    const best = writeBestScore(lessonId, correct);
    scoreEl.textContent = `You scored ${correct} out of ${total}. Your best is ${best} out of ${total}.`;
    results.hidden = false;
    updateBestLabel(best);
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
      </div>
      ${lessonBody}
      ${quizHtml}
      ${pager(links.prev, links.next)}
    </article>
  `;
  bindQuiz(quiz);
  document.title = `${title} · GDScript Tutor`;
}

async function render() {
  const route = parseHash();
  renderNav(route);
  if (route.view === "home") {
    renderHome();
  } else {
    await renderLesson(route.moduleId, route.subtopicId);
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  closeNav();
}

async function init() {
  registerServiceWorker();
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
    }
  });

  try {
    const response = await fetch(OUTLINE_URL);
    if (!response.ok) {
      throw new Error(`Could not load lessons (${response.status})`);
    }
    outline = await response.json();
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
