import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const required = [
  'manifest.webmanifest',
  'service-worker.js',
  'assets/images/icons/icon-192.png',
  'assets/images/icons/icon-512.png',
  'assets/images/icons/maskable-192.png',
  'assets/images/icons/maskable-512.png',
  'android-twa/assetlinks.template.json'
];

let failed = false;
for (const file of required) {
  try { await access(file); console.log(`OK file  ${file}`); }
  catch { console.error(`MISSING  ${file}`); failed = true; }
}

const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
for (const key of ['id','start_url','scope','display','icons']) {
  if (!manifest[key]) { console.error(`MISSING manifest.${key}`); failed = true; }
  else console.log(`OK manifest.${key}`);
}

for (const [label, command, args] of [
  ['Node', process.execPath, ['--version']],
  ['Java', 'java', ['-version']],
  ['ADB', 'adb', ['version']]
]) {
  const result = spawnSync(command, args, { encoding:'utf8' });
  if (result.error) console.warn(`OPTIONAL ${label} not found on PATH`);
  else console.log(`OK tool  ${label}`);
}

if (failed) process.exit(1);
console.log('Android web foundation is ready. Publish it before initializing Bubblewrap from the live manifest.');
