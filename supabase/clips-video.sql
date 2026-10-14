-- Clubbo 3.38 : les clips de l'analyse vidéo (application « Raincy Vidéo » de l'ordinateur du club).
-- À coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Sans danger à relancer. Ne modifie aucune donnée existante.
-- Un espace de stockage PRIVÉ « raincy-clips » : personne ne peut lire ni écrire directement. Seule la fonction « raincy-clips »
-- (Edge Function, clé de service) donne, à un dirigeant connecté, une adresse d'envoi ou une adresse de lecture valable 1 heure,
-- et seulement pour les clips de son club. MP4 seulement, 30 Mo au plus par clip.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raincy-clips', 'raincy-clips', false, 31457280, array['video/mp4'])
on conflict (id) do update set public = false, file_size_limit = 31457280, allowed_mime_types = array['video/mp4'];
