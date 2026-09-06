import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const syncKey = defineSecret('BRM_SYNC_KEY');
const appsScriptApi = 'https://script.google.com/macros/s/AKfycbw2hM9wqpgvlRlQVEUr-h19GpTeXoVe3fwZb2CsR0bjIDdi9idHEEUtgLPne0YJ0HtHMQ/exec';
const allowedTables = new Set([
  'Announcements','AnnouncementAudiences','AnnouncementReads','Acknowledgements','Events','Tasks','PageNotes','NoteHistory',
  'JournalEntries','JournalFeedback','Resources','Tracks','DepartmentItems','DepartmentRequests','UserDepartments',
  'BlockingMusicMaps','BlockingReferenceMedia','BlockingSceneRecordings','BlockingTimelineMedia','BlockingTimelineMarkers',
  'BlockingTimelineKeyframes','BlockingTimelineMotions','BlockingSections','BlockingCues','BlockingCharacters','BlockingGroups',
  'BlockingCast','BlockingScriptAnchors','BlockingBackgrounds','BlockingSnapshots','BlockingPlacements','BlockingObjects',
  'BlockingMovements','BlockingSnapshotVersions','BlockingActivity','CostumeCharacters','CostumeChanges','CostumeMeasurements',
  'CostumeFittings','CostumePieces','CostumeDeadlines','CostumeImages','CostumeSuggestions','CostumeActivity','ScenicSets',
  'ScenicElements','ScenicTransitions','ScenicDeadlines','ScenicImages','ScenicSuggestions','ScenicActivity','PropsInventory',
  'PropsPresets','PropsDeadlines','PropsImages','PropsSuggestions','PropsActivity','RegistrationCodes'
]);
const globalTables = new Set(['RegistrationCodes']);
const fixedCommunicationSpaces = [
  ['musical-theatre','Musical Theatre 10/20/30'],
  ['theatre-arts','Theatre Arts 20/30'],
  ['choreography','Choreography'],
  ['featured-dancers','Featured Dancers'],
  ['pit-orchestra','Pit Orchestra'],
  ['stage-crew','Stage Crew & Stage Hands'],
  ['scenic-painting','Scenic Painting'],
  ['hair-makeup','Hair & Makeup'],
  ['projections-video','Projections & Video'],
  ['photography-videography','Photography & Videography'],
  ['tickets-box-office','Tickets & Box Office'],
  ['wardrobe-crew','Wardrobe Crew']
];
const communicationSpaceAliases = new Map([
  ['musical-theatre-10','musical-theatre'],['musical-theatre-20','musical-theatre'],['musical-theatre-30','musical-theatre'],
  ['theatre-arts-20','theatre-arts'],['theatre-arts-30','theatre-arts']
]);
function normalizeCommunicationSpaceKey(key) { return communicationSpaceAliases.get(String(key)) || String(key); }
function validCommunicationSpaceKeys(keys) {
  return [...new Set((Array.isArray(keys) ? keys : []).map(normalizeCommunicationSpaceKey))]
    .filter(key => fixedCommunicationSpaces.some(([id]) => id === key));
}
const communicationNameMap = {lighting:'Lights Crew',lights:'Lights Crew',props:'Props Crew',costumes:'Costume Crew',sets:'Set Design','set-design':'Set Design',sound:'Sound Crew','stage-management':'Stage Management','pit-orchestra':'Pit Orchestra',ensemble:'General Cast','principal-cast':'General Cast','front-of-house':'Front of House',publicity:'PR & Marketing','pr-marketing':'PR & Marketing'};

