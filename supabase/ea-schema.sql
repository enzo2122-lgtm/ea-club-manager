-- Clubbo : le serveur commun de tous les clubs (Supabase → SQL Editor → New query → coller → Run).
-- Chaque donnée porte l'identifiant de son club : aucune fonction ne lit ni n'écrit en dehors du club de celui qui la demande.
-- Les tables sont fermées (row level security sans règle) : tout passe par les fonctions ci-dessous.
-- Le script peut être relancé sans perte (mise à jour du serveur).

/* ================= tables ================= */
-- La plateforme : la clé du propriétaire (hachée) et les codes d'activation qu'il remet aux clubs
create table if not exists ea_platform (id int primary key default 1, owner_key_hash text, installed_at timestamptz not null default now());
insert into ea_platform (id) values (1) on conflict (id) do nothing;
create table if not exists ea_activation (code text primary key, note text, created_at timestamptz not null default now(), used_by text, used_at timestamptz);
create table if not exists clubs (id text primary key, slug text not null unique, name text not null, status text not null default 'active' check (status in ('active', 'suspended')),
  invite text unique, created_at timestamptz not null default now(), last_seen timestamptz);
-- Les comptes des dirigeants (nom + prénom + mot de passe) et leurs connexions
create table if not exists accounts (club text not null references clubs(id) on delete cascade, staff_id text not null, last_key text not null, first_keys text[] not null default '{}',
  display text not null default '', salt text, pw_hash text, admin boolean not null default false, teams_set boolean not null default false,
  fails int not null default 0, locked_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (club, staff_id));
create table if not exists sessions (token_hash text primary key, club text not null references clubs(id) on delete cascade, staff_id text not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null);
-- Les données du club (licenciés, dirigeants, séances, matchs, schémas…), une ligne par élément, partagées par tous ses appareils
create table if not exists items (club text not null references clubs(id) on delete cascade, col text not null, id text not null, data jsonb,
  updated_at bigint not null default 0, deleted boolean not null default false, rev bigint not null, primary key (club, col, id));
create sequence if not exists items_rev;
create index if not exists items_club_rev on items (club, rev);
create table if not exists messages (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, created_at timestamptz not null default now(),
  channel text not null, author_id text, author_name text, body text not null check (length(body) between 1 and 2000));
create index if not exists messages_club on messages (club, created_at);
create table if not exists bookings (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, created_at timestamptz not null default now(),
  date date not null, start_min int not null, end_min int not null, field text not null default 'T1', part text not null check (part in ('full','A','B')),
  kind text not null default 'entrainement', team_id text, team_name text, author_id text, author_name text, note text, series text);
create index if not exists bookings_club on bookings (club, date);
create table if not exists slots (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade,
  weekday int not null, start_min int not null, end_min int not null, field text not null default 'T1');
create table if not exists answers (club text not null references clubs(id) on delete cascade, match_id text not null, player_id text not null,
  status text not null check (status in ('oui', 'non')), seats int not null default 0, note text, by_coach boolean not null default false,
  updated_at timestamptz not null default now(), primary key (club, match_id, player_id));
create table if not exists match_photos (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, created_at timestamptz not null default now(),
  match_id text not null, src text, by_name text, data text not null check (length(data) < 600000));
create index if not exists match_photos_match on match_photos (club, match_id);
create table if not exists push_config (id int primary key default 1, secret text not null default replace(gen_random_uuid()::text, '-', ''), fn_url text, vapid_public text, vapid_private jsonb);
insert into push_config (id) values (1) on conflict (id) do nothing;
create table if not exists push_subs (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, staff_id text not null,
  endpoint text not null unique, prefs jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists notifs (id bigserial primary key, club text not null references clubs(id) on delete cascade, staff_id text not null, created_at timestamptz not null default now(),
  kind text, tag text, title text, body text, url text, n int not null default 1, delivered boolean not null default false);
create index if not exists notifs_staff on notifs (club, staff_id, delivered);
create table if not exists message_reads (club text not null references clubs(id) on delete cascade, channel text not null, staff_id text not null, at timestamptz not null,
  primary key (club, channel, staff_id));
create table if not exists backups (id bigserial primary key, club text not null references clubs(id) on delete cascade, created_at timestamptz not null default now(),
  kind text not null default 'auto', size int, data jsonb not null);
create table if not exists member_codes (club text not null references clubs(id) on delete cascade, player_id text not null, code text not null unique,
  created_at timestamptz not null default now(), used_at timestamptz, given_at timestamptz, given_by text, first_at timestamptz, primary key (club, player_id));
do $rls$ declare t text; begin
  foreach t in array array['ea_platform', 'ea_activation', 'clubs', 'accounts', 'sessions', 'items', 'messages', 'bookings', 'slots', 'answers', 'match_photos',
    'push_config', 'push_subs', 'notifs', 'message_reads', 'backups', 'member_codes'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $rls$;
-- (1.23) la fonction « raincy-push » lit la configuration des notifications et range les abonnements disparus
grant select, update on push_config to service_role;
grant select, delete on push_subs to service_role;

/* ================= outils ================= */
create or replace function ea_hash(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex') $$;
create or replace function ea_token() returns text language sql volatile as $$ select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;
-- n caractères faciles à lire (sans I, L, O, 0, 1)
create or replace function ea_code(n int) returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(decode(md5(gen_random_uuid()::text || i::text), 'hex'), 0) % 31, 1), '') from generate_series(1, n) i $$;
-- Le club d'une clé : la connexion d'un dirigeant, ou le code d'invitation du club
create or replace function ea_club(k text) returns text language sql stable security definer set search_path = public as $$
  select case when coalesce(k, '') = '' then null else coalesce(
    (select s.club from sessions s join clubs c on c.id = s.club and c.status = 'active' where s.token_hash = ea_hash(k) and s.expires_at > now()),
    (select id from clubs where invite = k and status = 'active')) end $$;
create or replace function ea_need(k text) returns text language plpgsql stable security definer set search_path = public as $$
declare c text := ea_club(k); begin if c is null then raise exception 'CLE_CLUB'; end if; return c; end $$;
-- Un responsable de ce club (sa connexion)
create or replace function ea_admin(k text, c text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(k, '') <> '' and exists (select 1 from sessions s join accounts a on a.club = s.club and a.staff_id = s.staff_id
    where s.token_hash = ea_hash(k) and s.expires_at > now() and s.club = c and a.admin) $$;
create or replace function ea_staff(t text) returns text language sql stable security definer set search_path = public as $$
  select staff_id from sessions where coalesce(t, '') <> '' and token_hash = ea_hash(t) and expires_at > now() $$;
create or replace function ea_short(p jsonb) returns text language sql immutable as $$
  select trim(coalesce(p->>'firstName', '') || case when coalesce(p->>'lastName', '') <> '' then ' ' || upper(left(p->>'lastName', 1)) || '.' else '' end) $$;
create or replace function ea_day(d date) returns text language sql immutable as $$
  select (array['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'])[extract(dow from d)::int + 1] || ' ' || to_char(d, 'DD/MM') $$;
create or replace function ea_hm(m int) returns text language sql immutable as $$ select lpad((m / 60)::text, 2, '0') || 'h' || lpad((m % 60)::text, 2, '0') $$;
create or replace function ea_coach(n text) returns text language sql immutable as $$
  select coalesce('Coach ' || (select w from regexp_split_to_table(coalesce(n, ''), '\s+') w where w ~ '[a-zà-ÿ]' limit 1), nullif(n, ''), 'Un coach') $$;
create or replace function ea_arr(j jsonb) returns text[] language sql immutable as $$
  select array(select jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end)) $$;

/* ================= comptes ================= */
create or replace function ea_new_session(c text, p_staff text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := ea_token(); a accounts; cl clubs;
begin
  select * into a from accounts where club = c and staff_id = p_staff;
  select * into cl from clubs where id = c;
  delete from sessions where expires_at < now();
  insert into sessions (token_hash, club, staff_id, expires_at) values (ea_hash(t), c, p_staff, now() + interval '400 days');
  update accounts set fails = 0, locked_until = null where club = c and staff_id = p_staff;
  return jsonb_build_object('token', t, 'staff_id', a.staff_id, 'admin', a.admin, 'teams_set', a.teams_set, 'display', a.display, 'last_key', a.last_key,
    'club', jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name));
end $$;
-- Un club se crée avec un code d'activation remis par le propriétaire de la plateforme ; son créateur en est le premier responsable
create or replace function ea_create_club(p_code text, p_name text, p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a ea_activation; c text := replace(gen_random_uuid()::text, '-', ''); s text := ea_token(); sl text := lower(regexp_replace(coalesce(p_slug, ''), '[^A-Za-z0-9-]', '', 'g'));
  sid text := p->>'staff_id';
begin
  select * into a from ea_activation where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g')) for update;
  if a.code is null or a.used_by is not null then raise exception 'ACTIVATION'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(sl) < 3 or length(sl) > 30 then raise exception 'DONNEES'; end if;
  if exists (select 1 from clubs where slug = sl) then raise exception 'SLUG_PRIS'; end if;
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  insert into clubs (id, slug, name, invite) values (c, sl, left(trim(p_name), 80), ea_code(12));
  update ea_activation set used_by = c, used_at = now() where code = a.code;
  insert into accounts (club, staff_id, last_key, first_keys, display, salt, pw_hash, admin, teams_set)
    values (c, sid, p->>'last_key', ea_arr(p->'first_keys'), coalesce(p->>'display', ''), s, ea_hash(s || (p->>'h')), true, true);
  insert into items (club, col, id, data, updated_at, rev) values (c, 'club', 'club', jsonb_build_object('name', left(trim(p_name), 80)), (extract(epoch from now()) * 1000)::bigint, nextval('items_rev'));
  return ea_new_session(c, sid);
end $$;
-- Connexion : le code du club (ex. « fc-exemple ») + nom + prénom + mot de passe (l'appli n'envoie jamais le mot de passe, seulement une empreinte lente)
create or replace function club_login(p_club text, p_last text, p_first text, p_h text) returns jsonb language plpgsql security definer set search_path = public as $$
declare cl clubs; a accounts; f1 text := split_part(coalesce(p_first, ''), ' ', 1);
begin
  select * into cl from clubs where slug = lower(trim(coalesce(p_club, ''))) or invite = trim(coalesce(p_club, '')) limit 1;
  if cl.id is null then return jsonb_build_object('error', 'CLUB_INCONNU'); end if;
  if cl.status <> 'active' then return jsonb_build_object('error', 'CLUB_SUSPENDU'); end if;
  select * into a from accounts where club = cl.id and last_key = p_last and pw_hash is not null and (p_first = any(first_keys) or f1 = any(first_keys))
    order by (p_first = any(first_keys)) desc, updated_at desc limit 1;
  if a.staff_id is null then return jsonb_build_object('error', 'COMPTE_INCONNU'); end if;
  if a.locked_until > now() then return jsonb_build_object('error', 'BLOQUE'); end if;
  if ea_hash(a.salt || coalesce(p_h, '')) <> a.pw_hash then
    update accounts set fails = case when fails >= 4 then 0 else fails + 1 end,
      locked_until = case when fails >= 4 then now() + interval '5 minutes' else locked_until end where club = cl.id and staff_id = a.staff_id;
    return jsonb_build_object('error', 'MOT_DE_PASSE');
  end if;
  return ea_new_session(cl.id, a.staff_id);
end $$;
-- Première connexion d'un dirigeant (lien d'invitation), ou nouveau mot de passe donné par un responsable
create or replace function club_register(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := coalesce(ea_club(admin_k), ea_club(k)); is_adm boolean; sid text := p->>'staff_id'; s text := ea_token(); a accounts;
begin
  if c is null then raise exception 'CLE_CLUB'; end if;
  is_adm := ea_admin(admin_k, c);
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  select * into a from accounts where club = c and staff_id = sid;
  if a.pw_hash is not null and not is_adm then raise exception 'DEJA_INSCRIT'; end if;
  insert into accounts (club, staff_id, last_key, first_keys, display, salt, pw_hash, admin)
    values (c, sid, p->>'last_key', ea_arr(p->'first_keys'), coalesce(p->>'display', ''), s, ea_hash(s || (p->>'h')), coalesce((p->>'admin')::boolean, false) and is_adm)
    on conflict (club, staff_id) do update set last_key = excluded.last_key, first_keys = excluded.first_keys, display = excluded.display, salt = excluded.salt,
      pw_hash = excluded.pw_hash, admin = accounts.admin or excluded.admin, updated_at = now();
  delete from sessions where club = c and staff_id = sid;
  return ea_new_session(c, sid);
end $$;
create or replace function club_accounts(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'display', display, 'admin', admin, 'teams_set', teams_set, 'has_pw', pw_hash is not null)), '[]'::jsonb)
  from accounts where club = c); end $$;
create or replace function club_account_set(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); sid text := p->>'staff_id';
begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if;
  if p ? 'admin' then update accounts set admin = (p->>'admin')::boolean, updated_at = now() where club = c and staff_id = sid; end if;
  if p ? 'teams_set' then update accounts set teams_set = (p->>'teams_set')::boolean, updated_at = now() where club = c and staff_id = sid; end if;
  if coalesce((p->>'reset')::boolean, false) then update accounts set pw_hash = null, salt = null, updated_at = now() where club = c and staff_id = sid; delete from sessions where club = c and staff_id = sid; end if;
  if coalesce((p->>'delete')::boolean, false) then delete from sessions where club = c and staff_id = sid; delete from accounts where club = c and staff_id = sid; end if;
  return to_jsonb(true); end $$;
