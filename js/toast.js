// ── js/toast.js — Toast notifikácie ──────────────────────────────────────────

const toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      this._container.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        display:flex;flex-direction:column;gap:8px;pointer-events:none;
      `;
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(msg, type = 'info', duration = 4000) {
    const colors = {
      success: { bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.4)', color:'#10b981', icon:'✓' },
      error:   { bg:'rgba(242,85,85,0.15)',  border:'rgba(242,85,85,0.4)',  color:'#f25555', icon:'✕' },
      warning: { bg:'rgba(212,148,58,0.15)', border:'rgba(212,148,58,0.4)', color:'#d4943a', icon:'⚠' },
      info:    { bg:'rgba(91,164,245,0.15)', border:'rgba(91,164,245,0.4)', color:'#5ba4f5', icon:'ℹ' },
    };
    const c = colors[type] || colors.info;
    const el = document.createElement('div');
    el.style.cssText = `
      background:${c.bg};border:1px solid ${c.border};color:${c.color};
      border-radius:8px;padding:10px 14px;font-size:13px;font-weight:500;
      display:flex;align-items:center;gap:8px;pointer-events:auto;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:320px;
      animation:toastIn 0.2s ease;
    `;
    el.innerHTML = `<span style="font-size:15px;">${c.icon}</span><span>${esc ? esc(msg) : msg}</span>`;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      @keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateX(20px); } }
    `;
    if (!document.getElementById('toast-style')) {
      style.id = 'toast-style';
      document.head.appendChild(style);
    }

    this._getContainer().appendChild(el);

    setTimeout(() => {
      el.style.animation = 'toastOut 0.2s ease forwards';
      setTimeout(() => el.remove(), 200);
    }, duration);
  },

  success: (msg) => toast.show(msg, 'success'),
  error:   (msg) => toast.show(msg, 'error'),
  warning: (msg) => toast.show(msg, 'warning'),
  info:    (msg) => toast.show(msg, 'info'),
};
