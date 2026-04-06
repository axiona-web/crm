// ── js/views/clen_dashboard.js — dashboard pre člena ─────────────────────────

const clenDashboardView = {
  render() {
    const p       = auth.profile || {};
    const refLink = `${window.location.origin}${window.location.pathname}?ref=${p.referral_code || ''}`;
    const level   = p.level || 'Základný';
    const points  = p.points || 0;
    const levelColors = {
      'Základný': 'var(--muted)',
      'Strieborný': '#94a3b8',
      'Zlatý': 'var(--acc)',
      'Platinový': '#a78bfa',
    };
    const lColor = levelColors[level] || 'var(--muted)';

    return `
      <div class="view-head"><h2>Môj prehľad</h2></div>

      <!-- Uvítanie -->
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#1a180e,var(--card));border-color:var(--acc-brd);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Vitaj späť</div>
            <div style="font-size:20px;font-weight:700;">${esc(p.name || p.email || '')}</div>
            <div style="margin-top:6px;">${roleBadge('clen')}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Úroveň</div>
            <div style="font-size:18px;font-weight:700;color:${lColor};">${esc(level)}</div>
          </div>
        </div>
      </div>

      <!-- Body a referral -->
      <div class="stat-grid" style="margin-bottom:14px;">
        <div class="card stat-card">
          <div class="stat-label">Moje body</div>
          <div class="stat-value mono" style="color:var(--acc);">${points}</div>
          <div class="stat-sub">Aktuálny stav</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Úroveň</div>
          <div class="stat-value" style="font-size:16px;color:${lColor};">${esc(level)}</div>
          <div class="stat-sub">Členský stupeň</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Registrovaný cez</div>
          <div style="font-size:13px;font-weight:600;margin-top:6px;color:var(--txt);">
            ${p.registered_by_name ? esc(p.registered_by_name) : '— priama registrácia'}
          </div>
        </div>
      </div>

      <!-- Referral kód -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Tvoj referral link</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 14px;flex:1;min-width:0;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.06em;">Kód</div>
            <div class="mono" style="font-size:18px;font-weight:700;color:var(--acc);">${esc(p.referral_code || '—')}</div>
          </div>
          <div style="flex:2;min-width:200px;background:var(--inp);border:1px solid var(--brd);border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.06em;">Link</div>
            <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(refLink)}</div>
          </div>
          <button class="btn-primary" onclick="clenDashboardView._copyLink('${esc(refLink)}', this)" style="white-space:nowrap;">
            📋 Kopírovať link
          </button>
        </div>
      </div>

      <!-- Benefity placeholder -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Moje benefity</div>
        <div style="text-align:center;padding:24px 0;color:var(--muted);">
          <div style="font-size:28px;margin-bottom:8px;">🎁</div>
          <div style="font-size:13px;">Benefity budú dostupné čoskoro</div>
          <div style="font-size:12px;margin-top:4px;">Zbieraj body a odomkni výhody</div>
        </div>
      </div>

      <!-- Produkty placeholder -->
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em;">Moje produkty / nákupy</div>
        <div style="text-align:center;padding:24px 0;color:var(--muted);">
          <div style="font-size:28px;margin-bottom:8px;">📦</div>
          <div style="font-size:13px;">Zatiaľ žiadne produkty</div>
        </div>
      </div>`;
  },

  _copyLink(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Skopírované';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => { prompt('Skopíruj link:', link); });
  },
};
