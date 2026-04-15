// ── views/dashboard.js ───────────────────────────────────────────────────────

const dashboardView = {
  _charts: [],

  _destroyCharts() {
    this._charts.forEach(c => { try { c.destroy(); } catch {} });
    this._charts = [];
  },

  render() {
    this._destroyCharts();
    const { contacts, orders, commissions } = app.state;
    const deals = app.state.deals || [];

    const activeDeals  = deals.filter(d => !['lost','cancelled'].includes(d.status));
    const paidDeals    = deals.filter(d => ['paid','in_progress','completed'].includes(d.status));
    const wonDeals     = deals.filter(d => d.status === 'won');
    const lostDeals    = deals.filter(d => d.status === 'lost');
    const pipeVal      = activeDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const paidVal      = paidDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const winRate      = (wonDeals.length+lostDeals.length) > 0
      ? Math.round(wonDeals.length/(wonDeals.length+lostDeals.length)*100) : 0;
    const newDeals     = deals.filter(d => d.status === 'new' && !d.reviewed_at).length;
    const pendComm     = commissions.filter(c => c.status==='pending').reduce((a,c)  => a+(c.amount||0), 0);
    const approvedComm = commissions.filter(c => c.status==='approved').reduce((a,c) => a+(c.amount||0), 0);

    // Top členovia
    const memberTotals = {};
    deals.forEach(d => {
      if (!d.contact_id) return;
      memberTotals[d.contact_id] = (memberTotals[d.contact_id]||0) + (d.sale_price_snapshot||0);
    });
    const topMembers = Object.entries(memberTotals)
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([id, val]) => ({
        name:  contacts.find(c=>c.id===id)?.name || '—',
        value: val,
        deals: deals.filter(d=>d.contact_id===id).length,
      }));
    const maxMember = topMembers[0]?.value || 1;

    // Mesačné dáta
    const now = new Date();
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyData.push({
        label: d.toLocaleDateString('sk-SK', { month:'short' }),
        new:   deals.filter(x => (x.created_at||'').startsWith(key)).length,
        paid:  deals.filter(x => ['paid','in_progress','completed'].includes(x.status) && (x.paid_at||x.created_at||'').startsWith(key))
                    .reduce((a,x)=>a+(x.sale_price_snapshot||0),0),
      });
    }

    return `
      <div class="view-head"><h2>Dashboard</h2>
        <button class="btn-ghost" style="font-size:12px;" onclick="app._loadData().then(()=>app.renderContent())">↻ Obnoviť</button>
        ${newDeals > 0 ? `<span class="badge" style="background:rgba(212,148,58,0.15);color:var(--acc);border:1px solid var(--acc-brd);">⏳ ${newDeals} čaká</span>` : ''}
      </div>

      <!-- KPI -->
      <div class="kpi-grid">
        <div class="card kpi-main">
          <div class="kpi-label">Aktívna pipeline</div>
          <div class="kpi-big mono" style="color:var(--acc);">${EUR(pipeVal)}</div>
          <div class="kpi-sub">${activeDeals.length} aktívnych dealov</div>
          <div class="kpi-sub" style="margin-top:4px;">${contacts.length} členov · ${deals.length} dealov celkom</div>
        </div>
        <div class="kpi-side">
          <div class="card kpi-small">
            <div class="kpi-label">Zaplatené</div>
            <div class="kpi-med mono" style="color:var(--green);">${EUR(paidVal)}</div>
            <div class="kpi-sub">${paidDeals.length} dealov</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Win rate</div>
            <div class="kpi-med mono" style="color:${winRate>=50?'var(--green)':'var(--acc)'};">${winRate}%</div>
            <div class="kpi-sub">${wonDeals.length} z ${wonDeals.length+lostDeals.length}</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Čakajúce provízie</div>
            <div class="kpi-med mono" style="color:var(--acc);">${EUR(pendComm+approvedComm)}</div>
            <div class="kpi-sub">Schválené: ${EUR(approvedComm)}</div>
          </div>
          <div class="card kpi-small">
            <div class="kpi-label">Nové tento mesiac</div>
            <div class="kpi-med mono" style="color:var(--purple);">${monthlyData[5]?.new||0}</div>
            <div class="kpi-sub">dealov</div>
          </div>
        </div>
      </div>

      <!-- Grafy -->
      <div class="charts-row">
        <div class="card" style="flex:1.6;">
          <div class="chart-title">Pipeline funnel</div>
          <canvas id="chart-funnel" height="220"></canvas>
        </div>
        <div class="card" style="flex:1;display:flex;flex-direction:column;align-items:center;">
          <div class="chart-title" style="align-self:flex-start;">Dealy podľa stavu</div>
          <div style="position:relative;width:180px;height:180px;margin:0 auto;">
            <canvas id="chart-donut"></canvas>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
              <div class="mono" style="font-size:15px;font-weight:700;">${deals.length}</div>
              <div style="font-size:10px;color:var(--muted);">celkom</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mesačný vývoj -->
      <div class="card" style="margin-bottom:14px;">
        <div class="chart-title">Mesačný vývoj (posledných 6 mesiacov)</div>
        <canvas id="chart-monthly" height="110"></canvas>
      </div>

      <!-- Top členovia -->
      <div class="card">
        <div class="chart-title">Top členovia podľa hodnoty dealov</div>
        ${topMembers.length === 0
          ? '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Žiadne dáta</div>'
          : topMembers.map((m, i) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;width:16px;">#${i+1}</span>
                  <span style="font-size:13px;font-weight:600;">${esc(m.name)}</span>
                  <span style="font-size:11px;color:var(--muted);">${m.deals} dealov</span>
                </div>
                <span class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${EUR(m.value)}</span>
              </div>
              <div style="height:5px;background:var(--brd);border-radius:3px;">
                <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),#f0b85a);width:${Math.round(m.value/maxMember*100)}%;"></div>
              </div>
            </div>`).join('')}
      </div>

      <!-- Pilotný monitoring -->
      <div id="monitoring-wrap" style="margin-top:14px;"></div>`;
  },

  async afterRender() {
    this._destroyCharts();
    await app._loadData();
    const content = document.getElementById('content');
    if (content) content.innerHTML = this.render();
    this._initFunnel();
    this._initDonut();
    this._initMonthly();
    await this._loadMonitoring();
  },

  async _loadMonitoring() {
    const el = document.getElementById('monitoring-wrap');
    if (!el) return;

    const today = new Date().toISOString().slice(0,10);
    const daysDiff = (dateStr) => Math.floor((new Date() - new Date(dateStr)) / 86400000);

    const [invRes, dealRes, commRes, auditRes] = await Promise.all([
      db.client.from('invoices').select('id,invoice_number,status,due_date,amount_inc_vat,deal_id,issue_date').not('status','in','("cancelled","draft")').order('due_date'),
      db.client.from('deals').select('id,title,status,payment_pending_at,created_at').order('created_at'),
      db.client.from('commissions').select('id,amount,status,created_at,notes').eq('status','pending').order('created_at'),
      db.client.from('audit_logs').select('action,created_at,entity_id,old_value,new_value')
        .in('action',['status_changed','price_changed_after_invoice','discount_applied'])
        .order('created_at',{ascending:false}).limit(20),
    ]);

    const invoices = invRes.data || [];
    const deals    = dealRes.data || [];
    const comms    = commRes.data || [];
    const audits   = auditRes.data || [];

    // Kategorizácia
    const overdueInvs  = invoices.filter(i => i.status === 'sent' && i.due_date < today)
      .sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
    const pendingInvs  = invoices.filter(i => i.status === 'sent' && i.due_date >= today)
      .sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
    const longPending  = deals.filter(d => d.status === 'payment_pending' && d.payment_pending_at && daysDiff(d.payment_pending_at) > 7);
    const allPending   = deals.filter(d => d.status === 'payment_pending');
    const priceChanges = audits.filter(a => a.action === 'price_changed_after_invoice');
    const relevantAudit = audits.filter(a => a.action === 'status_changed').slice(0,5);

    // Sekcie
    const critical = [];
    const attention = [];
    const info = [];

    // KRITICKÉ
    if (overdueInvs.length > 0) {
      const oldest = daysDiff(overdueInvs[0].due_date);
      critical.push({
        icon: '🔴',
        title: `${overdueInvs.length} faktúr po splatnosti`,
        subtitle: `Najstaršia: ${oldest} dní | Celková suma: ${EUR(overdueInvs.reduce((a,i)=>a+i.amount_inc_vat,0))}`,
        items: overdueInvs.slice(0,3).map(i => `${i.invoice_number} — ${daysDiff(i.due_date)} dní — ${EUR(i.amount_inc_vat)}`),
        action: "app.setView('payouts')",
        color: 'var(--red)',
      });
    }
    if (priceChanges.length > 0) {
      critical.push({
        icon: '⚠️',
        title: `${priceChanges.length} zmien ceny po faktúre`,
        subtitle: 'Faktúra môže mať inú sumu ako deal',
        items: priceChanges.slice(0,3).map(a => `Deal zmenený ${new Date(a.created_at).toLocaleDateString('sk-SK')}`),
        action: "app.setView('pipeline')",
        color: 'var(--red)',
      });
    }

    // POZORNOSŤ
    if (pendingInvs.length > 0) {
      const nearest = Math.max(0, Math.ceil((new Date(pendingInvs[0].due_date) - new Date()) / 86400000));
      attention.push({
        icon: '🟡',
        title: `${pendingInvs.length} faktúr čaká na úhradu`,
        subtitle: `Najbližšia splatnosť: ${nearest} dní | Suma: ${EUR(pendingInvs.reduce((a,i)=>a+i.amount_inc_vat,0))}`,
        items: pendingInvs.slice(0,3).map(i => `${i.invoice_number} — splatnosť ${i.due_date} — ${EUR(i.amount_inc_vat)}`),
        action: "app.setView('payouts')",
        color: '#f59e0b',
      });
    }
    if (comms.length > 0) {
      const oldest = daysDiff(comms[0].created_at);
      attention.push({
        icon: '🟡',
        title: `${comms.length} komisií čaká na schválenie`,
        subtitle: `Najstaršia: ${oldest} dní | Suma: ${EUR(comms.reduce((a,c)=>a+c.amount,0))}`,
        items: comms.slice(0,3).map(c => `${EUR(c.amount)} — ${daysDiff(c.created_at)} dní`),
        action: "app.setView('commissions')",
        color: '#f59e0b',
      });
    }
    if (longPending.length > 0) {
      attention.push({
        icon: '🟡',
        title: `${longPending.length} dealov čaká na platbu viac ako 7 dní`,
        subtitle: `Celkom v payment_pending: ${allPending.length}`,
        items: longPending.slice(0,3).map(d => `${esc(d.title)} — ${daysDiff(d.payment_pending_at)} dní`),
        action: "app.setView('pipeline')",
        color: '#f59e0b',
      });
    } else if (allPending.length > 0) {
      info.push({
        icon: 'ℹ️',
        title: `${allPending.length} dealov v stave Čaká platba`,
        subtitle: 'Všetky v rámci bežnej lehoty',
        action: "app.setView('pipeline')",
        color: 'var(--muted)',
      });
    }

    // INFORMATÍVNE — posledná aktivita
    if (relevantAudit.length > 0) {
      info.push({
        icon: '📋',
        title: 'Posledná aktivita',
        subtitle: relevantAudit[0] ? `${relevantAudit[0].old_value} → ${relevantAudit[0].new_value} (${new Date(relevantAudit[0].created_at).toLocaleString('sk-SK')})` : '—',
        action: null,
        color: 'var(--muted)',
      });
    }

    if (critical.length === 0 && attention.length === 0 && info.filter(i=>i.icon!=='ℹ️'&&i.icon!=='📋').length === 0) {
      el.innerHTML = `
        <div class="card" style="border-color:rgba(62,207,142,0.3);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">✅</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--green);">Systém bez problémov</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">Žiadne kritické stavy — faktúry, komisie, nekonzistencie</div>
            </div>
          </div>
          ${info.length > 0 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--brd);">
            ${info.map(i=>`<div style="font-size:12px;color:var(--muted);">${i.icon} ${i.title}${i.subtitle?' — '+i.subtitle:''}</div>`).join('')}
          </div>` : ''}
        </div>`;
      return;
    }

    const renderSection = (items, sectionTitle, sectionColor) => items.length === 0 ? '' : `
      <div style="font-size:10px;font-weight:700;color:${sectionColor};text-transform:uppercase;letter-spacing:0.08em;margin:12px 0 6px;">${sectionTitle}</div>
      ${items.map(item => `
        <div style="background:var(--inp);border:1px solid ${item.color}33;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:${item.color};margin-bottom:2px;">${item.icon} ${item.title}</div>
              <div style="font-size:11px;color:var(--muted);">${item.subtitle||''}</div>
              ${(item.items||[]).length > 0 ? `<div style="margin-top:6px;">${item.items.map(i=>`<div style="font-size:11px;color:var(--txt);padding:1px 0;">• ${i}</div>`).join('')}</div>` : ''}
            </div>
            ${item.action ? `<button class="btn-ghost" style="font-size:11px;flex-shrink:0;" onclick="${item.action}">Zobraziť →</button>` : ''}
          </div>
        </div>`).join('')}`;

    el.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">🔍 Monitoring</div>
      ${renderSection(critical, '🔴 Kritické', 'var(--red)')}
      ${renderSection(attention, '🟡 Vyžaduje pozornosť', '#f59e0b')}
      ${renderSection(info, 'ℹ Informatívne', 'var(--muted)')}`;
  },

  _initFunnel() {
    const canvas = document.getElementById('chart-funnel');
    if (!canvas || typeof Chart === 'undefined') return;
    const deals = app.state.deals || [];
    const COLS = [
      { key:'new',             label:'Nový',         color:'#66668a' },
      { key:'assigned',        label:'Priradený',     color:'#5ba4f5' },
      { key:'contacted',       label:'Kontaktovaný',  color:'#a78bfa' },
      { key:'qualified',       label:'Kvalifikovaný', color:'#f0b85a' },
      { key:'offer_sent',      label:'Ponuka',        color:'#d4943a' },
      { key:'won',             label:'Vyhraný',       color:'#3ecf8e' },
      { key:'payment_pending', label:'Čaká platba',   color:'#f59e0b' },
      { key:'paid',            label:'Zaplatený',     color:'#10b981' },
      { key:'in_progress',     label:'V realizácii',  color:'#6366f1' },
      { key:'completed',       label:'Dokončený',     color:'#3ecf8e' },
    ];
    const data = COLS.map(c => ({
      ...c,
      count: deals.filter(d=>d.status===c.key).length,
    }));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d=>d.label),
        datasets: [{
          data: data.map(d=>d.count),
          backgroundColor: data.map(d=>d.color+'bb'),
          borderColor:     data.map(d=>d.color),
          borderWidth:1, borderRadius:5,
        }],
      },
      options: {
        indexAxis:'y', responsive:true,
        plugins: {
          legend:{ display:false },
          tooltip:{ callbacks:{ label: ctx => ` ${ctx.raw} dealov` } },
        },
        scales: {
          x:{ grid:{color:'#24243a'}, ticks:{color:'#66668a',stepSize:1}, border:{color:'#24243a'} },
          y:{ grid:{display:false}, ticks:{color:'#dcdcf0',font:{size:11}}, border:{color:'#24243a'} },
        },
      },
    });
    this._charts.push(chart);
  },

  _initDonut() {
    const canvas = document.getElementById('chart-donut');
    if (!canvas || typeof Chart === 'undefined') return;
    const deals = app.state.deals || [];
    const groups = [
      { label:'Vstupné',    statuses:['new','assigned','contacted'],       color:'#5ba4f5' },
      { label:'Kvalif.',    statuses:['qualified','offer_sent'],            color:'#f0b85a' },
      { label:'Vyhraté',    statuses:['won','payment_pending'],             color:'#3ecf8e' },
      { label:'Zaplatené',  statuses:['paid','in_progress','completed'],    color:'#10b981' },
      { label:'Stratené',   statuses:['lost','cancelled'],                  color:'#f25555' },
    ];
    const values = groups.map(g => deals.filter(d=>g.statuses.includes(d.status)).length);
    if (values.every(v=>v===0)) values[0] = 0.001;
    const chart = new Chart(canvas, {
      type:'doughnut',
      data:{
        labels: groups.map(g=>g.label),
        datasets:[{
          data: values,
          backgroundColor: groups.map(g=>g.color+'99'),
          borderColor:     groups.map(g=>g.color),
          borderWidth:2, hoverOffset:6,
        }],
      },
      options:{
        cutout:'70%', responsive:true,
        plugins:{
          legend:{ display:false },
          tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
        },
      },
    });
    this._charts.push(chart);
  },

  _initMonthly() {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas || typeof Chart === 'undefined') return;
    const deals = app.state.deals || [];
    const now   = new Date();
    const months = [];
    for (let i=5;i>=0;i--) {
      const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({
        label: d.toLocaleDateString('sk-SK',{month:'short',year:'2-digit'}),
        new:   deals.filter(x=>(x.created_at||'').startsWith(key)).length,
        paid:  deals.filter(x=>['paid','in_progress','completed'].includes(x.status)&&(x.paid_at||x.created_at||'').startsWith(key))
                    .reduce((a,x)=>a+(x.sale_price_snapshot||0),0),
      });
    }
    const chart = new Chart(canvas, {
      type:'bar',
      data:{
        labels: months.map(m=>m.label),
        datasets:[
          {
            label:'Nové dealy',
            data: months.map(m=>m.new),
            backgroundColor:'#5ba4f555', borderColor:'#5ba4f5', borderWidth:1, borderRadius:4,
            yAxisID:'yCount',
          },
          {
            label:'Obrat (€)',
            data: months.map(m=>m.paid),
            backgroundColor:'#3ecf8e88', borderColor:'#3ecf8e', borderWidth:1, borderRadius:4,
            yAxisID:'yEur',
          },
        ],
      },
      options:{
        responsive:true,
        plugins:{
          legend:{ labels:{ color:'#66668a', font:{size:11} } },
          tooltip:{ callbacks:{ label: ctx => ctx.datasetIndex===0 ? ` ${ctx.raw} ks` : ` ${EUR(ctx.raw)}` } },
        },
        scales:{
          x:      { grid:{color:'#24243a'}, ticks:{color:'#66668a'}, border:{color:'#24243a'} },
          yEur:   { position:'left',  grid:{color:'#24243a'}, ticks:{color:'#66668a',callback:v=>EUR(v)}, border:{color:'#24243a'} },
          yCount: { position:'right', grid:{display:false}, ticks:{color:'#5ba4f5',stepSize:1}, border:{color:'#24243a'} },
        },
      },
    });
    this._charts.push(chart);
  },
};
