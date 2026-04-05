// ── views/contacts.js ────────────────────────────────────────────────────────

const contactsView = {
  search: '',
  filter: 'Všetci',

  render() {
    const filtered = app.state.contacts.filter(c => {
      const q  = this.search.toLowerCase();
      const ms = !q
        || c.name.toLowerCase().includes(q)
        || (c.company || '').toLowerCase().includes(q)
        || (c.email   || '').toLowerCase().includes(q)
        || (c.ico     || '').toLowerCase().includes(q);
      const mt = this.filter === 'Všetci' || c.type === this.filter;
      return ms && mt;
    });

    const typeC = { Klient:'var(--blue)', Obchodník:'var(--acc)', Partner:'var(--purple)' };
    const entityIcon = c => c.entityType === 'pravnicka' ? '🏢' : '👤';

    return `
      <div class="view-head">
        <h2>Kontakty</h2>
        <button class="btn-primary" onclick="contactsView.openAdd()">+ Pridať kontakt</button>
      </div>

      <div class="search-bar">
        <input style="max-width:260px;" placeholder="Hľadať..."
          value="${esc(this.search)}"
          oninput="contactsView.search=this.value; app.renderContent();" />
        <div class="filter-tabs">
          ${['Všetci', ...CONTACT_TYPES].map(t =>
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
                      <span style="font-size:15px;">${entityIcon(c)}</span>
                      <span style="font-weight:700;font-size:14px;">${esc(c.name)}</span>
                      ${badge(c.type, typeC[c.type] || 'var(--muted)')}
                      <span class="badge" style="background:var(--surf);color:var(--muted);border:1px solid var(--brd);font-size:10px;">
                        ${c.entityType === 'pravnicka' ? 'Práv. osoba' : 'Fyz. osoba'}
                      </span>
                    </div>
                    <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);margin-top:3px;flex-wrap:wrap;">
                      ${c.entityType === 'pravnicka' && c.ico ? `<span>IČO: ${esc(c.ico)}</span>` : ''}
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
    const isFyz = (c.entityType || 'fyzicka') === 'fyzicka';
    return `
      <!-- Typ osoby toggle -->
      <div class="form-row">
        <label class="form-label">Typ osoby</label>
        <div style="display:flex;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:3px;gap:3px;">
          <button type="button" id="btn-fyz"
            onclick="contactsView._switchEntity('fyzicka')"
            style="flex:1;padding:7px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;
              background:${isFyz ? 'var(--card)' : 'transparent'};
              color:${isFyz ? 'var(--txt)' : 'var(--muted)'};
              font-weight:${isFyz ? '600' : '400'};">
            👤 Fyzická osoba
          </button>
          <button type="button" id="btn-prav"
            onclick="contactsView._switchEntity('pravnicka')"
            style="flex:1;padding:7px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;
              background:${!isFyz ? 'var(--card)' : 'transparent'};
              color:${!isFyz ? 'var(--txt)' : 'var(--muted)'};
              font-weight:${!isFyz ? '600' : '400'};">
            🏢 Právnická osoba
          </button>
        </div>
      </div>

      <!-- Fyzická osoba polia -->
      <div id="fields-fyzicka" style="display:${isFyz ? '' : 'none'};">
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">Meno *</label><input id="cf-firstname" value="${esc(c.firstName||'')}" /></div>
          <div class="form-row"><label class="form-label">Priezvisko *</label><input id="cf-lastname" value="${esc(c.lastName||'')}" /></div>
        </div>
      </div>

      <!-- Právnická osoba polia -->
      <div id="fields-pravnicka" style="display:${!isFyz ? '' : 'none'};">
        <div class="form-row"><label class="form-label">Názov spoločnosti *</label><input id="cf-companyname" value="${esc(c.companyName||'')}" /></div>
        <div class="form-row"><label class="form-label">IČO</label><input id="cf-ico" value="${esc(c.ico||'')}" /></div>
      </div>

      <!-- Spoločné polia -->
      <div class="form-row">
        <label class="form-label">Typ</label>
        <select id="cf-type">${CONTACT_TYPES.map(t=>`<option${c.type===t?' selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Telefón</label><input id="cf-phone" value="${esc(c.phone||'')}" /></div>
        <div class="form-row"><label class="form-label">Email</label><input id="cf-email" type="email" value="${esc(c.email||'')}" /></div>
      </div>
      <div class="form-row">
        <label class="form-label">Poznámky</label>
        <textarea id="cf-notes" style="min-height:60px;resize:vertical;">${esc(c.notes||'')}</textarea>
      </div>

      <input type="hidden" id="cf-entitytype" value="${isFyz ? 'fyzicka' : 'pravnicka'}" />

      <div class="form-actions">
        <button class="btn-primary" onclick="contactsView.save('${c.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="contactsView.delete('${c.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  _switchEntity(type) {
    document.getElementById('cf-entitytype').value = type;
    const isFyz = type === 'fyzicka';

    document.getElementById('fields-fyzicka').style.display  = isFyz ? '' : 'none';
    document.getElementById('fields-pravnicka').style.display = isFyz ? 'none' : '';

    const btnFyz  = document.getElementById('btn-fyz');
    const btnPrav = document.getElementById('btn-prav');

    btnFyz.style.background  = isFyz ? 'var(--card)' : 'transparent';
    btnFyz.style.color       = isFyz ? 'var(--txt)' : 'var(--muted)';
    btnFyz.style.fontWeight  = isFyz ? '600' : '400';
    btnPrav.style.background = isFyz ? 'transparent' : 'var(--card)';
    btnPrav.style.color      = isFyz ? 'var(--muted)' : 'var(--txt)';
    btnPrav.style.fontWeight = isFyz ? '400' : '600';
  },

  openAdd() {
    modal.open('Nový kontakt', this._form({
      entityType:'fyzicka', firstName:'', lastName:'',
      companyName:'', ico:'', phone:'', email:'', type:'Klient', notes:'',
    }, true));
  },

  openEdit(id) {
    const c = app.state.contacts.find(x => x.id === id);
    if (c) modal.open('Upraviť kontakt', this._form(c, false));
  },

  async save(id, isNew) {
    const entityType = document.getElementById('cf-entitytype').value;
    const isFyz      = entityType === 'fyzicka';

    const obj = {
      entityType,
      firstName:   isFyz ? document.getElementById('cf-firstname').value.trim() : '',
      lastName:    isFyz ? document.getElementById('cf-lastname').value.trim()  : '',
      companyName: !isFyz ? document.getElementById('cf-companyname').value.trim() : '',
      ico:         !isFyz ? document.getElementById('cf-ico').value.trim() : '',
      type:    document.getElementById('cf-type').value,
      phone:   document.getElementById('cf-phone').value.trim(),
      email:   document.getElementById('cf-email').value.trim(),
      notes:   document.getElementById('cf-notes').value.trim(),
    };

    // Validácia
    if (isFyz && !obj.firstName && !obj.lastName) { alert('Zadaj meno alebo priezvisko.'); return; }
    if (!isFyz && !obj.companyName) { alert('Zadaj názov spoločnosti.'); return; }

    try {
      if (isNew) {
        const created = await db.createContact(obj);
        app.state.contacts.unshift(created);
      } else {
        const orig    = app.state.contacts.find(c => c.id === id);
        const updated = await db.updateContact(id, { ...orig, ...obj });
        app.state.contacts = app.state.contacts.map(c => c.id === id ? updated : c);
      }
      modal.close();
      app.updateFooter();
      app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async delete(id) {
    if (!confirm('Vymazať kontakt?')) return;
    try {
      await db.deleteContact(id);
      app.state.contacts = app.state.contacts.filter(c => c.id !== id);
      modal.close();
      app.updateFooter();
      app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
