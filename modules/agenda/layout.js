// modules/agenda/layout.js
import { computeColumnsForEvent, assignColumns } from './overlap.js';

export function applyBlockLayout(block, a, dayApps) {
  const { cols, index } = computeColumnsForEvent(a, dayApps);

  if (cols === 1) {
    block.style.left = '0%';
    block.style.width = '100%';
  } else {
    const widthPercent = 100 / cols;
    const leftPercent = widthPercent * index;
    block.style.left = leftPercent + '%';
    block.style.width = widthPercent + '%';
  }
}

// Utility opzionale: assicura che gli eventi abbiano _colIndex/_colCount coerenti
// prima di chiamare applyBlockLayout() (anti regressione "tutto al 50%").
export function ensureDayLayout(dayApps) {
  return assignColumns(dayApps || []);
}