function equalSecret(candidate) {
  const expected = Buffer.from(syncKey.value().trim());
  const received = Buffer.from(String(candidate || ''));
  return expected.length === received.length && expected.length > 20 && crypto.timingSafeEqual(expected, received);
}
function lowerCamel(key) {
  const value = String(key);
  if (!value) return value;
  // Table and sheet fields are PascalCase (Tracks, DriveFileID).  The old
  // acronym regex left ordinary PascalCase words unchanged, which caused the
  // sync service to write `Tracks` while every client and rule reads `tracks`.
  return /^[A-Z]+$/.test(value)
    ? value.toLowerCase()
    : value[0].toLowerCase() + value.slice(1);
}
function decode(value, key) {
  if (typeof value === 'string' && /JSON$/.test(key) && value.trim()) {
    try { return JSON.parse(value); } catch {}
  }
  return value === '' ? null : value;
}
function normalize(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !key.includes('__duplicate_')).map(([key, value]) => [lowerCamel(key), decode(value, key)]));
}
function recordId(record, index) {
  const entry = Object.entries(record).find(([key, value]) => /ID$/.test(key) && String(value || '').trim());
  return String(entry?.[1] || `row-${String(index + 1).padStart(6, '0')}`).replaceAll('/', '_');
}

function isActiveUser(user) {
  return String(user?.status ?? user?.Status ?? '').toLowerCase() === 'active';
}

function isFullAdministrator(user) {
  const value = user?.isFullAdmin ?? user?.IsFullAdmin;
  return isActiveUser(user) && (value === true || String(value).toLowerCase() === 'true');
}

function principalId(decoded) {
  return clean(decoded?.legacyUserId || decoded?.uid, 128);
}

async function reconcileCommunicationSpaces(productionId) {
  const production=db.collection('productions').doc(productionId);
  let departments=await production.collection('departments').get();
  if(departments.empty) departments=await db.collection('departments').get();
  const [memberships,assignments,users]=await Promise.all([
    production.collection('userDepartments').get(),production.collection('communicationAssignments').get(),db.collection('users').get()
  ]);
  const admins=users.docs.filter(d=>isFullAdministrator(d.data())).map(d=>d.id);
  const byDepartment=new Map(); memberships.docs.forEach(d=>{const row=d.data();if(String(row.status||'Active')!=='Active')return;const key=String(row.departmentID||row.departmentId||'');if(key)(byDepartment.get(key)||byDepartment.set(key,[]).get(key)).push(String(row.userID||row.userId||''));});
  const assigned=new Map(fixedCommunicationSpaces.map(([key])=>[key,[]])); assignments.docs.forEach(d=>{const row=d.data();for(const rawKey of row.spaceKeys||[]){const key=normalizeCommunicationSpaceKey(rawKey);if(assigned.has(key))assigned.get(key).push(String(row.userId||d.id));}});
  const spaces=[],generalCastMembers=[];
  departments.docs.forEach(d=>{const row=d.data(),status=row.status||row.Status,slug=String(row.slug||row.Slug||'').toLowerCase();if(status!=='Active'||slug==='administration'||slug==='directing')return;const sourceId=row.departmentID||row.DepartmentID||d.id,members=byDepartment.get(String(sourceId))||[];if(slug==='ensemble'||slug==='principal-cast'||slug==='general-cast'){generalCastMembers.push(...members);return;}const fixedKey=normalizeCommunicationSpaceKey(slug);if(assigned.has(fixedKey)){assigned.get(fixedKey).push(...members);return;}const category=slug==='pit-orchestra'?'ensemble':'production';spaces.push({key:`department-${slug}`,title:communicationNameMap[slug]||row.name||row.Name||slug,category,sourceType:'department',sourceId,members});});
  spaces.push({key:'ensemble-general-cast',title:'Cast',category:'ensemble',sourceType:'ensemble',sourceId:'general-cast',members:generalCastMembers});
  fixedCommunicationSpaces.forEach(([key,title])=>{const category=key==='musical-theatre'||key==='theatre-arts'?'class':key==='choreography'||key==='featured-dancers'||key==='pit-orchestra'?'ensemble':'production';spaces.push({key:`assignment-${key}`,title,category,sourceType:'assignment',sourceId:key,members:assigned.get(key)||[]});});
  const batch=db.batch(),now=FieldValue.serverTimestamp(),roomCollection=production.collection('communicationConversations'),desiredIds=new Set(spaces.map(space=>`space-${space.key}`));
  const existingRooms=await roomCollection.get();
  existingRooms.docs.filter(document=>document.data().autoManaged===true&&!desiredIds.has(document.id)).forEach(document=>batch.set(document.ref,{status:'Archived',updatedAt:now},{merge:true}));
  spaces.forEach(space=>{const members=[...new Set([...admins,...space.members].filter(Boolean))];batch.set(roomCollection.doc(`space-${space.key}`),{title:space.title,type:'space',description:`Official ${space.title} space`,memberIds:members,adminIds:admins,category:space.category,sourceType:space.sourceType,sourceId:space.sourceId,autoManaged:true,status:'Active',updatedAt:now,createdAt:now},{merge:true});});
  await batch.commit(); return {spaces:spaces.length,administrators:admins.length,memberships:memberships.size};
}

