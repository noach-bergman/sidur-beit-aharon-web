import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
const read=name=>readFile(resolve(root,name),'utf8');
const json=async name=>JSON.parse(await read(name));
const [toc,menu,tehillim,highlights,crops]=await Promise.all([
  json('docs/data/toc.json'),json('docs/data/menu.json'),json('docs/data/tehillim.json'),json('docs/data/highlights.json'),json('native/resources/page-crops.json')
]);
for(const name of ['toc','menu','tehillim','highlights']) assert.equal(await read(`data/${name}.json`),await read(`docs/data/${name}.json`),`${name} copies differ`);
const hash=createHash('sha256').update(await readFile(resolve(root,'docs/siddur.pdf'))).digest('hex');
assert.equal(hash,crops.pdfSha256,'Crop map belongs to a different PDF');
assert.equal(toc.pdfPages,crops.pageCount);
const special={1:'שער / cover',2:'תוכן ומפתח / contents',231:'לוח / table',232:'שער תהלים / Tehillim cover',303:'עמוד ללא מספור / unnumbered page',304:'שער מנהגים / Minhagim cover'};
const pages=Array.from({length:toc.pdfPages},(_,i)=>{
  const pdfPage=i+1,sequence=toc.sequences.find(s=>pdfPage>=s.pdfFrom&&pdfPage<=s.pdfTo);
  const entries=toc.entries.filter(e=>e.pdfPage===pdfPage);
  const nearest=sequence?toc.entries.filter(e=>e.section===sequence.section&&e.pdfPage&&e.pdfPage<=pdfPage).sort((a,b)=>b.pdfPage-a.pdfPage)[0]:null;
  assert(crops.pages[pdfPage],`No crop for ${pdfPage}`);
  return {pdfPage,section:sequence?.section||'unnumbered',printed:sequence?pdfPage+sequence.offset:null,
    special:special[pdfPage]||null,starts:entries.map(e=>e.title),nearestIndexedHeading:nearest?.title||null,
    tehillimChapters:tehillim.pages[String(pdfPage)]||[],crop:crops.pages[pdfPage],
    highlights:highlights.items.filter(h=>h.page===pdfPage).map(({id,rule,label})=>({id,rule,label}))};
});
for(const entry of toc.entries)assert(entry.pdfPage===null||(entry.pdfPage>=1&&entry.pdfPage<=toc.pdfPages));
for(const h of highlights.items)assert(h.page>=1&&h.page<=toc.pdfPages);
const data={generatedAt:new Date().toISOString(),pdfSha256:hash,pdfPageCount:toc.pdfPages,sequences:toc.sequences,missingPrintedPages:toc.missingPrintedPages,prayers:toc.entries.map(e=>({...e,menuCategories:menu.categories.filter(c=>c.items.includes(e.title)).map(c=>c.title)})),pages};
await mkdir(resolve(root,'reference'),{recursive:true});
await writeFile(resolve(root,'reference/page-index.json'),JSON.stringify(data,null,2)+'\n');
const esc=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');
const table=(heads,rows)=>[heads,heads.map(()=> '---'),...rows].map(row=>'| '+row.map(esc).join(' | ')+' |').join('\n');
const generated=`## Generated lookup indexes\n\nGenerated ${data.generatedAt}. PDF SHA-256: \`${hash}\`.\n\n${toc.pdfPages} PDF pages; ${toc.entries.length} indexed prayer/section entries; ${menu.categories.length} menu categories. Machine-readable detail: [reference/page-index.json](reference/page-index.json). Nearest indexed headings below are navigation inferences, not OCR or a verified title for each individual scanned page.\n\n### Numbering sequences\n\n${table(['Section','PDF from','PDF to','Printed = PDF +'],toc.sequences.map(s=>[s.section,s.pdfFrom,s.pdfTo,s.offset]))}\n\n### Every indexed prayer and section\n\n${table(['Prayer / section','Menu group','Book section','Printed label / number','PDF page','Status / note'],data.prayers.map(e=>[e.title,e.menuCategories.join(' / '),e.section,`${e.printedLabel||''} / ${e.printed??'—'}`,e.pdfPage,e.note||(e.pdfPage?'Available':'Missing')]))}\n\n### Every scanned page\n\n${table(['PDF page','Section','Printed number','Starts on this page','Nearest indexed heading (inferred)','Tehillim chapters','Frame kind','Highlight entries'],pages.map(p=>[p.pdfPage,p.section,p.printed,p.starts.join(' / ')||p.special,p.nearestIndexedHeading,p.tehillimChapters.join(', '),p.crop.kind,p.highlights.length]))}\n`;
const filename=resolve(root,'PROJECT_REFERENCE.md');const doc=await readFile(filename,'utf8');
const begin='<!-- GENERATED INDEX START -->',end='<!-- GENERATED INDEX END -->';
assert.equal(doc.split(begin).length,2);assert.equal(doc.split(end).length,2);
await writeFile(filename,doc.slice(0,doc.indexOf(begin)+begin.length)+'\n\n'+generated+'\n'+doc.slice(doc.indexOf(end)));
console.log(`Indexed ${pages.length} pages, ${toc.entries.length} entries and ${menu.categories.length} categories; PDF and source data unchanged.`);
