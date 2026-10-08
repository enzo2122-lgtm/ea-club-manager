-- Clubbo 2.26 : « qui a vu » la convocation ou la séance, et les joueurs silencieux. À coller une fois dans Supabase (SQL Editor → Run).
-- (2.26) chaque fois que l'espace joueur ou parents affiche un match ou une séance à venir, il le dit au serveur (lecture : rien d'autre) ;
-- le coach voit alors, pour chaque événement : qui a répondu, qui a vu sans répondre, qui n'a pas ouvert l'appli, qui n'a jamais utilisé son code.
create table if not exists member_seen (club text not null references clubs(id) on delete cascade, player_id text not null, event_id text not null,
  at timestamptz not null default now(), primary key (club, player_id, event_id));
alter table member_seen enable row level security;
create index if not exists member_seen_event on member_seen (club, event_id);
-- le joueur (ou ses parents, avec son code) a vu ces événements (au plus 60 à la fois, seulement ceux de sa catégorie)
create or replace function member_seen(p_code text, p_ids text[]) returns boolean language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_cat_teams(pl);
begin
  insert into member_seen (club, player_id, event_id, at)
    select c, pl.id, i.id, now() from items i where i.club = c and i.col in ('matches', 'trainings') and not i.deleted and i.id = any(p_ids[1:60]) and i.data->>'teamId' = any(tids)
    on conflict (club, player_id, event_id) do update set at = now();
  return true;
end $$;
grant execute on function member_seen(text, text[]) to anon, authenticated;
-- le coach : pour ces événements, qui les a vus (et quand), et pour les joueurs de ses équipes : dernière ouverture de l'appli, notifications actives
create or replace function club_seen(k text, admin_k text, p_ids text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k); adm boolean := ea_admin(admin_k, c); st items; tids text[] := '{}';
begin
  if not adm then select * into st from items where club = c and col = 'staff' and id = ea_staff(k) and not deleted; tids := ea_arr(st.data->'teamIds'); end if;
  return jsonb_build_object(
    'seen', (select coalesce(jsonb_object_agg(e.id, e.who), '{}'::jsonb) from (
      select s.event_id id, jsonb_object_agg(s.player_id, s.at) who from member_seen s where s.club = c and s.event_id = any(p_ids[1:60]) group by s.event_id) e),
    'codes', (select coalesce(jsonb_object_agg(mc.player_id, jsonb_build_object('used', mc.used_at, 'first', mc.first_at, 'push', exists (select 1 from member_subs ms where ms.club = c and ms.player_id = mc.player_id))), '{}'::jsonb)
      from member_codes mc join items i on i.club = c and i.col = 'players' and i.id = mc.player_id and not i.deleted
      where mc.club = c and (adm or ea_member_teams(i) && tids)));
end $$;
revoke all on function club_seen(text, text, text[]) from public;
grant execute on function club_seen(text, text, text[]) to anon, authenticated;
-- ménage : les « vus » de plus de 120 jours partent avec la sauvegarde de nuit (ou à la main)
create or replace function ea_seen_clean() returns void language sql security definer set search_path = public as $$ delete from member_seen where at < now() - interval '120 days' $$;
revoke all on function ea_seen_clean() from public, anon, authenticated;
