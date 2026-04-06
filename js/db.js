// ── js/db.js — Supabase dátová vrstva ────────────────────────────────────────

const SUPABASE_URL = 'https://cdusjrckwiqsfbrvczgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXNqcmNrd2lxc2ZicnZjemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDg2MTcsImV4cCI6MjA5MDk4NDYxN30.WMFMqeJB-MT9T-1dBz2lzvFDI0yfZFKNCXUZ5QBliNs';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactDisplayName(r) {
  if (r.entity_type === 'pravnicka') return r.company_name || r.name || '—';
  const parts = [r.first_name, r.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : (r.name || '—');
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function contactFromRow(r) {
  return {
    id:          r.id,
    name:        contactDisplayName(r),
    entityType:  r.entity_type   || 'fyzicka',
    firstName:   r.first_name    || '',
    lastName:    r.last_name     || '',
    companyName: r.company_name  || '',
    ico:         r.ico           || '',
    company:     r.company       || '',
    phone:       r.phone         || '',
    email:       r.email         || '',
    type:        r.type          || 'Klient',
    notes:       r.notes         || '',
    ownerId:     r.owner_id,
    createdAt:   r.created_at,
  };
}

function contactToRow(c, ownerId) {
  const displayName = c.entityType === 'pravnicka'
    ? (c.companyName || '')
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
  return {
    name:         displayName,
    entity_type:  c.entityType  || 'fyzicka',
    first_name:   c.firstName   || null,
    last_name:    c.lastName    || null,
    company_name: c.companyName || null,
    ico:          c.ico         || null,
    company:      c.company     || null,
    phone:        c.phone       || null,
    email:        c.email       || null,
    type:         c.type,
    notes:        c.notes       || null,
    owner_id:     ownerId,
  };
}

function dealFromRow(r) {
  return {
    id:            r.id,
    name:          r.name,
    contactId:     r.contact_id,
    value:         r.value          || 0,
    stage:         r.stage,
    probability:   r.probability    || 0,
    expectedClose: r.expected_close || '',
    notes:         r.notes          || '',
    ownerId:       r.owner_id,
    createdAt:     r.created_at,
  };
}

function dealToRow(d, ownerId) {
  return {
    name:           d.name,
    contact_id:     d.contactId     || null,
    value:          Number(d.value)       || 0,
    stage:          d.stage,
    probability:    Number(d.probability) || 0,
    expected_close: d.expectedClose || null,
    notes:          d.notes         || null,
    owner_id:       ownerId,
  };
}

function commFromRow(r) {
  return {
    id:        r.id,
    dealId:    r.deal_id,
    contactId: r.contact_id,
    amount:    r.amount  || 0,
    rate:      r.rate    || 0,
    status:    r.status,
    date:      r.date    || '',
    notes:     r.notes   || '',
    ownerId:   r.owner_id,
    createdAt: r.created_at,
  };
}

function commToRow(c, ownerId) {
  return {
    deal_id:    c.dealId    || null,
    contact_id: c.contactId || null,
    amount:     Number(c.amount) || 0,
    rate:       Number(c.rate)   || 0,
    status:     c.status,
    date:       c.date      || null,
    notes:      c.notes     || null,
    owner_id:   ownerId,
  };
}

// ── DB API ────────────────────────────────────────────────────────────────────

const db = {

  // ── Contacts ────────────────────────────────
  async getContacts() {
    const { data, error } = await _sb.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(contactFromRow);
  },
  async createContact(c) {
    const uid = (await _sb.auth.getUser()).data.user.id;
    const { data, error } = await _sb.from('contacts').insert(contactToRow(c, uid)).select().single();
    if (error) throw error;
    return contactFromRow(data);
  },
  async updateContact(id, c) {
    const { data, error } = await _sb.from('contacts').update(contactToRow(c, c.ownerId)).eq('id', id).select().single();
    if (error) throw error;
    return contactFromRow(data);
  },
  async deleteContact(id) {
    const { error } = await _sb.from('contacts').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Deals ───────────────────────────────────
  async getDeals() {
    const { data, error } = await _sb.from('deals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(dealFromRow);
  },
  async createDeal(d) {
    const uid = (await _sb.auth.getUser()).data.user.id;
    const { data, error } = await _sb.from('deals').insert(dealToRow(d, uid)).select().single();
    if (error) throw error;
    return dealFromRow(data);
  },
  async updateDeal(id, d) {
    const { data, error } = await _sb.from('deals').update(dealToRow(d, d.ownerId)).eq('id', id).select().single();
    if (error) throw error;
    return dealFromRow(data);
  },
  async deleteDeal(id) {
    const { error } = await _sb.from('deals').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Commissions ─────────────────────────────
  async getCommissions() {
    const { data, error } = await _sb.from('commissions').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(commFromRow);
  },
  async createCommission(c) {
    const uid = (await _sb.auth.getUser()).data.user.id;
    const { data, error } = await _sb.from('commissions').insert(commToRow(c, uid)).select().single();
    if (error) throw error;
    return commFromRow(data);
  },
  async updateCommission(id, c) {
    const { data, error } = await _sb.from('commissions').update(commToRow(c, c.ownerId)).eq('id', id).select().single();
    if (error) throw error;
    return commFromRow(data);
  },
  async deleteCommission(id) {
    const { error } = await _sb.from('commissions').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Auth / Profile ──────────────────────────
  async getProfile() {
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) return null;
    const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
    return data;
  },
  async getPartners() {
    const { data } = await _sb.from('profiles').select('*').order('created_at');
    return data || [];
  },
  async setRole(userId, role) {
    const { error } = await _sb.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  // ── Referral ─────────────────────────────────
  async setReferredBy(userId, refCode) {
    try {
      const { data } = await _sb.from('profiles').select('id').eq('referral_code', refCode).single();
      if (data) {
        await _sb.from('profiles').update({ referred_by: data.id }).eq('id', userId);
      }
    } catch(e) {
      console.warn('Referral code not found:', refCode);
    }
  },

  client: _sb,

  // ── Export ───────────────────────────────────
  exportAll(contacts, deals, commissions) {
    const json = JSON.stringify({ contacts, deals, commissions, exportedAt: new Date().toISOString(), version: '2.0' }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `axiona-crm-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  },
};

  // ── Invite user (admin funkcia) ──────────────────────────────────────────
  async inviteUser(email, name, role) {
    // Použijeme Supabase magic link cez signInWithOtp ako pozvánku
    const { error } = await _sb.auth.signInWithOtp({
      email,
      options: {
        data: { name },
        shouldCreateUser: true,
      }
    });
    if (error) throw error;
    // Nastav rolu po registrácii (cez trigger sa vytvorí profil, rolu nastavíme manuálne)
    // Uložíme pending rolu do localStorage aby sme ju mohli nastaviť
    // V praxi admin nastaví rolu manuálne cez select v zozname partnerov
  },

  async inviteMember(email, contactData) {
    const { error } = await _sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    return { error: null };
  },
