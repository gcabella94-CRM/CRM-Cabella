// Modulo UI: drawer dettaglio Notizia
// Estratto da crm-app.js per micro-spacchettamento (prima tappa).
// Nota: non cambia markup o funzioni; espone solo una funzione riusabile.

export function ensureNotiziaDetailDrawer({ closeNotiziaDetail }) {
  let overlay = document.getElementById('notizia-detail-overlay');
  if (overlay) return overlay;

  // === BEGIN: markup identico alla versione legacy ===
overlay = document.createElement('div');
  overlay.id = 'notizia-detail-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = [
    "    <div class=\"modal-panel notizia-detail-panel\" role=\"dialog\" aria-modal=\"true\">",
    "      <div class=\"modal-header\">",
    "        <div>",
    "          <div class=\"modal-title\">Scheda Notizia</div>",
    "          <div class=\"modal-subtitle\" id=\"notizia-detail-subtitle\">Dettaglio</div>",
    "        </div>",
    "        <button class=\"btn btn-ghost\" id=\"notizia-detail-close\" title=\"Chiudi\">\u2715</button>",
    "      </div>",
    "",
    "      <div class=\"modal-body\" id=\"notizia-detail-body\" style=\"padding-top:6px;\">",
    "        <div class=\"notizia-detail-sections\">",
    "          <div class=\"notizia-detail-section\" id=\"notd-indirizzo\">",
    "            <div class=\"card-title\" style=\"font-size:13px;\">\ud83d\udccd Dati immobile potenziale</div>",
    "            <div id=\"notd-indirizzo-content\" class=\"muted\" style=\"margin-top:6px;\"></div>",
    "          </div>",
    "",
    "          <div class=\"notizia-detail-section\" id=\"notd-proprietario\" style=\"margin-top:10px;\">",
    "            <div class=\"card-title\" style=\"font-size:13px;\">\ud83d\udc64 Proprietario / Contatto</div>",
    "            <div id=\"notd-proprietario-content\" class=\"muted\" style=\"margin-top:6px;\"></div>",
    "          </div>",
    "",
    "          <div class=\"notizia-detail-section\" id=\"notd-timeline\" style=\"margin-top:10px;\">",
    "            <div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;\">",
    "              <div class=\"card-title\" style=\"font-size:13px;\">\ud83d\udd52 Timeline</div>",
    "              <button class=\"btn btn-sm\" id=\"notd-add-interazione\">+ Interazione</button>",
    "            </div>",
    "            <div id=\"notd-timeline-list\" style=\"margin-top:6px;\"></div>",
    "",
    "            <div id=\"notd-add-interazione-box\" style=\"display:none;margin-top:8px;border:1px solid #111827;border-radius:12px;padding:8px;background:rgba(2,6,23,0.55);\">",
    "              <div class=\"form-grid-2\">",
    "                <div class=\"form-group\">",
    "                  <label>Tipo</label>",
    "                  <select id=\"notd-int-tipo\">",
    "                    <option value=\"chiamata\">Chiamata</option>",
    "                    <option value=\"whatsapp\">WhatsApp</option>",
    "                    <option value=\"email\">Email</option>",
    "                    <option value=\"sopralluogo\">Sopralluogo</option>",
    "                    <option value=\"nota\" selected>Nota</option>",
    "                    <option value=\"altro\">Altro</option>",
    "                  </select>",
    "                </div>",
    "                <div class=\"form-group\">",
    "                  <label>Esito</label>",
    "                  <select id=\"notd-int-esito\">",
    "                    <option value=\"neutro\" selected>Neutro</option>",
    "                    <option value=\"positivo\">Positivo</option>",
    "                    <option value=\"negativo\">Negativo</option>",
    "                    <option value=\"da_richiamare\">Da richiamare</option>",
    "                    <option value=\"non_risponde\">Non risponde</option>",
    "                  </select>",
    "                </div>",
    "              </div>",
    "",
    "              <div class=\"form-group\">",
    "                <label>Testo</label>",
    "                <textarea id=\"notd-int-testo\" placeholder=\"Cosa ci siamo detti...\"></textarea>",
    "              </div>",
    "",
    "              <div class=\"form-grid-2\">",
    "                <div class=\"form-group\">",
    "                  <label>Ricontatto (opz.)</label>",
    "                  <input id=\"notd-int-when\" type=\"datetime-local\">",
    "                </div>",
    "                <div class=\"form-group\" style=\"display:flex;align-items:flex-end;gap:8px;\">",
    "                  <label style=\"display:flex;align-items:center;gap:8px;\">",
    "                    <input id=\"notd-int-crea-agenda\" type=\"checkbox\" checked>",
    "                    Crea in agenda (15 min)",
    "                  </label>",
    "                </div>",
    "              </div>",
    "",
    "              <div style=\"display:flex;gap:8px;justify-content:flex-end;margin-top:6px;\">",
    "                <button class=\"btn btn-ghost\" id=\"notd-int-cancel\">Annulla</button>",
    "                <button class=\"btn btn-primary\" id=\"notd-int-save\">Salva interazione</button>",
    "              </div>",
    "            </div>",
    "          </div>",
    "",
    "          <div class=\"notizia-detail-section\" id=\"notd-azioni\" style=\"margin-top:10px;\">",
    "            <div class=\"card-title\" style=\"font-size:13px;\">\u2699\ufe0f Azioni</div>",
    "            <div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;\">",
    "              <button class=\"btn btn-sm\" id=\"notd-btn-modifica\">Modifica notizia</button>",
    "              <button class=\"btn btn-sm\" id=\"notd-btn-chiudi\">Chiudi</button>",
    "            </div>",
    "            <div class=\"muted\" style=\"margin-top:6px;\">(Livello 1) Da qui poi collegheremo conversione \u2192 Immobile e relazioni avanzate.</div>",
    "          </div>",
    "        </div>",
    "      </div>",
    "    </div>"
  ].join('\n');

  document.body.appendChild(overlay);

  // close handlers
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNotiziaDetail();
  });
  document.getElementById('notizia-detail-close')?.addEventListener('click', closeNotiziaDetail);
  document.getElementById('notd-btn-chiudi')?.addEventListener('click', closeNotiziaDetail);

  return overlay;
}
