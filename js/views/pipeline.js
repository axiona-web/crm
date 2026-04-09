// ── views/pipeline.js ────────────────────────────────────────────────────────

const LEAD_STATUSES = {
  new:        { label: 'Nový',          color: 'var(--muted)' },
  assigned:   { label: 'Priradený',     color: 'var(--blue)'  },
  contacted:  { label: 'Kontaktovaný',  color: 'var(--purple)'},
  qualified:  { label: 'Kvalifikovaný', color: 'var(--acc)'   },
  lost:       { label: 'Stratený',      color: 'var(--red)'   },
  cancelled:  { label: 'Zrušený',       color: 'var(--muted)' },
};

const OPP_STATUSES = {
  open:        { label: 'Otvorená',    color: 'var(--blue)'  },
  negotiation: { label: 'Rokovanie',   color: 'var(--purple)'},
  won:         { label: 'Vyhraná',     color: 'var(--green)' },
  lost:        { label: 'Stratená',    color: 'var(--red)'   },
  cancelled:   { label: 'Zrušená',     color: 'var(--muted)' },
};

const pipelineView = {
  _tab:    'leads',
  _leads:  [],
  _opps:   [],
  _filter: 'all',

  render() {
    return `
      <div class="view-head">
        <h2>📊 Pipeline</h2>
        <button class="btn-primary" onclick="pipelineView._openAdd()">+ Nový</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <button class="filter-tab${this._tab==='leads'?' active':''}"
          onclick="pipelineView._switchTab('leads')">
          📋 Leady <span id="leads-count" style="font-size:10px;opacity:0.7;"></span>
        </button>
        <button class="filter-tab${this._tab==='opps'?' active':''}"
          onclick="pipelineView._switchTab('opps')">
          🎯 Príležitosti <span id="opps-count" style="font-size:10px;opacity:0.7;"></span>
        </button>
      </div>
      <div id="pipeline-filters" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;"></div>
      <div id="pipeline-list">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderFilters();
    this._renderList();
    // Obnov tab active state
    document.querySelectorAll('.filter-tab').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      if (oc.includes("'leads'")) b.classList.toggle('active', this._tab === 'leads');
      if (oc.includes("'opps'"))  b.classList.toggle('active', this._tab === 'opps');
    });
  },

  async _load() {
    const uid     = app._currentUserId();
    const role    = previewRole.effective() || auth.profile?.role;
    const isAdmin = role === 'admin';

    let lQ = db.client.from('leads')
      .select('*, contacts(name,email,phone), products(name,category,base_price)')
      .order('created_at', { ascending: false });
    if (!isAdmin) lQ = lQ.or(`owner_id.eq.${uid},assigned_to.eq.${uid},created_by.eq.${uid}`);

    let oQ = db.client.from('opportunities')
      .select('*, contacts(name,email), products(name,category,base_price)')
      .order('created_at', { ascending: false });
    if (!isAdmin) oQ = oQ.or(`owner_id.eq.${uid},assigned_to.eq.${uid},created_by.eq.${uid}`);

    const [lr, or_] = await Promise.all([lQ, oQ]);
    if (lr.error) console.error('Leads error:', lr.error);
    if (or_.error) console.error('Opps error:', or_.error);

    this._leads = lr.data || [];
    this._opps  = or_.data || [];

    const lc = document.getElementById('leads-count');
    const oc = document.getElementById('opps-count');
    if (lc) lc.textContent = `(${this._leads.length})`;
    if (oc) oc.textContent = `(${this._opps.length})`;
  },

  _switchTab(tab) {
    this._tab    = tab;
    this._filter = 'all';
    document.querySelectorAll('.filter-tab').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      if (oc.includes("'leads'")) b.classList.toggle('active', tab === 'leads');
      if (oc.includes("'opps'"))  b.classList.toggle('active', tab === 'opps');
    });
    this._renderFilters();
    this._renderList();
  },

  _setFilter(f) {
    this._filter = f;
    this._renderFilters();
    this._renderList();
  },

  _renderFilters() {
    const el = document.getElementById('pipeline-filters');
    if (!el) return;
    const statuses = this._tab === 'leads' ? LEAD_STATUSES : OPP_STATUSES;
    el.innerHTML = `
      <button class="filter-tab${this._filter==='all'?' active':''}" onclick="pipelineView._setFilter('all')">Všetky</button>
      ${Object.entries(statuses).map(([k,v]) => `
        <button class="filter-tab${this._filter===k?' active':''}"
          style="${this._filter===k?`color:${v.color};border-color:${v.color};`:''}"
          onclick="pipelineView._setFilter('${k}')">${v.label}</button>`).join('')}`;
  },

  _renderList() {
    const el = document.getElementById('pipeline-list');
    if (!el) return;
    const items = this._tab === 'leads'
      ? (this._filter === 'all' ? this._leads : this._leads.filter(l => l.status === this._filter))
      : (this._filter === 'all' ? this._opps  : this._opps.filter(o => o.status === this._filter));
    if (!items.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
        <div style="font-size:28px;margin-bottom:8px;">${this._tab==='leads'?'📋':'🎯'}</div>
        <div>Žiadne záznamy</div>
        <div style="margin-top:12px;"><button class="btn-primary" onclick="pipelineView._openAdd()">+ Pridať</button></div>
      </div>`;
      return;
    }
    el.innerHTML = items.map(i => this._tab === 'leads' ? this._leadCard(i) : this._oppCard(i)).join('');
  },

  _badge(status, type) {
    const cfg = (type==='lead' ? LEAD_STATUSES : OPP_STATUSES)[status] || { label: status, color:'var(--muted)' };
    return `<span class="badge" style="background:${cfg.color}18;color:${cfg.color};border:1px solid ${cfg.color}44;font-size:10px;">${cfg.label}</span>`;
  },

  _leadCard(l) {
    const needsApproval = l.requires_approval && !l.approved_at && l.status === 'new';
    const hasKey = !!localStorage.getItem('axiona_ai_key');
    return `
      <div class="card" style="cursor:pointer;margin-bottom:8px;${needsApproval?'border-color:rgba(212,148,58,0.4);':''}"
        onclick="pipelineView._openEditLead('${l.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              ${this._badge(l.status, 'lead')}
              ${needsApproval?`<span class="badge" style="background:rgba(212,148,58,0.12);color:var(--acc);border:1px solid var(--acc-brd);font-size:10px;">⏳ Čaká na schválenie</span>`:''}
              ${l.sla_breached?`<span style="font-size:10px;color:var(--red);">⚠ SLA</span>`:''}
            </div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${esc(l.title||'—')}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
              ${l.contacts?`<span>👤 ${esc(l.contacts.name)}</span>`:''}
              ${l.products?`<span>🛍️ ${esc(l.products.name)}</span>`:''}
              ${l.source?`<span>🔗 ${esc(l.source)}</span>`:''}
              ${l.value_estimate?`<span class="mono" style="color:var(--green);">💰 ${EUR(l.value_estimate)}</span>`:''}
            </div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
            ${hasKey?`<button class="icon-btn" onclick="event.stopPropagation();aiLead.openPanelLead('${l.id}')">✦</button>`:''}
            ${l.status==='qualified'?`
              <button class="btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--green);white-space:nowrap;"
                onclick="event.stopPropagation();pipelineView._convertToOpp('${l.id}')">→ Príležitosť</button>`:''}
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveLeadStatus('${l.id}',-1)">◀</button>
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveLeadStatus('${l.id}',1)">▶</button>
          </div>
        </div>
      </div>`;
  },

  _oppCard(o) {
    const hasKey = !!localStorage.getItem('axiona_ai_key');
    return `
      <div class="card" style="cursor:pointer;margin-bottom:8px;"
        onclick="pipelineView._openEditOpp('${o.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              ${this._badge(o.status, 'opp')}
              ${o.probability!=null?`<span style="font-size:11px;color:var(--muted);">${o.probability}%</span>`:''}
              ${o.expected_close?`<span style="font-size:11px;color:var(--muted);">📅 ${FMT(o.expected_close)}</span>`:''}
            </div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${esc(o.title||'—')}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
              ${o.contacts?`<span>👤 ${esc(o.contacts.name)}</span>`:''}
              ${o.products?`<span>🛍️ ${esc(o.products.name)}</span>`:''}
            </div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
            ${hasKey?`<button class="icon-btn" onclick="event.stopPropagation();aiLead.openPanelOpp('${o.id}')">✦</button>`:''}
            <div class="mono" style="font-size:15px;font-weight:700;color:var(--acc);">${EUR(o.value)}</div>
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveOppStatus('${o.id}',-1)">◀</button>
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveOppStatus('${o.id}',1)">▶</button>
          </div>
        </div>
      </div>`;
  },

  // ── Status pohyb ──────────────────────────────────────────────────────────
  async _moveLeadStatus(id, dir) {
    const keys = Object.keys(LEAD_STATUSES);
    const l    = this._leads.find(x => x.id === id);
    if (!l) return;
    const ni = Math.max(0, Math.min(keys.length-1, keys.indexOf(l.status)+dir));
    if (keys[ni] === l.status) return;
    const { error } = await db.client.from('leads').update({ status: keys[ni] }).eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    l.status = keys[ni];
    this._renderList();
  },

  async _moveOppStatus(id, dir) {
    const keys = Object.keys(OPP_STATUSES);
    const o    = this._opps.find(x => x.id === id);
    if (!o) return;
    const ni = Math.max(0, Math.min(keys.length-1, keys.indexOf(o.status)+dir));
    if (keys[ni] === o.status) return;
    if (keys[ni] === 'won' && !confirm('Označiť ako WON? Automaticky sa vytvorí objednávka.')) return;
    const { error } = await db.client.from('opportunities').update({ status: keys[ni] }).eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    o.status = keys[ni];
    this._renderList();
    if (keys[ni] === 'won') {
      setTimeout(() => alert('✓ Príležitosť vyhraná! Objednávka bola vytvorená v záložke Objednávky.'), 300);
    }
  },

  // ── Konverzia lead → opportunity ──────────────────────────────────────────
  async _convertToOpp(leadId) {
    const l = this._leads.find(x => x.id === leadId);
    if (!l) return;

    const assignOpts = (await db.client.from('profiles')
      .select('id,name,email').eq('role','obchodnik')).data || [];

    modal.open('Vytvoriť príležitosť', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Z leadu: <strong>${esc(l.title||'—')}</strong>
        ${l.contacts?` · ${esc(l.contacts.name)}`:''}
      </div>
      <div class="form-row"><label class="form-label">Názov príležitosti *</label>
        <input id="co-title" value="${esc(l.title||l.contacts?.name||'')}" /></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€)</label>
          <input id="co-value" type="number" value="${l.value_estimate||''}" /></div>
        <div class="form-row"><label class="form-label">Pravdepodobnosť (%)</label>
          <input id="co-prob" type="number" min="0" max="100" value="50" /></div>
      </div>
      <div class="form-row"><label class="form-label">Plánované uzatvorenie</label>
        <input id="co-close" type="date" /></div>
      <div class="form-row"><label class="form-label">Priradiť obchodníkovi</label>
        <select id="co-assign">
          <option value="">— admin spracuje —</option>
          ${assignOpts.map(u=>`<option value="${u.id}">${esc(u.name||u.email)}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="co-notes" style="min-height:55px;">${esc(l.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" id="co-btn" onclick="pipelineView._doConvert('${leadId}')">Vytvoriť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _doConvert(leadId) {
    const l     = this._leads.find(x => x.id === leadId);
    const title = document.getElementById('co-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }
    const btn = document.getElementById('co-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    const uid = app._currentUserId();
    try {
      const { data, error } = await db.client.from('opportunities').insert({
        lead_id:        leadId,
        contact_id:     l?.contact_id || null,
        product_id:     l?.product_id || null,
        created_by:     uid,
        owner_id:       uid,
        assigned_to:    document.getElementById('co-assign')?.value || null,
        title,
        value:          Number(document.getElementById('co-value')?.value)  || 0,
        probability:    Number(document.getElementById('co-prob')?.value)   || 50,
        expected_close: document.getElementById('co-close')?.value || null,
        notes:          document.getElementById('co-notes')?.value || null,
        status:         'open',
      }).select().single();
      if (error) throw error;

      // Aktualizuj lead na qualified
      await db.client.from('leads').update({ status: 'qualified', qualified_at: new Date().toISOString() }).eq('id', leadId);
      l.status = 'qualified';

      modal.close();
      this._opps.unshift(data);
      this._tab = 'opps';
      this._filter = 'all';
      this._renderFilters();
      this._renderList();
      document.querySelectorAll('.filter-tab').forEach(b => {
        const oc = b.getAttribute('onclick') || '';
        if (oc.includes("'leads'")) b.classList.remove('active');
        if (oc.includes("'opps'"))  b.classList.add('active');
      });
      const oc = document.getElementById('opps-count');
      if (oc) oc.textContent = `(${this._opps.length})`;
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Vytvoriť'; }
    }
  },

  // ── Formuláre ─────────────────────────────────────────────────────────────
  _openAdd() {
    this._tab === 'leads' ? this._openAddLead() : this._openAddOpp();
  },

  _openAddLead() {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.active||p.is_active).map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Nový lead', `
      <div class="form-row"><label class="form-label">Názov / Téma *</label>
        <input id="lf-title" placeholder="napr. Záujem o chatbota" /></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="lf-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="lf-product" onchange="pipelineView._onLeadProduct(this.value)">
          <option value="">— vybrať —</option>${pOpts}</select></div>
      <div id="lf-pinfo" style="display:none;margin-bottom:10px;"></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Odhadovaná hodnota (€)</label>
          <input id="lf-value" type="number" /></div>
        <div class="form-row"><label class="form-label">Zdroj</label>
          <select id="lf-source">
            <option value="manual">Manuálne</option>
            <option value="web">Web</option>
            <option value="referral">Referral</option>
            <option value="member">Člen</option>
            <option value="phone">Telefón</option>
            <option value="email">Email</option>
          </select></div>
      </div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="lf-desc" style="min-height:55px;resize:vertical;"></textarea></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="lf-notes" style="min-height:55px;resize:vertical;"></textarea></div>
      <div style="padding:10px 12px;background:rgba(212,148,58,0.08);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--acc);margin-bottom:12px;">
        ℹ️ Lead bude odoslaný na schválenie adminovi.
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="lf-btn" onclick="pipelineView._saveLead()">Odoslať</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  _onLeadProduct(pid) {
    const p = (app.state.products||[]).find(x => x.id === pid);
    if (!p) return;
    const v = document.getElementById('lf-value');
    if (v && !v.value) v.value = p.base_price || p.price || '';
    const d = document.getElementById('lf-desc');
    if (d && !d.value && p.description) d.value = p.description;
    const t = document.getElementById('lf-title');
    if (t && !t.value) t.value = p.name;
    const info = document.getElementById('lf-pinfo');
    if (info) {
      info.style.display = '';
      info.innerHTML = `<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--muted);">${esc(p.category||'')} › ${esc(p.subcategory||'')}</span>
          <span class="mono" style="color:var(--acc);font-weight:700;">${EUR(p.base_price||p.price||0)}</span>
        </div>
        ${p.description?`<div style="color:var(--muted);margin-top:4px;">${esc(p.description)}</div>`:''}
      </div>`;
    }
  },

  async _saveLead() {
    const title = document.getElementById('lf-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }
    const btn = document.getElementById('lf-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    const uid = app._currentUserId();
    try {
      const { data, error } = await db.client.from('leads').insert({
        title,
        contact_id:     document.getElementById('lf-contact')?.value || null,
        product_id:     document.getElementById('lf-product')?.value || null,
        value_estimate: Number(document.getElementById('lf-value')?.value) || 0,
        source:         document.getElementById('lf-source')?.value || 'manual',
        description:    document.getElementById('lf-desc')?.value   || null,
        notes:          document.getElementById('lf-notes')?.value  || null,
        created_by:     uid,
        owner_id:       uid,
        status:         'new',
        requires_approval: true,
      }).select().single();
      if (error) throw error;
      this._leads.unshift(data);
      modal.close();
      this._tab = 'leads';
      this._renderFilters();
      this._renderList();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Odoslať'; }
    }
  },

  _openAddOpp() {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.active||p.is_active).map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Nová príležitosť', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="of-title" /></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="of-contact"><option value="">—</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="of-product" onchange="pipelineView._onOppProduct(this.value)">
          <option value="">—</option>${pOpts}</select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€) *</label>
          <input id="of-value" type="number" /></div>
        <div class="form-row"><label class="form-label">Pravdepodobnosť (%)</label>
          <input id="of-prob" type="number" min="0" max="100" value="50" /></div>
      </div>
      <div class="form-row"><label class="form-label">Uzatvorenie</label>
        <input id="of-close" type="date" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="of-status">
          ${Object.entries(OPP_STATUSES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="of-notes" style="min-height:55px;resize:vertical;"></textarea></div>
      <div class="form-actions">
        <button class="btn-primary" id="of-btn" onclick="pipelineView._saveOpp('')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  _onOppProduct(pid) {
    const p = (app.state.products||[]).find(x => x.id === pid);
    if (!p) return;
    const v = document.getElementById('of-value');
    if (v && !v.value) v.value = p.base_price || p.price || '';
  },

  async _saveOpp(id) {
    const isNew = !id;
    const title = document.getElementById('of-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }
    const btn = document.getElementById('of-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    const uid = app._currentUserId();
    const obj = {
      title,
      contact_id:     document.getElementById('of-contact')?.value || null,
      product_id:     document.getElementById('of-product')?.value || null,
      value:          Number(document.getElementById('of-value')?.value)  || 0,
      probability:    Number(document.getElementById('of-prob')?.value)   || 50,
      expected_close: document.getElementById('of-close')?.value || null,
      status:         document.getElementById('of-status')?.value || 'open',
      notes:          document.getElementById('of-notes')?.value || null,
    };
    try {
      if (isNew) { obj.created_by = uid; obj.owner_id = uid; }
      const q = isNew
        ? db.client.from('opportunities').insert(obj).select().single()
        : db.client.from('opportunities').update(obj).eq('id', id).select().single();
      const { data, error } = await q;
      if (error) throw error;
      if (isNew) this._opps.unshift(data);
      else this._opps = this._opps.map(o => o.id === id ? {...o,...data} : o);
      modal.close();
      this._renderList();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  _openEditLead(id) {
    const l = this._leads.find(x => x.id === id);
    if (!l) return;
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}"${l.contact_id===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.active||p.is_active).map(p =>
      `<option value="${p.id}"${l.product_id===p.id?' selected':''}>${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Upraviť lead', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="lf-title" value="${esc(l.title||'')}" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="lf-status">
          ${Object.entries(LEAD_STATUSES).map(([k,v])=>`<option value="${k}"${l.status===k?' selected':''}>${v.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="lf-contact"><option value="">—</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="lf-product"><option value="">—</option>${pOpts}</select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Odhadovaná hodnota (€)</label>
          <input id="lf-value" type="number" value="${l.value_estimate||''}" /></div>
        <div class="form-row"><label class="form-label">Zdroj</label>
          <input id="lf-source" value="${esc(l.source||'')}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="lf-notes" style="min-height:65px;resize:vertical;">${esc(l.notes||'')}</textarea></div>
      ${!l.approved_at && l.requires_approval ? `
        <div style="padding:10px 12px;background:rgba(212,148,58,0.08);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--acc);margin-bottom:12px;">
          ⏳ Čaká na schválenie adminom
        </div>` : ''}
      <div class="form-actions">
        <button class="btn-primary" id="lf-btn" onclick="pipelineView._updateLead('${id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${l.status==='qualified'?`
          <button class="btn-ghost" style="color:var(--green);"
            onclick="modal.close();pipelineView._convertToOpp('${id}')">→ Príležitosť</button>`:''}
        <button class="btn-danger" style="margin-left:auto;"
          onclick="pipelineView._deleteLead('${id}')">Vymazať</button>
      </div>`);
  },

  async _updateLead(id) {
    const btn = document.getElementById('lf-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
      const obj = {
        title:          document.getElementById('lf-title')?.value.trim(),
        status:         document.getElementById('lf-status')?.value,
        contact_id:     document.getElementById('lf-contact')?.value || null,
        product_id:     document.getElementById('lf-product')?.value || null,
        value_estimate: Number(document.getElementById('lf-value')?.value) || 0,
        source:         document.getElementById('lf-source')?.value || null,
        notes:          document.getElementById('lf-notes')?.value  || null,
      };
      const { error } = await db.client.from('leads').update(obj).eq('id', id);
      if (error) throw error;
      this._leads = this._leads.map(l => l.id === id ? {...l,...obj} : l);
      modal.close();
      this._renderList();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async _deleteLead(id) {
    if (!confirm('Vymazať lead?')) return;
    await db.client.from('leads').delete().eq('id', id);
    this._leads = this._leads.filter(l => l.id !== id);
    modal.close();
    this._renderList();
  },

  _openEditOpp(id) {
    const o = this._opps.find(x => x.id === id);
    if (!o) return;
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}"${o.contact_id===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.active||p.is_active).map(p =>
      `<option value="${p.id}"${o.product_id===p.id?' selected':''}>${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Upraviť príležitosť', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="of-title" value="${esc(o.title||'')}" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="of-status">
          ${Object.entries(OPP_STATUSES).map(([k,v])=>`<option value="${k}"${o.status===k?' selected':''}>${v.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="of-contact"><option value="">—</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="of-product"><option value="">—</option>${pOpts}</select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€)</label>
          <input id="of-value" type="number" value="${o.value||''}" /></div>
        <div class="form-row"><label class="form-label">Pravdepodobnosť (%)</label>
          <input id="of-prob" type="number" min="0" max="100" value="${o.probability||50}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Uzatvorenie</label>
        <input id="of-close" type="date" value="${o.expected_close||''}" /></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="of-notes" style="min-height:65px;resize:vertical;">${esc(o.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" id="of-btn" onclick="pipelineView._saveOpp('${id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        <button class="btn-danger" style="margin-left:auto;"
          onclick="pipelineView._deleteOpp('${id}')">Vymazať</button>
      </div>`);
  },

  async _deleteOpp(id) {
    if (!confirm('Vymazať príležitosť?')) return;
    await db.client.from('opportunities').delete().eq('id', id);
    this._opps = this._opps.filter(o => o.id !== id);
    modal.close();
    this._renderList();
  },
};
