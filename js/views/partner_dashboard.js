// ── views/partner_dashboard.js ───────────────────────────────────────────────

const partnerDashboardView = {
  _data: null,

  render() {
    return `
      <div class="view-head"><h2>🤝 Partner prehľad</h2></div>
      <div id="partner-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderContent();
  },

  async _load() {
    const uid = app._currentUserId();

    const [profileRes, dealsRes, ordersRes, invoicesRes, contactsRes] = await Promise.all([
      db.client.from('profiles')
        .select('*, membership_levels(name,color,icon), partner_profiles(*)')
        .eq('id', uid).single(),
      db.client.from('deals')
        .select('*, contacts(name,email), products(name,category)')
        .or(`owner_id.eq.${uid},assigned_to.eq.${uid},created_by.eq.${uid}`)
        .order('created_at', { ascending: false }),
      db.client.from('orders')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false }),
      db.client.from('invoices')
        .select('*')
        .or(`contact_id.eq.${uid},created_by.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(20),
      db.client.from('contacts')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false }),
    ]);

    this._data = {
      profile:  profileRes.data  || {},
      deals:    dealsRes.data    || [],
      orders:   ordersRes.data   || [],
      invoices: invoicesRes.data || [],
      contacts: contactsRes.data || [],
    };
  },

  _renderContent() {
    const el = document.getElementById('partner-wrap');
    if (!el || !this._data) return;

    const { profile, deals, orders, invoices, contacts } = this._data;
    const p = profile;

    // KPI
    const activeDeals  = deals.filter(d => !['lost','cancelled'].includes(d.status));
    const paidDeals    = deals.filter(d => ['paid','in_progress','completed'].includes(d.status));
    const totalRevenue = paidDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const pendingInv   = invoices.filter(i => i.status === 'sent');
    const overdueInv   = invoices.filter(i => i.status === 'overdue');
    const paidInv      = invoices.filter(i => i.status === 'paid');
    const pendingVal   = pendingInv.reduce((a,i) => a+(i.amount_inc_vat||0), 0);
    const overdueVal   = overdueInv.reduce((a,i) => a+(i.amount_inc_vat||0), 0);
    const paidVal      = paidInv.reduce((a,i) => a+(i.amount_inc_vat||0), 0);

    el.innerHTML = `
      <!-- Uvítanie -->
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#0d1a2e,var(--card));border-color:rgba(91,164,245,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Partner</div>
            <div style="font-size:20px;font-weight:700;">${esc(p.name||p.email||'')}</div>
            ${p.partner_profiles?.company_name ? `<div style="font-size:13px;color:var(--muted);margin-top:3px;">🏢 ${esc(p.partner_profiles.company_name)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Obrat celkom</div>
            <div class="mono" style="font-size:24px;font-weight:700;color:var(--blue);">${EUR(totalRevenue)}</div>
          </div>
        </div>
      </div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Klienti</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--purple);">${contacts.length}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Aktívne dealy</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">${activeDeals.length}</div>
        </div>
        <div class="card" style="text-align:center;${overdueVal>0?'border-color:rgba(242,85,85,0.4);':''}">
          <div style="font-size:10px;color:${overdueVal>0?'var(--red)':'var(--muted)'};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Po splatnosti</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:${overdueVal>0?'var(--red)':'var(--muted)'};">${EUR(overdueVal)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Vyplatené</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);">${EUR(paidVal)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Moji klienti -->
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            👥 Moji klienti (${contacts.length})
          </div>
          ${contacts.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadni klienti</div>'
            : contacts.slice(0,8).map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(c.name||'—')}</div>
                    <div style="font-size:11px;color:var(--muted);">${esc(c.email||'')}</div>
                  </div>
                  <div style="font-size:11px;color:var(--muted);">${FMT(c.created_at)}</div>
                </div>`).join('')}
          ${contacts.length > 8 ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;">+${contacts.length-8} ďalších</div>` : ''}
        </div>

        <!-- Aktívne dealy -->
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            📊 Aktívne dealy (${activeDeals.length})
          </div>
          ${activeDeals.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne aktívne dealy</div>'
            : activeDeals.slice(0,6).map(d => {
                const col = typeof DEAL_COLS !== 'undefined' ? DEAL_COLS.find(c=>c.key===d.status) : null;
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                    <div>
                      <div style="font-size:13px;font-weight:600;">${esc(d.title||'—')}</div>
                      <div style="font-size:11px;color:var(--muted);">${esc(d.contacts?.name||'')} · ${esc(d.products?.name||'')}</div>
                    </div>
                    <div style="text-align:right;">
                      ${col ? `<span class="badge" style="background:${col.color}18;color:${col.color};border:1px solid ${col.color}44;font-size:10px;">${col.label}</span>` : ''}
                      <div class="mono" style="font-size:12px;color:var(--acc);margin-top:2px;">${EUR(d.sale_price_snapshot||0)}</div>
                    </div>
                  </div>`;
              }).join('')}
        </div>
      </div>

      <!-- Faktúry -->
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">
            🧾 Faktúry
          </div>
          <div style="display:flex;gap:16px;font-size:12px;">
            <span>Odoslané: <strong style="color:var(--blue);">${EUR(pendingVal)}</strong></span>
            <span>Uhradené: <strong style="color:var(--green);">${EUR(paidVal)}</strong></span>
            ${overdueVal > 0 ? `<span>Po splatnosti: <strong style="color:var(--red);">${EUR(overdueVal)}</strong></span>` : ''}
          </div>
        </div>
        ${invoices.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne faktúry</div>'
          : invoices.slice(0,8).map(i => {
              const sc = { draft:{label:'Koncept',color:'var(--muted)'}, sent:{label:'Odoslaná',color:'var(--blue)'}, paid:{label:'Uhradená',color:'var(--green)'}, overdue:{label:'Po splatnosti',color:'var(--red)'} }[i.status] || {label:i.status,color:'var(--muted)'};
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:13px;font-weight:600;">${esc(i.invoice_number)}</span>
                      <span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;font-size:10px;">${sc.label}</span>
                    </div>
                    <div style="font-size:11px;color:var(--muted);">Splatnosť: ${FMT(i.due_date)} ${i.client_name?`· ${esc(i.client_name)}`:''}</div>
                  </div>
                  <div class="mono" style="font-weight:700;color:var(--acc);">${EUR(i.amount_inc_vat)}</div>
                </div>`;
            }).join('')}
      </div>

      <!-- História dealov -->
      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          📋 História dealov
        </div>
        ${deals.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne dealy</div>'
          : deals.slice(0,10).map(d => {
              const col = typeof DEAL_COLS !== 'undefined' ? DEAL_COLS.find(c=>c.key===d.status) : null;
              const lostCancelled = ['lost','cancelled'].includes(d.status);
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);opacity:${lostCancelled?'0.5':'1'};">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(d.title||'—')}</div>
                    <div style="font-size:11px;color:var(--muted);">${esc(d.contacts?.name||'—')} · ${FMT(d.created_at)}</div>
                  </div>
                  <div style="text-align:right;">
                    ${col ? `<span class="badge" style="background:${col.color}18;color:${col.color};border:1px solid ${col.color}44;font-size:10px;">${col.label}</span>` : ''}
                    <div class="mono" style="font-size:12px;color:${lostCancelled?'var(--muted)':'var(--acc)'};margin-top:2px;">${EUR(d.sale_price_snapshot||0)}</div>
                  </div>
                </div>`;
            }).join('')}
      </div>`;
  },
};
