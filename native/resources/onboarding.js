import { guideLanguage } from './guide-language.js';
const SEEN = 'siddur-guide-v1';
const LANGUAGE = 'siddur-guide-language';
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key,value) => { try { localStorage.setItem(key,value); } catch {} };
const text = {
  en: {welcome:'Welcome to your siddur',intro:'A short, hands-on guide to choosing a tefillah and reading comfortably.',start:'Show me how',skip:'Skip for now',next:'Continue',try:'Try it',done:'Start using the siddur',loading:'Preparing the guide…',retry:'The guide could not load. You can try again from Help in the prayer menu.',step:'Step',of:'of',finish:'You’re ready',finishBody:'The home screen also has Tehillim, Birkat Hamazon and daily prayer times. You can replay this guide from “עזרה” (Help) in the prayer menu.',help:'Help / עזרה'},
  he: {welcome:'ברוכים הבאים לסידור',intro:'הדרכה קצרה לבחירת תפילה ולקריאה נוחה.',start:'מתחילים',skip:'דילוג לעכשיו',next:'המשך',try:'נסו כאן',done:'לפתיחת הסידור',loading:'מכינים את ההדרכה…',retry:'לא ניתן לטעון את ההדרכה. אפשר לנסות שוב דרך ״עזרה״ בתפריט התפילות.',step:'שלב',of:'מתוך',finish:'אפשר להתחיל',finishBody:'במסך הבית תמצאו גם תהלים, ברכת המזון וזמני היום. אפשר לחזור להדרכה דרך ״עזרה״ בתפריט התפילות.',help:'עזרה / Help'}
};
const words = (en,he) => ({en,he});
const $ = selector => document.querySelector(selector);
const row = title => [...document.querySelectorAll('#idx-list button.row')].find(b=>b.querySelector('.row-title')?.textContent.startsWith(title));
const hand = '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M14 24V7a4 4 0 0 1 8 0v13-3a3.5 3.5 0 0 1 7 0v3a3.5 3.5 0 0 1 7 0v11c0 8-5 13-12 13h-4c-5 0-8-3-11-7L3 29a4 4 0 0 1 6-5l5 5z" fill="#fffaf0" stroke="#866337" stroke-width="2"/></svg>';
const steps = [
  {id:'menu',target:()=>$('#btn-index'),title:words('Choose a tefillah','בוחרים תפילה'),body:words('The large prayer button is a quick shortcut. Tap “לבחירת תפילה” to browse every prayer and blessing.','הכפתור הגדול פותח מיד את התפילה המתאימה. לבחירת תפילה אחרת, לחצו על ״לבחירת תפילה״.'),action:true,home:true},
  {id:'category',target:()=>row('שחרית'),title:words('Find the section','בוחרים סדר'),body:words('Choose a section, or use the search field above. Let’s open Shacharit as an example.','בחרו סדר, או חפשו בשדה החיפוש למעלה. נפתח את שחרית לדוגמה.'),action:true},
  {id:'prayer',target:()=>row('תפלת שחרית'),title:words('Open the printed page','פותחים את התפילה'),body:words('Tap the prayer name to open its original siddur page.','לחצו על שם התפילה כדי לפתוח את העמוד המקורי בסידור.'),action:true},
  {id:'fullscreen',target:()=>$('#tap-menu'),title:words('Read without the controls','קוראים במסך מלא'),body:words('Tap the middle of the page to hide the header and buttons. The prayer stays in the same place.','נגיעה באמצע העמוד מסתירה את הכותרת והכפתורים. התפילה נשארת באותו מקום.'),action:true,region:'center',reader:true},
  {id:'turn',target:()=>$('#tap-next'),title:words('Turn a page','מעבירים עמוד'),body:words('Swipe right to go forward, or tap the left edge. Swipe left or tap the right edge to go back—like a Hebrew book.','להמשך, החליקו ימינה או געו בשוליים השמאליים. לחזרה, החליקו שמאלה או געו בשוליים הימניים — כמו בספר עברי.'),action:true,region:'turn',reader:true},
  {id:'controls',target:()=>$('#tap-menu'),title:words('Bring the controls back','מחזירים את הכפתורים'),body:words('Tap the middle again whenever you need the controls.','נוגעים שוב באמצע העמוד כדי להציג את הכפתורים.'),action:true,region:'center',reader:true},
  {id:'original',target:()=>$('#native-reader-original'),title:words('Choose the page size','בוחרים את תצוגת העמוד'),body:words('The fitted view makes the text larger by reducing blank margins. “מקור” shows the original page with its wider margins.','התצוגה המותאמת מגדילה את הכתב באמצעות צמצום השוליים הריקים. ״מקור״ מציג את העמוד עם השוליים המקוריים.'),action:true,reader:true,chrome:true},
  {id:'fitted',target:()=>$('#native-reader-original'),title:words('Return to the larger view','חוזרים לתצוגה המוגדלת'),body:words('Tap “התאמה” to return to the fitted page. No words are changed in either view.','לחצו על ״התאמה״ כדי לחזור לעמוד המותאם למסך. המילים נשארות זהות בשתי התצוגות.'),action:true,reader:true},
  {id:'home',target:()=>$('#btn-back'),title:words('Back to the gate','חוזרים למסך הבית'),body:words('The close button returns you to the home screen.','כפתור הסגירה מחזיר למסך הבית.'),action:true,reader:true},
  {id:'today',target:()=>$('#native-day-button')?.getClientRects().length?$('#native-day-button'):$('#t-panel'),title:words('Today’s additions','התוספות של היום'),body:words('Daily additions and reminders appear here. On busy days, “היום ותזכורות” opens the full list. In the reader, tap a day-marking note to show or hide its highlights.','כאן מופיעות התוספות והתזכורות של היום. ביום עמוס, ״היום ותזכורות״ פותח את הרשימה המלאה. בקורא אפשר לגעת בהערת הסימון כדי להציג או להסתיר את ההדגשות.')},
  {id:'location',target:()=>$('#btn-location'),title:words('Set your city','בוחרים מיקום'),body:words('Your city helps determine prayer times and the Hebrew date. Tap here to choose it.','המיקום משמש לקביעת זמני התפילה והתאריך העברי. לחצו כאן כדי לבחור עיר.'),action:true},
  {id:'city',target:()=>$('#loc-cancel'),highlight:()=>$('#loc-gps'),title:words('Location is optional','אפשר לבחור עיר ידנית'),body:words('Choose a city manually, or use “אתר אותי” when you want to allow location access. This practice guide leaves your current city unchanged.','אפשר לבחור עיר מהרשימה, או ללחוץ על ״אתר אותי״ כדי לאפשר גישה למיקום. ההדרכה אינה משנה את העיר שבחרתם.'),action:true}
];

