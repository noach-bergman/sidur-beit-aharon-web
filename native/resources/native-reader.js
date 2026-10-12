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
      const base = page.getViewport({ scale: 1 });
      const frame = original ? null : crops.pages[pageNumber];
      const box = frame || { x: 0, y: 0, width: base.width, height: base.height };
      const scale = Math.min(size.w / box.width, size.h / box.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Every fitted page has the same display rectangle. Ordinary pages also
      // share the same physical frame, so turning pages never changes zoom.
      // Render directly into that rectangle: no fractional crop/copy/rescale.
      const displayRatio = frame ? crops.frame[1] / crops.frame[0] : box.height / box.width;
      canvas.width = Math.floor(box.width * scale * dpr);
      canvas.height = Math.floor(canvas.width * displayRatio);
      canvas.style.width = `${canvas.width / dpr}px`;
      canvas.style.height = `${canvas.height / dpr}px`;
      const renderScale = canvas.width / box.width;
      const viewport = page.getViewport({ scale: renderScale });
      const context = canvas.getContext('2d', { alpha: false });
      const dx = -box.x * renderScale, dy = -box.y * renderScale;
      return page.render({ canvasContext: context, viewport,
        transform: [1, 0, 0, 1, dx, dy] }).promise.then(() => {
        // Keep the original highlight coordinates and data. Excess highlight
        // wash over blank paper is naturally clipped at the common frame edge.
        context.save();
        context.translate(dx, dy);
        drawMarks(context, pageNumber, viewport.width, viewport.height, dpr);
        context.restore();
      });
    }
  };
}
