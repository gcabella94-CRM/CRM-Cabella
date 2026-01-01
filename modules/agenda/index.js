// modules/agenda/index.js
// PROXY -> Legacy Agenda (crm-app.legacy.js)
//
// Scopo: crm-app.js importa initAgenda dai moduli.
// Noi manteniamo quell'API, ma demandiamo tutto al legacy,
// evitando doppioni di rendering/listeners.
//
// In più, importiamo overlap.js così espone window.AgendaOverlap (usato dal legacy).
import './overlap.js';

function L() {
  return (typeof window !== 'undefined') ? window.AgendaLegacy : null;
}

export function initAgenda() {
  const legacy = L();
  if (!legacy) return;

  // init idempotente
  if (typeof legacy.init === 'function') legacy.init();

  // Render iniziale (week come default)
  if (typeof legacy.renderWeek === 'function') legacy.renderWeek();
  else if (typeof legacy.renderAgendaWeek === 'function') legacy.renderAgendaWeek();
}

export function setAgendaWeekAnchor(dateStr) {
  const legacy = L();
  if (!legacy) return;
  if (typeof legacy.setWeekAnchor === 'function') legacy.setWeekAnchor(dateStr);
  else legacy._weekAnchor = dateStr;
}

export function getAgendaWeekAnchor() {
  const legacy = L();
  if (!legacy) return '';
  if (typeof legacy.getWeekAnchor === 'function') return legacy.getWeekAnchor() || '';
  return legacy._weekAnchor || '';
}

export function renderAgendaWeek() {
  const legacy = L();
  if (!legacy) return;
  if (typeof legacy.renderWeek === 'function') legacy.renderWeek();
  else if (typeof legacy.renderAgendaWeek === 'function') legacy.renderAgendaWeek();
}

export function renderAgendaMonth() {
  const legacy = L();
  if (!legacy) return;
  if (typeof legacy.renderMonth === 'function') legacy.renderMonth();
  else if (typeof legacy.renderAgendaMonth === 'function') legacy.renderAgendaMonth();
}

export function openAgendaWeekFromDate(dateStr) {
  const legacy = L();
  if (!legacy) return;
  if (typeof legacy.openWeekFromDate === 'function') legacy.openWeekFromDate(dateStr);
  else if (typeof legacy.openAgendaWeekFromDate === 'function') legacy.openAgendaWeekFromDate(dateStr);
}

export default {
  initAgenda,
  setAgendaWeekAnchor,
  getAgendaWeekAnchor,
  renderAgendaWeek,
  renderAgendaMonth,
  openAgendaWeekFromDate
};
