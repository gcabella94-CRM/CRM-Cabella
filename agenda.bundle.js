/* agenda.bundle.js
   Scopo: rendere attivi i moduli Agenda (MODEL / LAYOUT / OVERLAP) senza ESM.
   Espone un namespace unico: window.AGENDA
*/
(function(){
  'use strict';

  function getOverlaps(a, dayApps) {
    return (dayApps || []).filter(function(ev){
      if (!ev || ev === a) return false;
      return (ev._startMin < a._endMin) && (ev._endMin > a._startMin);
    });
  }

  function computeColumnsForEvent(a, dayApps) {
    var overlaps = getOverlaps(a, dayApps);
    if (overlaps.length === 0) return { cols: 1, index: 0, overlaps: overlaps };

    var cols = overlaps.length + 1;
    var index = Math.min(a && a._colIndex ? a._colIndex : 0, cols - 1);
    return { cols: cols, index: index, overlaps: overlaps };
  }

  function hasSameResponsabileOverlap(a, overlaps) {
    if (!a || !a.responsabileId) return false;
    return (overlaps || []).some(function(ev){ return ev && ev.responsabileId === a.responsabileId; });
  }

  function applyBlockLayout(block, a, dayApps) {
    if (!block) return;

    // reset (evita effetto "50%" persistente)
    block.style.left = '0%';
    block.style.width = '100%';

    var r = computeColumnsForEvent(a, dayApps);
    if (!r || r.cols === 1) return;

    var widthPercent = 100 / r.cols;
    var leftPercent = widthPercent * r.index;
    block.style.left = leftPercent + '%';
    block.style.width = widthPercent + '%';
  }

  // Namespace pubblico (estendibile)
  var AGENDA = window.AGENDA || {};
  AGENDA.getOverlaps = getOverlaps;
  AGENDA.computeColumnsForEvent = computeColumnsForEvent;
  AGENDA.hasSameResponsabileOverlap = hasSameResponsabileOverlap;
  AGENDA.applyBlockLayout = applyBlockLayout;

  window.AGENDA = AGENDA;
})();
