-- Clubbo 3.14 : les pièces jointes dans les chats des catégories et dans la messagerie du club
-- (PDF, vidéos jusqu'à 50 Mo, photos en taille réelle, Word, Excel, PowerPoint, texte ; 20 Mo pour le reste).
-- À coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Sans danger à relancer. Ne modifie aucune donnée existante.
-- Le fichier arrive en morceaux de 3 Mo (pour passer partout), il est relu morceau par morceau quand on le touche.
-- Gardé 90 jours, comme les photos du chat. Un joueur ou un parent envoie un fichier seulement là où il peut envoyer des photos.

create table if not exists att_files (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade,
  scope text not null, name text not null, mime text not null, size bigint not null, parts int not null, author text, at timestamptz not null default now(), done boolean not null default false);
create index if not exists att_files_club on att_files (club, at);
create table if not exists att_parts (att uuid not null references att_files(id) on delete cascade, n int not null, data text not null, primary key (att, n));
alter table att_files enable row level security;
alter table att_parts enable row level security;

-- les règles communes : le type, le poids, le nombre de morceaux, et pas plus de 40 fichiers / 400 Mo par personne et par jour
create or replace function ea_att_begin(c text, p_scope text, p_by text, p_name text, p_mime text, p_size bigint, p_parts int) returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; lim bigint := case when p_mime like 'video/%' then 52428800 else 20971520 end;
begin
  if coalesce(p_mime, '') !~ '^(application/pdf|video/|image/|audio/|text/plain|text/csv|application/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.oasis\.opendocument\.))' then raise exception 'FICHIER_TYPE'; end if;
  if p_size is null or p_size <= 0 or p_size > lim then raise exception 'FICHIER_POIDS'; end if;
  if p_parts is null or p_parts < 1 or p_parts <> ceil(p_size / 3145728.0)::int then raise exception 'DONNEES'; end if;
  if (select count(*) from att_files where club = c and author = p_by and at > now() - interval '1 day') >= 40
    or (select coalesce(sum(size), 0) from att_files where club = c and author = p_by and at > now() - interval '1 day') + p_size > 419430400 then raise exception 'LIMITE_CHAT'; end if;
  delete from att_files where club = c and (at < now() - interval '90 days' or (not done and at < now() - interval '1 day'));
  insert into att_files (club, scope, name, mime, size, parts, author) values (c, p_scope, left(coalesce(nullif(trim(p_name), ''), 'fichier'), 120), p_mime, p_size, p_parts, p_by) returning att_files.id into id;
  return id;
end $$;
create or replace function ea_att_put(c text, p_by text, p_id uuid, p_n int, p_data text) returns boolean language plpgsql security definer set search_path = public as $$
declare f att_files;
begin
  select * into f from att_files where club = c and id = p_id;
  if f.id is null or f.author is distinct from p_by or f.done or p_n < 0 or p_n >= f.parts then raise exception 'DONNEES'; end if;
  if length(coalesce(p_data, '')) = 0 or length(p_data) > 4194400 or p_data !~ '^[A-Za-z0-9+/=]+$' then raise exception 'FICHIER_POIDS'; end if;
  insert into att_parts (att, n, data) values (p_id, p_n, p_data) on conflict (att, n) do update set data = excluded.data;
  if (select count(*) from att_parts where att = p_id) = f.parts then update att_files set done = true where id = p_id; end if;
  return true;
end $$;
create or replace function ea_att_get(c text, p_id uuid, p_n int, p_scopes text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f att_files;
begin
  select * into f from att_files where club = c and id = p_id and done;
  if f.id is null or (p_scopes is not null and not (f.scope = any(p_scopes))) then raise exception 'FICHIER_ABSENT'; end if;
  return jsonb_build_object('name', f.name, 'mime', f.mime, 'size', f.size, 'parts', f.parts, 'data', (select data from att_parts where att = p_id and n = p_n));
end $$;

-- les coachs et dirigeants (leur connexion) : le chat d'une catégorie (p_where = 'team:<id d'équipe>') ou la messagerie (p_where = 'msg:<canal>')
create or replace function ea_att_scope(k text, p_where text) returns text language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k);
begin
  if ea_staff(k) is null then raise exception 'CLE_CLUB'; end if;
  if p_where like 'team:%' then return 'chat:' || (ea_chat_coach(k, substr(p_where, 6))->>'cat'); end if;
  if p_where like 'msg:%' then return left(p_where, 80); end if;
  raise exception 'DONNEES';
end $$;
create or replace function club_att_begin(k text, p_where text, p_name text, p_mime text, p_size bigint, p_parts int) returns uuid language plpgsql security definer set search_path = public as $$
begin return ea_att_begin(ea_need(k), ea_att_scope(k, p_where), ea_staff(k), p_name, p_mime, p_size, p_parts); end $$;
create or replace function club_att_put(k text, p_id uuid, p_n int, p_data text) returns boolean language plpgsql security definer set search_path = public as $$
begin if ea_staff(k) is null then raise exception 'CLE_CLUB'; end if; return ea_att_put(ea_need(k), ea_staff(k), p_id, p_n, p_data); end $$;
create or replace function club_att_get(k text, p_id uuid, p_n int) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin if ea_staff(k) is null then raise exception 'CLE_CLUB'; end if; return ea_att_get(ea_need(k), p_id, p_n, null); end $$;

-- les joueurs et les parents (leur code) : seulement le chat de leur catégorie, et seulement si les coachs y ouvrent les photos
create or replace function member_att_begin(p_code text, p_cat text, p_name text, p_mime text, p_size bigint, p_parts int) returns uuid language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if; -- son salon : « U12 · Parents » (U15 et moins) ou « Seniors »
  if not ea_chat_photos_ok(pl.club, p_cat) then raise exception 'PHOTOS_COACHS'; end if;
  return ea_att_begin(pl.club, 'chat:' || p_cat, 'm:' || pl.id, p_name, p_mime, p_size, p_parts);
end $$;
create or replace function member_att_put(p_code text, p_id uuid, p_n int, p_data text) returns boolean language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); begin return ea_att_put(pl.club, 'm:' || pl.id, p_id, p_n, p_data); end $$;
create or replace function member_att_get(p_code text, p_id uuid, p_n int) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin return ea_att_get(pl.club, p_id, p_n, array(select 'chat:' || ea_cat_room(x) from unnest(ea_chat_cats(pl.club, ea_member_teams(pl))) x)); end $$;

revoke all on function ea_att_begin(text, text, text, text, text, bigint, int), ea_att_put(text, text, uuid, int, text), ea_att_get(text, uuid, int, text[]), ea_att_scope(text, text) from public, anon, authenticated;
grant execute on function club_att_begin(text, text, text, text, bigint, int), club_att_put(text, uuid, int, text), club_att_get(text, uuid, int),
  member_att_begin(text, text, text, text, bigint, int), member_att_put(text, uuid, int, text), member_att_get(text, uuid, int) to anon, authenticated;
notify pgrst, 'reload schema';
