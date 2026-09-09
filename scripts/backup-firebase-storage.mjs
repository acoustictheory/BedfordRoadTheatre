import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const bucket=process.env.BRM_FIREBASE_BUCKET||'brpa-digital-hub-dev.firebasestorage.app';
const output=path.resolve(process.argv[2]||`backups/storage-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const filesRoot=path.join(output,'objects');fs.mkdirSync(filesRoot,{recursive:true});
function authModule(){const root=process.platform==='win32'?path.join(process.env.APPDATA||'','npm','node_modules'):'/usr/local/lib/node_modules';return require(path.join(root,'firebase-tools','lib','auth.js'));}
async function token(){const config=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config','configstore','firebase-tools.json'),'utf8'));const result=await authModule().getAccessToken(config.tokens?.refresh_token,[]);if(!result.access_token)throw new Error('Run firebase login first.');return result.access_token;}
const accessToken=await token();
async function request(url){const response=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});if(!response.ok)throw new Error(`${response.status}: ${await response.text()}`);return response;}
let pageToken='',objects=[];
do{const url=new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);url.searchParams.set('maxResults','1000');if(pageToken)url.searchParams.set('pageToken',pageToken);const body=await request(url).then(r=>r.json());objects.push(...(body.items||[]));pageToken=body.nextPageToken||'';}while(pageToken);
const manifest=[];let totalBytes=0;
for(const [index,object] of objects.entries()){
  const relative=object.name.split('/').map(part=>part==='..'?'_':part).join(path.sep);const destination=path.join(filesRoot,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
  const bytes=Buffer.from(await request(`https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object.name)}?alt=media`).then(r=>r.arrayBuffer()));
  fs.writeFileSync(destination,bytes);const digest=crypto.createHash('sha256').update(bytes).digest('hex');totalBytes+=bytes.length;
  manifest.push({name:object.name,contentType:object.contentType||'',size:Number(object.size||0),generation:object.generation||'',updated:object.updated||'',md5Hash:object.md5Hash||'',crc32c:object.crc32c||'',backupBytes:bytes.length,backupSha256:digest,sizeMatches:Number(object.size||0)===bytes.length});
  console.log(`Saved Storage object ${index+1}/${objects.length}: ${object.name}`);
}
const failed=manifest.filter(item=>!item.sizeMatches);const summary={bucket,exportedAt:new Date().toISOString(),objects:manifest.length,bytes:totalBytes,failedSizeChecks:failed.map(item=>item.name),valid:failed.length===0,manifest};
const summaryBytes=Buffer.from(JSON.stringify(summary,null,2));fs.writeFileSync(path.join(output,'storage-manifest.json'),summaryBytes);console.log(JSON.stringify({bucket:summary.bucket,objects:summary.objects,bytes:summary.bytes,valid:summary.valid,manifestSha256:crypto.createHash('sha256').update(summaryBytes).digest('hex')},null,2));if(!summary.valid)process.exitCode=1;
