import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const spreadsheetId = process.env.BRM_SPREADSHEET_ID || '1Qbj_-F6rsn6PYhEnE4sda7XK8REKVPMPxquQIiEv4PU';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(process.argv[2] || `backups/pre-cutover-${stamp}`);
const dataDir = path.join(output, 'legacy-data');
const filesDir = path.join(output, 'drive-files');
fs.mkdirSync(dataDir, { recursive:true });
fs.mkdirSync(filesDir, { recursive:true });

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function safeName(value) { return String(value || 'file').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180); }
function deduplicate(headers) {
  const counts=new Map();
  return headers.map((header,index)=>{const base=String(header||`Column${index+1}`);const count=(counts.get(base)||0)+1;counts.set(base,count);return count===1?base:`${base}__duplicate_${count}`;});
}

const credentialsPath=path.join(os.homedir(),'.clasprc.json');
const credentials=JSON.parse(fs.readFileSync(credentialsPath,'utf8'));
const credentialName=process.env.BRM_GOOGLE_PROFILE || 'default';
const tokenProfile=credentials.tokens?.[credentialName] || Object.values(credentials.tokens||{})[0];
if(!tokenProfile?.refresh_token) throw new Error('Run clasp login before creating the live backup.');
const refreshResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:tokenProfile.client_id,client_secret:tokenProfile.client_secret,refresh_token:tokenProfile.refresh_token,grant_type:'refresh_token'})});
const refreshed=await refreshResponse.json();
if(!refreshResponse.ok||!refreshed.access_token) throw new Error(`Google authorization failed: ${refreshed.error_description||refreshed.error||refreshResponse.status}`);
const accessToken=refreshed.access_token;

async function google(url, options={}) {
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}});
  if(!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response;
}

let metadata;
try {
  metadata=await google(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,properties.timeZone,sheets.properties`).then(r=>r.json());
} catch (error) {
  if(!/sheets\.googleapis\.com|Sheets API|SERVICE_DISABLED/i.test(error.message)) throw error;
  console.warn(`Structured Sheets export unavailable: ${error.message}`);
  const info=await google(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id,name,mimeType,modifiedTime,size,md5Checksum&supportsAllDrives=true`).then(r=>r.json());
  const workbook=Buffer.from(await google(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`).then(r=>r.arrayBuffer()));
  const workbookName='bedford-road-theatre-live.xlsx';
  fs.writeFileSync(path.join(output,workbookName),workbook,{mode:0o600});
  const manifest={createdAt:new Date().toISOString(),source:{spreadsheetId,title:info.name,modifiedTime:info.modifiedTime,mimeType:info.mimeType},backupMode:'native-workbook-fallback',workbookName,workbookBytes:workbook.length,workbookSha256:sha256(workbook),structuredExportPending:true,reason:'Google Sheets API is disabled for the authorized OAuth project.'};
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(`Native workbook backup saved to ${output}`);
  console.log(`Workbook SHA-256 ${manifest.workbookSha256}`);
  process.exit(0);
}
const database={};
const tableManifest=[];
for(const sheet of metadata.sheets||[]) {
  const title=sheet.properties.title;
  const encoded=encodeURIComponent(`'${title.replaceAll("'","''")}'`);
  const result=await google(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encoded}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`).then(r=>r.json());
  const values=result.values||[],headers=deduplicate(values[0]||[]);
  const records=values.slice(1).filter(row=>row.some(value=>value!==''&&value!==null&&value!==undefined)).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])));
  database[title]={headers,records};
  const bytes=Buffer.from(JSON.stringify({headers,records},null,2));
  fs.writeFileSync(path.join(dataDir,`${safeName(title)}.json`),bytes);
  tableManifest.push({title,rows:records.length,columns:headers.length,sha256:sha256(bytes)});
  console.log(`Saved ${title}: ${records.length} rows`);
}
const databaseBytes=Buffer.from(JSON.stringify(database,null,2));
fs.writeFileSync(path.join(dataDir,'complete-database.json'),databaseBytes,{mode:0o600});

const fileIds=new Set();
for(const table of Object.values(database)) for(const record of table.records) for(const [key,value] of Object.entries(record)) {
  if(/(?:Drive)?FileID$/i.test(key)&&String(value||'').trim()) fileIds.add(String(value).trim());
}
const fileManifest=[];
for(const [index,fileId] of [...fileIds].entries()) {
  try {
    const info=await google(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,md5Checksum,modifiedTime,trashed&supportsAllDrives=true`).then(r=>r.json());
    let url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,extension='';
    if(String(info.mimeType).startsWith('application/vnd.google-apps.')) { url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application%2Fpdf`;extension='.pdf'; }
    const bytes=Buffer.from(await google(url).then(r=>r.arrayBuffer()));
    const name=`${safeName(fileId)}--${safeName(info.name)}${extension}`;
    fs.writeFileSync(path.join(filesDir,name),bytes);
    fileManifest.push({...info,backupName:name,backupBytes:bytes.length,backupSha256:sha256(bytes),status:'saved'});
    console.log(`Saved Drive file ${index+1}/${fileIds.size}: ${info.name}`);
  } catch(error) {
    fileManifest.push({id:fileId,status:'failed',error:error.message});
    console.warn(`Could not save Drive file ${fileId}: ${error.message}`);
  }
}

const manifest={createdAt:new Date().toISOString(),source:{spreadsheetId,title:metadata.properties?.title,timeZone:metadata.properties?.timeZone},tables:tableManifest.length,rows:tableManifest.reduce((sum,item)=>sum+item.rows,0),databaseSha256:sha256(databaseBytes),tableManifest,referencedDriveFiles:fileIds.size,savedDriveFiles:fileManifest.filter(item=>item.status==='saved').length,failedDriveFiles:fileManifest.filter(item=>item.status==='failed'),fileManifest};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Backup saved to ${output}`);
console.log(`Database SHA-256 ${manifest.databaseSha256}`);
if(manifest.failedDriveFiles.length) process.exitCode=2;
