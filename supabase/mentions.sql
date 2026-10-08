/* (2.39) Taguer un joueur dans le chat avec @ :
   - la liste des joueurs de la catégorie arrive avec le chat (« people »), pour les suggestions quand on tape @ ;
   - un joueur tagué reçoit une notification à lui, même si le chat est en sourdine chez lui
     (dans le chat des parents : ce sont ses parents qui la reçoivent).
   À coller dans Supabase → SQL Editor, après les fichiers du chat déjà collés. */

-- the players of a room, by the name shown in the chat (« Lucas M. »)
create or replace function ea_chat_people(c text, p_cat text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(n order by n), '[]'::jsonb) from (
    select distinct ea_short(p.data) n from items p where p.club = c and p.col = 'players' and not p.deleted
      and p.id = any(ea_cat_players(c, ea_room_base(p_cat))) and ea_short(p.data) <> '') z $$;

-- who is tagged in a message: « @Lucas M. », or « @Lucas » when only one Lucas is in the room
create or replace function ea_chat_tagged(c text, p_base text, p_body text, p_author text) returns text[] language sql stable security definer set search_path = public as $$
  with pl as (
    select p.id, lower(ea_short(p.data)) short, lower(split_part(trim(coalesce(p.data->>'firstName', '')), ' ', 1)) first
    from items p where p.club = c and p.col = 'players' and not p.deleted and p.id = any(ea_cat_players(c, p_base)))
  select coalesce(array_agg(pl.id), '{}') from pl
  where pl.id <> coalesce(p_author, '') and coalesce(p_body, '') like '%@%' and (
    (pl.short <> '' and position('@' || pl.short in lower(p_body)) > 0)
    or (pl.first <> '' and (select count(*) from pl x where x.first = pl.first) = 1
        and lower(p_body) ~ ('@' || regexp_replace(pl.first, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '([^[:alnum:]]|$)'))) $$;

-- the chat, for the families and for the coaches: + « people » on the first loading
create or replace function member_chat(p_code text, p_cat text default null, p_after bigint default 0, p_room text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); base text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); cats text[]; cat text;
begin
  if cardinality(base) = 0 then return jsonb_build_object('cats', '[]'::jsonb, 'msgs', '[]'::jsonb); end if;
  cats := case p_room when 'parents' then array(select b || ' · Parents' from unnest(base) b)
    when 'all' then array(select b || ' · Parents' from unnest(base) b) || base else base end;
  cat := case when p_cat = any(cats) then p_cat else cats[1] end;
  return ea_chat_view(pl.club, cat, pl.id, false, p_after) || jsonb_build_object('cats', to_jsonb(cats))
    || case when coalesce(p_after, 0) = 0 then jsonb_build_object('people', ea_chat_people(pl.club, cat)) else '{}'::jsonb end; end $$;
create or replace function club_chat(k text, p_team text, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  return ea_chat_view(x->>'club', x->>'cat', x->>'sid', true, p_after)
    || case when coalesce(p_after, 0) = 0 then jsonb_build_object('people', ea_chat_people(x->>'club', x->>'cat')) else '{}'::jsonb end; end $$;

-- a new message: the tagged ones get their own notification (even with the chat muted), the others as before
create or replace function ea_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare base text := ea_room_base(new.cat); par boolean := new.cat like '% · Parents';
  title text := case when new.poll is not null then '📊 Sondage · ' else '💬 ' || case when par then 'Parents ' else 'Chat ' end end || base;
  body text := new.name || ' : ' || left(case when new.img then '📷 Photo' || case when new.body <> '' then ' · ' || new.body else '' end else new.body end, 160);
  muted text[] := array(select person from chat_mutes where club = new.club);
  tagged text[] := case when new.poll is null and new.author not like 'bday:%' then ea_chat_tagged(new.club, base, new.body, new.author) else '{}' end;
  people text[] := array(select x from unnest(ea_cat_players(new.club, base)) x where x <> new.author and not (x = any(muted)) and not (x = any(tagged)));
  t text; who text := regexp_replace(coalesce(new.name, ''), '^Coach\s+', '');
  msg text := left(case when new.img then '📷 Photo' || case when new.body <> '' then ' · ' || new.body else '' end else new.body end, 200);
begin
  begin
    -- the tagged players (the parents in the parents' room)
    if cardinality(tagged) > 0 and (par or ea_chat_free(new.cat) or not ea_quiet()) then
      foreach t in array tagged loop
        if par then perform ea_member_note_page(new.club, array[t], '📣 ' || who || ' a tagué ' || coalesce((select nullif(split_part(trim(coalesce(p.data->>'firstName', '')), ' ', 1), '') from items p where p.club = new.club and p.col = 'players' and p.id = t), 'ton enfant') || ' · ' || base, msg, 'tag:' || new.id, '#chat', 'parents.html');
        else perform ea_member_note(new.club, array[t], '📣 ' || who || ' t''a tagué · ' || base, msg, 'tag:' || new.id, '#chat'); end if;
      end loop;
    end if;
    if par then perform ea_member_note_page(new.club, people, title, body, 'chat:' || new.cat, '#chat', 'parents.html');
    elsif ea_chat_free(new.cat) or not ea_quiet() then perform ea_member_note(new.club, people, title, body, 'chat:' || new.cat, '#chat'); end if;
    perform ea_notify(new.club, array(select x from unnest(ea_cat_staff(new.club, base)) x where x <> new.author and not (x = any(muted))), 'messages', 'chat:' || new.cat, title, body,
      '#/chat/' || coalesce((select t2.id from items t2 where t2.club = new.club and t2.col = 'teams' and not t2.deleted and ea_team_cat(t2.data) = base order by t2.data->>'name' limit 1), '')
      || case when par then '|parents' else '' end);
  exception when others then raise notice 'notification du chat : %', sqlerrm; end;
  return null;
end $$;

revoke all on function ea_chat_people(text, text), ea_chat_tagged(text, text, text, text), ea_on_chat() from public, anon, authenticated;
grant execute on function member_chat(text, text, bigint, text), club_chat(text, text, bigint) to anon, authenticated;
notify pgrst, 'reload schema';
