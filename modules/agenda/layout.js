// modules/agenda/layout.js
// Apply computed layout to a DOM block.

import { buildOverlapLayout } from './overlap.js';

export function ensureDayLayout(dayApps) {
  // Mutates events: sets ev._layout = { cols, index }
  return buildOverlapLayout(dayApps);
}

export function applyBlockLayout(blockEl, ev, dayApps) {
  if (!blockEl || !ev) return;

  // Ensure layout exists (cheap if already computed)
  if (!ev._layout || !Number.isFinite(ev._layout.cols) || !Number.isFinite(ev._layout.index)) {
    ensureDayLayout(dayApps || []);
  }

  const cols = Math.max(1, Number(ev._layout?.cols || 1));
  const index = Math.max(0, Math.min(cols - 1, Number(ev._layout?.index || 0)));

  if (cols === 1) {
    blockEl.style.left = '0%';
    blockEl.style.width = '100%';
  } else {
    const widthPercent = 100 / cols;
    const leftPercent = widthPercent * index;
    blockEl.style.left = `${leftPercent}%`;
    blockEl.style.width = `${widthPercent}%`;
  }
}
