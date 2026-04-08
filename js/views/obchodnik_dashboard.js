// ── views/obchodnik_dashboard.js ─────────────────────────────────────────────

const obchodnikDashboardView = {
  render() {
    const { contacts, deals, orders, commissions } = app.state;
    const uid = app._currentUserId();

    // Filtrujem len svoje dáta
    const myDeals       = deals.filter(d => d.ownerId === uid);
    const myOrders      = (orders||[]).filter(o => o.ownerId === uid);
    const myComms       = commissions.filter(c => c.ownerId === uid);
    const myMembers     = contacts.filter(c => c.ownerId === uid);
    const activeDeals   = myDeals.filter(d => !['won','lost','cancelled'].includes(d.status));
    const pipeVal       = activeDeals.reduce((a,d) => a+(d.value||0), 0);
    const pendingComm   = myComms.filter(c => c.status==='pending').reduce((a,c) => a+c.amount, 0);
    const approvedComm  = myComms.filter(c => c.status==='approved').reduce((a,c) => a+c.amount, 0);
    const paidComm      = myComms.filter(c => c.status==='paid').reduce((a,c) => a+c.amount, 0);
    const wonDeals      = myDeals.filter(d => d.status==='won');
    const lostDeals     = myDeals.filter(d => d.status==='lost');
    const winRate       = (wonDeals.length+lostDeals.length) > 0
      ? Math.round(wonDeals.length/(wonDeals.length+lostDeals.length)*100) : 0;

    const cName = id => contacts.find(c=>c.id===id)?.name||'—';
    const recentDeals = [...myDeals].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
    const upcomingClose = myDeals
      .filter(d => d.expectedClose && !['won','lost','cancelled'].includes(d.status))
      .sort((a,b) => new Date(a.expectedClose)-new Date(b.expectedClose)).slice(0,3);

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
          <div style="font-size:11px;color:var(--muted);">${wonDeals.length} z ${wonDeals.length+lostDeals.length}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <!-- Posledné leady -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
            Moje posledné leady
          </div>
          ${recentDeals.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne leady</div>'
            : recentDeals.map(d => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                <div>
                  <div style="font-size:13px;font-weight:600;">${esc(d.title||d.name||'—')}</div>
                  <div style="font-size:11px;color:var(--muted);">${esc(cName(d.contactId))}</div>
                </div>
                <div style="text-align:right;">
                  ${dealBadge(d.status)}
                  <div class="mono" style="font-size:12px;color:var(--acc);margin-top:3px;">${EUR(d.value)}</div>
                </div>
              </div>`).join('')}
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
              : upcomingClose.map(d => `
                <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(d.title||d.name||'—')}</div>
                    <div style="font-size:11px;color:var(--muted);">📅 ${FMT(d.expectedClose)}</div>
                  </div>
                  <div class="mono" style="font-size:13px;color:var(--green);">${EUR(d.value)}</div>
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
          : [...myComms].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8).map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${commBadge(c.status)}
                <span class="mono" style="font-size:14px;font-weight:700;">${EUR(c.amount)}</span>
                ${c.rate ? `<span style="font-size:11px;color:var(--muted);">${c.rate}%</span>` : ''}
              </div>
              <span style="font-size:12px;color:var(--muted);">${FMT(c.date||c.createdAt)}</span>
            </div>`).join('')}
        <button class="btn-ghost" style="width:100%;margin-top:10px;font-size:12px;" onclick="app.setView('commissions')">Zobraziť všetky →</button>
      </div>`;
  },
};
