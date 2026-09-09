import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

async function files(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes:true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await files(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

let failed = false;
for (const file of await files('assets/js')) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio:'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log('All frontend JavaScript passed syntax checks.');
