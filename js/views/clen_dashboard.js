// ── views/clen_dashboard.js ───────────────────────────────────────────────────

const clenDashboardView = {
  _orders:  [],
  _points:  [],
  _loaded:  false,

  render() {
    return `
      <div class="view-head"><h2>Môj prehľad</h2></div>
      <div id="clen-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    this._loaded = false;
    await this._load();
    this._renderContent();
  },

  async _load() {
    const uid = (await db.client.auth.getUser()).data.user?.id;

    // Nájdi contact_id tohto usera cez email
    const { data: profile } = await db.client
      .from('profiles').select('email, referral_code, points, level, referred_by').eq('id', uid).single();

    let contactId = null;
    if (profile?.email) {
      const { data: contact } = await db.client
        .from('contacts').select('id').eq('email', profile.email).single();
      contactId = contact?.id || null;
    }

    const [{ data: orders }, { data: points }, { data: referrals }] = await Promise.all([
      contactId
        ? db.client.from('orders').select('*, products(name,category,subcategory)').eq('contact_id', contactId).order('created_at', { ascending:false }).limit(10)
        : Promise.resolve({ data: [] }),
      db.client.from('point_transactions').select('*').eq('user_id', uid).order('created_at', { ascending:false }).limit(20),
      db.client.from('referrals').select('*, profiles!referrals_referred_user_id_fkey(name,email,created_at)').eq('referrer_user_id', uid),
    ]);

    this._orders    = orders    || [];
    this._points    = points    || [];
    this._referrals = referrals || [];
    this._profile   = profile   || {};
    this._loaded    = true;
  },

  _renderContent() {
    const el = document.getElementById('clen-wrap');
    if (!el) return;

    const p         = this._profile || auth.profile || {};
    const refLink   = `${window.location.origin}${window.location.pathname}?ref=${p.referral_code||''}`;
    const level     = p.level || 'Základný';
    const points    = p.points || 0;
    const totalSpent = this._orders.filter(o=>o.status==='completed').reduce((a,o)=>a+(o.value||0),0);
    const pendPoints = this._points.filter(pt=>pt.status==='pending').reduce((a,pt)=>a+pt.points,0);

    const levelColors = { 'Základný':'var(--muted)', 'Strieborný':'#94a3b8', 'Zlatý':'var(--acc)', 'Platinový':'#a78bfa' };
    const lColor = levelColors[level] || 'var(--muted)';

    el.innerHTML = `
      <!-- Uvítanie -->
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Vitaj späť</div>
            <div style="font-size:20px;font-weight:700;">${esc(p.name||p.email||'')}</div>
            ${roleBadge('clen')}
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Úroveň</div>
            <div style="font-size:18px;font-weight:700;color:${lColor};">${esc(level)}</div>
          </div>
        </div>
      </div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Moje body</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">${points}</div>
          ${pendPoints > 0 ? `<div style="font-size:11px;color:var(--muted);">+${pendPoints} čakajúcich</div>` : ''}
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Objednávky</div>
          <div class="mono" style="font-size:22px;font-weight:700;">${this._orders.length}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Celkom minul</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);">${EUR(totalSpent)}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pozvaní</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--purple);">${this._referrals.length}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <!-- Referral -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">Tvoj referral</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);letter-spacing:0.1em;margin-bottom:8px;">${esc(p.referral_code||'—')}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px;word-break:break-all;">${esc(refLink)}</div>
          <button class="btn-primary" style="width:100%;font-size:13px;" onclick="clenDashboardView._copy('${esc(refLink)}',this)">
            📋 Kopírovať link
          </button>
          ${p.referred_by_name || p.referred_by ? `
            <div style="margin-top:10px;font-size:12px;color:var(--muted);">
              Registrovaný cez: <strong>${esc(p.referred_by_name||'—')}</strong>
            </div>` : ''}
        </div>

        <!-- Pozvaní členovia -->
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
            Moji pozvaní (${this._referrals.length})
          </div>
          ${this._referrals.length === 0
            ? '<div style="color:var(--muted);font-size:13px;">Zatiaľ nikto. Zdieľaj referral link!</div>'
            : this._referrals.slice(0,5).map(r => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--brd);">
                <div style="font-size:13px;font-weight:600;">${esc(r.profiles?.name||r.profiles?.email||'—')}</div>
                <div style="font-size:11px;color:var(--muted);">${FMT(r.registered_at)}</div>
              </div>`).join('')}
        </div>
      </div>

      <!-- Objednávky -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
          Moje objednávky
        </div>
        ${this._orders.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Zatiaľ žiadne objednávky</div>'
          : this._orders.map(o => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd);">
              <div>
                <div style="font-size:13px;font-weight:600;">${esc(o.products?.name||'—')}</div>
                <div style="font-size:11px;color:var(--muted);">${esc(o.products?.category||'')} ${FMT(o.created_at)}</div>
              </div>
              <div style="text-align:right;">
                ${orderBadge(o.status)}
                <div class="mono" style="font-size:13px;color:var(--acc);margin-top:3px;">${EUR(o.value)}</div>
              </div>
            </div>`).join('')}
      </div>

      <!-- História bodov -->
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
          História bodov
        </div>
        ${this._points.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadna história bodov</div>'
          : this._points.map(pt => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
              <div>
                <div style="font-size:12px;">${esc(pt.note||pt.source_type||'—')}</div>
                <div style="font-size:11px;color:var(--muted);">${FMT(pt.created_at)} · ${esc(pt.status)}</div>
              </div>
              <div class="mono" style="font-size:14px;font-weight:700;color:${pt.points>=0?'var(--green)':'var(--red)'};">
                ${pt.points>=0?'+':''}${pt.points}
              </div>
            </div>`).join('')}
      </div>`;
  },

  _copy(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const o = btn.textContent; btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = o; }, 2000);
    }).catch(() => { prompt('Link:', link); });
  },
};

