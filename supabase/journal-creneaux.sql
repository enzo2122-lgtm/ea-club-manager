-- Clubbo 3.14 : le journal des modifications (qui, quand, quoi) et les créneaux protégés.
-- À coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Sans danger à relancer. Ne modifie aucune donnée existante.
-- 1) club_push (la synchronisation) : la version 2.91 (fusion à trois) + les accès limités intendance / référent médical (3.0x),
--    que la 2.91 avait perdus, + elle note qui envoie (pour le journal).
-- 2) Le journal : chaque ajout, modification, suppression d'un joueur, match, séance, équipe, schéma, dirigeant, réglage, créneau.
--    Les modifications d'une même personne sur le même élément pendant 10 minutes forment une seule ligne. Gardé 18 mois.
-- 3) Les créneaux (terrain, vestiaires) : seul celui qui a réservé, ou un responsable, peut les libérer — vérifié par le serveur
--    avec la connexion de la personne (avant, l'appli seule le vérifiait).

create table if not exists audit_log (id bigserial primary key, club text not null references clubs(id) on delete cascade, at timestamptz not null default now(),
  col text not null, item_id text not null, action text not null, who text, label text, fields text[] not null default '{}');
create index if not exists audit_log_club_at on audit_log (club, at desc);
create index if not exists audit_log_item on audit_log (club, col, item_id, id desc);
alter table audit_log enable row level security; -- aucune lecture directe : seulement par club_journal (responsables)

create or replace function ea_label(p_col text, d jsonb) returns text language sql immutable as $$
  select left(coalesce(case p_col
    when 'players' then nullif(trim(coalesce(d->>'firstName', '') || ' ' || coalesce(d->>'lastName', '')), '')
    when 'staff' then nullif(trim(coalesce(d->>'firstName', '') || ' ' || coalesce(d->>'lastName', '')), '')
    when 'matches' then 'Match du ' || coalesce(d->>'date', '?') || ' contre ' || coalesce(nullif(d->>'opponent', ''), '?')
    when 'trainings' then 'Séance du ' || coalesce(d->>'date', '?') || coalesce(' · ' || nullif(d->>'title', ''), '')
    when 'club' then 'Réglages du club'
    else null end, d->>'name', d->>'title', ''), 140) $$;

create or replace function ea_on_items_log() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := coalesce(new.data, old.data); act text; f text[] := '{}'; w text; lst audit_log;
begin
  if tg_op = 'UPDATE' and new.deleted and not coalesce(old.deleted, false) then act := 'suppression';
  elsif tg_op = 'INSERT' or (coalesce(old.deleted, false) and not new.deleted) then act := 'ajout';
  elsif new.deleted then return new;
  else
    act := 'modification';
    select coalesce(array_agg(k order by k), '{}') into f from (select jsonb_object_keys(coalesce(new.data, '{}'::jsonb)) k union select jsonb_object_keys(coalesce(old.data, '{}'::jsonb))) ks
      where k not in ('updatedAt', 'editedBy', 'rev', 'sync', 'example') and (new.data->k) is distinct from (old.data->k);
    if coalesce(array_length(f, 1), 0) = 0 then return new; end if;
  end if;
  w := coalesce(nullif(current_setting('ea.who', true), ''), new.data->>'editedBy');
  select * into lst from audit_log where club = new.club and col = new.col and item_id = new.id order by id desc limit 1;
  if act = 'modification' and lst.id is not null and lst.action = 'modification' and coalesce(lst.who, '') = coalesce(w, '') and lst.at > now() - interval '10 minutes' then
    update audit_log set at = now(), label = ea_label(new.col, d), fields = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(lst.fields || f) x) where id = lst.id;
  else
    insert into audit_log (club, col, item_id, action, who, label, fields) values (new.club, new.col, new.id, act, w, ea_label(new.col, d), f);
  end if;
  return new;
exception when others then raise notice 'journal : %', sqlerrm; return new; -- le journal ne bloque jamais une modification
end $$;
drop trigger if exists items_log on items;
create trigger items_log after insert or update on items for each row execute function ea_on_items_log();

create or replace function ea_on_bookings_log() returns trigger language plpgsql security definer set search_path = public as $$
declare b bookings := case when tg_op = 'DELETE' then old else new end;
  lbl text := 'Créneau ' || b.field || ' · ' || to_char(b.date, 'DD/MM') || ' ' || lpad((b.start_min / 60)::text, 2, '0') || 'h' || lpad((b.start_min % 60)::text, 2, '0')
    || '–' || lpad((b.end_min / 60)::text, 2, '0') || 'h' || lpad((b.end_min % 60)::text, 2, '0') || coalesce(' · ' || nullif(b.team_name, ''), '');
begin
  insert into audit_log (club, col, item_id, action, who, label) values (b.club, 'bookings', b.id::text, case when tg_op = 'DELETE' then 'suppression' else 'ajout' end,
    case when tg_op = 'DELETE' then coalesce(nullif(current_setting('ea.who', true), ''), '?') else b.author_id end, lbl);
  return null;