create or replace function club_me(t text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_club(t); sid text := ea_staff(t); a accounts; cl clubs;
begin if c is null or sid is null then return jsonb_build_object('error', 'SESSION'); end if;
  select * into a from accounts where club = c and staff_id = sid;
  if a.staff_id is null then return jsonb_build_object('error', 'SESSION'); end if;
  select * into cl from clubs where id = c;
  return jsonb_build_object('staff_id', a.staff_id, 'admin', a.admin, 'teams_set', a.teams_set, 'display', a.display, 'last_key', a.last_key,
    'club', jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name)); end $$;
create or replace function club_teams_done(t text) returns jsonb language plpgsql security definer set search_path = public as $$
begin update accounts set teams_set = true, updated_at = now() where club = ea_club(t) and staff_id = ea_staff(t); return to_jsonb(found); end $$;
create or replace function club_change_pw(t text, p_old text, p_new text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_club(t); sid text := ea_staff(t); a accounts; s text := ea_token();
begin if c is null or sid is null then raise exception 'SESSION'; end if;
  select * into a from accounts where club = c and staff_id = sid;
  if ea_hash(a.salt || coalesce(p_old, '')) <> a.pw_hash then return jsonb_build_object('error', 'MOT_DE_PASSE'); end if;
  if length(coalesce(p_new, '')) < 32 then raise exception 'DONNEES'; end if;
  update accounts set salt = s, pw_hash = ea_hash(s || p_new), updated_at = now() where club = c and staff_id = sid;
  delete from sessions where club = c and staff_id = sid and token_hash <> ea_hash(t);
  return to_jsonb(true); end $$;
create or replace function club_logout(t text) returns jsonb language plpgsql security definer set search_path = public as $$
begin delete from sessions where token_hash = ea_hash(t); return to_jsonb(true); end $$;
-- Le lien d'invitation des dirigeants (un responsable peut en refaire un, ce qui annule l'ancien) et le code du club
create or replace function club_invite(k text, admin_k text, p_new boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); v text;
begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if;
  select invite into v from clubs where id = c;
  if v is null or p_new then v := ea_code(12); update clubs set invite = v where id = c; end if;
  return to_jsonb(v); end $$;
create or replace function club_info(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select jsonb_build_object('id', id, 'slug', slug, 'name', name, 'created', created_at) from clubs where id = c); end $$;

/* ================= données partagées ================= */
create or replace function club_pull(k text, p_since bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin
  update clubs set last_seen = now() where id = c and (last_seen is null or last_seen < now() - interval '10 minutes');
  return (select coalesce(jsonb_agg(jsonb_build_object('col', col, 'id', id, 'data', data, 'u', updated_at, 'del', deleted, 'rev', rev) order by rev), '[]'::jsonb)
    from (select * from items where club = c and rev > coalesce(p_since, 0) order by rev limit 1000) x); end $$;
create or replace function club_push(k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int;
begin
  perform pg_advisory_xact_lock(hashtext('items:' || c));
  insert into items (club, col, id, data, updated_at, deleted, rev)
    select c, x.col, x.id, case when coalesce(x.del, false) then null else x.data end, coalesce(x.u, 0), coalesce(x.del, false), nextval('items_rev')
    from jsonb_to_recordset(p) as x(col text, id text, data jsonb, u bigint, del boolean)
    where x.col in ('teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports', 'club') and coalesce(x.id, '') <> ''
  on conflict (club, col, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
    where excluded.updated_at >= items.updated_at;
  get diagnostics n = row_count; return to_jsonb(n); end $$;
create or replace function club_ping(k text) returns boolean language plpgsql security definer set search_path = public as $$
begin perform ea_need(k); return true; end $$;
create or replace function club_admin_ping(k text, admin_k text) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin return ea_admin(admin_k, c); end $$;

/* ================= messagerie, terrains, vestiaires ================= */
create or replace function club_messages(k text, since timestamptz default '1970-01-01') returns setof messages language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return query select * from messages where club = c and created_at > since order by created_at asc limit 500; end $$;
create or replace function club_post(k text, p_channel text, p_author_id text, p_author_name text, p_body text) returns messages language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); r messages;
begin insert into messages (club, channel, author_id, author_name, body) values (c, p_channel, p_author_id, p_author_name, p_body) returning * into r; return r; end $$;
create or replace function club_delete_message(k text, p_id uuid, p_author text, admin_k text default null) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin delete from messages where club = c and id = p_id and (author_id = p_author or ea_admin(admin_k, c)); return found; end $$;
create or replace function club_slots(k text) returns setof slots language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin return query select * from slots where club = c order by weekday, start_min; end $$;
create or replace function club_set_slots(k text, admin_k text, p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if;
  delete from slots where club = c;
  insert into slots (club, weekday, start_min, end_min, field) select c, x.weekday, x.start_min, x.end_min, coalesce(x.field, 'T1') from jsonb_to_recordset(p) as x(weekday int, start_min int, end_min int, field text);
  return true; end $$;
create or replace function club_bookings(k text, d_from date, d_to date) returns setof bookings language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return query select * from bookings where club = c and date between d_from and d_to order by date, start_min; end $$;
-- Un terrain entier bloque tout ; deux demi-terrains (A et B) peuvent servir en même temps
create or replace function club_book(k text, p jsonb) returns bookings language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); r bookings; d date := (p->>'date')::date; s int := (p->>'start_min')::int; e int := (p->>'end_min')::int;
  f text := coalesce(p->>'field', 'T1'); want text := p->>'part'; chosen text;
begin
  if e <= s then raise exception 'HORAIRE'; end if;
  perform pg_advisory_xact_lock(hashtext(c || f || d::text));
  if exists (select 1 from slots where club = c and field = f) and not exists (select 1 from slots x where x.club = c and x.field = f and x.weekday = extract(dow from d)::int and x.start_min <= s and x.end_min >= e) then
    raise exception 'HORS_CRENEAU'; end if;
  foreach chosen in array (case when want = 'half' then array['A','B'] else array[want] end) loop
    if not exists (select 1 from bookings b where b.club = c and b.field = f and b.date = d and b.start_min < e and s < b.end_min and (b.part = 'full' or chosen = 'full' or b.part = chosen)) then
      insert into bookings (club, date, start_min, end_min, field, part, kind, team_id, team_name, author_id, author_name, note, series)
        values (c, d, s, e, f, chosen, coalesce(p->>'kind', 'entrainement'), p->>'team_id', p->>'team_name', p->>'author_id', p->>'author_name', p->>'note', p->>'series') returning * into r;
      return r;
    end if;
  end loop;
  raise exception 'CRENEAU_PRIS';
end $$;
create or replace function club_unbook(k text, p_id uuid, p_author text, admin_k text default null) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin delete from bookings where club = c and id = p_id and (author_id = p_author or ea_admin(admin_k, c)); return found; end $$;
create or replace function club_unbook_series(k text, p_series text, p_author text, admin_k text default null) returns int language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int;
begin delete from bookings where club = c and series = p_series and date >= current_date and (author_id = p_author or ea_admin(admin_k, c));
  get diagnostics n = row_count; return n; end $$;

/* ================= convocations, photos ================= */
create or replace function club_answers(k text, p_matches text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select coalesce(jsonb_agg(jsonb_build_object('match_id', match_id, 'player_id', player_id, 'status', status, 'seats', seats, 'note', note, 'by_coach', by_coach, 'at', updated_at)), '[]'::jsonb)
  from answers where club = c and match_id = any(p_matches)); end $$;
create or replace function club_set_answer(k text, p_match text, p_player text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_match and player_id = p_player; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, by_coach) values (c, p_match, p_player, p_status, true)
    on conflict (club, match_id, player_id) do update set status = excluded.status, by_coach = true, updated_at = now();
  return to_jsonb(true); end $$;
create or replace function club_photo_add(k text, p_match text, p_src text, p_data text, p_by text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); r uuid;
begin
  if coalesce(p_data, '') not like 'data:image/jpeg;base64,%' or length(p_data) >= 600000 then raise exception 'DONNEES'; end if;
  delete from match_photos where created_at < now() - interval '90 days';
  select id into r from match_photos where club = c and match_id = p_match and src = p_src limit 1;
  if r is not null then return to_jsonb(r); end if;
  if (select count(*) from match_photos where club = c and match_id = p_match) >= 12 then raise exception 'PHOTOS_MAX'; end if;
  insert into match_photos (club, match_id, src, by_name, data) values (c, p_match, p_src, left(p_by, 80), p_data) returning id into r;
  return to_jsonb(r); end $$;
create or replace function club_photos(k text, p_match text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'src', src, 'by', by_name, 'at', created_at) order by created_at), '[]'::jsonb) from match_photos where club = c and match_id = p_match); end $$;
create or replace function club_photo_get(k text, p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin return (select data from match_photos where club = c and id = p_id); end $$;
create or replace function club_photo_del(k text, p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin delete from match_photos where club = c and id = p_id; return found; end $$;

/* ================= notifications ================= */
do $pg$ begin
  begin create extension if not exists pg_net with schema extensions;
  exception when others then raise notice 'pg_net indisponible : %', sqlerrm; end;
end $pg$;
-- Les dirigeants d'une catégorie du club (la catégorie et ses équipes A / B vont ensemble)
create or replace function ea_team_staff(c text, p_team text) returns text[] language sql stable security definer set search_path = public as $$
  with k as (select upper(replace(coalesce(data->>'category', data->>'name', ''), ' ', '')) as key from items where club = c and col = 'teams' and id = p_team),
  fam as (select t.id from items t, k where t.club = c and t.col = 'teams' and not t.deleted and upper(replace(coalesce(t.data->>'category', t.data->>'name', ''), ' ', '')) = k.key)
  select coalesce(array_agg(distinct st.id), '{}') from items st where st.club = c and st.col = 'staff' and not st.deleted
    and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) x where x = p_team or x in (select id from fam)) $$;
create or replace function ea_notify(c text, p_staff text[], p_kind text, p_tag text, p_title text, p_body text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare s text; targets text[] := '{}'; cfg push_config; subs jsonb;
begin
  foreach s in array coalesce(p_staff, '{}'::text[]) loop
    if s is null or s = '' then continue; end if;
    if exists (select 1 from notifs where club = c and staff_id = s and tag = p_tag and created_at > now() - interval '2 minutes' and (not delivered or p_kind = 'planning')) then
      update notifs set n = n + 1, title = left(p_title, 120), body = left(p_body, 240), url = p_url, delivered = false
        where id = (select max(id) from notifs where club = c and staff_id = s and tag = p_tag);
    else
      insert into notifs (club, staff_id, kind, tag, title, body, url) values (c, s, p_kind, p_tag, left(p_title, 120), left(p_body, 240), p_url);
      targets := targets || s;
    end if;
  end loop;
  delete from notifs where created_at < now() - interval '30 days';
  select * into cfg from push_config where id = 1;
  if cfg.fn_url is null or coalesce(array_length(targets, 1), 0) = 0 then return; end if;
  select jsonb_agg(jsonb_build_object('id', id, 'endpoint', endpoint)) into subs from push_subs
    where club = c and staff_id = any(targets) and (p_kind in ('mention', 'test') or coalesce((prefs->>p_kind)::boolean, true));
  if subs is null then return; end if;
  begin
    perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'envoi des notifications : %', sqlerrm; end;
end $$;
create or replace function ea_on_message() returns trigger language plpgsql security definer set search_path = public as $$
declare t text[]; tagged text[]; who text := ea_coach(new.author_name); title text; body text;
begin
  begin
    tagged := coalesce(string_to_array(substring(new.body from '\[\[tag:([\w,-]+)\]\]'), ','), '{}');
    body := left(btrim(regexp_replace(regexp_replace(new.body, '\[\[[^\]]*\]\]', '', 'g'), '#rappel-[\w-]+', '', 'g'), ' ' || chr(10) || chr(13)), 200);
    if new.channel = 'general' then
      t := array(select distinct staff_id from push_subs where club = new.club); title := '💬 Tout le club · ' || who;
    elsif new.channel like 'team:%' then
      t := ea_team_staff(new.club, substr(new.channel, 6));
      title := '💬 ' || coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = substr(new.channel, 6)), 'Catégorie') || ' · ' || who;
    elsif new.channel like 'dm:%' then
      t := string_to_array(substr(new.channel, 4), ':'); title := case when new.body like '🐞%' then '🐞 Signalement · ' else '✉️ ' end || who;
      tagged := array(select x from unnest(tagged) x where x = any(t));
    end if;
    t := array(select x from unnest(t) x where x <> coalesce(new.author_id, '') and not x = any(tagged));
    tagged := array(select x from unnest(tagged) x where x <> coalesce(new.author_id, ''));
    perform ea_notify(new.club, tagged, 'mention', 'tag:' || new.id, '📣 ' || who || ' t''a mentionné', body, '#/messages/' || new.channel);
    perform ea_notify(new.club, t, 'messages', 'msg:' || new.channel, title, body, '#/messages/' || new.channel);
  exception when others then raise notice 'notification du message : %', sqlerrm; end;
  return new;
