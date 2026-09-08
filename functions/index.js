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
  'PropsPresets','PropsDeadlines','PropsImages','PropsSuggestions','PropsActivity','RegistrationCodes','Users','Profiles','Departments'
]);
const globalTables = new Set(['RegistrationCodes','Users','Profiles']);
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
const communityPositionCatalog = [
  ['principal-cast','Principal Cast',['general-cast']],['ensemble-cast','Ensemble Cast',['general-cast']],
  ['featured-dancer','Featured Dancer',['general-cast','featured-dancers','choreography']],['student-choreographer','Student Choreographer',['choreography']],
  ['stage-manager','Stage Manager',['stage-crew']],['assistant-stage-manager','Assistant Stage Manager',['stage-crew']],
  ['scenic-painter','Scenic Painter',['scenic-painting']],['hair-makeup-crew','Hair & Makeup Crew',['hair-makeup']],
  ['projections-video-crew','Projections & Video Crew',['projections-video']],['photography-videography-crew','Photography & Videography Crew',['photography-videography']],
  ['tickets-box-office-crew','Tickets & Box Office Crew',['tickets-box-office']],['wardrobe-crew','Wardrobe Crew',['wardrobe-crew']],
  ...['keyboard-1','keyboard-2','keyboard-3','drums','flute','oboe','clarinet','tenor-sax','violin','cello','guitar-1','guitar-2','bass','trumpet']
    .map(key=>[`pit-${key}`,`Pit · ${key.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ')}`,['pit-orchestra']])
].map(([key,label,spaceKeys])=>({key,label,spaceKeys}));
const communityPositionMap = new Map(communityPositionCatalog.map(position=>[position.key,position]));
const communitySpacePolicies = Object.fromEntries(fixedCommunicationSpaces.map(([key,title])=>[key,{
  key,title,mode:key==='pit-orchestra'?'invite-only':key==='musical-theatre'||key==='theatre-arts'?'automatic':'requestable',
  restricted:key==='pit-orchestra'
}]));
function validCommunityPositionKeys(keys) { return [...new Set(Array.isArray(keys)?keys.map(String):[])].filter(key=>communityPositionMap.has(key)); }
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
  const [memberships,assignments,users,profiles]=await Promise.all([
    production.collection('userDepartments').get(),production.collection('communicationAssignments').get(),db.collection('users').get(),db.collection('profiles').get()
  ]);
  const admins=users.docs.filter(d=>isFullAdministrator(d.data())).map(d=>d.id);
  const byDepartment=new Map(); memberships.docs.forEach(d=>{const row=d.data();if(String(row.status||'Active')!=='Active')return;const key=String(row.departmentID||row.departmentId||'');if(key)(byDepartment.get(key)||byDepartment.set(key,[]).get(key)).push(String(row.userID||row.userId||''));});
  const assigned=new Map([...fixedCommunicationSpaces.map(([key])=>[key,[]]),['general-cast',[]]]); assignments.docs.forEach(d=>{const row=d.data(),uid=String(row.userId||d.id),blocked=new Set(validCommunicationSpaceKeys(row.blockedSpaceKeys));for(const rawKey of row.spaceKeys||[]){const key=normalizeCommunicationSpaceKey(rawKey);if(assigned.has(key)&&!blocked.has(key))assigned.get(key).push(uid);}for(const positionKey of validCommunityPositionKeys(row.positionKeys)){for(const key of communityPositionMap.get(positionKey).spaceKeys){const normalized=normalizeCommunicationSpaceKey(key);if(assigned.has(normalized)&&!blocked.has(normalized))assigned.get(normalized).push(uid);}}});
  const spaces=[],generalCastMembers=[...(assigned.get('general-cast')||[])];
  departments.docs.forEach(d=>{const row=d.data(),status=row.status||row.Status,slug=String(row.slug||row.Slug||'').toLowerCase();if(status!=='Active'||slug==='administration'||slug==='directing')return;const sourceId=row.departmentID||row.DepartmentID||d.id,members=byDepartment.get(String(sourceId))||[];if(slug==='ensemble'||slug==='principal-cast'||slug==='general-cast'){generalCastMembers.push(...members);return;}const fixedKey=normalizeCommunicationSpaceKey(slug);if(assigned.has(fixedKey)){assigned.get(fixedKey).push(...members);return;}const category=slug==='pit-orchestra'?'ensemble':'production';spaces.push({key:`department-${slug}`,title:communicationNameMap[slug]||row.name||row.Name||slug,category,sourceType:'department',sourceId,members});});
  spaces.push({key:'ensemble-general-cast',title:'Cast',category:'ensemble',sourceType:'ensemble',sourceId:'general-cast',members:generalCastMembers});
  fixedCommunicationSpaces.forEach(([key,title])=>{const category=key==='musical-theatre'||key==='theatre-arts'?'class':key==='choreography'||key==='featured-dancers'||key==='pit-orchestra'?'ensemble':'production';spaces.push({key:`assignment-${key}`,title,category,sourceType:'assignment',sourceId:key,members:assigned.get(key)||[]});});
  const batch=db.batch(),now=FieldValue.serverTimestamp(),roomCollection=production.collection('communicationConversations'),desiredIds=new Set(spaces.map(space=>`space-${space.key}`));
  const profilesByUser=new Map(); profiles.docs.forEach(document=>{const profile=document.data(),id=String(profile.userID||profile.UserID||document.id);if(id)profilesByUser.set(id,profile);});
  const departmentsById=new Map(); departments.docs.forEach(document=>{const row=document.data(),id=String(row.departmentID||row.DepartmentID||document.id);departmentsById.set(id,row);});
  const membershipsByUser=new Map(); memberships.docs.forEach(document=>{const row=document.data(),id=String(row.userID||row.userId||'');if(!id||String(row.status||row.Status||'Active').toLowerCase()!=='active')return;(membershipsByUser.get(id)||membershipsByUser.set(id,[]).get(id)).push(row);});
  const assignmentsByUser=new Map(assignments.docs.map(document=>[String(document.data().userId||document.id),document.data()]));
  const memberUpdates=[];
  users.docs.forEach(document=>{const account=document.data(),id=document.id,profile=profilesByUser.get(id)||{},membershipRows=membershipsByUser.get(id)||[],assignment=assignmentsByUser.get(id)||{};const firstName=clean(profile.firstName||profile.FirstName,80),lastName=clean(profile.lastName||profile.LastName,80),assembledName=`${firstName} ${lastName}`.trim(),displayName=clean(assembledName||profile.displayName||profile.DisplayName||account.username||account.Username||id,120)||id;memberUpdates.push({ref:db.collection('communityMembers').doc(id),data:{userId:id,username:clean(account.username||account.Username,80),displayName,firstName,lastName,photoURL:clean(profile.photoURL||profile.PhotoURL,2000),photoFileID:clean(profile.photoFileID||profile.PhotoFileID,300),pronouns:clean(profile.pronouns||profile.Pronouns,80),grade:clean(profile.grade||profile.Grade,40),status:isActiveUser(account)?'Active':'Disabled',administrator:isFullAdministrator(account),departments:membershipRows.map(row=>{const departmentId=String(row.departmentID||row.DepartmentID||''),department=departmentsById.get(departmentId)||{};return {id:departmentId,name:clean(department.name||department.Name,120),role:clean(row.roleLabel||row.RoleLabel||'Member',120)};}),positionKeys:validCommunityPositionKeys(assignment.positionKeys),spaceKeys:validCommunicationSpaceKeys(assignment.spaceKeys),updatedAt:now}});});
  for(let offset=0;offset<memberUpdates.length;offset+=400){const identityBatch=db.batch();memberUpdates.slice(offset,offset+400).forEach(item=>identityBatch.set(item.ref,item.data,{merge:true}));await identityBatch.commit();}
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
    const [profiles,productions] = await Promise.all([db.collection('profiles').where('UserID', '==', userId).get(),db.collection('productions').get()]);
    const cleanup = db.batch();
    cleanup.delete(db.collection('users').doc(userId));
    cleanup.delete(db.collection('profiles').doc(userId));
    cleanup.delete(db.collection('communityMembers').doc(userId));
    profiles.docs.forEach(document => cleanup.delete(document.ref));
    await cleanup.commit();
    for(const production of productions.docs){const rooms=await production.ref.collection('communicationConversations').where('memberIds','array-contains',userId).get(),roomCleanup=db.batch();roomCleanup.delete(production.ref.collection('communicationAssignments').doc(userId));rooms.docs.forEach(room=>roomCleanup.set(room.ref,{memberIds:FieldValue.arrayRemove(userId),updatedAt:FieldValue.serverTimestamp()},{merge:true}));await roomCleanup.commit();}
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
  if(productionId&&['Users','Profiles','UserDepartments','Departments'].includes(table)) communicationSync=await reconcileCommunicationSpaces(productionId);
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
      const requestedPositions=validCommunityPositionKeys(body.requestedPositionKeys);
      const preferredDevice=['iphone','ipad','android-phone','android-tablet','none'].includes(clean(body.preferredDevice,30))?clean(body.preferredDevice,30):'';
      if(!preferredDevice) throw new Error('Choose the device you will use for the Bedford app.');
      const mirror = {requestId,userId:uid,profileId,productionId,username,email:clean(body.email,160).toLowerCase(),firstName:clean(body.firstName,80),lastName:clean(body.lastName,80),displayName:clean(body.displayName || `${body.firstName || ''} ${body.lastName || ''}`,120),preferredDevice,registrationCode:code,requestedDepartmentIds:requested,departmentRequestNote:clean(body.departmentRequestNote,500),createdAt:now};
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
        for(const positionKey of requestedPositions){const position=communityPositionMap.get(positionKey),requestDocument=db.collection('productions').doc(productionId).collection('communityAccessRequests').doc();transaction.set(requestDocument,{userId:uid,positionKey,spaceKey:position.spaceKeys[0],reason:clean(body.communityRequestNote||body.departmentRequestNote,500),status:'Pending',source:'registration',createdAt:now,updatedAt:now});}
      });
      await reconcileCommunicationSpaces(productionId);
      response.json(publicResult);
    } catch (error) { await getAuth().deleteUser(uid).catch(()=>{}); throw error; }
  } catch (error) {
    const duplicate = error.code === 'auth/email-already-exists' || error.code === 'auth/uid-already-exists';
    response.status(duplicate ? 409 : 400).json({success:false,error:duplicate?'That username is already registered. Sign in or ask an administrator for help.':error.message});
  }
});

