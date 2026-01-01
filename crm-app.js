// crm-app.js (module entrypoint)
import './modules/legacy/crm-app.legacy.js';

// Islands (modules)
import { initAgenda } from './modules/agenda/index.js';
import { initNotizie } from './modules/notizie/index.js';

document.addEventListener('DOMContentLoaded', () => {
  try { initAgenda(); } catch (e) { console.warn('[BOOT] initAgenda err', e); }
  try { initNotizie(); } catch (e) { console.warn('[BOOT] initNotizie err', e); }
});
