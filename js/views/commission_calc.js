// ── views/commission_calc.js ─────────────────────────────────────────────────

const commissionCalcView = {
  _products:   [],
  _rules:      {},
  _qty:        {}, // počet predajov per produkt pre simuláciu
  _loaded:     false,
  _simTarget:  2000,
  _hiddenCost: 10,
  RISK_OK:     45,
  RISK_WARN:   25,

  render() {
    return `
      <div class="view-head">
        <h2>🧮 Provízna kalkulačka</h2>
        <button class="btn-primary" id="save-rules-btn" onclick="commissionCalcView.saveRules()">💾 Uložiť pravidlá</button>
      </div>
      <div id="calc-wrap" style="min-width:0;">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) await this._load();
    this._renderCalc();
  },

  async _load() {
    const [{ data: prods }, { data: rules }] = await Promise.all([
      db.client.from('products').select('*').eq('is_active', true).order('subcategory').order('name'),
      db.client.from('commission_rules').select('*').is('valid_to', null).order('created_at', { ascending: false }),
    ]);
    this._products = prods || [];
    this._rules = {};
    this._qty   = {};
    (prods || []).forEach(p => {
      const rule = (rules || []).find(r => r.product_id === p.id);
      this._rules[p.id] = {
        ruleId: rule?.id || null,
        pct:    rule?.base_percent               ?? p.commission_percent ?? 10,
        bonus:  rule?.self_referral_bonus_percent ?? p.referral_bonus_pct ?? 2,
        maxPct: rule?.max_percent                ?? 30,
        cap:    rule?.cap_eur                    ?? null,
        hidden: rule?.hidden_cost_factor         ?? this._defaultHidden(p),
      };
      this._qty[p.id] = 0;
    });
    this._loaded = true;
  },

  _defaultHidden(p) {
    const wf = p.workflow_type || '', type = p.product_type || '';
    if (type === 'custom')                          return 20;
    if (wf === 'project' || wf === 'projektovy')   return 15;
    if (type === 'entry')                           return 5;
    return 10;
  },

  _limits(price) {
    if (price <= 199)  return { min:5,  max:20, safe:[12,18] };
    if (price <= 599)  return { min:8,  max:25, safe:[15,22] };
    if (price <= 999)  return { min:10, max:30, safe:[18,25] };
    return                    { min:12, max:35, safe:[20,28] };
  },

  _calc(p) {
    const r      = this._rules[p.id] || { pct:10, bonus:2, cap:null, hidden:10 };
    const price  = p.base_price || p.price || 0;
    const cost   = p.cost_price || 0;
    const hiddenE = Math.round(cost * (r.hidden / 100));
    const realCost = cost + hiddenE;
    const margin   = price - realCost;
    const comm     = Math.round(price * r.pct / 100);
    const capped   = r.cap ? Math.min(comm, r.cap) : comm;
    const net      = margin - capped;
    const pctOfPrice = price > 0 ? (net / price * 100) : 0;
    const risk = pctOfPrice >= this.RISK_OK  ? 'green'
               : pctOfPrice >= this.RISK_WARN ? 'amber' : 'red';
    const toTarget = capped > 0 ? Math.ceil(this._simTarget / capped) : '∞';
    return { price, cost, hiddenE, realCost: Math.round(realCost),
      margin: Math.round(margin), comm: capped, net: Math.round(net),
      pctOfPrice: Math.round(pctOfPrice * 10) / 10, risk, toTarget };
  },

  // Celkový príjem obchodníka na základe qty
  _simEarning() {
    return this._products.reduce((a, p) => {
      const qty = this._qty[p.id] || 0;
      if (qty === 0) return a;
      return a + this._calc(p).comm * qty;
    }, 0);
  },

  // Priemerná provízia len z produktov kde qty > 0 a pct > 0
  _avgComm() {
    const active = this._products.filter(p => (this._qty[p.id]||0) > 0 && (this._rules[p.id]?.pct||0) > 0);
    if (!active.length) {
      // Fallback — produkty s pct > 0 a cenou > 0
      const valid = this._products.filter(p => (p.base_price||p.price||0) > 0 && (this._rules[p.id]?.pct||0) > 0);
      if (!valid.length) return 0;
      return Math.round(valid.reduce((a,p) => a + this._calc(p).comm, 0) / valid.length);
    }
    return Math.round(active.reduce((a,p) => a + this._calc(p).comm * (this._qty[p.id]||0), 0) / active.reduce((a,p) => a + (this._qty[p.id]||0), 0));
  },

  _setQty(id, val) {
    this._qty[id] = val;
    this._updateSimSummary();
    this._updateRow(id);
  },

  _fmt(v)    { return Math.round(v).toLocaleString('sk-SK') + ' €'; },
  _fmtPct(v) { return (Math.round(v * 10) / 10) + '%'; },

  _riskBadge(risk) {
    const cfg = {
      green: { bg:'rgba(62,207,142,0.12)', color:'var(--green)', label:'✓ OK'    },
      amber: { bg:'rgba(212,148,58,0.12)', color:'var(--acc)',   label:'⚠ Pozor' },
      red:   { bg:'rgba(242,85,85,0.12)',  color:'var(--red)',   label:'✕ Riziko'},
    }[risk];
    return `<span class="badge" style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}44;font-size:10px;white-space:nowrap;">${cfg.label}</span>`;
  },

  _renderCalc() {
    const el = document.getElementById('calc-wrap');
    if (!el) return;

    const products  = this._products;
    const subcats   = [...new Set(products.map(p => p.subcategory || 'Ostatné'))];
    const totMargin = products.reduce((a,p) => a + this._calc(p).margin, 0);
    const totComm   = products.reduce((a,p) => a + this._calc(p).comm,   0);
    const totNet    = products.reduce((a,p) => a + this._calc(p).net,    0);
    const avgComm   = this._avgComm();
    const needForTarget = avgComm > 0 ? Math.ceil(this._simTarget / avgComm) : '∞';

    el.innerHTML = `
      <!-- Globálne -->
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:13px;color:var(--muted);">Globálna prov.:</span>
            <input type="range" min="0" max="35" step="1" value="10" id="global-slider" style="width:110px;"
              oninput="document.getElementById('global-val').textContent=this.value+'%'">
            <span id="global-val" style="font-size:14px;font-weight:700;min-width:36px;">10%</span>
            <button class="btn-ghost" style="font-size:12px;" onclick="commissionCalcView._applyGlobal()">Aplikovať</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:13px;color:var(--muted);">Glob. skrytý náklad:</span>
            <input type="range" min="0" max="40" step="5" value="${this._hiddenCost}" id="hidden-slider" style="width:100px;"
              oninput="commissionCalcView._setHiddenGlobal(+this.value); document.getElementById('hidden-val').textContent=this.value+'%'">
            <span id="hidden-val" style="font-size:14px;font-weight:700;min-width:36px;">${this._hiddenCost}%</span>
          </div>
          <div style="margin-left:auto;font-size:11px;color:var(--muted);">
            ✓ ≥${this.RISK_OK}% &nbsp;|&nbsp; ⚠ ${this.RISK_WARN}–${this.RISK_OK-1}% &nbsp;|&nbsp; ✕ &lt;${this.RISK_WARN}%
          </div>
        </div>
      </div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Reálna marža</div>
          <div class="mono" style="font-size:17px;font-weight:700;color:var(--green);" id="tot-margin">${this._fmt(totMargin)}</div>
          <div style="font-size:11px;color:var(--muted);">po skryt. nákladoch</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Celk. provízie</div>
          <div class="mono" style="font-size:17px;font-weight:700;color:var(--acc);" id="tot-comm">${this._fmt(totComm)}</div>
          <div style="font-size:11px;color:var(--muted);">ak predaný každý 1×</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Čistý zisk</div>
          <div class="mono" style="font-size:17px;font-weight:700;color:var(--green);" id="tot-net">${this._fmt(totNet)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Priem. provízia</div>
          <div class="mono" style="font-size:17px;font-weight:700;color:var(--acc);" id="avg-comm">${this._fmt(avgComm)}</div>
          <div style="font-size:11px;color:var(--muted);">z produktov s cenou</div>
        </div>
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Na cieľ ${this._fmt(this._simTarget)}</div>
          <div class="mono" style="font-size:17px;font-weight:700;color:var(--acc);" id="need-count">${needForTarget} obchodov</div>
        </div>
      </div>

      <!-- Simulácia príjmu -->
      <div class="card" style="margin-bottom:16px;border-color:var(--acc-brd);">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Simulácia príjmu obchodníka</div>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:13px;color:var(--muted);">Cieľový príjem:</span>
            <select id="target-select" onchange="commissionCalcView._setTarget(+this.value)" style="font-size:13px;width:auto;">
              ${[1000,1500,2000,2500,3000,4000,5000].map(t =>
                `<option value="${t}"${this._simTarget===t?' selected':''}>${this._fmt(t)}</option>`
              ).join('')}
            </select>
          </div>
          <div style="font-size:12px;color:var(--muted);">
            Zadaj počet predajov pri každom produkte v stĺpci <strong>Počet</strong> →
          </div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:11px;color:var(--muted);">Celkový príjem obchodníka</div>
            <div class="mono" style="font-size:28px;font-weight:700;color:${this._simEarning() >= this._simTarget ? 'var(--green)' : 'var(--acc)'};" id="sim-result">${this._fmt(this._simEarning())}</div>
            <div style="font-size:11px;color:var(--muted);" id="sim-vs-target">${this._simEarning() >= this._simTarget ? '✓ Cieľ dosiahnutý' : 'Cieľ: ' + this._fmt(this._simTarget)}</div>
          </div>
        </div>
        <div id="sim-product-summary" style="display:flex;gap:8px;flex-wrap:wrap;">
          ${this._products.filter(p => (this._qty[p.id]||0) > 0).map(p => {
            const c = this._calc(p);
            const qty = this._qty[p.id];
            return `<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;">
              <div style="font-size:11px;color:var(--muted);">${esc(p.name)} × ${qty}</div>
              <div class="mono" style="font-size:14px;font-weight:700;color:var(--acc);">${this._fmt(c.comm * qty)}</div>
            </div>`;
          }).join('') || '<div style="font-size:12px;color:var(--muted);">Zadaj počty produktov v tabuľke nižšie...</div>'}
        </div>
      </div>

      <!-- Tabuľky — wide scroll -->
      <div style="overflow-x:auto;margin:0 -4px;padding:0 4px;">
        ${subcats.map(sub => this._renderSubcatTable(sub)).join('')}
      </div>

      <div style="font-size:12px;color:var(--muted);margin-top:8px;padding:12px;background:var(--surf);border-radius:8px;border:1px solid var(--brd);line-height:1.8;">
        <strong>Vzorec:</strong> Čistý zisk = Cena − Náklad − Skrytý náklad − Provízia &nbsp;|&nbsp;
        <strong>Skrytý náklad</strong> je per produkt (custom=20%, projekt=15%, quick=10%, entry=5%) &nbsp;|&nbsp;
        <strong>✓ bezpečné</strong> = odporúčaný provízny rozsah pre daný cenový segment &nbsp;|&nbsp;
        <strong>Na cieľ</strong> = počet predajov tohto produktu na dosiahnutie mesačného cieľa
      </div>`;
  },

  _renderSubcatTable(sub) {
    const items = this._products.filter(p => (p.subcategory||'Ostatné') === sub);
    if (!items.length) return '';

    const rows = items.map(p => {
      const r   = this._rules[p.id];
      const c   = this._calc(p);
      const lim = this._limits(c.price);
      const netColor = { green:'var(--green)', amber:'var(--acc)', red:'var(--red)' }[c.risk];
      const wf  = p.workflow_type || '';
      const isQ = wf === 'quick' || wf === 'ai_web';
      const inSafe = r.pct >= lim.safe[0] && r.pct <= lim.safe[1];

      return `<tr style="border-bottom:1px solid var(--brd);">
        <td style="padding:8px;min-width:170px;">
          <div style="font-weight:600;font-size:13px;">${esc(p.name)}</div>
          <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">
            <span class="badge" style="font-size:10px;background:${isQ?'rgba(62,207,142,0.12)':'rgba(91,164,245,0.12)'};color:${isQ?'var(--green)':'var(--blue)'};border:1px solid ${isQ?'rgba(62,207,142,0.25)':'rgba(91,164,245,0.25)'};">${isQ?'⚡ rýchly':'🏗 projekt'}</span>
            ${p.product_code?`<span class="mono" style="font-size:10px;color:var(--muted);">${esc(p.product_code)}</span>`:''}
          </div>
        </td>
        <td style="padding:8px;text-align:right;font-size:12px;white-space:nowrap;" class="mono">${this._fmt(c.price)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;color:var(--muted);white-space:nowrap;" class="mono">${this._fmt(c.cost)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;color:var(--muted);white-space:nowrap;" class="mono" id="hidden-e-${p.id}">+${this._fmt(c.hiddenE)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;white-space:nowrap;" class="mono" id="margin-${p.id}">${this._fmt(c.margin)}</td>
        <td style="padding:8px;min-width:190px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" min="${lim.min}" max="${lim.max}" step="1"
              value="${Math.min(Math.max(r.pct,lim.min),lim.max)}"
              style="width:80px;"
              oninput="commissionCalcView._setPct('${p.id}',+this.value)">
            <span id="pct-lbl-${p.id}" style="min-width:34px;font-size:13px;font-weight:700;color:${inSafe?'var(--green)':'var(--acc)'};">${r.pct}%</span>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">
            rozsah ${lim.min}–${lim.max}% &nbsp;·&nbsp; <span style="color:var(--green);">✓ ${lim.safe[0]}–${lim.safe[1]}%</span>
          </div>
        </td>
        <td style="padding:8px;text-align:right;font-size:13px;font-weight:700;color:var(--acc);white-space:nowrap;" class="mono" id="comm-e-${p.id}">${this._fmt(c.comm)}</td>
        <td style="padding:8px;min-width:90px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="range" min="0" max="10" step="1" value="${r.bonus||0}" style="width:55px;"
              oninput="commissionCalcView._setBonus('${p.id}',+this.value); document.getElementById('bonus-lbl-${p.id}').textContent='+'+this.value+'%'">
            <span id="bonus-lbl-${p.id}" style="font-size:12px;min-width:30px;">+${r.bonus||0}%</span>
          </div>
        </td>
        <td style="padding:8px;min-width:90px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="range" min="0" max="40" step="5" value="${r.hidden||10}" style="width:55px;"
              oninput="commissionCalcView._setHiddenProduct('${p.id}',+this.value); document.getElementById('hidden-lbl-${p.id}').textContent=this.value+'%'">
            <span id="hidden-lbl-${p.id}" style="font-size:12px;min-width:30px;">${r.hidden||10}%</span>
          </div>
        </td>
        <td style="padding:8px;text-align:right;font-size:14px;font-weight:700;white-space:nowrap;color:${netColor};" class="mono" id="net-${p.id}">${this._fmt(c.net)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;white-space:nowrap;" id="pct-price-${p.id}">${this._fmtPct(c.pctOfPrice)}</td>
        <td style="padding:8px;" id="risk-${p.id}">${this._riskBadge(c.risk)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;color:var(--muted);white-space:nowrap;" id="to-target-${p.id}">${c.toTarget}×</td>
        <td style="padding:8px;text-align:center;">
          <input type="number" min="0" max="99" step="1" value="${this._qty[p.id]||0}"
            style="width:54px;font-size:13px;font-weight:700;text-align:center;"
            oninput="commissionCalcView._setQty('${p.id}',+this.value||0)">
        </td>
        <td style="padding:8px;text-align:right;font-size:13px;font-weight:700;white-space:nowrap;" class="mono" id="income-${p.id}"
          style="color:${(this._qty[p.id]||0)>0?'var(--acc)':'var(--muted)'};">
          ${(this._qty[p.id]||0) > 0 ? this._fmt(c.comm * (this._qty[p.id]||0)) : '—'}
        </td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;
          letter-spacing:0.08em;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--brd);">${esc(sub)}</div>
        <table style="width:100%;border-collapse:collapse;min-width:1000px;">
          <thead>
            <tr style="border-bottom:2px solid var(--brd);">
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Cena</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Náklad</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Skrytý</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Reál. marža</th>
              <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Provízia % <span style="color:var(--green);font-weight:400;">✓ bezpečné</span></th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Prov. €</th>
              <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Bonus ref.</th>
              <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Skrytý %</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Čistý zisk</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">% ceny</th>
              <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Risk</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Na cieľ</th>
              <th style="text-align:center;padding:6px 8px;font-size:11px;color:var(--acc);font-weight:600;">Počet ×</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--acc);font-weight:600;">Príjem</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Settery ───────────────────────────────────────────────────────────────
  _setPct(id, val) {
    if (this._rules[id]) this._rules[id].pct = val;
    const lim    = this._limits(this._products.find(p=>p.id===id)?.base_price || 0);
    const inSafe = val >= lim.safe[0] && val <= lim.safe[1];
    const lbl    = document.getElementById('pct-lbl-'+id);
    if (lbl) { lbl.textContent = val+'%'; lbl.style.color = inSafe ? 'var(--green)' : 'var(--acc)'; }
    this._updateRow(id);
  },
  _setBonus(id, val) { if(this._rules[id]) this._rules[id].bonus=val; this._updateRow(id); },
  _setHiddenProduct(id, val) { if(this._rules[id]) this._rules[id].hidden=val; this._updateRow(id); },
  _setHiddenGlobal(val) {
    this._hiddenCost = val;
    this._products.forEach(p => {
      if (this._rules[p.id] && this._rules[p.id].hidden === this._defaultHidden(p)) {
        this._rules[p.id].hidden = val;
        const el = document.getElementById('hidden-lbl-'+p.id);
        if (el) el.textContent = val + '%';
      }
    });
    this._updateAll();
  },
  _setTarget(val) {
    this._simTarget = val;
    this._updateTotals();
    this._updateSimSummary();
    this._products.forEach(p => {
      const c = this._calc(p);
      const el = document.getElementById('to-target-'+p.id);
      if (el) el.textContent = c.toTarget + '×';
    });
  },
  _setSim(n) {
    this._simCount = n;
    const el = document.getElementById('sim-count');
    const re = document.getElementById('sim-result');
    if (el) el.textContent = n;
    if (re) re.textContent = this._fmt(this._simEarning());
  },
  _applyGlobal() {
    const val = Number(document.getElementById('global-slider').value);
    this._products.forEach(p => {
      const lim = this._limits(p.base_price || p.price || 0);
      if (this._rules[p.id]) this._rules[p.id].pct = Math.min(Math.max(val, lim.min), lim.max);
    });
    this._renderCalc();
  },

  // ── Update helpers ────────────────────────────────────────────────────────
  _updateRow(id) {
    const p = this._products.find(x => x.id===id); if(!p) return;
    const c = this._calc(p);
    const r = this._rules[id];
    const lim = this._limits(c.price);
    const netColor = { green:'var(--green)', amber:'var(--acc)', red:'var(--red)' }[c.risk];
    const inSafe = r.pct >= lim.safe[0] && r.pct <= lim.safe[1];
    const s = (eid, val, style) => { const el=document.getElementById(eid); if(el){el.textContent=val; if(style) Object.assign(el.style,style);} };
    s('hidden-e-'+id, '+'+this._fmt(c.hiddenE));
    s('margin-'+id,   this._fmt(c.margin));
    s('comm-e-'+id,   this._fmt(c.comm));
    s('net-'+id,      this._fmt(c.net), { color: netColor });
    s('pct-price-'+id, this._fmtPct(c.pctOfPrice));
    s('to-target-'+id, c.toTarget + '×');
    s('pct-lbl-'+id,   r.pct + '%', { color: inSafe ? 'var(--green)' : 'var(--acc)' });
    const qty = this._qty[id] || 0;
    const incEl = document.getElementById('income-'+id);
    if (incEl) {
      incEl.textContent = qty > 0 ? this._fmt(c.comm * qty) : '—';
      incEl.style.color = qty > 0 ? 'var(--acc)' : 'var(--muted)';
    }
    const riskEl = document.getElementById('risk-'+id);
    if (riskEl) riskEl.innerHTML = this._riskBadge(c.risk);
    this._updateTotals();
    this._updateSimSummary();
  },
  _updateSimSummary() {
    const earning = this._simEarning();
    const resEl   = document.getElementById('sim-result');
    const vsEl    = document.getElementById('sim-vs-target');
    const sumEl   = document.getElementById('sim-product-summary');
    if (resEl) {
      resEl.textContent = this._fmt(earning);
      resEl.style.color = earning >= this._simTarget ? 'var(--green)' : 'var(--acc)';
    }
    if (vsEl) {
      vsEl.textContent = earning >= this._simTarget
        ? '✓ Cieľ dosiahnutý'
        : 'Cieľ: ' + this._fmt(this._simTarget);
    }
    if (sumEl) {
      const active = this._products.filter(p => (this._qty[p.id]||0) > 0);
      sumEl.innerHTML = active.length === 0
        ? '<div style="font-size:12px;color:var(--muted);">Zadaj počty produktov v tabuľke nižšie...</div>'
        : active.map(p => {
            const c   = this._calc(p);
            const qty = this._qty[p.id];
            return `<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;">
              <div style="font-size:11px;color:var(--muted);">${esc(p.name)} × ${qty}</div>
              <div class="mono" style="font-size:14px;font-weight:700;color:var(--acc);">${this._fmt(c.comm * qty)}</div>
            </div>`;
          }).join('');
    }
  },
  _updateTotals() {
    const totMargin = this._products.reduce((a,p) => a+this._calc(p).margin, 0);
    const totComm   = this._products.reduce((a,p) => a+this._calc(p).comm,   0);
    const totNet    = this._products.reduce((a,p) => a+this._calc(p).net,    0);
    const avgComm   = this._avgComm();
    const needForTarget = avgComm > 0 ? Math.ceil(this._simTarget / avgComm) : '∞';
    const s = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    s('tot-margin',  this._fmt(totMargin));
    s('tot-comm',    this._fmt(totComm));
    s('tot-net',     this._fmt(totNet));
    s('avg-comm',    this._fmt(avgComm));
    s('need-count',  needForTarget + ' obchodov');
    s('sim-result',  this._fmt(this._simEarning()));
    const simResEl = document.getElementById('sim-result');
    if (simResEl) simResEl.style.color = this._simEarning() >= this._simTarget ? 'var(--green)' : 'var(--acc)';
  },

  // ── Uloženie ──────────────────────────────────────────────────────────────
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
