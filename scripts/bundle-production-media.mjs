// Release-time export only. Runtime playback never contacts these services.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const project = 'brpa-digital-hub-dev';
const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
const bucket = `${project}.firebasestorage.app`;
const output = path.resolve('mobile-app/assets/offline');
const cache = path.resolve('backups/offline-media-source');
fs.mkdirSync(output,{recursive:true});
fs.mkdirSync(cache,{recursive:true});
const config = JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/configstore/firebase-tools.json')));
const auth = require(path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/auth.js'));
const token = (await auth.getAccessToken(config.tokens.refresh_token,[])).access_token;
async function request(url) {
  const r = await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw Error(`Media export failed: HTTP ${r.status}`);
  return r;
}
function decode(v) {
  if(v.stringValue!==undefined)return v.stringValue;
  if(v.integerValue!==undefined)return Number(v.integerValue);
  if(v.doubleValue!==undefined)return v.doubleValue;
  if(v.booleanValue!==undefined)return v.booleanValue;
  if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);
  if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));
  return v.timestampValue||null;
}
async function collection(name) {
  const rows=[];let next='';
  do {
    const url=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/productions/${productionId}/${name}?pageSize=1000${next?'&pageToken='+encodeURIComponent(next):''}`;
    const body=await (await request(url)).json();
    rows.push(...(body.documents||[]).map(d=>({_id:d.name.split('/').pop(),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]))})));
    next=body.nextPageToken;
  }while(next);
  return rows;
}
const [trackRows,assetRows,syncRows] = await Promise.all([collection('tracks'),collection('storageAssets'),collection('scoreFlowSync')]);
let next='', documentRows=[];
do {
  const body=await (await request(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodeURIComponent('production-documents/'+productionId+'/')}&maxResults=1000${next?'&pageToken='+encodeURIComponent(next):''}`)).json();
  documentRows.push(...(body.items||[]));next=body.nextPageToken;
}while(next);
const assetById=new Map(assetRows.map(row=>[row._id,row]));
const list = value => typeof value==='string' ? JSON.parse(value||'[]') : value||[];
const tracks = trackRows.filter(row=>(row.status||row.Status)==='Published').map(row=>{
  if(list(row.userIDsJSON||row.UserIDsJSON).length||list(row.departmentIDsJSON||row.DepartmentIDsJSON).length)throw Error('A restricted track requires review before including it in a shared app build.');
  const driveId=row.driveFileID||row.DriveFileID, asset=assetById.get(driveId);
  if(!asset?.storagePath||!asset.sha256)throw Error(`Missing verified audio: ${row._id}`);
  const order=Number(row.sortOrder??row.SortOrder);
  if(!Number.isInteger(order)||order<1||order>46)throw Error(`Unknown song mapping: ${row._id}`);
  return {id:row._id,title:row.title||row.Title,type:row.trackType||row.TrackType,
    order,scoreDocumentId:row.scoreDocumentId||row.ScoreDocumentID||`descendants-song-${String(order).padStart(2,'0')}`,
    driveFileId:driveId,notes:row.notes||row.Notes||'',assetKey:row._id,
    source:{path:asset.storagePath,bytes:Number(asset.bytes),sha256:asset.sha256,mimeType:asset.mimeType}};
}).sort((a,b)=>a.order-b.order||a.type.localeCompare(b.type));
if(tracks.length!==92)throw Error(`Expected the reviewed 92-track production, found ${tracks.length}; review the catalog before exporting.`);
const documents=documentRows.filter(row=>/\/descendants-(?:libretto|music|script|song-\d{2})\.pdf$/.test(row.name)).map(row=>({
  id:path.basename(row.name,'.pdf'),assetKey:path.basename(row.name,'.pdf'),
  source:{path:row.name,bytes:Number(row.size),md5Hash:row.md5Hash,mimeType:'application/pdf'},
})).sort((a,b)=>a.id.localeCompare(b.id));
if(documents.length!==49)throw Error(`Expected 49 production documents, found ${documents.length}.`);
const manifest={schemaVersion:1,productionId,exportedAt:new Date().toISOString(),tracks:[],documents:[],sync:{},assets:{}};
const jobs=[...tracks,...documents];let completed=0;
async function bundle(item) {
  if(!/^[A-Za-z0-9_-]+$/.test(item.assetKey))throw Error('Unsafe asset key');
  const file=path.join(cache,item.assetKey);
  if(!fs.existsSync(file)||fs.statSync(file).size!==item.source.bytes) {
    const r=await request(`https://storage.googleapis.com/download/storage/v1/b/${bucket}/o/${encodeURIComponent(item.source.path)}?alt=media`);
    await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file+'.partial'));
    fs.renameSync(file+'.partial',file);
  }
  const parts=[], sha=crypto.createHash('sha256'), md5=crypto.createHash('md5');let bytes=0, index=0;
  for await(const chunk of fs.createReadStream(file,{highWaterMark:16*1024*1024})) {
    const filename=`${item.assetKey}.${index++}.bin`;
    fs.writeFileSync(path.join(output,filename),chunk);
    sha.update(chunk);md5.update(chunk);bytes+=chunk.length;
    parts.push({path:`assets/offline/${filename}`,bytes:chunk.length,sha256:crypto.createHash('sha256').update(chunk).digest('hex')});
  }
  const sha256=sha.digest('hex'),md5Hash=md5.digest('base64');
  if(bytes!==item.source.bytes||(item.source.sha256&&sha256!==item.source.sha256)||(item.source.md5Hash&&md5Hash!==item.source.md5Hash))throw Error(`Integrity check failed for ${item.assetKey}`);
  manifest.assets[item.assetKey]={bytes,sha256,mimeType:item.source.mimeType,parts};
  console.log(`Bundled ${++completed}/${jobs.length}: ${item.assetKey}`);
}
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length)await bundle(jobs[cursor++]);}));
manifest.tracks=tracks.map(({source,...row})=>row);
manifest.documents=documents.map(({source,...row})=>row);
for(const row of syncRows) {
  if(!tracks.some(t=>t.id===row._id)||!Array.isArray(row.keyframes))continue;
  manifest.sync[row._id]={keyframes:row.keyframes.map(({timeMs,page,y,holdMs})=>({timeMs,page,y,holdMs})).filter(frame=>Number.isFinite(frame.timeMs))};
}
manifest.assets=Object.fromEntries(Object.entries(manifest.assets).sort(([a],[b])=>a.localeCompare(b)));
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({tracks:tracks.length,documents:documents.length,bytes:Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0),syncMaps:Object.keys(manifest.sync).length}));
