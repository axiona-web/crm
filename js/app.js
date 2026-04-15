// ── js/app.js ─────────────────────────────────────────────────────────────────

const VIEWS = {
  dashboard:            dashboardView,
  queue:                adminQueueView,
  members:              membersView,
  pipeline:             pipelineView,
  orders:               ordersView,
  commissions:          commissionsView,
  payouts:              payoutsView,
  reporting:            reportingView,
  products:             productsView,
  calc:                 commissionCalcView,
  ai:                   aiView,
  partners:             partnersView,
  profile:              profileView,
  clen_dashboard:       clenDashboardView,
  partner_dashboard:    partnerDashboardView,
  obchodnik_dashboard:  obchodnikDashboardView,
  marketplace:          marketplaceView,
  marketplace_orders:   marketplaceOrdersView,
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

  _currentUserId() {
    return auth.user?.id || null;
  },

  async boot() {
    const role = previewRole.effective();

    // Hash routing — načítaj sekciu z URL pri boote/refreshi
    const hashView = window.location.hash.replace('#', '').trim();
    if (hashView && VIEWS[hashView]) {
      this.state.view = hashView;
    } else if (role === 'clen')      this.state.view = 'clen_dashboard';
    else if (role === 'obchodnik')   this.state.view = 'obchodnik_dashboard';
    else if (role === 'partner')     this.state.view = 'partner_dashboard';
    else                             this.state.view = 'dashboard';

    document.getElementById('root').innerHTML = this._appShell();
    modal.init();

    // Browser back/forward
    window.addEventListener('popstate', (e) => {
      const view = e.state?.view || window.location.hash.replace('#','');
      if (view && VIEWS[view] && view !== this.state.view) {
        this.state.view = view;
        this.renderNav();
        this._lastLoad = 0;
        this._loadData().then(() => this.renderContent());
      }
    });

    if (role !== 'clen') await this._loadData();
    this.renderNav();
    await this.renderContent();
    this.updateFooter();
    this._updatePreviewBanner();
    if (typeof notifView !== 'undefined') notifView.init();
  },

  showLogin() {
    document.getElementById('root').innerHTML = auth.renderLoginScreen();
  },

  _lastLoad: 0,

  async _loadData() {
    // Throttle — nenačítavaj znovu ak to bolo pred menej ako 3 sekundy
    const now = Date.now();
    if (now - this._lastLoad < 3000) return;
    this._lastLoad = now;

    try {
      const [contacts, orders, commissions, products, deals] = await Promise.all([
        db.client.from('contacts').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        db.client.from('orders').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        db.client.from('commissions').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        db.client.from('products').select('*').order('name').then(r => r.data || []),
        db.client.from('deals')
          .select('*, contacts(name,email,phone), products(name,category,base_price,commission_percent,commission_enabled,benefit_eligible,max_discount_pct)')
          .order('created_at', { ascending: false })
          .then(r => r.data || []),
      ]);
      this.state.contacts    = contacts;
      this.state.orders      = orders;
      this.state.commissions = commissions;
      this.state.products    = products;
      this.state.deals       = deals;
      this.state.leads         = deals;
      this.state.opportunities = deals.filter(d => ['offer_sent','won','payment_pending','paid','in_progress','completed'].includes(d.status));
    } catch(e) { console.error('Load error:', e); }
  },

  _rendering: false,
  _renderSeq:  0,
  _debug:      false,
  _log(...args) { if (this._debug) console.log('[APP]', ...args); },

  setView(id) {
    if (!VIEWS[id]) { console.warn('[APP] unknown view:', id); return; }
    this._log('setView', id, '<- from', this.state.view);
    this.state.view = id;
    // Hash routing — URL zmena okamžite
    history.pushState({ view: id }, '', window.location.pathname + '#' + id);
    // Nav highlight okamžite
    this.renderNav();
    // Reset throttle pri manuálnej navigácii
    this._lastLoad = 0;
    this._loadData()
      .then(() => this.renderContent())
      .catch(e => { console.error('[APP] setView error:', e); this.renderContent(); });
  },

  _forceSetView(id) {
    this._rendering = false;
    this._renderSeq++;
    this._lastLoad = 0;
    this.state.view = id;
    history.pushState({ view: id }, '', window.location.pathname + '#' + id);
    this.renderNav();
    this._loadData().then(() => this.renderContent());
  },

  renderNav() {
    const el = document.getElementById('nav');
    if (!el) return;
    const role  = previewRole.effective();
    const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.clen;
    el.innerHTML = items.map(n => `
      <button class="nav-btn${this.state.view === n.id ? ' active' : ''}"
        onclick="app.setView('${n.id}')">
        <span class="nav-icon">${n.icon}</span>
        <span>${n.label}</span>
      </button>`).join('');
  },

  async renderContent() {
    const seq = ++this._renderSeq;
    // Ak stale render beží, force unlock po 50ms
    if (this._rendering) {
      await new Promise(r => setTimeout(r, 50));
      if (this._rendering) this._rendering = false;
    }
    this._rendering = true;
    const viewId = this.state.view;
    const view   = VIEWS[viewId];
    if (!view) { this._rendering = false; return; }

    const content = document.getElementById('content');
    if (content) content.innerHTML = `<div style="padding:24px;color:var(--muted);font-size:13px;"><span style="display:inline-block;width:12px;height:12px;border:2px solid var(--acc);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle;"></span>Načítavam...</div>`;

    try {
      if (seq !== this._renderSeq) { this._rendering = false; return; }
      const html = view.render();
      if (seq !== this._renderSeq) { this._rendering = false; return; }
      if (content) content.innerHTML = html;
      if (view.afterRender) await view.afterRender();
      this._log('renderContent done seq='+seq, viewId);
    } catch(e) {
      console.error('[APP] renderContent error:', e);
      if (content && seq === this._renderSeq) {
        content.innerHTML = `<div style="padding:20px;"><div style="background:rgba(242,85,85,0.1);border:1px solid rgba(242,85,85,0.3);border-radius:8px;padding:14px;font-size:13px;color:var(--red);"><div style="font-weight:700;margin-bottom:6px;">⚠ Chyba sekcie</div><div style="color:var(--muted);margin-bottom:10px;">${e.message}</div><button class="btn-ghost" style="font-size:12px;" onclick="app._forceSetView('${viewId}')">↻ Skúsiť znovu</button><button class="btn-ghost" style="font-size:12px;margin-left:8px;" onclick="app.setView('dashboard')">← Dashboard</button></div></div>`;
      }
    } finally {
      this._rendering = false;
    }
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

  async saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key.startsWith('sk-ant-')) { alert('Neplatný kľúč. Musí začínať sk-ant-'); return; }
    try {
      if (typeof aiProxy !== 'undefined') {
        await aiProxy.saveApiKey(key);
        alert('✓ API kľúč uložený bezpečne v databáze.');
      } else {
        localStorage.setItem('axiona_ai_key', key);
        alert('✓ API kľúč uložený lokálne.');
      }
      const el = document.getElementById('api-setup');
      if (el) el.style.display = 'none';
    } catch(e) {
      // Fallback na localStorage
      localStorage.setItem('axiona_ai_key', key);
      alert('✓ API kľúč uložený lokálne (DB nedostupná).');
      const el = document.getElementById('api-setup');
      if (el) el.style.display = 'none';
    }
  },

  _appShell() {
    const role      = previewRole.effective();
    const realRole  = auth.profile?.role;
    const showTools = realRole === 'admin' || role === 'obchodnik';
    return `
      <div id="api-setup" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:2000;align-items:center;justify-content:center;">
        <div class="setup-box">
          <h2 style="margin-bottom:8px;">✦ AI Asistent</h2>
          <p>Pre AI funkcie zadaj Anthropic API kľúč. Uloží sa bezpečne v databáze.</p>
          <div style="margin-bottom:12px;"><a href="https://console.anthropic.com/keys" target="_blank" style="color:var(--acc);font-size:13px;">→ console.anthropic.com/keys</a></div>
          <div class="form-row"><label class="form-label">API kľúč</label><input id="api-key-input" type="password" placeholder="sk-ant-api03-..." /></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn-primary" onclick="app.saveApiKey()">Uložiť bezpečne</button>
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
            <button id="notif-bell" onclick="notifView.openPanel()"
              style="margin-left:auto;background:none;border:none;cursor:pointer;position:relative;padding:4px;color:var(--muted);">
              🔔
              <span id="notif-count" style="display:none;position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:8px;padding:1px 4px;min-width:14px;text-align:center;"></span>
            </button>
          </div>
          <nav id="nav"></nav>
          <div id="sidebar-foot" style="padding:12px 18px;border-top:1px solid var(--brd);font-size:12px;color:var(--muted);"></div>
          <div style="padding:10px 10px 16px;border-top:1px solid var(--brd);display:flex;flex-direction:column;gap:5px;">
            ${realRole === 'admin' ? `
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;padding:4px 8px 2px;">Zobraziť ako</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;padding:0 4px 6px;">
                ${Object.entries(ROLES).map(([k,v]) => `
                  <button onclick="previewRole.set('${k}')"
                    style="padding:4px 8px;border-radius:6px;border:1px solid ${previewRole.current()===k?v.color:'var(--brd)'};
                      background:${previewRole.current()===k?v.color+'22':'transparent'};
                      color:${previewRole.current()===k?v.color:'var(--muted)'};
                      font-size:11px;font-weight:${previewRole.current()===k?'700':'400'};cursor:pointer;font-family:inherit;">
                    ${v.icon} ${v.label}
                  </button>`).join('')}
                ${previewRole.current() ? `
                  <button onclick="previewRole.clear()"
                    style="padding:4px 8px;border-radius:6px;border:1px solid var(--red);background:rgba(242,85,85,0.1);
                      color:var(--red);font-size:11px;cursor:pointer;font-family:inherit;">✕</button>` : ''}
              </div>
              <div style="height:1px;background:var(--brd);margin:2px 0 4px;"></div>` : ''}
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
