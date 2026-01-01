// modules/agenda/index.js
// Facade dell'isola Agenda: espone API minime al bootstrap/legacy.
// Scopo: mantenere crm-app.legacy.js come "mappa" (routing/entrypoints) e spostare qui
// tutta la logica Agenda (render + layout + collisioni).

import { addDays, startOfWeek, toLocalISODate, addMinutesToTime } from '../core/utils.js';
import { normalizeAgendaEvent } from './model.js';
import { assignColumns, getOverlaps, hasSameResponsabileOverlap } from './overlap.js';
import { applyBlockLayout } from './layout.js';

let agendaWeekAnchor = startOfWeek(new Date());

// Anti-spam: evita popup ripetuti per la stessa collisione nella stessa render.
let lastCollisionSig = '';

export function setAgendaWeekAnchor(d) {
  if (!d) return;
  agendaWeekAnchor = startOfWeek(d);
}

export function getAgendaWeekAnchor() {
  return agendaWeekAnchor;
}

/**
 * Render della griglia settimanale (stessa UI della legacy, ma senza variabili globali fragili).
 * @param {object} ctx
 * @param {Array} ctx.attivita
 * @param {Array} ctx.staff
 * @param {Function} ctx.openAgendaRangeDialog (dateIso, startMin, endMin)
 * @param {Function} ctx.openAppuntamentoDialogById (id)
 * @param {string} [ctx.lastCreatedAppId]
 */
