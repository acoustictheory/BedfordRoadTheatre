// Publish an immutable large APK to the project's existing Firebase Storage.
// Neocities serves the install page and release descriptor, not this binary.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const versionLine=fs.readFileSync('mobile-app/pubspec.yaml','utf8').match(/^version:\s*(\S+)/m)?.[1];
if(!versionLine)throw Error('No app version');
const [version,buildNumber]=versionLine.split('+');
const filename=`BedfordRoadMusical-${version}.apk`,file=path.resolve('downloads',filename);
const bucket='brpa-digital-hub-dev.firebasestorage.app',object=`app-releases/${filename}`;
const size=fs.statSync(file).size;
async function digest(file) {const hash=crypto.createHash('sha256');for await(const part of fs.createReadStream(file))hash.update(part);return hash.digest('hex');}
const sha256=await digest(file),mediaManifestSha256=await digest('mobile-app/assets/offline/manifest.json');
const manifest=JSON.parse(fs.readFileSync('mobile-app/assets/offline/manifest.json'));
const config=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/configstore/firebase-tools.json')));
const auth=require(path.join(process.env.APPDATA||'','npm/node_modules/firebase-tools/lib/auth.js'));
const token=(await auth.getAccessToken(config.tokens.refresh_token,[])).access_token;
const headers={Authorization:`Bearer ${token}`};
const existing=await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}`,{headers});
let downloadToken;
if(existing.ok) {
  const metadata=await existing.json();
  if(metadata.metadata?.sha256!==sha256||Number(metadata.size)!==size)throw Error('This release version already exists with different contents. Bump the app version.');
  downloadToken=metadata.metadata.firebaseStorageDownloadTokens;
} else {
  if(existing.status!==404)throw Error(`Could not inspect release storage: ${existing.status}`);
  downloadToken=crypto.randomUUID();
  const start=await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable&ifGenerationMatch=0&name=${encodeURIComponent(object)}`,{
    method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':'application/vnd.android.package-archive','X-Upload-Content-Length':String(size)},
    body:JSON.stringify({name:object,contentType:'application/vnd.android.package-archive',contentDisposition:`attachment; filename="${filename}"`,cacheControl:'public,max-age=31536000,immutable',metadata:{firebaseStorageDownloadTokens:downloadToken,sha256,version,buildNumber}}),
  });
  if(!start.ok||!start.headers.get('location'))throw Error(`Could not start release upload: ${start.status}`);
  let sent=0,lastReport=0;const stream=fs.createReadStream(file);
  stream.on('data',part=>{sent+=part.length;if(sent-lastReport>100*1024*1024){lastReport=sent;console.log(`Uploading APK: ${Math.round(sent/size*100)}%`);}});
  const uploaded=await fetch(start.headers.get('location'),{method:'PUT',headers:{'Content-Type':'application/vnd.android.package-archive','Content-Length':String(size)},body:stream,duplex:'half',signal:AbortSignal.timeout(600000)});
  if(!uploaded.ok)throw Error(`Release upload failed: ${uploaded.status}`);
}
if(!downloadToken)throw Error('The release has no download token.');
const url=`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(object)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
console.log('Verifying the public APK download...');
const remote=await fetch(url,{signal:AbortSignal.timeout(600000)});
if(!remote.ok)throw Error(`Public download failed: ${remote.status}`);
const hash=crypto.createHash('sha256');let received=0,lastReport=0;
for await(const part of remote.body){hash.update(part);received+=part.length;if(received-lastReport>100*1024*1024){lastReport=received;console.log(`Verifying APK: ${Math.round(received/size*100)}%`);}}
if(received!==size||hash.digest('hex')!==sha256)throw Error('Public APK verification failed.');
const release={version,buildNumber:Number(buildNumber),filename,url,bytes:size,sha256,mediaManifestSha256,tracks:manifest.tracks.length,documents:manifest.documents.length,mediaBytes:Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0)};
fs.writeFileSync('downloads/android-release.json',JSON.stringify(release,null,2)+'\n');
console.log(`Verified Android ${version}: ${size} bytes, SHA256 ${sha256}`);
