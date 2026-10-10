-- Clubbo 2.91 (10 octobre 2026) : la synchronisation ne perd plus rien.
-- Chaque appareil envoie, avec chaque élément modifié, la date de la version du serveur sur laquelle il a travaillé (« bu »).
-- Si le serveur a reçu entre-temps une autre version (un autre écran a touché le même match, la même séance…), il refuse
-- d'écraser et renvoie sa version : l'appareil fusionne les deux (champ par champ) et renvoie le résultat.
-- Les anciennes versions de l'appli (sans « bu ») continuent de marcher comme avant.
-- À coller dans Supabase → SQL. Sans danger à relancer.

create or replace function club_push(k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int := 0; sid text := ea_staff(k); r record; cur items; confl jsonb := '[]'::jsonb;
begin
  if sid is not null and not ea_admin(k, c) and exists (select 1 from items s where s.club = c and s.col = 'staff' and s.id = sid and not s.deleted and s.data->>'access' = 'read') then
    raise exception 'LECTURE_SEULE';
  end if;
  perform pg_advisory_xact_lock(hashtext('items:' || c));
  for r in select * from jsonb_to_recordset(p) as x(col text, id text, data jsonb, u bigint, del boolean, bu bigint)
      where x.col in ('teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports', 'club') and coalesce(x.id, '') <> '' loop
    select * into cur from items where club = c and col = r.col and id = r.id;
    -- the item changed on the server since the version this device worked on: refused, the server's version goes back to the device
    if cur.id is not null and r.bu is not null and r.col <> 'club' and cur.updated_at > r.bu and not cur.deleted then
      confl := confl || jsonb_build_object('col', r.col, 'id', r.id, 'data', cur.data, 'u', cur.updated_at, 'del', cur.deleted, 'rev', cur.rev);
      continue;
    end if;
    -- older than what the server holds (clock late, or a very old copy): refused the same way
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
notify pgrst, 'reload schema';
