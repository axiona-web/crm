// ── views/products.js ────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = {
  'AI & Automatizácia': ['Chatboty', 'Automatizácie', 'AI nástroje'],
  'Web & Digitálne':    ['Web Basic', 'Web Pro', 'Landing page', 'Správa webu'],
  'Reality':            ['Predaj nehnuteľnosti', 'Nábor nehnuteľnosti', 'Obhliadky'],
  'Financie':           ['Hypotéky', 'Poistenie', 'Investície'],
};

const PRODUCT_TYPES = {
  internal:    { label: 'Interný',  icon: '🏢' },
  financial:   { label: 'Finančný', icon: '💳' },
  real_estate: { label: 'Reality',  icon: '🏠' },
  partner:     { label: 'Partner',  icon: '🤝' },
};

const FULFILLMENT_OPTIONS = {
  admin:           'Admin',
  obchodnik:       'Obchodník',
  admin_obchodnik: 'Admin + Obchodník',
  partner:         'Partner',
};

const REWARD_TRIGGERS = {
  payment_received: { label: 'Po prijatí platby',  icon: '💳' },
  admin_verified:   { label: 'Po overení adminom', icon: '✓'  },
  revenue_received: { label: 'Po prijatí výnosu',  icon: '💰' },
};

const WORKFLOW_TYPES = {
  ai_web:      '⚡ Rýchly produkt',
  projektovy:  '🏗️ Projektový produkt',
  financial:   '💳 Financie',
  real_estate: '🏠 Reality',
  partner:     '🤝 Partner',
};

