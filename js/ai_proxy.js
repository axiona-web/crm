// ── js/ai_proxy.js — Centrálne AI volanie cez Edge Function ──────────────────

const aiProxy = {

  // Supabase Edge Function URL
  _url() {
    // Priamo hardcode URL — istejšie ako brať z db.client
    return 'https://cdusjrckwiqsfbrvczgs.supabase.co/functions/v1/ai-proxy';
  },

  // Hlavná metóda — zavolá Edge Function
  async call({ system, messages, model = 'claude-haiku-4-5-20251001', max_tokens = 1000 }) {
    // Získaj token priamo z auth
    const { data: { session } } = await db.client.auth.getSession();
    const token = session?.access_token;

    if (!token) throw new Error('Nie si prihlásený.');

    const res = await fetch(this._url(), {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXNqcmNrd2lxc2ZicnZjemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDg2MTcsImV4cCI6MjA5MDk4NDYxN30.WMFMqeJB-MT9T-1dBz2lzvFDI0yfZFKNCXUZ5QBliNs',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    return data.content?.find(b => b.type === 'text')?.text || '';
  },

  // Ulož API kľúč do app_settings (admin only)
  async saveApiKey(key) {
    const { error } = await db.client.from('app_settings').upsert({
      key:        'anthropic_api_key',
      value:      key,
      updated_by: app._currentUserId(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (error) throw error;
    // Vymaž z localStorage ak tam ešte je
    localStorage.removeItem('axiona_ai_key');
  },

  // Skontroluj či je kľúč nastavený
  async hasKey() {
    // Najprv skontroluj localStorage (legacy)
    if (localStorage.getItem('axiona_ai_key')) return true;
    // Potom app_settings
    const { data } = await db.client.from('app_settings')
      .select('value').eq('key', 'anthropic_api_key').single();
    return !!(data?.value);
  },

  // Migrácia — presuň kľúč z localStorage do DB
  async migrateKey() {
    const localKey = localStorage.getItem('axiona_ai_key');
    if (!localKey) return false;
    await this.saveApiKey(localKey);
    return true;
  },
};
