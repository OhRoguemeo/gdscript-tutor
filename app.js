/* GDScript Tutor — loads outline.json, hash routing, service worker. */

const OUTLINE_URL = "lessons/outline.json";

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

function formatInlineCode(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderCode(example) {
  if (!example) {
    return "";
  }
  return `<pre><code>${escapeHtml(example)}</code></pre>`;
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

  // prevModule is reserved so a later pass can jump from first subtopic to the previous module's last subtopic.
  void prevModule;
  return { prev, next };
}

async function renderQuiz(module) {
  if (!module.quiz) {
    return "";
  }
  try {
    const response = await fetch(module.quiz);
    if (!response.ok) {
      return "";
    }
    const quiz = await response.json();
    const questions = (quiz.questions || [])
      .map((question, qIndex) => {
        const choices = question.choices
          .map((choice, cIndex) => {
            return `<li>
              <button type="button" data-quiz="${qIndex}" data-choice="${cIndex}">
                ${escapeHtml(choice)}
              </button>
            </li>`;
          })
          .join("");
        return `<div class="quiz-question" data-answer="${question.answer}" data-explain="${escapeHtml(question.explain)}">
          <p><strong>${qIndex + 1}.</strong> ${escapeHtml(question.prompt)}</p>
          <ul class="quiz-choices">${choices}</ul>
          <p class="quiz-explain" hidden></p>
        </div>`;
      })
      .join("");
    return `<section class="quiz" aria-label="Practice quiz">
      <h2>${escapeHtml(quiz.title)}</h2>
      <p>This is a short check on Module ${module.id}. It runs in this page; it does not execute GDScript.</p>
      ${questions}
    </section>`;
  } catch (error) {
    console.warn("Quiz failed to load:", error);
    return "";
  }
}

function bindQuiz() {
  main.querySelectorAll(".quiz-question").forEach((block) => {
    const answer = Number(block.getAttribute("data-answer"));
    const explain = block.getAttribute("data-explain");
    const explainEl = block.querySelector(".quiz-explain");
    block.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        block.querySelectorAll("button").forEach((item) => {
          item.disabled = true;
          item.classList.remove("is-correct", "is-wrong");
        });
        const choice = Number(button.getAttribute("data-choice"));
        button.classList.add(choice === answer ? "is-correct" : "is-wrong");
        const correctBtn = block.querySelector(`[data-choice="${answer}"]`);
        if (correctBtn) {
          correctBtn.classList.add("is-correct");
        }
        explainEl.hidden = false;
        explainEl.textContent = explain;
      });
    });
  });
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
  const sections = module.subtopics.map((sub) => renderSubtopicBlock(module, sub)).join("");
  const quizHtml = await renderQuiz(module);
  main.innerHTML = `
    <article class="content">
      <p class="kicker">Module ${module.id}</p>
      <h1>${escapeHtml(module.title)}</h1>
      <div class="meta-row">
        <span class="badge badge-godot">Godot 4 · GDScript</span>
        ${isStarter(module) ? '<span class="badge badge-download">Download a Godot project</span>' : ""}
      </div>
      <p class="lead">${escapeHtml(module.summary)}</p>
      ${starterCallout}
      <p>${escapeHtml(module.horrorHook)}</p>
      ${sections}
      ${quizHtml}
      ${pager(links.prev, links.next)}
    </article>
  `;
  bindQuiz();
  document.title = `${module.title} · GDScript Tutor`;
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
