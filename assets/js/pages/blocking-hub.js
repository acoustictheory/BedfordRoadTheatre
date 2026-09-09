const BLOCKING_UI_BUILD='bedford-blocking-hub-v42-workspace-20260826';
const BLOCKING_SCENE_AUDIO_LIMITS={sourceMaxBytes:150*1024*1024,targetBytes:18*1024*1024,finalMaxBytes:24*1024*1024,recordingMaxBytes:24*1024*1024};
const BState={data:null,scene:1,cue:'',snapshotId:'',snapshot:null,placements:[],objects:[],selected:null,paletteTab:'cast',zoom:1,showMovement:true,showSeats:true,showTokenNames:true,multiSelectMode:false,selectedPlacements:new Set(),layout:{leftWidth:150,rightWidth:330,leftCollapsed:false,rightCollapsed:false,density:'compact',toolbar:{duplicate:true,undoRedo:true,multiSelect:true,names:true,export:true,fullscreen:true}},save:{monitor:0,autosaveTimer:0,lastSavedSnapshotFingerprint:'',lastSeenSnapshotFingerprint:'',snapshotDirty:false,snapshotSaving:false,snapshotPending:false,snapshotManualRequested:false,snapshotPromise:null,timelineDirty:false,lastSavedAt:'',lastError:''},previousSnapshot:null,undo:[],redo:[],stage:null,layers:{},tokenNodes:new Map(),objectNodes:new Map(),backgroundCache:new Map(),photoCache:new Map(),photoDataCache:new Map(),photoDataLoads:new Map(),photoImageCache:new Map(),photoCanvasCache:new Map(),photoStatus:new Map(),photoRequestQueue:[],photoRequestActive:0,photoObserver:null,photoRetryAttempts:new Map(),photoRetryTimers:new Map(),audioBlobLoads:new Map(),sceneAudioBlobLoads:new Map(),cache:{hubFreshening:false,timelineFreshening:new Map(),snapshotFreshening:new Map(),mediaIndex:[],mediaIndexLoaded:false,prefetchRunning:false},drawingShape:null,fauxFullscreen:false,timeline:{loaded:false,libraryLoaded:false,tracks:[],guideTracks:[],media:null,markers:[],keyframes:[],motions:[],audio:null,objectUrl:'',duration:180,current:0,speed:1,playing:false,loopA:null,loopB:null,sceneTimerBase:0,sceneTimerStartedAt:0,raf:0,trace:null,recording:null,showPaths:true,saving:false,pendingSave:false,manualSaveRequested:false,savePromise:null,sceneRecorder:null,recordStream:null,recordChunks:[],recordWakeLock:null,recordTick:0,uploadingRecording:false,recordings:[],audioLoadPromise:null,audioLoadKey:'',audioReady:false}};
const LOGICAL_W=1000,LOGICAL_H=1800;
BState.castGroup='A';
BState.objectEditMode=false;
BState.layout.timelineCollapsed=false;BState.layout.mainNavCollapsed=false;
BState.stageEditing={snap:false,gridX:50,gridY:50,collisionWarnings:true,collisionClearance:86,contextPaths:true};
BState.viewerLayout='full';BState.viewerSplitLastDraw=0;
BState.viewerSplitSharpTimer=0;
BState.splitDrag=null;
BState.splitView={top:{zoom:1,panX:0,panY:0},bottom:{zoom:1,panX:0,panY:0}};
BState.visualViewer={mode:'2d',camera:'high',videoUrl:'',videoOffset:0,primary:'2d',last3dDraw:0,yaw:0,zoom:1,lift:0,screenX:0,screenY:0,manualCamera:false,drag:null,exportRecorder:null,exportRaf:0};
BState.musicMap={bpm:120,meter:4,downbeat:0,snap:true,taps:[],tempoChanges:[],regions:[],waveform:[],waveformKey:''};
const BedfordFormation={shape:'circle',width:420,depth:300,rotation:0,rows:3,order:'forward',direction:'cw',snake:false,pin:false,expand:true,ghosts:true,preview:[],metrics:null};
// Bedford Road auditorium proportions are based on the venue sketch supplied for this production.
// The canvas is intentionally portrait, approximately 5:9, rather than square.
const VENUE={
  stageLipY:645,
  stageSideTopY:465,
  stageLeftX:105,
  stageRightX:895,
  scenicZone:{x:155,y:105,w:690,h:300},
  backgroundZone:{x:108,y:28,w:784,h:595},
  stairs:[
    {x:105,y:645,w:100,h:115,label:'SR STAIRS'},
    {x:450,y:645,w:100,h:115,label:'CENTRE STAIRS'},
    {x:795,y:645,w:100,h:115,label:'SL STAIRS'}
  ],
  seats:[
    {x:105,y:845,w:310,h:295,cols:6,rows:6},
    {x:585,y:845,w:310,h:295,cols:6,rows:6},
    {x:0,y:1225,w:415,h:285,cols:9,rows:6},
    {x:585,y:1225,w:415,h:285,cols:9,rows:6}
  ],
  centreAisle:{x:415,y:845,w:170,h:955},
  crossAisle:{x:0,y:1140,w:1000,h:85}
};

document.addEventListener('DOMContentLoaded',()=>BRM.initPrivatePage(async()=>{
  const main=document.querySelector('#app-main'); BRM.loading(main,'Opening Blocking & Staging Studio…');
  try{
    if(!window.Konva)throw new Error('The visual stage library could not load. Check the network connection and refresh.');
    loadBlockingUiPrefs();
    const cachedHub=blockingCacheRead('hub','active',12*60*60*1000);
    if(cachedHub?.data){
      BState.data=cachedHub.data;
      const firstScene=BState.data.sections?.[0]; BState.scene=Number(firstScene?.SceneNumber||1);
      renderShell(); initStage(); bindGlobalKeys();
      await chooseInitialSnapshot(true);
      await loadTimelineContext(true);
      startBlockingAutosaveMonitor();
      updateBlockingPerformanceStatus('cache','Loaded instantly · checking production…');
      refreshBlockingHubInBackground();
      warmBlockingMediaIndex();
      scheduleIdlePhotoHydration();
      return;
    }
    try{BState.data=await BRM.firebaseBlockingHub(false)}catch(firebaseError){console.warn('Firebase Blocking load failed; using legacy fallback.',firebaseError);BState.data=await BRM.api('blockingHub',{}, {noCache:true,forceNetwork:true})}
    blockingCacheWrite('hub','active',{data:BState.data});
    const firstScene=BState.data.sections?.[0]; BState.scene=Number(firstScene?.SceneNumber||1);
    renderShell(); initStage(); bindGlobalKeys(); await chooseInitialSnapshot(false); await loadTimelineContext(false); startBlockingAutosaveMonitor();
    updateBlockingPerformanceStatus('ready','Production ready');
    warmBlockingMediaIndex();
    scheduleIdlePhotoHydration();
  }catch(error){main.innerHTML=`<div class="alert alert-error">${BRM.escape(error.message)}</div>`;}
}));

function main(){return document.querySelector('#app-main')}
function perms(){return BState.data?.permissions||{}}
function canEdit(){return !!perms().canEdit}

function loadBlockingUiPrefs(){
  try{
    const raw=localStorage.getItem('bedfordBlockingUiPrefs');
    if(!raw)return;
    const prefs=JSON.parse(raw);
    if(typeof prefs.showTokenNames==='boolean')BState.showTokenNames=prefs.showTokenNames;
    if(typeof prefs.showSeats==='boolean')BState.showSeats=prefs.showSeats;
    if(typeof prefs.showMovement==='boolean')BState.showMovement=prefs.showMovement;
    if(typeof prefs.objectEditMode==='boolean')BState.objectEditMode=prefs.objectEditMode;
    if(['A','B'].includes(prefs.castGroup))BState.castGroup=prefs.castGroup;
    if(prefs.stageEditing&&typeof prefs.stageEditing==='object')BState.stageEditing={...BState.stageEditing,...prefs.stageEditing};
    if(['full','split'].includes(prefs.viewerLayout))BState.viewerLayout=prefs.viewerLayout;
    if(prefs.musicMap&&typeof prefs.musicMap==='object')BState.musicMap={...BState.musicMap,...prefs.musicMap,taps:[],waveform:[],waveformKey:''};
    if(prefs.layout&&typeof prefs.layout==='object'){
      if(Number.isFinite(Number(prefs.layout.leftWidth)))BState.layout.leftWidth=Math.max(110,Math.min(280,Number(prefs.layout.leftWidth)));
      if(Number.isFinite(Number(prefs.layout.rightWidth)))BState.layout.rightWidth=Math.max(260,Math.min(500,Number(prefs.layout.rightWidth)));
      if(typeof prefs.layout.leftCollapsed==='boolean')BState.layout.leftCollapsed=prefs.layout.leftCollapsed;
      if(typeof prefs.layout.rightCollapsed==='boolean')BState.layout.rightCollapsed=prefs.layout.rightCollapsed;
      if(typeof prefs.layout.timelineCollapsed==='boolean')BState.layout.timelineCollapsed=prefs.layout.timelineCollapsed;
      if(typeof prefs.layout.mainNavCollapsed==='boolean')BState.layout.mainNavCollapsed=prefs.layout.mainNavCollapsed;
      if(['compact','comfortable'].includes(prefs.layout.density))BState.layout.density=prefs.layout.density;
      if(prefs.layout.toolbar&&typeof prefs.layout.toolbar==='object')BState.layout.toolbar={...BState.layout.toolbar,...prefs.layout.toolbar};
    }
  }catch(_error){}
}
function saveBlockingUiPrefs(){
  try{
    localStorage.setItem('bedfordBlockingUiPrefs',JSON.stringify({
      showTokenNames:!!BState.showTokenNames,
      showSeats:!!BState.showSeats,
      showMovement:!!BState.showMovement,
      objectEditMode:!!BState.objectEditMode,
      castGroup:BState.castGroup,
      stageEditing:{...BState.stageEditing},
      viewerLayout:BState.viewerLayout,
      musicMap:{...BState.musicMap,taps:[],waveform:[],waveformKey:'',saveTimer:0},
      layout:{
        leftWidth:BState.layout.leftWidth,
        rightWidth:BState.layout.rightWidth,
        leftCollapsed:!!BState.layout.leftCollapsed,
        rightCollapsed:!!BState.layout.rightCollapsed,
        timelineCollapsed:!!BState.layout.timelineCollapsed,
        mainNavCollapsed:!!BState.layout.mainNavCollapsed,
        density:BState.layout.density,
        toolbar:{...BState.layout.toolbar}
      }
    }));
  }catch(_error){}
}

function blockingCacheScope(){
  const user=BRM.context?.userId||BRM.context?.user?.UserID||BRM.context?.profile?.UserID||BRM.context?.profile?.Username||'user';
  const production=BRM.context?.production?.ProductionID||'active';
  return `${String(user)}:${String(production)}`;
}
function blockingCacheKey(type,key){return `bedfordBlockingFast:v41.2.2:${blockingCacheScope()}:${type}:${String(key||'')}`}
function blockingCacheWrite(type,key,value){
  try{localStorage.setItem(blockingCacheKey(type,key),JSON.stringify({savedAt:Date.now(),value}));return true}catch(_error){return false}
}
function blockingCacheRead(type,key,maxAge=24*60*60*1000){
  try{const raw=localStorage.getItem(blockingCacheKey(type,key));if(!raw)return null;const parsed=JSON.parse(raw);if(!parsed||!parsed.savedAt||Date.now()-Number(parsed.savedAt)>maxAge)return null;return parsed.value||null}catch(_error){return null}
}
function blockingContextKey(scene=BState.scene,cue=BState.cue){return `${Number(scene)||0}:${String(cue||'')}`}
function cacheCurrentTimeline(){
  if(!BState.timeline.loaded)return;
  blockingCacheWrite('timeline',blockingContextKey(),{media:BState.timeline.media||null,markers:BState.timeline.markers||[],keyframes:(BState.timeline.keyframes||[]).map(({_state,...k})=>({...k,StateJSON:k.StateJSON||JSON.stringify(_state||{})})),motions:(BState.timeline.motions||[]).map(({_path,...m})=>({...m,PathJSON:m.PathJSON||JSON.stringify(_path||[])})),recordings:BState.timeline.recordings||[]});
}
function cacheCurrentSnapshot(){
  if(!BState.snapshotId||!BState.snapshot)return;
  blockingCacheWrite('snapshot',BState.snapshotId,{snapshot:BState.snapshot,placements:BState.placements.map(({_localId,...p})=>p),objects:BState.objects.map(({_localId,...o})=>o),movements:[]});
}
function cacheTracksLibrary(){if(BState.timeline.tracks?.length)blockingCacheWrite('tracks','library',{data:BState.timeline.tracks})}
function updateBlockingPerformanceStatus(state,text){
  const el=document.querySelector('[data-blocking-performance]');if(!el)return;el.dataset.state=state;el.textContent=text;
}
async function refreshBlockingHubInBackground(){
  if(BState.cache.hubFreshening)return;BState.cache.hubFreshening=true;
  try{
    let fresh;try{fresh=await BRM.firebaseBlockingHub(false)}catch(firebaseError){console.warn('Firebase Blocking refresh failed; using legacy fallback.',firebaseError);fresh=await BRM.api('blockingHub',{}, {noCache:true,forceNetwork:true})}
    BState.data=fresh;blockingCacheWrite('hub','active',{data:fresh});
    updateBlockingPerformanceStatus('ready','Production synced');
    // Refresh lightweight chrome without reconstructing the stage currently being edited.
    const nav=document.querySelector('[data-blocking-nav]');if(nav){nav.innerHTML=renderNavigator();bindNavigatorOnly();}
    const strip=document.querySelector('[data-snapshot-strip]');if(strip){strip.innerHTML=renderSnapshotStrip();bindSnapshotStripOnly();}
    refreshRight();
  }catch(error){updateBlockingPerformanceStatus('offline','Using fast local copy');console.warn('Blocking background refresh failed',error)}
  finally{BState.cache.hubFreshening=false}
}
function bindNavigatorOnly(){
  document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=async()=>{if(BState.timeline.sceneRecorder&&!confirm('A scene recording is still in progress. Discard it and change scenes?'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;if(BState.timeline.sceneRecorder)await discardSceneAudioRecording();stopTimelinePlayback(true);BState.scene=Number(b.dataset.scene);BState.cue='';BState.snapshotId='';BState.snapshot=null;BState.placements=[];BState.objects=[];BState.selected=null;BState.selectedPlacements.clear();BState.multiSelectMode=false;resetTimelineContext();renderShell();initStage();await chooseInitialSnapshot(true);await loadTimelineContext(true);scheduleIdlePhotoHydration();});
  document.querySelectorAll('[data-cue]').forEach(b=>b.onclick=async()=>{if(BState.timeline.sceneRecorder&&!confirm('A scene recording is still in progress. Discard it and change timelines?'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;if(BState.timeline.sceneRecorder)await discardSceneAudioRecording();stopTimelinePlayback(true);BState.cue=b.dataset.cue;BState.snapshotId='';BState.snapshot=null;BState.placements=[];BState.objects=[];BState.selected=null;BState.selectedPlacements.clear();BState.multiSelectMode=false;resetTimelineContext();renderShell();initStage();await chooseInitialSnapshot(true);await loadTimelineContext(true);scheduleIdlePhotoHydration();});
}
function bindSnapshotStripOnly(){document.querySelectorAll('[data-snapshot]').forEach(b=>b.onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;await loadSnapshot(b.dataset.snapshot,true);});}

function canManage(){return !!perms().canManage}
function sceneRecord(){return (BState.data.sections||[]).find(s=>Number(s.SceneNumber)===Number(BState.scene))}
function cueRecord(){return (BState.data.cues||[]).find(c=>String(c.CueNumber)===String(BState.cue))}
function anchorsForContext(){return (BState.data.anchors||[]).filter(a=>Number(a.SceneNumber||0)===Number(BState.scene)&&(!BState.cue||!a.CueNumber||String(a.CueNumber)===String(BState.cue))).sort((a,b)=>Number(a.SortOrder||0)-Number(b.SortOrder||0))}
function snapshotsForScene(){return (BState.data.snapshots||[]).filter(s=>Number(s.SceneNumber)===Number(BState.scene)&&String(s.Status)!=='Archived').sort((a,b)=>Number(a.SortOrder||0)-Number(b.SortOrder||0))}


function toolbarEnabled(key){return BState.layout?.toolbar?.[key]!==false}
function renderCommandBar(){
  return `<div class="blocking-toolbar blocking-toolbar-core blocking-commandbar" data-commandbar>
    <div class="blocking-command-group blocking-command-priority" aria-label="Primary stage views">
      ${toolbarEnabled('fullscreen')?'<button class="button button-primary button-small" data-fullscreen title="Enter full screen">⛶ <span class="blocking-command-text">Full Screen</span></button>':''}
      <button class="button button-secondary button-small ${BState.visualViewer.mode==='2d'?'is-active':''}" data-live-mode="2d" title="Edit the standard overhead stage">2D</button>
      <button class="button button-secondary button-small ${BState.visualViewer.mode==='3d'?'is-active':''}" data-live-mode="3d" title="Open the interactive 3D stage">3D</button>
      <button class="button button-secondary button-small ${BState.visualViewer.mode==='combined'?'is-active':''}" data-live-mode="combined" title="Show 2D, 3D and reference video together">2D + 3D + Video</button>
      <button class="button button-secondary button-small ${BState.visualViewer.mode==='video'?'is-active':''}" data-live-mode="video" title="Show the reference video">Video</button>
    </div>
    <div class="blocking-command-group blocking-command-layout">
      <button class="button button-secondary button-small" data-toggle-scenes title="Show or hide Scenes & Songs">☰ <span class="blocking-command-text">Scenes</span></button>
      <button class="button button-secondary button-small" data-toggle-tools title="Show or hide Company & Tools">⚙ <span class="blocking-command-text">Tools</span></button>
      <button class="button button-secondary button-small" data-toggle-timeline title="Show or hide the timeline"><span class="blocking-command-text">Timeline</span></button>
      <button class="button button-secondary button-small" data-toggle-main-nav title="Show or hide the main Bedford navigation"><span class="blocking-command-text">Main Nav</span></button>
      <button class="button button-secondary button-small" data-customize-workspace title="Customize panel widths and toolbar">⌘ <span class="blocking-command-text">Layout</span></button>
    </div>
    ${canEdit()?`<div class="blocking-command-group"><button class="button button-primary button-small" data-new-snapshot title="Create a new editable blocking snapshot">＋ <span class="blocking-command-text">Snapshot</span></button><button class="button button-secondary button-small blocking-save-all-button" data-save-snapshot title="Save the current blocking picture and timeline now">💾 <span class="blocking-command-text">Save All</span></button>${toolbarEnabled('duplicate')?'<button class="button button-secondary button-small" data-duplicate-snapshot title="Duplicate current snapshot">Duplicate</button>':''}</div>`:''}
    ${canEdit()?`<div class="blocking-command-group blocking-command-rehearsal"><button class="button button-primary button-small" data-capture-formation title="Capture every current performer/object position at the current timeline time">◆ <span class="blocking-command-text">Formation</span></button>${canManage()?'<button class="button button-secondary button-small" data-manage-cast title="Connect students to characters and manage ensemble assignments">👥 <span class="blocking-command-text">Manage Cast</span></button>':''}</div>`:''}
    ${toolbarEnabled('undoRedo')?`<div class="blocking-command-group"><button class="button button-secondary button-small" data-undo ${canEdit()?'':'disabled'} title="Undo">↶</button><button class="button button-secondary button-small" data-redo ${canEdit()?'':'disabled'} title="Redo">↷</button></div>`:''}
    <div class="blocking-command-spacer"></div>
    ${canEdit()?`<div class="blocking-save-indicator" data-save-status data-state="saved" title="Blocking is persisted to the production database"><span class="blocking-save-dot">✓</span><span data-save-status-text>Saved</span></div>`:''}
    ${currentSnapshotPhotoCasts().length?`<div class="blocking-photo-indicator" data-photo-status data-state="idle" title="Cast face loading status"><span class="blocking-photo-dot">👤</span><span data-photo-status-text>Faces —</span></div><button class="button button-secondary button-small" data-refresh-missing-faces title="Retry cast faces that are still missing">↻ <span class="blocking-command-text">Faces</span></button>`:''}
    <div class="blocking-command-group blocking-command-view">
      ${toolbarEnabled('multiSelect')&&canEdit()?`<button class="button button-secondary button-small ${BState.multiSelectMode?'is-active':''}" data-multi-select-mode title="Tap several performers to select them together" aria-pressed="${BState.multiSelectMode?'true':'false'}">☑ <span class="blocking-command-text">Multi</span></button>`:''}
      ${toolbarEnabled('names')?`<button class="button button-secondary button-small" data-toggle-token-names title="Show or hide performer labels">${BState.showTokenNames?'Names On':'Names Off'}</button>`:''}
      ${toolbarEnabled('export')?'<button class="button button-secondary button-small" data-export-image title="Save the current blocking picture as a PNG">📷 <span class="blocking-command-text">Image</span></button>':''}
    </div>
  </div>`;
}
function renderShell(){
  const s=sceneRecord();
  enhanceBlockingTopbar(s);
  main().innerHTML=`<div class="blocking-page">
    <div class="blocking-hero"><div><span class="eyebrow">Director / Stage Management Workspace</span><h1>Blocking & Staging Studio</h1><p>Block scenes and songs against the Bedford auditorium, synchronized music, rehearsal dialogue audio, cast, props, furniture, and scenic traffic.</p></div><div><div class="blocking-build">${BLOCKING_UI_BUILD}</div><div class="blocking-stat-row"><span class="blocking-stat blocking-performance-chip" data-blocking-performance data-state="ready">Fast mode</span><span class="blocking-stat">18 scenes</span><span class="blocking-stat">44 cues + optional #45</span><span class="blocking-stat">${(BState.data.cast||[]).length} cast assignments</span><span class="blocking-stat">Bedford auditorium map</span></div></div></div>
    <div class="blocking-source-note"><strong>Private rehearsal workspace:</strong> scene recordings and dialogue cues stay inside the authenticated production system and private production Drive. Follow your school/production recording policy when recording rehearsals.</div>
    <div class="blocking-workspace">
      <button class="blocking-main-nav-tab" data-toggle-main-nav title="Show or hide the Bedford administrator and production navigation" aria-label="Toggle Bedford main navigation"><span data-main-nav-tab-label>Hide main navigation</span></button>
      <button class="blocking-rail-return blocking-rail-return-left" data-restore-left title="Show Scenes & Songs" aria-label="Show Scenes & Songs">☰ <span>Scenes</span> ›</button>
      <button class="blocking-rail-return blocking-rail-return-right" data-restore-right title="Show Company & Tools" aria-label="Show Company & Tools">‹ <span>Tools</span> ⚙</button>
      <section class="blocking-panel blocking-scene-panel"><div class="blocking-panel-head"><strong>Scenes & Songs</strong><div class="blocking-panel-head-actions"><span class="badge">Book p.${BRM.escape(s?.BookPage||'—')}</span><button class="button button-secondary button-small blocking-panel-collapse" data-collapse-left title="Collapse Scenes & Songs">‹</button></div></div><div class="blocking-panel-body blocking-nav" data-blocking-nav>${renderNavigator()}</div></section><div class="blocking-panel-resizer blocking-panel-resizer-left" data-panel-resizer="left" title="Drag to resize Scenes & Songs"></div>
      <section class="blocking-panel blocking-stage-shell">
        <div class="blocking-panel-head blocking-stage-context"><div><strong data-stage-title>Scene ${BState.scene}: ${BRM.escape(s?.Title||'')}</strong><span class="blocking-stage-song" data-stage-subtitle>${cueRecord()?`#${cueRecord().CueNumber} ${BRM.escape(cueRecord().Title)}`:'Scene / dialogue blocking'}</span></div><div class="blocking-stage-context-status"><span data-stage-count>0 people · 0 objects</span><span class="badge" data-save-state>${canEdit()?'Editable':'View only'}</span></div></div>
        ${renderCommandBar()}
        <div class="blocking-stage-wrap" data-stage-drop>
          <div class="blocking-viewer-layout-controls" aria-label="Venue viewer layout"><button class="button button-secondary button-small ${BState.viewerLayout==='split'?'is-active':''}" data-viewer-layout="split">Split view</button><button class="button button-secondary button-small ${BState.viewerLayout==='full'?'is-active':''}" data-viewer-layout="full">Full length</button></div>
          <div class="blocking-trace-banner" data-trace-banner hidden><strong>Trace Path</strong><small data-trace-copy>Drag on the venue map to draw the selected route.</small><button class="button button-secondary button-small" data-cancel-trace>Cancel</button></div>
          <div class="blocking-draw-banner" data-draw-banner hidden><strong>Drawing custom shape</strong><span>Click or tap each corner. Use at least 3 points.</span><button class="button button-primary button-small" data-finish-shape>Finish</button><button class="button button-secondary button-small" data-cancel-shape>Cancel</button></div>
          <div class="blocking-stage-container" id="blocking-stage"></div>
          <div class="blocking-split-view" data-split-view hidden><figure><img data-split-bottom alt="Bottom half of Bedford venue map"><figcaption>Bottom half</figcaption></figure><figure><img data-split-top alt="Top half of Bedford venue map"><figcaption>Top half</figcaption></figure></div>
          <div class="bedford-live-viewers" data-live-viewers hidden><section class="bedford-view-pane" data-pane="2d"><img data-combined-2d alt="Live 2D Bedford blocking"></section><section class="bedford-view-pane" data-pane="3d"><canvas data-bedford-3d width="1000" height="700"></canvas><div class="bedford-camera-help">Drag to orbit · wheel to zoom</div><div class="bedford-camera-controls"><button data-camera="overhead">Overhead</button><button data-camera="high">High Judge</button><button data-camera="low">Low Judge</button><button data-camera="floor">Floor Judge</button></div></section><section class="bedford-view-pane" data-pane="video"><video data-reference-video playsinline muted controls></video><div class="bedford-video-empty" data-video-empty>Choose a local reference video in View & Canvas.</div></section></div>
        </div>
        ${renderZoomDock()}
        <div class="blocking-snapshot-strip" data-snapshot-strip>${renderSnapshotStrip()}</div>
        <div class="blocking-rehearsal-dock">
          <div data-timeline>${renderTimelineDock()}</div>
        </div>
      </section>
      <div class="blocking-panel-resizer blocking-panel-resizer-right" data-panel-resizer="right" title="Drag to resize Company & Tools"></div>
      <section class="blocking-panel blocking-right-panel">
        <div class="blocking-panel-head"><strong>Company & Tools</strong><div class="blocking-panel-head-actions"><span class="badge">Director rail</span><button class="button button-secondary button-small blocking-panel-collapse" data-collapse-right title="Collapse Company & Tools">›</button></div></div>
        <div class="blocking-right-scroll">
          <div class="blocking-director-tools">
            <details class="blocking-tool-group blocking-palette-zone" open><summary><span><small class="blocking-tool-step">1 · ADD</small>Cast, Groups & Objects</span></summary><div class="blocking-tool-body"><div class="blocking-right-tabs"><div class="blocking-tabs"><button class="blocking-tab ${BState.paletteTab==='cast'?'active':''}" data-palette-tab="cast">Cast</button><button class="blocking-tab ${BState.paletteTab==='groups'?'active':''}" data-palette-tab="groups">Groups</button><button class="blocking-tab ${BState.paletteTab==='elements'?'active':''}" data-palette-tab="elements">Objects</button></div></div><div data-right-panel>${renderPalette()}</div></div></details>
            <details class="blocking-tool-group blocking-selected-dock" ${BState.selected?'open':''}><summary><span><small class="blocking-tool-step">2 · EDIT</small>Selected Item</span></summary><div class="blocking-tool-body" data-inspector-dock>${renderInspector()}</div></details>
            <details class="blocking-tool-group"><summary><span><small class="blocking-tool-step">3 · ANIMATE</small>${isSongTimeline()?'Music & Motion':'Scene Audio & Motion'}</span></summary><div class="blocking-tool-body" data-timeline-tool-panel>${renderTimelineToolPanel()}</div></details>
            ${canEdit()?`<details class="blocking-tool-group blocking-formation-dock"><summary><span><small class="blocking-tool-step">4 · ARRANGE</small>Formation Lab</span></summary><div class="blocking-tool-body"><button class="button button-secondary button-small bedford-formation-ghost-toggle ${BedfordFormation.ghosts?'is-active':''}" data-bedford-ghosts aria-pressed="${BedfordFormation.ghosts}">Ghosts ${BedfordFormation.ghosts?'On':'Off'}</button>${renderBedfordFormationLab()}</div></details>`:''}
            <details class="blocking-tool-group"><summary><span><small class="blocking-tool-step">SETUP</small>Stage & Objects</span></summary><div class="blocking-tool-body">${renderStageToolPanel()}</div></details>
            <details class="blocking-tool-group"><summary><span><small class="blocking-tool-step">DISPLAY</small>View, Grid & Export</span></summary><div class="blocking-tool-body">${renderViewToolPanel()}</div></details>
          </div>
        </div>
      </section>
    </div>
    <div class="blocking-lower">
      <section class="blocking-panel"><div class="blocking-panel-head"><div><strong>Script / Cue Anchors</strong><div class="field-hint">Attach snapshots to exact lines, lyrics, counts, measures, or stage directions.</div></div>${canEdit()?'<button class="button button-primary button-small" data-new-anchor>+ Anchor</button>':''}</div><div class="blocking-panel-body"><div class="blocking-anchor-list" data-anchor-list>${renderAnchors()}</div></div></section>
      <section class="blocking-panel"><div class="blocking-panel-head"><div><strong>Snapshot Details</strong><div class="field-hint">Current picture, cue link, type, notes, and lock state.</div></div>${canManage()?'<button class="button button-secondary button-small" data-history>History</button>':''}</div><div class="blocking-panel-body" data-snapshot-detail>${renderSnapshotDetails()}</div></section>
    </div>
  </div>`;
  bindUI(); scheduleIdlePhotoHydration();
}
function enhanceBlockingTopbar(scene){
  const heading=document.querySelector('.topbar-production');
  if(!heading)return;
  heading.classList.add('blocking-topbar-heading');
  heading.innerHTML=`<strong>Blocking &amp; Staging Studio</strong><span>${BRM.escape(BRM.context?.production?.Title||'Bedford production')} · Scene ${Number(scene?.SceneNumber||BState.scene)}${scene?.Title?` · ${BRM.escape(scene.Title)}`:''}</span><small title="Scene recordings and dialogue cues stay inside the authenticated production system and private production Drive.">Private rehearsal workspace · scene recordings and dialogue cues remain in authenticated production storage</small>`;
}
function renderNavigator(){return (BState.data.sections||[]).map(s=>{const cues=(BState.data.cues||[]).filter(c=>Number(c.SceneNumber)===Number(s.SceneNumber));return `<div class="blocking-scene"><button class="blocking-scene-button ${Number(s.SceneNumber)===Number(BState.scene)?'active':''}" data-scene="${s.SceneNumber}"><span class="blocking-scene-no">${s.SceneNumber}</span><span><span class="blocking-scene-title">${BRM.escape(s.Title)}</span><small style="display:block;color:var(--muted)">Book p.${BRM.escape(s.BookPage||'—')}</small></span></button>${Number(s.SceneNumber)===Number(BState.scene)?`<div class="blocking-cues"><button class="blocking-cue-button ${!BState.cue?'active':''}" data-cue="">Scene / dialogue</button>${cues.map(c=>`<button class="blocking-cue-button ${String(BState.cue)===String(c.CueNumber)?'active':''} ${String(c.Optional)==='Yes'?'optional':''}" data-cue="${c.CueNumber}">#${c.CueNumber} ${BRM.escape(c.Title)}</button>`).join('')}</div>`:''}</div>`}).join('')}
function renderSnapshotStrip(){const rows=snapshotsForScene().filter(s=>!BState.cue||!s.CueNumber||String(s.CueNumber)===String(BState.cue));return rows.length?rows.map(s=>`<button class="blocking-snapshot-card ${String(s.SnapshotID)===String(BState.snapshotId)?'active':''}" data-snapshot="${s.SnapshotID}"><strong>${BRM.escape(s.Title)}</strong><small>${BRM.escape(s.SnapshotType||'Blocking')} · v${BRM.escape(s.VersionNumber||1)} ${s.LockState==='Locked'?'🔒':''}</small></button>`).join(''):'<div class="blocking-empty">No snapshots here yet.</div>'}
function renderAnchors(){const rows=anchorsForContext();return rows.length?rows.map(a=>`<div class="blocking-anchor ${String(BState.snapshot?.AnchorID)===String(a.AnchorID)?'active':''}" data-anchor="${a.AnchorID}"><div class="blocking-anchor-meta"><span class="badge">${BRM.escape(a.AnchorType)}</span>${a.Speaker?`<span class="badge">${BRM.escape(a.Speaker)}</span>`:''}${a.BookPage?`<span class="badge">p.${BRM.escape(a.BookPage)}</span>`:''}${a.Measure?`<span class="badge">m.${BRM.escape(a.Measure)}</span>`:''}${a.CountLabel?`<span class="badge">${BRM.escape(a.CountLabel)}</span>`:''}</div><div class="blocking-anchor-text">${BRM.escape(a.TextSnippet||'(Untitled anchor)')}</div>${a.CueWord?`<small>Trigger: <strong>${BRM.escape(a.CueWord)}</strong></small>`:''}</div>`).join(''):'<div class="blocking-empty">No anchors for this selection.</div>'}
function renderSnapshotDetails(){if(!BState.snapshot)return '<div class="blocking-empty">Create or choose a snapshot to begin.</div>';const a=(BState.data.anchors||[]).find(x=>String(x.AnchorID)===String(BState.snapshot.AnchorID));return `<div class="blocking-inspector"><div><span class="eyebrow">${BRM.escape(BState.snapshot.SnapshotType||'Blocking')}</span><h3>${BRM.escape(BState.snapshot.Title)}</h3></div><div class="blocking-stat-row"><span class="blocking-stat">v${BRM.escape(BState.snapshot.VersionNumber||1)}</span><span class="blocking-stat">${BRM.escape(BState.snapshot.Status||'Draft')}</span><span class="blocking-stat">${BRM.escape(BState.snapshot.LockState||'Unlocked')}</span></div>${a?`<div class="panel-inset"><strong>Attached anchor</strong><p>${BRM.escape(a.TextSnippet)}</p></div>`:''}${BState.snapshot.Notes?`<p>${BRM.escape(BState.snapshot.Notes)}</p>`:''}<div class="form-actions"><button class="button button-secondary button-small" data-export-image>Snapshot image</button>${canManage()?`<button class="button button-secondary button-small" data-toggle-lock>${BState.snapshot.LockState==='Locked'?'Unlock':'Lock'}</button><button class="button button-secondary button-small" data-archive-snapshot>Archive</button>${perms().isAdmin?'<button class="button button-danger button-small" data-delete-snapshot>Delete permanently</button>':''}`:''}</div></div>`}

function isDoubleCastRole(c){const clean=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'');return ['mal','evie','carlos'].includes(clean(c?.CharacterKey))||['mal','evie','carlos'].includes(clean(c?.CharacterName))}
function blockingCastCompanyName(value){return String(value||'A').toUpperCase()==='B'?'Purple Cast':'Green Cast'}
function castVisibleForCompany(c){return !isDoubleCastRole(c)||String(c.CastGroup||'A').toUpperCase()===BState.castGroup}
function castSearchRows(){const q=(document.querySelector('[data-cast-search]')?.value||'').toLowerCase();return (BState.data.cast||[]).filter(c=>castVisibleForCompany(c)&&[c.CharacterName,c.PersonName,c.RoleLabel,c.World,c.CastGroup].join(' ').toLowerCase().includes(q));}
function renderPalette(){
  if(BState.paletteTab==='groups'){
    const cards=(BState.data.groups||[]).map(g=>{const n=groupCastMembers(g).length;return `<div class="blocking-group" data-group="${g.GroupID}"><strong>${BRM.escape(g.GroupName)}</strong><small>${BRM.escape(g.Description||'')}</small><span class="blocking-group-count">${n} individual assignment${n===1?'':'s'} · click to choose who enters</span></div>`}).join('');
    return `${canManage()?'<div class="blocking-element-toolbar"><button class="button button-primary button-small" data-ensemble-roster>+ Ensemble Roster</button><span class="blocking-token-note">Create individual Isle Ensemble, Auradonian, crowd, choir, or other ensemble assignments.</span></div>':''}<div class="blocking-palette">${cards}</div>`;
  }
  if(BState.paletteTab==='elements')return renderElementPalette();
  const cast=(BState.data.cast||[]).filter(castVisibleForCompany);
  return `<div class="blocking-element-toolbar"><span class="blocking-token-note">Rehearsing</span><button class="button button-secondary button-small ${BState.castGroup==='A'?'is-active':''}" data-cast-company="A">Green Cast</button><button class="button button-secondary button-small ${BState.castGroup==='B'?'is-active':''}" data-cast-company="B">Purple Cast</button></div><input class="blocking-palette-search" data-cast-search placeholder="Search cast…"><div class="blocking-palette" data-cast-list>${renderCastRows(cast)}</div>${!cast.length?`<div class="alert alert-info"><strong>No cast assignments yet.</strong><p style="margin:7px 0 10px">Connect students to characters before placing them on the stage.</p>${canManage()?'<button class="button button-primary button-small" data-manage-cast>Manage Cast</button>':'<span class="field-hint">Ask Stage Management or a Full Administrator to set up the cast.</span>'}</div>`:''}`;
}
function objectVisualName(o){
  if(o.ShapeType==='Text')return 'Text';
  if(o.ShapeType==='Marker')return 'Marker';
  return o.ShapeType||'Shape';
}
function renderElementPalette(){
  const rows=[...BState.objects].sort((a,b)=>Number(b.ZIndex||0)-Number(a.ZIndex||0));
  return `<div class="blocking-element-toolbar">${canEdit()?'<button class="button button-primary button-small" data-palette-add-element>+ Add stage element</button>':''}<span class="blocking-token-note">${rows.length} object${rows.length===1?'':'s'} in this snapshot</span></div><div class="blocking-elements-list">${rows.length?rows.map(o=>`<button class="blocking-element-card ${BState.selected?.kind==='object'&&BState.selected?.id===o._localId?'active':''}" data-select-object="${o._localId}"><span class="blocking-element-swatch" style="--element-fill:${BRM.escape(o.FillColor||'#5e000f')};--element-text:${BRM.escape(o.TextColor||'#ffffff')}">${o.ShapeType==='Text'?'T':o.ShapeType==='Marker'?'●':'◆'}</span><span class="blocking-element-copy"><strong>${BRM.escape(o.Label||o.ObjectType||'Untitled')}</strong><small>${BRM.escape(o.ObjectType||'Object')} · ${BRM.escape(objectVisualName(o))}</small></span><span class="blocking-element-edit">Edit</span></button>`).join(''):'<div class="blocking-empty">No stage objects in this snapshot yet.</div>'}</div>`;
}
function tokenColor(cast,key,fallback){
  const value=String(cast?.[key]||'').trim();
  return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;
}
function tokenStyle(cast){
  return {
    background:tokenColor(cast,'TokenBackgroundColor','#5e000f'),
    initials:tokenColor(cast,'TokenInitialColor','#ffffff'),
    outline:tokenColor(cast,'TokenOutlineColor','#f8b918')
  };
}
function blockingCastAvatar(cast,size='small'){
  const cls=`avatar ${size?`avatar-${size}`:''} blocking-cast-avatar`;
  const initials=BRM.escape(BRM.initials(cast?.PersonName||cast?.CharacterName||'?'));
  const style=tokenStyle(cast);
  const inline=`--blocking-token-bg:${style.background};--blocking-token-text:${style.initials};--blocking-token-outline:${style.outline}`;
  if(!cast?.UserID&&!cast?.HasPhoto&&!cast?.PhotoFileID&&!cast?.PhotoURL)return `<span class="${cls}" style="${inline}">${initials}</span>`;
  return `<span class="${cls}" data-blocking-avatar style="${inline}"><span data-blocking-photo-fallback style="grid-area:1/1">${initials}</span><img hidden data-blocking-cast-photo="${BRM.escape(cast.BlockingCastID||'')}" style="grid-area:1/1;width:100%;height:100%;object-fit:cover;display:block" alt=""></span>`;
}
function renderCastRows(rows){return rows.map(c=>`<div class="blocking-person" draggable="${canEdit()?'true':'false'}" data-cast="${c.BlockingCastID}" title="Drag onto the stage"><span>${blockingCastAvatar(c,'small')}</span><span><span class="blocking-person-name">${BRM.escape(c.CharacterName)}${isDoubleCastRole(c)?` · ${BRM.escape(blockingCastCompanyName(c.CastGroup))}`:''}</span><span class="blocking-person-role">${BRM.escape(c.PersonName||'Unassigned performer')}${c.RoleLabel?` · ${BRM.escape(c.RoleLabel)}`:''}</span></span>${canEdit()?'<span class="blocking-add">＋</span>':''}</div>`).join('')}
function setCastPhotoStatus(castId,state,message=''){
  castId=String(castId||'');if(!castId)return;
  BState.photoStatus.set(castId,{state,message});
  document.querySelectorAll('[data-cast-photo-status]').forEach(el=>{if(String(el.dataset.castPhotoStatus)===castId){el.textContent=message||state;const box=el.closest('.blocking-photo-state');if(box)box.dataset.state=state;}});
  if(document.querySelector('[data-photo-status]'))updatePhotoSummaryStatus();
}
function castPhotoStatus(cast){
  const status=BState.photoStatus.get(String(cast?.BlockingCastID||''));
  if(status)return status;
  if(!cast?.UserID&&!cast?.HasPhoto&&!cast?.PhotoFileID&&!cast?.PhotoURL)return {state:'none',message:'No profile photo stored — initials will be used.'};
  return {state:'idle',message:'Profile photo will load automatically.'};
}

function blockingPhotoCandidate(cast){return !!(cast?.UserID||cast?.HasPhoto||cast?.PhotoFileID||cast?.PhotoURL)}
function currentSnapshotPhotoCasts(){
  const seen=new Set();
  const source=(BState.placements||[]).length
    ? BState.placements.map(p=>castById(p.BlockingCastID)).filter(Boolean)
    : (BState.data?.cast||[]);
  return source.filter(c=>{
    const id=String(c?.BlockingCastID||'').trim();
    if(!id||seen.has(id)||!blockingPhotoCandidate(c))return false;
    seen.add(id);return true;
  });
}
function photoSummarySnapshot(){
  const casts=currentSnapshotPhotoCasts();
  const summary={total:casts.length,ready:0,cached:0,loading:0,error:0,missing:0,idle:0};
  casts.forEach(c=>{
    const state=castPhotoStatus(c).state;
    if(['visible','canvas','decoded','resolved'].includes(state))summary.ready++;
    else if(state==='cached'){summary.ready++;summary.cached++;}
    else if(state==='loading')summary.loading++;
    else if(state==='error')summary.error++;
    else if(state==='none')summary.missing++;
    else summary.idle++;
  });
  return summary;
}
function updatePhotoSummaryStatus(){
  const wrap=document.querySelector('[data-photo-status]');
  const textNode=document.querySelector('[data-photo-status-text]');
  const summary=photoSummarySnapshot();
  let state='idle',text=summary.total?`Faces ${summary.ready}/${summary.total}`:'Faces —';
  if(summary.total){
    if(summary.ready>=summary.total && !summary.loading && !summary.idle && !summary.error){
      state='ready';text=`Faces ${summary.ready}/${summary.total}${summary.cached?` · ${summary.cached} cached`:''}`;
    }else if(summary.loading||summary.idle){
      state='loading';text=`Faces ${summary.ready}/${summary.total} · ${summary.loading+summary.idle} loading`;
      if(summary.error)text+=` · ${summary.error} retrying`;
      if(summary.missing)text+=` · ${summary.missing} no photo`;
    }else if(summary.error){
      state='warning';text=`Faces ${summary.ready}/${summary.total} · ${summary.error} retrying`;
      if(summary.missing)text+=` · ${summary.missing} no photo`;
    }else if(summary.missing){
      text=`Faces ${summary.ready}/${summary.total} · ${summary.missing} no photo`;
    }
  }
  if(wrap){
    wrap.dataset.state=state;
    wrap.title=summary.total
      ? `${summary.ready} ready, ${summary.loading+summary.idle} loading, ${summary.error} retrying, ${summary.missing} with no usable profile photo.`
      : 'No cast face candidates are present in the current snapshot.';
  }
  if(textNode)textNode.textContent=text;
}
function cancelBlockingPhotoRetry(castId,{resetAttempts=true}={}){
  castId=String(castId||'').trim();if(!castId)return;
  const timer=BState.photoRetryTimers.get(castId);
  if(timer){clearTimeout(timer);BState.photoRetryTimers.delete(castId);}
  if(resetAttempts)BState.photoRetryAttempts.delete(castId);
}
function scheduleBlockingPhotoRetry(cast){
  const castId=String(cast?.BlockingCastID||'').trim();if(!castId)return;
  if(BState.photoRetryTimers.has(castId))return;
  const completed=Number(BState.photoRetryAttempts.get(castId)||0);
  if(completed>=3){setCastPhotoStatus(castId,'error','Profile photo could not load after 3 attempts. Use ↻ Faces to try again.');return;}
  const attempt=completed+1,delay=[1100,2400,4800][attempt-1];
  BState.photoRetryAttempts.set(castId,attempt);
  setCastPhotoStatus(castId,'loading',`Profile photo retry ${attempt}/3…`);
  const timer=setTimeout(async()=>{
    BState.photoRetryTimers.delete(castId);
    BState.photoDataCache.delete(castId);
    BState.photoDataLoads.delete(castId);
    BState.photoImageCache.delete(castId);
    BState.photoCanvasCache.delete(castId);
    try{
      const data=await blockingPhotoDataForCast(cast,{priority:'high',retrying:true,bypassPersistent:true});
      if(data?.hasPhoto){
        renderTokens();hydrateBlockingCastPhotos(document);refreshRight();
      }
    }catch(_error){}
  },delay);
  BState.photoRetryTimers.set(castId,timer);
}
async function refreshMissingBlockingFaces(){
  const casts=currentSnapshotPhotoCasts().filter(c=>!['visible','canvas','decoded','resolved','cached','none'].includes(castPhotoStatus(c).state));
  if(!casts.length){BRM.toast('All available cast faces are already loaded.');return;}
  casts.forEach(c=>{
    const id=String(c.BlockingCastID||'');cancelBlockingPhotoRetry(id);BState.photoDataCache.delete(id);BState.photoDataLoads.delete(id);BState.photoImageCache.delete(id);BState.photoCanvasCache.delete(id);BState.photoStatus.delete(id);
  });
  updatePhotoSummaryStatus();
  casts.forEach(c=>blockingPhotoDataForCast(c,{force:true,priority:'high'}).then(data=>{if(data?.hasPhoto){renderTokens();hydrateBlockingCastPhotos(document)}}).catch(()=>null));
  BRM.toast(`Refreshing ${casts.length} cast face${casts.length===1?'':'s'}…`);
}
function warmVisibleBlockingFaces(){
  currentSnapshotPhotoCasts().slice(0,16).forEach(c=>{
    const state=castPhotoStatus(c).state;
    if(['visible','canvas','decoded','resolved','cached','none','loading'].includes(state))return;
    blockingPhotoDataForCast(c,{priority:'high'}).catch(()=>null);
  });
  updatePhotoSummaryStatus();
}


function openBlockingFastDb(){
  return new Promise((resolve,reject)=>{const r=indexedDB.open('bedford-blocking-fast-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Fast cache unavailable.'));});
}
async function getPersistentBlockingPhoto(cast){
  try{const db=await openBlockingFastDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').get(blockingPhotoPersistentKey(cast));req.onsuccess=()=>{db.close();const row=req.result,maxAge=(cast?.PhotoFileID||cast?.PhotoURL)?7*24*60*60*1000:12*60*60*1000;resolve(row&&row.version===blockingPhotoVersion(cast)&&row.result&&Date.now()-Number(row.savedAt||0)<maxAge?row.result:null)};req.onerror=()=>{db.close();reject(req.error)}})}catch(_error){return null}
}
async function putPersistentBlockingPhoto(cast,result){
  if(!result?.hasPhoto||!result?.dataUrl)return;
  try{const db=await openBlockingFastDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({key:blockingPhotoPersistentKey(cast),version:blockingPhotoVersion(cast),savedAt:Date.now(),result:{hasPhoto:true,fileId:result.fileId||cast.PhotoFileID||'',mimeType:result.mimeType||'',updatedAt:result.updatedAt||'',dataUrl:result.dataUrl}});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}catch(_error){}
}
function blockingPhotoVersion(cast){return String(cast?.PhotoFileID||cast?.PhotoURL||cast?.UserID||cast?.BlockingCastID||'')}
function blockingPhotoPersistentKey(cast){return `photo:${blockingPhotoVersion(cast)}`}
function scheduleBlockingPhotoRequest(task,{priority='normal'}={}){
  return new Promise((resolve,reject)=>{const item={task,resolve,reject};if(priority==='high')BState.photoRequestQueue.unshift(item);else BState.photoRequestQueue.push(item);pumpBlockingPhotoRequests();});
}
function pumpBlockingPhotoRequests(){
  while(BState.photoRequestActive<3&&BState.photoRequestQueue.length){
    const item=BState.photoRequestQueue.shift();BState.photoRequestActive++;
    Promise.resolve().then(item.task).then(item.resolve,item.reject).finally(()=>{BState.photoRequestActive--;pumpBlockingPhotoRequests();});
  }
}

async function blockingPhotoDataForCast(cast,{force=false,priority='normal',retrying=false,bypassPersistent=false}={}){
  if(!cast)return null;
  const castId=String(cast.BlockingCastID||'').trim();if(!castId)return null;
  const sharedKey='photo-version:'+blockingPhotoVersion(cast);
  if(force){
    cancelBlockingPhotoRetry(castId);
    BState.photoDataCache.delete(castId);BState.photoDataCache.delete(sharedKey);BState.photoDataLoads.delete(castId);BState.photoImageCache.delete(sharedKey);BState.photoCanvasCache.delete(sharedKey);
  }
  if(BState.photoDataCache.has(castId))return BState.photoDataCache.get(castId);
  if(BState.photoDataCache.has(sharedKey)){const shared=BState.photoDataCache.get(sharedKey);BState.photoDataCache.set(castId,shared);setCastPhotoStatus(castId,'cached','Profile photo reused from this device.');return shared;}
  if(!force&&!bypassPersistent){
    const persisted=await getPersistentBlockingPhoto(cast);
    if(persisted){BState.photoDataCache.set(castId,persisted);BState.photoDataCache.set(sharedKey,persisted);cancelBlockingPhotoRetry(castId);setCastPhotoStatus(castId,'cached','Profile photo loaded from this device.');return persisted;}
  }
  if(BState.photoDataLoads.has(castId))return BState.photoDataLoads.get(castId);
  setCastPhotoStatus(castId,'loading',retrying?'Retrying profile photo…':'Loading profile photo…');
  const request=scheduleBlockingPhotoRequest(async()=>{
    try{
      const result=await BRM.api('blockingCastPhotoData',{blockingCastId:castId},{noCache:true,forceNetwork:true});
      if(result?.hasPhoto&&(result?.dataUrl||result?.externalUrl)){
        BState.photoDataCache.set(castId,result);BState.photoDataCache.set(sharedKey,result);putPersistentBlockingPhoto(cast,result);cancelBlockingPhotoRetry(castId);setCastPhotoStatus(castId,'resolved','Profile photo resolved.');return result;
      }
      const empty=result||{hasPhoto:false,reason:'NO_PHOTO'};
      BState.photoDataCache.set(castId,empty);cancelBlockingPhotoRetry(castId);setCastPhotoStatus(castId,'none','No usable profile photo — initials will be used.');return empty;
    }catch(error){
      console.warn('Blocking cast photo request failed',castId,error);
      setCastPhotoStatus(castId,'error','Profile photo request failed — retrying automatically.');
      scheduleBlockingPhotoRetry(cast);
      return {hasPhoto:false,reason:'REQUEST_FAILED',error:error?.message||String(error)};
    }
  },{priority});
  BState.photoDataLoads.set(castId,request);try{return await request}finally{BState.photoDataLoads.delete(castId)}
}
async function blockingPhotoSource(cast,{force=false,priority='normal'}={}){
  const data=await blockingPhotoDataForCast(cast,{force,priority});
  return data?.dataUrl||data?.externalUrl||'';
}
function loadHtmlImage(src,{external=false}={}){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.decoding='async';
    if(external)img.referrerPolicy='no-referrer';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Browser could not decode the profile image.'));
    img.src=src;
  });
}
async function photoImageForCast(cast,{force=false,priority='high'}={}){
  const castId=String(cast?.BlockingCastID||'');if(!castId)return null;const sharedKey='photo-version:'+blockingPhotoVersion(cast);
  if(force){BState.photoImageCache.delete(sharedKey);BState.photoCanvasCache.delete(sharedKey);}
  if(BState.photoImageCache.has(sharedKey))return BState.photoImageCache.get(sharedKey);
  const data=await blockingPhotoDataForCast(cast,{force,priority});
  const src=data?.dataUrl||data?.externalUrl||'';if(!src)return null;
  try{
    const img=await loadHtmlImage(src,{external:!!data?.externalUrl&&!data?.dataUrl});
    BState.photoImageCache.set(sharedKey,img);cancelBlockingPhotoRetry(castId);setCastPhotoStatus(castId,'decoded','Photo decoded in Blocking Studio.');return img;
  }catch(error){setCastPhotoStatus(castId,'error','Photo resolved but browser could not decode it — retrying automatically.');console.warn(error);scheduleBlockingPhotoRetry(cast);return null;}
}
function makeCircularFaceCanvas(img,size=160){
  const c=document.createElement('canvas');c.width=size;c.height=size;
  const ctx=c.getContext('2d');if(!ctx)return null;
  const iw=Number(img.naturalWidth||img.width||0),ih=Number(img.naturalHeight||img.height||0);if(!iw||!ih)return null;
  const side=Math.min(iw,ih),sx=(iw-side)/2,sy=(ih-side)/2;
  ctx.save();ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.closePath();ctx.clip();
  ctx.drawImage(img,sx,sy,side,side,0,0,size,size);ctx.restore();
  return c;
}
async function photoCanvasForCast(cast,{force=false}={}){
  const castId=String(cast?.BlockingCastID||'');if(!castId)return null;const sharedKey='photo-version:'+blockingPhotoVersion(cast);
  if(force)BState.photoCanvasCache.delete(sharedKey);
  if(BState.photoCanvasCache.has(sharedKey)){setCastPhotoStatus(castId,'cached','Face reused from this device.');return BState.photoCanvasCache.get(sharedKey);}
  const img=await photoImageForCast(cast,{force,priority:'high'});if(!img)return null;
  try{
    const canvas=makeCircularFaceCanvas(img,160);if(!canvas)throw new Error('Could not create face canvas.');
    BState.photoCanvasCache.set(sharedKey,canvas);cancelBlockingPhotoRetry(castId);setCastPhotoStatus(castId,'canvas','Face loaded into the stage renderer.');return canvas;
  }catch(error){setCastPhotoStatus(castId,'error','Photo decoded but stage renderer could not prepare it — retrying automatically.');console.warn(error);scheduleBlockingPhotoRetry(cast);return null;}
}
function hydrateBlockingCastPhotoElement(img){
  if(!img||img.dataset.blockingPhotoStarted==='true')return;img.dataset.blockingPhotoStarted='true';
  const cast=castById(img.dataset.blockingCastPhoto);if(!cast)return;
  blockingPhotoSource(cast,{priority:'normal'}).then(src=>{if(!src)return;img.onload=()=>{img.hidden=false;const fb=img.closest('[data-blocking-avatar]')?.querySelector('[data-blocking-photo-fallback]');if(fb)fb.hidden=true;setCastPhotoStatus(cast.BlockingCastID,'visible','Profile photo visible.');};img.onerror=()=>{img.hidden=true;const fb=img.closest('[data-blocking-avatar]')?.querySelector('[data-blocking-photo-fallback]');if(fb)fb.hidden=false;setCastPhotoStatus(cast.BlockingCastID,'error','Profile photo could not render — retrying automatically.');scheduleBlockingPhotoRetry(cast);};img.src=src;}).catch(()=>scheduleBlockingPhotoRetry(cast));
}
function hydrateBlockingCastPhotos(root=document){
  const imgs=[...(root.matches?.('[data-blocking-cast-photo]')?[root]:[]),...(root.querySelectorAll?.('[data-blocking-cast-photo]')||[])];
  if(!('IntersectionObserver'in window)){imgs.forEach(hydrateBlockingCastPhotoElement);return;}
  if(!BState.photoObserver)BState.photoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){BState.photoObserver.unobserve(entry.target);hydrateBlockingCastPhotoElement(entry.target);}}),{rootMargin:'180px'});
  imgs.forEach(img=>{if(img.dataset.blockingPhotoStarted!=='true')BState.photoObserver.observe(img)});
}
function scheduleIdlePhotoHydration(){const run=()=>{hydrateBlockingCastPhotos(document);warmVisibleBlockingFaces();};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1200});else setTimeout(run,250)}
function clearCastPhotoCaches(castId){
  castId=String(castId||'').trim();if(!castId)return;const cast=castById(castId),sharedKey=cast?'photo-version:'+blockingPhotoVersion(cast):'';
  cancelBlockingPhotoRetry(castId);BState.photoDataCache.delete(castId);BState.photoDataLoads.delete(castId);if(sharedKey){BState.photoDataCache.delete(sharedKey);BState.photoImageCache.delete(sharedKey);BState.photoCanvasCache.delete(sharedKey);}BState.photoStatus.delete(castId);updatePhotoSummaryStatus();
}
async function reloadSelectedCastPhoto(){
  const p=BState.placements.find(x=>x._localId===BState.selected?.id);const cast=p&&castById(p.BlockingCastID);if(!cast)return;
  clearCastPhotoCaches(cast.BlockingCastID);setCastPhotoStatus(cast.BlockingCastID,'loading','Reloading profile photo…');
  document.querySelectorAll('[data-blocking-cast-photo]').forEach(img=>{if(String(img.dataset.blockingCastPhoto)===String(cast.BlockingCastID)){img.dataset.blockingPhotoStarted='false';img.hidden=true;img.removeAttribute('src');const fb=img.closest('[data-blocking-avatar]')?.querySelector('[data-blocking-photo-fallback]');if(fb)fb.hidden=false;}});
  await blockingPhotoDataForCast(cast,{force:true});hydrateBlockingCastPhotos(document);renderTokens();refreshRight();
}

function isPolygonShape(type){return ['Rectangle','Square','Triangle','Custom'].includes(String(type||''))}
function shapePoints(o){
  if(!isPolygonShape(o.ShapeType))return [];
  try{
    const parsed=JSON.parse(o.PointsJSON||'[]');
    if(Array.isArray(parsed)&&parsed.length>=3&&parsed.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))))return parsed.map(p=>[Number(p[0]),Number(p[1])]);
  }catch{}
  const w=(Number(o.WidthPercent)||14)/100*LOGICAL_W,h=(Number(o.HeightPercent)||8)/100*LOGICAL_H;
  if(o.ShapeType==='Triangle')return [[0,-h/2],[w/2,h/2],[-w/2,h/2]];
  if(o.ShapeType==='Square'){const s=Math.max(w,h);return [[-s/2,-s/2],[s/2,-s/2],[s/2,s/2],[-s/2,s/2]];}
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
}
function setShapePoints(o,points){
  if(!points||!points.length){o.PointsJSON='';return;}
  o.PointsJSON=JSON.stringify(points.map(p=>[Math.round(Number(p[0])*100)/100,Math.round(Number(p[1])*100)/100]));syncObjectBounds(o,points)
}
function syncObjectBounds(o,points){if(!points||!points.length)return;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);o.WidthPercent=Math.max(.5,(Math.max(...xs)-Math.min(...xs))/LOGICAL_W*100);o.HeightPercent=Math.max(.5,(Math.max(...ys)-Math.min(...ys))/LOGICAL_H*100)}
function edgeColors(o,n){let list=[];try{list=JSON.parse(o.EdgeColorsJSON||'[]')}catch{};if(!Array.isArray(list))list=[];while(list.length<n)list.push('#f8b918');return list.slice(0,n).map(v=>/^#[0-9a-f]{6}$/i.test(String(v))?v:'#f8b918')}
function setEdgeColors(o,list){o.EdgeColorsJSON=JSON.stringify(list||[])}
function shapePresetDimensions(type){const width=type==='Square'?14:(type==='Triangle'?16:(type==='Marker'?4:20));const logicalHeight=type==='Square'?140:(type==='Triangle'?140:(type==='Marker'?72:(type==='Text'?70:100)));return {w:width,h:logicalHeight/LOGICAL_H*100};}
function resetObjectGeometry(o,type){
  o.ShapeType=type;const dims=shapePresetDimensions(type);o.WidthPercent=dims.w;o.HeightPercent=dims.h;o.PointsJSON='';
  if(isPolygonShape(type)){const pts=shapePoints(o);setShapePoints(o,pts);setEdgeColors(o,Array(pts.length).fill('#f8b918'))}else setEdgeColors(o,[]);
}
function renderObjectEdgeControls(o){const pts=shapePoints(o);if(!pts.length)return '';const colors=edgeColors(o,pts.length);return `<div class="blocking-edge-editor"><label>Individual edge colours</label>${colors.map((c,i)=>`<div class="blocking-edge-row"><span>Edge ${i+1}</span><input type="color" data-edge-color="${i}" value="${c}"></div>`).join('')}</div>`}
function objectLabelPositionOptions(o){return ['Center','Above','Below'].map(v=>`<option ${String(o.LabelPosition||'Center')===v?'selected':''}>${v}</option>`).join('')}

function selectedPlacementRows(){
  return [...BState.selectedPlacements].map(id=>(BState.placements||[]).find(p=>p._localId===id)).filter(Boolean);
}
function placementSelectionCount(){return selectedPlacementRows().length}
function clearPlacementSelection({render=false}={}){
  BState.selectedPlacements.clear();
  if(BState.selected?.kind==='placement')BState.selected=null;
  if(render){refreshRight();renderTokens();renderTimelinePaths();}
}
function selectionModifier(event){
  const evt=event?.evt||event;
  return !!BState.multiSelectMode||!!evt?.shiftKey||!!evt?.ctrlKey||!!evt?.metaKey;
}
function selectPlacementToken(localId,event){
  if(selectionModifier(event)){
    if(BState.selectedPlacements.has(localId))BState.selectedPlacements.delete(localId);
    else BState.selectedPlacements.add(localId);
    const ids=[...BState.selectedPlacements];
    BState.selected=ids.length?{kind:'placement',id:ids[ids.length-1]}:null;
  }else{
    BState.selectedPlacements.clear();
    BState.selectedPlacements.add(localId);
    BState.selected={kind:'placement',id:localId};
  }
  hideBlockingTokenTooltip();refreshRight();renderTokens();renderObjects();renderTimelinePaths();updateMultiSelectUi();
}
function toggleMultiSelectMode(){
  BState.multiSelectMode=!BState.multiSelectMode;
  updateMultiSelectUi();
  BRM.toast(BState.multiSelectMode?'Multi-select is on. Tap performers to add/remove them from the selection.':'Multi-select is off.','info');
}
function updateMultiSelectUi(){
  const count=placementSelectionCount();
  document.querySelectorAll('[data-multi-select-mode]').forEach(el=>{el.classList.toggle('is-active',BState.multiSelectMode);el.setAttribute('aria-pressed',String(BState.multiSelectMode));});
  document.querySelectorAll('[data-selection-count]').forEach(el=>el.textContent=count?`${count} selected · click order preserved`:'No performers selected');
}
function selectAllPlacements(){
  BState.selectedPlacements=new Set((BState.placements||[]).map(p=>p._localId));
  const ids=[...BState.selectedPlacements];BState.selected=ids.length?{kind:'placement',id:ids[ids.length-1]}:null;
  refreshRight();renderTokens();renderTimelinePaths();updateMultiSelectUi();
}
function tokenScalePercent(scale){return Math.round((Number(scale)||1)*100)}
function selectedScaleInfo(rows){
  const values=rows.map(p=>tokenScalePercent(p.Scale));
  const unique=[...new Set(values)];
  const average=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):100;
  return {common:unique.length===1?unique[0]:null,average};
}
function renderTokenScaleEditor(rows,{title='Token size'}={}){
  const info=selectedScaleInfo(rows),slider=info.common??info.average;
  return `<div class="blocking-inspector-section blocking-scale-editor"><strong>${BRM.escape(title)}</strong><div class="blocking-scale-readout"><span data-token-scale-readout>${info.common==null?'Mixed':info.common+'%'}</span><small>${rows.length>1?`${rows.length} performers selected`:'Exact percentage'}</small></div><input class="blocking-scale-range" type="range" min="25" max="400" step="5" value="${slider}" list="blocking-token-scale-notches" data-token-scale-range><datalist id="blocking-token-scale-notches">${[25,50,75,100,125,150,175,200,250,300,350,400].map(v=>`<option value="${v}" label="${v}%"></option>`).join('')}</datalist><div class="blocking-scale-exact"><label>Exact % <input type="number" min="25" max="400" step="1" value="${info.common??''}" placeholder="${info.common==null?'Mixed':''}" data-token-scale-number></label><div class="blocking-scale-presets">${[50,75,100,125,150,200,300].map(v=>`<button class="button button-secondary button-small" type="button" data-token-scale-preset="${v}">${v}%</button>`).join('')}</div></div><p class="field-hint">Slider notches move in 5% steps. The number field accepts any whole percentage from 25%–400%.</p></div>`;
}
function setSelectedScalePercent(percent){
  const rows=selectedPlacementRows();if(!rows.length)return;
  const pct=Math.max(25,Math.min(400,Math.round(Number(percent)||100))),scale=pct/100;
  rows.forEach(p=>{p.Scale=scale;const node=BState.tokenNodes.get(p._localId);if(node)node.scale({x:scale,y:scale});});
  BState.layers.tokens?.batchDraw();
  document.querySelectorAll('[data-token-scale-readout]').forEach(el=>el.textContent=pct+'%');
  document.querySelectorAll('[data-token-scale-range]').forEach(el=>el.value=pct);
  document.querySelectorAll('[data-token-scale-number]').forEach(el=>el.value=pct);
}
function bindTokenScaleEditor(){
  document.querySelectorAll('[data-token-scale-range]').forEach(el=>{el.onpointerdown=()=>pushUndo();el.oninput=()=>setSelectedScalePercent(el.value);});
  document.querySelectorAll('[data-token-scale-number]').forEach(el=>el.onchange=()=>{pushUndo();setSelectedScalePercent(el.value);});
  document.querySelectorAll('[data-token-scale-preset]').forEach(el=>el.onclick=()=>{pushUndo();setSelectedScalePercent(el.dataset.tokenScalePreset);});
}
function renderMultiPlacementInspector(rows){
  const names=rows.map(p=>{const c=castById(p.BlockingCastID)||{};return p.LabelOverride||c.CharacterName||c.PersonName||'Performer'});
  return `<div class="blocking-inspector"><div><span class="eyebrow">Multi-selection</span><h3>${rows.length} Performers Selected</h3><p class="field-hint">${BRM.escape(names.slice(0,8).join(' · '))}${names.length>8?' · …':''}</p></div>${renderTokenScaleEditor(rows,{title:'Resize selected performers'})}<div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-select-all-performers>Select all in snapshot</button><button class="button button-secondary button-small" data-clear-performer-selection>Clear selection</button></div><div class="blocking-source-note"><strong>Tip:</strong> keep Multi on for touch devices, or hold Shift/Ctrl/Cmd while clicking faces on a computer. Scaling changes all selected performers together and saves with the Blocking Snapshot.</div></div>`;
}
function renderInspector(){
  const multi=selectedPlacementRows();
  if(multi.length>1)return renderMultiPlacementInspector(multi);
  const sel=BState.selected;if(!sel)return '<div class="blocking-empty">Select a performer or stage object.</div>';
  if(sel.kind==='object'){
    const o=BState.objects.find(x=>x._localId===sel.id);if(!o)return '';
    const polygon=isPolygonShape(o.ShapeType);
    return `<div class="blocking-inspector object-inspector">
      <div><span class="eyebrow">Stage Element</span><h3>${BRM.escape(o.Label||o.ObjectType||'Untitled object')}</h3><p class="field-hint">The object itself and its text are separate. Labels no longer require a dark rectangle.</p></div>
      <div class="blocking-inspector-section"><strong>Identity</strong>
        <div class="field"><label>Name / text</label><input data-object-field="Label" value="${BRM.escape(o.Label||'')}" placeholder="e.g. Maleficent's staff"></div>
        <div class="field"><label>Purpose</label><select data-object-field="ObjectType">${['Set Piece','Furniture','Prop','Spike','Entrance','Exit','Text Note','Zone'].map(v=>`<option ${o.ObjectType===v?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>Visual type</label><select data-object-shape>${['Rectangle','Square','Triangle','Custom','Marker','Text'].map(v=>`<option ${o.ShapeType===v?'selected':''}>${v==='Text'?'Text only':v}</option>`).join('')}</select></div>
      </div>
      <div class="blocking-inspector-section"><strong>Text</strong>
        <label class="checkbox-row"><input type="checkbox" data-object-bool="LabelVisible" ${o.LabelVisible!==false?'checked':''}><span>Show name/text on plan</span></label>
        <div class="blocking-color-grid">
          <div class="field"><label>Text colour</label><input type="color" data-object-field="TextColor" value="${BRM.escape(o.TextColor||'#ffffff')}"></div>
          <div class="field"><label>Text size</label><input type="range" min="8" max="48" step="1" data-object-number="TextSize" value="${Number(o.TextSize||14)}"><span class="field-hint">${Number(o.TextSize||14)} px</span></div>
        </div>
        <div class="blocking-toggle-grid">
          <label class="checkbox-row"><input type="checkbox" data-object-bool="TextBold" ${o.TextBold!==false?'checked':''}><span>Bold text</span></label>
          <label class="checkbox-row"><input type="checkbox" data-object-bool="LabelBackground" ${o.LabelBackground===true?'checked':''}><span>Text background</span></label>
        </div>
        ${o.ShapeType!=='Text'?`<div class="field"><label>Text position</label><select data-object-field="LabelPosition">${objectLabelPositionOptions(o)}</select></div>`:''}
      </div>
      ${o.ShapeType==='Text'?`<div class="blocking-object-help"><strong>Text-only element</strong><span>No box, polygon, or fill is drawn. Drag the words directly around the map.</span></div>`:''}
      ${o.ShapeType==='Marker'?`<div class="blocking-object-help"><strong>Marker element</strong><span>Useful for hand props, spike marks, entrances/exits, and small tracked objects without pretending they are rectangular.</span></div>`:''}
      ${polygon||o.ShapeType==='Marker'?`<div class="blocking-inspector-section"><strong>${o.ShapeType==='Marker'?'Marker':'Shape'} appearance</strong><div class="blocking-color-grid"><div class="field"><label>${o.ShapeType==='Marker'?'Marker':'Fill'} colour</label><input type="color" data-object-field="FillColor" value="${BRM.escape(o.FillColor||'#5e000f')}"></div>${polygon?`<div class="field"><label>Fill opacity</label><input type="range" min="0" max="1" step="0.05" data-object-number="FillOpacity" value="${Number(o.FillOpacity??.72)}"></div>`:''}<div class="field"><label>Edge width</label><input type="range" min="0" max="12" step="1" data-object-number="StrokeWidth" value="${Number(o.StrokeWidth||3)}"></div><div class="field"><label>Rotation</label><input type="range" min="-180" max="180" step="1" data-object-number="Rotation" value="${Number(o.Rotation||0)}"></div></div>${polygon?renderObjectEdgeControls(o):''}</div>`:''}
      <div class="blocking-inspector-section"><strong>Layer & notes</strong><div class="field"><label>Layer order</label><input type="number" min="-100" max="100" step="1" data-object-number="ZIndex" value="${Number(o.ZIndex||0)}"><span class="field-hint">Higher numbers appear in front.</span></div><div class="field"><label>Notes</label><textarea data-object-field="Notes">${BRM.escape(o.Notes||'')}</textarea></div></div>
      ${canEdit()?`<div class="form-actions">${polygon?`<button class="button button-secondary button-small" data-add-vertex>Add vertex</button><button class="button button-secondary button-small" data-remove-vertex ${shapePoints(o).length<=3?'disabled':''}>Remove last vertex</button>`:''}<button class="button button-secondary button-small" data-duplicate-object>Duplicate</button><button class="button button-danger button-small" data-remove-selected>Remove from snapshot</button></div>`:''}
    </div>`;
  }
  const p=BState.placements.find(x=>x._localId===sel.id);if(!p)return '';
  const cast=(BState.data.cast||[]).find(c=>String(c.BlockingCastID)===String(p.BlockingCastID));
  const style=tokenStyle(cast),photoState=castPhotoStatus(cast);
  return `<div class="blocking-inspector"><div><span class="eyebrow">Performer</span><h3>${BRM.escape(p.LabelOverride||cast?.CharacterName||'Performer')}</h3><p>${BRM.escape(cast?.PersonName||'')}</p></div><div class="blocking-photo-state" data-state="${BRM.escape(photoState.state)}"><span class="blocking-photo-state-dot"></span><span data-cast-photo-status="${BRM.escape(cast?.BlockingCastID||'')}">${BRM.escape(photoState.message)}</span></div><div class="field"><label>Facing</label><select data-placement-field="Facing">${['Front','Upstage','Stage Left','Stage Right','Diagonal UL','Diagonal UR','Diagonal DL','Diagonal DR'].map(v=>`<option ${p.Facing===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Level</label><select data-placement-field="Level">${['Standing','Sitting','Kneeling','Crouching','Lying','Platform','Stairs','Offstage'].map(v=>`<option ${p.Level===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Counts / timing</label><input data-placement-field="Counts" value="${BRM.escape(p.Counts||'')}" placeholder="e.g. 4 counts"></div><div class="field"><label>Movement note</label><textarea data-placement-field="MovementNote" placeholder="Cross behind Ben, finish on lyric…">${BRM.escape(p.MovementNote||'')}</textarea></div>${renderTokenScaleEditor([p],{title:'Photo / token size'})}<div class="blocking-inspector-section blocking-token-style-editor"><strong>Character Token Colours</strong><div class="blocking-token-style-preview" style="--blocking-token-bg:${style.background};--blocking-token-text:${style.initials};--blocking-token-outline:${style.outline}"><span>${BRM.escape(BRM.initials(cast?.PersonName||cast?.CharacterName||'?'))}</span></div><div class="blocking-color-grid"><div class="field"><label>Background (initials fallback)</label><input type="color" data-cast-style="TokenBackgroundColor" value="${style.background}"></div><div class="field"><label>Initials colour</label><input type="color" data-cast-style="TokenInitialColor" value="${style.initials}"></div><div class="field"><label>Circle outline</label><input type="color" data-cast-style="TokenOutlineColor" value="${style.outline}"></div></div><p class="field-hint">Background and initials are visible when a profile photo is unavailable. The outline colour remains visible around profile photos.</p>${canManage()?'<div class="blocking-tool-buttons"><button class="button button-primary button-small" data-save-cast-style>Save Token Colours</button><button class="button button-secondary button-small" data-reset-cast-style>Reset Colours</button></div>':''}<button class="button button-secondary button-small" data-reload-cast-photo>↻ Reload Face</button></div>${canEdit()?'<button class="button button-danger button-small" data-remove-selected>Remove from snapshot</button>':''}</div>`;

}

function workspaceEl(){return document.querySelector('.blocking-workspace')}
function applyWorkspaceLayout({resize=true}={}){
  const w=workspaceEl(); if(!w)return;
  w.style.setProperty('--blocking-left-w',`${Math.max(110,Math.min(280,Number(BState.layout.leftWidth)||150))}px`);
  w.style.setProperty('--blocking-right-w',`${Math.max(260,Math.min(500,Number(BState.layout.rightWidth)||330))}px`);
  w.classList.toggle('blocking-left-collapsed',!!BState.layout.leftCollapsed);
  w.classList.toggle('blocking-right-collapsed',!!BState.layout.rightCollapsed);
  w.classList.toggle('blocking-toolbar-comfortable',BState.layout.density==='comfortable');
  w.classList.toggle('blocking-timeline-collapsed',!!BState.layout.timelineCollapsed);
  document.body.classList.toggle('blocking-main-nav-collapsed',!!BState.layout.mainNavCollapsed);
  document.querySelectorAll('[data-toggle-scenes]').forEach(b=>{b.classList.toggle('active',!BState.layout.leftCollapsed);b.setAttribute('aria-pressed',String(!BState.layout.leftCollapsed));});
  document.querySelectorAll('[data-toggle-tools]').forEach(b=>{b.classList.toggle('active',!BState.layout.rightCollapsed);b.setAttribute('aria-pressed',String(!BState.layout.rightCollapsed));});
  document.querySelectorAll('[data-toggle-timeline]').forEach(b=>{b.classList.toggle('active',!BState.layout.timelineCollapsed);b.setAttribute('aria-pressed',String(!BState.layout.timelineCollapsed));const label=b.querySelector('.blocking-command-text');if(label)label.textContent=BState.layout.timelineCollapsed?'Show Timeline':'Timeline';});
  document.querySelectorAll('[data-toggle-main-nav]').forEach(b=>{b.classList.toggle('active',!BState.layout.mainNavCollapsed);b.setAttribute('aria-pressed',String(!BState.layout.mainNavCollapsed));});
  document.querySelectorAll('[data-main-nav-tab-label]').forEach(label=>{label.textContent=BState.layout.mainNavCollapsed?'Show main navigation':'Hide main navigation';});
  document.querySelectorAll('[data-restore-left]').forEach(b=>{b.hidden=!BState.layout.leftCollapsed;});
  document.querySelectorAll('[data-restore-right]').forEach(b=>{b.hidden=!BState.layout.rightCollapsed;});
  if(resize)setTimeout(()=>resizeStage(),20);
}
function toggleWorkspacePanel(which){
  if(which==='left')BState.layout.leftCollapsed=!BState.layout.leftCollapsed;
  if(which==='right')BState.layout.rightCollapsed=!BState.layout.rightCollapsed;
  if(which==='timeline')BState.layout.timelineCollapsed=!BState.layout.timelineCollapsed;
  if(which==='mainNav')BState.layout.mainNavCollapsed=!BState.layout.mainNavCollapsed;
  saveBlockingUiPrefs();applyWorkspaceLayout();
}
function applyWorkspacePreset(name){
  if(name==='canvas')Object.assign(BState.layout,{leftWidth:135,rightWidth:300,leftCollapsed:true,rightCollapsed:true,density:'compact'});
  else if(name==='balanced')Object.assign(BState.layout,{leftWidth:150,rightWidth:330,leftCollapsed:false,rightCollapsed:false,density:'compact'});
  else if(name==='director')Object.assign(BState.layout,{leftWidth:125,rightWidth:410,leftCollapsed:false,rightCollapsed:false,density:'compact'});
  else if(name==='navigation')Object.assign(BState.layout,{leftWidth:235,rightWidth:285,leftCollapsed:false,rightCollapsed:false,density:'comfortable'});
  saveBlockingUiPrefs();applyWorkspaceLayout();
}
function bindWorkspaceResizers(){
  document.querySelectorAll('[data-panel-resizer]').forEach(handle=>{
    handle.onpointerdown=e=>{
      if(window.matchMedia('(max-width:980px)').matches)return;
      e.preventDefault(); handle.setPointerCapture?.(e.pointerId);
      const side=handle.dataset.panelResizer,startX=e.clientX,startLeft=BState.layout.leftWidth,startRight=BState.layout.rightWidth;
      document.documentElement.classList.add('blocking-resizing-panel');
      const move=ev=>{
        if(side==='left'){BState.layout.leftCollapsed=false;BState.layout.leftWidth=Math.max(110,Math.min(280,startLeft+(ev.clientX-startX)));}
        else{BState.layout.rightCollapsed=false;BState.layout.rightWidth=Math.max(260,Math.min(500,startRight-(ev.clientX-startX)));}
        applyWorkspaceLayout();
      };
      const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.documentElement.classList.remove('blocking-resizing-panel');saveBlockingUiPrefs();};
      document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
    };
  });
}
function openWorkspaceCustomizer(){
  const t=BState.layout.toolbar||{};
  openModal('Customize Blocking Workspace',`<div class="blocking-layout-presets"><button class="button button-secondary" data-layout-preset="canvas"><strong>Canvas Focus</strong><small>Hide both rails; maximum map space.</small></button><button class="button button-secondary" data-layout-preset="balanced"><strong>Balanced</strong><small>150px scenes + 330px tools.</small></button><button class="button button-secondary" data-layout-preset="director"><strong>Director Tools</strong><small>Narrow scenes + wide inspector/tool rail.</small></button><button class="button button-secondary" data-layout-preset="navigation"><strong>Navigation Focus</strong><small>Wider scene list for browsing.</small></button></div><hr><div class="blocking-layout-sliders"><div class="field"><label>Scenes & Songs width <strong data-layout-left-readout>${Math.round(BState.layout.leftWidth)}px</strong></label><input type="range" min="110" max="280" step="5" value="${BState.layout.leftWidth}" data-layout-left-width></div><div class="field"><label>Company & Tools width <strong data-layout-right-readout>${Math.round(BState.layout.rightWidth)}px</strong></label><input type="range" min="260" max="500" step="5" value="${BState.layout.rightWidth}" data-layout-right-width></div><div class="field"><label>Toolbar density</label><select data-layout-density><option value="compact" ${BState.layout.density==='compact'?'selected':''}>Compact</option><option value="comfortable" ${BState.layout.density==='comfortable'?'selected':''}>Comfortable</option></select></div></div><hr><strong>Quick toolbar buttons</strong><div class="blocking-layout-checks"><label class="checkbox-row"><input type="checkbox" data-toolbar-option="duplicate" ${t.duplicate!==false?'checked':''}><span>Duplicate</span></label><label class="checkbox-row"><input type="checkbox" data-toolbar-option="undoRedo" ${t.undoRedo!==false?'checked':''}><span>Undo / Redo</span></label><label class="checkbox-row"><input type="checkbox" data-toolbar-option="multiSelect" ${t.multiSelect!==false?'checked':''}><span>Multi-select</span></label><label class="checkbox-row"><input type="checkbox" data-toolbar-option="names" ${t.names!==false?'checked':''}><span>Names toggle</span></label><label class="checkbox-row"><input type="checkbox" data-toolbar-option="export" ${t.export!==false?'checked':''}><span>Snapshot Image</span></label><label class="checkbox-row"><input type="checkbox" data-toolbar-option="fullscreen" ${t.fullscreen!==false?'checked':''}><span>Full Screen</span></label></div><p class="field-hint">New Snapshot, Save, Scenes, Tools and Layout always stay available. On desktop you can also drag the thin dividers beside the canvas to resize the rails directly.</p>`,`<button class="button button-secondary" data-layout-reset>Reset</button><button class="button button-primary" data-layout-done>Done</button>`);
  document.querySelectorAll('[data-layout-preset]').forEach(b=>b.onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;applyWorkspacePreset(b.dataset.layoutPreset);closeModal();renderShell();initStage();if(BState.snapshotId)await loadSnapshot(BState.snapshotId);else await chooseInitialSnapshot();await loadTimelineContext();});
  const left=document.querySelector('[data-layout-left-width]'),right=document.querySelector('[data-layout-right-width]');
  left.oninput=()=>{BState.layout.leftWidth=Number(left.value);document.querySelector('[data-layout-left-readout]').textContent=left.value+'px';applyWorkspaceLayout();};
  right.oninput=()=>{BState.layout.rightWidth=Number(right.value);document.querySelector('[data-layout-right-readout]').textContent=right.value+'px';applyWorkspaceLayout();};
  document.querySelector('[data-layout-density]').onchange=e=>{BState.layout.density=e.target.value;applyWorkspaceLayout({resize:false});};
  document.querySelectorAll('[data-toolbar-option]').forEach(el=>el.onchange=()=>{BState.layout.toolbar[el.dataset.toolbarOption]=!!el.checked;});
  document.querySelector('[data-layout-reset]').onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;BState.layout={leftWidth:150,rightWidth:330,leftCollapsed:false,rightCollapsed:false,timelineCollapsed:false,mainNavCollapsed:false,density:'compact',toolbar:{duplicate:true,undoRedo:true,multiSelect:true,names:true,export:true,fullscreen:true}};saveBlockingUiPrefs();closeModal();renderShell();initStage();if(BState.snapshotId)await loadSnapshot(BState.snapshotId);else await chooseInitialSnapshot();await loadTimelineContext();};
  document.querySelector('[data-layout-done]').onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;saveBlockingUiPrefs();closeModal();renderShell();initStage();if(BState.snapshotId)await loadSnapshot(BState.snapshotId);else await chooseInitialSnapshot();await loadTimelineContext();};
}
function bindUI(){
  if(canEdit()&&!document.querySelector('[data-object-edit-mode]'))document.querySelector('[data-multi-select-mode]')?.insertAdjacentHTML('afterend',`<button class="button button-secondary button-small ${BState.objectEditMode?'is-active':''}" data-object-edit-mode title="Objects can only be selected or moved while this is on" aria-pressed="${BState.objectEditMode?'true':'false'}">Objects ${BState.objectEditMode?'On':'Off'}</button>`);
  applyWorkspaceLayout({resize:false});bindWorkspaceResizers();updateBlockingSaveStatus();
  document.querySelectorAll('[data-toggle-scenes],[data-collapse-left]').forEach(b=>b.addEventListener('click',()=>toggleWorkspacePanel('left')));
  document.querySelectorAll('[data-toggle-tools],[data-collapse-right]').forEach(b=>b.addEventListener('click',()=>toggleWorkspacePanel('right')));
  document.querySelectorAll('[data-toggle-timeline]').forEach(b=>b.addEventListener('click',()=>toggleWorkspacePanel('timeline')));
  document.querySelectorAll('[data-toggle-main-nav]').forEach(b=>b.addEventListener('click',()=>toggleWorkspacePanel('mainNav')));
  document.querySelectorAll('[data-customize-workspace]').forEach(b=>b.addEventListener('click',openWorkspaceCustomizer));
  document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=async()=>{if(BState.timeline.sceneRecorder&&!confirm('A scene recording is still in progress. Discard it and change scenes?'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;if(BState.timeline.sceneRecorder)await discardSceneAudioRecording();stopTimelinePlayback(true);BState.scene=Number(b.dataset.scene);BState.cue='';BState.snapshotId='';BState.snapshot=null;BState.placements=[];BState.objects=[];BState.selected=null;BState.selectedPlacements.clear();BState.multiSelectMode=false;resetTimelineContext();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();});
  document.querySelectorAll('[data-cue]').forEach(b=>b.onclick=async()=>{if(BState.timeline.sceneRecorder&&!confirm('A scene recording is still in progress. Discard it and change timelines?'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;if(BState.timeline.sceneRecorder)await discardSceneAudioRecording();stopTimelinePlayback(true);BState.cue=b.dataset.cue;BState.snapshotId='';BState.snapshot=null;BState.placements=[];BState.objects=[];BState.selected=null;BState.selectedPlacements.clear();BState.multiSelectMode=false;resetTimelineContext();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();});
  document.querySelectorAll('[data-snapshot]').forEach(b=>b.onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;await loadSnapshot(b.dataset.snapshot);});
  document.querySelectorAll('[data-palette-tab]').forEach(b=>b.onclick=()=>{BState.paletteTab=b.dataset.paletteTab;refreshRight();});
  document.querySelectorAll('[data-cast-company]').forEach(b=>b.onclick=()=>{BState.castGroup=b.dataset.castCompany;saveBlockingUiPrefs();refreshRight();});
  document.querySelector('[data-cast-search]')?.addEventListener('input',e=>{document.querySelector('[data-cast-list]').innerHTML=renderCastRows(castSearchRows());bindPalette();BRM.hydrateProfilePhotos?.(document.querySelector('[data-cast-list]'));hydrateBlockingCastPhotos(document.querySelector('[data-cast-list]'));});
  bindPalette();
  document.querySelector('[data-new-snapshot]')?.addEventListener('click',openSnapshotModal);
  document.querySelector('[data-save-snapshot]')?.addEventListener('click',()=>saveAllBlocking(true));
  document.querySelector('[data-duplicate-snapshot]')?.addEventListener('click',duplicateCurrentSnapshot);
  document.querySelector('[data-new-anchor]')?.addEventListener('click',openAnchorModal);
  document.querySelectorAll('[data-anchor]').forEach(a=>a.onclick=()=>{if(BState.snapshot&&canEdit()){BState.snapshot.AnchorID=a.dataset.anchor;document.querySelector('[data-anchor-list]').innerHTML=renderAnchors();document.querySelector('[data-snapshot-detail]').innerHTML=renderSnapshotDetails();bindDetailButtons();}});
  document.querySelector('[data-add-object]')?.addEventListener('click',openStageElementModal);
  document.querySelector('[data-shapes]')?.addEventListener('click',openShapeModal);
  document.querySelector('[data-fullscreen]')?.addEventListener('click',toggleStudioFullscreen);
  document.querySelector('[data-finish-shape]')?.addEventListener('click',finishCustomShape);
  document.querySelector('[data-cancel-shape]')?.addEventListener('click',cancelCustomShape);
  document.querySelector('[data-background]')?.addEventListener('click',openBackgroundModal);
  document.querySelectorAll('[data-manage-cast]').forEach(button=>button.addEventListener('click',openCastModal));
  document.querySelectorAll('[data-refresh-missing-faces]').forEach(button=>button.addEventListener('click',refreshMissingBlockingFaces));
  document.querySelectorAll('[data-restore-left]').forEach(button=>button.addEventListener('click',()=>{BState.layout.leftCollapsed=false;saveBlockingUiPrefs();applyWorkspaceLayout();}));
  document.querySelectorAll('[data-restore-right]').forEach(button=>button.addEventListener('click',()=>{BState.layout.rightCollapsed=false;saveBlockingUiPrefs();applyWorkspaceLayout();}));
  document.querySelector('[data-undo]')?.addEventListener('click',undo);document.querySelector('[data-redo]')?.addEventListener('click',redo);
  document.querySelector('[data-zoom-in]')?.addEventListener('click',()=>setZoom(BState.zoom+.1));document.querySelector('[data-zoom-out]')?.addEventListener('click',()=>setZoom(BState.zoom-.1));
  bindMapZoomControls();
  document.querySelector('[data-show-movement]')?.addEventListener('change',e=>{BState.showMovement=e.target.checked;saveBlockingUiPrefs();renderMovements();});
  document.querySelector('[data-show-seats]')?.addEventListener('change',e=>{BState.showSeats=e.target.checked;saveBlockingUiPrefs();drawGrid();});
  document.querySelector('[data-show-token-names]')?.addEventListener('change',e=>setTokenNamesVisible(!!e.target.checked));
  document.querySelectorAll('[data-multi-select-mode]').forEach(el=>el.addEventListener('click',toggleMultiSelectMode));
  document.querySelectorAll('[data-object-edit-mode]').forEach(el=>el.addEventListener('click',()=>{BState.objectEditMode=!BState.objectEditMode;if(!BState.objectEditMode&&BState.selected?.kind==='object')BState.selected=null;saveBlockingUiPrefs();renderObjects();renderTokens();refreshRight();document.querySelectorAll('[data-object-edit-mode]').forEach(button=>{button.classList.toggle('is-active',BState.objectEditMode);button.setAttribute('aria-pressed',String(BState.objectEditMode));button.textContent=`Objects ${BState.objectEditMode?'On':'Off'}`;});}));
  document.querySelectorAll('[data-toggle-token-names]').forEach(el=>el.addEventListener('click',toggleTokenNames));
  document.querySelectorAll('[data-export-image]').forEach(el=>el.addEventListener('click',openExportSnapshotModal));
  document.querySelector('[data-history]')?.addEventListener('click',openHistoryModal);
  bindDetailButtons();
  const drop=document.querySelector('[data-stage-drop]');drop?.addEventListener('dragover',e=>e.preventDefault());drop?.addEventListener('drop',handleExternalDrop);
  document.querySelector('[data-cancel-trace]')?.addEventListener('click',cancelTimelineTrace);
  document.querySelectorAll('[data-viewer-layout]').forEach(button=>button.addEventListener('click',()=>setBedfordViewerLayout(button.dataset.viewerLayout)));
  bindTimelineUI();
  enhanceBlockingNumericControls(document.querySelector('.blocking-right-panel'));
  bindBedfordFormationLab();
  document.querySelector('[data-bedford-ghosts]')?.addEventListener('click',event=>{BedfordFormation.ghosts=!BedfordFormation.ghosts;event.currentTarget.classList.toggle('is-active',BedfordFormation.ghosts);event.currentTarget.setAttribute('aria-pressed',String(BedfordFormation.ghosts));event.currentTarget.textContent=`Ghosts ${BedfordFormation.ghosts?'On':'Off'}`;if(BedfordFormation.preview.length)renderBedfordFormationPreview();});
  bindBedfordStageEditing();
  bindBedfordSplitEditing();
  bindBedfordLiveViewers();
  bindBedford3DPanPresentation();
  bindBedfordMusicMap();
  bindBedfordAdvancedMusicMap();
  document.querySelector('[data-music-map-controls]')?.addEventListener('change',scheduleBedfordCreativeDataSave);
  bindBedfordExportTools();
  applyBedfordViewerLayout();
}
function bindBedford3DPanPresentation(){const canvas=document.querySelector('[data-bedford-3d]');if(!canvas||canvas.dataset.panPresentationBound)return;canvas.dataset.panPresentationBound='1';const apply=()=>{canvas.style.translate=`${Number(BState.visualViewer.screenX||0)}px ${Number(BState.visualViewer.screenY||0)}px`;};canvas.addEventListener('pointermove',apply);canvas.addEventListener('pointerup',apply);document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{BState.visualViewer.screenX=0;BState.visualViewer.screenY=-105;BState.visualViewer.manualCamera=false;apply();}));apply();}
function scheduleBedfordCreativeDataSave(){clearTimeout(BState.musicMap.saveTimer);BState.musicMap.saveTimer=setTimeout(()=>saveTimeline(false),500);}

function bindBedfordMusicMap(){const controls=document.querySelector('[data-live-viewer-controls]');if(controls&&!document.querySelector('[data-music-map-controls]'))controls.insertAdjacentHTML('afterend',`<div class="bedford-music-map" data-music-map-controls><strong>Music map</strong><label>Tempo <span><input type="number" min="20" max="300" step="0.01" value="${Number(BState.musicMap.bpm).toFixed(2)}" data-music-bpm> BPM</span></label><label>Meter <select data-music-meter>${[2,3,4,5,6,7,8,9,12].map(v=>`<option value="${v}" ${Number(BState.musicMap.meter)===v?'selected':''}>${v}/4</option>`).join('')}</select></label><label>Downbeat <span><input type="number" min="0" step="0.01" value="${Number(BState.musicMap.downbeat).toFixed(2)}" data-music-downbeat> sec</span></label><label class="checkbox-row"><input type="checkbox" data-music-snap ${BState.musicMap.snap?'checked':''}><span>Snap timeline actions to beats</span></label><div class="blocking-tool-buttons"><button class="button button-primary button-small" data-tap-tempo>Tap tempo</button><button class="button button-secondary button-small" data-set-downbeat>Set downbeat here</button><button class="button button-secondary button-small" data-add-beat-anchor>Add beat anchor</button><button class="button button-secondary button-small" data-snap-playhead>Snap playhead</button></div><small data-music-map-status>${bedfordMusicMapStatus()}</small></div>`);const bpm=document.querySelector('[data-music-bpm]'),meter=document.querySelector('[data-music-meter]'),downbeat=document.querySelector('[data-music-downbeat]');if(bpm)bpm.oninput=()=>{BState.musicMap.bpm=Math.max(20,Math.min(300,Number(bpm.value)||120));saveBlockingUiPrefs();updateBedfordMusicMapStatus();};if(meter)meter.onchange=()=>{BState.musicMap.meter=Number(meter.value)||4;saveBlockingUiPrefs();updateBedfordMusicMapStatus();};if(downbeat)downbeat.oninput=()=>{BState.musicMap.downbeat=Math.max(0,Number(downbeat.value)||0);saveBlockingUiPrefs();updateBedfordMusicMapStatus();};document.querySelector('[data-music-snap]')?.addEventListener('change',e=>{BState.musicMap.snap=e.target.checked;saveBlockingUiPrefs();});document.querySelector('[data-tap-tempo]')?.addEventListener('click',tapBedfordTempo);document.querySelector('[data-set-downbeat]')?.addEventListener('click',setBedfordDownbeatHere);document.querySelector('[data-add-beat-anchor]')?.addEventListener('click',addBedfordBeatAnchor);document.querySelector('[data-snap-playhead]')?.addEventListener('click',()=>seekTimeline(snapBedfordBeatTime(timelineCurrentTime())));}
function bedfordBeatSeconds(seconds=timelineCurrentTime()){return 60/Math.max(20,bedfordTempoAt(seconds))}
function snapBedfordBeatTime(seconds){if(!BState.musicMap.snap)return Math.max(0,Number(seconds)||0);const beat=bedfordBeatSeconds(seconds),changes=[...(BState.musicMap.tempoChanges||[])].filter(x=>Number(x.time)<=Number(seconds)).sort((a,b)=>a.time-b.time),origin=changes.length?Number(changes[changes.length-1].time):Number(BState.musicMap.downbeat)||0;return Math.max(0,origin+Math.round((Number(seconds)-origin)/beat)*beat)}
function bedfordBeatAt(seconds){const beat=bedfordBeatSeconds(seconds),index=Math.round((Number(seconds)-Number(BState.musicMap.downbeat||0))/beat),meter=Math.max(1,Number(BState.musicMap.meter)||4);return {index,measure:Math.floor(index/meter)+1,count:(index%meter+meter)%meter+1,time:Number(BState.musicMap.downbeat||0)+index*beat}}
function bedfordMusicMapStatus(){const b=bedfordBeatAt(timelineCurrentTime());return `${Number(BState.musicMap.bpm).toFixed(2)} BPM · ${BState.musicMap.meter}/4 · measure ${Math.max(1,b.measure)}, beat ${b.count}`}
function updateBedfordMusicMapStatus(){const el=document.querySelector('[data-music-map-status]');if(el)el.textContent=bedfordMusicMapStatus();}
function tapBedfordTempo(){const now=performance.now(),taps=BState.musicMap.taps;taps.push(now);while(taps.length>8)taps.shift();if(taps.length>1){const gaps=taps.slice(1).map((v,i)=>v-taps[i]),average=gaps.reduce((a,b)=>a+b,0)/gaps.length;BState.musicMap.bpm=Math.max(20,Math.min(300,60000/average));const input=document.querySelector('[data-music-bpm]');if(input)input.value=BState.musicMap.bpm.toFixed(2);saveBlockingUiPrefs();updateBedfordMusicMapStatus();}}
function setBedfordDownbeatHere(){BState.musicMap.downbeat=Math.max(0,timelineCurrentTime());const input=document.querySelector('[data-music-downbeat]');if(input)input.value=BState.musicMap.downbeat.toFixed(2);saveBlockingUiPrefs();updateBedfordMusicMapStatus();BRM.toast('Downbeat set at '+formatTimelineTime(BState.musicMap.downbeat)+'.','success');}
function addBedfordBeatAnchor(){if(!canEdit())return;const time=snapBedfordBeatTime(timelineCurrentTime()),beat=bedfordBeatAt(time);BState.timeline.markers.push({TimeSeconds:time,Label:`Beat anchor M${Math.max(1,beat.measure)}.${beat.count}`,MarkerType:'Beat Anchor',Measure:String(Math.max(1,beat.measure)),CountLabel:String(beat.count),Notes:`Manual anchor · ${Number(BState.musicMap.bpm).toFixed(2)} BPM · ${BState.musicMap.meter}/4`});BState.timeline.markers.sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));refreshTimelineDock();saveTimeline(false);BRM.toast('Manual beat anchor added.','success');}
function bindBedfordAdvancedMusicMap(){const map=document.querySelector('[data-music-map-controls]');if(!map||map.querySelector('[data-advanced-music-map]'))return;map.insertAdjacentHTML('beforeend',`<div class="bedford-advanced-music" data-advanced-music-map><div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-add-tempo-change>Tempo change here</button><button class="button button-secondary button-small" data-add-rubato>Rubato region</button><button class="button button-secondary button-small" data-add-free-time>Free-time region</button><button class="button button-secondary button-small" data-add-fermata>Fermata</button><button class="button button-secondary button-small" data-fit-beat-anchors>Fit anchors</button></div><div data-music-events>${renderBedfordMusicEvents()}</div></div>`);document.querySelector('[data-add-tempo-change]')?.addEventListener('click',openBedfordTempoChange);document.querySelector('[data-add-rubato]')?.addEventListener('click',()=>openBedfordTimingRegion('Rubato'));document.querySelector('[data-add-free-time]')?.addEventListener('click',()=>openBedfordTimingRegion('Free Time'));document.querySelector('[data-add-fermata]')?.addEventListener('click',()=>openBedfordTimingRegion('Fermata'));document.querySelector('[data-fit-beat-anchors]')?.addEventListener('click',fitBedfordBeatAnchors);document.querySelectorAll('[data-delete-tempo]').forEach(b=>b.onclick=()=>{BState.musicMap.tempoChanges.splice(Number(b.dataset.deleteTempo),1);saveBlockingUiPrefs();refreshBedfordMusicEvents();});document.querySelectorAll('[data-delete-region]').forEach(b=>b.onclick=()=>{BState.musicMap.regions.splice(Number(b.dataset.deleteRegion),1);saveBlockingUiPrefs();refreshBedfordMusicEvents();});}
function renderBedfordMusicEvents(){const changes=[...(BState.musicMap.tempoChanges||[])].sort((a,b)=>a.time-b.time),regions=BState.musicMap.regions||[];return `<div class="bedford-music-events">${changes.map((x,i)=>`<span>Tempo ${Number(x.bpm).toFixed(2)} at ${formatTimelineTime(x.time)} <button data-delete-tempo="${i}">×</button></span>`).join('')}${regions.map((x,i)=>`<span>${BRM.escape(x.type)} ${formatTimelineTime(x.start)}–${formatTimelineTime(x.end)} <button data-delete-region="${i}">×</button></span>`).join('')||'<small>No tempo changes or expressive-time regions yet.</small>'}</div>`}
function refreshBedfordMusicEvents(){const host=document.querySelector('[data-music-events]');if(!host)return;host.innerHTML=renderBedfordMusicEvents();host.querySelectorAll('[data-delete-tempo]').forEach(b=>b.onclick=()=>{BState.musicMap.tempoChanges.splice(Number(b.dataset.deleteTempo),1);saveBlockingUiPrefs();refreshBedfordMusicEvents();});host.querySelectorAll('[data-delete-region]').forEach(b=>b.onclick=()=>{BState.musicMap.regions.splice(Number(b.dataset.deleteRegion),1);saveBlockingUiPrefs();refreshBedfordMusicEvents();});}
function openBedfordTempoChange(){const time=timelineCurrentTime();openModal('Tempo Change',`<div class="form-grid"><div class="field"><label>Start time</label><input type="number" min="0" step="0.01" value="${time.toFixed(2)}" data-tempo-time></div><div class="field"><label>New BPM</label><input type="number" min="20" max="300" step="0.01" value="${bedfordTempoAt(time).toFixed(2)}" data-tempo-value></div></div>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-save-tempo>Save</button>`);document.querySelector('[data-modal-close]').onclick=closeModal;document.querySelector('[data-save-tempo]').onclick=()=>{const change={time:Math.max(0,Number(document.querySelector('[data-tempo-time]').value)||0),bpm:Math.max(20,Math.min(300,Number(document.querySelector('[data-tempo-value]').value)||120))};BState.musicMap.tempoChanges.push(change);BState.musicMap.tempoChanges.sort((a,b)=>a.time-b.time);saveBlockingUiPrefs();closeModal();refreshBedfordMusicEvents();updateBedfordMusicMapStatus();};}
function openBedfordTimingRegion(type){const start=timelineCurrentTime(),defaultLength=type==='Fermata'?1:4;openModal(type,`<div class="form-grid"><div class="field"><label>Start</label><input type="number" min="0" step="0.01" value="${start.toFixed(2)}" data-region-start></div><div class="field"><label>End</label><input type="number" min="0" step="0.01" value="${(start+defaultLength).toFixed(2)}" data-region-end></div><div class="field span-2"><label>Note</label><input data-region-note placeholder="Director timing note"></div></div>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-save-region>Save</button>`);document.querySelector('[data-modal-close]').onclick=closeModal;document.querySelector('[data-save-region]').onclick=()=>{const a=Math.max(0,Number(document.querySelector('[data-region-start]').value)||0),b=Math.max(a+.01,Number(document.querySelector('[data-region-end]').value)||a+defaultLength);BState.musicMap.regions.push({type,start:a,end:b,note:document.querySelector('[data-region-note]').value||''});saveBlockingUiPrefs();closeModal();refreshBedfordMusicEvents();};}
function bedfordTempoAt(seconds){let bpm=Number(BState.musicMap.bpm)||120;for(const change of [...(BState.musicMap.tempoChanges||[])].sort((a,b)=>a.time-b.time)){if(Number(change.time)>Number(seconds))break;bpm=Number(change.bpm)||bpm;}return bpm}
function fitBedfordBeatAnchors(){const anchors=(BState.timeline.markers||[]).filter(m=>String(m.MarkerType)==='Beat Anchor').sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));if(anchors.length<2)return BRM.toast('Add at least two beat anchors before fitting.','warning');let made=0;for(let i=1;i<anchors.length;i++){const a=anchors[i-1],b=anchors[i],beats=Math.max(1,(Number(b.Measure||1)-Number(a.Measure||1))*Number(BState.musicMap.meter||4)+(Number(b.CountLabel||1)-Number(a.CountLabel||1))),seconds=Number(b.TimeSeconds)-Number(a.TimeSeconds);if(seconds>0&&beats>0){BState.musicMap.tempoChanges.push({time:Number(a.TimeSeconds),bpm:60*beats/seconds});made++;}}BState.musicMap.tempoChanges.sort((a,b)=>a.time-b.time);saveBlockingUiPrefs();refreshBedfordMusicEvents();BRM.toast(`${made} anchor-fitted tempo segment${made===1?'':'s'} created.`,'success');}
function bindBedfordExportTools(){const map=document.querySelector('[data-music-map-controls]');if(!map||document.querySelector('[data-bedford-export-tools]'))return;map.insertAdjacentHTML('afterend',`<div class="bedford-export-tools" data-bedford-export-tools><strong>Export & offline rehearsal</strong><div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-export-jpg>JPG picture</button><button class="button button-primary button-small" data-record-view>Record current view</button><button class="button button-danger button-small" data-stop-view-recording disabled>Stop recording</button><button class="button button-secondary button-small" data-export-rehearsal>Offline rehearsal JSON</button></div><label>Recording audio <select data-record-audio><option value="track">Track / scene audio</option><option value="video">Reference-video audio</option><option value="none">No audio</option></select></label><small data-export-status>Records the active 2D, 3D, Video, or Combined view as WebM when supported by this browser.</small></div>`);document.querySelector('[data-export-jpg]')?.addEventListener('click',exportBedfordJpg);document.querySelector('[data-record-view]')?.addEventListener('click',startBedfordViewRecording);document.querySelector('[data-stop-view-recording]')?.addEventListener('click',stopBedfordViewRecording);document.querySelector('[data-export-rehearsal]')?.addEventListener('click',exportBedfordOfflineRehearsal);}
function bedfordFilename(suffix,ext){const scene=`scene-${BState.scene}${BState.cue?'-cue-'+String(BState.cue).replace(/[^a-z0-9-]/gi,'-'):''}`;return `bedford-${scene}-${suffix}.${ext}`}
function exportBedfordJpg(){if(!BState.stage)return;const source=BState.stage.toCanvas({pixelRatio:1.5}),out=document.createElement('canvas');out.width=source.width;out.height=source.height;const c=out.getContext('2d');c.fillStyle='#111827';c.fillRect(0,0,out.width,out.height);c.drawImage(source,0,0);downloadDataUrl(bedfordFilename('blocking','jpg'),out.toDataURL('image/jpeg',.92));BRM.toast('JPG blocking picture downloaded.','success');}
function drawBedfordRecordingFrame(canvas){const c=canvas.getContext('2d'),mode=BState.visualViewer.mode,w=canvas.width,h=canvas.height;c.fillStyle='#07111f';c.fillRect(0,0,w,h);const stage=BState.stage?.toCanvas({pixelRatio:1}),three=document.querySelector('[data-bedford-3d]'),video=document.querySelector('[data-reference-video]');const fit=(src,x,y,dw,dh)=>{const sw=src?.videoWidth||src?.naturalWidth||src?.width,sh=src?.videoHeight||src?.naturalHeight||src?.height;if(!sw||!sh)return;const scale=Math.min(dw/sw,dh/sh),rw=sw*scale,rh=sh*scale;c.drawImage(src,x+(dw-rw)/2,y+(dh-rh)/2,rw,rh)};if(mode==='2d')fit(stage,0,0,w,h);else if(mode==='3d')fit(three,0,0,w,h);else if(mode==='video')fit(video,0,0,w,h);else{const primary=BState.visualViewer.primary,sources={'2d':stage,'3d':three,video},main=sources[primary],others=['2d','3d','video'].filter(v=>v!==primary);fit(main,0,0,w*.74,h);fit(sources[others[0]],w*.74,0,w*.26,h/2);fit(sources[others[1]],w*.74,h/2,w*.26,h/2);}c.fillStyle='rgba(15,23,42,.8)';c.fillRect(8,h-30,210,22);c.fillStyle='#fff';c.font='14px sans-serif';c.fillText(formatTimelineTime(timelineCurrentTime()),16,h-14);}
async function startBedfordViewRecording(){if(BState.visualViewer.exportRecorder)return;if(typeof MediaRecorder==='undefined')return BRM.toast('This browser cannot record the viewer. Try current Chrome or Edge.','error');const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const stream=canvas.captureStream(30),audioChoice=document.querySelector('[data-record-audio]')?.value||'track',media=audioChoice==='video'?document.querySelector('[data-reference-video]'):BState.timeline.audio;try{const audioStream=media?.captureStream?.()||media?.mozCaptureStream?.();audioStream?.getAudioTracks?.().forEach(track=>stream.addTrack(track));}catch(error){console.warn('Recording audio capture unavailable',error);}const chunks=[],mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>!MediaRecorder.isTypeSupported||MediaRecorder.isTypeSupported(x))||'';let recorder;try{recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6000000}:undefined);}catch{recorder=new MediaRecorder(stream);}recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=()=>{cancelAnimationFrame(BState.visualViewer.exportRaf);BState.visualViewer.exportRaf=0;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=bedfordFilename(BState.visualViewer.mode+'-rehearsal','webm');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);BState.visualViewer.exportRecorder=null;updateBedfordRecordingButtons(false);};BState.visualViewer.exportRecorder=recorder;const frame=()=>{drawBedfordRecordingFrame(canvas);BState.visualViewer.exportRaf=requestAnimationFrame(frame)};frame();recorder.start(1000);updateBedfordRecordingButtons(true);if(!BState.timeline.playing)startTimelinePlayback();}
function stopBedfordViewRecording(){const recorder=BState.visualViewer.exportRecorder;if(recorder&&recorder.state!=='inactive')recorder.stop();}
function updateBedfordRecordingButtons(active){const start=document.querySelector('[data-record-view]'),stop=document.querySelector('[data-stop-view-recording]'),status=document.querySelector('[data-export-status]');if(start)start.disabled=active;if(stop)stop.disabled=!active;if(status)status.textContent=active?'Recording… press Stop recording when finished.':'Records the active viewer as WebM when supported by this browser.';}
function exportBedfordOfflineRehearsal(){const payload={format:'bedford-blocking-offline-rehearsal',version:1,exportedAt:new Date().toISOString(),scene:BState.scene,cue:BState.cue,snapshot:BState.snapshot,placements:BState.placements,objects:BState.objects,timeline:timelineSavePayload('export'),musicMap:{...BState.musicMap,taps:[],waveform:[],waveformKey:''},cast:(BState.data.cast||[]).map(({PhotoData,...cast})=>cast)};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=bedfordFilename('offline-rehearsal','json');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);BRM.toast('Offline rehearsal JSON downloaded.','success');}

function bindBedfordLiveViewers(){const editing=document.querySelector('.blocking-stage-editing');if(editing&&!document.querySelector('[data-live-viewer-controls]'))editing.insertAdjacentHTML('afterend',`<div class="bedford-live-viewer-controls" data-live-viewer-controls><strong>Live viewer</strong><div class="blocking-tool-buttons">${[['2d','2D'],['3d','3D'],['video','Video'],['combined','Combined']].map(([v,l])=>`<button class="button button-secondary button-small ${BState.visualViewer.mode===v?'is-active':''}" data-live-mode="${v}">${l}</button>`).join('')}</div><label>Reference video <input type="file" accept="video/*" data-reference-file></label><label>Video offset (seconds) <input type="number" step="0.01" value="${BState.visualViewer.videoOffset.toFixed(2)}" data-video-offset></label><div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-video-nudge="-0.1">−0.10s</button><button class="button button-primary button-small" data-video-align>Align current frames</button><button class="button button-secondary button-small" data-video-nudge="0.1">+0.10s</button></div><label>Large combined pane <select data-combined-primary><option value="2d">2D</option><option value="3d">3D</option><option value="video">Video</option></select></label><small>Pause, scrub the reference video to its matching frame, then choose Align current frames. Video stays local to this browser session.</small></div>`);document.querySelectorAll('[data-live-mode]').forEach(button=>button.onclick=()=>setBedfordLiveMode(button.dataset.liveMode));document.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{BState.visualViewer.camera=button.dataset.camera;BState.visualViewer.yaw=0;BState.visualViewer.zoom=1;BState.visualViewer.lift=0;renderBedford3D(true);});const file=document.querySelector('[data-reference-file]');if(file)file.onchange=()=>loadBedfordReferenceVideo(file.files?.[0]);const offset=document.querySelector('[data-video-offset]');if(offset)offset.oninput=()=>{BState.visualViewer.videoOffset=Number(offset.value)||0;syncBedfordReferenceVideo(true);};document.querySelectorAll('[data-video-nudge]').forEach(button=>button.onclick=()=>setBedfordVideoOffset(BState.visualViewer.videoOffset+Number(button.dataset.videoNudge)));document.querySelector('[data-video-align]')?.addEventListener('click',alignBedfordReferenceVideo);const primary=document.querySelector('[data-combined-primary]');if(primary){primary.value=BState.visualViewer.primary;primary.onchange=()=>{BState.visualViewer.primary=primary.value;applyBedfordLiveMode();};}bindBedford3DGestures();applyBedfordLiveMode();}
function setBedfordVideoOffset(value){BState.visualViewer.videoOffset=Math.round(Number(value||0)*100)/100;const input=document.querySelector('[data-video-offset]');if(input)input.value=BState.visualViewer.videoOffset.toFixed(2);syncBedfordReferenceVideo(true);}
function alignBedfordReferenceVideo(){const video=document.querySelector('[data-reference-video]');if(!video?.src)return BRM.toast('Choose a reference video first.','warning');setBedfordVideoOffset(Number(video.currentTime||0)-timelineCurrentTime());BRM.toast(`Reference aligned at ${BState.visualViewer.videoOffset>=0?'+':''}${BState.visualViewer.videoOffset.toFixed(2)}s.`,'success');}
function bindBedford3DGestures(){const canvas=document.querySelector('[data-bedford-3d]');if(!canvas||canvas.dataset.gesturesBound)return;canvas.dataset.gesturesBound='1';canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button>2)return;e.preventDefault();const state=BState.visualViewer,orbiting=e.button===2||(e.button===0&&e.ctrlKey);if(orbiting)state.manualCamera=true;canvas.setPointerCapture?.(e.pointerId);state.drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,orbiting,yaw:state.yaw,lift:state.lift,screenX:state.screenX,screenY:state.screenY};});canvas.addEventListener('pointermove',e=>{const state=BState.visualViewer,d=state.drag;if(!d||d.pointerId!==e.pointerId)return;e.preventDefault();if(d.orbiting){state.yaw=Math.max(-Math.PI*2,Math.min(Math.PI*2,d.yaw+(e.clientX-d.x)*.35*Math.PI/180));state.lift=Math.max(-.25,Math.min(.30,d.lift-(e.clientY-d.y)*.0025));}else{const rect=canvas.getBoundingClientRect(),scaleX=canvas.width/Math.max(1,rect.width)/(devicePixelRatio||1),scaleY=canvas.height/Math.max(1,rect.height)/(devicePixelRatio||1);state.screenX=d.screenX+(e.clientX-d.x)*scaleX;state.screenY=d.screenY+(e.clientY-d.y)*scaleY;}renderBedford3D(true);});const end=e=>{if(BState.visualViewer.drag?.pointerId===e.pointerId)BState.visualViewer.drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('wheel',e=>{e.preventDefault();const state=BState.visualViewer,delta=Math.max(-80,Math.min(80,e.deltaY));state.manualCamera=true;state.zoom=Math.max(.55,Math.min(2.4,state.zoom*Math.exp(-delta*.0007)));renderBedford3D(true);},{passive:false});}
function setBedfordLiveMode(mode){BState.visualViewer.mode=['2d','3d','video','combined'].includes(mode)?mode:'2d';document.querySelectorAll('[data-live-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.liveMode===BState.visualViewer.mode));applyBedfordLiveMode();}
function applyBedfordLiveMode(){const mode=BState.visualViewer.mode,stage=document.querySelector('#blocking-stage'),split=document.querySelector('[data-split-view]'),host=document.querySelector('[data-live-viewers]');if(!stage||!host)return;const live=mode!=='2d';host.hidden=!live;if(split)split.hidden=live||BState.viewerLayout!=='split';stage.hidden=live||BState.viewerLayout==='split';host.dataset.mode=mode;host.dataset.primary=BState.visualViewer.primary;host.querySelector('[data-pane="2d"]')?.toggleAttribute('hidden',mode!=='combined');host.querySelector('[data-pane="3d"]')?.toggleAttribute('hidden',mode==='video');host.querySelector('[data-pane="video"]')?.toggleAttribute('hidden',mode==='3d');if(mode==='3d'||mode==='combined')renderBedford3D(true);if(mode==='video'||mode==='combined')syncBedfordReferenceVideo(true);refreshBedfordCombined2D(true);}
function refreshBedfordCombined2D(force=false){if(BState.visualViewer.mode!=='combined'||!BState.stage)return;const image=document.querySelector('[data-combined-2d]');if(!image)return;const now=performance.now();if(!force&&now-BState.viewerSplitLastDraw<80)return;try{image.src=BState.stage.toDataURL({pixelRatio:1});}catch{}}
function loadBedfordReferenceVideo(file){if(!file)return;if(BState.visualViewer.videoUrl)URL.revokeObjectURL(BState.visualViewer.videoUrl);BState.visualViewer.videoUrl=URL.createObjectURL(file);const video=document.querySelector('[data-reference-video]');if(video){video.src=BState.visualViewer.videoUrl;video.load();}document.querySelector('[data-video-empty]')?.toggleAttribute('hidden',true);syncBedfordReferenceVideo(true);}
function syncBedfordReferenceVideo(force=false){const video=document.querySelector('[data-reference-video]');if(!video?.src)return;const target=Math.max(0,timelineCurrentTime()+Number(BState.visualViewer.videoOffset||0));if(force||Math.abs(Number(video.currentTime||0)-target)>.18){try{video.currentTime=Math.min(target,Number(video.duration)||target)}catch{}}video.playbackRate=BState.timeline.speed||1;if(BState.timeline.playing){if(video.paused)video.play().catch(()=>{});}else if(!video.paused)video.pause();}
function performerHeightFeet(cast){const raw=Number(cast?.HeightFeet||cast?.Height||cast?.height);return Number.isFinite(raw)&&raw>=3&&raw<=8?raw:5.7}
function renderBedford3DLegacy(force=false){}
function renderBedford3D(force=false){const canvas=document.querySelector('[data-bedford-3d]');if(!canvas)return;const state=BState.visualViewer,now=performance.now();if(!force&&now-state.last3dDraw<45)return;state.last3dDraw=now;const box=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.max(500,Math.round(box.width||1000)),h=Math.max(360,Math.round(box.height||700));if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const camera=state.camera,horizon=h*((camera==='floor'?.36:camera==='low'?.27:camera==='overhead'?.08:.18)+state.lift),bottom=h*.96,zoom=state.zoom;c.fillStyle='#07111f';c.fillRect(0,0,w,h);c.beginPath();c.moveTo(w*.08,bottom);c.lineTo(w*.92,bottom);c.lineTo(w*.68,horizon);c.lineTo(w*.32,horizon);c.closePath();c.fillStyle='#182235';c.fill();c.strokeStyle='rgba(248,185,24,.3)';c.lineWidth=1;for(let i=0;i<=10;i++){const u=i/10;c.beginPath();c.moveTo(w*(.08+.84*u),bottom);c.lineTo(w*(.32+.36*u),horizon);c.stroke();}for(let i=0;i<=12;i++){const u=i/12,y=horizon+(bottom-horizon)*Math.pow(u,1.5);c.beginPath();c.moveTo(w*(.32-.24*Math.pow(u,1.2)),y);c.lineTo(w*(.68+.24*Math.pow(u,1.2)),y);c.stroke();}const sin=Math.sin(state.yaw),cos=Math.cos(state.yaw),people=BState.placements.map(p=>{const cast=castById(p.BlockingCastID)||{},pos=timelinePositionForEntity('cast:'+p.BlockingCastID,timelineCurrentTime())||{x:p.XPercent,y:p.YPercent},nx=(Number(pos.x)-50)/50,nz=(Number(pos.y)-50)/50,rx=nx*cos-nz*sin,rz=nx*sin+nz*cos,depth=Math.max(0,Math.min(1,(rz+1)/2)),spread=(.3+.5*Math.pow(depth,1.1))*zoom,x=w/2+rx*w*.5*spread,y=horizon+(bottom-horizon)*Math.pow(depth,1.42),scale=(.38+depth*.95)*zoom*(performerHeightFeet(cast)/5.7);return {p,cast,x,y,scale,depth}}).sort((a,b)=>a.depth-b.depth);people.forEach(({p,cast,x,y,scale})=>{const style=tokenStyle(cast),gender=String(cast.AvatarType||cast.Gender||'neutral').toLowerCase(),body=gender.includes('female')?'female':gender.includes('male')?'male':'neutral',head=10*scale,top=y-76*scale;c.save();c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x,y+2,20*scale,6*scale,0,0,Math.PI*2);c.fill();c.fillStyle=style.background;c.strokeStyle=style.outline;c.lineWidth=Math.max(1.5,2.5*scale);c.beginPath();c.arc(x,top,head,0,Math.PI*2);c.fill();c.stroke();c.beginPath();const shoulder=body==='male'?19:body==='female'?15:17,hip=body==='female'?18:body==='male'?13:15;c.moveTo(x-shoulder*scale,top+17*scale);c.quadraticCurveTo(x-hip*scale,top+43*scale,x-hip*scale,top+53*scale);c.lineTo(x-8*scale,y-24*scale);c.lineTo(x-14*scale,y);c.lineTo(x-4*scale,y);c.lineTo(x,y-25*scale);c.lineTo(x+4*scale,y);c.lineTo(x+14*scale,y);c.lineTo(x+8*scale,y-24*scale);c.lineTo(x+hip*scale,top+53*scale);c.quadraticCurveTo(x+hip*scale,top+43*scale,x+shoulder*scale,top+17*scale);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(x-shoulder*scale,top+20*scale);c.lineTo(x-27*scale,top+43*scale);c.moveTo(x+shoulder*scale,top+20*scale);c.lineTo(x+27*scale,top+43*scale);c.stroke();c.fillStyle='#fff';c.font=`600 ${Math.max(9,11*scale)}px sans-serif`;c.textAlign='center';c.fillText(p.LabelOverride||cast.CharacterName||'',x,y+16*scale);c.restore();});}

function setBedfordViewerLayout(mode){BState.viewerLayout=mode==='split'?'split':'full';saveBlockingUiPrefs();applyBedfordViewerLayout();document.querySelectorAll('[data-viewer-layout]').forEach(button=>button.classList.toggle('is-active',button.dataset.viewerLayout===BState.viewerLayout));}
function splitLogicalPointer(event,halfName){const img=event.currentTarget,rect=img.getBoundingClientRect();if(!rect.width||!rect.height)return null;const x=Math.max(0,Math.min(LOGICAL_W,(event.clientX-rect.left)/rect.width*LOGICAL_W)),localY=Math.max(0,Math.min(LOGICAL_H/2,(event.clientY-rect.top)/rect.height*(LOGICAL_H/2)));return {x,y:localY+(halfName==='bottom'?LOGICAL_H/2:0)}}
function splitEditableTarget(point){let best=null,distance=Infinity;for(const p of BState.placements){if(p.Locked||p.Visible===false)continue;const d=Math.hypot(point.x-Number(p.XPercent)/100*LOGICAL_W,point.y-Number(p.YPercent)/100*LOGICAL_H);if(d<distance&&d<75){best={kind:'placement',row:p};distance=d;}}if(BState.objectEditMode)for(const o of BState.objects){const d=Math.hypot(point.x-Number(o.XPercent)/100*LOGICAL_W,point.y-Number(o.YPercent)/100*LOGICAL_H);if(d<distance&&d<95){best={kind:'object',row:o};distance=d;}}return best}
function applyBedfordSplitTransforms(){document.querySelectorAll('[data-split-bottom],[data-split-top]').forEach(img=>{const half=img.hasAttribute('data-split-bottom')?'bottom':'top',view=BState.splitView[half];img.style.transform=`translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`;});scheduleSharpBedfordSplitRender();}
function scheduleSharpBedfordSplitRender(){clearTimeout(BState.viewerSplitSharpTimer);BState.viewerSplitSharpTimer=setTimeout(()=>refreshBedfordSplitViewer(true),120);}
function bindBedfordSplitEditing(){document.querySelectorAll('[data-split-bottom],[data-split-top]').forEach(img=>{if(img.dataset.splitEditBound)return;img.dataset.splitEditBound='1';img.draggable=false;const half=img.hasAttribute('data-split-bottom')?'bottom':'top';img.addEventListener('dragstart',e=>e.preventDefault());img.addEventListener('pointerdown',e=>{if(BState.viewerLayout!=='split')return;e.preventDefault();const point=splitLogicalPointer(e,half),target=canEdit()&&point?splitEditableTarget(point):null;img.setPointerCapture?.(e.pointerId);if(!target){const view=BState.splitView[half];BState.splitDrag={kind:'pan',half,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,panX:view.panX,panY:view.panY};return;}pushUndo();BState.splitDrag={kind:'edit',half,target,pointerId:e.pointerId};if(target.kind==='placement'){BState.selectedPlacements.clear();BState.selectedPlacements.add(target.row._localId);BState.selected={kind:'placement',id:target.row._localId};}else{BState.selectedPlacements.clear();BState.selected={kind:'object',id:target.row._localId};}refreshRight();});img.addEventListener('pointermove',e=>{const drag=BState.splitDrag;if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();if(drag.kind==='pan'){const view=BState.splitView[drag.half];view.panX=drag.panX+(e.clientX-drag.startX);view.panY=drag.panY+(e.clientY-drag.startY);applyBedfordSplitTransforms();return;}const point=splitLogicalPointer(e,half);if(!point)return;const snapped=snapStagePoint(point.x,point.y),row=drag.target.row;row.XPercent=Math.max(0,Math.min(100,snapped.x/LOGICAL_W*100));row.YPercent=Math.max(0,Math.min(100,snapped.y/LOGICAL_H*100));renderTokens();renderObjects();renderMovements();refreshBedfordSplitViewer(true);});img.addEventListener('wheel',e=>{if(BState.viewerLayout!=='split')return;e.preventDefault();const view=BState.splitView[half],before=view.zoom,next=Math.max(.5,Math.min(4,before*Math.exp(-e.deltaY*.001)));if(next===before)return;const rect=img.parentElement.getBoundingClientRect(),px=e.clientX-(rect.left+rect.width/2),py=e.clientY-(rect.top+rect.height/2),ratio=next/before;view.panX=px-(px-view.panX)*ratio;view.panY=py-(py-view.panY)*ratio;view.zoom=next;BState.zoom=next;updateZoomDisplays();applyBedfordSplitTransforms();},{passive:false});img.addEventListener('dblclick',e=>{e.preventDefault();BState.splitView[half]={zoom:1,panX:0,panY:0};BState.zoom=1;updateZoomDisplays();applyBedfordSplitTransforms();});const finish=e=>{if(!BState.splitDrag||BState.splitDrag.pointerId!==e.pointerId)return;const edited=BState.splitDrag.kind==='edit';BState.splitDrag=null;if(edited){renderTimelinePaths();updateCount();refreshRight();}};img.addEventListener('pointerup',finish);img.addEventListener('pointercancel',finish);});applyBedfordSplitTransforms();}
function applyBedfordViewerLayout(){const split=document.querySelector('[data-split-view]'),stage=document.querySelector('#blocking-stage');if(!split||!stage)return;const enabled=BState.viewerLayout==='split';split.hidden=!enabled;stage.hidden=enabled;if(enabled)requestAnimationFrame(()=>{refreshBedfordSplitViewer(true);applyBedfordSplitTransforms();});else setTimeout(resizeStage,20);}
function refreshBedfordSplitViewer(force=false){if(BState.viewerLayout!=='split'||!BState.stage)return;const now=performance.now();if(!force&&now-BState.viewerSplitLastDraw<80)return;BState.viewerSplitLastDraw=now;try{const splitZoom=Math.max(1,...Object.values(BState.splitView).map(view=>Number(view.zoom)||1)),pixelRatio=Math.min(4,Math.max(2,Number(window.devicePixelRatio)||1,splitZoom*(Number(window.devicePixelRatio)||1))),full=BState.stage.toCanvas({pixelRatio}),sourceWidth=full.width,sourceHeight=full.height,half=Math.floor(sourceHeight/2);if(!sourceWidth||half<1)return;const makeHalf=startY=>{const canvas=document.createElement('canvas');canvas.width=sourceWidth;canvas.height=half;const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(full,0,startY,sourceWidth,half,0,0,sourceWidth,half);return canvas.toDataURL('image/png');},bottomImg=document.querySelector('[data-split-bottom]'),topImg=document.querySelector('[data-split-top]');if(bottomImg)bottomImg.src=makeHalf(sourceHeight-half);if(topImg)topImg.src=makeHalf(0);}catch(error){console.warn('Bedford split viewer could not refresh',error);}}
function enhanceBlockingNumericControls(root){
  if(!root)return;
  root.querySelectorAll('input[type="number"],input[type="range"]').forEach(input=>{
    if(input.dataset.blockingNumberPair||input.closest('.blocking-transport'))return;
    const min=Number(input.min),max=Number(input.max);if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return;
    input.dataset.blockingNumberPair='source';const exact=document.createElement('input'),slider=document.createElement('input'),companion=input.type==='range'?exact:slider;
    exact.type='number';slider.type='range';for(const node of [exact,slider]){node.min=String(min);node.max=String(max);node.step=input.step||'1';node.value=input.value;node.dataset.blockingNumberPair='paired';}
    companion.className=input.type==='range'?'blocking-paired-number':'blocking-paired-range';input.insertAdjacentElement('afterend',companion);
    const typed=input.type==='number'?input:exact,range=input.type==='range'?input:slider,sync=(source,kind)=>{const value=Number(source.value),valid=Number.isFinite(value)&&value>=min&&value<=max;typed.classList.toggle('blocking-number-invalid',!valid);typed.setAttribute('aria-invalid',String(!valid));if(!valid){typed.setCustomValidity(`Enter a value from ${min} to ${max}.`);return;}typed.setCustomValidity('');typed.value=source.value;range.value=source.value;if(source!==input){input.value=source.value;input.dispatchEvent(new Event(kind,{bubbles:true}));}};
    typed.addEventListener('input',()=>sync(typed,'input'));typed.addEventListener('change',()=>sync(typed,'change'));range.addEventListener('input',()=>sync(range,'input'));range.addEventListener('change',()=>sync(range,'change'));
  });
}
function bindPalette(){
  document.querySelectorAll('[data-cast]').forEach(el=>{el.ondragstart=e=>{e.dataTransfer.setData('text/blocking-cast',el.dataset.cast)};el.onclick=()=>{if(canEdit())addCastToStage(el.dataset.cast,50,22)}});
  document.querySelectorAll('[data-group]').forEach(el=>el.onclick=()=>{if(canEdit())openGroupMemberPicker(el.dataset.group)});
  document.querySelectorAll('[data-manage-cast]').forEach(button=>{if(!button.dataset.boundManageCast){button.dataset.boundManageCast='true';button.addEventListener('click',openCastModal);}});
  document.querySelector('[data-ensemble-roster]')?.addEventListener('click',()=>openEnsembleRosterModal());
  document.querySelector('[data-palette-add-element]')?.addEventListener('click',openStageElementModal);
  document.querySelectorAll('[data-select-object]').forEach(el=>el.onclick=()=>{BState.selectedPlacements.clear();BState.selected={kind:'object',id:el.dataset.selectObject};refreshRight();renderObjects();renderTokens();});
}
function bindDetailButtons(){document.querySelector('[data-toggle-lock]')?.addEventListener('click',toggleLock);document.querySelector('[data-archive-snapshot]')?.addEventListener('click',archiveSnapshot);document.querySelector('[data-delete-snapshot]')?.addEventListener('click',deleteSnapshot);}
function refreshRight(){if(!['cast','groups','elements'].includes(BState.paletteTab))BState.paletteTab='cast';document.querySelectorAll('[data-palette-tab]').forEach(b=>b.classList.toggle('active',b.dataset.paletteTab===BState.paletteTab));const panel=document.querySelector('[data-right-panel]');if(panel){panel.innerHTML=renderPalette();bindPalette();BRM.hydrateProfilePhotos?.(panel);hydrateBlockingCastPhotos(panel);}const insp=document.querySelector('[data-inspector-dock]');if(insp){insp.innerHTML=renderInspector();bindInspector();}const selectedDock=document.querySelector('.blocking-selected-dock');if(selectedDock&&BState.selected)selectedDock.open=true;document.querySelectorAll('[data-map-zoom-selection]').forEach(el=>el.disabled=!BState.selected);hydrateBlockingCastPhotos(document);updateZoomDisplays();updateTokenNameToggleUi();updateMultiSelectUi();updatePhotoSummaryStatus();}

function updateTokenNameToggleUi(){
  document.querySelectorAll('[data-toggle-token-names]').forEach(el=>el.textContent=BState.showTokenNames?'Names On':'Names Off');
  const cb=document.querySelector('[data-show-token-names]');
  if(cb)cb.checked=!!BState.showTokenNames;
}
function setTokenNamesVisible(visible){
  BState.showTokenNames=!!visible;
  saveBlockingUiPrefs();
  BState.tokenNodes.forEach(group=>{
    group.find('.blocking-token-label-bg').forEach(node=>node.visible(BState.showTokenNames));
    group.find('.blocking-token-label-text').forEach(node=>node.visible(BState.showTokenNames));
    const layer=group.getLayer();
    if(layer)layer.batchDraw();
  });
  updateTokenNameToggleUi();
}
function toggleTokenNames(){
  setTokenNamesVisible(!BState.showTokenNames);
}
function bindInspector(){
  enhanceSelectedCastPhysicalControls();
  document.querySelectorAll('[data-placement-field]').forEach(el=>el.oninput=()=>{const p=BState.placements.find(x=>x._localId===BState.selected?.id);if(!p)return;pushUndo();p[el.dataset.placementField]=el.type==='range'?Number(el.value):el.value;renderTokens();});
  bindTokenScaleEditor();
  document.querySelector('[data-select-all-performers]')?.addEventListener('click',selectAllPlacements);
  document.querySelector('[data-clear-performer-selection]')?.addEventListener('click',()=>clearPlacementSelection({render:true}));
  document.querySelectorAll('[data-cast-style]').forEach(el=>el.oninput=()=>{const p=BState.placements.find(x=>x._localId===BState.selected?.id),cast=p&&castById(p.BlockingCastID);if(!cast)return;cast[el.dataset.castStyle]=el.value;const preview=document.querySelector('.blocking-token-style-preview');if(preview){const st=tokenStyle(cast);preview.style.setProperty('--blocking-token-bg',st.background);preview.style.setProperty('--blocking-token-text',st.initials);preview.style.setProperty('--blocking-token-outline',st.outline);}renderTokens();refreshCastPaletteStyles();});
  document.querySelector('[data-save-cast-style]')?.addEventListener('click',saveSelectedCastTokenStyle);
  document.querySelector('[data-reset-cast-style]')?.addEventListener('click',resetSelectedCastTokenStyle);
  document.querySelector('[data-reload-cast-photo]')?.addEventListener('click',reloadSelectedCastPhoto);
  document.querySelectorAll('[data-object-field]').forEach(el=>el.oninput=()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;pushUndo();o[el.dataset.objectField]=el.value;renderObjects();if(el.dataset.objectField==='Label')refreshElementListOnly();});
  document.querySelectorAll('[data-object-number]').forEach(el=>el.oninput=()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;pushUndo();o[el.dataset.objectNumber]=Number(el.value);renderObjects();const hint=el.parentElement?.querySelector('.field-hint');if(el.dataset.objectNumber==='TextSize'&&hint)hint.textContent=`${Number(el.value)} px`;});
  document.querySelectorAll('[data-object-bool]').forEach(el=>el.onchange=()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;pushUndo();o[el.dataset.objectBool]=!!el.checked;renderObjects();});
  document.querySelector('[data-object-shape]')?.addEventListener('change',e=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;pushUndo();resetObjectGeometry(o,e.target.value);if(e.target.value==='Text'){o.LabelVisible=true;o.LabelBackground=false;}renderObjects();refreshRight();});
  document.querySelectorAll('[data-edge-color]').forEach(el=>el.oninput=()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;const colors=edgeColors(o,shapePoints(o).length);colors[Number(el.dataset.edgeColor)]=el.value;setEdgeColors(o,colors);renderObjects();});
  document.querySelector('[data-add-vertex]')?.addEventListener('click',()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;pushUndo();const pts=shapePoints(o),a=pts[pts.length-1],b=pts[0];pts.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);o.ShapeType='Custom';setShapePoints(o,pts);setEdgeColors(o,edgeColors(o,pts.length));renderObjects();refreshRight();});
  document.querySelector('[data-remove-vertex]')?.addEventListener('click',()=>{const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o)return;const pts=shapePoints(o);if(pts.length<=3)return;pushUndo();pts.pop();o.ShapeType='Custom';setShapePoints(o,pts);setEdgeColors(o,edgeColors(o,pts.length));renderObjects();refreshRight();});
  document.querySelector('[data-duplicate-object]')?.addEventListener('click',duplicateSelectedObject);
  document.querySelector('[data-remove-selected]')?.addEventListener('click',removeSelected);
}
async function saveSelectedCastTokenStyle(){
  const p=BState.placements.find(x=>x._localId===BState.selected?.id),cast=p&&castById(p.BlockingCastID);if(!cast||!canManage())return;
  const btn=document.querySelector('[data-save-cast-style]');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    const style=tokenStyle(cast);
    await BRM.api('saveBlockingCast',{blockingCastId:cast.BlockingCastID,characterId:cast.CharacterID,userId:cast.UserID||'',displayLabel:cast.DisplayLabel||'',roleLabel:cast.RoleLabel||'',heightFeet:Number(cast.HeightFeet)||5.7,avatarType:cast.AvatarType||'Neutral',status:cast.Status||'Active',sortOrder:Number(cast.SortOrder||1000),tokenBackgroundColor:style.background,tokenInitialColor:style.initials,tokenOutlineColor:style.outline});
    cast.TokenBackgroundColor=style.background;cast.TokenInitialColor=style.initials;cast.TokenOutlineColor=style.outline;BRM.toast('Character token colours saved.','success');
  }catch(error){BRM.toast('Token colours could not save: '+error.message,'error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Save Token Colours';}}
}
function enhanceSelectedCastPhysicalControls(){const section=document.querySelector('.blocking-token-style-editor');if(!section||section.querySelector('[data-cast-physical]'))return;const p=BState.placements.find(x=>x._localId===BState.selected?.id),cast=p&&castById(p.BlockingCastID);if(!cast)return;section.insertAdjacentHTML('afterbegin',`<div class="blocking-cast-physical" data-cast-physical><div class="field"><label>Height (feet)</label><input type="number" min="3" max="8" step="0.01" value="${performerHeightFeet(cast).toFixed(2)}" data-cast-height></div><div class="field"><label>3D avatar</label><select data-cast-avatar>${['Neutral','Female','Male'].map(v=>`<option ${String(cast.AvatarType||'Neutral')===v?'selected':''}>${v}</option>`).join('')}</select></div></div>`);document.querySelector('[data-cast-height]').oninput=e=>{if(e.target.checkValidity()){cast.HeightFeet=Number(e.target.value);renderBedford3D(true);}};document.querySelector('[data-cast-avatar]').onchange=e=>{cast.AvatarType=e.target.value;renderBedford3D(true);};}
function enhanceCastAssignmentForm(){const form=document.querySelector('[data-cast-form] .form-grid');if(!form||form.querySelector('[name=heightFeet]'))return;form.insertAdjacentHTML('beforeend',`<div class="field"><label>Height (feet)</label><input name="heightFeet" type="number" min="3" max="8" step="0.01" value="5.70"></div><div class="field"><label>3D avatar</label><select name="avatarType"><option>Neutral</option><option>Female</option><option>Male</option></select></div>`);}
async function resetSelectedCastTokenStyle(){
  const p=BState.placements.find(x=>x._localId===BState.selected?.id),cast=p&&castById(p.BlockingCastID);if(!cast||!canManage())return;
  cast.TokenBackgroundColor='#5e000f';cast.TokenInitialColor='#ffffff';cast.TokenOutlineColor='#f8b918';renderTokens();refreshRight();await saveSelectedCastTokenStyle();
}
function refreshCastPaletteStyles(){
  document.querySelectorAll('[data-cast]').forEach(row=>{const cast=castById(row.dataset.cast),avatar=row.querySelector('.blocking-cast-avatar');if(!cast||!avatar)return;const st=tokenStyle(cast);avatar.style.setProperty('--blocking-token-bg',st.background);avatar.style.setProperty('--blocking-token-text',st.initials);avatar.style.setProperty('--blocking-token-outline',st.outline);});
}

function refreshElementListOnly(){if(BState.paletteTab!=='elements')return;const panel=document.querySelector('[data-right-panel]');if(panel){panel.innerHTML=renderPalette();bindPalette();}}
function duplicateSelectedObject(){const o=BState.objects.find(x=>x._localId===BState.selected?.id);if(!o||!canEdit())return;pushUndo();const copy=localObject({...o,ObjectID:'',TimelineKey:'',XPercent:Math.min(100,Number(o.XPercent)+3),YPercent:Math.min(100,Number(o.YPercent)+2),Label:(o.Label||o.ObjectType||'Object')+' copy'});BState.objects.push(copy);BState.selected={kind:'object',id:copy._localId};renderObjects();updateCount();refreshRight();}

function initStage(){
  const container=document.querySelector('#blocking-stage');if(!container)return;container.innerHTML='';
  BState.stage=new Konva.Stage({container:'blocking-stage',width:LOGICAL_W,height:LOGICAL_H});
  const bg=new Konva.Layer(),grid=new Konva.Layer(),move=new Konva.Layer(),timeline=new Konva.Layer(),objects=new Konva.Layer(),tokens=new Konva.Layer(),preview=new Konva.Layer();
  BState.layers={bg,grid,move,timeline,objects,tokens,preview};[bg,grid,move,timeline,objects,tokens,preview].forEach(l=>BState.stage.add(l));drawGrid();resizeStage();window.addEventListener('resize',resizeStage,{passive:true});
  BState.stage.on('mousedown touchstart',e=>{
    if(BState.timeline.trace?.armed){beginTimelineTrace();return;}
    if(BState.drawingShape){
      const pointer=BState.stage.getPointerPosition(),scale=BState.stage.scaleX()||1;
      const x=Math.max(0,Math.min(LOGICAL_W,pointer.x/scale)),y=Math.max(0,Math.min(LOGICAL_H,pointer.y/scale));
      BState.drawingShape.points.push([x,y]);renderDrawingPreview();return;
    }
    if(e.target===BState.stage||e.target.getAttr('backgroundHit')){BState.selected=null;BState.selectedPlacements.clear();refreshRight();renderObjects();renderTokens();}
  });
  BState.stage.on('mousemove touchmove',()=>{if(BState.timeline.trace?.drawing)continueTimelineTrace();});
  BState.stage.on('mouseup touchend mouseleave',()=>{if(BState.timeline.trace?.drawing)finishTimelineTrace();});
  BState.stage.on('dblclick dbltap',()=>{if(BState.drawingShape&&BState.drawingShape.points.length>=3)finishCustomShape();});
  installMapZoomGestures();
}
function studioWorkspace(){return document.querySelector('.blocking-workspace')}
function isStudioFullscreen(){const w=studioWorkspace();return !!(w&&(document.fullscreenElement===w||w.classList.contains('blocking-faux-fullscreen')))}
function zoomBounds(){return {min:.35,max:4}}
function mapViewportLogicalCenter(){const wrap=document.querySelector('[data-stage-drop]');const scale=BState.stage?.scaleX?.()||1;if(!wrap)return {x:LOGICAL_W/2,y:LOGICAL_H/2};return {x:(wrap.scrollLeft+wrap.clientWidth/2)/scale,y:(wrap.scrollTop+wrap.clientHeight/2)/scale}}
function updateZoomDisplays(){const pct=Math.round(BState.zoom*100);document.querySelectorAll('[data-zoom-label],[data-map-zoom-value]').forEach(el=>el.textContent=pct+'%');document.querySelectorAll('[data-map-zoom-slider]').forEach(el=>el.value=pct);document.querySelectorAll('[data-map-zoom-preset]').forEach(el=>{if([...el.options].some(o=>o.value===String(pct)))el.value=String(pct);else el.value='';});}
function resizeStage(options={}){
  if(!BState.stage)return;
  const wrap=document.querySelector('[data-stage-drop]');
  const keepCenter=options.keepCenter||null;
  const availableW=Math.max(320,(wrap?.clientWidth||LOGICAL_W)-8);
  let baseScale=Math.min(1,availableW/LOGICAL_W);
  const availableH=Math.max(360,(wrap?.clientHeight||Math.min(window.innerHeight*.72,880))-8);
  baseScale=Math.min(baseScale,availableH/LOGICAL_H);
  const scale=Math.max(.12,baseScale*BState.zoom);
  BState.stage.width(LOGICAL_W*scale);BState.stage.height(LOGICAL_H*scale);BState.stage.scale({x:scale,y:scale});
  updateZoomDisplays();
  if(BState.viewerLayout==='split')requestAnimationFrame(()=>{refreshBedfordSplitViewer(true);applyBedfordSplitTransforms();});
  if(wrap&&keepCenter){requestAnimationFrame(()=>{wrap.scrollLeft=Math.max(0,keepCenter.x*scale-wrap.clientWidth/2);wrap.scrollTop=Math.max(0,keepCenter.y*scale-wrap.clientHeight/2);});}
}
function setZoom(v,options={}){const b=zoomBounds(),center=options.center||mapViewportLogicalCenter();BState.zoom=Math.max(b.min,Math.min(b.max,Math.round(Number(v||1)*20)/20));resizeStage({keepCenter:center});if(BState.viewerLayout==='split'){Object.values(BState.splitView).forEach(view=>view.zoom=BState.zoom);applyBedfordSplitTransforms();}}
function fitMap(){BState.zoom=1;resizeStage();Object.keys(BState.splitView).forEach(key=>BState.splitView[key]={zoom:1,panX:0,panY:0});applyBedfordSplitTransforms();const wrap=document.querySelector('[data-stage-drop]');if(wrap){wrap.scrollLeft=0;wrap.scrollTop=0;}}
function focusMapSelection(){
  let x=LOGICAL_W/2,y=LOGICAL_H/2;
  const many=selectedPlacementRows();
  if(many.length){x=many.reduce((s,p)=>s+Number(p.XPercent||0),0)/many.length/100*LOGICAL_W;y=many.reduce((s,p)=>s+Number(p.YPercent||0),0)/many.length/100*LOGICAL_H;}
  else if(BState.selected?.kind==='object'){const o=BState.objects.find(v=>v._localId===BState.selected.id);if(o){x=o.XPercent/100*LOGICAL_W;y=o.YPercent/100*LOGICAL_H;}}
  else if(BState.selected?.kind==='placement'){const p=BState.placements.find(v=>v._localId===BState.selected.id);if(p){x=p.XPercent/100*LOGICAL_W;y=p.YPercent/100*LOGICAL_H;}}
  else{BRM.toast('Select a performer or stage object first.','info');return;}
  setZoom(Math.max(BState.zoom,many.length>1?1.8:2.5),{center:{x,y}});
}
function bindMapZoomControls(){
  document.querySelectorAll('[data-map-zoom-in]').forEach(el=>el.onclick=()=>setZoom(BState.zoom+.15));
  document.querySelectorAll('[data-map-zoom-out]').forEach(el=>el.onclick=()=>setZoom(BState.zoom-.15));
  document.querySelectorAll('[data-map-zoom-fit]').forEach(el=>el.onclick=fitMap);
  document.querySelectorAll('[data-map-zoom-selection]').forEach(el=>el.onclick=focusMapSelection);
  document.querySelectorAll('[data-map-zoom-slider]').forEach(el=>el.oninput=()=>setZoom(Number(el.value)/100));
  document.querySelectorAll('[data-map-zoom-preset]').forEach(el=>el.onchange=()=>{if(el.value)setZoom(Number(el.value)/100)});
}
function installMapZoomGestures(){
  const wrap=document.querySelector('[data-stage-drop]');if(!wrap||wrap.dataset.zoomGestures==='true')return;wrap.dataset.zoomGestures='true';
  wrap.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const rect=wrap.getBoundingClientRect(),oldScale=BState.stage?.scaleX?.()||1;const logical={x:(wrap.scrollLeft+e.clientX-rect.left)/oldScale,y:(wrap.scrollTop+e.clientY-rect.top)/oldScale};setZoom(BState.zoom*(e.deltaY<0?1.12:.89),{center:logical});},{passive:false});
}

function addVenueText(layer,x,y,text,size=18,opts={}){
  layer.add(new Konva.Text({x,y,width:opts.width||220,text,fontSize:size,fontStyle:opts.bold?'bold':'normal',align:opts.align||'center',fill:opts.fill||'rgba(226,232,240,.58)',rotation:opts.rotation||0,listening:false}));
}
function addVenueLine(layer,points,opts={}){
  layer.add(new Konva.Line({points,stroke:opts.stroke||'rgba(226,232,240,.62)',strokeWidth:opts.width||2,dash:opts.dash||[],lineCap:'round',lineJoin:'round',listening:false}));
}
function drawStairs(layer,s){
  layer.add(new Konva.Rect({x:s.x,y:s.y,width:s.w,height:s.h,fill:'rgba(148,163,184,.07)',stroke:'rgba(226,232,240,.72)',strokeWidth:2,listening:false}));
  const steps=5;
  for(let i=1;i<steps;i++)addVenueLine(layer,[s.x,s.y+s.h*i/steps,s.x+s.w,s.y+s.h*i/steps],{stroke:'rgba(226,232,240,.52)',width:1.5});
}
function drawChairBlock(layer,b){
  const gapX=8,gapY=9,cellW=(b.w-gapX*(b.cols-1))/b.cols,cellH=(b.h-gapY*(b.rows-1))/b.rows;
  for(let r=0;r<b.rows;r++)for(let c=0;c<b.cols;c++){
    const x=b.x+c*(cellW+gapX),y=b.y+r*(cellH+gapY);
    layer.add(new Konva.Rect({x:x+2,y:y+3,width:Math.max(8,cellW-4),height:Math.max(8,cellH-7),cornerRadius:4,fill:'rgba(148,163,184,.055)',stroke:'rgba(203,213,225,.43)',strokeWidth:1.2,listening:false}));
    addVenueLine(layer,[x+3,y+cellH-2,x+cellW-3,y+cellH-2],{stroke:'rgba(203,213,225,.56)',width:1.4});
  }
}
function drawGrid(){
  const l=BState.layers.grid;l.destroyChildren();
  l.add(new Konva.Rect({x:0,y:0,width:LOGICAL_W,height:LOGICAL_H,fill:'#111827',listening:true,backgroundHit:true}));

  // Stage deck and physical room outline.
  l.add(new Konva.Rect({x:0,y:0,width:LOGICAL_W,height:VENUE.stageLipY,fill:'#182235',listening:false}));
  l.add(new Konva.Rect({x:0,y:VENUE.stageLipY,width:LOGICAL_W,height:LOGICAL_H-VENUE.stageLipY,fill:'#202030',listening:false}));
  addVenueLine(l,[0,0,LOGICAL_W,0,LOGICAL_W,LOGICAL_H,0,LOGICAL_H,0,0],{stroke:'rgba(226,232,240,.78)',width:3});

  // The reference drawing's main set / projection rectangle.
  const z=VENUE.scenicZone;
  l.add(new Konva.Rect({x:z.x,y:z.y,width:z.w,height:z.h,stroke:'rgba(248,185,24,.55)',strokeWidth:2,dash:[15,12],cornerRadius:2,listening:false}));
  addVenueText(l,z.x,z.y+z.h/2-15,'MAIN STAGE / SET AREA',24,{width:z.w,bold:true,fill:'rgba(248,185,24,.18)'});

  // Side stage boundaries and the downstage lip.
  addVenueLine(l,[VENUE.stageLeftX,VENUE.stageLipY,VENUE.stageLeftX,VENUE.stageSideTopY,205,VENUE.stageSideTopY],{stroke:'rgba(226,232,240,.75)',width:3});
  addVenueLine(l,[VENUE.stageRightX,VENUE.stageLipY,VENUE.stageRightX,VENUE.stageSideTopY,795,VENUE.stageSideTopY],{stroke:'rgba(226,232,240,.75)',width:3});
  addVenueLine(l,[0,VENUE.stageLipY,LOGICAL_W,VENUE.stageLipY],{stroke:'#f8b918',width:4});
  addVenueLine(l,[LOGICAL_W/2,0,LOGICAL_W/2,LOGICAL_H],{stroke:'rgba(248,185,24,.20)',width:1.5,dash:[12,10]});

  // The real side-floor entrances adjacent to the stage.
  l.add(new Konva.Rect({x:0,y:VENUE.stageSideTopY,width:VENUE.stageLeftX,height:VENUE.stageLipY-VENUE.stageSideTopY,fill:'rgba(56,189,248,.07)',stroke:'rgba(56,189,248,.32)',strokeWidth:1,listening:false}));
  l.add(new Konva.Rect({x:VENUE.stageRightX,y:VENUE.stageSideTopY,width:LOGICAL_W-VENUE.stageRightX,height:VENUE.stageLipY-VENUE.stageSideTopY,fill:'rgba(56,189,248,.07)',stroke:'rgba(56,189,248,.32)',strokeWidth:1,listening:false}));
  addVenueText(l,3,VENUE.stageSideTopY+42,'SR FLOOR\nENTRANCE',14,{width:100,bold:true,fill:'rgba(125,211,252,.70)'});
  addVenueText(l,897,VENUE.stageSideTopY+42,'SL FLOOR\nENTRANCE',14,{width:100,bold:true,fill:'rgba(125,211,252,.70)'});

  // Three stair units visible in the supplied venue sketch.
  VENUE.stairs.forEach(s=>drawStairs(l,s));

  // Audience floor / aisles. Chairs can be hidden while preserving the room geometry.
  if(BState.showSeats)VENUE.seats.forEach(b=>drawChairBlock(l,b));
  l.add(new Konva.Rect({x:VENUE.centreAisle.x,y:VENUE.centreAisle.y,width:VENUE.centreAisle.w,height:VENUE.centreAisle.h,fill:'rgba(56,189,248,.025)',stroke:'rgba(56,189,248,.16)',strokeWidth:1,listening:false}));
  l.add(new Konva.Rect({x:VENUE.crossAisle.x,y:VENUE.crossAisle.y,width:VENUE.crossAisle.w,height:VENUE.crossAisle.h,fill:'rgba(56,189,248,.025)',stroke:'rgba(56,189,248,.14)',strokeWidth:1,listening:false}));

  // Lower inner walls shown in the venue sketch.
  addVenueLine(l,[415,1510,415,LOGICAL_H],{stroke:'rgba(226,232,240,.52)',width:2});
  addVenueLine(l,[585,1510,585,LOGICAL_H],{stroke:'rgba(226,232,240,.52)',width:2});

  addVenueText(l,390,25,'UPSTAGE',18,{width:220,bold:true});
  addVenueText(l,390,VENUE.stageLipY-34,'DOWNSTAGE / STAGE LIP',16,{width:220,bold:true,fill:'rgba(248,185,24,.82)'});
  addVenueText(l,12,300,'STAGE RIGHT',15,{width:120,bold:true,fill:'rgba(226,232,240,.45)'});
  addVenueText(l,868,300,'STAGE LEFT',15,{width:120,bold:true,fill:'rgba(226,232,240,.45)'});
  addVenueText(l,390,790,'FRONT FLOOR',16,{width:220,bold:true,fill:'rgba(226,232,240,.38)'});
  addVenueText(l,VENUE.centreAisle.x+12,1070,'CENTRE AISLE',14,{width:VENUE.centreAisle.w-24,bold:true,fill:'rgba(125,211,252,.48)',rotation:90});
  addVenueText(l,390,1164,'CROSS AISLE',13,{width:220,bold:true,fill:'rgba(125,211,252,.42)'});
  addVenueText(l,390,1740,'AUDIENCE / REAR OF ROOM ↓',16,{width:220,bold:true,fill:'rgba(226,232,240,.56)'});
  l.draw();
}

async function chooseInitialSnapshot(preferCache=true){const rows=snapshotsForScene().filter(s=>!BState.cue||!s.CueNumber||String(s.CueNumber)===String(BState.cue));if(rows[0])await loadSnapshot(rows[0].SnapshotID,preferCache);else{renderAll();}}
function applyBlockingSnapshotResult(id,result){
  BState.snapshotId=id;BState.snapshot=result.snapshot;BState.placements=(result.placements||[]).map(localPlacement);BState.objects=(result.objects||[]).map(localObject);BState.selected=null;BState.selectedPlacements.clear();BState.multiSelectMode=false;BState.undo=[];BState.redo=[];renderAll();establishSnapshotSaveBaseline();cacheCurrentSnapshot();
}
async function refreshSnapshotFromServer(id){
  const key=String(id);if(BState.cache.snapshotFreshening.has(key))return BState.cache.snapshotFreshening.get(key);
  const task=(async()=>{try{const result=await BRM.api('blockingSnapshot',{snapshotId:id},{noCache:true,forceNetwork:true});blockingCacheWrite('snapshot',id,result);if(String(BState.snapshotId)===key&&!BState.save.snapshotDirty&&!BState.save.snapshotSaving){applyBlockingSnapshotResult(id,result);await loadPreviousSnapshot(true);}return result}catch(error){console.warn('Blocking snapshot refresh failed',error);return null}finally{BState.cache.snapshotFreshening.delete(key)}})();BState.cache.snapshotFreshening.set(key,task);return task;
}
async function loadSnapshot(id,preferCache=true){
  const cached=preferCache?blockingCacheRead('snapshot',id,7*24*60*60*1000):null;
  if(cached?.snapshot){applyBlockingSnapshotResult(id,cached);loadPreviousSnapshot(true);refreshSnapshotFromServer(id);return;}
  const result=await BRM.api('blockingSnapshot',{snapshotId:id},{noCache:true,forceNetwork:true});blockingCacheWrite('snapshot',id,result);applyBlockingSnapshotResult(id,result);await loadPreviousSnapshot(true);
}
function localPlacement(p){return {...p,_localId:crypto.randomUUID?.()||('p'+Math.random()),XPercent:Number(p.XPercent||50),YPercent:Number(p.YPercent||50),Scale:Number(p.Scale||1)}}
function localObject(o){
  const hasLabelVisible=Object.prototype.hasOwnProperty.call(o||{},'LabelVisible')&&o.LabelVisible!==''&&o.LabelVisible!==null;
  const item={...o,_localId:crypto.randomUUID?.()||('o'+Math.random()),TimelineKey:o?.TimelineKey||('BTENT-'+(crypto.randomUUID?.()||Math.random().toString(36).slice(2))),XPercent:Number(o.XPercent??50),YPercent:Number(o.YPercent??25),WidthPercent:Number(o.WidthPercent||12),HeightPercent:Number(o.HeightPercent||8),Rotation:Number(o.Rotation||0),ShapeType:o.ShapeType||'Rectangle',FillColor:o.FillColor||'#5e000f',FillOpacity:Number((o.FillOpacity===''||o.FillOpacity==null)?0.72:o.FillOpacity),StrokeWidth:Number(o.StrokeWidth||3),ZIndex:Number(o.ZIndex||0),TextColor:o.TextColor||'#ffffff',TextSize:Number(o.TextSize||14),TextBold:o.TextBold===''||o.TextBold==null?true:!(o.TextBold===false||String(o.TextBold).toLowerCase()==='false'),LabelVisible:hasLabelVisible?!(o.LabelVisible===false||String(o.LabelVisible).toLowerCase()==='false'):true,LabelBackground:o.LabelBackground===true||String(o.LabelBackground).toLowerCase()==='true',LabelPosition:o.LabelPosition||'Center'};
  if(isPolygonShape(item.ShapeType)&&!item.PointsJSON){setShapePoints(item,shapePoints(item));setEdgeColors(item,edgeColors(item,shapePoints(item).length));}
  return item
}
async function loadPreviousSnapshot(preferCache=true){BState.previousSnapshot=null;if(!BState.snapshot)return;const list=snapshotsForScene().filter(s=>Number(s.SortOrder||0)<Number(BState.snapshot.SortOrder||0)).sort((a,b)=>Number(b.SortOrder||0)-Number(a.SortOrder||0));if(!list[0])return;const id=list[0].SnapshotID,cached=preferCache?blockingCacheRead('snapshot',id,7*24*60*60*1000):null;if(cached){BState.previousSnapshot=cached;renderMovements();return;}BRM.api('blockingSnapshot',{snapshotId:id},{noCache:true,forceNetwork:true}).then(result=>{blockingCacheWrite('snapshot',id,result);if(BState.snapshot&&String(BState.snapshot.SnapshotID)!==String(id)){BState.previousSnapshot=result;renderMovements();}}).catch(()=>{});}
function renderAll(){document.querySelector('[data-snapshot-strip]').innerHTML=renderSnapshotStrip();document.querySelectorAll('[data-snapshot]').forEach(b=>b.onclick=async()=>{if(!(await flushBlockingSavesBeforeNavigation()))return;await loadSnapshot(b.dataset.snapshot);});document.querySelector('[data-anchor-list]').innerHTML=renderAnchors();document.querySelector('[data-snapshot-detail]').innerHTML=renderSnapshotDetails();bindDetailButtons();renderBackground();renderObjects();renderTokens();renderMovements();renderTimelinePaths();updateCount();positionTimelineAt(timelineCurrentTime());}

function castById(id){return (BState.data.cast||[]).find(c=>String(c.BlockingCastID)===String(id))}
function characterById(id){return (BState.data.characters||[]).find(c=>String(c.CharacterID)===String(id))}
function imageFromUrl(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src})}
function addCastToStage(castId,xPct,yPct){if(!canEdit())return;const cast=castById(castId);if(!cast)return;if(BState.placements.some(p=>String(p.BlockingCastID)===String(castId))){BRM.toast(`${cast.CharacterName} is already in this snapshot.`,'info');return;}pushUndo();const p=localPlacement({BlockingCastID:cast.BlockingCastID,CharacterID:cast.CharacterID,UserID:cast.UserID,XPercent:xPct,YPercent:yPct,Facing:'Front',Level:'Standing',Scale:1,Visible:true,Locked:false,MovementNote:'',Counts:''});BState.placements.push(p);BState.selectedPlacements.clear();BState.selectedPlacements.add(p._localId);BState.selected={kind:'placement',id:p._localId};renderTokens();renderMovements();updateCount();refreshRight();}
function groupCastMembers(group){
  const keys=String(group?.MemberCharacterKeys||'').split(',').map(x=>x.trim()).filter(Boolean);
  return (BState.data.cast||[]).filter(c=>keys.includes(c.CharacterKey));
}
function addCastBatchToStage(castIds){
  if(!canEdit())return;
  const rows=castIds.map(castById).filter(Boolean).filter(c=>!BState.placements.some(p=>String(p.BlockingCastID)===String(c.BlockingCastID)));
  if(!rows.length){BRM.toast('Those performers are already in this snapshot.','info');return;}
  pushUndo();
  const cols=Math.max(1,Math.ceil(Math.sqrt(rows.length))),rCount=Math.ceil(rows.length/cols),spanX=Math.min(64,Math.max(18,(cols-1)*12)),spanY=Math.min(22,Math.max(8,(rCount-1)*7));
  rows.forEach((c,i)=>{const col=i%cols,row=Math.floor(i/cols),x=cols===1?50:50-spanX/2+col*(spanX/(cols-1)),y=rCount===1?18:18-spanY/2+row*(spanY/(rCount-1));BState.placements.push(localPlacement({BlockingCastID:c.BlockingCastID,CharacterID:c.CharacterID,UserID:c.UserID,XPercent:x,YPercent:y,Facing:'Front',Level:'Standing',Scale:1,Visible:true,Locked:false,MovementNote:'',Counts:''}));});
  BState.selectedPlacements=new Set(rows.map(c=>BState.placements.find(p=>String(p.BlockingCastID)===String(c.BlockingCastID))?._localId).filter(Boolean));
  const ids=[...BState.selectedPlacements];BState.selected=ids.length?{kind:'placement',id:ids[ids.length-1]}:BState.selected;
  renderTokens();renderMovements();updateCount();refreshRight();
}
function openGroupMemberPicker(groupId){
  const g=(BState.data.groups||[]).find(x=>String(x.GroupID)===String(groupId));if(!g)return;
  const cast=groupCastMembers(g),onStage=new Set(BState.placements.map(p=>String(p.BlockingCastID)));
  if(!cast.length){
    if(canManage()){openEnsembleRosterModal(groupId);return;}
    BRM.toast(`${g.GroupName} does not have individual cast assignments yet.`,'info');return;
  }
  const rows=cast.map(c=>`<label class="blocking-group-member ${onStage.has(String(c.BlockingCastID))?'is-on-stage':''}"><input type="checkbox" data-group-cast="${BRM.escape(c.BlockingCastID)}" ${onStage.has(String(c.BlockingCastID))?'disabled':''}><span>${blockingCastAvatar(c,'small')}</span><span><strong>${BRM.escape(c.PersonName||c.CharacterName)}</strong><small>${BRM.escape(c.CharacterName)}${onStage.has(String(c.BlockingCastID))?' · already on stage':''}</small></span></label>`).join('');
  openModal(`Choose ${g.GroupName}`,`<div class="blocking-source-note"><strong>Use only the ensemble members needed for this picture.</strong> This does not change the roster; it only chooses who is added to the current Blocking Snapshot.</div><div class="blocking-group-picker-actions"><button class="button button-secondary button-small" data-group-select-all>Select available</button><button class="button button-secondary button-small" data-group-select-none>Clear</button>${canManage()?'<button class="button button-secondary button-small" data-edit-ensemble-roster>+ Add roster members</button>':''}</div><div class="blocking-group-member-list">${rows}</div>`,`<button class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary" data-add-group-selected>Add Selected</button>`);
  hydrateBlockingCastPhotos(document.querySelector('[data-blocking-modal]'));
  document.querySelector('[data-cancel]').onclick=closeModal;
  document.querySelector('[data-group-select-all]').onclick=()=>document.querySelectorAll('[data-group-cast]:not(:disabled)').forEach(x=>x.checked=true);
  document.querySelector('[data-group-select-none]').onclick=()=>document.querySelectorAll('[data-group-cast]:not(:disabled)').forEach(x=>x.checked=false);
  document.querySelector('[data-edit-ensemble-roster]')?.addEventListener('click',()=>{closeModal();openEnsembleRosterModal(groupId)});
  document.querySelector('[data-add-group-selected]').onclick=()=>{const ids=[...document.querySelectorAll('[data-group-cast]:checked')].map(x=>x.dataset.groupCast);if(!ids.length){BRM.toast('Choose at least one performer.','warning');return;}closeModal();addCastBatchToStage(ids);};
}
function defaultEnsembleRoleName(group){
  const name=String(group?.GroupName||'Ensemble').trim();
  if(/auradonians/i.test(name))return 'Auradonian';
  if(/coronation crowd/i.test(name))return 'Coronation Crowd';
  if(/choir/i.test(name))return 'Auradonian Choir';
  if(/isle/i.test(name)&&/ensemble/i.test(name))return 'Isle Ensemble';
  return name;
}
function openEnsembleRosterModal(groupId=''){
  if(!canManage())return;
  const groups=BState.data.groups||[],initial=groups.find(g=>String(g.GroupID)===String(groupId))||groups[0];
  if(!initial){BRM.toast('No Blocking groups are configured yet.','warning');return;}
  const people=BState.data.people||[];
  const groupOpts=groups.map(g=>`<option value="${g.GroupID}" ${String(g.GroupID)===String(initial.GroupID)?'selected':''}>${BRM.escape(g.GroupName)}</option>`).join('');
  const peopleRows=people.map(p=>`<label class="blocking-group-member" data-roster-person-row><input type="checkbox" data-roster-user="${BRM.escape(p.UserID)}"><span>${BRM.avatar(p.DisplayName,p.PhotoURL,'small')}</span><span><strong>${BRM.escape(p.DisplayName)}</strong><small>${BRM.escape((p.Departments||[]).join(' · '))}</small></span></label>`).join('');
  openModal('Create Individual Ensemble Roster',`<div class="blocking-source-note"><strong>One ensemble role, many individual people.</strong> Each selected student gets their own draggable Blocking Cast identity and face. Later, clicking the group lets you choose only the members needed for a particular scene or formation.</div><div class="form-grid"><div class="field"><label>Ensemble / group</label><select data-roster-group>${groupOpts}</select></div><div class="field"><label>Individual role name</label><input data-roster-role value="${BRM.escape(defaultEnsembleRoleName(initial))}" placeholder="Isle Ensemble or Auradonian"></div><div class="field span-2"><label>Role label</label><input data-roster-label value="Ensemble" placeholder="Ensemble"></div><div class="field span-2"><label>Find people</label><input data-roster-search placeholder="Search student names…"></div></div><div class="blocking-group-picker-actions"><button class="button button-secondary button-small" data-roster-select-all>Select all visible</button><button class="button button-secondary button-small" data-roster-select-none>Clear</button></div><div class="blocking-group-member-list" data-roster-people>${peopleRows}</div><label class="checkbox-row"><input type="checkbox" data-roster-add-now><span>Add newly assigned people to this Blocking Snapshot immediately</span></label>`,`<button class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary" data-save-roster>Save Ensemble Roster</button>`);
  BRM.hydrateProfilePhotos?.(document.querySelector('[data-blocking-modal]'));
  const groupSelect=document.querySelector('[data-roster-group]'),roleInput=document.querySelector('[data-roster-role]');
  groupSelect.onchange=()=>{const g=groups.find(x=>String(x.GroupID)===String(groupSelect.value));roleInput.value=defaultEnsembleRoleName(g)};
  document.querySelector('[data-roster-search]').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-roster-person-row]').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));};
  document.querySelector('[data-roster-select-all]').onclick=()=>document.querySelectorAll('[data-roster-person-row]:not([hidden]) [data-roster-user]').forEach(x=>x.checked=true);
  document.querySelector('[data-roster-select-none]').onclick=()=>document.querySelectorAll('[data-roster-user]').forEach(x=>x.checked=false);
  document.querySelector('[data-cancel]').onclick=closeModal;
  document.querySelector('[data-save-roster]').onclick=async()=>{
    const userIds=[...document.querySelectorAll('[data-roster-user]:checked')].map(x=>x.dataset.rosterUser),roleName=roleInput.value.trim();
    if(!userIds.length){BRM.toast('Choose at least one student.','warning');return;}if(!roleName){BRM.toast('Enter an individual role name.','warning');return;}
    const btn=document.querySelector('[data-save-roster]');btn.disabled=true;btn.textContent='Saving…';
    try{const result=await BRM.api('saveBlockingEnsembleRoster',{groupId:groupSelect.value,roleName,roleLabel:document.querySelector('[data-roster-label]').value||'Ensemble',userIds});const addNow=document.querySelector('[data-roster-add-now]').checked;closeModal();await reloadHubMeta();refreshRight();if(addNow&&result.blockingCastIds?.length)addCastBatchToStage(result.blockingCastIds);BRM.toast(`${result.created||0} new ensemble assignment${Number(result.created)===1?'':'s'} ready.`, 'success');}catch(error){BRM.toast(error.message,'error');btn.disabled=false;btn.textContent='Save Ensemble Roster';}
  };
}
function handleExternalDrop(e){e.preventDefault();if(!canEdit()||!BState.stage)return;const id=e.dataTransfer.getData('text/blocking-cast');if(!id)return;BState.stage.setPointersPositions(e);const p=BState.stage.getPointerPosition();const scale=BState.stage.scaleX();addCastToStage(id,(p.x/scale)/LOGICAL_W*100,(p.y/scale)/LOGICAL_H*100);}
function imageCoverCrop(img){const side=Math.min(img.naturalWidth||img.width,img.naturalHeight||img.height);return {x:((img.naturalWidth||img.width)-side)/2,y:((img.naturalHeight||img.height)-side)/2,width:side,height:side}}

function blockingTokenTooltip(){
  const wrap=document.querySelector('[data-stage-drop]');if(!wrap)return null;
  let tip=wrap.querySelector('[data-blocking-token-tooltip]');
  if(!tip){tip=document.createElement('div');tip.className='blocking-token-tooltip';tip.dataset.blockingTokenTooltip='';tip.hidden=true;wrap.appendChild(tip);}
  return tip;
}
function showBlockingTokenTooltip(cast,p){
  const tip=blockingTokenTooltip();if(!tip||!BState.stage)return;
  const character=p?.LabelOverride||cast?.CharacterName||'Performer',person=cast?.PersonName||'';
  tip.innerHTML=`<strong>${BRM.escape(character)}</strong>${person?`<span>${BRM.escape(person)}</span>`:''}`;
  tip.hidden=false;
  moveBlockingTokenTooltip();
}
function moveBlockingTokenTooltip(){
  const tip=document.querySelector('[data-blocking-token-tooltip]'),wrap=document.querySelector('[data-stage-drop]');if(!tip||tip.hidden||!wrap||!BState.stage)return;
  const pos=BState.stage.getPointerPosition();if(!pos)return;
  const stageRect=BState.stage.container().getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect();
  let left=(stageRect.left-wrapRect.left)+pos.x+14,top=(stageRect.top-wrapRect.top)+pos.y-10;
  const maxLeft=Math.max(6,wrap.clientWidth-tip.offsetWidth-8),maxTop=Math.max(6,wrap.clientHeight-tip.offsetHeight-8);
  left=Math.max(6,Math.min(maxLeft,left));top=Math.max(6,Math.min(maxTop,top));
  tip.style.left=left+'px';tip.style.top=top+'px';
}
function hideBlockingTokenTooltip(){const tip=document.querySelector('[data-blocking-token-tooltip]');if(tip)tip.hidden=true;}

function renderTokens(){
  const l=BState.layers.tokens;if(!l)return;l.destroyChildren();BState.tokenNodes.clear();
  const collisionIds=BState.stageEditing.collisionWarnings?placementCollisionIds():new Set();
  BState.placements.forEach(p=>{if(p.Visible===false)return;const cast=castById(p.BlockingCastID)||{};const st=tokenStyle(cast);const x=p.XPercent/100*LOGICAL_W,y=p.YPercent/100*LOGICAL_H;
    const g=new Konva.Group({x,y,draggable:canEdit()&&!p.Locked,scaleX:p.Scale||1,scaleY:p.Scale||1});g.setAttr('localId',p._localId);
    const selected=BState.selectedPlacements.has(p._localId)||BState.selected?.id===p._localId,selectionOrder=[...BState.selectedPlacements].indexOf(p._localId)+1;
    const selectionRing=new Konva.Circle({x:0,y:0,radius:43,stroke:selected?'#ffffff':'rgba(255,255,255,0)',strokeWidth:selected?4:0,listening:false});
    const orderBadge=new Konva.Circle({x:34,y:-34,radius:12,fill:'#f8b918',stroke:'#111827',strokeWidth:2,visible:selectionOrder>0,listening:false});
    const orderText=new Konva.Text({x:22,y:-41,width:24,text:selectionOrder>0?String(selectionOrder):'',fontSize:12,fontStyle:'bold',fill:'#111827',align:'center',visible:selectionOrder>0,listening:false});
    const colliding=collisionIds.has(p._localId);const halo=new Konva.Circle({x:0,y:0,radius:38,fill:st.outline,opacity:1,stroke:colliding?'#ef4444':st.outline,strokeWidth:colliding?7:2,listening:false});
    const face=new Konva.Circle({x:0,y:0,radius:32,fill:st.background,listening:false});
    const initials=new Konva.Text({x:-32,y:-10,width:64,align:'center',text:BRM.initials(cast.PersonName||cast.CharacterName||'?'),fontSize:18,fontStyle:'bold',fill:st.initials,listening:false});
    // v35: transparent hit target makes the entire circular token clickable,
    // draggable, and hoverable. Visual token layers remain non-listening.
    const tokenHit=new Konva.Circle({x:0,y:0,radius:42,fill:'rgba(255,255,255,0.001)',strokeEnabled:false,listening:true,name:'blocking-token-hit'});
    const character=p.LabelOverride||cast.CharacterName||'Performer',person=cast.PersonName||'';
    const text=[character,person].filter(Boolean).join('\n');
    const labelText=new Konva.Text({x:-70,y:43,width:140,text,fontSize:12,lineHeight:1.18,fontStyle:'bold',fill:'#fff',align:'center',padding:4,ellipsis:true,name:'blocking-token-label-text',visible:BState.showTokenNames});
    const labelBg=new Konva.Rect({x:-70,y:42,width:140,height:person?39:24,fill:'rgba(15,23,42,.92)',cornerRadius:7,stroke:'rgba(255,255,255,.18)',strokeWidth:1,name:'blocking-token-label-bg',visible:BState.showTokenNames});
    const facing=new Konva.Arrow({points:[0,-42,0,-60],stroke:'#f8b918',fill:'#f8b918',strokeWidth:3,pointerLength:7,pointerWidth:7,rotation:facingRotation(p.Facing),listening:false});
    g.add(selectionRing,halo,face,initials,facing,labelBg,labelText,orderBadge,orderText,tokenHit);
    const selectToken=e=>selectPlacementToken(p._localId,e);
    g.on('click tap',selectToken);
    g.on('mouseenter',()=>{const container=BState.stage?.container();if(container)container.style.cursor=canEdit()&&!p.Locked?'grab':'pointer';showBlockingTokenTooltip(cast,p);});
    g.on('mousemove touchmove',()=>moveBlockingTokenTooltip());
    g.on('mouseleave',()=>{const container=BState.stage?.container();if(container)container.style.cursor='default';hideBlockingTokenTooltip();});
    g.on('dragstart',()=>{hideBlockingTokenTooltip();const container=BState.stage?.container();if(container)container.style.cursor='grabbing';pushUndo();recordTimelineSample('Cast','cast:'+p.BlockingCastID,p.LabelOverride||cast.CharacterName||'Performer',g.x()/LOGICAL_W*100,g.y()/LOGICAL_H*100,true);});
    g.on('dragmove',()=>recordTimelineSample('Cast','cast:'+p.BlockingCastID,p.LabelOverride||cast.CharacterName||'Performer',g.x()/LOGICAL_W*100,g.y()/LOGICAL_H*100,false));
    g.on('dragend',()=>{const container=BState.stage?.container();if(container)container.style.cursor='grab';const snapped=snapStagePoint(g.x(),g.y());g.position(snapped);p.XPercent=Math.max(0,Math.min(100,snapped.x/LOGICAL_W*100));p.YPercent=Math.max(0,Math.min(100,snapped.y/LOGICAL_H*100));recordTimelineSample('Cast','cast:'+p.BlockingCastID,p.LabelOverride||cast.CharacterName||'Performer',p.XPercent,p.YPercent,false);renderTokens();renderMovements();renderTimelinePaths();updateCount();});
    l.add(g);BState.tokenNodes.set(p._localId,g);
    // v34 uses an already-decoded, circular off-screen canvas as Konva's image
    // source. This avoids the old object-URL cache and nested clip group entirely.
    photoCanvasForCast(cast).then(canvas=>{
      // v34: Konva.Node has destroy(), getParent(), and getStage(), but no
      // public isDestroyed() method.  The old guard threw here after the
      // image had already loaded, which is why the photo diagnostic could
      // pass while the real Blocking Studio still showed initials.
      if(!canvas)return;

      // Async photo loads may finish after renderTokens() has replaced this
      // group. Only attach a face to the group that is still current.
      if(BState.tokenNodes.get(p._localId)!==g)return;
      if(typeof g.getParent==='function'&&!g.getParent())return;
      if(typeof g.getStage==='function'&&!g.getStage())return;

      const photoNode=new Konva.Image({
        x:-32,
        y:-32,
        width:64,
        height:64,
        image:canvas,
        listening:false,
        name:'blocking-cast-face'
      });

      g.add(photoNode);

      // Put the photograph above the fallback disc/initials, then restore
      // the facing arrow and labels above the photograph.
      photoNode.moveToTop();
      initials.hide();
      // Keep the invisible circular hit target above the photo so the face
      // itself remains clickable after the asynchronous image is attached.
      tokenHit.moveToTop();
      facing.moveToTop();
      labelBg.moveToTop();
      labelText.moveToTop();

      const attached=
        photoNode.getParent()===g &&
        photoNode.getStage()===BState.stage &&
        BState.tokenNodes.get(p._localId)===g;

      if(!attached){
        photoNode.destroy();
        setCastPhotoStatus(cast.BlockingCastID,'error','Photo prepared, but the current stage token changed before it could be attached.');
        return;
      }

      // The image source is already decoded; an immediate layer draw makes
      // the asynchronous attachment deterministic instead of waiting for a
      // later interaction to repaint the layer.
      const photoLayer=photoNode.getLayer();
      if(photoLayer)photoLayer.draw();

      setCastPhotoStatus(
        cast.BlockingCastID,
        'visible',
        'Face attached to the live Blocking Studio token and drawn.'
      );
    }).catch(error=>{
      setCastPhotoStatus(cast.BlockingCastID,'error','The Studio renderer could not attach this photo — retrying automatically.');
      console.error('Blocking Studio face attach failed',cast.BlockingCastID,error);scheduleBlockingPhotoRetry(cast);
    });
  });l.draw();updatePhotoSummaryStatus();refreshBedfordSplitViewer();
}

function facingRotation(v){return {'Front':180,'Upstage':0,'Stage Left':-90,'Stage Right':90,'Diagonal UL':-45,'Diagonal UR':45,'Diagonal DL':-135,'Diagonal DR':135}[v]||180}
function addObject(type,label){openStageElementModal(type,label)}
function createShapeObject(shapeType,objectType='Zone',label=shapeType,options={}){
  const dims=shapePresetDimensions(shapeType);
  const o=localObject({ObjectType:objectType,ShapeType:shapeType,Label:label,XPercent:Number(options.XPercent??50),YPercent:Number(options.YPercent??20),WidthPercent:dims.w,HeightPercent:dims.h,Rotation:0,FillColor:options.FillColor||'#5e000f',FillOpacity:Number(options.FillOpacity??.62),StrokeWidth:Number(options.StrokeWidth??3),ZIndex:Number(options.ZIndex??0),Notes:'',TextColor:options.TextColor||'#ffffff',TextSize:Number(options.TextSize||14),TextBold:options.TextBold!==false,LabelVisible:options.LabelVisible===true,LabelBackground:options.LabelBackground===true,LabelPosition:options.LabelPosition||'Center'});
  resetObjectGeometry(o,shapeType);return o;
}
function addShapePreset(shapeType,objectType='Zone',label=shapeType,options={}){if(!canEdit())return;pushUndo();const o=createShapeObject(shapeType,objectType,label,options);BState.objects.push(o);BState.selected={kind:'object',id:o._localId};renderObjects();updateCount();refreshRight();}
function flatPoints(points){return points.flatMap(p=>[p[0],p[1]])}
function objectBoundsFromPoints(points){if(!points?.length)return {minX:-60,maxX:60,minY:-35,maxY:35,w:120,h:70};const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return {minX,maxX,minY,maxY,w:maxX-minX,h:maxY-minY}}
function createObjectLabel(o,bounds,{force=false}={}){
  if(!force&&o.LabelVisible===false)return null;
  const text=String(o.Label||'').trim();if(!text)return null;
  const fontSize=Math.max(8,Math.min(48,Number(o.TextSize||14))),padding=5;
  let width=Math.max(70,Math.min(280,Math.max(bounds.w||0,text.length*fontSize*.62)+padding*2));
  let y=-fontSize*.7;
  const pos=o.LabelPosition||'Center';
  if(pos==='Above')y=(bounds.minY||-30)-fontSize-12;
  else if(pos==='Below')y=(bounds.maxY||30)+9;
  const x=-width/2;
  const group=new Konva.Group({x:0,y:0,listening:false});
  const txt=new Konva.Text({x,y,width,text,fontSize,fontStyle:o.TextBold===false?'normal':'bold',fill:o.TextColor||'#ffffff',align:'center',padding,lineHeight:1.05,shadowColor:'rgba(0,0,0,.9)',shadowBlur:o.LabelBackground?0:4,shadowOffsetY:o.LabelBackground?0:1,shadowOpacity:o.LabelBackground?0:.75,listening:false});
  if(o.LabelBackground===true){const h=txt.height();group.add(new Konva.Rect({x,y,width,height:h,fill:'rgba(15,23,42,.86)',cornerRadius:6,stroke:'rgba(255,255,255,.14)',strokeWidth:1,listening:false}));}
  group.add(txt);return group;
}
function renderObjects(){
  const l=BState.layers.objects;if(!l)return;l.destroyChildren();BState.objectNodes.clear();
  [...BState.objects].sort((a,b)=>Number(a.ZIndex||0)-Number(b.ZIndex||0)).forEach(o=>{
    const selected=BState.selected?.kind==='object'&&BState.selected?.id===o._localId;
    const g=new Konva.Group({x:o.XPercent/100*LOGICAL_W,y:o.YPercent/100*LOGICAL_H,rotation:o.Rotation||0,draggable:canEdit()&&BState.objectEditMode,listening:BState.objectEditMode});g.setAttr('localId',o._localId);
    const type=o.ShapeType||'Rectangle';
    let bounds={minX:-60,maxX:60,minY:-35,maxY:35,w:120,h:70};
    if(type==='Text'){
      const text=String(o.Label||'Text');const fontSize=Math.max(8,Math.min(48,Number(o.TextSize||18)));const width=Math.max(80,Math.min(360,text.length*fontSize*.68+24));
      const node=new Konva.Text({x:-width/2,y:-fontSize,width,text,fontSize,fontStyle:o.TextBold===false?'normal':'bold',fill:o.TextColor||'#ffffff',align:'center',padding:6,lineHeight:1.08,shadowColor:'rgba(0,0,0,.9)',shadowBlur:o.LabelBackground?0:5,shadowOffsetY:1,shadowOpacity:o.LabelBackground?0:.8});
      if(o.LabelBackground===true)g.add(new Konva.Rect({x:-width/2,y:-fontSize,width,height:node.height(),fill:'rgba(15,23,42,.86)',cornerRadius:6,stroke:'rgba(255,255,255,.18)',strokeWidth:1}));
      g.add(node);bounds={minX:-width/2,maxX:width/2,minY:-fontSize,maxY:-fontSize+node.height(),w:width,h:node.height()};
      if(selected)g.add(new Konva.Rect({x:bounds.minX-4,y:bounds.minY-4,width:bounds.w+8,height:bounds.h+8,stroke:'#fff',strokeWidth:1.5,dash:[7,5],cornerRadius:6,listening:false}));
    }else if(type==='Marker'){
      const r=15;g.add(new Konva.Circle({x:0,y:0,radius:r,fill:o.FillColor||'#f8b918',opacity:.94,stroke:selected?'#ffffff':'rgba(255,255,255,.72)',strokeWidth:selected?4:Math.max(1,Number(o.StrokeWidth||2))}));
      g.add(new Konva.Circle({x:0,y:0,radius:4,fill:o.TextColor||'#ffffff',listening:false}));bounds={minX:-r,maxX:r,minY:-r,maxY:r,w:r*2,h:r*2};
      const label=createObjectLabel(o,bounds);if(label)g.add(label);
    }else{
      const points=shapePoints(o),colors=edgeColors(o,points.length),flat=flatPoints(points);bounds=objectBoundsFromPoints(points);
      const fill=new Konva.Line({points:flat,closed:true,fill:o.FillColor||'#5e000f',opacity:Number(o.FillOpacity??.62),strokeEnabled:false});g.add(fill);
      const edgeNodes=[];points.forEach((p,i)=>{const n=points[(i+1)%points.length];const edge=new Konva.Line({points:[p[0],p[1],n[0],n[1]],stroke:colors[i],strokeWidth:Number(o.StrokeWidth||3),lineCap:'round',lineJoin:'round'});edge.on('click tap',e=>{e.cancelBubble=true;BState.selected={kind:'object',id:o._localId,edge:i};refreshRight();renderObjects();renderTokens();});edgeNodes.push(edge);g.add(edge)});
      if(selected)g.add(new Konva.Line({points:flat,closed:true,stroke:'#fff',strokeWidth:1.5,dash:[7,5],listening:false}));
      const label=createObjectLabel(o,bounds);if(label)g.add(label);
      if(selected&&canEdit()&&BState.objectEditMode)points.forEach((p,i)=>{const a=new Konva.Circle({x:p[0],y:p[1],radius:8,fill:'#fff',stroke:'#111827',strokeWidth:2,draggable:true});a.on('mousedown touchstart',e=>{e.cancelBubble=true});a.on('dragstart',e=>{e.cancelBubble=true;pushUndo()});a.on('dragmove',e=>{e.cancelBubble=true;points[i]=[a.x(),a.y()];setShapePoints(o,points);fill.points(flatPoints(points));points.forEach((q,j)=>{const n=points[(j+1)%points.length];edgeNodes[j].points([q[0],q[1],n[0],n[1]])});l.batchDraw()});a.on('dragend',e=>{e.cancelBubble=true;o.ShapeType=o.ShapeType==='Square'||o.ShapeType==='Rectangle'||o.ShapeType==='Triangle'?'Custom':o.ShapeType;setShapePoints(o,points);refreshRight();renderObjects()});g.add(a)});
    }
    if(BState.objectEditMode)g.on('click tap',e=>{if(e.target.getClassName()==='Circle'&&selected&&isPolygonShape(type))return;BState.selectedPlacements.clear();BState.selected={kind:'object',id:o._localId};refreshRight();renderObjects();renderTokens();renderTimelinePaths();});
    g.on('dragstart',()=>{pushUndo();recordTimelineSample('Object','obj:'+o.TimelineKey,o.Label||o.ObjectType||'Object',g.x()/LOGICAL_W*100,g.y()/LOGICAL_H*100,true);});g.on('dragmove',()=>recordTimelineSample('Object','obj:'+o.TimelineKey,o.Label||o.ObjectType||'Object',g.x()/LOGICAL_W*100,g.y()/LOGICAL_H*100,false));g.on('dragend',()=>{const snapped=snapStagePoint(g.x(),g.y());g.position(snapped);o.XPercent=Math.max(0,Math.min(100,snapped.x/LOGICAL_W*100));o.YPercent=Math.max(0,Math.min(100,snapped.y/LOGICAL_H*100));recordTimelineSample('Object','obj:'+o.TimelineKey,o.Label||o.ObjectType||'Object',o.XPercent,o.YPercent,false);renderTimelinePaths();});
    l.add(g);BState.objectNodes.set(o._localId,g);
  });l.draw();refreshBedfordSplitViewer();
}

function renderMovements(){const l=BState.layers.move;if(!l)return;l.destroyChildren();if(!BState.showMovement||!BState.previousSnapshot){l.draw();return;}const prev=BState.previousSnapshot.placements||[];BState.placements.forEach(p=>{const from=prev.find(x=>String(x.BlockingCastID)===String(p.BlockingCastID));if(!from)return;const x1=Number(from.XPercent)/100*LOGICAL_W,y1=Number(from.YPercent)/100*LOGICAL_H,x2=p.XPercent/100*LOGICAL_W,y2=p.YPercent/100*LOGICAL_H;if(Math.hypot(x2-x1,y2-y1)<10)return;l.add(new Konva.Arrow({points:[x1,y1,x2,y2],stroke:'rgba(56,189,248,.82)',fill:'rgba(56,189,248,.82)',strokeWidth:3,pointerLength:10,pointerWidth:9,dash:[8,5],listening:false}));});l.draw();}
async function renderBackground(){
  const l=BState.layers.bg;if(!l)return;l.destroyChildren();const id=BState.snapshot?.BackgroundID;if(!id){l.draw();return;}
  try{
    let img=BState.backgroundCache.get(id);
    if(!img){const r=await BRM.api('blockingBackgroundData',{backgroundId:id},{noCache:true});img=await imageFromUrl(r.dataUrl);BState.backgroundCache.set(id,img);}
    const zone=VENUE.backgroundZone,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    const scale=Math.min(zone.w/iw,zone.h/ih),w=iw*scale,h=ih*scale,x=zone.x+(zone.w-w)/2,y=zone.y+(zone.h-h)/2;
    l.add(new Konva.Rect({x:zone.x,y:zone.y,width:zone.w,height:zone.h,fill:'rgba(2,6,23,.28)',cornerRadius:5,listening:false}));
    l.add(new Konva.Image({x,y,width:w,height:h,image:img,opacity:.62,listening:false}));
    l.draw();
  }catch(e){console.warn(e)}
}
function updateCount(){const el=document.querySelector('[data-stage-count]');if(el)el.textContent=`${BState.placements.length} people · ${BState.objects.length} objects`;}

function serialState(){return {placements:BState.placements.map(({_localId,...p})=>p),objects:BState.objects.map(({_localId,...o})=>o)}}
function pushUndo(){if(!canEdit())return;BState.undo.push(JSON.stringify(serialState()));if(BState.undo.length>60)BState.undo.shift();BState.redo=[];}
function applySerial(s){const state=JSON.parse(s);BState.placements=(state.placements||[]).map(localPlacement);BState.objects=(state.objects||[]).map(localObject);BState.selected=null;BState.selectedPlacements.clear();renderTokens();renderObjects();renderMovements();updateCount();refreshRight();}
function undo(){if(!BState.undo.length)return;BState.redo.push(JSON.stringify(serialState()));applySerial(BState.undo.pop());}
function redo(){if(!BState.redo.length)return;BState.undo.push(JSON.stringify(serialState()));applySerial(BState.redo.pop());}
function removeSelected(){if(!BState.selected||!canEdit())return;pushUndo();if(BState.selected.kind==='placement'){const ids=BState.selectedPlacements.size?new Set(BState.selectedPlacements):new Set([BState.selected.id]);BState.placements=BState.placements.filter(x=>!ids.has(x._localId));BState.selectedPlacements.clear();}else BState.objects=BState.objects.filter(x=>x._localId!==BState.selected.id);BState.selected=null;renderTokens();renderObjects();renderMovements();updateCount();refreshRight();}
function bindGlobalKeys(){document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(BState.drawingShape&&e.key==='Enter'){e.preventDefault();finishCustomShape();return;}if(BState.drawingShape&&e.key==='Escape'){e.preventDefault();cancelCustomShape();return;}if(e.key==='Escape'&&studioWorkspace()?.classList.contains('blocking-faux-fullscreen')){studioWorkspace().classList.remove('blocking-faux-fullscreen');document.documentElement.classList.remove('blocking-no-scroll');BState.fauxFullscreen=false;updateFullscreenButton();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveAllBlocking(true);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}else if((e.key==='Delete'||e.key==='Backspace')&&BState.selected){e.preventDefault();removeSelected();}else if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(BState.zoom+.15);}else if(e.key==='-'){e.preventDefault();setZoom(BState.zoom-.15);}else if(e.key==='0'){e.preventDefault();fitMap();}})}


/* =========================================================
   v28 Timeline / synchronized blocking motion
   ========================================================= */
function resetTimelineContext(){
  const t=BState.timeline;if(t.objectUrl){try{URL.revokeObjectURL(t.objectUrl)}catch{}}if(t.sceneRecorder){try{t.sceneRecorder.recorder.stop()}catch{}t.recordStream?.getTracks?.().forEach(track=>track.stop());stopSceneRecorderTicker();releaseBlockingWakeLock();}
  Object.assign(t,{loaded:false,media:null,markers:[],keyframes:[],motions:[],audio:null,objectUrl:'',duration:180,current:0,playing:false,loopA:null,loopB:null,sceneTimerBase:0,sceneTimerStartedAt:0,trace:null,recording:null,saving:false,pendingSave:false,manualSaveRequested:false,savePromise:null,sceneRecorder:null,recordStream:null,recordChunks:[],recordings:[],audioLoadPromise:null,audioLoadKey:'',audioReady:false});BState.save.timelineDirty=false;updateBlockingSaveStatus();
}
function isSongTimeline(){return !!String(BState.cue||'').trim()}
function formatTimelineTime(sec){sec=Math.max(0,Number(sec)||0);const m=Math.floor(sec/60),s=sec-m*60;return `${m}:${s.toFixed(1).padStart(4,'0')}`}
function timelineCurrentTime(){
  const t=BState.timeline;
  if(t.audio&&Number.isFinite(t.audio.currentTime))return Number(t.audio.currentTime||0);
  if(t.playing&&t.sceneTimerStartedAt)return Math.max(0,t.sceneTimerBase+(performance.now()-t.sceneTimerStartedAt)/1000);
  return Number(t.current||t.sceneTimerBase||0);
}
function timelineDuration(){const t=BState.timeline;return Math.max(1,Number(t.audio?.duration)||Number(t.duration)||180)}
function guideTrackLabel(track){return String(track?.Title||track?.Name||'Guide Vocal').replace(/\.(mp3|wav|m4a|aac|ogg)$/i,'').trim()}
function trackIsGuide(track){const type=String(track?.TrackType||'').toLowerCase(),title=String(track?.Title||'').toLowerCase();return type.includes('guide')||title.includes('guide')||title.includes('predominant')}
function renderTimelineDock(){
  const t=BState.timeline;
  return `<div class="blocking-timeline blocking-timeline-compact">
    <audio class="blocking-timeline-audio" data-blocking-audio preload="metadata"></audio>
    <div class="blocking-transport"><div class="blocking-transport-buttons"><button class="button button-secondary button-small" data-timeline-back>−5s</button><button class="button button-primary button-small" data-timeline-play>▶ Play</button><button class="button button-secondary button-small" data-timeline-forward>+5s</button></div><input class="blocking-time-slider" data-timeline-seek type="range" min="0" max="${timelineDuration()}" step="0.05" value="${Math.min(timelineDuration(),timelineCurrentTime())}"><span class="blocking-time-readout" data-timeline-time>${formatTimelineTime(timelineCurrentTime())} / ${formatTimelineTime(timelineDuration())}</span></div>
    <div class="blocking-timeline-events" data-timeline-events>${renderTimelineEvents()}</div>
  </div>`;
}
function renderTimelineToolPanel(){
  const t=BState.timeline,song=isSongTimeline();
  const options=(t.guideTracks||[]).map(track=>`<option value="${BRM.escape(track.TrackID)}" ${String(t.media?.TrackID||'')===String(track.TrackID)?'selected':''}>${BRM.escape(guideTrackLabel(track))}</option>`).join('');
  return `${song?`<div class="blocking-tool-caption"><strong>Guide Vocal</strong><br>${t.media?.TrackID?`<span class="blocking-linked-media">✓ Linked permanently: ${BRM.escape(t.media.TrackTitle||'Guide Vocal')}</span>`:'Choose a Guide Vocal once. The song-to-track link will be remembered.'}</div><div class="blocking-tool-row"><select data-guide-track><option value="">Choose Guide Vocal…</option>${options}</select>${canEdit()?`<button class="button button-secondary button-small" data-link-guide>${t.media?.TrackID?'Change Track':'Link Track'}</button>`:''}</div>`:renderSceneRecorderPanel()}
    <div class="blocking-tool-row"><label class="field-hint">Speed <select data-timeline-speed><option value="0.5" ${t.speed===.5?'selected':''}>0.5×</option><option value="0.75" ${t.speed===.75?'selected':''}>0.75×</option><option value="1" ${t.speed===1?'selected':''}>1×</option><option value="1.25" ${t.speed===1.25?'selected':''}>1.25×</option></select></label><span class="blocking-loop-readout" data-loop-readout>${renderLoopReadout()}</span></div>
    <div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-loop-a>Set Loop A</button><button class="button button-secondary button-small" data-loop-b>Set Loop B</button><button class="button button-secondary button-small" data-loop-clear>Clear Loop</button>${canEdit()?'<button class="button button-secondary button-small" data-save-timeline>Save Timeline</button>':''}</div>
    ${canEdit()?`<div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-add-marker>+ Marker</button>${!song?'<button class="button button-secondary button-small" data-add-dialogue>💬 Dialogue Cue</button>':''}<button class="button button-secondary button-small" data-capture-formation>◆ Formation</button><button class="button button-secondary button-small" data-trace-selected>〰 Trace Path</button><button class="button button-secondary button-small" data-record-selected>● Record Drag</button><button class="button button-secondary button-small" data-stop-recording>■ Stop Drag</button></div>`:''}
    <label class="checkbox-row"><input type="checkbox" data-show-paths ${t.showPaths!==false?'checked':''}><span>Show traced movement paths</span></label><span class="blocking-timeline-status ${t.recording?'recording':t.playing?'playing':''}" data-timeline-status>${timelineStatusText()}</span>`;
}
function renderStageToolPanel(){return `<div class="blocking-tool-buttons">${canEdit()?'<button class="button button-primary button-small" data-add-object>+ Stage Element</button><button class="button button-secondary button-small" data-shapes>+ Shape</button>':''}${canManage()?'<button class="button button-secondary button-small" data-background>Background</button><button class="button button-secondary button-small" data-manage-cast>Manage Cast</button>':''}</div><div class="blocking-tool-caption">Props, furniture, set pieces, zones and labels can all participate in timed blocking.</div>`}
function renderBedfordFormationLab(){const count=bedfordFormationRows().length,m=BedfordFormation.metrics;return `<section class="bedford-formation-lab"><div class="bedford-formation-head"><strong>Formation Lab</strong><small>${count} performer${count===1?'':'s'}</small></div><label>Shape<select data-bedford-formation="shape">${[['circle','Perfect Circle'],['double-circle','Double Circle'],['arc','Arc'],['line','Straight Line'],['diagonal','Diagonal'],['v','V / Chevron'],['inverted-v','Inverted V'],['diamond','Diamond'],['grid','Grid / Rows'],['staggered','Staggered Rows']].map(([v,l])=>`<option value="${v}" ${BedfordFormation.shape===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="bedford-formation-grid"><label>Width <span>${BedfordFormation.width}</span><input type="range" min="80" max="900" step="10" value="${BedfordFormation.width}" data-bedford-formation="width"><input type="number" min="80" max="900" step="1" value="${BedfordFormation.width}" data-bedford-formation-exact="width"></label><label>Depth <span>${BedfordFormation.depth}</span><input type="range" min="60" max="1300" step="10" value="${BedfordFormation.depth}" data-bedford-formation="depth"><input type="number" min="60" max="1300" step="1" value="${BedfordFormation.depth}" data-bedford-formation-exact="depth"></label><label>Rotation <span>${BedfordFormation.rotation}°</span><input type="range" min="-180" max="180" step="1" value="${BedfordFormation.rotation}" data-bedford-formation="rotation"><input type="number" min="-180" max="180" step="1" value="${BedfordFormation.rotation}" data-bedford-formation-exact="rotation"></label><label>Rows <span>${BedfordFormation.rows}</span><input type="range" min="1" max="12" step="1" value="${BedfordFormation.rows}" data-bedford-formation="rows"><input type="number" min="1" max="12" step="1" value="${BedfordFormation.rows}" data-bedford-formation-exact="rows"></label></div><div class="bedford-formation-options"><label>Order<select data-bedford-formation="order"><option value="forward">Selection 1 → N</option><option value="reverse" ${BedfordFormation.order==='reverse'?'selected':''}>Selection N → 1</option></select></label><label>Ring<select data-bedford-formation="direction"><option value="cw">Clockwise</option><option value="ccw" ${BedfordFormation.direction==='ccw'?'selected':''}>Counter-clockwise</option></select></label></div><div class="bedford-formation-actions"><button class="button button-secondary button-small" data-bedford-preview>Preview</button><button class="button button-primary button-small" data-bedford-apply ${BedfordFormation.preview.length?'':'disabled'}>Apply</button></div><div class="bedford-formation-metrics">${m?`Travel ${m.travel.toFixed(1)} · Crossings ${m.crossings} · Collisions ${m.collisions}`:'Move a slider for live preview.'}</div></section>`}
function bedfordFormationRows(){const selected=selectedPlacementRows();return selected.length?selected:[...(BState.placements||[])];}
function bedfordRotatePoint(point,cx,cy,degrees){const a=degrees*Math.PI/180,x=point.x-cx,y=point.y-cy;return{x:cx+x*Math.cos(a)-y*Math.sin(a),y:cy+x*Math.sin(a)+y*Math.cos(a)}}
function bedfordFormationPoints(count,cx,cy){const w=Number(BedfordFormation.width),d=Number(BedfordFormation.depth),rows=Math.max(1,Number(BedfordFormation.rows)||1),points=[],shape=BedfordFormation.shape,dir=BedfordFormation.direction==='ccw'?-1:1;if(!count)return points;if(shape==='circle'){const radius=Math.min(w,d)/2;for(let i=0;i<count;i++){const a=(-Math.PI/2+dir*i/count*Math.PI*2);points.push({x:cx+Math.cos(a)*radius,y:cy+Math.sin(a)*radius});}}else if(shape==='double-circle'){const inner=Math.ceil(count/2),outer=count-inner;for(let i=0;i<inner;i++){const a=-Math.PI/2+dir*i/inner*Math.PI*2;points.push({x:cx+Math.cos(a)*Math.min(w,d)*.24,y:cy+Math.sin(a)*Math.min(w,d)*.24});}for(let i=0;i<outer;i++){const a=-Math.PI/2+dir*i/Math.max(1,outer)*Math.PI*2;points.push({x:cx+Math.cos(a)*Math.min(w,d)*.48,y:cy+Math.sin(a)*Math.min(w,d)*.48});}}else if(shape==='arc'){for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1),a=Math.PI*(.15+.7*t);points.push({x:cx+Math.cos(a)*w/2,y:cy-Math.sin(a)*d/2+d*.32});}}else if(shape==='line'||shape==='diagonal'){for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1);points.push({x:cx-w/2+w*t,y:shape==='diagonal'?cy-d/2+d*t:cy});}}else if(shape==='v'||shape==='inverted-v'){const sign=shape==='v'?1:-1;if(count%2){points.push({x:cx,y:cy-sign*d/2});for(let i=1;i<=Math.floor(count/2);i++){const t=i/Math.max(1,Math.floor(count/2));points.push({x:cx-w/2*t,y:cy-sign*d/2+sign*d*t},{x:cx+w/2*t,y:cy-sign*d/2+sign*d*t});}}else{const half=count/2;for(let i=0;i<half;i++){const t=half===1?0:i/(half-1),spread=half===1?Math.min(50,w*.12):w*.08+(w*.42*t),y=cy-sign*d/2+sign*d*t;points.push({x:cx-spread,y},{x:cx+spread,y});}}}else if(shape==='diamond'){const corners=[{x:cx,y:cy-d/2},{x:cx+w/2,y:cy},{x:cx,y:cy+d/2},{x:cx-w/2,y:cy}];for(let i=0;i<count;i++){const u=i/count*4,j=Math.floor(u)%4,t=u-Math.floor(u),a=corners[j],b=corners[(j+1)%4];points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}else{const cols=Math.max(1,Math.ceil(count/rows));for(let i=0;i<count;i++){const row=Math.floor(i/cols),col=i%cols,rowCount=Math.min(cols,count-row*cols),x=cx-w/2+(rowCount===1?w/2:col*w/(cols-1))+(shape==='staggered'&&row%2?w/Math.max(4,cols*2):0),y=cy-d/2+(rows===1?d/2:row*d/(rows-1));points.push({x,y});}}return points.map(p=>bedfordRotatePoint(p,cx,cy,Number(BedfordFormation.rotation)||0)).map(p=>({x:Math.max(15,Math.min(LOGICAL_W-15,p.x)),y:Math.max(15,Math.min(LOGICAL_H-15,p.y))})).slice(0,count);}
function bedfordSegmentsCross(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),x1=cross(a,b,c),x2=cross(a,b,d),x3=cross(c,d,a),x4=cross(c,d,b);return x1*x2<0&&x3*x4<0;}
function bedfordFormationCollisionCount(points,clearance=42){let count=0;for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<clearance)count++;return count;}
function bedfordExpandFormation(points,cx,cy){let expanded=points.map(p=>({...p}));for(let pass=0;pass<10&&bedfordFormationCollisionCount(expanded);pass++)expanded=expanded.map(p=>({x:cx+(p.x-cx)*1.09,y:cy+(p.y-cy)*1.09}));return expanded.map(p=>({x:Math.max(15,Math.min(LOGICAL_W-15,p.x)),y:Math.max(15,Math.min(LOGICAL_H-15,p.y))}));}
function bedfordSnakeFormation(points){if(!BedfordFormation.snake||!['grid','staggered'].includes(BedfordFormation.shape))return points;const cols=Math.max(1,Math.ceil(points.length/Math.max(1,Number(BedfordFormation.rows)||1))),out=[];for(let start=0,row=0;start<points.length;start+=cols,row++){const slice=points.slice(start,start+cols);out.push(...(row%2?slice.reverse():slice));}return out;}
function previewBedfordFormation(){let rows=bedfordFormationRows();if(rows.length<2){BedfordFormation.preview=[];BedfordFormation.metrics=null;BState.layers.preview?.destroyChildren();BState.layers.preview?.draw();return BRM.toast('Add or select at least two performers.','info');}if(BedfordFormation.order==='reverse')rows=[...rows].reverse();const cx=rows.reduce((s,p)=>s+Number(p.XPercent)/100*LOGICAL_W,0)/rows.length,cy=rows.reduce((s,p)=>s+Number(p.YPercent)/100*LOGICAL_H,0)/rows.length;let points=bedfordSnakeFormation(bedfordFormationPoints(rows.length,cx,cy));if(BedfordFormation.expand)points=bedfordExpandFormation(points,cx,cy);if(BedfordFormation.pin&&points[0]){const first={x:Number(rows[0].XPercent)/100*LOGICAL_W,y:Number(rows[0].YPercent)/100*LOGICAL_H},dx=first.x-points[0].x,dy=first.y-points[0].y;points=points.map(p=>({x:Math.max(15,Math.min(LOGICAL_W-15,p.x+dx)),y:Math.max(15,Math.min(LOGICAL_H-15,p.y+dy))}));}BedfordFormation.preview=rows.map((row,i)=>({id:row._localId,x:points[i].x,y:points[i].y}));let travel=0,crossings=0;BedfordFormation.preview.forEach((p,i)=>{const row=rows.find(r=>r._localId===p.id);travel+=Math.hypot(p.x-Number(row.XPercent)/100*LOGICAL_W,p.y-Number(row.YPercent)/100*LOGICAL_H);});for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a={x:Number(rows[i].XPercent)/100*LOGICAL_W,y:Number(rows[i].YPercent)/100*LOGICAL_H},b=BedfordFormation.preview[i],c={x:Number(rows[j].XPercent)/100*LOGICAL_W,y:Number(rows[j].YPercent)/100*LOGICAL_H},d=BedfordFormation.preview[j];if(bedfordSegmentsCross(a,b,c,d))crossings++;}BedfordFormation.metrics={travel:travel/rows.length,collisions:bedfordFormationCollisionCount(BedfordFormation.preview),crossings};renderBedfordFormationPreview();const host=document.querySelector('.bedford-formation-lab');if(host){host.outerHTML=renderBedfordFormationLab();bindBedfordFormationLab();}}
function renderBedfordFormationPreview(){const layer=BState.layers.preview;if(!layer)return;layer.destroyChildren();BedfordFormation.preview.forEach((p,i)=>{const row=BState.placements.find(item=>item._localId===p.id),before=row?{x:Number(row.XPercent)/100*LOGICAL_W,y:Number(row.YPercent)/100*LOGICAL_H}:null;if(BedfordFormation.ghosts&&before){layer.add(new Konva.Arrow({points:[before.x,before.y,p.x,p.y],stroke:'rgba(248,185,24,.72)',fill:'rgba(248,185,24,.72)',strokeWidth:2,dash:[8,6],pointerLength:8,pointerWidth:8,listening:false}));layer.add(new Konva.Circle({x:before.x,y:before.y,radius:25,fill:'rgba(248,185,24,.10)',stroke:'#f8b918',strokeWidth:2,dash:[5,5],listening:false}));layer.add(new Konva.Text({x:before.x-28,y:before.y-8,width:56,text:`B${i+1}`,align:'center',fontSize:12,fontStyle:'bold',fill:'#f8b918',listening:false}));}layer.add(new Konva.Circle({x:p.x,y:p.y,radius:25,fill:'rgba(56,189,248,.18)',stroke:'#38bdf8',strokeWidth:3,dash:[7,5],listening:false}));layer.add(new Konva.Text({x:p.x-28,y:p.y-8,width:56,text:`A${i+1}`,align:'center',fontSize:12,fontStyle:'bold',fill:'#7dd3fc',listening:false}));});layer.draw();}
function applyBedfordFormation(){if(!BedfordFormation.preview.length)return;pushUndo();BedfordFormation.preview.forEach(target=>{const row=BState.placements.find(p=>p._localId===target.id);if(row){row.XPercent=target.x/LOGICAL_W*100;row.YPercent=target.y/LOGICAL_H*100;}});BedfordFormation.preview=[];BedfordFormation.metrics=null;BState.layers.preview?.destroyChildren();BState.layers.preview?.draw();renderTokens();renderMovements();refreshRight();}
function bindBedfordFormationLab(){const lab=document.querySelector('.bedford-formation-lab');if(!lab)return;if(!lab.querySelector('.bedford-formation-checks'))lab.querySelector('.bedford-formation-actions')?.insertAdjacentHTML('beforebegin',`<div class="bedford-formation-checks"><label><input type="checkbox" data-bedford-formation-check="snake" ${BedfordFormation.snake?'checked':''}> Snake rows</label><label><input type="checkbox" data-bedford-formation-check="pin" ${BedfordFormation.pin?'checked':''}> Pin performer #1</label><label><input type="checkbox" data-bedford-formation-check="expand" ${BedfordFormation.expand?'checked':''}> Expand collisions</label></div><div class="bedford-formation-alternatives"><button class="button button-secondary button-small" data-bedford-alternative="compact">Compact</button><button class="button button-secondary button-small" data-bedford-alternative="balanced">Balanced</button><button class="button button-secondary button-small" data-bedford-alternative="wide">Wide</button></div>`);document.querySelectorAll('[data-bedford-formation]').forEach(input=>{input.oninput=()=>{BedfordFormation[input.dataset.bedfordFormation]=input.type==='range'?Number(input.value):input.value;previewBedfordFormation();};});document.querySelectorAll('[data-bedford-formation-exact]').forEach(input=>{input.oninput=()=>{if(!input.checkValidity())return;BedfordFormation[input.dataset.bedfordFormationExact]=Number(input.value);previewBedfordFormation();};});document.querySelectorAll('[data-bedford-formation-check]').forEach(input=>input.onchange=()=>{BedfordFormation[input.dataset.bedfordFormationCheck]=input.checked;previewBedfordFormation();});document.querySelectorAll('[data-bedford-alternative]').forEach(button=>button.onclick=()=>{const preset=button.dataset.bedfordAlternative;if(preset==='compact'){BedfordFormation.width=280;BedfordFormation.depth=190;}else if(preset==='wide'){BedfordFormation.width=760;BedfordFormation.depth=520;}else{BedfordFormation.width=480;BedfordFormation.depth=320;}previewBedfordFormation();});document.querySelector('[data-bedford-preview]')?.addEventListener('click',previewBedfordFormation);document.querySelector('[data-bedford-apply]')?.addEventListener('click',applyBedfordFormation);}
function renderZoomDock(){
  const pct=Math.round(BState.zoom*100);
  return `<div class="blocking-zoom-dock" data-zoom-dock aria-label="Blocking map zoom controls"><button class="button button-secondary button-small blocking-zoom-button" data-map-zoom-out aria-label="Zoom out">−</button><input class="blocking-zoom-slider" data-map-zoom-slider type="range" min="35" max="400" step="5" value="${pct}" aria-label="Map zoom"><button class="button button-secondary button-small blocking-zoom-button" data-map-zoom-in aria-label="Zoom in">＋</button><span class="blocking-zoom-value" data-map-zoom-value>${pct}%</span><button class="button button-secondary button-small" data-map-zoom-fit>Fit</button><button class="button button-secondary button-small" data-map-zoom-selection ${BState.selected?'':'disabled'}>Selection</button><select class="blocking-zoom-preset" data-map-zoom-preset aria-label="Zoom preset"><option value="">Preset…</option>${[50,75,100,125,150,200,250,300,400].map(v=>`<option value="${v}" ${v===pct?'selected':''}>${v}%</option>`).join('')}</select></div>`;
}
function renderViewToolPanel(){const s=BState.stageEditing;return `<div class="blocking-tool-caption">The main zoom controls now stay directly below the venue map. Range: 35%–400% of Fit.</div><div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-zoom-out>− Zoom</button><button class="button button-secondary button-small" data-zoom-in>+ Zoom</button><button class="button button-secondary button-small" data-map-zoom-fit>Fit Map</button><button class="button button-secondary button-small" data-map-zoom-selection ${BState.selected?'':'disabled'}>Focus Selection</button><button class="button button-secondary button-small" data-export-image>📷 Snapshot image</button></div><div class="blocking-tool-row"><span class="blocking-token-note" data-zoom-label>${Math.round(BState.zoom*100)}%</span><label class="checkbox-row"><input type="checkbox" data-show-movement ${BState.showMovement?'checked':''}><span>Movement arrows</span></label><label class="checkbox-row"><input type="checkbox" data-show-seats ${BState.showSeats?'checked':''}><span>Seats</span></label><label class="checkbox-row"><input type="checkbox" data-show-token-names ${BState.showTokenNames?'checked':''}><span>Display names</span></label>${canEdit()?`<button class="button button-secondary button-small ${BState.multiSelectMode?'is-active':''}" data-multi-select-mode aria-pressed="${BState.multiSelectMode?'true':'false'}">☑ Multi-select performers</button><span class="blocking-token-note" data-selection-count>${placementSelectionCount()?placementSelectionCount()+' selected':'No performers selected'}</span>`:''}</div><div class="blocking-stage-editing"><strong>Stage editing</strong><label class="checkbox-row"><input type="checkbox" data-grid-snap ${s.snap?'checked':''}><span>Snap to grid</span></label><label>Across <input type="number" min="10" max="250" step="5" value="${s.gridX}" data-grid-x></label><label>Depth <input type="number" min="10" max="250" step="5" value="${s.gridY}" data-grid-y></label><label class="checkbox-row"><input type="checkbox" data-collision-warnings ${s.collisionWarnings?'checked':''}><span>Collision warnings</span></label><label>Clearance <input type="number" min="40" max="200" step="2" value="${s.collisionClearance}" data-collision-clearance></label><label class="checkbox-row"><input type="checkbox" data-context-paths ${s.contextPaths?'checked':''}><span>Only relevant paths</span></label></div>`}
function snapStagePoint(x,y){const s=BState.stageEditing;if(!s.snap)return {x,y};const gx=Math.max(10,Number(s.gridX)||50),gy=Math.max(10,Number(s.gridY)||50);return {x:Math.round(x/gx)*gx,y:Math.round(y/gy)*gy}}
function placementCollisionIds(){const ids=new Set(),clearance=Math.max(1,Number(BState.stageEditing.collisionClearance)||86);for(let i=0;i<BState.placements.length;i++)for(let j=i+1;j<BState.placements.length;j++){const a=BState.placements[i],b=BState.placements[j];if(Math.hypot((a.XPercent-b.XPercent)/100*LOGICAL_W,(a.YPercent-b.YPercent)/100*LOGICAL_H)<clearance){ids.add(a._localId);ids.add(b._localId)}}return ids}
function bindBedfordStageEditing(){[['[data-grid-snap]','snap',1],['[data-grid-x]','gridX'],['[data-grid-y]','gridY'],['[data-collision-warnings]','collisionWarnings',1],['[data-collision-clearance]','collisionClearance'],['[data-context-paths]','contextPaths',1]].forEach(([selector,key,toggle])=>{const el=document.querySelector(selector);if(!el)return;el.addEventListener(toggle?'change':'input',()=>{BState.stageEditing[key]=toggle?el.checked:Number(el.value);saveBlockingUiPrefs();if(key.startsWith('collision'))renderTokens();if(key==='contextPaths')renderTimelinePaths();});})}
function blockingTruthy(value){return value===true||String(value||'').toUpperCase()==='TRUE'||String(value||'')==='1'}
function formatBlockingBytes(value){const n=Number(value||0);if(!(n>0))return '';if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(n<10240?1:0)} KB`;return `${(n/1024/1024).toFixed(n<10*1024*1024?1:0)} MB`}
function renderSceneRecorderPanel(){
  const t=BState.timeline,media=t.media?.MediaSource==='SceneRecording'?t.media:null,rows=t.recordings||[];
  if(t.sceneRecorder){const paused=t.sceneRecorder.state==='paused';return `<div class="blocking-scene-recorder"><div class="blocking-scene-recorder-head"><span class="blocking-recorder-live">${paused?'Paused':'Recording scene'}</span><span class="blocking-recorder-time" data-scene-record-time>${formatTimelineTime(sceneRecordingElapsed())}</span></div><div class="blocking-tool-caption">Voice recording is automatically captured at a speech-friendly bitrate so long dialogue rehearsals stay manageable.</div><div class="blocking-tool-buttons"><button class="button button-secondary button-small" data-scene-record-pause>${paused?'▶ Resume':'⏸ Pause'}</button><button class="button button-primary button-small" data-scene-record-stop>■ Stop & Save</button><button class="button button-secondary button-small" data-scene-record-discard>Discard</button></div></div>`}
  const activeRecording=media?rows.find(r=>String(r.RecordingID||'')===String(media.RecordingID||'')||String(r.FileID||'')===String(media.FileID||'')):null;
  const sourceLabel=media?.SourceType==='Upload'?'Uploaded audio':'Recorded rehearsal';
  const storedSize=formatBlockingBytes(activeRecording?.StoredByteLength||0),originalSize=formatBlockingBytes(activeRecording?.OriginalByteLength||0),optimized=blockingTruthy(activeRecording?.OptimizedForBlocking);
  const savedOptions=rows.map(r=>`<option value="${BRM.escape(r.RecordingID)}" ${String(r.FileID||'')===String(media?.FileID||'')?'selected':''}>${BRM.escape(r.Title||'Scene audio')} · ${formatTimelineTime(r.DurationSeconds||0)}${blockingTruthy(r.OptimizedForBlocking)?' · optimized':''}${r.SourceType?` · ${BRM.escape(r.SourceType)}`:''}</option>`).join('');
  return `${media?`<div class="blocking-scene-media-card"><div class="blocking-scene-media-title"><strong>🎧 ${BRM.escape(media.RecordingTitle||'Scene rehearsal audio')}</strong>${optimized?'<span class="badge blocking-audio-optimized-badge">Optimized</span>':''}</div><small>${formatTimelineTime(media.DurationSeconds||timelineDuration())} · ${BRM.escape(sourceLabel)}${storedSize?` · ${BRM.escape(storedSize)} stored`:''}${optimized&&originalSize?` · from ${BRM.escape(originalSize)}`:''}</small>${activeRecording?.OptimizationNote?`<small>${BRM.escape(activeRecording.OptimizationNote)}</small>`:''}</div>`:'<div class="blocking-tool-caption"><strong>Add timing audio for this dialogue scene</strong><br>Record rehearsal dialogue here or upload an existing audio file. Large uploads can be automatically speech-optimized before they are sent to Drive.</div>'}
    ${canEdit()?`<div class="blocking-scene-source-actions"><button class="button button-primary button-small" data-scene-record-start>🎙 ${media?'Record New':'Record Scene'}</button><button class="button button-secondary button-small" data-scene-upload>⬆ Upload Dialogue Audio</button></div>`:''}
    ${rows.length?`<div class="blocking-tool-caption" style="margin-top:8px"><strong>Saved Scene ${BState.scene} recordings</strong><br>Your currently selected recording stays linked when you leave and return.</div><div class="blocking-tool-row"><select data-scene-saved-select><option value="">Choose saved recording…</option>${savedOptions}</select>${canEdit()?'<button class="button button-secondary button-small" data-scene-use-saved>Use</button>':''}</div>`:''}`;
}
function timelineStatusText(){const t=BState.timeline;if(t.sceneRecorder)return t.sceneRecorder.state==='paused'?'⏸ Scene recording paused':'● Recording scene audio';if(t.recording)return `● Recording ${t.recording.label}`;if(t.trace)return 'Trace path armed';if(t.playing)return '▶ Playback';if(t.audioLoadPromise&&!t.audioReady)return '⚡ Timeline ready · audio preparing in background';return t.loaded?'Ready':'Loading…'}
function renderLoopReadout(){const t=BState.timeline;if(t.loopA==null&&t.loopB==null)return 'Loop off';return `A ${t.loopA==null?'—':formatTimelineTime(t.loopA)} · B ${t.loopB==null?'—':formatTimelineTime(t.loopB)}`}
function safeStateJSON(value){if(!value)return {};if(typeof value==='object')return value;try{return JSON.parse(value)}catch{return {}}}
function safePathJSON(value){if(!value)return [];if(Array.isArray(value))return value;try{const a=JSON.parse(value);return Array.isArray(a)?a:[]}catch{return []}}
function renderTimelineEvents(){
  const t=BState.timeline,events=[];
  (t.markers||[]).forEach((m,i)=>{const dialogue=String(m.MarkerType||'')==='Dialogue';const copy=dialogue?`<span class="blocking-dialogue-chip">💬 ${BRM.escape(m.Speaker||'Dialogue')}:</span> ${BRM.escape(m.DialogueText||m.Label||'')}`:`• ${BRM.escape(m.Label||'Marker')}`;events.push({time:Number(m.TimeSeconds||0),html:`<button class="blocking-timeline-event ${dialogue?'blocking-dialogue-event':''}" data-seek-event="${Number(m.TimeSeconds||0)}">${formatTimelineTime(m.TimeSeconds)} ${copy}${canEdit()?` <span class="x" data-delete-timeline="marker:${i}">×</span>`:''}</button>`})});
  (t.keyframes||[]).forEach((k,i)=>events.push({time:Number(k.TimeSeconds||0),html:`<button class="blocking-timeline-event keyframe" data-seek-event="${Number(k.TimeSeconds||0)}">◆ ${formatTimelineTime(k.TimeSeconds)} ${BRM.escape(k.Title||'Formation')}${canEdit()?` <span class="x" data-delete-timeline="keyframe:${i}">×</span>`:''}</button>`}));
  (t.motions||[]).forEach((m,i)=>events.push({time:Number(m.StartSeconds||0),html:`<button class="blocking-timeline-event motion" data-seek-event="${Number(m.StartSeconds||0)}">〰 ${formatTimelineTime(m.StartSeconds)}–${formatTimelineTime(m.EndSeconds)} ${BRM.escape(m.Label||'Path')}${canEdit()?` <span class="x" data-delete-timeline="motion:${i}">×</span>`:''}</button>`}));
  return events.sort((a,b)=>a.time-b.time).map(e=>e.html).join('')||'<span class="blocking-timeline-empty">No timed formations, dialogue cues, markers, or paths yet.</span>';
}
function applyTimelineResult(timeline,recordingsResult=null){
  const t=BState.timeline;t.recordings=recordingsResult?.recordings||timeline?.recordings||t.recordings||[];t.media=timeline?.media||null;t.markers=timeline?.markers||[];t.keyframes=(timeline?.keyframes||[]).map(k=>({...k,_state:safeStateJSON(k.StateJSON)}));t.motions=(timeline?.motions||[]).map(m=>({...m,_path:safePathJSON(m.PathJSON)}));if(timeline?.musicMap&&Object.keys(timeline.musicMap).length)BState.musicMap={...BState.musicMap,...timeline.musicMap,taps:[],waveform:[],waveformKey:''};BState.visualViewer.referenceMedia=timeline?.referenceMedia||null;if(BState.visualViewer.referenceMedia?.OffsetSeconds!=null)BState.visualViewer.videoOffset=Number(BState.visualViewer.referenceMedia.OffsetSeconds)||0;if(t.media?.DurationSeconds)t.duration=Number(t.media.DurationSeconds)||t.duration;t.loaded=true;BState.save.timelineDirty=false;updateBlockingSaveStatus();refreshTimelineDock();renderTimelinePaths();cacheCurrentTimeline();queueCurrentTimelineAudioLoad();
}
function queueCurrentTimelineAudioLoad(){
  const t=BState.timeline,key=t.media?.TrackID?`track:${t.media.TrackID}`:t.media?.FileID?`scene:${t.media.FileID}`:'';if(!key)return;t.audioReady=false;t.audioLoadKey=key;updateTimelineReadouts();
  const task=t.media?.TrackID?loadBlockingGuideAudio(t.media.TrackID):loadBlockingSceneAudio(t.media.FileID);t.audioLoadPromise=Promise.resolve(task).finally(()=>{if(t.audioLoadKey===key){t.audioLoadPromise=null;t.audioReady=!!t.audio;updateTimelineReadouts();}});
}
async function refreshTimelineFromServer(contextKey){
  if(BState.cache.timelineFreshening.has(contextKey))return BState.cache.timelineFreshening.get(contextKey);
  const [scene,cue]=contextKey.split(':');
  const task=(async()=>{try{
    const [timeline,recordingsResult]=await Promise.all([BRM.api('blockingTimeline',{sceneNumber:Number(scene),cueNumber:cue||''},{noCache:true,forceNetwork:true}),cue?Promise.resolve({recordings:[]}):BRM.api('blockingSceneRecordings',{sceneNumber:Number(scene)},{noCache:true,forceNetwork:true})]);
    const cached={...timeline,recordings:recordingsResult?.recordings||[]};blockingCacheWrite('timeline',contextKey,cached);
    if(blockingContextKey()===contextKey&&!BState.save.timelineDirty&&!BState.timeline.saving)applyTimelineResult(timeline,recordingsResult);
    return timeline;
  }catch(error){console.warn('Timeline background refresh failed',error);return null}finally{BState.cache.timelineFreshening.delete(contextKey)}})();BState.cache.timelineFreshening.set(contextKey,task);return task;
}
async function loadTimelineContext(preferCache=true){
  const t=BState.timeline,contextKey=blockingContextKey();
  const cachedTracks=blockingCacheRead('tracks','library',24*60*60*1000);if(!t.libraryLoaded&&cachedTracks?.data?.length){t.tracks=cachedTracks.data;t.libraryLoaded=true;t.guideTracks=t.tracks.filter(trackIsGuide);}
  const tracksPromise=t.libraryLoaded?Promise.resolve({data:t.tracks}):BRM.api('tracks');
  const cached=preferCache?blockingCacheRead('timeline',contextKey,7*24*60*60*1000):null;
  if(cached){applyTimelineResult(cached,{recordings:cached.recordings||[]});refreshTimelineFromServer(contextKey);tracksPromise.then(r=>{t.tracks=Array.isArray(r?.data)?r.data:(Array.isArray(r)?r:t.tracks||[]);t.libraryLoaded=true;t.guideTracks=t.tracks.filter(trackIsGuide);cacheTracksLibrary();refreshTimelineDock();queueCurrentTimelineAudioLoad();}).catch(()=>{});return;}
  try{
    const [timeline,tracksResult,recordingsResult]=await Promise.all([BRM.api('blockingTimeline',{sceneNumber:BState.scene,cueNumber:BState.cue||''},{noCache:true,forceNetwork:true}),tracksPromise,isSongTimeline()?Promise.resolve({recordings:[]}):BRM.api('blockingSceneRecordings',{sceneNumber:BState.scene},{noCache:true,forceNetwork:true})]);
    t.tracks=Array.isArray(tracksResult?.data)?tracksResult.data:(Array.isArray(tracksResult)?tracksResult:t.tracks||[]);t.libraryLoaded=true;t.guideTracks=t.tracks.filter(trackIsGuide);cacheTracksLibrary();blockingCacheWrite('timeline',contextKey,{...timeline,recordings:recordingsResult?.recordings||[]});applyTimelineResult(timeline,recordingsResult);
  }catch(e){t.loaded=true;refreshTimelineDock();BRM.toast(`Timeline could not load: ${e.message}`,'warning');}
}
function refreshTimelineDock(){
  const holder=document.querySelector('[data-timeline]');if(!holder)return;
  const t=BState.timeline,wasPlaying=!!t.playing,current=timelineCurrentTime(),hadAudio=!!(t.objectUrl&&(t.media?.TrackID||t.media?.FileID));
  holder.innerHTML=renderTimelineDock();refreshTimelineToolPanel();bindTimelineUI();
  if(hadAudio){
    const audio=holder.querySelector('[data-blocking-audio]');if(audio){t.audio=audio;audio.src=t.objectUrl;audio.preload='metadata';audio.playbackRate=t.speed;audio.preservesPitch=true;audio.webkitPreservesPitch=true;audio.addEventListener('loadedmetadata',()=>{t.duration=audio.duration||t.duration;try{audio.currentTime=Math.min(current,audio.duration||current)}catch{}updateTimelineReadouts();if(wasPlaying)audio.play().catch(()=>{})},{once:true});audio.addEventListener('ended',()=>{t.playing=false;t.current=audio.duration||0;updateTimelineReadouts();});audio.load();}
  }
}
function refreshTimelineToolPanel(){const host=document.querySelector('[data-timeline-tool-panel]');if(host)host.innerHTML=renderTimelineToolPanel();}
function bindTimelineUI(){
  bindBedfordWaveform();
  document.querySelector('[data-timeline-play]')?.addEventListener('click',toggleTimelinePlayback);
  document.querySelector('[data-timeline-back]')?.addEventListener('click',()=>seekTimeline(timelineCurrentTime()-5));
  document.querySelector('[data-timeline-forward]')?.addEventListener('click',()=>seekTimeline(timelineCurrentTime()+5));
  document.querySelector('[data-timeline-seek]')?.addEventListener('input',e=>seekTimeline(Number(e.target.value),false));
  document.querySelector('[data-timeline-speed]')?.addEventListener('change',e=>{BState.timeline.speed=Number(e.target.value)||1;if(BState.timeline.audio)BState.timeline.audio.playbackRate=BState.timeline.speed;});
  document.querySelector('[data-loop-a]')?.addEventListener('click',()=>{BState.timeline.loopA=timelineCurrentTime();updateTimelineReadouts();});
  document.querySelector('[data-loop-b]')?.addEventListener('click',()=>{BState.timeline.loopB=timelineCurrentTime();updateTimelineReadouts();});
  document.querySelector('[data-loop-clear]')?.addEventListener('click',()=>{BState.timeline.loopA=BState.timeline.loopB=null;updateTimelineReadouts();});
  document.querySelector('[data-link-guide]')?.addEventListener('click',linkSelectedGuideTrack);
  document.querySelector('[data-save-timeline]')?.addEventListener('click',()=>saveTimeline(true));
  document.querySelector('[data-add-marker]')?.addEventListener('click',openTimelineMarkerModal);
  document.querySelector('[data-add-dialogue]')?.addEventListener('click',openTimelineDialogueModal);
  document.querySelector('[data-scene-record-start]')?.addEventListener('click',startSceneAudioRecording);
  document.querySelector('[data-scene-upload]')?.addEventListener('click',openSceneAudioUploadModal);
  document.querySelector('[data-scene-use-saved]')?.addEventListener('click',useSelectedSavedSceneRecording);
  document.querySelector('[data-scene-record-pause]')?.addEventListener('click',toggleSceneAudioPause);
  document.querySelector('[data-scene-record-stop]')?.addEventListener('click',stopSceneAudioRecording);
  document.querySelector('[data-scene-record-discard]')?.addEventListener('click',discardSceneAudioRecording);
  document.querySelectorAll('[data-capture-formation]').forEach(button=>button.addEventListener('click',captureFormationKeyframe));
  document.querySelector('[data-trace-selected]')?.addEventListener('click',openTraceSelectedModal);
  document.querySelector('[data-record-selected]')?.addEventListener('click',startSelectedDragRecording);
  document.querySelector('[data-stop-recording]')?.addEventListener('click',stopSelectedDragRecording);
  document.querySelector('[data-show-paths]')?.addEventListener('change',e=>{BState.timeline.showPaths=e.target.checked;renderTimelinePaths();});
  document.querySelectorAll('[data-seek-event]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('[data-delete-timeline]'))return;seekTimeline(Number(el.dataset.seekEvent));}));
  document.querySelectorAll('[data-delete-timeline]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();deleteTimelineEvent(el.dataset.deleteTimeline);}));
}
function bindBedfordWaveform(){const transport=document.querySelector('.blocking-transport');if(!transport)return;let canvas=document.querySelector('[data-bedford-waveform]');if(!canvas){canvas=document.createElement('canvas');canvas.className='bedford-waveform';canvas.dataset.bedfordWaveform='';canvas.width=1200;canvas.height=96;transport.insertAdjacentElement('afterend',canvas);canvas.addEventListener('pointerdown',e=>{const rect=canvas.getBoundingClientRect(),time=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*timelineDuration();seekTimeline(BState.musicMap.snap?snapBedfordBeatTime(time):time);});}drawBedfordWaveform();loadBedfordWaveform();}
async function loadBedfordWaveform(){const url=BState.timeline.objectUrl;if(!url||BState.musicMap.waveformKey===url)return;BState.musicMap.waveformKey=url;try{const bytes=await (await fetch(url)).arrayBuffer(),Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),buffer=await ctx.decodeAudioData(bytes.slice(0)),data=buffer.getChannelData(0),bins=600,samples=[];for(let i=0;i<bins;i++){const a=Math.floor(i*data.length/bins),b=Math.floor((i+1)*data.length/bins),step=Math.max(1,Math.floor((b-a)/80));let peak=0;for(let j=a;j<b;j+=step)peak=Math.max(peak,Math.abs(data[j]||0));samples.push(peak);}BState.musicMap.waveform=samples;await ctx.close();drawBedfordWaveform();}catch(error){console.warn('Bedford waveform unavailable',error);}}
function drawBedfordWaveform(){const canvas=document.querySelector('[data-bedford-waveform]');if(!canvas)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.max(500,Math.round(rect.width||1200)),h=72;if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#0b1220';c.fillRect(0,0,w,h);const duration=timelineDuration();for(const region of BState.musicMap.regions||[]){const x=Number(region.start)/duration*w,width=Math.max(2,(Number(region.end)-Number(region.start))/duration*w);c.fillStyle=region.type==='Fermata'?'rgba(251,113,133,.24)':region.type==='Rubato'?'rgba(167,139,250,.22)':'rgba(251,191,36,.18)';c.fillRect(x,0,width,h);}const samples=BState.musicMap.waveform||[];c.strokeStyle='#38bdf8';c.lineWidth=1.2;c.beginPath();samples.forEach((v,i)=>{const x=i/Math.max(1,samples.length-1)*w,amp=Math.max(1,v*h*.46);c.moveTo(x,h/2-amp);c.lineTo(x,h/2+amp);});c.stroke();for(const marker of (BState.timeline.markers||[]).filter(m=>String(m.MarkerType)==='Beat Anchor')){const x=Number(marker.TimeSeconds)/duration*w;c.strokeStyle='#fbbf24';c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}const play=timelineCurrentTime()/duration*w;c.strokeStyle='#fb7185';c.lineWidth=2;c.beginPath();c.moveTo(play,0);c.lineTo(play,h);c.stroke();}
function updateTimelineReadouts(){
  const now=timelineCurrentTime(),duration=timelineDuration();BState.timeline.current=now;
  const s=document.querySelector('[data-timeline-seek]');if(s){s.max=duration;s.value=Math.min(duration,now)}
  const r=document.querySelector('[data-timeline-time]');if(r)r.textContent=`${formatTimelineTime(now)} / ${formatTimelineTime(duration)}`;
  const l=document.querySelector('[data-loop-readout]');if(l)l.textContent=renderLoopReadout();
  const p=document.querySelector('[data-timeline-play]');if(p)p.textContent=BState.timeline.playing?'⏸ Pause':'▶ Play';
  const st=document.querySelector('[data-timeline-status]');if(st){st.textContent=timelineStatusText();st.className=`blocking-timeline-status ${BState.timeline.recording?'recording':BState.timeline.playing?'playing':''}`;}
  const ss=document.querySelector('[data-timeline-summary-status]');if(ss){ss.textContent=timelineStatusText();ss.className=`blocking-timeline-summary-status ${BState.timeline.sceneRecorder?'recording':BState.timeline.playing?'playing':''}`;}
  const rt=document.querySelector('[data-scene-record-time]');if(rt&&BState.timeline.sceneRecorder)rt.textContent=formatTimelineTime(sceneRecordingElapsed());
  updateBedfordMusicMapStatus();
  drawBedfordWaveform();
}
async function toggleTimelinePlayback(){if(BState.timeline.playing)stopTimelinePlayback(false);else await startTimelinePlayback()}
async function startTimelinePlayback(){
  const t=BState.timeline;
  if(t.sceneRecorder){BRM.toast('Stop or discard the live scene recording before timeline playback.','warning');return;}
  if(t.media?.TrackID){if(!t.audio&&t.audioLoadPromise)await t.audioLoadPromise;if(!t.audio)await loadBlockingGuideAudio(t.media.TrackID);try{t.audio.playbackRate=t.speed;await t.audio.play();}catch(e){BRM.toast('The Guide Vocal could not start. Try clicking Play again.','warning');return;}}
  else if(t.media?.FileID&&(t.media.MediaSource==='SceneRecording'||!isSongTimeline())){if(!t.audio&&t.audioLoadPromise)await t.audioLoadPromise;if(!t.audio)await loadBlockingSceneAudio(t.media.FileID);try{t.audio.playbackRate=t.speed;await t.audio.play();}catch(e){BRM.toast('The scene recording could not start. Try clicking Play again.','warning');return;}}
  else{t.sceneTimerBase=t.current||0;t.sceneTimerStartedAt=performance.now();}
  t.playing=true;updateTimelineReadouts();timelineAnimationLoop();
}
function stopTimelinePlayback(reset=false){const t=BState.timeline;if(t.audio)t.audio.pause();if(!t.audio&&t.playing)t.sceneTimerBase=timelineCurrentTime();t.current=reset?0:timelineCurrentTime();t.sceneTimerStartedAt=0;t.playing=false;if(t.raf)cancelAnimationFrame(t.raf);t.raf=0;if(reset)seekTimeline(0,false);updateTimelineReadouts();syncBedfordReferenceVideo(true);}
function timelineAnimationLoop(){
  const t=BState.timeline;if(!t.playing)return;let now=timelineCurrentTime();
  if(t.loopA!=null&&t.loopB!=null&&t.loopB>t.loopA&&now>=t.loopB){seekTimeline(t.loopA,false);now=t.loopA;if(!t.audio){t.sceneTimerBase=t.loopA;t.sceneTimerStartedAt=performance.now();}}
  if(!t.audio&&now>=timelineDuration()){stopTimelinePlayback(false);return;}
  positionTimelineAt(now);updateTimelineReadouts();t.raf=requestAnimationFrame(timelineAnimationLoop);
}
function seekTimeline(seconds,update=true){
  const t=BState.timeline,sec=Math.max(0,Math.min(timelineDuration(),Number(seconds)||0));t.current=sec;
  if(t.audio){try{t.audio.currentTime=sec}catch{}}
  else{t.sceneTimerBase=sec;if(t.playing)t.sceneTimerStartedAt=performance.now();}
  positionTimelineAt(sec);if(update)updateTimelineReadouts();else updateTimelineReadouts();
}
async function linkSelectedGuideTrack(){
  const id=document.querySelector('[data-guide-track]')?.value;if(!id){BRM.toast('Choose a Guide Vocal track first.','warning');return;}
  const track=BState.timeline.guideTracks.find(x=>String(x.TrackID)===String(id));if(!track)return;
  BState.timeline.media={MediaSource:'GuideTrack',TrackID:track.TrackID,TrackTitle:track.Title||guideTrackLabel(track),TrackType:track.TrackType||'Guide Vocal',FileID:'',MimeType:'',DurationSeconds:0};refreshTimelineDock();const saved=await saveTimeline(false);if(!saved)return;BRM.toast('Guide Vocal linked permanently to this song.','success');await loadBlockingGuideAudio(id);
}
function trackCacheVersionBlocking(track){return ['bedford-audio-v42',track.TrackID||'',track.DriveFileID||'',track.UpdatedAt||'',track.URL||''].join('|')}
function openBlockingAudioDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('bedford-musical-audio-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('tracks'))r.result.createObjectStore('tracks',{keyPath:'trackId'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Could not open audio cache.'));});}
async function getBlockingCachedTrack(track){const db=await openBlockingAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readonly'),r=tx.objectStore('tracks').get(String(track.TrackID));r.onsuccess=()=>{db.close();const e=r.result;resolve(e&&e.version===trackCacheVersionBlocking(track)&&e.blob instanceof Blob?e:null)};r.onerror=()=>{db.close();reject(r.error)}})}
async function putBlockingCachedTrack(track,blob,info){const db=await openBlockingAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').put({trackId:String(track.TrackID),version:trackCacheVersionBlocking(track),title:track.Title||'',trackType:track.TrackType||'',mimeType:info.mimeType||blob.type||'audio/mpeg',byteLength:Number(info.byteLength||blob.size||0),savedAt:Date.now(),blob});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
function decodeBlockingBase64(base64){const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes}
async function getBlockingTrackBlob(track){
  const key=String(track.TrackID);if(BState.audioBlobLoads.has(key))return BState.audioBlobLoads.get(key);
  const task=(async()=>{try{const cached=await getBlockingCachedTrack(track);if(cached)return cached.blob}catch{}const info=await BRM.api('trackAudioInfo',{trackId:key}),chunkCount=Math.max(1,Number(info.chunkCount)||0),chunks=new Array(chunkCount);let next=0;async function fetchChunk(i){let lastError;for(let attempt=0;attempt<3;attempt++){try{const r=await BRM.api('trackAudioChunk',{trackId:key,chunkIndex:i},{noCache:true,forceNetwork:true});if(Number(r.chunkIndex)!==i||!r.base64)throw new Error(`Drive returned an invalid audio chunk ${i+1}.`);return decodeBlockingBase64(r.base64)}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));}}throw lastError;}async function worker(){while(true){const i=next++;if(i>=chunkCount)return;chunks[i]=await fetchChunk(i)}}await Promise.all(Array.from({length:Math.min(2,chunkCount)},worker));const blob=new Blob(chunks,{type:info.mimeType||'audio/mpeg'}),expected=Number(info.byteLength)||0;if(expected&&blob.size!==expected)throw new Error(`Drive audio was incomplete (${blob.size} of ${expected} bytes).`);try{await putBlockingCachedTrack(track,blob,info)}catch{}return blob;})();BState.audioBlobLoads.set(key,task);try{return await task}finally{BState.audioBlobLoads.delete(key)}
}
async function loadBlockingGuideAudio(trackId){
  const t=BState.timeline,requestedKey=`track:${String(trackId)}`,track=t.guideTracks.find(x=>String(x.TrackID)===String(trackId))||t.tracks.find(x=>String(x.TrackID)===String(trackId));if(!track)return;
  const audio=document.querySelector('[data-blocking-audio]')||document.createElement('audio');if(t.objectUrl){try{URL.revokeObjectURL(t.objectUrl)}catch{}}
  try{const blob=await getBlockingTrackBlob(track);if(t.audioLoadKey&&t.audioLoadKey!==requestedKey)return;t.objectUrl=URL.createObjectURL(blob);audio.src=t.objectUrl;audio.preload='metadata';audio.playbackRate=t.speed;audio.preservesPitch=true;audio.webkitPreservesPitch=true;t.audio=audio;
    await new Promise((resolve,reject)=>{if(Number.isFinite(audio.duration)&&audio.duration>0)return resolve();const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(new Error('Guide track could not be decoded.'))},cleanup=()=>{audio.removeEventListener('loadedmetadata',ok);audio.removeEventListener('error',bad)};audio.addEventListener('loadedmetadata',ok,{once:true});audio.addEventListener('error',bad,{once:true});audio.load();});
    t.duration=Number(audio.duration)||t.duration;t.audioReady=true;audio.addEventListener('ended',()=>{t.playing=false;t.current=audio.duration||0;updateTimelineReadouts();});refreshTimelineDock();
    const newAudio=document.querySelector('[data-blocking-audio]');if(newAudio&&newAudio!==audio){newAudio.src=t.objectUrl;newAudio.playbackRate=t.speed;t.audio=newAudio;newAudio.addEventListener('loadedmetadata',()=>{t.duration=newAudio.duration||t.duration;updateTimelineReadouts()});newAudio.load();}
  }catch(e){BRM.toast(`Guide track could not load: ${e.message}`,'error');}
}

async function warmBlockingMediaIndex(){
  if(BState.cache.mediaIndexLoaded)return;
  try{const r=await BRM.api('blockingTimelineMediaIndex',{}, {noCache:true,forceNetwork:true});BState.cache.mediaIndex=r?.media||[];BState.cache.mediaIndexLoaded=true;scheduleLinkedGuidePrefetch();}catch(_error){}
}
function scheduleLinkedGuidePrefetch(){
  if(BState.cache.prefetchRunning||!BState.cache.mediaIndexLoaded)return;BState.cache.prefetchRunning=true;
  const run=async()=>{try{
    const linked=BState.cache.mediaIndex.filter(m=>m.TrackID).sort((a,b)=>Math.abs(Number(a.SceneNumber||0)-Number(BState.scene||0))-Math.abs(Number(b.SceneNumber||0)-Number(BState.scene||0))).slice(0,2);
    for(const media of linked){const track=BState.timeline.tracks.find(x=>String(x.TrackID)===String(media.TrackID));if(!track)continue;try{const cached=await getBlockingCachedTrack(track);if(!cached)await getBlockingTrackBlob(track);}catch(_error){}}
  }finally{BState.cache.prefetchRunning=false}};
  if('requestIdleCallback'in window)requestIdleCallback(()=>run(),{timeout:2500});else setTimeout(run,1200);
}

function selectedTimelineEntity(){
  if(placementSelectionCount()>1)return null;
  if(BState.selected?.kind==='placement'){const p=BState.placements.find(x=>x._localId===BState.selected.id),c=p&&castById(p.BlockingCastID);if(p)return {EntityType:'Cast',EntityKey:'cast:'+p.BlockingCastID,Label:p.LabelOverride||c?.CharacterName||'Performer',x:p.XPercent,y:p.YPercent};}
  if(BState.selected?.kind==='object'){const o=BState.objects.find(x=>x._localId===BState.selected.id);if(o)return {EntityType:'Object',EntityKey:'obj:'+o.TimelineKey,Label:o.Label||o.ObjectType||'Object',x:o.XPercent,y:o.YPercent};}
  return null;
}
function objectEntityKey(o){return 'obj:'+o.TimelineKey}
function formationState(){return {entities:[...BState.placements.map(p=>({key:'cast:'+p.BlockingCastID,type:'Cast',x:Number(p.XPercent),y:Number(p.YPercent)})),...BState.objects.map(o=>({key:objectEntityKey(o),type:'Object',x:Number(o.XPercent),y:Number(o.YPercent),rotation:Number(o.Rotation||0)}))]}}

function sceneAudioCacheKey(media){return 'scene:'+String(media?.FileID||'')}
function sceneAudioCacheVersion(media){return [media?.FileID||'',media?.UpdatedAt||'',media?.DurationSeconds||''].join('|')}
async function getBlockingCachedSceneAudio(media){const db=await openBlockingAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readonly'),r=tx.objectStore('tracks').get(sceneAudioCacheKey(media));r.onsuccess=()=>{db.close();const e=r.result;resolve(e&&e.version===sceneAudioCacheVersion(media)&&e.blob instanceof Blob?e:null)};r.onerror=()=>{db.close();reject(r.error)}})}
async function putBlockingCachedSceneAudio(media,blob,info){const db=await openBlockingAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').put({trackId:sceneAudioCacheKey(media),version:sceneAudioCacheVersion(media),title:media.RecordingTitle||'Scene recording',trackType:'Scene Rehearsal Audio',mimeType:info.mimeType||blob.type||'audio/webm',byteLength:Number(info.byteLength||blob.size||0),savedAt:Date.now(),blob});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getBlockingSceneAudioBlob(media){
  const key=String(media.FileID);if(BState.sceneAudioBlobLoads.has(key))return BState.sceneAudioBlobLoads.get(key);
  const task=(async()=>{try{const cached=await getBlockingCachedSceneAudio(media);if(cached)return cached.blob}catch{}const info=await BRM.api('blockingSceneAudioInfo',{fileId:key}),chunks=new Array(info.chunkCount);let next=0;async function worker(){while(true){const i=next++;if(i>=info.chunkCount)return;const r=await BRM.api('blockingSceneAudioChunk',{fileId:key,chunkIndex:i});chunks[i]=decodeBlockingBase64(r.base64)}}await Promise.all(Array.from({length:Math.min(5,Math.max(1,info.chunkCount))},worker));const blob=new Blob(chunks,{type:info.mimeType||media.MimeType||'audio/webm'});try{await putBlockingCachedSceneAudio(media,blob,info)}catch{}return blob;})();BState.sceneAudioBlobLoads.set(key,task);try{return await task}finally{BState.sceneAudioBlobLoads.delete(key)}
}
async function loadBlockingSceneAudio(fileId){
  const t=BState.timeline,requestedKey=`scene:${String(fileId)}`,media=t.media;if(!media||String(media.FileID)!==String(fileId))return;
  const audio=document.querySelector('[data-blocking-audio]');if(!audio)return;
  try{
    const blob=await getBlockingSceneAudioBlob(media);if(t.audioLoadKey&&t.audioLoadKey!==requestedKey)return;
    if(t.objectUrl){try{URL.revokeObjectURL(t.objectUrl)}catch{}}
    t.objectUrl=URL.createObjectURL(blob);t.audio=audio;t.audioReady=true;audio.src=t.objectUrl;audio.preload='metadata';audio.playbackRate=t.speed;audio.preservesPitch=true;audio.webkitPreservesPitch=true;
    audio.addEventListener('loadedmetadata',()=>{t.duration=Number(media.DurationSeconds)||audio.duration||t.duration;updateTimelineReadouts();},{once:true});audio.addEventListener('ended',()=>{t.playing=false;t.current=t.audio?.duration||t.duration||0;updateTimelineReadouts();});audio.load();
  }catch(e){BRM.toast('Scene recording could not load: '+e.message,'warning')}
}

function sceneRecordingElapsed(){
  const r=BState.timeline.sceneRecorder;if(!r)return 0;
  const now=r.state==='paused'&&r.pausedAt?r.pausedAt:performance.now();
  return Math.max(0,(now-Number(r.startedAt||now)-Number(r.pausedMs||0))/1000);
}
function stopSceneRecorderTicker(){
  if(BState.timeline.recordTick){clearInterval(BState.timeline.recordTick);BState.timeline.recordTick=0;}
}
function startSceneRecorderTicker(){
  stopSceneRecorderTicker();BState.timeline.recordTick=setInterval(()=>updateTimelineReadouts(),200);
}
async function acquireBlockingWakeLock(){
  try{
    if(!('wakeLock' in navigator)||!navigator.wakeLock?.request)return null;
    const lock=await navigator.wakeLock.request('screen');BState.timeline.recordWakeLock=lock;
    lock.addEventListener?.('release',()=>{if(BState.timeline.recordWakeLock===lock)BState.timeline.recordWakeLock=null;});
    return lock;
  }catch(_error){return null}
}
async function releaseBlockingWakeLock(){
  const lock=BState.timeline.recordWakeLock;BState.timeline.recordWakeLock=null;
  if(!lock)return;try{await lock.release?.()}catch(_error){}
}
function preferredSceneRecordingMime(){
  if(typeof MediaRecorder==='undefined')return '';
  const candidates=['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/ogg;codecs=opus','audio/ogg'];
  return candidates.find(type=>{try{return !MediaRecorder.isTypeSupported||MediaRecorder.isTypeSupported(type)}catch(_error){return false}})||'';
}
async function startSceneAudioRecording(){
  if(isSongTimeline()){BRM.toast('Live dialogue recording belongs on a Scene timeline, not a song cue.','info');return;}
  if(BState.timeline.sceneRecorder){BRM.toast('A scene recording is already in progress.','warning');return;}
  if(!navigator.mediaDevices?.getUserMedia){BRM.toast('This browser does not support microphone recording. Use Upload Dialogue Audio instead.','error');return;}
  if(typeof MediaRecorder==='undefined'){BRM.toast('This browser does not support MediaRecorder. Use Upload Dialogue Audio instead.','error');return;}
  stopTimelinePlayback(false);
  let stream=null;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    const mimeType=preferredSceneRecordingMime();
    const options={audioBitsPerSecond:48000};if(mimeType)options.mimeType=mimeType;
    let recorder;try{recorder=new MediaRecorder(stream,options)}catch(_error){recorder=new MediaRecorder(stream)}
    const actualMime=String(recorder.mimeType||mimeType||'audio/webm');
    BState.timeline.recordChunks=[];BState.timeline.recordStream=stream;
    BState.timeline.sceneRecorder={recorder,state:'recording',startedAt:performance.now(),pausedMs:0,pausedAt:0,mimeType:actualMime};
    recorder.addEventListener('dataavailable',event=>{if(event.data&&event.data.size)BState.timeline.recordChunks.push(event.data)});
    recorder.addEventListener('error',event=>{
      const message=event?.error?.message||'The browser stopped the scene recording unexpectedly.';
      BRM.toast(message,'error');
    });
    recorder.start(1000);
    startSceneRecorderTicker();acquireBlockingWakeLock();refreshTimelineDock();
    BRM.toast(`Recording Scene ${BState.scene} dialogue…`,'success');
  }catch(error){
    stream?.getTracks?.().forEach(track=>track.stop());BState.timeline.recordStream=null;BState.timeline.sceneRecorder=null;BState.timeline.recordChunks=[];stopSceneRecorderTicker();await releaseBlockingWakeLock();
    const denied=String(error?.name||'').includes('NotAllowed')||String(error?.name||'').includes('Security');
    BRM.toast(denied?'Microphone access was not allowed. Enable microphone permission or use Upload Dialogue Audio.':'Could not start scene recording: '+(error?.message||String(error)),'error');
    refreshTimelineDock();
  }
}
function toggleSceneAudioPause(){const r=BState.timeline.sceneRecorder;if(!r)return;try{if(r.state==='recording'){r.recorder.pause();r.state='paused';r.pausedAt=performance.now()}else{r.recorder.resume();r.pausedMs+=performance.now()-r.pausedAt;r.pausedAt=0;r.state='recording'}refreshTimelineDock()}catch(e){BRM.toast(e.message,'error')}}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Could not prepare recording.'));reader.readAsDataURL(blob)})}
async function finishSceneRecorderResources(){stopSceneRecorderTicker();BState.timeline.recordStream?.getTracks?.().forEach(track=>track.stop());BState.timeline.recordStream=null;await releaseBlockingWakeLock()}
async function stopSceneAudioRecording(){const r=BState.timeline.sceneRecorder;if(!r)return;const duration=sceneRecordingElapsed();const recorder=r.recorder;const mime=r.mimeType;const chunks=BState.timeline.recordChunks;await new Promise(resolve=>{recorder.addEventListener('stop',resolve,{once:true});try{recorder.stop()}catch{resolve()}});await finishSceneRecorderResources();BState.timeline.sceneRecorder=null;const blob=new Blob(chunks,{type:mime||chunks[0]?.type||'audio/webm'});BState.timeline.recordChunks=[];if(!blob.size){refreshTimelineDock();BRM.toast('No audio was captured.','warning');return;}if(blob.size>BLOCKING_SCENE_AUDIO_LIMITS.recordingMaxBytes){refreshTimelineDock();BRM.toast('That recording is too large to upload safely. Save the scene in shorter sections or upload an optimized file.','error');return;}openSceneRecordingSaveModal(blob,duration);}
async function discardSceneAudioRecording(){const r=BState.timeline.sceneRecorder;if(!r)return;try{r.recorder.stop()}catch{}await finishSceneRecorderResources();BState.timeline.sceneRecorder=null;BState.timeline.recordChunks=[];refreshTimelineDock();BRM.toast('Scene recording discarded.','info')}
function openSceneRecordingSaveModal(blob,duration){
  const objectUrl=URL.createObjectURL(blob),defaultTitle=`Scene ${BState.scene} rehearsal dialogue`;
  openModal('Save Scene Recording',`<div class="blocking-source-note"><strong>${formatTimelineTime(duration)}</strong> captured · ${BRM.escape(formatBlockingBytes(blob.size))}. Saving it will make this audio the timing clock for Scene ${BState.scene}.</div><audio controls style="width:100%;margin:12px 0" src="${objectUrl}"></audio><div class="field"><label>Recording title</label><input data-scene-record-title value="${BRM.escape(defaultTitle)}"></div><p class="field-hint">Microphone recordings are already captured at a speech-friendly bitrate. The audio is stored privately in Scene Rehearsal Audio and remains linked to this scene until you choose another recording.</p><div class="blocking-audio-progress" data-scene-record-progress hidden><span data-scene-record-progress-bar></span></div><p class="field-hint" data-scene-record-status></p>`,`<button class="button button-secondary" data-scene-record-cancel>Discard</button><button class="button button-primary" data-scene-record-save>Save & Use</button>`);
  document.querySelector('[data-scene-record-cancel]').onclick=()=>{URL.revokeObjectURL(objectUrl);closeModal();refreshTimelineDock()};
  document.querySelector('[data-scene-record-save]').onclick=async()=>{
    if(BState.timeline.uploadingRecording)return;BState.timeline.uploadingRecording=true;
    const btn=document.querySelector('[data-scene-record-save]'),status=document.querySelector('[data-scene-record-status]'),progress=document.querySelector('[data-scene-record-progress]'),bar=document.querySelector('[data-scene-record-progress-bar]');btn.disabled=true;btn.textContent='Preparing…';progress.hidden=false;bar.style.width='15%';status.textContent='Preparing the recording for secure upload…';
    try{
      const dataUrl=await blobToDataUrl(blob);bar.style.width='55%';status.textContent='Uploading to the private production Drive…';btn.textContent='Uploading…';
      const title=document.querySelector('[data-scene-record-title]').value||defaultTitle;
      const recordMime=String(blob.type||'audio/webm').toLowerCase(),recordExt=recordMime.includes('mp4')?'m4a':recordMime.includes('ogg')?'ogg':'webm',recordFilename=title+'.'+recordExt;
      const r=await BRM.api('saveBlockingSceneRecording',{sceneNumber:BState.scene,cueNumber:'',title,durationSeconds:duration,filename:recordFilename,originalFilename:recordFilename,sourceType:'Recorded',originalByteLength:blob.size,storedByteLength:blob.size,optimizedForBlocking:true,originalMimeType:blob.type||'audio/webm',optimizationNote:'Browser voice recording · 48 kbps speech capture',dataUrl});
      bar.style.width='90%';status.textContent='Verifying the Drive file and linking it to Scene '+BState.scene+'…';
      BState.timeline.media=r.media;BState.timeline.duration=Number(r.media?.DurationSeconds)||duration;await loadSceneRecordingLibrary();BState.timeline.current=0;URL.revokeObjectURL(objectUrl);closeModal();refreshTimelineDock();await loadBlockingSceneAudio(r.media.FileID);BRM.toast('Scene recording saved to Drive and linked permanently to this scene.','success');
    }catch(e){BRM.toast('Recording upload failed: '+e.message,'error');status.textContent='Upload did not complete. Your recording remains open here so you can try again.';bar.style.width='0%';btn.disabled=false;btn.textContent='Save & Use'}finally{BState.timeline.uploadingRecording=false}
  };
}

function sceneAudioMimeFromFile(file){
  const type=String(file?.type||'').toLowerCase();
  const name=String(file?.name||'').toLowerCase();
  if(type.startsWith('audio/'))return type;
  if(name.endsWith('.mp3'))return 'audio/mpeg';
  if(name.endsWith('.m4a'))return 'audio/mp4';
  if(name.endsWith('.wav'))return 'audio/wav';
  if(name.endsWith('.aac'))return 'audio/aac';
  if(name.endsWith('.webm'))return 'audio/webm';
  if(name.endsWith('.ogg'))return 'audio/ogg';
  return '';
}
function sceneAudioFileAllowed(file){
  const mime=sceneAudioMimeFromFile(file);
  return ['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/wav','audio/x-wav','audio/wave','audio/aac','audio/webm','audio/ogg'].includes(mime);
}
function sceneAudioIsWave(file){const mime=sceneAudioMimeFromFile(file);return ['audio/wav','audio/x-wav','audio/wave'].includes(mime)||/\.wav$/i.test(String(file?.name||''))}
function sceneAudioIsAlreadyCompressed(file){return !sceneAudioIsWave(file)&&['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/webm','audio/ogg'].includes(sceneAudioMimeFromFile(file))}
function audioFileDuration(file){
  return new Promise((resolve,reject)=>{
    const mime=sceneAudioMimeFromFile(file),source=(file?.type&&String(file.type).startsWith('audio/'))?file:new Blob([file],{type:mime||'audio/mpeg'});
    const url=URL.createObjectURL(source),audio=document.createElement('audio');
    const clean=()=>{URL.revokeObjectURL(url);audio.removeAttribute('src');};
    const done=()=>{const d=Number(audio.duration);clean();Number.isFinite(d)&&d>0?resolve(d):reject(new Error('Duration could not be read.'));};
    const fail=()=>{clean();reject(new Error('This browser could not read the audio duration. You can enter it manually.'));};
    audio.preload='metadata';audio.addEventListener('loadedmetadata',done,{once:true});audio.addEventListener('error',fail,{once:true});audio.src=url;audio.load();
  });
}
function fileToAudioDataUrl(file,mime){const blob=file.type?file:new Blob([file],{type:mime});return blobToDataUrl(blob)}
function blockingSpeechProfile(durationSeconds,targetBytes=BLOCKING_SCENE_AUDIO_LIMITS.targetBytes){
  const duration=Math.max(.1,Number(durationSeconds)||1);
  const candidates=[];
  [16000,14000,12000,10000,8000,6000].forEach(rate=>[16,8].forEach(bits=>{
    const bytes=44+Math.ceil(duration*rate*(bits/8));
    const quality=rate*(bits===16?1.18:1);
    candidates.push({sampleRate:rate,bits,estimatedBytes:bytes,quality});
  }));
  const fitting=candidates.filter(p=>p.estimatedBytes<=targetBytes).sort((a,b)=>b.quality-a.quality);
  return fitting[0]||candidates.sort((a,b)=>a.estimatedBytes-b.estimatedBytes)[0];
}
function blockingAudioYield(){return new Promise(resolve=>requestAnimationFrame(()=>resolve()))}
function writeBlockingWavHeader(view,sampleRate,bits,frames){
  const bytesPerSample=bits/8,dataBytes=frames*bytesPerSample;
  const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};
  text(0,'RIFF');view.setUint32(4,36+dataBytes,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*bytesPerSample,true);view.setUint16(32,bytesPerSample,true);view.setUint16(34,bits,true);text(36,'data');view.setUint32(40,dataBytes,true);
}
async function encodeBlockingSpeechWav(audioBuffer,profile,onProgress){
  const rate=profile.sampleRate,bits=profile.bits,frames=Math.max(1,Math.floor(audioBuffer.duration*rate)),bytesPerSample=bits/8;
  const buffer=new ArrayBuffer(44+frames*bytesPerSample),view=new DataView(buffer);writeBlockingWavHeader(view,rate,bits,frames);
  const channels=Array.from({length:audioBuffer.numberOfChannels},(_,i)=>audioBuffer.getChannelData(i)),ratio=audioBuffer.sampleRate/rate;
  const chunk=120000;
  for(let start=0;start<frames;start+=chunk){
    const stop=Math.min(frames,start+chunk);
    for(let i=start;i<stop;i++){
      const src=Math.min(audioBuffer.length-1,Math.max(0,Math.round(i*ratio)));let sample=0;
      for(let c=0;c<channels.length;c++)sample+=channels[c][src]||0;sample=Math.max(-1,Math.min(1,sample/Math.max(1,channels.length)));
      if(bits===8)view.setUint8(44+i,Math.max(0,Math.min(255,Math.round((sample*.5+.5)*255))));
      else view.setInt16(44+i*2,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);
    }
    onProgress?.(Math.min(1,stop/frames));await blockingAudioYield();
  }
  return new Blob([buffer],{type:'audio/wav'});
}
async function decodeBlockingAudioFile(file){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('This browser cannot optimize audio. Try Chrome or Edge on a desktop computer.');
  const ctx=new AudioCtx();try{const bytes=await file.arrayBuffer();return await ctx.decodeAudioData(bytes.slice(0));}finally{try{await ctx.close()}catch{}}
}
async function prepareBlockingSceneAudio(file,smartOptimize,durationSeconds,onStatus,onProgress){
  if(file.size>BLOCKING_SCENE_AUDIO_LIMITS.sourceMaxBytes)throw new Error(`Choose a source file smaller than ${Math.round(BLOCKING_SCENE_AUDIO_LIMITS.sourceMaxBytes/1024/1024)} MB.`);
  const mime=sceneAudioMimeFromFile(file);if(!sceneAudioFileAllowed(file))throw new Error('Use MP3, M4A, WAV, AAC, WebM, or OGG audio.');
  let duration=Number(durationSeconds)||0;if(!(duration>0)){onStatus?.('Reading audio duration…');duration=await audioFileDuration(file)}
  const keepOriginal=()=>({blob:file,mimeType:mime,filename:file.name,originalFilename:file.name,originalMimeType:mime,originalByteLength:file.size,storedByteLength:file.size,durationSeconds:duration,optimized:false,note:'Original audio preserved'});
  if(!smartOptimize){if(file.size>BLOCKING_SCENE_AUDIO_LIMITS.finalMaxBytes)throw new Error(`This file is ${formatBlockingBytes(file.size)}. Turn on Smart Optimize so the browser can reduce it before upload.`);return keepOriginal()}
  if(sceneAudioIsAlreadyCompressed(file)&&file.size<=BLOCKING_SCENE_AUDIO_LIMITS.targetBytes){onStatus?.('This file is already compact. Keeping the original quality.');onProgress?.(.35);return keepOriginal()}
  onStatus?.('Decoding the source audio locally on this device…');onProgress?.(.08);
  let audioBuffer;try{audioBuffer=await decodeBlockingAudioFile(file)}catch(error){if(file.size<=BLOCKING_SCENE_AUDIO_LIMITS.finalMaxBytes){onStatus?.('Automatic optimization was unavailable, so the original compact file will be used.');return keepOriginal()}throw new Error('The browser could not optimize this large audio file: '+error.message)}
  duration=Number(audioBuffer.duration)||duration;const profile=blockingSpeechProfile(duration);
  if(profile.estimatedBytes>BLOCKING_SCENE_AUDIO_LIMITS.finalMaxBytes)throw new Error(`This recording is about ${Math.round(duration/60)} minutes long and cannot be reduced safely enough for one upload. Split it into two scene recordings.`);
  onStatus?.(`Speech optimizing locally · mono · ${Math.round(profile.sampleRate/1000)} kHz · ${profile.bits}-bit…`);
  const optimizedBlob=await encodeBlockingSpeechWav(audioBuffer,profile,p=>onProgress?.(.12+p*.58));
  if(optimizedBlob.size>BLOCKING_SCENE_AUDIO_LIMITS.finalMaxBytes)throw new Error('The optimized file is still too large. Split this scene recording into shorter parts.');
  if(optimizedBlob.size>=file.size&&file.size<=BLOCKING_SCENE_AUDIO_LIMITS.finalMaxBytes){onStatus?.('The original file is already smaller than the optimized copy, so the original will be used.');return keepOriginal()}
  const base=String(file.name||`scene-${BState.scene}`).replace(/\.[^.]+$/,'').replace(/[^a-z0-9 _.-]+/gi,'').trim()||`scene-${BState.scene}`;
  return {blob:optimizedBlob,mimeType:'audio/wav',filename:base+'-blocking-optimized.wav',originalFilename:file.name,originalMimeType:mime,originalByteLength:file.size,storedByteLength:optimizedBlob.size,durationSeconds:duration,optimized:true,note:`Speech optimized · mono · ${profile.sampleRate} Hz · ${profile.bits}-bit PCM`};
}
async function loadSceneRecordingLibrary(){
  if(isSongTimeline())return [];
  try{const r=await BRM.api('blockingSceneRecordings',{sceneNumber:BState.scene},{noCache:true,forceNetwork:true});BState.timeline.recordings=r?.recordings||[];return BState.timeline.recordings;}catch(e){console.warn(e);return BState.timeline.recordings||[]}
}
function setBlockingAudioProgress(progressEl,barEl,value){if(progressEl)progressEl.hidden=false;if(barEl)barEl.style.width=`${Math.max(0,Math.min(100,Math.round(Number(value||0)*100)))}%`}
function openSceneAudioUploadModal(){
  if(isSongTimeline()){BRM.toast('Scene audio uploads belong on the Scene / dialogue timeline.','info');return;}
  openModal('Upload Dialogue Audio',`<div class="blocking-object-help"><strong>Large dialogue recordings are welcome</strong><span>Choose MP3, M4A, WAV, AAC, WebM or OGG up to <strong>150 MB</strong>. Smart Optimize prepares large audio locally on this device before anything is uploaded, then stores the smaller blocking copy privately in Drive.</span></div><div class="form-grid"><div class="field field-full"><label>Audio file</label><input type="file" data-scene-upload-file accept=".mp3,.m4a,.wav,.aac,.webm,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/webm,audio/ogg" required></div><div class="field field-full"><label>Title</label><input data-scene-upload-title placeholder="Scene ${BState.scene} dialogue recording"></div><div class="field"><label>Duration (seconds)</label><input data-scene-upload-duration type="number" min="0.1" step="0.01" placeholder="Auto-detected"></div><div class="field"><label>Detected format</label><input data-scene-upload-format readonly value="—"></div><label class="checkbox-row field-full blocking-audio-optimize-toggle"><input type="checkbox" data-scene-upload-optimize checked><span><strong>Smart Optimize for Blocking</strong><small>Recommended. Keeps small compressed files as-is; reduces large/WAV recordings to speech-friendly mono audio before upload.</small></span></label></div><div class="blocking-audio-summary" data-scene-upload-summary hidden></div><div class="blocking-audio-progress" data-scene-upload-progress hidden><span data-scene-upload-progress-bar></span></div><p class="field-hint" data-scene-upload-help>Choose a file. Nothing is uploaded until you press Upload & Use.</p>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-scene-upload-save>Prepare, Upload & Use</button>`);
  document.querySelector('[data-modal-close]').onclick=closeModal;
  const input=document.querySelector('[data-scene-upload-file]'),title=document.querySelector('[data-scene-upload-title]'),duration=document.querySelector('[data-scene-upload-duration]'),format=document.querySelector('[data-scene-upload-format]'),help=document.querySelector('[data-scene-upload-help]'),optimize=document.querySelector('[data-scene-upload-optimize]'),summary=document.querySelector('[data-scene-upload-summary]'),progress=document.querySelector('[data-scene-upload-progress]'),bar=document.querySelector('[data-scene-upload-progress-bar]');
  const updatePreview=async()=>{
    const file=input.files?.[0];if(!file)return;const mime=sceneAudioMimeFromFile(file);format.value=mime||'Unknown';summary.hidden=true;progress.hidden=true;bar.style.width='0%';
    if(!title.value)title.value=file.name.replace(/\.[^.]+$/,'');
    if(!sceneAudioFileAllowed(file)){help.textContent='Unsupported file. Choose MP3, M4A, WAV, AAC, WebM, or OGG.';return;}
    if(file.size>BLOCKING_SCENE_AUDIO_LIMITS.sourceMaxBytes){help.textContent=`That source is larger than ${Math.round(BLOCKING_SCENE_AUDIO_LIMITS.sourceMaxBytes/1024/1024)} MB. Split the recording first.`;return;}
    help.textContent='Reading audio duration locally…';
    try{
      const d=await audioFileDuration(file);duration.value=d.toFixed(2);const smart=optimize.checked;let estimate=file.size,note='Original file will be stored.';
      if(smart&&(sceneAudioIsWave(file)||file.size>BLOCKING_SCENE_AUDIO_LIMITS.targetBytes)){const profile=blockingSpeechProfile(d);estimate=profile.estimatedBytes;note=`Estimated blocking copy: ${formatBlockingBytes(estimate)} · mono · ${Math.round(profile.sampleRate/1000)} kHz · ${profile.bits}-bit`;}
      else if(smart)note='Already compact — Smart Optimize will preserve the original file.';
      summary.hidden=false;summary.innerHTML=`<span><strong>Source</strong>${BRM.escape(formatBlockingBytes(file.size))}</span><span><strong>Length</strong>${BRM.escape(formatTimelineTime(d))}</span><span><strong>Plan</strong>${BRM.escape(note)}</span>`;help.textContent='Ready. Preparation happens locally first; only the prepared audio is uploaded.';
    }catch(e){help.textContent=e.message}
  };
  input.addEventListener('change',updatePreview);optimize.addEventListener('change',updatePreview);
  document.querySelector('[data-scene-upload-save]').onclick=async()=>{
    const file=input.files?.[0];if(!file){BRM.toast('Choose an audio file first.','warning');return;}if(!sceneAudioFileAllowed(file)){BRM.toast('Use MP3, M4A, WAV, AAC, WebM, or OGG audio.','error');return;}if(file.size>BLOCKING_SCENE_AUDIO_LIMITS.sourceMaxBytes){BRM.toast('That source file is larger than 150 MB.','error');return;}
    let seconds=Number(duration.value||0);const btn=document.querySelector('[data-scene-upload-save]');btn.disabled=true;input.disabled=true;optimize.disabled=true;btn.textContent='Preparing…';
    try{
      const prepared=await prepareBlockingSceneAudio(file,optimize.checked,seconds,msg=>{help.textContent=msg},value=>setBlockingAudioProgress(progress,bar,value));seconds=prepared.durationSeconds;duration.value=seconds.toFixed(2);
      summary.hidden=false;summary.innerHTML=`<span><strong>Original</strong>${BRM.escape(formatBlockingBytes(prepared.originalByteLength))}</span><span><strong>Stored copy</strong>${BRM.escape(formatBlockingBytes(prepared.storedByteLength))}</span><span><strong>Preparation</strong>${BRM.escape(prepared.optimized?prepared.note:'Original quality preserved')}</span>`;
      setBlockingAudioProgress(progress,bar,.74);help.textContent='Preparing secure upload…';btn.textContent='Preparing upload…';
      const dataUrl=await blobToDataUrl(prepared.blob);setBlockingAudioProgress(progress,bar,.84);help.textContent='Uploading the prepared audio to the private production Drive…';btn.textContent='Uploading…';
      const uploadTitle=title.value.trim()||file.name.replace(/\.[^.]+$/,'');
      const r=await BRM.api('saveBlockingSceneRecording',{sceneNumber:BState.scene,cueNumber:'',title:uploadTitle,durationSeconds:seconds,filename:prepared.filename,originalFilename:prepared.originalFilename,sourceType:'Upload',originalByteLength:prepared.originalByteLength,storedByteLength:prepared.storedByteLength,optimizedForBlocking:prepared.optimized,originalMimeType:prepared.originalMimeType,optimizationNote:prepared.note,dataUrl});
      setBlockingAudioProgress(progress,bar,.96);help.textContent='Drive upload complete. Verifying and linking the recording to this scene…';
      BState.timeline.media=r.media;BState.timeline.duration=Number(r.media?.DurationSeconds)||seconds;BState.timeline.current=0;await loadSceneRecordingLibrary();setBlockingAudioProgress(progress,bar,1);closeModal();refreshTimelineDock();await loadBlockingSceneAudio(r.media.FileID);BRM.toast(prepared.optimized?'Dialogue audio optimized, saved to Drive, and linked to this scene.':'Dialogue audio saved to Drive and linked to this scene.','success');
    }catch(e){BRM.toast('Audio upload failed: '+e.message,'error');help.textContent='Nothing was linked. Your chosen file is still here — adjust the option or try again.';setBlockingAudioProgress(progress,bar,0);btn.disabled=false;input.disabled=false;optimize.disabled=false;btn.textContent='Prepare, Upload & Use';}
  };
}

async function useSelectedSavedSceneRecording(){
  const recordingId=document.querySelector('[data-scene-saved-select]')?.value;
  if(!recordingId){BRM.toast('Choose a saved recording first.','warning');return;}
  try{
    stopTimelinePlayback(false);
    const r=await BRM.api('useBlockingSceneRecording',{sceneNumber:BState.scene,recordingId});
    BState.timeline.media=r.media;BState.timeline.duration=Number(r.media?.DurationSeconds)||BState.timeline.duration;BState.timeline.current=0;
    refreshTimelineDock();await loadBlockingSceneAudio(r.media.FileID);BRM.toast('Saved recording is now the timing audio for this scene.','success');
  }catch(e){BRM.toast('Could not use that recording: '+e.message,'error')}
}

function openTimelineDialogueModal(){const now=timelineCurrentTime();openModal('Dialogue Cue',`<div class="blocking-source-note"><strong>${formatTimelineTime(now)}</strong> — add the spoken line or cue word you want visible on the scene timeline.</div><div class="form-grid"><div class="field"><label>Time</label><input data-dialogue-time type="number" min="0" step="0.05" value="${now.toFixed(2)}"></div><div class="field"><label>Speaker</label><input data-dialogue-speaker placeholder="MAL, BEN, BEAST…"></div><div class="field field-full"><label>Spoken dialogue / cue</label><textarea data-dialogue-text maxlength="700" placeholder="Enter the line, phrase, or short cue reference"></textarea></div><div class="field field-full"><label>Blocking note</label><textarea data-dialogue-notes placeholder="Cross on this line, stair entrance, prop handoff…"></textarea></div></div>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-save-dialogue>Save Dialogue Cue</button>`);document.querySelector('[data-modal-close]').onclick=closeModal;document.querySelector('[data-save-dialogue]').onclick=()=>{const speaker=document.querySelector('[data-dialogue-speaker]').value||'',text=document.querySelector('[data-dialogue-text]').value||'';if(!text.trim()){BRM.toast('Enter the spoken line or cue.','warning');return;}BState.timeline.markers.push({TimeSeconds:Number(document.querySelector('[data-dialogue-time]').value)||0,Label:text.slice(0,180),MarkerType:'Dialogue',Speaker:speaker,DialogueText:text,Measure:'',CountLabel:'',Notes:document.querySelector('[data-dialogue-notes]').value||''});BState.timeline.markers.sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));closeModal();refreshTimelineDock();saveTimeline(false)}}

function captureFormationKeyframe(){
  if(!canEdit())return;const time=snapBedfordBeatTime(timelineCurrentTime()),title=`Formation @ ${formatTimelineTime(time)}`;const state=formationState();
  const existing=BState.timeline.keyframes.find(k=>Math.abs(Number(k.TimeSeconds)-time)<.12);if(existing){existing.TimeSeconds=time;existing.Title=title;existing._state=state;existing.StateJSON=JSON.stringify(state);}else BState.timeline.keyframes.push({TimeSeconds:time,Title:title,_state:state,StateJSON:JSON.stringify(state)});
  BState.timeline.keyframes.sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));refreshTimelineDock();renderTimelinePaths();saveTimeline(false);BRM.toast('Formation captured at '+formatTimelineTime(time)+'.','success');
}
function openTimelineMarkerModal(){
  const now=snapBedfordBeatTime(timelineCurrentTime());openModal('Timeline Marker',`<div class="form-grid"><div class="field"><label>Time</label><input data-marker-time type="number" min="0" step="0.05" value="${now.toFixed(2)}"></div><div class="field"><label>Label</label><input data-marker-label value="Blocking cue"></div><div class="field"><label>Measure</label><input data-marker-measure></div><div class="field"><label>Count</label><input data-marker-count placeholder="e.g. 5-6-7-8"></div><div class="field field-full"><label>Notes</label><textarea data-marker-notes></textarea></div></div>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-save-marker>Save Marker</button>`);
  document.querySelector('[data-modal-close]').onclick=closeModal;document.querySelector('[data-save-marker]').onclick=()=>{BState.timeline.markers.push({TimeSeconds:Number(document.querySelector('[data-marker-time]').value)||0,Label:document.querySelector('[data-marker-label]').value||'Marker',MarkerType:'Blocking',Measure:document.querySelector('[data-marker-measure]').value||'',CountLabel:document.querySelector('[data-marker-count]').value||'',Notes:document.querySelector('[data-marker-notes]').value||''});BState.timeline.markers.sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));closeModal();refreshTimelineDock();saveTimeline(false);};
}
function openTraceSelectedModal(){
  const ent=selectedTimelineEntity();if(!ent){BRM.toast('Select a performer, prop, furniture item, or set piece first.','warning');return;}
  const start=timelineCurrentTime(),end=Math.min(timelineDuration(),start+8);openModal('Trace Path — '+ent.Label,`<div class="blocking-object-help"><strong>Draw the route directly on the Bedford map.</strong><span>The program will preserve the curve and distribute the movement across this time range. You can create as many independent character/object paths as needed.</span></div><div class="form-grid"><div class="field"><label>Start time</label><input data-trace-start type="number" min="0" step="0.05" value="${start.toFixed(2)}"></div><div class="field"><label>End time</label><input data-trace-end type="number" min="0" step="0.05" value="${end.toFixed(2)}"></div></div>`,`<button class="button button-secondary" data-modal-close>Cancel</button><button class="button button-primary" data-arm-trace>Trace Route</button>`);
  document.querySelector('[data-modal-close]').onclick=closeModal;document.querySelector('[data-arm-trace]').onclick=()=>{const a=Number(document.querySelector('[data-trace-start]').value)||0,b=Number(document.querySelector('[data-trace-end]').value)||a+1;if(b<=a){BRM.toast('End time must be after start time.','warning');return;}closeModal();BState.timeline.trace={...ent,start:a,end:b,points:[],armed:true,drawing:false};const banner=document.querySelector('[data-trace-banner]');if(banner)banner.hidden=false;const copy=document.querySelector('[data-trace-copy]');if(copy)copy.textContent=`${ent.Label}: drag freehand from ${formatTimelineTime(a)} to ${formatTimelineTime(b)}.`;renderTimelinePaths();};
}
function stageLogicalPointer(){if(!BState.stage)return null;const p=BState.stage.getPointerPosition(),s=BState.stage.scaleX()||1;if(!p)return null;return {x:Math.max(0,Math.min(LOGICAL_W,p.x/s)),y:Math.max(0,Math.min(LOGICAL_H,p.y/s))}}
function beginTimelineTrace(){const tr=BState.timeline.trace,p=stageLogicalPointer();if(!tr||!p)return;tr.drawing=true;tr.armed=false;tr.points=[[p.x,p.y]];renderTimelineTracePreview();}
function continueTimelineTrace(){const tr=BState.timeline.trace,p=stageLogicalPointer();if(!tr?.drawing||!p)return;const last=tr.points[tr.points.length-1];if(Math.hypot(p.x-last[0],p.y-last[1])>=5){tr.points.push([p.x,p.y]);renderTimelineTracePreview();}}
function simplifyTimelinePoints(points,max=260){if(points.length<=max)return points;const step=(points.length-1)/(max-1),out=[];for(let i=0;i<max;i++)out.push(points[Math.min(points.length-1,Math.round(i*step))]);return out}
function finishTimelineTrace(){
  const tr=BState.timeline.trace;if(!tr?.drawing)return;tr.drawing=false;const pts=simplifyTimelinePoints(tr.points||[]);if(pts.length<2){cancelTimelineTrace();return;}
  const path=pts.map((p,i)=>({t:tr.start+(tr.end-tr.start)*(i/Math.max(1,pts.length-1)),x:p[0]/LOGICAL_W*100,y:p[1]/LOGICAL_H*100}));
  BState.timeline.motions.push({EntityType:tr.EntityType,EntityKey:tr.EntityKey,Label:tr.Label,MotionType:'Trace',StartSeconds:tr.start,EndSeconds:tr.end,_path:path,PathJSON:JSON.stringify(path),Easing:'linear'});BState.timeline.trace=null;const banner=document.querySelector('[data-trace-banner]');if(banner)banner.hidden=true;BState.layers.preview?.destroyChildren();BState.layers.preview?.draw();refreshTimelineDock();renderTimelinePaths();saveTimeline(false);BRM.toast('Traced route saved to the timeline.','success');
}
function cancelTimelineTrace(){BState.timeline.trace=null;const banner=document.querySelector('[data-trace-banner]');if(banner)banner.hidden=true;BState.layers.preview?.destroyChildren();BState.layers.preview?.draw();renderTimelinePaths();}
function renderTimelineTracePreview(){const l=BState.layers.preview,tr=BState.timeline.trace;if(!l)return;l.destroyChildren();if(tr?.points?.length>1)l.add(new Konva.Line({points:tr.points.flat(),stroke:'#38bdf8',strokeWidth:5,lineCap:'round',lineJoin:'round',dash:[10,5],listening:false}));l.draw();}
async function startSelectedDragRecording(){
  const ent=selectedTimelineEntity();if(!ent){BRM.toast('Select the performer or object you want to record.','warning');return;}if(BState.timeline.recording)stopSelectedDragRecording();
  BState.timeline.recording={...ent,start:timelineCurrentTime(),samples:[{t:timelineCurrentTime(),x:ent.x,y:ent.y}]};if(!BState.timeline.playing)await startTimelinePlayback();refreshTimelineDock();
}
function recordTimelineSample(type,key,label,x,y,force){const r=BState.timeline.recording;if(!r||r.EntityKey!==key)return;const now=timelineCurrentTime(),last=r.samples[r.samples.length-1];if(!force&&last&&now-last.t<.035&&Math.hypot(x-last.x,y-last.y)<.25)return;r.samples.push({t:now,x:Number(x),y:Number(y)});}
function stopSelectedDragRecording(){
  const r=BState.timeline.recording;if(!r)return;const end=timelineCurrentTime();if(r.samples.length<2)r.samples.push({t:end,x:r.x,y:r.y});const path=simplifyTimelinePoints(r.samples,300);BState.timeline.motions.push({EntityType:r.EntityType,EntityKey:r.EntityKey,Label:r.Label,MotionType:'Recorded Drag',StartSeconds:r.start,EndSeconds:Math.max(r.start+.05,end),_path:path,PathJSON:JSON.stringify(path),Easing:'linear'});BState.timeline.recording=null;refreshTimelineDock();renderTimelinePaths();saveTimeline(false);BRM.toast('Recorded movement added.','success');
}
function deleteTimelineEvent(spec){const [kind,indexRaw]=String(spec).split(':'),i=Number(indexRaw);if(kind==='marker')BState.timeline.markers.splice(i,1);if(kind==='keyframe')BState.timeline.keyframes.splice(i,1);if(kind==='motion')BState.timeline.motions.splice(i,1);BState.save.timelineDirty=true;updateBlockingSaveStatus();refreshTimelineDock();renderTimelinePaths();saveTimeline(false);}
function timelineSavePayload(saveMode='autosave'){
  const musicMap={...BState.musicMap,taps:[],waveform:[],waveformKey:'',saveTimer:0};return {sceneNumber:BState.scene,cueNumber:BState.cue||'',saveMode,media:BState.timeline.media,musicMap,referenceMedia:BState.visualViewer.referenceMedia||null,markers:BState.timeline.markers.map(({_row,...m})=>m),keyframes:BState.timeline.keyframes.map(k=>({...k,StateJSON:k.StateJSON||JSON.stringify(k._state||{})})),motions:BState.timeline.motions.map(m=>({...m,PathJSON:m.PathJSON||JSON.stringify(m._path||[])}))};
}
function timelinePayloadSignature(){try{return JSON.stringify(timelineSavePayload('autosave'))}catch{return String(Date.now())}}
function saveTimeline(showToast=false){
  if(!canEdit())return Promise.resolve(true);
  const t=BState.timeline;
  t.pendingSave=true;
  t.manualSaveRequested=t.manualSaveRequested||!!showToast;
  BState.save.timelineDirty=true;
  BState.save.lastError='';
  updateBlockingSaveStatus();
  if(t.savePromise)return t.savePromise;
  t.savePromise=(async()=>{
    let success=true;
    while(t.pendingSave){
      const manual=!!t.manualSaveRequested;
      t.pendingSave=false;
      t.manualSaveRequested=false;
      t.saving=true;
      updateBlockingSaveStatus();
      const payload=timelineSavePayload(manual?'manual':'autosave');
      const comparableSignature=JSON.stringify({...payload,saveMode:'autosave'});
      try{
        const r=await BRM.api('saveBlockingTimeline',payload);
        if(!r?.saveVerification?.verified)throw new Error('The server did not verify the timeline write.');
        const changed=timelinePayloadSignature()!==comparableSignature;
        if(!changed&&!t.pendingSave){
          t.media=r.media||t.media;
          t.markers=r.markers||t.markers;
          t.keyframes=(r.keyframes||t.keyframes).map(k=>({...k,_state:safeStateJSON(k.StateJSON)}));
          t.motions=(r.motions||t.motions).map(m=>({...m,_path:safePathJSON(m.PathJSON)}));
          BState.save.timelineDirty=false;
        }else{
          t.pendingSave=true;
          BState.save.timelineDirty=true;
        }
        BState.save.lastSavedAt=new Date();
        BState.save.lastError='';cacheCurrentTimeline();
      }catch(e){
        success=false;
        BState.save.timelineDirty=true;
        BState.save.lastError=`Timeline save failed: ${e.message}`;
        BRM.toast(BState.save.lastError,'error');
        break;
      }finally{
        t.saving=false;
        updateBlockingSaveStatus();
        refreshTimelineDock();
        renderTimelinePaths();
      }
    }
    if(showToast&&success)BRM.toast('Blocking timeline saved.','success');
    return success;
  })().finally(()=>{
    t.saving=false;
    t.savePromise=null;
    updateBlockingSaveStatus();
  });
  return t.savePromise;
}
function entityBasePosition(key){if(key.startsWith('cast:')){const id=key.slice(5),p=BState.placements.find(x=>String(x.BlockingCastID)===String(id));return p?{x:Number(p.XPercent),y:Number(p.YPercent)}:null}if(key.startsWith('obj:')){const id=key.slice(4),o=BState.objects.find(x=>String(x.TimelineKey)===String(id));return o?{x:Number(o.XPercent),y:Number(o.YPercent),rotation:Number(o.Rotation||0)}:null}return null}
function stateEntity(k,key){const st=k._state||safeStateJSON(k.StateJSON);return (st.entities||[]).find(e=>String(e.key)===String(key))}
function pathPosition(path,t){const pts=path||[];if(!pts.length)return null;if(t<=Number(pts[0].t))return {x:Number(pts[0].x),y:Number(pts[0].y)};if(t>=Number(pts[pts.length-1].t))return {x:Number(pts[pts.length-1].x),y:Number(pts[pts.length-1].y)};for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(t<=Number(b.t)){const span=Math.max(.001,Number(b.t)-Number(a.t)),u=(t-Number(a.t))/span;return {x:Number(a.x)+(Number(b.x)-Number(a.x))*u,y:Number(a.y)+(Number(b.y)-Number(a.y))*u}}}return null}
function timelinePositionForEntity(key,t){
  const motions=(BState.timeline.motions||[]).filter(m=>String(m.EntityKey)===String(key)&&t>=Number(m.StartSeconds)-.001&&t<=Number(m.EndSeconds)+.001);if(motions.length){const m=motions[motions.length-1],pos=pathPosition(m._path||safePathJSON(m.PathJSON),t);if(pos)return pos;}
  const frames=(BState.timeline.keyframes||[]).filter(k=>stateEntity(k,key)).sort((a,b)=>Number(a.TimeSeconds)-Number(b.TimeSeconds));if(!frames.length)return entityBasePosition(key);
  let prev=null,next=null;for(const f of frames){if(Number(f.TimeSeconds)<=t)prev=f;if(Number(f.TimeSeconds)>=t){next=f;break}}
  prev=prev||frames[0];next=next||frames[frames.length-1];const a=stateEntity(prev,key),b=stateEntity(next,key);if(!a&&!b)return entityBasePosition(key);if(!b||prev===next)return {x:Number(a.x),y:Number(a.y),rotation:Number(a.rotation||0)};if(!a)return {x:Number(b.x),y:Number(b.y),rotation:Number(b.rotation||0)};const span=Math.max(.001,Number(next.TimeSeconds)-Number(prev.TimeSeconds)),u=Math.max(0,Math.min(1,(t-Number(prev.TimeSeconds))/span));return {x:Number(a.x)+(Number(b.x)-Number(a.x))*u,y:Number(a.y)+(Number(b.y)-Number(a.y))*u,rotation:Number(a.rotation||0)+(Number(b.rotation||0)-Number(a.rotation||0))*u};
}
function positionTimelineAt(t){
  if(!BState.stage)return;(BState.placements||[]).forEach(p=>{const node=BState.tokenNodes.get(p._localId),pos=timelinePositionForEntity('cast:'+p.BlockingCastID,t);if(node&&pos)node.position({x:pos.x/100*LOGICAL_W,y:pos.y/100*LOGICAL_H});});
  (BState.objects||[]).forEach(o=>{const node=BState.objectNodes.get(o._localId),pos=timelinePositionForEntity(objectEntityKey(o),t);if(node&&pos){node.position({x:pos.x/100*LOGICAL_W,y:pos.y/100*LOGICAL_H});if(Number.isFinite(pos.rotation))node.rotation(pos.rotation);}});BState.layers.tokens?.batchDraw();BState.layers.objects?.batchDraw();refreshBedfordSplitViewer();refreshBedfordCombined2D();renderBedford3D();syncBedfordReferenceVideo();
}
function renderTimelinePaths(){
  const l=BState.layers.timeline;if(!l)return;l.destroyChildren();if(BState.timeline.showPaths===false){l.draw();return;}const sel=selectedTimelineEntity(),now=timelineCurrentTime();
  (BState.timeline.motions||[]).forEach(m=>{const path=m._path||safePathJSON(m.PathJSON);if(path.length<2)return;const selected=sel&&String(sel.EntityKey)===String(m.EntityKey),active=now>=Number(m.StartSeconds)-.25&&now<=Number(m.EndSeconds)+.25;if(BState.stageEditing.contextPaths&&!selected&&!active)return;const points=path.flatMap(p=>[Number(p.x)/100*LOGICAL_W,Number(p.y)/100*LOGICAL_H]);let hash=0;for(const c of String(m.EntityKey))hash=(hash*31+c.charCodeAt(0))>>>0;const colors=['#38bdf8','#fb7185','#a78bfa','#34d399','#fbbf24','#f472b6','#22d3ee','#fb923c'],color=colors[hash%colors.length];l.add(new Konva.Line({points,stroke:color,strokeWidth:selected?5:3,lineCap:'round',lineJoin:'round',dash:selected?[]:[9,7],opacity:selected?1:.7,listening:false}));if(selected){const first=path[0],last=path[path.length-1];l.add(new Konva.Circle({x:first.x/100*LOGICAL_W,y:first.y/100*LOGICAL_H,radius:7,fill:'#22c55e',listening:false}));l.add(new Konva.Circle({x:last.x/100*LOGICAL_W,y:last.y/100*LOGICAL_H,radius:7,fill:'#fb7185',listening:false}));}});l.draw();
}
function openStageElementModal(){
  openModal('Add Stage Element',`<div class="blocking-object-help"><strong>Create the thing you actually mean</strong><span>No automatic labelled rectangle. Choose a stage element first; you can change its visual style and text independently afterward.</span></div><div class="blocking-add-grid">
    <button class="blocking-add-choice" data-element-kind="Set Piece"><span class="blocking-add-choice-icon">▰</span><strong>Set Piece</strong><small>Platform, wall, wagon, scenic unit</small></button>
    <button class="blocking-add-choice" data-element-kind="Furniture"><span class="blocking-add-choice-icon">▱</span><strong>Furniture</strong><small>Table, desk, chair, bench</small></button>
    <button class="blocking-add-choice" data-element-kind="Prop"><span class="blocking-add-choice-icon">●</span><strong>Prop</strong><small>Hand prop or small tracked object</small></button>
    <button class="blocking-add-choice" data-element-kind="Zone"><span class="blocking-add-choice-icon">◇</span><strong>Zone</strong><small>Playing area, dance area, hold zone</small></button>
    <button class="blocking-add-choice" data-element-kind="Entrance"><span class="blocking-add-choice-icon">↦</span><strong>Entrance / Exit</strong><small>Mark a doorway, aisle, or access point</small></button>
    <button class="blocking-add-choice" data-element-kind="Spike"><span class="blocking-add-choice-icon">✚</span><strong>Spike / Mark</strong><small>Precise position marker</small></button>
    <button class="blocking-add-choice" data-element-kind="Text Note"><span class="blocking-add-choice-icon">T</span><strong>Text Only</strong><small>Words with no shape behind them</small></button>
    <button class="blocking-add-choice" data-element-kind="Custom"><span class="blocking-add-choice-icon">✦</span><strong>Custom Shape</strong><small>Draw the exact outline yourself</small></button>
  </div>`,`<button class="button button-secondary" data-cancel>Close</button>`);
  document.querySelector('[data-cancel]').onclick=closeModal;
  document.querySelectorAll('[data-element-kind]').forEach(b=>b.onclick=()=>{const kind=b.dataset.elementKind;closeModal();
    if(kind==='Custom'){startCustomShape();return;}
    if(kind==='Text Note'){addShapePreset('Text','Text Note','Text',{LabelVisible:true,TextSize:18,LabelBackground:false});return;}
    if(kind==='Prop'){addShapePreset('Marker','Prop','Prop',{LabelVisible:true,LabelPosition:'Below',FillColor:'#f8b918'});return;}
    if(kind==='Entrance'){addShapePreset('Marker','Entrance','Entrance',{LabelVisible:true,LabelPosition:'Below',FillColor:'#38bdf8'});return;}
    if(kind==='Spike'){addShapePreset('Marker','Spike','Spike',{LabelVisible:false,FillColor:'#fb7185'});return;}
    openElementShapeModal(kind);
  });
}
function openElementShapeModal(kind){
  openModal(`Add ${kind}`,`<div class="blocking-object-help"><strong>Choose its footprint</strong><span>The name is optional and does not need a box behind it.</span></div><div class="blocking-shape-picker"><button class="blocking-shape-choice" data-element-shape="Rectangle"><span class="shape-icon rectangle"></span><strong>Rectangle</strong><small>Most scenery & furniture</small></button><button class="blocking-shape-choice" data-element-shape="Square"><span class="shape-icon square"></span><strong>Square</strong><small>Equal-sided footprint</small></button><button class="blocking-shape-choice" data-element-shape="Triangle"><span class="shape-icon triangle"></span><strong>Triangle</strong><small>Three-sided footprint</small></button><button class="blocking-shape-choice" data-element-shape="Custom"><span class="shape-icon custom">✦</span><strong>Draw custom</strong><small>Trace the actual outline</small></button></div>`,`<button class="button button-secondary" data-cancel>Back</button>`);
  document.querySelector('[data-cancel]').onclick=()=>{closeModal();openStageElementModal()};
  document.querySelectorAll('[data-element-shape]').forEach(b=>b.onclick=()=>{const shape=b.dataset.elementShape;closeModal();if(shape==='Custom'){startCustomShape(kind);return;}const opts=kind==='Zone'?{LabelVisible:false,FillOpacity:.20,FillColor:'#38bdf8'}:{LabelVisible:false};addShapePreset(shape,kind,kind,opts);});
}
function openShapeModal(){openModal('Add Scenic Shape',`<div class="blocking-shape-picker"><button class="blocking-shape-choice" data-shape-choice="Square"><span class="shape-icon square"></span><strong>Square</strong><small>Four equal sides</small></button><button class="blocking-shape-choice" data-shape-choice="Rectangle"><span class="shape-icon rectangle"></span><strong>Rectangle</strong><small>Resizable scenic area</small></button><button class="blocking-shape-choice" data-shape-choice="Triangle"><span class="shape-icon triangle"></span><strong>Triangle</strong><small>Three editable edges</small></button><button class="blocking-shape-choice" data-shape-choice="Custom"><span class="shape-icon custom">✦</span><strong>Draw custom</strong><small>Click each corner yourself</small></button></div>`,`<button class="button button-secondary" data-cancel>Close</button>`);document.querySelector('[data-cancel]').onclick=closeModal;document.querySelectorAll('[data-shape-choice]').forEach(b=>b.onclick=()=>{const type=b.dataset.shapeChoice;closeModal();if(type==='Custom')startCustomShape('Zone');else addShapePreset(type,'Zone',type,{LabelVisible:false});});}
function startCustomShape(objectType='Zone'){if(!canEdit())return;BState.drawingShape={points:[],objectType};BState.selected=null;updateDrawBanner();renderDrawingPreview();BRM.toast('Custom shape: click each corner. Double-click or press Enter to finish.','info')}
function updateDrawBanner(){const b=document.querySelector('[data-draw-banner]');if(!b)return;b.hidden=!BState.drawingShape;if(BState.drawingShape){const span=b.querySelector('span');if(span)span.textContent=`${BState.drawingShape.points.length} point${BState.drawingShape.points.length===1?'':'s'} · click or tap each corner`;}}
function renderDrawingPreview(){const l=BState.layers.preview;if(!l)return;l.destroyChildren();if(!BState.drawingShape){l.draw();return;}const pts=BState.drawingShape.points;if(pts.length){l.add(new Konva.Line({points:flatPoints(pts),stroke:'#38bdf8',strokeWidth:4,dash:[10,6],closed:false,listening:false}));pts.forEach((p,i)=>l.add(new Konva.Circle({x:p[0],y:p[1],radius:i===0?9:7,fill:i===0?'#f8b918':'#fff',stroke:'#111827',strokeWidth:2,listening:false})));}l.draw();updateDrawBanner();}
function finishCustomShape(){if(!BState.drawingShape)return;const pts=BState.drawingShape.points;if(pts.length<3){BRM.toast('A custom shape needs at least 3 points.','error');return;}pushUndo();const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,local=pts.map(p=>[p[0]-cx,p[1]-cy]);const o=createShapeObject('Custom',BState.drawingShape.objectType||'Zone',BState.drawingShape.objectType||'Custom Shape',{LabelVisible:false});o.XPercent=cx/LOGICAL_W*100;o.YPercent=cy/LOGICAL_H*100;setShapePoints(o,local);setEdgeColors(o,Array(local.length).fill('#f8b918'));BState.objects.push(o);BState.drawingShape=null;BState.selected={kind:'object',id:o._localId};renderDrawingPreview();renderObjects();updateCount();refreshRight();updateDrawBanner();}
function cancelCustomShape(){BState.drawingShape=null;renderDrawingPreview();updateDrawBanner();}
async function toggleStudioFullscreen(){const w=studioWorkspace();if(!w)return;if(document.fullscreenElement===w){await document.exitFullscreen?.();return;}if(w.classList.contains('blocking-faux-fullscreen')){w.classList.remove('blocking-faux-fullscreen');BState.fauxFullscreen=false;document.documentElement.classList.remove('blocking-no-scroll');updateFullscreenButton();resizeStage();return;}try{if(w.requestFullscreen){await w.requestFullscreen();}else throw new Error('Fullscreen API unavailable');}catch{w.classList.add('blocking-faux-fullscreen');BState.fauxFullscreen=true;document.documentElement.classList.add('blocking-no-scroll');updateFullscreenButton();resizeStage();}}
function updateFullscreenButton(){const b=document.querySelector('[data-fullscreen]');if(b)b.textContent=isStudioFullscreen()?'⛶ Exit Full Screen':'⛶ Full Screen';setTimeout(resizeStage,30)}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.documentElement.classList.remove('blocking-no-scroll');BState.fauxFullscreen=false;}updateFullscreenButton()});

function blockingModalHost(){const w=studioWorkspace();return (w&&(document.fullscreenElement===w||w.classList.contains('blocking-faux-fullscreen')))?w:document.body}
function openModal(title,body,actions=''){closeModal();const host=blockingModalHost();host.insertAdjacentHTML('beforeend',`<div class="blocking-modal-backdrop" data-blocking-modal><div class="blocking-modal"><div class="blocking-modal-head"><strong>${BRM.escape(title)}</strong><button class="button button-secondary button-small" data-close-modal>×</button></div><div class="blocking-modal-body">${body}</div>${actions?`<div class="blocking-modal-actions">${actions}</div>`:''}</div></div>`);const modal=host.querySelector('[data-blocking-modal]');modal.querySelector('[data-close-modal]').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});if(title==='Manage Blocking Cast')enhanceCastAssignmentForm();}
function closeModal(){document.querySelector('[data-blocking-modal]')?.remove()}
function openSnapshotModal(){const anchors=anchorsForContext(),bgs=(BState.data.backgrounds||[]).filter(b=>!b.SceneNumber||Number(b.SceneNumber)===Number(BState.scene));openModal('New Blocking Snapshot',`<form data-snapshot-form><div class="form-grid"><div class="field span-2"><label>Snapshot title</label><input name="title" required placeholder="e.g. Opening picture"></div><div class="field"><label>Type</label><select name="snapshotType">${['Actor Blocking','Choreography','Scenic Transition','Crew Traffic','Prop Movement','Picture/Tableau'].map(v=>`<option>${v}</option>`).join('')}</select></div><div class="field"><label>Cue</label><select name="cueNumber"><option value="">Scene / dialogue</option>${(BState.data.cues||[]).filter(c=>Number(c.SceneNumber)===Number(BState.scene)).map(c=>`<option value="${c.CueNumber}" ${String(BState.cue)===String(c.CueNumber)?'selected':''}>#${c.CueNumber} ${BRM.escape(c.Title)}</option>`).join('')}</select></div><div class="field span-2"><label>Attach to script/cue anchor</label><select name="anchorId"><option value="">No exact anchor yet</option>${anchors.map(a=>`<option value="${a.AnchorID}">${BRM.escape(a.TextSnippet)}</option>`).join('')}</select></div><div class="field span-2"><label>Background / ground plan</label><select name="backgroundId"><option value="">Default stage grid</option>${bgs.map(b=>`<option value="${b.BackgroundID}">${BRM.escape(b.Title)}</option>`).join('')}</select></div><div class="field span-2"><label>Notes</label><textarea name="notes" placeholder="Purpose, staging note, rehearsal date…"></textarea></div></div></form>`,`<button class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary" data-create>Create snapshot</button>`);document.querySelector('[data-cancel]').onclick=closeModal;document.querySelector('[data-create]').onclick=async()=>{const form=document.querySelector('[data-snapshot-form]');if(!form.reportValidity())return;const d=Object.fromEntries(new FormData(form));if(!(await flushBlockingSavesBeforeNavigation()))return;const r=await BRM.api('saveBlockingSnapshot',{...d,sceneNumber:BState.scene,status:'Draft',lockState:'Unlocked',sortOrder:Date.now(),placements:[],objects:[],saveMode:'manual'});closeModal();await reloadHubAndSnapshot(r.snapshot.SnapshotID);BRM.toast('Blocking snapshot created.');};}
function snapshotSavePayload(saveMode='autosave'){
  if(!BState.snapshot)return null;
  const state=serialState();
  return {snapshotId:BState.snapshot.SnapshotID,sceneNumber:BState.snapshot.SceneNumber,cueNumber:BState.snapshot.CueNumber,anchorId:BState.snapshot.AnchorID,title:BState.snapshot.Title,snapshotType:BState.snapshot.SnapshotType,backgroundId:BState.snapshot.BackgroundID,status:BState.snapshot.Status,lockState:BState.snapshot.LockState,notes:BState.snapshot.Notes,sortOrder:BState.snapshot.SortOrder,placements:state.placements,objects:state.objects,saveMode};
}
function snapshotFingerprint(){
  const p=snapshotSavePayload('autosave');if(!p)return '';
  try{return JSON.stringify(p)}catch{return String(Date.now())}
}
function establishSnapshotSaveBaseline(){
  const fp=snapshotFingerprint();BState.save.lastSavedSnapshotFingerprint=fp;BState.save.lastSeenSnapshotFingerprint=fp;BState.save.snapshotDirty=false;BState.save.lastError='';updateBlockingSaveStatus();
}
function updateBlockingSaveStatus(){
  const host=document.querySelector('[data-save-status]'),text=document.querySelector('[data-save-status-text]');if(!host||!text)return;
  let state='saved',copy='Saved';
  if(BState.save.lastError){state='error';copy='Save failed';}
  else if(BState.save.snapshotSaving||BState.timeline.saving){state='saving';copy='Saving…';}
  else if(BState.save.snapshotDirty||BState.save.timelineDirty){state='dirty';copy='Unsaved changes';}
  else if(BState.save.lastSavedAt){const d=BState.save.lastSavedAt;state='saved';copy=`Saved ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;}
  host.dataset.state=state;text.textContent=copy;const dot=host.querySelector('.blocking-save-dot');if(dot)dot.textContent=state==='saved'?'✓':state==='saving'?'↻':state==='dirty'?'●':'!';
}
function scheduleSnapshotAutosave(){
  if(!canEdit()||!BState.snapshot)return;clearTimeout(BState.save.autosaveTimer);BState.save.autosaveTimer=setTimeout(()=>requestSnapshotSave(false),650);updateBlockingSaveStatus();
}
function scanSnapshotForChanges(){
  if(!canEdit()||!BState.snapshot)return;
  const fp=snapshotFingerprint();
  if(fp!==BState.save.lastSeenSnapshotFingerprint){BState.save.lastSeenSnapshotFingerprint=fp;if(fp!==BState.save.lastSavedSnapshotFingerprint){BState.save.snapshotDirty=true;scheduleSnapshotAutosave();}}
}
function startBlockingAutosaveMonitor(){
  if(BState.save.monitor)return;BState.save.monitor=window.setInterval(scanSnapshotForChanges,250);
  window.addEventListener('beforeunload',e=>{if(BState.save.snapshotDirty||BState.save.timelineDirty||BState.save.snapshotSaving||BState.timeline.saving){e.preventDefault();e.returnValue='';}});
}
function syncSavedSnapshotMeta(saved){
  if(!saved)return;BState.snapshot={...BState.snapshot,...saved};BState.snapshotId=saved.SnapshotID||BState.snapshotId;
  const i=(BState.data?.snapshots||[]).findIndex(x=>String(x.SnapshotID)===String(saved.SnapshotID));if(i>=0)BState.data.snapshots[i]={...BState.data.snapshots[i],...saved};
}
function requestSnapshotSave(manual=false){
  if(!canEdit())return Promise.resolve(true);if(!BState.snapshot){if(manual)openSnapshotModal();return Promise.resolve(false);}
  BState.save.snapshotPending=true;BState.save.snapshotManualRequested=BState.save.snapshotManualRequested||!!manual;BState.save.snapshotDirty=true;BState.save.lastError='';clearTimeout(BState.save.autosaveTimer);updateBlockingSaveStatus();
  if(BState.save.snapshotPromise)return BState.save.snapshotPromise;
  BState.save.snapshotPromise=(async()=>{
    let success=true;
    while(BState.save.snapshotPending){
      const saveMode=BState.save.snapshotManualRequested?'manual':'autosave';BState.save.snapshotPending=false;BState.save.snapshotManualRequested=false;const payload=snapshotSavePayload(saveMode);if(!payload)break;
      const savedFingerprint=JSON.stringify({...payload,saveMode:'autosave'});BState.save.snapshotSaving=true;updateBlockingSaveStatus();
      try{
        const r=await BRM.api('saveBlockingSnapshot',payload);if(!r?.saveVerification?.verified)throw new Error('The server did not verify the blocking snapshot write.');syncSavedSnapshotMeta(r.snapshot);
        BState.save.lastSavedSnapshotFingerprint=savedFingerprint;BState.save.lastSavedAt=new Date();BState.save.lastError='';
        const current=snapshotFingerprint();BState.save.lastSeenSnapshotFingerprint=current;
        if(current!==savedFingerprint){BState.save.snapshotPending=true;BState.save.snapshotDirty=true;}else{BState.save.snapshotDirty=false;cacheCurrentSnapshot();}
      }catch(e){success=false;BState.save.snapshotDirty=true;BState.save.lastError=e.message||'Blocking save failed.';BRM.toast(BState.save.lastError,'error');break;}
      finally{BState.save.snapshotSaving=false;updateBlockingSaveStatus();}
    }
    return success;
  })().finally(()=>{BState.save.snapshotSaving=false;BState.save.snapshotPromise=null;updateBlockingSaveStatus();});
  return BState.save.snapshotPromise;
}
async function saveCurrentSnapshot(){return requestSnapshotSave(true)}
async function saveAllBlocking(showToast=true){
  if(!canEdit())return true;
  BState.save.lastError='';
  updateBlockingSaveStatus();
  const snapshotOk=BState.snapshot?await requestSnapshotSave(true):true;
  if(!snapshotOk){updateBlockingSaveStatus();return false;}
  const timelineOk=BState.timeline.loaded?await saveTimeline(true):true;
  const ok=!!timelineOk&&!BState.save.lastError;
  if(showToast&&ok){
    const p=BState.placements.length,o=BState.objects.length,k=BState.timeline.keyframes?.length||0,m=BState.timeline.motions?.length||0;
    const audio=BState.timeline.media?.TrackID?' · Guide Vocal linked':BState.timeline.media?.FileID?' · Scene audio linked':'';
    BRM.toast(`✓ Saved to production · ${p} performer${p===1?'':'s'} · ${o} object${o===1?'':'s'} · ${k} formation${k===1?'':'s'} · ${m} path${m===1?'':'s'}${audio}`,'success');
  }
  updateBlockingSaveStatus();
  return ok;
}
async function flushBlockingSavesBeforeNavigation(){
  if(!canEdit())return true;
  let ok=true;
  if(BState.save.snapshotPromise)ok=(await BState.save.snapshotPromise)&&ok;
  if(ok&&BState.save.snapshotDirty&&BState.snapshot)ok=(await requestSnapshotSave(false))&&ok;
  if(BState.timeline.savePromise)ok=(await BState.timeline.savePromise)&&ok;
  if(ok&&BState.save.timelineDirty&&BState.timeline.loaded)ok=(await saveTimeline(false))&&ok;
  if(ok&&!BState.save.snapshotDirty&&!BState.save.timelineDirty&&!BState.save.snapshotSaving&&!BState.timeline.saving)return true;
  return confirm('Some blocking changes could not be saved. Leave this scene anyway?');
}
async function duplicateCurrentSnapshot(){if(!BState.snapshot)return;if(!(await flushBlockingSavesBeforeNavigation()))return;const r=await BRM.api('duplicateBlockingSnapshot',{snapshotId:BState.snapshot.SnapshotID});await reloadHubAndSnapshot(r.snapshot.SnapshotID);BRM.toast('Snapshot duplicated.');}
async function reloadHubMeta(){const data=await BRM.api('blockingHub',{}, {noCache:true,forceNetwork:true});BState.data=data;blockingCacheWrite('hub','active',{data});}
async function reloadHubAndSnapshot(id){await reloadHubMeta();renderShell();initStage();await loadSnapshot(id);await loadTimelineContext();}


function sanitizeFilenamePart(value){
  return String(value||'blocking-snapshot').trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'blocking-snapshot';
}
function currentBlockingExportMeta(){
  const scene=sceneRecord();
  const cue=cueRecord();
  const snapshot=BState.snapshot;
  return {
    title:snapshot?.Title||`${scene?`Scene ${scene.SceneNumber}: ${scene.Title}`:'Blocking Snapshot'}`,
    description:snapshot?.Notes||'',
    subtitle:[scene?`Scene ${scene.SceneNumber}: ${scene.Title}`:'',cue?`#${cue.CueNumber} ${cue.Title}`:'Scene / dialogue',snapshot?.SnapshotType||'Blocking'].filter(Boolean).join(' · '),
    filename:[scene?`scene-${scene.SceneNumber}`:'scene',cue?`cue-${cue.CueNumber}`:'dialogue',snapshot?.Title||'blocking'].map(sanitizeFilenamePart).filter(Boolean).join('-')
  };
}
function wrapCanvasText(ctx,text,maxWidth){
  const words=String(text||'').split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  const lines=[]; let line='';
  words.forEach(word=>{
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width<=maxWidth||!line)line=test;
    else{lines.push(line);line=word;}
  });
  if(line)lines.push(line);
  return lines;
}
function downloadDataUrl(filename,dataUrl){
  const a=document.createElement('a');
  a.href=dataUrl; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}
function openExportSnapshotModal(){
  if(!BState.stage){BRM.toast('The blocking map is not ready yet.','info');return;}
  const meta=currentBlockingExportMeta();
  openModal('Save Blocking Snapshot as Image',`<form data-export-form><div class="form-grid"><div class="field span-2"><label>Image title</label><input name="title" value="${BRM.escape(meta.title)}" placeholder="e.g. Rotten to the Core opening picture"></div><div class="field span-2"><label>Description / note</label><textarea name="description" placeholder="Optional rehearsal note, count, lyric, or staging description">${BRM.escape(meta.description)}</textarea></div><div class="field"><label>File name</label><input name="filename" value="${BRM.escape(meta.filename)}" placeholder="scene-1-opening-picture"></div><div class="field"><label>Resolution</label><select name="pixelRatio"><option value="1">Standard</option><option value="2" selected>High</option><option value="3">Very high</option></select></div><div class="field span-2"><label class="checkbox-row"><input type="checkbox" name="includeMeta" checked><span>Include scene / cue / snapshot information</span></label><label class="checkbox-row"><input type="checkbox" name="showNames" ${BState.showTokenNames?'checked':''}><span>Show token names in exported image</span></label><div class="field-hint">The image exports the full blocking map and auditorium, not just the currently scrolled viewport.</div></div></div></form>`,`<button class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary" data-do-export>Download PNG</button>`);
  document.querySelector('[data-cancel]').onclick=closeModal;
  document.querySelector('[data-do-export]').onclick=async()=>{
    const form=document.querySelector('[data-export-form]');
    if(!form.reportValidity())return;
    const fd=new FormData(form);
    const payload={
      title:String(fd.get('title')||'').trim(),
      description:String(fd.get('description')||'').trim(),
      filename:sanitizeFilenamePart(fd.get('filename')||meta.filename),
      pixelRatio:Math.max(1,Math.min(3,Number(fd.get('pixelRatio')||2))),
      includeMeta:fd.get('includeMeta')==='on',
      showNames:fd.get('showNames')==='on'
    };
    const btn=document.querySelector('[data-do-export]');
    btn.disabled=true; btn.textContent='Rendering…';
    try{await exportBlockingImage(payload); closeModal(); BRM.toast('Blocking image downloaded.');}
    catch(error){BRM.toast(error.message||'Could not export the blocking image.','error'); btn.disabled=false; btn.textContent='Download PNG';}
  };
}
async function exportBlockingImage(options={}){
  if(!BState.stage)throw new Error('The blocking map is not ready yet.');
  hideBlockingTokenTooltip?.();
  const previousShowNames=BState.showTokenNames;
  if(options.showNames!==previousShowNames)setTokenNamesVisible(options.showNames);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  try{
    const stageCanvas=BState.stage.toCanvas({pixelRatio:options.pixelRatio||2});
    const pad=40, gap=24;
    const title=String(options.title||'').trim();
    const description=String(options.description||'').trim();
    const meta=currentBlockingExportMeta();
    const footer=options.includeMeta?`${meta.subtitle} · ${BState.snapshot?.Title||'Blocking snapshot'} · ${new Date().toLocaleString()}`:'';
    const exportCanvas=document.createElement('canvas');
    const ctx=exportCanvas.getContext('2d');
    const textWidth=Math.max(stageCanvas.width, 1200);
    ctx.font='bold 48px Arial, sans-serif';
    const titleLines=title?wrapCanvasText(ctx,title,textWidth):[];
    ctx.font='24px Arial, sans-serif';
    const descLines=description?wrapCanvasText(ctx,description,textWidth):[];
    ctx.font='20px Arial, sans-serif';
    const footerLines=footer?wrapCanvasText(ctx,footer,textWidth):[];
    const headerH=pad+(titleLines.length?titleLines.length*56:0)+(descLines.length?descLines.length*34+14:0)+(footerLines.length?footerLines.length*28+10:0)+(titleLines.length||descLines.length||footerLines.length?18:0);
    exportCanvas.width=stageCanvas.width+pad*2;
    exportCanvas.height=headerH+stageCanvas.height+pad;
    ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,exportCanvas.width,exportCanvas.height);
    let y=pad+10;
    if(titleLines.length){ctx.fillStyle='#ffffff'; ctx.font='bold 48px Arial, sans-serif'; titleLines.forEach(line=>{ctx.fillText(line,pad,y); y+=56;});}
    if(descLines.length){ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='24px Arial, sans-serif'; descLines.forEach(line=>{ctx.fillText(line,pad,y); y+=34;}); y+=8;}
    if(footerLines.length){ctx.fillStyle='rgba(255,255,255,.72)'; ctx.font='20px Arial, sans-serif'; footerLines.forEach(line=>{ctx.fillText(line,pad,y); y+=28;});}
    const mapTop=headerH;
    ctx.fillStyle='#111827'; ctx.fillRect(pad-2,mapTop-2,stageCanvas.width+4,stageCanvas.height+4);
    ctx.drawImage(stageCanvas,pad,mapTop);
    downloadDataUrl(`${options.filename||meta.filename}.png`, exportCanvas.toDataURL('image/png'));
  } finally {
    if(BState.showTokenNames!==previousShowNames)setTokenNamesVisible(previousShowNames);
  }
}

function openAnchorModal(){openModal('Add Script / Cue Anchor',`<form data-anchor-form><div class="form-grid"><div class="field"><label>Anchor type</label><select name="anchorType">${['Dialogue','Lyric','Stage Direction','Measure','Count','Transition','Other'].map(v=>`<option>${v}</option>`).join('')}</select></div><div class="field"><label>Speaker / group</label><input name="speaker" placeholder="MAL, ENSEMBLE…"></div><div class="field span-2"><label>Exact line or short reference</label><textarea name="textSnippet" maxlength="500" required placeholder="Use only enough text to identify the blocking cue."></textarea></div><div class="field"><label>Book page</label><input name="bookPage" value="${BRM.escape(sceneRecord()?.BookPage||'')}"></div><div class="field"><label>Music cue</label><select name="cueNumber"><option value="">None</option>${(BState.data.cues||[]).filter(c=>Number(c.SceneNumber)===Number(BState.scene)).map(c=>`<option value="${c.CueNumber}" ${String(BState.cue)===String(c.CueNumber)?'selected':''}>#${c.CueNumber} ${BRM.escape(c.Title)}</option>`).join('')}</select></div><div class="field"><label>Measure</label><input name="measure" placeholder="e.g. 32"></div><div class="field"><label>Count</label><input name="countLabel" placeholder="e.g. 5-6-7-8"></div><div class="field"><label>Trigger word</label><input name="cueWord" placeholder="e.g. trouble"></div><div class="field"><label>Verification</label><select name="verificationStatus"><option>Verified</option><option>Needs Review</option><option>Draft</option></select></div><div class="field span-2"><label>Blocking note</label><textarea name="notes"></textarea></div></div></form>`,`<button class="button button-secondary" data-cancel>Cancel</button><button class="button button-primary" data-save-anchor>Save anchor</button>`);document.querySelector('[data-cancel]').onclick=closeModal;document.querySelector('[data-save-anchor]').onclick=async()=>{const f=document.querySelector('[data-anchor-form]');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));await BRM.api('saveBlockingAnchor',{...d,sceneNumber:BState.scene,sortOrder:Date.now()});closeModal();await reloadHubMeta();document.querySelector('[data-anchor-list]').innerHTML=renderAnchors();document.querySelectorAll('[data-anchor]').forEach(a=>a.onclick=()=>{if(BState.snapshot&&canEdit()){BState.snapshot.AnchorID=a.dataset.anchor;document.querySelector('[data-anchor-list]').innerHTML=renderAnchors();}});BRM.toast('Script anchor saved.');};}

function openBackgroundModal(){const bgs=(BState.data.backgrounds||[]).filter(b=>!b.SceneNumber||Number(b.SceneNumber)===Number(BState.scene));openModal('Stage Backgrounds & Ground Plans',`<div class="blocking-source-note"><strong>v26:</strong> scene/set images are fitted inside the physical stage deck. The Bedford auditorium map, stairs, entrances, aisles, and seating remain visible.</div><div class="data-list">${bgs.length?bgs.map(b=>`<div class="data-card"><div class="data-card-main"><strong>${BRM.escape(b.Title)}</strong><p>Scene ${BRM.escape(b.SceneNumber||'All')}</p></div><button class="button button-secondary button-small" data-use-bg="${b.BackgroundID}">Use</button></div>`).join(''):'<div class="blocking-empty">No backgrounds uploaded yet.</div>'}</div><hr><form data-bg-form><div class="form-grid"><div class="field"><label>Title</label><input name="title" required placeholder="Auradon Prep ground plan"></div><div class="field"><label>Scene</label><input name="sceneNumber" type="number" min="0" max="18" value="${BState.scene}"></div><div class="field span-2"><label>Image</label><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required></div></div></form>`,`<button class="button button-secondary" data-cancel>Close</button><button class="button button-primary" data-upload-bg>Upload background</button>`);document.querySelector('[data-cancel]').onclick=closeModal;document.querySelectorAll('[data-use-bg]').forEach(b=>b.onclick=()=>{if(!BState.snapshot){BRM.toast('Create a snapshot first.','info');return;}BState.snapshot.BackgroundID=b.dataset.useBg;closeModal();renderBackground();});document.querySelector('[data-upload-bg]').onclick=async()=>{const f=document.querySelector('[data-bg-form]');if(!f.reportValidity())return;const fd=new FormData(f),file=fd.get('file');const dataUrl=await prepareBlockingImage(file);await BRM.api('uploadBlockingBackground',{filename:file.name,title:fd.get('title'),sceneNumber:fd.get('sceneNumber'),dataUrl});closeModal();await reloadHubMeta();BRM.toast('Background uploaded.');};}
async function prepareBlockingImage(file){if(file.size>25*1024*1024)throw new Error('Choose an image smaller than 25 MB.');const img=await imageFromUrl(URL.createObjectURL(file));const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.84)}

function openCastModal(){const characters=BState.data.characters||[],people=BState.data.people||[],cast=BState.data.cast||[];openModal('Manage Blocking Cast',`<div class="data-list">${cast.map(c=>`<div class="data-card"><span>${blockingCastAvatar(c,'small')}</span><div class="data-card-main"><strong>${BRM.escape(c.CharacterName)}</strong><p>${BRM.escape(c.PersonName||'No performer assigned')}</p></div><button class="button button-danger button-small" data-remove-cast="${c.BlockingCastID}">Remove</button></div>`).join('')}</div><hr><form data-cast-form><div class="form-grid"><div class="field"><label>Character</label><select name="characterId" required><option value="">Choose…</option>${characters.map(c=>`<option value="${c.CharacterID}">${BRM.escape(c.CharacterName)}</option>`).join('')}</select></div><div class="field"><label>Student / performer</label><select name="userId"><option value="">Placeholder only</option>${people.map(p=>`<option value="${p.UserID}">${BRM.escape(p.DisplayName)}</option>`).join('')}</select></div><div class="field"><label>Role label</label><input name="roleLabel" placeholder="Principal Cast, Ensemble, Swing…"></div><div class="field"><label>Display override</label><input name="displayLabel" placeholder="Optional"></div></div></form>`,`<button class="button button-secondary" data-cancel>Close</button><button class="button button-primary" data-add-cast>Add assignment</button>`);BRM.hydrateProfilePhotos?.(document.querySelector('[data-blocking-modal]'));hydrateBlockingCastPhotos(document.querySelector('[data-blocking-modal]'));document.querySelector('[data-cancel]').onclick=closeModal;document.querySelector('[data-add-cast]').onclick=async()=>{const f=document.querySelector('[data-cast-form]');if(!f.reportValidity())return;if(!(await flushBlockingSavesBeforeNavigation()))return;const d=Object.fromEntries(new FormData(f));await BRM.api('saveBlockingCast',d);closeModal();if(BState.snapshotId)await reloadHubAndSnapshot(BState.snapshotId);else{await reloadHubMeta();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();}BRM.toast('Cast assignment added.');};document.querySelectorAll('[data-remove-cast]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this blocking cast assignment? Existing snapshots protect assignments that are already in use.'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;try{await BRM.api('deleteBlockingCast',{blockingCastId:b.dataset.removeCast});closeModal();if(BState.snapshotId)await reloadHubAndSnapshot(BState.snapshotId);else{await reloadHubMeta();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();}}catch(e){BRM.toast(e.message,'error')}});}

async function toggleLock(){if(!BState.snapshot)return;if(!(await flushBlockingSavesBeforeNavigation()))return;const next=BState.snapshot.LockState==='Locked'?'Unlocked':'Locked';await BRM.api('setBlockingSnapshotStatus',{snapshotId:BState.snapshot.SnapshotID,status:BState.snapshot.Status,lockState:next});await reloadHubAndSnapshot(BState.snapshot.SnapshotID);}
async function archiveSnapshot(){if(!BState.snapshot||!confirm('Archive this snapshot? It can be restored later from the spreadsheet/history workflow.'))return;if(!(await flushBlockingSavesBeforeNavigation()))return;await BRM.api('setBlockingSnapshotStatus',{snapshotId:BState.snapshot.SnapshotID,status:'Archived',lockState:BState.snapshot.LockState});BState.snapshotId='';BState.snapshot=null;BState.placements=[];BState.objects=[];await reloadHubMeta();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();}
async function deleteSnapshot(){if(!BState.snapshot)return;const confirmation=prompt('Permanent deletion cannot be undone. Type DELETE to continue:','');if(confirmation!=='DELETE')return;await BRM.api('deleteBlockingSnapshotPermanently',{snapshotId:BState.snapshot.SnapshotID,confirmation});BState.snapshotId='';BState.snapshot=null;await reloadHubMeta();renderShell();initStage();await chooseInitialSnapshot();await loadTimelineContext();}
async function openHistoryModal(){if(!BState.snapshot)return;const r=await BRM.api('blockingSnapshotVersions',{snapshotId:BState.snapshot.SnapshotID},{noCache:true});openModal('Snapshot Version History',`${(r.versions||[]).length?(r.versions||[]).map(v=>`<div class="data-card"><div class="data-card-main"><strong>Version ${v.VersionNumber}</strong><p>${BRM.formatDateTime(v.CreatedAt)} · ${BRM.escape(v.CreatedBy||'')}</p></div><button class="button button-secondary button-small" data-restore-version="${v.VersionID}">Restore</button></div>`).join(''):'<div class="blocking-empty">No previous saved versions yet.</div>'}`,'<button class="button button-secondary" data-cancel>Close</button>');document.querySelector('[data-cancel]').onclick=closeModal;document.querySelectorAll('[data-restore-version]').forEach(b=>b.onclick=async()=>{if(!confirm('Restore this version? The current version will be saved in history first.'))return;const result=await BRM.api('restoreBlockingSnapshotVersion',{versionId:b.dataset.restoreVersion});closeModal();await reloadHubAndSnapshot(result.snapshot.SnapshotID);BRM.toast('Blocking version restored.');});}
