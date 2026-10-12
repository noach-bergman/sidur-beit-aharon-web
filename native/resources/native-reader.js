import crops from './page-crops.json';
import { installReaderGestures } from './reader-gestures.js';
import { createPagePresenter } from './page-turn.js';

export function installNativeReader() {
  let presenter;
  const revealControls = () => window.dispatchEvent(new Event('siddur-show-controls'));
  installReaderGestures(document.querySelector('#page-stage'), revealControls);

  window.SiddurNativeReader = {
    revealControls,
    show(pageNumber, hooks) {
      if (!presenter) {
        const reader = document.querySelector('#view-reader');
        const loader = document.querySelector('#reader-loading');
        presenter = createPagePresenter({
          ...hooks,
          front: document.querySelector('#pdf-canvas'),
          back: document.querySelector('#pdf-canvas-next'),
          visible: () => !reader.classList.contains('hidden'),
          loading(on, error) {
            if (error) loader.innerHTML = '<span style="color:#fff">שגיאה בטעינת הדף</span>';
            else loader.innerHTML = '<span class="spin"></span>';
            loader.classList.toggle('hidden', !on);
          }
        });
      }
      return presenter.request(pageNumber);
    },
    close() {
      presenter?.close();
      document.querySelector('#running-head').textContent = '';
      document.querySelector('#page-label').textContent = '';
    },
    paint(page, canvas, pageNumber, size, drawMarks) {
      const base = page.getViewport({ scale: 1 });
      const frame = crops.pages[pageNumber];
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
