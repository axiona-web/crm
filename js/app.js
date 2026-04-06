// ── js/app.js ─────────────────────────────────────────────────────────────────

const VIEWS = {
  dashboard:      dashboardView,
  members:        membersView,
  pipeline:       pipelineView,
  commissions:    commissionsView,
  ai:             aiView,
  partners:       partnersView,
  profile:        profileView,
  clen_dashboard: clenDashboardView,
};

const app = {
  state: {
    view:        'dashboard',
    contacts:    [],
    deals:       [],
    commissions: [],
  },

  async init() {
    await auth.init();
    if (auth.user) {
      await this.boot();
    } else {
      this.showLogin();
    }
  },

  async boot() {
    // Nastav defaultný view podľa roly
    const role = auth.profile?.role;
    if (role === 'clen') {
      this.state.view = 'clen_dashboard';
    } else {
      this.state.view = 'dashboard';
    }

    document.getElementById('root').innerHTML = this._appShell();
    modal.init();

    // Načítaj dáta len pre roly ktoré ich potrebujú
    if (role !== 'clen') {
      await this._loadData();
    }

    this.renderNav();
    this.renderContent();
    this.updateFooter();
  },

  showLogin() {
    document.getElementById('root').innerHTML = auth.renderLoginScreen();
  },

  async _loadData() {
    try {
      const [contacts, deals, commissions] = await Promise.all([
        db.getContacts(),
        db.getDeals(),
        db.getCommissions(),
      ]);
      this.state.contacts    = contacts;
      this.state.deals       = deals;
      this.state.commissions = commissions;
    } catch(e) { console.error('Load error:', e); }
  },

  setView(id) {
    this.state.view = id;
    this.renderNav();
    this.renderContent();
  },

  renderNav() {
    const role  = auth.profile?.role || 'clen';
    const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.clen;
    document.getElementById('nav').innerHTML = items.map(n => `
      <button class="nav-btn${this.state.view === n.id ? ' active' : ''}"
        onclick="app.setView('${n.id}')">
        <span class="nav-icon">${n.icon}</span>
        <span>${n.label}</span>
      </button>`).join('');
  },

  renderContent() {
    const view = VIEWS[this.state.view];
    if (!view) return;
    document.getElementById('content').innerHTML = view.render();
    if (view.afterRender) view.afterRender();
  },

  updateFooter() {
    const el = document.getElementById('sidebar-foot');
    if (!el) return;
    const p    = auth.profile;
    const role = p?.role || 'clen';
    const r    = ROLES[role] || ROLES.clen;
    const name = p?.name || auth.user?.email || '';
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(name)}</div>
      <div style="font-size:10px;color:${r.color};">${r.icon} ${r.label}</div>`;
  },

  async exportData() {
    db.exportAll(this.state.contacts, this.state.deals, this.state.commissions);
  },

  async logout() { await auth.logout(); },

  showApiSetup() { document.getElementById('api-setup').classList.add('open'); },

  saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key.startsWith('sk-ant-')) { alert('Neplatný kľúč.'); return; }
    localStorage.setItem('axiona_ai_key', key);
    document.getElementById('api-setup').classList.remove('open');
  },

  _appShell() {
    const role = auth.profile?.role || 'clen';
    const showTools = role !== 'clen';
    return `
      <div id="api-setup" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:2000;align-items:center;justify-content:center;">
        <div class="setup-box">
          <h2 style="margin-bottom:8px;">✦ AI Asistent</h2>
          <p>Pre AI funkcie zadaj Anthropic API kľúč. Uloží sa len lokálne.</p>
          <div style="margin-bottom:12px;"><a href="https://console.anthropic.com/keys" target="_blank" style="color:var(--acc);font-size:13px;">→ console.anthropic.com/keys</a></div>
          <div class="form-row"><label class="form-label">API kľúč</label><input id="api-key-input" type="password" placeholder="sk-ant-api03-..." /></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn-primary" onclick="app.saveApiKey()">Uložiť</button>
            <button class="btn-ghost" onclick="document.getElementById('api-setup').style.display='none'">Neskôr</button>
          </div>
        </div>
      </div>

      <div class="overlay" id="modal-overlay">
        <div class="modal" id="modal-box">
          <div class="modal-head">
            <h3 id="modal-title"></h3>
            <button class="btn-ghost" style="padding:3px 10px;font-size:16px;" onclick="modal.close()">✕</button>
          </div>
          <div id="modal-body"></div>
        </div>
      </div>

      <div id="app">
        <div id="sidebar">
          <div id="sidebar-head">
            <div class="brand">Axiona</div>
            <div class="title">CRM</div>
          </div>
          <nav id="nav"></nav>
          <div id="sidebar-foot" style="padding:12px 18px;border-top:1px solid var(--brd);font-size:12px;color:var(--muted);"></div>
          <div style="padding:10px 10px 16px;border-top:1px solid var(--brd);display:flex;flex-direction:column;gap:5px;">
            ${showTools ? `<button class="btn-ghost" style="font-size:11px;padding:5px 8px;text-align:left;" onclick="app.exportData()">⬇ Export záloha</button>` : ''}
            ${showTools ? `<button class="btn-ghost" style="font-size:11px;padding:5px 8px;text-align:left;" onclick="app.showApiSetup()">🔑 AI API kľúč</button>` : ''}
            <button class="btn-ghost" style="font-size:11px;padding:5px 8px;text-align:left;color:var(--red);" onclick="app.logout()">⎋ Odhlásiť</button>
          </div>
        </div>
        <div id="content"></div>
      </div>`;
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());
