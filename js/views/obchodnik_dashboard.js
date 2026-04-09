// ── views/obchodnik_dashboard.js ─────────────────────────────────────────────

const obchodnikDashboardView = {
  render() {
    const { contacts, deals, orders, commissions } = app.state;
    const uid  = app._currentUserId();
    const leads = (app.state.leads || []).filter(l => l.owner_id === uid || l.assigned_to === uid || l.created_by === uid);
    const opps  = (app.state.opportunities || []).filter(o => o.owner_id === uid || o.assigned_to === uid);

    const myOrders      = (orders||[]).filter(o => o.owner_id === uid);
    const myComms       = commissions.filter(c => c.owner_id === uid);
    const myMembers     = contacts.filter(c => c.ownerId === uid);
    const activeOpps    = opps.filter(o => ['open','negotiation'].includes(o.status));
    const pipeVal       = activeOpps.reduce((a,o) => a+(o.value||0), 0);
    const pendingComm   = myComms.filter(c => c.status==='pending').reduce((a,c) => a+c.amount, 0);
    const approvedComm  = myComms.filter(c => c.status==='approved').reduce((a,c) => a+c.amount, 0);
    const paidComm      = myComms.filter(c => c.status==='paid').reduce((a,c) => a+c.amount, 0);
    const wonOpps       = opps.filter(o => o.status==='won');
    const lostOpps      = opps.filter(o => o.status==='lost');
    const winRate       = (wonOpps.length+lostOpps.length) > 0
      ? Math.round(wonOpps.length/(wonOpps.length+lostOpps.length)*100) : 0;
    const newLeads      = leads.filter(l => l.status === 'new' && !l.approved_at).length;

    const recentLeads   = [...leads].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
    const upcomingClose = opps
      .filter(o => o.expected_close && ['open','negotiation'].includes(o.status))
      .sort((a,b) => new Date(a.expected_close)-new Date(b.expected_close)).slice(0,3);

    return `
      <div class="view-head"><h2>Môj prehľad</h2></div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pipeline</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${EUR(pipeVal)}</div>
          <div style="font-size:11px;color:var(--muted);">${activeOpps.length} príležitostí</div>
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
          <div style="font-size:11px;color:var(--muted);">${wonOpps.length} z ${wonOpps.length+lostOpps.length}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <!-- Posledné leady -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
            Moje posledné leady ${newLeads>0?`<span class="badge" style="background:rgba(212,148,58,0.12);color:var(--acc);border:1px solid var(--acc-brd);font-size:10px;">⏳ ${newLeads} čaká</span>`:''}
          </div>
          ${recentLeads.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne leady</div>'
            : recentLeads.map(l => {
              const cfg = LEAD_STATUSES?.[l.status] || { label: l.status, color:'var(--muted)' };
              return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                <div>
                  <div style="font-size:13px;font-weight:600;">${esc(l.title||l.contacts?.name||'—')}</div>
                  <div style="font-size:11px;color:var(--muted);">${esc(l.contacts?.name||'')}</div>
                </div>
                <div style="text-align:right;">
                  <span class="badge" style="background:${cfg.color}18;color:${cfg.color};border:1px solid ${cfg.color}44;font-size:10px;">${cfg.label}</span>
                  <div class="mono" style="font-size:12px;color:var(--acc);margin-top:3px;">${EUR(l.value_estimate)}</div>
                </div>
              </div>`}).join('')}
          <button class="btn-ghost" style="width:100%;margin-top:10px;font-size:12px;" onclick="app.setView('pipeline')">Zobraziť všetky →</button>
        </div>

        <!-- Nadchádzajúce uzatvorenia + členovia -->
        <div>
          <div class="card" style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
              Nadchádzajúce uzatvorenia
            </div>
            ${upcomingClose.length === 0
              ? '<div style="color:var(--muted);font-size:13px;">Žiadne naplánované</div>'
              : upcomingClose.map(o => `
                <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(o.title||'—')}</div>
                    <div style="font-size:11px;color:var(--muted);">📅 ${FMT(o.expected_close)} · ${o.probability||0}%</div>
                  </div>
                  <div class="mono" style="font-size:13px;color:var(--green);">${EUR(o.value)}</div>
                </div>`).join('')}
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">
              Moji členovia
            </div>
            <div class="mono" style="font-size:28px;font-weight:700;color:var(--purple);">${myMembers.length}</div>
            <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:12px;" onclick="app.setView('members')">Zobraziť →</button>
          </div>
        </div>
      </div>

      <!-- Provízie detail -->
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
          Moje provízie
        </div>
        ${myComms.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne provízie</div>'
          : [...myComms].sort((a,b)=>new Date(b.created_at||b.createdAt)-new Date(a.created_at||a.createdAt)).slice(0,8).map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${commBadge(c.status)}
                <span class="mono" style="font-size:14px;font-weight:700;">${EUR(c.amount)}</span>
                ${c.rate ? `<span style="font-size:11px;color:var(--muted);">${c.rate}%</span>` : ''}
              </div>
              <span style="font-size:12px;color:var(--muted);">${FMT(c.date||c.created_at)}</span>
            </div>`).join('')}
        <button class="btn-ghost" style="width:100%;margin-top:10px;font-size:12px;" onclick="app.setView('commissions')">Zobraziť všetky →</button>
      </div>`;
  },
};
