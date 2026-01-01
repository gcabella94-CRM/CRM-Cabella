// modules/agenda/overlap.js
// Overlap + colonne (NO "maxCols globale").
// Obiettivo: le colonne si applicano SOLO dentro un gruppo di sovrapposizione reale,
// evitando l'effetto "tutto al 50%" anche sugli eventi successivi.
//
// API (usata dai moduli):
// - assignColumns(dayApps) -> NEW array (shallow copies) con _colIndex/_colCount
// - computeColumnsForEvent(a, dayApps) -> { cols, index, overlaps }
// - getOverlaps(a, dayApps)
// - hasSameResponsabileOverlap(a, overlaps)
//
// API (usata dal legacy, via window.AgendaOverlap):
// - assignColumnsInPlace(dayApps) -> muta gli oggetti in input (se possibile)

export function getOverlaps(a, dayApps) {
  const list = dayApps || [];
  if (!a) return [];
  const s = Number(a._startMin);
  const e = Number(a._endMin);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return [];
  return list.filter(ev => {
    if (!ev || ev === a) return false;
    const es = Number(ev._startMin);
    const ee = Number(ev._endMin);
    if (!Number.isFinite(es) || !Number.isFinite(ee)) return false;
    return (es < e) && (ee > s);
  });
}

// Greedy column assignment within each overlap-group.
// Returns NEW shallow copies (does not mutate the original array elements).
export function assignColumns(dayApps = []) {
  const apps = (dayApps || [])
    .filter(Boolean)
    .map(ev => ({ ...ev })) // shallow copy
    .sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

  let group = [];
  let groupMaxEnd = -1;

  function finalizeGroup(g) {
    if (!g || g.length === 0) return;

    // Active columns (each entry = last endMin of that column)
    const colEnds = [];
    // For tracking the max simultaneous columns in this group
    let maxCols = 1;

    // Sort again by start then longer first (helps stability)
    g.sort((a, b) => (a._startMin - b._startMin) || (b._endMin - a._endMin));

    for (const ev of g) {
      // find first free column
      let col = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= ev._startMin) { col = i; break; }
      }
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(ev._endMin);
      } else {
        colEnds[col] = ev._endMin;
      }

      ev._colIndex = col;
      // Temporary: group size will be set after we know maxCols
      maxCols = Math.max(maxCols, colEnds.length);
    }

    // assign group column count
    for (const ev of g) ev._colCount = maxCols;
  }

  for (const ev of apps) {
    const s = Number(ev._startMin);
    const e = Number(ev._endMin);

    // if invalid times, treat as isolated
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      finalizeGroup(group);
      group = [];
      groupMaxEnd = -1;
      ev._colIndex = 0;
      ev._colCount = 1;
      continue;
    }

    if (group.length === 0) {
      group.push(ev);
      groupMaxEnd = e;
      continue;
    }

    // If current event starts after groupMaxEnd, no overlap-chain continuation -> close group
    if (s >= groupMaxEnd) {
      finalizeGroup(group);
      group = [ev];
      groupMaxEnd = e;
    } else {
      group.push(ev);
      groupMaxEnd = Math.max(groupMaxEnd, e);
    }
  }
  finalizeGroup(group);

  return apps;
}

// In-place version for legacy usage.
// Mutates provided objects when possible (fallback: no-op if array invalid).
export function assignColumnsInPlace(dayApps = []) {
  const assigned = assignColumns(dayApps || []);
  // Map by stable identity if possible (id), else by start/end and titolo
  const byId = new Map();
  for (const ev of assigned) {
    if (ev && (ev.id || ev._id)) byId.set(ev.id || ev._id, ev);
  }

  for (const orig of (dayApps || [])) {
    if (!orig) continue;
    const key = orig.id || orig._id;
    let src = key ? byId.get(key) : null;

    if (!src) {
      // fallback match
      src = assigned.find(e =>
        e &&
        e._startMin === orig._startMin &&
        e._endMin === orig._endMin &&
        String(e.titolo || e.descrizione || '') === String(orig.titolo || orig.descrizione || '')
      );
    }

    if (src) {
      orig._colIndex = src._colIndex;
      orig._colCount = src._colCount;
    } else {
      // safe defaults
      orig._colIndex = 0;
      orig._colCount = 1;
    }
  }
  return dayApps;
}

export function computeColumnsForEvent(a, dayApps) {
  const overlaps = getOverlaps(a, dayApps);

  // If columns already assigned, trust them
  const cols = Math.max(1, Number(a?._colCount) || 0, overlaps.length + 1);
  const index = Math.min(Math.max(0, Number(a?._colIndex) || 0), cols - 1);

  return { cols, index, overlaps };
}

export function hasSameResponsabileOverlap(a, overlaps) {
  const rid = a?.responsabileId;
  if (!rid) return false;
  return (overlaps || []).some(ev => ev?.responsabileId === rid);
}

// Bridge for legacy (global access)
try {
  if (typeof window !== 'undefined') {
    window.AgendaOverlap = window.AgendaOverlap || {};
    window.AgendaOverlap.getOverlaps = getOverlaps;
    window.AgendaOverlap.assignColumns = assignColumns;
    window.AgendaOverlap.assignColumnsInPlace = assignColumnsInPlace;
    window.AgendaOverlap.computeColumnsForEvent = computeColumnsForEvent;
    window.AgendaOverlap.hasSameResponsabileOverlap = hasSameResponsabileOverlap;
  }
} catch (_) {
  // ignore
}