export function renderAgendaWeek(ctx) {
  const labelEl = document.getElementById('agenda-week-label');
  const grid = document.getElementById('agenda-week-grid');
  if (!grid) return;

  const weekStart = agendaWeekAnchor;
  const weekEnd = addDays(weekStart, 6);
  if (labelEl) {
    labelEl.textContent = `Settimana ${weekStart.toLocaleDateString('it-IT')} – ${weekEnd.toLocaleDateString('it-IT')}`;
  }

  grid.innerHTML = '';

  const giorni = [];
  for (let i = 0; i < 7; i++) giorni.push(addDays(weekStart, i));

  const typeFilter = document.getElementById('agenda-type-filter')?.value || 'tutti';
  const staffFilter = document.getElementById('agenda-staff-filter')?.value || 'tutti';

  const minStart = 8 * 60;   // 08:00
  const minEnd = 20 * 60;    // 20:00
  const slotSize = 15;       // 15 minuti

  // drag state (solo settimana)
  const agendaDrag = {
    isDragging: false,
    start: null, // { date, minutes }
    end: null
  };

  const slotMap = {}; // key: date|minutes -> cell

  // header corner
  const corner = document.createElement('div');
  corner.className = 'agenda-hour-cell';
  grid.appendChild(corner);

  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  giorni.forEach((d, idx) => {
    const h = document.createElement('div');
    h.className = 'agenda-hour-cell';
    h.style.textAlign = 'center';
    const lab = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    h.textContent = `${dayNames[idx]} ${lab}`;
    grid.appendChild(h);
  });

  // highlight drag selection
  const updateAgendaDragHighlight = () => {
    const all = grid.querySelectorAll('.agenda-slot');
    all.forEach(c => c.classList.remove('agenda-slot-range'));
    if (!agendaDrag.isDragging || !agendaDrag.start || !agendaDrag.end) return;
    if (agendaDrag.start.date !== agendaDrag.end.date) return;
    const iso = agendaDrag.start.date;
    const mStart = Math.min(agendaDrag.start.minutes, agendaDrag.end.minutes);
    const mEnd = Math.max(agendaDrag.start.minutes, agendaDrag.end.minutes);
    for (let m = mStart; m <= mEnd; m += slotSize) {
      const cell = slotMap[`${iso}|${m}`];
      if (cell) cell.classList.add('agenda-slot-range');
    }
  };

  // grid body
  for (let minutes = minStart; minutes < minEnd; minutes += slotSize) {
    const hour = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const hourCell = document.createElement('div');
    hourCell.className = 'agenda-hour-cell';
    hourCell.textContent = mins === 0 ? `${String(hour).padStart(2, '0')}:00` : '';
    grid.appendChild(hourCell);

    giorni.forEach(d => {
      const iso = toLocalISODate(d);
      const cell = document.createElement('div');
      cell.className = 'agenda-slot';
      cell.dataset.date = iso;
      cell.dataset.minutes = String(minutes);

      cell.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        // se clic su un blocco appuntamento, non avvio drag
        if (e.target?.closest?.('.agenda-block')) return;
        e.preventDefault();
        agendaDrag.isDragging = true;
        agendaDrag.start = { date: iso, minutes };
        agendaDrag.end = { date: iso, minutes };
        updateAgendaDragHighlight();
      });

      cell.addEventListener('mouseenter', () => {
        if (!agendaDrag.isDragging || !agendaDrag.start) return;
        if (agendaDrag.start.date !== iso) return;
        agendaDrag.end = { date: iso, minutes };
        updateAgendaDragHighlight();
      });

      cell.addEventListener('mouseup', () => {
        if (!agendaDrag.isDragging || !agendaDrag.start || !agendaDrag.end) return;
        agendaDrag.isDragging = false;
        const { start, end } = agendaDrag;
        if (start.date === end.date) {
          const mStart = Math.min(start.minutes, end.minutes);
          const mEnd = Math.max(start.minutes, end.minutes) + slotSize;
          ctx?.openAgendaRangeDialog?.(start.date, mStart, mEnd);
        }
        agendaDrag.start = null;
        agendaDrag.end = null;
        updateAgendaDragHighlight();
      });

      const key = `${iso}|${minutes}`;
      slotMap[key] = cell;
      grid.appendChild(cell);
    });
  }

  // ===== render appuntamenti =====
  const settimanaIso = giorni.map(d => toLocalISODate(d));

  const appsRaw = (ctx?.attivita || []).filter(a => {
    if (!a || a.tipo !== 'appuntamento') return false;
    if (!settimanaIso.includes(a.data)) return false;
    if (typeFilter !== 'tutti' && a.tipoDettaglio !== typeFilter) return false;
    if (staffFilter !== 'tutti' && a.responsabileId !== staffFilter) return false;
    return true;
  });

  const staffMap = {};
  (ctx?.staff || []).forEach(s => { if (s?.id) staffMap[s.id] = s; });

  const appsByDay = {};
  appsRaw.forEach(a => {
    const ev = normalizeAgendaEvent(a, { minStart, minEnd, slotSize });
    if (!ev?.data) return;
    (appsByDay[ev.data] ||= []).push(ev);
  });

  Object.keys(appsByDay).forEach(iso => {
    // colonne per overlap (anti "tutto al 50%")
    const dayApps = assignColumns(appsByDay[iso]);

    // collision alert non bloccante (stesso responsabile)
    maybeAlertSameResponsabileCollision(dayApps);

    dayApps.forEach(a => {
      const startMin = a._startMin;
      const endMin = a._endMin;
      const totalSlots = (endMin - startMin) / slotSize;

      const firstCell = slotMap[`${iso}|${startMin}`];
      if (!firstCell) return;

      // costruisci blocco visuale nella cella (posizionamento assoluto dentro la cella start)
      const cell = firstCell;
      cell.classList.add('agenda-slot-app-start');
      cell.style.position = 'relative';

      const rangeLabel = `${a.ora || ''}${a.oraFine ? '–' + a.oraFine : ''}`.trim();
      const tipologia = (a.tipoDettaglio || a.tipo || '').toString();

      let luogoLabel = '';
      if (a.inUfficio && a.cittaUfficio) luogoLabel = `Ufficio ${a.cittaUfficio}`;
      else if (a.luogo) luogoLabel = a.luogo;

      const respObj = a.responsabileId ? staffMap[a.responsabileId] : null;
      const respLabel = respObj?.nome || '';

      const parts = [];
      if (rangeLabel) parts.push(rangeLabel);
      if (luogoLabel) parts.push(luogoLabel);
      if (respLabel) parts.push(respLabel);
      let text = parts.join(' · ');
      if (!text) text = `${rangeLabel} ${tipologia}`.trim();

      const block = document.createElement('div');
      block.className = 'agenda-block';

      // colore responsabile
      let respColor = '#22c55e';
      if (respObj && (respObj.colore || respObj.color)) respColor = respObj.colore || respObj.color;

      block.style.background = `linear-gradient(135deg, ${respColor}ee 0%, ${respColor}cc 45%, ${respColor}aa 100%)`;
      block.style.border = '3px solid ' + respColor;
      const depth = Math.min(18, 4 + totalSlots * 1.2);
      block.style.boxShadow = `0 0 0 1px ${respColor}88, 0 4px ${depth}px rgba(0,0,0,0.45)`;

      let labelText = text;
      if (a.bollente) {
        labelText = '🔥 ' + labelText;
        block.classList.add('agenda-block-hot');
      }
      block.textContent = labelText;
      block.title = labelText;

      if (ctx?.lastCreatedAppId && a.id === ctx.lastCreatedAppId) {
        block.classList.add('agenda-block-new');
      }

      block.style.position = 'absolute';
      block.style.top = '0';
      block.style.height = `${Math.max(1, totalSlots)}00%`; // fallback, sovrascritto sotto
      block.style.left = '0%';
      block.style.width = '100%';

      // altezza proporzionale agli slot (usa px basati sull'altezza cella)
      const slotPx = firstCell.offsetHeight || 18;
      block.style.height = `${totalSlots * slotPx - 2}px`;

      // layout orizzontale overlap
      applyBlockLayout(block, a, dayApps);

      block.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx?.openAppuntamentoDialogById?.(a.id);
      });

      cell.appendChild(block);

      // marca anche le celle intermedie (utile per drag logic ecc)
      for (let m = startMin + slotSize; m < endMin; m += slotSize) {
        const c = slotMap[`${iso}|${m}`];
        if (!c) continue;
        c.classList.add('agenda-slot-app');
      }
    });
  });
}

