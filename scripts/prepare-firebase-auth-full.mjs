import fs from 'node:fs';
import path from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/prepare-firebase-auth-full.mjs <auth-export.json>');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'));
const supportedKeys = new Set([
  'localId', 'email', 'emailVerified', 'passwordHash', 'salt', 'displayName',
  'photoUrl', 'disabled', 'customAttributes', 'providerUserInfo', 'mfaInfo'
]);
const users = (source.users || []).map(user => Object.fromEntries(
  Object.entries(user).filter(([key]) => supportedKeys.has(key))
));

const ids = new Set();
const emails = new Set();
for (const user of users) {
  const id = String(user.localId || '');
  const email = String(user.email || '').toLowerCase();
  if (!id || ids.has(id)) throw new Error(`Missing or duplicate UID: ${id}`);
  if (!email || emails.has(email)) throw new Error(`Missing or duplicate login identifier: ${email}`);
  if (!user.passwordHash || !user.salt) throw new Error(`Missing password material for ${email}`);
  ids.add(id);
  emails.add(email);
}

const outputDirectory = path.resolve('migration-exports');
const outputPath = path.join(outputDirectory, 'firebase-auth-full-ready.json');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ users }, null, 2), {
  encoding: 'utf8',
  mode: 0o600
});

console.log(`Prepared ${users.length} accounts at ${outputPath}`);
console.log('Unsupported source metadata was removed; password hashes and salts were retained.');
