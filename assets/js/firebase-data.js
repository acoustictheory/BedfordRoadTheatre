window.BRM = window.BRM || {};
(function (BRM) {
  let modulesPromise;
  const legacyRecord = record => Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (key.startsWith('_')) return [key, value];
    const converted = key.replace(/Ids(?=$|[A-Z])/g, 'IDs').replace(/Id(?=$|[A-Z])/g, 'ID').replace(/Url(?=$|[A-Z])/g, 'URL');
    return [converted.charAt(0).toUpperCase() + converted.slice(1), value];
  }));
  async function modules() {
    const config = window.BRM_CONFIG?.FIREBASE;
    if (!config || window.BRM_CONFIG?.FIREBASE_MODE === 'off') throw new Error('Firebase is disabled.');
    modulesPromise ||= Promise.all([
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
    ]).then(([appApi, authApi, storeApi]) => {
      const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(config);
      return { auth: authApi.getAuth(app), db: storeApi.getFirestore(app), storeApi };
    });
    return modulesPromise;
  }
  BRM.firebaseCollection = async function (collectionName) {
    const loaded = await modules();
    await loaded.auth.authStateReady();
    if (!loaded.auth.currentUser) throw new Error('Firebase session is unavailable.');
    const productionId = BRM.context?.production?.ProductionID;
    if (!productionId) throw new Error('Active production is unavailable.');
    const snapshot = await loaded.storeApi.getDocs(loaded.storeApi.collection(loaded.db, 'productions', productionId, collectionName));
    return snapshot.docs.map(document => legacyRecord(document.data()));
  };
  BRM.firebaseRootCollection = async function (collectionName) {
    const loaded = await modules();
    await loaded.auth.authStateReady();
    if (!loaded.auth.currentUser) throw new Error('Firebase session is unavailable.');
    const snapshot = await loaded.storeApi.getDocs(loaded.storeApi.collection(loaded.db, collectionName));
    return snapshot.docs.map(document => ({ ...legacyRecord(document.data()), _DocumentID:document.id }));
  };
  BRM.firebaseUpdateProfile = async function (values) {
    const loaded = await modules();
    await loaded.auth.authStateReady();
    const user = loaded.auth.currentUser;
    if (!user) throw new Error('Firebase session is unavailable.');
    await loaded.storeApi.setDoc(
      loaded.storeApi.doc(loaded.db, 'profiles', user.uid),
      { ...values, updatedAt: loaded.storeApi.serverTimestamp() },
      { merge: true }
    );
  };
  BRM.firebaseWorkspaceOverlay = async function (base, mapping, includeArchived) {
    const entries = await Promise.all(Object.entries(mapping).map(async ([target, collectionName]) => {
      try {
        let rows = await BRM.firebaseCollection(collectionName);
        if (!includeArchived) rows = rows.filter(row => String(row.Status || 'Active') !== 'Archived');
        return [target, rows];
      } catch (error) {
        if (String(error?.code || '').includes('permission-denied')) return [target, base?.[target] || []];
        throw error;
      }
    }));
    return Object.assign({}, base, Object.fromEntries(entries), { firebaseFresh: true });
  };
  const permissions = () => new Set(BRM.context?.permissions || []);
  const fullAdmin = () => Boolean(BRM.context?.isAdmin || permissions().has('admin.all'));
  const workspacePermissions = prefix => {
    const allowed = key => fullAdmin() || permissions().has(`${prefix}.${key}`);
    return { canView:true, canContribute:allowed('contribute') || allowed('edit'), canEdit:allowed('edit'), canManage:allowed('manage'), canArchive:allowed('archive'), canAudit:allowed('audit'), canDelete:fullAdmin(), permanentDelete:fullAdmin(), view:true, contribute:allowed('contribute') || allowed('edit'), manage:allowed('manage'), archive:allowed('archive'), audit:allowed('audit'), isAdmin:fullAdmin() };
  };
  async function firebaseTeam(slug) {
    const people = await BRM.firebaseRootCollection('communityMembers');
    return people.filter(person => fullAdmin() || (person.Departments || []).some(item => String(item.name || item.Name || '').toLowerCase().includes(slug)));
  }
  BRM.firebasePropsHub = async function (includeArchived = false) {
    const data = await BRM.firebaseWorkspaceOverlay({}, { inventory:'propsInventory', presets:'propsPresets', deadlines:'propsDeadlines', images:'propsImages', suggestions:'propsSuggestions', activity:'propsActivity', tasks:'tasks', announcements:'announcements' }, includeArchived);
    data.tasks=(data.tasks||[]).filter(item=>String(item.RelatedType||'').toLowerCase()==='prop');
    data.permissions=workspacePermissions('props');data.team=await firebaseTeam('prop');data.department={Name:'Props',Slug:'props'};data.folderUrl='';
    data.stats={ total:(data.inventory||[]).length, ready:(data.inventory||[]).filter(item=>String(item.Status).toLowerCase()==='ready').length, overdue:(data.deadlines||[]).filter(item=>item.DueDate&&Date.parse(item.DueDate)<Date.now()&&String(item.Status).toLowerCase()!=='completed').length };
    return data;
  };
  BRM.firebaseScenicHub = async function (includeArchived = false) {
    const data = await BRM.firebaseWorkspaceOverlay({}, { sets:'scenicSets', elements:'scenicElements', transitions:'scenicTransitions', deadlines:'scenicDeadlines', images:'scenicImages', suggestions:'scenicSuggestions', activity:'scenicActivity', tasks:'tasks', announcements:'announcements' }, includeArchived);
    data.tasks=(data.tasks||[]).filter(item=>['scenic','set'].includes(String(item.RelatedType||'').toLowerCase()));data.permissions=workspacePermissions('scenic');data.team=await firebaseTeam('scenic');data.department={Name:'Sets & Scenic Design',Slug:'sets'};data.folderUrl='';data.context=BRM.context;data.success=true;data.firebaseFresh=true;data.stats={sets:(data.sets||[]).length,elements:(data.elements||[]).length};return data;
  };
  BRM.firebaseCostumeHub = async function (includeArchived = false) {
    const data = await BRM.firebaseWorkspaceOverlay({}, { characters:'costumeCharacters', changes:'costumeChanges', measurements:'costumeMeasurements', fittings:'costumeFittings', pieces:'costumePieces', deadlines:'costumeDeadlines', images:'costumeImages', suggestions:'costumeSuggestions', activity:'costumeActivity', tasks:'tasks', announcements:'announcements' }, includeArchived);
    data.tasks=(data.tasks||[]).filter(item=>String(item.RelatedType||'').toLowerCase()==='costume');data.permissions=workspacePermissions('costume');data.team=await firebaseTeam('costume');data.department={Name:'Costumes',Slug:'costumes'};data.folderUrl='';data.firebaseFresh=true;data.stats={characters:(data.characters||[]).length,pieces:(data.pieces||[]).length};return data;
  };
  BRM.firebaseBlockingHub = async function (includeArchived = false) {
    const data=await BRM.firebaseWorkspaceOverlay({}, { sections:'blockingSections', cues:'blockingCues', characters:'blockingCharacters', groups:'blockingGroups', cast:'blockingCast', anchors:'blockingScriptAnchors', backgrounds:'blockingBackgrounds', snapshots:'blockingSnapshots', activity:'blockingActivity' }, includeArchived);
    const [people,productions]=await Promise.all([BRM.firebaseRootCollection('communityMembers'),BRM.firebaseRootCollection('productions')]);
    const peopleById=new Map(people.map(person=>[String(person.UserId||person.UserID||person._DocumentID),person])),charactersById=new Map((data.characters||[]).map(character=>[String(character.CharacterID),character]));
    data.cast=(data.cast||[]).map(item=>{const person=peopleById.get(String(item.UserID))||{},character=charactersById.get(String(item.CharacterID))||{};return {...item,CharacterName:character.CharacterName||item.DisplayLabel||'Unassigned',CharacterKey:character.CharacterKey||'',World:character.World||'',PersonName:person.DisplayName||'',PhotoURL:person.PhotoURL||'',PhotoFileID:person.PhotoFileID||''};});
    data.people=fullAdmin()?people:[];data.production=productions.find(item=>String(item.ProductionID||item._DocumentID)===String(BRM.context?.production?.ProductionID))||BRM.context?.production||{};data.permissions=workspacePermissions('blocking');data.build='firebase-blocking-v1';data.firebaseFresh=true;return data;
  };
  BRM.firebaseBlockingViewer = async function (base) {
    const data = await BRM.firebaseWorkspaceOverlay(base || {}, {
      sections:'blockingSections', cast:'blockingCast', snapshots:'blockingSnapshots',
      placements:'blockingPlacements', objects:'blockingObjects', media:'blockingTimelineMedia',
      markers:'blockingTimelineMarkers', keyframes:'blockingTimelineKeyframes', motions:'blockingTimelineMotions'
    }, false);
    const group = (rows, key) => rows.reduce((result, row) => ((result[String(row[key] || '')] ||= []).push(row), result), {});
    const placements = group(data.placements || [], 'SnapshotID');
    const objects = group(data.objects || [], 'SnapshotID');
    const timelineKey = row => `${Number(row.SceneNumber || 0)}::${String(row.CueNumber || '')}`;
    const timelines = {};
    for (const [name, rows] of [['Markers',data.markers],['Keyframes',data.keyframes],['Motions',data.motions]]) {
      for (const row of rows || []) (timelines[timelineKey(row)] ||= { Media:null, Markers:[], Keyframes:[], Motions:[] })[name].push(row);
    }
    for (const row of data.media || []) (timelines[timelineKey(row)] ||= { Media:null, Markers:[], Keyframes:[], Motions:[] }).Media = row;
    data.snapshots = (data.snapshots || []).filter(row => String(row.Status || 'Active') !== 'Archived').map(row => ({
      ...row, Placements:placements[String(row.SnapshotID)] || [], Objects:objects[String(row.SnapshotID)] || [],
      Timeline:timelines[timelineKey(row)] || { Media:null, Markers:[], Keyframes:[], Motions:[] }
    }));
    return data;
  };
})(window.BRM);
