// modules/notizie/notiziaDrawer.js

export function ensureNotiziaDetailDrawer() {
  const existing = document.getElementById('notizia-detail-overlay');
  if (existing) return existing;

  const overlay = document.createElement('div');
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
