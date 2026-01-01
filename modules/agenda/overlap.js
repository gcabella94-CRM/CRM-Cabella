// modules/agenda/overlap.js
// Calcolo sovrapposizioni reali e colonne per un evento (NO maxCols globale)
// Obiettivo: niente effetto "tutto al 50%" fuori dal gruppo di overlap.

export function getOverlaps(a, dayApps) {
  return (dayApps || []).filter(ev => {
    if (!ev || ev === a) return false;
    return (ev._startMin < a._endMin) && (ev._endMin > a._startMin);
  });
}

// Assegna colonne con algoritmo greedy (sweep-line) su eventi già normalizzati (_startMin/_endMin).
// Restituisce una nuova lista di eventi con _colIndex e _colCount coerenti per il loro gruppo di overlap.
export function assignColumns(dayApps) {
  const apps = (dayApps || []).filter(Boolean).slice().sort((a,b) => a._startMin - b._startMin || a._endMin - b._endMin);

  // colEnd[i] = minuto di fine dell'evento attualmente nella colonna i
  const colEnd = [];
  apps.forEach(a => {
    let col = 0;
    while (col < colEnd.length && a._startMin < colEnd[col]) col++;
    colEnd[col] = a._endMin;
    a._colIndex = col;
  });

  // per ciascun evento calcolo quante colonne servono davvero nel suo gruppo di overlap
  apps.forEach(a => {
    const overlaps = getOverlaps(a, apps);
    const cols = overlaps.length === 0 ? 1 : (overlaps.length + 1);
    // attenzione: se i overlaps includono eventi con colIndex alto, garantisco che colCount copra anche loro
    let maxIdx = a._colIndex || 0;
    overlaps.forEach(o => { maxIdx = Math.max(maxIdx, o._colIndex || 0); });
    a._colCount = Math.max(cols, maxIdx + 1);
  });

  return apps;
}

export function computeColumnsForEvent(a, dayApps) {
  const overlaps = getOverlaps(a, dayApps);
  if (overlaps.length === 0) return { cols: 1, index: 0, overlaps };
  // colCount è già calcolato dal legacy (a._colCount) o da assignColumns
  const cols = Math.max(1, a._colCount || (overlaps.length + 1));
  const index = Math.min(a._colIndex || 0, cols - 1);
  return { cols, index, overlaps };
}

export function hasSameResponsabileOverlap(a, overlaps) {
  if (!a?.responsabileId) return false;
  return (overlaps || []).some(ev => ev?.responsabileId === a.responsabileId);
}
