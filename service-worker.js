importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCj9z5BuDIWW0JcuK2k7EwiWpe8xRI4vRY', authDomain: 'brpa-digital-hub-dev.firebaseapp.com',
  projectId: 'brpa-digital-hub-dev', storageBucket: 'brpa-digital-hub-dev.firebasestorage.app',
  messagingSenderId: '499470162310', appId: '1:499470162310:web:34dcd8a4a54e501137b407'
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  return self.registration.showNotification(data.senderName || 'Bedford Community', {
    body: data.body || 'You have a new message.', icon: '/assets/images/icons/icon-192.png',
    badge: '/assets/images/icons/icon-192.png', tag: `bedford-community-${data.conversationId || 'message'}`,
    data: { url: `/communications.html?conversation=${encodeURIComponent(data.conversationId || '')}` }
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/communications.html', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => client.url.startsWith(self.location.origin));
    return existing ? existing.navigate(target).then(client => client.focus()) : clients.openWindow(target);
  }));
});

const BUILD_ID = 'bedford-frontend-20260907-edit-members4';
const SHELL_CACHE = `bedford-shell-${BUILD_ID}`;
const RUNTIME_CACHE = 'bedford-runtime-v1';

const COMPLETE_SHELL = [
  "./",
  "404.html",
  "admin.html",
  "scoreflow-sync.html",
  "casting.html",
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
  "production-library.html",
  "schedule.html",
  "sets.html",
  "sound.html",
  "storage.html",
  "stage-management.html",
  "tasks.html",
  "tracks.html",
  "manifest.webmanifest",
  "assets/style.css",
  "assets/scoreflow-sync.css",
  "assets/recruitment.css",
  "assets/blocking-hub.css",
  "assets/blocking-viewer.css",
  "assets/costume-hub.css",
  "assets/calendar.css",
  "assets/dashboard.css",
  "assets/journal.css",
  "assets/props-hub.css",
  "assets/scenic-hub.css",
  "assets/config.js",
  "assets/js/api.js",
  "assets/js/core.js",
  "assets/js/firebase-auth.js",
  "assets/js/firebase-data.js",
  "assets/js/notes.js",
  "assets/js/pages/admin.js",
  "assets/js/pages/scoreflow-sync.js",
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
  "assets/js/pages/production-library.js",
  "assets/js/pages/props-hub.js",
  "assets/js/pages/scenic-hub.js",
  "assets/js/pages/schedule.js",
  "assets/js/pages/storage.js",
  "assets/js/pages/tasks.js",
  "assets/js/pages/tracks.js",
  "assets/images/favicon.svg",
  "assets/images/favicon.png",
  "assets/images/bedford-road-theatre-logo.png",
  "assets/images/bedford-road-theatre-logo-192.png",
  "assets/images/icons/icon-192.png",
  "assets/images/icons/icon-512.png",
  "assets/images/icons/maskable-192.png",
  "assets/images/icons/maskable-512.png",
  "assets/images/icons/apple-touch-icon.png",
  "assets/images/chat-backgrounds/royal-villain.jpg",
  "assets/images/chat-backgrounds/enchanted-stage.jpg",
  "assets/images/chat-backgrounds/dragon-fire.jpg",
  "assets/images/chat-backgrounds/auradon-castle.jpg",
  "assets/images/chat-backgrounds/isle-graffiti.jpg",
  "assets/images/chat-backgrounds/magic-mirror.jpg",
  "assets/images/chat-backgrounds/spotlight-score.jpg",
  "assets/images/chat-backgrounds/red-curtain.jpg",
  "assets/images/chat-backgrounds/spring-opening-night.jpg",
  "assets/images/chat-backgrounds/summer-showtime.jpg",
  "assets/images/chat-backgrounds/autumn-playbill.jpg",
  "assets/images/chat-backgrounds/winter-gala.jpg",
  "assets/images/chat-backgrounds/symphony-night.jpg",
  "assets/images/chat-backgrounds/piano-nocturne.jpg",
  "assets/images/chat-backgrounds/jazz-stage.jpg",
  "assets/images/chat-backgrounds/choral-harmony.jpg",
  "assets/images/chat-avatars/musical-theatre.jpg",
  "assets/images/chat-avatars/theatre-arts.jpg",
  "assets/images/chat-avatars/choreography.jpg",
  "assets/images/chat-avatars/featured-dancers.jpg",
  "assets/images/chat-avatars/pit-orchestra.jpg",
  "assets/images/chat-avatars/stage-crew.jpg",
  "assets/images/chat-avatars/scenic-painting.jpg",
  "assets/images/chat-avatars/hair-makeup.jpg",
  "assets/images/chat-avatars/projections-video.jpg",
  "assets/images/chat-avatars/photography-videography.jpg",
  "assets/images/chat-avatars/tickets-box-office.jpg",
  "assets/images/chat-avatars/wardrobe-crew.jpg",
  "assets/images/chat-avatars/lights-crew.jpg",
  "assets/images/chat-avatars/props-crew.jpg",
  "assets/images/chat-avatars/costume-crew.jpg",
  "assets/images/chat-avatars/set-design.jpg",
  "assets/images/chat-avatars/sound-crew.jpg",
  "assets/images/chat-avatars/stage-management.jpg",
  "assets/images/chat-avatars/front-of-house.jpg",
  "assets/images/chat-avatars/pr-marketing.jpg",
  "assets/vendor/fflate.min.js"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
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
      .then(keys => Promise.all(keys
        .filter(key => (key.startsWith('bedford-shell-') || key.startsWith('bedford-frontend-')) && key !== SHELL_CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);

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
  const cache = await caches.open(RUNTIME_CACHE);
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

  // Installers are large streaming downloads. Let the browser handle them
  // directly instead of cloning them into the runtime cache first.
  if (/\.apk$/i.test(url.pathname)) return;

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

  if (event.data === 'CLEAR_SHELL_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('bedford-shell-') || key.startsWith('bedford-frontend-')).map(key => caches.delete(key))
    )));
  }

  if (event.data === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});
