// Native-only home layout. Keep the reader and calendar implementation intact.
export function installFixedHome() {
  const home = document.querySelector('#view-today');
  const shell = home.querySelector('.gate-shell');
  const panel = document.querySelector('#t-panel');
  const footer = home.querySelector('.foot');
  const anchor = document.createComment('daily panel position');
  panel.before(anchor);

  const more = document.createElement('button');
  more.type = 'button';
  more.id = 'native-day-button';
  more.className = 'quick-btn hidden';
  more.textContent = 'היום ותזכורות';
  more.setAttribute('aria-controls', 'native-day-sheet');
  more.setAttribute('aria-expanded', 'false');
  footer.before(more);

  const sheet = document.createElement('section');
  sheet.id = 'native-day-sheet';
  sheet.className = 'fullsheet hidden';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'היום ותזכורות');
  sheet.innerHTML = '<div class="fs-head"><button type="button" class="native-day-close">חזרה</button><h2>היום ותזכורות</h2><span class="ibtn-spacer"></span></div><div class="scroller"></div>';
  document.body.append(sheet);
  const sheetBody = sheet.querySelector('.scroller');
  const closeButton = sheet.querySelector('button');
  let frame = 0;

  function close(restoreFocus = true) {
    sheet.classList.add('hidden');
    more.setAttribute('aria-expanded', 'false');
    home.removeAttribute('inert');
    if (restoreFocus && !home.classList.contains('hidden')) more.focus({ preventScroll: true });
    schedule();
  }
  more.addEventListener('click', () => {
    sheet.classList.remove('hidden');
    more.setAttribute('aria-expanded', 'true');
    home.setAttribute('inert', '');
    closeButton.focus({ preventScroll: true });
  });
  closeButton.addEventListener('click', () => close());
  // Existing day-row callbacks still open the same scanned page. Remove our
  // overlay in the same event turn so it cannot cover the reader.
  sheetBody.addEventListener('click', event => {
    if (event.target.closest('button')) close(false);
  });
  sheet.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const buttons = [...sheet.querySelectorAll('button')].filter(el => el.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  function fits() {
    const bottom = shell.getBoundingClientRect().bottom - parseFloat(getComputedStyle(shell).paddingBottom);
    return footer.getBoundingClientRect().bottom <= bottom + 1;
  }
  function fit() {
    frame = 0;
    if (home.classList.contains('hidden') || !sheet.classList.contains('hidden')) return;
    home.removeAttribute('data-home-density');
    more.classList.add('hidden');
    if (panel.parentElement !== shell) anchor.after(panel);
    home.scrollTop = 0;
    if (fits()) return;
    home.dataset.homeDensity = 'compact';
    if (fits()) return;
    if (panel.querySelector('.block:not(.hidden)')) {
      sheetBody.append(panel);
      more.classList.remove('hidden');
    }
    if (!fits()) home.dataset.homeDensity = 'tight';
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(fit);
  }
  const observer = new MutationObserver(schedule);
  for (const id of ['t-special', 't-reminders', 't-badges', 't-notice-text']) {
    observer.observe(document.getElementById(id), { childList: true, subtree: true, characterData: true });
  }
  for (const element of [home, ...panel.querySelectorAll('.block')]) {
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  // Prevent the native home surface from participating in pan/rubber-band
  // gestures. Other full-screen lists and the PDF's swipe handlers are untouched.
  home.addEventListener('touchmove', event => event.preventDefault(), { passive: false });
  schedule();
}
