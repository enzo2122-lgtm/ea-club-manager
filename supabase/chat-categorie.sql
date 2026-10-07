-- Clubbo 1.96 : le chat de la catégorie. Joueurs de la catégorie (équipes A et B ensemble) et leurs coachs.
-- Mots vulgaires ou insultants bloqués dans toutes les catégories, sauf Seniors et Vétérans.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run). Ne modifie aucune donnée existante.

create table if not exists chat_msgs (id bigserial primary key, club text not null references clubs(id) on delete cascade, cat text not null,
  author text not null, kind text not null check (kind in ('player', 'coach')), name text not null, body text not null,
  at timestamptz not null default now(), deleted boolean not null default false, deleted_by text);
create index if not exists chat_msgs_cat on chat_msgs (club, cat, id);
create table if not exists chat_state (club text not null references clubs(id) on delete cascade, cat text not null, off boolean not null default false,
  by_name text, at timestamptz not null default now(), primary key (club, cat));
alter table chat_msgs enable row level security;
alter table chat_state enable row level security;
revoke all on chat_msgs, chat_state from public, anon, authenticated;
revoke all on sequence chat_msgs_id_seq from public, anon, authenticated;

-- the category of a team: its « category » field, otherwise its name without the last letter or number (« Seniors A » → « Seniors »)
create or replace function ea_team_cat(d jsonb) returns text language sql immutable as $$
  select coalesce(nullif(trim(d->>'category'), ''), regexp_replace(trim(coalesce(d->>'name', '')), '\s+[A-Za-z0-9]$', '')) $$;
create or replace function ea_chat_cats(c text, p_teams text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct ea_team_cat(t.data) order by ea_team_cat(t.data)), '{}') from items t
    where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(coalesce(p_teams, '{}')) and ea_team_cat(t.data) <> '' $$;
-- Seniors and Vétérans: adults, no filter
create or replace function ea_chat_free(p_cat text) returns boolean language sql immutable as $$
  select coalesce(p_cat, '') ~* '(s[eé]nior|v[eé]t[eé]ran)' $$;

-- the text as the filter reads it: lower case, no accents, 0 → o, 1 → i, 3 → e, @ → a…, only letters, « connnnard » → « connard »
create or replace function ea_chat_fold(s text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(translate(lower(coalesce(s, '')), 'àâäáãåéèêëíìîïóòôöõúùûüçñœ0134578@$€', 'aaaaaaeeeeiiiiooooouuuucnooieastbase'),
    '[^a-z]+', ' ', 'g'), '([a-z])\1\1+', '\1\1', 'g')) $$;
-- true when the message has a vulgar or insulting word (the club can add its own words in the club item: data.chatBan = ["mot", …])
create or replace function ea_chat_bad(c text, p_body text) returns boolean language plpgsql stable security definer set search_path = public as $$
declare f text := ' ' || ea_chat_fold(p_body) || ' '; nosp text := replace(f, ' ', '');
  -- short words: only alone (« con » but not « cône », « nik » but not « Nike »)
  w_short text := 'con|cons|cul|culs|pd|pds|tg|ftg|fdp|ntm|nik|bz|encul|salop|merd';
  -- the others: also with an ending (s, x, e, es, er, ée, ez)
  w_long text := 'conne|connard|connarde|conard|connasse|conasse|pute|putain|putin|pede|salope|salaud|encule|enculer|batard|merde|merdeux|merdique|chier|nique|niquer|niker|'
    || 'bite|couille|foutre|enfoire|abruti|debile|cretin|imbecile|mongol|gogol|triso|trisomique|negre|negro|bougnoule|youpin|tapette|tafiole|gouine|chienne|catin|'
    || 'branleur|branlette|suce|suceur|suceuse|nichon|chatte|pouffiasse|poufiasse|grognasse|raclure|ordure|bouffon|petasse|garce|fumier|enflure|emmerde|emmerder|'
    || 'fuck|fucking|fucker|shit|bitch|motherfucker|dick|pussy|nigga|nigger|bastard|asshole|cunt';
  w_phrase text := 'ta gueule|ta race|nique ta';
  -- written with spaces or dots between the letters (« c o n n a r d »): long words that are inside no ordinary word
  w_nosp text := 'connard|connasse|encule|batard|pouffiasse|putain|tagueule|niquetamere|filsdepute|fuck';
  extra text;
begin
  if f ~ (' (' || w_short || ') ') or f ~ (' (' || w_long || ')(s|x|e|es|er|ee|ez)? ') or f ~ (' (' || w_phrase || ') ') or nosp ~ ('(' || w_nosp || ')') then return true; end if;
  select string_agg(w, '|') into extra from (select ea_chat_fold(x) w from items i, jsonb_array_elements_text(case when jsonb_typeof(i.data->'chatBan') = 'array' then i.data->'chatBan' else '[]'::jsonb end) x
    where i.club = c and i.col = 'club' and i.id = 'club' and not i.deleted) z where w <> '';
  return extra is not null and f ~ (' (' || extra || ')(s|x|e|es)? ');
