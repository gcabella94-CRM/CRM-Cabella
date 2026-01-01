// modules/agenda/index.js
// PROXY -> Legacy
// Obiettivo: l'Agenda viene richiamata e renderizzata dal legacy (crm-app.legacy.js).
// Questo file resta importabile senza rompere nulla: inoltra le chiamate a window.AgendaLegacy.

function legacy() {
  return (typeof window !== 'undefined') ? window.AgendaLegacy : null;
}

export function setAgendaWeekAnchor(dateLike) {
  try { legacy()?.setWeekAnchor?.(dateLike); } catch {}
}

export function getAgendaWeekAnchor() {
  try { return legacy()?.getWeekAnchor?.() || null; } catch { return null; }
}

export function renderAgendaWeek() {
  try { legacy()?.renderWeek?.(); } catch {}
}

export function renderAgendaMonth() {
  try { legacy()?.renderMonth?.(); } catch {}
}

// Helper usato tipicamente dal click su un giorno del mese
export function openAgendaWeekFromDate(dateLike) {
  try {
    const L = legacy();
    if (L?.openWeekFromDate) return L.openWeekFromDate(dateLike);
    // fallback
    L?.setWeekAnchor?.(dateLike);
    L?.renderWeek?.();
    L?.scrollToWeek?.();
  } catch {}
}
