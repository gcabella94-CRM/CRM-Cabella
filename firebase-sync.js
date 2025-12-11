const FIREBASE_CONFIG = {
  "apiKey": "AIzaSyDtHDNNDfcrs__PudNO0TyLDWXC2Lc6Y4A",
  "authDomain": "crm-4edc1.firebaseapp.com",
  "databaseURL": "https://crm-4edc1-default-rtdb.europe-west1.firebasedatabase.app",
  "projectId": "crm-4edc1",
  "storageBucket": "crm-4edc1.firebasestorage.app",
  "messagingSenderId": "478739038924",
  "appId": "1:478739038924:web:0a84657f30e75023acb869"
};

    let FIREBASE_ENABLED = false;
    let db = null;

    try {
      if (window.firebase && !firebase.apps.length && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey !== "INSERISCI_API_KEY") {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.database();
        FIREBASE_ENABLED = true;
        console.log('[SYNC] Firebase inizializzato');
      }
    } catch (e) {
      console.warn('[SYNC] Firebase non inizializzato:', e);
      FIREBASE_ENABLED = false;
    }

    const SYNC_ROOT = 'crm_dashboard_agenda_v1';

    const cloudSync = {
      save(key, value) {
        if (!FIREBASE_ENABLED || !db) return;
        try {
          db.ref(SYNC_ROOT + '/' + key).set(value || []);
        } catch (e) {
          console.warn('[SYNC] Errore salvataggio', key, e);
        }
      },
      subscribe(key, handler) {
        if (!FIREBASE_ENABLED || !db) return;
        try {
          db.ref(SYNC_ROOT + '/' + key).on('value', snap => {
            const val = snap.val() || [];
            handler(val);
          });
        } catch (e) {
          console.warn('[SYNC] Errore subscribe', key, e);
        }
      }
    };