export const communityAccess = onRequest({region:'northamerica-northeast2',timeoutSeconds:60,memory:'256MiB',cors:false},async(request,response)=>{
  appCors(request,response);response.set('Cache-Control','no-store');
  if(request.method==='OPTIONS'){response.status(204).send('');return;}if(request.method!=='POST'){response.status(405).json({success:false,error:'POST required.'});return;}
  try{
    const bearer=String(request.get('authorization')||'').replace(/^Bearer\s+/i,''),decoded=await getAuth().verifyIdToken(bearer),uid=principalId(decoded),user=(await db.collection('users').doc(uid).get()).data();
    if(!isActiveUser(user))throw new Error('Active membership is required.');
    const productionId=clean(request.body?.productionId,128),action=clean(request.body?.action,40);if(!productionId)throw new Error('Production is required.');
    const production=db.collection('productions').doc(productionId),assignmentRef=production.collection('communicationAssignments').doc(uid),requests=production.collection('communityAccessRequests');
    if(action==='catalog'){
      const [assignmentSnap,requestSnap]=await Promise.all([assignmentRef.get(),requests.where('userId','==',uid).get()]);
      response.json({success:true,positions:communityPositionCatalog,spaces:Object.values(communitySpacePolicies),assignment:assignmentSnap.data()||{userId:uid,spaceKeys:[],positionKeys:[],blockedSpaceKeys:[]},requests:requestSnap.docs.map(d=>({id:d.id,...d.data()}))});return;
    }
    if(action==='request'){
      const positionKey=clean(request.body?.positionKey,80),spaceKey=normalizeCommunicationSpaceKey(clean(request.body?.spaceKey,80)),position=communityPositionMap.get(positionKey),policy=communitySpacePolicies[spaceKey];
      if(!position&&!policy)throw new Error('Choose a valid position or Space.');
      const effectiveSpace=position?.spaceKeys?.[0]||spaceKey,existing=await requests.where('userId','==',uid).get();
      if(existing.docs.some(d=>{const row=d.data();return positionKey?row.positionKey===positionKey:row.spaceKey===effectiveSpace;}))throw new Error('That request is already waiting for review.');
      const ref=await requests.add({userId:uid,positionKey:positionKey||'',spaceKey:effectiveSpace,reason:clean(request.body?.reason,500),status:'Pending',source:'community',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});response.json({success:true,requestId:ref.id});return;
    }
    if(!isFullAdministrator(user))throw new Error('Administrator access required.');
    if(action==='adminState'){
      const [assignmentSnap,requestSnap,userSnap,profileSnap]=await Promise.all([production.collection('communicationAssignments').get(),requests.get(),db.collection('users').get(),db.collection('profiles').get()]);
      const profiles=new Map(profileSnap.docs.map(d=>[String(d.data().userID||d.data().UserID||d.id),d.data()]));
      response.json({success:true,positions:communityPositionCatalog,spaces:Object.values(communitySpacePolicies),assignments:assignmentSnap.docs.map(d=>({id:d.id,...d.data()})),requests:requestSnap.docs.map(d=>({id:d.id,...d.data()})),people:userSnap.docs.filter(d=>isActiveUser(d.data())).map(d=>{const account=d.data(),profile=profiles.get(d.id)||{},username=account.username||account.Username||d.id,firstName=clean(profile.firstName||profile.FirstName,80),lastName=clean(profile.lastName||profile.LastName,80),assembled=`${firstName} ${lastName}`.trim(),displayName=clean(profile.displayName||profile.DisplayName,120),fullName=assembled||(displayName&&displayName.toLowerCase()!==String(username).toLowerCase()?displayName:'');return {id:d.id,name:fullName||username,fullName,username,photoURL:profile.photoURL||profile.PhotoURL||'',photoFileID:profile.photoFileID||profile.PhotoFileID||''};})});return;
    }
    if(action==='saveInvolvement'){
      const targetUserId=clean(request.body?.userId,128);if(!targetUserId)throw new Error('Choose a person.');
      await production.collection('communicationAssignments').doc(targetUserId).set({userId:targetUserId,positionKeys:validCommunityPositionKeys(request.body?.positionKeys),spaceKeys:validCommunicationSpaceKeys(request.body?.spaceKeys),blockedSpaceKeys:validCommunicationSpaceKeys(request.body?.blockedSpaceKeys),updatedAt:FieldValue.serverTimestamp(),updatedBy:uid},{merge:true});
      await reconcileCommunicationSpaces(productionId);response.json({success:true});return;
    }
    if(action==='saveSpaceMembership'){
      const spaceKey=normalizeCommunicationSpaceKey(clean(request.body?.spaceKey,80)),policy=communitySpacePolicies[spaceKey],memberIds=new Set((Array.isArray(request.body?.memberIds)?request.body.memberIds:[]).map(value=>clean(value,128)).filter(Boolean));
      if(!policy)throw new Error('Choose a valid Space.');
      const current=await production.collection('communicationAssignments').get();
      for(let offset=0;offset<current.docs.length;offset+=400){const batch=db.batch();for(const document of current.docs.slice(offset,offset+400)){const row=document.data(),keys=validCommunicationSpaceKeys(row.spaceKeys).filter(key=>key!==spaceKey);if(memberIds.has(document.id))keys.push(spaceKey);batch.set(document.ref,{userId:document.id,spaceKeys:[...new Set(keys)],updatedAt:FieldValue.serverTimestamp(),updatedBy:uid},{merge:true});memberIds.delete(document.id);}await batch.commit();}
      const remainingIds=[...memberIds];for(let offset=0;offset<remainingIds.length;offset+=400){const batch=db.batch();for(const id of remainingIds.slice(offset,offset+400))batch.set(production.collection('communicationAssignments').doc(id),{userId:id,spaceKeys:[spaceKey],positionKeys:[],blockedSpaceKeys:[],updatedAt:FieldValue.serverTimestamp(),updatedBy:uid},{merge:true});await batch.commit();}
      await reconcileCommunicationSpaces(productionId);response.json({success:true});return;
    }
    if(action==='review'){
      const requestId=clean(request.body?.requestId,128),decision=request.body?.decision==='Approved'?'Approved':'Declined',ref=requests.doc(requestId),snapshot=await ref.get();if(!snapshot.exists)throw new Error('Request not found.');const row=snapshot.data();
      if(decision==='Approved'){const target=production.collection('communicationAssignments').doc(row.userId);if(row.positionKey)await target.set({userId:row.userId,positionKeys:FieldValue.arrayUnion(row.positionKey),updatedAt:FieldValue.serverTimestamp(),updatedBy:uid},{merge:true});else if(row.spaceKey)await target.set({userId:row.userId,spaceKeys:FieldValue.arrayUnion(row.spaceKey),updatedAt:FieldValue.serverTimestamp(),updatedBy:uid},{merge:true});}
      await ref.set({status:decision,reviewNote:clean(request.body?.reviewNote,500),reviewedBy:uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});await reconcileCommunicationSpaces(productionId);response.json({success:true});return;
    }
    throw new Error('Unsupported access action.');
  }catch(error){response.status(403).json({success:false,error:error.message});}
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

export const openCommunicationDirect = onRequest({region:'northamerica-northeast2',timeoutSeconds:30,memory:'256MiB',cors:false},async(request,response)=>{
  appCors(request,response);
  response.set('Cache-Control','no-store');
  if(request.method==='OPTIONS'){response.status(204).send('');return;}
  if(request.method!=='POST'){response.status(405).json({success:false,error:'POST required.'});return;}
  try {
    const bearer=String(request.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if(!bearer) throw new Error('Sign in is required.');
    const decoded=await getAuth().verifyIdToken(bearer), callerId=principalId(decoded);
    const callerSnap=await db.collection('users').doc(callerId).get(), caller=callerSnap.data();
    if(!isActiveUser(caller)) throw new Error('Active membership is required.');
    const callerAdmin=isFullAdministrator(caller), [usersSnap,profilesSnap]=await Promise.all([db.collection('users').get(),db.collection('profiles').get()]);
    const activeUsers=usersSnap.docs.filter(document=>isActiveUser(document.data())&&document.id!==callerId);
    const allowedTargets=callerAdmin?activeUsers:activeUsers.filter(document=>isFullAdministrator(document.data()));
    const profilesByUser=new Map(); profilesSnap.docs.forEach(document=>{const profile=document.data(),id=clean(profile.userID||profile.UserID||document.id,128);if(id)profilesByUser.set(id,profile);});
    const targetRows=allowedTargets.map((document,index)=>{
      const user=document.data(), profile=profilesByUser.get(document.id)||{};
      const assembledName=`${profile.firstName||profile.FirstName||''} ${profile.lastName||profile.LastName||''}`.trim(),name=clean(profile.displayName||profile.DisplayName||assembledName||user.username||user.Username||document.id,120);
      return {id:document.id,name:name||document.id,photoURL:clean(profile.photoURL||profile.PhotoURL,2000),photoFileID:clean(profile.photoFileID||profile.PhotoFileID,300),administrator:isFullAdministrator(user)};
    }).sort((a,b)=>a.name.localeCompare(b.name));
    if(request.body?.action==='targets'){response.json({success:true,targets:targetRows});return;}
    const productionId=clean(request.body?.productionId,120), targetUserId=clean(request.body?.targetUserId,128);
    if(!productionId) throw new Error('Production is required.');
    const target=targetRows.find(item=>item.id===targetUserId);
    if(!target) throw new Error(callerAdmin?'Choose an active member.':'Private messages may only be started with an administrator.');
    const callerProfile=profilesByUser.get(callerId)||{};
    const callerAssembledName=`${callerProfile.firstName||callerProfile.FirstName||''} ${callerProfile.lastName||callerProfile.LastName||''}`.trim();
    const callerName=clean(callerProfile.displayName||callerProfile.DisplayName||callerAssembledName||caller.username||caller.Username||callerId,120)||callerId;
    const memberIds=[callerId,targetUserId].sort(), id=`direct-${crypto.createHash('sha256').update(memberIds.join('|')).digest('hex').slice(0,24)}`;
    const conversation={title:`${callerName} & ${target.name}`,type:'direct',description:'Private conversation',memberIds,adminIds:callerAdmin?[callerId]:[targetUserId],createdBy:callerId,status:'Active',category:'production',groupColor:'#6d4aff',groupSecondaryColor:'#b22a8f',groupTheme:'aurora',groupIcon:'💬',updatedAt:FieldValue.serverTimestamp()};
    const ref=db.collection('productions').doc(productionId).collection('communicationConversations').doc(id);
    const prior=await ref.get();
    await ref.set({...conversation,...(!prior.exists?{createdAt:FieldValue.serverTimestamp()}: {})},{merge:true});
    response.json({success:true,conversationId:id,conversation:{...conversation,updatedAt:new Date().toISOString(),createdAt:prior.exists?null:new Date().toISOString()}});
  } catch(error) { response.status(403).json({success:false,error:error.message||'Private messaging is unavailable.'}); }
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
  const recipientChunks=[];for(let offset=0;offset<recipients.length;offset+=30)recipientChunks.push(recipients.slice(offset,offset+30));
  const [deviceSnapshots,settings]=await Promise.all([
    Promise.all(recipientChunks.map(chunk=>db.collection('communicationDevices').where('userId','in',chunk).get())),
    Promise.all(recipients.map(id=>db.collection('productions').doc(productionId).collection('communicationSettings').doc(id).get()))
  ]);
  const muted=new Set(settings.filter(s=>s.exists && s.data().notifications===false).map(s=>s.id));
  const targets=deviceSnapshots.flatMap(snapshot=>snapshot.docs).filter(d=>d.data().enabled!==false&&!muted.has(d.data().userId)&&d.data().token);
  if (!targets.length) return;
  const data={type:'communication',productionId,conversationId,messageId:event.params.messageId,
    conversationTitle:String(room.title||'Bedford Musical'),senderName:String(message.senderName||'New message'),body:String(message.text||'New message').slice(0,500)};
  const result=await getMessaging().sendEach(targets.map(device=>({
    token:device.data().token,
    notification:{title:data.senderName,body:data.body},
    data:{...data,bubbles:String(device.data().bubbles!==false)},
    android:{
      priority:'high',
      notification:{channelId:'bedford_messages',sound:'default',tag:`community-${conversationId}`}
    },
    apns:{
      headers:{'apns-priority':'10','apns-push-type':'alert'},
      payload:{aps:{sound:'default','content-available':1,'thread-id':conversationId}}
    }
  })));
  const batch=db.batch(); result.responses.forEach((r,i)=>{if(!r.success&&/registration-token-not-registered|invalid-registration-token/.test(r.error?.code||''))batch.delete(targets[i].ref);});
  await batch.commit();
});