end $$;
drop trigger if exists ea_msg_notify on messages;
create trigger ea_msg_notify after insert on messages for each row execute function ea_on_message();
create or replace function ea_on_booking() returns trigger language plpgsql security definer set search_path = public as $$
declare b bookings; t text[];
begin
  if tg_op = 'DELETE' then b := old; else b := new; end if;
  begin
    if b.team_id is null or b.date < current_date or b.date > current_date + 60 then return null; end if;
    t := array(select x from unnest(ea_team_staff(b.club, b.team_id)) x where tg_op = 'DELETE' or x <> coalesce(b.author_id, ''));
    perform ea_notify(b.club, t, 'planning', 'plan:' || b.team_id,
      case when coalesce(b.field, 'T1') like 'V%' then '🚪 Vestiaires · ' else '📅 Planning · ' end || coalesce(b.team_name, ''),
      case when tg_op = 'DELETE' then 'Libéré : ' else 'Réservé : ' end || ea_day(b.date) || ' ' || ea_hm(b.start_min) || '–' || ea_hm(b.end_min)
        || case when b.part = 'full' then '' else ' (demi-terrain ' || b.part || ')' end, case when coalesce(b.field, 'T1') like 'V%' then '#/vestiaires' else '#/planning' end);
  exception when others then raise notice 'notification du planning : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_booking_notify on bookings;
create trigger ea_booking_notify after insert or delete on bookings for each row execute function ea_on_booking();
create or replace function ea_on_item() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; t text[]; what text; team text; lbl text; ismatch boolean := new.col = 'matches'; dt date;
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    if new.deleted then
      if o is null then return null; end if;
      d := o; what := case when ismatch then 'Match supprimé' else 'Séance supprimée' end;
    else
      d := new.data;
      if coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
      if o is null then what := case when ismatch then 'Nouveau match' else 'Nouvelle séance' end;
      elsif (d->>'date') is distinct from (o->>'date') then what := 'Nouvelle date';
      elsif (d->>'time') is distinct from (o->>'time') or (ismatch and (d->>'rdv') is distinct from (o->>'rdv')) then what := 'Nouvel horaire';
      elsif ismatch and (d->>'place') is distinct from (o->>'place') then what := 'Nouveau lieu';
      else return null; end if;
    end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    t := array(select x from unnest(ea_team_staff(new.club, team)) x where x <> coalesce(d->>'editedBy', ''));
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    perform ea_notify(new.club, t, 'planning', 'plan:' || team, case when ismatch then '⚽ ' else '🏃 ' end || what || ' · ' || lbl,
      ea_day(dt) || coalesce(' ' || replace(nullif(d->>'time', ''), ':', 'h'), '')
        || case when ismatch then ' · ' || case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(d->>'opponent', '?') || coalesce(' · ' || nullif(d->>'place', ''), '')
           else coalesce(' · ' || nullif(d->>'title', ''), '') end,
      case when new.deleted then case when ismatch then '#/matchs' else '#/entrainements' end else case when ismatch then '#/match/' else '#/entrainement/' end || new.id end);
  exception when others then raise notice 'notification du planning : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_item_notify on items;
create trigger ea_item_notify after insert or update on items for each row execute function ea_on_item();
create or replace function club_push_key(k text) returns text language plpgsql security definer set search_path = public as $$
begin perform ea_need(k); return (select vapid_public from push_config where id = 1); end $$;
create or replace function club_push_sub(k text, p_endpoint text, p_prefs jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_club(k); sid text := ea_staff(k);
begin if c is null or sid is null then raise exception 'SESSION'; end if;
  if coalesce(p_endpoint, '') not like 'https://%' then raise exception 'DONNEES'; end if;
  insert into push_subs (club, staff_id, endpoint, prefs) values (c, sid, p_endpoint, coalesce(p_prefs, '{}'::jsonb))
    on conflict (endpoint) do update set club = excluded.club, staff_id = excluded.staff_id, prefs = excluded.prefs;
  return true; end $$;
create or replace function club_push_unsub(k text, p_endpoint text) returns boolean language plpgsql security definer set search_path = public as $$
begin delete from push_subs where endpoint = p_endpoint and club = ea_club(k) and staff_id = ea_staff(k); return found; end $$;
create or replace function club_push_test(k text) returns int language plpgsql security definer set search_path = public as $$
declare c text := ea_club(k); sid text := ea_staff(k);
begin if c is null or sid is null then raise exception 'SESSION'; end if;
  perform ea_notify(c, array[sid], 'test', 'test:' || now(), '🔔 Clubbo', 'Les notifications marchent sur ce téléphone !', '#/reglages');
  return (select count(*) from push_subs where club = c and staff_id = sid); end $$;
create or replace function club_notifs(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_club(k); sid text := ea_staff(k); r jsonb;
begin if c is null or sid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'url', url, 'n', n, 'tag', tag, 'kind', kind) order by id desc), '[]'::jsonb) into r
    from (select * from notifs where club = c and staff_id = sid and not delivered and created_at > now() - interval '2 days' order by id desc limit 10) x;
  update notifs set delivered = true where club = c and staff_id = sid and not delivered;
  return r; end $$;
create or replace function club_mark_read(k text, p_channel text, p_at timestamptz) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_club(k); sid text := ea_staff(k);
begin if c is null or sid is null or coalesce(p_channel, '') = '' then return false; end if;
  insert into message_reads (club, channel, staff_id, at) values (c, p_channel, sid, coalesce(p_at, now()))
    on conflict (club, channel, staff_id) do update set at = greatest(message_reads.at, excluded.at);
  update notifs set delivered = true where club = c and staff_id = sid and tag = 'msg:' || p_channel and not delivered;
  return true; end $$;
create or replace function club_reads(k text, p_channel text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'at', at)), '[]'::jsonb) from message_reads where club = c and channel = p_channel); end $$;

/* ================= bénévoles (rappel la veille), sauvegardes ================= */
create or replace function ea_vol_remind() returns void language plpgsql security definer set search_path = public as $$
declare m items; k text; e jsonb; lbl text;
begin
  for m in select * from items where col = 'matches' and not deleted and data->>'date' = to_char(current_date + 1, 'YYYY-MM-DD') and jsonb_typeof(data->'vol') = 'object' loop
    for k in select jsonb_object_keys(m.data->'vol') loop
      for e in select * from jsonb_array_elements(case when jsonb_typeof(m.data->'vol'->k) = 'array' then m.data->'vol'->k else '[]'::jsonb end) loop
        if coalesce(e->>'staffId', '') = '' then continue; end if;
        lbl := coalesce((select t->>'label' from items c, jsonb_array_elements(case when jsonb_typeof(c.data->'volTasks') = 'array' then c.data->'volTasks' else '[]'::jsonb end) t
          where c.club = m.club and c.col = 'club' and c.id = 'club' and t->>'key' = k limit 1), 'Bénévole');
        perform ea_notify(m.club, array[e->>'staffId'], 'planning', 'vol:' || m.id || ':' || k, '🙋 Demain : ' || lbl,
          coalesce((select data->>'name' from items where club = m.club and col = 'teams' and id = m.data->>'teamId'), '')
          || case when coalesce((m.data->>'home')::boolean, false) then ' contre ' else ' chez ' end || coalesce(m.data->>'opponent', '?'), '#/benevoles');
      end loop;
    end loop;
  end loop;
exception when others then raise notice 'rappel des bénévoles : %', sqlerrm;
end $$;
create or replace function ea_backup(c text, p_kind text default 'auto') returns bigint language plpgsql security definer set search_path = public as $$
declare d jsonb; n bigint;
begin
  d := jsonb_build_object('app', 'ea-club-manager', 'version', 1, 'exportedAt', now(), 'backup', true,
    'data', coalesce((select jsonb_object_agg(col, arr) from (select col, jsonb_agg(data - 'bgData') arr from items where club = c and not deleted and data is not null and col <> 'club' group by col) g), '{}'::jsonb)
      || jsonb_build_object('club', coalesce((select data - 'cloud' from items where club = c and col = 'club' and id = 'club' and not deleted), '{}'::jsonb)));
  insert into backups (club, kind, size, data) values (c, coalesce(p_kind, 'auto'), length(d::text), d) returning id into n;
  delete from backups where club = c and id not in (select id from backups where club = c order by created_at desc limit 8);
  return n; end $$;
create or replace function ea_backup_all() returns void language plpgsql security definer set search_path = public as $$
declare c text; begin for c in select id from clubs where status = 'active' loop perform ea_backup(c, 'auto'); end loop; end $$;
create or replace function club_backups(k text, admin_k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'kind', kind, 'size', size) order by created_at desc), '[]'::jsonb) from backups where club = c); end $$;
create or replace function club_backup_now(k text, admin_k text) returns bigint language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if; return ea_backup(c, 'manuel'); end $$;
create or replace function club_backup_get(k text, admin_k text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin if not ea_admin(admin_k, c) then raise exception 'ADMIN'; end if; return (select data from backups where club = c and id = p_id); end $$;
create or replace function club_backup_auto(k text) returns boolean language plpgsql security definer set search_path = public as $$
begin perform ea_need(k); return exists (select 1 from pg_extension where extname = 'pg_cron'); end $$;
do $cron$ begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname in ('ea-backup', 'ea-benevoles');
    perform cron.schedule('ea-backup', '0 3 * * 1', 'select public.ea_backup_all()');
    perform cron.schedule('ea-benevoles', '0 16 * * *', 'select public.ea_vol_remind()');
  exception when others then raise notice 'Tâches automatiques non programmées : %', sqlerrm;
  end;
end $cron$;

/* ================= codes personnels des licenciés (joueurs et parents) ================= */
create or replace function ea_member(p_code text) returns items language plpgsql stable security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); pl items;
begin
  if length(c) <> 8 then raise exception 'CODE_PERSO'; end if;
  select i.* into pl from member_codes mc join clubs cl on cl.id = mc.club and cl.status = 'active'
    join items i on i.club = mc.club and i.col = 'players' and i.id = mc.player_id and not i.deleted where mc.code = c;
  if pl.id is null then raise exception 'CODE_PERSO'; end if;
  return pl; end $$;
create or replace function ea_member_teams(pl items) returns text[] language sql immutable as $$ select ea_arr(pl.data->'teamIds') $$;
-- le responsable voit tous les codes ; un coach ne voit que ceux de ses catégories qu'il n'a pas encore remis
create or replace function club_member_codes(k text, admin_k text, p_players text[], p_renew text[] default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); pid text; v text; adm boolean := ea_admin(admin_k, c); sid text := ea_staff(k); st items; tids text[];
begin
  if not adm then
    if sid is null then raise exception 'ADMIN'; end if;
    select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
    tids := ea_arr(st.data->'teamIds');
  end if;
  foreach pid in array coalesce(p_players, '{}') loop
    if not exists (select 1 from items i where i.club = c and i.col = 'players' and i.id = pid and not i.deleted and (adm or ea_member_teams(i) && tids)) then continue; end if;
    if adm and pid = any(coalesce(p_renew, '{}')) then delete from member_codes where club = c and player_id = pid; end if;
    if not exists (select 1 from member_codes where club = c and player_id = pid) then
      loop v := ea_code(8); exit when not exists (select 1 from member_codes where code = v); end loop;
      insert into member_codes (club, player_id, code) values (c, pid, v);
    end if;
  end loop;
  return (select coalesce(jsonb_object_agg(mc.player_id, jsonb_build_object('code', case when adm or mc.given_at is null then mc.code else null end, 'used', mc.used_at, 'first', mc.first_at,
      'given', mc.given_at, 'by', case when adm then mc.given_by else null end)), '{}'::jsonb)
    from member_codes mc join items i on i.club = c and i.col = 'players' and i.id = mc.player_id and not i.deleted
    where mc.club = c and mc.player_id = any(coalesce(p_players, '{}')) and (adm or ea_member_teams(i) && tids));
end $$;
create or replace function club_member_given(k text, admin_k text, p_player text, p_given boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); adm boolean := ea_admin(admin_k, c); sid text := ea_staff(k); st items; pl items;
begin
  if not adm and sid is null then raise exception 'ADMIN'; end if;
  select * into pl from items where club = c and col = 'players' and id = p_player and not deleted;
  if pl.id is null then raise exception 'DONNEES'; end if;
  if not adm then
    select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
    if not (ea_member_teams(pl) && ea_arr(st.data->'teamIds')) then raise exception 'DONNEES'; end if;
    if not coalesce(p_given, false) then raise exception 'ADMIN'; end if;
  end if;
  update member_codes set given_at = case when coalesce(p_given, false) then now() else null end,
    given_by = case when coalesce(p_given, false) then coalesce((select trim(coalesce(s.data->>'firstName', '') || ' ' || coalesce(s.data->>'lastName', '')) from items s where s.club = c and s.col = 'staff' and s.id = sid), 'Responsable') else null end
    where club = c and player_id = p_player;
  return to_jsonb(true); end $$;
