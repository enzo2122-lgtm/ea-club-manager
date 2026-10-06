-- Clubbo 1.76 : le coach envoie son message en notification de l'appli (non-convoqués…). À coller une fois dans Supabase (SQL Editor → Run).
-- (1.76) a coach (logged in, not the invitation link) sends his own message as a notification to some players of the club
-- (those whose phone has the notifications on); returns who has them on (the others: WhatsApp)
create or replace function club_member_note(k text, p_players text[], p_title text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); ids text[];
begin
  if not exists (select 1 from sessions s where s.token_hash = ea_hash(k) and s.club = c and s.expires_at > now()) then raise exception 'SESSION'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'DONNEES'; end if;
  ids := array(select i.id from items i where i.club = c and i.col = 'players' and not i.deleted and i.id = any(coalesce(p_players, '{}'::text[])) limit 300);
  perform member_note(c, ids, coalesce(nullif(trim(p_title), ''), '📣 Message du coach'), trim(p_body));
  return jsonb_build_object('sent', (select coalesce(jsonb_agg(distinct s.player_id), '[]'::jsonb) from member_subs s where s.club = c and s.player_id = any(ids)));
end $$;
grant execute on function club_member_note(text, text[], text, text) to anon, authenticated;
notify pgrst, 'reload schema';
