import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const keyPath = path.join(root, '.neocities-api-key');
if (!fs.existsSync(keyPath)) throw new Error('Missing .neocities-api-key');
const apiKey = fs.readFileSync(keyPath, 'utf8').trim();
if (apiKey.length < 20) throw new Error('The Neocities API key is empty or invalid.');

const roots = ['assets', 'downloads', '.well-known'];
const pubspec = fs.readFileSync(path.join(root, 'mobile-app', 'pubspec.yaml'), 'utf8');
const appVersion = pubspec.match(/^version:\s*([^+\s]+)/m)?.[1];
if (!appVersion) throw new Error('Could not determine the mobile app version from mobile-app/pubspec.yaml.');
const currentApk = `downloads/BedfordRoadMusical-${appVersion}.apk`;
const rootFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && (/\.html$/i.test(entry.name) || ['manifest.webmanifest', 'robots.txt', 'service-worker.js'].includes(entry.name)))
  .map(entry => entry.name);

function walk(relativeDir) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

const files = [...rootFiles, ...roots.flatMap(walk)]
  .filter(file => !/(?:^|\/)desktop\.ini$/i.test(file))
  .filter(file => !/\.idsig$/i.test(file))
  .filter(file => !/^downloads\/live-.*-check\.html$/i.test(file))
  .filter(file => !/^downloads\/.*\.apk$/i.test(file) || file === currentApk)
  .sort();

if (!files.includes(currentApk)) throw new Error(`Missing current Android release: ${currentApk}`);

async function neocities(endpoint, options = {}) {
  const response = await fetch(`https://neocities.org/api/${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}`, ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`Neocities returned ${response.status}: ${text.slice(0, 200)}`); }
  if (!response.ok || body.result !== 'success') throw new Error(body.message || `Neocities ${endpoint} failed (${response.status}).`);
  return body;
}

const info = await neocities('info');
const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  console.log(`Neocities credential verified for ${info.info?.sitename || 'site'}.`);
}

if (!checkOnly) {
const batches = [];
let batch = [];
let batchBytes = 0;
for (const file of files) {
  const bytes = fs.statSync(path.join(root, file)).size;
  if (batch.length && (batch.length >= 35 || batchBytes + bytes > 18 * 1024 * 1024)) {
    batches.push(batch);
    batch = [];
    batchBytes = 0;
  }
  batch.push(file);
  batchBytes += bytes;
}
if (batch.length) batches.push(batch);

for (let index = 0; index < batches.length; index += 1) {
  const form = new FormData();
  for (const file of batches[index]) {
    const bytes = fs.readFileSync(path.join(root, file));
    form.append(file, new Blob([bytes]), path.basename(file));
  }
  await neocities('upload', { method: 'POST', body: form });
  console.log(`Uploaded batch ${index + 1}/${batches.length} (${batches[index].length} files).`);
}

console.log(`NEOCITIES DEPLOY COMPLETE: ${files.length} public files to ${info.info?.sitename || 'site'}.`);
}
