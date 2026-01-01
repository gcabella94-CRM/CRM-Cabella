// modules/notizie/listeners.js
import { findNotiziaById, upsertNotizia, deleteNotizia } from './model.js';
import { renderNotizie } from './render.js';

function nowLocalISO() {
  const d = new Date();
  const pad = (x)=>String(x).padStart(2,'0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function ensureBoundFlag(flag) {
  if (window[flag]) return true;
  window[flag] = true;
  return false;
}

export function openNotiziaModal(prefill, focusId) {
  const overlay = document.getElementById('notizie-modal-overlay');
  const form = document.getElementById('not-form');
  if (!overlay || !form) return;

  form.reset();
  const idEl = document.getElementById('not-id');
  if (idEl) idEl.value = (prefill && prefill.id) ? prefill.id : '';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  if (prefill) {
    set('not-etichetta', prefill.etichetta || 'generica');
    set('not-nome', prefill.nome || prefill.proprietarioNome || '');
    set('not-cognome', prefill.cognome || '');
    set('not-telefono', prefill.telefono || prefill.proprietarioTelefono || '');
    set('not-email', prefill.email || prefill.proprietarioEmail || '');
    set('not-indirizzo', prefill.indirizzo || '');
    set('not-citta', prefill.citta || '');
    set('not-provincia', prefill.provincia || '');
    set('not-cap', prefill.cap || '');
    set('not-categoria', prefill.categoria || '');
    set('not-tipologia', prefill.tipologia || 'vendita');
    set('not-mq', prefill.mq ?? '');
    set('not-prezzo', prefill.prezzo ?? '');
    set('not-note', prefill.note || '');
    const chk = document.getElementById('not-non-risponde');
    if (chk && typeof chk.checked !== 'undefined') chk.checked = !!prefill.nonRisponde;
    set('not-ricontatto', prefill.ricontatto || '');
    set('not-resp', prefill.responsabileId || '');
  }

  overlay.style.display = 'flex';
  if (focusId) {
    const el = document.getElementById(focusId);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus?.();
  } else {
    (document.getElementById('not-etichetta') || document.getElementById('not-indirizzo') || document.getElementById('not-nome'))?.focus?.();
  }
}

export function closeNotiziaModal() {
  const overlay = document.getElementById('notizie-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
}

export function resetNotizieForm() {
  const form = document.getElementById('not-form');
  if (!form) return;
  form.reset();
  const creaContattoEl = document.getElementById('not-crea-contatto');
  if (creaContattoEl) creaContattoEl.checked = true;
  const idEl = document.getElementById('not-id');
  if (idEl) idEl.value = '';
  const cancelBtn = document.getElementById('not-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const saveBtn = document.getElementById('not-save-btn');
  if (saveBtn) saveBtn.textContent = 'Salva notizia';
}

function pushTimelineInterazione(payload) {
  try {
    if (typeof window.pushInterazioneInTimeline === 'function') {
      window.pushInterazioneInTimeline(payload);
      return;
    }
  } catch {}
  try {
    if (typeof window.addInterazione === 'function') {
      window.addInterazione(payload);
      return;
    }
  } catch {}
}

export function bindNotizieUI() {
  if (ensureBoundFlag('__NOTIZIE_UI_BOUND__')) return;

  // NEW button
  document.getElementById('not-new-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openNotiziaModal(null);
  });

  // modal close UX
  const overlay = document.getElementById('notizie-modal-overlay');
  if (overlay) {
    document.getElementById('not-modal-close')?.addEventListener('click', closeNotiziaModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeNotiziaModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') closeNotiziaModal();
    });
  }

  // filtri -> render
  ['not-filter-resp','not-filter-label','not-filter-sort','not-filter-search'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => renderNotizie());
    el.addEventListener('change', () => renderNotizie());
  });

  // delega click: open/edit/del/jump/non-risponde/save comment/save recall
  document.addEventListener('click', (e) => {
    const t = e.target;

    const openBtn = t.closest?.('[data-not-open]');
    if (openBtn) {
      const id = openBtn.getAttribute('data-not-open');
      const n = findNotiziaById(id);
      if (n && typeof window.openNotiziaDetailDrawer === 'function') {
        window.openNotiziaDetailDrawer(n, '', { renderNotiziaDetail: window.renderNotiziaDetail });
      }
      return;
    }

    const editBtn = t.closest?.('[data-not-edit]');
    if (editBtn) {
      const id = editBtn.getAttribute('data-not-edit');
      const n = findNotiziaById(id);
      if (n) openNotiziaModal(n);
      return;
    }

    const delBtn = t.closest?.('[data-not-del]');
    if (delBtn) {
      const id = delBtn.getAttribute('data-not-del');
      if (!id) return;
      if (!confirm('Eliminare questa notizia?')) return;
      deleteNotizia(id);
      renderNotizie();
      return;
    }

    const jumpEl = t.closest?.('[data-not-jump]');
    if (jumpEl) {
      const id = jumpEl.getAttribute('data-not-jump');
      const focusId = jumpEl.getAttribute('data-jump') || '';
      const n = findNotiziaById(id);
      if (n && typeof window.openNotiziaDetailDrawer === 'function') {
        window.openNotiziaDetailDrawer(n, focusId, { renderNotiziaDetail: window.renderNotiziaDetail });
      }
      return;
    }

    const noans = t.closest?.('[data-not-noans-toggle]');
    if (noans) {
      const id = noans.getAttribute('data-not-noans-toggle');
      const n = findNotiziaById(id);
      if (!n) return;

      // slot ricontatto sempre visibile
      const box = document.getElementById('not-recall-' + id);
      if (box) box.style.display = 'block';

      // registra esito "Non risponde" in timeline, ma NON crea appuntamenti automaticamente
      try {
        const contattoId = (typeof window.findContattoFromNotizia === 'function') ? (window.findContattoFromNotizia(n) || '') : '';
        pushTimelineInterazione({
          tipo: 'telefonata',
          esito: 'non risponde',
          testo: 'Non risponde',
          links: { notiziaId: n.id, immobileId:'', contattoId: contattoId, attivitaId:'' },
          prossimaAzione: { enabled:false }
        });
      } catch {}
      // segna pending, così quando salva ricontatto sappiamo che è un no-answer
      n._pendingNoAnswer = true;
      upsertNotizia(n);

      // prefill ricontatto se già presente
      if (n.ricontatto) {
        try {
          const parts = String(n.ricontatto).split('T');
          const dPart = parts[0] || '';
          const tPart = (parts[1] || '').slice(0,5);
          const dateEl = document.querySelector(`[data-not-recall-date="${window.CSS?.escape ? window.CSS.escape(id) : id}"]`);
          const timeEl = document.querySelector(`[data-not-recall-time="${window.CSS?.escape ? window.CSS.escape(id) : id}"]`);
          if (dateEl && dPart) dateEl.value = dPart;
          if (timeEl && tPart) timeEl.value = tPart;
        } catch {}
      }
      return;
    }

    const saveRecall = t.closest?.('[data-not-save-recall]');
    if (saveRecall) {
      const id = saveRecall.getAttribute('data-not-save-recall');
      const n = findNotiziaById(id);
      if (!n) return;

      const esc = window.CSS?.escape ? window.CSS.escape(id) : id;
      const dateEl = document.querySelector(`[data-not-recall-date="${esc}"]`);
      const timeEl = document.querySelector(`[data-not-recall-time="${esc}"]`);
      const dateVal = (dateEl?.value || '').trim();
      const timeVal = (timeEl?.value || '').trim();

      if (!dateVal) { alert('Seleziona una data di ricontatto.'); return; }

      // ✅ Salva sempre in formato LOCALE (no UTC shift)
      const iso = dateVal + 'T' + (timeVal ? timeVal : '09:00') + ':00';
      n.ricontatto = iso;

      const isNoAnswer = !!n._pendingNoAnswer;
      n.nonRisponde = isNoAnswer;
      n._pendingNoAnswer = false;
      upsertNotizia(n);

      if (isNoAnswer) {
        // ✅ timeline: non risponde + prossima azione 15'
        pushTimelineInterazione({
          tipo: 'telefonata',
          esito: 'non risponde',
          testo: 'Non risponde',
          links: { notiziaId: n.id, immobileId:'', contattoId:'', attivitaId:'' },
          prossimaAzione: { enabled:true, when: iso, durataMin: 15, creaInAgenda: true }
        });
      } else {
        // ricontatto normale (solo prossima azione)
        pushTimelineInterazione({
          tipo: 'telefonata',
          esito: 'risposta',
          testo: 'Ricontatto fissato',
          links: { notiziaId: n.id, immobileId:'', contattoId:'', attivitaId:'' },
          prossimaAzione: { enabled:true, when: iso, durataMin: 15, creaInAgenda: true }
        });
      }

      renderNotizie();
      return;
    }

    const saveLast = t.closest?.('[data-not-save-lastcomment]');
    if (saveLast) {
      const id = saveLast.getAttribute('data-not-save-lastcomment');
      const n = findNotiziaById(id);
      if (!n) return;

      const textarea = document.querySelector(`[data-not-lastcomment="${window.CSS?.escape ? window.CSS.escape(id) : id}"]`);
      const txt = (textarea?.value || '').trim();
      if (!txt) { alert('Inserisci un commento.'); return; }

      // salva in notizia (anteprima)
      n.commentoUltimaInterazione = txt;
      n.ultimaInterazioneAt = nowLocalISO();
      upsertNotizia(n);

      // ✅ interazione timeline: adesso, tipo telefonata, esito risposta
      pushTimelineInterazione({
        tipo: 'telefonata',
        esito: 'risposta',
        testo: txt,
        links: { notiziaId: n.id, immobileId:'', contattoId:'', attivitaId:'' },
        prossimaAzione: { enabled:false }
      });

      if (textarea) textarea.value = '';
      renderNotizie();
      return;
    }
  });

  // submit form modale: delega al legacy (per non rischiare regressioni ora)
  document.getElementById('not-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      // preferisci handler legacy se esiste (già collaudato)
      if (typeof window.__LEGACY_API__?.notizie?.submitFromModal === 'function') {
        window.__LEGACY_API__.notizie.submitFromModal();
        return;
      }
    } catch {}

    // fallback minimo: non implementiamo qui per non rompere nulla
    alert('Salvataggio notizia: handler legacy non disponibile (manca bridge submitFromModal).');
  });

  document.getElementById('not-cancel-edit')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetNotizieForm();
  });
}
