// ── views/notifications.js — Notifikačný bell ────────────────────────────────

const notifView = {
  _notifs:   [],
  _interval: null,

  // Spusti polling pri boot
  init() {
    this.refresh();
    // Refresh každých 30 sekúnd
    this._interval = setInterval(() => this.refresh(), 30000);
  },

  async refresh() {
    const uid = app._currentUserId();
    if (!uid) return;

    const { data } = await db.client
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(30);

    this._notifs = data || [];
    this._updateBell();
  },

  _updateBell() {
    const unread = this._notifs.filter(n => !n.is_read).length;
    const bell   = document.getElementById('notif-bell');
    const count  = document.getElementById('notif-count');
    if (!bell || !count) return;

    if (unread > 0) {
      count.style.display = 'block';
      count.textContent   = unread > 99 ? '99+' : unread;
      bell.style.color    = 'var(--acc)';
    } else {
      count.style.display = 'none';
      bell.style.color    = 'var(--muted)';
    }
  },

  async openPanel() {
    await this.refresh();
    const unread = this._notifs.filter(n => !n.is_read);

    modal.open('🔔 Notifikácie', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;color:var(--muted);">${this._notifs.length} notifikácií · ${unread.length} neprečítaných</span>
        ${unread.length > 0 ? `<button class="btn-ghost" style="font-size:11px;" onclick="notifView.markAllRead()">✓ Označiť všetky</button>` : ''}
      </div>
      ${this._notifs.length === 0
        ? '<div style="text-align:center;padding:30px;color:var(--muted);">Žiadne notifikácie</div>'
        : this._notifs.map(n => this._notifItem(n)).join('')}
      <div class="form-actions">
        <button class="btn-ghost" onclick="modal.close()">Zavrieť</button>
      </div>`);
  },

  _notifItem(n) {
    const icons = {
      new_deal:         '📋',
      deal_paid:        '💰',
      opp_won:          '🏆',
      commission_paid:  '💳',
      lead_assigned:    '👤',
      order_paid:       '✓',
    };
    const icon  = icons[n.type] || '🔔';
    const isNew = !n.is_read;

    return `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd);cursor:pointer;${isNew?'background:rgba(212,148,58,0.04);margin:0 -4px;padding:10px 4px;border-radius:6px;':''}"
        onclick="notifView._clickNotif('${n.id}','${n.entity_type||''}','${n.entity_id||''}')">
        <div style="font-size:18px;flex-shrink:0;">${icon}</div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="font-size:13px;font-weight:${isNew?'700':'400'};color:${isNew?'var(--txt)':'var(--muted)'};">
              ${esc(n.title||'Notifikácia')}
            </div>
            ${isNew?`<span style="width:7px;height:7px;border-radius:50%;background:var(--acc);flex-shrink:0;margin-top:4px;"></span>`:''}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${esc(n.message||'')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">${FMT(n.created_at)}</div>
        </div>
      </div>`;
  },

  async _clickNotif(id, entityType, entityId) {
    // Označ ako prečítané
    await db.client.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    const n = this._notifs.find(x => x.id === id);
    if (n) n.is_read = true;
    this._updateBell();
    modal.close();

    // Naviguj na relevantnú záložku
    if (entityType === 'deal') {
      app.setView('pipeline');
    } else if (entityType === 'commission') {
      app.setView('commissions');
    } else if (entityType === 'order') {
      app.setView('orders');
    } else if (entityType === 'payout_batch') {
      app.setView('payouts');
    }
  },

  async markAllRead() {
    const uid = app._currentUserId();
    await db.client.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', uid)
      .eq('is_read', false);
    this._notifs.forEach(n => n.is_read = true);
    this._updateBell();
    modal.close();
  },
};
