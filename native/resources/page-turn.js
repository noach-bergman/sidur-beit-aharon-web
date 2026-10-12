// A cylindrical paper fold. The next Hebrew page is revealed from the left;
// its outgoing leaf bends toward the right binding. Reverse turns lay the
// previous leaf back down. Text stays on the front; the paper reverse is blank.
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
  const radius = width * .115;
  const duration = 520;
  let raf = 0, ended = false;

  function draw(progress) {
    ctx.clearRect(0, 0, width, height + 2 * padding);
    if (progress <= 0) { ctx.drawImage(source, 0, padding, width, height); return; }
    if (progress >= 1) return;
    const fold = progress * (width + Math.PI * radius);
    const shadowX = fold - radius;
    const shadow = ctx.createLinearGradient(shadowX - 18, 0, fold + 12, 0);
    shadow.addColorStop(0, 'rgba(35,27,17,0)');
    shadow.addColorStop(.32, 'rgba(35,27,17,.17)');
    shadow.addColorStop(1, 'rgba(35,27,17,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(shadowX - 18, padding - 3, radius + 30, height + 6);
    // The still-flat front of the outgoing leaf.
    const flat = Math.min(width, Math.max(0, fold));
    if (flat < width) ctx.drawImage(source, flat / width * source.width, 0,
      (width-flat) / width * source.width, source.height, flat, padding, width-flat, height);
    // Front half of the curl, textured with the actual scanned page. Thin
    // vertical strips follow the cylinder rather than sliding the whole page.
    const strips = 64, step = Math.PI / strips;
    for (let i = 0; i < strips / 2; i++) {
      const a0 = i * step, a1 = (i+1) * step;
      const x0 = Math.max(0, fold-radius*a1), x1 = Math.min(width, fold-radius*a0);
      if (x1 <= x0) continue;
      const t0 = (fold-x1)/radius, t1 = (fold-x0)/radius;
      const left = fold-radius*Math.sin(t1), right = fold-radius*Math.sin(t0);
      const lift = (1-Math.cos((t0+t1)/2))*6;
      ctx.drawImage(source, x0/width*source.width, 0, (x1-x0)/width*source.width, source.height,
        left, padding-lift, Math.max(.1,right-left)+.35, height+2*lift);
      ctx.fillStyle = `rgba(44,33,20,${.13*Math.sin((t0+t1)/2)})`;
      ctx.fillRect(left,padding-lift,Math.max(.1,right-left)+.35,height+2*lift);
    }
    // The turned-over flat sheet, then its curved reverse (drawn on top).
    const backWidth = Math.max(0, fold-Math.PI*radius);
    ctx.fillStyle = '#fffefa';
    ctx.fillRect(fold,padding-12,backWidth,height+24);
    for (let i = strips-1; i >= strips/2; i--) {
      const x0 = Math.max(0, fold-radius*(i+1)*step), x1 = Math.min(width, fold-radius*i*step);
      if (x1 <= x0) continue;
      const t0 = (fold-x1)/radius, t1 = (fold-x0)/radius;
      const left = fold-radius*Math.sin(t0), right = fold-radius*Math.sin(t1);
      const lift = (1-Math.cos((t0+t1)/2))*6;
      const shade = Math.round(255 - 32*Math.pow(Math.sin((t0+t1)/2),4));
      ctx.fillStyle = `rgb(${shade},${shade},${Math.max(0,shade-3)})`;
      ctx.fillRect(left,padding-lift,Math.max(.1,right-left)+.5,height+2*lift);
    }
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
