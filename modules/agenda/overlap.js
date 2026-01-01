// modules/agenda/overlap.js
// Robust overlap + column assignment for a single day.
// Goal: avoid the classic bug "two overlaps -> everything after stays 50%".
// We do a sweep-line column assignment per connected overlap group.

import { clamp } from '../core/utils.js';

function overlaps(a, b) {
  return a._startMin < b._endMin && b._startMin < a._endMin;
}

export function buildOverlapLayout(dayApps) {
  const apps = (dayApps || []).filter(Boolean);

  // Ensure _startMin/_endMin exist
  apps.forEach(a => {
    a._startMin = Number.isFinite(a._startMin) ? a._startMin : 0;
    a._endMin = Number.isFinite(a._endMin) ? a._endMin : a._startMin + 15;
  });

  // Sort by start, then longer first (helps stable packing)
  const sorted = apps.slice().sort((a, b) => (a._startMin - b._startMin) || (b._endMin - a._endMin));

  // Assign columns using sweep-line:
  // Maintain active columns with their current ending time.
  const colEnd = []; // endMin per column (for current group)
  const active = []; // list of active events in current group
  const groupEvents = []; // current connected component events
  let groupMaxCols = 1;

  function flushGroup() {
    if (groupEvents.length === 0) return;
    // Apply groupMaxCols to every event in group
    groupEvents.forEach(ev => {
      ev._layout = ev._layout || {};
      ev._layout.cols = groupMaxCols;
    });
    // reset
    colEnd.length = 0;
    active.length = 0;
    groupEvents.length = 0;
    groupMaxCols = 1;
  }

  for (const ev of sorted) {
    // If no active events, start a new group
    if (active.length === 0) {
      flushGroup();
    } else {
      // If ev does not overlap ANY active, then previous group ended
      const touchesGroup = active.some(a => overlaps(a, ev));
      if (!touchesGroup) {
        flushGroup();
      }
    }

    // Remove finished from active + free columns
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]._endMin <= ev._startMin) {
        active.splice(i, 1);
      }
    }
    // rebuild colEnd based on current active assignments
    // (colEnd is per column; we keep it updated lazily)
    // We'll keep colEnd entries and just ensure we find a free one.

    // Find first free column (colEnd[c] <= ev.start)
    let col = -1;
    for (let c = 0; c < colEnd.length; c++) {
      if (colEnd[c] <= ev._startMin) { col = c; break; }
    }
    if (col === -1) {
      col = colEnd.length;
      colEnd.push(0);
    }

    ev._layout = ev._layout || {};
    ev._layout.index = col;

    colEnd[col] = ev._endMin;
    active.push(ev);
    groupEvents.push(ev);
    groupMaxCols = Math.max(groupMaxCols, colEnd.length);
  }

  flushGroup();

  // Safety clamp for layout index
  apps.forEach(ev => {
    if (!ev._layout) ev._layout = { cols: 1, index: 0 };
    ev._layout.cols = Math.max(1, Number(ev._layout.cols || 1));
    ev._layout.index = clamp(Number(ev._layout.index || 0), 0, ev._layout.cols - 1);
  });

  return apps;
}

export function getOverlapsForEvent(a, dayApps) {
  if (!a) return [];
  return (dayApps || []).filter(ev => ev && ev !== a && overlaps(ev, a));
}

export function hasSameResponsabileOverlap(a, overlapsList) {
  if (!a?.responsabileId) return false;
  return (overlapsList || []).some(ev => ev?.responsabileId && ev.responsabileId === a.responsabileId);
}
