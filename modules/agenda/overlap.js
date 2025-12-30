// modules/agenda/overlap.js
// Calcola sovrapposizioni reali e colonne per un evento (NO maxCols globale)

export function getOverlaps(a, dayApps) {
  return (dayApps || []).filter(ev => {
    if (!ev || ev === a) return false;
    return (ev._startMin < a._endMin) && (ev._endMin > a._startMin);
  });
}

export function computeColumnsForEvent(a, dayApps) {
  const overlaps = getOverlaps(a, dayApps);

  if (overlaps.length === 0) {
    return { cols: 1, index: 0, overlaps };
  }

  const cols = overlaps.length + 1;
  const index = Math.min(a._colIndex || 0, cols - 1);
  return { cols, index, overlaps };
}

export function hasSameResponsabileOverlap(a, overlaps) {
  if (!a?.responsabileId) return false;
  return overlaps.some(ev => ev?.responsabileId === a.responsabileId);
}
