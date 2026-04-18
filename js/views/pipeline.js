// ── views/pipeline.js — Kanban Deal Pipeline ─────────────────────────────────

const DEAL_COLS = [
  { key: 'new',             label: 'Nový',           color: '#66668a', group: 'lead'    },
  { key: 'assigned',        label: 'Priradený',      color: '#5ba4f5', group: 'lead'    },
  { key: 'contacted',       label: 'Kontaktovaný',   color: '#a78bfa', group: 'lead'    },
  { key: 'offer_sent',      label: 'Ponuka',         color: '#d4943a', group: 'deal'    },
  { key: 'won',             label: 'Vyhraný',        color: '#3ecf8e', group: 'deal'    },
  { key: 'payment_pending', label: 'Čaká platba',    color: '#f59e0b', group: 'payment' },
  { key: 'paid',            label: 'Zaplatený',      color: '#10b981', group: 'payment' },
  { key: 'in_progress',     label: 'V realizácii',   color: '#6366f1', group: 'done'    },
  { key: 'completed',       label: 'Dokončený',      color: '#22c55e', group: 'done'    },
  { key: 'commission',      label: 'Komisia',        color: '#f0b85a', group: 'done'    },
];

const GROUP_COLORS = {
  lead:    '#5ba4f5',
  qualify: '#f0b85a',
  deal:    '#3ecf8e',
  payment: '#f59e0b',
  done:    '#6366f1',
};

