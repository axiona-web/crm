// ── js/views/profile.js ──────────────────────────────────────────────────────

const profileView = {

  render() {
    const p = auth.profile || {};
    const isFyz = (p.entity_type || 'fyzicka') === 'fyzicka';
    const refBy = p.referred_by_name || null;

    const btnStyle = (active) =>
      `flex:1;padding:8px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;
       background:${active?'var(--card)':'transparent'};
       color:${active?'var(--txt)':'var(--muted)'};
       font-weight:${active?'600':'400'};`;

    return `
      <div class="view-head">
        <h2>Môj profil</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn-primary" id="profile-save-btn" onclick="profileView.save()">Uložiť zmeny</button>
        </div>
      </div>

      <div id="profile-error" style="display:none;color:var(--red);font-size:13px;padding:10px 14px;background:rgba(242,85,85,0.1);border:1px solid rgba(242,85,85,0.2);border-radius:8px;margin-bottom:14px;"></div>
      <div id="profile-success" style="display:none;color:var(--green);font-size:13px;padding:10px 14px;background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.2);border-radius:8px;margin-bottom:14px;"></div>

      <!-- Referral kód (readonly) -->
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:10px;color:var(--acc);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Tvoj referral kód</div>
            <div class="mono" style="font-size:26px;font-weight:700;color:var(--acc);letter-spacing:0.12em;">${esc(p.referral_code || '—')}</div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Tvoj referral link</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
                ${window.location.origin}${window.location.pathname}?ref=${esc(p.referral_code||'')}
              </div>
              <button class="btn-ghost" style="font-size:11px;padding:5px 10px;white-space:nowrap;"
                onclick="profileView._copyLink(this)">📋 Kopírovať</button>
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Rola</div>
            <span class="badge" style="background:${p.role==='admin'?'var(--acc)':'var(--blue)'}22;color:${p.role==='admin'?'var(--acc)':'var(--blue)'};border:1px solid ${p.role==='admin'?'var(--acc)':'var(--blue)'}44;font-size:12px;padding:4px 12px;">
              ${p.role === 'admin' ? '⭐ Admin' : 'Partner'}
            </span>
          </div>
        </div>
      </div>

      <!-- Typ osoby -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Typ osoby</div>
        <div style="display:flex;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:3px;gap:3px;max-width:360px;">
          <button type="button" id="prof-btn-fyz"  onclick="profileView._switchEntity('fyzicka')"  style="${btnStyle(isFyz)}">👤 Fyzická osoba</button>
          <button type="button" id="prof-btn-prav" onclick="profileView._switchEntity('pravnicka')" style="${btnStyle(!isFyz)}">🏢 Právnická osoba</button>
        </div>
        <input type="hidden" id="prof-entity-type" value="${isFyz?'fyzicka':'pravnicka'}" />
      </div>

      <!-- Základné údaje -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Základné údaje</div>

        <div id="prof-fields-fyz" style="display:${isFyz?'':'none'};">
          <div class="form-grid-2">
            <div class="form-row"><label class="form-label">Meno *</label><input id="prof-firstname" value="${esc(p.first_name||'')}" /></div>
            <div class="form-row"><label class="form-label">Priezvisko *</label><input id="prof-lastname" value="${esc(p.last_name||'')}" /></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row">
              <label class="form-label">Dátum narodenia</label>
              <input id="prof-birthdate" type="date" value="${esc(p.birth_date||'')}" />
            </div>
            <div class="form-row">
              <label class="form-label">Pohlavie</label>
              <select id="prof-gender">
                <option value="">— nevybrané —</option>
                <option value="muz"${p.gender==='muz'?' selected':''}>Muž</option>
                <option value="zena"${p.gender==='zena'?' selected':''}>Žena</option>
              </select>
            </div>
          </div>
        </div>

        <div id="prof-fields-prav" style="display:${!isFyz?'':'none'};">
          <div class="form-row"><label class="form-label">Názov spoločnosti *</label><input id="prof-companyname" value="${esc(p.company_name||'')}" /></div>
        </div>
      </div>

      <!-- Kontaktné údaje -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Kontaktné údaje</div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">Mobil</label><input id="prof-phone" type="tel" value="${esc(p.phone||'')}" /></div>
          <div class="form-row"><label class="form-label">Súkromný email</label><input id="prof-email-private" type="email" value="${esc(p.email_private||'')}" /></div>
        </div>
        <div class="form-row"><label class="form-label">Ulica</label><input id="prof-street" value="${esc(p.street||'')}" /></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">Mesto</label><input id="prof-city" value="${esc(p.city||'')}" /></div>
          <div class="form-row"><label class="form-label">PSČ</label><input id="prof-zip" value="${esc(p.zip||'')}" /></div>
        </div>
        <div class="form-row">
          <label class="form-label">Krajina</label>
          <select id="prof-country">
            ${['Slovensko','Česká republika','Rakúsko','Maďarsko','Poľsko','Nemecko','Iná'].map(c =>
              `<option${(p.country||'Slovensko')===c?' selected':''}>${c}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Firemné údaje (len PO) -->
      <div id="prof-firma-section" style="display:${!isFyz?'':'none'};">
        <div class="card" style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Firemné údaje</div>
          <div class="form-grid-2">
            <div class="form-row"><label class="form-label">IČO</label><input id="prof-ico" value="${esc(p.ico||'')}" /></div>
            <div class="form-row"><label class="form-label">DIČ</label><input id="prof-dic" value="${esc(p.dic||'')}" /></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label class="form-label">IČ DPH</label><input id="prof-icdph" value="${esc(p.ic_dph||'')}" /></div>
            <div class="form-row">
              <label class="form-label">Platca DPH</label>
              <select id="prof-vatpayer">
                <option value="false"${!p.vat_payer?' selected':''}>Nie</option>
                <option value="true"${p.vat_payer?' selected':''}>Áno</option>
              </select>
            </div>
          </div>
          <div class="form-row"><label class="form-label">IBAN</label><input id="prof-iban" placeholder="SK00 0000 0000 0000 0000 0000" value="${esc(p.iban||'')}" /></div>
        </div>
      </div>

      <!-- Pracovné údaje -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Pracovné údaje</div>
        <div class="form-row">
          <label class="form-label">Pozícia</label>
          <input id="prof-position" value="${esc(p.position||'')}" placeholder="napr. Obchodný zástupca" />
        </div>
        <div class="form-row">
          <label class="form-label">Registrovaný cez</label>
          <div style="padding:9px 12px;background:var(--inp);border:1px solid var(--brd);border-radius:8px;font-size:13px;color:var(--muted);">
            ${refBy ? `🔗 ${esc(refBy)}` : '— priama registrácia'}
          </div>
        </div>
      </div>

      <!-- Doplnkové -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Doplnkové</div>
        <div class="form-row">
          <label class="form-label">LinkedIn</label>
          <input id="prof-linkedin" type="url" placeholder="https://linkedin.com/in/..." value="${esc(p.linkedin||'')}" />
        </div>
        <div class="form-row">
          <label class="form-label">Bio</label>
          <textarea id="prof-bio" style="min-height:80px;resize:vertical;" placeholder="Krátky popis o sebe...">${esc(p.bio||'')}</textarea>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:30px;">
        <button class="btn-primary" onclick="profileView.save()">Uložiť zmeny</button>
      </div>`;
  },

  _switchEntity(type) {
    const isFyz = type === 'fyzicka';
    document.getElementById('prof-entity-type').value = type;
    document.getElementById('prof-fields-fyz').style.display    = isFyz ? '' : 'none';
    document.getElementById('prof-fields-prav').style.display   = isFyz ? 'none' : '';
    document.getElementById('prof-firma-section').style.display = isFyz ? 'none' : '';
    const btnFyz  = document.getElementById('prof-btn-fyz');
    const btnPrav = document.getElementById('prof-btn-prav');
    btnFyz.style.background  = isFyz ? 'var(--card)' : 'transparent';
    btnFyz.style.color       = isFyz ? 'var(--txt)' : 'var(--muted)';
    btnFyz.style.fontWeight  = isFyz ? '600' : '400';
    btnPrav.style.background = isFyz ? 'transparent' : 'var(--card)';
    btnPrav.style.color      = isFyz ? 'var(--muted)' : 'var(--txt)';
    btnPrav.style.fontWeight = isFyz ? '400' : '600';
  },

  _val(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value.trim() : fallback;
  },

  async save() {
    const entityType = this._val('prof-entity-type') || 'fyzicka';
    const isFyz = entityType === 'fyzicka';

    const errEl = document.getElementById('profile-error');
    const sucEl = document.getElementById('profile-success');
    const btn   = document.getElementById('profile-save-btn');
    errEl.style.display = 'none';
    sucEl.style.display = 'none';

    // Validácia
    if (isFyz && !this._val('prof-firstname') && !this._val('prof-lastname')) {
      errEl.textContent   = 'Zadaj aspoň meno alebo priezvisko.';
      errEl.style.display = 'block'; return;
    }
    if (!isFyz && !this._val('prof-companyname')) {
      errEl.textContent   = 'Zadaj názov spoločnosti.';
      errEl.style.display = 'block'; return;
    }

    btn.disabled = true; btn.textContent = 'Ukladám...';

    const updates = {
      entity_type:   entityType,
      first_name:    isFyz  ? this._val('prof-firstname')   : null,
      last_name:     isFyz  ? this._val('prof-lastname')    : null,
      birth_date:    isFyz  ? (this._val('prof-birthdate')  || null) : null,
      gender:        isFyz  ? (this._val('prof-gender')     || null) : null,
      company_name:  !isFyz ? this._val('prof-companyname') : null,
      phone:         this._val('prof-phone')        || null,
      email_private: this._val('prof-email-private')|| null,
      street:        this._val('prof-street')       || null,
      city:          this._val('prof-city')         || null,
      zip:           this._val('prof-zip')          || null,
      country:       this._val('prof-country')      || 'Slovensko',
      ico:           !isFyz ? (this._val('prof-ico')   || null) : null,
      dic:           !isFyz ? (this._val('prof-dic')   || null) : null,
      ic_dph:        !isFyz ? (this._val('prof-icdph') || null) : null,
      vat_payer:     !isFyz ? (this._val('prof-vatpayer') === 'true') : false,
      iban:          !isFyz ? (this._val('prof-iban')  || null) : null,
      position:      this._val('prof-position')     || null,
      linkedin:      this._val('prof-linkedin')     || null,
      bio:           this._val('prof-bio')          || null,
      // Aktualizuj aj name pre zobrazenie
      name: isFyz
        ? [this._val('prof-firstname'), this._val('prof-lastname')].filter(Boolean).join(' ')
        : this._val('prof-companyname'),
    };

    try {
      const { error } = await db.client
        .from('profiles')
        .update(updates)
        .eq('id', auth.user.id);
      if (error) throw error;

      // Refresh profil
      auth.profile = await db.getProfile();
      app.updateFooter();

      sucEl.textContent   = '✓ Profil bol úspešne uložený.';
      sucEl.style.display = 'block';
      setTimeout(() => { sucEl.style.display = 'none'; }, 3000);
    } catch(e) {
      console.error('Profile save error:', e);
      errEl.textContent   = 'Chyba pri ukladaní: ' + (e.message || 'skús znova');
      errEl.style.display = 'block';
    }

    btn.disabled = false; btn.textContent = 'Uložiť zmeny';
  },

  _copyLink(btn) {
    const p    = auth.profile || {};
    const link = `${window.location.origin}${window.location.pathname}?ref=${p.referral_code||''}`;
    navigator.clipboard.writeText(link).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => { prompt('Skopíruj link:', link); });
  },
};
