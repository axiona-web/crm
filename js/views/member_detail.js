// ── views/member_detail.js — detail člena pre admina/obchodníka ──────────────

const memberDetailView = {
  _memberId: null,
  _profile:  null,
  _orders:   [],
  _deals:    [],
  _recruits: [],
  _points:   [],

  // Otvorí detail ako modal
  async open(contactId) {
    // Nájdi profil podľa emailu kontaktu
    const contact = app.state.contacts.find(c => c.id === contactId);
    if (!contact) return;

    modal.open(`👤 ${esc(contact.name)}`, `
      <div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center;">Načítavam...</div>`);

    try {
      // Načítaj profil člena
      const { data: profile } = await db.client
        .from('profiles')
        .select('*')
        .eq('email', contact.email)
        .single();

      // Načítaj objednávky člena
      const { data: orders } = await db.client
        .from('orders')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Načítaj dealy člena
      const { data: deals } = await db.client
        .from('deals')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Načítaj koho člen pozval (cez referred_by)
      let recruits = [];
      if (profile) {
        const { data: r } = await db.client
          .from('profiles')
          .select('id, name, email, role, created_at, referral_code')
          .eq('referred_by', profile.id)
          .order('created_at', { ascending: false });
        recruits = r || [];
      }

      // Načítaj body
      const { data: points } = await db.client
        .from('points')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20);

      this._render(contact, profile, orders || [], deals || [], recruits, points || []);
    } catch(e) {
      document.getElementById('modal-body').innerHTML =
        `<div style="color:var(--red);font-size:13px;">Chyba: ${esc(e.message)}</div>`;
    }
  },

  _render(contact, profile, orders, deals, recruits, points) {
    const p         = profile || {};
    const wonDeals  = deals.filter(d => d.status === 'won');
    const totalVal  = wonDeals.reduce((a, d) => a + (d.value || 0), 0);
    const orderVal  = orders.filter(o => o.status === 'completed').reduce((a, o) => a + (o.value || 0), 0);
    const level     = p.level || 'Základný';
    const points_n  = p.points || 0;
    const refLink   = `${window.location.origin}${window.location.pathname}?ref=${p.referral_code || ''}`;

    const levelColors = { 'Základný':'var(--muted)', 'Strieborný':'#94a3b8', 'Zlatý':'var(--acc)', 'Platinový':'#a78bfa' };
    const lColor = levelColors[level] || 'var(--muted)';

    document.getElementById('modal-title').textContent = `👤 ${contact.name}`;
    document.getElementById('modal-body').innerHTML = `
      <!-- KPI riadok -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Body</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${points_n}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Úroveň</div>
          <div style="font-size:14px;font-weight:700;color:${lColor};">${esc(level)}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Objednávky</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--green);">${EUR(orderVal)}</div>
        </div>
        <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pozvaní</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--purple);">${recruits.length}</div>
        </div>
      </div>

      <!-- Kontaktné info -->
      <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
          ${contact.phone ? `<span>📞 ${esc(contact.phone)}</span>` : ''}
          ${contact.email ? `<span>✉️ ${esc(contact.email)}</span>` : ''}
          ${p.city        ? `<span>📍 ${esc(p.city)}</span>`        : ''}
          ${p.position    ? `<span>💼 ${esc(p.position)}</span>`    : ''}
          <span>📅 Registrovaný: ${FMT(p.created_at)}</span>
        </div>
        ${p.referral_code ? `
          <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:11px;color:var(--muted);">Referral kód:</span>
            <span class="mono" style="font-size:13px;font-weight:700;color:var(--acc);">${esc(p.referral_code)}</span>
            <button class="btn-ghost" style="font-size:11px;padding:3px 8px;"
              onclick="memberDetailView._copy('${esc(refLink)}',this)">📋 Kopírovať link</button>
          </div>` : ''}
      </div>

      <!-- Objednávky -->
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
          Objednávky (${orders.length})
        </div>
        ${orders.length === 0
          ? `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Žiadne objednávky</div>`
          : orders.slice(0,5).map(o => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${orderBadge(o.status)}
                <span style="font-size:12px;color:var(--muted);">${FMT(o.created_at)}</span>
              </div>
              <span class="mono" style="font-size:13px;font-weight:600;color:var(--green);">${EUR(o.value)}</span>
            </div>`).join('')}
        ${orders.length > 5 ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">+ ${orders.length-5} ďalších</div>` : ''}
      </div>

      <!-- Leady -->
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
          Leady / Obchody (${deals.length})
        </div>
        ${deals.length === 0
          ? `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Žiadne leady</div>`
          : deals.slice(0,5).map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd);">
              <div style="display:flex;align-items:center;gap:8px;">
                ${dealBadge(d.status)}
                <span style="font-size:13px;">${esc(d.title)}</span>
              </div>
              <span class="mono" style="font-size:13px;color:var(--acc);">${EUR(d.value)}</span>
            </div>`).join('')}
        ${deals.length > 5 ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">+ ${deals.length-5} ďalších</div>` : ''}
      </div>

      <!-- Pozvaní členovia -->
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
          Pozvaní členovia (${recruits.length})
        </div>
        ${recruits.length === 0
          ? `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Zatiaľ nikto</div>`
          : recruits.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd);">
              <div>
                <div style="font-size:13px;font-weight:600;">${esc(r.name || r.email)}</div>
                <div style="font-size:11px;color:var(--muted);">${esc(r.email)} · ${FMT(r.created_at)}</div>
              </div>
              ${roleBadge(r.role)}
            </div>`).join('')}
      </div>

      <!-- Body história -->
      ${points.length > 0 ? `
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
            História bodov
          </div>
          ${points.map(pt => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
              <div>
                <div style="font-size:12px;">${esc(pt.reason || 'Bod')}</div>
                <div style="font-size:11px;color:var(--muted);">${FMT(pt.created_at)}</div>
              </div>
              <span class="mono" style="font-size:14px;font-weight:700;color:${pt.amount>=0?'var(--green)':'var(--red)'};">
                ${pt.amount >= 0 ? '+' : ''}${pt.amount}
              </span>
            </div>`).join('')}
        </div>` : ''}

      <!-- Admin akcie -->
      <div style="display:flex;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--brd);flex-wrap:wrap;">
        <button class="btn-ghost" style="font-size:12px;"
          onclick="memberDetailView._addPoints('${contact.id}','${p.id||''}')">
          + Pridať body
        </button>
        <button class="btn-ghost" style="font-size:12px;"
          onclick="app.setView('members');modal.close();">
          Upraviť profil
        </button>
      </div>`;
  },

  async _addPoints(contactId, profileId) {
    const amount = prompt('Koľko bodov pridať? (záporné číslo = odobrať)');
    if (!amount || isNaN(Number(amount))) return;
    const reason = prompt('Dôvod:') || 'Manuálne pridané adminom';

    try {
      // Pridaj do points tabuľky
      await db.client.from('points').insert({
        user_id:    profileId || null,
        contact_id: contactId,
        amount:     Number(amount),
        status:     'approved',
        reason,
      });

      // Aktualizuj súčet bodov v profiles
      if (profileId) {
        const { data: prof } = await db.client.from('profiles').select('points').eq('id', profileId).single();
        const newTotal = (prof?.points || 0) + Number(amount);
        await db.client.from('profiles').update({ points: newTotal }).eq('id', profileId);
      }

      alert(`✓ Body pridané: ${amount > 0 ? '+' : ''}${amount}`);
      // Znovu otvor detail
      const contact = app.state.contacts.find(c => c.id === contactId);
      if (contact) this.open(contactId);
    } catch(e) {
      alert('Chyba: ' + e.message);
    }
  },

  _copy(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const o = btn.textContent; btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = o; }, 2000);
    }).catch(() => { prompt('Link:', link); });
  },
};
