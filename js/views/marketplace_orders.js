// ── views/marketplace_orders.js — Moje dopyty (pre člena) ───────────────────

const marketplaceOrdersView = {
  _deals: [],

  render() {
    return `
      <div class="view-head">
        <h2>📋 Moje dopyty</h2>
        <button class="btn-ghost" style="font-size:12px;" onclick="app.setView('marketplace')">← Marketplace</button>
      </div>
      <div id="orders-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    const uid = app._currentUserId();
    const { data, error } = await db.client.from('deals')
      .select('*, products(name,category,marketplace_title)')
      .eq('created_by', uid)
      .eq('source', 'marketplace')
      .order('created_at', { ascending: false });

    this._deals = data || [];
    this._render();
  },

  _render() {
    const el = document.getElementById('orders-wrap');
    if (!el) return;

    if (this._deals.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:40px;margin-bottom:12px;">🛍</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Zatiaľ žiadne dopyty</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">Prehliadaj marketplace a vytvor svoj prvý dopyt.</div>
          <button class="btn-primary" onclick="app.setView('marketplace')">Otvoriť Marketplace</button>
        </div>`;
      return;
    }

    const statusInfo = {
      new:             { label: 'Čaká na schválenie', color: '#66668a', icon: '⏳' },
      assigned:        { label: 'Priradené',           color: '#5ba4f5', icon: '👤' },
      contacted:       { label: 'Kontaktovaný',        color: '#a78bfa', icon: '📞' },
      offer_sent:      { label: 'Ponuka odoslaná',     color: '#d4943a', icon: '📄' },
      won:             { label: 'Schválené',            color: '#3ecf8e', icon: '✅' },
      payment_pending: { label: 'Čaká platba',         color: '#f59e0b', icon: '💳' },
      paid:            { label: 'Zaplatené',            color: '#10b981', icon: '✓'  },
      in_progress:     { label: 'V realizácii',        color: '#6366f1', icon: '⚙️' },
      completed:       { label: 'Dokončené',            color: '#22c55e', icon: '🏆' },
      lost:            { label: 'Zamietnuté',           color: '#f25555', icon: '✕'  },
      cancelled:       { label: 'Zrušené',              color: '#666',    icon: '✕'  },
    };

    el.innerHTML = `
      <div style="display:grid;gap:10px;">
        ${this._deals.map(d => {
          const st = statusInfo[d.status] || { label: d.status, color: 'var(--muted)', icon: '?' };
          const price = d.discount_amount > 0 ? d.final_price : d.sale_price_snapshot;
          return `
            <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${esc(d.title||'—')}</div>
                <div style="font-size:12px;color:var(--muted);">
                  ${esc(d.products?.marketplace_title||d.products?.name||'—')}
                  · ${FMT(d.created_at)}
                </div>
                ${d.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic;">"${esc(d.notes.slice(0,80))}${d.notes.length>80?'...':''}"</div>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                ${price > 0 ? `
                  <div style="text-align:right;">
                    <div class="mono" style="font-size:14px;font-weight:700;color:var(--acc);">${EUR(price)}</div>
                    ${d.discount_amount > 0 ? `<div style="font-size:10px;color:var(--green);">-${EUR(d.discount_amount)} zľava</div>` : ''}
                  </div>` : ''}
                <div style="text-align:center;">
                  <div style="font-size:18px;">${st.icon}</div>
                  <div style="font-size:10px;color:${st.color};font-weight:600;white-space:nowrap;">${st.label}</div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },
};
