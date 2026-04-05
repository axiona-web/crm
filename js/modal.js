// ── modal.js — reusable modal ─────────────────────────────────────────────────

const modal = {
  overlay: null,
  box:     null,
  title:   null,
  body:    null,

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.box     = document.getElementById('modal-box');
    this.title   = document.getElementById('modal-title');
    this.body    = document.getElementById('modal-body');

    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });
  },

  open(title, html) {
    this.title.textContent = title;
    this.body.innerHTML    = html;
    this.overlay.classList.add('open');
    // Focus first input
    setTimeout(() => {
      const first = this.body.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 50);
  },

  close() {
    this.overlay.classList.remove('open');
  },
};
