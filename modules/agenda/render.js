// modules/agenda/render.js
// Rendering helpers puri (nessun bootstrap). Utilizzabile dal legacy se vuoi staccare pezzi in modo safe.

import { applyBlockLayout, ensureDayLayout } from './layout.js';

export function createAgendaBlock(ev) {
  const el = document.createElement('div');
  el.className = 'agenda-block';
  el.dataset.id = ev?.id || '';
  const title = (ev?.titolo || ev?.descrizione || ev?.tipoDettaglio || 'Appuntamento');
  el.innerHTML = `<div class="agenda-block-title">${escapeHtml(title)}</div>`;
  return el;
}

export function positionAgendaBlock(el, ev, dayApps, { pxPerMin = 1, topOffsetPx = 0 } = {}) {
  if (!el || !ev) return;
  const top = topOffsetPx + (ev._startMin * pxPerMin);
  const height = Math.max(10, (ev._endMin - ev._startMin) * pxPerMin);
  el.style.top = `${top}px`;
  el.style.height = `${height}px`;
  applyBlockLayout(el, ev, dayApps);
}

export function renderDayInto(containerEl, dayApps = [], opts = {}) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  ensureDayLayout(dayApps);
  for (const ev of dayApps) {
    const block = createAgendaBlock(ev);
    positionAgendaBlock(block, ev, dayApps, opts);
    containerEl.appendChild(block);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