create or replace function member_view(p_code text, p_preview boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); today text := to_char(current_date, 'YYYY-MM-DD'); first boolean;
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  if not coalesce(p_preview, false) then
    select first_at is null into first from member_codes where club = c and player_id = pl.id;
    update member_codes set used_at = now(), first_at = coalesce(first_at, now()) where club = c and player_id = pl.id;
    if first then begin
      perform ea_notify(c, array(select distinct x from (select a.staff_id x from accounts a where a.club = c and a.admin
          union select st.id from items st join accounts a on a.club = c and a.staff_id = st.id where st.club = c and st.col = 'staff' and not st.deleted
            and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) y where y = any(tids))) z),
        'codes', 'codes', '✅ Code activé', ea_short(pl.data) || ' a ouvert son espace (joueur / parents)', '#/codes/' || coalesce(tids[1], ''));
    exception when others then raise notice 'notification code : %', sqlerrm; end; end if;
  end if;
  return jsonb_build_object(
    'team', coalesce((select string_agg(t.data->>'name', ' · ' order by t.data->>'name') from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(tids)), ''),
    'me', jsonb_build_object('id', pl.id, 'name', ea_short(pl.data), 'firstName', pl.data->>'firstName', 'number', pl.data->>'number', 'birth', pl.data->>'birth',
      'wb', (select max(w->>'day') from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) w)),
    'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName', 'crest', data->>'crest', 'sport', data->>'sport') from items where club = c and col = 'club' and id = 'club' and not deleted),
    'volTasks', (select data->'volTasks' from items where club = c and col = 'club' and id = 'club' and not deleted),
    'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
        order by st.data->>'lastName'), '[]'::jsonb) from items st where st.club = c and st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
        and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) x where x = any(tids))),
    'matches', (select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
      select jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'rdv', i.data->>'rdv', 'opponent', i.data->>'opponent',
        'home', coalesce((i.data->>'home')::boolean, false), 'place', i.data->>'place', 'competition', i.data->>'competition',
        'exempt', coalesce((i.data->>'exempt')::boolean, false), 'played', coalesce((i.data->>'played')::boolean, false), 'gf', i.data->'gf', 'ga', i.data->'ga',
        'team', (select t.data->>'name' from items t where t.club = c and t.col = 'teams' and t.id = i.data->>'teamId'),
        'open', not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today,
        'convoked', coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id, 'published', jsonb_array_length(coalesce(i.data->'convoked', '[]'::jsonb)) > 0,
        'answer', (select a.status from answers a where a.club = c and a.match_id = i.id and a.player_id = pl.id),
        'seats', (select a.seats from answers a where a.club = c and a.match_id = i.id and a.player_id = pl.id),
        'talk', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then jsonb_build_object(
          'objective', i.data#>>'{prep,talk,objective}', 'keys', coalesce(i.data#>'{prep,talk,keys}', '[]'::jsonb), 'final', i.data#>>'{prep,talk,final}',
          'video', i.data#>>'{prep,talk,videoUrl}', 'system', i.data#>>'{prep,plan,system}') else null end,
        'my', case when coalesce((i.data->>'played')::boolean, false) and coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id then jsonb_build_object(
          'min', i.data#>>array['minutes', pl.id], 'g', i.data#>>array['stats', pl.id, 'g'], 'a', i.data#>>array['stats', pl.id, 'a']) else null end,
        'photos', (select coalesce(jsonb_agg(ph.id order by ph.created_at), '[]'::jsonb) from match_photos ph where ph.club = c and ph.match_id = i.id),
        'vol', case when i.data->>'date' >= today and jsonb_typeof(i.data->'vol') = 'object' then (select coalesce(jsonb_object_agg(v.key,
            (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb)
             from jsonb_array_elements(case when jsonb_typeof(v.value) = 'array' then v.value else '[]'::jsonb end) e)), '{}'::jsonb) from jsonb_each(i.data->'vol') v) else '{}'::jsonb end,
        'carpool', (select coalesce(jsonb_agg(jsonb_build_object('seats', coalesce((cp->>'seats')::int, 0), 'from', cp->>'from', 'time', cp->>'time',
            'n', jsonb_array_length(case when jsonb_typeof(cp->'kids') = 'array' then cp->'kids' else '[]'::jsonb end),
            'mine', coalesce(cp->'kids', '[]'::jsonb) ? pl.id, 'driver', case when coalesce(cp->'kids', '[]'::jsonb) ? pl.id then cp->>'driver' else null end)), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(i.data->'carpool') = 'array' then i.data->'carpool' else '[]'::jsonb end) cp)) x
      from items i where i.club = c and i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(tids)
        and i.data->>'date' between season and to_char(current_date + 60, 'YYYY-MM-DD')) s),
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title') order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
        and i.data->>'date' between today and to_char(current_date + 14, 'YYYY-MM-DD')));
end $$;
-- (1.60) the player's page: the tables and results of every team of his category (he can be picked in A or B),
-- and his own season in every team of the club (matches where he was called up, minutes, goals, assists, cards, sessions).
-- Read only. Public FFF data for the tables; nothing about the other players.
create or replace function member_standings(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); cats text[];
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  select array_agg(distinct coalesce(nullif(t.data->>'category', ''), t.data->>'name')) into cats from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(tids);
  return jsonb_build_object(
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.data->>'name', 'mine', t.id = any(tids),
        'tables', coalesce(t.data->'fffTables', '{}'::jsonb), 'poules', coalesce(t.data->'fffPoules', '{}'::jsonb)) order by t.data->>'name'), '[]'::jsonb)
      from items t where t.club = c and t.col = 'teams' and not t.deleted and coalesce(nullif(t.data->>'category', ''), t.data->>'name') = any(coalesce(cats, '{}'::text[]))),
    'played', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'opponent', i.data->>'opponent', 'competition', i.data->>'competition',
        'team', (select t.data->>'name' from items t where t.club = c and t.col = 'teams' and t.id = i.data->>'teamId'),
        'min', i.data#>array['minutes', pl.id], 'st', i.data#>array['stats', pl.id], 'det', i.data#>array['detail', pl.id]) order by i.data->>'date'), '[]'::jsonb)
      from items i where i.club = c and i.col = 'matches' and not i.deleted and coalesce(i.data->>'played', '') = 'true'
        and coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id and i.data->>'date' >= season),
    'sessions', (select jsonb_build_object('total', count(*), 'present', count(*) filter (where coalesce(i.data->'presents', '[]'::jsonb) ? pl.id))
      from items i where i.club = c and i.col = 'trainings' and not i.deleted and coalesce(i.data->>'model', '') <> 'true' and i.data->>'teamId' = any(tids)
        and i.data->>'date' between season and to_char(current_date, 'YYYY-MM-DD') and jsonb_array_length(coalesce(i.data->'presents', '[]'::jsonb)) > 0));
end $$;
-- (1.61) « Jeu des pronos » : free predictions on Champions League matches (no money), players and coaches of a category
-- (teams A and B together). Bets of the others are shown only from the kick-off. Settings (gages, on/off) in the club item (data.game).
create table if not exists game_bets (club text not null, person text not null, kind text not null, event text not null,
  h int not null check (h between 0 and 20), a int not null check (a between 0 and 20), kickoff timestamptz not null, at timestamptz not null default now(),
  primary key (club, person, event));
create table if not exists game_people (club text not null, person text not null, fav text, at timestamptz not null default now(), primary key (club, person));
alter table game_bets enable row level security;
alter table game_people enable row level security;
revoke all on game_bets, game_people from public, anon, authenticated;
-- the view of the game for one category (teams of the same category as p_teams), « me » = the person asking
create or replace function ea_game_view(c text, p_teams text[], p_me text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cats text[]; tids text[];
begin
  select array_agg(distinct coalesce(nullif(t.data->>'category', ''), t.data->>'name')) into cats from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(p_teams);
  select array_agg(t.id) into tids from items t where t.club = c and t.col = 'teams' and not t.deleted and coalesce(nullif(t.data->>'category', ''), t.data->>'name') = any(coalesce(cats, '{}'::text[]));
  return jsonb_build_object(
    'category', (select string_agg(x, ' · ') from unnest(coalesce(cats, '{}'::text[])) x),
    'settings', (select data->'game' from items where club = c and col = 'club' and id = 'club' and not deleted),
    'people', (select coalesce(jsonb_agg(p order by p->>'name'), '[]'::jsonb) from (
        select jsonb_build_object('id', i.id, 'kind', 'player', 'name', ea_short(i.data), 'me', i.id = p_me, 'fav', (select g.fav from game_people g where g.club = c and g.person = i.id)) p
          from items i where i.club = c and i.col = 'players' and not i.deleted and ea_arr(i.data->'teamIds') && coalesce(tids, '{}'::text[])
        union all
        select jsonb_build_object('id', s.id, 'kind', 'coach', 'name', 'Coach ' || ea_short(s.data), 'me', s.id = p_me, 'fav', coalesce((select g.fav from game_people g where g.club = c and g.person = s.id), s.data->>'club'))
          from items s where s.club = c and s.col = 'staff' and not s.deleted and ea_arr(s.data->'teamIds') && coalesce(tids, '{}'::text[])) z),
    'bets', (select coalesce(jsonb_agg(jsonb_build_object('p', b.person, 'e', b.event, 'h', b.h, 'a', b.a, 'at', b.at)), '[]'::jsonb) from game_bets b
      where b.club = c and (b.person = p_me or b.kickoff <= now()) and b.kickoff > now() - interval '300 days'
        and (exists (select 1 from items i where i.club = c and i.col = 'players' and i.id = b.person and ea_arr(i.data->'teamIds') && coalesce(tids, '{}'::text[]))
          or exists (select 1 from items s where s.club = c and s.col = 'staff' and s.id = b.person and ea_arr(s.data->'teamIds') && coalesce(tids, '{}'::text[])))));
end $$;
create or replace function ea_game_bet(c text, p_me text, p_kind text, p_event text, p_h int, p_a int, p_kickoff timestamptz) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_kickoff is null or p_kickoff <= now() then raise exception 'TROP_TARD'; end if;
  if coalesce(p_event, '') !~ '^[0-9]{1,12}p_code text, p_match text, p_status text, p_seats int default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items;
begin
  select * into m from items where club = c and col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
  if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_match and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, seats, by_coach) values (c, p_match, pl.id, p_status, greatest(0, least(coalesce(p_seats, 0), 8)), false)
    on conflict (club, match_id, player_id) do update set status = excluded.status, seats = excluded.seats, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
create or replace function member_wellness(p_code text, p_mood int, p_mental int, p_sleep int, p_legs int, p_sore int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb; d text := to_char(current_date, 'YYYY-MM-DD');
begin
  if least(p_mood, p_mental, p_sleep, p_legs, p_sore) < 1 or greatest(p_mood, p_mental, p_sleep, p_legs, p_sore) > 10 then raise exception 'DONNEES'; end if;
  w := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) e where e->>'day' <> d order by e->>'day' desc limit 119) q)
    || jsonb_build_array(jsonb_build_object('day', d, 'mood', p_mood, 'mental', p_mental, 'sleep', p_sleep, 'legs', p_legs, 'sore', p_sore, 'note', left(coalesce(p_note, ''), 200), 'self', true));
  update items set data = jsonb_set(data, '{wellness}', w), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
  return to_jsonb(true); end $$;
create or replace function member_volunteer(p_code text, p_match text, p_task text, p_label text, p_name text, p_remove boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items; v jsonb; lst jsonb; nm text := left(trim(coalesce(p_name, '')), 40);
begin
  if coalesce(p_task, '') !~ '^[A-Za-z0-9_-]{1,30}$' or (nm = '' and not coalesce(p_remove, false)) then raise exception 'DONNEES'; end if;
  select * into m from items where club = c and col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  v := case when jsonb_typeof(m.data->'vol') = 'object' then m.data->'vol' else '{}'::jsonb end;
  lst := case when jsonb_typeof(v->p_task) = 'array' then v->p_task else '[]'::jsonb end;
  if coalesce(p_remove, false) then
    lst := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') <> pl.id);
  elsif not exists (select 1 from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') = pl.id) then
    if jsonb_array_length(lst) >= 8 then raise exception 'COMPLET'; end if;
    lst := lst || jsonb_build_array(jsonb_build_object('id', substr(md5(random()::text), 1, 12), 'name', nm, 'parent', true, 'pid', pl.id, 'label', left(coalesce(p_label, ''), 40)));
  end if;
  update items set data = jsonb_set(data, '{vol}', v || jsonb_build_object(p_task, lst)), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where club = c and col = 'matches' and id = p_match;
  return (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb) from jsonb_array_elements(lst) e); end $$;
create or replace function member_photo(p_code text, p_id uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin return (select ph.data from match_photos ph join items i on i.club = pl.club and i.col = 'matches' and i.id = ph.match_id and not i.deleted
  where ph.club = pl.club and ph.id = p_id and i.data->>'teamId' = any(ea_member_teams(pl))); end $$;

/* ================= espace du propriétaire de la plateforme ================= */
-- La clé du propriétaire se choisit une seule fois, dans les 24 heures qui suivent l'installation (depuis l'appli : Réglages → Propriétaire)
create or replace function ea_owner_ok(p_key text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_key, '') <> '' and exists (select 1 from ea_platform where id = 1 and owner_key_hash = ea_hash(p_key)) $$;
create or replace function ea_owner_init(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_key, '')) < 12 then raise exception 'DONNEES'; end if;
  update ea_platform set owner_key_hash = ea_hash(p_key) where id = 1 and owner_key_hash is null and installed_at > now() - interval '24 hours';
  if not found then raise exception 'PROPRIETAIRE'; end if;
  return to_jsonb(true); end $$;
create or replace function ea_owner_codes(p_key text, p_new int default 0, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare i int;
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  for i in 1 .. least(greatest(coalesce(p_new, 0), 0), 50) loop
    insert into ea_activation (code, note) values ('EA-' || ea_code(4) || '-' || ea_code(4), left(p_note, 120)) on conflict do nothing;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'note', a.note, 'created', a.created_at, 'used', a.used_at, 'club', cl.name) order by a.created_at desc), '[]'::jsonb)
    from ea_activation a left join clubs cl on cl.id = a.used_by); end $$;