export const syncTable = onRequest({ region: 'northamerica-northeast2', secrets: [syncKey], timeoutSeconds: 300, memory: '512MiB' }, async (request, response) => {
  if (request.method !== 'POST' || !equalSecret(request.get('x-brm-sync-key'))) {
    response.status(403).json({ success: false, error: 'Forbidden' }); return;
  }
  const { table, productionId, records } = request.body || {};
  if (request.body?.operation === 'deleteUser') {
    const userId = String(request.body.userId || '');
    if (!/^USR-[A-Za-z0-9-]+$/.test(userId)) { response.status(400).json({ success:false, error:'Invalid user.' }); return; }
    try { await getAuth().deleteUser(userId); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    const profiles = await db.collection('profiles').where('UserID', '==', userId).get();
    const cleanup = db.batch();
    cleanup.delete(db.collection('users').doc(userId));
    profiles.docs.forEach(document => cleanup.delete(document.ref));
    await cleanup.commit();
    response.json({ success:true, operation:'deleteUser', userId }); return;
  }
  if (request.body?.operation === 'createUser') {
    const body = request.body || {}, userId = clean(body.userId, 100), username = clean(body.username, 40).toLowerCase(), password = String(body.password || '');
    if (!/^USR-[A-Za-z0-9-]+$/.test(userId) || !/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 8) { response.status(400).json({success:false,error:'Invalid managed user.'}); return; }
    const now = new Date().toISOString(), displayName = clean(body.displayName,120), syntheticEmail = `${username}@users.bedford-musical.invalid`;
    try {
      await getAuth().createUser({uid:userId,email:syntheticEmail,password,displayName,emailVerified:false});
      const batch=db.batch();
      batch.set(db.collection('users').doc(userId),{userID:userId,username,usernameNormalized:username,email:clean(body.email,160).toLowerCase(),status:'Active',isFullAdmin:false,mustChangePassword:body.mustChangePassword!==false,createdAt:now,updatedAt:now,lastLoginAt:null});
      batch.set(db.collection('profiles').doc(userId),{profileID:`PROF-${crypto.randomUUID()}`,userID:userId,firstName:clean(body.firstName,80),lastName:clean(body.lastName,80),displayName,photoURL:'',theme:'bedford-dark',visibility:'Production',createdAt:now,updatedAt:now});
      await batch.commit(); response.json({success:true,operation:'createUser',userId}); return;
    } catch (error) { await getAuth().deleteUser(userId).catch(()=>{}); response.status(400).json({success:false,error:error.code==='auth/email-already-exists'?'That username already exists in Firebase.':error.message}); return; }
  }
  if (!allowedTables.has(table) || (!productionId && !globalTables.has(table)) || !Array.isArray(records) || records.length > 1000) {
    response.status(400).json({ success: false, error: 'Invalid synchronization payload.' }); return;
  }
  const collectionName = lowerCamel(table);
  const collection = globalTables.has(table)
    ? db.collection(collectionName)
    : db.collection('productions').doc(productionId).collection(collectionName);
  const incoming = new Map(records.map((record, index) => [recordId(record, index), normalize(record)]));
  const existing = await collection.select().get();
  const operations = [];
  for (const document of existing.docs) if (!incoming.has(document.id)) operations.push({ type: 'delete', ref: document.ref });
  for (const [id, data] of incoming) operations.push({ type: 'set', ref: collection.doc(id), data: { ...data, _sourceTable: table, _syncedAt: FieldValue.serverTimestamp() } });
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = db.batch();
    for (const operation of operations.slice(offset, offset + 400)) operation.type === 'delete' ? batch.delete(operation.ref) : batch.set(operation.ref, operation.data);
    await batch.commit();
  }
  let communicationSync=null;
  if(productionId&&(table==='UserDepartments'||table==='Departments')) communicationSync=await reconcileCommunicationSpaces(productionId);
  response.json({ success: true, table, rows: records.length, deleted: operations.filter(item => item.type === 'delete').length, communicationSync });
});

