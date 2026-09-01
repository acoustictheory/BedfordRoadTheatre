window.BRM = window.BRM || {};

(function (BRM) {
  const config = window.BRM_CONFIG || {};
  const placeholder = !config.API_URL || config.API_URL.includes('PASTE_YOUR');

  const SITE_CACHE_DB = 'bedford-musical-site-cache-v1';
  const SITE_CACHE_STORE = 'snapshots';
  const SITE_CACHE_KEY = 'active-user-snapshot';
  const SNAPSHOT_FRESH_MS = 2 * 60 * 1000;
  const SNAPSHOT_MAX_MS = 24 * 60 * 60 * 1000;

  const CACHEABLE_ACTIONS = new Set([
    'validateSession',
    'dashboard',
    'getProfile',
    'directory',
    'announcements',
    'pageNotes',
    'myJournal',
    'journalReview',
    'schedule',
    'departments',
    'departmentWorkspace',
    'myTasks',
    'resources',
    'tracks',
    'adminData',
    'recruitmentAdminData',
    'myDepartmentRequests'
  ]);

  const MUTATING_ACTIONS = new Set([
    'register',
    'submitAuditionBooking',
    'submitMusicalInterest',
    'reviewRecruitmentSubmission',
    'deleteRecruitmentSubmission',
    'changePassword',
    'updateProfile',
    'uploadProfilePhoto',
    'removeProfilePhoto',
    'saveAnnouncement',
    'archiveAnnouncement',
    'deleteAnnouncement',
    'acknowledgeAnnouncement',
    'createPageNote',
    'editPageNote',
    'deletePageNote',
    'saveJournalEntry',
    'saveJournalFeedback', 'deleteJournalEntry',
    'saveEvent',
    'saveDepartmentItem',
    'saveTask',
    'updateTaskStatus',
    'saveResource',
    'uploadDepartmentImage',
    'saveUserAccess',
    'saveManagedUser',
    'saveMyDepartmentRequests',
    'reviewDepartmentRequest',
    'createRegistrationCode',
    'startNewProduction',
    'requestProductionDeletion',
    'approveProductionDeletion', 'createManagedUser', 'deleteManagedUser',
    'savePropsItem', 'savePropsTask', 'savePropsPreset', 'savePropsDeadline',
    'savePropsSuggestion', 'reviewPropsSuggestion', 'archivePropsItem',
    'restorePropsItem', 'deletePropsItemPermanently', 'uploadPropsImage',
    'deletePropsImage', 'updatePropsPresetRunStatus', 'resetPropsPresetRun',
    'saveScenicSet', 'saveScenicElement', 'saveScenicTask', 'saveScenicTransition',
    'saveScenicDeadline', 'saveScenicSuggestion', 'reviewScenicSuggestion',
    'archiveScenicSet', 'restoreScenicSet', 'deleteScenicSetPermanently',
    'archiveScenicElement', 'restoreScenicElement', 'deleteScenicElementPermanently',
    'uploadScenicImage', 'deleteScenicImage', 'updateScenicTransitionRunStatus',
    'resetScenicTransitionRun', 'uploadCostumeImage', 'deleteCostumeImage',
    'reviewCostumeSuggestion', 'archiveCostumeCharacter', 'restoreCostumeCharacter',
    'deleteCostumeCharacterPermanently', 'archiveCostumePiece', 'restoreCostumePiece',
    'deleteCostumePiecePermanently', 'updateCostumeChangeRunStatus',
    'resetCostumeChangeRun', 'saveCostumeCharacter', 'saveCostumeChange',
    'saveCostumePiece', 'saveCostumeMeasurement', 'saveCostumeFitting',
    'saveCostumeTask', 'saveCostumeDeadline', 'saveCostumeSuggestion',
    'saveBlockingSnapshot', 'saveBlockingTimeline',
    'saveBlockingAnchor', 'saveBlockingCast', 'deleteBlockingCast',
    'saveBlockingEnsembleRoster', 'uploadBlockingBackground',
    'setBlockingSnapshotStatus', 'deleteBlockingSnapshotPermanently',
    'duplicateBlockingSnapshot', 'restoreBlockingSnapshotVersion',
    'saveBlockingSceneRecording', 'useBlockingSceneRecording'
  ]);

  let responseCache = new Map();
  let snapshotMemory = null;
  let snapshotLoadPromise = null;
  let snapshotRefreshPromise = null;

  BRM.isDemo = () => Boolean(config.DEMO_MODE || placeholder);

  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function contextAdminValue(context) {
    const value = context?.isAdmin;

    return Boolean(
      value === true
      || String(value || '').toLowerCase() === 'true'
      || context?.permissions?.includes('admin.all')
    );
  }

  function mergeDepartments(primary = [], secondary = []) {
    const departments = new Map();

    [...secondary, ...primary].forEach(department => {
      const key = String(
        department?.DepartmentID
        || department?.departmentId
        || department?.Slug
        || department?.slug
        || ''
      );

      if (key) departments.set(key, department);
    });

    return [...departments.values()];
  }

  function mergePortalContexts(primary, secondary) {
    if (!primary) return secondary ? clone(secondary) : null;
    if (!secondary) return clone(primary);

    if (
      primary.userId
      && secondary.userId
      && String(primary.userId) !== String(secondary.userId)
    ) {
      return clone(primary);
    }

    const merged = {
      ...secondary,
      ...primary,
      profile: {
        ...(secondary.profile || {}),
        ...(primary.profile || {})
      },
      production: {
        ...(secondary.production || {}),
        ...(primary.production || {})
      }
    };

    const permissions = new Set(primary.permissions || []);
    const departmentIds = new Set((primary.departmentIds || []).map(String));

    merged.permissions = [...permissions];
    merged.departmentIds = [...departmentIds];
    merged.departments = clone(primary.departments || []);
    merged.isAdmin = Boolean(
      contextAdminValue(primary)
      || merged.permissions.includes('admin.all')
    );

    return merged;
  }

  function cachedContextWouldDowngrade(cachedContext, currentContext) {
    if (!cachedContext || !currentContext) return false;

    const sameUser =
      !cachedContext.userId
      || !currentContext.userId
      || String(cachedContext.userId) === String(currentContext.userId);

    return sameUser
      && contextAdminValue(currentContext)
      && !contextAdminValue(cachedContext);
  }

  BRM.mergePortalContexts = mergePortalContexts;

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((out, key) => {
          if (value[key] !== undefined) out[key] = stableValue(value[key]);
          return out;
        }, {});
    }
    return value;
  }

  function requestKey(action, payload = {}) {
    return `${action}|${JSON.stringify(stableValue(payload || {}))}`;
  }

  function setCachedResponse(action, payload, result) {
    responseCache.set(requestKey(action, payload), clone(result));
  }

  function getCachedResponse(action, payload) {
    const result = responseCache.get(requestKey(action, payload));
    return result ? clone(result) : null;
  }

  function dispatchSyncStatus(state, message) {
    window.dispatchEvent(new CustomEvent('brm:sync-status', {
      detail: { state, message }
    }));
  }

  function openSnapshotDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support persistent portal caching.'));
        return;
      }

      const request = indexedDB.open(SITE_CACHE_DB, 1);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SITE_CACHE_STORE)) {
          database.createObjectStore(SITE_CACHE_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the portal cache.'));
    });
  }

  async function readSnapshotRecord() {
    const database = await openSnapshotDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SITE_CACHE_STORE, 'readonly');
      const request = transaction.objectStore(SITE_CACHE_STORE).get(SITE_CACHE_KEY);

      request.onsuccess = () => {
        database.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        database.close();
        reject(request.error || new Error('Could not read the portal cache.'));
      };
    });
  }

  async function writeSnapshotRecord(snapshot) {
    const database = await openSnapshotDatabase();
    const owner = localStorage.getItem('brmToken') || '';

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SITE_CACHE_STORE, 'readwrite');
      transaction.objectStore(SITE_CACHE_STORE).put({
        id: SITE_CACHE_KEY,
        owner,
        savedAt: Date.now(),
        revision: Number(snapshot.revision || 0),
        snapshot
      });

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };

      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Could not save the portal cache.'));
      };
    });
  }

  async function deleteSnapshotRecord() {
    if (!('indexedDB' in window)) return;

    const database = await openSnapshotDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SITE_CACHE_STORE, 'readwrite');
      transaction.objectStore(SITE_CACHE_STORE).delete(SITE_CACHE_KEY);

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };

      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Could not clear the portal cache.'));
      };
    });
  }

  async function rawApi(action, payload = {}, options = {}) {
    if (BRM.isDemo()) return BRM.demoApi(action, payload);

    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:[?#].*)?$/.test(String(config.API_URL || ''))) {
      throw new Error('The musical portal server is not configured with a valid Apps Script Web App URL.');
    }

    const token = options.public ? '' : localStorage.getItem('brmToken') || '';
    let response;

    try {
      response = await fetch(config.API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ ...payload, action, token })
      });
    } catch (error) {
      throw new Error('Could not reach the musical portal server. Check your internet connection and Apps Script deployment.');
    }

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error('The server returned an unreadable response. Redeploy Apps Script and verify the URL.');
    }

    if (!result.success) {
      if (['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(result.code)) {
        BRM.clearSession?.();
      }

      const error = new Error(result.error || 'Request failed.');
      error.code = result.code;
      throw error;
    }

    return result;
  }

  function seedSnapshot(snapshot) {
    if (!snapshot || !snapshot.context) return;

    let currentContext = null;

    try {
      currentContext = JSON.parse(localStorage.getItem('brmContext') || 'null');
    } catch {}

    snapshot.context = mergePortalContexts(snapshot.context, currentContext);

    if (snapshot.dashboard?.context) {
      snapshot.dashboard.context = mergePortalContexts(
        snapshot.dashboard.context,
        snapshot.context
      );
    }

    snapshotMemory = snapshot;
    responseCache = new Map();

    setCachedResponse('validateSession', {}, {
      success: true,
      context: snapshot.context,
      revision: snapshot.revision
    });

    setCachedResponse('dashboard', {}, {
      success: true,
      ...snapshot.dashboard,
      revision: snapshot.revision
    });

    setCachedResponse('getProfile', {}, {
      success: true,
      ...snapshot.profile,
      revision: snapshot.revision
    });

    setCachedResponse('announcements', {}, {
      success: true,
      data: snapshot.announcements || [],
      revision: snapshot.revision
    });

    setCachedResponse('schedule', {}, {
      success: true,
      data: snapshot.schedule || [],
      revision: snapshot.revision
    });

    setCachedResponse('myTasks', { includeCompleted: true }, {
      success: true,
      data: snapshot.tasks || [],
      revision: snapshot.revision
    });

    setCachedResponse('myTasks', {}, {
      success: true,
      data: (snapshot.tasks || []).filter(task => String(task.Status) !== 'Completed'),
      revision: snapshot.revision
    });

    setCachedResponse('resources', {}, {
      success: true,
      data: snapshot.resources || [],
      revision: snapshot.revision
    });

    setCachedResponse('tracks', {}, {
      success: true,
      data: snapshot.tracks || [],
      revision: snapshot.revision
    });

    setCachedResponse('directory', {}, {
      success: true,
      data: snapshot.directory || [],
      revision: snapshot.revision
    });

    setCachedResponse('departments', {}, {
      success: true,
      data: snapshot.departments || [],
      revision: snapshot.revision
    });

    setCachedResponse('myJournal', {}, {
      success: true,
      ...(snapshot.journal || { entries: [], feedback: [] }),
      revision: snapshot.revision
    });

    (snapshot.departmentWorkspaces || []).forEach(entry => {
      if (!entry.error && entry.result) {
        setCachedResponse('departmentWorkspace', entry.payload || {}, {
          success: true,
          ...entry.result,
          revision: snapshot.revision
        });
      }
    });

    (snapshot.pageNotes || []).forEach(entry => {
      if (!entry.error) {
        setCachedResponse('pageNotes', entry.payload || {}, {
          success: true,
          data: entry.result || [],
          revision: snapshot.revision
        });
      }
    });

    if (snapshot.adminData) {
      setCachedResponse('adminData', {}, {
        success: true,
        ...snapshot.adminData,
        revision: snapshot.revision
      });
    }

    if (snapshot.journalReview) {
      const journalReviewResult = {
        success: true,
        data: snapshot.journalReview,
        revision: snapshot.revision
      };

      setCachedResponse('journalReview', {}, journalReviewResult);
      setCachedResponse('journalReview', {
        dateFrom: '',
        dateTo: '',
        helpOnly: false
      }, journalReviewResult);
    }
  }

  BRM.clearSiteCache = async function clearSiteCache() {
    responseCache.clear();
    snapshotMemory = null;
    snapshotLoadPromise = null;
    snapshotRefreshPromise = null;

    try {
      await deleteSnapshotRecord();
    } catch (error) {
      console.warn('Portal cache could not be cleared:', error);
    }
  };

  BRM.repairAdminNavigationContext = async function repairAdminNavigationContext() {
    const live = await rawApi('validateSession', {}, {});

    if (!contextAdminValue(live.context)) {
      throw new Error('The live server session does not currently contain administrator access.');
    }

    await BRM.clearSiteCache();

    localStorage.setItem('brmContext', JSON.stringify(live.context));
    BRM.context = live.context;
    sessionStorage.removeItem('brmSnapshotDisabledUntil');

    return live.context;
  };

  BRM.invalidateSiteCache = async function invalidateSiteCache() {
    responseCache.clear();
    snapshotMemory = null;

    try {
      await deleteSnapshotRecord();
    } catch (error) {
      console.warn('Portal cache could not be invalidated:', error);
    }

    dispatchSyncStatus('stale', 'Updates saved');
  };

  BRM.refreshSiteSnapshot = async function refreshSiteSnapshot(options = {}) {
    if (BRM.isDemo()) return null;
    if (snapshotRefreshPromise && !options.force) return snapshotRefreshPromise;

    snapshotRefreshPromise = (async () => {
      dispatchSyncStatus('syncing', options.firstLoad ? 'Preparing portal…' : 'Refreshing…');

      const result = await rawApi('bootstrap', {}, {});
      const snapshot = result.snapshot;

      if (!snapshot || !snapshot.context) {
        throw new Error('The portal snapshot was incomplete.');
      }

      let storedContext = null;

      try {
        storedContext = JSON.parse(localStorage.getItem('brmContext') || 'null');
      } catch {}

      snapshot.context = mergePortalContexts(snapshot.context, storedContext);

      if (snapshot.dashboard?.context) {
        snapshot.dashboard.context = mergePortalContexts(
          snapshot.dashboard.context,
          snapshot.context
        );
      }

      seedSnapshot(snapshot);
      localStorage.setItem('brmContext', JSON.stringify(snapshot.context));

      try {
        await writeSnapshotRecord(snapshot);
      } catch (error) {
        console.warn('Portal data loaded but could not be stored for later:', error);
      }

      dispatchSyncStatus('ready', 'Portal ready');
      window.dispatchEvent(new CustomEvent('brm:snapshot-updated', {
        detail: {
          revision: snapshot.revision,
          generatedAt: snapshot.generatedAt
        }
      }));

      return snapshot;
    })();

    try {
      return await snapshotRefreshPromise;
    } finally {
      snapshotRefreshPromise = null;
    }
  };

  BRM.ensureSiteSnapshot = async function ensureSiteSnapshot() {
    if (BRM.isDemo()) return null;
    if (snapshotMemory) return snapshotMemory;
    if (snapshotLoadPromise) return snapshotLoadPromise;

    snapshotLoadPromise = (async () => {
      const token = localStorage.getItem('brmToken') || '';
      let record = null;

      try {
        record = await readSnapshotRecord();
      } catch (error) {
        console.warn('Portal cache unavailable:', error);
      }

      const belongsToCurrentLogin = record && record.owner === token;
      const age = record ? Date.now() - Number(record.savedAt || 0) : Infinity;

      let currentContext = null;

      try {
        currentContext = JSON.parse(localStorage.getItem('brmContext') || 'null');
      } catch {}

      const wouldDowngrade = Boolean(
        record?.snapshot?.context
        && cachedContextWouldDowngrade(
          record.snapshot.context,
          currentContext
        )
      );

      const usable = Boolean(
        belongsToCurrentLogin
        && record.snapshot
        && age <= SNAPSHOT_MAX_MS
        && !wouldDowngrade
      );

      if (wouldDowngrade) {
        console.warn(
          'Discarding an older member snapshot because the current login is a Full Administrator.'
        );

        try {
          await deleteSnapshotRecord();
        } catch (error) {
          console.warn('The outdated member snapshot could not be deleted:', error);
        }
      }

      if (usable) {
        record.snapshot.context = mergePortalContexts(
          record.snapshot.context,
          currentContext
        );

        if (record.snapshot.dashboard?.context) {
          record.snapshot.dashboard.context = mergePortalContexts(
            record.snapshot.dashboard.context,
            record.snapshot.context
          );
        }

        seedSnapshot(record.snapshot);
        dispatchSyncStatus('cached', 'Loaded from device');

        if (age > SNAPSHOT_FRESH_MS) {
          window.setTimeout(() => {
            BRM.refreshSiteSnapshot().catch(error => {
              console.warn('Background portal refresh failed:', error);
              dispatchSyncStatus('offline', 'Using saved data');
            });
          }, 50);
        }

        return record.snapshot;
      }

      return BRM.refreshSiteSnapshot({ firstLoad: true, force: true });
    })();

    try {
      return await snapshotLoadPromise;
    } finally {
      snapshotLoadPromise = null;
    }
  };

  BRM.api = async function api(action, payload = {}, options = {}) {
    if (BRM.isDemo()) return BRM.demoApi(action, payload);

    const publicAction = options.public || ['login', 'register', 'registrationOptions', 'publicRecruitmentConfig', 'submitAuditionBooking', 'submitMusicalInterest'].includes(action);
    const neverCache = options.noCache || ['bootstrap', 'trackAudioInfo', 'trackAudioChunk', 'logout'].includes(action);

    if (!publicAction && !neverCache && CACHEABLE_ACTIONS.has(action) && !options.forceNetwork) {
      const cached = getCachedResponse(action, payload);
      if (cached) return cached;
    }

    const result = await rawApi(action, payload, { public: publicAction });

    if (!publicAction && CACHEABLE_ACTIONS.has(action) && !neverCache) {
      setCachedResponse(action, payload, result);
    }

    if (MUTATING_ACTIONS.has(action)) {
      await BRM.invalidateSiteCache();

      if (!['changePassword', 'startNewProduction', 'approveProductionDeletion'].includes(action)) {
        window.setTimeout(() => {
          BRM.refreshSiteSnapshot({ force: true }).catch(error => {
            console.warn('Portal refresh after update failed:', error);
          });
        }, 150);
      }
    }

    return result;
  };

  const demoContext = {
    userId: 'USR-DEMO', username: 'demo', email: 'demo@example.ca', isAdmin: true,
    profile: { ProfileID: 'PROF-DEMO', DisplayName: 'Justin La', FirstName: 'Justin', LastName: 'La', Pronouns: 'he/him', Grade: 'Staff', Bio: 'Music director and production administrator.', Theme: 'bedford-dark', PhotoURL: '' },
    production: { ProductionID: 'PROD-DEMO', Title: 'Descendants: The Musical', ShortTitle: 'Descendants', SchoolYear: '2026–2027', DefaultTheme: 'bedford-dark', Status: 'Active' },
    departmentIds: ['DEP-STAGE', 'DEP-ENSEMBLE', 'DEP-PIT'],
    departments: [
      { DepartmentID: 'DEP-STAGE', Name: 'Stage Management', Slug: 'stage-management', Icon: 'clipboard', Description: 'Calls, reports, schedules, and production coordination.' },
      { DepartmentID: 'DEP-ENSEMBLE', Name: 'Ensemble', Slug: 'ensemble', Icon: 'users', Description: 'Ensemble music, choreography, scenes, and calls.' },
      { DepartmentID: 'DEP-PIT', Name: 'Pit Orchestra', Slug: 'pit-orchestra', Icon: 'music', Description: 'Music, calls, equipment, and orchestra information.' }
    ],
    permissions: ['admin.all', 'notes.post', 'journals.own', 'journal.review', 'announcement.manage', 'event.manage', 'department.manage'],
    mustChangePassword: false
  };

  const demoAnnouncements = [
    { AnnouncementID: 'ANN-1', Title: 'Full company rehearsal moved to the theatre', Body: 'Wednesday’s rehearsal begins at 3:45 PM on stage. Bring water, dance shoes, and a pencil.', Priority: 'Urgent', Pinned: 'TRUE', AcknowledgementRequired: 'TRUE', CreatedAt: new Date().toISOString(), AuthorName: 'Stage Management' },
    { AnnouncementID: 'ANN-2', Title: 'Costume measurements due Friday', Body: 'Anyone who has not completed a measurement form should visit the costume room before Friday afternoon.', Priority: 'Important', Pinned: 'FALSE', AcknowledgementRequired: 'FALSE', CreatedAt: new Date(Date.now() - 86400000).toISOString(), AuthorName: 'Costume Team' }
  ];
  const demoEvents = [
    { EventID: 'EV-1', Title: 'Full Company Rehearsal', EventType: 'Rehearsal', StartAt: new Date(Date.now() + 3 * 3600000).toISOString(), EndAt: new Date(Date.now() + 6 * 3600000).toISOString(), Location: 'Bedford Theatre', WhatToBring: 'Water, pencil, dance shoes' },
    { EventID: 'EV-2', Title: 'Pit Orchestra Read-Through', EventType: 'Music', StartAt: new Date(Date.now() + 2 * 86400000).toISOString(), EndAt: new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(), Location: 'Room 132' }
  ];
  const demoTasks = [
    { TaskID: 'TASK-1', Title: 'Confirm Act I prop preset', Description: 'Photograph the stage-left table after the preset is complete.', DueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), Priority: 'Important', Status: 'Open', DepartmentID: 'DEP-STAGE' },
    { TaskID: 'TASK-2', Title: 'Practice Ways to Be Wicked', Description: 'Review choreography and vocal track before Wednesday.', DueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), Priority: 'Normal', Status: 'Open', DepartmentID: 'DEP-ENSEMBLE' }
  ];

  let demoNotes = [
    { NoteID: 'NOTE-1', AuthorUserID: 'USR-STUDENT', AuthorName: 'Taylor Smith', AuthorPhotoURL: '', Content: 'The crown has been moved to the stage-left prop table.', CreatedAt: new Date(Date.now() - 4500000).toISOString(), UpdatedAt: new Date(Date.now() - 4500000).toISOString(), Status: 'Published' }
  ];
  let demoJournals = [
    { JournalEntryID: 'JRN-1', EntryDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10), ActivityTitle: 'Full company rehearsal', ActivityType: 'Rehearsal', WorkCompleted: 'Reviewed the Act I transitions and helped reset props.', Successes: 'The transitions became much faster.', Challenges: 'I missed one entrance while moving a set piece.', SuccessRating: 4, MinutesWorked: 150, NextStep: 'Mark the entrance in my script.', HelpRequested: 'FALSE', HelpDetails: '', Status: 'Submitted' }
  ];

  BRM.demoApi = async function demoApi(action, payload) {
    await new Promise(resolve => setTimeout(resolve, 120));
    switch (action) {
      case 'login': return { success: true, token: 'demo-token', user: demoContext };
      case 'registrationOptions': return {
        success: true,
        departments: demoContext.departments
      };
      case 'register': return {
        success: true,
        requestedDepartmentCount: (payload.requestedDepartmentIds || []).length,
        message: 'Demo account created and production-area requests submitted.'
      };
      case 'validateSession': return { success: true, context: demoContext };
      case 'logout': return { success: true };
      case 'dashboard': return { success: true, context: demoContext, announcements: demoAnnouncements, events: demoEvents, tasks: demoTasks, departments: demoContext.departments, journal: { totalEntries: demoJournals.length, lastEntryDate: demoJournals[0]?.EntryDate || '', helpReviewCount: 1 }, adminStats: { activeUsers: 48, journalEntries: 126, openTasks: 19, upcomingEvents: 12 } };
      case 'getProfile': return {
        success: true,
        context: demoContext,
        departmentAccess: {
          assigned: demoContext.departments,
          requests: [],
          availableDepartments: demoContext.departments,
          pendingCount: 0
        }
      };
      case 'myDepartmentRequests': return {
        success: true,
        departmentAccess: {
          assigned: demoContext.departments,
          requests: [],
          availableDepartments: demoContext.departments,
          pendingCount: 0
        }
      };
      case 'saveMyDepartmentRequests': return {
        success: true,
        departmentAccess: {
          assigned: demoContext.departments,
          requests: [],
          availableDepartments: demoContext.departments,
          pendingCount: 0
        }
      };
      case 'updateProfile': Object.assign(demoContext.profile, payload); return { success: true, profile: demoContext.profile };
      case 'uploadProfilePhoto': return { success: true, url: payload.dataUrl };
      case 'removeProfilePhoto': demoContext.profile.PhotoURL = ''; return { success: true };
      case 'announcements': return { success: true, data: demoAnnouncements };
      case 'saveAnnouncement': demoAnnouncements.unshift({ AnnouncementID: `ANN-${Date.now()}`, Title: payload.title, Body: payload.body, Priority: payload.priority, Pinned: payload.pinned ? 'TRUE' : 'FALSE', AcknowledgementRequired: payload.acknowledgementRequired ? 'TRUE' : 'FALSE', CreatedAt: new Date().toISOString(), AuthorName: 'Justin La' }); return { success: true };
      case 'archiveAnnouncement': return { success: true };
      case 'deleteAnnouncement': return { success: true };
      case 'acknowledgeAnnouncement': return { success: true };
      case 'schedule': return { success: true, data: demoEvents };
      case 'saveEvent': return { success: true };
      case 'departments': return { success: true, data: demoContext.departments };
      case 'departmentWorkspace': {
        const slug = payload.slug || 'ensemble';
        const dep = demoContext.departments.find(d => d.Slug === slug) || { DepartmentID: `DEP-${slug}`, Name: BRM.titleCase(slug), Slug: slug, Description: 'Production department workspace.' };
        return { success: true, department: dep, canManage: true, items: [
          { DepartmentItemID: 'ITEM-1', ItemType: 'Update', Title: 'Department priority', Category: 'This Week', Description: 'Complete assigned preparation before the next full company rehearsal.', Status: 'In Progress', Priority: 'Important', DueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10), Location: 'Bedford Theatre', MetadataJSON: '{}' }
        ], tasks: demoTasks, resources: [{ ResourceID: 'RES-1', Title: 'Department Handbook', Description: 'Procedures and expectations.', ResourceType: 'Link', URL: '#', DepartmentID: dep.DepartmentID }] };
      }
      case 'saveDepartmentItem': return { success: true };
      case 'saveTask': return { success: true };
      case 'myTasks': return { success: true, data: demoTasks };
      case 'updateTaskStatus': return { success: true };
      case 'resources': return { success: true, data: [
        { ResourceID: 'RES-1', Title: 'Company Handbook', Description: 'Production expectations, safety, and communication.', ResourceType: 'Document', URL: '#', DepartmentID: '' },
        { ResourceID: 'RES-2', Title: 'Descendants Script Notes', Description: 'Current shared notes and revisions.', ResourceType: 'Document', URL: '#', DepartmentID: 'DEP-ENSEMBLE' }
      ] };
      case 'tracks': return { success: true, data: [
        { TrackID: 'TRK-1', Title: 'Rotten to the Core (Part 1)', TrackType: 'Guide Vocal', SortOrder: 3, URL: 'assets/audio/demo-overture.mp3', Notes: '' },
        { TrackID: 'TRK-2', Title: 'Ways to Be Wicked', TrackType: 'Practice', SortOrder: 36, URL: 'assets/audio/demo-overture.mp3', Notes: '' }
      ] };
      case 'pageNotes': return { success: true, data: demoNotes };
      case 'createPageNote': demoNotes.push({ NoteID: `NOTE-${Date.now()}`, AuthorUserID: demoContext.userId, AuthorName: demoContext.profile.DisplayName, Content: payload.content, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString(), Status: 'Published' }); return { success: true };
      case 'editPageNote': return { success: true };
      case 'deletePageNote': demoNotes = demoNotes.filter(n => n.NoteID !== payload.noteId); return { success: true };
      case 'myJournal': return { success: true, entries: demoJournals, feedback: [] };
      case 'saveJournalEntry': demoJournals.unshift({ ...payload, JournalEntryID: payload.journalEntryId || `JRN-${Date.now()}`, StudentUserID: demoContext.userId }); return { success: true };
      case 'journalReview': return { success: true, data: demoJournals.map(j => ({ ...j, StudentName: 'Taylor Smith', Feedback: [] })) };
      case 'saveJournalFeedback': return { success: true };
      case 'directory': return { success: true, data: [
        { userId: 'USR-1', displayName: 'Taylor Smith', pronouns: 'they/them', grade: '11', bio: 'Ensemble and props.', photoUrl: '', departments: ['Ensemble', 'Props'] },
        { userId: 'USR-2', displayName: 'Morgan Lee', pronouns: 'she/her', grade: '12', bio: 'Stage manager.', photoUrl: '', departments: ['Stage Management'] },
        { userId: 'USR-3', displayName: 'Alex Chen', pronouns: 'he/him', grade: '10', bio: 'Percussion and sound.', photoUrl: '', departments: ['Pit Orchestra', 'Sound'] }
      ] };
      case 'reviewDepartmentRequest': return { success: true, saved: true };
      case 'adminData': return { success: true, departmentRequests: [], users: [
        { UserID: 'USR-DEMO', Username: 'demo', Email: 'demo@example.ca', Status: 'Active', IsFullAdmin: 'TRUE', DisplayName: 'Justin La', DepartmentIDs: ['DEP-STAGE'], GroupIDs: [] },
        { UserID: 'USR-1', Username: 'taylor', Email: '', Status: 'Active', IsFullAdmin: 'FALSE', DisplayName: 'Taylor Smith', DepartmentIDs: ['DEP-ENSEMBLE'], GroupIDs: ['GRP-STUDENT'] }
      ], departments: demoContext.departments, permissionGroups: [{ PermissionGroupID: 'GRP-STUDENT', GroupName: 'Student Participant' }, { PermissionGroupID: 'GRP-STAGE', GroupName: 'Stage Management Lead' }], registrationCodes: [{ Code: 'BEDFORD-STUDENT-2026', Label: 'Student registration', Uses: 14, MaxUses: 250, Status: 'Active' }], productions: [demoContext.production], resetRequests: [], stats: { activeUsers: 48, journalEntries: 126, openTasks: 19, upcomingEvents: 12 } };
      case 'saveUserAccess': return { success: true };
      case 'createRegistrationCode': return { success: true };
      case 'startNewProduction': return { success: true, productionId: `PROD-${Date.now()}` };
      case 'requestProductionDeletion': return { success: true, resetRequestId: `RESET-${Date.now()}` };
      case 'approveProductionDeletion': return { success: true };
      default: return { success: true, data: [] };
    }
  };
})(window.BRM);
