// modules/agenda/overlap.js
// Overlap + colonne (NO maxCols globale).
// Obiettivo: le colonne si applicano SOLO dentro un gruppo di sovrapposizione reale,
// evitando l'effetto "tutto al 50%" anche sugli eventi successivi.

export function getOverlaps(a, dayApps) {
  return (dayApps || []).filter(ev => {
    if (!ev || ev === a) return false;
    return (ev._startMin < a._endMin) && (ev._endMin > a._startMin);
  });
}

// Assegna colonne con sweep-line greedy su eventi normalizzati (_startMin/_endMin).
// Ritorna una NUOVA lista (copie shallow) con:
// - _colIndex: indice colonna dell'evento nel suo gruppo
// - _colCount: numero colonne del gruppo (usato per width/left)
export function assignColumns(dayApps) {
  const apps = (dayApps || [])
    .filter(Boolean)
    .map(ev => ({ ...ev }))
    .sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

  // Active: eventi non ancora terminati (endMin > current startMin)
  let active = [];
  // Gruppo corrente: accumula eventi finché esiste continuità di overlap nel tempo
  let group = [];
  let groupMaxEnd = -1;

  function finalizeGroup(g) {
    if (!g || g.length === 0) return;

    // 1) riassegna colonne greedy dentro il gruppo
    // (lista delle "colonne" con endMin dell'ultimo evento in colonna)
    const colEnds = [];

    // ordina per start/end
    const sorted = g.slice().sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

    for (const ev of sorted) {
      // trova prima colonna libera
      let idx = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= ev._startMin) { idx = i; break; }
      }
      if (idx === -1) {
        idx = colEnds.length;
        colEnds.push(ev._endMin);
      } else {
        colEnds[idx] = ev._endMin;
      }
      ev._colIndex = idx;
      // _colCount lo settiamo dopo, uguale per tutti nel gruppo
    }

    const cols = Math.max(1, colEnds.length);
    for (const ev of sorted) ev._colCount = cols;
  }

  for (const ev of apps) {
    const s = Number(ev._startMin);
    const e = Number(ev._endMin);

    // Se ev non ha start/end validi, lo lasciamo a colonna piena
    if (!isFinite(s) || !isFinite(e)) {
      ev._colIndex = 0;
      ev._colCount = 1;
      continue;
    }

    if (group.length === 0) {
      group = [ev];
      groupMaxEnd = e;
      continue;
    }

    // Se l'evento inizia dopo la fine massima del gruppo -> nuovo gruppo
    if (s >= groupMaxEnd) {
      finalizeGroup(group);
      group = [ev];
      groupMaxEnd = e;
    } else {
      group.push(ev);
      if (e > groupMaxEnd) groupMaxEnd = e;
    }
  }
  finalizeGroup(group);

  return apps;
}

export function computeColumnsForEvent(a, dayApps) {
  const overlaps = getOverlaps(a, dayApps);

  if (overlaps.length === 0) {
    return { cols: 1, index: 0, overlaps };
  }

  // Se assignColumns è stato applicato, a._colCount è affidabile.
  // Fallback: overlaps+1.
  const cols = Math.max(1, a._colCount || (overlaps.length + 1));
  const index = Math.min(a._colIndex || 0, cols - 1);
  return { cols, index, overlaps };
}

export function hasSameResponsabileOverlap(a, overlaps) {
  if (!a?.responsabileId) return false;
  return (overlaps || []).some(ev => ev?.responsabileId === a.responsabileId);
}
