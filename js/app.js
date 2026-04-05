// ── app.js — main controller ──────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',   icon: '⊞', label: 'Dashboard'    },
  { id: 'contacts',    icon: '👥', label: 'Kontakty'     },
  { id: 'pipeline',    icon: '📊', label: 'Pipeline'     },
  { id: 'commissions', icon: '💰', label: 'Provízie'     },
  { id: 'ai',          icon: '✦', label: 'AI Asistent'  },
];

const VIEWS = {
  dashboard:   dashboardView,
  contacts:    contactsView,
  pipeline:    pipelineView,
  commissions: commissionsView,
  ai:          aiView,
};

const app = {
  state: {
    view:        'dashboard',
    contacts:    [],
    deals:       [],
    commissions: [],
  },

  init() {
    // Load data
    this.state.contacts    = db.get('contacts');
    this.state.deals       = db.get('deals');
    this.state.commissions = db.get('commissions');

    modal.init();
    this.renderNav();
    this.renderContent();
    this.updateFooter();

    // Show API key setup if not set (only matters for AI view, so we defer)
    // Key is requested lazily when the AI view tries to send.
  },

  setView(id) {
    this.state.view = id;
    this.renderNav();
    this.renderContent();
  },

  renderNav() {
    document.getElementById('nav').innerHTML = NAV_ITEMS.map(n => `
      <button class="nav-btn${this.state.view === n.id ? ' active' : ''}"
        onclick="app.setView('${n.id}')">
        <span class="nav-icon">${n.icon}</span>
        <span>${n.label}</span>
      </button>`).join('');
  },

  renderContent() {
    const view = VIEWS[this.state.view];
    document.getElementById('content').innerHTML = view.render();
    if (view.afterRender) view.afterRender();
  },

  updateFooter() {
    document.getElementById('sidebar-foot').textContent =
      `${this.state.contacts.length} kontaktov · ${this.state.deals.length} obchodov`;
  },

  // ── API key setup ─────────────────────────────────────────────────────────
  showApiSetup() {
    document.getElementById('api-setup').classList.add('open');
  },

  saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key.startsWith('sk-ant-')) {
      alert('Neplatný kľúč. Musí začínať sk-ant-');
      return;
    }
    db.setApiKey(key);
    document.getElementById('api-setup').classList.remove('open');
  },

  clearApiKey() {
    if (!confirm('Odstrániť API kľúč?')) return;
    db.clearApiKey();
    alert('API kľúč bol odstránený.');
  },

  // ── Data export / import ──────────────────────────────────────────────────
  exportData() {
    const json     = db.exportAll();
    const filename = `axiona-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(filename, json);
  },

  importData() {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json';
    input.onchange = async e => {
      try {
        const text = await readFile(e.target.files[0]);
        db.importAll(text);
        this.state.contacts    = db.get('contacts');
        this.state.deals       = db.get('deals');
        this.state.commissions = db.get('commissions');
        this.updateFooter();
        this.renderContent();
        alert('Dáta boli úspešne importované.');
      } catch {
        alert('Chyba pri importe. Skontroluj formát súboru.');
      }
    };
    input.click();
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => app.init());
