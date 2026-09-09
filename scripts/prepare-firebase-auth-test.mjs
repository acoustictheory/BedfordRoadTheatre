import fs from 'node:fs';
import path from 'node:path';

const [, , sourcePath, username] = process.argv;

if (!sourcePath || !username) {
  console.error('Usage: node scripts/prepare-firebase-auth-test.mjs <auth-export.json> <username>');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'));
const normalized = String(username).trim().toLowerCase();
const expectedEmail = `${normalized}@users.bedford-musical.invalid`;
const matches = (source.users || []).filter(user =>
  String(user.email || '').toLowerCase() === expectedEmail
);

if (matches.length !== 1) {
  console.error(`Expected one account for ${normalized}; found ${matches.length}.`);
  process.exit(1);
}

const supportedKeys = new Set([
  'localId', 'email', 'emailVerified', 'passwordHash', 'salt', 'displayName',
  'photoUrl', 'disabled', 'customAttributes', 'providerUserInfo', 'mfaInfo'
]);
const testUser = Object.fromEntries(
  Object.entries(matches[0]).filter(([key]) => supportedKeys.has(key))
);
const outputDirectory = path.resolve('migration-exports');
const outputPath = path.join(outputDirectory, 'firebase-auth-test-one-user.json');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ users: [testUser] }, null, 2), {
  encoding: 'utf8',
  mode: 0o600
});

console.log(`Prepared one account at ${outputPath}`);
console.log(`Firebase login identifier: ${expectedEmail}`);
console.log('No plaintext password was read or stored.');