create or replace function ea_owner_clubs(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name, 'status', cl.status, 'created', cl.created_at, 'seen', cl.last_seen,
      'players', (select count(*) from items i where i.club = cl.id and i.col = 'players' and not i.deleted),
      'staff', (select count(*) from items i where i.club = cl.id and i.col = 'staff' and not i.deleted),
      'accounts', (select count(*) from accounts a where a.club = cl.id and a.pw_hash is not null),
      'matches', (select count(*) from items i where i.club = cl.id and i.col = 'matches' and not i.deleted)) order by cl.created_at desc), '[]'::jsonb) from clubs cl); end $$;
create or replace function ea_owner_club_set(p_key text, p_club text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'DONNEES'; end if;
  update clubs set status = p_status where id = p_club;
  if p_status = 'suspended' then delete from sessions where club = p_club; end if;
  return to_jsonb(found); end $$;
create or replace function ea_owner_push(p_key text, p_url text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  update push_config set fn_url = nullif(p_url, '') where id = 1;
  return (select jsonb_build_object('secret', secret, 'public', vapid_public) from push_config where id = 1); end $$;

/* ================= droits ================= */
-- a player or a parent (with the personal code) sends a message to the coaches of the category: his own training, his footings. 10 a day at most.
create or replace function member_message(p_code text, p_body text, p_parent boolean default false) returns boolean language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); who text;
begin
  if coalesce(trim(p_body), '') = '' or coalesce(array_length(tids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  if (select count(*) from messages where club = pl.club and author_id = 'member:' || pl.id and created_at > now() - interval '1 day') >= 10 then raise exception 'LIMITE'; end if;
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who, left(p_body, 2000));
  return true; end $$;

-- (1.21) un joueur ou un parent répond présent / absent à un match OU à un entraînement, avec la raison de l'absence (malade, blessé, vacances…)
create or replace function member_reply(p_code text, p_kind text, p_id text, p_status text, p_seats int default 0, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items; r text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
begin
  if p_kind = 'match' then
    select * into m from items where club = c and col = 'matches' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
    if coalesce((m.data->>'played')::boolean, false) then raise exception 'MATCH_PASSE'; end if;
  elsif p_kind = 'training' then
    select * into m from items where club = c and col = 'trainings' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  else raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_id and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, seats, note, by_coach)
    values (c, p_id, pl.id, p_status, case when p_kind = 'match' and p_status = 'oui' then greatest(0, least(coalesce(p_seats, 0), 8)) else 0 end, case when p_status = 'non' then r end, false)
    on conflict (club, match_id, player_id) do update set status = excluded.status, seats = excluded.seats, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
-- ses réponses : les entraînements des 2 semaines à venir (avec sa réponse) et les raisons de ses absences aux matchs
-- (1.66) le groupe d'entraînement d'une séance (« Groupe Gianni ») : écrit par le coach, sinon le prénom de son premier encadrant (ou de qui l'a créée)
create or replace function ea_tr_group(c text, d jsonb) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(d->>'group'), ''), (select 'Groupe ' || coalesce(nullif(st.data->>'firstName', ''), st.data->>'lastName') from items st
    where st.club = c and st.col = 'staff' and not st.deleted and st.id = coalesce(d->'staffIds'->>0, d->>'by'))) $$;
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
  mygrp text := nullif(trim(pl.data->>'trGroup'), '');
begin
  return jsonb_build_object(
    -- (1.68) one line per day : several sessions the same day (one per training group) are answered once ;
    -- the line shows the session of his group when the coaches have chosen it
    'trainings', (with tr as (select i.* from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false)
          and i.data->>'teamId' = any(tids) and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')),
        g as (select tr.data->>'teamId' tm, tr.data->>'date' d, array_agg(tr.id order by tr.data->>'time', tr.id) ids from tr group by 1, 2),
        p as (select g.*, case when array_length(g.ids, 1) = 1 then g.ids[1] else (select t.id from tr t where t.id = any(g.ids) and ea_tr_group(c, t.data) = mygrp limit 1) end mine from g)
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'date', p.d, 'time', t.data->>'time',
          'title', case when p.mine is null then 'Entraînement' else t.data->>'title' end,
          'group', case when array_length(p.ids, 1) > 1 then coalesce(case when p.mine is not null then ea_tr_group(c, t.data) end, 'Groupe choisi par le coach') end,
          'answer', ans.status, 'reason', ans.note) order by p.d, t.data->>'time'), '[]'::jsonb)
      from p join tr t on t.id = coalesce(p.mine, p.ids[1])
      left join lateral (select a.status, a.note from answers a where a.club = c and a.player_id = pl.id and a.match_id = any(p.ids) order by a.updated_at desc limit 1) ans on true),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
grant execute on function member_reply(text, text, text, text, int, text), member_replies(text) to anon, authenticated;
-- (1.22) les demandes de code d'activation envoyées depuis la page « Découvrir Clubbo » ; le propriétaire les voit dans son espace
create table if not exists ea_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  name text not null, club text not null, sport text, town text, contact text not null, message text, status text not null default 'new', code text);
alter table ea_requests enable row level security;
create or replace function ea_request(p_name text, p_club text, p_sport text, p_town text, p_contact text, p_message text, p_trap text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_trap, '') <> '' then return true; end if; -- un robot a rempli le champ caché
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_club, ''))) < 2 or length(trim(coalesce(p_contact, ''))) < 6 then raise exception 'DONNEES'; end if;
  if (select count(*) from ea_requests where created_at > now() - interval '1 hour') >= 20 then raise exception 'LIMITE'; end if;
  if exists (select 1 from ea_requests where lower(contact) = lower(trim(p_contact)) and created_at > now() - interval '1 day') then return true; end if;
  insert into ea_requests (name, club, sport, town, contact, message)
    values (left(trim(p_name), 80), left(trim(p_club), 80), left(p_sport, 20), left(trim(coalesce(p_town, '')), 60), left(trim(p_contact), 120), left(trim(coalesce(p_message, '')), 1000));
  return true; end $$;
create or replace function ea_owner_requests(p_key text, p_id uuid default null, p_status text default null, p_code text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_id is not null and p_status in ('new', 'done', 'dropped') then update ea_requests set status = p_status, code = coalesce(p_code, code) where id = p_id; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'name', name, 'club', club, 'sport', sport, 'town', town, 'contact', contact, 'message', message, 'status', status, 'code', code) order by created_at desc), '[]'::jsonb)
    from (select * from ea_requests order by created_at desc limit 200) r); end $$;
revoke all on function ea_request(text, text, text, text, text, text, text), ea_owner_requests(text, uuid, text, text) from public;
grant execute on function ea_request(text, text, text, text, text, text, text), ea_owner_requests(text, uuid, text, text) to anon, authenticated;
-- (1.23) le propriétaire est prévenu sur son téléphone à chaque nouvelle demande de code
create extension if not exists pg_net;
create table if not exists ea_owner_subs (id uuid primary key default gen_random_uuid(), endpoint text not null unique, created_at timestamptz not null default now());
alter table ea_owner_subs enable row level security;
alter table ea_requests add column if not exists notified_at timestamptz;
-- réveille les téléphones du propriétaire (sans contenu : le téléphone vient ensuite lire « ea_owner_news »)
create or replace function ea_owner_wake() returns void language plpgsql security definer set search_path = public as $$
declare cfg push_config; subs jsonb;
begin
  select * into cfg from push_config where id = 1;
  select jsonb_agg(jsonb_build_object('id', id, 'endpoint', endpoint)) into subs from ea_owner_subs;
  if cfg.fn_url is null or subs is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification propriétaire : %', sqlerrm; end;
end $$;
create or replace function ea_request(p_name text, p_club text, p_sport text, p_town text, p_contact text, p_message text, p_trap text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_trap, '') <> '' then return true; end if; -- un robot a rempli le champ caché
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_club, ''))) < 2 or length(trim(coalesce(p_contact, ''))) < 6 then raise exception 'DONNEES'; end if;
  if (select count(*) from ea_requests where created_at > now() - interval '1 hour') >= 20 then raise exception 'LIMITE'; end if;
  if exists (select 1 from ea_requests where lower(contact) = lower(trim(p_contact)) and created_at > now() - interval '1 day') then return true; end if;
  insert into ea_requests (name, club, sport, town, contact, message)
    values (left(trim(p_name), 80), left(trim(p_club), 80), left(p_sport, 20), left(trim(coalesce(p_town, '')), 60), left(trim(p_contact), 120), left(trim(coalesce(p_message, '')), 1000));
  perform ea_owner_wake();
  return true; end $$;
-- ce téléphone reçoit (ou plus) les alertes du propriétaire ; renvoie la clé publique des notifications
create or replace function ea_owner_sub(p_key text, p_endpoint text default null, p_on boolean default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if coalesce(p_endpoint, '') <> '' and p_on is not null then
    if p_on then insert into ea_owner_subs (endpoint) values (left(p_endpoint, 1000)) on conflict (endpoint) do nothing;
    else delete from ea_owner_subs where endpoint = p_endpoint; end if;
  end if;
  return jsonb_build_object('key', (select vapid_public from push_config where id = 1),
    'on', coalesce(p_endpoint, '') <> '' and exists (select 1 from ea_owner_subs where endpoint = p_endpoint)); end $$;
-- le téléphone réveillé lit ses alertes (seulement s'il est abonné comme propriétaire)
create or replace function ea_owner_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; last ea_requests;
begin
  if coalesce(p_endpoint, '') = '' or not exists (select 1 from ea_owner_subs where endpoint = p_endpoint) then return '[]'::jsonb; end if;
  select count(*) into n from ea_requests where status = 'new' and notified_at is null and created_at > now() - interval '2 days';
  if n = 0 then return '[]'::jsonb; end if;
  select * into last from ea_requests where status = 'new' and notified_at is null order by created_at desc limit 1;
  update ea_requests set notified_at = now() where status = 'new' and notified_at is null;
  return jsonb_build_array(jsonb_build_object('title', case when n > 1 then '📨 ' || n || ' nouvelles demandes de code' else '📨 Nouvelle demande de code' end,
    'body', last.club || coalesce(' · ' || nullif(last.sport, ''), '') || ' · ' || last.name, 'url', '#/proprietaire', 'tag', 'ea-request')); end $$;
revoke all on function ea_owner_wake() from public, anon, authenticated;
revoke all on function ea_request(text, text, text, text, text, text, text), ea_owner_sub(text, text, boolean), ea_owner_news(text) from public;
grant execute on function ea_request(text, text, text, text, text, text, text), ea_owner_sub(text, text, boolean), ea_owner_news(text) to anon, authenticated;
-- (1.26) les joueurs et les parents prévenus sur leur téléphone : convocation envoyée, changement d'horaire ou de lieu, match ou séance annulés
create table if not exists member_subs (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, player_id text not null,
  endpoint text not null, page text not null default 'parents.html', created_at timestamptz not null default now(), unique (endpoint, player_id));
create table if not exists member_notifs (id bigserial primary key, club text not null references clubs(id) on delete cascade, player_id text not null,
  title text, body text, created_at timestamptz not null default now(), delivered boolean not null default false);
create index if not exists member_notifs_player on member_notifs (club, player_id, delivered);
alter table member_subs enable row level security;
alter table member_notifs enable row level security;
create or replace function member_arr(j jsonb) returns text[] language sql immutable as $$
  select array(select jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end)) $$;
-- ce téléphone est prévenu (ou plus) pour ce joueur ; renvoie la clé publique des notifications
create or replace function member_push(p_code text, p_endpoint text default null, p_on boolean default null, p_page text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if coalesce(p_endpoint, '') <> '' and p_on is not null then
    if p_on then insert into member_subs (club, player_id, endpoint, page) values (pl.club, pl.id, left(p_endpoint, 1000), case when p_page = 'joueurs.html' then 'joueurs.html' else 'parents.html' end)
      on conflict (endpoint, player_id) do update set page = excluded.page;
    else delete from member_subs where endpoint = p_endpoint and player_id = pl.id; end if;
  end if;
  return jsonb_build_object('key', (select vapid_public from push_config where id = 1),
    'on', exists (select 1 from member_subs where endpoint = coalesce(p_endpoint, '') and player_id = pl.id)); end $$;
-- le téléphone réveillé lit ses notifications (celles des joueurs suivis sur ce téléphone)
create or replace function member_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if coalesce(p_endpoint, '') = '' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'url', s.page, 'tag', 'm' || n.id) order by n.id desc), '[]'::jsonb) into r
    from member_notifs n join member_subs s on s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint
    where not n.delivered and n.created_at > now() - interval '2 days';
  update member_notifs n set delivered = true from member_subs s where s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint and not n.delivered;
  delete from member_notifs where created_at < now() - interval '30 days';
  return r; end $$;
