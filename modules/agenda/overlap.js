// modules/agenda/overlap.js
// Overlap + colonne (per gruppi) per evitare la regressione "tutto al 50%".
// Questo modulo può essere usato sia dai moduli Agenda sia dal legacy (via window.AgendaOverlap).

function overlaps(a, b) {
  return (b._startMin < a._endMin) && (b._endMin > a._startMin);
}

export function getOverlaps(a, dayApps) {
  return (dayApps || []).filter(ev => {
    if (!ev || ev === a) return false;
    return overlaps(a, ev);
  });
}

// Alias di compatibilità (alcune versioni lo chiamavano così)
export function getOverlapsForEvent(ev, dayApps) {
  return getOverlaps(ev, dayApps);
}

// Assegna colonne greedy dentro ogni gruppo di sovrapposizione reale.
// Ritorna una NUOVA lista (copie shallow) con _colIndex/_colCount.
export function assignColumns(dayApps) {
  const apps = (dayApps || [])
    .filter(Boolean)
    .map(ev => ({ ...ev }))
    .sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

  function finalizeGroup(group) {
    if (!group || group.length === 0) return;

    const colEnds = [];
    const sorted = group.slice().sort((a, b) => (a._startMin - b._startMin) || (a._endMin - b._endMin));

    for (const ev of sorted) {
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
    }

    const cols = Math.max(1, colEnds.length);
    for (const ev of sorted) ev._colCount = cols;
  }

  let group = [];
  let groupMaxEnd = -1;

  for (const ev of apps) {
    const s = Number(ev._startMin);
    const e = Number(ev._endMin);

    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      ev._colIndex = 0;
      ev._colCount = 1;
      continue;
    }

    if (group.length === 0) {
      group = [ev];
      groupMaxEnd = e;
      continue;
    }

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

// Variante "in-place" (comoda per legacy che lavora sugli stessi oggetti)
export function assignColumnsInPlace(dayApps) {
  const computed = assignColumns(dayApps || []);
  const byId = new Map(computed.map(e => [e.id ?? e._id ?? e.__tmpKey ?? Symbol('k'), e]));

  // Se gli eventi hanno id, aggiorniamo per id; altrimenti fallback per ordine start/end.
  const allHaveId = (dayApps || []).every(e => e && (e.id || e._id));

  if (allHaveId) {
    (dayApps || []).forEach(e => {
      const k = e.id || e._id;
      const c = byId.get(k);
      if (!c) return;
      e._colIndex = c._colIndex;
      e._colCount = c._colCount;
    });
  } else {
    const sortedOrig = (dayApps || []).filter(Boolean).slice().sort((a,b)=> (a._startMin-b._startMin)||(a._endMin-b._endMin));
    const sortedComp = computed.slice().sort((a,b)=> (a._startMin-b._startMin)||(a._endMin-b._endMin));
    for (let i = 0; i < Math.min(sortedOrig.length, sortedComp.length); i++) {
      sortedOrig[i]._colIndex = sortedComp[i]._colIndex;
      sortedOrig[i]._colCount = sortedComp[i]._colCount;
    }
  }

  return dayApps;
}

export function computeColumnsForEvent(a, dayApps) {
  const ovs = getOverlaps(a, dayApps);
  if (ovs.length === 0) return { cols: 1, index: 0, overlaps: ovs };
  const cols = Math.max(1, a._colCount || (ovs.length + 1));
  const index = Math.min(a._colIndex || 0, cols - 1);
  return { cols, index, overlaps: ovs };
}

export function hasSameResponsabileOverlap(a, overlapsList) {
  if (!a?.responsabileId) return false;
  return (overlapsList || []).some(ev => ev?.responsabileId === a.responsabileId);
}

// Bridge per legacy
try {
  if (typeof window !== 'undefined') {
    window.AgendaOverlap = window.AgendaOverlap || {};
    Object.assign(window.AgendaOverlap, {
      getOverlaps,
      getOverlapsForEvent,
      assignColumns,
      assignColumnsInPlace,
      computeColumnsForEvent,
      hasSameResponsabileOverlap
    });
  }
} catch (_) {}
