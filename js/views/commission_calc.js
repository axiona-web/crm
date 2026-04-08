// ── views/commission_calc.js — provízna kalkulačka ───────────────────────────

const commissionCalcView = {
  _products: [],
  _loaded:   false,

  render() {
    return `
      <div class="view-head">
        <h2>Provízna kalkulačka</h2>
        <button class="btn-primary" id="save-rules-btn" onclick="commissionCalcView.saveRules()">
          💾 Uložiť pravidlá do DB
        </button>
      </div>

      <div id="calc-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam produkty...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) await this._load();
    this._renderCalc();
  },

  async _load() {
    const { data } = await db.client.from('products')
      .select('*').eq('is_active', true).order('subcategory').order('name');
    this._products = (data || []).map(p => ({
      ...p,
      _pct:   p.commission_percent || 10,
      _bonus: p.referral_bonus_pct  || 2,
      _cap:   p.commission_cap      || null,
    }));
    this._loaded = true;
  },

  _calc(p) {
    const margin = (p.base_price || p.price || 0) - (p.cost_price || 0);
    const comm   = Math.round((p.base_price || p.price || 0) * p._pct / 100);
    const capped = p._cap ? Math.min(comm, p._cap) : comm;
    const net    = margin - capped;
    const withBonus  = Math.round((p.base_price || p.price || 0) * (p._pct + (p._bonus||0)) / 100);
    const cappedBonus = p._cap ? Math.min(withBonus, p._cap) : withBonus;
    return { margin, comm: capped, net, commBonus: cappedBonus, netBonus: margin - cappedBonus };
  },

  _fmt(v) {
    return Math.round(v).toLocaleString('sk-SK') + ' €';
  },

  _wfBadge(wf) {
    const isQuick = wf === 'quick' || wf === 'ai_web';
    return `<span class="badge" style="font-size:10px;background:${isQuick?'rgba(62,207,142,0.12)':'rgba(91,164,245,0.12)'};color:${isQuick?'var(--green)':'var(--blue)'};border:1px solid ${isQuick?'rgba(62,207,142,0.25)':'rgba(91,164,245,0.25)'};">
      ${isQuick ? '⚡ rýchly' : '🏗 projekt'}
    </span>`;
  },

  _renderCalc() {
    const el = document.getElementById('calc-wrap');
    if (!el) return;

    const products = this._products;
    const totMargin = products.reduce((a,p) => a + this._calc(p).margin, 0);
    const totComm   = products.reduce((a,p) => a + this._calc(p).comm,   0);
    const totNet    = products.reduce((a,p) => a + this._calc(p).net,     0);

    const subcats = [...new Set(products.map(p => p.subcategory || 'Ostatné'))];

    const tableRows = (sub) => products
      .filter(p => (p.subcategory||'Ostatné') === sub)
      .map(p => {
        const c = this._calc(p);
        const netColor = c.net < 0 ? 'var(--red)' : c.net < 50 ? 'var(--acc)' : 'var(--green)';
        const pid = p.id;
        return `
          <tr style="border-bottom:1px solid var(--brd);">
            <td style="padding:8px;font-size:13px;">
              <div style="font-weight:600;">${esc(p.name)}</div>
              <div style="margin-top:3px;">${this._wfBadge(p.workflow_type)}</div>
            </td>
            <td style="padding:8px;text-align:right;font-size:13px;" class="mono">${this._fmt(p.base_price||p.price||0)}</td>
            <td style="padding:8px;text-align:right;font-size:13px;color:var(--muted);" class="mono">${this._fmt(p.cost_price||0)}</td>
            <td style="padding:8px;text-align:right;font-size:13px;" class="mono">${this._fmt(c.margin)}</td>
            <td style="padding:8px;min-width:140px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <input type="range" min="0" max="30" step="1" value="${p._pct}"
                  style="width:80px;"
                  oninput="commissionCalcView._setPct('${pid}',+this.value,this)">
                <span id="pct-${pid}" style="min-width:30px;font-size:13px;font-weight:600;">${p._pct}%</span>
              </div>
            </td>
            <td style="padding:8px;text-align:right;font-size:13px;color:var(--acc);" class="mono" id="comm-${pid}">${this._fmt(c.comm)}</td>
            <td style="padding:8px;min-width:110px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <input type="range" min="0" max="10" step="1" value="${p._bonus||0}"
                  style="width:60px;"
                  oninput="commissionCalcView._setBonus('${pid}',+this.value,this)">
                <span id="bonus-${pid}" style="min-width:30px;font-size:13px;">+${p._bonus||0}%</span>
              </div>
            </td>
            <td style="padding:8px;">
              <input type="number" min="0" step="10" value="${p._cap||''}" placeholder="—"
                style="width:70px;font-size:12px;"
                oninput="commissionCalcView._setCap('${pid}', this.value ? +this.value : null)">
            </td>
            <td style="padding:8px;text-align:right;font-size:14px;font-weight:700;color:${netColor};" id="net-${pid}">${this._fmt(c.net)}</td>
          </tr>`;
      }).join('');

    el.innerHTML = `
      <!-- Globálne nastavenie -->
      <div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="font-size:13px;color:var(--muted);">Globálna provízia:</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="range" min="0" max="30" step="1" value="10" id="global-slider" style="width:140px;"
            oninput="document.getElementById('global-val').textContent=this.value+'%'">
          <span id="global-val" style="font-size:14px;font-weight:600;min-width:36px;">10%</span>
        </div>
        <button class="btn-ghost" style="font-size:12px;" onclick="commissionCalcView._applyGlobal()">
          Aplikovať na všetky
        </button>
        <div style="margin-left:auto;display:flex;gap:10px;">
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Celk. marža</div>
            <div class="mono" style="font-size:16px;font-weight:700;color:var(--green);" id="tot-margin">${this._fmt(totMargin)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Celk. provízie</div>
            <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);" id="tot-comm">${this._fmt(totComm)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Ostáva tebe</div>
            <div class="mono" style="font-size:16px;font-weight:700;color:var(--green);" id="tot-net">${this._fmt(totNet)}</div>
          </div>
        </div>
      </div>

      <!-- Tabuľky podľa podkategórie -->
      ${subcats.map(sub => `
        <div style="margin-bottom:20px;">
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;
            margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--brd);">${esc(sub)}</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--brd);">
                  <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Cena</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Náklad</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Marža</th>
                  <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Provízia %</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Provízia €</th>
                  <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Bonus ref.</th>
                  <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Strop €</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Ostáva</th>
                </tr>
              </thead>
              <tbody>${tableRows(sub)}</tbody>
            </table>
          </div>
        </div>`).join('')}

      <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.6;">
        Bonus ref. = extra % ak obchodník = referrer daného člena. Strop = max. výška provízie v €.
        Po nastavení klikni <strong>Uložiť pravidlá do DB</strong>.
      </div>`;
  },

  _setPct(id, val, input) {
    const p = this._products.find(x => x.id === id);
    if (!p) return;
    p._pct = val;
    const el = document.getElementById('pct-' + id);
    if (el) el.textContent = val + '%';
    this._updateRow(id);
  },

  _setBonus(id, val, input) {
    const p = this._products.find(x => x.id === id);
    if (!p) return;
    p._bonus = val;
    const el = document.getElementById('bonus-' + id);
    if (el) el.textContent = '+' + val + '%';
    this._updateRow(id);
  },

  _setCap(id, val) {
    const p = this._products.find(x => x.id === id);
    if (!p) return;
    p._cap = val;
    this._updateRow(id);
  },

  _updateRow(id) {
    const p = this._products.find(x => x.id === id);
    if (!p) return;
    const c = this._calc(p);
    const commEl = document.getElementById('comm-' + id);
    const netEl  = document.getElementById('net-'  + id);
    if (commEl) commEl.textContent = this._fmt(c.comm);
    if (netEl) {
      netEl.textContent = this._fmt(c.net);
      netEl.style.color = c.net < 0 ? 'var(--red)' : c.net < 50 ? 'var(--acc)' : 'var(--green)';
    }
    this._updateTotals();
  },

  _updateTotals() {
    const totMargin = this._products.reduce((a,p) => a + this._calc(p).margin, 0);
    const totComm   = this._products.reduce((a,p) => a + this._calc(p).comm,   0);
    const totNet    = this._products.reduce((a,p) => a + this._calc(p).net,     0);
    const m = document.getElementById('tot-margin');
    const c = document.getElementById('tot-comm');
    const n = document.getElementById('tot-net');
    if (m) m.textContent = this._fmt(totMargin);
    if (c) c.textContent = this._fmt(totComm);
    if (n) n.textContent = this._fmt(totNet);
  },

  _applyGlobal() {
    const val = Number(document.getElementById('global-slider').value);
    this._products.forEach(p => {
      p._pct = val;
      const el = document.getElementById('pct-' + p.id);
      if (el) el.textContent = val + '%';
      const slider = document.querySelector(`input[oninput*="${p.id}"][type="range"]`);
    });
    // Re-render tabuľky (slidery potrebujú reset value)
    this._renderCalc();
  },

  async saveRules() {
    const btn = document.getElementById('save-rules-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Ukladám...'; }

    // Pridaj stĺpce ak neexistujú
    try {
      await db.client.rpc('exec_sql', { sql: `
        alter table products add column if not exists commission_percent numeric default 0;
        alter table products add column if not exists referral_bonus_pct numeric default 0;
        alter table products add column if not exists commission_cap     numeric;
      `});
    } catch {}

    let saved = 0, errors = 0;
    for (const p of this._products) {
      try {
        const { error } = await db.client.from('products').update({
          commission_percent: p._pct,
          referral_bonus_pct: p._bonus || 0,
          commission_cap:     p._cap   || null,
          commission_enabled: true,
        }).eq('id', p.id);
        if (error) { errors++; console.error(error); }
        else saved++;
      } catch(e) { errors++; }
    }

    // Refresh produktov v app.state
    app.state.products = this._products;

    if (btn) {
      btn.disabled = false;
      btn.textContent = errors > 0
        ? `⚠️ Uložené ${saved}/${this._products.length}`
        : `✓ Uložené (${saved} produktov)`;
      setTimeout(() => { btn.textContent = '💾 Uložiť pravidlá do DB'; }, 3000);
    }
  },
};
