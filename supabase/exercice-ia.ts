// Lecture d'une fiche ou d'un dessin d'exercice par l'IA (Supabase Edge Function « exercice-ia »).
// L'appli envoie l'image d'une page (et le texte déjà lu) ; Claude la regarde et renvoie l'exercice :
// titre, organisation, déroulement, rotations, consignes, variantes, matériel (plots, chasubles…), durée, espace.
// À coller une fois dans Supabase : Edge Functions → Deploy a new function → Via Editor, nom « exercice-ia »,
// puis désactiver « Verify JWT » dans ses réglages, et ajouter le secret ANTHROPIC_API_KEY (Edge Functions → Secrets).
// Seul un dirigeant connecté peut l'utiliser (sa session est vérifiée), 60 analyses par jour et par dirigeant.
const SB = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AI = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5';
const PER_DAY = 60;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const auth = (): Record<string, string> => KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };
const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...auth(), 'Content-Type': 'application/json', ...(init.headers as Record<string, string> ?? {}) } });
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, '0')).join('');

// the answer of the AI: always this shape (a « tool » it must fill)
const TOOL = {
  name: 'exercice',
  description: 'L\'exercice de football lu sur la fiche ou le dessin, en français, prêt pour un coach.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Titre court et parlant (ex. « Conservation 4 contre 4 + 2 jokers »). Si la fiche a un titre, le garder.' },
      theme: { type: 'string', enum: ['pressing', 'conservation', 'transitions', 'finition', 'defense', 'construction', 'technique', 'cpa', 'physique', 'gardien', 'echauffement', 'jeu', 'calme', ''] },
      duree: { type: 'integer', description: 'Durée en minutes (écrite, ou estimée).' },
      objectif: { type: 'string' },
      joueurs: { type: 'string', description: 'Nombre de joueurs et répartition (ex. « 2 équipes de 4 + 2 jokers + 1 gardien »).' },
      espace: { type: 'string', description: 'Dimensions au format 30x20 (mètres), vide si inconnu.' },
      organisation: { type: 'string', description: 'La mise en place : où sont les joueurs, les plots, les portes, les buts, qui a le ballon au départ.' },
      deroulement: { type: 'string', description: 'Ce qui se passe, dans l\'ordre, en suivant les flèches du dessin (passes, courses, conduites, frappes).' },
      rotations: { type: 'string', description: 'Qui va où après son action (rotation des postes / des colonnes), et le changement des rôles ou des équipes.' },
      consignes: { type: 'array', items: { type: 'string' }, description: 'Consignes et points clés pour les joueurs, courtes.' },
      variantes: { type: 'array', items: { type: 'string' } },
      plots: { type: 'string', description: 'Plots / coupelles / piquets / mannequins : nombre et couleurs (ex. « 8 plots orange, 4 piquets »).' },
      chasubles: { type: 'string', description: 'Chasubles : couleurs et nombre par couleur (ex. « 4 rouges, 4 bleues, 2 jaunes (jokers) »).' },
      autre_materiel: { type: 'string', description: 'Ballons, buts, mini-buts, échelle, cerceaux…' },
    },
    required: ['titre', 'duree', 'organisation', 'deroulement', 'consignes', 'plots', 'chasubles'],
  },
};
const PROMPT = `Tu es un éducateur de football diplômé. Voici une fiche ou un dessin d'exercice (terrain vu du dessus : ronds ou joueurs de couleur = joueurs et leurs chasubles,
triangles ou petits ronds orange/jaunes = plots ou coupelles, traits pleins = passes, pointillés = courses, zigzags = conduites de balle).
Lis l'image avec attention (et le texte déjà extrait, s'il y en a) et remplis l'outil « exercice » en français simple, comme pour un coach de club amateur.
Compte les joueurs de chaque couleur pour les chasubles et compte les plots. Décris les rotations (qui prend quelle place après son action).
N'invente pas ce qui n'est pas sur la fiche : laisse vide si tu ne sais pas, sauf la durée et le titre que tu peux proposer.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    if (!AI) return json({ error: 'CLE_IA' }, 503);
    const { k, image, text, fmt } = await req.json().catch(() => ({})) as { k?: string; image?: string; text?: string; fmt?: string };
    if (!k || !image) return json({ error: 'DONNEES' }, 400);
    // a dirigeant logged in on the club server
    const r = await db(`sessions?token_hash=eq.${await sha(k)}&expires_at=gt.${new Date().toISOString()}&select=staff_id`);
    const who = r.ok ? ((await r.json())[0] || {}).staff_id : null;
    if (!who) return json({ error: 'SESSION' }, 403);
    // 60 a day for each dirigeant (the table is optional: without it, no limit)
    const day = new Date().toISOString().slice(0, 10);
    const u = await db(`ai_usage?who=eq.${encodeURIComponent(who)}&day=eq.${day}&select=n`);
    if (u.ok) {
      const n = ((await u.json())[0] || {}).n || 0;
      if (n >= PER_DAY) return json({ error: 'LIMITE' }, 429);
      await db('ai_usage', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ who, day, n: n + 1 }) });
    }
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(image);
    if (!m || image.length > 6_000_000) return json({ error: 'IMAGE' }, 400);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AI, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2000, tools: [TOOL], tool_choice: { type: 'tool', name: 'exercice' },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: PROMPT + (fmt ? `\nFormat de jeu de la catégorie : foot à ${fmt}.` : '') + (text ? `\n\nTexte extrait de la page :\n${String(text).slice(0, 4000)}` : '') },
        ] }],
      }),
    });
    const out = await res.json();
    if (!res.ok) return json({ error: 'IA', detail: out && out.error && out.error.message }, 502);
    const tool = (out.content || []).find((c: { type: string }) => c.type === 'tool_use');
    return json({ ok: true, ex: tool ? tool.input : null });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
