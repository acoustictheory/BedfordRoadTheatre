import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [, , endpoint, key] = process.argv;
if (!endpoint || !key) {
  console.error('Usage: node scripts/download-migration-database.mjs <endpoint> <temporary-key>');
  process.exit(1);
}

async function post(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, key })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Migration download failed.');
  return result;
}

const info = await post({ action: 'temporaryMigrationDatabaseInfo' });
const chunks = [];
for (let index = 0; index < info.chunkCount; index += 1) {
  const chunk = await post({
    action: 'temporaryMigrationDatabaseChunk',
    fileId: info.fileId,
    chunkIndex: index
  });
  if (chunk.chunkIndex !== index) throw new Error(`Received the wrong chunk at ${index}.`);
  chunks.push(Buffer.from(chunk.base64, 'base64'));
  console.log(`Downloaded database chunk ${index + 1}/${info.chunkCount}`);
}

const bytes = Buffer.concat(chunks);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (bytes.length !== info.byteLength) throw new Error(`Byte count mismatch: ${bytes.length}/${info.byteLength}`);
if (sha256 !== info.sha256) throw new Error(`SHA-256 mismatch: ${sha256}/${info.sha256}`);

const outputDirectory = path.resolve('migration-exports');
const outputPath = path.join(outputDirectory, 'complete-database-v2.json');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, bytes, { mode: 0o600 });
console.log(`Verified ${bytes.length} bytes with SHA-256 ${sha256}`);
console.log(`Saved ${outputPath}`);