-- une notification pour ces joueurs (seulement ceux qui ont un téléphone abonné), puis les téléphones sont réveillés
create or replace function member_note(c text, p_players text[], p_title text, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config;
begin
  if coalesce(array_length(p_players, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240) from member_subs s where s.club = c and s.player_id = any(p_players);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(p_players)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;
create or replace function ea_on_item_members() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; ismatch boolean := new.col = 'matches'; dt date; team text; lbl text; body text; conv text[]; added text[];
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    d := case when new.deleted then o else new.data end;
    if d is null or coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    body := ea_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if ismatch then
      body := (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body
        || coalesce(' · RDV ' || replace(nullif(d->>'rdv', ''), ':', 'h'), '') || coalesce(' · ' || nullif(d->>'place', ''), '');
      conv := member_arr(d->'convoked');
      if new.deleted then perform member_note(new.club, conv, '❌ Match annulé · ' || lbl, body); return null; end if;
      if (d->>'convSent') is null then return null; end if; -- la convocation n'est pas encore envoyée par le coach
      if o is null or (o->>'convSent') is distinct from (d->>'convSent') then perform member_note(new.club, conv, '📣 Convocation · ' || lbl, body); return null; end if;
      added := array(select x from unnest(conv) x where not (coalesce(o->'convoked', '[]'::jsonb) ? x));
      if coalesce(array_length(added, 1), 0) > 0 then perform member_note(new.club, added, '📣 Convocation · ' || lbl, body); end if;
      if (d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time') or (d->>'rdv') is distinct from (o->>'rdv') or (d->>'place') is distinct from (o->>'place') then
        perform member_note(new.club, array(select x from unnest(conv) x where not (x = any(added))), '🕘 Changement · match ' || lbl, body);
      end if;
    else
      if dt > current_date + 7 then return null; end if;
      body := body || coalesce(' · ' || nullif(d->>'title', ''), '');
      conv := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      if new.deleted then perform member_note(new.club, conv, '❌ Séance annulée · ' || lbl, body);
      elsif o is not null and ((d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time')) then perform member_note(new.club, conv, '🕘 Changement · séance ' || lbl, body); end if;
    end if;
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_item_members on items;
create trigger ea_item_members after insert or update on items for each row execute function ea_on_item_members();
revoke all on function member_note(text, text[], text, text), ea_on_item_members() from public, anon, authenticated;
revoke all on function member_push(text, text, boolean, text), member_news(text) from public;
grant execute on function member_push(text, text, boolean, text), member_news(text) to anon, authenticated;
-- (1.26) la formule de chaque club (gratuite jusqu'à 3 équipes, « Club » à 15 € par mois au-delà) et l'usage de l'appli, pour le propriétaire
alter table clubs add column if not exists plan text not null default 'free';
create or replace function ea_owner_clubs(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare wk bigint := (extract(epoch from now() - interval '7 days') * 1000)::bigint;
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name, 'status', cl.status, 'created', cl.created_at, 'seen', cl.last_seen, 'plan', cl.plan,
      'teams', (select count(*) from items i where i.club = cl.id and i.col = 'teams' and not i.deleted),
      'players', (select count(*) from items i where i.club = cl.id and i.col = 'players' and not i.deleted),
      'staff', (select count(*) from items i where i.club = cl.id and i.col = 'staff' and not i.deleted),
      'accounts', (select count(*) from accounts a where a.club = cl.id and a.pw_hash is not null),
      'matches', (select count(*) from items i where i.club = cl.id and i.col = 'matches' and not i.deleted),
      'week', (select count(*) from items i where i.club = cl.id and i.col in ('trainings', 'matches', 'schemas', 'players') and i.updated_at > wk),
      'families', (select count(distinct player_id) from member_subs s where s.club = cl.id),
      'up', (select count(*) from items i where i.club = cl.id and i.col = 'reports' and not i.deleted and i.data->>'type' = 'avis' and i.data->>'value' = 'up'),
      'down', (select count(*) from items i where i.club = cl.id and i.col = 'reports' and not i.deleted and i.data->>'type' = 'avis' and i.data->>'value' = 'down'))
    order by cl.created_at desc), '[]'::jsonb) from clubs cl); end $$;
-- les pages les moins aimées, tous clubs confondus
create or replace function ea_owner_votes(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'down')::int desc, (x->>'up')::int), '[]'::jsonb) from (
    select jsonb_build_object('page', data->>'page', 'up', count(*) filter (where data->>'value' = 'up'), 'down', count(*) filter (where data->>'value' = 'down')) x
    from items where col = 'reports' and not deleted and data->>'type' = 'avis' group by data->>'page') q); end $$;
create or replace function ea_owner_club_plan(p_key text, p_club text, p_plan text) returns boolean language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_plan not in ('free', 'club') then raise exception 'DONNEES'; end if;
  update clubs set plan = p_plan where id = p_club; return found; end $$;
-- le club connaît sa formule (pour le message de la version gratuite)
create or replace function club_info(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select jsonb_build_object('id', id, 'slug', slug, 'name', name, 'created', created_at, 'plan', plan) from clubs where id = c); end $$;
revoke all on function ea_owner_votes(text), ea_owner_club_plan(text, text, text) from public;
grant execute on function ea_owner_votes(text), ea_owner_club_plan(text, text, text) to anon, authenticated;
-- (1.27) « Retirer l'accès » : un dirigeant marqué « blocked » ne peut plus créer de compte (même avec le lien d'invitation)
create or replace function club_register(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := coalesce(ea_club(admin_k), ea_club(k)); is_adm boolean; sid text := p->>'staff_id'; s text := ea_token(); a accounts;
begin
  if c is null then raise exception 'CLE_CLUB'; end if;
  is_adm := ea_admin(admin_k, c);
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  if not is_adm and exists (select 1 from items where club = c and col = 'staff' and id = sid and not deleted and coalesce(data->>'blocked', '') not in ('', 'false', 'null')) then raise exception 'ACCES_RETIRE'; end if;
  select * into a from accounts where club = c and staff_id = sid;
  if a.pw_hash is not null and not is_adm then raise exception 'DEJA_INSCRIT'; end if;
  insert into accounts (club, staff_id, last_key, first_keys, display, salt, pw_hash, admin)
    values (c, sid, p->>'last_key', ea_arr(p->'first_keys'), coalesce(p->>'display', ''), s, ea_hash(s || (p->>'h')), coalesce((p->>'admin')::boolean, false) and is_adm)
    on conflict (club, staff_id) do update set last_key = excluded.last_key, first_keys = excluded.first_keys, display = excluded.display, salt = excluded.salt,
      pw_hash = excluded.pw_hash, admin = accounts.admin or excluded.admin, updated_at = now();
  delete from sessions where club = c and staff_id = sid;
  return ea_new_session(c, sid);
end $$;
-- (1.32) un joueur ou un parent répond « absent » (match ou séance) : les coachs de la catégorie sont prévenus, avec la raison
create or replace function ea_on_answer() returns trigger language plpgsql security definer set search_path = public as $$
declare m items; pl items; ismatch boolean; dt date; who text; what text;
begin
  begin
    if new.by_coach or new.status <> 'non' then return null; end if;
    if tg_op = 'UPDATE' and old.status = 'non' and coalesce(old.note, '') = coalesce(new.note, '') then return null; end if;
    select * into m from items where club = new.club and col in ('matches', 'trainings') and id = new.match_id and not deleted limit 1;
    if m.id is null or coalesce(m.data->>'teamId', '') = '' then return null; end if;
    select * into pl from items where club = new.club and col = 'players' and id = new.player_id;
    ismatch := m.col = 'matches';
    begin dt := (m.data->>'date')::date; exception when others then dt := null; end;
    who := coalesce(nullif(ea_short(pl.data), ''), 'Un joueur');
    what := case when ismatch then 'match ' || case when coalesce((m.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(m.data->>'opponent', '?')
      else 'séance' || coalesce(' « ' || nullif(m.data->>'title', '') || ' »', '') end
      || coalesce(' · ' || ea_day(dt), '');
    perform ea_notify(new.club, ea_team_staff(new.club, m.data->>'teamId'), 'planning', 'abs:' || new.match_id || ':' || new.player_id,
      '✗ Absent · ' || who, what || coalesce(' · ' || nullif(new.note, ''), ''),
      case when ismatch then '#/match/' else '#/entrainement/' end || m.id);
  exception when others then raise notice 'notification absence : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_answer_notify on answers;
create trigger ea_answer_notify after insert or update on answers for each row execute function ea_on_answer();
revoke all on function ea_on_answer() from public, anon, authenticated;
do $grants$ declare f record; open_fns text[] := array['ea_create_club', 'club_login', 'club_register', 'club_accounts', 'club_account_set', 'club_me', 'club_teams_done',
  'club_change_pw', 'club_logout', 'club_invite', 'club_info', 'club_pull', 'club_push', 'club_ping', 'club_admin_ping', 'club_messages', 'club_post', 'club_delete_message',
  'club_slots', 'club_set_slots', 'club_bookings', 'club_book', 'club_unbook', 'club_unbook_series', 'club_answers', 'club_set_answer', 'club_photo_add', 'club_photos',
  'club_photo_get', 'club_photo_del', 'club_push_key', 'club_push_sub', 'club_push_unsub', 'club_push_test', 'club_notifs', 'club_mark_read', 'club_reads',
  'club_backups', 'club_backup_now', 'club_backup_get', 'club_backup_auto', 'club_member_codes', 'club_member_given', 'member_view', 'member_standings', 'member_tips', 'member_session', 'member_game', 'member_game_bet', 'member_game_fav', 'club_game', 'club_game_bet', 'club_game_fav', 'member_answer', 'member_message',
  'member_wellness', 'member_volunteer', 'member_photo', 'member_reply', 'member_replies', 'ea_owner_init', 'ea_owner_codes', 'ea_request', 'ea_owner_requests', 'ea_owner_sub', 'ea_owner_news', 'member_push', 'member_news', 'ea_owner_votes', 'ea_owner_club_plan', 'ea_owner_clubs', 'ea_owner_club_set', 'ea_owner_push'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'ea\_%' or p.proname like 'club\_%' or p.proname like 'member\_%') loop
    execute format('revoke all on function %s from public', f.sig);
    begin execute format('revoke all on function %s from anon, authenticated', f.sig); exception when others then null; end;
    if f.proname = any(open_fns) then execute format('grant execute on function %s to anon, authenticated', f.sig); end if;
  end loop;
end $grants$;
notify pgrst, 'reload schema';
 then raise exception 'DONNEES'; end if;
  if (select (data#>>'{game,off}')::boolean from items where club = c and col = 'club' and id = 'club') is true then raise exception 'JEU_FERME'; end if;
  insert into game_bets (club, person, kind, event, h, a, kickoff) values (c, p_me, p_kind, p_event, p_h, p_a, p_kickoff)
    on conflict (club, person, event) do update set h = excluded.h, a = excluded.a, at = now()
    where game_bets.kickoff > now();
  return to_jsonb(true); end $$;
create or replace function ea_game_fav(c text, p_me text, p_fav text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into game_people (club, person, fav) values (c, p_me, left(nullif(trim(coalesce(p_fav, '')), ''), 40))
    on conflict (club, person) do update set fav = excluded.fav, at = now();
  return to_jsonb(true); end $$;
-- the player (personal code)
create or replace function member_game(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); begin return ea_game_view(pl.club, ea_member_teams(pl), pl.id); end $$;
create or replace function member_game_bet(p_code text, p_event text, p_h int, p_a int, p_kickoff timestamptz) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); begin return ea_game_bet(pl.club, pl.id, 'player', p_event, p_h, p_a, p_kickoff); end $$;
create or replace function member_game_fav(p_code text, p_fav text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); begin return ea_game_fav(pl.club, pl.id, p_fav); end $$;
-- the coach (his login), for one of the club's teams
create or replace function club_game(k text, p_team text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  return ea_game_view(c, array[p_team], sid); end $$;
create or replace function club_game_bet(k text, p_event text, p_h int, p_a int, p_kickoff timestamptz) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  return ea_game_bet(c, sid, 'coach', p_event, p_h, p_a, p_kickoff); end $$;
create or replace function club_game_fav(k text, p_fav text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  return ea_game_fav(c, sid, p_fav); end $$;
-- (1.63) the player's page: the content of an upcoming session of his team (goal, exercises), only once he answered « présent ». Read only.
-- (1.65) les conseils perso du coach pour ce joueur (exercices pour progresser), lus seulement avec son code
create or replace function member_tips(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t->>'id', 'at', t->>'at', 'icon', t->>'icon', 'themeLabel', t->>'themeLabel', 'title', t->>'title', 'text', t->>'text', 'link', t->>'link', 'by', t->>'by')
      order by t->>'at' desc), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(pl.data->'coachTips') = 'array' then pl.data->'coachTips' else '[]'::jsonb end) t);
end $$;
create or replace function member_session(p_code text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; t items; f items; ids text[];
begin
  select * into t from items where club = c and col = 'trainings' and id = p_id and not deleted;
  if t.id is null or not (t.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if t.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  -- (1.68) the sessions of that day for his team (one per training group): présent once for the day
  ids := array(select j.id from items j where j.club = c and j.col = 'trainings' and not j.deleted and not coalesce((j.data->>'model')::boolean, false)
    and j.data->>'teamId' = t.data->>'teamId' and j.data->>'date' = t.data->>'date');
  if not exists (select 1 from answers a where a.club = c and a.player_id = pl.id and a.status = 'oui' and a.match_id = any(ids || p_id)) then raise exception 'PRESENT_D_ABORD'; end if;
  if array_length(ids, 1) > 1 then
    select * into f from items j where j.club = c and j.col = 'trainings' and j.id = any(ids) and ea_tr_group(c, j.data) = nullif(trim(pl.data->>'trGroup'), '') limit 1;
    if f.id is null then
      return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', 'Entraînement', 'group', 'Groupe choisi par le coach',
        'goal', 'Le coach va choisir ton groupe d''entraînement : ta séance s''affichera ici.', 'exercises', '[]'::jsonb);
    end if;
    t := f;
  end if;
  return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', t.data->>'title', 'group', case when array_length(ids, 1) > 1 then ea_tr_group(c, t.data) end, 'goal', t.data->>'goal',
    'exercises', (select coalesce(jsonb_agg(jsonb_build_object('title', e->>'title', 'duration', e->>'duration', 'org', e->>'org', 'consignes', e->>'consignes', 'materiel', e->>'materiel') order by n), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(t.data->'exercises') = 'array' then t.data->'exercises' else '[]'::jsonb end) with ordinality as x(e, n)));
end $$;
create or replace function member_answer(p_code text, p_match text, p_status text, p_seats int default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items;
begin
  select * into m from items where club = c and col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
  if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_match and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, seats, by_coach) values (c, p_match, pl.id, p_status, greatest(0, least(coalesce(p_seats, 0), 8)), false)
    on conflict (club, match_id, player_id) do update set status = excluded.status, seats = excluded.seats, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
create or replace function member_wellness(p_code text, p_mood int, p_mental int, p_sleep int, p_legs int, p_sore int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb; d text := to_char(current_date, 'YYYY-MM-DD');
begin
  if least(p_mood, p_mental, p_sleep, p_legs, p_sore) < 1 or greatest(p_mood, p_mental, p_sleep, p_legs, p_sore) > 10 then raise exception 'DONNEES'; end if;
  w := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) e where e->>'day' <> d order by e->>'day' desc limit 119) q)
    || jsonb_build_array(jsonb_build_object('day', d, 'mood', p_mood, 'mental', p_mental, 'sleep', p_sleep, 'legs', p_legs, 'sore', p_sore, 'note', left(coalesce(p_note, ''), 200), 'self', true));
  update items set data = jsonb_set(data, '{wellness}', w), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
  return to_jsonb(true); end $$;
create or replace function member_volunteer(p_code text, p_match text, p_task text, p_label text, p_name text, p_remove boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items; v jsonb; lst jsonb; nm text := left(trim(coalesce(p_name, '')), 40);
begin
  if coalesce(p_task, '') !~ '^[A-Za-z0-9_-]{1,30}$' or (nm = '' and not coalesce(p_remove, false)) then raise exception 'DONNEES'; end if;
  select * into m from items where club = c and col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  v := case when jsonb_typeof(m.data->'vol') = 'object' then m.data->'vol' else '{}'::jsonb end;
  lst := case when jsonb_typeof(v->p_task) = 'array' then v->p_task else '[]'::jsonb end;
  if coalesce(p_remove, false) then
    lst := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') <> pl.id);
  elsif not exists (select 1 from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') = pl.id) then
    if jsonb_array_length(lst) >= 8 then raise exception 'COMPLET'; end if;
    lst := lst || jsonb_build_array(jsonb_build_object('id', substr(md5(random()::text), 1, 12), 'name', nm, 'parent', true, 'pid', pl.id, 'label', left(coalesce(p_label, ''), 40)));
  end if;
  update items set data = jsonb_set(data, '{vol}', v || jsonb_build_object(p_task, lst)), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where club = c and col = 'matches' and id = p_match;
  return (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb) from jsonb_array_elements(lst) e); end $$;
create or replace function member_photo(p_code text, p_id uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin return (select ph.data from match_photos ph join items i on i.club = pl.club and i.col = 'matches' and i.id = ph.match_id and not i.deleted
  where ph.club = pl.club and ph.id = p_id and i.data->>'teamId' = any(ea_member_teams(pl))); end $$;

/* ================= espace du propriétaire de la plateforme ================= */
-- La clé du propriétaire se choisit une seule fois, dans les 24 heures qui suivent l'installation (depuis l'appli : Réglages → Propriétaire)
create or replace function ea_owner_ok(p_key text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_key, '') <> '' and exists (select 1 from ea_platform where id = 1 and owner_key_hash = ea_hash(p_key)) $$;
create or replace function ea_owner_init(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_key, '')) < 12 then raise exception 'DONNEES'; end if;
  update ea_platform set owner_key_hash = ea_hash(p_key) where id = 1 and owner_key_hash is null and installed_at > now() - interval '24 hours';
  if not found then raise exception 'PROPRIETAIRE'; end if;
  return to_jsonb(true); end $$;
create or replace function ea_owner_codes(p_key text, p_new int default 0, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare i int;
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  for i in 1 .. least(greatest(coalesce(p_new, 0), 0), 50) loop
    insert into ea_activation (code, note) values ('EA-' || ea_code(4) || '-' || ea_code(4), left(p_note, 120)) on conflict do nothing;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'note', a.note, 'created', a.created_at, 'used', a.used_at, 'club', cl.name) order by a.created_at desc), '[]'::jsonb)
    from ea_activation a left join clubs cl on cl.id = a.used_by); end $$;
