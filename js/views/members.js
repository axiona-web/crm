// ── js/views/members.js — správa členov ──────────────────────────────────────

const membersView = {
  search: '',
  filter: 'Všetci',

  render() {
    const role    = auth.profile?.role;
    const isAdmin = role === 'admin';
    const title   = role === 'partner' ? 'Moji klienti' : 'Členovia';

    const filtered = app.state.contacts.filter(c => {
      const q  = this.search.toLowerCase();
      const ms = !q
        || c.name.toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q)
        || (c.ico   || '').toLowerCase().includes(q);
      const mt = this.filter === 'Všetci' || c.type === this.filter;
      return ms && mt;
    });

    const typeC = { Člen:'var(--green)', Firma:'var(--acc)', Iné:'var(--muted)' };
    const entityIcon = c => c.entityType === 'pravnicka' ? '🏢' : '👤';

    return `
      <div class="view-head">
        <h2>${title}</h2>
        ${role !== 'partner' ? `<button class="btn-primary" onclick="membersView.openAdd()">+ Pridať člena</button>` : ''}
      </div>

      <div class="search-bar">
        <input style="max-width:260px;" placeholder="Hľadať..."
          value="${esc(this.search)}"
          oninput="membersView.search=this.value; app.renderContent();" />
        <div class="filter-tabs">
          ${['Všetci', ...CONTACT_TYPES].map(t =>
            `<button class="filter-tab${this.filter===t?' active':''}"
              onclick="membersView.filter='${t}'; app.renderContent();">${t}</button>`
          ).join('')}
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
            <div style="font-size:28px;margin-bottom:8px;">👥</div>
            <div>Žiadni členovia</div>
            ${role !== 'partner' ? `<div style="margin-top:12px;"><button class="btn-primary" onclick="membersView.openAdd()">+ Pridať prvého člena</button></div>` : ''}
           </div>`
        : `<div class="list">
            ${filtered.map(c => `
              <div class="card" style="cursor:pointer;" onclick="memberDetailView.open('${c.id}')">
                <div class="list-item">
                  <div>
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap;">
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
                  <div style="font-size:11px;color:var(--muted);white-space:nowrap;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                    <span>${FMT(c.createdAt)}</span>
                    <button class="btn-ghost" style="font-size:11px;padding:3px 8px;"
                      onclick="event.stopPropagation();membersView.openEdit('${c.id}')">✏️ Upraviť</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  _form(c, isNew) {
    const isFyz  = (c.entityType || 'fyzicka') === 'fyzicka';
    const btnSt  = active =>
      `flex:1;padding:8px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;
       background:${active?'var(--card)':'transparent'};color:${active?'var(--txt)':'var(--muted)'};font-weight:${active?'600':'400'};`;

    const inviteNote = isNew ? `
      <div style="background:rgba(91,164,245,0.08);border:1px solid rgba(91,164,245,0.2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--blue);">
        ℹ️ Členovi bude zaslaný email s odkazom na nastavenie hesla.
      </div>` : '';

    return `
      ${inviteNote}
      <input type="hidden" id="cf-entitytype" value="${isFyz?'fyzicka':'pravnicka'}" />

      <div class="form-row">
        <label class="form-label">Typ osoby</label>
        <div style="display:flex;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:3px;gap:3px;">
          <button type="button" id="btn-fyz"  onclick="membersView._switchEntity('fyzicka')"  style="${btnSt(isFyz)}">👤 Fyzická osoba</button>
          <button type="button" id="btn-prav" onclick="membersView._switchEntity('pravnicka')" style="${btnSt(!isFyz)}">🏢 Právnická osoba</button>
        </div>
      </div>

      <div id="fields-fyzicka" style="display:${isFyz?'':'none'};">
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">Meno *</label><input id="cf-firstname" value="${esc(c.firstName||'')}" /></div>
          <div class="form-row"><label class="form-label">Priezvisko *</label><input id="cf-lastname" value="${esc(c.lastName||'')}" /></div>
        </div>
      </div>

      <div id="fields-pravnicka" style="display:${!isFyz?'':'none'};">
        <div class="form-row"><label class="form-label">Názov spoločnosti *</label><input id="cf-companyname" value="${esc(c.companyName||'')}" /></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">IČO *</label><input id="cf-ico" value="${esc(c.ico||'')}" /></div>
          <div class="form-row"><label class="form-label">IČ DPH</label><input id="cf-ic-dph" value="${esc(c.ic_dph||'')}" placeholder="SK2020..." /></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;margin-bottom:4px;">
          <input type="checkbox" id="cf-vat-payer" ${c.is_vat_payer?'checked':''} />
          <label for="cf-vat-payer" style="font-size:13px;cursor:pointer;">
            Platca DPH
            <span style="font-size:11px;color:var(--muted);margin-left:4px;">(informácia o subjekte — daňový režim faktúry sa nastavuje pri fakturácii)</span>
          </label>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label">Typ</label>
        <select id="cf-type">${CONTACT_TYPES.map(t=>`<option${c.type===t?' selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Telefón *</label><input id="cf-phone" type="tel" value="${esc(c.phone||'')}" /></div>
        <div class="form-row"><label class="form-label">Email *</label><input id="cf-email" type="email" value="${esc(c.email||'')}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="cf-notes" style="min-height:60px;resize:vertical;">${esc(c.notes||'')}</textarea></div>

      <div id="cf-error" style="display:none;color:var(--red);font-size:12px;padding:8px 10px;background:rgba(242,85,85,0.1);border-radius:6px;margin-bottom:4px;"></div>

      <div class="form-actions">
        <button type="button" class="btn-primary" id="cf-submit"
          onclick="membersView.save('${c.id||''}',${isNew})">
          ${isNew ? 'Pridať a pozvať' : 'Uložiť'}
        </button>
        <button type="button" class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button type="button" class="btn-danger" style="margin-left:auto;" onclick="membersView.delete('${c.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  _switchEntity(type) {
    document.getElementById('cf-entitytype').value = type;
    const isFyz = type === 'fyzicka';
    document.getElementById('fields-fyzicka').style.display  = isFyz ? '' : 'none';
    document.getElementById('fields-pravnicka').style.display = isFyz ? 'none' : '';
    ['btn-fyz','btn-prav'].forEach((id, i) => {
      const active = (i === 0) === isFyz;
      const el = document.getElementById(id);
      el.style.background = active ? 'var(--card)' : 'transparent';
      el.style.color      = active ? 'var(--txt)'  : 'var(--muted)';
      el.style.fontWeight = active ? '600'          : '400';
    });
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

  _setError(id, has) { const el = document.getElementById(id); if(el) el.style.borderColor = has ? 'var(--red)' : ''; },

  _showError(msg) {
    const el = document.getElementById('cf-error');
    if(el) { el.textContent = msg; el.style.display = 'block'; }
  },

  openAdd()    { modal.open('Nový člen', this._form({name:'',entityType:'fyzicka',firstName:'',lastName:'',companyName:'',ico:'',phone:'',email:'',type:'Člen',notes:''}, true)); },
  openEdit(id) { const c = app.state.contacts.find(x=>x.id===id); if(c) modal.open('Upraviť člena', this._form(c, false)); },

  async save(id, isNew) {
    const entityType = this._val('cf-entitytype') || 'fyzicka';
    const isFyz      = entityType === 'fyzicka';

    ['cf-firstname','cf-lastname','cf-companyname','cf-ico','cf-phone','cf-email'].forEach(i => this._setError(i, false));
    document.getElementById('cf-error').style.display = 'none';

    const firstName   = isFyz  ? this._val('cf-firstname')   : '';
    const lastName    = isFyz  ? this._val('cf-lastname')    : '';
    const companyName = !isFyz ? this._val('cf-companyname') : '';
    const ico         = !isFyz ? this._val('cf-ico')         : '';
    const phone       = this._val('cf-phone');
    const email       = this._val('cf-email');

    const errors = [];
    if (isFyz) {
      if (!firstName) { this._setError('cf-firstname',   true); errors.push('meno'); }
      if (!lastName)  { this._setError('cf-lastname',    true); errors.push('priezvisko'); }
    } else {
      if (!companyName) { this._setError('cf-companyname', true); errors.push('názov spoločnosti'); }
      if (!ico)         { this._setError('cf-ico',         true); errors.push('IČO'); }
    }
    if (!phone) { this._setError('cf-phone', true); errors.push('telefón'); }
    if (!email) { this._setError('cf-email', true); errors.push('email'); }

    if (errors.length) { this._showError('Vyplň povinné polia: ' + errors.join(', ')); return; }

    const btn = document.getElementById('cf-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      entityType, firstName, lastName, companyName, ico, phone, email,
      type: this._val('cf-type') || 'Člen',
      notes: this._val('cf-notes'),
      ic_dph: this._val('cf-ic-dph') || null,
      is_vat_payer: document.getElementById('cf-vat-payer')?.checked || false,
    };

    try {
      if (isNew) {
        const created = await db.createContact(obj);
        app.state.contacts.unshift(created);
        // Ak má email, skús poslať invite (nevadí ak zlyhá — kontakt je vytvorený)
        if (email) {
          db.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
            .catch(() => {}); // ticho — invite je bonus, nie requirement
        }
      } else {
        const orig    = app.state.contacts.find(c => c.id === id);
        const updated = await db.updateContact(id, { ...orig, ...obj });
        app.state.contacts = app.state.contacts.map(c => c.id === id ? updated : c);
      }
      modal.close(); app.updateFooter(); app.renderContent();
    } catch(e) {
      console.error(e);
      this._showError('Chyba: ' + (e.message || 'skús znova'));
      if (btn) { btn.disabled = false; btn.textContent = isNew ? 'Pridať a pozvať' : 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať člena?')) return;
    try {
      await db.deleteContact(id);
      app.state.contacts = app.state.contacts.filter(c => c.id !== id);
      modal.close(); app.updateFooter(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