exception when others then raise notice 'journal : %', sqlerrm; return null;
end $$;
drop trigger if exists bookings_log on bookings;
create trigger bookings_log after insert or delete on bookings for each row execute function ea_on_bookings_log();

-- la synchronisation (2.91 + accès limités + qui envoie)
create or replace function club_push(k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int := 0; sid text := ea_staff(k); acc text; r record; cur items; confl jsonb := '[]'::jsonb;
begin
  if sid is not null and not ea_admin(k, c) then
    select s.data->>'access' into acc from items s where s.club = c and s.col = 'staff' and s.id = sid and not s.deleted;
    if acc = 'read' then raise exception 'LECTURE_SEULE'; end if;
    if acc in ('kit', 'med') and exists (select 1 from jsonb_to_recordset(p) as x(col text) where x.col is distinct from 'players') then raise exception 'ACCES_LIMITE'; end if;
  end if;
  perform set_config('ea.who', coalesce(sid, ''), true);
  perform pg_advisory_xact_lock(hashtext('items:' || c));
  for r in select * from jsonb_to_recordset(p) as x(col text, id text, data jsonb, u bigint, del boolean, bu bigint)
      where x.col in ('teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports', 'club') and coalesce(x.id, '') <> '' loop
    select * into cur from items where club = c and col = r.col and id = r.id;
    if cur.id is not null and r.bu is not null and r.col <> 'club' and cur.updated_at > r.bu and not cur.deleted then
      confl := confl || jsonb_build_object('col', r.col, 'id', r.id, 'data', cur.data, 'u', cur.updated_at, 'del', cur.deleted, 'rev', cur.rev);
      continue;
    end if;
    if cur.id is not null and cur.updated_at > coalesce(r.u, 0) then
      if r.bu is not null then confl := confl || jsonb_build_object('col', r.col, 'id', r.id, 'data', cur.data, 'u', cur.updated_at, 'del', cur.deleted, 'rev', cur.rev); end if;
      continue;
    end if;
    insert into items (club, col, id, data, updated_at, deleted, rev)
      values (c, r.col, r.id, case when coalesce(r.del, false) then null else r.data end, coalesce(r.u, 0), coalesce(r.del, false), nextval('items_rev'))
    on conflict (club, col, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev;
    n := n + 1;
  end loop;
  return jsonb_build_object('n', n, 'conflicts', confl);
end $$;

-- libérer un créneau : celui qui l'a réservé (sa connexion), ou un responsable
create or replace function club_unbook(k text, p_id uuid, p_author text, admin_k text default null) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); me text := coalesce(ea_staff(k), p_author); adm boolean := ea_admin(k, c) or ea_admin(admin_k, c);
begin
  perform set_config('ea.who', coalesce(me, ''), true);
  delete from bookings where club = c and id = p_id and (adm or author_id = me);
  if not found and exists (select 1 from bookings where club = c and id = p_id) then raise exception 'CRENEAU_AUTEUR'; end if;
  return found;
end $$;
create or replace function club_unbook_series(k text, p_series text, p_author text, admin_k text default null) returns int language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); me text := coalesce(ea_staff(k), p_author); adm boolean := ea_admin(k, c) or ea_admin(admin_k, c); n int;
begin
  perform set_config('ea.who', coalesce(me, ''), true);
  delete from bookings where club = c and series = p_series and date >= current_date and (adm or author_id = me);
  get diagnostics n = row_count;
  if n = 0 and exists (select 1 from bookings where club = c and series = p_series and date >= current_date) then raise exception 'CRENEAU_AUTEUR'; end if;
  return n;
end $$;

-- le journal, pour les responsables : les plus récents d'abord, 100 par page (p_before = id de la dernière ligne lue)
create or replace function club_journal(k text, p_before bigint default null, p_col text default null, p_who text default null, admin_k text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin
  if not (ea_admin(k, c) or ea_admin(admin_k, c)) then raise exception 'RESPONSABLE'; end if;
  delete from audit_log where club = c and at < now() - interval '18 months';
  return (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'col', l.col, 'item', l.item_id, 'action', l.action, 'who', l.who,
      'name', (select nullif(trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), '') from items st where st.club = c and st.col = 'staff' and st.id = l.who),
      'label', l.label, 'fields', l.fields) order by l.id desc), '[]'::jsonb)
    from (select * from audit_log where club = c and (p_before is null or id < p_before) and (p_col is null or col = p_col) and (p_who is null or who = p_who)
      order by id desc limit 100) l);
end $$;
revoke all on function club_journal(text, bigint, text, text, text) from public;
grant execute on function club_journal(text, bigint, text, text, text) to anon, authenticated;
revoke all on function ea_on_items_log(), ea_on_bookings_log() from public, anon, authenticated;
notify pgrst, 'reload schema';
