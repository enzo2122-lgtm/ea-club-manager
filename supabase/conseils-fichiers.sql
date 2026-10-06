-- Clubbo 1.74 : les conseils du coach avec une séance prête, des liens vidéo, des PDF et des images, lisibles par le joueur.
-- À coller une fois dans Supabase : SQL Editor → New query → coller → Run. Crée la table des fichiers des conseils (tip_files), ne modifie aucune donnée.
create table if not exists tip_files (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade,
  player_id text not null, tip_id text not null, name text, mime text not null, data text not null check (length(data) < 4200000), created_at timestamptz not null default now());
create index if not exists tip_files_player on tip_files (club, player_id);
alter table tip_files enable row level security;
-- (1.74) a coach joins a PDF or an image to a tip for one player (at most 40 files a player, ~3 Mo each)
create or replace function club_tip_file_add(k text, p_player text, p_tip text, p_name text, p_mime text, p_data text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); r uuid;
begin
  if coalesce(p_mime, '') not in ('application/pdf', 'image/jpeg', 'image/png') or coalesce(p_data, '') not like 'data:' || p_mime || ';base64,%' or length(p_data) >= 4200000 then raise exception 'DONNEES'; end if;
  if not exists (select 1 from items where club = c and col = 'players' and id = p_player and not deleted) then raise exception 'DONNEES'; end if;
  if (select count(*) from tip_files where club = c and player_id = p_player) >= 40 then raise exception 'FICHIERS_MAX'; end if;
  insert into tip_files (club, player_id, tip_id, name, mime, data) values (c, p_player, left(p_tip, 40), left(p_name, 120), p_mime, p_data) returning id into r;
  return to_jsonb(r); end $$;
create or replace function club_tip_file_del(k text, p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin delete from tip_files where club = c and id = p_id; return found; end $$;
-- the player (or his parents) reads a file of HIS tips only
create or replace function member_tip_file(p_code text, p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin return (select jsonb_build_object('name', name, 'mime', mime, 'data', data) from tip_files where club = pl.club and player_id = pl.id and id = p_id); end $$;
-- (1.65 → 1.74) the coach's tips for this player: the exercise, a ready session, video links, files
create or replace function member_tips(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t->>'id', 'at', t->>'at', 'icon', t->>'icon', 'themeLabel', t->>'themeLabel', 'title', t->>'title', 'text', t->>'text', 'link', t->>'link', 'by', t->>'by',
      'session', t->'session', 'links', t->'links', 'files', t->'files') order by t->>'at' desc), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(pl.data->'coachTips') = 'array' then pl.data->'coachTips' else '[]'::jsonb end) t);
end $$;
grant execute on function club_tip_file_add(text, text, text, text, text, text), club_tip_file_del(text, uuid), member_tip_file(text, uuid), member_tips(text) to anon, authenticated;
notify pgrst, 'reload schema';
