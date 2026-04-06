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
      // Ak klikneš na svoju vlastnú rolu, zruš preview
      this.clear();
      return;
    }
    sessionStorage.setItem(this._key, role);
    this._apply();
  },

  clear() {
    sessionStorage.removeItem(this._key);
    this._apply();
  },

  _apply() {
    // Re-render navigácie a obsahu
    app.renderNav();
    app.renderContent();
    app._updatePreviewBanner();
  },
};
