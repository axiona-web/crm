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
    const [dealsRes, commsRes, productsRes, membersRes] = await Promise.all([
      db.client.from('deals').select('*, profiles(name)').order('created_at'),
      db.client.from('commissions').select('*, profiles(name,email)').order('created_at'),
      db.client.from('products').select('*').eq('is_active', true),
      db.client.from('profiles').select('*').eq('role', 'clen'),
    ]);
    this._data = {
      deals:    dealsRes.data    || [],
      comms:    commsRes.data    || [],
      products: productsRes.data || [],
      members:  membersRes.data  || [],
    };
  },

  _render() {
    const el = document.getElementById('report-wrap');
    if (!el || !this._data) return;
    const { deals, comms, products, members } = this._data;
    const fmt  = v => Math.round(v||0).toLocaleString('sk-SK') + ' €';
    const fmtN = v => Math.round(v||0).toLocaleString('sk-SK');

    // Celkové metriky
    const paidDeals   = deals.filter(d => ['paid','in_progress','completed'].includes(d.status));
    const wonDeals    = deals.filter(d => d.status === 'won');
    const lostDeals   = deals.filter(d => d.status === 'lost');
    const closedDeals = deals.filter(d => ['won','paid','in_progress','completed','lost'].includes(d.status));

    const totalRevenue = paidDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const totalCost    = paidDeals.reduce((a,d) => a+(d.cost_snapshot||0), 0);
    const totalComm    = comms.filter(c=>c.status!=='cancelled').reduce((a,c) => a+(c.amount||0), 0);
    const totalMargin  = totalRevenue - totalCost;
    const totalNet     = totalRevenue - totalCost - totalComm;

    // Zisk po benefitoch — zľava sa prejaví v nižšej cene (sale_price_snapshot už obsahuje zľavu)
    // Vypočítaj koľko zliav bolo uplatnených (z notes)
    const discountDeals = paidDeals.filter(d => d.notes?.includes('zľava'));
    const totalDiscountSaved = discountDeals.reduce((a,d) => {
      const match = d.notes?.match(/pôvodná cena: ([\d.]+)/);
      const orig  = match ? parseFloat(match[1]) : 0;
      return a + Math.max(0, orig - (d.sale_price_snapshot||0));
    }, 0);

    const convRate     = closedDeals.length ? Math.round((closedDeals.length - lostDeals.length) / closedDeals.length * 100) : 0;

    // Pipeline konverzie — % čo prešlo z jedného stavu do ďalšieho
    const STAGES = ['new','contacted','qualified','offer_sent','won','paid','completed'];
    const STAGE_LABELS = { new:'Nový', contacted:'Kontakt', qualified:'Kvalif.', offer_sent:'Ponuka', won:'Vyhraný', paid:'Zaplatený', completed:'Dokončený' };
    const stageConv = STAGES.map((s, i) => {
      const cnt = deals.filter(d => {
        const idx = STAGES.indexOf(d.status);
        return idx >= i || ['paid','in_progress','completed'].includes(d.status) && i <= 5;
      }).length;
      return { status: s, label: STAGE_LABELS[s], count: cnt };
    });

    // Časové metriky (dni medzi stavmi)
    const avgTime = (fromField, toField) => {
      const times = deals
        .filter(d => d[fromField] && d[toField])
        .map(d => (new Date(d[toField]) - new Date(d[fromField])) / 86400000);
      if (!times.length) return null;
      return Math.round(times.reduce((a,b)=>a+b,0) / times.length * 10) / 10;
    };
    const timeMetrics = [
      { label: 'Nový → Kontakt',      days: avgTime('created_at',      'first_contact_at') },
      { label: 'Kvalif. → Ponuka',    days: avgTime('qualified_at',    'offer_sent_at') },
      { label: 'Vyhraný → Zaplatený', days: avgTime('won_at',          'paid_at') },
      { label: 'Zaplatený → Dokonč.', days: avgTime('paid_at',         'completed_at') },
    ].filter(m => m.days !== null);

    // Loss reasons
    const lossReasons = {};
    lostDeals.forEach(d => {
      const r = d.loss_reason?.split(' — ')[0] || 'Iné';
      lossReasons[r] = (lossReasons[r]||0) + 1;
    });

    // Cancel reasons
    const cancelDeals = deals.filter(d => d.status === 'cancelled');
    const cancelReasons = {};
    cancelDeals.forEach(d => {
      const r = d.cancel_reason?.split(' — ')[0] || 'Iné';
      cancelReasons[r] = (cancelReasons[r]||0) + 1;
    });

    // Top produkty podľa počtu a obratu
    const prodStats = {};
    paidDeals.forEach(d => {
      const name = d.product_name_snapshot || '—';
      if (!prodStats[name]) prodStats[name] = { count:0, revenue:0, net:0 };
      prodStats[name].count++;
      prodStats[name].revenue += d.sale_price_snapshot || 0;
      prodStats[name].net     += (d.sale_price_snapshot||0) - (d.cost_snapshot||0) - (d.commission_amount_snapshot||0);
    });
    const topProds = Object.entries(prodStats).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,8);

    // Top obchodníci
    const ownerStats = {};
    deals.forEach(d => {
      const name = d.profiles?.name || 'Neznámy';
      if (!ownerStats[name]) ownerStats[name] = { deals:0, paid:0, revenue:0, comm:0 };
      ownerStats[name].deals++;
      if (['paid','in_progress','completed'].includes(d.status)) {
        ownerStats[name].paid++;
        ownerStats[name].revenue += d.sale_price_snapshot || 0;
      }
    });
    comms.filter(c=>c.status!=='cancelled').forEach(c => {
      const name = c.profiles?.name || 'Neznámy';
      if (!ownerStats[name]) ownerStats[name] = { deals:0, paid:0, revenue:0, comm:0 };
      ownerStats[name].comm += c.amount || 0;
    });
    const topOwners = Object.entries(ownerStats).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5);

    // Mesačné dáta
    const now = new Date();
    const months = [];
    for (let i=5;i>=0;i--) {
      const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const mDeals = paidDeals.filter(x=>(x.paid_at||x.created_at||'').startsWith(key));
      months.push({
        label:   d.toLocaleDateString('sk-SK',{month:'short'}),
        revenue: mDeals.reduce((a,x)=>a+(x.sale_price_snapshot||0),0),
        net:     mDeals.reduce((a,x)=>a+(x.sale_price_snapshot||0)-(x.cost_snapshot||0)-(x.commission_amount_snapshot||0),0),
        count:   mDeals.length,
      });
    }

    el.innerHTML = `
      <!-- Hlavné KPI -->
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Tržby</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${fmt(totalRevenue)}</div>
          <div style="font-size:11px;color:var(--muted);">${paidDeals.length} dealov</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Hrubá marža</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--blue);">${fmt(totalMargin)}</div>
          <div style="font-size:11px;color:var(--muted);">${totalRevenue>0?Math.round(totalMargin/totalRevenue*100):0}%</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Provízie</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${fmt(totalComm)}</div>
        </div>
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#0a1f12,var(--card));border-color:rgba(62,207,142,0.3);">
          <div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Čistý zisk</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--green);">${fmt(totalNet)}</div>
          <div style="font-size:11px;color:var(--muted);">${totalRevenue>0?Math.round(totalNet/totalRevenue*100):0}%</div>
        </div>
        <div class="card" style="text-align:center;${totalDiscountSaved>0?'border-color:rgba(167,139,250,0.3);':''}">
          <div style="font-size:10px;color:var(--purple);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Benefit zľavy</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--purple);">${fmt(totalDiscountSaved)}</div>
          <div style="font-size:11px;color:var(--muted);">${discountDeals.length} dealov</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Win rate</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:${convRate>=50?'var(--green)':'var(--acc)'};">${convRate}%</div>
          <div style="font-size:11px;color:var(--muted);">${closedDeals.length-lostDeals.length}/${closedDeals.length}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Mesačný trend -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Mesačný trend
          </div>
          ${months.length === 0 ? '<div style="color:var(--muted);font-size:13px;">Žiadne dáta</div>' :
            (() => {
              const max = Math.max(...months.map(m=>m.revenue), 1);
              return months.map(m => `
                <div style="margin-bottom:10px;">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                    <span style="color:var(--muted);">${m.label}</span>
                    <span class="mono" style="font-weight:600;">${fmt(m.revenue)}</span>
                  </div>
                  <div style="background:var(--inp);border-radius:4px;height:6px;overflow:hidden;">
                    <div style="background:var(--acc);height:100%;width:${Math.round(m.revenue/max*100)}%;border-radius:4px;"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:2px;">
                    <span>${m.count} dealov</span>
                    <span style="color:var(--green);">Zisk: ${fmt(m.net)}</span>
                  </div>
                </div>`).join('');
            })()}
        </div>

        <!-- Top obchodníci -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Výkon obchodníkov
          </div>
          ${topOwners.length === 0 ? '<div style="color:var(--muted);font-size:13px;">Žiadne dáta</div>' :
            topOwners.map(([name, s], i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;color:var(--muted);min-width:18px;">#${i+1}</span>
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(name)}</div>
                    <div style="font-size:11px;color:var(--muted);">${s.deals} dealov · ${s.paid} zaplatených</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="mono" style="font-size:14px;font-weight:700;color:var(--acc);">${fmt(s.revenue)}</div>
                  <div style="font-size:11px;color:var(--muted);">Prov: ${fmt(s.comm)}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <!-- Konverzie pipeline -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Pipeline konverzie
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:8px;">
          ${stageConv.map((s, i) => {
            const max   = stageConv[0]?.count || 1;
            const pct   = Math.round(s.count / max * 100);
            const conv  = i > 0 && stageConv[i-1].count > 0
              ? Math.round(s.count / stageConv[i-1].count * 100) : null;
            const colors = ['#66668a','#a78bfa','#f0b85a','#d4943a','#3ecf8e','#10b981','#6366f1'];
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                ${conv !== null ? `<div style="font-size:9px;color:var(--muted);">${conv}%</div>` : '<div style="font-size:9px;"></div>'}
                <div style="width:100%;background:${colors[i]};border-radius:4px 4px 0 0;height:${Math.max(8,pct*0.7)}px;"></div>
                <div style="font-size:9px;color:var(--muted);text-align:center;">${s.label}</div>
                <div style="font-size:10px;font-weight:700;">${s.count}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Časové metriky -->
      ${timeMetrics.length > 0 ? `
        <div class="card" style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Priemerné časy (dni)
          </div>
          <div style="display:grid;grid-template-columns:repeat(${timeMetrics.length},1fr);gap:10px;">
            ${timeMetrics.map(m => `
              <div style="text-align:center;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px;">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${m.label}</div>
                <div class="mono" style="font-size:20px;font-weight:700;color:var(--acc);">${m.days}</div>
                <div style="font-size:11px;color:var(--muted);">dní</div>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Top produkty -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Top produkty — tržby vs čistý zisk
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--brd);">
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">#</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Ks</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Tržby</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--green);font-weight:600;">Zisk</th>
            </tr>
          </thead>
          <tbody>
            ${topProds.length === 0
              ? '<tr><td colspan="5" style="padding:12px 8px;color:var(--muted);">Žiadne dáta</td></tr>'
              : topProds.map(([name, s], i) => `
                  <tr style="border-bottom:1px solid var(--brd);">
                    <td style="padding:7px 8px;font-size:12px;color:var(--muted);">${i+1}</td>
                    <td style="padding:7px 8px;font-size:13px;font-weight:600;">${esc(name)}</td>
                    <td style="padding:7px 8px;text-align:right;" class="mono">${s.count}×</td>
                    <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--acc);" class="mono">${fmt(s.revenue)}</td>
                    <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--green);" class="mono">${fmt(s.net)}</td>
                  </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Loss reasons -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Dôvody straty dealov (${lostDeals.length})
          </div>
          ${Object.keys(lossReasons).length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne stratené dealy</div>'
            : Object.entries(lossReasons).sort((a,b)=>b[1]-a[1]).map(([reason, count]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--brd);">
                  <span style="font-size:13px;">${esc(reason)}</span>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="background:var(--inp);border-radius:4px;height:5px;width:60px;overflow:hidden;">
                      <div style="background:var(--red);height:100%;width:${lostDeals.length>0?Math.round(count/lostDeals.length*100):0}%;"></div>
                    </div>
                    <span class="mono" style="font-size:13px;font-weight:700;color:var(--red);min-width:20px;">${count}</span>
                  </div>
                </div>`).join('')}
        </div>

        <!-- Cancel reasons -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Dôvody zrušenia dealov (${cancelDeals.length})
          </div>
          ${Object.keys(cancelReasons).length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne zrušené dealy</div>'
            : Object.entries(cancelReasons).sort((a,b)=>b[1]-a[1]).map(([reason, count]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--brd);">
                  <span style="font-size:13px;">${esc(reason)}</span>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="background:var(--inp);border-radius:4px;height:5px;width:60px;overflow:hidden;">
                      <div style="background:var(--muted);height:100%;width:${cancelDeals.length>0?Math.round(count/cancelDeals.length*100):0}%;"></div>
                    </div>
                    <span class="mono" style="font-size:13px;font-weight:700;color:var(--muted);min-width:20px;">${count}</span>
                  </div>
                </div>`).join('')}
        </div>
      </div>

      <!-- Rast členov -->
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          Rast členov
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Celkom</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--purple);">${members.length}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Tento mesiac</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);">
              ${members.filter(m => { const d=new Date(m.created_at),n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Tento týždeň</div>
            <div class="mono" style="font-size:22px;font-weight:700;">
              ${members.filter(m=>(new Date()-new Date(m.created_at))<7*24*60*60*1000).length}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Cez referral</div>
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">
              ${members.filter(m=>m.referred_by).length}
            </div>
          </div>
        </div>
      </div>`;
  },

  exportXLSX() {
    if (!this._data) { alert('Najprv načítaj dáta.'); return; }
    const { deals, comms } = this._data;

    const toRows = (headers, data) => [headers, ...data];

    const dealsData = toRows(
      ['Názov','Stav','Produkt','Tržby €','Náklad €','Zisk €','Komisie €','Zdroj','Dátum'],
      deals.map(d => [
        d.title || '—', d.status,
        d.product_name_snapshot || '—',
        d.sale_price_snapshot || 0,
        d.cost_snapshot || 0,
        (d.sale_price_snapshot||0)-(d.cost_snapshot||0)-(d.commission_amount_snapshot||0),
        d.commission_amount_snapshot || 0,
        d.source || '—',
        d.created_at?.slice(0,10) || '—',
      ])
    );

    const commsData = toRows(
      ['Obchodník','Suma €','%','Stav','Dátum','Vyplatené'],
      comms.map(c => [
        c.profiles?.name || '—', c.amount||0, c.rate||'',
        c.status, c.date?.slice(0,10)||c.created_at?.slice(0,10)||'—',
        c.paid_at?.slice(0,10)||'—',
      ])
    );

    const load = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dealsData),  'Dealy');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(commsData),  'Provízie');
      XLSX.writeFile(wb, `axiona-report-${new Date().toISOString().slice(0,10)}.xlsx`);
    };
    if (typeof XLSX !== 'undefined') { load(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = load;
    document.head.appendChild(s);
  },
};
