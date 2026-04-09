// ── views/ai_lead.js — AI sumár a návrh krokov pre lead ─────────────────────

const aiLead = {
  _loading: {},

  _getApiKey() {
    return localStorage.getItem('axiona_ai_key') || '';
  },

  // Hlavné tlačidlo — zobrazí AI panel pod leadom
  renderBtn(dealId) {
    return `
      <button class="btn-ghost" style="font-size:11px;padding:3px 8px;"
        onclick="aiLead.openPanel('${dealId}')">
        ✦ AI
      </button>`;
  },

  async openPanel(dealId) {
    const apiKey = this._getApiKey();
    if (!apiKey) { app.showApiSetup(); return; }

    const deal    = app.state.deals.find(d => d.id === dealId);
    const contact = app.state.contacts.find(c => c.id === deal?.contactId);
    const product = (app.state.products||[]).find(p => p.id === deal?.productId);

    modal.open('✦ AI Analýza leadu', `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        <strong>${esc(deal?.title||contact?.name||'Lead')}</strong>
        ${contact ? ` · ${esc(contact.name)}` : ''}
        ${product ? ` · ${esc(product.name)}` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn-ghost" style="font-size:12px;" onclick="aiLead.runAction('${dealId}','summary')">📋 Sumár</button>
        <button class="btn-ghost" style="font-size:12px;" onclick="aiLead.runAction('${dealId}','next_step')">➡️ Ďalší krok</button>
        <button class="btn-ghost" style="font-size:12px;" onclick="aiLead.runAction('${dealId}','email')">✉️ Email draft</button>
        <button class="btn-ghost" style="font-size:12px;" onclick="aiLead.runAction('${dealId}','risk')">⚠️ Riziká</button>
        <button class="btn-ghost" style="font-size:12px;" onclick="aiLead.runAction('${dealId}','classify')">🏷️ Klasifikácia</button>
      </div>
      <div id="ai-lead-result" style="min-height:80px;font-size:13px;line-height:1.7;color:var(--txt);white-space:pre-wrap;"></div>
      <div style="height:1px;background:var(--brd);margin:14px 0;"></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Vlastná otázka:</div>
      <div style="display:flex;gap:8px;">
        <input id="ai-lead-input" placeholder="Napr. Napíš ponuku pre tohto klienta..."
          style="flex:1;font-size:13px;"
          onkeydown="if(event.key==='Enter'){event.preventDefault();aiLead.runCustom('${dealId}');}">
        <button class="btn-primary" onclick="aiLead.runCustom('${dealId}')">→</button>
      </div>`);
  },

  async runAction(dealId, action) {
    const prompts = {
      summary:   'Zhrň tento lead v 3-5 vetách. Kto je zákazník, o čo má záujem, v akom stave je obchod a aký je potenciál.',
      next_step: 'Navrhni konkrétny ďalší krok pre tento lead. Buď špecifický — čo presne urobiť, kedy a ako. Maximálne 3 kroky.',
      email:     'Napíš profesionálny follow-up email pre tohto zákazníka. Slovenčina, formálny ale priateľský tón. Zahrň predmet emailu.',
      risk:      'Identifikuj hlavné riziká tohto obchodu. Prečo by mohol zákazník odísť? Čo môže spôsobiť zlyhanie? Max 4 body.',
      classify:  'Klasifikuj tento lead: pravdepodobnosť uzatvorenia (%), typ zákazníka, urgentnosť, odporúčaná priorita (high/medium/low). Vysvetli prečo.',
    };

    const prompt = prompts[action];
    await this._callAI(dealId, prompt);
  },

  async runCustom(dealId) {
    const input = document.getElementById('ai-lead-input');
    const text  = input?.value.trim();
    if (!text) return;
    if (input) input.value = '';
    await this._callAI(dealId, text);
  },

  async _callAI(dealId, userPrompt) {
    const resultEl = document.getElementById('ai-lead-result');
    if (!resultEl) return;
    resultEl.innerHTML = '<span style="color:var(--muted);">✦ Analyzujem...</span>';

    const apiKey  = this._getApiKey();
    const deal    = app.state.deals.find(d => d.id === dealId);
    const contact = app.state.contacts.find(c => c.id === deal?.contactId);
    const product = (app.state.products||[]).find(p => p.id === deal?.productId);

    const context = `
LEAD:
- Názov: ${deal?.title || '—'}
- Stav: ${deal?.status || '—'}
- Hodnota: ${deal?.value || 0} €
- Zdroj: ${deal?.source || '—'}
- Plánované uzatvorenie: ${deal?.expectedClose || '—'}
- Popis: ${deal?.description || '—'}
- Poznámky: ${deal?.notes || '—'}

ZÁKAZNÍK:
- Meno: ${contact?.name || '—'}
- Email: ${contact?.email || '—'}
- Telefón: ${contact?.phone || '—'}
- Typ: ${contact?.entityType || '—'}

PRODUKT:
- Názov: ${product?.name || '—'}
- Kategória: ${product?.category || '—'} / ${product?.subcategory || '—'}
- Cena: ${product?.base_price || product?.price || '—'} €
- Popis: ${product?.description || '—'}`;

    try {
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
          max_tokens: 800,
          system: `Si CRM asistent pre obchodný tím. Odpovedáš vždy v slovenčine. Si konkrétny, stručný a praktický. Vyhýbaš sa zbytočným úvodným frázam.`,
          messages: [{ role: 'user', content: `${context}\n\nÚLOHA: ${userPrompt}` }],
        }),
      });

      const data  = await res.json();
      const reply = data.content?.find(b => b.type === 'text')?.text || data.error?.message || 'Chyba.';

      if (resultEl) {
        resultEl.style.background   = 'var(--surf)';
        resultEl.style.borderRadius = '8px';
        resultEl.style.padding      = '12px';
        resultEl.style.border       = '1px solid var(--brd)';
        resultEl.textContent        = reply;
      }

      // Uložiť do poznámok — vždy len jedno tlačidlo (nahradí existujúce)
      const existing = document.getElementById('ai-lead-save-btn');
      if (existing) existing.remove();
      const saveBtn = document.createElement('button');
      saveBtn.id          = 'ai-lead-save-btn';
      saveBtn.className   = 'btn-ghost';
      saveBtn.style.cssText = 'font-size:11px;margin-top:10px;display:block;';
      saveBtn.textContent = '💾 Uložiť do poznámok leadu';
      saveBtn.onclick     = () => aiLead._saveToNotes(dealId, reply);
      resultEl?.parentNode?.appendChild(saveBtn);

    } catch(e) {
      if (resultEl) resultEl.textContent = 'Chyba pripojenia: ' + e.message;
    }
  },

  async _saveToNotes(dealId, text) {
    const deal = app.state.deals.find(d => d.id === dealId);
    if (!deal) return;
    const existing = deal.notes || '';
    const timestamp = new Date().toLocaleDateString('sk-SK');
    const newNotes  = existing
      ? `${existing}\n\n--- AI (${timestamp}) ---\n${text}`
      : `--- AI (${timestamp}) ---\n${text}`;

    try {
      const { error } = await db.client.from('deals').update({ notes: newNotes }).eq('id', dealId);
      if (error) throw error;
      deal.notes = newNotes;
      alert('✓ Uložené do poznámok');
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};

// Rozšírenie pre leads tabuľku
aiLead.openPanelLead = async function(leadId) {
  const apiKey = this._getApiKey();
  if (!apiKey) { app.showApiSetup(); return; }
  const lead    = pipelineView._leads?.find(l => l.id === leadId);
  const contact = lead?.contacts;
  const product = lead?.products;
  this._openModal(leadId, 'lead', lead, contact, product);
};

aiLead.openPanelOpp = async function(oppId) {
  const apiKey = this._getApiKey();
  if (!apiKey) { app.showApiSetup(); return; }
  const opp     = pipelineView._opps?.find(o => o.id === oppId);
  const contact = opp?.contacts;
  const product = opp?.products;
  this._openModal(oppId, 'opp', opp, contact, product);
};

aiLead._openModal = function(id, type, item, contact, product) {
  modal.open('✦ AI Analýza', `
    <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
      <strong>${esc(item?.title||contact?.name||'—')}</strong>
      ${contact ? ` · ${esc(contact.name)}` : ''}
      ${product ? ` · ${esc(product.name)}` : ''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <button class="btn-ghost" style="font-size:12px;" onclick="aiLead._runForItem('${id}','${type}','summary')">📋 Sumár</button>
      <button class="btn-ghost" style="font-size:12px;" onclick="aiLead._runForItem('${id}','${type}','next_step')">➡️ Ďalší krok</button>
      <button class="btn-ghost" style="font-size:12px;" onclick="aiLead._runForItem('${id}','${type}','email')">✉️ Email draft</button>
      <button class="btn-ghost" style="font-size:12px;" onclick="aiLead._runForItem('${id}','${type}','risk')">⚠️ Riziká</button>
      <button class="btn-ghost" style="font-size:12px;" onclick="aiLead._runForItem('${id}','${type}','classify')">🏷️ Klasifikácia</button>
    </div>
    <div id="ai-lead-result" style="min-height:80px;font-size:13px;line-height:1.7;color:var(--txt);white-space:pre-wrap;"></div>
    <div style="height:1px;background:var(--brd);margin:14px 0;"></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Vlastná otázka:</div>
    <div style="display:flex;gap:8px;">
      <input id="ai-lead-input" placeholder="Napr. Napíš ponuku..." style="flex:1;font-size:13px;"
        onkeydown="if(event.key==='Enter'){event.preventDefault();aiLead._customForItem('${id}','${type}');}">
      <button class="btn-primary" onclick="aiLead._customForItem('${id}','${type}')">→</button>
    </div>`);
};

aiLead._runForItem = async function(id, type, action) {
  const prompts = {
    summary:   'Zhrň tento prípad v 3-5 vetách. Kto je zákazník, o čo má záujem, v akom stave je a aký je potenciál.',
    next_step: 'Navrhni konkrétny ďalší krok. Buď špecifický — čo presne urobiť, kedy a ako. Maximálne 3 kroky.',
    email:     'Napíš profesionálny follow-up email. Slovenčina, formálny ale priateľský tón. Zahrň predmet emailu.',
    risk:      'Identifikuj hlavné riziká. Prečo by mohol zákazník odísť? Max 4 body.',
    classify:  'Klasifikuj: pravdepodobnosť uzatvorenia (%), typ zákazníka, urgentnosť, priorita (high/medium/low).',
  };
  await this._callForItem(id, type, prompts[action]);
};

aiLead._customForItem = async function(id, type) {
  const input = document.getElementById('ai-lead-input');
  const text  = input?.value.trim();
  if (!text) return;
  if (input) input.value = '';
  await this._callForItem(id, type, text);
};

aiLead._callForItem = async function(id, type, userPrompt) {
  const resultEl = document.getElementById('ai-lead-result');
  if (!resultEl) return;
  resultEl.innerHTML = '<span style="color:var(--muted);">✦ Analyzujem...</span>';

  const apiKey = this._getApiKey();
  const item    = type === 'lead'
    ? pipelineView._leads?.find(l => l.id === id)
    : pipelineView._opps?.find(o => o.id === id);
  const contact = item?.contacts;
  const product = item?.products;

  const context = `
TYP: ${type === 'lead' ? 'Lead' : 'Príležitosť'}
Názov: ${item?.title || '—'}
Stav: ${item?.status || '—'}
Hodnota: ${item?.value || item?.value_estimate || 0} €
Zdroj: ${item?.source || '—'}
Pravdepodobnosť: ${item?.probability != null ? item.probability + '%' : '—'}
Plánované uzatvorenie: ${item?.expected_close || '—'}
Poznámky: ${item?.notes || '—'}

ZÁKAZNÍK: ${contact?.name || '—'} | ${contact?.email || '—'} | ${contact?.phone || '—'}
PRODUKT: ${product?.name || '—'} | ${product?.category || '—'} | ${product?.base_price || product?.price || '—'} €`;

  try {
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
        max_tokens: 800,
        system: 'Si CRM asistent. Odpovedáš vždy v slovenčine. Si konkrétny a stručný.',
        messages: [{ role: 'user', content: `${context}\n\nÚLOHA: ${userPrompt}` }],
      }),
    });
    const data  = await res.json();
    const reply = data.content?.find(b => b.type === 'text')?.text || data.error?.message || 'Chyba.';

    if (resultEl) {
      resultEl.style.cssText = 'background:var(--surf);border-radius:8px;padding:12px;border:1px solid var(--brd);white-space:pre-wrap;font-size:13px;line-height:1.7;';
      resultEl.textContent = reply;
    }

    const existing = document.getElementById('ai-lead-save-btn');
    if (existing) existing.remove();
    const saveBtn = document.createElement('button');
    saveBtn.id = 'ai-lead-save-btn';
    saveBtn.className = 'btn-ghost';
    saveBtn.style.cssText = 'font-size:11px;margin-top:10px;display:block;';
    saveBtn.textContent = '💾 Uložiť do poznámok';
    saveBtn.onclick = () => aiLead._saveToItem(id, type, reply);
    resultEl?.parentNode?.appendChild(saveBtn);
  } catch(e) {
    if (resultEl) resultEl.textContent = 'Chyba: ' + e.message;
  }
};

aiLead._saveToItem = async function(id, type, text) {
  const table = type === 'lead' ? 'leads' : 'opportunities';
  const items = type === 'lead' ? pipelineView._leads : pipelineView._opps;
  const item  = items?.find(x => x.id === id);
  if (!item) return;
  const existing = item.notes || '';
  const ts = new Date().toLocaleDateString('sk-SK');
  const newNotes = existing ? `${existing}\n\n--- AI (${ts}) ---\n${text}` : `--- AI (${ts}) ---\n${text}`;
  try {
    const { error } = await db.client.from(table).update({ notes: newNotes }).eq('id', id);
    if (error) throw error;
    item.notes = newNotes;
    alert('✓ Uložené do poznámok');
  } catch(e) { alert('Chyba: ' + e.message); }
};
