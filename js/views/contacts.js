// ── views/contacts.js ────────────────────────────────────────────────────────

const contactsView = {
  search: '',
  filter: 'Všetci',

  render() {
    const filtered = app.state.contacts.filter(c => {
      const q  = this.search.toLowerCase();
      const ms = !q || c.name.toLowerCase().includes(q)
               || (c.company||'').toLowerCase().includes(q)
               || (c.email||'').toLowerCase().includes(q);
      const mt = this.filter === 'Všetci' || c.type === this.filter;
      return ms && mt;
    });
    const typeC = { Klient:'var(--blue)', Obchodník:'var(--acc)', Partner:'var(--purple)' };

    return `
      <div class="view-head">
        <h2>Kontakty</h2>
        <button class="btn-primary" onclick="contactsView.openAdd()">+ Pridať kontakt</button>
      </div>
      <div class="search-bar">
        <input style="max-width:260px;" placeholder="Hľadať..."
          value="${esc(this.search)}" oninput="contactsView.search=this.value; app.renderContent();" />
        <div class="filter-tabs">
          ${['Všetci',...CONTACT_TYPES].map(t =>
            `<button class="filter-tab${this.filter===t?' active':''}"
              onclick="contactsView.filter='${t}'; app.renderContent();">${t}</button>`
          ).join('')}
        </div>
      </div>
      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadne kontakty</div>`
        : `<div class="list">
            ${filtered.map(c => `
              <div class="card" style="cursor:pointer;" onclick="contactsView.openEdit('${c.id}')">
                <div class="list-item">
                  <div>
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
                      <span style="font-weight:700;font-size:14px;">${esc(c.name)}</span>
                      ${badge(c.type, typeC[c.type]||'var(--muted)')}
                    </div>
                    ${c.company ? `<div style="font-size:12px;color:var(--muted);margin-bottom:2px;">${esc(c.company)}</div>` : ''}
                    <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);margin-top:3px;">
                      ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
                      ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
                    </div>
                  </div>
                  <div style="font-size:11px;color:var(--muted);white-space:nowrap;">${FMT(c.createdAt)}</div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  _form(c, isNew) {
    return `
      <div class="form-row"><label class="form-label">Meno *</label><input id="cf-name" value="${esc(c.name)}" /></div>
      <div class="form-row"><label class="form-label">Firma</label><input id="cf-company" value="${esc(c.company||'')}" /></div>
      <div class="form-row"><label class="form-label">Typ</label>
        <select id="cf-type">${CONTACT_TYPES.map(t=>`<option${c.type===t?' selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-row"><label class="form-label">Telefón</label><input id="cf-phone" value="${esc(c.phone||'')}" /></div>
      <div class="form-row"><label class="form-label">Email</label><input id="cf-email" type="email" value="${esc(c.email||'')}" /></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="cf-notes" style="min-height:65px;resize:vertical;">${esc(c.notes||'')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="contactsView.save('${c.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="contactsView.delete('${c.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  openAdd()    { modal.open('Nový kontakt', this._form({name:'',company:'',phone:'',email:'',type:'Klient',notes:''}, true)); },
  openEdit(id) { const c=app.state.contacts.find(x=>x.id===id); if(c) modal.open('Upraviť kontakt', this._form(c, false)); },

  async save(id, isNew) {
    const obj = {
      name:    document.getElementById('cf-name').value.trim(),
      company: document.getElementById('cf-company').value.trim(),
      type:    document.getElementById('cf-type').value,
      phone:   document.getElementById('cf-phone').value.trim(),
      email:   document.getElementById('cf-email').value.trim(),
      notes:   document.getElementById('cf-notes').value.trim(),
    };
    if (!obj.name) return;
    try {
      if (isNew) {
        const created = await db.createContact(obj);
        app.state.contacts.unshift(created);
      } else {
        const orig = app.state.contacts.find(c=>c.id===id);
        const updated = await db.updateContact(id, {...orig,...obj});
        app.state.contacts = app.state.contacts.map(c=>c.id===id ? updated : c);
      }
      modal.close(); app.updateFooter(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async delete(id) {
    if (!confirm('Vymazať kontakt?')) return;
    try {
      await db.deleteContact(id);
      app.state.contacts = app.state.contacts.filter(c=>c.id!==id);
      modal.close(); app.updateFooter(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