const productsView = {
  _products:  [],
  _loaded:    false,
  _catFilter: 'all',

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const filterBtns = [
      { id: 'all', label: 'Všetky' },
      ...Object.keys(PRODUCT_CATEGORIES).map(cat => ({ id: cat, label: cat })),
    ].map(f => `
      <button class="filter-tab${this._catFilter === f.id ? ' active' : ''}"
        onclick="productsView._setFilter('${esc(f.id)}')">
        ${esc(f.label)}
      </button>`).join('');

    return `
      <div class="view-head">
        <h2>Produkty</h2>
        <button class="btn-primary" onclick="productsView.openAdd()">+ Nový produkt</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;" id="product-filters">
        ${filterBtns}
      </div>
      <div id="products-list">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) await this._load();
    this._renderList();
  },

  async _load() {
    const { data } = await db.client.from('products').select('*').order('sort_order').order('name');
    this._products     = data || [];
    this._loaded       = true;
    app.state.products = this._products;
  },

  _setFilter(cat) {
    this._catFilter = cat;
    // Aktualizuj len tlačidlá
    document.querySelectorAll('#product-filters .filter-tab').forEach(btn => {
      const id = btn.onclick?.toString().match(/'([^']+)'/)?.[1];
      btn.classList.toggle('active', id === cat);
    });
    this._renderList();
  },

  _renderList() {
    const el = document.getElementById('products-list');
    if (!el) return;

    const filtered = this._catFilter === 'all'
      ? this._products
      : this._products.filter(p => p.category === this._catFilter);

    if (filtered.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
          <div style="font-size:28px;margin-bottom:8px;">🛍️</div>
          <div>Žiadne produkty</div>
          <div style="margin-top:12px;">
            <button class="btn-primary" onclick="productsView.openAdd()">+ Pridať produkt</button>
          </div>
        </div>`;
      return;
    }

    // Zoskup: kategória → podkategória
    const grouped = {};
    filtered.forEach(p => {
      const cat    = p.category    || 'Bez kategórie';
      const subcat = p.subcategory || 'Ostatné';
      if (!grouped[cat])         grouped[cat] = {};
      if (!grouped[cat][subcat]) grouped[cat][subcat] = [];
      grouped[cat][subcat].push(p);
    });

    el.innerHTML = Object.entries(grouped).map(([cat, subcats]) => `
      <div style="margin-bottom:22px;">
        <div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:12px;
          padding-bottom:6px;border-bottom:1px solid var(--brd);">${esc(cat)}</div>
        ${Object.entries(subcats).map(([subcat, items]) => `
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
              letter-spacing:0.08em;margin-bottom:8px;">${esc(subcat)}</div>
            <div class="list">
              ${items.map(p => {
                const pt = PRODUCT_TYPES[p.product_type]     || PRODUCT_TYPES.internal;
                const rt = REWARD_TRIGGERS[p.reward_trigger] || REWARD_TRIGGERS.payment_received;
                return `
                  <div class="card" style="cursor:pointer;" onclick="productsView.openEdit('${p.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                      <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                          <span style="font-size:15px;">${pt.icon}</span>
                          <span style="font-weight:700;font-size:14px;">${esc(p.name)}</span>
                          ${p.product_code ? `<span class="mono" style="font-size:11px;color:var(--muted);">${esc(p.product_code)}</span>` : ''}
                          ${!p.is_active && p.is_active !== null ? `<span class="badge" style="background:rgba(242,85,85,0.1);color:var(--red);border:1px solid rgba(242,85,85,0.25);font-size:10px;">Neaktívny</span>` : ''}
                          ${p.direct_purchase_allowed ? `<span class="badge" style="background:rgba(91,164,245,0.1);color:var(--blue);border:1px solid rgba(91,164,245,0.25);font-size:10px;">Priamy nákup</span>` : ''}
                        </div>
                        ${p.description ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${esc(p.description)}</div>` : ''}
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">${pt.icon} ${pt.label}</span>
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">${esc(WORKFLOW_TYPES[p.workflow_type] || p.workflow_type || '—')}</span>
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">👷 ${esc(FULFILLMENT_OPTIONS[p.fulfillment_by || p.fulfillment] || p.fulfillment || '—')}</span>
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">${rt.icon} ${rt.label}</span>
                          ${p.points_enabled     ? `<span class="badge" style="background:rgba(212,148,58,0.1);color:var(--acc);border:1px solid var(--acc-brd);font-size:10px;">⭐ Body</span>` : ''}
                          ${p.commission_enabled ? `<span class="badge" style="background:rgba(62,207,142,0.1);color:var(--green);border:1px solid rgba(62,207,142,0.25);font-size:10px;">💰 Provízia</span>` : ''}
                        </div>
                      </div>
                      <div style="text-align:right;flex-shrink:0;">
                        <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${EUR(p.base_price || p.price || 0)}</div>
                        <div style="font-size:11px;color:var(--muted);">${esc(p.currency||'EUR')}</div>
                        ${(p.margin||0) > 0 ? `<div style="font-size:11px;color:var(--muted);">Marža: ${EUR(p.margin)}</div>` : ''}
                      </div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>`).join('');
  },

  // ── Formulár ──────────────────────────────────────────────────────────────
  _form(p, isNew) {
    const selCat     = p.category || '';
    const subcatOpts = selCat && PRODUCT_CATEGORIES[selCat]
      ? PRODUCT_CATEGORIES[selCat].map(s =>
          `<option${p.subcategory===s?' selected':''}>${esc(s)}</option>`).join('')
      : '';

    const chk = (val, def=true) => (val === undefined || val === null) ? def : val;

    return `
      <!-- 1. Základná identifikácia -->
      <div style="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">① Identifikácia</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Názov *</label>
          <input id="pf-name" value="${esc(p.name||'')}" placeholder="napr. Chatbot Basic" /></div>
        <div class="form-row"><label class="form-label">Interný kód</label>
          <input id="pf-code" value="${esc(p.product_code||'')}" placeholder="napr. AI-CB-001" /></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Kategória *</label>
          <select id="pf-category" onchange="productsView._onCatChange(this.value)">
            <option value="">— vybrať —</option>
            ${Object.keys(PRODUCT_CATEGORIES).map(cat =>
              `<option${p.category===cat?' selected':''}>${esc(cat)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">Podkategória</label>
          <select id="pf-subcategory">
            <option value="">— vybrať —</option>
            ${subcatOpts}
          </select>
        </div>
      </div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="pf-desc" style="min-height:50px;resize:vertical;">${esc(p.description||'')}</textarea></div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- 2. Obchodná logika -->
      <div style="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">② Obchodná logika</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Typ produktu</label>
          <select id="pf-type">
            ${Object.entries(PRODUCT_TYPES).map(([k,v]) =>
              `<option value="${k}"${(p.product_type||'internal')===k?' selected':''}>${v.icon} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">Workflow</label>
          <select id="pf-workflow">
            ${Object.entries(WORKFLOW_TYPES).map(([k,v]) =>
              `<option value="${k}"${(p.workflow_type||'ai_web')===k?' selected':''}>${v}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row"><label class="form-label">Realizuje</label>
        <select id="pf-fulfillment">
          ${Object.entries(FULFILLMENT_OPTIONS).map(([k,v]) =>
            `<option value="${k}"${(p.fulfillment_by||p.fulfillment||'admin')===k?' selected':''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-active" ${chk(p.is_active??p.active)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--acc);" />
          <span>Aktívny produkt</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-direct" ${chk(p.direct_purchase_allowed,false)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--blue);" />
          <span>Priamy nákup členom</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-admin-approval" ${chk(p.requires_admin_approval,false)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--purple);" />
          <span>Vyžaduje schválenie adminom</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-docs" ${chk(p.requires_documents,false)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--muted);" />
          <span>Vyžaduje dokumenty</span>
        </label>
      </div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- 3. Finančné polia -->
      <div style="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">③ Financie</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Predajná cena (€) *</label>
          <input id="pf-price" type="number" step="0.01" value="${p.base_price||p.price||''}"
            oninput="productsView._calcMargin()" /></div>
        <div class="form-row"><label class="form-label">Náklad (€)</label>
          <input id="pf-cost" type="number" step="0.01" value="${p.cost_price||''}"
            oninput="productsView._calcMargin()" /></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Marža (€)</label>
          <input id="pf-margin" type="number" step="0.01" value="${p.margin||''}" readonly
            style="background:var(--surf);color:var(--green);" /></div>
        <div class="form-row"><label class="form-label">Partner share (€)</label>
          <input id="pf-partner-share" type="number" step="0.01" value="${p.partner_share||''}" /></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Zľava pre člena</label>
          <select id="pf-discount-type" onchange="productsView._toggleDiscount(this.value)">
            <option value="none"${(p.member_discount_type||'none')==='none'?' selected':''}>Žiadna</option>
            <option value="percent"${p.member_discount_type==='percent'?' selected':''}>Percentuálna (%)</option>
            <option value="fixed"${p.member_discount_type==='fixed'?' selected':''}>Pevná suma (€)</option>
          </select>
        </div>
        <div class="form-row"><label class="form-label">Hodnota zľavy</label>
          <input id="pf-discount-val" type="number" step="0.01" value="${p.member_discount_value||''}"
            ${(p.member_discount_type||'none')==='none'?'disabled style="opacity:0.4;"':''} /></div>
      </div>
      <div class="form-row"><label class="form-label">DPH režim</label>
        <select id="pf-vat">
          <option value="standard"${(p.vat_mode||'standard')==='standard'?' selected':''}>Štandardná DPH</option>
          <option value="reduced"${p.vat_mode==='reduced'?' selected':''}>Znížená DPH</option>
          <option value="exempt"${p.vat_mode==='exempt'?' selected':''}>Oslobodené</option>
          <option value="none"${p.vat_mode==='none'?' selected':''}>Bez DPH</option>
        </select>
      </div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- 4. Odmeny -->
      <div style="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">④ Odmeny</div>
      <div class="form-row"><label class="form-label">Trigger odmeny</label>
        <select id="pf-trigger">
          ${Object.entries(REWARD_TRIGGERS).map(([k,v]) =>
            `<option value="${k}"${(p.reward_trigger||'payment_received')===k?' selected':''}>${v.icon} ${v.label}</option>`
          ).join('')}
        </select>
      </div>
      <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-points" ${chk(p.points_enabled)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--acc);" />
          <span>⭐ Body pre člena</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-ref-points" ${chk(p.referrer_points_enabled)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--acc);" />
          <span>⭐ Body pre referrera</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-commission" ${chk(p.commission_enabled)?'checked':''}
            style="width:16px;height:16px;accent-color:var(--green);" />
          <span>💰 Provízia pre obchodníka</span>
        </label>
      </div>
      <div style="margin-top:10px;padding:10px 12px;background:rgba(212,148,58,0.06);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--muted);">
        ℹ️ Presné výpočty bodov a provízií budú definované v kompenzačnom pláne.
      </div>

      <div id="pf-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;margin-top:12px;"></div>
      <div class="form-actions" style="margin-top:14px;">
        <button class="btn-primary" id="pf-submit" onclick="productsView.save('${p.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="productsView.delete('${p.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  _onCatChange(cat) {
    const sel  = document.getElementById('pf-subcategory');
    const opts = PRODUCT_CATEGORIES[cat] || [];
    sel.innerHTML = `<option value="">— vybrať —</option>` +
      opts.map(s => `<option>${esc(s)}</option>`).join('');
  },

  _calcMargin() {
    const price = Number(document.getElementById('pf-price')?.value) || 0;
    const cost  = Number(document.getElementById('pf-cost')?.value)  || 0;
    const el    = document.getElementById('pf-margin');
    if (el) el.value = (price - cost).toFixed(2);
  },

  _toggleDiscount(type) {
    const el = document.getElementById('pf-discount-val');
    if (!el) return;
    el.disabled = type === 'none';
    el.style.opacity = type === 'none' ? '0.4' : '1';
  },

  openAdd() {
    modal.open('Nový produkt', this._form({}, true));
  },

  openEdit(id) {
    const p = this._products.find(x => x.id === id);
    if (p) modal.open('Upraviť produkt', this._form(p, false));
  },

  _val(id)  { const el = document.getElementById(id); return el ? el.value.trim() : ''; },
  _chk(id)  { const el = document.getElementById(id); return el ? el.checked : false; },
  _num(id)  { const v = this._val(id); return v ? Number(v) : null; },

  async save(id, isNew) {
    const name     = this._val('pf-name');
    const price    = this._val('pf-price');
    const category = this._val('pf-category');
    const errEl    = document.getElementById('pf-error');
    errEl.style.display = 'none';

    if (!name)     { errEl.textContent = 'Zadaj názov produktu.'; errEl.style.display = 'block'; return; }
    if (!price)    { errEl.textContent = 'Zadaj predajnú cenu.';  errEl.style.display = 'block'; return; }
    if (!category) { errEl.textContent = 'Vyber kategóriu.';      errEl.style.display = 'block'; return; }

    const btn = document.getElementById('pf-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      name,
      product_code:              this._val('pf-code')          || null,
      description:               this._val('pf-desc')          || null,
      category,
      subcategory:               this._val('pf-subcategory')   || null,
      product_type:              this._val('pf-type')          || 'internal',
      workflow_type:             this._val('pf-workflow')      || 'ai_web',
      fulfillment:               this._val('pf-fulfillment')   || 'admin',
      is_active:                 this._chk('pf-active'),
      active:                    this._chk('pf-active'),
      direct_purchase_allowed:   this._chk('pf-direct'),
      requires_admin_approval:   this._chk('pf-admin-approval'),
      requires_documents:        this._chk('pf-docs'),
      base_price:                Number(price) || 0,
      price:                     Number(price) || 0,
      cost_price:                this._num('pf-cost'),
      margin:                    this._num('pf-margin'),
      partner_share:             this._num('pf-partner-share'),
      member_discount_type:      this._val('pf-discount-type') || 'none',
      member_discount_value:     this._num('pf-discount-val'),
      vat_mode:                  this._val('pf-vat')           || 'standard',
      reward_trigger:            this._val('pf-trigger')       || 'payment_received',
      points_enabled:            this._chk('pf-points'),
      referrer_points_enabled:   this._chk('pf-ref-points'),
      commission_enabled:        this._chk('pf-commission'),
      currency:                  'EUR',
    };

    try {
      if (isNew) {
        const { data, error } = await db.client.from('products').insert(obj).select().single();
        if (error) throw error;
        this._products.unshift(data);
      } else {
        const { data, error } = await db.client.from('products').update(obj).eq('id', id).select().single();
        if (error) throw error;
        this._products = this._products.map(p => p.id === id ? data : p);
      }
      app.state.products = this._products;
      modal.close();
      this._renderList();
    } catch(e) {
      errEl.textContent = 'Chyba: ' + (e.message || 'skús znova');
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať produkt?')) return;
    try {
      const { error } = await db.client.from('products').delete().eq('id', id);
      if (error) throw error;
      this._products     = this._products.filter(p => p.id !== id);
      app.state.products = this._products;
      modal.close();
      this._renderList();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
