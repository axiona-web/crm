// ── views/commissions.js ─────────────────────────────────────────────────────

const commissionsView = {
  render() {
    const { commissions, contacts, deals } = app.state;
    const cName = id => contacts.find(c=>c.id===id)?.name||'—';
    const dName = id => deals.find(d=>d.id===id)?.name||'—';
    const pending = commissions.filter(c=>c.status==='Čakajúca').reduce((a,c)=>a+c.amount,0);
    const paid    = commissions.filter(c=>c.status==='Vyplatená').reduce((a,c)=>a+c.amount,0);
    const sorted  = [...commissions].sort((a,b)=>new Date(b.date)-new Date(a.date));

    return `
      <div class="view-head">
        <h2>Provízie</h2>
        <button class="btn-primary" onclick="commissionsView.openAdd()">+ Pridať províziu</button>
      </div>
      <div class="comm-stats">
        <div class="card stat-card"><div class="stat-label">Čakajúce</div><div class="stat-value mono" style="color:var(--acc);font-size:19px;">${EUR(pending)}</div></div>
        <div class="card stat-card"><div class="stat-label">Vyplatené</div><div class="stat-value mono" style="color:var(--green);font-size:19px;">${EUR(paid)}</div></div>
        <div class="card stat-card"><div class="stat-label">Celkom</div><div class="stat-value mono" style="font-size:19px;">${EUR(pending+paid)}</div></div>
      </div>
      ${sorted.length===0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadne provízie</div>`
        : `<div class="list">
            ${sorted.map(c=>`
              <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                      <span class="mono" style="font-weight:700;font-size:16px;color:${c.status==='Vyplatená'?'var(--green)':'var(--acc)'};">${EUR(c.amount)}</span>
                      ${badge(c.status, c.status==='Vyplatená'?'var(--green)':'var(--acc)')}
                      ${c.rate?`<span style="font-size:11px;color:var(--muted);">${c.rate}%</span>`:''}
                    </div>
                    <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);">
                      ${c.contactId?`<span>👤 ${esc(cName(c.contactId))}</span>`:''}
                      ${c.dealId?`<span>📁 ${esc(dName(c.dealId))}</span>`:''}
                      <span>📅 ${FMT(c.date)}</span>
                    </div>
                    ${c.notes?`<div style="font-size:12px;color:var(--muted);margin-top:4px;">${esc(c.notes)}</div>`:''}
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button class="btn-ghost" style="padding:5px 10px;font-size:12px;color:${c.status==='Čakajúca'?'var(--green)':'var(--muted)'};"
                      onclick="commissionsView.toggle('${c.id}')">
                      ${c.status==='Čakajúca'?'✓ Vyplatiť':'↩ Vrátiť'}
                    </button>
                    <button class="icon-btn" onclick="commissionsView.openEdit('${c.id}')">✏️</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  async toggle(id) {
    const c = app.state.commissions.find(x=>x.id===id); if(!c) return;
    const newStatus = c.status==='Čakajúca' ? 'Vyplatená' : 'Čakajúca';
    const updated = await db.updateCommission(id, {...c, status: newStatus});
    app.state.commissions = app.state.commissions.map(x=>x.id===id ? updated : x);
    app.renderContent();
  },

  _form(c, isNew) {
    const cOpts = app.state.contacts.map(x=>`<option value="${x.id}"${c.contactId===x.id?' selected':''}>${esc(x.name)}</option>`).join('');
    const dOpts = app.state.deals.map(x=>`<option value="${x.id}"${c.dealId===x.id?' selected':''}>${esc(x.name)}</option>`).join('');
    return `
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Suma (€) *</label><input id="cm-amount" type="number" value="${c.amount||''}" /></div>
        <div class="form-row"><label class="form-label">Sadzba (%)</label><input id="cm-rate" type="number" value="${c.rate||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="cm-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Obchod</label>
        <select id="cm-deal"><option value="">— vybrať —</option>${dOpts}</select></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Stav</label>
          <select id="cm-status">
            <option${c.status==='Čakajúca'?' selected':''}>Čakajúca</option>
            <option${c.status==='Vyplatená'?' selected':''}>Vyplatená</option>
          </select></div>
        <div class="form-row"><label class="form-label">Dátum</label><input id="cm-date" type="date" value="${c.date||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="cm-notes" style="min-height:55px;resize:vertical;">${esc(c.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="commissionsView.save('${c.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew?`<button class="btn-danger" style="margin-left:auto;" onclick="commissionsView.delete('${c.id}')">Vymazať</button>`:''}
      </div>`;
  },

  openAdd()    { modal.open('Nová provízia', this._form({dealId:'',contactId:'',amount:'',rate:'',status:'Čakajúca',date:new Date().toISOString().slice(0,10),notes:''}, true)); },
  openEdit(id) { const c=app.state.commissions.find(x=>x.id===id); if(c) modal.open('Upraviť províziu', this._form(c, false)); },

  async save(id, isNew) {
    const obj = {
      amount:    Number(document.getElementById('cm-amount').value)||0,
      rate:      Number(document.getElementById('cm-rate').value)||0,
      contactId: document.getElementById('cm-contact').value,
      dealId:    document.getElementById('cm-deal').value,
      status:    document.getElementById('cm-status').value,
      date:      document.getElementById('cm-date').value,
      notes:     document.getElementById('cm-notes').value.trim(),
    };
    if (!obj.amount) return;
    try {
      if (isNew) {
        const created = await db.createCommission(obj);
        app.state.commissions.unshift(created);
      } else {
        const orig = app.state.commissions.find(c=>c.id===id);
        const updated = await db.updateCommission(id, {...orig,...obj});
        app.state.commissions = app.state.commissions.map(c=>c.id===id ? updated : c);
      }
      modal.close(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async delete(id) {
    if (!confirm('Vymazať províziu?')) return;
    try {
      await db.deleteCommission(id);
      app.state.commissions = app.state.commissions.filter(c=>c.id!==id);
      modal.close(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
