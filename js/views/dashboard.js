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
    const leads = app.state.leads || [];
    const opps  = app.state.opportunities || [];

    // Pipeline z opportunities (nový model)
    const activeOpps   = opps.filter(o => ['open','negotiation'].includes(o.status));
    const wonOpps      = opps.filter(o => o.status === 'won');
    const lostOpps     = opps.filter(o => o.status === 'lost');
    const pipeVal      = activeOpps.reduce((a, o) => a + (o.value || 0), 0);
    const wonVal       = wonOpps.reduce((a, o) => a + (o.value || 0), 0);
    const winRate      = (wonOpps.length + lostOpps.length) > 0
      ? Math.round(wonOpps.length / (wonOpps.length + lostOpps.length) * 100) : 0;

    // Leady
    const newLeads     = leads.filter(l => l.status === 'new' && !l.approved_at).length;
    const activeLeads  = leads.filter(l => !['lost','cancelled'].includes(l.status)).length;

    const pendComm     = commissions.filter(c => c.status === 'pending').reduce((a, c) => a + (c.amount||0), 0);
    const approvedComm = commissions.filter(c => c.status === 'approved').reduce((a, c) => a + (c.amount||0), 0);
    const orderVal     = orders.filter(o => ['paid','in_progress','completed'].includes(o.status)).reduce((a, o) => a + (o.value || 0), 0);
    const completedVal = orders.filter(o => o.status === 'completed').reduce((a, o) => a + (o.value || 0), 0);

    // Top produkty podľa objednávok
    const prodCount = {};
    orders.forEach(o => {
      const name = o.product_name_snapshot || '—';
      prodCount[name] = (prodCount[name] || 0) + 1;
    });
    const topProds = Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

    // Top členovia podľa hodnoty opportunities
    const memberTotals = {};
    opps.forEach(o => {
      if (!o.contact_id) return;
      memberTotals[o.contact_id] = (memberTotals[o.contact_id] || 0) + (o.value || 0);
    });
    const topMembers = Object.entries(memberTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, val]) => ({
        name:  contacts.find(c => c.id === id)?.name || '—',
        value: val,
        opps:  opps.filter(o => o.contact_id === id).length,
      }));
    const maxMember = topMembers[0]?.value || 1;

    // Mesačný obrat (posledných 6 mesiacov)
    const now = new Date();
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const mo = orders.filter(o => {
        const od = new Date(o.created_at);
        return od.getMonth() === m && od.getFullYear() === y &&
          ['paid','in_progress','completed'].includes(o.status);
      });
      monthlyData.push({
        label: d.toLocaleDateString('sk-SK', { month: 'short' }),
        value: mo.reduce((a, o) => a + (o.value || 0), 0),
        count: mo.length,
      });
    }

    return `
      <div class="view-head"><h2>Dashboard</h2>
        <button class="btn-ghost" style="font-size:12px;" onclick="app._loadData().then(()=>app.renderContent())">↻ Obnoviť</button>
        ${newLeads > 0 ? `<span class="badge" style="background:rgba(212,148,58,0.15);color:var(--acc);border:1px solid var(--acc-brd);">⏳ ${newLeads} leadov čaká</span>` : ''}
      </div>

      <!-- KPI -->
      <div class="kpi-grid">
        <div class="card kpi-main">
          <div class="kpi-label">Aktívna pipeline</div>
          <div class="kpi-big mono" style="color:var(--acc);">${EUR(pipeVal)}</div>
          <div class="kpi-sub">${activeOpps.length} príležitostí · ${activeLeads} leadov</div>
          <div class="kpi-sub" style="margin-top:4px;">${contacts.length} členov celkom</div>
        </div>
        <div class="kpi-side">
          <div class="card kpi-small">
            <div class="kpi-label">Vyhraté príležitosti</div>
            <div class="kpi-med mono" style="color:var(--green);">${EUR(wonVal)}</div>
            <div class="kpi-sub">${wonOpps.length} uzatvorených</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Win rate</div>
            <div class="kpi-med mono" style="color:${winRate>=50?'var(--green)':'var(--acc)'};">${winRate}%</div>
            <div class="kpi-sub">${wonOpps.length} z ${wonOpps.length+lostOpps.length}</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Obrat (zaplatené)</div>
            <div class="kpi-med mono" style="color:var(--purple);">${EUR(orderVal)}</div>
            <div class="kpi-sub">Dokončené: ${EUR(completedVal)}</div>
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
        <div class="chart-title">Top členovia podľa hodnoty príležitostí</div>
        ${topMembers.length === 0
          ? '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Žiadne dáta</div>'
          : topMembers.map((m, i) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;width:16px;">#${i+1}</span>
                  <span style="font-size:13px;font-weight:600;">${esc(m.name)}</span>
                  <span style="font-size:11px;color:var(--muted);">${m.opps} príležitostí</span>
                </div>
                <span class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${EUR(m.value)}</span>
              </div>
              <div style="height:5px;background:var(--brd);border-radius:3px;">
                <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),#f0b85a);width:${Math.round(m.value/maxMember*100)}%;"></div>
              </div>
            </div>`).join('')}
      </div>`;
  },

  async afterRender() {
    // Vždy načítaj čerstvé dáta pre dashboard
    await app._loadData();
    this._destroyCharts();
    // Re-render s novými dátami
    const content = document.getElementById('content');
    if (content) {
      const newHtml = this.render();
      content.innerHTML = newHtml;
    }
    this._initFunnel();
    this._initDonut();
    this._initMonthly();
  },

  _initFunnel() {
    const canvas = document.getElementById('chart-funnel');
    if (!canvas || typeof Chart === 'undefined') return;
    const opps  = app.state.opportunities || [];
    const leads = app.state.leads || [];

    const data = [
      { label: 'Nové leady',     value: leads.filter(l=>l.status==='new').length,         color: '#66668a' },
      { label: 'Kontaktovaní',   value: leads.filter(l=>l.status==='contacted').length,    color: '#5ba4f5' },
      { label: 'Kvalifikovaní',  value: leads.filter(l=>l.status==='qualified').length,    color: '#a78bfa' },
      { label: 'Príležitosti',   value: opps.filter(o=>o.status==='open').length,          color: '#d4943a' },
      { label: 'Rokovanie',      value: opps.filter(o=>o.status==='negotiation').length,   color: '#f0b85a' },
      { label: 'Vyhraté',        value: opps.filter(o=>o.status==='won').length,           color: '#3ecf8e' },
    ];
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
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw} záznamov` } },
        },
        scales: {
          x: { grid:{ color:'#24243a' }, ticks:{ color:'#66668a', stepSize: 1 }, border:{ color:'#24243a' } },
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
