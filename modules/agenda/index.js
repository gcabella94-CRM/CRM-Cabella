// modules/agenda/index.js
// PROXY -> Legacy Agenda (crm-app.legacy.js)
// Scopo: mantenere compatibilità con import { initAgenda } ... dai moduli,
// ma delegare tutto al legacy, evitando doppioni di rendering/listeners.

function legacy() {
  return (typeof window !== 'undefined') ? window.AgendaLegacy : null;
}

/**
 * Entry point richiesto da crm-app.js (modulare):
 * deve esistere come named export.
 * Qui inizializziamo l'Agenda legacy in modo idempotente.
 */
export function initAgenda() {
  try {
    const L = legacy();
    if (!L) return;

    // Se il legacy espone initAgenda/init, usalo
    if (typeof L.initAgenda === 'function') { L.initAgenda(); return; }
    if (typeof L.init === 'function') { L.init(); return; }

    // Fallback: render e bind minimi se disponibili
    if (typeof L.ensureHooks === 'function') L.ensureHooks();
    if (typeof L.renderWeek === 'function') L.renderWeek();
    else if (typeof L.renderAgendaWeek === 'function') L.renderAgendaWeek();

    if (typeof L.renderMonth === 'function') L.renderMonth();
    else if (typeof L.renderAgendaMonth === 'function') L.renderAgendaMonth();

  } catch (e) {
    // non rilanciare: questo file deve essere "safe"
    console.warn('[agenda proxy] initAgenda failed:', e);
  }
}

// ---- Proxy API (usata da altre parti del codice) ----
export function setAgendaWeekAnchor(dateLike) {
  try { legacy()?.setWeekAnchor?.(dateLike); } catch {}
}

export function getAgendaWeekAnchor() {
  try { return legacy()?.getWeekAnchor?.() ?? null; } catch { return null; }
}

export function renderAgendaWeek() {
  try {
    const L = legacy();
    if (L?.renderWeek) return L.renderWeek();
    return L?.renderAgendaWeek?.();
  } catch {}
}

export function renderAgendaMonth() {
  try {
    const L = legacy();
    if (L?.renderMonth) return L.renderMonth();
    return L?.renderAgendaMonth?.();
  } catch {}
}

export function openAgendaWeekFromDate(dateLike) {
  try {
    const L = legacy();
    if (L?.openWeekFromDate) return L.openWeekFromDate(dateLike);
    // fallback semplice
    L?.setWeekAnchor?.(dateLike);
    if (L?.renderWeek) L.renderWeek(); else L?.renderAgendaWeek?.();
    L?.scrollToWeek?.();
  } catch {}
}

// opzionale: default export per chi lo usa
export default {
  initAgenda,
  setAgendaWeekAnchor,
  getAgendaWeekAnchor,
  renderAgendaWeek,
  renderAgendaMonth,
  openAgendaWeekFromDate
};
