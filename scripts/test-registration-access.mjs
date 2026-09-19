import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const functions = read('functions/index.js');
const authSource = read('backend/appsscript/Auth.js');
const passwordSource = read('backend/appsscript/FirebasePasswordLogin.js');

// Exercise the actual registration handler with a failing secondary sync or
// failing primary commit. Only the latter may roll back the Firebase login.
async function registrationTest(commitFails) {
  const writes = [];
  let deleted = 0;
  const code = {status:'Active', uses:0, maxUses:250};
  const document = {id:'PROD-test', data:()=>code};
  const ref = {
    get:async()=>({exists:false, empty:false, docs:[document]}),
    where:()=>ref, limit:()=>ref, doc:()=>ref, collection:()=>ref,
  };
  document.ref = ref;
  const context = {
    onRequest:(_, handler)=>handler, syncKey:{value:()=> 'test-secret'},
    publicCors:()=>{}, clean:(v,n)=>String(v||'').trim().slice(0,n),
    db:{collection:()=>ref, batch:()=>({
      set:(...v)=>writes.push(v), update:()=>{},
      commit:async()=>{if(commitFails)throw Error('commit failed');},
    })},
    uuid:prefix=>`${prefix}-test`, getAuth:()=>({
      createUser:async()=>{}, deleteUser:async()=>{deleted++;},
    }),
    validCommunityPositionKeys:()=>[], validCommunicationSpaceKeys:()=>[],
    FieldValue:{increment:n=>n}, Buffer, crypto,
    reconcileCommunicationMember:async()=>{throw Error('sync unavailable');},
    console:{error:()=>{}},
  };
  vm.createContext(context);
  const source = functions.slice(functions.indexOf('export const registerStudent ='), functions.indexOf('export const communityAccess ='));
  vm.runInContext(source.replace('export const registerStudent', 'globalThis.handler'), context);
  let status = 200, result;
  const response = {status:n=>{status=n;return response;}, json:v=>{result=v;}};
  await context.handler({method:'POST',body:{username:'testuser',password:'test-password',registrationRequestId:'test-request-123456789012',registrationCode:'TEST',preferredDevice:'iphone'}},response);
  assert.equal(deleted, commitFails ? 1 : 0);
  assert.equal(result.success, !commitFails);
  assert.equal(status, commitFails ? 400 : 200);
  assert.ok(writes.length > 0);
}
await registrationTest(false);
await registrationTest(true);

// A successful Firebase password check must match the mirrored UID, not just
// return HTTP 200. Legacy password holders retain their existing sign-in.
const user = {UserID:'USR-test',Username:'testuser',Status:'Active',PasswordSalt:'salt',PasswordHash:'legacy-valid'};
let firebaseUid = 'USR-test', firebaseStatus = 200, passwordChecks = 0;
const gas = {
  normalizeLower_:v=>String(v).trim().toLowerCase(),
  assert_:(ok,message)=>{if(!ok)throw Error(message);},
  listRecords_:()=>[user], hashPassword_:p=>`legacy-${p}`,
  UrlFetchApp:{fetch:()=>{passwordChecks++;return {getResponseCode:()=>firebaseStatus,getContentText:()=>JSON.stringify({localId:firebaseUid})};}},
};
vm.createContext(gas);vm.runInContext(authSource+'\n'+passwordSource,gas);
Object.assign(gas,{
  randomToken_:()=> 'test-session',bool_:Boolean,uuid_:()=> 'session',
  appendRecord_:()=>{},updateRecordByRow_:()=>{},nowIso_:()=>new Date().toISOString(),
  buildUserContext_:()=>({userId:user.UserID}),cacheSessionContext_:()=>{},
  audit_:()=>{},safeJsonForClient_:v=>v,
});
assert.equal(gas.login_({username:'testuser',password:'valid'}).token,'test-session');
assert.equal(passwordChecks,0);
assert.equal(gas.login_({username:'testuser',password:'firebase-password'}).token,'test-session');
firebaseUid='USR-someone-else';
assert.throws(()=>gas.login_({username:'testuser',password:'firebase-password'}),/Incorrect/);
firebaseUid='USR-test';firebaseStatus=400;
assert.throws(()=>gas.login_({username:'testuser',password:'wrong'}),/Incorrect/);
user.Status='Disabled';
assert.throws(()=>gas.login_({username:'testuser',password:'valid'}),/not active/);
user.Status='Active';

// Recover a mirror interrupted after Users was saved, then retry without
// duplicating profiles, memberships, or registration-code usage.
const records = {Users:[user],Profiles:[],RegistrationCodes:[{Code:'TEST',PermissionGroupName:'Student',Uses:1}],PermissionGroups:[{GroupName:'Student',PermissionGroupID:'GROUP'}],UserPermissionGroups:[],Sessions:[]};
let unlocks=0,codeUpdates=0;
const pendingMirrors = new Map();
const registration={userId:'USR-test',profileId:'PROFILE',productionId:'PROD',registrationCode:'TEST',requestedDepartmentIds:[]};
Object.assign(gas,{
  firebaseMirrorSignature_:()=> 'signature',
  Utilities:{base64Decode:()=>Buffer.from(JSON.stringify(registration)),newBlob:b=>({getDataAsString:()=>b.toString()})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{unlocks++;}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>pendingMirrors.get(k),setProperty:(k,v)=>pendingMirrors.set(k,v),deleteProperty:k=>pendingMirrors.delete(k)})},
  resetRequestDataCache_:()=>{},
  listRecords_:(name,filter=()=>true)=>(records[name]||[]).filter(filter),
  appendRecord_:(name,row)=>records[name].push(row),
  getUserGroups_:()=>records.UserPermissionGroups,
  ensureSheetColumn_:()=>{},getActiveProduction_:()=>({DefaultTheme:'bedford-dark'}),
  normalize_:v=>v,createDepartmentRequestsForUser_:()=>{},
  updateRecordByRow_:()=>{codeUpdates++;},INSTALL_CONFIG:{sessionDays:14},
});
gas.completeFirebaseRegistration_({mirrorToken:'test',mirrorSignature:'signature'});
gas.completeFirebaseRegistration_({mirrorToken:'test',mirrorSignature:'signature'});
assert.equal(records.Profiles.length,1);assert.equal(records.UserPermissionGroups.length,1);
assert.equal(codeUpdates,0);assert.equal(unlocks,2);
assert.equal(pendingMirrors.size,0);
pendingMirrors.set('BRM_MIRROR_PENDING_USR-test',String(Date.now()));
assert.throws(()=>gas.completeFirebaseRegistration_({mirrorToken:'test',mirrorSignature:'signature'}),/still finishing/);
assert.equal(records.Profiles.length,1);

