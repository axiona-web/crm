// ── views/clen_dashboard.js ───────────────────────────────────────────────────

const clenDashboardView = {
  _orders:   [],
  _points:   [],
  _referrals:[],
  _profile:  {},
  _levels:   [],
  _benefits: [],

  render() {
    return `
      <div class="view-head"><h2>Môj prehľad</h2></div>
      <div id="clen-wrap">
        <div style="color:var(--muted);font-size:13px;padding:20px 0;">Načítavam...</div>
      </div>`;
  },

  async afterRender() {
    await this._load();
    this._renderContent();
  },

  async _load() {
    const uid = (await db.client.auth.getUser()).data.user?.id;

    const { data: profile } = await db.client
      .from('profiles')
      .select('*, membership_levels(name,slug,color,icon,points_min,points_max,discount_pct)')
      .eq('id', uid).single();

    let contactId = null;
    if (profile?.email) {
      const { data: contact } = await db.client
        .from('contacts').select('id').eq('email', profile.email).single();
      contactId = contact?.id || null;
    }

    const [ordersRes, pointsRes, referralsRes, levelsRes] = await Promise.all([
      contactId
        ? db.client.from('orders').select('*').eq('contact_id', contactId).order('created_at', { ascending:false }).limit(10)
        : Promise.resolve({ data: [] }),
      db.client.from('point_transactions').select('*').eq('user_id', uid).order('created_at', { ascending:false }).limit(20),
      db.client.from('referrals').select('*, profiles!referrals_referred_user_id_fkey(name,email,created_at)').eq('referrer_user_id', uid),
      db.client.from('membership_levels').select('*, benefits(*)').eq('is_active', true).order('sort_order'),
    ]);

    this._orders    = ordersRes.data   || [];
    this._points    = pointsRes.data   || [];
    this._referrals = referralsRes.data|| [];
    this._profile   = profile          || {};
    this._levels    = levelsRes.data   || [];
  },

  _renderContent() {
    const el = document.getElementById('clen-wrap');
    if (!el) return;

    const p         = this._profile;
    const points    = p.points || 0;
    const pendPoints = this._points.filter(pt=>pt.status==='pending').reduce((a,pt)=>a+(pt.points||0),0);
    const level     = p.membership_levels;
    const refLink   = `${window.location.origin}${window.location.pathname}?ref=${p.referral_code||''}`;
    const totalSpent = this._orders.filter(o=>['paid','in_progress','completed'].includes(o.status)).reduce((a,o)=>a+(o.value||0),0);

    // Nájdi aktuálnu a nasledujúcu úroveň
    const currentLevel = level || this._levels[0];
    const nextLevel    = this._levels.find(l => l.points_min > points);
    const toNext       = nextLevel ? nextLevel.points_min - points : 0;
    const progressPct  = nextLevel
      ? Math.min(100, Math.round((points - (currentLevel?.points_min||0)) / (nextLevel.points_min - (currentLevel?.points_min||0)) * 100))
      : 100;

    el.innerHTML = `
      <!-- Uvítanie + Level -->
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#1a180e,var(--card));border-color:${currentLevel?.color||'var(--acc-brd)'}44;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Vitaj späť</div>
            <div style="font-size:20px;font-weight:700;">${esc(p.name||p.email||'')}</div>
            <div style="margin-top:6px;">
              ${currentLevel
                ? `<span style="font-size:14px;font-weight:700;color:${currentLevel.color};">${currentLevel.icon} ${currentLevel.name}</span>`
                : `<span style="font-size:13px;color:var(--muted);">Základný člen</span>`}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Moje body</div>
            <div class="mono" style="font-size:28px;font-weight:700;color:${currentLevel?.color||'var(--acc)'};">${points.toLocaleString('sk-SK')}</div>
            ${pendPoints > 0 ? `<div style="font-size:11px;color:var(--muted);">+${pendPoints} čakajúcich</div>` : ''}
          </div>
        </div>

        ${nextLevel ? `
          <div style="margin-top:14px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px;">
              <span>Postup na ${nextLevel.icon} ${nextLevel.name}</span>
              <span>${toNext.toLocaleString('sk-SK')} bodov chýba</span>
            </div>
            <div style="height:6px;background:var(--brd);border-radius:3px;">
              <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,${currentLevel?.color||'var(--acc)'},${nextLevel.color});width:${progressPct}%;transition:width 0.8s;"></div>
            </div>
          </div>` : `
          <div style="margin-top:12px;font-size:12px;color:${currentLevel?.color||'var(--green)'};">
            🏆 Si na najvyššej úrovni!
          </div>`}
      </div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;">
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

      <!-- Benefity aktuálnej úrovne -->
      ${currentLevel && currentLevel.benefits?.length > 0 ? `
        <div class="card" style="margin-bottom:14px;border-color:${currentLevel.color}33;">
          <div style="font-size:12px;font-weight:700;color:${currentLevel.color};margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
            ${currentLevel.icon} Tvoje benefity — ${currentLevel.name}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
            ${currentLevel.benefits.filter(b=>b.is_active).map(b => `
              <div style="background:${currentLevel.color}12;border:1px solid ${currentLevel.color}33;border-radius:8px;padding:10px 12px;">
                <div style="font-size:13px;font-weight:700;color:${currentLevel.color};">
                  ${b.type==='discount'?`-${b.value}${b.unit}`:b.type==='cashback'?`${b.value}${b.unit} cashback`:b.type==='priority'?'⚡ Priorita':'✓'}
                </div>
                <div style="font-size:12px;font-weight:600;margin-top:3px;">${esc(b.title)}</div>
                ${b.description?`<div style="font-size:11px;color:var(--muted);margin-top:2px;">${esc(b.description)}</div>`:''}
              </div>`).join('')}
          </div>
          ${currentLevel.discount_pct > 0 ? `
            <div style="margin-top:10px;padding:8px 10px;background:${currentLevel.color}18;border-radius:6px;font-size:12px;color:${currentLevel.color};">
              💡 Tvoja zľava <strong>${currentLevel.discount_pct}%</strong> sa automaticky uplatní pri každom nákupe.
            </div>` : ''}
        </div>` : ''}

      <!-- Všetky úrovne -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
          Všetky úrovne
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">
          ${this._levels.map(l => {
            const isActive  = currentLevel?.slug === l.slug;
            const isPast    = (currentLevel?.points_min||0) > l.points_min;
            const isFuture  = !isActive && !isPast;
            return `
              <div style="border:2px solid ${isActive?l.color:'var(--brd)'};border-radius:10px;padding:12px;opacity:${isFuture?'0.6':'1'};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:15px;font-weight:700;color:${l.color};">${l.icon} ${l.name}</span>
                  ${isActive?`<span style="font-size:10px;background:${l.color};color:#000;padding:2px 6px;border-radius:10px;font-weight:700;">AKTÍVNA</span>`:''}
                  ${isPast?`<span style="font-size:10px;color:var(--green);">✓</span>`:''}
                </div>
                <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">
                  ${l.points_min.toLocaleString('sk-SK')}${l.points_max?` – ${l.points_max.toLocaleString('sk-SK')}`:'+'}  bodov
                </div>
                ${l.benefits?.filter(b=>b.is_active).slice(0,3).map(b=>`
                  <div style="font-size:11px;color:${l.color};margin-bottom:2px;">
                    ✓ ${b.type==='discount'?`${b.value}${b.unit} zľava`:b.type==='cashback'?`${b.value}${b.unit} cashback`:esc(b.title)}
                  </div>`).join('')}
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Referral -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
          🔗 Môj referral link
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input readonly value="${refLink}"
            style="flex:1;font-size:11px;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:6px 10px;color:var(--muted);min-width:200px;" />
          <button class="btn-ghost" style="font-size:12px;white-space:nowrap;"
            onclick="navigator.clipboard.writeText('${refLink}').then(()=>this.textContent='✓ Skopírované!').catch(()=>{})">
            📋 Kopírovať
          </button>
        </div>
        ${this._referrals.length > 0 ? `
          <div style="margin-top:10px;font-size:12px;color:var(--muted);">
            Pozvaní: ${this._referrals.map(r=>`<strong style="color:var(--txt);">${esc(r.profiles?.name||r.profiles?.email||'—')}</strong>`).join(', ')}
          </div>` : `
          <div style="margin-top:8px;font-size:12px;color:var(--muted);">Zatiaľ si nikoho nepozval.</div>`}
      </div>

      <!-- História bodov -->
      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;">
          História bodov
        </div>
        ${this._points.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Zatiaľ žiadne body</div>'
          : this._points.map(pt => {
              const sc = {
                pending:  { label:'Čaká',    color:'var(--acc)'   },
                approved: { label:'Schválené',color:'var(--green)' },
                reversed: { label:'Vrátené', color:'var(--red)'   },
                cancelled:{ label:'Zrušené', color:'var(--muted)' },
              }[pt.status] || { label:pt.status, color:'var(--muted)' };
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:13px;">${esc(pt.note||pt.source_type||'Body')}</div>
                    <div style="font-size:11px;color:var(--muted);">${FMT(pt.created_at)}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;font-size:10px;">${sc.label}</span>
                    <span class="mono" style="font-weight:700;color:${sc.color};">+${pt.points||0}</span>
                  </div>
                </div>`;
            }).join('')}
      </div>`;
  },
};
