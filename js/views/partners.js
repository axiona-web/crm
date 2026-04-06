// ── js/views/partners.js — správa tímu (len admin) ───────────────────────────

const partnersView = {
  _partners: [],
  _roleFilter: 'vsetci',

  render() {
    return `
      <div class="view-head">
        <h2>Tím & Partneri</h2>
        <button class="btn-primary" onclick="partnersView.openInvite()">+ Pozvať užívateľa</button>
      </div>
      <div class="filter-tabs" style="margin-bottom:16px;">
        ${[
          {id:'vsetci',     label:'Všetci'},
          {id:'obchodnik',  label:'💼 Obchodníci'},
          {id:'partner',    label:'🤝 Partneri'},
          {id:'clen',       label:'👤 Členovia'},
          {id:'admin',      label:'⭐ Admini'},
        ].map(f => `
          <button class="filter-tab${this._roleFilter===f.id?' active':''}"
            onclick="partnersView._roleFilter='${f.id}'; partnersView.afterRender();">
            ${f.label}
          </button>`).join('')}
      </div>
      <div id="partners-list"><div style="color:var(--muted);font-size:13px;">Načítavam...</div></div>`;
  },

  async afterRender() {
    this._partners = await db.getPartners();
    const { contacts, deals, commissions } = app.state;
    const baseUrl = window.location.origin + window.location.pathname;

    const filtered = this._roleFilter === 'vsetci'
      ? this._partners
      : this._partners.filter(p => p.role === this._roleFilter);

    if (filtered.length === 0) {
      document.getElementById('partners-list').innerHTML =
        '<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadni užívatelia v tejto kategórii</div>';
      return;
    }

    const rows = filtered.map(p => {
      const isMe     = p.id === auth.user?.id;
      const refLink  = `${baseUrl}?ref=${p.referral_code}`;
      const recruits = this._partners.filter(x => x.referred_by === p.id).length;
      const pDeals   = deals.filter(d => d.ownerId === p.id);
      const pPipe    = pDeals.filter(d => !['Uzavreté','Stratené'].includes(d.stage)).reduce((a,d)=>a+(d.value||0),0);
      const pMembers = contacts.filter(c => c.ownerId === p.id).length;
      const pComm    = commissions.filter(c=>c.ownerId===p.id&&c.status==='Čakajúca').reduce((a,c)=>a+c.amount,0);
      const r        = ROLES[p.role] || ROLES.clen;

      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:14px;">${esc(p.name || p.email)}</span>
                ${roleBadge(p.role)}
                ${isMe ? '<span style="font-size:11px;color:var(--muted);">(ty)</span>' : ''}
                ${p.referred_by ? '<span style="font-size:11px;color:var(--muted);">· pozvaný cez referral</span>' : ''}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${esc(p.email)}</div>

              <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap;">
                <span>👥 ${pMembers} členov</span>
                <span>📁 ${pDeals.length} obchodov</span>
                <span class="mono" style="color:var(--acc);">💼 ${EUR(pPipe)}</span>
                <span class="mono" style="color:var(--acc);">💰 ${EUR(pComm)}</span>
                <span>🔗 ${recruits} pozvaných</span>
              </div>

              <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div>
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Referral kód</div>
                  <div class="mono" style="font-size:15px;font-weight:700;color:var(--acc);">${esc(p.referral_code||'—')}</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Link</div>
                  <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(refLink)}</div>
                </div>
                <button class="btn-ghost" style="font-size:11px;padding:5px 10px;white-space:nowrap;"
                  onclick="partnersView._copy('${esc(refLink)}',this)">📋 Kopírovať</button>
              </div>
            </div>

            ${!isMe ? `
              <div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Zmeniť rolu</div>
                <select onchange="partnersView.setRole('${p.id}',this.value)" style="font-size:12px;">
                  ${Object.entries(ROLES).map(([k,v]) =>
                    `<option value="${k}"${p.role===k?' selected':''}>${v.icon} ${v.label}</option>`
                  ).join('')}
                </select>
              </div>` : ''}
          </div>
        </div>`;
    }).join('');

    document.getElementById('partners-list').innerHTML = rows;
  },

  openInvite() {
    modal.open('Pozvať užívateľa', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">
        Užívateľ dostane email s odkazom na nastavenie hesla.
      </div>
      <div class="form-row"><label class="form-label">Email *</label><input id="inv-email" type="email" placeholder="uzivatel@email.sk" /></div>
      <div class="form-row"><label class="form-label">Meno</label><input id="inv-name" placeholder="Ján Novák" /></div>
      <div class="form-row">
        <label class="form-label">Rola</label>
        <select id="inv-role">
          ${Object.entries(ROLES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div id="inv-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;margin-bottom:8px;"></div>
      <div id="inv-success" style="display:none;color:var(--green);font-size:12px;padding:8px;background:rgba(62,207,142,0.1);border-radius:6px;margin-bottom:8px;"></div>
      <div class="form-actions">
        <button class="btn-primary" id="inv-btn" onclick="partnersView.doInvite()">Pozvať</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async doInvite() {
    const email = document.getElementById('inv-email').value.trim();
    const name  = document.getElementById('inv-name').value.trim();
    const role  = document.getElementById('inv-role').value;
    const errEl = document.getElementById('inv-error');
    const sucEl = document.getElementById('inv-success');
    const btn   = document.getElementById('inv-btn');
    errEl.style.display = 'none'; sucEl.style.display = 'none';
    if (!email) { errEl.textContent = 'Zadaj email.'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Pozývam...';
    try {
      await db.inviteUser(email, name, role);
      sucEl.textContent   = `✓ Pozvánka odoslaná na ${email}`;
      sucEl.style.display = 'block';
      btn.textContent     = 'Odoslané ✓';
    } catch(e) {
      errEl.textContent   = e.message || 'Chyba pri pozývaní.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Pozvať';
    }
  },

  async setRole(userId, role) {
    try { await db.setRole(userId, role); await this.afterRender(); }
    catch(e) { alert('Chyba: ' + e.message); }
  },

  _copy(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const o = btn.textContent; btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = o; }, 2000);
    }).catch(() => { prompt('Link:', link); });
  },
};
