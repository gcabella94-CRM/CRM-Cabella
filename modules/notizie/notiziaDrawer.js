// modules/notizie/notiziaDrawer.js

export function ensureNotiziaDetailDrawer() {
  let overlay = document.getElementById('notizia-detail-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'notizia-detail-overlay';
  overlay.className = 'drawer-overlay hidden';

  overlay.innerHTML = `
    <div class="drawer notizia-drawer">
      <button class="drawer-close" id="closeNotiziaDrawer">×</button>
      <div class="drawer-content" id="notiziaDrawerContent">
        <!-- contenuto dinamico -->
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('#closeNotiziaDrawer');
  closeBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  return overlay;
}
