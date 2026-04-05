// ── views/contacts.js ────────────────────────────────────────────────────────

const contactsView = {
  search: '',
  filter: 'Všetci',

  render() {
    const filtered = app.state.contacts.filter(c => {
      const q  = this.search.toLowerCase();
      const ms = !q
        || c.name.toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q)
        || (c.ico   || '').toLowerCase().includes(q);
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
                      <span style="font-size:15px;">${c.entityType === 'pravnicka' ? '🏢' : '👤'}</span>
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
    const btnStyle = (active) =>
      `flex:1;padding:8px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;
       background:${active ? 'var(--card)' : 'transparent'};
       color:${active ? 'var(--txt)' : 'var(--muted)'};
       font-weight:${active ? '600' : '400'};`;

    return `
      <input type="hidden" id="cf-entitytype" value="${isFyz ? 'fyzicka' : 'pravnicka'}" />

      <div class="form-row">
        <label class="form-label">Typ osoby</label>
        <div style="display:flex;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:3px;gap:3px;">
          <button type="button" id="btn-fyz"  onclick="contactsView._switchEntity('fyzicka')"  style="${btnStyle(isFyz)}">👤 Fyzická osoba</button>
          <button type="button" id="btn-prav" onclick="contactsView._switchEntity('pravnicka')" style="${btnStyle(!isFyz)}">🏢 Právnická osoba</button>
        </div>
      </div>

      <div id="fields-fyzicka" style="display:${isFyz ? '' : 'none'};">
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">Meno *</label><input id="cf-firstname" value="${esc(c.firstName || '')}" /></div>
          <div class="form-row"><label class="form-label">Priezvisko *</label><input id="cf-lastname" value="${esc(c.lastName || '')}" /></div>
        </div>
      </div>

      <div id="fields-pravnicka" style="display:${!isFyz ? '' : 'none'};">
        <div class="form-row"><label class="form-label">Názov spoločnosti *</label><input id="cf-companyname" value="${esc(c.companyName || '')}" /></div>
        <div class="form-row"><label class="form-label">IČO *</label><input id="cf-ico" value="${esc(c.ico || '')}" /></div>
      </div>

      <div class="form-row">
        <label class="form-label">Typ kontaktu *</label>
        <select id="cf-type">${CONTACT_TYPES.map(t => `<option${c.type===t?' selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Telefón *</label><input id="cf-phone" type="tel" value="${esc(c.phone || '')}" /></div>
        <div class="form-row"><label class="form-label">Email *</label><input id="cf-email" type="email" value="${esc(c.email || '')}" /></div>
      </div>
      <div class="form-row">
        <label class="form-label">Poznámky</label>
        <textarea id="cf-notes" style="min-height:60px;resize:vertical;">${esc(c.notes || '')}</textarea>
      </div>

      <div id="cf-error" style="display:none;color:var(--red);font-size:12px;padding:8px 10px;background:rgba(242,85,85,0.1);border-radius:6px;margin-bottom:4px;"></div>

      <div class="form-actions">
        <button type="button" class="btn-primary" id="cf-submit" onclick="contactsView.save('${c.id || ''}', ${isNew})">Uložiť</button>
        <button type="button" class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button type="button" class="btn-danger" style="margin-left:auto;" onclick="contactsView.delete('${c.id}')">Vymazať</button>` : ''}
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
    // Vymaž chyby pri prepnutí
    this._clearErrors();
  },

  _val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  },

  _setError(id, hasError) {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = hasError ? 'var(--red)' : '';
  },

  _clearErrors() {
    ['cf-firstname','cf-lastname','cf-companyname','cf-ico','cf-phone','cf-email'].forEach(id => this._setError(id, false));
    const errEl = document.getElementById('cf-error');
    if (errEl) errEl.style.display = 'none';
  },

  _showError(msg) {
    const errEl = document.getElementById('cf-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
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
    this._clearErrors();

    const entityType = this._val('cf-entitytype') || 'fyzicka';
    const isFyz      = entityType === 'fyzicka';

    // Zber hodnôt
    const firstName   = isFyz  ? this._val('cf-firstname')   : '';
    const lastName    = isFyz  ? this._val('cf-lastname')    : '';
    const companyName = !isFyz ? this._val('cf-companyname') : '';
    const ico         = !isFyz ? this._val('cf-ico')         : '';
    const phone       = this._val('cf-phone');
    const email       = this._val('cf-email');
    const type        = this._val('cf-type') || 'Klient';
    const notes       = this._val('cf-notes');

    // Validácia
    let errors = [];
    if (isFyz) {
      if (!firstName)   { this._setError('cf-firstname',   true); errors.push('meno'); }
      if (!lastName)    { this._setError('cf-lastname',    true); errors.push('priezvisko'); }
    } else {
      if (!companyName) { this._setError('cf-companyname', true); errors.push('názov spoločnosti'); }
      if (!ico)         { this._setError('cf-ico',         true); errors.push('IČO'); }
    }
    if (!phone) { this._setError('cf-phone', true); errors.push('telefón'); }
    if (!email) { this._setError('cf-email', true); errors.push('email'); }

    if (errors.length > 0) {
      this._showError('Vyplň povinné polia: ' + errors.join(', '));
      return;
    }

    // Uloženie
    const btn = document.getElementById('cf-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = { entityType, firstName, lastName, companyName, ico, phone, email, type, notes };

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
    } catch(e) {
      console.error('Save contact error:', e);
      this._showError('Chyba pri ukladaní: ' + (e.message || 'skús znova'));
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať kontakt?')) return;
    try {
      await db.deleteContact(id);
      app.state.contacts = app.state.contacts.filter(c => c.id !== id);
      modal.close();
      app.updateFooter();
      app.renderContent();
    } catch(e) {
      console.error('Delete contact error:', e);
      alert('Chyba: ' + e.message);
    }
  },
};
