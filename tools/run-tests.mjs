// Runs every *.test.mjs under web/src/lib and tools with `node --test`. Written out because the
// directory form of `node --test` differs between Node 20 and 22 and glob arguments only exist from Node 21.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const files = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); }
    else if (n.endsWith('.test.mjs')) files.push(p);
  }
};
for (const d of ['web/src/lib', 'tools']) walk(join(root, d));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
