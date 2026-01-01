// modules/agenda/index.js
// Facade + bind UI Agenda. Mantiene il legacy "pulito": niente click handler nelle celle month.
import { startOfWeek } from '../core/utils.js';

let _bound = false;

export function bindAgendaMonthClicks() {
  const cont = document.getElementById('agenda-month-summary');
  if (!cont || cont.dataset.boundMonthClicks === '1') return;

  cont.addEventListener('click', (e) => {
    const el = e.target?.closest?.('.agenda-month-day');
    if (!el) return;

    const ds = el.dataset?.date;
    if (!ds) return;

    const dateObj = new Date(ds + 'T00:00:00'); // locale
    if (isNaN(dateObj)) return;

    // Sync con legacy week anchor (se presente)
    try { window.agendaWeekAnchor = startOfWeek(dateObj); } catch {}

    try { window.setView?.('agenda'); } catch {}

    const gridWeekly = document.getElementById('agenda-week-grid');
    if (gridWeekly) {
      try { gridWeekly.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }

    // micro feedback visivo (compat con css esistente)
    try {
      el.classList.add('agenda-month-day-click');
      setTimeout(() => el.classList.remove('agenda-month-day-click'), 220);
    } catch {}
  });

  cont.dataset.boundMonthClicks = '1';
}

export function bindAgendaNavAndFilters() {
  // Binding minimo e idempotente per navigazione agenda (se hai bottoni prev/next/month/week).
  // Non facciamo assunzioni invasive: ci limitiamo a marcare il binding.
  const root = document.getElementById('agenda-view') || document.body;
  if (!root || root.dataset.boundAgendaNav === '1') return;

  // Esempio: bottoni standard se presenti
  const btnWeekPrev = document.getElementById('agenda-week-prev');
  const btnWeekNext = document.getElementById('agenda-week-next');
  const btnMonth = document.getElementById('agenda-tab-month');
  const btnWeek = document.getElementById('agenda-tab-week');

  // Se questi id non esistono nel tuo HTML, non succede nulla: resta safe.
  btnWeekPrev?.addEventListener('click', () => {
    if (!(window.agendaWeekAnchor instanceof Date)) return;
    const d = new Date(window.agendaWeekAnchor.getTime());
    d.setDate(d.getDate() - 7);
    window.agendaWeekAnchor = d;
    try { window.renderAgendaWeek?.(); } catch {}
  });

  btnWeekNext?.addEventListener('click', () => {
    if (!(window.agendaWeekAnchor instanceof Date)) return;
    const d = new Date(window.agendaWeekAnchor.getTime());
    d.setDate(d.getDate() + 7);
    window.agendaWeekAnchor = d;
    try { window.renderAgendaWeek?.(); } catch {}
  });

  btnMonth?.addEventListener('click', () => {
    try { window.setView?.('agenda-month'); } catch {}
    try { window.renderAgendaMonth?.(); } catch {}
  });

  btnWeek?.addEventListener('click', () => {
    try { window.setView?.('agenda'); } catch {}
    try { window.renderAgendaWeek?.(); } catch {}
  });

  root.dataset.boundAgendaNav = '1';
}

export function initAgenda() {
  if (_bound) return;
  _bound = true;
  // Flag utile per far capire al legacy che l’agenda è “gestita”
  window.AgendaManaged = true;

  bindAgendaNavAndFilters();
  bindAgendaMonthClicks();
}

// Alias utili (stabili) per il boot o per altri moduli
export const renderAgendaWeek = () => { try { window.renderAgendaWeek?.(); } catch {} };
export const renderAgendaMonth = () => { try { window.renderAgendaMonth?.(); } catch {} };
