/**
 * Compatibility shim – NON è il CRM vero
 * Carica crm-app.js
 */
(function () {
  var alreadyLoaded = Array.from(document.scripts || []).some(function (s) {
    return (s.getAttribute('src') || '').includes('crm-app.js');
  });
  if (alreadyLoaded) return;

  var s = document.createElement('script');
  s.src = './crm-app.js';
  s.defer = true;
  document.head.appendChild(s);
})();
