import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const databaseId = '(default)';
const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const globalRoot = path.join(process.env.APPDATA || '', 'npm', 'node_modules');
const firebaseAuth = require(path.join(globalRoot, 'firebase-tools', 'lib', 'auth.js'));
const token = (await firebaseAuth.getAccessToken(config.tokens.refresh_token, [])).access_token;
const root = `projects/${projectId}/databases/${databaseId}/documents/productions/${productionId}`;
const api = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents`;

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body.error?.message || JSON.stringify(body)}`);
  return body;
}

const legacy = await json(`${api}/productions/${productionId}/Tracks?pageSize=300`);
const documents = legacy.documents || [];
if (!documents.length) throw new Error('No legacy Tracks records were found; nothing was changed.');

const writes = documents.map((document) => ({
  update: {
    name: document.name.replace('/Tracks/', '/tracks/'),
    fields: document.fields,
  },
}));
for (let offset = 0; offset < writes.length; offset += 350) {
  await json(`${api}:batchWrite`, {
    method: 'POST',
    body: JSON.stringify({ writes: writes.slice(offset, offset + 350) }),
  });
}

const repaired = await json(`${api}/productions/${productionId}/tracks?pageSize=300`);
const repairedCount = (repaired.documents || []).length;
if (repairedCount !== documents.length) {
  throw new Error(`Repair validation failed: copied ${repairedCount} of ${documents.length} tracks.`);
}
console.log(`ScoreFlow repair validated: ${repairedCount} tracks are available in the lowercase collection.`);
