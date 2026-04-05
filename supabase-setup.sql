-- ══════════════════════════════════════════════
-- Axiona CRM — Supabase schema
-- Spusti celý tento súbor v SQL Editor
-- ══════════════════════════════════════════════

-- ── Helper: zistí či je prihlásený user admin ──
create or replace function is_admin()
returns boolean
language sql
security definer stable
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  );
$$;

-- ── Profiles (rozšírenie auth.users) ──────────
create table if not exists profiles (
  id        uuid references auth.users on delete cascade primary key,
  email     text,
  name      text,
  role      text not null default 'partner'
              check (role in ('admin', 'partner')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_policy" on profiles;
create policy "profiles_policy" on profiles for all
  using  (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- Auto-vytvor profil po registrácii
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Contacts ───────────────────────────────────
create table if not exists contacts (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  company    text,
  phone      text,
  email      text,
  type       text default 'Klient',
  notes      text,
  owner_id   uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table contacts enable row level security;

drop policy if exists "contacts_policy" on contacts;
create policy "contacts_policy" on contacts for all
  using  (is_admin() or owner_id = auth.uid())
  with check (is_admin() or owner_id = auth.uid());

-- ── Deals ──────────────────────────────────────
create table if not exists deals (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  contact_id      uuid references contacts on delete set null,
  value           numeric default 0,
  stage           text default 'Kontakt',
  probability     integer default 0,
  expected_close  date,
  notes           text,
  owner_id        uuid references auth.users on delete set null,
  created_at      timestamptz default now()
);

alter table deals enable row level security;

drop policy if exists "deals_policy" on deals;
create policy "deals_policy" on deals for all
  using  (is_admin() or owner_id = auth.uid())
  with check (is_admin() or owner_id = auth.uid());

-- ── Commissions ────────────────────────────────
create table if not exists commissions (
  id         uuid default gen_random_uuid() primary key,
  deal_id    uuid references deals on delete set null,
  contact_id uuid references contacts on delete set null,
  amount     numeric not null,
  rate       numeric default 0,
  status     text default 'Čakajúca',
  date       date,
  notes      text,
  owner_id   uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table commissions enable row level security;

drop policy if exists "commissions_policy" on commissions;
create policy "commissions_policy" on commissions for all
  using  (is_admin() or owner_id = auth.uid())
  with check (is_admin() or owner_id = auth.uid());

-- ══════════════════════════════════════════════
-- Po spustení: nastav seba ako admin
-- (zmeň email@tvoj.sk na svoj email)
-- ══════════════════════════════════════════════
-- update profiles set role = 'admin'
-- where email = 'email@tvoj.sk';
