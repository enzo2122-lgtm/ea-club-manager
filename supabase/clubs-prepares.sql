-- Clubbo 3.59 : « Préparer un club » (espace propriétaire). Le propriétaire prépare le club AVANT de remettre le code :
-- son nom, son numéro FFF (résultats automatiques) et la formule offerte. Le code porte ces réglages : le lien de création
-- est pré-rempli, et le club naît déjà branché sur la FFF. À coller une fois dans Supabase (SQL Editor → Run). Sans danger à relancer.
alter table ea_activation add column if not exists preset jsonb;

-- le propriétaire prépare un club : un code d'activation avec son nom, son n° FFF et sa formule
create or replace function ea_owner_prepare(p_key text, p_name text, p_fff text default null, p_plan text default 'club') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; n text := left(trim(coalesce(p_name, '')), 80); f text := nullif(regexp_replace(coalesce(p_fff, ''), '[^0-9]', '', 'g'), '');
begin
  if not ea_owner_ok(p_key) then raise exception 'PROPRIETAIRE'; end if;
  if length(n) < 2 then raise exception 'DONNEES'; end if;
  loop
    v := 'EA-' || ea_code(4) || '-' || ea_code(4);
    exit when not exists (select 1 from ea_activation where code = v);
  end loop;
  insert into ea_activation (code, note, preset) values (v, n, jsonb_build_object('name', n, 'fff', f, 'plan', case when p_plan = 'club' then 'club' else 'free' end));
  return jsonb_build_object('code', v, 'name', n, 'fff', f);
end $$;

-- le lien de création pré-rempli : ce que le code prépare (seulement un code pas encore utilisé ; rien de privé)
create or replace function ea_activation_info(p_code text) returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('name', a.preset->>'name', 'fff', a.preset->>'fff') from ea_activation a
  where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g')) and a.used_by is null and a.preset is not null $$;

-- la création du club applique ce que le code prépare : le n° FFF dans la fiche du club, la formule offerte
create or replace function ea_create_club(p_code text, p_name text, p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a ea_activation; c text := replace(gen_random_uuid()::text, '-', ''); s text := ea_token(); sl text := lower(regexp_replace(coalesce(p_slug, ''), '[^A-Za-z0-9-]', '', 'g'));
  sid text := p->>'staff_id'; d jsonb;
begin
  select * into a from ea_activation where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g')) for update;
  if a.code is null or a.used_by is not null then raise exception 'ACTIVATION'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(sl) < 3 or length(sl) > 30 then raise exception 'DONNEES'; end if;
  if exists (select 1 from clubs where slug = sl) then raise exception 'SLUG_PRIS'; end if;
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  insert into clubs (id, slug, name, invite) values (c, sl, left(trim(p_name), 80), ea_code(12));
  update ea_activation set used_by = c, used_at = now() where code = a.code;
  if a.preset->>'plan' = 'club' then update clubs set plan = 'club' where id = c; end if;
  insert into accounts (club, staff_id, last_key, first_keys, display, salt, pw_hash, admin, teams_set)
    values (c, sid, p->>'last_key', ea_arr(p->'first_keys'), coalesce(p->>'display', ''), s, ea_hash(s || (p->>'h')), true, true);
  d := jsonb_build_object('name', left(trim(p_name), 80));
  if coalesce(a.preset->>'fff', '') <> '' then
    d := d || jsonb_build_object('fffClub', a.preset->>'fff', 'fffUrl', 'https://epreuves.fff.fr/competition/club/' || (a.preset->>'fff'));
  end if;
  insert into items (club, col, id, data, updated_at, rev) values (c, 'club', 'club', d, (extract(epoch from now()) * 1000)::bigint, nextval('items_rev'));
  return ea_new_session(c, sid);
end $$;

revoke all on function ea_owner_prepare(text, text, text, text) from public;
grant execute on function ea_owner_prepare(text, text, text, text), ea_activation_info(text) to anon, authenticated;
