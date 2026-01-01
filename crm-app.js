// crm-app.js (module entrypoint)
// Boots the legacy app and then initializes module bindings (Agenda takeover month-click).
import './modules/legacy/crm-app.legacy.js';
import { initAgenda } from './modules/agenda/index.js';

window.addEventListener('DOMContentLoaded', () => {
  try { initAgenda(); } catch (e) { console.warn('[initAgenda] errore', e); }
});
