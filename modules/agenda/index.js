// modules/agenda/index.js
// PROXY: mantiene l'entrypoint richiesto dal bootstrap (initAgenda),
// ma la verità resta nel legacy (window.AgendaLegacy).
// Importiamo overlap.js SOLO per registrare window.AgendaOverlap (utility per legacy).

import './overlap.js';

export function initAgenda() {
  try {
    if (window?.AgendaLegacy?.init) return window.AgendaLegacy.init();
  } catch (_) {}

  // fallback no-op: non deve rompere l'app
  return null;
}
