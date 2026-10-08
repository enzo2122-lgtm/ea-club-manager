/* (2.63) Saisie partagée du match en direct : le coach donne un code (lien / QR) à un adjoint ou un parent ;
   celui-ci note depuis son téléphone (aide.html) les buts, les occasions, les arrêts, la possession.
   Ses actions arrivent dans une boîte (live_inbox) que l'appli du coach relève toutes les quelques secondes et ajoute au fil du match :
   le match reste écrit par le coach seul (pas de conflit). Le code ne vaut que pour ce match et 2 jours.
   À coller dans Supabase → SQL Editor. */
create table if not exists live_share (club text not null references clubs(id) on delete cascade, match_id text not null, code text not null unique,
  created_at timestamptz not null default now(), primary key (club, match_id));
create table if not exists live_inbox (id bigserial primary key, club text not null, match_id text not null, code text not null, who text not null default '',
  ev jsonb not null, at timestamptz not null default now());
create index if not exists live_inbox_m on live_inbox (club, match_id, id);
alter table live_share enable row level security; alter table live_inbox enable row level security;
revoke all on live_share, live_inbox from public, anon, authenticated;

-- the coach: the code of a match (the same one if it exists)
create or replace function club_live_share(k text, p_match text) returns text language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); cd text;
begin
  if not exists (select 1 from items where club = c and col = 'matches' and id = p_match and not deleted) then raise exception 'DONNEES'; end if;
  select code into cd from live_share where club = c and match_id = p_match and created_at > now() - interval '2 days';
  if cd is null then
    delete from live_share where club = c and match_id = p_match;
    cd := 'M' || ea_code(7); insert into live_share (club, match_id, code) values (c, p_match, cd);
  end if;
  return cd; end $$;
-- the coach: what the helpers sent since the last one he took
create or replace function club_live_inbox(k text, p_match text, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ev', ev, 'who', who, 'at', (extract(epoch from at) * 1000)::bigint) order by id), '[]'::jsonb)
    from live_inbox where club = c and match_id = p_match and id > coalesce(p_after, 0));
end $$;
-- the helper: the match of the code (teams, the players called up, the score known on the server, what he sent)
create or replace function ea_live_code(p_code text) returns live_share language sql stable security definer set search_path = public as $$
  select * from live_share where code = upper(trim(p_code)) and created_at > now() - interval '2 days' $$;
create or replace function live_helper(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s live_share := ea_live_code(p_code); m items;
begin
  if s.code is null then raise exception 'CODE'; end if;
  select * into m from items where club = s.club and col = 'matches' and id = s.match_id and not deleted;
  if not found then raise exception 'CODE'; end if;
  return jsonb_build_object('club', (select data->>'name' from items where club = s.club and col = 'club' and id = 'club'),
    'team', (select data->>'name' from items where club = s.club and col = 'teams' and id = m.data->>'teamId'),
    'opponent', m.data->>'opponent', 'home', m.data->'home', 'date', m.data->>'date', 'time', m.data->>'time', 'gf', m.data->'gf', 'ga', m.data->'ga',
    'status', m.data #>> '{live,status}',
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', ea_short(p.data), 'n', p.data->>'number') order by p.data->>'firstName'), '[]'::jsonb)
      from items p where p.club = s.club and p.col = 'players' and not p.deleted and coalesce(m.data->'convoked', '[]'::jsonb) ? p.id),
    'sent', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ev', ev, 'who', who, 'at', at) order by id desc), '[]'::jsonb) from (select * from live_inbox where club = s.club and match_id = s.match_id order by id desc limit 30) z));
end $$;
create or replace function live_helper_add(p_code text, p_ev jsonb, p_who text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare s live_share := ea_live_code(p_code); t text := p_ev->>'type';
begin
  if s.code is null then raise exception 'CODE'; end if;
  if t not in ('goal', 'against', 'chance', 'chanceThem', 'post', 'save', 'yellow', 'poss', 'note') then raise exception 'DONNEES'; end if;
  if (select count(*) from live_inbox where code = s.code and at > now() - interval '1 minute') >= 40 then raise exception 'LIMITE'; end if;
  insert into live_inbox (club, match_id, code, who, ev) values (s.club, s.match_id, s.code, left(trim(coalesce(p_who, '')), 40),
    jsonb_strip_nulls(jsonb_build_object('type', t, 'player', nullif(left(coalesce(p_ev->>'player', ''), 40), ''), 'assist', nullif(left(coalesce(p_ev->>'assist', ''), 40), ''),
      'who', case when t = 'poss' and p_ev->>'who' in ('us', 'them', 'stop') then p_ev->>'who' end, 'text', nullif(left(trim(coalesce(p_ev->>'text', '')), 120), ''))));
  return live_helper(p_code);
end $$;
revoke all on function ea_live_code(text) from public, anon, authenticated;
grant execute on function club_live_share(text, text), club_live_inbox(text, text, bigint) to anon, authenticated;
grant execute on function live_helper(text), live_helper_add(text, jsonb, text) to anon, authenticated;
notify pgrst, 'reload schema';
