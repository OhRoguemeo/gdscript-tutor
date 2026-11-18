# GDScript Tutor

A responsive progressive web app that teaches **Godot 4 GDScript** in plain language. It is meant to be used on a PC, a laptop, or a phone, and it is hosted for free on GitHub Pages.

The tutor is being built **before** the Godot 4 first-person horror game, so every lesson is a skill that game will need: variables, data types, conditionals, loops, functions, signals, and a short capstone.

## What this version is (and is not)

- Lessons, quizzes, typing drills, Daily Review, and the cheat sheet run in the browser as static pages.
- There is **no in-browser code execution** and **no server-side sandbox**.
- The Signals practice and the Capstone mini-game are **game sections**: you download a starter Godot 4 project (`.zip`) and run it in the Godot editor. Those zip files will be added to `starter-projects/` in a later pass.

## File structure

```
gdscript-tutor/
  index.html                 # App shell (header, lesson nav, main, footer)
  styles.css                 # Dark, mobile-first layout
  app.js                     # Loads lessons, hash routing, bootcamp progress, service worker registration
  sw.js                      # Cache-first offline service worker
  manifest.webmanifest       # PWA name, colors, standalone display, icons
  README.md
  lessons/
    outline.json             # Lesson data the app loads
    OUTLINE.md               # The same outline, readable as a document
  quizzes/
    lesson-01-variables.json
    ...
  drills/
    lesson-01-variables.json # "Type the code" exercises for modules 1-5
    ...
  assets/
    icons/icon.svg
    icons/icon-192.png
    icons/icon-512.png
    icons/apple-touch-icon.png
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
- Addresses use hash routing, such as `#/` for the home page, `#/lesson/1` for Module 1, `#/review` for Daily Review, and `#/cheatsheet` for the syntax reference.
- Adding the site to a phone's home screen uses the web manifest and service worker, so the lessons can work offline after the first visit.

## Bootcamp progress

The tutor tracks a client-side bootcamp layer in `localStorage`:

- Quizzes award 25 XP per correct answer based on your **best** score, plus 50 XP for a perfect 4/4. Retakes only add the difference.
- Typing drills award 10 XP each, first completion only. Checking is forgiving about spacing, trailing semicolons, comments, and equivalent Godot 4 forms.
- Modules 6 and 7 have a **Mark mission complete** button worth 150 XP each (no quiz yet).
- A perfect run of all quizzes, drills, and missions is 1,300 XP, which is Cable-Level Operative.
- Rank thresholds: Recruit 0, Private 150, Corporal 300, Sergeant 450, Lieutenant 600, Captain 750, Operative 900, Cable-Level Operative 1,300.
- Lesson N+1 stays locked until you pass lesson N with at least 3/4. Lesson 1 is always open. Modules 6 and 7 unlock after you pass lesson 5.
- Missed quiz questions and drills go into a Leitner-style Daily Review (1, 3, 7, then 14 days).
- A daily streak counts any day you finish a quiz, a drill, or a review item.
- Ranks, achievements, drills, the review queue, and the streak live on this device. Use **Export progress** / **Import progress** to move a save between your laptop and phone.
- Older quiz best-score keys (`gdscript-tutor:best-score:lesson-*`) and version 1 progress files are migrated automatically.
