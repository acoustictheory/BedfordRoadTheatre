import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectId = 'brpa-digital-hub-dev';
const bucket = 'brpa-digital-hub-dev.firebasestorage.app';
const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
const sources = [
  { id: 'descendants-music', title: 'Descendants Sheet Music', type: 'music', file: 'C:/Users/justi/Downloads/Descendants Music.pdf' },
  { id: 'descendants-script', title: 'Descendants Script', type: 'script', file: 'C:/Users/justi/Downloads/Descendants Script.pdf' },
  { id: 'descendants-libretto', title: 'Descendants Libretto', type: 'libretto', file: path.resolve('libretto/Descendants-Libretto.pdf') },
  ...fs.readdirSync(path.resolve('song-pdfs')).filter(name => name.toLowerCase().endsWith('.pdf')).map(name => ({ id: `descendants-song-${name.slice(0, 2)}`, title: name.replace(/\.pdf$/i, ''), type: 'song-score', file: path.resolve('song-pdfs', name) })),
];
const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const globalRoot = process.platform === 'win32' ? path.join(process.env.APPDATA || '', 'npm', 'node_modules') : '/usr/local/lib/node_modules';
const firebaseAuth = require(path.join(globalRoot, 'firebase-tools', 'lib', 'auth.js'));
const token = (await firebaseAuth.getAccessToken(config.tokens.refresh_token, [])).access_token;

function field(value) {
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'boolean') return { booleanValue: value };
  return { stringValue: String(value) };
}

const output = [];
for (const source of sources) {
  const stat = fs.statSync(source.file);
  const objectName = `production-documents/${productionId}/${source.id}.pdf`;
  const downloadToken = crypto.randomUUID();
  const metadata = {
    name: objectName,
    contentType: 'application/pdf',
    metadata: { firebaseStorageDownloadTokens: downloadToken, productionId, documentId: source.id },
  };
  const start = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/pdf', 'X-Upload-Content-Length': String(stat.size) },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw new Error(`Could not start ${source.title}: ${start.status} ${await start.text()}`);
  const uploadUrl = start.headers.get('location');
  const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(stat.size) }, body: fs.readFileSync(source.file) });
  if (!upload.ok) throw new Error(`Could not upload ${source.title}: ${upload.status} ${await upload.text()}`);
  const stored = await upload.json();
  const document = {
    id: source.id,
    title: source.title,
    documentType: source.type,
    storagePath: objectName,
    fileName: path.basename(source.file),
    mimeType: 'application/pdf',
    bytes: stat.size,
    downloadToken,
    status: 'Active',
    annotationEnabled: true,
    updatedAt: new Date().toISOString(),
  };
  const firestore = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/productions/${productionId}/productionDocuments/${source.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(document).map(([key, value]) => [key, field(value)])) }),
  });
  if (!firestore.ok) throw new Error(`Could not index ${source.title}: ${firestore.status} ${await firestore.text()}`);
  output.push({ ...document, generation: stored.generation });
  console.log(`Uploaded ${source.title} (${stat.size} bytes).`);
}
fs.writeFileSync('migration-exports/production-documents.json', JSON.stringify({ projectId, bucket, productionId, documents: output }, null, 2));
console.log('Production document upload and Firestore indexing complete.');
