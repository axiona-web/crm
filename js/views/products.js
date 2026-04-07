// ── views/products.js ────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = {
  'AI & Automatizácia': ['Chatboty', 'Automatizácie', 'AI nástroje'],
  'Web & Digitálne':    ['Web Basic', 'Web Pro', 'Landing page', 'Správa webu'],
  'Reality':            ['Predaj nehnuteľnosti', 'Nábor nehnuteľnosti', 'Obhliadky'],
  'Financie':           ['Hypotéky', 'Poistenie', 'Investície'],
};

const PRODUCT_TYPES = {
  internal:     { label: 'Interný',     icon: '🏢', desc: 'AI, web, vlastné služby' },
  financial:    { label: 'Finančný',    icon: '💳', desc: 'Hypotéky, poistenie, investície' },
  real_estate:  { label: 'Reality',     icon: '🏠', desc: 'Predaj, nábor, obhliadky' },
  partner:      { label: 'Partner',     icon: '🤝', desc: 'Externé partnerské služby' },
};

const FULFILLMENT_OPTIONS = {
  admin:          'Admin',
  obchodnik:      'Obchodník',
  admin_obchodnik:'Admin + Obchodník',
  partner:        'Partner',
};

const REWARD_TRIGGERS = {
  payment_received:  { label: 'Po prijatí platby',     icon: '💳' },
  admin_verified:    { label: 'Po overení adminom',    icon: '✓'  },
  revenue_received:  { label: 'Po prijatí výnosu',     icon: '💰' },
};

