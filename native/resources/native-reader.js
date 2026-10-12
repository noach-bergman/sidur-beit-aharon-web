import crops from './page-crops.json';

export function installNativeReader() {
  let original = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'native-reader-original';
  button.className = 'ibtn';
  button.textContent = 'מקור';
  button.setAttribute('aria-label', 'הצגת העמוד המקורי עם השוליים');
  button.setAttribute('aria-pressed', 'false');
  document.querySelector('#btn-goto').before(button);
  button.addEventListener('click', () => {
    original = !original;
    button.textContent = original ? 'התאמה' : 'מקור';
    button.setAttribute('aria-pressed', String(original));
    button.setAttribute('aria-label', original ? 'התאמת העמוד למסך' : 'הצגת העמוד המקורי עם השוליים');
    window.dispatchEvent(new Event('resize'));
  });

  window.SiddurNativeReader = {
    paint(page, canvas, pageNumber, size, drawMarks) {
      const box = original ? [0, 0, 1, 1] : (crops.pages[pageNumber] || [0, 0, 1, 1]);
      const base = page.getViewport({ scale: 1 });
      const width = (box[2] - box[0]) * base.width;
      const height = (box[3] - box[1]) * base.height;
      // Fit the entire retained content; never stretch letters or cut lines to
      // match the phone's aspect ratio. Tall pages fall back to full-content fit.
      const scale = Math.min(size.w / width, size.h / height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const full = document.createElement('canvas');
      full.width = Math.ceil(viewport.width);
      full.height = Math.ceil(viewport.height);
      const context = full.getContext('2d', { alpha: false });
      return page.render({ canvasContext: context, viewport }).promise.then(() => {
        // Highlights stay in original, full-page coordinates before cropping.
        drawMarks(context, pageNumber, full.width, full.height, dpr);
        const x = Math.floor(box[0] * full.width), y = Math.floor(box[1] * full.height);
        const w = Math.ceil(box[2] * full.width) - x, h = Math.ceil(box[3] * full.height) - y;
        canvas.width = w; canvas.height = h;
        const displayScale = Math.min(1 / dpr, size.w / w, size.h / h);
        canvas.style.width = `${w * displayScale}px`;
        canvas.style.height = `${h * displayScale}px`;
        canvas.getContext('2d', { alpha: false }).drawImage(full, x, y, w, h, 0, 0, w, h);
        full.width = full.height = 0;
      });
    }
  };
}
