// ── js/ai_proxy.js — AI volanie cez Supabase Edge Function ───────────────────

const aiProxy = {

  _url() {
    return 'https://cdusjrckwiqsfbrvczgs.supabase.co/functions/v1/ai-proxy';
  },

  _anonKey() {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXNqcmNrd2lxc2ZicnZjemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDg2MTcsImV4cCI6MjA5MDk4NDYxN30.WMFMqeJB-MT9T-1dBz2lzvFDI0yfZFKNCXUZ5QBliNs';
  },

  async call({ system, messages, model = 'claude-haiku-4-5-20251001', max_tokens = 1000 }) {
    const res = await fetch(this._url(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':       this._anonKey(),
        'Authorization': `Bearer ${this._anonKey()}`,
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${err.error || 'Edge Function error'}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.content?.find(b => b.type === 'text')?.text || '';
  },

  async saveApiKey(key) {
    const { error } = await db.client.from('app_settings').upsert({
      key:        'anthropic_api_key',
      value:      key,
      updated_by: app._currentUserId(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (error) throw error;
    localStorage.removeItem('axiona_ai_key');
  },

  async hasKey() {
    if (localStorage.getItem('axiona_ai_key')) return true;
    try {
      const { data } = await db.client.from('app_settings')
        .select('value').eq('key', 'anthropic_api_key').single();
      return !!(data?.value);
    } catch { return false; }
  },

  async migrateKey() {
    const localKey = localStorage.getItem('axiona_ai_key');
    if (!localKey) return false;
    await this.saveApiKey(localKey);
    return true;
  },
};
