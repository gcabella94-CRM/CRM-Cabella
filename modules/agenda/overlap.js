// modules/agenda/overlap.js
// Sovrapposizioni reali e collisioni per responsabile.

export function getOverlaps(a, dayApps){
  return (dayApps||[]).filter(ev=>{
    if(!ev || ev===a) return false;
    return (ev._startMin < a._endMin) && (ev._endMin > a._startMin);
  });
}

export function hasSameResponsabileOverlap(a, overlaps){
  if(!a?.responsabileId) return false;
  return (overlaps||[]).some(ev=>ev?.responsabileId===a.responsabileId);
}
