// ── js/app.js ─────────────────────────────────────────────────────────────────

const VIEWS = {
  dashboard:      dashboardView,
  members:        membersView,
  pipeline:       pipelineView,
  orders:         ordersView,
  commissions:    commissionsView,
  products:       productsView,
  calc:           commissionCalcView,
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
    orders:      [],
    commissions: [],
    products:    [],
  },

  async init() {
    await auth.init();
    if (auth.user) await this.boot();
    else this.showLogin();
  },

  async boot() {
    const role = previewRole.effective();
    this.state.view = (role === 'clen') ? 'clen_dashboard' : 'dashboard';
    document.getElementById('root').innerHTML = this._appShell();
    modal.init();
    if (role !== 'clen') await this._loadData();
    this.renderNav();
    this.renderContent();
    this.updateFooter();
    this._updatePreviewBanner();
  },

  showLogin() {
    document.getElementById('root').innerHTML = auth.renderLoginScreen();
  },

  async _loadData() {
    try {
      const [contacts, deals, orders, commissions, products] = await Promise.all([
        db.getContacts(), db.getDeals(), db.getOrders(), db.getCommissions(),
        db.client.from('products').select('*').order('name').then(r => r.data || []),
      ]);
      this.state.contacts    = contacts;
      this.state.deals       = deals;
      this.state.orders      = orders;
      this.state.commissions = commissions;
      this.state.products    = products;
    } catch(e) { console.error('Load error:', e); }
  },

  setView(id) {
    this.state.view = id;
    this.renderNav();
    this.renderContent();
  },

  renderNav() {
    const role  = previewRole.effective();
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
    const role = previewRole.effective();
    const r    = ROLES[role] || ROLES.clen;
    const name = p?.name || auth.user?.email || '';
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(name)}</div>
      <div style="font-size:10px;color:${r.color};">${r.icon} ${r.label}${previewRole.current() ? ' <span style="color:var(--acc);">(náhľad)</span>' : ''}</div>`;
  },

  _updatePreviewBanner() {
    const existing = document.getElementById('preview-banner');
    if (existing) existing.remove();
    const preview = previewRole.current();
    if (!preview || auth.profile?.role !== 'admin') return;
    const r      = ROLES[preview];
    const banner = document.createElement('div');
    banner.id    = 'preview-banner';
    banner.innerHTML = `
      <div style="position:fixed;bottom:20px;right:20px;z-index:500;
        background:var(--surf);border:1px solid var(--acc-brd);border-radius:12px;
        padding:12px 16px;display:flex;align-items:center;gap:12px;
        box-shadow:0 4px 24px rgba(0,0,0,0.4);font-size:13px;">
        <span style="color:var(--acc);">👁</span>
        <div>
          <div style="font-weight:600;color:var(--txt);">Náhľad: ${r.icon} ${r.label}</div>
          <div style="font-size:11px;color:var(--muted);">Vidíš systém očami tejto roly</div>
        </div>
        <button onclick="previewRole.clear()"
          style="background:rgba(242,85,85,0.12);color:var(--red);border:1px solid rgba(242,85,85,0.25);
            border-radius:7px;padding:5px 11px;font-size:12px;cursor:pointer;font-family:inherit;">
          ✕ Ukončiť
        </button>
      </div>`;
    document.body.appendChild(banner);
  },

  async exportData() {
    db.exportAll(this.state.contacts, this.state.deals, this.state.commissions);
  },

  async logout() { await auth.logout(); },
  showApiSetup() {
    const el = document.getElementById('api-setup');
    if (el) { el.style.display = 'flex'; }
  },

  saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key.startsWith('sk-ant-')) { alert('Neplatný kľúč. Musí začínať sk-ant-'); return; }
    localStorage.setItem('axiona_ai_key', key);
    const el = document.getElementById('api-setup');
    if (el) el.style.display = 'none';
    alert('✓ API kľúč uložený');
  },

  _appShell() {
    const role      = previewRole.effective();
    const realRole  = auth.profile?.role;
    const showTools = realRole === 'admin' || role === 'obchodnik';
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
          <div id="sidebar-head"><div class="brand">Axiona</div><div class="title">CRM</div></div>
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
