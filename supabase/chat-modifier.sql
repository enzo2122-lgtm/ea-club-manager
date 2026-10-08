/* (2.47) Chat : seul l'auteur d'un message peut le supprimer ou le modifier (les coachs ne suppriment plus les messages des autres :
   ils gardent les signalements et la fermeture du chat). « modifié » s'affiche sous un message changé.
   À coller dans Supabase → SQL Editor (après mentions.sql). */
alter table chat_msgs add column if not exists edited_at timestamptz;

-- change my message: same checks as a new message (empty, forbidden words in the youth chats)
create or replace function ea_chat_edit(c text, p_cat text, p_me text, p_id bigint, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 500);
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  update chat_msgs set body = b, edited_at = now()
    where club = c and cat = p_cat and id = p_id and author = p_me and not deleted and poll is null and author not like 'bday:%';
  if not found then raise exception 'DONNEES'; end if;
  return to_jsonb(true); end $$;
create or replace function member_chat_edit(p_code text, p_cat text, p_id bigint, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_edit(pl.club, p_cat, pl.id, p_id, p_body); end $$;
create or replace function club_chat_edit(k text, p_team text, p_id bigint, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin return ea_chat_edit(x->>'club', x->>'cat', x->>'sid', p_id, p_body); end $$;

-- delete: the coach only his own messages now (like the players and the parents)
create or replace function club_chat_del(k text, p_team text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  update chat_msgs set deleted = true, deleted_by = x->>'sid' where club = x->>'club' and cat = x->>'cat' and id = p_id and author = x->>'sid';
  return to_jsonb(found); end $$;

-- the messages changed, with the chat (their new text)
create or replace function ea_chat_edits(c text, p_cat text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'body', body) order by id), '[]'::jsonb) from chat_msgs
  where club = c and cat = p_cat and edited_at is not null and not deleted and at > now() - interval '120 days' $$;
create or replace function member_chat(p_code text, p_cat text default null, p_after bigint default 0, p_room text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); base text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); cats text[]; cat text;
begin
  if cardinality(base) = 0 then return jsonb_build_object('cats', '[]'::jsonb, 'msgs', '[]'::jsonb); end if;
  cats := case p_room when 'parents' then array(select b || ' · Parents' from unnest(base) b)
    when 'all' then array(select b || ' · Parents' from unnest(base) b) || base else base end;
  cat := case when p_cat = any(cats) then p_cat else cats[1] end;
  return ea_chat_view(pl.club, cat, pl.id, false, p_after) || jsonb_build_object('cats', to_jsonb(cats), 'edits', ea_chat_edits(pl.club, cat))
    || case when coalesce(p_after, 0) = 0 then jsonb_build_object('people', ea_chat_people(pl.club, cat)) else '{}'::jsonb end; end $$;
create or replace function club_chat(k text, p_team text, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  return ea_chat_view(x->>'club', x->>'cat', x->>'sid', true, p_after) || jsonb_build_object('edits', ea_chat_edits(x->>'club', x->>'cat'))
    || case when coalesce(p_after, 0) = 0 then jsonb_build_object('people', ea_chat_people(x->>'club', x->>'cat')) else '{}'::jsonb end; end $$;

revoke all on function ea_chat_edit(text, text, text, bigint, text), ea_chat_edits(text, text) from public, anon, authenticated;
grant execute on function member_chat_edit(text, text, bigint, text), club_chat_edit(text, text, bigint, text), club_chat_del(text, text, bigint),
  member_chat(text, text, bigint, text), club_chat(text, text, bigint) to anon, authenticated;
notify pgrst, 'reload schema';
