# CRM Modules Contract (v0)

Obiettivo: `crm-app.js` è il bootstrap/mappa. Ogni sezione vive in moduli piccoli.

## Entità (minime)
- notizia: lead/scheda operativa
- contatto: rubrica
- immobile
- appuntamento: unico oggetto (ex attività+appuntamenti)
- interazione: timeline (collegabile a notizia/contatto/immobile/appuntamento)
- poligono: areaRicerca | condominio

## Link standard (sempre)
Ogni entità può avere `links`:
```js
links: { notiziaId:'', contattoId:'', immobileId:'', appuntamentoId:'' }
```

## Eventi standard (event bus)
- `data:changed` { entity, id, action } // create|update|delete
- `nav:jump` { to, id, context }
- `agenda:collision` { evId, responsabileId, overlaps:[...] }

## Regole agenda (anti-regressioni)
- `telefonata` default **15 minuti**
- `ricontatto` genera appuntamento **15 minuti** (non 60)
- overlap/colonne calcolate **per gruppo reale** (niente maxCols globale)
- collision alert: solo se overlap con stesso `responsabileId`, non bloccante
