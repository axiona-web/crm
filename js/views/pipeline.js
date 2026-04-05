// ── views/pipeline.js ────────────────────────────────────────────────────────

const pipelineView = {
  filter: 'Všetky',

  render() {
    const { deals, contacts } = app.state;
    const cName = id => contacts.find(c => c.id === id)?.name || '—';

    const groups = STAGES.map(s => ({
      s,
      cnt: deals.filter(d => d.stage === s).length,
      val: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0),
    }));

    const filtered = deals
      .filter(d => this.filter === 'Všetky' || d.stage === this.filter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return `
      <div class="view-head">
        <h2>Pipeline</h2>
        <button class="btn-primary" onclick="pipelineView.openAdd()">+ Nová príležitosť</button>
      </div>

      <div class="stage-filters">
        ${groups.map(g => `
          <button class="stage-filter-btn"
            style="${this.filter === g.s ? `background:${STAGE_COLORS[g.s]}18;border-color:${STAGE_COLORS[g.s]};color:${STAGE_COLORS[g.s]};` : ''}"
            onclick="pipelineView.filter=pipelineView.filter==='${g.s}'?'Všetky':'${g.s}'; app.renderContent();">
            <div style="font-size:12px;font-weight:600;">${g.s}</div>
            <div style="font-size:11px;margin-top:1px;">${g.cnt} · ${EUR(g.val)}</div>
          </button>`).join('')}
        ${this.filter !== 'Všetky'
          ? `<button class="btn-ghost" style="align-self:center;font-size:12px;padding:5px 11px;"
               onclick="pipelineView.filter='Všetky'; app.renderContent();">× Všetky</button>`
          : ''}
      </div>

      ${filtered.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Žiadne príležitosti</div>`
        : `<div class="list">
            ${filtered.map(d => `
              <div class="card">
                <div class="list-item">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                      <span style="font-weight:700;font-size:14px;">${esc(d.name)}</span>
                      ${badge(d.stage, STAGE_COLORS[d.stage])}
                    </div>
                    <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
                      <span>👤 ${esc(cName(d.contactId))}</span>
                      <span class="mono" style="color:var(--green);">💰 ${EUR(d.value)}</span>
                      <span>📊 ${d.probability || 0}%</span>
                      ${d.expectedClose ? `<span>📅 ${FMT(d.expectedClose)}</span>` : ''}
                    </div>
                    ${d.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:5px;">${esc(d.notes)}</div>` : ''}
                  </div>
                  <div class="deal-actions">
                    <button class="icon-btn" onclick="pipelineView.move('${d.id}', -1)" title="Späť">◀</button>
                    <button class="icon-btn" onclick="pipelineView.move('${d.id}', 1)"  title="Ďalej">▶</button>
                    <button class="icon-btn" onclick="pipelineView.openEdit('${d.id}')">✏️</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}`;
  },

  move(id, dir) {
    const d   = app.state.deals.find(x => x.id === id);
    if (!d) return;
    const idx = STAGES.indexOf(d.stage) + dir;
    if (idx < 0 || idx >= STAGES.length) return;
    app.state.deals = app.state.deals.map(x => x.id === id ? { ...x, stage: STAGES[idx] } : x);
    db.set('deals', app.state.deals);
    app.renderContent();
  },

  _form(d, isNew) {
    const opts = app.state.contacts.map(c =>
      `<option value="${c.id}"${d.contactId === c.id ? ' selected' : ''}>${esc(c.name)}${c.company ? ` (${esc(c.company)})` : ''}</option>`
    ).join('');
    return `
      <div class="form-row"><label class="form-label">Názov *</label><input id="df-name" value="${esc(d.name)}" /></div>
      <div class="form-row">
        <label class="form-label">Kontakt</label>
        <select id="df-contact"><option value="">— vybrať —</option>${opts}</select>
      </div>
      <div class="form-row">
        <label class="form-label">Fáza</label>
        <select id="df-stage">${STAGES.map(s => `<option${d.stage === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">Hodnota (€)</label><input id="df-value" type="number" value="${d.value || ''}" /></div>
        <div class="form-row"><label class="form-label">Pravdep. (%)</label><input id="df-prob" type="number" min="0" max="100" value="${d.probability || ''}" /></div>
      </div>
      <div class="form-row"><label class="form-label">Plánované uzatvorenie</label><input id="df-close" type="date" value="${d.expectedClose || ''}" /></div>
      <div class="form-row"><label class="form-label">Poznámky</label><textarea id="df-notes" style="min-height:60px;resize:vertical;">${esc(d.notes || '')}</textarea></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="pipelineView.save('${d.id || ''}', ${isNew})">Uložiť</button>
        <button class="btn-ghost" onclick="modal.close()">Zrušiť</button>
        ${!isNew ? `<button class="btn-danger" style="margin-left:auto;" onclick="pipelineView.delete('${d.id}')">Vymazať</button>` : ''}
      </div>`;
  },

  openAdd() {
    modal.open('Nová príležitosť', this._form(
      { name: '', contactId: '', value: '', stage: 'Kontakt', probability: 20, expectedClose: '', notes: '' }, true
    ));
  },

  openEdit(id) {
    const d = app.state.deals.find(x => x.id === id);
    if (d) modal.open('Upraviť príležitosť', this._form(d, false));
  },

  save(id, isNew) {
    const obj = {
      name:          document.getElementById('df-name').value.trim(),
      contactId:     document.getElementById('df-contact').value,
      stage:         document.getElementById('df-stage').value,
      value:         Number(document.getElementById('df-value').value) || 0,
      probability:   Number(document.getElementById('df-prob').value) || 0,
      expectedClose: document.getElementById('df-close').value,
      notes:         document.getElementById('df-notes').value.trim(),
    };
    if (!obj.name) return;
    if (isNew) {
      app.state.deals.push({ ...obj, id: uid(), createdAt: new Date().toISOString() });
    } else {
      app.state.deals = app.state.deals.map(d => d.id === id ? { ...d, ...obj } : d);
    }
    db.set('deals', app.state.deals);
    modal.close();
    app.updateFooter();
    app.renderContent();
  },

  delete(id) {
    if (!confirm('Vymazať obchod?')) return;
    app.state.deals = app.state.deals.filter(d => d.id !== id);
    db.set('deals', app.state.deals);
    modal.close();
    app.updateFooter();
    app.renderContent();
  },
};
