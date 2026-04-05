// ── views/ai.js ──────────────────────────────────────────────────────────────

const aiView = {
  history: [
    { role: 'assistant', content: 'Ahoj! Som tvoj CRM asistent. Pýtaj sa ma na kontakty, obchody, provízie – alebo požiadaj o analýzu, follow-up email či odporúčanie ďalšieho kroku.' }
  ],
  loading: false,

  render() {
    const msgs = this.history.map(m => this._bubble(m)).join('');
    const loadingBubble = this.loading
      ? `<div class="msg assistant"><div class="msg-bubble" style="color:var(--muted);">✦ Premýšľam...</div></div>`
      : '';
    const suggestions = this.history.length <= 1 ? `
      <div class="suggestions">
        <button class="suggestion-btn" onclick="aiView.setInput('Ktoré obchody treba urgenčne riešiť?')">Urgentné obchody?</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Aká je moja celková pipeline hodnota?')">Pipeline hodnota?</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Napíš follow-up email pre môjho najdôležitejšieho klienta')">Follow-up email</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Zhrň moju obchodnú situáciu')">Zhrnutie situácie</button>
      </div>` : '';

    return `
      <div id="ai-wrap">
        <div class="view-head" style="margin-bottom:12px;"><h2>✦ AI Asistent</h2></div>
        <div id="chat-msgs">${msgs}${loadingBubble}</div>
        ${suggestions}
        <div class="chat-input-row">
          <input id="chat-input" placeholder="Opýtaj sa niečo..."
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();aiView.send();}" />
          <button class="btn-primary" onclick="aiView.send()" ${this.loading ? 'disabled' : ''} style="padding:9px 20px;">→</button>
        </div>
      </div>`;
  },

  afterRender() {
    const msgs = document.getElementById('chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  },

  setInput(v) {
    const el = document.getElementById('chat-input');
    if (el) { el.value = v; el.focus(); }
  },

  _bubble(m) {
    return `<div class="msg ${m.role}"><div class="msg-bubble">${esc(m.content)}</div></div>`;
  },

  async send() {
    const el   = document.getElementById('chat-input');
    const text = el?.value.trim();
    if (!text || this.loading) return;

    const apiKey = db.getApiKey();
    if (!apiKey) { app.showApiSetup(); return; }

    el.value = '';
    this.history.push({ role: 'user', content: text });
    this.loading = true;
    app.renderContent();

    try {
      const { contacts, deals, commissions } = app.state;
      const system = `Si asistent pre CRM systém. Komunikuješ výhradne po slovensky.
Máš prístup k týmto dátam:

KONTAKTY (${contacts.length}):
${JSON.stringify(contacts, null, 2)}

OBCHODY (${deals.length}):
${JSON.stringify(deals, null, 2)}

PROVÍZIE (${commissions.length}):
${JSON.stringify(commissions, null, 2)}

Pomáhaj analyzovať dáta, navrhuj ďalšie kroky, identifikuj príležitosti a riziká. Buď konkrétny a stručný.`;

      const messages = this.history.slice(-14).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system, messages }),
      });

      const data  = await res.json();
      const reply = data.content?.find(b => b.type === 'text')?.text
                 || data.error?.message
                 || 'Chyba.';
      this.history.push({ role: 'assistant', content: reply });
    } catch (e) {
      this.history.push({ role: 'assistant', content: `Chyba: ${e.message}` });
    }

    this.loading = false;
    app.renderContent();
  },
};
