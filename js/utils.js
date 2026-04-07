// ── js/utils.js ───────────────────────────────────────────────────────────────

// ── Deal stavy ────────────────────────────────────────────────────────────────
const DEAL_STATUSES = ['new','assigned','contacted','qualified','offer_sent','won','lost','cancelled'];

const DEAL_STATUS_LABELS = {
  new:        'Nový',
  assigned:   'Priradený',
  contacted:  'Kontaktovaný',
  qualified:  'Kvalifikovaný',
  offer_sent: 'Ponuka odoslaná',
  won:        'Vyhraný',
  lost:       'Stratený',
  cancelled:  'Zrušený',
};

const DEAL_STATUS_COLORS = {
  new:        '#818cf8',
  assigned:   '#38bdf8',
  contacted:  '#fb923c',
  qualified:  '#c084fc',
  offer_sent: '#f0b85a',
  won:        '#4ade80',
  lost:       '#f87171',
  cancelled:  '#66668a',
};

// Aktívne stavy (nie terminálne)
const DEAL_ACTIVE = ['new','assigned','contacted','qualified','offer_sent'];

// ── Order stavy ───────────────────────────────────────────────────────────────
const ORDER_STATUS_LABELS = {
  pending_payment: 'Čaká na platbu',
  paid:            'Zaplatená',
  in_progress:     'V realizácii',
  completed:       'Dokončená',
  cancelled:       'Zrušená',
};

const ORDER_STATUS_COLORS = {
  pending_payment: '#fb923c',
  paid:            '#38bdf8',
  in_progress:     '#c084fc',
  completed:       '#4ade80',
  cancelled:       '#f87171',
};

// ── Commission stavy ──────────────────────────────────────────────────────────
const COMM_STATUS_LABELS = {
  pending:   'Čakajúca',
  approved:  'Schválená',
  paid:      'Vyplatená',
  cancelled: 'Zrušená',
};

const COMM_STATUS_COLORS = {
  pending:   '#fb923c',
  approved:  '#38bdf8',
  paid:      '#4ade80',
  cancelled: '#f87171',
};

// ── Points stavy ──────────────────────────────────────────────────────────────
const POINTS_STATUS_LABELS = {
  pending:   'Čakajúce',
  approved:  'Schválené',
  reversed:  'Stornované',
  cancelled: 'Zrušené',
  expired:   'Expirované',
};

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = {
  admin:     { label: 'Admin',     icon: '⭐', color: 'var(--acc)'    },
  obchodnik: { label: 'Obchodník', icon: '💼', color: 'var(--blue)'   },
  partner:   { label: 'Partner',   icon: '🤝', color: 'var(--purple)' },
  clen:      { label: 'Člen',      icon: '👤', color: 'var(--green)'  },
};

const CONTACT_TYPES = ['Člen', 'Firma', 'Iné'];

const TYPE_COLORS = {
  Člen:  'var(--green)',
  Firma: 'var(--acc)',
  Iné:   'var(--muted)',
};

// ── Nav by role ───────────────────────────────────────────────────────────────
const NAV_BY_ROLE = {
  admin: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Členovia'    },
    { id: 'pipeline',    icon: '📊', label: 'Pipeline'    },
    { id: 'orders',      icon: '📦', label: 'Objednávky'  },
    { id: 'commissions', icon: '💰', label: 'Provízie'    },
    { id: 'partners',    icon: '🤝', label: 'Tím'         },
    { id: 'products',    icon: '🛍️', label: 'Produkty'    },
    { id: 'ai',          icon: '✦', label: 'AI Asistent' },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  obchodnik: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Moji členovia'},
    { id: 'pipeline',    icon: '📊', label: 'Pipeline'    },
    { id: 'orders',      icon: '📦', label: 'Objednávky'  },
    { id: 'commissions', icon: '💰', label: 'Provízie'    },
    { id: 'ai',          icon: '✦', label: 'AI Asistent' },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  partner: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Moji klienti'},
    { id: 'orders',      icon: '📦', label: 'Objednávky'  },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  clen: [
    { id: 'clen_dashboard', icon: '⊞', label: 'Prehľad'    },
    { id: 'profile',        icon: '👤', label: 'Môj profil' },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const EUR = n => new Intl.NumberFormat('sk-SK', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const FMT = d => d ? new Date(d).toLocaleDateString('sk-SK') : '—';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(label, color) {
  return `<span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44;">${esc(label)}</span>`;
}

function roleBadge(role) {
  const r = ROLES[role] || { label: role, icon: '?', color: 'var(--muted)' };
  return badge(`${r.icon} ${r.label}`, r.color);
}

function statusBadge(status, labels, colors) {
  const label = labels[status] || status;
  const color = colors[status] || 'var(--muted)';
  return badge(label, color);
}

function dealBadge(status)  { return statusBadge(status, DEAL_STATUS_LABELS,  DEAL_STATUS_COLORS);  }
function orderBadge(status) { return statusBadge(status, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS); }
function commBadge(status)  { return statusBadge(status, COMM_STATUS_LABELS,  COMM_STATUS_COLORS);  }

function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