export function installOnboarding() {
  const root=document.createElement('section');
  root.className='native-guide';root.id='native-guide';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','guide-title');document.body.append(root);
  let language=guideLanguage(read(LANGUAGE), navigator.languages?.[0] || navigator.language), hooks=null, active=false, step=-1, generation=0, saved=null, frame=0, busy=false;
  let deferredLocation=null;
  const inertState=new Map();
  const T=()=>text[language];
  function lock() {
    for(const node of document.body.children) if(node!==root) {inertState.set(node,node.hasAttribute('inert'));node.setAttribute('inert','');}
  }
  function unlock() {for(const [node,was] of inertState) if(!was)node.removeAttribute('inert');inertState.clear();}
  function buttons() {return [...root.querySelectorAll('button')].filter(el=>!el.disabled&&el.getClientRects().length);}
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();finish(true);}
    if(e.key!=='Tab')return;
    const all=buttons(),first=all[0],last=all.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  });
  function base() {root.lang=language;root.dir=language==='he'?'rtl':'ltr';}
  function chrome(title,body,primary) {
    base();root.innerHTML=`<div class="guide-dimmer"></div><div class="guide-card guide-welcome"><p class="guide-eyebrow">סידור בית אהרן וישראל</p><h2 id="guide-title"></h2><p class="guide-copy"></p><div class="guide-languages"><button data-language="he" type="button">עברית</button><button data-language="en" type="button">English</button></div><button type="button" class="guide-primary"></button><button type="button" class="guide-skip"></button></div>`;
    root.querySelector('h2').textContent=title;root.querySelector('.guide-copy').textContent=body;
    root.querySelector('.guide-primary').textContent=primary;root.querySelector('.guide-skip').textContent=T().skip;
    root.querySelector('.guide-skip').onclick=()=>finish(true);
    root.querySelectorAll('[data-language]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.language===language));b.onclick=()=>{language=b.dataset.language;write(LANGUAGE,language);welcome();};});
  }
  function welcome() {
    step=-1;chrome(T().welcome,T().intro,T().start);
    root.querySelector('.guide-primary').onclick=()=>begin();root.querySelector('.guide-primary').focus();
  }
  function open() {
    if(active)return; active=true;generation++;root.hidden=false;lock();saved=hooks?.snapshot();welcome();
  }
  function finish(markSeen) {
    if(!active)return;active=false;generation++;busy=false;cancelAnimationFrame(frame);
    root.hidden=true;unlock();hooks?.home();if(saved)hooks?.restore(saved);
    if(markSeen)write(SEEN,'1');
    const pending=deferredLocation;deferredLocation=null;if(pending)setTimeout(pending,600);
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function ready(check,token) {
    for(let i=0;i<100;i++){if(!active||generation!==token)return false;if(check())return true;await wait(80);}
    return false;
  }
  async function begin() {
    if(busy)return;busy=true;const token=generation;
    root.querySelector('.guide-primary').disabled=true;root.querySelector('.guide-primary').textContent=T().loading;
    if(!await ready(()=>hooks?.ready(),token)){
      if(active&&token===generation){busy=false;root.querySelector('.guide-copy').textContent=T().retry;root.querySelector('.guide-primary').disabled=false;root.querySelector('.guide-primary').textContent=T().start;}return;
    }
    if(!saved)saved=hooks.snapshot();hooks.home();window.SiddurNativeReader.setOriginalMode(false);busy=false;await show(0);
  }
  function rectangle(s) {
    const el=s.highlight?.()||s.target();if(!el)return null;
    const r=el.getBoundingClientRect();
    if(s.region==='center')return {left:innerWidth/2-38,top:innerHeight/2-38,width:76,height:76};
    if(s.region==='turn'){
      const page=$('#pdf-canvas').getBoundingClientRect();return {left:12,top:Math.min(innerHeight-170,page.bottom-100),width:80,height:80};
    }
    return {left:Math.max(8,r.left-5),top:Math.max(8,r.top-5),width:Math.min(innerWidth-16,r.width+10),height:Math.min(innerHeight-16,r.height+10)};
  }
  function layout() {
    if(!active||step<0||step>=steps.length)return;
    const rect=rectangle(steps[step]);if(!rect)return;
    const spot=root.querySelector('.guide-spot'),card=root.querySelector('.guide-card');if(!spot||!card)return;
    Object.assign(spot.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const upper=rect.top+rect.height/2>innerHeight*.53;
    card.classList.toggle('guide-card-top',upper);card.classList.toggle('guide-card-bottom',!upper);
  }
  function scheduleLayout(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
  async function show(index) {
    step=index;
    if(index>=steps.length){chrome(T().finish,T().finishBody,T().done);root.querySelector('.guide-languages').remove();root.querySelector('.guide-skip').remove();root.querySelector('.guide-primary').onclick=()=>finish(true);root.querySelector('.guide-primary').focus();return;}
    const s=steps[index],token=generation;busy=true;
    if(s.chrome)hooks.chrome();
    if(!await ready(()=>{const el=s.target();return el&&el.getClientRects().length&&(!s.reader||hooks.idle());},token)){if(active&&token===generation)finish(false);return;}
    if(s.id==='category'||s.id==='prayer')s.target().scrollIntoView({block:'center',behavior:'instant'});
    base();root.innerHTML=`<button type="button" class="guide-spot" tabindex="-1" aria-hidden="true"><span class="guide-hand">${hand}</span></button><div class="guide-card"><div class="guide-meta"><span class="guide-progress"></span><button class="guide-switch" type="button"></button></div><h2 id="guide-title"></h2><p class="guide-copy"></p><div class="guide-actions"><button type="button" class="guide-skip"></button><button type="button" class="guide-primary"></button></div></div>`;
    root.dataset.step=s.id;
    root.querySelector('.guide-progress').textContent=`${T().step} ${index+1} ${T().of} ${steps.length}`;
    root.querySelector('h2').textContent=s.title[language];root.querySelector('.guide-copy').textContent=s.body[language];
    root.querySelector('.guide-primary').textContent=s.action?T().try:T().next;
    root.querySelector('.guide-skip').textContent=T().skip;root.querySelector('.guide-skip').onclick=()=>finish(true);
    root.querySelector('.guide-switch').textContent=language==='he'?'English':'עברית';root.querySelector('.guide-switch').onclick=()=>{language=language==='he'?'en':'he';write(LANGUAGE,language);show(step);};
    root.querySelector('.guide-primary').onclick=perform;root.querySelector('.guide-spot').onclick=perform;
    busy=false;layout();root.querySelector('.guide-primary').focus();
  }
  async function perform() {
    if(busy||!active)return;busy=true;const token=generation,s=steps[step];
    root.querySelector('.guide-primary').disabled=true;
    if(s.action)s.target()?.click();
    // The original reader opens after two animation frames; let that request
    // start before waiting for its paint/turn to finish.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(!active||token!==generation)return;
    if(!await ready(()=>hooks.idle(),token)){if(active&&token===generation)finish(false);return;}
    busy=false;await show(step+1);
  }
  window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);
  window.SiddurNativeGuide={
    configure(value){hooks=value;const help=document.createElement('button');help.type='button';help.className='native-help';help.textContent='עזרה';help.setAttribute('aria-label','עזרה / Help');help.onclick=open;$('#sheet-index .ibtn-spacer').replaceWith(help);if(read(SEEN)!=='1')open();},
    afterIntro(callback){if(read(SEEN)==='1')setTimeout(callback,600);else deferredLocation=callback;},
    open
  };
}
