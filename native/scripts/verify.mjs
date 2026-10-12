import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const native = fileURLToPath(new URL('..', import.meta.url));
const web = path.resolve(native, '../docs');
const bundled = path.join(native, 'www');
for (const name of ['siddur.pdf', ...((await readdir(path.join(web, 'data'))).map(x => `data/${x}`))]) {
  assert.deepEqual(await readFile(path.join(web, name)), await readFile(path.join(bundled, name)), `${name} must be unchanged`);
}
const html = await readFile(path.join(bundled, 'index.html'), 'utf8');
assert(!html.includes('now-label'), 'Current-prayer button must have no עכשיו label');
assert(!/https?:\/\//.test(html), 'Native HTML must not depend on external resources');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?]+)(?:\?[^\"]*)?"/g)) {
  await readFile(path.join(bundled, match[1]));
}
const app = await readFile(path.join(bundled, 'js/app.js'), 'utf8');
assert(app.includes("var PDFJS_CDN = './vendor/pdfjs/';"));
assert(app.includes('isEvalSupported: false'));
assert(app.includes('plan(new Date(),'), 'No fixed-date QA fixture in release');
await readFile(path.join(bundled, 'vendor/pdfjs/pdf.worker.min.js'));
const config = JSON.parse(await readFile(path.join(native, 'capacitor.config.json'), 'utf8'));
assert(!config.server?.url, 'Release must bundle its UI, not load a remote preview');
console.log('PASS: PDF/data unchanged, all HTML resources local, local PDF worker, live calendar, label removed.');
