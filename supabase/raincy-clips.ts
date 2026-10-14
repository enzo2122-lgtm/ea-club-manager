// Raincy Coach – les clips de l'analyse vidéo (Supabase Edge Function « raincy-clips »).
// L'application « Raincy Vidéo » (ordinateur du club) y envoie les clips des actions ; l'appli les lit dans la fiche du match.
// L'espace de stockage « raincy-clips » est privé (supabase/clips-video.sql) : cette fonction vérifie la connexion du dirigeant
// (le même jeton que l'appli) puis donne une adresse d'envoi ou de lecture valable 1 heure, seulement dans le dossier de son club.
// À coller une fois dans Supabase : Edge Functions → Deploy a new function → Via Editor, nom « raincy-clips »,
// puis désactiver « Verify JWT » dans ses réglages. Aucun secret à saisir.
const SB = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'raincy-clips', MAX = 30 * 1024 * 1024;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const auth = (): Record<string, string> => KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };
const call = (path: string, body: unknown) => fetch(`${SB}${path}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const safe = (s: string) => String(s || 'clip').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 60);

// le club et le dirigeant de ce jeton (null : pas connecté, ou un parent / joueur)
async function who(k: string): Promise<{ club: string; staff: string } | null> {
  if (!k) return null;
  const [c, s] = await Promise.all([call('/rest/v1/rpc/ea_club', { k }), call('/rest/v1/rpc/ea_staff', { t: k })]);
  if (!c.ok || !s.ok) return null;
  const club = await c.json(), staff = await s.json();
  return club && staff ? { club, staff } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHODE' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'DONNEES' }, 400); }
  const me = await who(String(b.k || ''));
  if (!me) return json({ error: 'SESSION' }, 401);

  if (b.action === 'upload') {
    const match = safe(String(b.match || '')), size = Number(b.size || 0);
    if (!match || !(size > 0) || size > MAX) return json({ error: 'FICHIER_POIDS' }, 400);
    const path = `${me.club}/${match}/${crypto.randomUUID().slice(0, 8)}-${safe(String(b.name || 'clip')).replace(/\.mp4$/i, '')}.mp4`;
    const r = await call(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, {});
    if (!r.ok) return json({ error: 'STOCKAGE', detail: await r.text() }, 500);
    const { url } = await r.json();
    return json({ path, url: `${SB}/storage/v1${url}` });
  }
  if (b.action === 'read') {
    const paths = (Array.isArray(b.paths) ? b.paths : []).map(String).filter((p) => p.startsWith(me.club + '/')).slice(0, 100);
    if (!paths.length) return json({ urls: {} });
    const r = await call(`/storage/v1/object/sign/${BUCKET}`, { expiresIn: 3600, paths });
    if (!r.ok) return json({ error: 'STOCKAGE', detail: await r.text() }, 500);
    const urls: Record<string, string> = {};
    for (const x of await r.json()) if (x.signedURL) urls[x.path] = `${SB}/storage/v1${x.signedURL}`;
    return json({ urls });
  }
  if (b.action === 'delete') {
    const paths = (Array.isArray(b.paths) ? b.paths : []).map(String).filter((p) => p.startsWith(me.club + '/')).slice(0, 100);
    if (paths.length) await fetch(`${SB}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
    return json({ ok: true });
  }
  return json({ error: 'ACTION' }, 400);
});
