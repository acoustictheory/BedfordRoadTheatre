const CACHE = 'bedford-frontend-20260901-2';

const COMPLETE_SHELL = [
  "./",
  "404.html",
  "admin.html",
  "book-an-audition.html",
  "interested-in-musical.html",
  "recruitment-review.html",
  "announcements.html",
  "blocking.html",
  "blocking-viewer.html",
  "costumes.html",
  "dashboard.html",
  "directing.html",
  "directory.html",
  "ensemble.html",
  "front-of-house.html",
  "index.html",
  "journal-review.html",
  "journal.html",
  "lighting.html",
  "login.html",
  "pit-orchestra.html",
  "principal-cast.html",
  "profile.html",
  "props.html",
  "publicity.html",
  "resources.html",
  "schedule.html",
  "sets.html",
  "sound.html",
  "stage-management.html",
  "tasks.html",
  "tracks.html",
  "manifest.webmanifest",
  "assets/style.css",
  "assets/recruitment.css",
  "assets/blocking-hub.css",
  "assets/blocking-viewer.css",
  "assets/costume-hub.css",
  "assets/dashboard.css",
  "assets/journal.css",
  "assets/props-hub.css",
  "assets/scenic-hub.css",
  "assets/config.js",
  "assets/js/api.js",
  "assets/js/core.js",
  "assets/js/notes.js",
  "assets/js/pages/admin.js",
  "assets/js/pages/recruitment.js",
  "assets/js/pages/recruitment-review.js",
  "assets/js/pages/announcements.js",
  "assets/js/pages/blocking-hub.js",
  "assets/js/pages/blocking-viewer.js",
  "assets/js/pages/costume-hub.js",
  "assets/js/pages/dashboard.js",
  "assets/js/pages/department.js",
  "assets/js/pages/directory.js",
  "assets/js/pages/journal-review.js",
  "assets/js/pages/journal.js",
  "assets/js/pages/login.js",
  "assets/js/pages/profile.js",
  "assets/js/pages/resources.js",
  "assets/js/pages/props-hub.js",
  "assets/js/pages/scenic-hub.js",
  "assets/js/pages/schedule.js",
  "assets/js/pages/tasks.js",
  "assets/js/pages/tracks.js",
  "assets/images/favicon.svg",
  "assets/images/descendants-banner.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        for (const path of COMPLETE_SHELL) {
          try {
            const response = await fetch(path, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(path, response.clone());
            }
          } catch (error) {
            console.warn(`Could not precache ${path}:`, error);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) return cached;

    if (request.mode === 'navigate') {
      return cache.match('index.html');
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Offline'
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const response = await networkPromise;
  return response || new Response('Offline', {
    status: 503,
    statusText: 'Offline'
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCodeOrPage =
    request.mode === 'navigate'
    || /\.(?:html|js|css|webmanifest)$/i.test(url.pathname);

  event.respondWith(
    isCodeOrPage
      ? networkFirst(request)
      : staleWhileRevalidate(request)
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
  }
});
