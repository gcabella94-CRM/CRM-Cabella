// modules/agenda/overlap.js
// Overlap + colonne (NO maxCols globale).
// Obiettivo: le colonne si applicano SOLO dentro un gruppo di sovrapposizione reale,
// evitando l'effetto "tutto al 50%" anche sugli eventi successivi.

function overlaps(a, b) {
  return (a._startMin < b._endMin) && (b._startMin < a._endMin);
}

export function getOverlaps(a, dayApps) {
  return (dayApps || []).filter(ev => {
    if (!ev || ev === a) return false;
    return overlaps(ev, a);
  });
}

// Assegna colonne IN PLACE (mutando gli oggetti originali).
// Richiede che ogni evento abbia già:
// - _startMin (minuti da 00:00)
// - _endMin
export function assignColumnsInPlace(dayApps) {
  const apps = (dayApps || []).filter(Boolean);

  // Reset difensivo
  apps.forEach(a => {
    a._colIndex = 0;
    a._colCount = 1;
  });

  // Ordina per inizio (poi fine)
  const sorted = [...apps].sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

  // Costruisci gruppi di sovrapposizione reale
  let group = [];
  let groupEnd = -1;

  function flushGroup() {
    if (!group.length) return;

    // greedy columns dentro il gruppo
    const colEnd = [];
    group.sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));
    group.forEach(ev => {
      let col = 0;
      while (col < colEnd.length && ev._startMin < colEnd[col]) col++;
      colEnd[col] = ev._endMin;
      ev._colIndex = col;
    });

    const cols = Math.max(1, colEnd.length);
    group.forEach(ev => { ev._colCount = cols; });

    group = [];
    groupEnd = -1;
  }

  sorted.forEach(ev => {
    if (!group.length) {
      group = [ev];
      groupEnd = ev._endMin;
      return;
    }

    // Se non sovrappone al gruppo corrente, chiudi gruppo e aprine uno nuovo
    if (ev._startMin >= groupEnd) {
      flushGroup();
      group = [ev];
      groupEnd = ev._endMin;
      return;
    }

    // Altrimenti entra nel gruppo e aggiorna fine del gruppo
    group.push(ev);
    if (ev._endMin > groupEnd) groupEnd = ev._endMin;
  });

  flushGroup();
  return apps;
}

// Variante non mutante (ritorna copie shallow)
export function assignColumns(dayApps) {
  const cloned = (dayApps || []).filter(Boolean).map(ev => ({ ...ev }));
  assignColumnsInPlace(cloned);
  return cloned;
}

// Dati layout per un singolo evento (cols/index/overlaps)
export function getPlacement(a, dayApps) {
  const overlapsList = getOverlaps(a, dayApps);

  // Se assignColumns è stato applicato, a._colCount è affidabile.
  const cols = Math.max(1, a?._colCount || (overlapsList.length + 1));
  const index = Math.min(a?._colIndex || 0, cols - 1);
  return { cols, index, overlaps: overlapsList };
}

export function hasSameResponsabileOverlap(a, overlapsList) {
  if (!a?.responsabileId) return false;
  return (overlapsList || []).some(ev => ev?.responsabileId === a.responsabileId);
}

// Bridge: rende disponibili le funzioni anche al legacy (non-module).
// Nota: questo file è un ES module, ma l'assegnazione a window funziona comunque quando caricato dal bundle/app.
if (typeof window !== 'undefined') {
  window.AgendaOverlap = window.AgendaOverlap || {};
  window.AgendaOverlap.getOverlaps = getOverlaps;
  window.AgendaOverlap.assignColumnsInPlace = assignColumnsInPlace;
  window.AgendaOverlap.assignColumns = assignColumns;
  window.AgendaOverlap.getPlacement = getPlacement;
  window.AgendaOverlap.hasSameResponsabileOverlap = hasSameResponsabileOverlap;
}
