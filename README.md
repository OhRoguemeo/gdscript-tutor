# GDScript Tutor

A responsive progressive web app that teaches **Godot 4 GDScript** in plain language. It is meant to be used on a PC, a laptop, or a phone, and it will later be hosted for free on GitHub Pages.

The tutor is being built **before** the Godot 4 first-person horror game, so every lesson is a skill that game will need: variables, data types, conditionals, loops, functions, signals, and a short capstone.

## What version 1 is (and is not)

- Lessons and quizzes run in the browser as static pages.
- There is **no in-browser code execution** and **no server-side sandbox**.
- The Signals practice and the Capstone mini-game are **game sections**: you download a starter Godot 4 project (`.zip`) and run it in the Godot editor. Those zip files will be added to `starter-projects/` in a later pass.
- This copy lives on the shared computer. **GitHub push and GitHub Pages are step two, done on the main PC.** Do not initialize git or enable Pages from here.

## File structure

```
gdscript-tutor/
  index.html                 # App shell (header, lesson nav, main, footer)
  styles.css                 # Dark, mobile-first layout
  app.js                     # Loads lessons, hash routing, bootcamp progress, service worker registration
  sw.js                      # Cache-first offline service worker
  manifest.webmanifest       # PWA name, colors, standalone display, icon
  README.md
  lessons/
    outline.json             # Lesson data the app loads
    OUTLINE.md               # The same outline, readable as a document
  quizzes/
    lesson-01-variables.json # Sample quiz for Module 1
  assets/
    icons/icon.svg
    img/                     # Reserved for future images
  starter-projects/
    README.md                # Plan for the downloadable Godot 4 zips
```

## Preview it locally

From this folder, start a simple local server (do not open `index.html` as a `file://` page if you want the lesson data and service worker to load correctly):

```bash
python3 -m http.server
```

Then open http://127.0.0.1:8000 in a browser. On a phone or another computer on the same network, use this computer's local IP address and port 8000.

## How the app works

- The lesson list in the sidebar (a menu button on small screens) and the main content both come from `lessons/outline.json`.
- Addresses use hash routing, such as `#/` for the home page, `#/lesson/1` for Module 1, and `#/lesson/1/3` for a single subtopic.
- Adding the site to a phone's home screen uses the web manifest and service worker, so the lessons can work offline after the first visit.

## v1 plan

Game sections use downloadable starter Godot projects, with no sandbox. GitHub push and Pages wait for step two on the main PC.


## Bootcamp progress

The tutor tracks a client-side bootcamp layer in `localStorage`:

- Quizzes award 25 XP per correct answer based on your **best** score, plus 50 XP for a perfect 4/4. Retakes only add the difference.
- Modules 6 and 7 have a **Mark mission complete** button worth 150 XP each (no quiz yet).
- Lesson N+1 stays locked until you pass lesson N with at least 3/4. Lesson 1 is always open. Modules 6 and 7 unlock after you pass lesson 5.
- Ranks, achievements, and a home dashboard live on this device. Use **Export progress** / **Import progress** to move a save between your laptop and phone.
- Older quiz best-score keys (`gdscript-tutor:best-score:lesson-*`) are migrated automatically.
