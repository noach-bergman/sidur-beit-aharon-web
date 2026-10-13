// Offline privacy/support information; leave the home gate and PDF untouched.
export function installPrivacy() {
  const index = document.querySelector('#sheet-index');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'native-privacy-link';
  open.textContent = 'פרטיות ותמיכה / Privacy & Support';
  index.append(open);

  const sheet = document.createElement('section');
  sheet.className = 'fullsheet native-privacy-sheet hidden';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'פרטיות ותמיכה / Privacy & Support');
  sheet.innerHTML = '<div class="fs-head"><button type="button" class="native-help">חזרה / Back</button><h2>פרטיות ותמיכה</h2></div><iframe title="Privacy policy and support / פרטיות ותמיכה"></iframe>';
  document.body.append(sheet);
  const close = sheet.querySelector('button');
  const frame = sheet.querySelector('iframe');
  let previous = [];
  function dismiss() {
    sheet.classList.add('hidden');
    for (const [node, inert] of previous) node.inert = inert;
    previous = [];
    open.focus({ preventScroll: true });
  }
  function escape(event) {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
  }
  open.addEventListener('click', () => {
    previous = [...document.body.children].filter(node => node !== sheet && /^(MAIN|SECTION)$/.test(node.tagName)).map(node => [node, node.inert]);
    for (const [node] of previous) node.inert = true;
    frame.src = './legal/privacy.html' + ((navigator.language || '').toLowerCase().startsWith('he') ? '#he' : '');
    sheet.classList.remove('hidden');
    close.focus({ preventScroll: true });
  });
  close.addEventListener('click', dismiss);
  sheet.addEventListener('keydown', escape);
  frame.addEventListener('load', () => {
    try { frame.contentDocument.addEventListener('keydown', escape); } catch { /* External policy links use a separate browser context. */ }
  });
}