create or replace function ea_owner_clubs(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name, 'status', cl.status, 'created', cl.created_at, 'seen', cl.last_seen,
      'players', (select count(*) from items i where i.club = cl.id and i.col = 'players' and not i.deleted),
      'staff', (select count(*) from items i where i.club = cl.id and i.col = 'staff' and not i.deleted),
      'accounts', (select count(*) from accounts a where a.club = cl.id and a.pw_hash is not null),
      'matches', (select count(*) from items i where i.club = cl.id and i.col = 'matches' and not i.deleted)) order by cl.created_at desc), '[]'::jsonb) from clubs cl); end $$;
create or replace function ea_owner_club_set(p_key text, p_club text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'DONNEES'; end if;
  update clubs set status = p_status where id = p_club;
  if p_status = 'suspended' then delete from sessions where club = p_club; end if;
  return to_jsonb(found); end $$;
create or replace function ea_owner_push(p_key text, p_url text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  update push_config set fn_url = nullif(p_url, '') where id = 1;
  return (select jsonb_build_object('secret', secret, 'public', vapid_public) from push_config where id = 1); end $$;

/* ================= droits ================= */
-- a player or a parent (with the personal code) sends a message to the coaches of the category: his own training, his footings. 10 a day at most.
create or replace function member_message(p_code text, p_body text, p_parent boolean default false) returns boolean language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); who text;
begin
  if coalesce(trim(p_body), '') = '' or coalesce(array_length(tids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  if (select count(*) from messages where club = pl.club and author_id = 'member:' || pl.id and created_at > now() - interval '1 day') >= 10 then raise exception 'LIMITE'; end if;
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who, left(p_body, 2000));
  return true; end $$;

-- (1.21) un joueur ou un parent répond présent / absent à un match OU à un entraînement, avec la raison de l'absence (malade, blessé, vacances…)
create or replace function member_reply(p_code text, p_kind text, p_id text, p_status text, p_seats int default 0, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items; r text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
begin
  if p_kind = 'match' then
    select * into m from items where club = c and col = 'matches' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
    if coalesce((m.data->>'played')::boolean, false) then raise exception 'MATCH_PASSE'; end if;
  elsif p_kind = 'training' then
    select * into m from items where club = c and col = 'trainings' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  else raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_id and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, seats, note, by_coach)
    values (c, p_id, pl.id, p_status, case when p_kind = 'match' and p_status = 'oui' then greatest(0, least(coalesce(p_seats, 0), 8)) else 0 end, case when p_status = 'non' then r end, false)
    on conflict (club, match_id, player_id) do update set status = excluded.status, seats = excluded.seats, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
-- ses réponses : les entraînements des 2 semaines à venir (avec sa réponse) et les raisons de ses absences aux matchs
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
  mygrp text := nullif(trim(pl.data->>'trGroup'), '');
begin
  return jsonb_build_object(
    -- (1.68) one line per day : several sessions the same day (one per training group) are answered once ;
    -- the line shows the session of his group when the coaches have chosen it
    'trainings', (with tr as (select i.* from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false)
          and i.data->>'teamId' = any(tids) and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')),
        g as (select tr.data->>'teamId' tm, tr.data->>'date' d, array_agg(tr.id order by tr.data->>'time', tr.id) ids from tr group by 1, 2),
        p as (select g.*, case when array_length(g.ids, 1) = 1 then g.ids[1] else (select t.id from tr t where t.id = any(g.ids) and ea_tr_group(c, t.data) = mygrp limit 1) end mine from g)
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'date', p.d, 'time', t.data->>'time',
          'title', case when p.mine is null then 'Entraînement' else t.data->>'title' end,
          'group', case when array_length(p.ids, 1) > 1 then coalesce(case when p.mine is not null then ea_tr_group(c, t.data) end, 'Groupe choisi par le coach') end,
          'answer', ans.status, 'reason', ans.note) order by p.d, t.data->>'time'), '[]'::jsonb)
      from p join tr t on t.id = coalesce(p.mine, p.ids[1])
      left join lateral (select a.status, a.note from answers a where a.club = c and a.player_id = pl.id and a.match_id = any(p.ids) order by a.updated_at desc limit 1) ans on true),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
grant execute on function member_reply(text, text, text, text, int, text), member_replies(text) to anon, authenticated;
-- (1.22) les demandes de code d'activation envoyées depuis la page « Découvrir Clubbo » ; le propriétaire les voit dans son espace
create table if not exists ea_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  name text not null, club text not null, sport text, town text, contact text not null, message text, status text not null default 'new', code text);
alter table ea_requests enable row level security;
create or replace function ea_request(p_name text, p_club text, p_sport text, p_town text, p_contact text, p_message text, p_trap text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_trap, '') <> '' then return true; end if; -- un robot a rempli le champ caché
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_club, ''))) < 2 or length(trim(coalesce(p_contact, ''))) < 6 then raise exception 'DONNEES'; end if;
  if (select count(*) from ea_requests where created_at > now() - interval '1 hour') >= 20 then raise exception 'LIMITE'; end if;
  if exists (select 1 from ea_requests where lower(contact) = lower(trim(p_contact)) and created_at > now() - interval '1 day') then return true; end if;
  insert into ea_requests (name, club, sport, town, contact, message)
    values (left(trim(p_name), 80), left(trim(p_club), 80), left(p_sport, 20), left(trim(coalesce(p_town, '')), 60), left(trim(p_contact), 120), left(trim(coalesce(p_message, '')), 1000));
  return true; end $$;
create or replace function ea_owner_requests(p_key text, p_id uuid default null, p_status text default null, p_code text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_id is not null and p_status in ('new', 'done', 'dropped') then update ea_requests set status = p_status, code = coalesce(p_code, code) where id = p_id; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'name', name, 'club', club, 'sport', sport, 'town', town, 'contact', contact, 'message', message, 'status', status, 'code', code) order by created_at desc), '[]'::jsonb)
    from (select * from ea_requests order by created_at desc limit 200) r); end $$;
revoke all on function ea_request(text, text, text, text, text, text, text), ea_owner_requests(text, uuid, text, text) from public;
grant execute on function ea_request(text, text, text, text, text, text, text), ea_owner_requests(text, uuid, text, text) to anon, authenticated;
-- (1.23) le propriétaire est prévenu sur son téléphone à chaque nouvelle demande de code
create extension if not exists pg_net;
create table if not exists ea_owner_subs (id uuid primary key default gen_random_uuid(), endpoint text not null unique, created_at timestamptz not null default now());
alter table ea_owner_subs enable row level security;
alter table ea_requests add column if not exists notified_at timestamptz;
-- réveille les téléphones du propriétaire (sans contenu : le téléphone vient ensuite lire « ea_owner_news »)
create or replace function ea_owner_wake() returns void language plpgsql security definer set search_path = public as $$
declare cfg push_config; subs jsonb;
begin
  select * into cfg from push_config where id = 1;
  select jsonb_agg(jsonb_build_object('id', id, 'endpoint', endpoint)) into subs from ea_owner_subs;
  if cfg.fn_url is null or subs is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification propriétaire : %', sqlerrm; end;
end $$;
create or replace function ea_request(p_name text, p_club text, p_sport text, p_town text, p_contact text, p_message text, p_trap text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_trap, '') <> '' then return true; end if; -- un robot a rempli le champ caché
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_club, ''))) < 2 or length(trim(coalesce(p_contact, ''))) < 6 then raise exception 'DONNEES'; end if;
  if (select count(*) from ea_requests where created_at > now() - interval '1 hour') >= 20 then raise exception 'LIMITE'; end if;
  if exists (select 1 from ea_requests where lower(contact) = lower(trim(p_contact)) and created_at > now() - interval '1 day') then return true; end if;
  insert into ea_requests (name, club, sport, town, contact, message)
    values (left(trim(p_name), 80), left(trim(p_club), 80), left(p_sport, 20), left(trim(coalesce(p_town, '')), 60), left(trim(p_contact), 120), left(trim(coalesce(p_message, '')), 1000));
  perform ea_owner_wake();
  return true; end $$;
