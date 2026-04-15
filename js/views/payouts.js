// ── views/payouts.js — Fakturácia ────────────────────────────────────────────

const payoutsView = {
  _invoices: [],
  _filter:   'all',

  render() {
    return `
      <div class="view-head">
        <h2>🧾 Fakturácia</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost" style="font-size:12px;" onclick="payoutsView._openAdd('invoice')">+ Faktúra</button>
          <button class="btn-ghost" style="font-size:12px;" onclick="payoutsView._openAdd('proforma')">+ Proforma</button>
          <button class="btn-ghost" style="font-size:12px;" onclick="payoutsView._openAdd('credit_note')">+ Dobropis</button>
        </div>
      </div>
      <div id="inv-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._render();
  },

  async _load() {
    const { data, error } = await db.client
      .from('invoices')
      .select('*, contacts(name,email), deals(title)')
      .order('issue_date', { ascending: false });
    if (error) console.error('Invoices error:', error);
    this._invoices = data || [];
    // Auto-update overdue
    await this._checkOverdue();
  },

  async _checkOverdue() {
    const today = new Date().toISOString().slice(0,10);
    const overdue = this._invoices
      .filter(i => i.status === 'sent' && i.due_date < today)
      .map(i => i.id);
    if (overdue.length > 0) {
      await db.client.from('invoices').update({ status: 'overdue' }).in('id', overdue);
      overdue.forEach(id => {
        const inv = this._invoices.find(i => i.id === id);
        if (inv) inv.status = 'overdue';
      });
    }
  },

  _fmt(v) { return (Math.round((v||0)*100)/100).toLocaleString('sk-SK',{minimumFractionDigits:2}) + ' €'; },

  _statusCfg(s) {
    return {
      draft:       { label:'Koncept',       color:'var(--muted)'  },
      sent:        { label:'Odoslaná',      color:'var(--blue)'   },
      paid:        { label:'Uhradená',      color:'var(--green)'  },
      overdue:     { label:'Po splatnosti', color:'var(--red)'    },
      credited:    { label:'Dobropisovaná', color:'var(--purple)' },
      cancelled:   { label:'Zrušená',       color:'var(--muted)'  },
    }[s] || { label: s, color:'var(--muted)' };
  },

  _typeCfg(t) {
    return {
      invoice:     { label:'Faktúra',  icon:'🧾' },
      proforma:    { label:'Proforma', icon:'📋' },
      credit_note: { label:'Dobropis', icon:'↩️' },
    }[t] || { label: t, icon:'📄' };
  },

  _render() {
    const el = document.getElementById('inv-wrap');
    if (!el) return;

    const all      = this._invoices;
    const sent     = all.filter(i => i.status === 'sent');
    const paid     = all.filter(i => i.status === 'paid');
    const overdue  = all.filter(i => i.status === 'overdue');
    const draft    = all.filter(i => i.status === 'draft');

    const totalSent    = sent.reduce((a,i)=>a+(i.amount_inc_vat||0),0);
    const totalPaid    = paid.reduce((a,i)=>a+(i.amount_inc_vat||0),0);
    const totalOverdue = overdue.reduce((a,i)=>a+(i.amount_inc_vat||0),0);

    const filtered = this._filter === 'all' ? all : all.filter(i => i.status === this._filter);

    el.innerHTML = `
      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Koncepty</div>
          <div class="mono" style="font-size:20px;font-weight:700;">${draft.length}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Odoslané</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--blue);">${this._fmt(totalSent)}</div>
          <div style="font-size:11px;color:var(--muted);">${sent.length} faktúr</div>
        </div>
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#0a1f12,var(--card));border-color:rgba(62,207,142,0.3);">
          <div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Uhradené</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--green);">${this._fmt(totalPaid)}</div>
          <div style="font-size:11px;color:var(--muted);">${paid.length} faktúr</div>
        </div>
        <div class="card" style="text-align:center;${overdue.length>0?'border-color:rgba(242,85,85,0.4);':''}">
          <div style="font-size:10px;color:var(--red);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Po splatnosti</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--red);">${this._fmt(totalOverdue)}</div>
          <div style="font-size:11px;color:var(--muted);">${overdue.length} faktúr</div>
        </div>
      </div>

      <!-- Filter -->
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
        ${['all','draft','sent','paid','overdue','credited','cancelled'].map(f => {
          const labels = {all:'Všetky',draft:'Koncepty',sent:'Odoslané',paid:'Uhradené',overdue:'Po splatnosti',credited:'Dobropisované',cancelled:'Zrušené'};
          const cnt = f==='all' ? all.length : all.filter(i=>i.status===f).length;
          return `<button class="filter-tab${this._filter===f?' active':''}"
            onclick="payoutsView._filter='${f}';payoutsView._render();">
            ${labels[f]} (${cnt})</button>`;
        }).join('')}
      </div>

      <!-- Zoznam -->
      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
            <div style="font-size:24px;margin-bottom:8px;">🧾</div>
            Žiadne faktúry
          </div>`
        : filtered.map(i => {
            const sc   = this._statusCfg(i.status);
            const tc   = this._typeCfg(i.invoice_type);
            const days = i.due_date ? Math.round((new Date(i.due_date)-new Date())/86400000) : null;
            const isOverdue = i.status === 'overdue';
            return `
              <div class="card" style="margin-bottom:8px;cursor:pointer;${isOverdue?'border-color:rgba(242,85,85,0.4);':''}"
                onclick="payoutsView._openDetail('${i.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
                      <span style="font-size:12px;">${tc.icon}</span>
                      <span style="font-size:13px;font-weight:700;">${esc(i.invoice_number)}</span>
                      <span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;font-size:10px;">${sc.label}</span>
                      <span style="font-size:11px;color:var(--muted);">${tc.label}</span>
                    </div>
                    <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
                      ${i.contacts?.name ? `<span>👤 ${esc(i.contacts.name)}</span>` : i.client_name ? `<span>👤 ${esc(i.client_name)}</span>` : ''}
                      ${i.deals?.title  ? `<span>📊 ${esc(i.deals.title)}</span>` : ''}
                      <span>📅 Vystavená: ${FMT(i.issue_date)}</span>
                      ${i.due_date ? `<span style="color:${isOverdue?'var(--red)':days<=3?'var(--acc)':'var(--muted)'};">
                        ⏱ Splatnosť: ${FMT(i.due_date)}${days!==null?' ('+Math.abs(days)+'d '+(days<0?'po':'do')+')'  :''}</span>` : ''}
                      ${i.paid_date ? `<span style="color:var(--green);">✓ Uhradené: ${FMT(i.paid_date)}</span>` : ''}
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${this._fmt(i.amount_inc_vat)}</div>
                    ${i.reverse_charge
                      ? `<div style="font-size:11px;color:var(--blue);font-weight:600;">Reverse charge</div>`
                      : i.vat_rate > 0
                        ? `<div style="font-size:11px;color:var(--muted);">bez DPH: ${this._fmt(i.amount_ex_vat)} + ${i.vat_rate}% DPH</div>`
                        : `<div style="font-size:11px;color:var(--muted);">bez DPH: ${this._fmt(i.amount_ex_vat)}</div>`}
                  </div>
                </div>
              </div>`;
          }).join('')}`;
  },

  // ── Formulár — nová faktúra ───────────────────────────────────────────────
  async _openAdd(type) {
    const tc       = this._typeCfg(type);
    const contacts = app.state.contacts || [];
    const deals    = app.state.deals    || [];
    const number   = await this._genNumber(type);
    const today    = new Date().toISOString().slice(0,10);
    const due      = new Date(Date.now() + 14*86400000).toISOString().slice(0,10);

    modal.open(`Nová ${tc.label}`, `
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Číslo dokladu</label>
          <input id="if-number" value="${esc(number)}" /></div>
        <div class="form-row"><label class="form-label">Typ</label>
          <select id="if-type">
            <option value="invoice"${type==='invoice'?' selected':''}>Faktúra</option>
            <option value="proforma"${type==='proforma'?' selected':''}>Proforma</option>
            <option value="credit_note"${type==='credit_note'?' selected':''}>Dobropis</option>
          </select></div>
      </div>

      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Kontakt</label>
          <select id="if-contact" onchange="payoutsView._onContact(this.value)">
            <option value="">— vybrať —</option>
            ${contacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select></div>
        <div class="form-row"><label class="form-label">Deal</label>
          <select id="if-deal" onchange="payoutsView._onDeal(this.value)">
            <option value="">— vybrať —</option>
            ${deals.filter(d=>!['lost','cancelled'].includes(d.status)).map(d=>`<option value="${d.id}">${esc(d.title)} — ${(d.sale_price_snapshot||0).toLocaleString('sk-SK')} €</option>`).join('')}
          </select></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px;">Odberateľ</div>
      <div class="form-row"><label class="form-label">Názov *</label>
        <input id="if-cname" placeholder="Meno / Firma" /></div>
      <div class="form-row"><label class="form-label">Adresa</label>
        <input id="if-caddr" placeholder="Ulica, PSČ Mesto" /></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">IČO</label><input id="if-ico" /></div>
        <div class="form-row"><label class="form-label">DIČ</label><input id="if-dic" /></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px;">Finančné</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Suma bez DPH (€) *</label>
          <input id="if-amount" type="number" step="0.01" oninput="payoutsView._calcVat()" /></div>
        <div class="form-row"><label class="form-label">Sadzba DPH (%)</label>
          <select id="if-vat" onchange="payoutsView._calcVat()">
            <option value="20">20%</option>
            <option value="10">10%</option>
            <option value="0">0% (bez DPH)</option>
          </select></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:10px;">
        <input type="checkbox" id="if-reverse-charge" onchange="payoutsView._calcVat()" />
        Reverse charge (platca DPH — faktúra bez DPH)
        <span style="font-size:11px;color:var(--muted);">(vat_rate = 0, poznámka na faktúre)</span>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">DPH</div>
          <div class="mono" id="if-vat-amount" style="font-weight:700;color:var(--blue);">0,00 €</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Spolu s DPH</div>
          <div class="mono" id="if-total" style="font-weight:700;color:var(--green);">0,00 €</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px;">Dátumy</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Dátum vystavenia</label>
          <input id="if-issue" type="date" value="${today}" /></div>
        <div class="form-row"><label class="form-label">Dátum splatnosti</label>
          <input id="if-due" type="date" value="${due}" /></div>
      </div>

      <div class="form-row"><label class="form-label">Popis / Položky</label>
        <textarea id="if-notes" style="min-height:60px;resize:vertical;" placeholder="Popis plnenia, položky..."></textarea></div>
      <div class="form-row"><label class="form-label">Interná poznámka</label>
        <input id="if-internal" placeholder="Len pre interné účely" /></div>

      <div class="form-actions">
        <button class="btn-primary" id="if-btn" onclick="payoutsView._saveInvoice('')">Vytvoriť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _genNumber(type) {
    const { data } = await db.client.rpc('generate_invoice_number', { p_type: type });
    const prefix = type==='invoice' ? 'FAK' : type==='proforma' ? 'PRO' : 'DOB';
    return data || (prefix + '-' + new Date().getFullYear() + '-0001');
  },

  _onContact(contactId) {
    const c = (app.state.contacts||[]).find(x => x.id === contactId);
    if (!c) return;
    const n = document.getElementById('if-cname');
    if (n && !n.value) n.value = c.name || '';
  },

  _onDeal(dealId) {
    const d = (app.state.deals||[]).find(x => x.id === dealId);
    if (!d) return;
    const a = document.getElementById('if-amount');
    if (a && !a.value) {
      a.value = d.sale_price_snapshot || 0;
      this._calcVat();
    }
    const n = document.getElementById('if-notes');
    if (n && !n.value) n.value = d.title || '';
    // Nastav kontakt
    if (d.contact_id) {
      const cs = document.getElementById('if-contact');
      if (cs) cs.value = d.contact_id;
      this._onContact(d.contact_id);
    }
  },

  _calcVat() {
    const amount  = parseFloat(document.getElementById('if-amount')?.value) || 0;
    const isRC    = document.getElementById('if-reverse-charge')?.checked || false;
    const rate    = isRC ? 0 : (parseFloat(document.getElementById('if-vat')?.value) || 0);
    const vat     = Math.round(amount * rate) / 100;
    const total   = amount + vat;
    const fmt     = v => v.toLocaleString('sk-SK',{minimumFractionDigits:2}) + ' €';
    const va = document.getElementById('if-vat-amount');
    const to = document.getElementById('if-total');
    if (va) va.textContent = fmt(vat);
    if (to) to.textContent = fmt(total);
    // Disable VAT select pri reverse charge
    const vatSel = document.getElementById('if-vat');
    if (vatSel) vatSel.disabled = isRC;
  },

  async _saveInvoice(id) {
    const isNew  = !id;
    const number = document.getElementById('if-number')?.value.trim();
    const amount = parseFloat(document.getElementById('if-amount')?.value) || 0;
    if (!number || !amount) { toast.error('Zadaj číslo dokladu a sumu.'); return; }

    const btn = document.getElementById('if-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    const isRC  = document.getElementById('if-reverse-charge')?.checked || false;
    const rate  = isRC ? 0 : (parseFloat(document.getElementById('if-vat')?.value) || 0);
    const vat   = Math.round(amount * rate) / 100;
    const total = amount + vat;
    const uid   = app._currentUserId();

    const obj = {
      invoice_number:  number,
      invoice_type:    document.getElementById('if-type')?.value     || 'invoice',
      deal_id:         document.getElementById('if-deal')?.value     || null,
      contact_id:      document.getElementById('if-contact')?.value  || null,
      client_name:     document.getElementById('if-cname')?.value    || null,
      client_address:  document.getElementById('if-caddr')?.value    || null,
      client_ico:      document.getElementById('if-ico')?.value      || null,
      client_dic:      document.getElementById('if-dic')?.value      || null,
      amount_ex_vat:   amount,
      vat_rate:        rate,
      vat_amount:      vat,
      amount_inc_vat:  total,
      reverse_charge:  isRC,
      issue_date:      document.getElementById('if-issue')?.value    || new Date().toISOString().slice(0,10),
      due_date:        document.getElementById('if-due')?.value      || null,
      notes:           document.getElementById('if-notes')?.value    || null,
      internal_note:   document.getElementById('if-internal')?.value || null,
      status:          'draft',
      created_by:      uid,
    };

    try {
      const q = isNew
        ? db.client.from('invoices').insert(obj).select('*, contacts(name,email), deals(title)').single()
        : db.client.from('invoices').update(obj).eq('id', id).select('*, contacts(name,email), deals(title)').single();
      const { data, error } = await q;
      if (error) throw error;
      if (isNew) this._invoices.unshift(data);
      else this._invoices = this._invoices.map(i => i.id === id ? data : i);
      modal.close();
      this._render();
    } catch(e) {
      alert('Chyba: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = isNew ? 'Vytvoriť' : 'Uložiť'; }
    }
  },

  // ── Detail faktúry ────────────────────────────────────────────────────────
  _openDetail(id) {
    const i  = this._invoices.find(x => x.id === id);
    if (!i) return;
    const sc = this._statusCfg(i.status);
    const tc = this._typeCfg(i.invoice_type);

    modal.open(`${tc.icon} ${i.invoice_number}`, `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
        <span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;">${sc.label}</span>
        <span style="font-size:12px;color:var(--muted);">${tc.label} · Vystavená: ${FMT(i.issue_date)} · Splatnosť: ${FMT(i.due_date)}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Odberateľ</div>
          <div style="font-weight:600;">${esc(i.client_name||i.contacts?.name||'—')}</div>
          ${i.client_address?`<div style="font-size:12px;color:var(--muted);">${esc(i.client_address)}</div>`:''}
          ${i.client_ico?`<div style="font-size:12px;color:var(--muted);">IČO: ${esc(i.client_ico)}</div>`:''}
          ${i.client_dic?`<div style="font-size:12px;color:var(--muted);">DIČ: ${esc(i.client_dic)}</div>`:''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Suma</div>
          <div style="font-size:12px;color:var(--muted);">Bez DPH: ${this._fmt(i.amount_ex_vat)}</div>
          <div style="font-size:12px;color:var(--muted);">DPH (${i.vat_rate}%): ${this._fmt(i.vat_amount)}</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--acc);margin-top:4px;">${this._fmt(i.amount_inc_vat)}</div>
        </div>
      </div>

      ${i.notes?`<div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:12px;">${esc(i.notes)}</div>`:''}
      ${i.deals?.title?`<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">📊 Deal: ${esc(i.deals.title)}</div>`:''}
      ${i.paid_date?`<div style="font-size:12px;color:var(--green);margin-bottom:12px;">✓ Uhradené: ${FMT(i.paid_date)}</div>`:''}

      <!-- Akcie -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${i.status==='draft'?`
          <button class="btn-primary" style="font-size:12px;" onclick="payoutsView._setStatus('${id}','sent')">📤 Odoslať</button>`:''}
        ${i.status==='sent'||i.status==='overdue'?`
          <button class="btn-primary" style="font-size:12px;background:var(--green);" onclick="payoutsView._markPaid('${id}')">✓ Uhradiť</button>`:''}
        ${['draft','sent','overdue'].includes(i.status)?`
          <button class="btn-ghost" style="font-size:12px;" onclick="payoutsView._openEdit('${id}')">✏️ Upraviť</button>
          <button class="btn-ghost" style="font-size:12px;color:var(--red);" onclick="payoutsView._setStatus('${id}','cancelled')">✕ Zrušiť</button>`:''}
        ${i.status==='paid'?`
          <button class="btn-ghost" style="font-size:12px;" onclick="payoutsView._openAdd('credit_note')">↩️ Dobropis</button>`:''}
      </div>

      <div class="form-actions">
        <button class="btn-ghost" onclick="modal.close()">Zavrieť</button>
      </div>`);
  },

  async _setStatus(id, status) {
    const { error } = await db.client.from('invoices').update({ status }).eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    const inv = this._invoices.find(i => i.id === id);
    if (inv) inv.status = status;
    modal.close();
    this._render();
  },

  async _markPaid(id) {
    const today = new Date().toISOString().slice(0,10);
    const inv   = this._invoices.find(i => i.id === id);
    modal.open('✓ Označiť faktúru ako uhradenú', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Faktúra: <strong>${esc(inv?.invoice_number||'—')}</strong>
        · Suma: <strong>${this._fmt(inv?.amount_inc_vat||0)}</strong>
      </div>
      <div class="form-row"><label class="form-label">Dátum úhrady</label>
        <input id="paid-date" type="date" value="${today}" /></div>
      <div class="form-actions">
        <button class="btn-primary" style="background:var(--green);" onclick="payoutsView._submitMarkPaid('${id}')">✓ Potvrdiť úhradu</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _submitMarkPaid(id) {
    const date = document.getElementById('paid-date')?.value;
    if (!date) { toast.error('Zadaj dátum úhrady.'); return; }
    const { error } = await db.client.from('invoices')
      .update({ status: 'paid', paid_date: date }).eq('id', id);
    if (error) { toast.error('Chyba: ' + error.message); return; }
    const inv = this._invoices.find(i => i.id === id);
    if (inv) { inv.status = 'paid'; inv.paid_date = date; }
    modal.close();
    toast.success('Faktúra označená ako uhradená. Deal bol presunutý na Zaplatený.');
    this._render();
  },

  _openEdit(id) {
    const i = this._invoices.find(x => x.id === id);
    if (!i) return;
    modal.close();
    setTimeout(() => this._openEditModal(i), 100);
  },

  _openEditModal(i) {
    const contacts = app.state.contacts || [];
    const deals    = app.state.deals    || [];
    modal.open(`Upraviť — ${esc(i.invoice_number)}`, `
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Číslo dokladu</label>
          <input id="if-number" value="${esc(i.invoice_number)}" /></div>
        <div class="form-row"><label class="form-label">Typ</label>
          <select id="if-type">
            <option value="invoice"${i.invoice_type==='invoice'?' selected':''}>Faktúra</option>
            <option value="proforma"${i.invoice_type==='proforma'?' selected':''}>Proforma</option>
            <option value="credit_note"${i.invoice_type==='credit_note'?' selected':''}>Dobropis</option>
          </select></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Kontakt</label>
          <select id="if-contact">
            <option value="">—</option>
            ${contacts.map(c=>`<option value="${c.id}"${i.contact_id===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}
          </select></div>
        <div class="form-row"><label class="form-label">Deal</label>
          <select id="if-deal">
            <option value="">—</option>
            ${deals.map(d=>`<option value="${d.id}"${i.deal_id===d.id?' selected':''}>${esc(d.title)}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-row"><label class="form-label">Odberateľ</label>
        <input id="if-cname" value="${esc(i.client_name||'')}" /></div>
      <div class="form-row"><label class="form-label">Adresa</label>
        <input id="if-caddr" value="${esc(i.client_address||'')}" /></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">IČO</label><input id="if-ico" value="${esc(i.client_ico||'')}" /></div>
        <div class="form-row"><label class="form-label">DIČ</label><input id="if-dic" value="${esc(i.client_dic||'')}" /></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Suma bez DPH (€)</label>
          <input id="if-amount" type="number" step="0.01" value="${i.amount_ex_vat||''}" oninput="payoutsView._calcVat()" /></div>
        <div class="form-row"><label class="form-label">DPH (%)</label>
          <select id="if-vat" onchange="payoutsView._calcVat()">
            <option value="20"${i.vat_rate==20?' selected':''}>20%</option>
            <option value="10"${i.vat_rate==10?' selected':''}>10%</option>
            <option value="0"${i.vat_rate==0?' selected':''}>0%</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">DPH</div>
          <div class="mono" id="if-vat-amount" style="font-weight:700;color:var(--blue);">${this._fmt(i.vat_amount)}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);">Spolu s DPH</div>
          <div class="mono" id="if-total" style="font-weight:700;color:var(--green);">${this._fmt(i.amount_inc_vat)}</div>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Vystavená</label>
          <input id="if-issue" type="date" value="${i.issue_date||''}" /></div>
        <div class="form-row"><label class="form-label">Splatnosť</label>
          <input id="if-due" type="date" value="${i.due_date||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="if-notes" style="min-height:55px;resize:vertical;">${esc(i.notes||'')}</textarea></div>
      <div class="form-row"><label class="form-label">Interná poznámka</label>
        <input id="if-internal" value="${esc(i.internal_note||'')}" /></div>
      <div class="form-actions">
        <button class="btn-primary" id="if-btn" onclick="payoutsView._saveInvoice('${i.id}')">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        <button class="btn-danger" style="margin-left:auto;" onclick="payoutsView._delete('${i.id}')">Vymazať</button>
      </div>`);
  },

  async _delete(id) {
    if (!confirm('Vymazať doklad?')) return;
    const { error } = await db.client.from('invoices').delete().eq('id', id);
    if (error) { alert('Chyba: ' + error.message); return; }
    this._invoices = this._invoices.filter(i => i.id !== id);
    modal.close();
    this._render();
  },
};
