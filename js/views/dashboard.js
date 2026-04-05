// ── views/dashboard.js ───────────────────────────────────────────────────────

const dashboardView = {
  render() {
    const { contacts, deals, commissions } = app.state;

    const active  = deals.filter(d => !['Uzavreté', 'Stratené'].includes(d.stage));
    const pVal    = active.reduce((a, d) => a + (d.value || 0), 0);
    const wVal    = active.reduce((a, d) => a + (d.value || 0) * (d.probability || 0) / 100, 0);
    const closed  = deals.filter(d => d.stage === 'Uzavreté');
    const cVal    = closed.reduce((a, d) => a + (d.value || 0), 0);
    const pendComm = commissions.filter(c => c.status === 'Čakajúca').reduce((a, c) => a + c.amount, 0);

    const cName = id => contacts.find(c => c.id === id)?.name || '—';
    const recent   = [...deals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const upcoming = deals
      .filter(d => d.expectedClose && !['Uzavreté', 'Stratené'].includes(d.stage))
      .sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))
      .slice(0, 5);

    const stageBars = STAGES.map(s => {
      const cnt = deals.filter(d => d.stage === s).length;
      const val = deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0);
      const pct = deals.length ? Math.round(cnt / deals.length * 100) : 0;
      if (!cnt) return '';
      return `
        <div class="stage-bar">
          <div class="stage-bar-label">
            <span style="color:${STAGE_COLORS[s]}">${s}</span>
            <span class="mono" style="color:var(--muted);font-size:11px;">${EUR(val)} (${cnt})</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${STAGE_COLORS[s]};"></div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="view-head"><h2>Dashboard</h2></div>

      <div class="stat-grid">
        <div class="card stat-card">
          <div class="stat-label">Kontakty</div>
          <div class="stat-value mono" style="color:var(--blue);">${contacts.length}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Aktívne obchody</div>
          <div class="stat-value mono" style="color:var(--purple);">${active.length}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Pipeline</div>
          <div class="stat-value mono" style="color:var(--acc);font-size:17px;">${EUR(pVal)}</div>
          <div class="stat-sub">Vážená: ${EUR(wVal)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Čakajúce provízie</div>
          <div class="stat-value mono" style="color:var(--acc);font-size:17px;">${EUR(pendComm)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Uzavreté obchody</div>
          <div class="stat-value mono" style="color:var(--green);font-size:17px;">${EUR(cVal)}</div>
          <div class="stat-sub">${closed.length} obchodov</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div style="font-size:12px;font-weight:600;margin-bottom:14px;color:var(--muted);">Rozdelenie pipeline</div>
          ${stageBars || '<div style="color:var(--muted);font-size:13px;">Žiadne obchody</div>'}
        </div>
        <div class="card">
          <div style="font-size:12px;font-weight:600;margin-bottom:14px;color:var(--muted);">Nadchádzajúce uzatvorenia</div>
          ${upcoming.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne naplánované</div>'
            : upcoming.map(d => `
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid var(--brd);">
                <div>
                  <div style="font-size:13px;font-weight:600;">${esc(d.name)}</div>
                  <div style="font-size:11px;color:var(--muted);">${esc(cName(d.contactId))}</div>
                </div>
                <div style="text-align:right;">
                  <div class="mono" style="font-size:13px;color:var(--green);">${EUR(d.value)}</div>
                  <div style="font-size:11px;color:var(--muted);">${FMT(d.expectedClose)}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:600;margin-bottom:14px;color:var(--muted);">Posledné obchody</div>
        ${recent.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne obchody</div>'
          : recent.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${badge(d.stage, STAGE_COLORS[d.stage])}
                <span style="font-size:13px;">${esc(d.name)}</span>
                <span style="font-size:12px;color:var(--muted);">${esc(cName(d.contactId))}</span>
              </div>
              <span class="mono" style="font-size:13px;color:var(--acc);">${EUR(d.value)}</span>
            </div>`).join('')}
      </div>`;
  },
};