-- ce téléphone reçoit (ou plus) les alertes du propriétaire ; renvoie la clé publique des notifications
create or replace function ea_owner_sub(p_key text, p_endpoint text default null, p_on boolean default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if coalesce(p_endpoint, '') <> '' and p_on is not null then
    if p_on then insert into ea_owner_subs (endpoint) values (left(p_endpoint, 1000)) on conflict (endpoint) do nothing;
    else delete from ea_owner_subs where endpoint = p_endpoint; end if;
  end if;
  return jsonb_build_object('key', (select vapid_public from push_config where id = 1),
    'on', coalesce(p_endpoint, '') <> '' and exists (select 1 from ea_owner_subs where endpoint = p_endpoint)); end $$;
-- le téléphone réveillé lit ses alertes (seulement s'il est abonné comme propriétaire)
create or replace function ea_owner_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; last ea_requests;
begin
  if coalesce(p_endpoint, '') = '' or not exists (select 1 from ea_owner_subs where endpoint = p_endpoint) then return '[]'::jsonb; end if;
  select count(*) into n from ea_requests where status = 'new' and notified_at is null and created_at > now() - interval '2 days';
  if n = 0 then return '[]'::jsonb; end if;
  select * into last from ea_requests where status = 'new' and notified_at is null order by created_at desc limit 1;
  update ea_requests set notified_at = now() where status = 'new' and notified_at is null;
  return jsonb_build_array(jsonb_build_object('title', case when n > 1 then '📨 ' || n || ' nouvelles demandes de code' else '📨 Nouvelle demande de code' end,
    'body', last.club || coalesce(' · ' || nullif(last.sport, ''), '') || ' · ' || last.name, 'url', '#/proprietaire', 'tag', 'ea-request')); end $$;
revoke all on function ea_owner_wake() from public, anon, authenticated;
revoke all on function ea_request(text, text, text, text, text, text, text), ea_owner_sub(text, text, boolean), ea_owner_news(text) from public;
grant execute on function ea_request(text, text, text, text, text, text, text), ea_owner_sub(text, text, boolean), ea_owner_news(text) to anon, authenticated;
-- (1.26) les joueurs et les parents prévenus sur leur téléphone : convocation envoyée, changement d'horaire ou de lieu, match ou séance annulés
create table if not exists member_subs (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade, player_id text not null,
  endpoint text not null, page text not null default 'parents.html', created_at timestamptz not null default now(), unique (endpoint, player_id));
create table if not exists member_notifs (id bigserial primary key, club text not null references clubs(id) on delete cascade, player_id text not null,
  title text, body text, created_at timestamptz not null default now(), delivered boolean not null default false);
create index if not exists member_notifs_player on member_notifs (club, player_id, delivered);
alter table member_subs enable row level security;
alter table member_notifs enable row level security;
create or replace function member_arr(j jsonb) returns text[] language sql immutable as $$
  select array(select jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end)) $$;
-- ce téléphone est prévenu (ou plus) pour ce joueur ; renvoie la clé publique des notifications
create or replace function member_push(p_code text, p_endpoint text default null, p_on boolean default null, p_page text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if coalesce(p_endpoint, '') <> '' and p_on is not null then
    if p_on then insert into member_subs (club, player_id, endpoint, page) values (pl.club, pl.id, left(p_endpoint, 1000), case when p_page = 'joueurs.html' then 'joueurs.html' else 'parents.html' end)
      on conflict (endpoint, player_id) do update set page = excluded.page;
    else delete from member_subs where endpoint = p_endpoint and player_id = pl.id; end if;
  end if;
  return jsonb_build_object('key', (select vapid_public from push_config where id = 1),
    'on', exists (select 1 from member_subs where endpoint = coalesce(p_endpoint, '') and player_id = pl.id)); end $$;
-- le téléphone réveillé lit ses notifications (celles des joueurs suivis sur ce téléphone)
create or replace function member_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if coalesce(p_endpoint, '') = '' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'url', s.page, 'tag', 'm' || n.id) order by n.id desc), '[]'::jsonb) into r
    from member_notifs n join member_subs s on s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint
    where not n.delivered and n.created_at > now() - interval '2 days';
  update member_notifs n set delivered = true from member_subs s where s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint and not n.delivered;
  delete from member_notifs where created_at < now() - interval '30 days';
  return r; end $$;
-- une notification pour ces joueurs (seulement ceux qui ont un téléphone abonné), puis les téléphones sont réveillés
create or replace function member_note(c text, p_players text[], p_title text, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config;
begin
  if coalesce(array_length(p_players, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240) from member_subs s where s.club = c and s.player_id = any(p_players);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(p_players)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;
create or replace function ea_on_item_members() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; ismatch boolean := new.col = 'matches'; dt date; team text; lbl text; body text; conv text[]; added text[];
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    d := case when new.deleted then o else new.data end;
    if d is null or coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    body := ea_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if ismatch then
      body := (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body
        || coalesce(' · RDV ' || replace(nullif(d->>'rdv', ''), ':', 'h'), '') || coalesce(' · ' || nullif(d->>'place', ''), '');
      conv := member_arr(d->'convoked');
      if new.deleted then perform member_note(new.club, conv, '❌ Match annulé · ' || lbl, body); return null; end if;
      if (d->>'convSent') is null then return null; end if; -- la convocation n'est pas encore envoyée par le coach
      if o is null or (o->>'convSent') is distinct from (d->>'convSent') then perform member_note(new.club, conv, '📣 Convocation · ' || lbl, body); return null; end if;
      added := array(select x from unnest(conv) x where not (coalesce(o->'convoked', '[]'::jsonb) ? x));
      if coalesce(array_length(added, 1), 0) > 0 then perform member_note(new.club, added, '📣 Convocation · ' || lbl, body); end if;
      if (d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time') or (d->>'rdv') is distinct from (o->>'rdv') or (d->>'place') is distinct from (o->>'place') then
        perform member_note(new.club, array(select x from unnest(conv) x where not (x = any(added))), '🕘 Changement · match ' || lbl, body);
      end if;
    else
      if dt > current_date + 7 then return null; end if;
      body := body || coalesce(' · ' || nullif(d->>'title', ''), '');
      conv := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      if new.deleted then perform member_note(new.club, conv, '❌ Séance annulée · ' || lbl, body);
      elsif o is not null and ((d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time')) then perform member_note(new.club, conv, '🕘 Changement · séance ' || lbl, body); end if;
    end if;
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_item_members on items;
create trigger ea_item_members after insert or update on items for each row execute function ea_on_item_members();
revoke all on function member_note(text, text[], text, text), ea_on_item_members() from public, anon, authenticated;
revoke all on function member_push(text, text, boolean, text), member_news(text) from public;
grant execute on function member_push(text, text, boolean, text), member_news(text) to anon, authenticated;
-- (1.26) la formule de chaque club (gratuite jusqu'à 3 équipes, « Club » à 15 € par mois au-delà) et l'usage de l'appli, pour le propriétaire
alter table clubs add column if not exists plan text not null default 'free';
create or replace function ea_owner_clubs(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare wk bigint := (extract(epoch from now() - interval '7 days') * 1000)::bigint;
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'slug', cl.slug, 'name', cl.name, 'status', cl.status, 'created', cl.created_at, 'seen', cl.last_seen, 'plan', cl.plan,
      'teams', (select count(*) from items i where i.club = cl.id and i.col = 'teams' and not i.deleted),
      'players', (select count(*) from items i where i.club = cl.id and i.col = 'players' and not i.deleted),
      'staff', (select count(*) from items i where i.club = cl.id and i.col = 'staff' and not i.deleted),
      'accounts', (select count(*) from accounts a where a.club = cl.id and a.pw_hash is not null),
      'matches', (select count(*) from items i where i.club = cl.id and i.col = 'matches' and not i.deleted),
      'week', (select count(*) from items i where i.club = cl.id and i.col in ('trainings', 'matches', 'schemas', 'players') and i.updated_at > wk),
      'families', (select count(distinct player_id) from member_subs s where s.club = cl.id),
      'up', (select count(*) from items i where i.club = cl.id and i.col = 'reports' and not i.deleted and i.data->>'type' = 'avis' and i.data->>'value' = 'up'),
      'down', (select count(*) from items i where i.club = cl.id and i.col = 'reports' and not i.deleted and i.data->>'type' = 'avis' and i.data->>'value' = 'down'))
    order by cl.created_at desc), '[]'::jsonb) from clubs cl); end $$;
-- les pages les moins aimées, tous clubs confondus
create or replace function ea_owner_votes(p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'down')::int desc, (x->>'up')::int), '[]'::jsonb) from (
    select jsonb_build_object('page', data->>'page', 'up', count(*) filter (where data->>'value' = 'up'), 'down', count(*) filter (where data->>'value' = 'down')) x
    from items where col = 'reports' and not deleted and data->>'type' = 'avis' group by data->>'page') q); end $$;
create or replace function ea_owner_club_plan(p_key text, p_club text, p_plan text) returns boolean language plpgsql security definer set search_path = public as $$
begin if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if p_plan not in ('free', 'club') then raise exception 'DONNEES'; end if;
  update clubs set plan = p_plan where id = p_club; return found; end $$;
-- le club connaît sa formule (pour le message de la version gratuite)
create or replace function club_info(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin return (select jsonb_build_object('id', id, 'slug', slug, 'name', name, 'created', created_at, 'plan', plan) from clubs where id = c); end $$;
revoke all on function ea_owner_votes(text), ea_owner_club_plan(text, text, text) from public;
grant execute on function ea_owner_votes(text), ea_owner_club_plan(text, text, text) to anon, authenticated;
-- (1.27) « Retirer l'accès » : un dirigeant marqué « blocked » ne peut plus créer de compte (même avec le lien d'invitation)
create or replace function club_register(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := coalesce(ea_club(admin_k), ea_club(k)); is_adm boolean; sid text := p->>'staff_id'; s text := ea_token(); a accounts;
begin
  if c is null then raise exception 'CLE_CLUB'; end if;
  is_adm := ea_admin(admin_k, c);
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  if not is_adm and exists (select 1 from items where club = c and col = 'staff' and id = sid and not deleted and coalesce(data->>'blocked', '') not in ('', 'false', 'null')) then raise exception 'ACCES_RETIRE'; end if;
  select * into a from accounts where club = c and staff_id = sid;
  if a.pw_hash is not null and not is_adm then raise exception 'DEJA_INSCRIT'; end if;
  insert into accounts (club, staff_id, last_key, first_keys, display, salt, pw_hash, admin)
    values (c, sid, p->>'last_key', ea_arr(p->'first_keys'), coalesce(p->>'display', ''), s, ea_hash(s || (p->>'h')), coalesce((p->>'admin')::boolean, false) and is_adm)
    on conflict (club, staff_id) do update set last_key = excluded.last_key, first_keys = excluded.first_keys, display = excluded.display, salt = excluded.salt,
      pw_hash = excluded.pw_hash, admin = accounts.admin or excluded.admin, updated_at = now();
  delete from sessions where club = c and staff_id = sid;
  return ea_new_session(c, sid);
end $$;
-- (1.32) un joueur ou un parent répond « absent » (match ou séance) : les coachs de la catégorie sont prévenus, avec la raison
create or replace function ea_on_answer() returns trigger language plpgsql security definer set search_path = public as $$
declare m items; pl items; ismatch boolean; dt date; who text; what text;
begin
  begin
    if new.by_coach or new.status <> 'non' then return null; end if;
    if tg_op = 'UPDATE' and old.status = 'non' and coalesce(old.note, '') = coalesce(new.note, '') then return null; end if;
    select * into m from items where club = new.club and col in ('matches', 'trainings') and id = new.match_id and not deleted limit 1;
    if m.id is null or coalesce(m.data->>'teamId', '') = '' then return null; end if;
    select * into pl from items where club = new.club and col = 'players' and id = new.player_id;
    ismatch := m.col = 'matches';
    begin dt := (m.data->>'date')::date; exception when others then dt := null; end;
    who := coalesce(nullif(ea_short(pl.data), ''), 'Un joueur');
    what := case when ismatch then 'match ' || case when coalesce((m.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(m.data->>'opponent', '?')
      else 'séance' || coalesce(' « ' || nullif(m.data->>'title', '') || ' »', '') end
      || coalesce(' · ' || ea_day(dt), '');
    perform ea_notify(new.club, ea_team_staff(new.club, m.data->>'teamId'), 'planning', 'abs:' || new.match_id || ':' || new.player_id,
      '✗ Absent · ' || who, what || coalesce(' · ' || nullif(new.note, ''), ''),
      case when ismatch then '#/match/' else '#/entrainement/' end || m.id);
  exception when others then raise notice 'notification absence : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_answer_notify on answers;
create trigger ea_answer_notify after insert or update on answers for each row execute function ea_on_answer();
revoke all on function ea_on_answer() from public, anon, authenticated;
do $grants$ declare f record; open_fns text[] := array['ea_create_club', 'club_login', 'club_register', 'club_accounts', 'club_account_set', 'club_me', 'club_teams_done',
  'club_change_pw', 'club_logout', 'club_invite', 'club_info', 'club_pull', 'club_push', 'club_ping', 'club_admin_ping', 'club_messages', 'club_post', 'club_delete_message',
  'club_slots', 'club_set_slots', 'club_bookings', 'club_book', 'club_unbook', 'club_unbook_series', 'club_answers', 'club_set_answer', 'club_photo_add', 'club_photos',
  'club_photo_get', 'club_photo_del', 'club_push_key', 'club_push_sub', 'club_push_unsub', 'club_push_test', 'club_notifs', 'club_mark_read', 'club_reads',
  'club_backups', 'club_backup_now', 'club_backup_get', 'club_backup_auto', 'club_member_codes', 'club_member_given', 'member_view', 'member_standings', 'member_tips', 'member_session', 'member_game', 'member_game_bet', 'member_game_fav', 'club_game', 'club_game_bet', 'club_game_fav', 'member_answer', 'member_message',
  'member_wellness', 'member_volunteer', 'member_photo', 'member_reply', 'member_replies', 'ea_owner_init', 'ea_owner_codes', 'ea_request', 'ea_owner_requests', 'ea_owner_sub', 'ea_owner_news', 'member_push', 'member_news', 'ea_owner_votes', 'ea_owner_club_plan', 'ea_owner_clubs', 'ea_owner_club_set', 'ea_owner_push'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'ea\_%' or p.proname like 'club\_%' or p.proname like 'member\_%') loop
    execute format('revoke all on function %s from public', f.sig);
    begin execute format('revoke all on function %s from anon, authenticated', f.sig); exception when others then null; end;
    if f.proname = any(open_fns) then execute format('grant execute on function %s to anon, authenticated', f.sig); end if;
  end loop;
end $grants$;
notify pgrst, 'reload schema';
