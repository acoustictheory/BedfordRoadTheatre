import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const projectId=process.env.BRM_FIREBASE_PROJECT||'brpa-digital-hub-dev';
const databaseId='(default)';
const output=path.resolve(process.argv[2]||`backups/firestore-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const explicitParents=process.argv.slice(3).filter(Boolean);
fs.mkdirSync(output,{recursive:true});

function firebaseAuthModule(){const root=process.platform==='win32'?path.join(process.env.APPDATA||'','npm','node_modules'):'/usr/local/lib/node_modules';return require(path.join(root,'firebase-tools','lib','auth.js'));}
async function token(){const config=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config','configstore','firebase-tools.json'),'utf8'));const result=await firebaseAuthModule().getAccessToken(config.tokens?.refresh_token,[]);if(!result.access_token)throw new Error('Run firebase login first.');return result.access_token;}
const accessToken=await token();
const rootName=`projects/${projectId}/databases/${databaseId}/documents`;
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});const text=await response.text();let body={};try{body=text?JSON.parse(text):{};}catch{throw new Error(`${response.status}: Firestore returned a non-JSON response for ${url}`);}if(!response.ok)throw new Error(`${response.status}: ${body.error?.message||text}`);return body;}
function endpoint(documentPath=''){return `https://firestore.googleapis.com/v1/${rootName}${documentPath?`/${documentPath}`:''}`;}
async function collectionIds(parentPath=''){let pageToken='',result=[];do{const body=await api(`${endpoint(parentPath)}:listCollectionIds`,{method:'POST',body:JSON.stringify({pageSize:1000,...(pageToken?{pageToken}:{})})});result.push(...(body.collectionIds||[]));pageToken=body.nextPageToken||'';}while(pageToken);return result.sort();}
async function documents(parentPath,collectionId){let pageToken='',result=[];do{const base=`${endpoint(parentPath)}/${encodeURIComponent(collectionId)}?pageSize=300&showMissing=false`;const body=await api(pageToken?`${base}&pageToken=${encodeURIComponent(pageToken)}`:base);result.push(...(body.documents||[]));pageToken=body.nextPageToken||'';}while(pageToken);return result;}

const collections=[];let documentCount=0;
async function walk(parentPath=''){
  for(const collectionId of await collectionIds(parentPath)){
    const docs=await documents(parentPath,collectionId);const relative=parentPath?`${parentPath}/${collectionId}`:collectionId;
    collections.push({path:relative,documents:docs});documentCount+=docs.length;console.log(`Saved ${relative}: ${docs.length} documents`);
    for(const doc of docs){const docPath=doc.name.slice(rootName.length+1);await walk(docPath);}
  }
}
if(explicitParents.length) for(const parent of explicitParents) await walk(parent);
else await walk();
collections.sort((a,b)=>a.path.localeCompare(b.path));
const payload={format:'firestore-rest-v1',projectId,databaseId,exportedAt:new Date().toISOString(),explicitParents,collections};
const bytes=Buffer.from(JSON.stringify(payload,null,2));
fs.writeFileSync(path.join(output,'firestore-complete.json'),bytes,{mode:0o600});
const summary={projectId,databaseId,exportedAt:payload.exportedAt,collections:collections.length,documents:documentCount,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),collectionCounts:Object.fromEntries(collections.map(item=>[item.path,item.documents.length]))};
fs.writeFileSync(path.join(output,'firestore-manifest.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
