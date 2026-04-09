// ── views/reporting.js — Reporting a analytics ───────────────────────────────

const reportingView = {
  _data: null,

  render() {
    return `
      <div class="view-head">
        <h2>📈 Reporting</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost" style="font-size:12px;" onclick="reportingView.afterRender()">↻ Obnoviť</button>
          <button class="btn-ghost" style="font-size:12px;" onclick="reportingView.exportXLSX()">⬇ Export XLSX</button>
        </div>
      </div>
      <div id="report-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._render();
  },

  async _load() {
    const [
      { data: orders },
      { data: comms },
      { data: products },
      { data: leads },
      { data: members },
    ] = await Promise.all([
      db.client.from('orders').select('*, products(name,category,subcategory,base_price,cost_price)').order('created_at'),
      db.client.from('commissions').select('*, profiles!commissions_owner_id_fkey(name)').order('created_at'),
      db.client.from('products').select('*').eq('is_active', true),
      db.client.from('leads').select('*').order('created_at'),
      db.client.from('profiles').select('*').eq('role', 'clen'),
    ]);
    this._data = { orders: orders||[], comms: comms||[], products: products||[], leads: leads||[], members: members||[] };
  },

  _render() {
    const el = document.getElementById('report-wrap');
    if (!el || !this._data) return;
    const { orders, comms, products, leads, members } = this._data;
    const fmt  = v => Math.round(v||0).toLocaleString('sk-SK') + ' €';
    const fmtN = v => Math.round(v||0).toLocaleString('sk-SK');

    // Celkové metriky
    const completedOrders = orders.filter(o => o.status === 'completed');
    const paidOrders      = orders.filter(o => ['paid','in_progress','completed'].includes(o.status));
    const totalRevenue    = paidOrders.reduce((a,o) => a+(o.sale_price_snapshot||o.value||0), 0);
    const totalCost       = paidOrders.reduce((a,o) => a+(o.cost_snapshot||0), 0);
    const totalComm       = comms.filter(c=>c.status!=='cancelled').reduce((a,c) => a+(c.amount||0), 0);
    const totalNet        = totalRevenue - totalCost - totalComm;
    const wonLeads        = leads.filter(l => l.status === 'won');
    const allClosed       = leads.filter(l => ['won','lost'].includes(l.status));
    const convRate        = allClosed.length ? Math.round(wonLeads.length/allClosed.length*100) : 0;

    // Revenue podľa mesiaca (posledných 6 mesiacov)
    const monthlyRev = {};
    paidOrders.forEach(o => {
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthlyRev[k]) monthlyRev[k] = { rev:0, comm:0, orders:0 };
      monthlyRev[k].rev    += o.sale_price_snapshot || o.value || 0;
      monthlyRev[k].orders += 1;
    });
    comms.filter(c=>c.status!=='cancelled').forEach(c => {
      const d = new Date(c.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (monthlyRev[k]) monthlyRev[k].comm += c.amount || 0;
    });
    const months = Object.keys(monthlyRev).sort().slice(-6);

    // Top produkty podľa tržieb
    const prodStats = {};
    paidOrders.forEach(o => {
      const name = o.products?.name || o.product_name_snapshot || 'Neznámy';
      const cat  = o.products?.category || '—';
      if (!prodStats[name]) prodStats[name] = { name, cat, rev:0, count:0, comm:0 };
      prodStats[name].rev   += o.sale_price_snapshot || o.value || 0;
      prodStats[name].count += 1;
    });
    const topProds = Object.values(prodStats).sort((a,b)=>b.rev-a.rev).slice(0,8);

    // Obchodníci
    const obStats = {};
    comms.filter(c=>c.status!=='cancelled').forEach(c => {
      const name = c.profiles?.name || c.owner_id || '—';
      if (!obStats[name]) obStats[name] = { name, comm:0, paid:0, count:0 };
      obStats[name].comm  += c.amount || 0;
      obStats[name].count += 1;
      if (c.status==='paid') obStats[name].paid += c.amount||0;
    });
    const topOb = Object.values(obStats).sort((a,b)=>b.comm-a.comm).slice(0,6);

    el.innerHTML = `
      <!-- Hlavné KPI -->
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Tržby celkom</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${fmt(totalRevenue)}</div>
          <div style="font-size:11px;color:var(--muted);">${fmtN(paidOrders.length)} objednávok</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Náklady</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--red);">${fmt(totalCost)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Provízie</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${fmt(totalComm)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Čistý zisk</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--green);">${fmt(totalNet)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Konverzia</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:${convRate>=50?'var(--green)':'var(--acc)'};">${convRate}%</div>
          <div style="font-size:11px;color:var(--muted);">${wonLeads.length}/${allClosed.length} leadov</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Mesačný trend -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Mesačný trend (posledných 6 mes.)
          </div>
          ${months.length === 0 ? '<div style="color:var(--muted);font-size:13px;">Žiadne dáta</div>' :
            months.map(m => {
              const d   = monthlyRev[m];
              const max = Math.max(...months.map(k => monthlyRev[k].rev));
              const pct = max > 0 ? Math.round(d.rev/max*100) : 0;
              const net = d.rev - d.comm;
              return `
                <div style="margin-bottom:10px;">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                    <span style="color:var(--muted);">${m}</span>
                    <span class="mono" style="font-weight:600;">${fmt(d.rev)}</span>
                  </div>
                  <div style="background:var(--inp);border-radius:4px;height:6px;overflow:hidden;">
                    <div style="background:var(--acc);height:100%;width:${pct}%;border-radius:4px;transition:width 0.3s;"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:2px;">
                    <span>Prov: ${fmt(d.comm)}</span>
                    <span style="color:var(--green);">Zostatok: ${fmt(net)}</span>
                  </div>
                </div>`;
            }).join('')}
        </div>

        <!-- Top obchodníci -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Obchodníci — provízie
          </div>
          ${topOb.length === 0 ? '<div style="color:var(--muted);font-size:13px;">Žiadne dáta</div>' :
            topOb.map((o, i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);min-width:18px;">#${i+1}</span>
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(o.name)}</div>
                    <div style="font-size:11px;color:var(--muted);">${o.count} provízií</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="mono" style="font-size:14px;font-weight:700;color:var(--acc);">${fmt(o.comm)}</div>
                  <div style="font-size:11px;color:var(--green);">Vypl: ${fmt(o.paid)}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <!-- Top produkty -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Top produkty — tržby
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--brd);">
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">#</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Predajov</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Tržby</th>
              <th style="padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Podiel</th>
            </tr>
          </thead>
          <tbody>
            ${topProds.length === 0 ? '<tr><td colspan="5" style="padding:12px 8px;color:var(--muted);font-size:13px;">Žiadne dáta</td></tr>' :
              topProds.map((p, i) => {
                const share = totalRevenue > 0 ? Math.round(p.rev/totalRevenue*100) : 0;
                return `
                  <tr style="border-bottom:1px solid var(--brd);">
                    <td style="padding:7px 8px;font-size:12px;color:var(--muted);">${i+1}</td>
                    <td style="padding:7px 8px;">
                      <div style="font-size:13px;font-weight:600;">${esc(p.name)}</div>
                      <div style="font-size:11px;color:var(--muted);">${esc(p.cat)}</div>
                    </td>
                    <td style="padding:7px 8px;text-align:right;font-size:13px;" class="mono">${p.count}×</td>
                    <td style="padding:7px 8px;text-align:right;font-size:13px;font-weight:700;color:var(--acc);" class="mono">${fmt(p.rev)}</td>
                    <td style="padding:7px 8px;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="background:var(--inp);border-radius:4px;height:6px;width:80px;overflow:hidden;">
                          <div style="background:var(--acc);height:100%;width:${share}%;"></div>
                        </div>
                        <span style="font-size:11px;color:var(--muted);">${share}%</span>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Rast členov -->
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Rast členov
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Celkom členov</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--purple);">${members.length}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Tento mesiac</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);">
              ${members.filter(m => {
                const d = new Date(m.created_at);
                const n = new Date();
                return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
              }).length}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Tento týždeň</div>
            <div class="mono" style="font-size:22px;font-weight:700;">
              ${members.filter(m => (new Date()-new Date(m.created_at)) < 7*24*60*60*1000).length}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Cez referral</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">
              ${members.filter(m => m.referred_by).length}
            </div>
          </div>
        </div>
      </div>`;
  },

  exportXLSX() {
    if (!this._data) { alert('Najprv načítaj dáta.'); return; }
    const { orders, comms, leads, products, contacts } = this._data;

    // Pomocná funkcia na konverziu poľa objektov do CSV-like štruktúry
    const toRows = (headers, data) => [headers, ...data];

    // 3 sheety: Objednávky, Provízie, Pipeline
    const ordersData = toRows(
      ['Produkt','Dátum','Stav','Hodnota €','Marža €','Comm %','Comm €'],
      orders.map(o => {
        const p = products.find(x=>x.id===o.product_id);
        return [
          o.product_name_snapshot || p?.name || '—',
          o.created_at?.slice(0,10) || '—',
          o.status,
          o.value || 0,
          o.gross_margin_snapshot || (p ? (o.value||0)-(p.cost_price||0) : ''),
          o.commission_percent_snapshot || '',
          o.commission_amount_snapshot  || '',
        ];
      })
    );

    const commsData = toRows(
      ['Obchodník','Suma €','%','Stav','Dátum','Vyplatené'],
      comms.map(c => [
        c.profiles?.name || c.profiles?.email || '—',
        c.amount || 0,
        c.rate || '',
        c.status,
        c.date?.slice(0,10) || c.created_at?.slice(0,10) || '—',
        c.paid_at?.slice(0,10) || '—',
      ])
    );

    const leadsData = toRows(
      ['Lead','Stav','Hodnota €','Kontakt','Produkt','Zdroj','Uzatvorenie'],
      leads.map(d => {
        const c = contacts.find(x=>x.id===d.contactId||x.id===d.contact_id);
        const p = products.find(x=>x.id===d.productId||x.id===d.product_id);
        return [
          d.title || '—',
          d.status,
          d.value || 0,
          c?.name || '—',
          p?.name || '—',
          d.source || '—',
          d.expectedClose || d.expected_close || '—',
        ];
      })
    );

    // Vytvor workbook pomocou SheetJS cez CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersData),  'Objednávky');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(commsData),   'Provízie');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leadsData),   'Pipeline');

      const date = new Date().toISOString().slice(0,10);
      XLSX.writeFile(wb, `axiona-report-${date}.xlsx`);
    };
    // Ak je SheetJS už načítaný
    if (typeof XLSX !== 'undefined') {
      script.onload();
    } else {
      document.head.appendChild(script);
    }
  },
};
