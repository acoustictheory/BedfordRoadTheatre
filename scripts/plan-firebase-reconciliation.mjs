import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const backupRoot=path.resolve(process.argv[2]||'backups/pre-cutover-20260908-202450');
const legacyPath=process.argv[3] ? path.resolve(process.argv[3]) : find(backupRoot,'complete-database.json');
const rootFirestorePath=path.join(backupRoot,'firebase','firestore','firestore-complete.json');
const productionFirestorePath=path.join(backupRoot,'firebase','active-production','firestore-complete.json');
const outputPath=path.join(backupRoot,'reconciliation-plan.json');
function find(root,name){const stack=[root];while(stack.length){const current=stack.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=path.join(current,entry.name);if(entry.isDirectory())stack.push(target);else if(entry.name===name)return target;}}throw new Error(`${name} not found below ${root}`);}
function lowerCamel(value){const text=String(value);return /^[A-Z]+$/.test(text)?text.toLowerCase():text[0].toLowerCase()+text.slice(1);}
function decode(value){if(!value)return null;if('nullValue'in value)return null;if('stringValue'in value)return value.stringValue;if('booleanValue'in value)return value.booleanValue;if('integerValue'in value)return Number(value.integerValue);if('doubleValue'in value)return value.doubleValue;if('timestampValue'in value)return value.timestampValue;if('bytesValue'in value)return value.bytesValue;if('referenceValue'in value)return value.referenceValue;if('geoPointValue'in value)return value.geoPointValue;if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));return null;}
function decodeDocument(document){return {id:document.name.split('/').at(-1),path:document.name,data:Object.fromEntries(Object.entries(document.fields||{}).map(([k,v])=>[k,decode(v)])),createTime:document.createTime||'',updateTime:document.updateTime||''};}
function readFirestore(file){const payload=JSON.parse(fs.readFileSync(file));return new Map(payload.collections.map(collection=>[collection.path,collection.documents.map(decodeDocument)]));}
function sourceId(row,index){const entry=Object.entries(row).find(([key,value])=>/ID$/.test(key)&&String(value||'').trim());return String(entry?.[1]||`row-${String(index+1).padStart(6,'0')}`).replaceAll('/','_');}
function normalize(row){return Object.fromEntries(Object.entries(row).filter(([key])=>!key.includes('__duplicate_')&&!['PasswordHash','PasswordSalt'].includes(key)).map(([key,value])=>{let decoded=value;if(typeof value==='string'&&/JSON$/.test(key)&&value.trim()){try{decoded=JSON.parse(value);}catch{}}return [lowerCamel(key),decoded===''?null:decoded];}));}
function comparable(value){if(value===null||value===undefined||value==='')return null;if(Array.isArray(value))return value.map(comparable);if(typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!key.startsWith('_')&&!['updatedAt','syncedAt','migratedAt'].includes(key)).sort().map(([key,item])=>[key,comparable(item)]));return value;}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(comparable(value))).digest('hex');}
function timestamp(record){for(const key of ['updatedAt','UpdatedAt','submittedAt','SubmittedAt','createdAt','CreatedAt']){const value=record?.[key];if(value&&Number.isFinite(Date.parse(value)))return Date.parse(value);}return 0;}

const legacy=JSON.parse(fs.readFileSync(legacyPath));
const root=readFirestore(rootFirestorePath),production=readFirestore(productionFirestorePath);
const productionId=(legacy.Productions?.records||[]).find(row=>String(row.Status).toLowerCase()==='active')?.ProductionID||(legacy.Productions?.records||[])[0]?.ProductionID;
if(!productionId)throw new Error('Active production is missing.');
const globalTables=new Set(['Settings','Productions','Users','Profiles','Departments','Permissions','PermissionGroups','GroupPermissions','RegistrationCodes']);
const specialIds={Profiles:'UserID'};
const actions=[],tableSummary=[],conflicts=[];
for(const [tableName,table] of Object.entries(legacy)){
  const targetCollection=lowerCamel(tableName);const targetPath=globalTables.has(tableName)?targetCollection:`productions/${productionId}/${targetCollection}`;
  const current=(globalTables.has(tableName)?root:production).get(targetPath)||[];const byId=new Map(current.map(document=>[document.id,document]));
  let creates=0,updates=0,unchanged=0;
  for(const [index,row] of (table.records||[]).entries()){
    const id=specialIds[tableName]?String(row[specialIds[tableName]]||sourceId(row,index)):sourceId(row,index);const incoming=normalize(row);const existing=byId.get(id);
    if(!existing){actions.push({operation:'create',table:tableName,targetPath,id,sourceTimestamp:timestamp(incoming)});creates++;continue;}
    if(digest(existing.data)===digest(incoming)){unchanged++;continue;}
    const sourceTimestamp=timestamp(incoming),targetTimestamp=timestamp(existing.data);
    if(sourceTimestamp&&targetTimestamp&&targetTimestamp>sourceTimestamp){const conflict={table:tableName,targetPath,id,resolution:'preserve-newer-firebase',sourceTimestamp:new Date(sourceTimestamp).toISOString(),targetTimestamp:new Date(targetTimestamp).toISOString()};conflicts.push(conflict);actions.push({operation:'preserve',...conflict});}
    else{actions.push({operation:'update',table:tableName,targetPath,id,resolution:targetTimestamp>sourceTimestamp?'manual-review':'legacy-is-newer-or-equal',sourceTimestamp:sourceTimestamp?new Date(sourceTimestamp).toISOString():'',targetTimestamp:targetTimestamp?new Date(targetTimestamp).toISOString():''});updates++;}
  }
  tableSummary.push({table:tableName,targetPath,sourceRows:(table.records||[]).length,currentCanonicalDocuments:current.length,creates,updates,unchanged});
}

const firebaseOnlyPrefixes=['communicationConversations','communicationAssignments','communityAccessRequests','scoreAnnotations','productionDocuments','storageAssets'];
const preservedFirebaseCollections=[...production.entries()].filter(([collectionPath])=>firebaseOnlyPrefixes.some(name=>collectionPath.includes(`/${name}`))).map(([collectionPath,documents])=>({collectionPath,documents:documents.length}));
const plan={createdAt:new Date().toISOString(),backupRoot,legacyPath,productionId,mode:'dry-run-no-live-writes',sourceTables:Object.keys(legacy).length,sourceRows:Object.values(legacy).reduce((sum,table)=>sum+(table.records?.length||0),0),actions:{create:actions.filter(item=>item.operation==='create').length,update:actions.filter(item=>item.operation==='update').length,preserve:actions.filter(item=>item.operation==='preserve').length},conflicts,preservedFirebaseCollections,tableSummary,operations:actions};
fs.writeFileSync(outputPath,JSON.stringify(plan,null,2));
console.log(JSON.stringify({outputPath,productionId,sourceTables:plan.sourceTables,sourceRows:plan.sourceRows,actions:plan.actions,conflicts:conflicts.length,preservedFirebaseCollections},null,2));
