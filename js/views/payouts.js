// ── views/payouts.js — Výplaty provízií ──────────────────────────────────────

const payoutsView = {
  _batches: [],
  _commissions: [],
  _loaded: false,

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
      db.client.from('commission_payout_batches')
        .select('*, profiles!commission_payout_batches_created_by_fkey(name)')
        .order('created_at', { ascending: false }),
      db.client.from('commissions')
        .select('*, profiles!commissions_owner_id_fkey(name,email)')
        .eq('status', 'approved')
        .order('created_at'),
    ]);
    this._batches     = batches || [];
    this._commissions = comms   || [];
    this._loaded      = true;
  },

  _render() {
    const el = document.getElementById('payouts-wrap');
    if (!el) return;

    const totalApproved = this._commissions.reduce((a,c) => a + (c.amount||0), 0);
    const fmt = v => Math.round(v||0).toLocaleString('sk-SK') + ' €';

    // Zoskup approved komisie podľa obchodníka
    const byUser = {};
    this._commissions.forEach(c => {
      const uid  = c.owner_id || 'unknown';
      const name = c.profiles?.name || c.profiles?.email || 'Neznámy';
      if (!byUser[uid]) byUser[uid] = { name, items: [], total: 0 };
      byUser[uid].items.push(c);
      byUser[uid].total += c.amount || 0;
    });

    el.innerHTML = `
      <!-- Súhrn -->
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Na výplatu</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">${fmt(totalApproved)}</div>
          <div style="font-size:11px;color:var(--muted);">${this._commissions.length} provízií</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Obchodníkov</div>
          <div class="mono" style="font-size:22px;font-weight:700;">${Object.keys(byUser).length}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Dávok celkom</div>
          <div class="mono" style="font-size:22px;font-weight:700;">${this._batches.length}</div>
        </div>
      </div>

      <!-- Approved komisie ready na výplatu -->
      ${this._commissions.length > 0 ? `
        <div class="card" style="margin-bottom:16px;border-color:rgba(62,207,142,0.3);">
          <div style="font-size:12px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            ✓ Schválené — pripravené na výplatu
          </div>
          ${Object.entries(byUser).map(([uid, u]) => `
            <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--brd);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:600;font-size:14px;">${esc(u.name)}</div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="mono" style="font-size:16px;font-weight:700;color:var(--green);">${fmt(u.total)}</span>
                  <button class="btn-ghost" style="font-size:12px;color:var(--green);"
                    onclick="payoutsView.payUser('${uid}','${esc(u.name)}',${u.total})">
                    💳 Vyplatiť
                  </button>
                </div>
              </div>
              ${u.items.map(c => `
                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding:3px 0;">
                  <span>${FMT(c.date||c.created_at)} ${c.notes ? '· ' + esc(c.notes.slice(0,40)) : ''}</span>
                  <span class="mono">${fmt(c.amount)}</span>
                </div>`).join('')}
            </div>`).join('')}
          <button class="btn-primary" style="width:100%;margin-top:4px;" onclick="payoutsView.payAll()">
            💳 Vyplatiť všetkých (${fmt(totalApproved)})
          </button>
        </div>` : `
        <div class="card" style="margin-bottom:16px;text-align:center;padding:24px;color:var(--muted);">
          Žiadne schválené provízie na výplatu
        </div>`}

      <!-- História dávok -->
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
        História výplatných dávok
      </div>
      ${this._batches.length === 0
        ? '<div style="color:var(--muted);font-size:13px;">Žiadne výplaty</div>'
        : this._batches.map(b => {
          const statusColor = b.status==='paid' ? 'var(--green)' : b.status==='confirmed' ? 'var(--blue)' : 'var(--muted)';
          const statusLabel = { draft:'Koncept', confirmed:'Potvrdená', paid:'Vyplatená' }[b.status] || b.status;
          return `
            <div class="card" style="margin-bottom:8px;cursor:pointer;" onclick="payoutsView.openBatch('${b.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;font-size:14px;">${FMT(b.payout_date||b.created_at)}</div>
                  <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                    Vytvoril: ${esc(b.profiles?.name||'—')}
                    ${b.note ? ' · ' + esc(b.note) : ''}
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="mono" style="font-size:16px;font-weight:700;color:var(--acc);">${fmt(b.total_amount)}</div>
                  <span class="badge" style="color:${statusColor};background:${statusColor}18;border:1px solid ${statusColor}44;font-size:10px;">${statusLabel}</span>
                </div>
              </div>
            </div>`;
        }).join('')}`;
  },

  async payUser(userId, name, total) {
    if (!confirm(`Vyplatiť ${name}: ${Math.round(total).toLocaleString('sk-SK')} €?`)) return;
    const items = this._commissions.filter(c => c.owner_id === userId);
    await this._createBatch(items, `Výplata: ${name}`);
  },

  async payAll() {
    if (!confirm(`Vyplatiť všetkých obchodníkov spolu?`)) return;
    await this._createBatch(this._commissions, 'Hromadná výplata');
  },

  async _createBatch(items, note) {
    const total = items.reduce((a,c) => a+(c.amount||0), 0);
    const uid   = (await db.client.auth.getUser()).data.user?.id;
    const today = new Date().toISOString().slice(0,10);

    try {
      // Vytvor batch
      const { data: batch, error: be } = await db.client
        .from('commission_payout_batches')
        .insert({ created_by:uid, total_amount:total, status:'paid', payout_date:today, note })
        .select().single();
      if (be) throw be;

      // Vytvor batch items
      await db.client.from('commission_payout_items').insert(
        items.map(c => ({ batch_id:batch.id, commission_id:c.id, user_id:c.owner_id, amount:c.amount }))
      );

      // Označ komisie ako paid
      await db.client.from('commissions')
        .update({ status:'paid', paid_at: new Date().toISOString() })
        .in('id', items.map(c => c.id));

      // Notifikácie obchodníkom
      const byUser = {};
      items.forEach(c => {
        if (!byUser[c.owner_id]) byUser[c.owner_id] = 0;
        byUser[c.owner_id] += c.amount;
      });
      for (const [userId, amount] of Object.entries(byUser)) {
        await db.client.from('notifications').insert({
          user_id: userId, type: 'commission_paid',
          title: 'Provízia vyplatená',
          message: `Bola ti vyplatená provízia ${Math.round(amount).toLocaleString('sk-SK')} €.`,
          entity_type: 'payout_batch', entity_id: batch.id,
        });
      }

      alert(`✓ Výplata vytvorená: ${Math.round(total).toLocaleString('sk-SK')} €`);
      await this._load();
      this._render();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async openBatch(id) {
    const { data: items } = await db.client
      .from('commission_payout_items')
      .select('*, profiles!commission_payout_items_user_id_fkey(name,email), commissions(amount,date)')
      .eq('batch_id', id);

    const fmt = v => Math.round(v||0).toLocaleString('sk-SK') + ' €';
    modal.open('Detail výplaty', `
      <div style="font-size:13px;">
        ${(items||[]).map(i => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd);">
            <div>
              <div style="font-weight:600;">${esc(i.profiles?.name||i.profiles?.email||'—')}</div>
              <div style="font-size:11px;color:var(--muted);">${FMT(i.commissions?.date)}</div>
            </div>
            <div class="mono" style="font-weight:700;color:var(--green);">${fmt(i.amount)}</div>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;">
          <span>Spolu</span>
          <span class="mono" style="color:var(--acc);">${fmt((items||[]).reduce((a,i)=>a+i.amount,0))}</span>
        </div>
      </div>
      <div class="form-actions"><button class="btn-ghost" onclick="modal.close()">Zavrieť</button></div>`);
  },

  openNewBatch() {
    modal.open('Nová výplatná dávka', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Táto funkcia vyplatí všetky schválené provízie naraz.
        Môžeš tiež vyplatiť jednotlivých obchodníkov kliknutím na tlačidlo "Vyplatiť" v zozname.
      </div>
      <div class="form-row"><label class="form-label">Poznámka</label>
        <input id="batch-note" placeholder="napr. Výplata apríl 2026" /></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="payoutsView._batchFromModal()">Vytvoriť výplatu</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
      </div>`);
  },

  async _batchFromModal() {
    const note = document.getElementById('batch-note')?.value || 'Výplata';
    modal.close();
    await this._createBatch(this._commissions, note);
  },
};
