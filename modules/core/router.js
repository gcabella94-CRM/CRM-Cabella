// modules/core/router.js
// Minimal router for section navigation (no framework).
// Keeps the "jump" interactions consistent.

export function createRouter({ onNavigate } = {}) {
  let current = null;

  function go(to, payload = {}) {
    current = to;
    try { onNavigate?.(to, payload); } catch (e) { console.error('[router] onNavigate', e); }
    // Optional hash for deep-linking (safe: does not break if not used)
    try { window.location.hash = `#${encodeURIComponent(to)}`; } catch (_) {}
  }

  function getCurrent() { return current; }

  return { go, getCurrent };
}
