// ── views/dashboard.js ───────────────────────────────────────────────────────

const dashboardView = {
  _charts: [],

  _destroyCharts() {
    this._charts.forEach(c => { try { c.destroy(); } catch {} });
    this._charts = [];
  },

  render() {
    this._destroyCharts();

    const { contacts, deals, commissions } = app.state;

    const active    = deals.filter(d => !['Uzavreté', 'Stratené'].includes(d.stage));
    const pipeVal   = active.reduce((a, d) => a + (d.value || 0), 0);
    const wVal      = active.reduce((a, d) => a + (d.value || 0) * (d.probability || 0) / 100, 0);
    const closed    = deals.filter(d => d.stage === 'Uzavreté');
    const lost      = deals.filter(d => d.stage === 'Stratené');
    const closedVal = closed.reduce((a, d) => a + (d.value || 0), 0);
    const winRate   = (closed.length + lost.length) > 0
      ? Math.round(closed.length / (closed.length + lost.length) * 100) : 0;
    const pendComm  = commissions.filter(c => c.status === 'Čakajúca').reduce((a, c) => a + c.amount, 0);
    const paidComm  = commissions.filter(c => c.status === 'Vyplatená').reduce((a, c) => a + c.amount, 0);

    const clientTotals = {};
    deals.forEach(d => {
      if (!d.contactId) return;
      clientTotals[d.contactId] = (clientTotals[d.contactId] || 0) + (d.value || 0);
    });
    const topClients = Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, val]) => ({
        name:  contacts.find(c => c.id === id)?.name || '—',
        type:  contacts.find(c => c.id === id)?.type || '',
        value: val,
        deals: deals.filter(d => d.contactId === id).length,
      }));
    const maxClient = topClients[0]?.value || 1;
    const typeColors = { Klient:'#5ba4f5', Obchodník:'#d4943a', Partner:'#a78bfa' };

    return `
      <div class="view-head"><h2>Dashboard</h2></div>

      <div class="kpi-grid">
        <div class="card kpi-main">
          <div class="kpi-label">Hodnota pipeline</div>
          <div class="kpi-big mono" style="color:var(--acc);">${EUR(pipeVal)}</div>
          <div class="kpi-sub">Vážená pravdepodobnosťou: <strong class="mono">${EUR(wVal)}</strong></div>
          <div class="kpi-sub" style="margin-top:4px;">${active.length} aktívnych obchodov</div>
        </div>
        <div class="kpi-side">
          <div class="card kpi-small">
            <div class="kpi-label">Uzavreté obchody</div>
            <div class="kpi-med mono" style="color:var(--green);">${EUR(closedVal)}</div>
            <div class="kpi-sub">${closed.length} obchodov</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Win rate</div>
            <div class="kpi-med mono" style="color:${winRate >= 50 ? 'var(--green)' : winRate > 0 ? 'var(--acc)' : 'var(--muted)'};">${winRate}%</div>
            <div class="kpi-sub">${closed.length} z ${closed.length + lost.length} uzatvorených</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Aktívne obchody</div>
            <div class="kpi-med mono" style="color:var(--purple);">${active.length}</div>
            <div class="kpi-sub">${contacts.length} kontaktov</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Čakajúce provízie</div>
            <div class="kpi-med mono" style="color:var(--acc);">${EUR(pendComm)}</div>
            <div class="kpi-sub">Vyplatené: ${EUR(paidComm)}</div>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <div class="card" style="flex:1.6;">
          <div class="chart-title">Pipeline funnel</div>
          <canvas id="chart-funnel" height="220"></canvas>
        </div>
        <div class="card" style="flex:1;display:flex;flex-direction:column;align-items:center;">
          <div class="chart-title" style="align-self:flex-start;">Provízie</div>
          <div style="position:relative;width:180px;height:180px;margin:0 auto;">
            <canvas id="chart-donut"></canvas>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
              <div class="mono" style="font-size:15px;font-weight:700;">${EUR(pendComm + paidComm)}</div>
              <div style="font-size:10px;color:var(--muted);">celkom</div>
            </div>
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;">
            <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:#d4943a;"></div><span style="color:var(--muted);">Čakajúce</span></div>
            <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:#3ecf8e;"></div><span style="color:var(--muted);">Vyplatené</span></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="chart-title">Mesačný vývoj obchodov (posledných 6 mesiacov)</div>
        <canvas id="chart-monthly" height="110"></canvas>
      </div>

      <div class="card">
        <div class="chart-title">Top klienti podľa hodnoty obchodov</div>
        ${topClients.length === 0
          ? '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Žiadne dáta — pridaj kontakty a obchody</div>'
          : topClients.map((c, i) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;width:16px;">#${i+1}</span>
                  <span style="font-size:13px;font-weight:600;">${esc(c.name)}</span>
                  <span class="badge" style="background:${typeColors[c.type]||'#66668a'}22;color:${typeColors[c.type]||'#66668a'};border:1px solid ${typeColors[c.type]||'#66668a'}44;font-size:10px;">${esc(c.type)}</span>
                  <span style="font-size:11px;color:var(--muted);">${c.deals} obchod${c.deals !== 1 ? 'y' : ''}</span>
                </div>
                <span class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${EUR(c.value)}</span>
              </div>
              <div style="height:5px;background:var(--brd);border-radius:3px;">
                <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),#f0b85a);width:${Math.round(c.value/maxClient*100)}%;"></div>
              </div>
            </div>`).join('')}
      </div>`;
  },

  afterRender() {
    this._initFunnel();
    this._initDonut();
    this._initMonthly();
  },

  _initFunnel() {
    const canvas = document.getElementById('chart-funnel');
    if (!canvas || typeof Chart === 'undefined') return;
    const { deals } = app.state;
    const data = STAGES.map(s => ({
      label: s,
      count: deals.filter(d => d.stage === s).length,
      value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value||0), 0),
      color: STAGE_COLORS[s],
    }));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Hodnota (€)',
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color + 'bb'),
          borderColor: data.map(d => d.color),
          borderWidth: 1,
          borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const item = data[ctx.dataIndex];
                return ` ${EUR(item.value)}  (${item.count} obchod${item.count !== 1 ? 'y' : ''})`;
              },
            },
          },
        },
        scales: {
          x: { grid: { color:'#24243a' }, ticks: { color:'#66668a', callback: v => EUR(v) }, border: { color:'#24243a' } },
          y: { grid: { display:false }, ticks: { color:'#dcdcf0', font:{ size:12 } }, border: { color:'#24243a' } },
        },
      },
    });
    this._charts.push(chart);
  },

  _initDonut() {
    const canvas = document.getElementById('chart-donut');
    if (!canvas || typeof Chart === 'undefined') return;
    const { commissions } = app.state;
    const pending = commissions.filter(c => c.status === 'Čakajúca').reduce((a, c) => a + c.amount, 0);
    const paid    = commissions.filter(c => c.status === 'Vyplatená').reduce((a, c) => a + c.amount, 0);
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Čakajúce', 'Vyplatené'],
        datasets: [{
          data: [pending || 0.001, paid || 0.001],
          backgroundColor: ['#d4943a99','#3ecf8e99'],
          borderColor:     ['#d4943a',  '#3ecf8e'],
          borderWidth: 2, hoverOffset: 6,
        }],
      },
      options: {
        cutout: '70%', responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${EUR(ctx.raw)}` } },
        },
      },
    });
    this._charts.push(chart);
  },

  _initMonthly() {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas || typeof Chart === 'undefined') return;
    const { deals } = app.state;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: d.toLocaleDateString('sk-SK', { month:'short', year:'2-digit' }),
      });
    }
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Nové obchody',
            data: months.map(m => deals.filter(d => d.createdAt?.startsWith(m.key)).reduce((a,d) => a+(d.value||0), 0)),
            backgroundColor:'#5ba4f555', borderColor:'#5ba4f5', borderWidth:1, borderRadius:4,
          },
          {
            label: 'Uzavreté',
            data: months.map(m => deals.filter(d => d.stage==='Uzavreté' && d.createdAt?.startsWith(m.key)).reduce((a,d) => a+(d.value||0), 0)),
            backgroundColor:'#3ecf8e88', borderColor:'#3ecf8e', borderWidth:1, borderRadius:4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color:'#66668a', font:{ size:11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${EUR(ctx.raw)}` } },
        },
        scales: {
          x: { grid:{ color:'#24243a' }, ticks:{ color:'#66668a' }, border:{ color:'#24243a' } },
          y: { grid:{ color:'#24243a' }, ticks:{ color:'#66668a', callback: v => EUR(v) }, border:{ color:'#24243a' } },
        },
      },
    });
    this._charts.push(chart);
  },
};
