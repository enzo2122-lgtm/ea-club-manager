-- Clubbo 3.13 : la convocation envoyée dans l'appli (espace joueur / parents), pas seulement par WhatsApp.
-- À coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Ne modifie aucune donnée, ajoute seulement une fonction.
-- member_convocs : pour un joueur, ses convocations envoyées par le coach (matchs à venir où il est convoqué) :
--   le message du coach, l'heure d'envoi, et la liste des convoqués (prénom + initiale, numéro du match).
create or replace function member_convocs(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; today text := to_char(current_date, 'YYYY-MM-DD');
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'at', i.data->'convSent', 'msg', left(coalesce(i.data->>'convMsg', ''), 3000),
      'squad', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(nullif(i.data#>>array['numbers', p.id], ''), p.data->>'number'), 'name', ea_short(p.data), 'me', p.id = pl.id)
          order by coalesce(nullif(regexp_replace(coalesce(nullif(i.data#>>array['numbers', p.id], ''), p.data->>'number', ''), '\D', '', 'g'), '')::int, 999), ea_short(p.data)), '[]'::jsonb)
        from items p where p.club = c and p.col = 'players' and not p.deleted and coalesce(i.data->'convoked', '[]'::jsonb) ? p.id))
      order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
    from items i where i.club = c and i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(ea_member_cat_teams(pl))
      and i.data->>'date' >= today and coalesce(i.data->>'convSent', '') <> '' and coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id);
end $$;
revoke all on function member_convocs(text) from public;
grant execute on function member_convocs(text) to anon, authenticated;
notify pgrst, 'reload schema';