const allowedWebOrigins = new Set([
  'https://bedfordroadtheatre.ca',
  'https://www.bedfordroadtheatre.ca',
  'https://bedfordroadtheatre.neocities.org',
]);
function allowWebOrigin(request, response) {
  const origin = String(request.get('origin') || '').replace(/\/$/, '');
  if (allowedWebOrigins.has(origin)) response.set('Access-Control-Allow-Origin', origin);
  response.set('Vary', 'Origin');
}
function publicCors(request, response) {
  allowWebOrigin(request, response);
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

function appCors(request, response) {
  allowWebOrigin(request, response);
  response.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
}
function clean(value, limit = 160) { return String(value || '').trim().slice(0, limit); }
function uuid(prefix) { return `${prefix}-${crypto.randomUUID()}`; }

// Exchanges an already-validated production-portal session for Firebase Auth.
// This keeps the existing username/password system authoritative and avoids
// requiring the two systems' password hashes to remain synchronized.
export const legacyAppSignIn = onRequest({region:'northamerica-northeast2',timeoutSeconds:30,memory:'256MiB',cors:false}, async (request,response) => {
  appCors(request, response);
  response.set('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
  if (request.method !== 'POST') { response.status(405).json({success:false,error:'POST required.'}); return; }
  try {
    let sessionToken = clean(request.body?.token, 500);
    let context;
    const username = clean(request.body?.username, 40).toLowerCase();
    const password = String(request.body?.password || '');
    const trustedDevice = request.body?.trustedDevice === true;
    const action = sessionToken.length >= 20
      ? {action:'validateSession',token:sessionToken}
      : {action:'login',username,password,trustedDevice};
    if (!sessionToken && (!/^[a-z0-9._-]{3,40}$/.test(username) || !password)) {
      throw new Error('Enter your username and password.');
    }
    const validationResponse = await fetch(appsScriptApi, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(action),
      redirect:'follow',
    });
    if (!validationResponse.ok) throw new Error('The musical hub could not validate this sign in.');
    const validation = await validationResponse.json();
    context = validation?.user ?? validation?.context ?? validation?.data?.user ?? validation?.data?.context;
    sessionToken ||= clean(validation?.token ?? validation?.data?.token, 500);
    if (validation?.success !== true || !context?.userId) throw new Error(validation?.error || 'Your musical hub session is not valid.');

    const userId = clean(context.userId, 128);
    const accountUsername = clean(context.username, 40).toLowerCase();
    const member = (await db.collection('users').doc(userId).get()).data();
    if (!isActiveUser(member)) throw new Error('Your account has not been activated in the app yet.');

    let firebaseUser;
    try { firebaseUser = await getAuth().getUser(userId); }
    catch {
      if (!accountUsername) throw new Error('Your app account could not be located.');
      firebaseUser = await getAuth().getUserByEmail(`${accountUsername}@users.bedford-musical.invalid`);
    }
    const claims = {
      username:accountUsername,
      fullAdmin: context.isAdmin === true,
      legacyUserId:userId,
    };
    await getAuth().setCustomUserClaims(firebaseUser.uid, {
      ...(firebaseUser.customClaims || {}),
      ...claims,
    });
    const customToken = await getAuth().createCustomToken(firebaseUser.uid, claims);
    const activeProductionId = clean(context.productionId, 128);
    const pitRoomRef = activeProductionId
      ? db.collection('productions').doc(activeProductionId).collection('communicationConversations').doc('space-assignment-pit-orchestra')
      : null;
    const hasPitOrchestraAccess = Array.isArray(context.departments)
      && context.departments.some(department => clean(department?.slug || department?.Slug, 80).toLowerCase() === 'pit-orchestra');
    if (pitRoomRef && context.isAdmin !== true) {
      const assignmentRef = db.collection('productions').doc(activeProductionId).collection('communicationAssignments').doc(userId);
      await assignmentRef.set({
        userId,
        spaceKeys: hasPitOrchestraAccess
          ? FieldValue.arrayUnion('pit-orchestra')
          : FieldValue.arrayRemove('pit-orchestra'),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge:true});
      const pitRoom = await pitRoomRef.get();
      if (pitRoom.exists) {
        await pitRoomRef.set({
          memberIds: hasPitOrchestraAccess
            ? FieldValue.arrayUnion(userId)
            : FieldValue.arrayRemove(userId),
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge:true});
      }
    }
    // Keep guaranteed spaces current without exposing reconciliation to
    // unauthenticated callers. An administrator sign-in safely repairs any
    // room omitted by an earlier department synchronization.
    let communicationSync = null;
    if (context.isAdmin === true && activeProductionId) {
      communicationSync = await reconcileCommunicationSpaces(activeProductionId);
    }
    response.json({success:true,customToken,portalToken:sessionToken,portalContext:context,communicationSync});
  } catch(error) {
    response.status(401).json({success:false,error:error.message || 'App sign in failed.'});
  }
});

export const registerStudent = onRequest({ region:'northamerica-northeast2', secrets:[syncKey], timeoutSeconds:60, memory:'256MiB', cors:false }, async (request, response) => {
  publicCors(request, response);
  if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
  if (request.method !== 'POST') { response.status(405).json({success:false,error:'POST required.'}); return; }
  try {
    const body = request.body || {};
    const username = clean(body.username, 40).toLowerCase();
    const password = String(body.password || '');
    const requestId = clean(body.registrationRequestId, 100);
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 8 || !/^[A-Za-z0-9-]{20,100}$/.test(requestId)) throw new Error('Check the username and password fields.');
    const requestRef = db.collection('registrationRequests').doc(requestId);
    const prior = await requestRef.get();
    if (prior.exists) { response.json(prior.data().publicResult); return; }
    const code = clean(body.registrationCode, 100).toUpperCase();
    let codeQuery = await db.collection('registrationCodes').where('code','==',code).limit(1).get();
    if (codeQuery.empty) codeQuery = await db.collection('registrationCodes').where('Code','==',code).limit(1).get();
    if (codeQuery.empty) throw new Error('That registration code is not valid.');
    const codeDoc = codeQuery.docs[0], registration = codeDoc.data();
    const registrationStatus = registration.status ?? registration.Status;
    const registrationExpiry = registration.expiresAt ?? registration.ExpiresAt;
    if (registrationStatus !== 'Active' || (registrationExpiry && new Date(registrationExpiry) <= new Date())) throw new Error('That registration code is unavailable or expired.');
    const uid = uuid('USR');
    const profileId = uuid('PROF');
    const syntheticEmail = `${username}@users.bedford-musical.invalid`;
    await getAuth().createUser({uid,email:syntheticEmail,password,displayName:clean(`${body.firstName || ''} ${body.lastName || ''}`,120),emailVerified:false});
    try {
      let productionQuery = await db.collection('productions').where('status','==','Active').limit(1).get();
      if (productionQuery.empty) productionQuery = await db.collection('productions').where('Status','==','Active').limit(1).get();
      if (productionQuery.empty) throw new Error('No active production is available.');
      const productionId = productionQuery.docs[0].id;
      const now = new Date().toISOString();
      const requested = Array.isArray(body.requestedDepartmentIds) ? [...new Set(body.requestedDepartmentIds.map(String))].slice(0,30) : [];
      const mirror = {requestId,userId:uid,profileId,productionId,username,email:clean(body.email,160).toLowerCase(),firstName:clean(body.firstName,80),lastName:clean(body.lastName,80),displayName:clean(body.displayName || `${body.firstName || ''} ${body.lastName || ''}`,120),registrationCode:code,requestedDepartmentIds:requested,departmentRequestNote:clean(body.departmentRequestNote,500),createdAt:now};
      const mirrorToken = Buffer.from(JSON.stringify(mirror)).toString('base64url');
      const mirrorSignature = crypto.createHmac('sha256',syncKey.value().trim()).update(mirrorToken).digest('hex');
      const publicResult = {success:true,userId:uid,username,message:'Your Firebase account is ready. Finishing your production access…',mirrorToken,mirrorSignature};
      await db.runTransaction(async transaction => {
        const currentCode = (await transaction.get(codeDoc.ref)).data();
        const usesKey = Object.prototype.hasOwnProperty.call(currentCode, 'uses') ? 'uses' : 'Uses';
        const maxUses = currentCode.maxUses ?? currentCode.MaxUses ?? 999999;
        const currentUses = currentCode.uses ?? currentCode.Uses ?? 0;
        if (Number(currentUses) >= Number(maxUses)) throw new Error('That registration code has reached its limit.');
        const codeUpdate = { [usesKey]:Number(currentUses)+1 };
        codeUpdate[usesKey === 'uses' ? 'updatedAt' : 'UpdatedAt'] = now;
        transaction.update(codeDoc.ref, codeUpdate);
        transaction.set(db.collection('users').doc(uid),{userID:uid,username,usernameNormalized:username,email:clean(body.email,160).toLowerCase(),status:'Active',isFullAdmin:false,mustChangePassword:false,createdAt:now,updatedAt:now,lastLoginAt:null});
        transaction.set(db.collection('profiles').doc(profileId),{profileID:profileId,userID:uid,firstName:mirror.firstName,lastName:mirror.lastName,displayName:mirror.displayName,pronouns:'',grade:'',bio:'',phone:'',emergencyContact:'',photoFileID:'',photoURL:'',theme:'bedford-dark',visibility:'Production',createdAt:now,updatedAt:now});
        transaction.set(requestRef,{userId:uid,createdAt:now,publicResult});
        const classKeys=validCommunicationSpaceKeys(body.classSpaceKeys);
        transaction.set(db.collection('productions').doc(productionId).collection('communicationAssignments').doc(uid),{userId:uid,spaceKeys:classKeys,updatedAt:now});
      });
      response.json(publicResult);
    } catch (error) { await getAuth().deleteUser(uid).catch(()=>{}); throw error; }
  } catch (error) {
    const duplicate = error.code === 'auth/email-already-exists' || error.code === 'auth/uid-already-exists';
    response.status(duplicate ? 409 : 400).json({success:false,error:duplicate?'That username is already registered. Sign in or ask an administrator for help.':error.message});
  }
});

