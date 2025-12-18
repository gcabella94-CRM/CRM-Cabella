// modules/notizie/notiziaDrawer.js
// Drawer Notizia – modulo UI puro, idempotente

export function ensureNotiziaDetailDrawer() {
  // L'overlay ESISTE SOLO nel DOM, mai come variabile top-level
  let overlay = document.getElementById('notizia-detail-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'notizia-detail-overlay';
  overlay.className = 'drawer-overlay hidden';

  overlay.innerHTML = `
    <div class="drawer notizia-drawer">
      <button class="drawer-close" id="closeNotiziaDrawer">×</button>
      <div class="drawer-content" id="notiziaDrawerContent"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay
    .querySelector('#closeNotiziaDrawer')
    .addEventListener('click', () => {
      overlay.classList.add('hidden');
    });

  return overlay;
}
