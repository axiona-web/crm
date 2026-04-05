// ── js/views/partners.js — správa partnerov (len admin) ─────────────────────

const partnersView = {
  _partners: [],

  render() {
    return `
      <div class="view-head">
        <h2>Partneri</h2>
      </div>
      <div id="partners-list">
        <div style="color:var(--muted);font-size:13px;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    this._partners = await db.getPartners();
    const { contacts, deals, commissions } = app.state;

    const rows = this._partners.map(p => {
      const pContacts = contacts.filter(c => c.ownerId === p.id).length;
      const pDeals    = deals.filter(d => d.ownerId === p.id);
      const pPipeline = pDeals.filter(d => !['Uzavreté','Stratené'].includes(d.stage))
                              .reduce((a, d) => a + (d.value || 0), 0);
      const pComm     = commissions.filter(c => c.ownerId === p.id && c.status === 'Čakajúca')
                                   .reduce((a, c) => a + c.amount, 0);
      const isMe      = p.id === auth.user?.id;

      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-weight:700;font-size:14px;">${esc(p.name || p.email)}</span>
                <span class="badge" style="background:${p.role==='admin'?'var(--acc)':'var(--blue)'}22;color:${p.role==='admin'?'var(--acc)':'var(--blue)'};border:1px solid ${p.role==='admin'?'var(--acc)':'var(--blue)'}44;">
                  ${p.role === 'admin' ? '⭐ Admin' : 'Partner'}
                </span>
                ${isMe ? '<span style="font-size:11px;color:var(--muted);">(ty)</span>' : ''}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${esc(p.email)}</div>
              <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);">
                <span>👥 ${pContacts} kontaktov</span>
                <span>📁 ${pDeals.length} obchodov</span>
                <span class="mono" style="color:var(--acc);">💼 ${EUR(pPipeline)}</span>
                <span class="mono" style="color:var(--acc);">💰 ${EUR(pComm)} čakajúce</span>
              </div>
            </div>
            ${!isMe ? `
              <div>
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

  async setRole(userId, role) {
    try {
      await db.setRole(userId, role);
      await this.afterRender();
    } catch(e) {
      alert('Chyba: ' + e.message);
    }
  },
};