const pipelineView = {
  _deals:    [],
  _filter:   'active', // 'active' | 'lost' | 'cancelled' | 'all'
  _dragging: null,

  render() {
    return `
      <div class="view-head">
        <h2>📊 Pipeline</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="pl-filter" onchange="pipelineView._setFilter(this.value)"
            style="font-size:12px;padding:4px 8px;background:var(--inp);border:1px solid var(--brd);border-radius:6px;color:var(--txt);">
            <option value="active">Aktívne</option>
            <option value="all">Všetky</option>
            <option value="lost">Stratené</option>
            <option value="cancelled">Zrušené</option>
          </select>
          <button class="btn-primary" onclick="pipelineView._openAdd()">+ Nový deal</button>
        </div>
      </div>
      <div id="pipeline-board" style="overflow-x:auto;padding-bottom:16px;">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderBoard();
  },

  async _load() {
    const uid     = app._currentUserId();
    const role    = previewRole.effective() || auth.profile?.role;
    const isAdmin = role === 'admin';

    let q = db.client.from('deals')
      .select('id,title,status,contact_id,product_id,owner_id,assigned_to,created_by,source,notes,description,requires_approval,reviewed_at,sla_breached,sla_due_at,loss_reason,cancel_reason,payment_method,payment_reference,sale_price_snapshot,cost_snapshot,commission_percent_snapshot,commission_amount_snapshot,net_profit_snapshot,product_name_snapshot,base_price,discount_percent,discount_amount,final_price,discount_source,discount_applied_by,discount_applied_at,margin_override,margin_override_reason,paid_at,won_at,in_progress_at,completed_at,lost_at,cancelled_at,created_at,contacts(name,email,phone),products(name,category,base_price,commission_percent,commission_enabled,benefit_eligible,max_discount_pct)')
      .order('created_at', { ascending: false });

    if (!isAdmin) q = q.or(`owner_id.eq.${uid},assigned_to.eq.${uid},created_by.eq.${uid}`);

    const { data, error } = await q;
    if (error) console.error('Pipeline load error:', error);
    this._deals = data || [];
  },

  _setFilter(val) {
    this._filter = val;
    this._renderBoard();
  },

  _filtered() {
    if (this._filter === 'active')    return this._deals.filter(d => !['lost','cancelled'].includes(d.status));
    if (this._filter === 'lost')      return this._deals.filter(d => d.status === 'lost');
    if (this._filter === 'cancelled') return this._deals.filter(d => d.status === 'cancelled');
    return this._deals;
  },

  _renderBoard() {
    const board = document.getElementById('pipeline-board');
    if (!board) return;

    const deals = this._filtered();

    if (this._filter !== 'active') {
      // Jednoduchý zoznam pre archív
      board.innerHTML = `
        <div style="max-width:700px;">
          ${deals.length === 0
            ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadne záznamy</div>`
            : deals.map(d => this._listCard(d)).join('')}
        </div>`;
      return;
    }

    // Kanban board
    const cols = DEAL_COLS.map(col => {
      const colDeals = deals.filter(d => d.status === col.key);
      const colVal   = colDeals.reduce((a,d) => a+(d.sale_price_snapshot||0), 0);
      return `
        <div class="kanban-col" data-status="${col.key}"
          style="min-width:155px;max-width:165px;flex-shrink:0;"
          ondragover="event.preventDefault();pipelineView._onDragOver(this)"
          ondragleave="pipelineView._onDragLeave(this)"
          ondrop="pipelineView._onDrop(event,'${col.key}')">

          <!-- Hlavička stĺpca -->
          <div style="padding:6px 8px 5px;margin-bottom:6px;border-radius:7px;background:${col.color}18;border:1px solid ${col.color}33;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;font-weight:700;color:${col.color};text-transform:uppercase;letter-spacing:0.04em;">${col.label}</span>
              <span style="font-size:10px;background:${col.color}33;color:${col.color};padding:1px 5px;border-radius:10px;font-weight:600;">${colDeals.length}</span>
            </div>
            ${colVal > 0 ? `<div style="font-size:10px;color:${col.color};margin-top:1px;opacity:0.8;">${EUR(colVal)}</div>` : ''}
          </div>

          <!-- Karty -->
          <div class="kanban-cards" data-status="${col.key}" style="min-height:60px;">
            ${colDeals.map(d => this._card(d, col.color)).join('')}
          </div>
        </div>`;
    }).join('');

    board.innerHTML = `
      <style>
        .kanban-board { display:flex;gap:6px;align-items:flex-start;padding:4px 2px; }
        .kanban-col.drag-over .kanban-cards { background:rgba(255,255,255,0.04);border-radius:8px; }
        .deal-card { cursor:grab; transition:transform 0.1s,box-shadow 0.1s; }
        .deal-card:active { cursor:grabbing; }
        .deal-card.dragging { opacity:0.4; transform:scale(0.97); }
      </style>
      <div class="kanban-board">${cols}</div>`;
  },

  _card(d, colColor) {
    const hasKey   = !!localStorage.getItem('axiona_ai_key');
    const contact  = d.contacts;
    const product  = d.products;
    const price    = (d.discount_amount > 0 ? d.final_price : d.sale_price_snapshot) || product?.base_price || 0;
    const slaWarn  = d.sla_breached || (d.sla_due_at && new Date(d.sla_due_at) < new Date());
    const role     = previewRole.effective() || auth.profile?.role;
    const canMove  = role === 'admin' || d.owner_id === app._currentUserId() || d.assigned_to === app._currentUserId();

    return `
      <div class="card deal-card" style="margin-bottom:5px;padding:8px 9px;font-size:11px;"
        draggable="${canMove}"
        data-id="${d.id}"
        ondragstart="pipelineView._onDragStart(event,'${d.id}')"
        ondragend="pipelineView._onDragEnd(event)"
        onclick="pipelineView._openDetail('${d.id}')">

        ${slaWarn ? `<div style="font-size:9px;color:var(--red);margin-bottom:3px;">⚠ SLA</div>` : ''}
        ${d.requires_approval && !d.reviewed_at ? `<div style="font-size:9px;color:var(--acc);margin-bottom:3px;">⏳ Čaká</div>` : ''}
        ${d.margin_override ? `<div style="font-size:9px;color:var(--red);margin-bottom:3px;">⚠ Override</div>` : ''}

        <div style="font-weight:700;margin-bottom:4px;line-height:1.3;color:var(--txt);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.title||'—')}</div>

        ${contact ? `<div style="color:var(--muted);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ${esc(contact.name)}</div>` : ''}
        ${product ? `<div style="color:var(--muted);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🛍 ${esc(product.name)}</div>` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
          <span class="mono" style="font-weight:700;color:${colColor};font-size:11px;">${EUR(price)}</span>
          <div style="display:flex;align-items:center;gap:4px;">
            ${(() => {
              const cost  = d.cost_snapshot || 0;
              const comm  = d.commission_amount_snapshot || 0;
              const mPct  = price > 0 ? Math.round((price-cost-comm)/price*100) : null;
              if (mPct === null) return '';
              const mc = mPct >= 25 ? 'var(--green)' : mPct >= 15 ? 'var(--acc)' : 'var(--red)';
              return `<span style="font-size:9px;color:${mc};font-weight:700;">${mPct}%</span>`;
            })()}
            ${d.discount_amount > 0 ? `<span style="font-size:9px;color:var(--purple);" title="Benefit zľava">🎁</span>` : ''}
            ${hasKey ? `<button class="icon-btn" style="font-size:10px;padding:1px 4px;" title="AI" onclick="event.stopPropagation();pipelineView._openAI('${d.id}')">✦</button>` : ''}
          </div>
        </div>
      </div>`;
  },

  _listCard(d) {
    const sc = DEAL_COLS.find(c => c.key === d.status);
    return `
      <div class="card" style="margin-bottom:8px;cursor:pointer;" onclick="pipelineView._openDetail('${d.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600;margin-bottom:4px;">${esc(d.title||'—')}</div>
            <div style="font-size:12px;color:var(--muted);">
              ${d.contacts?.name ? `👤 ${esc(d.contacts.name)} · ` : ''}
              ${d.products?.name ? `🛍 ${esc(d.products.name)} · ` : ''}
              ${FMT(d.created_at)}
            </div>
          </div>
          <div style="text-align:right;">
            ${sc ? `<span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;">${sc.label}</span>` : ''}
            <div class="mono" style="font-size:13px;font-weight:700;color:var(--acc);margin-top:4px;">${EUR(d.sale_price_snapshot||0)}</div>
          </div>
        </div>
      </div>`;
  },

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  _onDragStart(e, id) {
    this._dragging = id;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  },

  _onDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-col.drag-over').forEach(el => el.classList.remove('drag-over'));
    this._dragging = null;
  },

  _onDragOver(col) {
    col.classList.add('drag-over');
  },

  _onDragLeave(col) {
    col.classList.remove('drag-over');
  },

  async _onDrop(e, newStatus) {
    e.preventDefault();
    const id  = e.dataTransfer.getData('text/plain') || this._dragging;
    const col = e.currentTarget;
    col.classList.remove('drag-over');
    if (!id) return;

    const deal = this._deals.find(d => d.id === id);
    if (!deal || deal.status === newStatus) return;

    // Validácie pred presunom
    if (newStatus === 'contacted' && !deal.contact_id) {
      toast.error('Prirad kontakt pred posunutím na KONTAKTOVANÝ.'); return;
    }
    if (newStatus === 'offer_sent' && !deal.product_id) {
      toast.error('Prirad produkt pred odoslaním PONUKY.'); return;
    }
    if (newStatus === 'offer_sent' && !deal.sale_price_snapshot) {
      toast.error('Nastav cenu pred odoslaním PONUKY.'); return;
    }
    if (newStatus === 'won' && (!deal.contact_id || !deal.product_id || !deal.sale_price_snapshot)) {
      toast.error('Deal musí mať kontakt, produkt a cenu pred WON.'); return;
    }
    if (newStatus === 'won') {
      // Trigger automaticky vytvorí faktúru a presunie na payment_pending
      toast.info('Deal WON — faktúra bude vytvorená automaticky a deal prejde na Čaká platba.');
    }
    if (newStatus === 'payment_pending') {
      toast.warning('Stav Čaká platba sa nastavuje automaticky po WON cez faktúru.'); return;
    }

    if (newStatus === 'paid') {
      await this._askPaid(id, deal);
      return;
    }
    if (newStatus === 'cancelled') {
      await this._askReason(id, 'cancelled');
      return;
    }
    if (newStatus === 'lost') {
      await this._askReason(id, 'lost');
      return;
    }

    await this._updateStatus(id, newStatus);
  },

  _askPaid(id, deal) {
    return new Promise(resolve => {
      modal.open('💳 Potvrdiť platbu', `
        <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
          Deal: <strong>${esc(deal.title||'—')}</strong> — ${EUR(deal.sale_price_snapshot||0)}
        </div>
        <div class="form-row"><label class="form-label">Spôsob platby *</label>
          <select id="pay-method">
            <option value="">— vybrať —</option>
            <option value="bank_transfer">🏦 Bankový prevod</option>
            <option value="card">💳 Karta</option>
            <option value="cash">💵 Hotovosť</option>
            <option value="invoice">🧾 Faktúra</option>
          </select></div>
        <div class="form-row"><label class="form-label">Referencia platby *</label>
          <input id="pay-ref" placeholder="č. faktúry, VS, ID transakcie..." /></div>
        <div class="form-actions">
          <button class="btn-primary" onclick="pipelineView._submitPaid('${id}')">✓ Potvrdiť platbu</button>
          <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        </div>`);
      resolve();
    });
  },

  async _submitPaid(id) {
    const method = document.getElementById('pay-method')?.value;
    const ref    = document.getElementById('pay-ref')?.value?.trim();
    if (!method) { toast.error('Vyber spôsob platby.'); return; }
    if (!ref)    { toast.error('Zadaj referenciu platby (číslo faktúry alebo VS).'); return; }
    // Uložíme pred zatvorením modalu
    const payMethod = method;
    const payRef    = ref;
    modal.close();
    await this._updateStatus(id, 'paid', { payment_method: payMethod, payment_reference: payRef });
  },

  _askReason(id, type) {
    const isLost = type === 'lost';
    const lossReasons   = ['Cena','Nezáujem','Konkurencia','Bez odpovede','Nesprávny produkt','Odložené','Iné'];
    const cancelReasons = ['Duplicitný deal','Omyl pri vytvorení','Klient stiahol záujem','Interné zrušenie','Storno po dohode','Iné'];
    const reasons = isLost ? lossReasons : cancelReasons;
    const deal    = this._deals.find(d => d.id === id);

    return new Promise(resolve => {
      modal.open(isLost ? '❌ Dôvod straty' : '🚫 Dôvod zrušenia', `
        <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
          Deal: <strong>${esc(deal?.title||'—')}</strong>
        </div>
        <div class="form-row"><label class="form-label">${isLost ? 'Dôvod straty' : 'Dôvod zrušenia'} *</label>
          <select id="reason-select">
            <option value="">— vybrať —</option>
            ${reasons.map(r=>`<option value="${r}">${r}</option>`).join('')}
          </select></div>
        <div class="form-row"><label class="form-label">Poznámka (voliteľné)</label>
          <textarea id="reason-note" style="min-height:55px;resize:vertical;" placeholder="Detaily..."></textarea></div>
        <div class="form-actions">
          <button class="btn-primary" style="background:var(--red);" onclick="pipelineView._submitReason('${id}','${type}')">
            ${isLost ? '❌ Označiť ako stratený' : '🚫 Zrušiť deal'}
          </button>
          <button class="btn-ghost" onclick="modal.close()">Späť</button>
        </div>`);
      resolve();
    });
  },

  async _submitReason(id, type) {
    const reason = document.getElementById('reason-select')?.value;
    const note   = document.getElementById('reason-note')?.value?.trim();
    if (!reason) { toast.error('Vyber dôvod zo zoznamu — je povinný.'); return; }
    const full   = note ? `${reason} — ${note}` : reason;
    modal.close();
    const extra  = type === 'lost' ? { loss_reason: full } : { cancel_reason: full };
    await this._updateStatus(id, type, extra);
  },

  async _updateStatus(id, status, extra = {}) {
    const deal = this._deals.find(d => d.id === id);
    if (!deal) return;

    const update = { status, ...extra };
    if (deal._pendingPayment) {
      update.payment_method    = deal._pendingPayment.method;
      update.payment_reference = deal._pendingPayment.ref;
      delete deal._pendingPayment;
    }

    const { error } = await db.client.from('deals').update(update).eq('id', id);
    if (error) {
      // Zobraz DB validačnú chybu čitateľne
      const msg = error.message || '';
      const friendly = msg.includes('musí mať') ? msg.split('ERROR:').pop().trim() : msg.split('ERROR:').pop().trim() || msg;
      toast.error(friendly);
      return;
    }

    deal.status = status;
    Object.assign(deal, extra);
    if (update.payment_method) deal.payment_method = update.payment_method;

    this._renderBoard();

    if (status === 'paid') {
      setTimeout(() => toast.success('Deal zaplatený! Transakcia, komisie a body vytvorené.'), 200);
    }
  },

  // ── Detail dealu ─────────────────────────────────────────────────────────
  async _openDetail(id) {
    const d = this._deals.find(x => x.id === id);
    if (!d) return;

    const col     = DEAL_COLS.find(c => c.key === d.status);
    const product = d.products;
    const contact = d.contacts;
    const price   = (d.discount_amount > 0 ? d.final_price : d.sale_price_snapshot) || product?.base_price || 0;
    const cost    = d.cost_snapshot || product?.cost_price || 0;
    const comm    = d.commission_amount_snapshot || 0;
    const net     = price - cost - comm;
    const role    = previewRole.effective() || auth.profile?.role;
    const isAdmin = role === 'admin';

    // Checklist — čo chýba pre ďalší krok
    const checks = [
      { ok: !!d.assigned_to,          label: 'Exekútor (kto rieši deal)', needed: ['assigned'] },
      { ok: !!d.contact_id,           label: 'Kontakt', needed: ['contacted','offer_sent','won','payment_pending','paid'] },
      { ok: !!d.product_id,           label: 'Produkt', needed: ['offer_sent','won','payment_pending','paid'] },
      { ok: price > 0,                label: 'Cena',    needed: ['offer_sent','won','payment_pending','paid'] },
      { ok: !!d.payment_method,       label: 'Spôsob platby', needed: ['paid'] },
      { ok: !!d.payment_reference,    label: 'Referencia platby', needed: ['paid'] },
    ];
    const colIdx  = DEAL_COLS.findIndex(c => c.key === d.status);
    const nextCol = DEAL_COLS[colIdx + 1];
    const blockers = nextCol
      ? checks.filter(c => !c.ok && c.needed.includes(nextCol.key))
      : [];

    // Načítaj históriu a benefit level klienta
    const [histRes, contactProfileRes] = await Promise.all([
      db.client.from('deal_history').select('*').eq('deal_id', id).order('created_at', { ascending: false }).limit(10),
      d.contact_id
        ? db.client.from('profiles')
            .select('name,points,rolling_points,lifetime_points,membership_levels(name,color,icon,discount_pct)')
            .eq('email', contact?.email || '')
            .single()
        : Promise.resolve({ data: null }),
    ]);
    const history      = histRes.data || [];
    const clientProfile = contactProfileRes.data;
    const clientLevel   = clientProfile?.membership_levels;

    const statusOpts = DEAL_COLS
      .filter(c => !['payment_pending','paid'].includes(c.key))
      .map(c => `<option value="${c.key}"${d.status===c.key?' selected':''}>${c.label}</option>`)
      .join('') +
      `<option value="payment_pending"${d.status==='payment_pending'?' selected':''} disabled>⏳ Čaká platba (auto)</option>
       <option value="paid"${d.status==='paid'?' selected':''} disabled>✓ Zaplatený (cez faktúru)</option>
       <option value="lost"${d.status==='lost'?' selected':''}>❌ Stratený</option>
       <option value="cancelled"${d.status==='cancelled'?' selected':''}>🚫 Zrušený</option>`;

    const payMethods = { bank_transfer:'Bankový prevod', card:'Karta', cash:'Hotovosť', invoice:'Faktúra' };

    modal.open(`📊 ${esc(d.title||'—')}`, `

      <!-- Stav + blocker upozornenie -->
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
        ${col ? `<span class="badge" style="background:${col.color}18;color:${col.color};border:1px solid ${col.color}44;font-size:12px;">${col.label}</span>` : ''}
        ${d.sla_breached ? `<span style="font-size:11px;color:var(--red);">⚠ SLA porušené</span>` : ''}
        <span style="font-size:11px;color:var(--muted);">Vytvorený: ${FMT(d.created_at)}</span>
        ${d.loss_reason ? `<span style="font-size:11px;color:var(--red);">Dôvod: ${esc(d.loss_reason)}</span>` : ''}
        ${d.cancel_reason ? `<span style="font-size:11px;color:var(--muted);">Dôvod: ${esc(d.cancel_reason)}</span>` : ''}
      </div>

      ${blockers.length > 0 ? `
        <div style="background:rgba(212,148,58,0.1);border:1px solid var(--acc-brd);border-radius:8px;padding:10px 12px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--acc);margin-bottom:6px;">
            ⚠ Pred presunom na <strong>${nextCol?.label}</strong> chýba:
          </div>
          ${blockers.map(b=>`<div style="font-size:12px;color:var(--acc);">• ${b.label}</div>`).join('')}
        </div>` : nextCol ? `
        <div style="background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.3);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--green);">
          ✓ Pripravený na presun → <strong>${nextCol.label}</strong>
        </div>` : ''}

      <!-- Klient + benefit level -->
      ${clientProfile ? `
        <div style="background:var(--inp);border:1px solid ${clientLevel?.color||'var(--brd)'}44;border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;font-weight:700;">👤 ${esc(contact?.name||'—')}</div>
            <div style="font-size:11px;color:var(--muted);">${esc(contact?.email||'')} · ${esc(contact?.phone||'')}</div>
          </div>
          ${clientLevel ? `
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:700;color:${clientLevel.color};">${clientLevel.icon} ${clientLevel.name}</div>
              <div style="font-size:11px;color:var(--muted);">Rolling: ${(clientProfile.rolling_points||0).toLocaleString('sk-SK')} b. · Lifetime: ${(clientProfile.lifetime_points||0).toLocaleString('sk-SK')} b.</div>
              ${clientLevel.discount_pct > 0 ? `<div style="font-size:11px;color:${clientLevel.color};">Zľava: ${clientLevel.discount_pct}%</div>` : ''}
            </div>` : `<div style="font-size:11px;color:var(--muted);">${(clientProfile.points||0)} bodov</div>`}
        </div>` : ''}

      <!-- Základ -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Základ</div>
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="dd-title" value="${esc(d.title||'')}" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="dd-status">${statusOpts}</select></div>

      ${isAdmin && (d.status === 'new' || d.status === 'assigned') ? `
        <!-- Priradenie exekútora — admin only -->
        <div style="background:rgba(91,164,245,0.08);border:1px solid rgba(91,164,245,0.3);border-radius:8px;padding:10px 12px;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:#5ba4f5;margin-bottom:8px;">👤 Priradenie exekútora</div>
          <div class="form-row" style="margin-bottom:0;">
            <label class="form-label">Kto rieši deal?</label>
            <select id="dd-assigned-to">
              <option value="">— nepriradený —</option>
              ${(await db.client.from('profiles').select('id,name,role').in('role',['admin','obchodnik']).then(r=>r.data||[])).map(p=>`<option value="${p.id}"${d.assigned_to===p.id?' selected':''}>${esc(p.name)} (${p.role})</option>`).join('')}
            </select>
          </div>
          ${d.assigned_to ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">✓ Priradené — deal sa pri uložení presunie do stavu Priradený</div>` : ''}
        </div>` : ''}

      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Kontakt</label>
          <select id="dd-contact">
            <option value="">—</option>
            ${app.state.contacts.map(c=>`<option value="${c.id}"${d.contact_id===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}
          </select></div>
        <div class="form-row"><label class="form-label">Produkt</label>
          <select id="dd-product" onchange="pipelineView._onDetailProduct(this.value,'${id}')">
            <option value="">—</option>
            ${(app.state.products||[]).filter(p=>p.active||p.is_active).map(p=>`<option value="${p.id}"${d.product_id===p.id?' selected':''}>${esc(p.name)}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="dd-notes" style="min-height:55px;resize:vertical;">${esc(d.notes||'')}</textarea></div>

      <!-- Finančné -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px;">Finančné dáta</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Predajná cena (€)</label>
          <input id="dd-price" type="number" value="${price||''}" /></div>
        <div class="form-row"><label class="form-label">Náklad (€)</label>
          <input id="dd-cost" type="number" value="${cost||''}" /></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Marža</div>
          <div class="mono" style="font-weight:700;color:var(--blue);">${EUR(price-cost)}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Komisie</div>
          <div class="mono" style="font-weight:700;color:var(--acc);">${EUR(comm)}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Čistý zisk</div>
          <div class="mono" style="font-weight:700;color:var(--green);">${EUR(net)}</div>
        </div>
      </div>

      <!-- Platba -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Platba</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Spôsob platby</label>
          <select id="dd-pay-method">
            <option value="">—</option>
            ${Object.entries(payMethods).map(([k,v])=>`<option value="${k}"${d.payment_method===k?' selected':''}>${v}</option>`).join('')}
          </select></div>
        <div class="form-row"><label class="form-label">Referencia</label>
          <input id="dd-pay-ref" value="${esc(d.payment_reference||'')}" placeholder="č. faktúry, VS..." /></div>
      </div>

      <!-- História zmien -->
      ${history.length > 0 ? `
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px;">História zmien</div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:6px 10px;max-height:140px;overflow-y:auto;">
          ${history.map(h => {
            const from = DEAL_COLS.find(c=>c.key===h.old_status);
            const to   = DEAL_COLS.find(c=>c.key===h.new_status);
            const timeAgo = (() => {
              const diff = Math.round((new Date()-new Date(h.created_at))/60000);
              if (diff < 60) return `pred ${diff} min`;
              if (diff < 1440) return `pred ${Math.round(diff/60)} hod`;
              return `pred ${Math.round(diff/1440)} d`;
            })();
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--brd);font-size:12px;">
                <div>
                  <span style="color:${from?.color||'var(--muted)'};">${from?.label||h.old_status||'—'}</span>
                  <span style="color:var(--muted);margin:0 4px;">→</span>
                  <span style="color:${to?.color||'var(--muted)'};font-weight:600;">${to?.label||h.new_status||'—'}</span>
                  ${h.note?`<span style="color:var(--muted);margin-left:6px;font-size:11px;">(${esc(h.note)})</span>`:''}
                </div>
                <span style="color:var(--muted);font-size:11px;white-space:nowrap;margin-left:8px;">${timeAgo}</span>
              </div>`;
          }).join('')}
        </div>` : ''}

      <div class="form-actions">
        <button class="btn-primary" onclick="pipelineView._saveDetail('${id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zavrieť</button>
        ${isAdmin ? `<button class="btn-danger" style="margin-left:auto;" onclick="pipelineView._deleteDeal('${id}')">Vymazať</button>` : ''}
      </div>`);
  },

  _onDetailProduct(pid, dealId) {
    const p = (app.state.products||[]).find(x => x.id === pid);
    if (!p) return;
    const priceEl = document.getElementById('dd-price');
    if (priceEl) priceEl.value = p.base_price || p.price || '';
    const costEl = document.getElementById('dd-cost');
    if (costEl) costEl.value = p.cost_price || '';
  },

  async _saveDetail(id) {
    const title     = document.getElementById('dd-title')?.value.trim();
    if (!title) { toast.error('Zadaj názov dealu.'); return; }

    const status     = document.getElementById('dd-status')?.value;
    const assignedTo = document.getElementById('dd-assigned-to')?.value || null;
    const contactId  = document.getElementById('dd-contact')?.value || deal?.contact_id || null;
    const productId  = document.getElementById('dd-product')?.value || deal?.product_id || null;
    const price      = Number(document.getElementById('dd-price')?.value)  || 0;
    const cost       = Number(document.getElementById('dd-cost')?.value)   || 0;
    const notes      = document.getElementById('dd-notes')?.value   || null;
    const payMethod  = document.getElementById('dd-pay-method')?.value || null;
    const payRef     = document.getElementById('dd-pay-ref')?.value    || null;

    // Auto-status: ak admin priradí exekútora a deal je 'new' → presun na 'assigned'
    const deal       = this._deals.find(x => x.id === id);
    const finalStatus = (assignedTo && status === 'new') ? 'assigned' : status;

    // Enforcement checklistu
    const checks = {
      contacted:       () => contactId || 'Chýba kontakt — prirad klienta pred posunom na Kontaktovaný.',
      offer_sent:      () => (productId && price > 0) || 'Chýba produkt alebo cena — vyplň pred odoslaním ponuky.',
      won:             () => (contactId && productId && price > 0) || 'Kontakt, produkt a cena sú povinné pred WON.',
      payment_pending: () => 'Stav Čaká platba sa nastavuje automaticky po WON cez faktúru.',
      paid:            () => (payMethod && payRef) || 'Vyplň spôsob platby aj referenciu (č. faktúry / VS) pred PAID.',
    };
    if (checks[finalStatus]) {
      const result = checks[finalStatus]();
      if (result !== true) { toast.error(result); return; }
    }
    if (finalStatus === 'lost' || finalStatus === 'cancelled') {
      if (finalStatus === 'lost' && !deal?.loss_reason) {
        await this._askReason(id, 'lost'); return;
      }
      if (finalStatus === 'cancelled' && !deal?.cancel_reason) {
        await this._askReason(id, 'cancelled'); return;
      }
    }
    const productChanged = deal && productId && deal.product_id !== productId;
    const contactChanged = deal && contactId && deal.contact_id !== contactId;
    const effectiveDealPrice = (deal?.discount_amount > 0 ? deal?.final_price : deal?.sale_price_snapshot) || 0;
    const priceChanged   = deal && price > 0 && Math.abs(effectiveDealPrice - price) > 0.01;
    const needsReset     = (productChanged || contactChanged || priceChanged) && (deal?.discount_amount||0) > 0;

    if (needsReset) {
      const reason = productChanged ? 'Produkt' : contactChanged ? 'Klient' : 'Cena';
      toast.warning(`${reason} sa zmenil — benefit zľava bola resetnutá. Pre novú zľavu vytvor nový deal.`);
    }

    // Varovanie ak sa mení cena po existujúcej faktúre
    if (priceChanged) {
      const { data: existingInv } = await db.client.from('invoices')
        .select('invoice_number').eq('deal_id', id).not('status','in','("cancelled","draft")').limit(1);
      if (existingInv?.length > 0) {
        toast.warning(`⚠ Cena dealu zmenená — faktúra ${existingInv[0].invoice_number} ostáva na pôvodnej sume. Zmena bola zalogovaná.`);
      }
    }

    // Prepočítaj komisie
    const product = (app.state.products||[]).find(p => p.id === (productId||deal?.product_id));
    const pct     = deal?.commission_percent_snapshot || product?.commission_percent || 0;
    const comm    = round2(price * pct / 100);
    const marginPct = price > 0 ? Math.round((price - cost - comm) / price * 100) : 0;

    // Guardrail aj pri úprave
    if (price > 0 && marginPct <= 15 && status !== deal?.status) {
      const role = previewRole.effective() || 'obchodnik';
      if (role !== 'admin') {
        toast.error(`Zmena stavu zablokovaná — marža ${marginPct}% je pod minimom 15%. Kontaktuj admina.`);
        return;
      }
      toast.warning(`Admin override: marža ${marginPct}% je pod minimom 15%.`);
    } else if (price > 0 && marginPct <= 25) {
      toast.warning(`Upozornenie: marža ${marginPct}% je pod odporúčanou hranicou 25%.`);
    }

    const update = {
      title,
      status:                      finalStatus,
      assigned_to:                 assignedTo,
      contact_id:                  contactId,
      product_id:                  productId,
      notes,
      sale_price_snapshot:         price,
      cost_snapshot:               cost,
      commission_percent_snapshot: pct,
      commission_amount_snapshot:  comm,
      net_profit_snapshot:         price - cost - comm,
      payment_method:              payMethod,
      payment_reference:           payRef,
      // Reset zľavy ak sa zmenil produkt/klient/cena
      ...(needsReset ? {
        discount_percent:    0,
        discount_amount:     0,
        discount_source:     null,
        discount_applied_by: null,
        discount_applied_at: null,
      } : {}),
    };

    const { data, error } = await db.client.from('deals').update(update).eq('id', id).select().single();
    if (error) { toast.error('Chyba: ' + error.message); return; }

    // Audit log pri zmene ceny alebo produktu
    const oldDeal = this._deals.find(x => x.id === id);
    if (oldDeal) {
      const changed = [];
      if (oldDeal.sale_price_snapshot !== price)    changed.push({ field:'cena',    old: oldDeal.sale_price_snapshot, new: price });
      if (oldDeal.product_id          !== productId) changed.push({ field:'produkt', old: oldDeal.product_id, new: productId });
      if (changed.length > 0) {
        db.client.from('audit_logs').insert({
          user_id:     app._currentUserId(),
          action:      'deal_edited',
          entity_type: 'deal',
          entity_id:   id,
          new_value:   JSON.stringify({ changes: changed }),
        }).catch(() => {});
      }
    }

    this._deals = this._deals.map(d => d.id === id ? {...d,...update} : d);
    modal.close();
    this._renderBoard();
    toast.success('Zmeny uložené.');
  },

  async _deleteDeal(id) {
    if (!confirm('Vymazať deal?')) return;
    const { error } = await db.client.from('deals').delete().eq('id', id);
    if (error) { toast.error('Chyba: ' + error.message); return; }
    this._deals = this._deals.filter(d => d.id !== id);
    modal.close();
    this._renderBoard();
  },

  _openAI(id) {
    const d = this._deals.find(x => x.id === id);
    if (!d) return;
    aiLead._openModal(id, 'deal', d, d.contacts, d.products);
  },

  // ── Nový deal ─────────────────────────────────────────────────────────────
  _openAdd() {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const pOpts = (app.state.products||[]).filter(p=>p.active||p.is_active).map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${EUR(p.base_price||0)}</option>`).join('');

    modal.open('Nový deal', `
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="nd-title" placeholder="napr. Záujem o chatbota" /></div>
      <div class="form-row"><label class="form-label">Kontakt</label>
        <select id="nd-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="nd-product" onchange="pipelineView._onNewProduct(this.value)">
          <option value="">— vybrať —</option>${pOpts}</select></div>
      <div id="nd-pinfo" style="display:none;margin-bottom:10px;"></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Cena (€)</label>
          <input id="nd-price" type="number" /></div>
        <div class="form-row"><label class="form-label">Zdroj</label>
          <select id="nd-source">
            <option value="manual">Manuálne</option>
            <option value="web">Web</option>
            <option value="referral">Referral</option>
            <option value="member">Člen</option>
            <option value="phone">Telefón</option>
          </select></div>
      </div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="nd-desc" style="min-height:50px;resize:vertical;"></textarea></div>
      <div style="padding:8px 12px;background:rgba(212,148,58,0.08);border:1px solid var(--acc-brd);border-radius:8px;font-size:12px;color:var(--acc);margin-bottom:12px;">
        ℹ️ Deal bude odoslaný na schválenie adminovi.
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="nd-btn" onclick="pipelineView._saveDeal()">Vytvoriť deal</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  _onNewProduct(pid) {
    const p = (app.state.products||[]).find(x => x.id === pid);
    if (!p) return;
    const pr = document.getElementById('nd-price');
    if (pr && !pr.value) pr.value = p.base_price || '';
    const ti = document.getElementById('nd-title');
    if (ti && !ti.value) ti.value = p.name;
    const info = document.getElementById('nd-pinfo');
    if (info) {
      info.style.display = '';
      info.innerHTML = `<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px 12px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--muted);">${esc(p.category||'')}${p.subcategory?' › '+esc(p.subcategory):''}</span>
          <span class="mono" style="color:var(--acc);font-weight:700;">${EUR(p.base_price||0)}</span>
        </div>
        ${p.description?`<div style="color:var(--muted);margin-top:3px;">${esc(p.description.slice(0,100))}</div>`:''}
      </div>`;
    }
  },

  async _saveDeal() {
    const title = document.getElementById('nd-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }

    // Duplicate check
    const contactId = document.getElementById('nd-contact')?.value || null;
    if (contactId) {
      const { data: dups } = await db.client.rpc('check_deal_duplicate', { p_contact_id: contactId });
      if (dups?.length > 0) {
        const names = dups.map(d=>`"${d.title}" (${d.status})`).join(', ');
        if (!confirm(`⚠️ Kontakt má aktívne dealy: ${names}\n\nPokračovať?`)) return;
      }
    }

    const btn = document.getElementById('nd-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    const pid     = document.getElementById('nd-product')?.value || null;
    const p       = (app.state.products||[]).find(x => x.id === pid);
    const pct     = p?.commission_percent || 0;
    const uid     = app._currentUserId();
    let   price   = Number(document.getElementById('nd-price')?.value) || p?.base_price || 0;

    // Načítaj benefit level kontaktu a uplatni zľavu automaticky
    let discountPct    = 0;
    let discountAmount = 0;
    let finalPrice     = price;
    let discountSource = null;
    let discountApply  = false;

    if (contactId && pid) {
      try {
        const contact = app.state.contacts.find(c => c.id === contactId);
        // Skontroluj či produkt má benefit_eligible
        const productEligible = p?.benefit_eligible !== false; // default true
        const productMaxDisc  = p?.max_discount_pct ?? 20;

        if (contact?.email && productEligible) {
          const { data: profile } = await db.client
            .from('profiles')
            .select('membership_levels(name,slug,color,discount_pct)')
            .eq('email', contact.email)
            .single();
          const level = profile?.membership_levels;
          if (level?.discount_pct > 0) {
            // Aplikuj max zľavu podľa produktu
            discountPct    = Math.min(level.discount_pct, productMaxDisc);
            discountAmount = round2(price * discountPct / 100);
            finalPrice     = round2(price - discountAmount);
            discountSource = `${level.name} (${level.slug})`;

            // Modal potvrdenie namiesto confirm()
            discountApply = await new Promise(resolve => {
              // Inline potvrdenie — nezatvára modal s dealem
              const existing = document.getElementById('discount-confirm-bar');
              if (existing) existing.remove();

              const bar = document.createElement('div');
              bar.id = 'discount-confirm-bar';
              bar.style.cssText = 'background:linear-gradient(135deg,#0a1f12,var(--card));border:1px solid rgba(62,207,142,0.4);border-radius:8px;padding:12px 14px;margin-bottom:10px;';
              bar.innerHTML = `
                <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px;">🎁 ${level.name} zľava ${discountPct}%</div>
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
                  <div style="font-size:13px;"><span style="text-decoration:line-through;color:var(--muted);">${EUR(price)}</span> → <strong style="color:var(--green);">${EUR(finalPrice)}</strong> <span style="color:var(--muted);font-size:11px;">(ušetrí ${EUR(discountAmount)})</span></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button id="apply-discount-yes" class="btn-primary" style="font-size:12px;padding:6px 14px;background:var(--green);">✓ Aplikovať zľavu</button>
                  <button id="apply-discount-no" class="btn-ghost" style="font-size:12px;padding:6px 14px;">Bez zľavy</button>
                </div>`;

              // Vlož pred form-actions
              const formActions = document.querySelector('#modal-body .form-actions');
              if (formActions) formActions.before(bar);
              else document.getElementById('modal-body')?.appendChild(bar);

              document.getElementById('apply-discount-yes').onclick = () => { bar.remove(); resolve(true); };
              document.getElementById('apply-discount-no').onclick  = () => { bar.remove(); resolve(false); };

              setTimeout(() => { bar.remove(); resolve(false); }, 30000);
            });
          }
        }
      } catch(e) { console.warn('Benefit check failed:', e.message); }
    }

    const effectivePrice = discountApply ? finalPrice : price;
    const costVal        = p?.cost_price || 0;
    const commAmount     = round2(effectivePrice * pct / 100);
    const netProfit      = round2(effectivePrice - costVal - commAmount);
    const marginPct      = effectivePrice > 0 ? Math.round(netProfit / effectivePrice * 100) : 0;

    // ── Benefit usage enforcement — max_uses_per_month ──────────────────────
    if (discountApply && contactId) {
      try {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const { data: usages } = await db.client
          .from('benefit_usage')
          .select('id')
          .eq('user_id', app._currentUserId())
          .gte('created_at', monthStart.toISOString());
        const usedThisMonth = (usages||[]).length;
        // Defaultný limit 3× mesačne ak nie je nastavený inak
        const monthLimit = 3;
        if (usedThisMonth >= monthLimit) {
          toast.warning(`Limit benefitov na tento mesiac dosiahnutý (${usedThisMonth}/${monthLimit}). Zľava nebude aplikovaná.`);
          discountApply = false;
        }
      } catch(e) { console.warn('Benefit usage check failed:', e.message); }
    }

    // ── Profit guardrail ────────────────────────────────────────────────────
    const WARN_THRESHOLD  = 25;
    const BLOCK_THRESHOLD = 15;
    let marginOverride = false;

    if (effectivePrice > 0 && marginPct <= BLOCK_THRESHOLD) {
      // Tvrdý blok — vyžaduje admin override
      const role = (previewRole.effective() || 'obchodnik');
      const isAdmin = role === 'admin';
      const overrideGranted = isAdmin
        ? await new Promise(resolve => {
            const existing = document.getElementById('override-bar');
            if (existing) existing.remove();
            const bar = document.createElement('div');
            bar.id = 'override-bar';
            bar.style.cssText = 'background:rgba(242,85,85,0.1);border:1px solid rgba(242,85,85,0.4);border-radius:8px;padding:12px 14px;margin-bottom:10px;';
            bar.innerHTML = `
              <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px;">🚨 Marža ${marginPct}% — pod minimom ${BLOCK_THRESHOLD}%</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Cena: ${EUR(effectivePrice)} · Náklad: ${EUR(costVal)} · Zisk: ${EUR(netProfit)}</div>
              <div class="form-row" style="margin-bottom:8px;">
                <input id="override-reason-input" placeholder="Dôvod override (povinný)..." style="font-size:12px;" />
              </div>
              <div style="display:flex;gap:8px;">
                <button id="override-yes" class="btn-primary" style="font-size:12px;padding:6px 14px;background:var(--red);">⚠ Schváliť</button>
                <button id="override-no" class="btn-ghost" style="font-size:12px;padding:6px 14px;">Zrušiť</button>
              </div>`;
            const formActions = document.querySelector('#modal-body .form-actions');
            if (formActions) formActions.before(bar);
            else document.getElementById('modal-body')?.appendChild(bar);
            document.getElementById('override-yes').onclick = () => {
              const r = document.getElementById('override-reason-input')?.value?.trim();
              if (!r) { toast.error('Zadaj dôvod override.'); return; }
              bar.remove(); resolve({ ok: true, reason: r });
            };
            document.getElementById('override-no').onclick = () => { bar.remove(); resolve({ ok: false }); };
            setTimeout(() => { bar.remove(); resolve({ ok: false }); }, 30000);
          })
        : { ok: false };

      if (!overrideGranted?.ok) {
        if (!isAdmin) toast.error(`Deal zablokovaný — marža ${marginPct}% je pod minimom ${BLOCK_THRESHOLD}%. Kontaktuj admina.`);
        if (btn) { btn.disabled = false; btn.textContent = 'Vytvoriť deal'; }
        return;
      }
      marginOverride = overrideGranted;

    } else if (effectivePrice > 0 && marginPct <= WARN_THRESHOLD) {
      // Mäkké varovanie — môže pokračovať
      toast.warning(`Upozornenie: marža ${marginPct}% je pod odporúčanou hranicou ${WARN_THRESHOLD}%.`);
    }

    try {
      const basePrice = p?.base_price || 0;
      const { data, error } = await db.client.from('deals').insert({
        title,
        contact_id:                  contactId,
        product_id:                  pid,
        owner_id:                    uid,
        created_by:                  uid,
        source:                      document.getElementById('nd-source')?.value || 'manual',
        description:                 document.getElementById('nd-desc')?.value   || null,
        status:                      'new',
        requires_approval:           false,
        // Ceny
        base_price:                  price,
        discount_percent:            discountApply ? discountPct    : 0,
        discount_amount:             discountApply ? discountAmount : 0,
        final_price:                 effectivePrice,
        discount_source:             discountApply ? discountSource : null,
        discount_applied_by:         discountApply ? uid            : null,
        discount_applied_at:         discountApply ? new Date().toISOString() : null,
        // Guardrail override
        margin_override:             marginOverride ? true : false,
        margin_override_by:          marginOverride ? uid  : null,
        margin_override_at:          marginOverride ? new Date().toISOString() : null,
        margin_override_reason:      marginOverride?.reason || null,
        // Snapshoty
        sale_price_snapshot:         effectivePrice,
        cost_snapshot:               costVal,
        commission_percent_snapshot: pct,
        commission_amount_snapshot:  commAmount,
        net_profit_snapshot:         netProfit,
        product_name_snapshot:       p?.name || null,
      }).select('*, contacts(name,email), products(name,category,base_price,commission_percent,commission_enabled,benefit_eligible,max_discount_pct)')
      .single();
      if (error) throw error;

      // Zaloguj použitie benefitu do benefit_usage
      if (discountApply && data?.id) {
        db.client.from('benefit_usage').insert({
          user_id:    uid,
          deal_id:    data.id,
          note:       `${discountSource} — ${discountPct}% zľava — ${EUR ? EUR(discountAmount) : discountAmount + ' €'} ušetrené`,
        }).then(() => {}).catch(e => console.warn('benefit_usage insert failed:', e.message));

        // Audit log
        db.client.from('audit_logs').insert({
          user_id:     uid,
          action:      'discount_applied',
          entity_type: 'deal',
          entity_id:   data.id,
          new_value:   JSON.stringify({
            discount_source:  discountSource,
            discount_pct:     discountPct,
            discount_amount:  discountAmount,
            base_price:       price,
            final_price:      effectivePrice,
          }),
        }).then(() => {}).catch(() => {});
      }

      this._deals.unshift(data);
      modal.close();
      this._renderBoard();
      if (discountApply) toast.success(`Zľava ${discountPct}% aplikovaná — ušetrené ${discountAmount.toFixed(2)} €`);
    } catch(e) {
      toast.error('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Vytvoriť deal'; }
    }
  },
};

function round2(n) { return Math.round((n||0) * 100) / 100; }
