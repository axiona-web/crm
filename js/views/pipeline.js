// ── views/pipeline.js — Kanban Deal Pipeline ─────────────────────────────────

const DEAL_COLS = [
  { key: 'new',             label: 'Nový',           color: '#66668a', group: 'lead'    },
  { key: 'assigned',        label: 'Priradený',      color: '#5ba4f5', group: 'lead'    },
  { key: 'contacted',       label: 'Kontaktovaný',   color: '#a78bfa', group: 'lead'    },
  { key: 'qualified',       label: 'Kvalifikovaný',  color: '#f0b85a', group: 'qualify' },
  { key: 'offer_sent',      label: 'Ponuka',         color: '#d4943a', group: 'deal'    },
  { key: 'won',             label: 'Vyhraný',        color: '#3ecf8e', group: 'deal'    },
  { key: 'payment_pending', label: 'Čaká platba',    color: '#f59e0b', group: 'payment' },
  { key: 'paid',            label: 'Zaplatený',      color: '#10b981', group: 'payment' },
  { key: 'in_progress',     label: 'V realizácii',   color: '#6366f1', group: 'done'    },
  { key: 'completed',       label: 'Dokončený',      color: '#3ecf8e', group: 'done'    },
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
      .select('*, contacts(name,email,phone), products(name,category,base_price,commission_percent,commission_enabled)')
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
          style="min-width:200px;max-width:220px;flex-shrink:0;"
          ondragover="event.preventDefault();pipelineView._onDragOver(this)"
          ondragleave="pipelineView._onDragLeave(this)"
          ondrop="pipelineView._onDrop(event,'${col.key}')">

          <!-- Hlavička stĺpca -->
          <div style="padding:8px 10px 6px;margin-bottom:8px;border-radius:8px;background:${col.color}18;border:1px solid ${col.color}33;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:${col.color};text-transform:uppercase;letter-spacing:0.05em;">${col.label}</span>
              <span style="font-size:10px;background:${col.color}33;color:${col.color};padding:1px 6px;border-radius:10px;font-weight:600;">${colDeals.length}</span>
            </div>
            ${colVal > 0 ? `<div style="font-size:11px;color:${col.color};margin-top:2px;opacity:0.8;">${EUR(colVal)}</div>` : ''}
          </div>

          <!-- Karty -->
          <div class="kanban-cards" data-status="${col.key}" style="min-height:80px;">
            ${colDeals.map(d => this._card(d, col.color)).join('')}
          </div>
        </div>`;
    }).join('');

    board.innerHTML = `
      <style>
        .kanban-board { display:flex;gap:10px;align-items:flex-start;padding:4px 2px; }
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
    const price    = d.sale_price_snapshot || product?.base_price || 0;
    const slaWarn  = d.sla_breached || (d.sla_due_at && new Date(d.sla_due_at) < new Date());
    const role     = previewRole.effective() || auth.profile?.role;
    const canMove  = role === 'admin' || d.owner_id === app._currentUserId() || d.assigned_to === app._currentUserId();

    return `
      <div class="card deal-card" style="margin-bottom:7px;padding:10px 11px;font-size:12px;"
        draggable="${canMove}"
        data-id="${d.id}"
        ondragstart="pipelineView._onDragStart(event,'${d.id}')"
        ondragend="pipelineView._onDragEnd(event)"
        onclick="pipelineView._openDetail('${d.id}')">

        ${slaWarn ? `<div style="font-size:10px;color:var(--red);margin-bottom:4px;">⚠ SLA</div>` : ''}
        ${d.requires_approval && !d.reviewed_at ? `<div style="font-size:10px;color:var(--acc);margin-bottom:4px;">⏳ Čaká schválenie</div>` : ''}

        <div style="font-weight:700;margin-bottom:5px;line-height:1.3;color:var(--txt);">${esc(d.title||'—')}</div>

        ${contact ? `<div style="color:var(--muted);margin-bottom:3px;">👤 ${esc(contact.name)}</div>` : ''}
        ${product ? `<div style="color:var(--muted);margin-bottom:3px;">🛍 ${esc(product.name)}</div>` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <span class="mono" style="font-weight:700;color:${colColor};">${EUR(price)}</span>
          <div style="display:flex;gap:4px;">
            ${hasKey ? `<button class="icon-btn" style="font-size:11px;" title="AI" onclick="event.stopPropagation();pipelineView._openAI('${d.id}')">✦</button>` : ''}
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
    const id = e.dataTransfer.getData('text/plain') || this._dragging;
    const col = e.currentTarget;
    col.classList.remove('drag-over');
    if (!id) return;

    const deal = this._deals.find(d => d.id === id);
    if (!deal || deal.status === newStatus) return;

    // Špeciálne akcie
    if (newStatus === 'paid') {
      if (!await this._confirmPaid(deal)) return;
    }
    if (newStatus === 'cancelled') {
      const reason = prompt('Dôvod zrušenia (voliteľné):') || '';
      await this._updateStatus(id, newStatus, { cancel_reason: reason });
      return;
    }
    if (newStatus === 'lost') {
      const reason = prompt('Dôvod straty (voliteľné):') || '';
      await this._updateStatus(id, newStatus, { loss_reason: reason });
      return;
    }

    await this._updateStatus(id, newStatus);
  },

  async _confirmPaid(deal) {
    const method = prompt('Spôsob platby:\n1 = Bankový prevod\n2 = Karta\n3 = Hotovosť\n4 = Faktúra\n\nZadaj číslo:', '1');
    if (method === null) return false;
    const methods = { '1':'bank_transfer','2':'card','3':'cash','4':'invoice' };
    const ref = prompt('Referencia platby (č. faktúry, VS...):', '') || '';
    deal._pendingPayment = { method: methods[method]||'bank_transfer', ref };
    return true;
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
    if (error) { alert('Chyba: ' + error.message); return; }

    deal.status = status;
    Object.assign(deal, extra);
    if (update.payment_method) deal.payment_method = update.payment_method;

    this._renderBoard();

    if (status === 'paid') {
      setTimeout(() => alert('✓ Deal označený ako zaplatený!\nKomisia a body boli vytvorené.'), 200);
    }
  },

  // ── Detail dealu ─────────────────────────────────────────────────────────
  _openDetail(id) {
    const d = this._deals.find(x => x.id === id);
    if (!d) return;

    const col     = DEAL_COLS.find(c => c.key === d.status);
    const product = d.products;
    const contact = d.contacts;
    const price   = d.sale_price_snapshot || product?.base_price || 0;
    const cost    = d.cost_snapshot || product?.cost_price || 0;
    const comm    = d.commission_amount_snapshot || 0;
    const margin  = price - cost;
    const net     = price - cost - comm;
    const role    = previewRole.effective() || auth.profile?.role;
    const isAdmin = role === 'admin';

    const statusOpts = DEAL_COLS.map(c =>
      `<option value="${c.key}"${d.status===c.key?' selected':''}>${c.label}</option>`
    ).join('') +
    `<option value="lost"${d.status==='lost'?' selected':''}>Stratený</option>
     <option value="cancelled"${d.status==='cancelled'?' selected':''}>Zrušený</option>`;

    modal.open(`Deal: ${esc(d.title||'—')}`, `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
        ${col ? `<span class="badge" style="background:${col.color}18;color:${col.color};border:1px solid ${col.color}44;">${col.label}</span>` : ''}
        ${d.sla_breached ? `<span style="font-size:11px;color:var(--red);">⚠ SLA porušené</span>` : ''}
        <span style="font-size:11px;color:var(--muted);">Vytvorený: ${FMT(d.created_at)}</span>
      </div>

      <!-- A. Základ -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Základ</div>
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="dd-title" value="${esc(d.title||'')}" /></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="dd-status">${statusOpts}</select></div>
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
        <textarea id="dd-notes" style="min-height:60px;resize:vertical;">${esc(d.notes||'')}</textarea></div>

      <!-- B. Finančné -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px;">Finančné dáta</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Predajná cena (€)</label>
          <input id="dd-price" type="number" value="${price||''}" /></div>
        <div class="form-row"><label class="form-label">Náklad (€)</label>
          <input id="dd-cost" type="number" value="${cost||''}" /></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Marža</div>
          <div class="mono" style="font-weight:700;color:var(--blue);">${EUR(margin)}</div>
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

      <!-- C. Platba -->
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Platba</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Spôsob platby</label>
          <select id="dd-pay-method">
            <option value="">—</option>
            <option value="bank_transfer"${d.payment_method==='bank_transfer'?' selected':''}>Bankový prevod</option>
            <option value="card"${d.payment_method==='card'?' selected':''}>Karta</option>
            <option value="cash"${d.payment_method==='cash'?' selected':''}>Hotovosť</option>
            <option value="invoice"${d.payment_method==='invoice'?' selected':''}>Faktúra</option>
          </select></div>
        <div class="form-row"><label class="form-label">Referencia</label>
          <input id="dd-pay-ref" value="${esc(d.payment_reference||'')}" placeholder="č. faktúry, VS..." /></div>
      </div>

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
    const title = document.getElementById('dd-title')?.value.trim();
    if (!title) { alert('Zadaj názov.'); return; }

    const status    = document.getElementById('dd-status')?.value;
    const contactId = document.getElementById('dd-contact')?.value || null;
    const productId = document.getElementById('dd-product')?.value || null;
    const price     = Number(document.getElementById('dd-price')?.value)  || 0;
    const cost      = Number(document.getElementById('dd-cost')?.value)   || 0;
    const notes     = document.getElementById('dd-notes')?.value   || null;
    const payMethod = document.getElementById('dd-pay-method')?.value || null;
    const payRef    = document.getElementById('dd-pay-ref')?.value    || null;

    // Prepočítaj komisie
    const deal    = this._deals.find(x => x.id === id);
    const product = (app.state.products||[]).find(p => p.id === (productId||deal?.product_id));
    const pct     = deal?.commission_percent_snapshot || product?.commission_percent || 0;
    const comm    = round2(price * pct / 100);

    const update = {
      title, status,
      contact_id:                 contactId,
      product_id:                 productId,
      notes,
      sale_price_snapshot:        price,
      cost_snapshot:              cost,
      commission_percent_snapshot: pct,
      commission_amount_snapshot:  comm,
      net_profit_snapshot:        price - cost - comm,
      payment_method:             payMethod,
      payment_reference:          payRef,
    };

    const { data, error } = await db.client.from('deals').update(update).eq('id', id).select().single();
    if (error) { alert('Chyba: ' + error.message); return; }

    this._deals = this._deals.map(d => d.id === id ? {...d,...update} : d);
    modal.close();
    this._renderBoard();
  },

  async _deleteDeal(id) {
    if (!confirm('Vymazať deal?')) return;
    const { error } = await db.client.from('deals').delete().eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
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

    const pid   = document.getElementById('nd-product')?.value || null;
    const price = Number(document.getElementById('nd-price')?.value) || 0;
    const p     = (app.state.products||[]).find(x => x.id === pid);
    const pct   = p?.commission_percent || 0;
    const uid   = app._currentUserId();

    try {
      const { data, error } = await db.client.from('deals').insert({
        title,
        contact_id:                 contactId,
        product_id:                 pid,
        owner_id:                   uid,
        created_by:                 uid,
        source:                     document.getElementById('nd-source')?.value || 'manual',
        description:                document.getElementById('nd-desc')?.value   || null,
        status:                     'new',
        requires_approval:          true,
        sale_price_snapshot:        price || p?.base_price || 0,
        cost_snapshot:              p?.cost_price || 0,
        commission_percent_snapshot: pct,
        commission_amount_snapshot:  round2((price||p?.base_price||0) * pct / 100),
        product_name_snapshot:      p?.name || null,
      }).select('*, contacts(name,email), products(name,category,base_price,commission_percent,commission_enabled)')
      .single();
      if (error) throw error;

      this._deals.unshift(data);
      modal.close();
      this._renderBoard();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Vytvoriť deal'; }
    }
  },
};

function round2(n) { return Math.round((n||0) * 100) / 100; }
