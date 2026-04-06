// ── js/views/partners.js — správa partnerov (len admin) ─────────────────────

const partnersView = {
  _partners: [],

  render() {
    return `
      <div class="view-head"><h2>Partneri</h2></div>
      <div id="partners-list">
        <div style="color:var(--muted);font-size:13px;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    this._partners = await db.getPartners();
    const { contacts, deals, commissions } = app.state;

    const baseUrl = window.location.origin + window.location.pathname;

    const rows = this._partners.map(p => {
      const pContacts = contacts.filter(c => c.ownerId === p.id).length;
      const pDeals    = deals.filter(d => d.ownerId === p.id);
      const pPipeline = pDeals.filter(d => !['Uzavreté','Stratené'].includes(d.stage))
                               .reduce((a, d) => a + (d.value || 0), 0);
      const pComm     = commissions.filter(c => c.ownerId === p.id && c.status === 'Čakajúca')
                                   .reduce((a, c) => a + c.amount, 0);
      const isMe      = p.id === auth.user?.id;
      const refLink   = `${baseUrl}?ref=${p.referral_code}`;
      const recruits  = this._partners.filter(x => x.referred_by === p.id).length;

      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:14px;">${esc(p.name || p.email)}</span>
                <span class="badge" style="background:${p.role==='admin'?'var(--acc)':'var(--blue)'}22;color:${p.role==='admin'?'var(--acc)':'var(--blue)'};border:1px solid ${p.role==='admin'?'var(--acc)':'var(--blue)'}44;">
                  ${p.role === 'admin' ? '⭐ Admin' : 'Partner'}
                </span>
                ${isMe ? '<span style="font-size:11px;color:var(--muted);">(ty)</span>' : ''}
                ${p.referred_by ? `<span style="font-size:11px;color:var(--muted);">pozvaný cez referral</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${esc(p.email)}</div>

              <!-- Štatistiky -->
              <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap;">
                <span>👥 ${pContacts} kontaktov</span>
                <span>📁 ${pDeals.length} obchodov</span>
                <span class="mono" style="color:var(--acc);">💼 ${EUR(pPipeline)}</span>
                <span class="mono" style="color:var(--acc);">💰 ${EUR(pComm)} čakajúce</span>
                <span>🔗 ${recruits} pozvaných</span>
              </div>

              <!-- Referral kód a link -->
              <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div>
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Referral kód</div>
                  <div class="mono" style="font-size:15px;font-weight:700;color:var(--acc);letter-spacing:0.08em;">${esc(p.referral_code || '—')}</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Referral link</div>
                  <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(refLink)}</div>
                </div>
                <button class="btn-ghost" style="font-size:11px;padding:5px 10px;white-space:nowrap;"
                  onclick="partnersView._copyLink('${esc(refLink)}', this)">📋 Kopírovať</button>
              </div>
            </div>

            ${!isMe ? `
              <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                ${p.role === 'partner'
                  ? `<button class="btn-ghost" style="font-size:12px;" onclick="partnersView.setRole('${p.id}','admin')">→ Admin</button>`
                  : `<button class="btn-ghost" style="font-size:12px;" onclick="partnersView.setRole('${p.id}','partner')">→ Partner</button>`}
              </div>` : ''}
          </div>
        </div>`;
    }).join('');

    document.getElementById('partners-list').innerHTML =
      this._partners.length === 0
        ? '<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadni partneri</div>'
        : rows;
  },

  _copyLink(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      prompt('Skopíruj link:', link);
    });
  },

  async setRole(userId, role) {
    try {
      await db.setRole(userId, role);
      await this.afterRender();
    } catch(e) {
      alert('Chyba: ' + e.message);
    }
  },
};
