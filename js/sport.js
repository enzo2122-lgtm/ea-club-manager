/* Sport: what changes from one sport to another. The club chooses its sport when it is created (club.sport);
   the app then takes from here the playing formats and their courts, the positions, the age categories, the way to score,
   the periods of a match, the actions of the live match and the words (but / panier / essai, terrain / salle…).
   Football is the default: a club created before the choice stays a football club. */
const Sport = (() => {
  // [code, name, abbreviation, type]: the first one of each type is the type itself
  const SPORTS = {
    foot: {
      label: 'Football', icon: '⚽', ball: '⚽', place: 'terrain', catPrefix: 'U',
      formats: [['11', 'Foot à 11', 11], ['8', 'Foot à 8', 8], ['5', 'Foot à 5', 5]],
      formatOfCat: c => /^U(6|7|8|9)$/.test(c) ? '5' : /^U(10|11|12|13)$/.test(c) ? '8' : '11',
      cats: ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'Seniors', 'Vétérans'],
      posts: [['GB', 'Gardien', 'G', 'GB'],
        ['DEF', 'Défenseur', 'DEF', 'DEF'], ['DC', 'Défenseur central', 'DC', 'DEF'], ['LD', 'Latéral droit', 'LD', 'DEF'], ['LG', 'Latéral gauche', 'LG', 'DEF'],
        ['MIL', 'Milieu', 'MIL', 'MIL'], ['MDC', 'Milieu défensif', 'MDC', 'MIL'], ['MC', 'Milieu relayeur', 'MC', 'MIL'], ['MOC', 'Milieu offensif', 'MOC', 'MIL'], ['MD', 'Milieu droit', 'MD', 'MIL'], ['MG', 'Milieu gauche', 'MG', 'MIL'],
        ['ATT', 'Attaquant', 'ATT', 'ATT'], ['AD', 'Ailier droit', 'AD', 'ATT'], ['AG', 'Ailier gauche', 'AG', 'ATT'], ['SA', 'Second attaquant', 'SA', 'ATT'], ['BU', 'Avant-centre', 'BU', 'ATT']],
      lines: [['GB', 'Gardiens'], ['DEF', 'Défenseurs'], ['MIL', 'Milieux'], ['ATT', 'Attaquants']],
      gk: 'Gardien', periods: 2, periodName: 'mi-temps', periodWord: 'période', periodLen: f => f === '5' ? 20 : f === '8' ? 30 : 45,
      unit: ['but', 'buts'], scorer: ['Buteur', 'Buteurs'], assist: 'Passe décisive',
      score: [{ k: 'goal', ic: '⚽', l: 'But pour nous', pts: 1, us: 1 }, { k: 'against', ic: '🥅', l: 'But encaissé', pts: 1 }],
      extra: [['yellow', '🟨', 'Carton jaune', '#ca8a04'], ['red', '🟥', 'Carton rouge', '#dc2626', 'out']],
      arrows: { course: 'Course', conduite: 'Conduite', passe: 'Passe', tir: 'Tir', pressing: 'Pressing', bascule: 'Bascule' },
      ai: 'football', school: 'École de foot',
    },
    basket: {
      label: 'Basket', icon: '🏀', ball: '🏀', place: 'salle', catPrefix: 'U',
      formats: [['b5', 'Basket 5 contre 5', 5], ['b3', 'Basket 3x3', 3]],
      formatOfCat: () => 'b5',
      cats: ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U18', 'U20', 'Seniors', 'Loisirs'],
      posts: [['MEN', 'Meneur', '1', 'MEN'], ['ARR', 'Arrière', '2', 'ARR'], ['AIL', 'Ailier', '3', 'AIL'], ['AF', 'Ailier fort', '4', 'AF'], ['PIV', 'Pivot', '5', 'PIV']],
      lines: [['MEN', 'Meneurs'], ['ARR', 'Arrières'], ['AIL', 'Ailiers'], ['AF', 'Ailiers forts'], ['PIV', 'Pivots']],
      gk: '', periods: 4, periodName: 'quart-temps', periodWord: 'quart-temps', periodLen: f => f === 'b3' ? 10 : 10,
      unit: ['point', 'points'], scorer: ['Marqueur', 'Marqueurs'], assist: 'Passe décisive',
      score: [{ k: 'p2', ic: '🏀', l: 'Panier à 2 pts', pts: 2, us: 1 }, { k: 'p3', ic: '🎯', l: 'Panier à 3 pts', pts: 3, us: 1 }, { k: 'p1', ic: '🆓', l: 'Lancer franc', pts: 1, us: 1 },
        { k: 'a2', ic: '🔻', l: '2 pts encaissés', pts: 2 }, { k: 'a3', ic: '🔻', l: '3 pts encaissés', pts: 3 }, { k: 'a1', ic: '🔻', l: '1 pt encaissé', pts: 1 }],
      extra: [['reb', '🙌', 'Rebond', '#0d9488'], ['stl', '🧤', 'Interception', '#0891b2'], ['foul', '✋', 'Faute', '#ca8a04']],
      arrows: { course: 'Déplacement', conduite: 'Dribble', passe: 'Passe', tir: 'Tir', pressing: 'Défense', bascule: 'Écran' },
      ai: 'basket-ball', school: 'Mini-basket', catOf: a => a >= 21 ? 'Seniors' : a >= 18 ? 'U20' : a >= 17 ? 'U18' : 'U' + Math.max(7, a % 2 ? a : a + 1),
    },
    hand: {
      label: 'Handball', icon: '🤾', ball: '🤾', place: 'salle', catPrefix: 'U',
      formats: [['h7', 'Hand à 7', 7]],
      formatOfCat: () => 'h7',
      cats: ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U18', 'Seniors', 'Loisirs'],
      posts: [['GB', 'Gardien', 'G', 'GB'], ['AIL', 'Ailier', 'AIL', 'AIL'], ['AIG', 'Ailier gauche', 'AG', 'AIL'], ['AID', 'Ailier droit', 'AD', 'AIL'],
        ['ARR', 'Arrière', 'ARR', 'ARR'], ['ARG', 'Arrière gauche', 'ArG', 'ARR'], ['ARD', 'Arrière droit', 'ArD', 'ARR'], ['DC', 'Demi-centre', 'DC', 'ARR'], ['PIV', 'Pivot', 'PIV', 'PIV']],
      lines: [['GB', 'Gardiens'], ['AIL', 'Ailiers'], ['ARR', 'Arrières et demi-centres'], ['PIV', 'Pivots']],
      gk: 'Gardien', periods: 2, periodName: 'mi-temps', periodWord: 'période', periodLen: () => 30,
      unit: ['but', 'buts'], scorer: ['Buteur', 'Buteurs'], assist: 'Passe décisive',
      score: [{ k: 'goal', ic: '🤾', l: 'But pour nous', pts: 1, us: 1 }, { k: 'against', ic: '🥅', l: 'But encaissé', pts: 1 }],
      extra: [['save', '🧤', 'Arrêt du gardien', '#0d9488'], ['yellow', '🟨', 'Avertissement', '#ca8a04'], ['two', '⏱️', 'Exclusion 2 min', '#ea580c'], ['red', '🟥', 'Disqualification', '#dc2626', 'out']],
      arrows: { course: 'Course', conduite: 'Dribble', passe: 'Passe', tir: 'Tir', pressing: 'Défense', bascule: 'Croisé' },
      ai: 'handball', school: 'École de hand', catOf: a => a >= 18 ? 'Seniors' : a === 17 ? 'U18' : 'U' + Math.max(7, a % 2 ? a : a + 1),
    },
    rugby: {
      label: 'Rugby', icon: '🏉', ball: '🏉', place: 'terrain', catPrefix: 'M',
      formats: [['r15', 'Rugby à XV', 15], ['r10', 'Rugby à X (école)', 10], ['r7', 'Rugby à 7', 7]],
      formatOfCat: c => /^M(6|8|10|12)$/.test(c) ? 'r10' : 'r15',
      cats: ['M6', 'M8', 'M10', 'M12', 'M14', 'M16', 'M19', 'Seniors', 'Vétérans'],
      posts: [['PL', 'Première ligne', '1L', 'PL'], ['PIL', 'Pilier', 'PIL', 'PL'], ['TAL', 'Talonneur', 'TAL', 'PL'],
        ['DL', 'Deuxième ligne', '2L', 'DL'], ['TL', 'Troisième ligne', '3L', 'TL'], ['FL', 'Troisième ligne aile', '3LA', 'TL'], ['N8', 'Numéro 8', 'N8', 'TL'],
        ['DEM', 'Demi', 'DEM', 'DEM'], ['DM', 'Demi de mêlée', 'DM', 'DEM'], ['DO', 'Demi d\'ouverture', 'DO', 'DEM'],
        ['TQ', 'Trois-quarts', '3/4', 'TQ'], ['CEN', 'Centre', 'CEN', 'TQ'], ['AIL', 'Ailier', 'AIL', 'TQ'], ['ARR', 'Arrière', 'ARR', 'ARR']],
      lines: [['PL', 'Première ligne'], ['DL', 'Deuxième ligne'], ['TL', 'Troisième ligne'], ['DEM', 'Demis'], ['TQ', 'Trois-quarts'], ['ARR', 'Arrières']],
      gk: '', periods: 2, periodName: 'mi-temps', periodWord: 'période', periodLen: f => f === 'r7' ? 7 : f === 'r10' ? 15 : 40,
      unit: ['point', 'points'], scorer: ['Marqueur', 'Marqueurs'], assist: 'Dernière passe',
      score: [{ k: 'try', ic: '🏉', l: 'Essai', pts: 5, us: 1 }, { k: 'conv', ic: '🥅', l: 'Transformation', pts: 2, us: 1 }, { k: 'pen', ic: '🎯', l: 'Pénalité', pts: 3, us: 1 }, { k: 'drop', ic: '🦶', l: 'Drop', pts: 3, us: 1 },
        { k: 'atry', ic: '🔻', l: 'Essai encaissé', pts: 5 }, { k: 'aconv', ic: '🔻', l: 'Transfo. encaissée', pts: 2 }, { k: 'apen', ic: '🔻', l: 'Pénalité / drop encaissé', pts: 3 }],
      extra: [['yellow', '🟨', 'Carton jaune', '#ca8a04'], ['red', '🟥', 'Carton rouge', '#dc2626', 'out']],
      arrows: { course: 'Course', conduite: 'Course avec ballon', passe: 'Passe', tir: 'Jeu au pied', pressing: 'Plaquage / montée', bascule: 'Soutien' },
      ai: 'rugby', school: 'École de rugby', catOf: a => a >= 20 ? 'Seniors' : a >= 17 ? 'M19' : 'M' + Math.max(6, a % 2 ? a + 1 : a),
    },
    volley: {
      label: 'Volley', icon: '🏐', ball: '🏐', place: 'salle', catPrefix: 'M',
      formats: [['v6', 'Volley 6 contre 6', 6], ['v4', 'Volley 4 contre 4', 4]],
      formatOfCat: c => /^M(9|11|13)$/.test(c) ? 'v4' : 'v6',
      cats: ['M9', 'M11', 'M13', 'M15', 'M18', 'M21', 'Seniors', 'Loisirs'],
      posts: [['PAS', 'Passeur', 'PAS', 'PAS'], ['OPP', 'Pointu (opposé)', 'OPP', 'OPP'], ['R4', 'Réceptionneur-attaquant', 'R4', 'R4'], ['CEN', 'Central', 'CEN', 'CEN'], ['LIB', 'Libéro', 'LIB', 'LIB']],
      lines: [['PAS', 'Passeurs'], ['OPP', 'Pointus'], ['R4', 'Réceptionneurs-attaquants'], ['CEN', 'Centraux'], ['LIB', 'Libéros']],
      gk: '', periods: 5, periodName: 'set', periodWord: 'set', sets: true, setsToWin: f => f === 'v4' ? 2 : 3, setPoints: (n, f) => (n === (f === 'v4' ? 3 : 5) ? 15 : 25), periodLen: () => 0,
      unit: ['point', 'points'], scorer: ['Marqueur', 'Marqueurs'], assist: 'Passe',
      score: [{ k: 'pt', ic: '🏐', l: 'Point pour nous', pts: 1, us: 1 }, { k: 'apt', ic: '🔻', l: 'Point pour eux', pts: 1 }],
      extra: [['ace', '🎯', 'Ace', '#0d9488'], ['block', '🧱', 'Contre', '#0891b2'], ['err', '❌', 'Faute', '#ca8a04']],
      arrows: { course: 'Déplacement', conduite: 'Course', passe: 'Passe', tir: 'Attaque', pressing: 'Contre', bascule: 'Rotation' },
      ai: 'volley-ball', school: 'Baby-volley', catOf: a => a >= 22 ? 'Seniors' : a >= 19 ? 'M21' : a >= 16 ? 'M18' : 'M' + Math.max(9, a % 2 ? a : a + 1),
    },
  };
  const KEYS = Object.keys(SPORTS);
  const id = () => { const s = (typeof Store !== 'undefined' && Store.state && Store.state.club && Store.state.club.sport) || (typeof window !== 'undefined' && window.CLUB_SPORT) || 'foot'; return SPORTS[s] ? s : 'foot'; };
  const cur = () => SPORTS[id()];
  // the format of a team, of a schema: the sport is known by its format (old football schemas have no prefix)
  const sportOfFormat = f => KEYS.find(k => SPORTS[k].formats.some(x => x[0] === f)) || 'foot';
  const formatLabel = f => { for (const k of KEYS) { const x = SPORTS[k].formats.find(y => y[0] === f); if (x) return x[1]; } return f === 'zone' ? 'Zone libre' : f; };
  const players = f => { for (const k of KEYS) { const x = SPORTS[k].formats.find(y => y[0] === f); if (x) return x[2]; } return 11; };
  const defFormat = () => cur().formats[0][0];
  const isFoot = () => id() === 'foot';
  // live references used by the modules (People, Board…): filled again when the club's sport changes
  const POSTS = [], TYPES = [], LINES = [];
  function apply() {
    const s = cur();
    POSTS.length = 0; POSTS.push(...s.posts);
    TYPES.length = 0; TYPES.push(...s.posts.filter(p => p[0] === p[3]).map(p => [p[0], p[1]]));
    LINES.length = 0; LINES.push(...s.lines, ['', 'Poste non renseigné']);
    if (typeof Board !== 'undefined' && Board.ARROWS) Object.entries(s.arrows).forEach(([k, l]) => { if (Board.ARROWS[k]) Board.ARROWS[k].label = l; });
    if (typeof document !== 'undefined') document.documentElement.dataset.sport = id();
  }
  // the scoring actions and the other actions of the live match
  const scoreEv = () => cur().score;
  const isScore = k => KEYS.some(s => SPORTS[s].score.some(e => e.k === k));
  const scoreOf = k => { for (const s of KEYS) { const e = SPORTS[s].score.find(x => x.k === k); if (e) return e; } return null; };
  // the words of the sport: W().Units (« Buts » / « Points »), W().Scorers (« Buteurs » / « Marqueurs »)…
  const cap = x => x[0].toUpperCase() + x.slice(1);
  const W = () => { const s = cur(); return { units: s.unit[1], Units: cap(s.unit[1]), unit: s.unit[0], scorers: s.scorer[1].toLowerCase(), Scorers: s.scorer[1], Scorer: s.scorer[0], icon: s.icon, assist: s.assist, Assists: s.assist === 'Passe' ? 'Passes' : s.assist === 'Dernière passe' ? 'Dernières passes' : 'Passes déc.', place: s.place }; };
  // the points of the table: win / draw / loss of each sport
  const leaguePts = (V, N, D) => ({ basket: V * 2 + D, hand: V * 3 + N * 2 + D, rugby: V * 4 + N * 2, volley: V * 3 })[id()] ?? V * 3 + N;
  const word = (n, w = cur().unit) => `${n} ${n > 1 ? w[1] : w[0]}`;
  return { W, leaguePts, SPORTS, KEYS, id, cur, apply, isFoot, sportOfFormat, formatLabel, players, defFormat, POSTS, TYPES, LINES, scoreEv, isScore, scoreOf, word };
})();
Sport.apply();
