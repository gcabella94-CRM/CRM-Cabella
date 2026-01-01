// modules/core/events.js
// Lightweight event bus (no dependencies). Keeps modules decoupled.

export function createEventBus() {
  const listeners = new Map(); // event -> Set<fn>

  function on(event, fn) {
    if (!event || typeof fn !== 'function') return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(event);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    // Snapshot to avoid issues if handlers add/remove listeners during emit
    [...set].forEach(fn => {
      try { fn(payload); } catch (err) { console.error('[bus]', event, err); }
    });
  }

  function once(event, fn) {
    const unsubscribe = on(event, (p) => {
      unsubscribe();
      fn(p);
    });
    return unsubscribe;
  }

  return { on, off, once, emit };
}
