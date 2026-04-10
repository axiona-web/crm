// ── js/preview_role.js — "Zobraziť ako" pre admina ───────────────────────────
// Ukladá sa len do sessionStorage — zmizne po zatvorení taba
// V DB sa nič nemení, ostatní užívatelia nevidia žiadnu zmenu

const previewRole = {
  _key: 'axiona_preview_role',

  current() {
    return sessionStorage.getItem(this._key) || null;
  },

  // Efektívna rola — ak je preview aktívny, vráti preview rolu
  effective() {
    return this.current() || auth.profile?.role || 'clen';
  },

  set(role) {
    if (role === auth.profile?.role) {
      this.clear();
      return;
    }
    sessionStorage.setItem(this._key, role);
    // Presmeruj na správny dashboard pre rolu
    const dashboards = {
      clen:      'clen_dashboard',
      partner:   'partner_dashboard',
      obchodnik: 'obchodnik_dashboard',
      admin:     'dashboard',
    };
    if (dashboards[role]) app.state.view = dashboards[role];
    this._apply();
  },

  clear() {
    sessionStorage.removeItem(this._key);
    // Vráť na admin dashboard
    app.state.view = 'dashboard';
    this._apply();
  },

  _apply() {
    app.renderNav();
    app._updatePreviewBanner();
    // Načítaj dáta a vyrenderuj
    app._loadData().then(() => app.renderContent());
  },
};
