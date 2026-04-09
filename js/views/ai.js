// ── views/ai.js ───────────────────────────────────────────────────────────────

const aiView = {
  history: [
    { role: 'assistant', content: 'Ahoj! Som tvoj CRM asistent. Pýtaj sa ma na kontakty, leady, objednávky, provízie – alebo požiadaj o analýzu, follow-up email či odporúčanie ďalšieho kroku.' }
  ],
  loading: false,

  _getApiKey() {
    return localStorage.getItem('axiona_ai_key') || '';
  },

  render() {
    const msgs = this.history.map(m => this._bubble(m)).join('');
    const loadingBubble = this.loading
      ? `<div class="msg assistant"><div class="msg-bubble" style="color:var(--muted);">✦ Premýšľam...</div></div>`
      : '';
    const hasKey = !!this._getApiKey();
    const suggestions = this.history.length <= 1 ? `
      <div class="suggestions">
        <button class="suggestion-btn" onclick="aiView.setInput('Ktoré leady treba urgenčne riešiť?')">Urgentné leady?</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Aká je moja celková pipeline hodnota?')">Pipeline hodnota?</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Napíš follow-up email pre môjho najdôležitejšieho člena')">Follow-up email</button>
        <button class="suggestion-btn" onclick="aiView.setInput('Zhrň moju obchodnú situáciu')">Zhrnutie situácie</button>
      </div>` : '';

    return `
      <div id="ai-wrap">
        <div class="view-head" style="margin-bottom:12px;">
          <h2>✦ AI Asistent</h2>
          ${!hasKey ? `<button class="btn-ghost" style="font-size:12px;" onclick="app.showApiSetup()">🔑 Nastaviť API kľúč</button>` : ''}
        </div>
        ${!hasKey ? `
          <div style="background:rgba(212,148,58,0.1);border:1px solid var(--acc-brd);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--acc);">
            ⚠️ Pre AI asistenta potrebuješ Anthropic API kľúč.
            <button class="btn-ghost" style="font-size:12px;margin-left:10px;" onclick="app.showApiSetup()">Nastaviť →</button>
          </div>` : ''}
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

    const apiKey = this._getApiKey();
    if (!apiKey) { app.showApiSetup(); return; }

    el.value = '';
    this.history.push({ role: 'user', content: text });
    this.loading = true;
    app.renderContent();
    setTimeout(() => {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);

    try {
      const { contacts, deals, orders, commissions } = app.state;
      const products = app.state.products || [];

      const system = `Si CRM asistent pre obchodný tím Axiona. Komunikuješ výhradne po slovensky. Si konkrétny, stručný a praktický. Vyhýbaš sa zbytočným úvodným frázam.

PRODUKTY (${products.length}):
${products.slice(0,20).map(p=>`- ${p.name} (${p.category||''}) ${p.base_price||p.price||0}€`).join('\n')}

KONTAKTY/ČLENOVIA (${contacts.length}):
${JSON.stringify(contacts.slice(0,15).map(c=>({name:c.name,email:c.email,phone:c.phone})), null, 2)}

PIPELINE (${deals.length} leadov):
${JSON.stringify(deals.slice(0,15).map(d=>({title:d.title,status:d.status,value:d.value,kontakt:contacts.find(c=>c.id===d.contactId)?.name,produkt:products.find(p=>p.id===d.productId)?.name,uzatvorenie:d.expectedClose,poznamky:d.notes})), null, 2)}

OBJEDNÁVKY (${(orders||[]).length}):
${JSON.stringify((orders||[]).slice(0,10).map(o=>({produkt:o.product_name_snapshot,hodnota:o.value,stav:o.status,datum:o.created_at?.slice(0,10)})), null, 2)}

PROVÍZIE (${commissions.length}):
${JSON.stringify(commissions.slice(0,10).map(c=>({suma:c.amount,stav:c.status,percento:c.rate})), null, 2)}

Pri emailoch uvádzaj predmet. Pri analýzach buď konkrétny s číslami.`;

      const messages = this.history.slice(-14).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system,
          messages,
        }),
      });

      const data  = await res.json();
      const reply = data.content?.find(b => b.type === 'text')?.text
                 || data.error?.message
                 || 'Chyba pri odpovedi.';
      this.history.push({ role: 'assistant', content: reply });
    } catch(e) {
      this.history.push({ role: 'assistant', content: `Chyba pripojenia: ${e.message}` });
    }

    this.loading = false;
    app.renderContent();
    setTimeout(() => {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  },
};
