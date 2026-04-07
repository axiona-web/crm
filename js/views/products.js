// ── views/products.js — správa produktov (len admin) ─────────────────────────

const productsView = {
  _products: [],
  _loaded:   false,

  render() {
    return `
      <div class="view-head">
        <h2>Produkty</h2>
        <button class="btn-primary" onclick="productsView.openAdd()">+ Nový produkt</button>
      </div>
      <div id="products-list">
        <div style="color:var(--muted);font-size:13px;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) {
      await this._load();
    }
    this._renderList();
  },

  async _load() {
    const { data } = await db.client.from('products').select('*').order('name');
    this._products = data || [];
    this._loaded   = true;
    // Ulož do app.state pre použitie v pipeline/orders
    app.state.products = this._products;
  },

  _renderList() {
    const el = document.getElementById('products-list');
    if (!el) return;

    if (this._products.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
          <div style="font-size:28px;margin-bottom:8px;">🛍️</div>
          <div>Žiadne produkty</div>
          <div style="margin-top:12px;"><button class="btn-primary" onclick="productsView.openAdd()">+ Pridať prvý produkt</button></div>
        </div>`;
      return;
    }

    // Zoskup podľa kategórie
    const categories = [...new Set(this._products.map(p => p.category || 'Bez kategórie'))];

    el.innerHTML = categories.map(cat => {
      const items = this._products.filter(p => (p.category || 'Bez kategórie') === cat);
      return `
        <div style="margin-bottom:18px;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;padding-left:2px;">${esc(cat)}</div>
          <div class="list">
            ${items.map(p => `
              <div class="card" style="cursor:pointer;" onclick="productsView.openEdit('${p.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <span style="font-weight:700;font-size:14px;">${esc(p.name)}</span>
                      ${!p.active ? `<span class="badge" style="background:rgba(242,85,85,0.1);color:var(--red);border:1px solid rgba(242,85,85,0.25);font-size:10px;">Neaktívny</span>` : ''}
                    </div>
                    ${p.description ? `<div style="font-size:12px;color:var(--muted);">${esc(p.description)}</div>` : ''}
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${EUR(p.price)}</div>
                    <div style="font-size:11px;color:var(--muted);">${esc(p.currency || 'EUR')}</div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },

  _form(p, isNew) {
    return `
      <div class="form-row"><label class="form-label">Názov produktu *</label>
        <input id="pf-name" value="${esc(p.name||'')}" placeholder="napr. Členstvo Gold" /></div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="pf-desc" style="min-height:60px;resize:vertical;">${esc(p.description||'')}</textarea></div>
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
      <div class="form-row"><label class="form-label">Kategória</label>
        <input id="pf-category" value="${esc(p.category||'')}" placeholder="napr. Členstvo, Služba, Školenie" /></div>
      <div class="form-row">
        <label class="form-label">Stav</label>
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

  openAdd()    { modal.open('Nový produkt', this._form({ name:'', description:'', price:'', currency:'EUR', category:'', active:true }, true)); },
  openEdit(id) {
    const p = this._products.find(x => x.id === id);
    if (p) modal.open('Upraviť produkt', this._form(p, false));
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

  async save(id, isNew) {
    const name  = this._val('pf-name');
    const price = this._val('pf-price');
    const errEl = document.getElementById('pf-error');
    errEl.style.display = 'none';
    if (!name)  { errEl.textContent = 'Zadaj názov produktu.'; errEl.style.display = 'block'; return; }
    if (!price) { errEl.textContent = 'Zadaj cenu.';           errEl.style.display = 'block'; return; }

    const btn = document.getElementById('pf-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      name, price: Number(price) || 0,
      currency:    this._val('pf-currency') || 'EUR',
      description: this._val('pf-desc'),
      category:    this._val('pf-category'),
      active:      this._val('pf-active') === 'true',
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
      this._products = this._products.filter(p => p.id !== id);
      app.state.products = this._products;
      modal.close();
      this._renderList();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
