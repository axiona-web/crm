// ── views/obchodnik_dashboard.js ─────────────────────────────────────────────

const obchodnikDashboardView = {
  render() {
    const { contacts, commissions } = app.state;
    const uid   = app._currentUserId();
    const deals = (app.state.deals || []).filter(d =>
      d.owner_id === uid || d.assigned_to === uid || d.created_by === uid
    );

    const activeDeals  = deals.filter(d => !['lost','cancelled'].includes(d.status));
    const paidDeals    = deals.filter(d => ['paid','in_progress','completed'].includes(d.status));
    const lostDeals    = deals.filter(d => d.status === 'lost');
    const pipeVal      = activeDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const myComms      = commissions.filter(c => c.owner_id === uid || c.owner_id === uid);
    const myMembers    = contacts.filter(c => c.owner_id === uid);
    const pendingComm  = myComms.filter(c => c.status==='pending').reduce((a,c)  => a+(c.amount||0), 0);
    const approvedComm = myComms.filter(c => c.status==='approved').reduce((a,c) => a+(c.amount||0), 0);
    const paidComm     = myComms.filter(c => c.status==='paid').reduce((a,c)     => a+(c.amount||0), 0);
    const closedDeals  = deals.filter(d => ['paid','in_progress','completed','lost'].includes(d.status));
    const winRate      = closedDeals.length > 0
      ? Math.round((closedDeals.length - lostDeals.length) / closedDeals.length * 100) : 0;

    const recentDeals  = [...deals].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
    const needsAction  = activeDeals.filter(d => d.sla_breached || !d.contact_id || !d.product_id);

    return `
      <div class="view-head"><h2>Môj prehľad</h2></div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pipeline</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${EUR(pipeVal)}</div>
          <div style="font-size:11px;color:var(--muted);">${activeDeals.length} aktívnych</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Čakajúce prov.</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${EUR(pendingComm)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Schválené prov.</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--blue);">${EUR(approvedComm)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Vyplatené</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--green);">${EUR(paidComm)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Win rate</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:${winRate>=50?'var(--green)':'var(--acc)'};">${winRate}%</div>
          <div style="font-size:11px;color:var(--muted);">${closedDeals.length-lostDeals.length}/${closedDeals.length}</div>
        </div>
      </div>

      ${needsAction.length > 0 ? `
        <div style="background:rgba(212,148,58,0.08);border:1px solid var(--acc-brd);border-radius:8px;padding:10px 14px;margin-bottom:14px;">
          <div style="font-size:12px;font-weight:700;color:var(--acc);margin-bottom:6px;">⚠ Vyžaduje pozornosť (${needsAction.length})</div>
          ${needsAction.slice(0,3).map(d => `
            <div style="font-size:12px;color:var(--acc);margin-bottom:3px;">
              • ${esc(d.title||'—')}
              ${d.sla_breached?'· SLA porušené':''}
              ${!d.contact_id?'· Chýba kontakt':''}
              ${!d.product_id?'· Chýba produkt':''}
            </div>`).join('')}
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Posledné dealy -->
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Moje posledné dealy
          </div>
          ${recentDeals.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne dealy</div>'
            : recentDeals.map(d => {
                const col = typeof DEAL_COLS !== 'undefined' ? DEAL_COLS.find(c=>c.key===d.status) : null;
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                    <div>
                      <div style="font-size:13px;font-weight:600;">${esc(d.title||'—')}</div>
                      <div style="font-size:11px;color:var(--muted);">${esc(d.product_name_snapshot||'')}</div>
                    </div>
                    <div style="text-align:right;">
                      ${col ? `<span class="badge" style="background:${col.color}18;color:${col.color};border:1px solid ${col.color}44;font-size:10px;">${col.label}</span>` : ''}
                      <div class="mono" style="font-size:12px;color:var(--acc);margin-top:2px;">${EUR(d.sale_price_snapshot||0)}</div>
                    </div>
                  </div>`;
              }).join('')}
          <button class="btn-ghost" style="width:100%;margin-top:10px;font-size:12px;" onclick="app.setView('pipeline')">Zobraziť pipeline →</button>
        </div>

        <!-- Moji členovia + komisie -->
        <div>
          <div class="card" style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
              Moji členovia
            </div>
            <div class="mono" style="font-size:28px;font-weight:700;color:var(--purple);">${myMembers.length}</div>
            <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:12px;" onclick="app.setView('members')">Zobraziť →</button>
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
              Komisie celkom
            </div>
            <div class="mono" style="font-size:20px;font-weight:700;color:var(--green);">${EUR(pendingComm+approvedComm+paidComm)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">${myComms.length} provízií</div>
            <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:12px;" onclick="app.setView('commissions')">Zobraziť →</button>
          </div>
        </div>
      </div>

      <!-- Posledné komisie -->
      ${myComms.length > 0 ? `
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Moje posledné provízie
          </div>
          ${myComms.slice(0,5).map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${commBadge(c.status)}
                <span class="mono" style="font-size:14px;font-weight:700;">${EUR(c.amount)}</span>
                ${c.rate ? `<span style="font-size:11px;color:var(--muted);">${c.rate}%</span>` : ''}
              </div>
              <span style="font-size:12px;color:var(--muted);">${FMT(c.date||c.created_at||c.created_at)}</span>
            </div>`).join('')}
        </div>` : ''}`;
  },
};