export const registerCommunicationDevice = onRequest({region:'northamerica-northeast2',timeoutSeconds:30,memory:'256MiB',cors:false}, async (request,response) => {
  appCors(request, response);
  if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
  if (request.method !== 'POST') { response.status(405).json({success:false,error:'POST required.'}); return; }
  try {
    const installId=clean(request.body?.installId,100), token=clean(request.body?.token,4096);
    if (!/^[a-f0-9-]{20,100}$/i.test(installId)) throw new Error('Invalid app installation.');
    const ref=db.collection('communicationDevices').doc(installId);
    if (token) {
      const platform=['android','ios','web'].includes(clean(request.body?.platform,20).toLowerCase())
        ? clean(request.body?.platform,20).toLowerCase()
        : 'unknown';
      await ref.set({token,platform,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      response.json({success:true,registered:true}); return;
    }
    const bearer=String(request.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if (!bearer) throw new Error('Sign in is required.');
    const decoded=await getAuth().verifyIdToken(bearer), userId=principalId(decoded), user=(await db.collection('users').doc(userId).get()).data();
    if (!isActiveUser(user)) throw new Error('Active membership is required.');
    await ref.set({userId,authUid:decoded.uid,enabled:request.body?.notifications!==false,bubbles:request.body?.bubbles!==false,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    response.json({success:true,attached:true});
  } catch(error) { response.status(400).json({success:false,error:error.message}); }
});

export const reconcileCommunicationGroups = onRequest({region:'northamerica-northeast2',timeoutSeconds:60,memory:'256MiB',cors:false},async(request,response)=>{
  appCors(request, response); if(request.method==='OPTIONS'){response.status(204).send('');return;}
  try{const bearer=String(request.get('authorization')||'').replace(/^Bearer\s+/i,''),decoded=await getAuth().verifyIdToken(bearer),user=(await db.collection('users').doc(principalId(decoded)).get()).data();if(!isFullAdministrator(user))throw new Error('Administrator access required.');const productionId=clean(request.body?.productionId,120);if(!productionId)throw new Error('Production is required.');if(Array.isArray(request.body?.assignments)){const batch=db.batch();for(const item of request.body.assignments.slice(0,500)){const uid=clean(item.userId,120);if(uid)batch.set(db.collection('productions').doc(productionId).collection('communicationAssignments').doc(uid),{userId:uid,spaceKeys:validCommunicationSpaceKeys(item.spaceKeys),updatedAt:FieldValue.serverTimestamp()},{merge:true});}await batch.commit();}response.json({success:true,...await reconcileCommunicationSpaces(productionId),fixedSpaces:fixedCommunicationSpaces.map(([id,title])=>({id,title}))});}catch(error){response.status(403).json({success:false,error:error.message});}
});

export const notifyCommunicationMessage = onDocumentCreated({
  document:'productions/{productionId}/communicationConversations/{conversationId}/messages/{messageId}',
  region:'northamerica-northeast2',memory:'256MiB'
}, async event => {
  const message=event.data?.data(); if (!message) return;
  const {productionId,conversationId}=event.params;
  const roomRef=db.collection('productions').doc(productionId).collection('communicationConversations').doc(conversationId);
  const roomSnap=await roomRef.get();
  if (!roomSnap.exists) return;
  await roomRef.set({
    lastMessage:String(message.text||'').slice(0,180),
    lastMessageAt:message.createdAt||FieldValue.serverTimestamp(),
    lastSenderId:String(message.senderId||''),
    lastSenderName:String(message.senderName||'Member'),
    updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  const room=roomSnap.data(), recipients=(room.memberIds||[]).filter(id=>id!==message.senderId);
  if (!recipients.length) return;
  const [devices,settings]=await Promise.all([
    db.collection('communicationDevices').where('userId','in',recipients.slice(0,30)).get(),
    Promise.all(recipients.map(id=>db.collection('productions').doc(productionId).collection('communicationSettings').doc(id).get()))
  ]);
  const muted=new Set(settings.filter(s=>s.exists && s.data().notifications===false).map(s=>s.id));
  const targets=devices.docs.filter(d=>d.data().enabled!==false&&!muted.has(d.data().userId)&&d.data().token);
  if (!targets.length) return;
  const data={type:'communication',productionId,conversationId,messageId:event.params.messageId,
    conversationTitle:String(room.title||'Bedford Musical'),senderName:String(message.senderName||'New message'),body:String(message.text||'New message').slice(0,500)};
  const result=await getMessaging().sendEach(targets.map(device=>({token:device.data().token,data:{...data,bubbles:String(device.data().bubbles!==false)},android:{priority:'high'}})));
  const batch=db.batch(); result.responses.forEach((r,i)=>{if(!r.success&&/registration-token-not-registered|invalid-registration-token/.test(r.error?.code||''))batch.delete(targets[i].ref);});
  await batch.commit();
});
