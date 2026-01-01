// modules/notizie/render.js
import { getNotizie } from './model.js';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function cssEscapeSafe(v) {
  try { return window.CSS?.escape ? window.CSS.escape(v) : String(v).replace(/"/g,'\\"'); } catch { return String(v); }
}

function safeDate(x) {
  const d = new Date(x || 0);
  return isNaN(d) ? new Date(0) : d;
}

function formatDateTimeIT(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return '';
  const date = d.toLocaleDateString('it-IT');
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function getStaffLabel(staffId) {
  try {
    const s = (window.staff || []).find(x => x && x.id === staffId);
    return s?.nome || staffId || '—';
  } catch {
    return staffId || '—';
  }
}

export function renderNotizie() {
  const cardsContainer = document.getElementById('not-cards-container');
  const tbody = document.getElementById('not-table-body'); // legacy table (if exists)
  if (!cardsContainer && !tbody) return;

  // filtri
  const fResp   = document.getElementById('not-filter-resp');
  const fLabel  = document.getElementById('not-filter-label');
  const fSort   = document.getElementById('not-filter-sort');
  const fSearch = document.getElementById('not-filter-search');

  const respVal   = (fResp?.value || '').trim();
  const labelVal  = (fLabel?.value || '').trim();
  const sortVal   = (fSort?.value || 'created_desc').trim();
  const searchVal = (fSearch?.value || '').trim().toLowerCase();

  // popola responsabili/etichette
  if (fResp) {
    const prev = fResp.value;
    const staff = Array.isArray(window.staff) ? window.staff : [];
    fResp.innerHTML = ['<option value="">Tutti i responsabili</option>']
      .concat(staff.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.nome || s.id)}</option>`))
      .join('');
    fResp.value = prev;
  }
  if (fLabel) {
    const prev = fLabel.value;
    const labels = Array.from(new Set(getNotizie().map(n => (n?.etichetta || '').trim()).filter(Boolean))).sort();
    fLabel.innerHTML = ['<option value="">Tutte le etichette</option>']
      .concat(labels.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`))
      .join('');
    fLabel.value = prev;
  }

  let list = getNotizie().slice();

  if (respVal)  list = list.filter(n => String(n?.responsabileId || '') === respVal);
  if (labelVal) list = list.filter(n => String(n?.etichetta || '') === labelVal);

  if (searchVal) {
    list = list.filter(n => {
      const hay = [
        n?.indirizzo, n?.citta, n?.provincia, n?.cap,
        n?.tipologia, n?.piano, n?.mq,
        n?.nome, n?.cognome, n?.telefono, n?.email,
        n?.note, n?.commentoUltimaInterazione
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(searchVal);
    });
  }

  if (sortVal === 'created_desc') {
    list.sort((a,b) => safeDate(b?.createdAt) - safeDate(a?.createdAt));
  } else if (sortVal === 'recall_asc') {
    list.sort((a,b) => safeDate(a?.ricontatto) - safeDate(b?.ricontatto));
  } else if (sortVal === 'label_asc') {
    list.sort((a,b) => String(a?.etichetta||'').localeCompare(String(b?.etichetta||''), 'it', { sensitivity:'base' }));
  }

  // render cards
  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    if (!list.length) {
      cardsContainer.innerHTML = `<div class="muted" style="padding:14px;">Nessuna notizia trovata.</div>`;
    } else {
      list.forEach(n => {
        const id = n?.id || '';
        const staffLabel = getStaffLabel(n?.responsabileId);
        const last = n?.ultimaInterazioneAt || n?.updatedAt || n?.createdAt || '';
        const lastComment = n?.commentoUltimaInterazione || '';
        const rec = n?.ricontatto || '';
        const recDT = rec ? formatDateTimeIT(rec) : '—';

        const card = document.createElement('div');
        card.className = 'notizia-card';
        card.setAttribute('tabindex','0');
        card.innerHTML = `
          <div class="notizia-mini">
            <div class="notizia-mini__top">
              <div class="notizia-mini__addr">
                <strong>${escapeHtml(n?.indirizzo || '—')}</strong>
                <span class="muted">${escapeHtml([n?.citta, n?.provincia].filter(Boolean).join(' ') || '')}</span>
              </div>
              <div class="notizia-actions-row">
                <button class="btn btn-xs" data-not-open="${escapeHtml(id)}">Apri</button>
                <button class="btn btn-xs" data-not-edit="${escapeHtml(id)}">Modifica</button>
                <button class="btn btn-xs" data-not-del="${escapeHtml(id)}">Elimina</button>
              </div>
            </div>

            <div class="notizia-mini__meta">
              <span><strong>Tipologia:</strong> ${escapeHtml(n?.tipologia || '—')}</span>
              <span><strong>MQ:</strong> ${escapeHtml(n?.mq ?? '—')}</span>
              <span><strong>Piano:</strong> ${escapeHtml(n?.piano || '—')}</span>
            </div>

            <div class="notizia-mini__owner">
              <div>
                <strong>${escapeHtml([n?.nome, n?.cognome].filter(Boolean).join(' ') || '—')}</strong>
                <div class="muted" style="margin-top:2px;">
                  <a href="tel:${escapeHtml(n?.telefono || '')}" data-not-jump="${escapeHtml(id)}" data-jump="telefono">${escapeHtml(n?.telefono || '—')}</a>
                  ${n?.email ? ` · <a href="mailto:${escapeHtml(n.email)}" data-not-jump="${escapeHtml(id)}" data-jump="email">${escapeHtml(n.email)}</a>` : ''}
                </div>
              </div>
              <div class="muted"><strong>Resp:</strong> ${escapeHtml(staffLabel)}</div>
            </div>

            <div class="notizia-lastcomment-box">
              <div class="muted"><strong>Ultimo contatto:</strong> ${escapeHtml(last ? formatDateTimeIT(last) : '—')}</div>
              <details style="margin-top:6px;">
                <summary class="muted">Commento</summary>
                <div style="margin-top:6px;white-space:pre-wrap;">${escapeHtml(lastComment || '—')}</div>
              </details>

              <div style="margin-top:10px;">
                <textarea class="input-sm" rows="2" placeholder="Inserisci commento ultima interazione…" data-not-lastcomment="${escapeHtml(id)}"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
                  <button class="btn btn-xs" data-not-save-lastcomment="${escapeHtml(id)}">Salva commento</button>
                </div>
              </div>
            </div>

            <div style="margin-top:10px;">
              <button class="btn btn-xs" data-not-noans-toggle="${escapeHtml(id)}">Non risponde</button>

              <div id="not-recall-${escapeHtml(id)}" style="margin-top:10px;">
                <div class="muted" style="margin-bottom:6px;"><strong>Ricontatto:</strong> ${escapeHtml(recDT)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  <input class="input-sm" type="date" data-not-recall-date="${escapeHtml(id)}" />
                  <input class="input-sm" type="time" data-not-recall-time="${escapeHtml(id)}" />
                  <button class="btn btn-xs" data-not-save-recall="${escapeHtml(id)}">Salva ricontatto</button>
                </div>
              </div>
            </div>
          </div>
        `;

        // card click -> dettaglio (solo su anteprima libera)
        card.addEventListener('click', (ev) => {
          try {
            const stopSel =
              'button, a, input, textarea, select, label, summary, details,' +
              '[data-not-jump],[data-not-open],[data-not-edit],[data-not-del],' +
              '[data-not-save-lastcomment],[data-not-noans-toggle],[data-not-recall-date],' +
              '[data-not-recall-time],[data-not-save-recall],.notizia-lastcomment-box,.notizia-actions-row';
            if (ev.target.closest(stopSel)) return;
          } catch { return; }

          // Prefer detail drawer legacy if exists
          try {
            if (typeof window.openNotiziaDetailDrawer === 'function') {
              window.openNotiziaDetailDrawer(n, '', { renderNotiziaDetail: window.renderNotiziaDetail });
              return;
            }
          } catch {}
          // fallback open
          try {
            if (typeof window.openSchedaNotizia === 'function') window.openSchedaNotizia(id);
          } catch {}
        });
        card.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && ev.target === card) {
            try {
              if (typeof window.openNotiziaDetailDrawer === 'function') {
                window.openNotiziaDetailDrawer(n, '', { renderNotiziaDetail: window.renderNotiziaDetail });
              }
            } catch {}
          }
        });

        // prefill ricontatto fields if present
        if (rec) {
          try {
            const parts = String(rec).split('T');
            const dPart = parts[0] || '';
            const tPart = (parts[1] || '').slice(0,5);
            const dateEl = card.querySelector(`[data-not-recall-date="${cssEscapeSafe(id)}"]`);
            const timeEl = card.querySelector(`[data-not-recall-time="${cssEscapeSafe(id)}"]`);
            if (dateEl && dPart) dateEl.value = dPart;
            if (timeEl && tPart) timeEl.value = tPart;
          } catch {}
        }

        cardsContainer.appendChild(card);
      });
    }
  }

  // legacy table: keep as-is (if you still use it)
  if (tbody && typeof window.renderNotizieTableLegacy === 'function') {
    window.renderNotizieTableLegacy(list);
  }
}
