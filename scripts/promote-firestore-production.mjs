import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const databaseId = '(default)';
const sourcePath = path.resolve(process.argv[2] || 'migration-exports/complete-database-v2.json');
const reportPath = path.resolve('migration-exports/firestore-production-validation.json');
const firebaseConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const sourceBytes = fs.readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const sourceSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
const importedAt = new Date().toISOString();

function firebaseAuthModule() {
  const root = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'node_modules')
    : '/usr/local/lib/node_modules';
  return require(path.join(root, 'firebase-tools', 'lib', 'auth.js'));
}

async function accessToken() {
  const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  const tokens = await firebaseAuthModule().getAccessToken(config.tokens?.refresh_token, []);
  if (!tokens.access_token) throw new Error('Run firebase login before promoting Firestore data.');
  return tokens.access_token;
}

function lowerCamel(value) {
  const text = String(value);
  if (!text) return text;
  return /^[A-Z]+$/.test(text) ? text.toLowerCase() : text[0].toLowerCase() + text.slice(1);
}

function decode(value, key) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/JSON$/.test(key) && trimmed) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return value;
}

function normalizeRecord(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.includes('__duplicate_')) continue;
    normalized[lowerCamel(key)] = decode(value, key);
  }
  // Consolidate the known duplicate announcement columns without losing values.
  for (const key of ['ActionURL', 'DeadlineAt', 'Location']) {
    const canonical = lowerCamel(key);
    const duplicate = record[`${key}__duplicate_2`];
    if (!normalized[canonical] && duplicate) normalized[canonical] = duplicate;
  }
  return normalized;
}

function idFor(record, index) {
  const entry = Object.entries(record).find(([key, value]) => /ID$/.test(key) && String(value || '').trim());
  return String(entry?.[1] || `row-${String(index + 1).padStart(6, '0')}`).replaceAll('/', '_');
}

function fv(value) {
  if (value === null || value === undefined || value === '') return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fv) } };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  return { stringValue: String(value) };
}

function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fv(value)]));
}

function docName(...parts) {
  return `projects/${projectId}/databases/${databaseId}/documents/${parts.join('/')}`;
}

async function api(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${response.status}: ${body.error?.message || text}`);
  return body;
}

async function writeBatch(token, docs) {
  if (!docs.length) return;
  const result = await api(token,
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents:batchWrite`,
    { method: 'POST', body: JSON.stringify({ writes: docs.map(doc => ({ update: doc })) }) }
  );
  const rejected = (result.status || []).filter(status => status.code);
  if (rejected.length) throw new Error(`Firestore rejected ${rejected.length} writes.`);
}

async function countCollection(token, parent, collectionId) {
  let count = 0;
  let pageToken = '';
  do {
    const base = `https://firestore.googleapis.com/v1/${parent}/${collectionId}?pageSize=300`;
    const result = await api(token, pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base);
    count += (result.documents || []).length;
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return count;
}

const globalTables = new Set([
  'Settings', 'Productions', 'Users', 'Profiles', 'Departments', 'Permissions',
  'PermissionGroups', 'GroupPermissions', 'RegistrationCodes'
]);
const excludedSensitiveFields = new Set(['passwordHash', 'passwordSalt']);
const token = await accessToken();
const productions = source.Productions.records || [];
const activeProduction = productions.find(row => row.Status === 'Active') || productions[0];
if (!activeProduction?.ProductionID) throw new Error('No production exists in the source export.');
const productionId = activeProduction.ProductionID;
const expected = {};
const locations = {};

for (const [tableName, table] of Object.entries(source)) {
  const rows = table.records || [];
  if (tableName === 'Users' || tableName === 'Profiles') continue;
  const collection = lowerCamel(tableName);
  const parentParts = globalTables.has(tableName) ? [] : ['productions', productionId];
  const docs = rows.map((row, index) => ({
    name: docName(...parentParts, collection, idFor(row, index)),
    fields: fields({ ...normalizeRecord(row), _sourceTable: tableName, _migratedAt: importedAt })
  }));
  for (let offset = 0; offset < docs.length; offset += 350) await writeBatch(token, docs.slice(offset, offset + 350));
  expected[tableName] = rows.length;
  locations[tableName] = { parentParts, collection };
  console.log(`Promoted ${tableName}: ${rows.length}`);
}

const profilesByUser = new Map((source.Profiles.records || []).map(row => [row.UserID, row]));
const membershipsByUser = new Map();
for (const row of source.UserDepartments.records || []) {
  if (row.Status !== 'Active') continue;
  const list = membershipsByUser.get(row.UserID) || [];
  list.push(row.DepartmentID);
  membershipsByUser.set(row.UserID, list);
}

const userDocs = [];
const profileDocs = [];
for (const row of source.Users.records || []) {
  const normalized = normalizeRecord(row);
  for (const field of excludedSensitiveFields) delete normalized[field];
  normalized.usernameNormalized = String(row.Username || '').trim().toLowerCase();
  normalized.departmentIds = [...new Set(membershipsByUser.get(row.UserID) || [])];
  normalized.activeProductionId = productionId;
  normalized.profile = normalizeRecord(profilesByUser.get(row.UserID) || {});
  normalized._migratedAt = importedAt;
  userDocs.push({ name: docName('users', row.UserID), fields: fields(normalized) });

  const fullProfile = normalizeRecord(profilesByUser.get(row.UserID) || { UserID: row.UserID });
  const profile = Object.fromEntries([
    'profileId', 'userId', 'firstName', 'lastName', 'displayName', 'pronouns',
    'grade', 'bio', 'photoFileId', 'photoURL', 'theme', 'visibility',
    'createdAt', 'updatedAt'
  ].filter(key => key in fullProfile).map(key => [key, fullProfile[key]]));
  profile.status = row.Status;
  profile._migratedAt = importedAt;
  profileDocs.push({ name: docName('profiles', row.UserID), fields: fields(profile) });
}
for (let offset = 0; offset < userDocs.length; offset += 350) await writeBatch(token, userDocs.slice(offset, offset + 350));
for (let offset = 0; offset < profileDocs.length; offset += 350) await writeBatch(token, profileDocs.slice(offset, offset + 350));
expected.Users = userDocs.length;
expected.Profiles = profileDocs.length;
locations.Users = { parentParts: [], collection: 'users' };
locations.Profiles = { parentParts: [], collection: 'profiles' };

const remote = {};
const mismatches = [];
for (const [tableName, location] of Object.entries(locations)) {
  const parent = location.parentParts.length
    ? docName(...location.parentParts)
    : `projects/${projectId}/databases/${databaseId}/documents`;
  remote[tableName] = await countCollection(token, parent, location.collection);
  if (remote[tableName] !== expected[tableName]) mismatches.push({ tableName, expected: expected[tableName], actual: remote[tableName] });
}

const report = {
  projectId, productionId, sourceSha256, importedAt,
  tables: Object.keys(expected).length,
  expectedRows: Object.values(expected).reduce((sum, count) => sum + count, 0),
  remoteRows: Object.values(remote).reduce((sum, count) => sum + count, 0),
  sensitivePasswordFieldsWritten: false,
  mismatches,
  valid: mismatches.length === 0
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(`Validation report: ${reportPath}`);
console.log(report.valid ? 'PRODUCTION FIRESTORE PROMOTION VALIDATED' : 'PRODUCTION FIRESTORE PROMOTION FAILED');
if (!report.valid) process.exit(1);
