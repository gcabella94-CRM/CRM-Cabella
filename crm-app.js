// crm-app.js (module entrypoint)
// Boots the app and delegates features to small modules.

import { initAgenda } from './modules/agenda/index.js';
import './modules/legacy/crm-app.legacy.js';

try { initAgenda(); } catch (e) { console.warn('[BOOT] initAgenda failed', e); }
