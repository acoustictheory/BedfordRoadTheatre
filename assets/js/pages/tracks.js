window.BRM_TRACK_PLAYER_BUILD = 'score-workspace-v17';

document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');

  main.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Synchronized rehearsal audio</span>
        <h1>Music &amp; tracks</h1>
        <p>
          Select a song, then move the fader between the guide vocal and practice track.
          Both files stay synchronized while you change speed, volume, or position.
        </p>
      </div>
    </div>

    <section class="panel track-score-panel" data-score-panel>
      <div class="track-score-head">
        <div><span class="eyebrow">Matching sheet music</span><h2 data-score-title>Select a song to open its score</h2><p data-score-copy>The score follows the same song number and title as the guide vocal and practice track.</p></div>
        <div class="page-actions"><a class="button button-primary" data-score-open href="#">Open in ScoreFlow</a></div>
      </div>
    </section>

    <div class="dual-track-layout">
      <section class="panel dual-track-studio" aria-label="Track player">
        <div class="dual-track-heading">
          <div>
            <span class="eyebrow">Now playing</span>
            <h2 data-current-title>Select a track</h2>
            <p data-current-subtitle>Choose a song from the playlist.</p>
          </div>
          <div class="dual-track-badges" data-current-badges></div>
        </div>

        <audio data-guide-audio preload="metadata"></audio>
        <audio data-practice-audio preload="metadata"></audio>

        <div class="dual-player-controls">
          <button type="button" class="icon-button dual-skip-button" data-previous aria-label="Previous track">⏮</button>
          <button type="button" class="button button-primary dual-main-play" data-play>▶ Play</button>
          <button type="button" class="button button-secondary" data-restart>↺ Restart</button>
          <button type="button" class="icon-button dual-skip-button" data-next aria-label="Next track">⏭</button>
          <span class="dual-player-time" data-time>0:00 / 0:00</span>
        </div>

        <div class="dual-player-status" data-player-status>
          The player privately loads both versions from Drive when a matching pair is available.
        </div>

        <div class="dual-control-group">
          <div class="dual-control-heading">
            <span>Guide Vocal</span>
            <strong data-blend-readout>Guide 100% · Practice 0%</strong>
            <span>Practice Track</span>
          </div>
          <input
            type="range"
            class="dual-fader"
            data-blend
            min="0"
            max="100"
            step="1"
            value="0"
            aria-label="Blend guide vocal and practice track"
          >
          <div class="dual-fader-shortcuts">
            <button type="button" class="button button-quiet button-small" data-blend-value="0">Guide only</button>
            <button type="button" class="button button-quiet button-small" data-blend-value="50">50 / 50</button>
            <button type="button" class="button button-quiet button-small" data-blend-value="100">Practice only</button>
          </div>
        </div>

        <div class="dual-control-grid">
          <div class="dual-control-group">
            <div class="dual-control-label">
              <span>Speed</span>
              <strong data-speed-readout>1.00×</strong>
            </div>
            <input type="range" data-speed min="0.50" max="1.25" step="0.05" value="1">
          </div>

          <div class="dual-control-group">
            <div class="dual-control-label">
              <span>Volume</span>
              <strong data-volume-readout>100%</strong>
            </div>
            <input type="range" data-volume min="0" max="1" step="0.01" value="1">
          </div>
        </div>

        <div class="dual-control-group">
          <div class="dual-control-label">
            <span>Progress</span>
            <strong data-progress-label>Drag to scrub</strong>
          </div>
          <input type="range" class="dual-progress" data-progress min="0" max="1000" step="1" value="0">
        </div>
      </section>

      <section class="panel dual-playlist-panel">
        <div class="toolbar">
          <div class="search-wrap">
            <input class="search-input" data-search placeholder="Search tracks">
          </div>
          <select class="search-input" data-pair-filter aria-label="Filter track pairs">
            <option value="all">All tracks</option>
            <option value="paired">Complete pairs</option>
            <option value="missing">Missing a version</option>
            <option value="guide">Has guide vocal</option>
            <option value="practice">Has practice track</option>
          </select>
        </div>
        <div class="dual-library-summary" data-library-summary></div>

        <div class="track-cache-panel" data-cache-panel>
          <div class="track-cache-heading">
            <div>
              <strong data-cache-title>Preparing offline track library</strong>
              <span data-cache-detail>Checking this browser for downloaded tracks…</span>
            </div>
            <span class="badge" data-cache-badge>0%</span>
          </div>

          <div
            class="track-cache-progress"
            role="progressbar"
            aria-label="Offline track download progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
            data-cache-progress
          >
            <span data-cache-progress-fill></span>
          </div>

          <div class="track-cache-actions">
            <button type="button" class="button button-quiet button-small" data-cache-start hidden>
              Download all tracks
            </button>
            <button type="button" class="button button-quiet button-small" data-cache-pause hidden>
              Pause download
            </button>
            <button type="button" class="button button-quiet button-small" data-cache-resume hidden>
              Resume download
            </button>
            <button type="button" class="button button-quiet button-small" data-cache-clear>
              Clear downloaded tracks
            </button>
          </div>
        </div>

        <div class="dual-track-list" data-track-list></div>
      </section>
    </div>

    <div data-notes-panel></div>
  `;

  const result = await BRM.api('tracks');
  const rawTracks = Array.isArray(result.data) ? result.data : [];
  const songs = pairTrackLibrary(rawTracks);

  const refs = {
    title: main.querySelector('[data-current-title]'),
    subtitle: main.querySelector('[data-current-subtitle]'),
    badges: main.querySelector('[data-current-badges]'),
    guide: main.querySelector('[data-guide-audio]'),
    practice: main.querySelector('[data-practice-audio]'),
    play: main.querySelector('[data-play]'),
    previous: main.querySelector('[data-previous]'),
    next: main.querySelector('[data-next]'),
    restart: main.querySelector('[data-restart]'),
    time: main.querySelector('[data-time]'),
    status: main.querySelector('[data-player-status]'),
    blend: main.querySelector('[data-blend]'),
    blendReadout: main.querySelector('[data-blend-readout]'),
    speed: main.querySelector('[data-speed]'),
    speedReadout: main.querySelector('[data-speed-readout]'),
    volume: main.querySelector('[data-volume]'),
    volumeReadout: main.querySelector('[data-volume-readout]'),
    progress: main.querySelector('[data-progress]'),
    progressLabel: main.querySelector('[data-progress-label]'),
    search: main.querySelector('[data-search]'),
    filter: main.querySelector('[data-pair-filter]'),
    list: main.querySelector('[data-track-list]'),
    summary: main.querySelector('[data-library-summary]'),
    scoreTitle: main.querySelector('[data-score-title]'),
    scoreCopy: main.querySelector('[data-score-copy]'),
    scoreOpen: main.querySelector('[data-score-open]'),
    scoreAppNote: main.querySelector('[data-score-app-note]'),
    cachePanel: main.querySelector('[data-cache-panel]'),
    cacheTitle: main.querySelector('[data-cache-title]'),
    cacheDetail: main.querySelector('[data-cache-detail]'),
    cacheBadge: main.querySelector('[data-cache-badge]'),
    cacheProgress: main.querySelector('[data-cache-progress]'),
    cacheProgressFill: main.querySelector('[data-cache-progress-fill]'),
    cacheStart: main.querySelector('[data-cache-start]'),
    cachePause: main.querySelector('[data-cache-pause]'),
    cacheResume: main.querySelector('[data-cache-resume]'),
    cacheClear: main.querySelector('[data-cache-clear]')
  };

  const state = {
    songs,
    currentIndex: -1,
    playing: false,
    timer: null,
    draggingProgress: false,
    masterVolume: 1,
    blend: 0,
    speed: 1,
    loadingPromise: null,
    loadGeneration: 0,
    libraryDownloadRunning: false,
    libraryDownloadPaused: false,
    libraryDownloadCancelled: false,
    cachedTrackIds: new Set(),
    cacheFailures: []
  };

  const audioBlobCache = new Map();
  const trackDownloadTasks = new Map();
  const AUDIO_CACHE_LIMIT = 6;
  const AUDIO_DB_NAME = 'bedford-musical-audio-v1';
  const AUDIO_DB_VERSION = 1;
  const AUDIO_STORE_NAME = 'tracks';
  const FULL_LIBRARY_WORKERS = 4;

  function cleanTrackTitle(value) {
    return String(value || '')
      .replace(/\.(mp3|m4a|wav|aac|ogg)$/i, '')
      .replace(/^\s*\d+\s*[-_.]?\s*/, '')
      .trim();
  }

  function normalizePairTitle(value) {
    return cleanTrackTitle(value)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function classifyTrack(track) {
    const type = String(track.TrackType || '').toLowerCase();
    if (type.includes('guide')) return 'guide';
    if (type.includes('practice')) return 'practice';
    return 'single';
  }

  function pairTrackLibrary(tracks) {
    const paired = new Map();
    const singles = [];

    tracks.forEach((track, originalIndex) => {
      const kind = classifyTrack(track);
      const order = Number(track.SortOrder);
      const hasOrder = Number.isFinite(order) && order < 9999;
      const title = cleanTrackTitle(track.Title);
      const key = hasOrder
        ? `order:${String(order).padStart(5, '0')}`
        : `title:${normalizePairTitle(title)}`;

      if (kind === 'single') {
        singles.push({
          key: `single:${track.TrackID || originalIndex}`,
          sortOrder: hasOrder ? order : 9999,
          title,
          guide: null,
          practice: null,
          single: track,
          originalIndex
        });
        return;
      }

      if (!paired.has(key)) {
        paired.set(key, {
          key,
          sortOrder: hasOrder ? order : 9999,
          title,
          guide: null,
          practice: null,
          single: null,
          originalIndex
        });
      }

      const song = paired.get(key);
      song[kind] = track;

      if (!song.title || (kind === 'guide' && track.Title)) {
        song.title = title;
      }
    });

    return [...paired.values(), ...singles].sort((a, b) => {
      return a.sortOrder - b.sortOrder
        || a.title.localeCompare(b.title)
        || a.originalIndex - b.originalIndex;
    });
  }

  function getCurrentSong() {
    return state.currentIndex >= 0 ? state.songs[state.currentIndex] : null;
  }

  function activeAudioElements(song = getCurrentSong()) {
    if (!song) return [];
    const players = [];
    if (song.guide) players.push(refs.guide);
    if (song.practice) players.push(refs.practice);
    if (song.single) players.push(refs.guide);
    return players;
  }

  function getMasterAudio(song = getCurrentSong()) {
    if (!song) return null;
    if (song.guide || song.single) return refs.guide;
    if (song.practice) return refs.practice;
    return null;
  }

  function getSlaveAudio(song = getCurrentSong()) {
    if (!song || !song.guide || !song.practice) return null;
    return refs.practice;
  }

  function decodeBase64Chunk(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function trackCacheVersion(track) {
    return [
      track.TrackID || '',
      track.DriveFileID || '',
      track.UpdatedAt || '',
      track.URL || ''
    ].join('|');
  }

  function openAudioDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support offline audio storage.'));
        return;
      }

      const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(AUDIO_STORE_NAME)) {
          database.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'trackId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open offline audio storage.'));
      request.onblocked = () => reject(new Error('Offline storage is blocked by another open tab.'));
    });
  }

  async function withAudioStore(mode, callback) {
    const database = await openAudioDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(AUDIO_STORE_NAME, mode);
      const store = transaction.objectStore(AUDIO_STORE_NAME);
      let result;

      try {
        result = callback(store);
      } catch (error) {
        database.close();
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        database.close();
        resolve(result);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Offline audio storage failed.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('Offline audio storage was interrupted.'));
      };
    });
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  async function estimateStorage() {
    if (!navigator.storage?.estimate) return null;
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }

  async function getAllStoredAudioEntries() {
    const database = await openAudioDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(AUDIO_STORE_NAME, 'readonly');
      const request = transaction.objectStore(AUDIO_STORE_NAME).getAll();

      request.onsuccess = () => {
        database.close();
        resolve(Array.isArray(request.result) ? request.result : []);
      };
      request.onerror = () => {
        database.close();
        reject(request.error || new Error('Could not inspect downloaded tracks.'));
      };
    });
  }

  async function getStoredAudioEntry(track) {
    const database = await openAudioDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(AUDIO_STORE_NAME, 'readonly');
      const request = transaction.objectStore(AUDIO_STORE_NAME).get(String(track.TrackID));

      request.onsuccess = () => {
        database.close();
        const entry = request.result;

        if (!entry) {
          resolve(null);
          return;
        }

        if (entry.version !== trackCacheVersion(track) || !(entry.blob instanceof Blob)) {
          resolve(null);
          return;
        }

        resolve(entry);
      };
      request.onerror = () => {
        database.close();
        reject(request.error || new Error('Could not read a downloaded track.'));
      };
    });
  }

  async function saveStoredAudioEntry(track, blob, info) {
    const entry = {
      trackId: String(track.TrackID),
      version: trackCacheVersion(track),
      title: track.Title || '',
      trackType: track.TrackType || '',
      mimeType: info.mimeType || blob.type || 'audio/mpeg',
      byteLength: Number(info.byteLength || blob.size || 0),
      savedAt: Date.now(),
      blob
    };

    await withAudioStore('readwrite', store => {
      store.put(entry);
    });

    state.cachedTrackIds.add(String(track.TrackID));
    return entry;
  }

  async function clearPersistentAudioCache() {
    await withAudioStore('readwrite', store => {
      store.clear();
    });

    audioBlobCache.forEach(cached => URL.revokeObjectURL(cached.url));
    audioBlobCache.clear();
    state.cachedTrackIds.clear();
  }

  async function removeStaleAudioEntries(tracks) {
    const validVersions = new Map(
      tracks.map(track => [String(track.TrackID), trackCacheVersion(track)])
    );
    const entries = await getAllStoredAudioEntries();
    const staleIds = entries
      .filter(entry => validVersions.get(String(entry.trackId)) !== entry.version)
      .map(entry => String(entry.trackId));

    if (!staleIds.length) return;

    await withAudioStore('readwrite', store => {
      staleIds.forEach(trackId => store.delete(trackId));
    });
  }

  function allLibraryTracks() {
    const unique = new Map();
    rawTracks.forEach(track => {
      if (track?.TrackID) unique.set(String(track.TrackID), track);
    });
    return [...unique.values()];
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '0 MB';
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  function sleep(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  function notifyDownloadTask(task, progress) {
    task.listeners.forEach(listener => {
      try {
        listener(progress);
      } catch {}
    });
  }

  function firestoreString(document, field) {
    return document?.fields?.[field]?.stringValue || '';
  }

  async function fetchFirebaseTrackBlob(track, onProgress) {
    const token = await BRM.firebaseIdToken();
    const driveFileId = String(track?.DriveFileID || '').trim();
    const firebase = window.BRM_CONFIG?.FIREBASE;
    const productionId = BRM.context?.production?.ProductionID;
    if (!token || !driveFileId || !firebase?.projectId || !productionId) return null;

    const documentUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebase.projectId)}/databases/(default)/documents/productions/${encodeURIComponent(productionId)}/storageAssets/${encodeURIComponent(driveFileId)}`;
    const metadataResponse = await fetch(documentUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!metadataResponse.ok) throw new Error(`Firebase asset lookup failed (${metadataResponse.status}).`);
    const metadata = await metadataResponse.json();
    const storagePath = firestoreString(metadata, 'storagePath');
    if (!storagePath) return null;

    const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(firebase.storageBucket)}/o/${encodeURIComponent(storagePath)}?alt=media`;
    const mediaResponse = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!mediaResponse.ok) throw new Error(`Firebase audio download failed (${mediaResponse.status}).`);
    const blob = await mediaResponse.blob();
    if (onProgress) onProgress(1);
    return {
      blob,
      byteLength: blob.size,
      mimeType: firestoreString(metadata, 'mimeType') || blob.type || 'audio/mpeg',
      fromCache: false,
      source: 'firebase-storage'
    };
  }

  async function fetchTrackBlob(track, label, onProgress) {
    if (!track?.TrackID) throw new Error(`${label} is missing its track record.`);

    const stored = await getStoredAudioEntry(track);
    if (stored) {
      state.cachedTrackIds.add(String(track.TrackID));
      if (onProgress) onProgress(1);
      return {
        blob: stored.blob,
        byteLength: stored.byteLength,
        mimeType: stored.mimeType,
        fromCache: true
      };
    }

    const trackId = String(track.TrackID);
    const existingTask = trackDownloadTasks.get(trackId);

    if (existingTask) {
      if (onProgress) existingTask.listeners.add(onProgress);
      try {
        return await existingTask.promise;
      } finally {
        if (onProgress) existingTask.listeners.delete(onProgress);
      }
    }

    const task = {
      listeners: new Set(onProgress ? [onProgress] : [])
    };

    task.promise = (async () => {
      try {
        const firebaseAudio = await fetchFirebaseTrackBlob(track, progress => notifyDownloadTask(task, progress));
        if (firebaseAudio) {
          await saveStoredAudioEntry(track, firebaseAudio.blob, firebaseAudio);
          return firebaseAudio;
        }
      } catch (firebaseError) {
        console.warn('Firebase audio unavailable; using Apps Script fallback:', firebaseError.message);
      }

      const info = await BRM.api('trackAudioInfo', { trackId });
      const chunks = new Array(info.chunkCount);
      let completed = 0;
      let nextIndex = 0;

      async function chunkWorker() {
        while (true) {
          const chunkIndex = nextIndex;
          nextIndex += 1;
          if (chunkIndex >= info.chunkCount) return;

          const result = await BRM.api('trackAudioChunk', {
            trackId,
            chunkIndex
          });

          chunks[chunkIndex] = decodeBase64Chunk(result.base64);
          completed += 1;
          notifyDownloadTask(task, completed / info.chunkCount);
        }
      }

      const workerCount = Math.min(3, info.chunkCount);
      await Promise.all(Array.from({ length: workerCount }, () => chunkWorker()));

      const blob = new Blob(chunks, { type: info.mimeType || 'audio/mpeg' });
      await saveStoredAudioEntry(track, blob, info);

      return {
        blob,
        byteLength: info.byteLength,
        mimeType: info.mimeType || 'audio/mpeg',
        fromCache: false
      };
    })();

    trackDownloadTasks.set(trackId, task);

    try {
      return await task.promise;
    } finally {
      trackDownloadTasks.delete(trackId);
    }
  }

  function touchCachedTrack(trackId) {
    const cached = audioBlobCache.get(trackId);
    if (cached) cached.lastUsed = Date.now();
    return cached;
  }

  function pruneAudioCache(protectedTrackIds = []) {
    const protectedSet = new Set(protectedTrackIds.filter(Boolean).map(String));
    const removable = [...audioBlobCache.entries()]
      .filter(([trackId]) => !protectedSet.has(String(trackId)))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    while (audioBlobCache.size > AUDIO_CACHE_LIMIT && removable.length) {
      const [trackId, cached] = removable.shift();
      URL.revokeObjectURL(cached.url);
      audioBlobCache.delete(trackId);
    }
  }

  async function fetchTrackObjectUrl(track, label, onProgress) {
    if (!track || !track.TrackID) throw new Error(`${label} is missing its track record.`);

    const cached = touchCachedTrack(track.TrackID);
    if (cached) {
      if (onProgress) onProgress(1);
      return cached.url;
    }

    const result = await fetchTrackBlob(track, label, onProgress);
    const url = URL.createObjectURL(result.blob);

    audioBlobCache.set(String(track.TrackID), {
      url,
      byteLength: result.byteLength,
      lastUsed: Date.now()
    });

    return url;
  }

  async function assignTrackSource(audio, track, label, generation) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    if (!track) return;

    const url = await fetchTrackObjectUrl(track, label, fraction => {
      if (generation !== state.loadGeneration) return;
      setStatus(`Loading ${label}: ${Math.round(fraction * 100)}%`, 'warning');
    });

    if (generation !== state.loadGeneration) return;

    await new Promise((resolve, reject) => {
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error(`${label} could not be decoded by this browser.`));
      };
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', ready);
        audio.removeEventListener('error', failed);
      };

      audio.addEventListener('loadedmetadata', ready, { once: true });
      audio.addEventListener('error', failed, { once: true });
      audio.src = url;
      audio.playbackRate = state.speed;
      audio.preservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.load();
    });
  }

  function updateCachePanel({
    title,
    detail,
    completed = 0,
    total = allLibraryTracks().length,
    running = state.libraryDownloadRunning,
    paused = state.libraryDownloadPaused
  } = {}) {
    const safeTotal = Math.max(0, total);
    const safeCompleted = Math.max(0, Math.min(completed, safeTotal));
    const percent = safeTotal ? Math.round((safeCompleted / safeTotal) * 100) : 100;

    if (title) refs.cacheTitle.textContent = title;
    if (detail) refs.cacheDetail.textContent = detail;

    refs.cacheBadge.textContent = `${percent}%`;
    refs.cacheProgress.setAttribute('aria-valuenow', String(percent));
    refs.cacheProgressFill.style.width = `${percent}%`;

    refs.cachePause.hidden = !running || paused;
    refs.cacheResume.hidden = !running || !paused;
    refs.cacheStart.hidden = running || safeCompleted >= safeTotal;
    refs.cachePanel.dataset.complete = safeCompleted >= safeTotal ? 'true' : 'false';
  }

  async function refreshCachePanel() {
    const tracks = allLibraryTracks();
    const entries = await getAllStoredAudioEntries();
    const validEntries = entries.filter(entry => {
      const track = tracks.find(item => String(item.TrackID) === String(entry.trackId));
      return track && entry.version === trackCacheVersion(track);
    });

    state.cachedTrackIds = new Set(validEntries.map(entry => String(entry.trackId)));

    const storedBytes = validEntries.reduce(
      (sum, entry) => sum + Number(entry.byteLength || entry.blob?.size || 0),
      0
    );
    const storage = await estimateStorage();
    const quotaText = storage?.quota
      ? ` · Browser storage ${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} used`
      : '';

    updateCachePanel({
      title: validEntries.length >= tracks.length && tracks.length
        ? 'All tracks downloaded to this device'
        : 'One-time full-library download',
      detail: `${validEntries.length} of ${tracks.length} tracks stored · ${formatBytes(storedBytes)} downloaded${quotaText}`,
      completed: validEntries.length,
      total: tracks.length,
      running: state.libraryDownloadRunning,
      paused: state.libraryDownloadPaused
    });

    renderPlaylist();
    return validEntries.length;
  }

  async function runFullLibraryDownload() {
    if (state.libraryDownloadRunning) return;

    const tracks = allLibraryTracks();
    if (!tracks.length) {
      updateCachePanel({
        title: 'No tracks available',
        detail: 'Sync tracks from Drive before downloading the library.',
        completed: 0,
        total: 0,
        running: false
      });
      return;
    }

    state.libraryDownloadRunning = true;
    state.libraryDownloadPaused = false;
    state.libraryDownloadCancelled = false;
    state.cacheFailures = [];

    await requestPersistentStorage();

    try {
      await removeStaleAudioEntries(tracks);
    } catch (error) {
      console.warn('Could not remove stale offline tracks:', error);
    }

    const entries = await getAllStoredAudioEntries();
    const validEntryMap = new Map(
      entries.map(entry => [String(entry.trackId), entry])
    );

    state.cachedTrackIds.clear();

    tracks.forEach(track => {
      const entry = validEntryMap.get(String(track.TrackID));
      if (entry && entry.version === trackCacheVersion(track)) {
        state.cachedTrackIds.add(String(track.TrackID));
      }
    });

    let completed = state.cachedTrackIds.size;
    let failed = 0;
    let downloadedBytes = entries
      .filter(entry => state.cachedTrackIds.has(String(entry.trackId)))
      .reduce((sum, entry) => sum + Number(entry.byteLength || entry.blob?.size || 0), 0);

    const queue = tracks.filter(track => !state.cachedTrackIds.has(String(track.TrackID)));

    updateCachePanel({
      title: queue.length ? 'Downloading the complete track library' : 'All tracks downloaded to this device',
      detail: queue.length
        ? `${completed} of ${tracks.length} tracks ready. Keep this page open during the first download.`
        : `${completed} of ${tracks.length} tracks stored locally.`,
      completed,
      total: tracks.length,
      running: Boolean(queue.length)
    });

    if (!queue.length) {
      state.libraryDownloadRunning = false;
      await refreshCachePanel();
      return;
    }

    let nextQueueIndex = 0;

    async function libraryWorker() {
      while (nextQueueIndex < queue.length && !state.libraryDownloadCancelled) {
        while (state.libraryDownloadPaused && !state.libraryDownloadCancelled) {
          await sleep(250);
        }

        if (state.libraryDownloadCancelled) return;

        const track = queue[nextQueueIndex];
        nextQueueIndex += 1;
        let trackFraction = 0;

        try {
          const result = await fetchTrackBlob(
            track,
            track.TrackType || 'Track',
            fraction => {
              trackFraction = fraction;
              const overall = completed + trackFraction;
              const percent = tracks.length
                ? Math.round((overall / tracks.length) * 100)
                : 100;

              refs.cacheBadge.textContent = `${percent}%`;
              refs.cacheProgress.setAttribute('aria-valuenow', String(percent));
              refs.cacheProgressFill.style.width = `${percent}%`;
              refs.cacheDetail.textContent =
                `${completed} of ${tracks.length} complete · Downloading ${track.Title || 'track'}…`;
            }
          );

          completed += 1;
          downloadedBytes += Number(result.byteLength || result.blob?.size || 0);
          state.cachedTrackIds.add(String(track.TrackID));

          updateCachePanel({
            title: 'Downloading the complete track library',
            detail: `${completed} of ${tracks.length} tracks ready · ${formatBytes(downloadedBytes)} stored`,
            completed,
            total: tracks.length,
            running: true,
            paused: state.libraryDownloadPaused
          });

          renderPlaylist();
        } catch (error) {
          failed += 1;
          state.cacheFailures.push({
            trackId: track.TrackID,
            title: track.Title,
            message: error.message || String(error)
          });

          updateCachePanel({
            title: 'Downloading the complete track library',
            detail: `${completed} ready · ${failed} failed · Continuing with the remaining tracks`,
            completed,
            total: tracks.length,
            running: true,
            paused: state.libraryDownloadPaused
          });
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(FULL_LIBRARY_WORKERS, queue.length) },
        () => libraryWorker()
      )
    );

    state.libraryDownloadRunning = false;
    state.libraryDownloadPaused = false;

    if (state.libraryDownloadCancelled) {
      await refreshCachePanel();
      return;
    }

    if (failed) {
      updateCachePanel({
        title: 'Track download finished with some errors',
        detail: `${completed} of ${tracks.length} tracks are stored. Reload the page to retry the ${failed} failed track${failed === 1 ? '' : 's'}.`,
        completed,
        total: tracks.length,
        running: false
      });
    } else {
      await refreshCachePanel();
    }
  }

  async function initializeFullLibraryCache() {
    try {
      await requestPersistentStorage();
      const tracks = allLibraryTracks();
      await removeStaleAudioEntries(tracks);
      const cachedCount = await refreshCachePanel();

      if (cachedCount < tracks.length) {
        updateCachePanel({
          title: 'Offline track library',
          detail: `${cachedCount} of ${tracks.length} tracks stored. Downloading the full library is optional.`,
          completed: cachedCount,
          total: tracks.length,
          running: false
        });
      }
    } catch (error) {
      updateCachePanel({
        title: 'Offline track storage unavailable',
        detail: error.message || 'This browser cannot store the complete track library.',
        completed: 0,
        total: allLibraryTracks().length,
        running: false
      });
    }
  }

  function setStatus(message, type = 'info') {
    refs.status.textContent = message;
    refs.status.dataset.status = type;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function availableDuration() {
    const durations = activeAudioElements()
      .map(audio => audio.duration)
      .filter(value => Number.isFinite(value) && value > 0);

    if (!durations.length) return 0;
    return Math.min(...durations);
  }

  function updateProgressDisplay() {
    const master = getMasterAudio();
    const duration = availableDuration();
    const current = master && Number.isFinite(master.currentTime) ? master.currentTime : 0;

    if (!state.draggingProgress && duration > 0) {
      refs.progress.value = Math.min(1000, Math.max(0, Math.round((current / duration) * 1000)));
    }

    refs.time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  function updatePlayButton() {
    refs.play.textContent = state.playing ? '❚❚ Pause' : '▶ Play';
  }

  function applyAudioMix() {
    const song = getCurrentSong();
    if (!song) return;

    const master = Math.max(0, Math.min(1, state.masterVolume));
    const blend = Math.max(0, Math.min(1, state.blend));

    if (song.guide && song.practice) {
      refs.guide.volume = (1 - blend) * master;
      refs.practice.volume = blend * master;
    } else {
      refs.guide.volume = master;
      refs.practice.volume = master;
    }

    refs.blendReadout.textContent =
      `Guide ${Math.round((1 - blend) * 100)}% · Practice ${Math.round(blend * 100)}%`;
  }

  function applySpeed() {
    activeAudioElements().forEach(audio => {
      audio.playbackRate = state.speed;
      audio.preservesPitch = true;
      audio.webkitPreservesPitch = true;
    });
    refs.speedReadout.textContent = `${state.speed.toFixed(2)}×`;
  }

  function pauseAll() {
    activeAudioElements().forEach(audio => audio.pause());
    state.playing = false;
    updatePlayButton();
    stopSyncTimer();
  }

  async function playCurrent() {
    const song = getCurrentSong();
    if (!song) {
      BRM.toast('Select a track first.', 'info');
      return;
    }

    if (state.loadingPromise) {
      setStatus('Finishing the private audio download…', 'warning');
      try {
        await state.loadingPromise;
      } catch (error) {
        setStatus(error.message || 'The private audio download failed.', 'error');
        return;
      }
    }

    const players = activeAudioElements(song);
    if (!players.length) {
      setStatus('No playable audio is attached to this track.', 'error');
      return;
    }

    const master = getMasterAudio(song);
    const targetTime = master && Number.isFinite(master.currentTime) ? master.currentTime : 0;

    players.forEach(audio => {
      try {
        if (Number.isFinite(audio.duration) && targetTime < audio.duration) audio.currentTime = targetTime;
      } catch {}
      audio.playbackRate = state.speed;
    });

    applyAudioMix();

    const attempts = players.map(audio => audio.play());
    const results = await Promise.allSettled(attempts);
    const played = results.some(item => item.status === 'fulfilled');

    if (!played) {
      state.playing = false;
      updatePlayButton();
      setStatus(
        'The audio downloaded, but the browser could not decode or play it. Confirm the Drive files are valid MP3 audio.',
        'error'
      );
      return;
    }

    state.playing = true;
    updatePlayButton();
    setStatus(
      song.guide && song.practice
        ? 'Guide and practice tracks are playing together and staying synchronized.'
        : 'This song currently has only one available version.',
      song.guide && song.practice ? 'success' : 'warning'
    );
    startSyncTimer();
  }

  function startSyncTimer() {
    stopSyncTimer();
    state.timer = window.setInterval(() => {
      if (!state.playing) return;

      const master = getMasterAudio();
      const slave = getSlaveAudio();

      if (master && slave && !master.paused && !slave.paused) {
        const difference = Math.abs(master.currentTime - slave.currentTime);
        if (difference > 0.18 && Number.isFinite(master.currentTime)) {
          try { slave.currentTime = master.currentTime; } catch {}
        }
      }

      updateProgressDisplay();
    }, 220);
  }

  function stopSyncTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function renderCurrentSong() {
    const song = getCurrentSong();

    if (!song) {
      refs.title.textContent = 'Select a track';
      refs.subtitle.textContent = 'Choose a song from the playlist.';
      refs.badges.innerHTML = '';
      return;
    }

    refs.title.textContent = song.title || 'Untitled track';
    refs.subtitle.textContent = Number.isFinite(song.sortOrder) && song.sortOrder < 9999
      ? `Track ${String(song.sortOrder).padStart(2, '0')}`
      : 'Rehearsal audio';

    const badges = [];
    if (song.guide) badges.push('<span class="badge dual-badge-guide">Guide Vocal</span>');
    if (song.practice) badges.push('<span class="badge dual-badge-practice">Practice Track</span>');
    if (song.single) badges.push(`<span class="badge">${BRM.escape(song.single.TrackType || 'Audio')}</span>`);
    if (!song.guide && !song.single) badges.push('<span class="badge dual-badge-missing">Guide missing</span>');
    if (!song.practice && !song.single) badges.push('<span class="badge dual-badge-missing">Practice missing</span>');
    refs.badges.innerHTML = badges.join('');

    if (Number.isFinite(song.sortOrder) && song.sortOrder >= 1 && song.sortOrder <= 46) {
      const number = String(song.sortOrder).padStart(2, '0');
      const filename = `${number} ${song.title}.pdf`;
      const scoreUrl = `song-pdfs/${encodeURIComponent(filename)}`;
      refs.scoreTitle.textContent = `${number} · ${song.title}`;
      const nativeApp = Boolean(localStorage.getItem('brmAppInstall'));
      refs.scoreCopy.textContent = nativeApp ? 'Open the score with its integrated player and Annotation Studio.' : 'Continue this score in ScoreFlow.';
      refs.scoreOpen.href = nativeApp ? scoreUrl : 'downloads/BedfordRoadMusical-2.16.1.apk';
      refs.scoreOpen.target = '_self';
    } else {
    }

    refs.blend.disabled = !(song.guide && song.practice);
    main.querySelectorAll('[data-blend-value]').forEach(button => {
      button.disabled = !(song.guide && song.practice);
    });

    if (song.guide && song.practice) {
      setStatus('Both versions are ready. Use the fader to move between them.', 'success');
    } else {
      setStatus('Only one version is available for this song.', 'warning');
    }
  }

  async function loadSong(index, autoplay = false) {
    if (!state.songs.length) return;

    pauseAll();
    state.currentIndex = Math.max(0, Math.min(index, state.songs.length - 1));
    state.loadGeneration += 1;
    const generation = state.loadGeneration;
    const song = getCurrentSong();

    renderCurrentSong();
    refs.play.disabled = true;
    refs.progress.value = 0;
    updateProgressDisplay();
    renderPlaylist();
    setStatus('Preparing private rehearsal audio…', 'warning');

    const loads = song.single
      ? [
          assignTrackSource(refs.guide, song.single, song.single.TrackType || 'Track', generation),
          assignTrackSource(refs.practice, null, 'Practice Track', generation)
        ]
      : [
          assignTrackSource(refs.guide, song.guide, 'Guide Vocal', generation),
          assignTrackSource(refs.practice, song.practice, 'Practice Track', generation)
        ];

    state.loadingPromise = Promise.all(loads)
      .then(() => {
        if (generation !== state.loadGeneration) return;

        applyAudioMix();
        applySpeed();
        updateProgressDisplay();

        const current = getCurrentSong();
        const protectedIds = [
          current?.guide?.TrackID,
          current?.practice?.TrackID,
          current?.single?.TrackID
        ];
        pruneAudioCache(protectedIds);

        setStatus(
          current.guide && current.practice
            ? 'Guide and practice tracks are ready. Use the fader to blend them.'
            : 'The available track is ready.',
          current.guide && current.practice ? 'success' : 'warning'
        );
      })
      .catch(error => {
        if (generation === state.loadGeneration) {
          setStatus(error.message || 'The private audio download failed.', 'error');
        }
        throw error;
      })
      .finally(() => {
        if (generation === state.loadGeneration) {
          refs.play.disabled = false;
          state.loadingPromise = null;
        }
      });

    try {
      await state.loadingPromise;
      if (autoplay && generation === state.loadGeneration) await playCurrent();
    } catch (error) {
      // The status panel already contains the useful error.
    }
  }

  function moveTrack(direction) {
    if (!state.songs.length) return;
    const nextIndex = state.currentIndex < 0
      ? 0
      : (state.currentIndex + direction + state.songs.length) % state.songs.length;
    loadSong(nextIndex, state.playing);
  }

  function renderLibrarySummary() {
    const paired = state.songs.filter(song => song.guide && song.practice).length;
    const guideOnly = state.songs.filter(song => song.guide && !song.practice).length;
    const practiceOnly = state.songs.filter(song => song.practice && !song.guide).length;
    const other = state.songs.filter(song => song.single).length;

    refs.summary.innerHTML = `
      <span><strong>${state.songs.length}</strong> songs</span>
      <span><strong>${paired}</strong> complete pairs</span>
      ${guideOnly ? `<span><strong>${guideOnly}</strong> guide only</span>` : ''}
      ${practiceOnly ? `<span><strong>${practiceOnly}</strong> practice only</span>` : ''}
      ${other ? `<span><strong>${other}</strong> other tracks</span>` : ''}
    `;
  }

  function renderPlaylist() {
    const query = refs.search.value.trim().toLowerCase();
    const filter = refs.filter.value;

    const visible = state.songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => {
        const matchesSearch = !query || `${song.title} ${song.sortOrder}`.toLowerCase().includes(query);
        if (!matchesSearch) return false;
        if (filter === 'paired') return Boolean(song.guide && song.practice);
        if (filter === 'missing') return Boolean(!song.single && !(song.guide && song.practice));
        if (filter === 'guide') return Boolean(song.guide || song.single);
        if (filter === 'practice') return Boolean(song.practice);
        return true;
      });

    if (!visible.length) {
      refs.list.innerHTML = BRM.empty(
        rawTracks.length ? 'No matching tracks' : 'No tracks have been synced',
        rawTracks.length
          ? 'Change the search or filter.'
          : 'Upload audio to the generated Drive folders and run syncTracksFromDrive().',
        '♪'
      );
      return;
    }

    refs.list.innerHTML = visible.map(({ song, index }) => {
      const badges = [];
      if (song.guide) badges.push('<span class="dual-mini-badge guide">Guide</span>');
      if (song.practice) badges.push('<span class="dual-mini-badge practice">Practice</span>');
      if (song.single) badges.push(`<span class="dual-mini-badge">${BRM.escape(song.single.TrackType || 'Audio')}</span>`);
      if (!song.single && !song.guide) badges.push('<span class="dual-mini-badge missing">No guide</span>');
      if (!song.single && !song.practice) badges.push('<span class="dual-mini-badge missing">No practice</span>');

      const songTrackIds = [song.guide?.TrackID, song.practice?.TrackID, song.single?.TrackID].filter(Boolean);
      const fullyDownloaded = songTrackIds.length
        && songTrackIds.every(trackId => state.cachedTrackIds.has(String(trackId)));

      if (fullyDownloaded) {
        badges.push('<span class="dual-mini-badge downloaded">Downloaded</span>');
      }

      return `
        <button
          type="button"
          class="dual-track-item ${index === state.currentIndex ? 'active' : ''}"
          data-song-index="${index}"
        >
          <span class="dual-track-number">${song.sortOrder < 9999 ? String(song.sortOrder).padStart(2, '0') : '♪'}</span>
          <span class="dual-track-copy">
            <strong>${BRM.escape(song.title)}</strong>
            <span>${badges.join('')}</span>
          </span>
          <span class="dual-track-action">${index === state.currentIndex && state.playing ? '❚❚' : '▶'}</span>
        </button>
      `;
    }).join('');

    refs.list.querySelectorAll('[data-song-index]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.songIndex);
        if (index === state.currentIndex) {
          if (state.playing) pauseAll();
          else playCurrent();
          renderPlaylist();
          return;
        }
        loadSong(index, state.playing);
      });
    });
  }

  refs.play.addEventListener('click', () => {
    if (state.playing) pauseAll();
    else playCurrent();
    renderPlaylist();
  });

  refs.restart.addEventListener('click', () => {
    activeAudioElements().forEach(audio => {
      try { audio.currentTime = 0; } catch {}
    });
    updateProgressDisplay();
  });

  refs.previous.addEventListener('click', () => moveTrack(-1));
  refs.next.addEventListener('click', () => moveTrack(1));

  refs.blend.addEventListener('input', () => {
    state.blend = Number(refs.blend.value) / 100;
    applyAudioMix();
  });

  main.querySelectorAll('[data-blend-value]').forEach(button => {
    button.addEventListener('click', () => {
      refs.blend.value = button.dataset.blendValue;
      state.blend = Number(button.dataset.blendValue) / 100;
      applyAudioMix();
    });
  });

  refs.speed.addEventListener('input', () => {
    state.speed = Number(refs.speed.value);
    applySpeed();
  });

  refs.volume.addEventListener('input', () => {
    state.masterVolume = Number(refs.volume.value);
    refs.volumeReadout.textContent = `${Math.round(state.masterVolume * 100)}%`;
    applyAudioMix();
  });

  refs.progress.addEventListener('pointerdown', () => {
    state.draggingProgress = true;
  });

  refs.progress.addEventListener('input', () => {
    const duration = availableDuration();
    if (!duration) return;

    const target = (Number(refs.progress.value) / 1000) * duration;
    activeAudioElements().forEach(audio => {
      try { audio.currentTime = target; } catch {}
    });
    refs.progressLabel.textContent = formatTime(target);
    updateProgressDisplay();
  });

  const finishScrub = () => {
    state.draggingProgress = false;
    refs.progressLabel.textContent = 'Drag to scrub';
    updateProgressDisplay();
  };

  refs.progress.addEventListener('change', finishScrub);
  refs.progress.addEventListener('pointerup', finishScrub);

  refs.search.addEventListener('input', renderPlaylist);
  refs.filter.addEventListener('change', renderPlaylist);

  refs.cachePause.addEventListener('click', () => {
    state.libraryDownloadPaused = true;
    updateCachePanel({
      title: 'Full-library download paused',
      detail: `${state.cachedTrackIds.size} of ${allLibraryTracks().length} tracks are ready. You can continue listening to downloaded tracks.`,
      completed: state.cachedTrackIds.size,
      total: allLibraryTracks().length,
      running: true,
      paused: true
    });
  });

  refs.cacheResume.addEventListener('click', () => {
    state.libraryDownloadPaused = false;
    updateCachePanel({
      title: 'Downloading the complete track library',
      detail: `${state.cachedTrackIds.size} of ${allLibraryTracks().length} tracks are ready.`,
      completed: state.cachedTrackIds.size,
      total: allLibraryTracks().length,
      running: true,
      paused: false
    });
  });

  refs.cacheStart.addEventListener('click', () => {
    runFullLibraryDownload().catch(error => {
      updateCachePanel({
        title: 'Download could not start',
        detail: error.message || 'The browser could not store the track library.',
        completed: state.cachedTrackIds.size,
        total: allLibraryTracks().length,
        running: false
      });
    });
  });

  refs.cacheClear.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Remove all downloaded rehearsal tracks from this browser? They can be downloaded again later.'
    );
    if (!confirmed) return;

    state.libraryDownloadCancelled = true;
    state.libraryDownloadPaused = false;

    try {
      await clearPersistentAudioCache();
      updateCachePanel({
        title: 'Downloaded tracks cleared',
        detail: 'The track library has been removed from this browser. Select Download all tracks to restore it.',
        completed: 0,
        total: allLibraryTracks().length,
        running: false
      });
      renderPlaylist();
    } catch (error) {
      BRM.toast(error.message || 'Downloaded tracks could not be cleared.', 'error');
    }
  });

  [refs.guide, refs.practice].forEach(audio => {
    audio.addEventListener('error', () => {
      setStatus('The downloaded audio could not be decoded. Confirm the source file is a valid MP3.', 'error');
    });
    audio.addEventListener('loadedmetadata', updateProgressDisplay);
    audio.addEventListener('durationchange', updateProgressDisplay);
    audio.addEventListener('timeupdate', updateProgressDisplay);
    audio.addEventListener('waiting', () => {
      if (state.playing) setStatus('Buffering audio from Drive…', 'warning');
    });
    audio.addEventListener('playing', () => {
      if (state.playing) setStatus('Playing synchronized rehearsal tracks.', 'success');
    });
  });

  refs.guide.addEventListener('ended', () => {
    pauseAll();
    updateProgressDisplay();
    renderPlaylist();
  });

  refs.practice.addEventListener('ended', () => {
    const song = getCurrentSong();
    if (song && !song.guide) {
      pauseAll();
      updateProgressDisplay();
      renderPlaylist();
    }
  });

  renderLibrarySummary();
  renderPlaylist();
  refs.play.disabled = true;
  initializeFullLibraryCache();

  try {
    await BRM.renderNotesPanel?.({
      pageKey: 'tracks',
      title: 'Music Notes'
    });
  } catch (error) {
    console.warn('Music Notes could not initialize:', error);
  }
}));

function pairTrackLibrary(tracks) {
  const cleanTitle = value => String(value || '')
    .replace(/\.(mp3|m4a|wav|aac|ogg)$/i, '')
    .replace(/^\s*\d+\s*[-_.]?\s*/, '')
    .trim();

  const normalizeTitle = value => cleanTitle(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const classify = track => {
    const type = String(track.TrackType || '').toLowerCase();
    if (type.includes('guide')) return 'guide';
    if (type.includes('practice')) return 'practice';
    return 'single';
  };

  const pairs = new Map();
  const singles = [];

  tracks.forEach((track, originalIndex) => {
    const order = Number(track.SortOrder);
    const hasOrder = Number.isFinite(order) && order < 9999;
    const kind = classify(track);
    const title = cleanTitle(track.Title);

    if (kind === 'single') {
      singles.push({
        key: `single:${track.TrackID || originalIndex}`,
        sortOrder: hasOrder ? order : 9999,
        title,
        guide: null,
        practice: null,
        single: track,
        originalIndex
      });
      return;
    }

    const key = hasOrder
      ? `order:${String(order).padStart(5, '0')}`
      : `title:${normalizeTitle(title)}`;

    if (!pairs.has(key)) {
      pairs.set(key, {
        key,
        sortOrder: hasOrder ? order : 9999,
        title,
        guide: null,
        practice: null,
        single: null,
        originalIndex
      });
    }

    const song = pairs.get(key);
    song[kind] = track;
    if (kind === 'guide') song.title = title;
  });

  return [...pairs.values(), ...singles].sort((a, b) => {
    return a.sortOrder - b.sortOrder
      || a.title.localeCompare(b.title)
      || a.originalIndex - b.originalIndex;
  });
}
