// ── views/admin_queue.js — Admin "Na schválenie" ─────────────────────────────

const adminQueueView = {
  _data: null,

  render() {
    return `
      <div class="view-head">
        <h2>✅ Na schválenie</h2>
        <button class="btn-ghost" style="font-size:12px;" onclick="adminQueueView._load()">↻ Obnoviť</button>
      </div>
      <div id="queue-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
  },

  async _load() {
    const el = document.getElementById('queue-wrap');
    if (el) el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>';

    const [
      { data: pendComm },
      { data: pendPoints },
      { data: paidOrders },
      { data: newLeads },
      { data: slaLeads },
    ] = await Promise.all([
      db.client.from('commissions').select('*, profiles(name,email)').eq('status','pending').order('created_at'),
      db.client.from('point_transactions').select('*, contacts(name,email)').eq('status','pending').order('created_at'),
      db.client.from('orders').select('*, contacts(name), products(name)').eq('status','paid').is('commission_amount_snapshot', null).order('paid_at'),
      db.client.from('leads').select('*, contacts(name,email), products(name)').eq('status','new').eq('requires_approval', true).is('approved_at', null).order('created_at'),
      db.client.from('leads').select('*, contacts(name,email)').eq('sla_breached', true).not('status', 'in', '("lost","cancelled")').order('sla_due_at'),
    ]);

    this._data = { pendComm, pendPoints, paidOrders, newLeads, slaLeads };
    this._render();
  },

  _render() {
    const el = document.getElementById('queue-wrap');
    if (!el) return;
    const { pendComm, pendPoints, paidOrders, newLeads, slaLeads } = this._data;

    const total = (pendComm?.length||0) + (pendPoints?.length||0) + (paidOrders?.length||0) + (newLeads?.length||0) + (slaLeads?.length||0);

    if (total === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:48px;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:12px;">✓</div>
          <div style="font-size:16px;font-weight:600;color:var(--green);">Všetko vybavené</div>
          <div style="font-size:13px;margin-top:6px;">Žiadne položky nečakajú na schválenie</div>
        </div>`;
      return;
    }

    el.innerHTML = `
      ${this._section('⚠️ SLA porušené', slaLeads, 'sla')}
      ${this._section('📊 Nové leady bez priradenia', newLeads, 'lead')}
      ${this._section('📦 Zaplatené objednávky', paidOrders, 'order')}
      ${this._section('💰 Čakajúce provízie', pendComm, 'commission')}
      ${this._section('⭐ Čakajúce body', pendPoints, 'points')}`;
  },

  _section(title, items, type) {
    if (!items?.length) return '';
    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:600;">${title}</div>
          <span class="badge" style="background:rgba(242,85,85,0.12);color:var(--red);border:1px solid rgba(242,85,85,0.25);">${items.length}</span>
        </div>
        <div class="list">
          ${items.map(item => this._item(item, type)).join('')}
        </div>
      </div>`;
  },

  _item(item, type) {
    const fmt = v => Math.round(v||0).toLocaleString('sk-SK') + ' €';
    const fmtDate = d => d ? new Date(d).toLocaleDateString('sk-SK') : '—';

    if (type === 'commission') {
      const name = item.profiles?.name || item.profiles?.email || '—';
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:600;font-size:14px;">💰 ${fmt(item.amount)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                Obchodník: ${esc(name)} &nbsp;·&nbsp; ${fmtDate(item.date)}
                ${item.rate ? ` &nbsp;·&nbsp; ${item.rate}%` : ''}
              </div>
              ${item.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${esc(item.notes)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost" style="font-size:12px;color:var(--green);" onclick="adminQueueView._approveComm('${item.id}')">✓ Schváliť</button>
              <button class="btn-ghost" style="font-size:12px;color:var(--red);" onclick="adminQueueView._cancelComm('${item.id}')">✕ Zamietnuť</button>
            </div>
          </div>
        </div>`;
    }

    if (type === 'points') {
      const name = item.contacts?.name || '—';
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:600;font-size:14px;">⭐ ${item.points} bodov</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                Člen: ${esc(name)} &nbsp;·&nbsp; ${esc(item.source_type)} &nbsp;·&nbsp; ${fmtDate(item.created_at)}
              </div>
              ${item.note ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${esc(item.note)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost" style="font-size:12px;color:var(--green);" onclick="adminQueueView._approvePoints('${item.id}', ${item.points}, '${item.user_id||''}')">✓ Schváliť</button>
              <button class="btn-ghost" style="font-size:12px;color:var(--red);" onclick="adminQueueView._cancelPoints('${item.id}')">✕ Zamietnuť</button>
            </div>
          </div>
        </div>`;
    }

    if (type === 'order') {
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:600;font-size:14px;">📦 ${esc(item.products?.name||'—')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                Zákazník: ${esc(item.contacts?.name||'—')} &nbsp;·&nbsp; ${fmt(item.value)} &nbsp;·&nbsp; ${fmtDate(item.paid_at||item.created_at)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost" style="font-size:12px;" onclick="app.setView('orders')">→ Objednávky</button>
            </div>
          </div>
        </div>`;
    }

    if (type === 'lead') {
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:600;font-size:14px;">📋 ${esc(item.title||item.contacts?.name||'Nový lead')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                ${item.contacts?.name ? esc(item.contacts.name) + ' &nbsp;·&nbsp; ' : ''}
                Produkt: ${esc(item.products?.name||'—')} &nbsp;·&nbsp;
                Zdroj: ${esc(item.source||'—')} &nbsp;·&nbsp;
                ${fmtDate(item.created_at)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost" style="font-size:12px;color:var(--green);"
                onclick="adminQueueView._approveLead('${item.id}')">✓ Schváliť</button>
              <button class="btn-ghost" style="font-size:12px;color:var(--red);"
                onclick="adminQueueView._rejectLead('${item.id}')">✕ Zamietnuť</button>
              <button class="btn-ghost" style="font-size:12px;"
                onclick="app.setView('pipeline')">→ Pipeline</button>
            </div>
          </div>
        </div>`;
    }

    if (type === 'sla') {
      return `
        <div class="card" style="border-color:rgba(242,85,85,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:600;font-size:14px;color:var(--red);">⚠ ${esc(item.contacts?.name||'Neznámy')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                SLA: ${fmtDate(item.sla_due_at)} &nbsp;·&nbsp; Obchodník: ${esc(item.profiles?.name||'Nepriradený')} &nbsp;·&nbsp; ${esc(item.status)}
              </div>
            </div>
            <button class="btn-ghost" style="font-size:12px;" onclick="app.setView('pipeline')">→ Pipeline</button>
          </div>
        </div>`;
    }
    return '';
  },

  async _approveLead(id) {
    const assignTo = prompt('Priradiť obchodníkovi (email alebo nechaj prázdne):');
    let userId = null;
    if (assignTo) {
      const { data: p } = await db.client.from('profiles').select('id').eq('email', assignTo).single();
      userId = p?.id || null;
    }
    try {
      await db.client.rpc('approve_lead', { p_lead_id: id, p_assign_to: userId });
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async _rejectLead(id) {
    const reason = prompt('Dôvod zamietnutia:') || 'Nezodpovedá kritériám';
    try {
      await db.client.from('leads').update({
        status: 'cancelled', rejection_reason: reason,
      }).eq('id', id);
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async _approveComm(id) {
    if (!confirm('Schváliť províziu?')) return;
    try {
      const uid = (await db.client.auth.getUser()).data.user?.id;
      await db.client.from('commissions').update({
        status: 'approved', approved_by: uid, approved_at: new Date().toISOString(),
      }).eq('id', id);
      await db.client.from('notifications').insert({
        user_id: (await db.client.from('commissions').select('owner_id').eq('id',id).single()).data?.owner_id,
        type: 'commission_approved', title: 'Provízia schválená',
        message: 'Tvoja provízia bola schválená adminom.', entity_type: 'commission', entity_id: id,
      });
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async _cancelComm(id) {
    if (!confirm('Zamietnuť províziu?')) return;
    try {
      await db.client.from('commissions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async _approvePoints(id, points, userId) {
    if (!confirm('Schváliť body?')) return;
    try {
      const uid = (await db.client.auth.getUser()).data.user?.id;
      await db.client.from('point_transactions').update({
        status: 'approved', approved_by: uid, approved_at: new Date().toISOString(),
      }).eq('id', id);
      // Aktualizuj súčet bodov v profiles
      if (userId) {
        const { data: prof } = await db.client.from('profiles').select('points').eq('id', userId).single();
        await db.client.from('profiles').update({ points: (prof?.points||0) + points }).eq('id', userId);
      }
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  async _cancelPoints(id) {
    if (!confirm('Zamietnuť body?')) return;
    try {
      await db.client.from('point_transactions').update({ status: 'cancelled' }).eq('id', id);
      await this._load();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
