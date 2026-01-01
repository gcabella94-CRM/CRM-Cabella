// modules/notizie/index.js
import { renderNotizie } from './render.js';
import { bindNotizieUI, openNotiziaModal, closeNotiziaModal, resetNotizieForm } from './listeners.js';

export function initNotizie() {
  bindNotizieUI();
  // primo render quando la view esiste
  try { renderNotizie(); } catch {}
}

// Re-export comodi (se qualche pezzo legacy li chiama ancora)
export { renderNotizie, openNotiziaModal, closeNotiziaModal, resetNotizieForm };
