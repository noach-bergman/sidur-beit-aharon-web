import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const toc=await read('../../docs/data/toc.json');
const audit=await read('../../reference/printed-contents-audit.json');
test('prayer index matches the printed contents and does not invent a missing alphabet scan',()=>{
  assert.deepEqual(toc.entries.slice(0,62).map(e=>e.printed),audit.mainPrintedNumbersInContentsOrder);
  assert.deepEqual(toc.missingPrintedPages,audit.missingPrintedPages);
  assert.equal(toc.entries.find(e=>e.title==='סדר אלף בית').pdfPage,null);
  for(const e of toc.entries.filter(e=>e.pdfPage)){
    if(e.title==='לוח קביעת השנים')continue;
    const sequence=toc.sequences.find(s=>s.section===e.section&&e.pdfPage>=s.pdfFrom&&e.pdfPage<=s.pdfTo);
    assert(sequence,e.title);
    if(e.title==='סדר פדיון הבן'){assert.equal(e.pdfPage,80);assert(e.note.includes('ההמשך'));}
    else assert.equal(e.printed,e.pdfPage+sequence.offset,e.title);
  }
});
