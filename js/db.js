// ── js/db.js ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://cdusjrckwiqsfbrvczgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXNqcmNrd2lxc2ZicnZjemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDg2MTcsImV4cCI6MjA5MDk4NDYxN30.WMFMqeJB-MT9T-1dBz2lzvFDI0yfZFKNCXUZ5QBliNs';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Mappers ───────────────────────────────────────────────────────────────────

function contactDisplayName(r) {
  if (r.entity_type === 'pravnicka') return r.company_name || r.name || '—';
  const parts = [r.first_name, r.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : (r.name || '—');
}

function contactFromRow(r) {
  return {
    id: r.id, name: contactDisplayName(r),
    entityType: r.entity_type || 'fyzicka',
    firstName: r.first_name || '', lastName: r.last_name || '',
    companyName: r.company_name || '', ico: r.ico || '',
    phone: r.phone || '', email: r.email || '',
    type: r.type || 'Člen', notes: r.notes || '',
    ownerId: r.owner_id, memberId: r.member_id, createdAt: r.created_at,
  };
}

function contactToRow(c, ownerId) {
  const name = c.entityType === 'pravnicka'
    ? (c.companyName || '')
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
  return {
    name, entity_type: c.entityType || 'fyzicka',
    first_name: c.firstName || null, last_name: c.lastName || null,
    company_name: c.companyName || null, ico: c.ico || null,
    phone: c.phone || null, email: c.email || null,
    type: c.type || 'Člen', notes: c.notes || null, owner_id: ownerId,
  };
}

function dealFromRow(r) {
  return {
    id: r.id, title: r.title, description: r.description || '',
    contactId: r.contact_id, ownerId: r.owner_id, assignedTo: r.assigned_to,
    status: r.status || 'new', value: r.value || 0, currency: r.currency || 'EUR',
    expectedClose: r.expected_close || '', closedAt: r.closed_at || '',
    source: r.source || '', notes: r.notes || '', tags: r.tags || [],
    productId: r.product_id || null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function dealToRow(d, ownerId) {
  return {
    title: d.title, description: d.description || null,
    contact_id: d.contactId || null, owner_id: ownerId,
    assigned_to: d.assignedTo || null, status: d.status || 'new',
    value: Number(d.value) || 0, currency: d.currency || 'EUR',
    expected_close: d.expectedClose || null, source: d.source || null,
    notes: d.notes || null, tags: d.tags || [],
    product_id: d.productId || null,
    updated_at: new Date().toISOString(),
  };
}

function orderFromRow(r) {
  return {
    id: r.id, dealId: r.deal_id, contactId: r.contact_id, ownerId: r.owner_id,
    status: r.status || 'pending_payment', value: r.value || 0,
    currency: r.currency || 'EUR', notes: r.notes || '',
    productId: r.product_id || null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function orderToRow(o, ownerId) {
  return {
    deal_id:           o.dealId          || null,
    opportunity_id:    o.opportunity_id  || null,
    contact_id:        o.contactId       || o.contact_id  || null,
    owner_id:          o.owner_id        || ownerId,
    status:            o.status          || 'pending_payment',
    value:             Number(o.value)   || 0,
    currency:          o.currency        || 'EUR',
    notes:             o.notes           || null,
    product_id:        o.productId       || o.product_id  || null,
    payment_method:    o.payment_method    || null,
    payment_reference: o.payment_reference || null,
    updated_at:        new Date().toISOString(),
  };
}

function commFromRow(r) {
  return {
    id:        r.id,
    dealId:    r.deal_id    || null,
    contactId: r.contact_id || null,
    ownerId:   r.owner_id   || null,
    order_id:  r.order_id   || null,
    amount:    r.amount     || 0,
    rate:      r.rate       || 0,
    status:    r.status     || 'pending',
    date:      r.date       || '',
    notes:     r.notes      || '',
    createdAt: r.created_at,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    paidAt:     r.paid_at,
  };
}

function commToRow(c, ownerId) {
  const row = {
    deal_id:    c.dealId    || null,
    contact_id: c.contactId || null,
    owner_id:   c.ownerId   || ownerId,
    amount:     Number(c.amount) || 0,
    rate:       Number(c.rate)   || 0,
    status:     c.status         || 'pending',
    date:       c.date           || null,
    notes:      c.notes          || null,
  };
  if (c.status === 'approved' && c.approvedBy) {
    row.approved_by = c.approvedBy;
    row.approved_at = c.approvedAt || new Date().toISOString();
  }
  if (c.status === 'paid' && c.paidAt) {
    row.paid_at = c.paidAt || new Date().toISOString();
  }
  if (c.status === 'cancelled') {
    row.cancelled_at = new Date().toISOString();
  }
  return row;
}

// ── DB API ────────────────────────────────────────────────────────────────────

const db = {

  // ── Contacts ─────────────────────────────────
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

  // ── Deals ─────────────────────────────────────
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
    const orig = await _sb.auth.getUser();
    const { data, error } = await _sb.from('deals').update(dealToRow(d, d.ownerId)).eq('id', id).select().single();
    if (error) throw error;
    return dealFromRow(data);
  },
  async deleteDeal(id) {
    const { error } = await _sb.from('deals').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Orders ────────────────────────────────────
  async getOrders() {
    const { data, error } = await _sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(orderFromRow);
  },
  async createOrder(o) {
    const uid = (await _sb.auth.getUser()).data.user.id;
    const { data, error } = await _sb.from('orders').insert(orderToRow(o, uid)).select().single();
    if (error) throw error;
    return orderFromRow(data);
  },
  async updateOrder(id, o) {
    const { data, error } = await _sb.from('orders').update(orderToRow(o, o.ownerId)).eq('id', id).select().single();
    if (error) throw error;
    return orderFromRow(data);
  },
  async deleteOrder(id) {
    const { error } = await _sb.from('orders').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Commissions ───────────────────────────────
  async getCommissions() {
    const { data, error } = await _sb.from('commissions').select('*').order('created_at', { ascending: false });
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

  // ── Profile / Auth ────────────────────────────
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

  // ── Referral ──────────────────────────────────
  async setReferredBy(userId, refCode) {
    try {
      const { data } = await _sb.from('profiles').select('id').eq('referral_code', refCode).single();
      if (data) await _sb.from('profiles').update({ referred_by: data.id }).eq('id', userId);
    } catch(e) { console.warn('Referral code not found:', refCode); }
  },

  // ── Invite ────────────────────────────────────
  async inviteUser(email, name, role) {
    const { error } = await _sb.auth.signInWithOtp({
      email,
      options: { data: { name }, shouldCreateUser: true },
    });
    if (error) throw error;
  },

  // ── Export ────────────────────────────────────
  exportAll(contacts, deals, commissions) {
    const json = JSON.stringify({ contacts, deals, commissions, exportedAt: new Date().toISOString(), version: '3.0' }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `axiona-crm-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  },

  client: _sb,
};
