/**
 * Build-size guard.
 *
 * The app shipped a single 1.03 MB chunk, which is what made the pre-mount
 * flash last seconds instead of milliseconds. Route splitting fixed it; this
 * keeps it fixed. Raise the budget deliberately, with a reason, rather than
 * letting it drift.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const MAX_MAIN_CHUNK_KB = 600;

let entries;
try {
  entries = readdirSync(ASSETS);
} catch {
  console.error('check:size — dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const chunks = entries
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, kb: statSync(join(ASSETS, f)).size / 1024 }))
  .sort((a, b) => b.kb - a.kb);

if (chunks.length === 0) {
  console.error('check:size — no JS chunks in dist/assets. Run `npm run build` first.');
  process.exit(1);
}

const [largest] = chunks;
const total = chunks.reduce((sum, c) => sum + c.kb, 0);

console.log(`check:size — ${chunks.length} chunks, ${total.toFixed(0)} KB total`);
for (const c of chunks.slice(0, 5)) console.log(`  ${c.kb.toFixed(0).padStart(5)} KB  ${c.name}`);

if (largest.kb > MAX_MAIN_CHUNK_KB) {
  console.error(
    `\ncheck:size FAILED — largest chunk ${largest.name} is ${largest.kb.toFixed(0)} KB, ` +
    `budget is ${MAX_MAIN_CHUNK_KB} KB.\n` +
    `Split a route with React.lazy, or raise MAX_MAIN_CHUNK_KB with a reason.`
  );
  process.exit(1);
}
console.log(`\ncheck:size OK — largest ${largest.kb.toFixed(0)} KB <= ${MAX_MAIN_CHUNK_KB} KB`);
