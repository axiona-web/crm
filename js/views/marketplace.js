// ── views/marketplace.js — Členský marketplace ───────────────────────────────

const marketplaceView = {
  _products:   [],
  _profile:    null,
  _level:      null,
  _usageCount: 0,
  _view:       'home',   // 'home' | 'category' | 'product'
  _category:   null,
  _subcategory:null,
  _product:    null,

  render() {
    return `
      <div class="view-head">
        <h2>🛍 Marketplace</h2>
        <div style="display:flex;gap:8px;">
          ${this._view !== 'home' ? `<button class="btn-ghost" style="font-size:12px;" onclick="marketplaceView._back()">← Späť</button>` : ''}
          <button class="btn-ghost" style="font-size:12px;" onclick="app.setView('marketplace_orders')">📋 Moje dopyty</button>
        </div>
      </div>
      <div id="marketplace-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderView();
  },

  async _load() {
    const uid = app._currentUserId();
    const [productsRes, profileRes, usageRes] = await Promise.all([
      db.client.from('products')
        .select('*')
        .eq('is_marketplace_visible', true)
        .eq('is_active', true)
        .order('marketplace_sort_order')
        .order('name'),
      db.client.from('profiles')
        .select('*, membership_levels(name,slug,color,icon,discount_pct)')
        .eq('id', uid).single(),
      db.client.from('benefit_usage')
        .select('id')
        .eq('user_id', uid)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    this._products   = productsRes.data || [];
    this._profile    = profileRes.data  || {};
    this._level      = this._profile.membership_levels;
    this._usageCount = (usageRes.data||[]).length;
  },

  _back() {
    if (this._view === 'product') {
      this._view = this._subcategory ? 'subcategory' : 'category';
      this._product = null;
    } else if (this._view === 'subcategory') {
      this._view = 'category';
      this._subcategory = null;
    } else {
      this._view = 'home';
      this._category = null;
    }
    this._renderView();
  },

  _renderView() {
    if      (this._view === 'product')     this._renderProduct();
    else if (this._view === 'subcategory') this._renderSubcategory();
    else if (this._view === 'category')    this._renderCategory();
    else                                   this._renderHome();
  },

  // ── HOME ──────────────────────────────────────────────────────────────────
  _renderHome() {
    const el = document.getElementById('marketplace-wrap');
    if (!el) return;

    // Zisti kategórie
    const cats = {};
    this._products.forEach(p => {
      const cat = p.category || 'Ostatné';
      if (!cats[cat]) cats[cat] = { name: cat, products: [], subcats: new Set() };
      cats[cat].products.push(p);
      if (p.subcategory) cats[cat].subcats.add(p.subcategory);
    });

    const featured = this._products.filter(p => p.marketplace_is_featured);

    el.innerHTML = `
      <!-- Uvítací banner -->
      <div style="background:linear-gradient(135deg,#0d1117,#1a1f2e);border:1px solid rgba(91,164,245,0.2);border-radius:12px;padding:20px 24px;margin-bottom:20px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:radial-gradient(circle,rgba(91,164,245,0.15),transparent);border-radius:50%;"></div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Vitaj v</div>
        <div style="font-size:22px;font-weight:800;color:var(--txt);margin-bottom:4px;">Axiona Marketplace</div>
        <div style="font-size:13px;color:var(--muted);">Vyber si službu a my sa postaráme o zvyšok.</div>
        ${this._level ? `
          <div style="margin-top:12px;display:inline-flex;align-items:center;gap:8px;background:${this._level.color}18;border:1px solid ${this._level.color}44;border-radius:8px;padding:6px 12px;">
            <span style="font-size:14px;">${this._level.icon}</span>
            <span style="font-size:12px;font-weight:700;color:${this._level.color};">${this._level.name}</span>
            <span style="font-size:12px;color:var(--muted);">— zľava ${this._level.discount_pct}% na vybrané produkty</span>
          </div>` : ''}
      </div>

      ${featured.length > 0 ? `
        <!-- Odporúčané -->
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">⭐ Odporúčané</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
            ${featured.map(p => this._productCard(p, true)).join('')}
          </div>
        </div>` : ''}

      <!-- Kategórie -->
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">📂 Kategórie</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
        ${Object.values(cats).map(cat => `
          <div class="card" style="cursor:pointer;transition:border-color 0.2s,transform 0.15s;border-color:rgba(91,164,245,0.2);"
            onclick="marketplaceView._openCategory('${esc(cat.name)}')"
            onmouseover="this.style.borderColor='rgba(91,164,245,0.5)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='rgba(91,164,245,0.2)';this.style.transform=''">
            <div style="font-size:24px;margin-bottom:8px;">${this._catIcon(cat.name)}</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${esc(cat.name)}</div>
            <div style="font-size:12px;color:var(--muted);">${cat.products.length} produktov${cat.subcats.size > 0 ? ` · ${cat.subcats.size} podkategórií` : ''}</div>
          </div>`).join('')}
      </div>`;
  },

  _catIcon(name) {
    const icons = {
      'AI': '🤖', 'Automatizácia': '⚙️', 'Web': '🌐', 'Digitálne': '💻',
      'Google': '🔍', 'Marketing': '📣', 'NFC': '📡', 'Reality': '🏠',
      'Financie': '💰', 'Poradenstvo': '💡', 'Ostatné': '📦',
    };
    for (const [key, icon] of Object.entries(icons)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📦';
  },

  // ── KATEGÓRIA ──────────────────────────────────────────────────────────────
  _openCategory(cat) {
    this._category    = cat;
    this._subcategory = null;
    this._view        = 'category';
    this._renderView();
  },

  _renderCategory() {
    const el = document.getElementById('marketplace-wrap');
    if (!el) return;

    const catProducts = this._products.filter(p => (p.category||'Ostatné') === this._category);
    const subcats = [...new Set(catProducts.map(p => p.subcategory).filter(Boolean))];

    el.innerHTML = `
      <!-- Breadcrumb -->
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">
        <span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._view='home';marketplaceView._renderView()">Marketplace</span>
        <span style="margin:0 6px;">›</span>
        <span>${esc(this._category)}</span>
      </div>

      <div style="font-size:20px;font-weight:800;margin-bottom:4px;">${this._catIcon(this._category)} ${esc(this._category)}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">${catProducts.length} produktov</div>

      ${subcats.length > 0 ? `
        <!-- Podkategórie -->
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Podkategórie</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:20px;">
          ${subcats.map(sub => {
            const cnt = catProducts.filter(p=>p.subcategory===sub).length;
            return `
              <div class="card" style="cursor:pointer;padding:10px 12px;border-color:rgba(91,164,245,0.15);"
                onclick="marketplaceView._openSubcategory('${esc(sub)}')"
                onmouseover="this.style.borderColor='var(--acc-brd)'" onmouseout="this.style.borderColor='rgba(91,164,245,0.15)'">
                <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${esc(sub)}</div>
                <div style="font-size:11px;color:var(--muted);">${cnt} produktov</div>
              </div>`;
          }).join('')}
        </div>` : ''}

      <!-- Všetky produkty v kategórii -->
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Všetky produkty</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
        ${catProducts.map(p => this._productCard(p)).join('')}
      </div>`;
  },

  // ── PODKATEGÓRIA ───────────────────────────────────────────────────────────
  _openSubcategory(sub) {
    this._subcategory = sub;
    this._view        = 'subcategory';
    this._renderView();
  },

  _renderSubcategory() {
    const el = document.getElementById('marketplace-wrap');
    if (!el) return;

    const products = this._products.filter(p =>
      (p.category||'Ostatné') === this._category && p.subcategory === this._subcategory
    );

    el.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">
        <span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._view='home';marketplaceView._renderView()">Marketplace</span>
        <span style="margin:0 6px;">›</span>
        <span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._openCategory('${esc(this._category)}')">${esc(this._category)}</span>
        <span style="margin:0 6px;">›</span>
        <span>${esc(this._subcategory)}</span>
      </div>
      <div style="font-size:20px;font-weight:800;margin-bottom:4px;">${esc(this._subcategory)}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">${products.length} produktov</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
        ${products.map(p => this._productCard(p)).join('')}
      </div>`;
  },

  // ── PRODUKT KARTA ──────────────────────────────────────────────────────────
  _productCard(p, featured = false) {
    const level       = this._level;
    const discountPct = (level && p.benefit_eligible && level.discount_pct > 0)
      ? Math.min(level.discount_pct, p.max_discount_pct || 100) : 0;
    const price       = p.base_price || 0;
    const finalPrice  = discountPct > 0 ? Math.round(price * (1 - discountPct/100) * 100)/100 : price;

    return `
      <div class="card" style="cursor:pointer;padding:0;overflow:hidden;border-color:${featured?'rgba(212,148,58,0.3)':'var(--brd)'};transition:transform 0.15s,border-color 0.2s;"
        onclick="marketplaceView._openProduct('${p.id}')"
        onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='rgba(91,164,245,0.4)'"
        onmouseout="this.style.transform='';this.style.borderColor='${featured?'rgba(212,148,58,0.3)':'var(--brd)'}'">

        <!-- Obrázok -->
        <div style="height:120px;background:linear-gradient(135deg,#1a1f2e,#0d1117);display:flex;align-items:center;justify-content:center;position:relative;">
          ${p.marketplace_image_url
            ? `<img src="${esc(p.marketplace_image_url)}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<div style="font-size:40px;opacity:0.3;">${this._catIcon(p.category||'')}</div>`}
          ${p.marketplace_badge ? `<span style="position:absolute;top:8px;left:8px;background:var(--acc);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;">${esc(p.marketplace_badge)}</span>` : ''}
          ${featured ? `<span style="position:absolute;top:8px;right:8px;background:rgba(212,148,58,0.9);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;">⭐ Odporúčané</span>` : ''}
        </div>

        <!-- Info -->
        <div style="padding:12px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:4px;line-height:1.3;">${esc(p.marketplace_title||p.name)}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.4;">${esc((p.marketplace_short_description||'').slice(0,80))}${(p.marketplace_short_description||'').length>80?'...':''}</div>

          <!-- Cena -->
          ${p.marketplace_show_price !== false ? `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              ${discountPct > 0 ? `
                <span class="mono" style="font-size:15px;font-weight:700;color:${level?.color||'var(--green)'};">${EUR(finalPrice)}</span>
                <span class="mono" style="font-size:12px;text-decoration:line-through;color:var(--muted);">${EUR(price)}</span>
                <span style="font-size:10px;background:${level?.color||'var(--green)'}22;color:${level?.color||'var(--green)'};border-radius:4px;padding:1px 6px;font-weight:700;">-${discountPct}%</span>
              ` : `<span class="mono" style="font-size:15px;font-weight:700;color:var(--acc);">${p.marketplace_price_label||EUR(price)}</span>`}
            </div>` : p.marketplace_price_label ? `
            <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">${esc(p.marketplace_price_label)}</div>` : ''}

          <div style="font-size:11px;color:var(--blue);font-weight:600;">${esc(p.marketplace_cta_label||'Mám záujem')} →</div>
        </div>
      </div>`;
  },

  // ── DETAIL PRODUKTU ────────────────────────────────────────────────────────
  _openProduct(pid) {
    this._product = this._products.find(p => p.id === pid);
    if (!this._product) return;
    this._view = 'product';
    this._renderView();
  },

  _renderProduct() {
    const el = document.getElementById('marketplace-wrap');
    if (!el) return;
    const p = this._product;
    if (!p) return;

    const level       = this._level;
    const discountPct = (level && p.benefit_eligible && level.discount_pct > 0)
      ? Math.min(level.discount_pct, p.max_discount_pct || 100) : 0;
    const price       = p.base_price || 0;
    const discountAmt = discountPct > 0 ? Math.round(price * discountPct/100 * 100)/100 : 0;
    const finalPrice  = discountPct > 0 ? Math.round((price - discountAmt) * 100)/100 : price;
    const limitReached = this._usageCount >= 3;

    el.innerHTML = `
      <!-- Breadcrumb -->
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">
        <span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._view='home';marketplaceView._renderView()">Marketplace</span>
        ${p.category ? `<span style="margin:0 6px;">›</span><span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._openCategory('${esc(p.category)}')">${esc(p.category)}</span>` : ''}
        ${p.subcategory ? `<span style="margin:0 6px;">›</span><span style="cursor:pointer;color:var(--blue);" onclick="marketplaceView._openSubcategory('${esc(p.subcategory)}')">${esc(p.subcategory)}</span>` : ''}
        <span style="margin:0 6px;">›</span>
        <span>${esc(p.marketplace_title||p.name)}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start;">

        <!-- Ľavý stĺpec — info -->
        <div>
          ${p.marketplace_image_url ? `
            <div style="height:220px;border-radius:10px;overflow:hidden;margin-bottom:16px;background:#1a1f2e;">
              <img src="${esc(p.marketplace_image_url)}" style="width:100%;height:100%;object-fit:cover;" />
            </div>` : `
            <div style="height:160px;border-radius:10px;background:linear-gradient(135deg,#1a1f2e,#0d1117);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <div style="font-size:60px;opacity:0.2;">${this._catIcon(p.category||'')}</div>
            </div>`}

          <div style="font-size:22px;font-weight:800;margin-bottom:6px;">${esc(p.marketplace_title||p.name)}</div>
          ${p.marketplace_badge ? `<span style="display:inline-block;background:var(--acc);color:#000;font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;margin-bottom:10px;">${esc(p.marketplace_badge)}</span>` : ''}
          <div style="font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:16px;">${esc(p.marketplace_short_description||'')}</div>

          ${p.marketplace_long_description ? `
            <div style="font-size:13px;color:var(--txt);line-height:1.7;white-space:pre-line;padding:14px;background:var(--inp);border:1px solid var(--brd);border-radius:8px;">
              ${esc(p.marketplace_long_description)}
            </div>` : ''}
        </div>

        <!-- Pravý stĺpec — kúpa -->
        <div style="position:sticky;top:16px;">
          <div class="card" style="border-color:rgba(91,164,245,0.3);">

            <!-- Cena -->
            ${p.marketplace_show_price !== false ? `
              <div style="margin-bottom:14px;">
                ${discountPct > 0 ? `
                  <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px;">
                    <span class="mono" style="font-size:26px;font-weight:800;color:${level?.color||'var(--green)'};">${EUR(finalPrice)}</span>
                    <span class="mono" style="font-size:16px;text-decoration:line-through;color:var(--muted);">${EUR(price)}</span>
                  </div>
                  <div style="font-size:12px;color:${level?.color||'var(--green)'};">Ušetríš ${EUR(discountAmt)} (${discountPct}% ${level?.name} zľava)</div>` : `
                  <div class="mono" style="font-size:26px;font-weight:800;color:var(--acc);">${p.marketplace_price_label||EUR(price)}</div>`}
              </div>` : ''}

            <!-- Benefit info -->
            ${level && discountPct > 0 && !limitReached ? `
              <div style="background:${level.color}12;border:1px solid ${level.color}33;border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:12px;">
                ${level.icon} Tvoja <strong style="color:${level.color};">${level.name}</strong> zľava bude automaticky aplikovaná
              </div>` : ''}
            ${limitReached ? `
              <div style="background:rgba(242,85,85,0.1);border:1px solid rgba(242,85,85,0.3);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:12px;color:var(--red);">
                ⚠ Mesačný limit benefitov vyčerpaný — bez zľavy
              </div>` : ''}

            <!-- CTA -->
            <button class="btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700;"
              onclick="marketplaceView._openOrderModal('${p.id}')">
              ${esc(p.marketplace_cta_label||'Mám záujem')}
            </button>

            <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;">
              Tvoj záujem bude spracovaný do 24 hodín
            </div>

            <!-- Meta info -->
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--brd);">
              ${p.category ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Kategória: <strong>${esc(p.category)}</strong></div>` : ''}
              ${p.subcategory ? `<div style="font-size:12px;color:var(--muted);">Typ: <strong>${esc(p.subcategory)}</strong></div>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  },

  // ── OBJEDNÁVKOVÝ MODAL ─────────────────────────────────────────────────────
  _openOrderModal(pid) {
    const p       = this._products.find(x => x.id === pid);
    if (!p) return;
    const level       = this._level;
    const prof        = this._profile;
    const discountPct = (level && p.benefit_eligible && level.discount_pct > 0 && this._usageCount < 3)
      ? Math.min(level.discount_pct, p.max_discount_pct || 100) : 0;
    const price       = p.base_price || 0;
    const discountAmt = discountPct > 0 ? Math.round(price * discountPct/100 * 100)/100 : 0;
    const finalPrice  = discountPct > 0 ? Math.round((price - discountAmt) * 100)/100 : price;

    modal.open(`🛍 ${esc(p.marketplace_title||p.name)}`, `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Vyplň kontaktné údaje a my ťa budeme kontaktovať do 24 hodín.
      </div>

      ${discountPct > 0 ? `
        <div style="background:${level.color}12;border:1px solid ${level.color}33;border-radius:8px;padding:10px 12px;margin-bottom:14px;">
          <div style="font-size:12px;font-weight:700;color:${level.color};margin-bottom:4px;">${level.icon} ${level.name} zľava ${discountPct}%</div>
          <div style="display:flex;gap:10px;font-size:13px;">
            <span style="text-decoration:line-through;color:var(--muted);">${EUR(price)}</span>
            <span style="font-weight:700;color:${level.color};">${EUR(finalPrice)}</span>
            <span style="color:var(--muted);">(ušetríš ${EUR(discountAmt)})</span>
          </div>
        </div>` : p.marketplace_show_price !== false ? `
        <div style="font-size:14px;font-weight:700;color:var(--acc);margin-bottom:14px;">${p.marketplace_price_label||EUR(price)}</div>` : ''}

      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Meno *</label>
          <input id="mo-name" value="${esc(prof.name||'')}" placeholder="Tvoje meno" /></div>
        <div class="form-row"><label class="form-label">Email *</label>
          <input id="mo-email" value="${esc(prof.email||'')}" placeholder="email@firma.sk" /></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Telefón</label>
          <input id="mo-phone" placeholder="+421 900 000 000" /></div>
        <div class="form-row"><label class="form-label">Firma</label>
          <input id="mo-company" placeholder="Názov firmy (voliteľné)" /></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámka k dopytu</label>
        <textarea id="mo-note" style="min-height:70px;resize:vertical;" placeholder="Čo potrebuješ? Akékoľvek detaily..."></textarea></div>

      <div class="form-actions">
        <button class="btn-primary" onclick="marketplaceView._submitOrder('${pid}','${discountPct}','${finalPrice}','${discountAmt}')">
          📨 Odoslať záujem
        </button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _submitOrder(pid, discountPct, finalPrice, discountAmt) {
    const p = this._products.find(x => x.id === pid);
    if (!p) return;

    const name    = document.getElementById('mo-name')?.value?.trim();
    const email   = document.getElementById('mo-email')?.value?.trim();
    const phone   = document.getElementById('mo-phone')?.value?.trim();
    const company = document.getElementById('mo-company')?.value?.trim();
    const note    = document.getElementById('mo-note')?.value?.trim();

    if (!name)  { toast.error('Zadaj meno.'); return; }
    if (!email) { toast.error('Zadaj email.'); return; }

    discountPct  = Number(discountPct);
    finalPrice   = Number(finalPrice);
    discountAmt  = Number(discountAmt);
    const price  = p.base_price || 0;
    const uid    = app._currentUserId();
    const level  = this._level;

    // Nájdi alebo použi existujúci kontakt
    let contactId = null;
    const contacts = app.state.contacts || [];
    const existing = contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact } = await db.client.from('contacts').insert({
        name: company ? `${name} (${company})` : name,
        email, phone: phone || null,
        owner_id: uid, created_by: uid,
      }).select('id').single();
      contactId = newContact?.id;
    }

    // Vytvor deal
    const dealTitle = `${p.marketplace_title||p.name} — ${company||name}`;
    const { data: deal, error } = await db.client.from('deals').insert({
      title:                       dealTitle,
      contact_id:                  contactId,
      product_id:                  pid,
      owner_id:                    uid,
      created_by:                  uid,
      source:                      'marketplace',
      description:                 note || null,
      notes:                       note || null,
      status:                      'new',
      requires_approval:           true,
      base_price:                  price,
      discount_percent:            discountPct,
      discount_amount:             discountAmt,
      final_price:                 discountPct > 0 ? finalPrice : price,
      discount_source:             discountPct > 0 ? `${level?.name} (${level?.slug})` : null,
      discount_applied_by:         discountPct > 0 ? uid : null,
      discount_applied_at:         discountPct > 0 ? new Date().toISOString() : null,
      sale_price_snapshot:         discountPct > 0 ? finalPrice : price,
      cost_snapshot:               p.cost_price || 0,
      commission_percent_snapshot: p.commission_percent || 0,
      commission_amount_snapshot:  Math.round((discountPct > 0 ? finalPrice : price) * (p.commission_percent||0) / 100 * 100)/100,
      product_name_snapshot:       p.name,
      margin_override:             false,
    }).select().single();

    if (error) { toast.error('Chyba pri odoslaní: ' + error.message); return; }

    // Benefit usage log
    if (discountPct > 0) {
      db.client.from('benefit_usage').insert({
        user_id: uid, deal_id: deal.id,
        note: `Marketplace: ${p.name} — ${discountPct}% zľava`,
      }).then(()=>{}).catch(()=>{});
    }

    modal.close();
    toast.success('Tvoj záujem bol prijatý! Admin ťa bude kontaktovať do 24 hodín.');

    // Refresh usage count
    this._usageCount++;

    // Presmeruj na moje dopyty
    setTimeout(() => app.setView('marketplace_orders'), 1500);
  },
};
