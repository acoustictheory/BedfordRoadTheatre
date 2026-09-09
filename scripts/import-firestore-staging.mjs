import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const databaseId = '(default)';
const sourcePath = path.resolve(process.argv[2] || 'migration-exports/complete-database-v2.json');
const runId = process.argv[3] || 'apps-script-20260904-043428';
const firebaseConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

function firebaseAuthModule() {
  const globalRoot = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'node_modules')
    : '/usr/local/lib/node_modules';
  return require(path.join(globalRoot, 'firebase-tools', 'lib', 'auth.js'));
}

async function accessToken() {
  const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  if (!config.tokens?.refresh_token) throw new Error('Firebase CLI refresh token was not found. Run firebase login.');
  const tokens = await firebaseAuthModule().getAccessToken(config.tokens.refresh_token, []);
  if (!tokens.access_token) throw new Error('Firebase CLI did not provide an access token.');
  return tokens.access_token;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { stringValue: String(value) };
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: firestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function firestoreFields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
}

function documentId(record, index) {
  const firstId = Object.entries(record).find(([key, value]) => /ID$/.test(key) && String(value || '').trim());
  const raw = firstId ? String(firstId[1]) : `row-${String(index + 1).padStart(6, '0')}`;
  return raw.replaceAll('/', '_').slice(0, 1400);
}

async function request(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${response.status} ${body.error?.message || text}`);
  return body;
}

function documentName(...segments) {
  return `projects/${projectId}/databases/${databaseId}/documents/${segments.join('/')}`;
}

async function batchWrite(token, documents) {
  if (!documents.length) return;
  const body = {
    writes: documents.map(document => ({ update: document }))
  };
  const result = await request(
    token,
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents:batchWrite`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  const failures = (result.status || []).filter(status => status.code && status.code !== 0);
  if (failures.length) throw new Error(`Firestore rejected ${failures.length} writes: ${JSON.stringify(failures[0])}`);
}

async function writeSingle(token, name, fields) {
  await batchWrite(token, [{ name, fields: firestoreFields(fields) }]);
}

async function countRemoteRecords(token, sheetName) {
  let pageToken = '';
  let count = 0;
  do {
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents/migrationRuns/${encodeURIComponent(runId)}/tables/${encodeURIComponent(sheetName)}/records?pageSize=300`;
    const result = await request(token, pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base);
    count += (result.documents || []).length;
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return count;
}

const sourceBytes = fs.readFileSync(sourcePath);
const sourceSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
const tables = JSON.parse(sourceBytes.toString('utf8'));
const token = await accessToken();
const startedAt = new Date().toISOString();
const tableNames = Object.keys(tables);
const expectedRows = tableNames.reduce((sum, name) => sum + (tables[name].records || []).length, 0);

await writeSingle(token, documentName('migrationRuns', runId), {
  status: 'importing',
  source: 'Apps Script and Google Sheets',
  sourceFile: path.basename(sourcePath),
  sourceSha256,
  startedAt,
  expectedTables: tableNames.length,
  expectedRows,
  authAccountsImported: 33
});

let importedRows = 0;
const counts = {};
for (const sheetName of tableNames) {
  const table = tables[sheetName];
  const records = table.records || [];
  const ids = new Set();
  const documents = records.map((record, index) => {
    const id = documentId(record, index);
    if (ids.has(id)) throw new Error(`Duplicate Firestore document ID in ${sheetName}: ${id}`);
    ids.add(id);
    return {
      name: documentName('migrationRuns', runId, 'tables', sheetName, 'records', id),
      fields: firestoreFields({ ...record, _migrationRow: index + 2 })
    };
  });

  await writeSingle(token, documentName('migrationRuns', runId, 'tables', sheetName), {
    sourceSheet: sheetName,
    rowCount: records.length,
    headers: table.headers || [],
    exportHeaders: table.exportHeaders || table.headers || []
  });

  for (let offset = 0; offset < documents.length; offset += 350) {
    await batchWrite(token, documents.slice(offset, offset + 350));
  }
  importedRows += records.length;
  counts[sheetName] = records.length;
  console.log(`Imported ${sheetName}: ${records.length}`);
}

const remoteCounts = {};
const mismatches = [];
for (const sheetName of tableNames) {
  remoteCounts[sheetName] = await countRemoteRecords(token, sheetName);
  if (remoteCounts[sheetName] !== counts[sheetName]) {
    mismatches.push({ sheetName, expected: counts[sheetName], actual: remoteCounts[sheetName] });
  }
}

const completedAt = new Date().toISOString();
await writeSingle(token, documentName('migrationRuns', runId), {
  status: mismatches.length ? 'validation-failed' : 'validated',
  source: 'Apps Script and Google Sheets',
  sourceFile: path.basename(sourcePath),
  sourceSha256,
  startedAt,
  completedAt,
  expectedTables: tableNames.length,
  importedTables: tableNames.length,
  expectedRows,
  importedRows,
  authAccountsImported: 33,
  countMismatches: mismatches
});

const report = {
  projectId,
  databaseId,
  runId,
  startedAt,
  completedAt,
  sourceSha256,
  tables: tableNames.length,
  expectedRows,
  importedRows,
  remoteRows: Object.values(remoteCounts).reduce((sum, count) => sum + count, 0),
  mismatches,
  counts,
  remoteCounts,
  valid: mismatches.length === 0 && importedRows === expectedRows
};
const reportPath = path.resolve('migration-exports/firestore-staging-validation.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(`Validation report: ${reportPath}`);
console.log(report.valid ? 'FIRESTORE STAGING IMPORT VALIDATED' : 'FIRESTORE STAGING IMPORT FAILED VALIDATION');
if (!report.valid) process.exit(1);
