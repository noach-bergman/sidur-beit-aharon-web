import { curlGeometry } from './page-curl-geometry.js';

// The leaf lifts from its bottom-left corner toward the right binding.
// Its scanned front bends over a diagonal cylinder; reverse turns lay it down.
export function startPageTurn(front, back, direction) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !front.animate) return null;
  const forward = direction > 0;
  const source = forward ? front : back;
  const width = source.clientWidth, height = source.clientHeight;
  if (!width || !height) return null;
  const padding = 14;
  const dpr = Math.min(source.width / width, 2);
  const overlay = document.createElement('canvas');
  overlay.className = 'pdf-page-curl';
  overlay.width = Math.ceil(width * dpr);
  overlay.height = Math.ceil((height + 2 * padding) * dpr);
  overlay.style.cssText = `position:absolute;z-index:3;pointer-events:none;left:${(front.clientWidth-width)/2}px;top:${(front.clientHeight-height)/2-padding}px;width:${width}px;height:${height+2*padding}px`;
  front.parentElement.append(overlay);
  const ctx = overlay.getContext('2d');
  ctx.scale(dpr, dpr);
  const duration = 520;
  let raf = 0, ended = false;

  function draw(progress) {
    ctx.clearRect(0, 0, width, height + 2 * padding);
    if (progress <= 0) { ctx.drawImage(source, 0, padding, width, height); return; }
    if (progress >= 1) return;
    const geometry = curlGeometry(width, height, progress);
    const point = (p, m) => [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]+padding];
    function path(patch) {
      ctx.beginPath();
      patch.polygon.forEach((p,i)=>{const [x,y]=point(p,patch.matrix);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      ctx.closePath();
    }
    function texture(patch) {
      if(!patch) return;
      ctx.save(); path(patch); ctx.clip();
      const m=patch.matrix;
      ctx.transform(m[0],m[1],m[2],m[3],m[4],m[5]+padding);
      ctx.drawImage(source,0,0,width,height);
      if(patch.shade) {ctx.fillStyle=`rgba(44,33,20,${.12*patch.shade})`;ctx.fillRect(0,0,width,height);}
      ctx.restore();
    }
    function paper(patch) {
      if(!patch) return;
      const shade=Math.round(255-32*Math.pow(patch.shade,4));
      ctx.fillStyle=`rgb(${shade},${shade},${shade-3})`;
      path(patch);ctx.fill();
    }
    const sh=geometry.shadow;
    const shadow=ctx.createLinearGradient(sh.nx*sh.low,sh.originY+sh.ny*sh.low+padding,
      sh.nx*sh.high,sh.originY+sh.ny*sh.high+padding);
    shadow.addColorStop(0,'rgba(35,27,17,0)');
    shadow.addColorStop(.32,'rgba(35,27,17,.17)');
    shadow.addColorStop(1,'rgba(35,27,17,0)');
    ctx.fillStyle=shadow;ctx.fillRect(0,padding,width,height);
    texture(geometry.flat);
    geometry.front.forEach(texture);
    paper(geometry.back);
    geometry.reverse.forEach(paper);
  }
  draw(forward ? 0 : 1);
  if (forward) { front.style.opacity='0'; back.style.visibility='visible'; back.style.opacity='1'; }
  // WAAPI supplies the clock, cancellation and reduced-motion-compatible
  // lifecycle; a canvas supplies the curved paper geometry.
  const clock = overlay.animate([{opacity:1},{opacity:1}], {duration,fill:'both'});
  function tick() {
    if (ended) return;
    const t = Math.min(1, Math.max(0, Number(clock.currentTime || 0)/duration));
    const eased = t*t*(3-2*t);
    draw(forward ? eased : 1-eased);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  const cleanup = () => {
    ended=true; cancelAnimationFrame(raf); clock.cancel(); overlay.remove();
    front.style.opacity=''; back.style.visibility=''; back.style.opacity='';
  };
  const finished = clock.finished.catch(() => {}).then(() => { if (!ended) draw(forward ? 1 : 0); });
  return { finished, cleanup, cancel: cleanup };
}

// Serialize PDF paint and animation. The page label describes displayed content,
// while state.pdfPage tracks the user's destination, including rapid taps.
export function createPagePresenter({ state, front, back, paint, copy, commit, visible, loading,
                                      transition = startPageTurn, reportError = console.error }) {
  let queued = null, running = false, displayed = null, epoch = 0, active = null;
  let idle = Promise.resolve();
  async function drain() {
    running = true; state.rendering = true;
    try {
      while (queued) {
        const job = queued; queued = null;
        if (job.epoch !== epoch || !visible()) continue;
        loading(displayed === null);
        try {
          await paint(back, job.page);
          // A newer request supersedes a page that has not started moving.
          if (job.epoch !== epoch || !visible() || queued) continue;
          if (displayed !== null && displayed !== job.page) {
            active = transition(front, back, Math.sign(job.page - displayed));
            if (active) await active.finished;
          }
          if (job.epoch !== epoch || !visible()) continue;
          copy(back, front);
          displayed = job.page;
          commit(job.page);
          loading(false);
        } catch (error) {
          reportError(error);
          if (job.epoch === epoch && visible() && !queued) {
            if (displayed !== null) state.pdfPage = displayed;
            loading(true, error);
          }
        } finally {
          active?.cleanup(); active = null;
        }
      }
    } finally {
      running = false; state.rendering = false; state.pendingPage = null;
    }
  }
  return {
    request(page) {
      state.pdfPage = page;
      state.pendingPage = page;
      queued = { page, epoch };
      if (!running) idle = drain();
      return idle;
    },
    close() {
      epoch++; queued = null; displayed = null;
      state.pendingPage = null;
      active?.cancel();
      loading(false);
    }
  };
}
