import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const databaseId = '(default)';
const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
const report = JSON.parse(fs.readFileSync(path.resolve('migration-exports/storage-migration-validation.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const globalRoot = process.platform === 'win32'
  ? path.join(process.env.APPDATA || '', 'npm', 'node_modules')
  : '/usr/local/lib/node_modules';
const firebaseAuth = require(path.join(globalRoot, 'firebase-tools', 'lib', 'auth.js'));
const token = (await firebaseAuth.getAccessToken(config.tokens.refresh_token, [])).access_token;

function value(input) {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'object') return { mapValue: { fields: fields(input) } };
  return { stringValue: String(input) };
}
function fields(input) { return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])); }

const writes = report.files.map(file => ({ update: {
  name: `projects/${projectId}/databases/${databaseId}/documents/productions/${productionId}/storageAssets/${file.sourceFileId}`,
  fields: fields({
    sourceDriveFileId: file.sourceFileId,
    storagePath: file.objectName,
    fileName: file.name,
    mimeType: file.mimeType,
    bytes: file.bytes,
    sha256: file.sha256,
    md5Hash: file.md5Hash,
    storageGeneration: file.storageGeneration,
    references: file.references,
    migratedAt: report.completedAt,
    status: 'Verified'
  })
}}));

for (let offset = 0; offset < writes.length; offset += 350) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents:batchWrite`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: writes.slice(offset, offset + 350) })
    }
  );
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
}
console.log(`Indexed ${writes.length} verified Storage assets in Firestore.`);

let objectCount = 0;
let objectBytes = 0;
let pageToken = '';
do {
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${report.bucket}/o`);
  url.searchParams.set('prefix', 'legacy-drive/');
  url.searchParams.set('maxResults', '1000');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Storage recount failed: ${response.status} ${await response.text()}`);
  const page = await response.json();
  objectCount += (page.items || []).length;
  objectBytes += (page.items || []).reduce((sum, item) => sum + Number(item.size || 0), 0);
  pageToken = page.nextPageToken || '';
} while (pageToken);

const expectedBytes = report.files.reduce((sum, file) => sum + file.bytes, 0);
if (objectCount !== report.uploadedFiles || objectBytes !== expectedBytes) {
  throw new Error(`Storage recount mismatch: ${objectCount}/${objectBytes}, expected ${report.uploadedFiles}/${expectedBytes}`);
}
console.log(`Storage recount validated ${objectCount} objects and ${objectBytes} bytes.`);