export function renderAgendaMonth(ctx) {
  const cont = document.getElementById('agenda-month-summary');
  if (!cont) return;
  cont.innerHTML = '';

  const oggi = new Date();
  const year = oggi.getFullYear();
  const month = oggi.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  let startOffset = first.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = last.getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const weeks = totalCells / 7;

  const table = document.createElement('table');
  table.className = 'agenda-month-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'separate';
  table.style.borderSpacing = '6px';
  table.style.tableLayout = 'fixed';

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  dayNames.forEach(name => {
    const th = document.createElement('th');
    th.className = 'muted';
    th.style.fontSize = '11px';
    th.style.fontWeight = '600';
    th.style.textTransform = 'uppercase';
    th.style.letterSpacing = '0.08em';
    th.style.padding = '0 6px';
    th.style.textAlign = 'left';
    th.textContent = name;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (let w = 0; w < weeks; w++) {
    const tr = document.createElement('tr');
    for (let d = 0; d < 7; d++) {
      const td = document.createElement('td');
      td.style.verticalAlign = 'top';
      td.style.padding = '0';

      const cell = document.createElement('div');
      cell.className = 'metric agenda-month-day';
      cell.style.minHeight = '80px';
      cell.style.borderRadius = '6px';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.justifyContent = 'flex-start';
      cell.style.padding = '6px 8px';
      cell.style.cursor = 'pointer';

      const i = w * 7 + d;
      const dayNum = i - startOffset + 1;

      if (dayNum > 0 && dayNum <= daysInMonth) {
        const dateObj = new Date(year, month, dayNum);
        const iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');

        const num = document.createElement('div');
        num.textContent = dayNum;
        num.style.fontWeight = '700';
        num.style.marginBottom = '6px';
        cell.appendChild(num);

        const count = (ctx?.attivita || []).filter(a => a && a.tipo === 'appuntamento' && a.data === iso).length;
        const counter = document.createElement('div');
        counter.style.marginTop = 'auto';
        counter.style.display = 'flex';
        counter.style.justifyContent = 'flex-end';

        if (count > 0) {
          const badge = document.createElement('span');
          badge.className = 'tag';
          badge.style.borderColor = 'rgba(34,197,94,0.35)';
          badge.style.background = 'rgba(34,197,94,0.10)';
          badge.style.color = 'var(--text-main)';
          badge.textContent = `${count} app.`;
          counter.appendChild(badge);
        } else {
          const muted = document.createElement('span');
          muted.className = 'muted';
          muted.style.fontSize = '11px';
          muted.textContent = '0 app.';
          counter.appendChild(muted);
        }

        cell.appendChild(counter);

        cell.addEventListener('click', () => {
          setAgendaWeekAnchor(dateObj);
          ctx?.setView?.('agenda');
          document.getElementById('agenda-week-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          cell.classList.add('agenda-month-day-click');
          setTimeout(() => cell.classList.remove('agenda-month-day-click'), 180);
        });
      } else {
        cell.style.opacity = '0.25';
        cell.style.cursor = 'default';
        cell.addEventListener('click', (e) => e.preventDefault());
      }

      td.appendChild(cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  cont.appendChild(table);
}

export function bindAgendaNavAndFilters(ctx) {
  // navigazione settimana + filtri
  document.getElementById('agenda-prev-week')?.addEventListener('click', () => {
    agendaWeekAnchor = addDays(agendaWeekAnchor, -7);
    renderAgendaWeek(ctx);
  });
  document.getElementById('agenda-next-week')?.addEventListener('click', () => {
    agendaWeekAnchor = addDays(agendaWeekAnchor, 7);
    renderAgendaWeek(ctx);
  });
  document.getElementById('agenda-today-week')?.addEventListener('click', () => {
    agendaWeekAnchor = startOfWeek(new Date());
    renderAgendaWeek(ctx);
  });
  document.getElementById('agenda-type-filter')?.addEventListener('change', () => renderAgendaWeek(ctx));
  document.getElementById('agenda-staff-filter')?.addEventListener('change', () => renderAgendaWeek(ctx));

  // bottone nuovo appuntamento (se esiste in UI)
  document.getElementById('agenda-new')?.addEventListener('click', () => {
    // usa legacy dialog se presente
    if (typeof ctx?.creaNuovoAppuntamentoDaBottone === 'function') {
      ctx.creaNuovoAppuntamentoDaBottone();
    }
  });
}

function maybeAlertSameResponsabileCollision(dayApps) {
  // trova una collisione "vera" (stesso responsabile) e avvisa una volta
  for (const a of dayApps) {
    const overlaps = getOverlaps(a, dayApps);
    if (!overlaps.length) continue;
    if (!hasSameResponsabileOverlap(a, overlaps)) continue;
    const b = overlaps.find(o => o?.responsabileId === a?.responsabileId);
    if (!b) continue;
    const sig = `${a.responsabileId}|${a.data}|${a.id}|${b.id}`;
    if (sig === lastCollisionSig) return;
    lastCollisionSig = sig;
    // non blocca, solo alert
    try {
      alert('⚠️ Collisione: due appuntamenti dello stesso responsabile si sovrappongono.');
    } catch {}
    return;
  }
}
