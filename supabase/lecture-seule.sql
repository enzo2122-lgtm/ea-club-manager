/* (2.61) Accès « Observation » (lecture seule) : un dirigeant dont la fiche a access = 'read' (choisi par le responsable)
   voit ses catégories mais le serveur refuse ses modifications. À coller dans Supabase → SQL Editor. */
create or replace function club_push(k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int; sid text := ea_staff(k);
begin
  if sid is not null and not ea_admin(k, c) and exists (select 1 from items s where s.club = c and s.col = 'staff' and s.id = sid and not s.deleted and s.data->>'access' = 'read') then
    raise exception 'LECTURE_SEULE';
  end if;
  perform pg_advisory_xact_lock(hashtext('items:' || c));
  insert into items (club, col, id, data, updated_at, deleted, rev)
    select c, x.col, x.id, case when coalesce(x.del, false) then null else x.data end, coalesce(x.u, 0), coalesce(x.del, false), nextval('items_rev')
    from jsonb_to_recordset(p) as x(col text, id text, data jsonb, u bigint, del boolean)
    where x.col in ('teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports', 'club') and coalesce(x.id, '') <> ''
  on conflict (club, col, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
    where excluded.updated_at >= items.updated_at;
  get diagnostics n = row_count; return to_jsonb(n); end $$;
notify pgrst, 'reload schema';
