// ── views/member_detail.js — detail člena pre admina/obchodníka ──────────────

const memberDetailView = {

  async open(contactId) {
    const contact = app.state.contacts.find(c => c.id === contactId);
    if (!contact) return;

    modal.open(`👤 ${esc(contact.name||contact.email||'Člen')}`, `
      <div style="color:var(--muted);font-size:13px;padding:30px 0;text-align:center;">⏳ Načítavam...</div>`);

    try {
      // Profil podľa emailu
      const { data: profile } = await db.client
        .from('profiles')
        .select('*, membership_levels(name,slug,color,icon,points_min,points_max,discount_pct,benefits(*))')
        .eq('email', contact.email)
        .single();

      // Dealy člena
      const { data: deals } = await db.client
        .from('deals')
        .select('*, products(name,category)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Body
      const { data: points } = await db.client
        .from('point_transactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Pozvaní
      let recruits = [];
      if (profile?.id) {
        const { data: r } = await db.client
          .from('profiles')
          .select('id,name,email,role,created_at')
          .eq('referred_by', profile.id)
          .order('created_at', { ascending: false });
        recruits = r || [];
      }

      // Komisie obchodníka pre tohto člena
      const { data: comms } = await db.client
        .from('commissions')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(10);

      this._render(modal._el || document.querySelector('#modal-body'), {
        contact, profile: profile || {}, deals: deals || [],
        points: points || [], recruits, comms: comms || [],
      });
    } catch(e) {
      console.error(e);
      const body = document.getElementById('modal-body');
      if (body) body.innerHTML = `<div style="color:var(--red);padding:20px;">Chyba: ${e.message}</div>`;
    }
  },

  _render(_, { contact, profile, deals, points, recruits, comms }) {
    const body = document.getElementById('modal-body');
    if (!body) return;

    const pts    = profile.points || 0;
    const level  = profile.membership_levels;
    const pending = points.filter(p=>p.status==='pending').reduce((a,p)=>a+(p.points||0),0);
    const totalSpent = deals.filter(d=>['paid','in_progress','completed'].includes(d.status))
                            .reduce((a,d)=>a+(d.sale_price_snapshot||0),0);

    // Progress do ďalšej úrovne
    const allLevels  = []; // neznáme — zobrazíme len aktuálnu
    const nextMin    = level?.points_max ? level.points_max + 1 : null;
    const progressPct = level
      ? Math.min(100, Math.round((pts - (level.points_min||0)) / Math.max(1,(level.points_max||pts+1) - (level.points_min||0)) * 100))
      : 0;

    const refLink = `${window.location.origin}${window.location.pathname}?ref=${profile.referral_code||''}`;

    body.innerHTML = `
      <!-- Hlavička -->
      <div style="background:linear-gradient(135deg,#1a180e,var(--card));border:1px solid ${level?.color||'var(--acc-brd)'}44;border-radius:10px;padding:14px 16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:18px;font-weight:700;margin-bottom:4px;">${esc(contact.name||'—')}</div>
            <div style="font-size:12px;color:var(--muted);">${esc(contact.email||'')}</div>
            ${contact.phone?`<div style="font-size:12px;color:var(--muted);">${esc(contact.phone)}</div>`:''}
            <div style="margin-top:6px;">${roleBadge('clen')}</div>
          </div>
          <div style="text-align:right;">
            ${level
              ? `<div style="font-size:16px;font-weight:700;color:${level.color};">${level.icon} ${level.name}</div>
                 <div class="mono" style="font-size:22px;font-weight:700;color:${level.color};">${pts.toLocaleString('sk-SK')} b.</div>`
              : `<div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);">${pts.toLocaleString('sk-SK')} b.</div>`}
            ${pending>0?`<div style="font-size:11px;color:var(--muted);">+${pending} čakajúcich</div>`:''}
          </div>
        </div>
        ${level && level.points_max ? `
          <div style="margin-top:10px;">
            <div style="height:5px;background:var(--brd);border-radius:3px;">
              <div style="height:100%;border-radius:3px;background:${level.color};width:${progressPct}%;"></div>
            </div>
          </div>` : ''}
      </div>

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        <div class="card" style="text-align:center;padding:10px;">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Dealy</div>
          <div class="mono" style="font-size:18px;font-weight:700;">${deals.length}</div>
        </div>
        <div class="card" style="text-align:center;padding:10px;">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Obrat</div>
          <div class="mono" style="font-size:15px;font-weight:700;color:var(--green);">${EUR(totalSpent)}</div>
        </div>
        <div class="card" style="text-align:center;padding:10px;">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Pozvaní</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--purple);">${recruits.length}</div>
        </div>
        <div class="card" style="text-align:center;padding:10px;">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;">Komisie</div>
          <div class="mono" style="font-size:15px;font-weight:700;color:var(--acc);">${EUR(comms.reduce((a,c)=>a+(c.amount||0),0))}</div>
        </div>
      </div>

      <!-- Benefity -->
      ${level?.benefits?.filter(b=>b.is_active).length > 0 ? `
        <div class="card" style="margin-bottom:14px;border-color:${level.color}33;">
          <div style="font-size:11px;font-weight:700;color:${level.color};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
            ${level.icon} Aktívne benefity — ${level.name}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;">
            ${level.benefits.filter(b=>b.is_active).map(b=>`
              <div style="background:${level.color}12;border:1px solid ${level.color}33;border-radius:7px;padding:8px 10px;">
                <div style="font-size:12px;font-weight:700;color:${level.color};">
                  ${b.type==='discount'?`-${b.value}${b.unit}`:b.type==='cashback'?`${b.value}${b.unit} back`:b.type==='priority'?'⚡':'✓'}
                </div>
                <div style="font-size:11px;font-weight:600;margin-top:2px;">${esc(b.title)}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Dealy -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
          Dealy (${deals.length})
        </div>
        ${deals.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne dealy</div>'
          : deals.slice(0,8).map(d => {
              const col = typeof DEAL_COLS !== 'undefined'
                ? DEAL_COLS.find(c=>c.key===d.status)
                : { color:'var(--muted)', label: d.status };
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${esc(d.title||'—')}</div>
                    <div style="font-size:11px;color:var(--muted);">${esc(d.products?.name||'—')} · ${FMT(d.created_at)}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge" style="background:${col?.color||'var(--muted)'}18;color:${col?.color||'var(--muted)'};border:1px solid ${col?.color||'var(--muted)'}44;font-size:10px;">${col?.label||d.status}</span>
                    <div class="mono" style="font-size:12px;color:var(--acc);margin-top:2px;">${EUR(d.sale_price_snapshot||0)}</div>
                  </div>
                </div>`;
            }).join('')}
      </div>

      <!-- Historia bodov -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
          História bodov
        </div>
        ${points.length === 0
          ? '<div style="color:var(--muted);font-size:13px;">Žiadne body</div>'
          : points.map(pt => {
              const sc = {
                pending:  { label:'Čaká',    color:'var(--acc)'   },
                approved: { label:'OK',      color:'var(--green)' },
                reversed: { label:'Vrátené', color:'var(--red)'   },
                cancelled:{ label:'Zrušené', color:'var(--muted)' },
              }[pt.status] || { label:pt.status, color:'var(--muted)' };
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--brd);">
                  <div>
                    <div style="font-size:12px;">${esc(pt.note||pt.source_type||'Body')}</div>
                    <div style="font-size:11px;color:var(--muted);">${FMT(pt.created_at)}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="badge" style="background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}44;font-size:10px;">${sc.label}</span>
                    <span class="mono" style="font-weight:700;color:${sc.color};">+${pt.points||0}</span>
                  </div>
                </div>`;
            }).join('')}
      </div>

      <!-- Referral link -->
      ${profile.referral_code ? `
        <div class="card" style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">🔗 Referral link</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input readonly value="${refLink}"
              style="flex:1;font-size:11px;background:var(--inp);border:1px solid var(--brd);border-radius:6px;padding:5px 8px;color:var(--muted);" />
            <button class="btn-ghost" style="font-size:11px;white-space:nowrap;"
              onclick="navigator.clipboard.writeText('${refLink}').then(()=>this.textContent='✓').catch(()=>{})">
              📋 Kopírovať
            </button>
          </div>
          ${recruits.length > 0 ? `
            <div style="margin-top:8px;font-size:12px;color:var(--muted);">
              Pozvaní: ${recruits.map(r=>`<strong style="color:var(--txt);">${esc(r.name||r.email||'—')}</strong>`).join(', ')}
            </div>` : ''}
        </div>` : ''}

      <div class="form-actions">
        <button class="btn-ghost" onclick="modal.close()">Zavrieť</button>
      </div>`;
  },
};
