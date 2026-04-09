// ── views/pipeline.js — Leady + Príležitosti ─────────────────────────────────

const LEAD_STATUSES = {
  new:        { label: 'Nový',          color: 'var(--muted)' },
  assigned:   { label: 'Priradený',     color: 'var(--blue)'  },
  contacted:  { label: 'Kontaktovaný',  color: 'var(--purple)'},
  qualified:  { label: 'Kvalifikovaný', color: 'var(--acc)'   },
  lost:       { label: 'Stratený',      color: 'var(--red)'   },
  cancelled:  { label: 'Zrušený',       color: 'var(--muted)' },
};

const OPP_STATUSES = {
  open:        { label: 'Otvorená',     color: 'var(--blue)'  },
  negotiation: { label: 'Rokovanie',    color: 'var(--purple)'},
  won:         { label: 'Vyhraná',      color: 'var(--green)' },
  lost:        { label: 'Stratená',     color: 'var(--red)'   },
  cancelled:   { label: 'Zrušená',      color: 'var(--muted)' },
};

const pipelineView = {
  _tab:    'leads',   // 'leads' | 'opps'
  _leads:  [],
  _opps:   [],
  _filter: 'all',

  render() {
    return `
      <div class="view-head">
        <h2>📊 Pipeline</h2>
        <button class="btn-primary" onclick="pipelineView._openAdd()">+ Nový</button>
      </div>

      <!-- Tab prepínač -->
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <button class="filter-tab${this._tab==='leads'?' active':''}"
          onclick="pipelineView._switchTab('leads')">
          📋 Leady
          <span id="leads-count" style="font-size:10px;margin-left:4px;opacity:0.7;"></span>
        </button>
        <button class="filter-tab${this._tab==='opps'?' active':''}"
          onclick="pipelineView._switchTab('opps')">
          🎯 Príležitosti
          <span id="opps-count" style="font-size:10px;margin-left:4px;opacity:0.7;"></span>
        </button>
      </div>

      <!-- Filter stavov -->
      <div id="pipeline-filters" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;"></div>

      <!-- Obsah -->
      <div id="pipeline-list">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderFilters();
    this._renderList();
  },

  async _load() {
    const uid  = app._currentUserId();
    const role = app.state.userRole || previewRole.effective() || auth.profile?.role;
    const isAdmin = role === 'admin';

    let leadsQ = db.client.from('leads')
      .select('*, contacts(name,email,phone), products(name,category,subcategory,base_price)')
      .order('created_at', { ascending: false });
    if (!isAdmin) leadsQ = leadsQ.or(`owner_id.eq.${uid},assigned_to.eq.${uid},created_by.eq.${uid}`);

    let oppsQ = db.client.from('opportunities')
      .select('*, contacts(name,email), products(name,category,base_price), profiles!opportunities_assigned_to_fkey(name)')
      .order('created_at', { ascending: false });
    if (!isAdmin) oppsQ = oppsQ.or(`owner_id.eq.${uid},assigned_to.eq.${uid}`);

    const [{ data: leads }, { data: opps }] = await Promise.all([leadsQ, oppsQ]);
    this._leads = leads || [];
    this._opps  = opps  || [];

    // Update counts
    const lc = document.getElementById('leads-count');
    const oc = document.getElementById('opps-count');
    if (lc) lc.textContent = `(${this._leads.length})`;
    if (oc) oc.textContent = `(${this._opps.length})`;
  },

  _switchTab(tab) {
    this._tab    = tab;
    this._filter = 'all';
    this._renderFilters();
    this._renderList();
    // Aktualizuj tab tlačidlá
    document.querySelectorAll('.filter-tab').forEach((b,i) => {
      if (i === 0) b.classList.toggle('active', tab === 'leads');
      if (i === 1) b.classList.toggle('active', tab === 'opps');
    });
  },

  _renderFilters() {
    const el = document.getElementById('pipeline-filters');
    if (!el) return;
    const statuses = this._tab === 'leads' ? LEAD_STATUSES : OPP_STATUSES;
    el.innerHTML = `
      <button class="filter-tab${this._filter==='all'?' active':''}"
        onclick="pipelineView._setFilter('all')">Všetky</button>
      ${Object.entries(statuses).map(([k,v]) => `
        <button class="filter-tab${this._filter===k?' active':''}"
          style="${this._filter===k?`border-color:${v.color};color:${v.color};`:''}"
          onclick="pipelineView._setFilter('${k}')">
          ${v.label}
        </button>`).join('')}`;
  },

  _setFilter(f) {
    this._filter = f;
    this._renderFilters();
    this._renderList();
  },

  _renderList() {
    const el = document.getElementById('pipeline-list');
    if (!el) return;

    if (this._tab === 'leads') {
      const items = this._filter === 'all'
        ? this._leads
        : this._leads.filter(l => l.status === this._filter);
      el.innerHTML = items.length === 0
        ? this._emptyState('lead')
        : items.map(l => this._leadCard(l)).join('');
    } else {
      const items = this._filter === 'all'
        ? this._opps
        : this._opps.filter(o => o.status === this._filter);
      el.innerHTML = items.length === 0
        ? this._emptyState('opp')
        : items.map(o => this._oppCard(o)).join('');
    }
  },

  _emptyState(type) {
    const msg = type === 'lead' ? 'Žiadne leady' : 'Žiadne príležitosti';
    return `
      <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
        <div style="font-size:28px;margin-bottom:8px;">${type==='lead'?'📋':'🎯'}</div>
        <div>${msg}</div>
        <div style="margin-top:12px;">
          <button class="btn-primary" onclick="pipelineView._openAdd()">+ Pridať</button>
        </div>
      </div>`;
  },

  _statusBadge(status, type) {
    const cfg = (type==='lead' ? LEAD_STATUSES : OPP_STATUSES)[status] || { label: status, color:'var(--muted)' };
    return `<span class="badge" style="background:${cfg.color}18;color:${cfg.color};border:1px solid ${cfg.color}44;font-size:10px;">${cfg.label}</span>`;
  },

  _slaIndicator(lead) {
    if (!lead.sla_due_at) return '';
    if (lead.sla_breached) return `<span style="font-size:10px;color:var(--red);">⚠ SLA porušené</span>`;
    const due  = new Date(lead.sla_due_at);
    const diff = Math.round((due - new Date()) / 3600000);
    if (diff < 0) return `<span style="font-size:10px;color:var(--red);">⚠ SLA po termíne</span>`;
    if (diff < 4) return `<span style="font-size:10px;color:var(--acc);">⏱ SLA: ${diff}h</span>`;
    return '';
  },

  _leadCard(l) {
    const hasKey = !!localStorage.getItem('axiona_ai_key');
    const needsApproval = l.requires_approval && !l.approved_at && l.status === 'new';
    return `
      <div class="card" style="cursor:pointer;margin-bottom:8px;${needsApproval?'border-color:rgba(212,148,58,0.4);':''}"
        onclick="pipelineView._openEditLead('${l.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              ${this._statusBadge(l.status, 'lead')}
              ${needsApproval ? `<span class="badge" style="background:rgba(212,148,58,0.12);color:var(--acc);border:1px solid var(--acc-brd);font-size:10px;">⏳ Čaká na schválenie</span>` : ''}
              ${this._slaIndicator(l)}
            </div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${esc(l.title||l.contacts?.name||'—')}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
              ${l.contacts ? `<span>👤 ${esc(l.contacts.name)}</span>` : ''}
              ${l.products ? `<span>🛍️ ${esc(l.products.name)}</span>` : ''}
              ${l.source   ? `<span>🔗 ${esc(l.source)}</span>` : ''}
              ${l.value_estimate ? `<span class="mono" style="color:var(--green);">💰 ${EUR(l.value_estimate)}</span>` : ''}
            </div>
            ${l.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px;">${esc(l.notes)}</div>` : ''}
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
            ${hasKey ? `<button class="icon-btn" title="AI analýza" onclick="event.stopPropagation();aiLead.openPanelLead('${l.id}')">✦</button>` : ''}
            ${l.status === 'qualified' ? `
              <button class="btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--green);"
                onclick="event.stopPropagation();pipelineView._convertToOpp('${l.id}')">
                → Príležitosť
              </button>` : ''}
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
              ${this._statusBadge(o.status, 'opp')}
              ${o.probability != null ? `<span style="font-size:11px;color:var(--muted);">${o.probability}% pravd.</span>` : ''}
              ${o.expected_close ? `<span style="font-size:11px;color:var(--muted);">📅 ${FMT(o.expected_close)}</span>` : ''}
            </div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${esc(o.title||'—')}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
              ${o.contacts  ? `<span>👤 ${esc(o.contacts.name)}</span>` : ''}
              ${o.products  ? `<span>🛍️ ${esc(o.products.name)}</span>` : ''}
              ${o.profiles  ? `<span>🤝 ${esc(o.profiles.name)}</span>` : ''}
            </div>
            ${o.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px;">${esc(o.notes)}</div>` : ''}
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
            ${hasKey ? `<button class="icon-btn" title="AI analýza" onclick="event.stopPropagation();aiLead.openPanelOpp('${o.id}')">✦</button>` : ''}
            <div style="text-align:right;">
              <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${EUR(o.value)}</div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveOppStatus('${o.id}',-1)">◀</button>
            <button class="icon-btn" onclick="event.stopPropagation();pipelineView._moveOppStatus('${o.id}',1)">▶</button>
          </div>
        </div>
      </div>`;
  },

  // ── Pohyb stavov ──────────────────────────────────────────────────────────
  async _moveLeadStatus(id, dir) {
    const keys = Object.keys(LEAD_STATUSES);
    const lead = this._leads.find(l => l.id === id);
    if (!lead) return;
    const idx  = keys.indexOf(lead.status);
    const nIdx = Math.max(0, Math.min(keys.length-1, idx+dir));
    if (nIdx === idx) return;
    await this._updateLeadStatus(id, keys[nIdx]);
  },

  async _updateLeadStatus(id, status) {
    const { error } = await db.client.from('leads').update({ status }).eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    const lead = this._leads.find(l => l.id === id);
    if (lead) lead.status = status;
    this._renderList();
  },

  async _moveOppStatus(id, dir) {
    const keys = Object.keys(OPP_STATUSES);
    const opp  = this._opps.find(o => o.id === id);
    if (!opp) return;
    const idx  = keys.indexOf(opp.status);
    const nIdx = Math.max(0, Math.min(keys.length-1, idx+dir));
    if (nIdx === idx) return;
    if (keys[nIdx] === 'won') {
      if (!confirm('Označiť príležitosť ako WON? Automaticky sa vytvorí objednávka.')) return;
    }
    const { error } = await db.client.from('opportunities').update({ status: keys[nIdx] }).eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    const opp2 = this._opps.find(o => o.id === id);
    if (opp2) opp2.status = keys[nIdx];
    this._renderList();
  },

  // ── Konverzia lead → opportunity ──────────────────────────────────────────
  async _convertToOpp(leadId) {
    const lead    = this._leads.find(l => l.id === leadId);
    const obchs   = app.state.contacts?.filter(c => {
      const p = app.state.profiles?.find(x => x.id === c.userId);
      return p?.role === 'obchodnik';
    }) || [];

    const assignOpts = (await db.client.from('profiles').select('id,name,email').eq('role','obchodnik')).data || [];

    modal.open('Vytvoriť príležitosť', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Z leadu: <strong>${esc(lead?.title||lead?.contacts?.name||'—')}</strong>
      </div>
      <div class="form-row"><label class="form-label">Názov príležitosti *</label>
        <input id="co-title" value="${esc(lead?.title||lead?.contacts?.name||'')}" /></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€)</label>
          <input id="co-value" type="number" value="${lead?.value_estimate||''}" /></div>
        <div class="form-row"><label class="form-label">Pravdepodobnosť (%)</label>
          <input id="co-prob" type="number" min="0" max="100" value="50" /></div>
      </div>
      <div class="form-row"><label class="form-label">Uzatvorenie</label>
        <input id="co-close" type="date" /></div>
      <div class="form-row"><label class="form-label">Priradiť obchodníkovi</label>
        <select id="co-assign">
          <option value="">— admin spracuje —</option>
          ${assignOpts.map(u => `<option value="${u.id}">${esc(u.name||u.email)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="co-notes" style="min-height:55px;">${esc(lead?.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="pipelineView._submitConvert('${leadId}')">Vytvoriť príležitosť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _submitConvert(leadId) {
    const lead  = this._leads.find(l => l.id === leadId);
    const title = document.getElementById('co-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }

    const btn = document.querySelector('#modal-body .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Vytváram...'; }

    const uid        = app._currentUserId();
    const assignedTo = document.getElementById('co-assign')?.value || null;

    const obj = {
      lead_id:        leadId,
      contact_id:     lead?.contact_id || null,
      product_id:     lead?.product_id || null,
      created_by:     uid,
      owner_id:       uid,
      assigned_to:    assignedTo,
      title,
      value:          Number(document.getElementById('co-value')?.value) || 0,
      probability:    Number(document.getElementById('co-prob')?.value)  || 50,
      expected_close: document.getElementById('co-close')?.value || null,
      notes:          document.getElementById('co-notes')?.value || null,
      status:         'open',
    };

    console.log('Inserting opportunity:', obj);

    try {
      const { data, error } = await db.client
        .from('opportunities')
        .insert(obj)
        .select()
        .single();

      if (error) {
        console.error('Opportunity insert error:', error);
        throw new Error(error.message + (error.details ? ' — ' + error.details : ''));
      }

      console.log('Opportunity created:', data);

      // Aktualizuj lead status
      await db.client.from('leads')
        .update({ status: 'qualified' })
        .eq('id', leadId);

      const l = this._leads.find(x => x.id === leadId);
      if (l) l.status = 'qualified';

      modal.close();
      await this._load();
      this._switchTab('opps');
    } catch(e) {
      console.error('Convert error:', e);
      alert('Chyba pri vytváraní príležitosti:\n' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Vytvoriť príležitosť'; }
    }
  },

  // ── Formuláre ─────────────────────────────────────────────────────────────
  _openAdd() {
    if (this._tab === 'leads') this._openAddLead();
    else                       this._openAddOpp();
  },

  _openAddLead() {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}">${esc(c.name)}${c.entityType?` — ${c.entityType}`:''}</option>`
    ).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.is_active||p.active).map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`
    ).join('');

    modal.open('Nový lead', `
      <div class="form-row"><label class="form-label">Názov / Téma *</label>
        <input id="lf-title" placeholder="napr. Záujem o chatbota" /></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="lf-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="lf-product" onchange="pipelineView._onLeadProduct(this.value)">
          <option value="">— vybrať —</option>${pOpts}
        </select></div>
      <div id="lf-product-info" style="display:none;margin-bottom:10px;"></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Odhadovaná hodnota (€)</label>
          <input id="lf-value" type="number" value="" /></div>
        <div class="form-row"><label class="form-label">Zdroj</label>
          <select id="lf-source">
            <option value="web">Web</option>
            <option value="referral">Referral</option>
            <option value="manual">Manuálne</option>
            <option value="member">Člen</option>
            <option value="phone">Telefón</option>
            <option value="email">Email</option>
          </select>
        </div>
      </div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="lf-desc" style="min-height:55px;resize:vertical;"></textarea></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="lf-notes" style="min-height:55px;resize:vertical;"></textarea></div>
      <div style="padding:10px 12px;background:rgba(212,148,58,0.08);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--acc);margin-bottom:12px;">
        ℹ️ Lead bude odoslaný na schválenie adminovi.
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="lf-submit" onclick="pipelineView._saveLead()">Odoslať lead</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  _onLeadProduct(productId) {
    if (!productId) return;
    const p = (app.state.products||[]).find(x => x.id === productId);
    if (!p) return;
    const valEl = document.getElementById('lf-value');
    if (valEl && !valEl.value) valEl.value = p.base_price || p.price || '';
    const descEl = document.getElementById('lf-desc');
    if (descEl && !descEl.value && p.description) descEl.value = p.description;
    const infoEl = document.getElementById('lf-product-info');
    if (infoEl) {
      infoEl.style.display = '';
      infoEl.innerHTML = `<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 12px;font-size:12px;">
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
    if (!title) { alert('Zadaj názov leadu.'); return; }
    const btn = document.getElementById('lf-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Ukladám...'; }
    const uid = app._currentUserId();
    try {
      const { data, error } = await db.client.from('leads').insert({
        title,
        contact_id:    document.getElementById('lf-contact')?.value || null,
        product_id:    document.getElementById('lf-product')?.value || null,
        value_estimate: Number(document.getElementById('lf-value')?.value) || 0,
        source:        document.getElementById('lf-source')?.value || 'manual',
        description:   document.getElementById('lf-desc')?.value   || null,
        notes:         document.getElementById('lf-notes')?.value  || null,
        created_by:    uid,
        owner_id:      uid,
        status:        'new',
        requires_approval: true,
      }).select().single();
      if (error) throw error;
      this._leads.unshift(data);
      modal.close();
      this._renderList();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Odoslať lead'; }
    }
  },

  _openAddOpp() {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.is_active||p.active).map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Nová príležitosť', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="of-title" placeholder="napr. Chatbot pre ABC s.r.o." /></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="of-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="of-product" onchange="pipelineView._onOppProduct(this.value)">
          <option value="">— vybrať —</option>${pOpts}
        </select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€) *</label>
          <input id="of-value" type="number" /></div>
        <div class="form-row"><label class="form-label">Pravdepodobnosť (%)</label>
          <input id="of-prob" type="number" min="0" max="100" value="50" /></div>
      </div>
      <div class="form-row"><label class="form-label">Plánované uzatvorenie</label>
        <input id="of-close" type="date" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="of-status">
          ${Object.entries(OPP_STATUSES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="of-notes" style="min-height:55px;resize:vertical;"></textarea></div>
      <div class="form-actions">
        <button class="btn-primary" id="of-submit" onclick="pipelineView._saveOpp('')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  _onOppProduct(productId) {
    const p = (app.state.products||[]).find(x => x.id === productId);
    if (!p) return;
    const v = document.getElementById('of-value');
    if (v && !v.value) v.value = p.base_price || p.price || '';
  },

  async _saveOpp(id) {
    const isNew = !id;
    const title = document.getElementById('of-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }
    const btn = document.getElementById('of-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Ukladám...'; }
    const uid = app._currentUserId();
    const obj = {
      title,
      contact_id:    document.getElementById('of-contact')?.value || null,
      product_id:    document.getElementById('of-product')?.value || null,
      value:         Number(document.getElementById('of-value')?.value) || 0,
      probability:   Number(document.getElementById('of-prob')?.value)  || 50,
      expected_close: document.getElementById('of-close')?.value || null,
      status:        document.getElementById('of-status')?.value || 'open',
      notes:         document.getElementById('of-notes')?.value  || null,
    };
    try {
      if (isNew) {
        obj.created_by = uid; obj.owner_id = uid;
        const { data, error } = await db.client.from('opportunities').insert(obj).select().single();
        if (error) throw error;
        this._opps.unshift(data);
      } else {
        const { data, error } = await db.client.from('opportunities').update(obj).eq('id', id).select().single();
        if (error) throw error;
        this._opps = this._opps.map(o => o.id === id ? {...o, ...data} : o);
      }
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
    const pOpts = (app.state.products||[]).filter(p=>p.is_active||p.active).map(p =>
      `<option value="${p.id}"${l.product_id===p.id?' selected':''}>${esc(p.name)} — ${EUR(p.base_price||p.price||0)}</option>`).join('');

    modal.open('Upraviť lead', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="lf-title" value="${esc(l.title||'')}" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="lf-status">
          ${Object.entries(LEAD_STATUSES).map(([k,v])=>`<option value="${k}"${l.status===k?' selected':''}>${v.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="lf-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="lf-product"><option value="">— vybrať —</option>${pOpts}</select></div>
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
        <button class="btn-primary" id="lf-submit" onclick="pipelineView._updateLead('${id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${l.status === 'qualified' ? `
          <button class="btn-ghost" style="color:var(--green);margin-left:auto;"
            onclick="modal.close();pipelineView._convertToOpp('${id}')">
            → Vytvoriť príležitosť
          </button>` : ''}
        <button class="btn-danger" style="${l.status==='qualified'?'':'margin-left:auto;'}"
          onclick="pipelineView._deleteLead('${id}')">Vymazať</button>
      </div>`);
  },

  async _updateLead(id) {
    const btn = document.getElementById('lf-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
      const obj = {
        title:          document.getElementById('lf-title')?.value.trim(),
        status:         document.getElementById('lf-status')?.value,
        contact_id:     document.getElementById('lf-contact')?.value || null,
        product_id:     document.getElementById('lf-product')?.value || null,
        value_estimate: Number(document.getElementById('lf-value')?.value)  || 0,
        source:         document.getElementById('lf-source')?.value || null,
        notes:          document.getElementById('lf-notes')?.value  || null,
      };
      const { error } = await db.client.from('leads').update(obj).eq('id', id);
      if (error) throw error;
      this._leads = this._leads.map(l => l.id === id ? {...l, ...obj} : l);
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
    const pOpts = (app.state.products||[]).filter(p=>p.is_active||p.active).map(p =>
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
      <div class="form-row"><label class="form-label">Plánované uzatvorenie</label>
        <input id="of-close" type="date" value="${o.expected_close||''}" /></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="of-notes" style="min-height:65px;resize:vertical;">${esc(o.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" id="of-submit" onclick="pipelineView._saveOpp('${id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        <button class="btn-danger" style="margin-left:auto;" onclick="pipelineView._deleteOpp('${id}')">Vymazať</button>
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
