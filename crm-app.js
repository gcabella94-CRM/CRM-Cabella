// crm-app.js (module entrypoint)
// Boots the legacy app (which mounts UI + listeners) and keeps the rest of the project structure intact.
import './modules/legacy/crm-app.legacy.js';
import { initNotizie } from './modules/notizie/index.js';

// init moduli (listener UI) – il legacy mantiene ancora la logica interna
document.addEventListener('DOMContentLoaded', () => {
  try { initNotizie(); } catch (e) { console.warn('[BOOT] initNotizie error', e); }
});
