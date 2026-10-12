import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySwipe, installReaderGestures } from '../resources/reader-gestures.js';
test('vertical gestures reveal controls without qualifying as page turns', () => {
  for (const [x,y] of [[0,80],[0,-80],[50,80],[-50,-80]]) assert.equal(classifySwipe(x,y),'controls');
  for (const [x,y] of [[80,0],[-80,0],[90,30]]) assert.equal(classifySwipe(x,y),'page');
  for (const [x,y] of [[0,10],[60,0],[75,75]]) assert.equal(classifySwipe(x,y),null);
});
function fixture() {
  const listeners={}; let reveals=0;
  installReaderGestures({addEventListener(type,handler){listeners[type]=handler;}},()=>reveals++);
  const emit=(type,x=0,y=0,count=1)=>{
    const event={touches:Array.from({length:count},()=>({clientX:x,clientY:y})),changedTouches:[{clientX:x,clientY:y}],stopped:false,prevented:false,stopImmediatePropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};
    listeners[type](event);return event;
  };
  return {emit, reveals:()=>reveals};
}
test('up/down stop the page handler and suppress a following synthetic tap',()=>{
  const f=fixture();
  for(const y of [100,-100]){f.emit('touchstart');assert.equal(f.emit('touchend',5,y).stopped,true);assert.equal(f.emit('click').prevented,true);}
  assert.equal(f.reveals(),2);
  f.emit('touchstart');f.emit('touchend',0,0);assert.equal(f.emit('click').prevented,false);
});
test('horizontal turns still reach the page handler; canceled and multi-touch gestures do not reveal',()=>{
  const f=fixture();f.emit('touchstart');assert.equal(f.emit('touchend',100,5).stopped,false);assert.equal(f.emit('click').prevented,true);
  f.emit('touchstart');f.emit('touchcancel');f.emit('touchend',0,100);
  f.emit('touchstart',0,0,2);f.emit('touchend',0,100);
  assert.equal(f.reveals(),0);
});
