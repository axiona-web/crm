// ── views/pipeline.js ────────────────────────────────────────────────────────

const pipelineView = {
  _filter: 'all',

  render() {
    const { deals, contacts } = app.state;
    const cName = id => contacts.find(c => c.id === id)?.name || '—';

    // Súhrn podľa statusu
    const summary = DEAL_STATUSES.map(s => ({
      s, label: DEAL_STATUS_LABELS[s], color: DEAL_STATUS_COLORS[s],
      cnt: deals.filter(d => d.status === s).length,
      val: deals.filter(d => d.status === s).reduce((a, d) => a + (d.value || 0), 0),
    }));

    const filtered = deals
      .filter(d => this._filter === 'all' || d.status === this._filter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const activeVal = deals
      .filter(d => DEAL_ACTIVE.includes(d.status))
      .reduce((a, d) => a + (d.value || 0), 0);

    return `
      <div class="view-head">
        <h2>Pipeline</h2>
        <button class="btn-primary" onclick="pipelineView.openAdd()">+ Nový lead</button>
      </div>

      <!-- Súhrn -->
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:140px;border-color:var(--acc-brd);background:linear-gradient(135deg,#1a180e,var(--card));">
          <div class="stat-label">Aktívna pipeline</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--acc);margin-top:4px;">${EUR(activeVal)}</div>
          <div class="stat-sub">${deals.filter(d => DEAL_ACTIVE.includes(d.status)).length} aktívnych leadov</div>
        </div>
        <div class="card" style="flex:1;min-width:140px;">
          <div class="stat-label">Vyhraté</div>
          <div class="mono" style="font-size:22px;font-weight:700;color:var(--green);margin-top:4px;">${EUR(summary.find(s=>s.s==='won')?.val||0)}</div>
          <div class="stat-sub">${summary.find(s=>s.s==='won')?.cnt||0} obchodov</div>
        </div>
        <div class="card" style="flex:1;min-width:140px;">
          <div class="stat-label">Win rate</div>
          ${(() => {
            const won  = summary.find(s=>s.s==='won')?.cnt  || 0;
            const lost = summary.find(s=>s.s==='lost')?.cnt || 0;
            const rate = (won + lost) > 0 ? Math.round(won / (won + lost) * 100) : 0;
            return `<div class="mono" style="font-size:22px;font-weight:700;color:${rate>=50?'var(--green)':'var(--acc)'};margin-top:4px;">${rate}%</div>
                    <div class="stat-sub">${won} vyhraných z ${won+lost}</div>`;
          })()}
        </div>
      </div>

      <!-- Filter statusov -->
      <div style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px;flex-wrap:wrap;">
        <button class="filter-tab${this._filter==='all'?' active':''}"
          onclick="pipelineView._filter='all'; app.renderContent();">Všetky (${deals.length})</button>
        ${summary.filter(s => s.cnt > 0).map(s => `
          <button class="filter-tab${this._filter===s.s?' active':''}"
            style="${this._filter===s.s?`color:${s.color};border-color:${s.color};background:${s.color}18;`:''}"
            onclick="pipelineView._filter='${s.s}'; app.renderContent();">
            ${esc(s.label)} (${s.cnt})
          </button>`).join('')}
      </div>

      <!-- Zoznam -->
      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
            <div style="font-size:28px;margin-bottom:8px;">📊</div>
            <div>Žiadne leady</div>
            <div style="margin-top:12px;"><button class="btn-primary" onclick="pipelineView.openAdd()">+ Pridať prvý lead</button></div>
           </div>`
        : `<div class="list">
            ${filtered.map(d => `
              <div class="card" style="cursor:pointer;" onclick="pipelineView.openEdit('${d.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                      <span style="font-weight:700;font-size:14px;">${esc(d.title)}</span>
                      ${dealBadge(d.status)}
                    </div>
                    <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
                      ${d.contactId ? `<span>👤 ${esc(cName(d.contactId))}</span>` : ''}
                      <span class="mono" style="color:var(--green);">💰 ${EUR(d.value)}</span>
                      ${d.source ? `<span>🔗 ${esc(d.source)}</span>` : ''}
                      ${d.expectedClose ? `<span>📅 ${FMT(d.expectedClose)}</span>` : ''}
                    </div>
                    ${d.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:5px;">${esc(d.notes)}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
                    <button class="icon-btn" onclick="event.stopPropagation();pipelineView.moveBack('${d.id}')">◀</button>
                    <button class="icon-btn" onclick="event.stopPropagation();pipelineView.moveNext('${d.id}')">▶</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  _form(d, isNew) {
    const cOpts = app.state.contacts.map(c =>
      `<option value="${c.id}"${d.contactId===c.id?' selected':''}>${esc(c.name)}${c.type?` — ${c.type}`:''}</option>`
    ).join('');

    return `
      <div class="form-row"><label class="form-label">Názov leadu *</label>
        <input id="df-title" value="${esc(d.title||'')}" placeholder="napr. Záujem o produkt X" /></div>
      <div class="form-row"><label class="form-label">Kontakt / Člen</label>
        <select id="df-contact"><option value="">— vybrať —</option>${cOpts}</select></div>
      <div class="form-row"><label class="form-label">Stav</label>
        <select id="df-status">
          ${DEAL_STATUSES.map(s =>
            `<option value="${s}"${(d.status||'new')===s?' selected':''}>${DEAL_STATUS_LABELS[s]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€)</label>
          <input id="df-value" type="number" value="${d.value||''}" /></div>
        <div class="form-row"><label class="form-label">Plánované uzatvorenie</label>
          <input id="df-close" type="date" value="${d.expectedClose||''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Produkt</label>
        <select id="df-product">
          <option value="">— vybrať produkt —</option>
          ${(app.state.products||[]).filter(p=>p.active).map(p=>
            `<option value="${p.id}"${d.productId===p.id?' selected':''}>${esc(p.name)} — ${EUR(p.price)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-row"><label class="form-label">Zdroj</label>
        <input id="df-source" value="${esc(d.source||'')}" placeholder="napr. referral, web, event" /></div>
      <div class="form-row"><label class="form-label">Popis</label>
        <textarea id="df-desc" style="min-height:55px;resize:vertical;">${esc(d.description||'')}</textarea></div>
      <div class="form-row"><label class="form-label">Poznámky</label>
        <textarea id="df-notes" style="min-height:55px;resize:vertical;">${esc(d.notes||'')}</textarea></div>
      <div id="df-error" style="display:none;color:var(--red);font-size:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <div class="form-actions">
        <button class="btn-primary" id="df-submit" onclick="pipelineView.save('${d.id||''}',${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew && ['won','lost','cancelled'].includes(d.status) ? '' : ''}
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="pipelineView.delete('${d.id}')">Vymazať</button>` : ''}
      </div>
      ${!isNew && d.status === 'won' ? `
        <div style="margin-top:12px;padding:10px 12px;background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.2);border-radius:8px;font-size:12px;color:var(--green);">
          ✓ Lead vyhraný — môžeš vytvoriť objednávku v záložke Objednávky.
        </div>` : ''}`;
  },

  openAdd()    { modal.open('Nový lead', this._form({ title:'', status:'new', value:'', contactId:'', source:'', description:'', notes:'' }, true)); },
  openEdit(id) { const d = app.state.deals.find(x => x.id === id); if(d) modal.open('Upraviť lead', this._form(d, false)); },

  async moveBack(id) {
    const d   = app.state.deals.find(x => x.id === id); if(!d) return;
    const idx = DEAL_STATUSES.indexOf(d.status) - 1;
    if (idx < 0) return;
    await this._updateStatus(id, d, DEAL_STATUSES[idx]);
  },

  async moveNext(id) {
    const d   = app.state.deals.find(x => x.id === id); if(!d) return;
    const idx = DEAL_STATUSES.indexOf(d.status) + 1;
    if (idx >= DEAL_STATUSES.length) return;
    await this._updateStatus(id, d, DEAL_STATUSES[idx]);
  },

  async _updateStatus(id, d, newStatus) {
    try {
      const updated = await db.updateDeal(id, { ...d, status: newStatus });
      app.state.deals = app.state.deals.map(x => x.id === id ? updated : x);
      app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },

  _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

  async save(id, isNew) {
    const title = this._val('df-title');
    const errEl = document.getElementById('df-error');
    errEl.style.display = 'none';
    if (!title) { errEl.textContent = 'Zadaj názov leadu.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('df-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Ukladám...'; }

    const obj = {
      title, status: this._val('df-status') || 'new',
      contactId: this._val('df-contact') || null,
      value: Number(this._val('df-value')) || 0,
      expectedClose: this._val('df-close') || null,
      source:    this._val('df-source'),
      productId: this._val('df-product') || null,
      description: this._val('df-desc'),
      notes: this._val('df-notes'),
    };

    try {
      if (isNew) {
        const created = await db.createDeal(obj);
        app.state.deals.unshift(created);
      } else {
        const orig    = app.state.deals.find(d => d.id === id);
        const updated = await db.updateDeal(id, { ...orig, ...obj });
        app.state.deals = app.state.deals.map(d => d.id === id ? updated : d);
      }
      modal.close(); app.renderContent();
    } catch(e) {
      errEl.textContent = 'Chyba: ' + (e.message || 'skús znova');
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Uložiť'; }
    }
  },

  async delete(id) {
    if (!confirm('Vymazať lead?')) return;
    try {
      await db.deleteDeal(id);
      app.state.deals = app.state.deals.filter(d => d.id !== id);
      modal.close(); app.renderContent();
    } catch(e) { alert('Chyba: ' + e.message); }
  },
};
