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
      db.client.from('deals')
        .select('*, contacts(membership_levels(name,slug,color,icon))')
        .order('created_at'),
      db.client.from('commissions').select('*, profiles(name,email)').order('created_at'),
      db.client.from('products').select('*').eq('is_active', true),
      db.client.from('profiles').select('*, membership_levels(name,slug,color,icon)').eq('role', 'clen'),
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

    // Benefit zľavy — zo štruktúrovaných polí
    const discountDeals      = paidDeals.filter(d => (d.discount_amount||0) > 0);
    const totalDiscounts     = discountDeals.reduce((a,d) => a+(d.discount_amount||0), 0);
    const profitAfterBenefits = totalNet - totalDiscounts;

    // Benefit ekonomika po produktoch
    const prodBenefit = {};
    paidDeals.forEach(d => {
      const name = d.product_name_snapshot || '—';
      if (!prodBenefit[name]) prodBenefit[name] = { revenue:0, cost:0, comm:0, discount:0, count:0, discountCount:0 };
      prodBenefit[name].revenue  += d.sale_price_snapshot || 0;
      prodBenefit[name].cost     += d.cost_snapshot || 0;
      prodBenefit[name].comm     += d.commission_amount_snapshot || 0;
      prodBenefit[name].discount += d.discount_amount || 0;
      prodBenefit[name].count++;
      if (d.discount_amount > 0) prodBenefit[name].discountCount++;
    });
    Object.values(prodBenefit).forEach(p => {
      p.grossMargin = p.revenue - p.cost;
      p.netProfit   = p.revenue - p.cost - p.comm;
      p.profitAfter = p.netProfit - p.discount;
      p.marginPct   = p.revenue > 0 ? Math.round(p.profitAfter / p.revenue * 100) : 0;
    });
    const topProdBenefit = Object.entries(prodBenefit).sort((a,b) => b[1].revenue - a[1].revenue).slice(0,8);

    // Benefit ekonomika po úrovniach
    const LEVELS = ['bronze','silver','gold','platinum'];
    const levelColors = { bronze:'#cd7f32', silver:'#a8a9ad', gold:'#d4af37', platinum:'#e5e4e2' };
    const levelBenefit = {};
    paidDeals.forEach(d => {
      // Skús získať level z discount_source alebo z kontaktu
      let slug = 'nezname';
      if (d.discount_source) {
        const match = d.discount_source.match(/\(([^)]+)\)/);
        if (match) slug = match[1].toLowerCase();
      }
      if (!levelBenefit[slug]) levelBenefit[slug] = { name: d.discount_source?.split(' (')[0] || slug, revenue:0, cost:0, comm:0, discount:0, count:0 };
      levelBenefit[slug].revenue  += d.sale_price_snapshot || 0;
      levelBenefit[slug].cost     += d.cost_snapshot || 0;
      levelBenefit[slug].comm     += d.commission_amount_snapshot || 0;
      levelBenefit[slug].discount += d.discount_amount || 0;
      levelBenefit[slug].count++;
    });
    Object.values(levelBenefit).forEach(l => {
      l.profitAfter = l.revenue - l.cost - l.comm - l.discount;
      l.marginPct   = l.revenue > 0 ? Math.round(l.profitAfter / l.revenue * 100) : 0;
    });

    // Benefit statistiky po úrovniach zo štruktúrovaných polí
    const memberLevels = { bronze:0, silver:0, gold:0, platinum:0, none:0 };
    members.forEach(m => {
      const slug = m.membership_levels?.slug || 'none';
      if (memberLevels[slug] !== undefined) memberLevels[slug]++;
      else memberLevels['none']++;
    });

    // Override reporting
    const overrideDeals    = paidDeals.filter(d => d.margin_override);
    const overrideRevenue  = overrideDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
    const overrideNet      = overrideDeals.reduce((a,d) => a+(d.net_profit_snapshot||0), 0);
    const overrideByUser   = {};
    overrideDeals.forEach(d => {
      const name = d.profiles?.name || 'Admin';
      if (!overrideByUser[name]) overrideByUser[name] = { count:0, revenue:0 };
      overrideByUser[name].count++;
      overrideByUser[name].revenue += d.sale_price_snapshot || 0;
    });

    // Časové benefit metriky — zľavy za posledných 6 mesiacov
    const now6 = new Date();
    const benefitMonths = [];
    for (let i=5;i>=0;i--) {
      const d   = new Date(now6.getFullYear(), now6.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const mDeals = deals.filter(x=>(x.paid_at||x.created_at||'').startsWith(key) && ['paid','in_progress','completed'].includes(x.status));
      benefitMonths.push({
        label:    d.toLocaleDateString('sk-SK',{month:'short'}),
        discount: mDeals.reduce((a,x)=>a+(x.discount_amount||0),0),
        net:      mDeals.reduce((a,x)=>a+(x.net_profit_snapshot||0),0),
        count:    mDeals.filter(x=>x.discount_amount>0).length,
      });
    }

    const convRate = closedDeals.length ? Math.round((closedDeals.length - lostDeals.length) / closedDeals.length * 100) : 0;

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
        <div class="card" style="text-align:center;${totalDiscounts>0?'border-color:rgba(167,139,250,0.3);':''}">
          <div style="font-size:10px;color:var(--purple);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Benefit zľavy</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:var(--purple);">-${fmt(totalDiscounts)}</div>
          <div style="font-size:11px;color:var(--muted);">${discountDeals.length} dealov</div>
        </div>
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#0a1a1f,var(--card));border-color:rgba(91,164,245,0.3);">
          <div style="font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Profit po zľavách</div>
          <div class="mono" style="font-size:16px;font-weight:700;color:${profitAfterBenefits>=0?'var(--blue)':'var(--red)'};">${fmt(profitAfterBenefits)}</div>
          <div style="font-size:11px;color:var(--muted);">${totalRevenue>0?Math.round(profitAfterBenefits/totalRevenue*100):0}%</div>
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

      <!-- Benefit ekonomika po produktoch -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
          🎁 Benefit ekonomika — po produktoch
        </div>
        ${topProdBenefit.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne dáta</div>'
          : `<table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--brd);">
                  <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Produkt</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Ks</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Tržby</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Čistý zisk</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--purple);font-weight:600;">Zľavy</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--blue);font-weight:600;">Po zľavách</th>
                  <th style="text-align:right;padding:6px 8px;font-size:11px;color:var(--muted);font-weight:600;">Marža</th>
                </tr>
              </thead>
              <tbody>
                ${topProdBenefit.map(([name, s]) => {
                  const marginColor = s.marginPct >= 30 ? 'var(--green)' : s.marginPct >= 15 ? 'var(--acc)' : 'var(--red)';
                  return `
                    <tr style="border-bottom:1px solid var(--brd);">
                      <td style="padding:7px 8px;font-size:13px;font-weight:600;">${esc(name)}</td>
                      <td style="padding:7px 8px;text-align:right;font-size:12px;" class="mono">${s.count}×</td>
                      <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--acc);" class="mono">${fmt(s.revenue)}</td>
                      <td style="padding:7px 8px;text-align:right;color:var(--green);" class="mono">${fmt(s.netProfit)}</td>
                      <td style="padding:7px 8px;text-align:right;color:var(--purple);" class="mono">${s.discount > 0 ? '-' + fmt(s.discount) : '—'}</td>
                      <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--blue);" class="mono">${fmt(s.profitAfter)}</td>
                      <td style="padding:7px 8px;text-align:right;">
                        <span style="font-weight:700;color:${marginColor};">${s.marginPct}%</span>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>`}
      </div>

      <!-- Benefit ekonomika po úrovniach -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Distribúcia členov -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Distribúcia členov po úrovniach
          </div>
          ${Object.entries(memberLevels).filter(([,v])=>v>0).map(([slug, count]) => {
            const colors = { bronze:'#cd7f32', silver:'#a8a9ad', gold:'#d4af37', platinum:'#e5e4e2', none:'var(--muted)' };
            const labels = { bronze:'🥉 Bronze', silver:'🥈 Silver', gold:'🥇 Gold', platinum:'💎 Platinum', none:'Bez úrovne' };
            const pct    = members.length > 0 ? Math.round(count/members.length*100) : 0;
            const color  = colors[slug] || 'var(--muted)';
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);">
                <div style="width:70px;font-size:12px;font-weight:600;color:${color};">${labels[slug]||slug}</div>
                <div style="flex:1;background:var(--inp);border-radius:4px;height:6px;overflow:hidden;">
                  <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;"></div>
                </div>
                <div style="text-align:right;min-width:50px;">
                  <span class="mono" style="font-weight:700;">${count}</span>
                  <span style="font-size:11px;color:var(--muted);"> (${pct}%)</span>
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Profit po úrovniach -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Profit po zľavách — po úrovniach klientov
          </div>
          ${Object.keys(levelBenefit).length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne dealy so zľavou</div>'
            : Object.entries(levelBenefit).filter(([k])=>k!=='nezname').sort((a,b)=>b[1].revenue-a[1].revenue).map(([slug, l]) => {
                const colors = { bronze:'#cd7f32', silver:'#a8a9ad', gold:'#d4af37', platinum:'#e5e4e2' };
                const color  = colors[slug] || 'var(--muted)';
                const marginColor = l.marginPct >= 30 ? 'var(--green)' : l.marginPct >= 15 ? 'var(--acc)' : 'var(--red)';
                return `
                  <div style="padding:8px 0;border-bottom:1px solid var(--brd);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                      <span style="font-size:13px;font-weight:700;color:${color};">${esc(l.name||slug)}</span>
                      <span style="font-size:11px;color:var(--muted);">${l.count} dealov</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                      <span style="color:var(--muted);">Tržby: <strong style="color:var(--acc);">${fmt(l.revenue)}</strong></span>
                      <span style="color:var(--purple);">Zľavy: -${fmt(l.discount)}</span>
                      <span style="color:${marginColor};font-weight:700;">${l.marginPct}%</span>
                    </div>
                  </div>`;
              }).join('')}
        </div>
      </div>

      <!-- Override dealy + benefit trend -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Override dealy -->
        <div class="card" style="${overrideDeals.length>0?'border-color:rgba(242,85,85,0.3);':''}">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            ⚠ Override dealy (nízka marža)
          </div>
          ${overrideDeals.length === 0
            ? '<div style="color:var(--green);font-size:13px;">✓ Žiadne override dealy</div>'
            : `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
                <div style="text-align:center;background:rgba(242,85,85,0.1);border:1px solid rgba(242,85,85,0.3);border-radius:8px;padding:8px;">
                  <div style="font-size:10px;color:var(--red);margin-bottom:2px;">Počet</div>
                  <div class="mono" style="font-size:18px;font-weight:700;color:var(--red);">${overrideDeals.length}</div>
                </div>
                <div style="text-align:center;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;">
                  <div style="font-size:10px;color:var(--muted);margin-bottom:2px;">Obrat</div>
                  <div class="mono" style="font-size:14px;font-weight:700;">${fmt(overrideRevenue)}</div>
                </div>
                <div style="text-align:center;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;">
                  <div style="font-size:10px;color:var(--muted);margin-bottom:2px;">Zisk</div>
                  <div class="mono" style="font-size:14px;font-weight:700;color:${overrideNet>=0?'var(--green)':'var(--red)'};">${fmt(overrideNet)}</div>
                </div>
              </div>
              ${Object.entries(overrideByUser).sort((a,b)=>b[1].count-a[1].count).map(([name,s]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--brd);font-size:12px;">
                  <span>${esc(name)}</span>
                  <div style="display:flex;gap:10px;">
                    <span class="mono" style="color:var(--red);font-weight:700;">${s.count}×</span>
                    <span class="mono">${fmt(s.revenue)}</span>
                  </div>
                </div>`).join('')}`}
        </div>

        <!-- Benefit trend za 6 mesiacov -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            📅 Trend zliav — posledných 6 mesiacov
          </div>
          ${benefitMonths.every(m=>m.discount===0)
            ? '<div style="color:var(--muted);font-size:13px;">Žiadne benefit zľavy</div>'
            : (() => {
                const max = Math.max(...benefitMonths.map(m=>m.discount), 1);
                return benefitMonths.map(m => `
                  <div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                      <span style="color:var(--muted);">${m.label}</span>
                      <div style="display:flex;gap:10px;">
                        ${m.count>0?`<span style="color:var(--purple);">-${fmt(m.discount)}</span>`:'<span style="color:var(--muted);">—</span>'}
                        <span style="color:var(--green);">${fmt(m.net)}</span>
                      </div>
                    </div>
                    <div style="background:var(--inp);border-radius:4px;height:5px;overflow:hidden;">
                      <div style="background:var(--purple);height:100%;width:${Math.round(m.discount/max*100)}%;border-radius:4px;"></div>
                    </div>
                  </div>`).join('');
              })()}
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
