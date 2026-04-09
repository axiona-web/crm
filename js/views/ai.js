// ── views/ai.js ───────────────────────────────────────────────────────────────

const aiView = {
  history: [
    { role: 'assistant', content: 'Ahoj! Som tvoj CRM asistent. Pýtaj sa ma na kontakty, leady, objednávky, provízie – alebo požiadaj o analýzu, follow-up email či odporúčanie ďalšieho kroku.' }
  ],
  loading: false,

  _getApiKey() {
    return localStorage.getItem('axiona_ai_key') || '';
  },

  async _hasKey() {
    if (typeof aiProxy !== 'undefined') return await aiProxy.hasKey();
    return !!this._getApiKey();
  },

  render() {
    const msgs = this.history.map(m => this._bubble(m)).join('');
    const loadingBubble = this.loading
      ? `<div class="msg assistant"><div class="msg-bubble" style="color:var(--muted);">✦ Premýšľam...</div></div>`
      : '';
    const hasKey = true;
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

      const system = `Si CRM asistent pre obchodný tím Axiona. Komunikuješ výhradne po slovensky. Si konkrétny, stručný a praktický.

PRODUKTY (${products.length}): ${products.slice(0,15).map(p=>`${p.name} ${p.base_price||0}€`).join(', ')}

DEALY (${deals.length}): ${JSON.stringify(deals.slice(0,10).map(d=>({title:d.title,status:d.status,value:d.sale_price_snapshot||0,produkt:d.product_name_snapshot})))}

ČLENOVIA (${contacts.length}): ${contacts.slice(0,10).map(c=>c.name).join(', ')}

PROVÍZIE: pending ${commissions.filter(c=>c.status==='pending').reduce((a,c)=>a+(c.amount||0),0)}€, schválené ${commissions.filter(c=>c.status==='approved').reduce((a,c)=>a+(c.amount||0),0)}€`;

      const messages = this.history.slice(-14).map(m => ({ role: m.role, content: m.content }));

      const reply = await aiProxy.call({ system, messages, max_tokens: 1024 });

      this.history.push({ role: 'assistant', content: reply });
    } catch(e) {
      this.history.push({ role: 'assistant', content: `Chyba: ${e.message}` });
    }

    this.loading = false;
    app.renderContent();
    setTimeout(() => {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  },
};
