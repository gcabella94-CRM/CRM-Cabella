// modules/core/store.js
// Single in-memory state + persistence to localStorage.
// Modules should never touch localStorage directly.

import { deepClone, mergeDeep } from './utils.js';

const DEFAULT_KEY = 'crm_state_v1';

export function createStore({ storageKey = DEFAULT_KEY, initialState = {} } = {}) {
  let state = deepClone(initialState);

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return state;
      const parsed = JSON.parse(raw);
      state = mergeDeep(deepClone(initialState), parsed || {});
      return state;
    } catch (err) {
      console.warn('[store] load failed, using initialState', err);
      state = deepClone(initialState);
      return state;
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('[store] save failed', err);
      return false;
    }
  }

  function get() {
    return state;
  }

  function set(nextState, { persist = true } = {}) {
    state = deepClone(nextState || {});
    if (persist) save();
    return state;
  }

  // Patch a slice of state (deep merge)
  function patch(partial, { persist = true } = {}) {
    state = mergeDeep(state, partial || {});
    if (persist) save();
    return state;
  }

  // Update with producer fn (immutable-like convenience)
  function update(producer, { persist = true } = {}) {
    const draft = deepClone(state);
    if (typeof producer === 'function') producer(draft);
    state = draft;
    if (persist) save();
    return state;
  }

  return { load, save, get, set, patch, update };
}