const productsView = {
  _products:   [],
  _loaded:     false,
  _catFilter:  'all',

  render() {
    return `
      <div class="view-head">
        <h2>Produkty</h2>
        <button class="btn-primary" onclick="productsView.openAdd()">+ Nový produkt</button>
      </div>

      <!-- Filter kategórií -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="filter-tab${this._catFilter==='all'?' active':''}"
          onclick="productsView._catFilter='all'; productsView._renderList();">Všetky</button>
        ${Object.keys(PRODUCT_CATEGORIES).map(cat => `
          <button class="filter-tab${this._catFilter===cat?' active':''}"
            onclick="productsView._catFilter='${esc(cat)}'; productsView._renderList();">
            ${esc(cat)}
          </button>`).join('')}
      </div>

      <div id="products-list">
        <div style="color:var(--muted);font-size:13px;">Načítavam...</div>
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
          <div>Žiadne produkty v tejto kategórii</div>
          <div style="margin-top:12px;">
            <button class="btn-primary" onclick="productsView.openAdd()">+ Pridať produkt</button>
          </div>
        </div>`;
      return;
    }

    // Zoskup podľa kategória → podkategória
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
          padding-bottom:6px;border-bottom:1px solid var(--brd);">
          ${esc(cat)}
        </div>
        ${Object.entries(subcats).map(([subcat, items]) => `
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
              letter-spacing:0.08em;margin-bottom:8px;padding-left:2px;">
              ${esc(subcat)}
            </div>
            <div class="list">
              ${items.map(p => {
                const pt = PRODUCT_TYPES[p.product_type] || PRODUCT_TYPES.internal;
                const rt = REWARD_TRIGGERS[p.reward_trigger] || REWARD_TRIGGERS.payment_received;
                return `
                  <div class="card" style="cursor:pointer;" onclick="productsView.openEdit('${p.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                      <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                          <span style="font-size:15px;">${pt.icon}</span>
                          <span style="font-weight:700;font-size:14px;">${esc(p.name)}</span>
                          ${!p.active ? `<span class="badge" style="background:rgba(242,85,85,0.1);color:var(--red);border:1px solid rgba(242,85,85,0.25);font-size:10px;">Neaktívny</span>` : ''}
                        </div>
                        ${p.description ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${esc(p.description)}</div>` : ''}
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">
                            ${pt.icon} ${pt.label}
                          </span>
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">
                            ${esc(FULFILLMENT_OPTIONS[p.fulfillment] || p.fulfillment)}
                          </span>
                          <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">
                            ${rt.icon} ${rt.label}
                          </span>
                          ${p.points_enabled     ? `<span class="badge" style="background:rgba(212,148,58,0.1);color:var(--acc);border:1px solid var(--acc-brd);font-size:10px;">⭐ Body</span>` : ''}
                          ${p.commission_enabled ? `<span class="badge" style="background:rgba(62,207,142,0.1);color:var(--green);border:1px solid rgba(62,207,142,0.25);font-size:10px;">💰 Provízia</span>` : ''}
                        </div>
                      </div>
                      <div style="text-align:right;flex-shrink:0;">
                        <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${EUR(p.price)}</div>
                        <div style="font-size:11px;color:var(--muted);">${esc(p.currency||'EUR')}</div>
                      </div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>`).join('');
  },

  _form(p, isNew) {
    const selCat    = p.category    || '';
    const subcatOpts = selCat && PRODUCT_CATEGORIES[selCat]
      ? PRODUCT_CATEGORIES[selCat].map(s =>
          `<option${p.subcategory===s?' selected':''}>${s}</option>`).join('')
      : '';

    return `
      <!-- Názov a cena -->
      <div class="form-row"><label class="form-label">Názov produktu *</label>
        <input id="pf-name" value="${esc(p.name||'')}" placeholder="napr. Chatbot Basic" /></div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="pf-desc" style="min-height:55px;resize:vertical;">${esc(p.description||'')}</textarea></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Cena (€) *</label>
          <input id="pf-price" type="number" step="0.01" value="${p.price||''}" /></div>
        <div class="form-row"><label class="form-label">Mena</label>
          <select id="pf-currency">
            <option${(p.currency||'EUR')==='EUR'?' selected':''}>EUR</option>
            <option${p.currency==='CZK'?' selected':''}>CZK</option>
            <option${p.currency==='USD'?' selected':''}>USD</option>
          </select>
        </div>
      </div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- Kategória -->
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Kategória *</label>
          <select id="pf-category" onchange="productsView._onCatChange(this.value)">
            <option value="">— vybrať —</option>
            ${Object.keys(PRODUCT_CATEGORIES).map(cat =>
              `<option${p.category===cat?' selected':''}>${cat}</option>`
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

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- Logika systému -->
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Logika systému</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Typ produktu</label>
          <select id="pf-type">
            ${Object.entries(PRODUCT_TYPES).map(([k,v]) =>
              `<option value="${k}"${(p.product_type||'internal')===k?' selected':''}>${v.icon} ${v.label} — ${v.desc}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">Realizuje</label>
          <select id="pf-fulfillment">
            ${Object.entries(FULFILLMENT_OPTIONS).map(([k,v]) =>
              `<option value="${k}"${(p.fulfillment||'admin')===k?' selected':''}>${v}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <!-- Odmeny -->
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Odmeny</div>

      <div class="form-row"><label class="form-label">Trigger odmeny</label>
        <select id="pf-trigger">
          ${Object.entries(REWARD_TRIGGERS).map(([k,v]) =>
            `<option value="${k}"${(p.reward_trigger||'payment_received')===k?' selected':''}>${v.icon} ${v.label}</option>`
          ).join('')}
        </select>
      </div>

      <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-points" ${p.points_enabled!==false?'checked':''}
            style="width:16px;height:16px;accent-color:var(--acc);" />
          <span>⭐ Body povolené</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="pf-commission" ${p.commission_enabled!==false?'checked':''}
            style="width:16px;height:16px;accent-color:var(--green);" />
          <span>💰 Provízia povolená</span>
        </label>
      </div>

      <div style="margin-top:10px;padding:10px 12px;background:rgba(212,148,58,0.06);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--muted);">
        ℹ️ Presné výpočty bodov a provízií budú definované v kompenzačnom pláne (Fáza 2).
      </div>

      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>

      <div class="form-row"><label class="form-label">Stav</label>
        <select id="pf-active">
          <option value="true"${p.active!==false?' selected':''}>✓ Aktívny</option>
          <option value="false"${p.active===false?' selected':''}>✕ Neaktívny</option>
        </select>
      </div>

      <div id="pf-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <div class="form-actions">
        <button class="btn-primary" id="pf-submit" onclick="productsView.save('${p.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="productsView.delete('${p.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  _onCatChange(cat) {
    const sel  = document.getElementById('pf-subcategory');
    const opts = PRODUCT_CATEGORIES[cat] || [];
    sel.innerHTML = `<option value="">— vybrať —</option>` +
      opts.map(s => `<option>${s}</option>`).join('');
  },

  openAdd() {
    modal.open('Nový produkt', this._form({
      name:'', description:'', price:'', currency:'EUR',
      category:'', subcategory:'', product_type:'internal',
      fulfillment:'admin', points_enabled:true,
      commission_enabled:true, reward_trigger:'payment_received',
      active:true,
    }, true));
  },

  openEdit(id) {
    const p = this._products.find(x => x.id === id);
    if (p) modal.open('Upraviť produkt', this._form(p, false));
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },
  _chk(id) { const el = document.getElementById(id); return el ? el.checked : false; },

  async save(id, isNew) {
    const name     = this._val('pf-name');
    const price    = this._val('pf-price');
    const category = this._val('pf-category');
    const errEl    = document.getElementById('pf-error');
    errEl.style.display = 'none';

    if (!name)     { errEl.textContent = 'Zadaj názov produktu.'; errEl.style.display = 'block'; return; }
    if (!price)    { errEl.textContent = 'Zadaj cenu.';           errEl.style.display = 'block'; return; }
    if (!category) { errEl.textContent = 'Vyber kategóriu.';      errEl.style.display = 'block'; return; }

    const btn = document.getElementById('pf-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      name, price: Number(price) || 0,
      currency:           this._val('pf-currency')    || 'EUR',
      description:        this._val('pf-desc'),
      category,
      subcategory:        this._val('pf-subcategory') || null,
      product_type:       this._val('pf-type')        || 'internal',
      fulfillment:        this._val('pf-fulfillment') || 'admin',
      reward_trigger:     this._val('pf-trigger')     || 'payment_received',
      points_enabled:     this._chk('pf-points'),
      commission_enabled: this._chk('pf-commission'),
      active:             this._val('pf-active') === 'true',
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