// Ensure the public wrapper actually forwards the caller's timeout to fetch.
const timers=[];
const api={window:{BRM_CONFIG:{API_URL:'https://script.google.com/macros/s/test/exec'},setTimeout:(_,ms)=>{timers.push(ms);return 1;},clearTimeout:()=>{}},AbortController,
  fetch:async()=>({json:async()=>({success:true})}),localStorage:{getItem:()=>null},console};
vm.createContext(api);vm.runInContext(read('assets/js/api.js'),api);
await api.window.BRM.api('completeFirebaseRegistration',{}, {public:true,timeoutMs:45000});
assert.equal(timers.at(-1),45000);

// Native webview tokens expire. A fresh token bypasses the browser SDK, while
// an expired token reconnects using the existing validated portal session.
const core=read('assets/js/core.js');
const tokenSource=core.slice(core.indexOf('  let firebaseReconnectPromise'),core.indexOf('  BRM.storeSessionContext'))
  .replaceAll('import(', 'loadModule(');
let nativeToken,bridges=0;
const browserAuth={currentUser:null,authStateReady:async()=>{}};
const sdk={getApps:()=>[{}],getApp:()=>({}),getAuth:()=>browserAuth,
  signInWithCustomToken:async()=>{browserAuth.currentUser={uid:'USR-test',getIdToken:async()=> 'refreshed-token'};}};
const browser={BRM:{getStoredContext:()=>({userId:'USR-test'}),getSessionValue:()=> 'portal-session'},CONFIG:{FIREBASE_APP_SIGN_IN_URL:'https://example.test/bridge'},
  window:{BRM_CONFIG:{FIREBASE:{}},setTimeout:()=>1,clearTimeout:()=>{}},
  sessionStorage:{getItem:()=>nativeToken,setItem:()=>{}},localStorage:{getItem:()=> 'flutter'},
  loadModule:async()=>sdk,atob,AbortController,
  fetch:async()=>{bridges++;return {ok:true,json:async()=>({customToken:'custom-token'})};},
};
vm.createContext(browser);vm.runInContext(tokenSource,browser);
const jwt=seconds=>`header.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url')}.signature`;
nativeToken=jwt(3600);assert.equal(await browser.BRM.firebaseIdToken(),nativeToken);assert.equal(bridges,0);
nativeToken=jwt(-60);assert.equal(await browser.BRM.firebaseIdToken(),'refreshed-token');assert.equal(bridges,1);

// Public recruitment calls are rejected, while an administrator can still
// load the retained booking/interest review data.
let administrator = false, bearer = '';
const recruitmentRef = {collection:()=>recruitmentRef,doc:()=>recruitmentRef,where:()=>recruitmentRef,
  get:async()=>({data:()=>({slots:[]}),docs:[]})};
const recruitment = {onRequest:(_,handler)=>handler,appCors:()=>{},clean:v=>String(v||''),
  activeProductionDocument:async()=>({id:'PROD',ref:recruitmentRef}),
  getAuth:()=>({verifyIdToken:async token=>{if(!token)throw Error('Sign in required');return {uid:'USER'};}}),
  principalId:d=>d.uid,db:{collection:()=>recruitmentRef},
  isFullAdministrator:()=>administrator,recruitmentDetails:{},legacyClientRecord:v=>v,
};
vm.createContext(recruitment);
vm.runInContext(functions.slice(functions.indexOf('export const recruitment ='),functions.indexOf('export const portalData =')).replace('export const recruitment','globalThis.handler'),recruitment);
async function recruitmentCall(action) {
  let result;
  const response={set:()=>{},status:()=>response,json:v=>{result=v;}};
  await recruitment.handler({method:'POST',body:{action},get:()=>bearer},response);
  return result;
}
for(const action of ['publicRecruitmentConfig','submitAuditionBooking','submitMusicalInterest']) {
  assert.equal((await recruitmentCall(action)).success,false);
  bearer='Bearer student';assert.equal((await recruitmentCall(action)).success,false);
  bearer='';
}
bearer='Bearer admin';administrator=true;
assert.equal((await recruitmentCall('recruitmentAdminData')).success,true);
assert.equal((await recruitmentCall('publicRecruitmentConfig')).success,true);
assert.doesNotMatch(read('index.html'),/href="(?:book-an-audition|interested-in-musical)\.html"/);
console.log('Registration/access regressions passed: rollback, UID verification, partial mirror recovery, timeouts, expired mobile tokens, and administrator-only recruitment.');
