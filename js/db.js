// ── db.js — localStorage wrapper ──────────────────────────────────────────────

const DB_KEYS = {
  contacts:    'axiona_crm_contacts',
  deals:       'axiona_crm_deals',
  commissions: 'axiona_crm_commissions',
  apiKey:      'axiona_crm_apikey',
};

const db = {
  get(entity) {
    try {
      const raw = localStorage.getItem(DB_KEYS[entity]);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  set(entity, data) {
    try {
      localStorage.setItem(DB_KEYS[entity], JSON.stringify(data));
    } catch (e) {
      console.error('DB write error:', e);
    }
  },

  getApiKey() {
    return localStorage.getItem(DB_KEYS.apiKey) || '';
  },

  setApiKey(key) {
    localStorage.setItem(DB_KEYS.apiKey, key);
  },

  clearApiKey() {
    localStorage.removeItem(DB_KEYS.apiKey);
  },

  // Export all data as JSON string (for backup)
  exportAll() {
    return JSON.stringify({
      contacts:    this.get('contacts'),
      deals:       this.get('deals'),
      commissions: this.get('commissions'),
      exportedAt:  new Date().toISOString(),
      version:     '1.0',
    }, null, 2);
  },

  // Import from JSON backup
  importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (data.contacts)    this.set('contacts',    data.contacts);
    if (data.deals)       this.set('deals',        data.deals);
    if (data.commissions) this.set('commissions',  data.commissions);
  },
};
