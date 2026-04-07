// ── views/dashboard.js ───────────────────────────────────────────────────────

const dashboardView = {
  _charts: [],

  _destroyCharts() {
    this._charts.forEach(c => { try { c.destroy(); } catch {} });
    this._charts = [];
  },

  render() {
    this._destroyCharts();
    const { contacts, deals, orders, commissions } = app.state;

    const activeDeals  = deals.filter(d => DEAL_ACTIVE.includes(d.status));
    const pipeVal      = activeDeals.reduce((a, d) => a + (d.value || 0), 0);
    const wonDeals     = deals.filter(d => d.status === 'won');
    const lostDeals    = deals.filter(d => d.status === 'lost');
    const wonVal       = wonDeals.reduce((a, d) => a + (d.value || 0), 0);
    const winRate      = (wonDeals.length + lostDeals.length) > 0
      ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100) : 0;
    const pendComm     = commissions.filter(c => c.status === 'pending').reduce((a, c) => a + c.amount, 0);
    const approvedComm = commissions.filter(c => c.status === 'approved').reduce((a, c) => a + c.amount, 0);
    const orderVal     = orders.filter(o => o.status === 'completed').reduce((a, o) => a + (o.value || 0), 0);

    // Top členovia podľa hodnoty obchodov
    const memberTotals = {};
    deals.forEach(d => {
      if (!d.contactId) return;
      memberTotals[d.contactId] = (memberTotals[d.contactId] || 0) + (d.value || 0);
    });
    const topMembers = Object.entries(memberTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, val]) => ({
        name:  contacts.find(c => c.id === id)?.name || '—',
        type:  contacts.find(c => c.id === id)?.type || '',
        value: val,
        deals: deals.filter(d => d.contactId === id).length,
      }));
    const maxMember = topMembers[0]?.value || 1;

    const typeColors = { Člen:'#5ba4f5', Firma:'#d4943a', Iné:'#66668a' };

    return `
      <div class="view-head"><h2>Dashboard</h2>
        <button class="btn-ghost" style="font-size:12px;" onclick="app._loadData().then(()=>app.renderContent())">↻ Obnoviť</button>
      </div>

      <!-- KPI -->
      <div class="kpi-grid">
        <div class="card kpi-main">
          <div class="kpi-label">Aktívna pipeline</div>
          <div class="kpi-big mono" style="color:var(--acc);">${EUR(pipeVal)}</div>
          <div class="kpi-sub">${activeDeals.length} aktívnych leadov</div>
          <div class="kpi-sub" style="margin-top:4px;">${contacts.length} členov · ${deals.length} leadov celkom</div>
        </div>
        <div class="kpi-side">
          <div class="card kpi-small">
            <div class="kpi-label">Vyhraté obchody</div>
            <div class="kpi-med mono" style="color:var(--green);">${EUR(wonVal)}</div>
            <div class="kpi-sub">${wonDeals.length} obchodov</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Win rate</div>
            <div class="kpi-med mono" style="color:${winRate>=50?'var(--green)':'var(--acc)'};">${winRate}%</div>
            <div class="kpi-sub">${wonDeals.length} z ${wonDeals.length+lostDeals.length}</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Obrat (dokončené)</div>
            <div class="kpi-med mono" style="color:var(--purple);">${EUR(orderVal)}</div>
            <div class="kpi-sub">${orders.filter(o=>o.status==='completed').length} objednávok</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Čakajúce provízie</div>
            <div class="kpi-med mono" style="color:var(--acc);">${EUR(pendComm + approvedComm)}</div>
            <div class="kpi-sub">Schválené: ${EUR(approvedComm)}</div>
          </div>
        </div>
      </div>

      <!-- Grafy -->
      <div class="charts-row">
        <div class="card" style="flex:1.6;">
          <div class="chart-title">Pipeline podľa stavu</div>
          <canvas id="chart-funnel" height="220"></canvas>
        </div>
        <div class="card" style="flex:1;display:flex;flex-direction:column;align-items:center;">
          <div class="chart-title" style="align-self:flex-start;">Objednávky</div>
          <div style="position:relative;width:180px;height:180px;margin:0 auto;">
            <canvas id="chart-donut"></canvas>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
              <div class="mono" style="font-size:15px;font-weight:700;">${orders.length}</div>
              <div style="font-size:10px;color:var(--muted);">celkom</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;font-size:11px;flex-wrap:wrap;justify-content:center;">
            ${Object.entries(ORDER_STATUS_LABELS).map(([k,v]) => `
              <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:7px;height:7px;border-radius:50%;background:${ORDER_STATUS_COLORS[k]};"></div>
                <span style="color:var(--muted);">${v}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Mesačný trend -->
      <div class="card" style="margin-bottom:14px;">
        <div class="chart-title">Mesačný vývoj (posledných 6 mesiacov)</div>
        <canvas id="chart-monthly" height="110"></canvas>
      </div>

      <!-- Top členovia -->
      <div class="card">
        <div class="chart-title">Top členovia podľa hodnoty leadov</div>
        ${topMembers.length === 0
          ? '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Žiadne dáta</div>'
          : topMembers.map((m, i) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;width:16px;">#${i+1}</span>
                  <span style="font-size:13px;font-weight:600;">${esc(m.name)}</span>
                  ${m.type ? `<span class="badge" style="background:${typeColors[m.type]||'#66668a'}22;color:${typeColors[m.type]||'#66668a'};border:1px solid ${typeColors[m.type]||'#66668a'}44;font-size:10px;">${esc(m.type)}</span>` : ''}
                  <span style="font-size:11px;color:var(--muted);">${m.deals} leadov</span>
                </div>
                <span class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${EUR(m.value)}</span>
              </div>
              <div style="height:5px;background:var(--brd);border-radius:3px;">
                <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),#f0b85a);width:${Math.round(m.value/maxMember*100)}%;transition:width 0.6s;"></div>
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
    const data = DEAL_STATUSES.map(s => ({
      label: DEAL_STATUS_LABELS[s],
      value: deals.filter(d => d.status === s).reduce((a, d) => a + (d.value||0), 0),
      count: deals.filter(d => d.status === s).length,
      color: DEAL_STATUS_COLORS[s],
    }));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color + 'bb'),
          borderColor: data.map(d => d.color),
          borderWidth: 1, borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${EUR(ctx.raw)}  (${data[ctx.dataIndex].count}×)` } },
        },
        scales: {
          x: { grid:{ color:'#24243a' }, ticks:{ color:'#66668a', callback: v => EUR(v) }, border:{ color:'#24243a' } },
          y: { grid:{ display:false }, ticks:{ color:'#dcdcf0', font:{ size:12 } }, border:{ color:'#24243a' } },
        },
      },
    });
    this._charts.push(chart);
  },

  _initDonut() {
    const canvas = document.getElementById('chart-donut');
    if (!canvas || typeof Chart === 'undefined') return;
    const { orders } = app.state;
    const data   = Object.keys(ORDER_STATUS_LABELS);
    const values = data.map(s => orders.filter(o => o.status === s).length);
    if (values.every(v => v === 0)) values[0] = 0.001;
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map(s => ORDER_STATUS_LABELS[s]),
        datasets: [{
          data: values,
          backgroundColor: data.map(s => ORDER_STATUS_COLORS[s] + '99'),
          borderColor:     data.map(s => ORDER_STATUS_COLORS[s]),
          borderWidth: 2, hoverOffset: 6,
        }],
      },
      options: {
        cutout: '70%', responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
        },
      },
    });
    this._charts.push(chart);
  },

  _initMonthly() {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas || typeof Chart === 'undefined') return;
    const { deals, orders } = app.state;
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
            label: 'Nové leady',
            data: months.map(m => deals.filter(d => (d.createdAt||'').startsWith(m.key)).reduce((a,d)=>a+(d.value||0),0)),
            backgroundColor:'#5ba4f555', borderColor:'#5ba4f5', borderWidth:1, borderRadius:4,
          },
          {
            label: 'Vyhraté',
            data: months.map(m => deals.filter(d => d.status==='won' && (d.createdAt||'').startsWith(m.key)).reduce((a,d)=>a+(d.value||0),0)),
            backgroundColor:'#3ecf8e88', borderColor:'#3ecf8e', borderWidth:1, borderRadius:4,
          },
          {
            label: 'Objednávky',
            data: months.map(m => orders.filter(o => (o.createdAt||'').startsWith(m.key)).reduce((a,o)=>a+(o.value||0),0)),
            backgroundColor:'#c084fc88', borderColor:'#c084fc', borderWidth:1, borderRadius:4,
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
