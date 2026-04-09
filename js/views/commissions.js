// ── views/commissions.js ─────────────────────────────────────────────────────

const commissionsView = {
  _filter: 'all',

  render() {
    const { commissions, contacts } = app.state;
    const orders = app.state.orders || [];
    const opps   = app.state.opportunities || [];

    const cName = id => contacts.find(c => c.id === id)?.name || '—';
    const oName = id => {
      const order = orders.find(o => o.id === id);
      if (order?.product_name_snapshot) return order.product_name_snapshot;
      const opp = opps.find(o => o.id === id);
      if (opp?.title) return opp.title;
      return '—';
    };

    const pending  = commissions.filter(c => c.status === 'pending').reduce((a,c)  => a + (c.amount||0), 0);
    const approved = commissions.filter(c => c.status === 'approved').reduce((a,c) => a + (c.amount||0), 0);
    const paid     = commissions.filter(c => c.status === 'paid').reduce((a,c)     => a + (c.amount||0), 0);

    const filtered = commissions
      .filter(c => this._filter === 'all' || c.status === this._filter)
      .sort((a, b) => new Date(b.createdAt||b.created_at) - new Date(a.createdAt||a.created_at));

    return `
      <div class="view-head">
        <h2>Provízie</h2>
        <button class="btn-primary" onclick="commissionsView.openAdd()">+ Pridať províziu</button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Čakajúce</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:${COMM_STATUS_COLORS.pending};margin-top:4px;">${EUR(pending)}</div>
        </div>
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Schválené</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:${COMM_STATUS_COLORS.approved};margin-top:4px;">${EUR(approved)}</div>
        </div>
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Vyplatené</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:${COMM_STATUS_COLORS.paid};margin-top:4px;">${EUR(paid)}</div>
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="filter-tab${this._filter==='all'?' active':''}"
          onclick="commissionsView._filter='all'; app.renderContent();">Všetky (${commissions.length})</button>
        ${Object.entries(COMM_STATUS_LABELS).map(([k,v]) => {
          const cnt = commissions.filter(c => c.status === k).length;
          if (!cnt) return '';
          return `<button class="filter-tab${this._filter===k?' active':''}"
            style="${this._filter===k?`color:${COMM_STATUS_COLORS[k]};border-color:${COMM_STATUS_COLORS[k]};background:${COMM_STATUS_COLORS[k]}18;`:''}"
            onclick="commissionsView._filter='${k}'; app.renderContent();">${v} (${cnt})</button>`;
        }).join('')}
      </div>

      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadne provízie</div>`
        : `<div class="list">
            ${filtered.map(c => `
              <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
                      <span class="mono" style="font-weight:700;font-size:16px;">${EUR(c.amount)}</span>
                      ${commBadge(c.status)}
                      ${c.rate ? `<span style="font-size:11px;color:var(--muted);">${c.rate}%</span>` : ''}
                    </div>
                    <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
                      ${c.contactId ? `<span>👤 ${esc(cName(c.contactId))}</span>` : ''}
                      ${c.order_id  ? `<span>📦 ${esc(oName(c.order_id))}</span>`  : ''}
                      ${c.dealId    ? `<span>🎯 ${esc(oName(c.dealId))}</span>`    : ''}
                      <span>📅 ${FMT(c.date||c.createdAt)}</span>
                    </div>
                    ${c.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">${esc(c.notes)}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;">
                    ${c.status === 'pending'  ? `<button class="btn-ghost" style="font-size:12px;color:${COMM_STATUS_COLORS.approved};" onclick="commissionsView.setStatus('${c.id}','approved')">✓ Schváliť</button>` : ''}
                    ${c.status === 'approved' ? `<button class="btn-ghost" style="font-size:12px;color:${COMM_STATUS_COLORS.paid};"     onclick="commissionsView.setStatus('${c.id}','paid')">💳 Vyplatiť</button>` : ''}
                    ${['pending','approved'].includes(c.status) ? `<button class="btn-ghost" style="font-size:12px;color:var(--red);" onclick="commissionsView.setStatus('${c.id}','cancelled')">✕</button>` : ''}
                    <button class="icon-btn" onclick="commissionsView.openEdit('${c.id}')">✏️</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  async setStatus(id, status) {
    try {
      const orig    = app.state.commissions.find(c => c.id === id);
      const updated = await db.updateCommission(id, { ...orig, status });
      app.state.commissions = app.state.commissions.map(c => c.id === id ? updated : c);
      app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  _form(c, isNew) {
    const cOpts = app.state.contacts.map(x =>
      `<option value="${x.id}"${c.contactId===x.id?' selected':''}>${esc(x.name)}</option>`
    ).join('');
    const oOpts = (app.state.opportunities||[]).map(x =>
      `<option value="${x.id}"${(c.dealId||c.order_id)===x.id?' selected':''}>${esc(x.title)} — ${EUR(x.value||0)}</option>`
    ).join('');

    return `
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Suma (€) *</label><input id="cm-amount" type="number" value="${c.amount||''}" /></div>
        <div class="form-row"><label class="form-label">Sadzba (%)</label><input id="cm-rate" type="number" value="${c.rate||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="cm-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Príležitosť</label>
        <select id="cm-deal"><option value="">— vybrať —</option>${oOpts}</select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Stav</label>
          <select id="cm-status">
            ${Object.entries(COMM_STATUS_LABELS).map(([k,v]) =>
              `<option value="${k}"${(c.status||'pending')===k?' selected':''}>${v}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">Dátum</label><input id="cm-date" type="date" value="${c.date||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="cm-notes" style="min-height:55px;resize:vertical;">${esc(c.notes||'')}</textarea></div>
      <div id="cm-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <div class="form-actions">
        <button class="btn-primary" id="cm-submit" onclick="commissionsView.save('${c.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="commissionsView.delete('${c.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  openAdd()    { modal.open('Nová provízia', this._form({ dealId:'', contactId:'', amount:'', rate:'', status:'pending', date: new Date().toISOString().slice(0,10), notes:'' }, true)); },
  openEdit(id) { const c = app.state.commissions.find(x => x.id === id); if(c) modal.open('Upraviť províziu', this._form(c, false)); },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

  async save(id, isNew) {
    const amount = this._val('cm-amount');
    const errEl  = document.getElementById('cm-error');
    errEl.style.display = 'none';
    if (!amount) { errEl.textContent = 'Zadaj sumu.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('cm-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      amount:    Number(amount) || 0,
      rate:      Number(this._val('cm-rate')) || 0,
      contactId: this._val('cm-contact') || null,
      dealId:    this._val('cm-deal')    || null,
      status:    this._val('cm-status')  || 'pending',
      date:      this._val('cm-date'),
      notes:     this._val('cm-notes'),
    };

    try {
      if (isNew) {
        const created = await db.createCommission(obj);
        app.state.commissions.unshift(created);
      } else {
        const orig    = app.state.commissions.find(c => c.id === id);
        const updated = await db.updateCommission(id, { ...orig, ...obj });
        app.state.commissions = app.state.commissions.map(c => c.id === id ? updated : c);
      }
      modal.close(); app.renderContent();
    } catch(e) {
      errEl.textContent = 'Chyba: ' + (e.message || 'skús znova');
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať províziu?')) return;
    try {
      await db.deleteCommission(id);
      app.state.commissions = app.state.commissions.filter(c => c.id !== id);
      modal.close(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
