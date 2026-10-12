import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.resolve(root, '../docs');
const output = path.resolve(root, 'www');
const native = root;
const modules = path.join(native, 'node_modules');
const cropManifest = JSON.parse(await readFile(path.join(native, 'resources/page-crops.json'), 'utf8'));
const pdfHash = createHash('sha256').update(await readFile(path.join(source, 'siddur.pdf'))).digest('hex');
if (pdfHash !== cropManifest.pdfSha256) throw new Error('PDF changed: regenerate and verify the display-only margin map.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'css', 'js', 'data', 'icons', 'siddur.pdf']) {
  await cp(path.join(source, file), path.join(output, file), { recursive: true });
}
await mkdir(path.join(output, 'assets'), { recursive: true });
await cp(path.join(source, 'assets/siddur-gate-phone.png'), path.join(output, 'assets/siddur-gate-phone.png'));
await mkdir(path.join(output, 'vendor/pdfjs'), { recursive: true });
for (const file of ['pdf.min.js', 'pdf.worker.min.js']) {
  await cp(path.join(modules, 'pdfjs-dist/build', file), path.join(output, 'vendor/pdfjs', file));
}
await mkdir(path.join(output, 'fonts'), { recursive: true });
let fonts = '';
for (const [slug, family, weights] of [
  ['heebo', 'Heebo', [400, 500, 600, 700]],
  ['frank-ruhl-libre', 'Frank Ruhl Libre', [700, 900]]
]) {
  for (const weight of weights) {
    for (const subset of ['hebrew', 'latin']) {
      const name = `${slug}-${subset}-${weight}-normal.woff2`;
      await cp(path.join(modules, '@fontsource', slug, 'files', name), path.join(output, 'fonts', name));
      fonts += `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('../fonts/${name}') format('woff2');${subset === 'hebrew' ? 'unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;' : 'unicode-range:U+0000-00FF,U+2000-206F;'}}\n`;
    }
  }
}
await writeFile(path.join(output, 'css/fonts.css'), fonts);
await cp(path.join(native, 'resources/native.css'), path.join(output, 'css/native.css'));
await build({ entryPoints: [path.join(native, 'resources/native.js')], bundle: true, format: 'iife', outfile: path.join(output, 'js/native.js'), minify: true });

let html = await readFile(path.join(output, 'index.html'), 'utf8');
html = html.replace(/  <link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\n/g, '')
  .replace(/  <link rel="manifest"[^>]*>\n/, '')
  .replace('</head>', '  <link rel="stylesheet" href="./css/fonts.css" />\n  <link rel="stylesheet" href="./css/native.css" />\n</head>')
  .replace('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', './vendor/pdfjs/pdf.min.js')
  .replace('<script src="./js/app.js?v=18"></script>', '<script src="./js/native.js"></script>\n<script src="./js/app.js?v=18"></script>');
await writeFile(path.join(output, 'index.html'), html);
// Adapt only the generated native bundle; keep the source reader and PDF intact.
let app = await readFile(path.join(output, 'js/app.js'), 'utf8');
app = app.replace("'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/'", "'./vendor/pdfjs/'")
  .replace('url: PDF_URL, disableAutoFetch:', 'url: PDF_URL, isEvalSupported: false, disableAutoFetch:')
  .replace("if (!('serviceWorker' in navigator)) return;", "if (window.Capacitor && window.Capacitor.isNativePlatform()) return;\n    if (!('serviceWorker' in navigator)) return;");
const paintHook = "      var ctx = canvas.getContext('2d', { alpha: false });";
if (app.split(paintHook).length !== 2) throw new Error('Reader paint hook changed; review native integration.');
app = app.replace(paintHook, "      if (window.SiddurNativeReader) return window.SiddurNativeReader.paint(page, canvas, n, stageSize(), drawMarks);\n" + paintHook)
  .replace('        back.style.width = front.style.width || back.style.width;\n', '')
  .replace('        back.style.height = front.style.height || back.style.height;\n', '');
await writeFile(path.join(output, 'js/app.js'), app);
await mkdir(path.join(output, 'licenses'), { recursive: true });
for (const [pkg, name] of [['pdfjs-dist', 'PDFjs'], ['@fontsource/heebo', 'Heebo'], ['@fontsource/frank-ruhl-libre', 'FrankRuhlLibre']]) {
  await cp(path.join(modules, pkg, 'LICENSE'), path.join(output, 'licenses', `${name}.txt`));
}
console.log('Bundled offline siddur, unchanged PDF/data, local fonts, PDF.js, and native location adapter.');
