// ── js/auth.js — prihlásenie / registrácia ───────────────────────────────────

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
    // Počúvaj zmeny auth stavu
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

  async signup(email, password, name) {
    const { error } = await db.client.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) throw error;
  },

  async logout() {
    await db.client.auth.signOut();
  },

  // Render login / registrácia
  renderLoginScreen() {
    return `
      <div style="min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="width:100%;max-width:400px;">

          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:11px;color:var(--acc);font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Axiona</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;">CRM</div>
          </div>

          <!-- Tabs -->
          <div style="display:flex;background:var(--surf);border:1px solid var(--brd);border-radius:10px;padding:4px;margin-bottom:24px;">
            <button id="tab-login" onclick="auth.switchTab('login')"
              style="flex:1;padding:8px;border:none;border-radius:7px;font-size:13px;font-weight:600;
                     background:var(--card);color:var(--txt);cursor:pointer;">
              Prihlásiť sa
            </button>
            <button id="tab-signup" onclick="auth.switchTab('signup')"
              style="flex:1;padding:8px;border:none;border-radius:7px;font-size:13px;font-weight:500;
                     background:transparent;color:var(--muted);cursor:pointer;">
              Registrácia
            </button>
          </div>

          <!-- Login form -->
          <div id="form-login" class="card" style="padding:24px;">
            <div class="form-row"><label class="form-label">Email</label><input id="auth-email" type="email" placeholder="tvoj@email.sk" /></div>
            <div class="form-row"><label class="form-label">Heslo</label><input id="auth-password" type="password" placeholder="••••••••"
              onkeydown="if(event.key==='Enter') auth.doLogin();" /></div>
            <div id="auth-error" style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
            <button class="btn-primary" style="width:100%;padding:11px;" onclick="auth.doLogin()" id="btn-login">
              Prihlásiť sa
            </button>
          </div>

          <!-- Signup form -->
          <div id="form-signup" class="card" style="padding:24px;display:none;">
            <div class="form-row"><label class="form-label">Meno</label><input id="auth-name" type="text" placeholder="Ján Novák" /></div>
            <div class="form-row"><label class="form-label">Email</label><input id="auth-email2" type="email" placeholder="tvoj@email.sk" /></div>
            <div class="form-row"><label class="form-label">Heslo</label><input id="auth-password2" type="password" placeholder="min. 6 znakov"
              onkeydown="if(event.key==='Enter') auth.doSignup();" /></div>
            <div id="auth-error2" style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(242,85,85,0.1);border-radius:6px;"></div>
            <div id="auth-success" style="display:none;color:var(--green);font-size:12px;margin-bottom:12px;padding:8px;background:rgba(62,207,142,0.1);border-radius:6px;"></div>
            <button class="btn-primary" style="width:100%;padding:11px;" onclick="auth.doSignup()" id="btn-signup">
              Zaregistrovať sa
            </button>
          </div>

        </div>
      </div>`;
  },

  switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('form-login').style.display  = isLogin ? '' : 'none';
    document.getElementById('form-signup').style.display = isLogin ? 'none' : '';
    document.getElementById('tab-login').style.background  = isLogin ? 'var(--card)' : 'transparent';
    document.getElementById('tab-login').style.color       = isLogin ? 'var(--txt)' : 'var(--muted)';
    document.getElementById('tab-signup').style.background = isLogin ? 'transparent' : 'var(--card)';
    document.getElementById('tab-signup').style.color      = isLogin ? 'var(--muted)' : 'var(--txt)';
  },

  async doLogin() {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    const btn      = document.getElementById('btn-login');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Prihlasujem...';
    try {
      await this.login(email, password);
    } catch(e) {
      errEl.textContent = 'Nesprávny email alebo heslo.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Prihlásiť sa';
    }
  },

  async doSignup() {
    const name     = document.getElementById('auth-name').value.trim();
    const email    = document.getElementById('auth-email2').value.trim();
    const password = document.getElementById('auth-password2').value;
    const errEl    = document.getElementById('auth-error2');
    const sucEl    = document.getElementById('auth-success');
    const btn      = document.getElementById('btn-signup');
    errEl.style.display = 'none'; sucEl.style.display = 'none';
    if (!name || !email || password.length < 6) {
      errEl.textContent = 'Vyplň všetky polia. Heslo min. 6 znakov.';
      errEl.style.display = 'block'; return;
    }
    btn.disabled = true; btn.textContent = 'Registrujem...';
    try {
      await this.signup(email, password, name);
      sucEl.textContent = 'Skontroluj email a potvrď registráciu.';
      sucEl.style.display = 'block';
      btn.textContent = 'Odoslané ✓';
    } catch(e) {
      errEl.textContent = e.message || 'Chyba pri registrácii.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Zaregistrovať sa';
    }
  },
};
