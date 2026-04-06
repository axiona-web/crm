// ── js/views/partners.js ─────────────────────────────────────────────────────

const partnersView = {
  _partners: [],
  _roleFilter: 'vsetci',
  _loaded: false,

  render() {
    const filterBtns = [
      { id:'vsetci',    label:'Všetci'       },
      { id:'obchodnik', label:'💼 Obchodníci' },
      { id:'partner',   label:'🤝 Partneri'   },
      { id:'clen',      label:'👤 Členovia'   },
      { id:'admin',     label:'⭐ Admini'     },
    ].map(f => `
      <button class="filter-tab${this._roleFilter===f.id?' active':''}"
        onclick="partnersView._setFilter('${f.id}')">
        ${f.label}
      </button>`).join('');

    return `
      <div class="view-head">
        <h2>Tím & Partneri</h2>
        <button class="btn-primary" onclick="partnersView.openInvite()">+ Pozvať užívateľa</button>
      </div>

      <!-- Zobraziť ako -->
      <div class="card" style="margin-bottom:16px;border-color:var(--acc-brd);background:linear-gradient(135deg,#1a180e,var(--card));">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;color:var(--acc);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">👁 Zobraziť ako</div>
            <div style="font-size:12px;color:var(--muted);">Simuluj pohľad inej roly — len ty to vidíš</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;">
            ${Object.entries(ROLES).map(([k, v]) => `
              <button onclick="previewRole.set('${k}')"
                style="padding:7px 13px;border-radius:8px;border:1px solid ${previewRole.current()===k ? v.color : 'var(--brd)'};
                  background:${previewRole.current()===k ? v.color+'22' : 'transparent'};
                  color:${previewRole.current()===k ? v.color : 'var(--muted)'};
                  font-size:12px;font-weight:${previewRole.current()===k?'700':'400'};cursor:pointer;font-family:inherit;">
                ${v.icon} ${v.label}
              </button>`).join('')}
            ${previewRole.current() ? `
              <button onclick="previewRole.clear()"
                style="padding:7px 13px;border-radius:8px;border:1px solid var(--red);background:rgba(242,85,85,0.1);
                  color:var(--red);font-size:12px;cursor:pointer;font-family:inherit;">
                ✕ Zrušiť
              </button>` : ''}
          </div>
        </div>
        ${previewRole.current() ? `
          <div style="margin-top:10px;padding:8px 12px;background:rgba(212,148,58,0.1);border-radius:6px;font-size:12px;color:var(--acc);">
            ⚠️ Práve simuluješ pohľad roly <strong>${ROLES[previewRole.current()]?.label}</strong> —
            navigácia a obsah sa zmenili. Ostatní užívatelia ťa stále vidia ako Admin.
          </div>` : ''}
      </div>

      <div class="filter-tabs" style="margin-bottom:16px;">${filterBtns}</div>
      <div id="partners-list">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    if (!this._loaded) {
      this._partners = await db.getPartners();
      this._loaded   = true;
    }
    this._renderList();
  },

  _setFilter(f) {
    this._roleFilter = f;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach((btn, i) => {
      const ids = ['vsetci','obchodnik','partner','clen','admin'];
      btn.classList.toggle('active', ids[i] === f);
    });
    this._renderList();
  },

  _renderList() {
    const el = document.getElementById('partners-list');
    if (!el) return;

    const { contacts, deals, commissions } = app.state;
    const baseUrl = window.location.origin + window.location.pathname;

    const filtered = this._roleFilter === 'vsetci'
      ? this._partners
      : this._partners.filter(p => p.role === this._roleFilter);

    if (filtered.length === 0) {
      el.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadni užívatelia v tejto kategórii</div>';
      return;
    }

    el.innerHTML = filtered.map(p => {
      const isMe     = p.id === auth.user?.id;
      const refLink  = `${baseUrl}?ref=${p.referral_code || ''}`;
      const recruits = this._partners.filter(x => x.referred_by === p.id).length;
      const pDeals   = deals.filter(d => d.ownerId === p.id);
      const pPipe    = pDeals.filter(d => !['Uzavreté','Stratené'].includes(d.stage))
                             .reduce((a, d) => a + (d.value || 0), 0);
      const pMembers = contacts.filter(c => c.ownerId === p.id).length;
      const pComm    = commissions.filter(c => c.ownerId === p.id && c.status === 'Čakajúca')
                                  .reduce((a, c) => a + c.amount, 0);

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
                  <div class="mono" style="font-size:15px;font-weight:700;color:var(--acc);">${esc(p.referral_code || '—')}</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Link</div>
                  <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(refLink)}</div>
                </div>
                <button class="btn-ghost" style="font-size:11px;padding:5px 10px;white-space:nowrap;"
                  onclick="partnersView._copy('${esc(refLink)}', this)">📋 Kopírovať</button>
              </div>
            </div>
            ${!isMe ? `
              <div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Zmeniť rolu</div>
                <select onchange="partnersView.setRole('${p.id}', this.value)" style="font-size:12px;width:auto;">
                  ${Object.entries(ROLES).map(([k, v]) =>
                    `<option value="${k}"${p.role === k ? ' selected' : ''}>${v.icon} ${v.label}</option>`
                  ).join('')}
                </select>
              </div>` : ''}
          </div>
        </div>`;
    }).join('');
  },

  _invalidate() { this._loaded = false; this._partners = []; },

  openInvite() {
    modal.open('Pozvať užívateľa', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">Užívateľ dostane email s odkazom na prihlásenie.</div>
      <div class="form-row"><label class="form-label">Email *</label><input id="inv-email" type="email" placeholder="uzivatel@email.sk" /></div>
      <div class="form-row"><label class="form-label">Meno</label><input id="inv-name" placeholder="Ján Novák" /></div>
      <div class="form-row">
        <label class="form-label">Rola</label>
        <select id="inv-role">
          ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div id="inv-error"   style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;margin-bottom:8px;"></div>
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
      sucEl.textContent = `✓ Pozvánka odoslaná na ${email}`;
      sucEl.style.display = 'block';
      btn.textContent = 'Odoslané ✓';
      this._invalidate();
    } catch(e) {
      errEl.textContent = e.message || 'Chyba pri pozývaní.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Pozvať';
    }
  },

  async setRole(userId, role) {
    try {
      await db.setRole(userId, role);
      this._invalidate();
      this._partners = await db.getPartners();
      this._loaded   = true;
      this._renderList();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  _copy(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const o = btn.textContent; btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = o; }, 2000);
    }).catch(() => { prompt('Link:', link); });
  },
};
