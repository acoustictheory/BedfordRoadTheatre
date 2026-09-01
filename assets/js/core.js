window.BRM = window.BRM || {};

(function (BRM) {
  const CONFIG = window.BRM_CONFIG;
  BRM.context = null;
  BRM.BUILD_ID = CONFIG.BUILD_ID || 'bedford-frontend';
  BRM.escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  BRM.titleCase = value => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  BRM.formatDate = value => value ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'America/Regina' }).format(new Date(value)) : '—';
  BRM.formatDateTime = value => value ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Regina' }).format(new Date(value)) : '—';
  BRM.initials = name => String(name || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  BRM.hasPermission = key => Boolean(BRM.context?.permissions?.includes('admin.all') || BRM.context?.permissions?.includes(key));
  BRM.isAdmin = () => {
    let stored = null;

    try {
      stored = JSON.parse(localStorage.getItem('brmContext') || 'null');
    } catch {}

    const context = BRM.context || stored || {};
    const value = context.isAdmin;
    const normalizedAdminFlag =
      value === true
      || String(value || '').toLowerCase() === 'true'
      || String(value || '').toUpperCase() === 'TRUE';

    return Boolean(
      normalizedAdminFlag
      || context.permissions?.includes('admin.all')
      || stored?.permissions?.includes('admin.all')
    );
  };

  BRM.toast = function (message, type = 'success') {
    let tray = document.querySelector('.toast-tray');
    if (!tray) { tray = document.createElement('div'); tray.className = 'toast-tray'; document.body.appendChild(tray); }
    const item = document.createElement('div');
    item.className = `toast toast-${type}`;
    item.textContent = message;
    tray.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => { item.classList.remove('show'); setTimeout(() => item.remove(), 250); }, 3600);
  };

  BRM.loading = function (target, message = 'Loading…') {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.innerHTML = `<div class="loading-state"><span class="spinner"></span><span>${BRM.escape(message)}</span></div>`;
  };

  BRM.empty = function (title, text, icon = '◇') {
    return `<div class="empty-state"><span class="empty-icon">${icon}</span><h3>${BRM.escape(title)}</h3><p>${BRM.escape(text)}</p></div>`;
  };

  BRM.openModal = function (html, options = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<section class="modal ${options.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true"><button class="modal-close icon-button" aria-label="Close">×</button>${html}</section>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 180); };
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.closeModal = close;
    return backdrop;
  };

  BRM.clearSession = function () {
    ['brmToken', 'brmContext'].forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('brmSnapshotDisabledUntil');
    BRM.context = null;
    BRM.clearSiteCache?.();
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.filter(key => key.startsWith('bedford-')).map(key => caches.delete(key))))
        .catch(() => {});
    }
  };

  BRM.setSession = function (token, context) {
    const previousToken = localStorage.getItem('brmToken');

    if (previousToken && previousToken !== token) {
      BRM.clearSiteCache?.();
    }

    localStorage.setItem('brmToken', token);
    localStorage.setItem('brmContext', JSON.stringify(context));
    BRM.context = context;
  };

  BRM.getStoredContext = function () {
    try { return JSON.parse(localStorage.getItem('brmContext') || 'null'); } catch { return null; }
  };

  BRM.mergeCurrentContext = function (incoming, stored) {
    if (typeof BRM.mergePortalContexts === 'function') {
      return BRM.mergePortalContexts(incoming, stored);
    }

    if (!incoming) return stored;
    if (!stored) return incoming;

    if (
      incoming.userId
      && stored.userId
      && String(incoming.userId) !== String(stored.userId)
    ) {
      return incoming;
    }

    // A live/server context is authoritative. Do not retain permissions or
    // department access that may have been revoked since the cached context.
    const permissions = [...new Set(incoming.permissions || [])];

    const storedAdmin =
      stored.isAdmin === true
      || String(stored.isAdmin || '').toLowerCase() === 'true'
      || stored.permissions?.includes('admin.all');

    const incomingAdmin =
      incoming.isAdmin === true
      || String(incoming.isAdmin || '').toLowerCase() === 'true'
      || incoming.permissions?.includes('admin.all');

    return {
      ...stored,
      ...incoming,
      profile: {
        ...(stored.profile || {}),
        ...(incoming.profile || {})
      },
      production: {
        ...(stored.production || {}),
        ...(incoming.production || {})
      },
      permissions,
      departmentIds: [...new Set((incoming.departmentIds || []).map(String))],
      departments: incoming.departments || [],
      isAdmin: Boolean(
        incomingAdmin
        || permissions.includes('admin.all')
      )
    };
  };

  BRM.applyTheme = function (theme, save = true) {
    const valid = CONFIG.THEMES.map(t => t.id);
    const chosen = valid.includes(theme) ? theme : CONFIG.DEFAULT_THEME;
    document.documentElement.dataset.theme = chosen;
    if (save) localStorage.setItem('brmTheme', chosen);
    document.querySelectorAll('[data-theme-name]').forEach(el => { el.textContent = CONFIG.THEMES.find(t => t.id === chosen)?.name || chosen; });
  };

  BRM.cycleTheme = function () {
    const current = document.documentElement.dataset.theme || CONFIG.DEFAULT_THEME;
    const index = CONFIG.THEMES.findIndex(t => t.id === current);
    BRM.applyTheme(CONFIG.THEMES[(index + 1) % CONFIG.THEMES.length].id);
    BRM.toast(`Theme: ${CONFIG.THEMES[(index + 1) % CONFIG.THEMES.length].name}`, 'info');
  };

  BRM.themeMenu = function () {
    return `<div class="theme-menu">${CONFIG.THEMES.map(t => `<button type="button" data-set-theme="${t.id}"><span class="theme-swatch theme-${t.id}"></span>${BRM.escape(t.name)}</button>`).join('')}</div>`;
  };

  function navItem(href, label, icon, key) {
    const active = document.body.dataset.page === key ? 'active' : '';
    return `<a class="nav-link ${active}" href="${href}"><span>${icon}</span><span>${label}</span></a>`;
  }

  function hasAnyPermission(...keys) {
    return BRM.isAdmin() || keys.some(key => BRM.hasPermission(key));
  }

  BRM.canAccessPage = function (page = document.body.dataset.page, context = BRM.context) {
    if (!context) return false;
    if (page === 'admin' || page === 'recruitment-review') return BRM.isAdmin();
    if (page === 'journal-review') return hasAnyPermission('journal.review');
    if (page === 'blocking') return hasAnyPermission('blocking.edit', 'blocking.manage', 'blocking.audit');

    const department = document.body.dataset.department;
    if (!department || BRM.isAdmin() || BRM.hasPermission('department.manage')) return true;
    return (context.departments || []).some(item => String(item.Slug) === String(department));
  };

  BRM.setSyncStatus = function (state, message) {
    document.querySelectorAll('[data-sync-status]').forEach(element => {
      element.dataset.state = state || 'ready';
      element.textContent = message || 'Portal ready';
      element.title = state === 'cached'
        ? 'This page loaded from the one-time portal cache.'
        : message || '';
    });
  };

  BRM.renderShell = function () {
    document.documentElement.dataset.brmBuild = BRM.BUILD_ID;
    const context = BRM.context;
    const profile = context.profile || {};
    const shell = document.querySelector('[data-app-shell]');
    if (!shell) return;
    const departmentLinks = (context.departments || [])
      .filter(dep => dep?.Slug && dep?.Name)
      .map(dep => navItem(`${encodeURIComponent(dep.Slug)}.html`, dep.Name, BRM.departmentIcon(dep.Slug), dep.Slug))
      .join('');
    const canReviewJournals = hasAnyPermission('journal.review');
    const canUseBlocking = hasAnyPermission('blocking.edit', 'blocking.manage', 'blocking.audit');
    const announcementLabel = BRM.hasPermission('announcement.manage') ? 'Manage Announcements' : 'Announcements';
    const scheduleLabel = BRM.hasPermission('event.manage') ? 'Manage Schedule' : 'Schedule & Calls';
    const resourcesLabel = BRM.hasPermission('resources.manage') ? 'Manage Resources' : 'Resources';
    shell.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <a class="brand-lockup" href="dashboard.html">
          <span class="brand-mark"><b>B</b><i>R</i></span>
          <span><strong>${BRM.escape(CONFIG.SITE_NAME)}</strong><small>${BRM.escape(context.production?.ShortTitle || context.production?.Title || '')}</small></span>
        </a>
        <nav class="main-nav" aria-label="Main navigation">
          ${BRM.isAdmin() ? `
            <p class="nav-label">Administrator portal</p>
            ${navItem('dashboard.html', 'Admin Dashboard', '◆', 'dashboard')}
            ${navItem('admin.html', 'People & Access', '⚙', 'admin')}
            ${navItem('recruitment-review.html', 'Auditions & Interest', '★', 'recruitment-review')}
            ${navItem('journal-review.html', 'Journal Review', '◉', 'journal-review')}
            ${navItem('announcements.html', 'Manage Announcements', '!', 'announcements')}
            ${navItem('schedule.html', 'Manage Schedule', '◷', 'schedule')}
            ${navItem('resources.html', 'Manage Resources', '▤', 'resources')}
            <p class="nav-label">Production tools</p>
            ${navItem('tasks.html', 'All Tasks', '✓', 'tasks')}
            ${navItem('blocking-viewer.html', 'Blocking Viewer', '▶', 'blocking-viewer')}
            ${navItem('blocking.html', 'Blocking Studio', '⌖', 'blocking')}
            ${navItem('journal.html', 'Private Journal', '✎', 'journal')}
            ${navItem('tracks.html', 'Music & Tracks', '♪', 'tracks')}
            ${navItem('directory.html', 'Company Directory', '◎', 'directory')}
          ` : `
            <p class="nav-label">Your portal</p>
            ${navItem('dashboard.html', 'Dashboard', '⌂', 'dashboard')}
            ${navItem('schedule.html', scheduleLabel, '◷', 'schedule')}
            ${navItem('tasks.html', 'My Tasks', '✓', 'tasks')}
            ${navItem('journal.html', 'Private Journal', '✎', 'journal')}
            ${navItem('blocking-viewer.html', 'Blocking Viewer', '▶', 'blocking-viewer')}
            ${canReviewJournals ? navItem('journal-review.html', 'Journal Review', '◉', 'journal-review') : ''}
            ${canUseBlocking ? navItem('blocking.html', 'Blocking Studio', '⌖', 'blocking') : ''}
            ${navItem('announcements.html', announcementLabel, '!', 'announcements')}
            ${navItem('tracks.html', 'Music & Tracks', '♪', 'tracks')}
            ${navItem('resources.html', resourcesLabel, '▤', 'resources')}
            ${navItem('directory.html', 'Company Directory', '◎', 'directory')}
          `}
          ${(context.departments || []).length
            ? `<p class="nav-label">${BRM.isAdmin() ? 'All departments' : 'Your departments'}</p>${departmentLinks}`
            : ''}
        </nav>
        <div class="sidebar-foot">
          <a class="profile-chip" href="profile.html">
            ${BRM.avatar(profile.DisplayName, profile.PhotoURL)}
            <span>
              <strong>${BRM.escape(profile.DisplayName || context.username)}</strong>
              <small>${BRM.isAdmin() ? '◆ Full Administrator' : 'View profile'}</small>
            </span>
          </a>
          <button class="button button-ghost button-block" data-logout>Sign out</button>
        </div>
      </aside>
      <div class="app-frame">
        <header class="topbar">
          <button class="icon-button mobile-menu" data-menu-toggle aria-label="Open menu">☰</button>
          <div class="topbar-production"><strong>${BRM.escape(context.production?.Title || 'Production')}</strong><span>${BRM.escape(context.production?.SchoolYear || '')}</span></div>
          <div class="topbar-actions">
            ${BRM.isAdmin() ? '<a class="badge admin-topbar-badge" href="admin.html">◆ Full Administrator</a>' : ''}
            <span class="badge portal-sync-status" data-sync-status data-state="ready">Portal ready</span>
            <div class="theme-picker"><button class="button button-quiet" data-theme-toggle><span>◐</span><span data-theme-name></span></button><div class="theme-popover">${BRM.themeMenu()}</div></div>
            <a class="avatar-link" href="profile.html">${BRM.avatar(profile.DisplayName, profile.PhotoURL, 'small')}</a>
          </div>
        </header>
        <main class="app-main" id="app-main"></main>
      </div>`;
    BRM.bindShell();
  };

  const profilePhotoObjectUrls = new Map();
  const profilePhotoLoads = new Map();

  BRM.extractProfilePhotoFileId = function (photoUrl) {
    const value = String(photoUrl || '').trim();
    if (!value) return '';

    if (value.startsWith('drivefile:')) {
      return value.slice('drivefile:'.length);
    }

    const idMatch = value.match(/[?&]id=([^&#]+)/i);
    if (idMatch) return decodeURIComponent(idMatch[1]);

    const drivePathMatch = value.match(/\/d\/([^/]+)/i);
    if (drivePathMatch) return drivePathMatch[1];

    return '';
  };

  function profilePhotoCacheName() {
    const userId = BRM.getStoredContext?.()?.userId || 'anonymous';
    return `bedford-profile-photos-v20-${userId}`;
  }

  function profilePhotoCacheRequest(fileId) {
    return new Request(
      `${location.origin}/__brm_profile_photo__/${encodeURIComponent(fileId)}`
    );
  }

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  function displayProfilePhoto(image, objectUrl) {
    const avatar = image.closest('[data-brm-avatar]');
    const fallback = avatar?.querySelector('[data-brm-photo-fallback]');

    image.addEventListener('load', () => {
      image.hidden = false;
      if (fallback) fallback.hidden = true;
    }, { once: true });

    image.addEventListener('error', () => {
      image.hidden = true;
      if (fallback) fallback.hidden = false;
    }, { once: true });

    image.src = objectUrl;
  }

  async function readCachedProfilePhoto(fileId) {
    if (profilePhotoObjectUrls.has(fileId)) {
      return profilePhotoObjectUrls.get(fileId);
    }

    if (!('caches' in window)) return '';

    try {
      const cache = await caches.open(profilePhotoCacheName());
      const response = await cache.match(profilePhotoCacheRequest(fileId));

      if (!response) return '';

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      profilePhotoObjectUrls.set(fileId, objectUrl);
      return objectUrl;
    } catch (error) {
      return '';
    }
  }

  BRM.cacheProfilePhoto = async function (fileId, dataUrl) {
    if (!fileId || !dataUrl) return '';

    const blob = await dataUrlToBlob(dataUrl);
    const existing = profilePhotoObjectUrls.get(fileId);

    if (existing) {
      try { URL.revokeObjectURL(existing); } catch (error) {}
    }

    const objectUrl = URL.createObjectURL(blob);
    profilePhotoObjectUrls.set(fileId, objectUrl);

    if ('caches' in window) {
      try {
        const cache = await caches.open(profilePhotoCacheName());
        await cache.put(
          profilePhotoCacheRequest(fileId),
          new Response(blob, {
            headers: {
              'Content-Type': blob.type || 'image/jpeg',
              'Cache-Control': 'private, max-age=31536000'
            }
          })
        );
      } catch (error) {}
    }

    return objectUrl;
  };

  async function fetchProfilePhotoObjectUrl(fileId) {
    const cached = await readCachedProfilePhoto(fileId);
    if (cached) return cached;

    if (profilePhotoLoads.has(fileId)) {
      return profilePhotoLoads.get(fileId);
    }

    const request = (async () => {
      const result = await BRM.api(
        'profilePhotoData',
        { fileId },
        { noCache: true }
      );

      return BRM.cacheProfilePhoto(fileId, result.dataUrl);
    })();

    profilePhotoLoads.set(fileId, request);

    try {
      return await request;
    } finally {
      profilePhotoLoads.delete(fileId);
    }
  }

  BRM.hydrateProfilePhotos = async function (root = document) {
    const images = [
      ...(root.matches?.('[data-brm-profile-photo]')
        ? [root]
        : []),
      ...root.querySelectorAll?.('[data-brm-profile-photo]')
        || []
    ];

    images.forEach(async image => {
      if (image.dataset.brmPhotoStarted === 'true') return;
      image.dataset.brmPhotoStarted = 'true';

      const fileId = image.dataset.brmPhotoId || '';
      const directUrl = image.dataset.brmPhotoUrl || '';

      if (!fileId) {
        if (directUrl) displayProfilePhoto(image, directUrl);
        return;
      }

      try {
        const objectUrl = await fetchProfilePhotoObjectUrl(fileId);
        if (objectUrl) displayProfilePhoto(image, objectUrl);
      } catch (error) {
        console.warn('Profile photo could not be loaded:', error);

        // Older uploads may still have a public Drive URL. Try it only as a
        // fallback after authenticated loading fails.
        if (directUrl && !directUrl.startsWith('drivefile:')) {
          displayProfilePhoto(image, directUrl);
        }
      }
    });
  };

  BRM.avatar = function (name, photoUrl, size = '') {
    const cls = `avatar ${size ? `avatar-${size}` : ''}`;
    const initials = BRM.escape(BRM.initials(name));
    const value = String(photoUrl || '').trim();

    if (!value) {
      return `<span class="${cls}">${initials}</span>`;
    }

    const fileId = BRM.extractProfilePhotoFileId(value);

    return `
      <span class="${cls}" data-brm-avatar>
        <span data-brm-photo-fallback style="grid-area:1/1">${initials}</span>
        <img
          hidden
          data-brm-profile-photo
          data-brm-photo-id="${BRM.escape(fileId)}"
          data-brm-photo-url="${BRM.escape(value)}"
          style="grid-area:1/1"
          alt=""
        >
      </span>
    `;
  };

  function startProfilePhotoObserver() {
    BRM.hydrateProfilePhotos(document);

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            BRM.hydrateProfilePhotos(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      startProfilePhotoObserver,
      { once: true }
    );
  } else {
    startProfilePhotoObserver();
  }

  BRM.departmentIcon = function (slug) {
    return ({ 'stage-management':'▣', ensemble:'♫', 'principal-cast':'★', 'pit-orchestra':'♬', props:'⚒', sets:'▰', costumes:'♛', lighting:'☀', sound:'◖', publicity:'◉', 'front-of-house':'▧', directing:'◆', administration:'⚙' })[slug] || '◇';
  };

  BRM.bindShell = function () {
    document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', e => { e.stopPropagation(); document.querySelector('.theme-picker')?.classList.toggle('open'); });
    document.querySelectorAll('[data-set-theme]').forEach(btn => btn.addEventListener('click', () => { BRM.applyTheme(btn.dataset.setTheme); document.querySelector('.theme-picker')?.classList.remove('open'); }));
    document.querySelector('[data-logout]')?.addEventListener('click', async () => {
      try { await BRM.api('logout'); } catch {}
      try { await BRM.clearSiteCache?.(); } catch {}
      BRM.clearSession();
      location.href = 'login.html';
    });
    document.addEventListener('click', () => document.querySelector('.theme-picker')?.classList.remove('open'));
  };

  BRM.initPrivatePage = async function (render) {
    BRM.applyTheme(localStorage.getItem('brmTheme') || CONFIG.DEFAULT_THEME, false);

    if (!localStorage.getItem('brmToken') && !BRM.isDemo()) {
      location.href = 'login.html';
      return;
    }

    const stored = BRM.getStoredContext();

    if (stored) {
      BRM.context = stored;
      BRM.applyTheme(
        localStorage.getItem('brmTheme')
          || stored.profile?.Theme
          || stored.production?.DefaultTheme
          || CONFIG.DEFAULT_THEME,
        false
      );
      BRM.renderShell();
      BRM.setSyncStatus('cached', 'Opening…');
    }

    try {
      let context = stored;

      if (BRM.isDemo()) {
        const result = await BRM.api('validateSession');
        context = result.context;
      } else {
        const snapshotDisabledUntil = Number(
          sessionStorage.getItem('brmSnapshotDisabledUntil') || 0
        );

        if (
          typeof BRM.ensureSiteSnapshot === 'function'
          && Date.now() >= snapshotDisabledUntil
        ) {
          try {
            const snapshot = await BRM.ensureSiteSnapshot();
            context = BRM.mergeCurrentContext(snapshot?.context, stored);
          } catch (snapshotError) {
            if (['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(snapshotError.code)) {
              throw snapshotError;
            }

            console.warn(
              'The one-request portal snapshot failed. Falling back to direct page requests.',
              snapshotError
            );

            sessionStorage.setItem(
              'brmSnapshotDisabledUntil',
              String(Date.now() + 5 * 60 * 1000)
            );

            BRM.setSyncStatus('offline', 'Direct mode');
          }
        }

        if (!context) {
          const result = await BRM.api(
            'validateSession',
            {},
            { forceNetwork: true, noCache: true }
          );
          context = result.context;
        }
      }

      context = BRM.mergeCurrentContext(context, stored);
      BRM.context = context;
      localStorage.setItem('brmContext', JSON.stringify(context));

      if (context.mustChangePassword && document.body.dataset.page !== 'profile') {
        location.href = 'profile.html?password=required';
        return;
      }

      BRM.applyTheme(
        localStorage.getItem('brmTheme')
          || context.profile?.Theme
          || context.production?.DefaultTheme
          || CONFIG.DEFAULT_THEME,
        false
      );

      BRM.renderShell();
      BRM.setSyncStatus('ready', 'Portal ready');

      if (!BRM.canAccessPage(document.body.dataset.page, context)) {
        BRM.toast('You do not have access to that workspace.', 'error');
        location.href = 'dashboard.html';
        return;
      }

      await render(context);
    } catch (error) {
      const hasUsableStoredContext = Boolean(stored && localStorage.getItem('brmToken'));

      if (hasUsableStoredContext && !['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(error.code)) {
        BRM.context = stored;
        BRM.renderShell();
        BRM.setSyncStatus('offline', 'Using saved data');

        try {
          await render(stored);
          BRM.toast('The server could not refresh, so saved portal data is being used.', 'info');
          return;
        } catch {}
      }

      if (['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(error.code)) {
        BRM.clearSession();

        if (!BRM.isDemo()) {
          location.href = `login.html?reason=${encodeURIComponent(error.message)}`;
          return;
        }
      }

      if (BRM.isDemo()) {
        BRM.toast(error.message, 'error');
        return;
      }

      const appMain = document.querySelector('#app-main');
      if (appMain) {
        appMain.innerHTML = `
          <div class="alert alert-error">
            <strong>This page could not refresh.</strong><br>
            ${BRM.escape(error.message || 'Unknown portal error')}
            <div style="margin-top:12px">
              <button class="button button-secondary" onclick="location.reload()">Try again</button>
            </div>
          </div>
        `;
      }
    }
  };

  BRM.initPublicPage = function () {
    BRM.applyTheme(localStorage.getItem('brmTheme') || CONFIG.DEFAULT_THEME, false);
    document.querySelectorAll('[data-theme-cycle]').forEach(btn => btn.addEventListener('click', BRM.cycleTheme));
    document.querySelectorAll('[data-set-theme]').forEach(btn => btn.addEventListener('click', () => BRM.applyTheme(btn.dataset.setTheme)));
  };

  window.addEventListener('brm:sync-status', event => {
    BRM.setSyncStatus(event.detail?.state, event.detail?.message);
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.dataset.private) BRM.initPublicPage();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register(`service-worker.js?v=${encodeURIComponent(BRM.BUILD_ID)}`).catch(error => {
        console.warn('Offline support could not start:', error);
      });
    }
  });
})(window.BRM);
