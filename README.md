# CRM - Spacchettamento (struttura definitiva)
Questa cartella crea una struttura a moduli *coerente* mantenendo il comportamento attuale:
- `crm-app.js` importa ancora il legacy (nessuna regressione)
- cartelle moduli pronte per estrazioni progressive senza toccare HTML/CSS

## Regola d'oro
Finché esistono `onclick="..."` o dipendenze globali, le funzioni estratte devono essere esposte su `window` (bridge) dal legacy o da un bootstrap.

## Prossimo step consigliato
1) Estrarre `modules/agenda/layout.js` e `modules/agenda/model.js`
2) Fare bridge dal legacy verso i moduli nuovi
3) Fix "mezza colonna" in layout.js
