// modules/notizie/notiziaDrawer.js
// Drawer Notizia (UI puro, idempotente)
// - Nessuna variabile top-level condivisa
// - Evita collisioni di identificatori (non usa il nome "overlay" come variabile)
// - Mantiene gli ID/struttura attesi dal legacy (crm-app.legacy.js)

export function ensureNotiziaDetailDrawer({ closeNotiziaDetail } = {}) {
  // Se esiste già, ritorna (idempotente)
  let overlayNode = document.getElementById('notizia-detail-overlay');
  if (overlayNode) return overlayNode;

  // fallback close handler
  const safeClose = (typeof closeNotiziaDetail === 'function')
    ? closeNotiziaDetail
    : () => {
        const ov = document.getElementById('notizia-detail-overlay');
        if (!ov) return;
        ov.classList.remove('show');
        ov.style.display = 'none';
      };

  // ===== Markup (mantiene gli ID/struttura attesi dal legacy) =====
  overlayNode = document.createElement('div');
  overlayNode.id = 'notizia-detail-overlay';
  overlayNode.className = 'modal-overlay';

  overlayNode.innerHTML = [
    '  <div class="modal-panel notizia-detail-panel" role="dialog" aria-modal="true">',
    '    <div class="modal-header">',
    '      <div>',
    '        <div class="modal-title">Scheda Notizia</div>',
    '        <div class="modal-subtitle" id="notizia-detail-subtitle">Dettaglio</div>',
    '      </div>',
    '      <button class="btn btn-ghost" id="notizia-detail-close" title="Chiudi">✕</button>',
    '    </div>',
    '',
    '    <div class="modal-body" id="notizia-detail-body" style="padding-top:6px;">',
    '      <div class="notizia-detail-sections">',
    '        <div class="notizia-detail-section" id="notd-indirizzo">',
    '          <div class="card-title" style="font-size:13px;">📍 Dati immobile potenziale</div>',
    '          <div id="notd-indirizzo-content" class="muted" style="margin-top:6px;"></div>',
    '        </div>',
    '',
    '        <div class="notizia-detail-section" id="notd-proprietario" style="margin-top:10px;">',
    '          <div class="card-title" style="font-size:13px;">👤 Proprietario / Contatto</div>',
    '          <div id="notd-proprietario-content" class="muted" style="margin-top:6px;"></div>',
    '        </div>',
    '',
    '        <div class="notizia-detail-section" id="notd-timeline" style="margin-top:10px;">',
    '          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">',
    '            <div class="card-title" style="font-size:13px;">🕒 Timeline</div>',
    '            <button class="btn btn-sm" id="notd-add-interazione">+ Interazione</button>',
    '          </div>',
    '          <div id="notd-timeline-list" style="margin-top:6px;"></div>',
    '',
    '          <div id="notd-add-interazione-box" style="display:none;margin-top:8px;border:1px solid #111827;border-radius:12px;padding:8px;background:rgba(2,6,23,0.55);">',
    '            <div class="form-grid-2">',
    '              <div class="form-group">',
    '                <label>Tipo</label>',
    '                <select id="notd-int-tipo">',
    '                  <option value="chiamata">Chiamata</option>',
    '                  <option value="whatsapp">WhatsApp</option>',
    '                  <option value="email">Email</option>',
    '                  <option value="sopralluogo">Sopralluogo</option>',
    '                  <option value="nota" selected>Nota</option>',
    '                  <option value="altro">Altro</option>',
    '                </select>',
    '              </div>',
    '              <div class="form-group">',
    '                <label>Esito</label>',
    '                <select id="notd-int-esito">',
    '                  <option value="neutro" selected>Neutro</option>',
    '                  <option value="positivo">Positivo</option>',
    '                  <option value="negativo">Negativo</option>',
    '                  <option value="da_richiamare">Da richiamare</option>',
    '                  <option value="non_risponde">Non risponde</option>',
    '                </select>',
    '              </div>',
    '            </div>',
    '',
    '            <div class="form-group">',
    '              <label>Testo</label>',
    '              <textarea id="notd-int-testo" placeholder="Cosa ci siamo detti..."></textarea>',
    '            </div>',
    '',
    '            <div class="form-grid-2">',
    '              <div class="form-group">',
    '                <label>Ricontatto (opz.)</label>',
    '                <input id="notd-int-when" type="datetime-local">',
    '              </div>',
    '              <div class="form-group" style="display:flex;align-items:flex-end;gap:8px;">',
    '                <label style="display:flex;align-items:center;gap:8px;">',
    '                  <input id="notd-int-crea-agenda" type="checkbox" checked>',
    '                  Crea in agenda (15 min)',
    '                </label>',
    '              </div>',
    '            </div>',
    '',
    '            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">',
    '              <button class="btn btn-ghost" id="notd-int-cancel">Annulla</button>',
    '              <button class="btn btn-primary" id="notd-int-save">Salva interazione</button>',
    '            </div>',
    '          </div>',
    '        </div>',
    '',
    '        <div class="notizia-detail-section" id="notd-azioni" style="margin-top:10px;">',
    '          <div class="card-title" style="font-size:13px;">⚙️ Azioni</div>',
    '          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">',
    '            <button class="btn btn-sm" id="notd-btn-modifica">Modifica notizia</button>',
    '            <button class="btn btn-sm" id="notd-btn-chiudi">Chiudi</button>',
    '          </div>',
    '          <div class="muted" style="margin-top:6px;">(Livello 1) Da qui poi collegheremo conversione → Immobile e relazioni avanzate.</div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>'
  ].join('\n');

  document.body.appendChild(overlayNode);

  // ===== Close handlers =====
  overlayNode.addEventListener('click', (e) => {
    if (e.target === overlayNode) safeClose();
  });

  const btnX = overlayNode.querySelector('#notizia-detail-close');
  if (btnX) btnX.addEventListener('click', safeClose);

  // ESC key close (safe)
  const onKey = (e) => {
    if (e.key === 'Escape') safeClose();
  };
  document.addEventListener('keydown', onKey, { passive: true });

  return overlayNode;
}


// ===============================
// API Drawer (logica open/close fuori dal legacy)
// ===============================
export function closeNotiziaDetail() {
  const ov = document.getElementById('notizia-detail-overlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.style.display = 'none';
}

export function openNotiziaDetail(notizia, focusId = '', { renderNotiziaDetail } = {}) {
  const overlayNode = ensureNotiziaDetailDrawer({ closeNotiziaDetail });
  overlayNode.style.display = 'flex';
  overlayNode.classList.add('show');

  // render contenuto (fornito dal legacy)
  if (typeof renderNotiziaDetail === 'function') {
    renderNotiziaDetail(notizia);
  }

  // focus se richiesto
  if (focusId) {
    const map = {
      'not-indirizzo': 'notd-indirizzo',
      'not-proprietario': 'notd-proprietario',
      'not-ultimo-contatto': 'notd-timeline',
      'not-commento': 'notd-timeline'
    };
    const targetId = map[focusId] || focusId;
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