end $$;

-- the chat of one category, « me » = the person asking; p_after: only the messages after this one (the page asks again every few seconds)
create or replace function ea_chat_view(c text, p_cat text, p_me text, p_mod boolean, p_after bigint) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object('cat', p_cat, 'filtered', not ea_chat_free(p_cat), 'mod', p_mod,
    'off', coalesce((select off from chat_state where club = c and cat = p_cat), false),
    'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me,
        'body', case when m.deleted then null else m.body end, 'deleted', m.deleted) order by m.id), '[]'::jsonb)
      from (select * from chat_msgs where club = c and cat = p_cat and id > coalesce(p_after, 0) and at > now() - interval '120 days' order by id desc limit 150) m),
    -- the messages deleted since (to take them away from the screen)
    'gone', (select coalesce(jsonb_agg(id), '[]'::jsonb) from chat_msgs where club = c and cat = p_cat and deleted and coalesce(p_after, 0) > 0 and id <= p_after and at > now() - interval '120 days'));
end $$;
create or replace function ea_chat_post(c text, p_cat text, p_me text, p_kind text, p_name text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 500); id bigint;
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind = 'player' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;

-- the player (personal code): the chat of his category (several categories: the one asked, otherwise the first)
create or replace function member_chat(p_code text, p_cat text default null, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); cats text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); cat text;
begin
  if cardinality(cats) = 0 then return jsonb_build_object('cats', '[]'::jsonb, 'msgs', '[]'::jsonb); end if;
  cat := case when p_cat = any(cats) then p_cat else cats[1] end;
  return ea_chat_view(pl.club, cat, pl.id, false, p_after) || jsonb_build_object('cats', to_jsonb(cats)); end $$;
create or replace function member_chat_post(p_code text, p_cat text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_post(pl.club, p_cat, pl.id, 'player', ea_short(pl.data), p_body); end $$;
-- a player takes back one of his own messages
create or replace function member_chat_del(p_code text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  update chat_msgs set deleted = true, deleted_by = pl.id where club = pl.club and id = p_id and author = pl.id;
  return to_jsonb(found); end $$;

-- the coach (his login), for one of his teams (a responsable: any team of the club). The coach moderates: he deletes any message, closes the chat.
create or replace function ea_chat_coach(k text, p_team text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); st items; t items;
begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  select * into t from items where club = c and col = 'teams' and id = p_team and not deleted;
  if t.id is null then raise exception 'DONNEES'; end if;
  select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
  if not ea_admin(k, c) and not (ea_team_cat(t.data) = any(ea_chat_cats(c, ea_arr(st.data->'teamIds')))) then raise exception 'DONNEES'; end if;
  return jsonb_build_object('club', c, 'sid', sid, 'cat', ea_team_cat(t.data),
    'name', 'Coach ' || coalesce(nullif(split_part(trim(regexp_replace(coalesce(st.data->>'firstName', ''), '\(.*?\)', '', 'g')), ' ', 1), ''), ea_short(st.data), 'du club')); end $$;
create or replace function club_chat(k text, p_team text, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_view(x->>'club', x->>'cat', x->>'sid', true, p_after); end $$;
create or replace function club_chat_post(k text, p_team text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_post(x->>'club', x->>'cat', x->>'sid', 'coach', x->>'name', p_body); end $$;
create or replace function club_chat_del(k text, p_team text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  update chat_msgs set deleted = true, deleted_by = x->>'sid' where club = x->>'club' and cat = x->>'cat' and id = p_id;
  return to_jsonb(found); end $$;
create or replace function club_chat_off(k text, p_team text, p_off boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  insert into chat_state (club, cat, off, by_name) values (x->>'club', x->>'cat', coalesce(p_off, false), x->>'name')
    on conflict (club, cat) do update set off = excluded.off, by_name = excluded.by_name, at = now();
  return to_jsonb(coalesce(p_off, false)); end $$;

revoke all on function ea_chat_bad(text, text), ea_chat_view(text, text, text, boolean, bigint), ea_chat_post(text, text, text, text, text, text), ea_chat_coach(text, text), ea_chat_cats(text, text[]) from public, anon, authenticated;
grant execute on function member_chat(text, text, bigint), member_chat_post(text, text, text), member_chat_del(text, bigint),
  club_chat(text, text, bigint), club_chat_post(text, text, text), club_chat_del(text, text, bigint), club_chat_off(text, text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
