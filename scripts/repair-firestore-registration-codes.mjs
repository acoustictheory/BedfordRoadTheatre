import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const source = JSON.parse(fs.readFileSync(path.resolve('migration-exports/complete-database-v2.json'), 'utf8'));
const records = source.RegistrationCodes?.records || [];
if (!records.length) throw new Error('No registration codes were found in the migration export.');

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firebaseAuth = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'auth.js'));
const token = await firebaseAuth.getAccessToken(config.tokens?.refresh_token, []);
if (!token.access_token) throw new Error('Run firebase login first.');

const lowerCamel = value => String(value).replace(/^[A-Z]+(?=[A-Z][a-z]|$)/, part => part.toLowerCase());
const fieldValue = value => {
  if (value === '' || value === null || value === undefined) return { nullValue:null };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  if (typeof value === 'boolean') return { booleanValue:value };
  return { stringValue:String(value) };
};

for (const record of records) {
  const id = encodeURIComponent(record.RegistrationCodeID);
  const fields = Object.fromEntries(Object.entries(record).map(([key,value]) => [lowerCamel(key), fieldValue(value)]));
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/registrationCodes/${id}`;
  const response = await fetch(url, { method:'PATCH', headers:{ Authorization:`Bearer ${token.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ fields }) });
  if (!response.ok) throw new Error(`${record.Code}: ${response.status} ${await response.text()}`);
  console.log(`Restored ${record.Code} (${record.Uses}/${record.MaxUses} uses).`);
}
