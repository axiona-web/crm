// ── views/payouts.js ─────────────────────────────────────────────────────────

const payoutsView = {
  _batches:     [],
  _commissions: [],

  render() {
    return `
      <div class="view-head">
        <h2>💳 Výplaty provízií</h2>
        <button class="btn-primary" onclick="payoutsView.openNewBatch()">+ Nová výplata</button>
      </div>
      <div id="payouts-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._render();
  },

  async _load() {
    const [{ data: batches }, { data: comms }] = await Promise.all([
      db.client
        .from('commission_payout_batches')
        .select('*, profiles!commission_payout_batches_created_by_fkey(name)')
        .order('created_at', { ascending: false }),
      db.client
        .from('commissions')
        .select('*, profiles!commissions_owner_id_fkey(name,email)')
        .eq('status', 'approved')
        .order('created_at'),
    ]);
    this._batches     = batches || [];
    this._commissions = comms   || [];
  },

  _fmt(v) { return Math.round(v||0).toLocaleString('sk-SK') + ' €'; },

  _byUser() {
    const map = {};
    this._commissions.forEach(c => {
      const uid  = c.owner_id || 'unknown';
      const name = c.profiles?.name || c.profiles?.email || 'Neznámy';
      if (!map[uid]) map[uid] = { name, items: [], total: 0 };
      map[uid].items.push(c);
      map[uid].total += c.amount || 0;
    });
    return map;
  },

  _render() {
    const el = document.getElementById('payouts-wrap');
    if (!el) return;

    const totalApproved = this._commissions.reduce((a,c) => a+(c.amount||0), 0);
    const totalPaid     = this._batches.filter(b=>b.status==='paid').reduce((a,b)=>a+(b.total_amount||0),0);
    const byUser        = this._byUser();

    el.innerHTML = `
      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Na výplatu</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">${this._fmt(totalApproved)}</div>
          <div style="font-size:11px;color:var(--muted);">${this._commissions.length} schválených provízií</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Obchodníkov čaká</div>
          <div class="mono" style="font-size:22px;font-weight:700;">${Object.keys(byUser).length}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Vyplatené historicky</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);">${this._fmt(totalPaid)}</div>
        </div>
      </div>

      <!-- Čakajúce výplaty -->
      ${this._commissions.length > 0 ? `
        <div class="card" style="margin-bottom:16px;border-color:rgba(62,207,142,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:12px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;">
              ✓ Schválené — čakajú na výplatu
            </div>
            <button class="btn-primary" style="font-size:12px;"
              onclick="payoutsView.payAll()">
              💳 Vyplatiť všetkých — ${this._fmt(totalApproved)}
            </button>
          </div>
          ${Object.entries(byUser).map(([uid, u]) => `
            <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--brd);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:600;font-size:14px;">👤 ${esc(u.name)}</div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="mono" style="font-size:16px;font-weight:700;color:var(--green);">${this._fmt(u.total)}</span>
                  <button class="btn-ghost" style="font-size:12px;color:var(--green);"
                    onclick="payoutsView.payOne('${uid}')">
                    💳 Vyplatiť
                  </button>
                </div>
              </div>
              ${u.items.map(c => `
                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding:3px 8px;">
                  <span>${FMT(c.date||c.created_at)}${c.notes?` · ${esc(c.notes.slice(0,50))}`:''}${c.rate?` · ${c.rate}%`:''}</span>
                  <span class="mono" style="font-weight:600;">${this._fmt(c.amount)}</span>
                </div>`).join('')}
            </div>`).join('')}
        </div>` : `
        <div class="card" style="margin-bottom:16px;text-align:center;padding:28px;color:var(--muted);">
          <div style="font-size:20px;margin-bottom:8px;">✓</div>
          Žiadne schválené provízie na výplatu
        </div>`}

      <!-- História -->
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        História výplatných dávok (${this._batches.length})
      </div>
      ${this._batches.length === 0
        ? `<div style="color:var(--muted);font-size:13px;">Žiadne výplaty</div>`
        : this._batches.map(b => {
            const sc = { draft:'var(--muted)', confirmed:'var(--blue)', paid:'var(--green)' }[b.status] || 'var(--muted)';
            const sl = { draft:'Koncept', confirmed:'Potvrdená', paid:'Vyplatená' }[b.status] || b.status;
            return `
              <div class="card" style="margin-bottom:8px;cursor:pointer;" onclick="payoutsView.openBatch('${b.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <span class="badge" style="color:${sc};background:${sc}18;border:1px solid ${sc}44;font-size:10px;">${sl}</span>
                      <span style="font-size:13px;font-weight:600;">${FMT(b.payout_date||b.created_at)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--muted);">
                      ${esc(b.profiles?.name||'—')} ${b.note?` · ${esc(b.note)}`:''}
                    </div>
                  </div>
                  <div class="mono" style="font-size:18px;font-weight:700;color:var(--green);">${this._fmt(b.total_amount)}</div>
                </div>
              </div>`;
          }).join('')}`;
  },

  async payOne(userId) {
    const byUser = this._byUser();
    const u      = byUser[userId];
    if (!u) return;
    if (!confirm(`Vyplatiť ${u.name}: ${this._fmt(u.total)}?`)) return;
    await this._createBatch(u.items, `Výplata: ${u.name}`);
  },

  async payAll() {
    const total = this._commissions.reduce((a,c)=>a+(c.amount||0),0);
    if (!confirm(`Vyplatiť všetkých obchodníkov: ${this._fmt(total)}?`)) return;
    await this._createBatch(this._commissions, 'Hromadná výplata');
  },

  async _createBatch(items, noteDefault) {
    if (!items?.length) { alert('Žiadne položky na výplatu.'); return; }

    const total = items.reduce((a,c)=>a+(c.amount||0),0);
    const uid   = (await db.client.auth.getUser()).data.user?.id;
    const today = new Date().toISOString().slice(0,10);

    // Pýtaj sa na poznámku
    const note = prompt('Poznámka k výplate (voliteľné):', noteDefault) ?? noteDefault;

    try {
      // 1. Vytvor batch
      const { data: batch, error: be } = await db.client
        .from('commission_payout_batches')
        .insert({
          created_by: uid, total_amount: total,
          status: 'paid', payout_date: today, note,
        })
        .select().single();
      if (be) throw be;

      // 2. Vytvor payout items
      const pItems = items.map(c => ({
        batch_id:      batch.id,
        commission_id: c.id,
        user_id:       c.owner_id,
        amount:        c.amount || 0,
      }));
      const { error: ie } = await db.client.from('commission_payout_items').insert(pItems);
      if (ie) throw ie;

      // 3. Označ komisie ako paid
      const { error: ce } = await db.client
        .from('commissions')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .in('id', items.map(c => c.id));
      if (ce) throw ce;

      // 4. Notifikácie obchodníkom
      const byUid = {};
      items.forEach(c => { byUid[c.owner_id] = (byUid[c.owner_id]||0) + (c.amount||0); });
      for (const [oUid, amt] of Object.entries(byUid)) {
        await db.client.from('notifications').insert({
          user_id:     oUid,
          type:        'commission_paid',
          title:       'Provízia vyplatená',
          message:     `Bola ti vyplatená provízia ${this._fmt(amt)}.`,
          entity_type: 'payout_batch',
          entity_id:   batch.id,
        });
      }

      alert(`✓ Výplata vytvorená: ${this._fmt(total)}`);
      await this._load();
      this._render();
    } catch(e) {
      alert('Chyba: ' + e.message);
      console.error(e);
    }
  },

  openNewBatch() {
    if (!this._commissions.length) {
      alert('Žiadne schválené provízie na výplatu.\n\nNajprv schváľ provízie v záložke Provízie.');
      return;
    }
    const total = this._commissions.reduce((a,c)=>a+(c.amount||0),0);
    const byUser = this._byUser();
    modal.open('Nová výplatná dávka', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Vyber obchodníkov pre túto výplatnú dávku:
      </div>
      ${Object.entries(byUser).map(([uid, u]) => `
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;border:1px solid var(--brd);border-radius:8px;margin-bottom:6px;">
          <input type="checkbox" data-uid="${uid}" checked
            style="width:16px;height:16px;accent-color:var(--acc);">
          <div style="flex:1;">
            <div style="font-weight:600;">${esc(u.name)}</div>
            <div style="font-size:12px;color:var(--muted);">${u.items.length} provízií</div>
          </div>
          <div class="mono" style="font-weight:700;color:var(--acc);">${this._fmt(u.total)}</div>
        </label>`).join('')}
      <div class="form-row" style="margin-top:12px;">
        <label class="form-label">Dátum výplaty</label>
        <input id="bp-date" type="date" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-row">
        <label class="form-label">Poznámka</label>
        <input id="bp-note" placeholder="napr. Výplata apríl 2026" value="Výplata ${new Date().toLocaleDateString('sk-SK',{month:'long',year:'numeric'})}">
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick="payoutsView._submitModal()">💳 Vytvoriť výplatu</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _submitModal() {
    const note  = document.getElementById('bp-note')?.value || 'Výplata';
    const boxes = document.querySelectorAll('input[data-uid]:checked');
    const selectedUids = [...boxes].map(b => b.dataset.uid);

    if (!selectedUids.length) { alert('Vyber aspoň jedného obchodníka.'); return; }

    const byUser   = this._byUser();
    const selected = this._commissions.filter(c => selectedUids.includes(c.owner_id));

    modal.close();
    await this._createBatch(selected, note);
  },

  async openBatch(id) {
    const { data: items } = await db.client
      .from('commission_payout_items')
      .select('*, profiles!commission_payout_items_user_id_fkey(name,email), commissions(amount,date,rate)')
      .eq('batch_id', id);

    const batch = this._batches.find(b => b.id === id);
    const total = (items||[]).reduce((a,i)=>a+(i.amount||0),0);

    modal.open('Detail výplaty', `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
        ${FMT(batch?.payout_date||batch?.created_at)}
        ${batch?.note ? ` · ${esc(batch.note)}` : ''}
      </div>
      ${(items||[]).map(i => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd);">
          <div>
            <div style="font-size:13px;font-weight:600;">${esc(i.profiles?.name||i.profiles?.email||'—')}</div>
            <div style="font-size:11px;color:var(--muted);">${FMT(i.commissions?.date)}${i.commissions?.rate?` · ${i.commissions.rate}%`:''}</div>
          </div>
          <div class="mono" style="font-weight:700;color:var(--green);">${this._fmt(i.amount)}</div>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:12px 0 0;font-weight:700;">
        <span>Spolu</span>
        <span class="mono" style="color:var(--green);">${this._fmt(total)}</span>
      </div>
      <div class="form-actions"><button class="btn-ghost" onclick="modal.close()">Zavrieť</button></div>`);
  },
};
