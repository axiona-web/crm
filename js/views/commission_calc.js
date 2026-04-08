// ── views/commission_calc.js ─────────────────────────────────────────────────

const commissionCalcView = {
  _products:  [],
  _rules:     {},
  _loaded:    false,
  _simTarget: 2000,
  _hiddenCost: 10,
  RISK_OK:    45,
  RISK_WARN:  25,

  // Simulačný košík: [{ productId, qty, pct, bonus }]
  _basket: [],

  render() {
    return `
      <div class="view-head">
        <h2>🧮 Provízna kalkulačka</h2>
        <button class="btn-primary" id="save-rules-btn" onclick="commissionCalcView.saveRules()">💾 Uložiť pravidlá</button>
      </div>
      <div id="calc-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) await this._load();
    this._renderCalc();
  },

  async _load() {
    const [{ data: prods }, { data: rules }] = await Promise.all([
      db.client.from('products').select('*').eq('is_active', true).order('category').order('subcategory').order('name'),
      db.client.from('commission_rules').select('*').is('valid_to', null).order('created_at', { ascending: false }),
    ]);
    this._products = prods || [];
    this._rules = {};
    (prods || []).forEach(p => {
      const rule = (rules || []).find(r => r.product_id === p.id);
      this._rules[p.id] = {
        ruleId: rule?.id || null,
        pct:    rule?.base_percent               ?? p.commission_percent ?? 10,
        bonus:  rule?.self_referral_bonus_percent ?? p.referral_bonus_pct ?? 2,
        maxPct: rule?.max_percent                ?? 30,
        hidden: rule?.hidden_cost_factor         ?? this._defaultHidden(p),
      };
    });
    this._loaded = true;
  },

  _defaultHidden(p) {
    const wf = p.workflow_type || '', type = p.product_type || '';
    if (type === 'custom')                        return 20;
    if (wf === 'project' || wf === 'projektovy') return 15;
    if (type === 'entry')                         return 5;
    return 10;
  },

  _limits(price) {
    if (price <= 199)  return { min:5,  max:20, safe:[12,18] };
    if (price <= 599)  return { min:8,  max:25, safe:[15,22] };
    if (price <= 999)  return { min:10, max:30, safe:[18,25] };
    return                    { min:12, max:35, safe:[20,28] };
  },

  _calcItem(item) {
    const p      = this._products.find(x => x.id === item.productId);
    if (!p) return null;
    const price  = p.base_price || p.price || 0;
    const cost   = p.cost_price || 0;
    const hidden = this._rules[p.id]?.hidden || this._defaultHidden(p);
    const hiddenE = Math.round(cost * hidden / 100);
    const realCost = cost + hiddenE;
    const margin   = price - realCost;
    const comm     = Math.round(price * item.pct / 100);
    const commBonus = Math.round(price * (item.pct + item.bonus) / 100);
    const net      = margin - comm;
    const pctOfPrice = price > 0 ? (net / price * 100) : 0;
    const risk = pctOfPrice >= this.RISK_OK  ? 'green'
               : pctOfPrice >= this.RISK_WARN ? 'amber' : 'red';
    const toTarget = comm > 0 ? Math.ceil(this._simTarget / comm) : '∞';
    return { p, price, cost, hiddenE, margin: Math.round(margin),
      comm, commBonus, net: Math.round(net),
      pctOfPrice: Math.round(pctOfPrice*10)/10, risk, toTarget,
      totalComm: comm * item.qty,
      totalCommBonus: commBonus * item.qty,
    };
  },

  _fmt(v)    { return Math.round(v).toLocaleString('sk-SK') + ' €'; },
  _fmtPct(v) { return (Math.round(v*10)/10) + '%'; },

  _riskBadge(risk) {
    const cfg = {
      green: { bg:'rgba(62,207,142,0.12)', color:'var(--green)', label:'✓ OK'    },
      amber: { bg:'rgba(212,148,58,0.12)', color:'var(--acc)',   label:'⚠ Pozor' },
      red:   { bg:'rgba(242,85,85,0.12)',  color:'var(--red)',   label:'✕ Riziko'},
    }[risk];
    return `<span class="badge" style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}44;font-size:10px;">${cfg.label}</span>`;
  },

  // Unikátne kategórie a podkategórie
  _categories() {
    const cats = {};
    this._products.forEach(p => {
      const cat = p.category || 'Ostatné';
      const sub = p.subcategory || 'Ostatné';
      if (!cats[cat]) cats[cat] = new Set();
      cats[cat].add(sub);
    });
    return cats;
  },

  _renderCalc() {
    const el = document.getElementById('calc-wrap');
    if (!el) return;

    const cats     = this._categories();
    const catList  = Object.keys(cats);
    const firstCat = catList[0] || '';
    const firstSubs = firstCat ? [...cats[firstCat]] : [];

    // Celkové súhrny z košíka
    const totComm      = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.totalComm:0); }, 0);
    const totCommBonus = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.totalCommBonus:0); }, 0);
    const totNet       = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.net*i.qty:0); }, 0);

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">

        <!-- ĽAVÝ PANEL: Pridať produkt + pravidlá -->
        <div>
          <!-- Pridať do simulácie -->
          <div class="card" style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Pridať produkt do simulácie
            </div>

            <div class="form-row">
              <label class="form-label">Kategória</label>
              <select id="add-cat" onchange="commissionCalcView._onCatChange(this.value)" style="font-size:13px;">
                <option value="">— vybrať —</option>
                ${catList.map(c => `<option>${esc(c)}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <label class="form-label">Podkategória</label>
              <select id="add-sub" onchange="commissionCalcView._onSubChange(this.value)" style="font-size:13px;">
                <option value="">— vybrať kategóriu —</option>
              </select>
            </div>

            <div class="form-row">
              <label class="form-label">Produkt</label>
              <select id="add-product" style="font-size:13px;">
                <option value="">— vybrať podkategóriu —</option>
              </select>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
              <div class="form-row" style="margin-bottom:0;">
                <label class="form-label">Počet ks</label>
                <input id="add-qty" type="number" min="1" max="99" value="1" style="font-size:13px;" />
              </div>
              <div class="form-row" style="margin-bottom:0;">
                <label class="form-label">Provízia %</label>
                <input id="add-pct" type="number" min="0" max="35" step="1" value="10" style="font-size:13px;" />
              </div>
              <div class="form-row" style="margin-bottom:0;">
                <label class="form-label">Bonus ref. %</label>
                <input id="add-bonus" type="number" min="0" max="10" step="1" value="2" style="font-size:13px;" />
              </div>
            </div>

            <button class="btn-primary" style="width:100%;" onclick="commissionCalcView._addToBasket()">
              + Pridať do simulácie
            </button>
          </div>

          <!-- Skrytý náklad + cieľ -->
          <div class="card" style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Nastavenia
            </div>
            <div class="form-row">
              <label class="form-label">Cieľový príjem/mes</label>
              <select id="target-select" onchange="commissionCalcView._setTarget(+this.value)" style="font-size:13px;">
                ${[1000,1500,2000,2500,3000,4000,5000].map(t =>
                  `<option value="${t}"${this._simTarget===t?' selected':''}>${this._fmt(t)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-row" style="margin-bottom:0;">
              <label class="form-label">Globálny skrytý náklad</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="range" min="0" max="40" step="5" value="${this._hiddenCost}" id="hidden-slider" style="flex:1;"
                  oninput="commissionCalcView._hiddenCost=+this.value; document.getElementById('hidden-val').textContent=this.value+'%'; commissionCalcView._refreshBasket()">
                <span id="hidden-val" style="font-size:14px;font-weight:700;min-width:36px;">${this._hiddenCost}%</span>
              </div>
            </div>
          </div>

          <!-- Nová kategória / produkt -->
          <div class="card">
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
              Správa číselníka
            </div>
            <button class="btn-ghost" style="width:100%;margin-bottom:8px;font-size:13px;" onclick="app.setView('products')">
              🛍️ Spravovať produkty →
            </button>
            <div style="font-size:11px;color:var(--muted);">Nové kategórie a produkty pridáš v záložke Produkty.</div>
          </div>
        </div>

        <!-- PRAVÝ PANEL: Košík + výsledky -->
        <div>
          <!-- Súhrn -->
          <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
              Výsledok simulácie
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Príjem obchodníka</div>
                <div class="mono" style="font-size:24px;font-weight:700;color:${totComm>=this._simTarget?'var(--green)':'var(--acc)'};" id="res-comm">${this._fmt(totComm)}</div>
                <div style="font-size:11px;color:var(--muted);" id="res-vs">${totComm>=this._simTarget?'✓ Cieľ dosiahnutý':'Cieľ: '+this._fmt(this._simTarget)}</div>
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">S referral bonusom</div>
                <div class="mono" style="font-size:24px;font-weight:700;color:var(--purple);" id="res-bonus">${this._fmt(totCommBonus)}</div>
                <div style="font-size:11px;color:var(--muted);">ak referral = obchodník</div>
              </div>
            </div>
            <div style="border-top:1px solid var(--brd);padding-top:10px;display:flex;gap:16px;">
              <div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Čistý zisk (tebe)</div>
                <div class="mono" style="font-size:16px;font-weight:700;color:var(--green);" id="res-net">${this._fmt(totNet)}</div>
              </div>
              <div style="margin-left:auto;text-align:right;">
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Produktov v košíku</div>
                <div class="mono" style="font-size:16px;font-weight:700;" id="res-count">${this._basket.length}</div>
              </div>
            </div>
          </div>

          <!-- Košík -->
          <div id="basket-list">
            ${this._renderBasket()}
          </div>
        </div>
      </div>

      <!-- Pravidlá produktov (pod gridом) -->
      <div style="margin-top:20px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Provízne pravidlá produktov (default hodnoty)
        </div>
        ${this._renderRulesTable()}
      </div>`;
  },

  _renderBasket() {
    if (this._basket.length === 0) {
      return `<div class="card" style="text-align:center;padding:32px;color:var(--muted);">
        <div style="font-size:24px;margin-bottom:8px;">🛒</div>
        <div>Košík je prázdny</div>
        <div style="font-size:12px;margin-top:4px;">Vyber produkt vľavo a pridaj ho do simulácie</div>
      </div>`;
    }
    return this._basket.map((item, idx) => {
      const c = this._calcItem(item);
      if (!c) return '';
      const lim    = this._limits(c.price);
      const inSafe = item.pct >= lim.safe[0] && item.pct <= lim.safe[1];
      const netColor = { green:'var(--green)', amber:'var(--acc)', red:'var(--red)' }[c.risk];

      return `
        <div class="card" style="margin-bottom:10px;" id="basket-item-${idx}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
            <div>
              <div style="font-weight:700;font-size:14px;">${esc(c.p.name)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">
                ${esc(c.p.category)} › ${esc(c.p.subcategory||'')} &nbsp;·&nbsp;
                <span class="mono">${c.p.product_code||''}</span>
              </div>
            </div>
            <button onclick="commissionCalcView._removeFromBasket(${idx})"
              style="background:transparent;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;">✕</button>
          </div>

          <!-- Hodnoty -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
            <div style="background:var(--inp);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);">Cena</div>
              <div class="mono" style="font-size:13px;font-weight:700;">${this._fmt(c.price)}</div>
            </div>
            <div style="background:var(--inp);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);">Reál. marža</div>
              <div class="mono" style="font-size:13px;font-weight:700;">${this._fmt(c.margin)}</div>
            </div>
            <div style="background:var(--inp);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);">Prov./ks</div>
              <div class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${this._fmt(c.comm)}</div>
            </div>
            <div style="background:var(--inp);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);">Čistý zisk/ks</div>
              <div class="mono" style="font-size:13px;font-weight:700;color:${netColor};">${this._fmt(c.net)}</div>
            </div>
          </div>

          <!-- Ovládacie prvky -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:end;">
            <div>
              <label class="form-label">Počet ks</label>
              <input type="number" min="1" max="99" value="${item.qty}" style="font-size:14px;font-weight:700;text-align:center;"
                oninput="commissionCalcView._updateBasketItem(${idx},'qty',+this.value||1)">
            </div>
            <div>
              <label class="form-label">Provízia % <span style="color:${inSafe?'var(--green)':'var(--acc)'};">${inSafe?'✓':'⚠'} ${lim.safe[0]}–${lim.safe[1]}%</span></label>
              <input type="number" min="${lim.min}" max="${lim.max}" step="1" value="${item.pct}" style="font-size:14px;font-weight:700;text-align:center;"
                oninput="commissionCalcView._updateBasketItem(${idx},'pct',+this.value||0)">
            </div>
            <div>
              <label class="form-label">Bonus ref. %</label>
              <input type="number" min="0" max="10" step="1" value="${item.bonus}" style="font-size:14px;text-align:center;"
                oninput="commissionCalcView._updateBasketItem(${idx},'bonus',+this.value||0)">
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Celkom × ${item.qty}</div>
              <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${this._fmt(c.totalComm)}</div>
              ${item.bonus > 0 ? `<div style="font-size:11px;color:var(--purple);">+ref: ${this._fmt(c.totalCommBonus)}</div>` : ''}
              <div style="margin-top:4px;">${this._riskBadge(c.risk)}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  _renderRulesTable() {
    const subcats = [...new Set(this._products.map(p => p.subcategory||'Ostatné'))];
    return subcats.map(sub => {
      const items = this._products.filter(p => (p.subcategory||'Ostatné') === sub);
      return `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--brd);">${esc(sub)}</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--brd);">
              <th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
              <th style="text-align:right;padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Cena</th>
              <th style="text-align:right;padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Marža</th>
              <th style="padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Def. prov. %</th>
              <th style="padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Def. bonus %</th>
              <th style="text-align:right;padding:5px 8px;font-size:11px;color:var(--muted);font-weight:600;">Def. prov. €</th>
            </tr></thead>
            <tbody>
              ${items.map(p => {
                const r     = this._rules[p.id];
                const price = p.base_price || p.price || 0;
                const cost  = p.cost_price || 0;
                const hiddenE = Math.round(cost * (r?.hidden||10) / 100);
                const margin  = price - cost - hiddenE;
                const comm    = Math.round(price * (r?.pct||0) / 100);
                const lim     = this._limits(price);
                const inSafe  = (r?.pct||0) >= lim.safe[0] && (r?.pct||0) <= lim.safe[1];
                return `<tr style="border-bottom:1px solid var(--brd);">
                  <td style="padding:6px 8px;font-size:13px;font-weight:600;">${esc(p.name)}
                    <span class="mono" style="font-size:10px;color:var(--muted);margin-left:4px;">${esc(p.product_code||'')}</span>
                  </td>
                  <td style="padding:6px 8px;text-align:right;font-size:12px;" class="mono">${this._fmt(price)}</td>
                  <td style="padding:6px 8px;text-align:right;font-size:12px;" class="mono">${this._fmt(margin)}</td>
                  <td style="padding:6px 8px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <input type="range" min="${lim.min}" max="${lim.max}" step="1" value="${r?.pct||0}" style="width:70px;"
                        oninput="commissionCalcView._setRulePct('${p.id}',+this.value); document.getElementById('rpct-${p.id}').textContent=this.value+'%'">
                      <span id="rpct-${p.id}" style="font-size:12px;font-weight:700;min-width:30px;color:${inSafe?'var(--green)':'var(--acc)'};">${r?.pct||0}%</span>
                    </div>
                    <div style="font-size:10px;color:var(--green);">✓ ${lim.safe[0]}–${lim.safe[1]}%</div>
                  </td>
                  <td style="padding:6px 8px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <input type="range" min="0" max="10" step="1" value="${r?.bonus||0}" style="width:55px;"
                        oninput="commissionCalcView._setRuleBonus('${p.id}',+this.value); document.getElementById('rbonus-${p.id}').textContent='+'+this.value+'%'">
                      <span id="rbonus-${p.id}" style="font-size:12px;min-width:30px;">+${r?.bonus||0}%</span>
                    </div>
                  </td>
                  <td style="padding:6px 8px;text-align:right;font-size:13px;font-weight:700;color:var(--acc);" class="mono">${this._fmt(comm)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');
  },

  // ── Košík akcie ───────────────────────────────────────────────────────────
  _onCatChange(cat) {
    const cats = this._categories();
    const subs = cat ? [...(cats[cat]||[])] : [];
    const sel  = document.getElementById('add-sub');
    sel.innerHTML = `<option value="">— vybrať —</option>` +
      subs.map(s => `<option>${esc(s)}</option>`).join('');
    document.getElementById('add-product').innerHTML = '<option value="">— vybrať podkategóriu —</option>';
  },

  _onSubChange(sub) {
    const cat  = document.getElementById('add-cat').value;
    const prods = this._products.filter(p =>
      (p.category||'Ostatné') === cat && (p.subcategory||'Ostatné') === sub
    );
    const sel = document.getElementById('add-product');
    sel.innerHTML = `<option value="">— vybrať —</option>` +
      prods.map(p => `<option value="${p.id}">${esc(p.name)} — ${this._fmt(p.base_price||p.price||0)}</option>`).join('');

    // Predvyplň default pct z pravidiel
    if (prods.length === 1) {
      const r = this._rules[prods[0].id];
      if (r) {
        document.getElementById('add-pct').value   = r.pct   || 10;
        document.getElementById('add-bonus').value = r.bonus || 2;
      }
    }
  },

  _addToBasket() {
    const productId = document.getElementById('add-product').value;
    const qty       = Number(document.getElementById('add-qty').value)   || 1;
    const pct       = Number(document.getElementById('add-pct').value)   || 0;
    const bonus     = Number(document.getElementById('add-bonus').value) || 0;

    if (!productId) { alert('Vyber produkt.'); return; }

    // Ak produkt už je v košíku, pridaj qty
    const existing = this._basket.find(i => i.productId === productId);
    if (existing) {
      existing.qty   += qty;
      existing.pct    = pct;
      existing.bonus  = bonus;
    } else {
      this._basket.push({ productId, qty, pct, bonus });
    }

    // Auto-vyplň pct z pravidiel ak je 0
    if (pct === 0) {
      const r = this._rules[productId];
      if (r && r.pct > 0) this._basket[this._basket.length-1].pct = r.pct;
    }

    this._refreshBasket();
  },

  _removeFromBasket(idx) {
    this._basket.splice(idx, 1);
    this._refreshBasket();
  },

  _updateBasketItem(idx, field, val) {
    if (this._basket[idx]) {
      this._basket[idx][field] = val;
      this._refreshBasket();
    }
  },

  _refreshBasket() {
    const totComm      = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.totalComm:0); }, 0);
    const totCommBonus = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.totalCommBonus:0); }, 0);
    const totNet       = this._basket.reduce((a,i) => { const c=this._calcItem(i); return a+(c?c.net*i.qty:0); }, 0);

    // Aktualizuj súhrn
    const s = (id,val,style) => { const el=document.getElementById(id); if(el){el.textContent=val; if(style) Object.assign(el.style,style);} };
    s('res-comm',  this._fmt(totComm),  { color: totComm>=this._simTarget?'var(--green)':'var(--acc)' });
    s('res-bonus', this._fmt(totCommBonus));
    s('res-net',   this._fmt(totNet));
    s('res-count', this._basket.length);
    s('res-vs',    totComm>=this._simTarget ? '✓ Cieľ dosiahnutý' : 'Cieľ: '+this._fmt(this._simTarget));

    // Znovu renderuj košík
    const bl = document.getElementById('basket-list');
    if (bl) bl.innerHTML = this._renderBasket();
  },

  // ── Pravidlá ─────────────────────────────────────────────────────────────
  _setRulePct(id, val) {
    if (this._rules[id]) this._rules[id].pct = val;
    const el = document.getElementById('rpct-'+id);
    if (el) {
      el.textContent = val + '%';
      const lim = this._limits(this._products.find(p=>p.id===id)?.base_price||0);
      el.style.color = (val>=lim.safe[0]&&val<=lim.safe[1]) ? 'var(--green)' : 'var(--acc)';
    }
  },

  _setRuleBonus(id, val) {
    if (this._rules[id]) this._rules[id].bonus = val;
  },

  _setTarget(val) {
    this._simTarget = val;
    this._refreshBasket();
  },

  // ── Uloženie pravidiel ────────────────────────────────────────────────────
  async saveRules() {
    const btn = document.getElementById('save-rules-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Ukladám...'; }
    const today = new Date().toISOString().slice(0,10);
    const uid   = (await db.client.auth.getUser()).data.user?.id;
    let saved = 0, errors = 0;

    for (const p of this._products) {
      const r = this._rules[p.id]; if(!r) continue;
      try {
        if (r.ruleId) {
          await db.client.from('commission_rules')
            .update({ valid_to: today }).eq('id', r.ruleId).is('valid_to', null);
        }
        const { data, error } = await db.client.from('commission_rules').insert({
          product_id: p.id, base_percent: r.pct,
          self_referral_bonus_percent: r.bonus||0,
          max_percent: this._limits(p.base_price||p.price||0).max,
          hidden_cost_factor: r.hidden||this._hiddenCost,
          valid_from: today, created_by: uid,
        }).select().single();
        if (error) throw error;
        await db.client.from('products').update({
          commission_percent: r.pct, referral_bonus_pct: r.bonus||0,
        }).eq('id', p.id);
        r.ruleId = data.id;
        saved++;
      } catch(e) { console.error(e); errors++; }
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = errors ? `⚠️ ${saved}/${this._products.length}` : `✓ Uložené (${saved})`;
      setTimeout(() => { btn.textContent = '💾 Uložiť pravidlá'; }, 3000);
    }
  },
};
