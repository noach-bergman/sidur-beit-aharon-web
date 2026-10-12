export function classifySwipe(dx, dy) {
  if (Math.abs(dy) >= 45 && Math.abs(dy) >= Math.abs(dx) * 1.2) return 'controls';
  if (Math.abs(dx) >= 70 && Math.abs(dx) >= Math.abs(dy) * 1.2) return 'page';
  return null;
}

// Capture runs before the original reader's horizontal swipe handler.
export function installReaderGestures(stage, revealControls) {
  let start = null, suppressClick = false;
  stage.addEventListener('touchstart', event => {
    suppressClick = false;
    const t = event.touches.length === 1 ? event.touches[0] : null;
    start = t ? [t.clientX, t.clientY] : null;
  }, { capture: true, passive: true });
  stage.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) start = null;
  }, { capture: true, passive: true });
  stage.addEventListener('touchcancel', () => { start = null; suppressClick = false; }, { capture: true, passive: true });
  stage.addEventListener('touchend', event => {
    const t = event.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start[0], dy = t.clientY - start[1];
    start = null;
    const gesture = classifySwipe(dx, dy);
    // A drag must not become a center toggle or an edge page tap afterwards.
    suppressClick = Math.hypot(dx, dy) >= 20;
    if (gesture === 'controls') {
      event.stopImmediatePropagation();
      revealControls();
    }
  }, { capture: true, passive: true });
  stage.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }, true);
}
