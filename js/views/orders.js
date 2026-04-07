// ── views/orders.js ───────────────────────────────────────────────────────────

const ordersView = {
  _filter: 'all',

  render() {
    const { orders = [], contacts, deals } = app.state;
    const cName = id => contacts.find(c => c.id === id)?.name || '—';
    const dName = id => deals.find(d => d.id === id)?.title || '—';

    const summary = Object.keys(ORDER_STATUS_LABELS).map(s => ({
      s, cnt: orders.filter(o => o.status === s).length,
      val: orders.filter(o => o.status === s).reduce((a, o) => a + (o.value || 0), 0),
    }));

    const totalVal     = orders.reduce((a, o) => a + (o.value || 0), 0);
    const completedVal = orders.filter(o => o.status === 'completed').reduce((a, o) => a + (o.value || 0), 0);

    const filtered = orders
      .filter(o => this._filter === 'all' || o.status === this._filter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return `
      <div class="view-head">
        <h2>Objednávky</h2>
        <button class="btn-primary" onclick="ordersView.openAdd()">+ Nová objednávka</button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Celkový obrat</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--acc);margin-top:4px;">${EUR(totalVal)}</div>
          <div class="stat-sub">${orders.length} objednávok</div>
        </div>
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Dokončené</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--green);margin-top:4px;">${EUR(completedVal)}</div>
          <div class="stat-sub">${summary.find(s=>s.s==='completed')?.cnt||0} objednávok</div>
        </div>
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">V realizácii</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--purple);margin-top:4px;">${EUR(summary.find(s=>s.s==='in_progress')?.val||0)}</div>
          <div class="stat-sub">${summary.find(s=>s.s==='in_progress')?.cnt||0} objednávok</div>
        </div>
        <div class="card" style="flex:1;min-width:130px;">
          <div class="stat-label">Čaká na platbu</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--acc);margin-top:4px;">${EUR(summary.find(s=>s.s==='pending_payment')?.val||0)}</div>
          <div class="stat-sub">${summary.find(s=>s.s==='pending_payment')?.cnt||0} objednávok</div>
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="filter-tab${this._filter==='all'?' active':''}"
          onclick="ordersView._filter='all'; app.renderContent();">Všetky (${orders.length})</button>
        ${summary.filter(s => s.cnt > 0).map(s => `
          <button class="filter-tab${this._filter===s.s?' active':''}"
            style="${this._filter===s.s?`color:${ORDER_STATUS_COLORS[s.s]};border-color:${ORDER_STATUS_COLORS[s.s]};background:${ORDER_STATUS_COLORS[s.s]}18;`:''}"
            onclick="ordersView._filter='${s.s}'; app.renderContent();">
            ${esc(ORDER_STATUS_LABELS[s.s])} (${s.cnt})
          </button>`).join('')}
      </div>

      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
            <div style="font-size:28px;margin-bottom:8px;">📦</div>
            <div>Žiadne objednávky</div>
           </div>`
        : `<div class="list">
            ${filtered.map(o => `
              <div class="card" style="cursor:pointer;" onclick="ordersView.openEdit('${o.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                      ${orderBadge(o.status)}
                      <span class="mono" style="font-weight:700;font-size:15px;color:var(--txt);">${EUR(o.value)}</span>
                    </div>
                    <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
                      ${o.contactId ? `<span>👤 ${esc(cName(o.contactId))}</span>` : ''}
                      ${o.dealId    ? `<span>📊 ${esc(dName(o.dealId))}</span>`    : ''}
                      <span>📅 ${FMT(o.createdAt)}</span>
                    </div>
                    ${o.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:5px;">${esc(o.notes)}</div>` : ''}
                  </div>
                  <!-- Quick status update -->
                  <select onclick="event.stopPropagation();"
                    onchange="ordersView.quickStatus('${o.id}', this.value)"
                    style="font-size:12px;width:auto;border-color:${ORDER_STATUS_COLORS[o.status]};color:${ORDER_STATUS_COLORS[o.status]};">
                    ${Object.entries(ORDER_STATUS_LABELS).map(([k,v]) =>
                      `<option value="${k}"${o.status===k?' selected':''}>${v}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  _form(o, isNew) {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}"${o.contactId===c.id?' selected':''}>${esc(c.name)}</option>`
    ).join('');
    const dOpts = app.state.deals.map(d =>
      `<option value="${d.id}"${o.dealId===d.id?' selected':''}>${esc(d.title)}</option>`
    ).join('');

    return `
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="of-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Lead / Obchod</label>
        <select id="of-deal"><option value="">— vybrať —</option>${dOpts}</select></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="of-status">
          ${Object.entries(ORDER_STATUS_LABELS).map(([k,v]) =>
            `<option value="${k}"${(o.status||'pending_payment')===k?' selected':''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="of-product">
          <option value="">— vybrať produkt —</option>
          ${(app.state.products||[]).filter(p=>p.active).map(p=>
            `<option value="${p.id}"${o.productId===p.id?' selected':''}>${esc(p.name)} — ${EUR(p.price)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-row"><label class="form-label">Hodnota (€) *</label>
        <input id="of-value" type="number" value="${o.value||''}" /></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="of-notes" style="min-height:60px;resize:vertical;">${esc(o.notes||'')}</textarea></div>
      <div id="of-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <div class="form-actions">
        <button class="btn-primary" id="of-submit" onclick="ordersView.save('${o.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="ordersView.delete('${o.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  openAdd()    { modal.open('Nová objednávka', this._form({ contactId:'', dealId:'', status:'pending_payment', value:'', notes:'' }, true)); },
  openEdit(id) { const o = (app.state.orders||[]).find(x => x.id === id); if(o) modal.open('Upraviť objednávku', this._form(o, false)); },

  async quickStatus(id, status) {
    try {
      const orig    = (app.state.orders||[]).find(o => o.id === id);
      const updated = await db.updateOrder(id, { ...orig, status });
      app.state.orders = (app.state.orders||[]).map(o => o.id === id ? updated : o);
      app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

  async save(id, isNew) {
    const value = this._val('of-value');
    const errEl = document.getElementById('of-error');
    errEl.style.display = 'none';
    if (!value) { errEl.textContent = 'Zadaj hodnotu objednávky.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('of-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      contactId: this._val('of-contact') || null,
      dealId:    this._val('of-deal')    || null,
      productId: this._val('of-product') || null,
      status:    this._val('of-status')  || 'pending_payment',
      value:     Number(value) || 0,
      notes:     this._val('of-notes'),
    };

    try {
      if (isNew) {
        const created = await db.createOrder(obj);
        if (!app.state.orders) app.state.orders = [];
        app.state.orders.unshift(created);
      } else {
        const orig    = (app.state.orders||[]).find(o => o.id === id);
        const updated = await db.updateOrder(id, { ...orig, ...obj });
        app.state.orders = (app.state.orders||[]).map(o => o.id === id ? updated : o);
      }
      modal.close(); app.renderContent();
    } catch(e) {
      errEl.textContent = 'Chyba: ' + (e.message || 'skús znova');
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať objednávku?')) return;
    try {
      await db.deleteOrder(id);
      app.state.orders = (app.state.orders||[]).filter(o => o.id !== id);
      modal.close(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
