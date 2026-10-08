-- Clubbo 2.07 : l'espace famille et le chat par âge.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run), APRÈS suite-chat.sql. Ne modifie aucune donnée existante.
-- · U15 et en dessous : un seul chat par catégorie, celui des parents (espace parents, avec les coachs). Plus de chat dans l'espace joueur.
-- · U16 et plus, Seniors, Vétérans, Loisirs : le chat des joueurs seulement (pas d'espace parents, pas de salon « Parents »).
-- · « Sourdine parents » : le coach (ou un responsable) met tous les parents en lecture seule ; ils peuvent encore réagir et voter aux sondages.

-- a category with a families' space (same rule as AppCfg.family in the app)
create or replace function ea_cat_family(p_cat text) returns boolean language sql immutable as $$
  select not (coalesce(ea_room_base(p_cat), '') ~* '(s[eé]nior|v[eé]t[eé]ran|cadet|junior|loisir|(^|[^a-z])u[ -]?(1[6-9]|[2-9][0-9])([^0-9]|$))') $$;
-- the one room of a category: « U13 · Parents » (U15 and younger) or « Seniors » (U16 and over)
create or replace function ea_cat_room(p_cat text) returns text language sql immutable as $$
  select case when ea_cat_family(p_cat) then ea_room_base(p_cat) || ' · Parents' else ea_room_base(p_cat) end $$;

-- a code opens only the room of each of its categories
create or replace function ea_member_cat_ok(pl items, p_cat text) returns boolean language sql stable security definer set search_path = public as $$
  select ea_room_base(p_cat) = any(ea_chat_cats(pl.club, ea_member_teams(pl))) and p_cat = ea_cat_room(p_cat) $$;

-- the players' page (p_room null): the players' chats (U16 and over); the parents' page (« all » / « parents »): the parents' rooms (U15 and younger)
create or replace function member_chat(p_code text, p_cat text default null, p_after bigint default 0, p_room text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); base text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); cats text[]; cat text;
begin
  cats := case when p_room in ('all', 'parents') then array(select b || ' · Parents' from unnest(base) b where ea_cat_family(b))
    else array(select b from unnest(base) b where not ea_cat_family(b)) end;
  if cardinality(cats) = 0 and p_room in ('all', 'parents') then cats := array(select b from unnest(base) b where not ea_cat_family(b)); end if;
  if cardinality(cats) = 0 then return jsonb_build_object('cats', '[]'::jsonb, 'msgs', '[]'::jsonb); end if;
  cat := case when p_cat = any(cats) then p_cat else cats[1] end;
  return ea_chat_view(pl.club, cat, pl.id, false, p_after) || jsonb_build_object('cats', to_jsonb(cats)); end $$;

-- the coach (or a manager): the team opens the one room of its category
create or replace function ea_chat_coach(k text, p_team text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); st items; t items; team text := split_part(coalesce(p_team, ''), '|', 1);
begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  select * into t from items where club = c and col = 'teams' and id = team and not deleted;
  if t.id is null then raise exception 'DONNEES'; end if;
  select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
  if not ea_admin(k, c) and not (ea_team_cat(t.data) = any(ea_chat_cats(c, ea_arr(st.data->'teamIds')))) then raise exception 'DONNEES'; end if;
  return jsonb_build_object('club', c, 'sid', sid, 'cat', ea_cat_room(ea_team_cat(t.data)),
    'name', 'Coach ' || coalesce(nullif(split_part(trim(regexp_replace(coalesce(st.data->>'firstName', ''), '\(.*?\)', '', 'g')), ' ', 1), ''), ea_short(st.data), 'du club')); end $$;

-- « Sourdine parents » (the chat closed by a coach): the parents can no longer write either (before, only the players were stopped)
create or replace function ea_chat_post(c text, p_cat text, p_me text, p_kind text, p_name text, p_body text, p_reply bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 500); id bigint;
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind <> 'coach' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body, reply_to) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b,
    (select r.id from chat_msgs r where r.club = c and r.cat = p_cat and r.id = p_reply)) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;
create or replace function ea_chat_poll(c text, p_cat text, p_me text, p_kind text, p_name text, p_q text, p_opts text[], p_multi boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare q text := left(trim(regexp_replace(coalesce(p_q, ''), '[\x00-\x1f\x7f]', ' ', 'g')), 200); opts text[]; id bigint;
begin
  select array_agg(x order by i) into opts from (select left(trim(regexp_replace(o, '[\x00-\x1f\x7f]', ' ', 'g')), 80) x, i from unnest(coalesce(p_opts, '{}')) with ordinality u(o, i)) z where x <> '';
  if q = '' or coalesce(array_length(opts, 1), 0) < 2 or array_length(opts, 1) > 6 then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind <> 'coach' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, q || ' ' || array_to_string(opts, ' . ')) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body, poll) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), q,
    jsonb_build_object('opts', to_jsonb(opts), 'multi', coalesce(p_multi, false), 'closed', false)) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;

revoke all on function ea_cat_family(text), ea_cat_room(text) from public, anon, authenticated;
notify pgrst, 'reload schema';
