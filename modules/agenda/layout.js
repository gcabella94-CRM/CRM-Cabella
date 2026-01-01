// modules/agenda/layout.js
import { computeColumnsForEvent, assignColumns } from './overlap.js';

export function applyBlockLayout(block, a, dayApps) {
  const { cols, index } = computeColumnsForEvent(a, dayApps);

  if (cols === 1) {
    block.style.left = '0%';
    block.style.width = '100%';
    return;
  }

  const widthPercent = 100 / cols;
  const leftPercent = widthPercent * index;
  block.style.left = leftPercent + '%';
  block.style.width = widthPercent + '%';
}

// Pre-compute colIndex/colCount per tutti gli eventi del giorno.
export function ensureDayLayout(dayApps) {
  return assignColumns(dayApps || []);
}
