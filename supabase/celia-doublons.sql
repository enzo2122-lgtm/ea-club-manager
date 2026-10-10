-- Clubbo 3.16 / Raincy 5.79 : FA Le Raincy, Celia SOARES en un seul exemplaire.
-- Garde une seule fiche (celle qui a un mot de passe, sinon celle du compte responsable), rôle « Trésorière · Secrétaire »,
-- aucune catégorie, responsable ; les autres fiches sont supprimées (et leurs comptes jamais utilisés). Sans danger à relancer.
do $$
declare c text := (select id from clubs where slug = 'fa-le-raincy' or id = 'fa-le-raincy' limit 1); keep text; n int;
begin
  if c is null then raise notice 'club fa-le-raincy introuvable'; return; end if;
  select i.id into keep from items i left join accounts a on a.club = i.club and a.staff_id = i.id
    where i.club = c and i.col = 'staff' and not i.deleted and upper(i.data->>'lastName') = 'SOARES' and lower(i.data->>'firstName') in ('celia', 'célia')
    order by (a.pw_hash is not null) desc, coalesce(a.admin, false) desc, (i.id = 'celia-soares') desc, i.updated_at limit 1;
  if keep is null then raise notice 'aucune fiche Celia SOARES'; return; end if;
  delete from accounts a where a.club = c and a.staff_id <> keep and a.pw_hash is null and a.staff_id in (select i.id from items i where i.club = c and i.col = 'staff'
    and upper(i.data->>'lastName') = 'SOARES' and lower(i.data->>'firstName') in ('celia', 'célia'));
  update items set deleted = true, data = null, updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where club = c and col = 'staff' and id <> keep and not deleted and upper(data->>'lastName') = 'SOARES' and lower(data->>'firstName') in ('celia', 'célia');
  get diagnostics n = row_count;
  update items set data = data || jsonb_build_object('role', 'Trésorière · Secrétaire', 'teamIds', '[]'::jsonb), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where club = c and col = 'staff' and id = keep;
  insert into accounts (club, staff_id, last_key, first_keys, display, admin) values (c, keep, 'SOARES', array['CELIA'], 'Celia SOARES', true)
    on conflict (club, staff_id) do update set admin = true, updated_at = now();
  raise notice 'Celia SOARES : 1 fiche gardée (%), % doublon(s) supprimé(s)', keep, n;
end $$;
