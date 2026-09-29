// Raincy Coach – notifications sur les téléphones (Supabase Edge Function « raincy-push »).
// La base du club l'appelle (pg_net) quand un message arrive ou que le planning change : elle « réveille »
// les téléphones abonnés par un Web Push sans contenu, signé VAPID. Chaque téléphone va ensuite chercher
// ses notifications sur le serveur du club : aucune donnée du club ne passe par Google ou Apple.
// À coller une fois dans Supabase : Edge Functions → Deploy a new function → Via Editor, nom « raincy-push »,
// puis désactiver « Verify JWT » dans ses réglages. Aucun secret à saisir : les clés sont créées toutes seules.
const SB = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUBJECT = 'https://enzo2122-lgtm.github.io/raincy-coach/';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-raincy-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const auth = (): Record<string, string> => KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };
const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...auth(), 'Content-Type': 'application/json', ...(init.headers as Record<string, string> ?? {}) } });
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const bytes = (s: string) => new TextEncoder().encode(s);

// deno-lint-ignore no-explicit-any
type Config = { secret: string; vapid_public?: string; vapid_private?: any };

async function config(): Promise<Config> {
  const r = await db('push_config?id=eq.1&select=*');
  if (!r.ok) throw new Error('push_config ' + r.status + ' ' + await r.text());
  return (await r.json())[0];
}
// The first call creates the club's VAPID keys and keeps them in the database (table closed to the public)
async function withKeys(cfg: Config): Promise<Config> {
  if (cfg.vapid_public && cfg.vapid_private) return cfg;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const r = await db('push_config?id=eq.1', { method: 'PATCH', body: JSON.stringify({ vapid_public: pub, vapid_private: priv }) });
  if (!r.ok) throw new Error('clés ' + r.status + ' ' + await r.text());
  return { ...cfg, vapid_public: pub, vapid_private: priv };
}
async function vapid(endpoint: string, pub: string, key: CryptoKey) {
  const head = b64u(bytes(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(bytes(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${pub}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    let cfg = await config();
    if (!cfg || !cfg.secret || req.headers.get('x-raincy-secret') !== cfg.secret) return json({ error: 'refusé' }, 403);
    cfg = await withKeys(cfg);
    const { subs = [] } = await req.json().catch(() => ({})) as { subs?: { id: string; endpoint: string }[] };
    const key = await crypto.subtle.importKey('jwk', { ...cfg.vapid_private, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    let sent = 0; const gone: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        const r = await fetch(s.endpoint, { method: 'POST', headers: { TTL: '86400', Urgency: 'high', Authorization: await vapid(s.endpoint, cfg.vapid_public!, key) } });
        if (r.status === 404 || r.status === 410) gone.push(s.id); else if (r.ok) sent++;
        await r.body?.cancel();
      } catch (_) { /* phone unreachable: next time */ }
    }));
    if (gone.length) await db(`push_subs?id=in.(${gone.join(',')})`, { method: 'DELETE' });
    return json({ ok: true, sent, gone: gone.length, publicKey: cfg.vapid_public });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
