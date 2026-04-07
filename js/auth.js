// ── js/auth.js ───────────────────────────────────────────────────────────────

const auth = {
  user:    null,
  profile: null,

  get isAdmin() { return this.profile?.role === 'admin'; },

  async init() {
    const { data: { session } } = await db.client.auth.getSession();
    if (session?.user) {
      this.user    = session.user;
      this.profile = await db.getProfile();
    }
    db.client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        this.user    = session.user;
        this.profile = await db.getProfile();
        await app.boot();
      } else if (event === 'SIGNED_OUT') {
        this.user    = null;
        this.profile = null;
        app.showLogin();
      }
    });
  },

  async login(email, password) {
    const { error } = await db.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signup(email, password, name, refCode) {
    const { data, error } = await db.client.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) throw error;
    // Nastav referral väzbu ak bol zadaný kód
    if (refCode && data.user) {
      await db.setReferredBy(data.user.id, refCode);
    }
    return data;
  },

  async logout() {
    await db.client.auth.signOut();
  },

  _getRefFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || '';
  },

  renderLoginScreen() {
    const refCode   = this._getRefFromUrl();
    const startTab  = refCode ? 'signup' : 'login';

    return `
      <div style="min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="width:100%;max-width:400px;">

          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:11px;color:var(--acc);font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Axiona</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;">CRM</div>
            ${refCode ? `
              <div style="margin-top:10px;font-size:12px;color:var(--green);background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.2);border-radius:8px;padding:6px 14px;display:inline-block;">
                🔗 Pozývací kód: <strong>${esc(refCode)}</strong>
              </div>` : ''}
          </div>

          ${refCode
            ? `<!-- Len registrácia — prišiel cez referral link -->
               <div id="form-signup" class="card" style="padding:24px;">
                 ${this._signupForm(refCode)}
               </div>`
            : `<!-- Tabs — priame otvorenie -->
               <div style="display:flex;background:var(--surf);border:1px solid var(--brd);border-radius:10px;padding:4px;margin-bottom:24px;">
                 <button id="tab-login" onclick="auth.switchTab('login')"
                   style="flex:1;padding:8px;border:none;border-radius:7px;font-size:13px;font-weight:600;
                     background:var(--card);color:var(--txt);cursor:pointer;font-family:inherit;">
                   Prihlásiť sa
                 </button>
                 <button id="tab-signup" onclick="auth.switchTab('signup')"
                   style="flex:1;padding:8px;border:none;border-radius:7px;font-size:13px;font-weight:500;
                     background:transparent;color:var(--muted);cursor:pointer;font-family:inherit;">
                   Registrácia
                 </button>
               </div>
               <div id="form-login" class="card" style="padding:24px;">
                 ${this._loginForm()}
               </div>
               <div id="form-signup" class="card" style="padding:24px;display:none;">
                 ${this._signupForm('')}
               </div>`}

        </div>
      </div>`;
  },

  _loginForm() {
    return `
      <div class="form-row"><label class="form-label">Email</label>
        <input id="auth-email" type="email" placeholder="tvoj@email.sk"
          onkeydown="if(event.key==='Enter') auth.doLogin();" /></div>
      <div class="form-row"><label class="form-label">Heslo</label>
        <input id="auth-password" type="password" placeholder="••••••••"
          onkeydown="if(event.key==='Enter') auth.doLogin();" /></div>
      <div id="auth-error" style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <button class="btn-primary" style="width:100%;padding:11px;" onclick="auth.doLogin()" id="btn-login">
        Prihlásiť sa
      </button>`;
  },

  _signupForm(refCode) {
    return `
      <div class="form-row"><label class="form-label">Meno a priezvisko *</label>
        <input id="auth-name" type="text" placeholder="Ján Novák" /></div>
      <div class="form-row"><label class="form-label">Email *</label>
        <input id="auth-email2" type="email" placeholder="tvoj@email.sk" /></div>
      <div class="form-row"><label class="form-label">Heslo *</label>
        <input id="auth-password2" type="password" placeholder="min. 6 znakov"
          onkeydown="if(event.key==='Enter') auth.doSignup();" /></div>
      <div class="form-row">
        <label class="form-label">Pozývací kód <span style="color:var(--muted);font-weight:400;">(nepovinný)</span></label>
        <input id="auth-refcode" type="text" placeholder="napr. A7BF166B"
          value="${esc(refCode)}"
          style="${refCode ? 'border-color:rgba(62,207,142,0.5);' : ''}" />
      </div>
      <div id="auth-error2"   style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
      <div id="auth-success2" style="display:none;color:var(--green);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(62,207,142,0.1);border-radius:6px;"></div>
      <button class="btn-primary" style="width:100%;padding:11px;" onclick="auth.doSignup()" id="btn-signup">
        Zaregistrovať sa
      </button>`;
  },

  switchTab(tab) {
    const isLogin = tab === 'login';
    const fLogin  = document.getElementById('form-login');
    const fSignup = document.getElementById('form-signup');
    const tLogin  = document.getElementById('tab-login');
    const tSignup = document.getElementById('tab-signup');
    if (fLogin)  fLogin.style.display  = isLogin ? '' : 'none';
    if (fSignup) fSignup.style.display = isLogin ? 'none' : '';
    if (tLogin) {
      tLogin.style.background = isLogin ? 'var(--card)' : 'transparent';
      tLogin.style.color      = isLogin ? 'var(--txt)'  : 'var(--muted)';
      tLogin.style.fontWeight = isLogin ? '600' : '400';
    }
    if (tSignup) {
      tSignup.style.background = isLogin ? 'transparent' : 'var(--card)';
      tSignup.style.color      = isLogin ? 'var(--muted)' : 'var(--txt)';
      tSignup.style.fontWeight = isLogin ? '400' : '600';
    }
  },

  async doLogin() {
    const email    = (document.getElementById('auth-email')?.value    || '').trim();
    const password =  document.getElementById('auth-password')?.value || '';
    const errEl    =  document.getElementById('auth-error');
    const btn      =  document.getElementById('btn-login');
    if (errEl) errEl.style.display = 'none';
    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Vyplň email a heslo.'; errEl.style.display = 'block'; }
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Prihlasujem...'; }
    try {
      await this.login(email, password);
    } catch(e) {
      if (errEl) { errEl.textContent = 'Nesprávny email alebo heslo.'; errEl.style.display = 'block'; }
      if (btn)   { btn.disabled = false; btn.textContent = 'Prihlásiť sa'; }
    }
  },

  async doSignup() {
    const name     = (document.getElementById('auth-name')?.value      || '').trim();
    const email    = (document.getElementById('auth-email2')?.value    || '').trim();
    const password =  document.getElementById('auth-password2')?.value || '';
    const refCode  = (document.getElementById('auth-refcode')?.value   || '').trim().toUpperCase();
    const errEl    =  document.getElementById('auth-error2');
    const sucEl    =  document.getElementById('auth-success2');
    const btn      =  document.getElementById('btn-signup');

    if (errEl) errEl.style.display = 'none';
    if (sucEl) sucEl.style.display = 'none';

    if (!name) {
      if (errEl) { errEl.textContent = 'Zadaj meno a priezvisko.'; errEl.style.display = 'block'; }
      return;
    }
    if (!email) {
      if (errEl) { errEl.textContent = 'Zadaj email.'; errEl.style.display = 'block'; }
      return;
    }
    if (password.length < 6) {
      if (errEl) { errEl.textContent = 'Heslo musí mať aspoň 6 znakov.'; errEl.style.display = 'block'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Registrujem...'; }

    try {
      await this.signup(email, password, name, refCode);
      if (sucEl) {
        sucEl.textContent   = '✓ Registrácia úspešná! Skontroluj email a potvrď účet.';
        sucEl.style.display = 'block';
      }
      if (btn) { btn.textContent = 'Odoslané ✓'; }
    } catch(e) {
      const msg = e.message?.includes('already registered')
        ? 'Tento email je už zaregistrovaný.'
        : (e.message || 'Chyba pri registrácii.');
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (btn)   { btn.disabled = false; btn.textContent = 'Zaregistrovať sa'; }
    }
  },
};
