import test from 'node:test';
import assert from 'node:assert/strict';
import { createPagePresenter, startPageTurn } from '../resources/page-turn.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const state = {}, front = {}, back = {}, paints = [], turns = [], commits = [], errors = [];
  let visible = true;
  const controller = createPagePresenter({ state, front, back,
    paint(canvas, page) { const job = deferred(); paints.push({ ...job, page }); return job.promise.then(() => { canvas.page = page; }); },
    copy(source, target) { target.page = source.page; },
    commit(page) { assert.equal(front.page, page); commits.push(page); },
    visible: () => visible, loading() {}, reportError: error => errors.push(error),
    transition(oldPage, newPage, direction) { const job = deferred(); const turn = { direction, from: oldPage.page, to: newPage.page, finished: job.promise, cleanup() {}, cancel: job.resolve, resolve: job.resolve }; turns.push(turn); return turn; }
  });
  return { controller, state, front, paints, turns, commits, errors, hide() { visible=false; controller.close(); }, show() { visible=true; } };
}
async function initial(f, page=14) { const done=f.controller.request(page); f.paints.at(-1).resolve(); await done; }
test('label and content commit together only after movement finishes', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15);
  assert.deepEqual(f.commits,[14]); f.paints.at(-1).resolve(); await tick();
  assert.deepEqual(f.commits,[14]); assert.equal(f.front.page,14); assert.equal(f.turns[0].direction,1);
  f.turns[0].resolve(); await done; assert.deepEqual(f.commits,[14,15]); assert.equal(f.state.rendering,false);
});
test('rapid forward requests preserve final destination and skip stale paints', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15);
  f.controller.request(16); f.controller.request(17); assert.equal(f.state.pdfPage,17);
  f.paints.at(-1).resolve(); await tick(); assert.deepEqual(f.paints.map(x=>x.page),[14,15,17]); assert.equal(f.turns.length,0);
  f.paints.at(-1).resolve(); await tick(); f.turns.at(-1).resolve(); await done;
  assert.deepEqual(f.commits,[14,17]);
});
test('reverse request during a turn is serialized and keeps labels in order', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15); f.paints.at(-1).resolve(); await tick();
  f.controller.request(14); f.turns[0].resolve(); await tick(); assert.deepEqual(f.commits,[14,15]);
  f.paints.at(-1).resolve(); await tick(); assert.equal(f.turns[1].direction,-1); f.turns[1].resolve(); await done;
  assert.deepEqual(f.commits,[14,15,14]);
});
test('closing while painting cannot overwrite a reopened prayer', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15); f.hide(); f.show(); f.controller.request(103);
  f.paints.at(-1).resolve(); await tick(); assert.deepEqual(f.commits,[14]); assert.equal(f.paints.at(-1).page,103);
  f.paints.at(-1).resolve(); await done; assert.deepEqual(f.commits,[14,103]); assert.equal(f.turns.length,0);
});
test('closing during movement cancels it and prevents a stale label', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15); f.paints.at(-1).resolve(); await tick(); f.hide(); await done;
  assert.deepEqual(f.commits,[14]); assert.equal(f.state.rendering,false);
});
test('render failure preserves the displayed destination and navigation recovers', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(15); f.paints.at(-1).reject(new Error('render failure')); await done;
  assert.equal(f.state.pdfPage,14); assert.deepEqual(f.commits,[14]); assert.equal(f.errors.length,1);
  const recovery=f.controller.request(15); f.paints.at(-1).resolve(); await tick(); f.turns.at(-1).resolve(); await recovery; assert.equal(f.front.page,15);
});
test('same-page resize does not animate', async () => {
  const f=fixture(); await initial(f); const done=f.controller.request(14); f.paints.at(-1).resolve(); await done; assert.equal(f.turns.length,0);
});
test('reduced motion disables page movement', () => {
  globalThis.window={matchMedia:()=>({matches:true})};
  assert.equal(startPageTurn({animate(){throw new Error('must not animate');}}, {},1),null);
  delete globalThis.window;
});
