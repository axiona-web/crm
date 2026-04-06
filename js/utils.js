// ── js/utils.js ───────────────────────────────────────────────────────────────

const STAGES = ['Kontakt', 'Záujem', 'Ponuka', 'Rokovanie', 'Uzavreté', 'Stratené'];

const STAGE_COLORS = {
  Kontakt:   '#818cf8',
  Záujem:    '#38bdf8',
  Ponuka:    '#fb923c',
  Rokovanie: '#c084fc',
  Uzavreté:  '#4ade80',
  Stratené:  '#f87171',
};

const CONTACT_TYPES = ['Člen', 'Firma', 'Iné'];

const TYPE_COLORS = {
  Člen:  'var(--blue)',
  Firma: 'var(--acc)',
  Iné:   'var(--muted)',
};

// Role definitions
const ROLES = {
  admin:      { label: 'Admin',      icon: '⭐', color: 'var(--acc)'    },
  obchodnik:  { label: 'Obchodník',  icon: '💼', color: 'var(--blue)'   },
  partner:    { label: 'Partner',    icon: '🤝', color: 'var(--purple)' },
  clen:       { label: 'Člen',       icon: '👤', color: 'var(--green)'  },
};

// Nav items per role
const NAV_BY_ROLE = {
  admin: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Členovia'    },
    { id: 'pipeline',    icon: '📊', label: 'Pipeline'    },
    { id: 'commissions', icon: '💰', label: 'Provízie'    },
    { id: 'partners',    icon: '🤝', label: 'Partneri'    },
    { id: 'ai',          icon: '✦', label: 'AI Asistent' },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  obchodnik: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Moji členovia' },
    { id: 'pipeline',    icon: '📊', label: 'Pipeline'    },
    { id: 'commissions', icon: '💰', label: 'Provízie'    },
    { id: 'ai',          icon: '✦', label: 'AI Asistent' },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  partner: [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard'   },
    { id: 'members',     icon: '👥', label: 'Moji klienti' },
    { id: 'profile',     icon: '👤', label: 'Môj profil'  },
  ],
  clen: [
    { id: 'clen_dashboard', icon: '⊞', label: 'Prehľad'     },
    { id: 'profile',        icon: '👤', label: 'Môj profil'  },
  ],
};

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

function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
