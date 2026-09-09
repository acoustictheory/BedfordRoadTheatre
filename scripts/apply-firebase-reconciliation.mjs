import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url),apply=process.argv.includes('--apply');
const backupRoot=path.resolve(process.argv.find(arg=>!arg.startsWith('--')&&arg!==process.argv[0]&&arg!==process.argv[1])||'backups/pre-cutover-20260908-202450');
function find(root,name){const stack=[root];while(stack.length){const current=stack.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=path.join(current,entry.name);if(entry.isDirectory())stack.push(target);else if(entry.name===name)return target;}}throw new Error(`${name} not found below ${root}`);}
const sourcePath=find(backupRoot,'complete-database.json'),source=JSON.parse(fs.readFileSync(sourcePath));
const projectId='brpa-digital-hub-dev',databaseId='(default)',rootName=`projects/${projectId}/databases/${databaseId}/documents`;
function authModule(){const root=process.platform==='win32'?path.join(process.env.APPDATA||'','npm','node_modules'):'/usr/local/lib/node_modules';return require(path.join(root,'firebase-tools','lib','auth.js'));}
async function token(){const config=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config','configstore','firebase-tools.json'),'utf8'));const result=await authModule().getAccessToken(config.tokens?.refresh_token,[]);if(!result.access_token)throw new Error('Run firebase login first.');return result.access_token;}
const accessToken=await token();
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});const text=await response.text();const body=text?JSON.parse(text):{};if(!response.ok)throw new Error(`${response.status}: ${body.error?.message||text}`);return body;}
function lowerCamel(value){const text=String(value);return /^[A-Z]+$/.test(text)?text.toLowerCase():text[0].toLowerCase()+text.slice(1);}
function normalize(row){const result={};for(const [key,value] of Object.entries(row)){if(key.includes('__duplicate_')||['PasswordHash','PasswordSalt'].includes(key))continue;let decoded=value;if(typeof value==='string'&&/JSON$/.test(key)&&value.trim()){try{decoded=JSON.parse(value);}catch{}}result[lowerCamel(key)]=decoded===''?null:decoded;}for(const key of ['ActionURL','DeadlineAt','Location']){const canonical=lowerCamel(key),duplicate=row[`${key}__duplicate_2`];if(!result[canonical]&&duplicate)result[canonical]=duplicate;}return result;}
function sourceId(row,index){const entry=Object.entries(row).find(([key,value])=>/ID$/.test(key)&&String(value||'').trim());return String(entry?.[1]||`row-${String(index+1).padStart(6,'0')}`).replaceAll('/','_');}
function fv(value){if(value===null||value===undefined||value==='')return {nullValue:null};if(typeof value==='boolean')return {booleanValue:value};if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};if(Array.isArray(value))return {arrayValue:{values:value.map(fv)}};if(typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,fv(item)]))}};return {stringValue:String(value)};}
const globalTables=new Set(['Settings','Productions','Users','Profiles','Departments','Permissions','PermissionGroups','GroupPermissions','RegistrationCodes']);
const productionId=(source.Productions?.records||[]).find(row=>String(row.Status).toLowerCase()==='active')?.ProductionID||(source.Productions?.records||[])[0]?.ProductionID;
const operations=[];const migratedAt=new Date().toISOString();
for(const [tableName,table] of Object.entries(source))for(const [index,row] of (table.records||[]).entries()){
  const collection=lowerCamel(tableName),parent=globalTables.has(tableName)?'':`productions/${productionId}/`,id=tableName==='Profiles'?String(row.UserID||sourceId(row,index)):sourceId(row,index),data={...normalize(row),_sourceTable:tableName,_migratedAt:migratedAt};
  operations.push({tableName,id,path:`${parent}${collection}/${id}`,write:{update:{name:`${rootName}/${parent}${collection}/${id}`,fields:Object.fromEntries(Object.entries(data).map(([key,value])=>[key,fv(value)]))},currentDocument:{exists:false}}});
}
if(!apply){console.log(JSON.stringify({mode:'dry-run',sourcePath,productionId,candidateCreates:operations.length,note:'Use --apply to create only documents that do not already exist.'},null,2));process.exit(0);}
let created=0,alreadyExists=0,failed=[];
for(let offset=0;offset<operations.length;offset+=250){const slice=operations.slice(offset,offset+250),result=await api(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents:batchWrite`,{method:'POST',body:JSON.stringify({writes:slice.map(item=>item.write)})});(result.status||[]).forEach((status,index)=>{if(!status.code)created++;else if(status.code===6)alreadyExists++;else failed.push({table:slice[index]?.tableName,id:slice[index]?.id,code:status.code,message:status.message});});console.log(`Processed ${Math.min(offset+slice.length,operations.length)}/${operations.length}: ${created} created, ${alreadyExists} preserved`);}
const report={appliedAt:new Date().toISOString(),mode:'create-only-no-deletes',sourcePath,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),productionId,candidates:operations.length,created,alreadyExists,failed,valid:failed.length===0};
fs.writeFileSync(path.join(backupRoot,'reconciliation-apply-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.valid)process.exitCode=1;
