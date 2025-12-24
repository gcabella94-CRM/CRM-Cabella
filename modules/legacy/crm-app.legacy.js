// crm-app.legacy.js
// STEP 1 — BOOT NOTIZIE
// Base solida: store + render + modale nuova notizia
// Nessuna dipendenza da altre sezioni

(function () {
  const STORAGE_KEY = 'crm_notizie_v1';

  /* ===============================
     UTILS
  =============================== */
  function uid() {
    return 'n_' + Math.random().toString(36).slice(2, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function qs(id) {
    return document.getElementById(id);
  }

  /* ===============================
     STORE
  =============================== */
  let notizie = [];

  function loadNotizie() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notizie = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[NOTIZIE] errore lettura storage', e);
      notizie = [];
    }
  }

  function saveNotizie() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notizie));
  }

  /* ===============================
     RENDER
  =============================== */
  function renderNotizie() {
    const container = qs('not-cards-container');
    if (!container) return;

    container.innerHTML = '';

    if (!notizie.length) {
      container.innerHTML = `
        <div class="muted" style="padding:16px;text-align:center;">
          Nessuna notizia inserita.
        </div>`;
      return;
    }

    notizie
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(n => {
        const card = document.createElement('div');
        card.className = 'card notizia-card';
        card.dataset.id = n.id;

        card.innerHTML = `
          <div class="card-header">
            <div>
              <div class="card-title">
                🧩 ${n.indirizzo || 'Indirizzo non indicato'}
              </div>
              <div class="card-subtitle">
                ${[n.tipologia, n.mq ? n.mq + ' mq' : '', n.piano].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div class="muted" style="margin-top:6px;">
            👤 ${[n.nome, n.cognome].filter(Boolean).join(' ')}
            ${n.telefono ? ' · 📞 ' + n.telefono : ''}
          </div>

          ${n.note ? `
            <div style="margin-top:6px;font-size:12px;">
              ${n.note}
            </div>` : ''}

          <div class="muted" style="margin-top:6px;font-size:11px;">
            Inserita il ${new Date(n.createdAt).toLocaleString()}
          </div>
        `;

        container.appendChild(card);
      });
  }

  /* ===============================
     MODALE NOTIZIA
  =============================== */
  function openNotiziaModal(editId = null) {
    const overlay = qs('notizie-modal-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    if (editId) {
      // futuro: modifica
    } else {
      resetNotiziaForm();
    }
  }

  function closeNotiziaModal() {
    const overlay = qs('notizie-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  function resetNotiziaForm() {
    qs('not-form').reset();
    qs('not-id').value = '';
  }

  /* ===============================
     SALVATAGGIO
  =============================== */
  function handleNotiziaSubmit(e) {
    e.preventDefault();

    const id = qs('not-id').value || uid();
    const existing = notizie.find(n => n.id === id);
    const isEdit = Boolean(existing);

    const data = {
      id,
      createdAt: isEdit ? existing.createdAt : nowISO(),
      updatedAt: nowISO(),

      nome: qs('not-nome').value.trim(),
      cognome: qs('not-cognome').value.trim(),
      telefono: qs('not-telefono').value.trim(),
      email: qs('not-email').value.trim(),

      indirizzo: qs('not-indirizzo').value.trim(),
      citta: qs('not-citta').value.trim(),
      provincia: qs('not-provincia').value.trim(),
      cap: qs('not-cap').value.trim(),
      condominio: qs('not-condominio').value.trim(),

      tipologia: qs('not-tipologia').value,
      piano: qs('not-piano').value.trim(),
      mq: Number(qs('not-mq').value) || null,

      caldo: qs('not-caldo').checked,
      note: qs('not-note').value.trim(),

      responsabileId: null
    };

    if (isEdit) {
      Object.assign(existing, data);
    } else {
      notizie.push(data);
    }

    saveNotizie();
    renderNotizie();
    closeNotiziaModal();
  }

  /* ===============================
     INIT
  =============================== */
  function initNotizie() {
    loadNotizie();
    renderNotizie();

    const btnNew = qs('not-new-btn');
    const btnClose = qs('not-modal-close');
    const form = qs('not-form');

    if (btnNew) btnNew.addEventListener('click', () => openNotiziaModal());
    if (btnClose) btnClose.addEventListener('click', closeNotiziaModal);
    if (form) form.addEventListener('submit', handleNotiziaSubmit);
  }

  document.addEventListener('DOMContentLoaded', initNotizie);
})();
