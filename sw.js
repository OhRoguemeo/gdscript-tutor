/* Cache-first service worker for offline lessons. */
const CACHE_NAME = "gdscript-tutor-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./lessons/outline.json",
  "./lessons/OUTLINE.md",
  "./lessons/01-variables.md",
  "./lessons/02-data-types.md",
  "./lessons/03-conditionals.md",
  "./lessons/04-loops.md",
  "./lessons/05-functions.md",
  "./quizzes/lesson-01-variables.json",
  "./quizzes/lesson-02-data-types.json",
  "./quizzes/lesson-03-conditionals.json",
  "./quizzes/lesson-04-loops.json",
  "./quizzes/lesson-05-functions.json",
  "./assets/icons/icon.svg",
  "./README.md",
  "./starter-projects/README.md"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
