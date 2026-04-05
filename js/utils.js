// ── utils.js — shared helpers ─────────────────────────────────────────────────

const STAGES = ['Kontakt', 'Záujem', 'Ponuka', 'Rokovanie', 'Uzavreté', 'Stratené'];

const STAGE_COLORS = {
  Kontakt:    '#818cf8',
  Záujem:     '#38bdf8',
  Ponuka:     '#fb923c',
  Rokovanie:  '#c084fc',
  Uzavreté:   '#4ade80',
  Stratené:   '#f87171',
};

const CONTACT_TYPES = ['Klient', 'Obchodník', 'Partner'];

const TYPE_COLORS = {
  Klient:    'var(--blue)',
  Obchodník: 'var(--acc)',
  Partner:   'var(--purple)',
};

// Unique ID
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Format currency
const EUR = n =>
  new Intl.NumberFormat('sk-SK', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n || 0);

// Format date
const FMT = d => (d ? new Date(d).toLocaleDateString('sk-SK') : '—');

// Escape HTML
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Render a colored badge
function badge(label, color) {
  return `<span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44;">${esc(label)}</span>`;
}

// Download a text file
function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Read uploaded file as text
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
