/* Compatibility shim: keeps old index.html references working.
   Loads the real entrypoint: crm-app.js
   Safe to remove once index.html no longer references crm-app_fixed.js
*/
(function () {
  try {
    if (window.__CRM_APP_FIXED_SHIM_LOADED__) return;
    window.__CRM_APP_FIXED_SHIM_LOADED__ = true;

    // If the main app already loaded, do nothing
    if (window.__CRM_APP_LOADED__ || window.CRM_APP_LOADED) return;

    var s = document.createElement('script');
    s.src = 'crm-app.js?v=' + Date.now(); // cache-bust once
    s.defer = true;
    s.onload = function () {
      window.__CRM_APP_LOADED__ = true;
    };
    s.onerror = function () {
      console.error('[CRM] Shim: impossibile caricare crm-app.js');
    };
    document.head.appendChild(s);
  } catch (e) {
    console.error('[CRM] Shim error', e);
  }
})();