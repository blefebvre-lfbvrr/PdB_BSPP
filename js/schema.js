// Description déclarative du bilan de garde BSPP, dans l'ordre de la démarche S · X · A · B · C · D.
// Chaque champ peut définir comment il se traduit en ligne(s) dans le bilan rendu :
//   - tri    : `yes` / `no` (phrase pour Oui / Non)
//   - radio  : `out` sur chaque option
//   - text   : `fmt(v)` et `noneOut` (si la valeur commence par « Aucun »)
//   - eva    : `fmt(v)`
//   - out(v, s) : surcharge complète (retourne une chaîne, un tableau ou null)
// et comment il s'affiche :
//   - now     : bouton « Maintenant » (heure du moment ; 'append' l'ajoute à la suite du texte)
//   - warn(s) : alerte sous le champ (valeur anormale, rappel du mémo), texte ou { text, level }
//   - info    : ligne calculée `calc(s)` ; `report: true` la reprend dans le bilan
// Un groupe peut avoir un `memo` (aide-mémoire repliable) : textes, { h }, { ul }, { table }.

export const has = (s, key, v) => Array.isArray(s[key]) && s[key].includes(v);
export const hasSome = (s, key) => Array.isArray(s[key]) && s[key].some((k) => k !== 'aucun');
const isF = (s) => s.sexe === 'F';
export const fmtTime = (v) => (v ? String(v).replace(/^0?(\d+):(\d\d).*$/, (_, h, m) => (m === '00' ? `${h}h` : `${h}h${m}`)) : v);

export const num = (x) => {
  if (x === undefined || x === null || String(x).trim() === '') return null;
  const n = Number(String(x).trim().replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

// « 132/87 » → [132, 87] ; « 13/8 » (en cmHg) → [130, 80].
export function taParts(v) {
  const m = String(v ?? '').match(/^\s*(\d{2,3})\s*\/\s*(\d{1,3})\s*$/);
  if (!m) return null;
  let [sys, dia] = [Number(m[1]), Number(m[2])];
  if (sys < 30) { sys *= 10; dia *= 10; }
  return [sys, dia];
}

// Minutes écoulées depuis une heure « HH:MM » du jour (null si dans le futur ou invalide).
export function minutesSince(hhmm, now = new Date()) {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d\d)/);
  if (!m) return null;
  let d = now.getHours() * 60 + now.getMinutes() - (Number(m[1]) * 60 + Number(m[2]));
  if (d < 0) d += 24 * 60;
  return d;
}
export const fmtDuree = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`);

const tri = (name, label, yes, no, extra = {}) => ({ type: 'tri', name, label, yes, no, ...extra });
const text = (name, label, extra = {}) => ({ type: 'text', name, label, ...extra });
const area = (name, label, extra = {}) => ({ type: 'textarea', name, label, ...extra });
const eva = (name, label, fmt, extra = {}) => ({ type: 'eva', name, label, fmt, ...extra });
const time = (name, label, extra = {}) => ({ type: 'time', name, label, now: true, ...extra });
const info = (calc, extra = {}) => ({ type: 'info', calc, ...extra });
const radio = (name, label, options, extra = {}) => ({ type: 'radio', name, label, options, ...extra });
const checks = (name, label, options, extra = {}) => ({ type: 'checks', name, label, options, ...extra });
const silent = () => null;

export const DOULEUR_TYPES = [
  { v: 'serre', l: 'Serre (constrictive)', out: 'Douleur constrictive (ça serre)' },
  { v: 'appuie', l: 'Pesanteur', out: 'Douleur à type de pesanteur' },
  { v: 'brule', l: 'Brûle', out: 'Douleur à type de brûlure' },
  { v: 'pique', l: 'Pique', out: 'Douleur qui pique' },
  { v: 'lance', l: 'Lance', out: 'Douleur qui lance' },
  { v: 'tire', l: 'Tiraille', out: 'Douleur qui tiraille' },
  { v: 'pulse', l: 'Pulse', out: 'Douleur pulsatile' },
  { v: 'poignard', l: 'Coup de poignard', out: 'Douleur en coup de poignard' },
  { v: 'sourde', l: 'Sourde', out: 'Douleur sourde' },
  { v: 'crampe', l: 'Crampe', out: 'Douleur à type de crampe' },
];

// ---------------------------------------------------------------------------
// Signes de détresse, un groupe par lettre (affichés en premier dans le bilan vital).
// `out` : formulation courte reprise dans le bilan.
// ---------------------------------------------------------------------------
export const SIGNES_DETRESSE = [
  {
    name: 'sd_x',
    letter: 'X',
    title: 'Hémorragie',
    aucun: 'Pas d’hémorragie',
    none: 'Pas d’hémorragie',
    options: [
      { v: 'externe', l: 'Hémorragie externe', out: 'hémorragie externe' },
      { v: 'exteriorisee', l: 'Extériorisée (nez, oreille, bouche…)', out: 'hémorragie extériorisée' },
    ],
  },
  {
    name: 'sd_a',
    letter: 'A',
    title: 'Voies aériennes',
    aucun: 'Libres',
    none: 'Libres',
    options: [
      { v: 'obstruction_complete', l: 'Obstruction complète', out: 'obstruction complète' },
      { v: 'obstruction_partielle', l: 'Obstruction partielle', out: 'obstruction partielle' },
      { v: 'encombrement', l: 'Gargouillements (sang, vomi)', out: 'encombrement (gargouillements)' },
      { v: 'stridor', l: 'Bruit à l’inspiration', out: 'bruit inspiratoire' },
      { v: 'ronflement', l: 'Ronflements', out: 'ronflements' },
      { v: 'oedeme', l: 'Œdème face / cou', out: 'œdème de la face ou du cou' },
    ],
  },
  {
    name: 'sd_b',
    letter: 'B',
    title: 'Respiration',
    aucun: 'Aucun signe',
    none: 'Pas de détresse respiratoire',
    options: [
      { v: 'arret', l: 'Arrêt ventilatoire (FR ≤ 6)', out: 'arrêt ventilatoire' },
      { v: 'fr', l: 'FR anormale', out: 'FR anormale' },
      { v: 'sat', l: 'SpO2 < 94 %', out: 'SpO2 < 94 %' },
      { v: 'efforts', l: 'Tirage (cou, intercostal)', out: 'tirage' },
      { v: 'balancement', l: 'Balancement thoraco-abdominal', out: 'balancement thoraco-abdominal' },
      { v: 'cyanose', l: 'Cyanose', out: 'cyanose' },
      { v: 'sueurs', l: 'Sueurs', out: 'sueurs' },
      { v: 'bruits', l: 'Sifflements, râles', out: 'sifflements / râles' },
      { v: 'parole', l: 'Difficulté à parler', out: 'difficulté à parler' },
      { v: 'assis', l: 'Refuse de s’allonger', out: 'refuse de s’allonger' },
      { v: 'poitrine', l: 'Se tient la poitrine', out: 'se tient la poitrine' },
      { v: 'enfant', l: 'Enfant : ailes du nez, creusement', out: 'battement des ailes du nez / creusement sternal' },
    ],
  },
  {
    name: 'sd_c',
    letter: 'C',
    title: 'Circulation',
    aucun: 'Aucun signe',
    none: 'Pas de détresse circulatoire',
    options: [
      { v: 'acr', l: 'Arrêt cardiaque', out: 'arrêt cardiaque' },
      { v: 'fc', l: 'FC anormale', out: 'FC anormale' },
      { v: 'ta', l: 'TA syst. < 90 (ou chute > 30 %)', out: 'TA systolique < 90' },
      { v: 'radial', l: 'Radial absent, carotidien présent', out: 'pouls radial absent' },
      { v: 'trc', l: 'TRC > 2 s', out: 'TRC > 2 s' },
      { v: 'paleur', l: 'Pâleur (lèvres, paupières)', out: 'pâleur' },
      { v: 'sueurs', l: 'Sueurs froides', out: 'sueurs froides' },
      { v: 'marbrures', l: 'Marbrures', out: 'marbrures' },
      { v: 'soif', l: 'Soif', out: 'soif' },
      { v: 'angoisse', l: 'Agitation, angoisse', out: 'agitation / angoisse' },
      { v: 'vertiges', l: 'Vertiges, ne tient pas debout', out: 'vertiges' },
    ],
  },
  {
    name: 'sd_d',
    letter: 'D',
    title: 'Neurologique',
    aucun: 'Aucun signe',
    none: 'Pas de détresse neurologique',
    options: [
      { v: 'inconscient', l: 'Inconscience', out: 'inconscience' },
      { v: 'pci', l: 'PC initiale', out: 'PC initiale' },
      { v: 'glasgow', l: 'Glasgow < 15', out: 'Glasgow < 15' },
      { v: 'desorientation', l: 'Désorientation', out: 'désorientation' },
      { v: 'somnolence', l: 'Somnolence, agitation', out: 'somnolence / agitation' },
      { v: 'convulsions', l: 'Convulsions', out: 'convulsions' },
      { v: 'asymetrie', l: 'Visage asymétrique', out: 'asymétrie du visage' },
      { v: 'paralysie', l: 'Perte de force, paralysie', out: 'déficit moteur' },
      { v: 'sensibilite', l: 'Perte de sensibilité', out: 'déficit sensitif' },
      { v: 'parole', l: 'Trouble de la parole', out: 'trouble de la parole' },
      { v: 'pupilles', l: 'Pupilles anormales', out: 'pupilles anormales' },
      { v: 'amnesie', l: 'Amnésie des faits', out: 'amnésie' },
    ],
  },
];

const sdField = (name, label) => {
  const sd = SIGNES_DETRESSE.find((x) => x.name === name);
  return { type: 'checks', name, label, sd: true, cols2: true, options: [{ v: 'aucun', l: sd.aucun, exclusive: true }, ...sd.options], out: silent };
};

// ---------------------------------------------------------------------------
// Bilans spécifiques (mémo bilans spé)
// ---------------------------------------------------------------------------
export const SPE = [
  { v: 'malaise', l: 'Malaise' },
  { v: 'thoracique', l: 'Douleur thoracique' },
  { v: 'respi', l: 'Difficulté respiratoire (asthme, OAP)' },
  { v: 'abdo', l: 'Douleur abdominale' },
  { v: 'avc', l: 'AVC' },
  { v: 'convulsions', l: 'Crise convulsive' },
  { v: 'meningite', l: 'Méningite' },
  { v: 'tc', l: 'Traumatisme crânien' },
  { v: 'trauma', l: 'Traumatisme (membres, corps)' },
  { v: 'rachis', l: 'Traumatisme du rachis' },
  { v: 'plaie', l: 'Plaie / brûlure' },
  { v: 'intox', l: 'Intoxication' },
  { v: 'grossesse', l: 'Grossesse / accouchement' },
  { v: 'temperature', l: 'Hyperthermie / hypothermie' },
  { v: 'autre', l: 'Autre' },
];

// Lésions du bilan traumatique : une fiche par zone.
export const LESION_SIGNES = [
  { v: 'douleur', l: 'Douleur', out: 'douleur' },
  { v: 'deformation', l: 'Déformation', out: 'déformation' },
  { v: 'gonflement', l: 'Gonflement', out: 'gonflement' },
  { v: 'hematome', l: 'Hématome', out: 'hématome' },
  { v: 'plaie', l: 'Plaie', out: 'plaie' },
  { v: 'fo', l: 'Fracture ouverte', out: 'fracture ouverte' },
  { v: 'craquement', l: 'Craquement', out: 'craquement' },
  { v: 'impotence', l: 'Impotence', out: 'impotence fonctionnelle' },
];

export function lesionLine(e) {
  const zone = [String(e.zone || '').trim(), e.cote === 'g' ? 'côté gauche' : e.cote === 'd' ? 'côté droit' : ''].filter(Boolean).join(', ');
  const signes = (e.signes || []).map((k) => LESION_SIGNES.find((o) => o.v === k)?.out).filter(Boolean);
  const evaN = num(e.eva);
  if (evaN !== null) {
    const i = signes.indexOf('douleur');
    if (i >= 0) signes[i] = `douleur ${evaN}/10`;
    else signes.unshift(`douleur ${evaN}/10`);
  }
  const parts = [];
  if (signes.length) parts.push(signes.join(', '));
  if (e.distal === 'oui') parts.push('motricité, sensibilité, pouls, TRC et chaleur conservés en aval');
  else if (e.distal === 'non') parts.push('atteinte en aval (motricité, sensibilité, pouls, TRC ou chaleur)');
  const note = String(e.note || '').trim();
  if (note) parts.push(note);
  if (!zone && !parts.length) return '';
  const body = parts.join(' ; ');
  return zone ? `${zone[0].toUpperCase()}${zone.slice(1)}${body ? ` : ${body}` : ''}` : body[0].toUpperCase() + body.slice(1);
}

// Classement de la température (mémo urgence).
export function tempWarn(s) {
  const t = num(s.temp);
  if (t === null) return null;
  if (t < 24) return { text: 'Hypothermie grave : ACR apparent. Évaluer respiration et circulation pendant plus d’1 min avant une RCP.', level: 'alert' };
  if (t < 28) return { text: 'Hypothermie sévère : victime inconsciente, FC et FR lentes. Risque d’ACR : mobiliser avec extrême précaution.', level: 'alert' };
  if (t < 32) return { text: 'Hypothermie modérée : troubles de la conscience, rigidité. O2, mobiliser avec précaution, réchauffer.', level: 'alert' };
  if (t < 35) return { text: 'Hypothermie légère : frissons, FC et FR rapides. Réchauffer (sécher, couverture).', level: 'warn' };
  if (t <= 37.5) return null;
  if (t <= 40) return { text: 'Fièvre, insolation ou épuisement hyperthermique : réhydrater, refroidir.', level: 'warn' };
  return { text: 'Coup de chaleur / hyperthermie maligne d’effort : détresse vitale, avis médical urgent, refroidir activement (objectif < 39,4 °C).', level: 'alert' };
}

const GLY_SEUIL = { 'g/L': 0.6, 'mmol/L': 3.3, 'mg/dL': 60 };
export const glyBasse = (s) => {
  const g = num(s.gly);
  return g !== null && g < (GLY_SEUIL[s.gly_unite || 'g/L'] ?? 0.6);
};

// Asymétrie des tensions entre les deux bras (systolique).
export function taEcart(s) {
  const d = taParts(s.ta_d), g = taParts(s.ta_g);
  return d && g ? Math.abs(d[0] - g[0]) : null;
}

// Score de Malinas (accouchement) : null tant qu'un item manque.
export const MALINAS = ['mal_parite', 'mal_travail', 'mal_duree', 'mal_intervalle', 'mal_eaux'];
export function malinas(s) {
  const v = MALINAS.map((k) => num(s[k]));
  return v.some((x) => x === null) ? null : v.reduce((a, b) => a + b, 0);
}
export const APGAR = ['apgar_fc', 'apgar_resp', 'apgar_tonus', 'apgar_reac', 'apgar_coul'];
export function apgar(s) {
  const v = APGAR.map((k) => num(s[k]));
  return v.some((x) => x === null) ? null : v.reduce((a, b) => a + b, 0);
}
const score012 = (name, label, l0, l1, l2) => radio(name, label, [
  { v: '0', l: `${l0} · 0` }, { v: '1', l: `${l1} · 1` }, { v: '2', l: `${l2} · 2` },
], { out: silent });

// Immobilisation du rachis (mémo bilans spé, traumatisme du rachis).
export function rachisDecision(s) {
  const answered = s.rc_fiabilite && (s.rc_signes || []).length && (s.rc_mecanisme || []).length;
  if (s.rc_fiabilite === 'non' || hasSome(s, 'rc_signes')) {
    return { text: 'Immobiliser le rachis : réponses non fiables ou signe d’atteinte.', level: 'alert' };
  }
  const atcdRisque = hasSome(s, 'rc_atcd') || num(s.age) > 65;
  if (atcdRisque && hasSome(s, 'rc_mecanisme')) {
    return { text: 'Immobiliser le rachis : ATCD à risque et mécanisme à risque.', level: 'alert' };
  }
  if (answered && (s.rc_atcd || []).length) return { text: 'Pas d’immobilisation du rachis nécessaire.', level: 'ok' };
  return null;
}

// Intoxication aux opiacés : neuro + myosis + FR < 12.
export function opiaces(s) {
  const fr = num(s.fr);
  const neuro = has(s, 'sd_d', 'inconscient') || (num(s.gcs_y) && num(s.gcs_v) && num(s.gcs_m) && num(s.gcs_y) + num(s.gcs_v) + num(s.gcs_m) < 15);
  if (s.pupilles !== 'myosis' || !((fr !== null && fr < 12) || neuro)) return null;
  return {
    text: 'Myosis + FR < 12 ou trouble neuro : suspicion d’intoxication aux opiacés. Naloxone possible si plus de 14 ans ; insufflations si FR < 6.',
    level: 'alert',
  };
}

// ---------------------------------------------------------------------------
// Aide-mémoire (mémo urgence et mémo bilans spécifiques)
// ---------------------------------------------------------------------------
const MEMO = {
  s: [
    { h: 'Sécurité' }, 'Dangers ? Renforts utiles ?',
    { h: 'Scène' }, 'Freins ? Problèmes d’accès ? Informations de départ correctes ?',
    { h: 'Situation' }, 'Événements ? Mécanismes ? Nombre de victimes ? Plainte principale ?',
  ],
  x: [
    { h: 'Sans corps étranger' },
    { ul: [
      'Compression directe.',
      'Inefficace ou impossible : garrot.',
      'Efficace : pansement compressif d’urgence (PCU). Si le PCU est inefficace : reprendre la compression, puis GISH ou garrot.',
    ] },
    { h: 'Avec corps étranger' }, 'Garrot.',
    'Garrot : 5 à 7 cm au-dessus de la plaie, en zone garrotable uniquement. Noter l’heure de pose.',
    'GISH : compression maintenue 3 min, puis PCU.',
  ],
  a: [
    { h: 'Obstruction complète' },
    { ul: [
      '5 claques dans le dos, puis 5 compressions.',
      'Recommencer jusqu’à amélioration ou perte de connaissance.',
      'Arrêter si toux ou bruit.',
      'Inconscient : RCP (sans insufflations initiales).',
    ] },
    { h: 'Libération des voies aériennes' }, 'Sans trauma : bascule de la tête. Trauma : subluxation de la mâchoire.',
    { h: 'Aspiration' },
    { table: [
      ['', 'Sonde (CH)', 'mmHg', 'bar'],
      ['Adulte', '18–26', '350–500', '0,47–0,67'],
      ['Enfant', '8–12', '200–350', '0,27–0,47'],
      ['Nourrisson', '6–8', '200–250', '0,27–0,33'],
      ['Nouveau-né', '4–6', '120–150', '0,16–0,20'],
    ] },
  ],
  b: [
    { table: [['FR normale', '/min'], ['Adulte', '12–20'], ['Enfant', '20–30'], ['Nourrisson', '30–40'], ['Nouveau-né', '40–60']] },
    { table: [['SpO2 cible', '%'], ['Général', '94–98'], ['Insuffisant respiratoire chronique', '89–94'], ['COVID', '92–96']] },
    { table: [['Masque', 'L/min'], ['Masque haute concentration', '9–15'], ['Masque moyenne concentration', '6–9'], ['Lunettes', '1–6']] },
    'O2 à 15 L/min aussi si : intoxication au CO ou aux fumées, accident de plongée, crise drépanocytaire, détresse sans SpO2 mesurable, intoxication aux opiacés (FR < 12 ou inconscience), hypothermie modérée ou sévère, éclampsie.',
    { h: 'Arrêt ventilatoire (FR ≤ 6)' },
    'Insufflations avec O2 15 L/min, surveillance +++ (pouls, scope). Rythme : adulte 10/min, enfant 15–25, nourrisson 25–30. Rechercher une respiration chaque minute pendant 10 s ; si FR > 6 : surveillance +++ sur le dos.',
    { h: 'Signes' },
    'Sueurs (chaudes), cyanose, tirage (cou, intercostal), balancement thoraco-abdominal, battement des ailes du nez, sifflements, ronflements, râles crépitants, difficulté à compter jusqu’à 10.',
    { h: 'Position' }, 'Assise ou demi-assise (hors OAP : assise jambes pendantes).',
  ],
  c: [
    { table: [['FC normale', '/min'], ['Adulte', '60–100'], ['Enfant', '70–140'], ['Nourrisson', '100–160'], ['Nouveau-né', '120–160']] },
    'TA adulte : hypotension < 100, normale ~120, hypertension > 160 mmHg. Grave : systolique < 90, ou baisse de plus de 30 % chez l’hypertendu.',
    'TRC normal : moins de 2 s (lit de l’ongle).',
    { h: 'ACR adulte' }, '5 insufflations si noyade · RCP 30/2 · DSA · alerte (moyens, renfort) · O2 15 L/min.',
    { h: 'ACR enfant et nourrisson' }, '5 insufflations initiales · RCP 15/2 · alerte · DSA · O2 15 L/min.',
    'Pendant la RCP, à partir de 3 secouristes, rechercher le pouls en insufflant : pas de pouls → ACR ; pouls et FR ≤ 6 → arrêt ventilatoire ; pouls et FR > 6 → surveillance +++ sur le dos.',
    { h: 'Signes' }, 'Pâleur, sueurs (froides), marbrures, conjonctives décolorées, soif, arythmie, douleur thoracique, extrémités froides.',
    { h: 'Position' }, 'Allongée si détresse circulatoire, demi-assise si détresse respiratoire associée. Douleur thoracique sans détresse : position de confort.',
  ],
  d: [
    'Perte de connaissance · orientation (temps, espace) · pupilles (taille, réactivité, symétrie) · motricité et sensibilité des 4 membres.',
    'Glasgow : 13 à 15 léger, 9 à 12 modéré, 3 à 8 grave.',
    { h: 'Inconscience' },
    { ul: [
      'Sans trauma : PLS, aspiration si besoin, contact urgent après tension, température et glycémie, surveillance +++.',
      'Avec trauma : maintenir la LVA sur le dos ou assise ; PLS à 2 sur avis médical.',
    ] },
    'Position : PLS si trouble de la conscience (Glasgow < 10), allongée sinon ; demi-assise si détresse respiratoire associée.',
    { h: 'AVC' }, 'FAST (Face, Arm, Speech, Time) sur 10 s. Aphasie, asymétrie (visage, membres), vertiges, céphalées, bouche pâteuse. Noter l’heure des premiers signes : 4 h pour agir. Allongée strict.',
    { h: 'Crise convulsive' }, 'PC brutale → phase tonique (~30 s) → phase clonique (~1 min, morsure de langue, perte d’urine) → récupération (jusqu’à 30 min, PLS). Crise de plus de 5 min ou crises sans récupération : état de mal, UA.',
  ],
  glycemie: [
    'Indications : malaise à l’effort ou à jeun, diabétique, suspicion d’AVC, troubles de la conscience ou du comportement, intoxication éthylique.',
    { table: [['', 'min', 'moy.', 'diabète'], ['g/L', '0,6', '0,8', '1,26'], ['mmol/L', '3,3', '4,4', '7,0'], ['mg/dL', '60', '80', '126']] },
    'Glycémie < 0,6 g/L : 4 morceaux de sucre (2 à 3 chez l’enfant) si la victime peut avaler ; recontrôler après 15 min.',
    'Hyperglycémie : ne pas interpréter la valeur, demander un avis médical.',
    { h: 'Température' },
    { table: [
      ['< 24 °C', 'Hypothermie grave (ACR apparent)'],
      ['24–28', 'Sévère : inconsciente, FC et FR lentes'],
      ['28–32', 'Modérée : troubles de la conscience, rigidité'],
      ['32–35', 'Légère : frissons, FC et FR rapides'],
      ['35–37,5', 'Normale'],
      ['37,5–40', 'Fièvre, insolation, épuisement'],
      ['> 40 °C', 'Coup de chaleur, hyperthermie maligne'],
    ], nohead: true },
  ],
  position: [
    { ul: [
      'PLS : trouble de la conscience sans trauma.',
      'Allongée : détresse circulatoire ; AVC (allongée strict).',
      'Demi-assise : détresse respiratoire (+ circulatoire).',
      'Assise jambes pendantes : OAP.',
      'Assise penchée en avant : crise d’asthme.',
      'Allongée jambes fléchies : douleur abdominale, plaie de l’abdomen.',
      'Position de confort : douleur thoracique sans détresse.',
    ] },
  ],
  immo: [
    { h: 'Membre supérieur' },
    { ul: [
      'Écharpe simple : avant-bras, poignet, main.',
      'Écharpe + contre-écharpe : bras.',
      'Écharpe oblique : épaule, clavicule, omoplate.',
      'Attelle de membre supérieur (2 SR) : coude, avant-bras, poignet, main.',
    ] },
    { h: 'Membre inférieur' },
    { ul: ['Attelle de membre inférieur (3 SR) : genou, jambe, cheville, pied.', 'Attelle à traction (3 SR, en présence du médecin) : cuisse.'] },
    { h: 'Bassin' }, 'Contention pelvienne (3 SR) sur avis médical, ou détresse circulatoire si avis impossible. Ne jamais palper un bassin suspect.',
    { h: 'Rachis' },
    { ul: [
      'Victime sur le dos : cuillère + MID (3 SR) ou pont à 4 + MID (4 SR).',
      'Sur le ventre : retournement sur plan dur + MID (3 SR).',
      'Assise : ACT + MID (3 SR). Debout : plan dur debout + MID (3 SR).',
      'Plan dur seul uniquement si pas de MID.',
    ] },
  ],
};

// ---------------------------------------------------------------------------
// Onglets / groupes / champs
// ---------------------------------------------------------------------------
export const TABS = [
  // ------------------------------------------------------------------- S
  {
    id: 'situation',
    letter: 'S',
    title: 'Sécurité · Scène · Situation',
    groups: [
      {
        id: 'depart',
        title: 'Départ',
        fields: [
          text('motif', 'Motif de départ', { placeholder: 'Malaise sur la voie publique', out: silent }),
          area('adresse_inter', 'Adresse de l’intervention', { out: silent }),
          { type: 'date', name: 'date_pec', label: 'Date', out: silent },
          time('heure_depart', 'Départ', { out: silent }),
          time('heure_pec', 'Sur les lieux', { out: silent }),
        ],
      },
      {
        id: 'securite',
        title: 'Sécurité',
        fields: [
          checks('danger', 'Danger(s) persistant(s)', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'circulation', l: 'Circulation' },
            { v: 'feu', l: 'Feu, fumées' },
            { v: 'gaz', l: 'Gaz, CO' },
            { v: 'electricite', l: 'Électricité' },
            { v: 'chimique', l: 'Produit chimique' },
            { v: 'effondrement', l: 'Chute d’objets, effondrement' },
            { v: 'violence', l: 'Violence, agressivité' },
            { v: 'animal', l: 'Animal' },
            { v: 'autre', l: 'Autre' },
          ], {
            out: (v, s) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Pas de danger persistant';
              const f = getField('danger');
              const d = joinEt(v.filter((k) => k !== 'autre').map((k) => f.options.find((o) => o.v === k).l.toLowerCase()));
              const detail = (s.danger_detail || '').trim();
              const act = (s.danger_action || []).map((k) => optLabel('danger_action', k).toLowerCase());
              const what = [d, detail].filter(Boolean).join(' : ') || 'danger';
              return `Danger : ${what}${act.length ? ` (${act.join(', ')})` : ''}`;
            },
          }),
          text('danger_detail', 'Préciser', { show: (s) => hasSome(s, 'danger'), out: silent }),
          checks('danger_action', 'Danger', [
            { v: 'supprime', l: 'Supprimé' },
            { v: 'balise', l: 'Balisé' },
            { v: 'degagement', l: 'Dégagement d’urgence' },
          ], { show: (s) => hasSome(s, 'danger'), out: silent }),
          tri('securite_ok', 'Équipe en sécurité', null, 'Équipe pas en sécurité'),
          radio('renfort', 'Moyens', [
            { v: 'suffisants', l: 'Suffisants', out: 'Moyens suffisants' },
            { v: 'renfort', l: 'Renfort demandé' },
          ], {
            out: (v, s) => {
              if (v !== 'renfort') return optOut('renfort', v);
              const types = joinEt((s.renfort_type || []).map((k) => optOut('renfort_type', k)));
              const pour = (s.renfort_motif || '').trim();
              return [
                `Renfort demandé${s.heure_renfort ? ` à ${fmtTime(s.heure_renfort)}` : ''}${types ? ` : ${types}` : ''}`,
                pour ? ` pour ${pour}` : '',
              ].join('');
            },
          }),
          checks('renfort_type', 'Renfort', [
            { v: 'medical', l: 'Médicalisation (AR, SMUR)', out: 'médicalisation' },
            { v: 'secours', l: 'VSAV, secouristes', out: 'moyen de secours' },
            { v: 'incendie', l: 'Engin incendie, désincarcération', out: 'engin incendie' },
            { v: 'police', l: 'Police', out: 'police' },
            { v: 'autre', l: 'Autre', out: 'autre moyen' },
          ], { show: (s) => s.renfort === 'renfort', out: silent }),
          text('renfort_motif', 'Renfort pour', { placeholder: 'détresse vitale, relevage…', show: (s) => s.renfort === 'renfort', out: silent }),
          time('heure_renfort', 'Demandé à', { show: (s) => s.renfort === 'renfort', out: silent }),
        ],
        memo: MEMO.s,
      },
      {
        id: 'scene',
        title: 'Scène',
        hint: 'Freins ? Problèmes d’accès ? Informations de départ correctes ?',
        fields: [
          radio('lieu_type', 'Lieu', [
            { v: 'domicile', l: 'Domicile', out: 'à domicile' },
            { v: 'vp', l: 'Voie publique', out: 'sur la voie publique' },
            { v: 'erp', l: 'Lieu public, commerce', out: 'dans un lieu public' },
            { v: 'travail', l: 'Lieu de travail', out: 'sur le lieu de travail' },
            { v: 'transports', l: 'Transports', out: 'dans les transports' },
            { v: 'autre', l: 'Autre', out: '' },
          ], { out: silent }),
          text('lieu', 'Lieu, accès', {
            placeholder: '3e étage sans ascenseur, code 12A45',
            out: (v, s) => {
              const where = optOut('lieu_type', s.lieu_type);
              const acc = (v || '').trim();
              if (!where && !acc) return null;
              return where ? `Intervention ${where}${acc ? ` : ${acc}` : ''}` : `Lieu : ${acc}`;
            },
          }),
          text('temoins', 'Témoins, présents', { placeholder: 'son épouse, la police', fmt: (v) => `En présence de ${v}` }),
        ],
      },
      {
        id: 'situation',
        title: 'Situation',
        fields: [
          radio('sexe', 'Victime', [{ v: 'H', l: 'Homme' }, { v: 'F', l: 'Femme' }], { out: silent }),
          { type: 'number', name: 'age', label: 'Âge', suffix: 'ans', min: 0, max: 130, help: 'Calculé si la date de naissance est saisie (Identité).', out: silent },
          area('histoire', 'Que s’est-il passé ?', {
            placeholder: 'a fait une chute dans l’escalier…',
            help: 'Événements, mécanisme. Commencer en minuscule pour enchaîner : « Homme de 34 ans qui … »',
            out: silent,
          }),
          text('plainte', 'Plainte principale', { placeholder: 'une douleur au poignet droit', out: silent }),
          {
            type: 'counts',
            name: 'victimes',
            label: 'Nombre de victimes',
            items: [
              { k: 'nb_impliques', l: 'Impliqués' },
              { k: 'nb_ur', l: 'UR' },
              { k: 'nb_ua', l: 'UA' },
              { k: 'nb_dcd', l: 'Décédés' },
            ],
            out: (v, s) => {
              const n = (k) => num(s[k]) || 0;
              const parts = [
                n('nb_impliques') && `${n('nb_impliques')} impliqué${n('nb_impliques') > 1 ? 's' : ''}`,
                n('nb_ur') && `${n('nb_ur')} UR`,
                n('nb_ua') && `${n('nb_ua')} UA`,
                n('nb_dcd') && `${n('nb_dcd')} décédé${n('nb_dcd') > 1 ? 's' : ''}`,
              ].filter(Boolean);
              return parts.length ? `Victimes : ${parts.join(', ')}` : null;
            },
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- X
  {
    id: 'x',
    letter: 'X',
    title: 'Hémorragie',
    groups: [
      {
        id: 'x',
        letter: 'X',
        title: 'Hémorragie',
        vital: 'sd_x',
        fields: [
          sdField('sd_x', 'Hémorragie'),
          text('x_loc', 'Localisation', {
            placeholder: 'avant-bras droit',
            show: (s) => hasSome(s, 'sd_x'),
            fmt: (v) => `Localisation : ${v}`,
          }),
          tri('x_ce', 'Corps étranger dans la plaie', 'Corps étranger dans la plaie', 'Pas de corps étranger', { show: (s) => has(s, 'sd_x', 'externe') }),
          checks('x_gestes', 'Gestes', [
            { v: 'compression', l: 'Compression directe' },
            { v: 'pcu', l: 'Pansement compressif (PCU)' },
            { v: 'gish', l: 'Pansement hémostatique (GISH)' },
            { v: 'garrot', l: 'Garrot', out: (s) => (s.x_garrot_heure ? `Garrot posé à ${fmtTime(s.x_garrot_heure)}` : 'Garrot') },
            { v: 'allonge', l: 'Allongée' },
            { v: 'rechauffe', l: 'Réchauffée' },
          ], { show: (s) => hasSome(s, 'sd_x'), out: silent }),
          time('x_garrot_heure', 'Heure de pose du garrot', {
            show: (s) => has(s, 'x_gestes', 'garrot'),
            fmt: (v) => `Garrot posé à ${fmtTime(v)}`,
            warn: (s) => {
              const m = minutesSince(s.x_garrot_heure);
              return m === null ? null : { text: `Garrot posé depuis ${fmtDuree(m)}.`, level: 'warn' };
            },
          }),
          radio('x_resultat', 'Hémorragie', [
            { v: 'arretee', l: 'Arrêtée', out: 'Hémorragie arrêtée' },
            { v: 'persiste', l: 'Persiste', out: 'Hémorragie persistante' },
          ], { show: (s) => hasSome(s, 'sd_x') }),
          area('x_autre', 'Autres éléments', { show: (s) => hasSome(s, 'sd_x') }),
        ],
        memo: MEMO.x,
      },
    ],
  },

  // ------------------------------------------------------------------- A
  {
    id: 'a',
    letter: 'A',
    title: 'Voies aériennes',
    groups: [
      {
        id: 'a',
        letter: 'A',
        title: 'Voies aériennes',
        vital: 'sd_a',
        fields: [
          sdField('sd_a', 'Voies aériennes'),
          checks('a_gestes', 'Gestes', [
            { v: 'claques', l: 'Claques dans le dos' },
            { v: 'compressions_abdo', l: 'Compressions abdominales' },
            { v: 'compressions_tho', l: 'Compressions thoraciques' },
            { v: 'bascule', l: 'Bascule de la tête (LVA)', out: 'LVA par bascule de la tête' },
            { v: 'subluxation', l: 'Subluxation de la mâchoire (LVA)', out: 'LVA par subluxation de la mâchoire' },
            { v: 'aspiration', l: 'Aspiration' },
            { v: 'retournement', l: 'Retournement' },
            { v: 'casque', l: 'Retrait du casque' },
            { v: 'maintien_tete', l: 'Maintien de la tête' },
          ], { out: silent }),
          radio('a_desob', 'Désobstruction', [
            { v: 'efficace', l: 'Efficace', out: 'Désobstruction efficace' },
            { v: 'inefficace', l: 'Inefficace', out: 'Désobstruction inefficace' },
            { v: 'pc', l: 'Perte de connaissance', out: 'Perte de connaissance pendant la désobstruction, RCP' },
          ], { show: (s) => has(s, 'sd_a', 'obstruction_complete') || has(s, 'sd_a', 'obstruction_partielle') }),
          area('a_autre', 'Autres éléments'),
        ],
        memo: MEMO.a,
      },
    ],
  },

  // ------------------------------------------------------------------- B
  {
    id: 'b',
    letter: 'B',
    title: 'Respiration',
    groups: [
      {
        id: 'b',
        letter: 'B',
        title: 'Respiration',
        vital: 'sd_b',
        fields: [
          sdField('sd_b', 'Signes de détresse respiratoire'),
          { type: 'subtitle', label: 'Mesures' },
          {
            type: 'number',
            name: 'fr',
            label: 'Fréquence respiratoire',
            suffix: '/min',
            out: (v, s) => {
              const q = ['fr_ampl', 'fr_reg', 'fr_sym', 'fr_bruit'].map((k) => optOut(k, s[k])).filter(Boolean);
              if (isEmptyV(v)) return q.length ? `Respiration ${q.join(', ')}` : null;
              return [`FR ${v}/min`, ...q].join(', ');
            },
            warn: (s) => (num(s.fr) !== null && num(s.fr) <= 6
              ? { text: 'FR ≤ 6 : arrêt ventilatoire. Insufflations avec O2 15 L/min.', level: 'alert' }
              : null),
          },
          { type: 'preset', label: 'Ample, régulière, symétrique, silencieuse', set: { fr_ampl: 'ample', fr_reg: 'reguliere', fr_sym: 'symetrique', fr_bruit: 'silencieuse' } },
          radio('fr_ampl', 'Amplitude', [{ v: 'ample', l: 'Ample', out: 'ample' }, { v: 'superficielle', l: 'Superficielle', out: 'superficielle' }], { out: silent }),
          radio('fr_reg', 'Régularité', [
            { v: 'reguliere', l: 'Régulière', out: 'régulière' },
            { v: 'irreguliere', l: 'Irrégulière', out: 'irrégulière' },
            { v: 'pauses', l: 'Pauses > 6 s', out: 'avec pauses de plus de 6 s' },
          ], { out: silent }),
          radio('fr_sym', 'Symétrie', [{ v: 'symetrique', l: 'Symétrique', out: 'symétrique' }, { v: 'asymetrique', l: 'Asymétrique', out: 'asymétrique' }], { out: silent }),
          radio('fr_bruit', 'Bruit', [{ v: 'silencieuse', l: 'Silencieuse', out: 'silencieuse' }, { v: 'bruyante', l: 'Bruyante', out: 'bruyante' }], { out: silent }),
          {
            type: 'number',
            name: 'sat',
            label: 'Saturation (SpO2)',
            suffix: '%',
            out: (v, s) => {
              if (isEmptyV(v)) return null;
              if (s.sat_sous !== 'O2') return `SpO2 ${v} % à l’air ambiant`;
              const debit = num(s.o2_debit);
              const masque = optOut('o2_masque', s.o2_masque);
              return `SpO2 ${v} % sous O2${debit !== null ? ` ${debit} L/min` : ''}${masque ? ` (${masque})` : ''}`;
            },
            warn: (s) => {
              const sat = num(s.sat);
              if (sat === null || sat >= 94) return null;
              return { text: 'SpO2 < 94 % : oxygénothérapie (cible 94–98 %, 89–94 % si insuffisance respiratoire chronique).', level: sat < 90 ? 'alert' : 'warn' };
            },
          },
          radio('sat_sous', 'Sous', [{ v: 'AA', l: 'Air ambiant' }, { v: 'O2', l: 'O2' }], { out: silent }),
          { type: 'number', name: 'o2_debit', label: 'Débit O2', suffix: 'L/min', step: '0.5', show: (s) => s.sat_sous === 'O2', out: silent },
          radio('o2_masque', 'Dispositif', [
            { v: 'mhc', l: 'MHC', out: 'MHC' },
            { v: 'mmc', l: 'Masque simple', out: 'masque simple' },
            { v: 'lunettes', l: 'Lunettes', out: 'lunettes' },
            { v: 'bavu', l: 'BAVU', out: 'BAVU' },
          ], { show: (s) => s.sat_sous === 'O2', out: silent }),
          checks('b_gestes', 'Gestes', [
            { v: 'insufflations', l: 'Insufflations (BAVU)', out: 'Insufflations au BAVU' },
            { v: 'aspiration', l: 'Aspiration des mucosités' },
          ], { out: silent }),
          area('b_autre', 'Autres éléments respiratoires'),
        ],
        memo: MEMO.b,
      },
    ],
  },

  // ------------------------------------------------------------------- C
  {
    id: 'c',
    letter: 'C',
    title: 'Circulation',
    groups: [
      {
        id: 'c',
        letter: 'C',
        title: 'Circulation',
        vital: 'sd_c',
        fields: [
          sdField('sd_c', 'Signes de détresse circulatoire'),
          { type: 'subtitle', label: 'Arrêt cardiaque', show: (s) => has(s, 'sd_c', 'acr') },
          time('acr_heure', 'Heure du constat', { show: (s) => has(s, 'sd_c', 'acr'), fmt: (v) => `ACR constaté à ${fmtTime(v)}` }),
          tri('acr_temoin', 'Arrêt devant témoin', 'ACR devant témoin', 'ACR sans témoin', { show: (s) => has(s, 'sd_c', 'acr') }),
          tri('rcp_temoin', 'RCP débutée par un témoin', 'RCP débutée par un témoin', 'Pas de RCP avant notre arrivée', { show: (s) => has(s, 'sd_c', 'acr') }),
          text('no_flow', 'No flow estimé', { placeholder: '5 min', show: (s) => has(s, 'sd_c', 'acr'), fmt: (v) => `No flow estimé : ${v}` }),
          checks('c_gestes', 'Gestes', [
            { v: 'rcp', l: 'Massage cardiaque (RCP)', out: (s) => (s.rcp_heure ? `RCP débutée à ${fmtTime(s.rcp_heure)}` : 'RCP') },
            {
              v: 'dae',
              l: 'DAE',
              out: (s) => {
                const n = num(s.dae_chocs);
                if (n === null) return 'DAE';
                return n === 0 ? 'DAE : aucun choc délivré' : `DAE : ${n} choc${n > 1 ? 's' : ''}${s.dae_heures ? ` (${s.dae_heures})` : ''}`;
              },
            },
          ], { show: (s) => has(s, 'sd_c', 'acr'), out: silent }),
          time('rcp_heure', 'Début de la RCP', { show: (s) => has(s, 'c_gestes', 'rcp'), out: silent }),
          { type: 'number', name: 'dae_chocs', label: 'Nombre de chocs', show: (s) => has(s, 'c_gestes', 'dae'), out: silent },
          text('dae_heures', 'Heures des chocs', { now: 'append', placeholder: '14h02, 14h04', show: (s) => has(s, 'c_gestes', 'dae'), out: silent }),
          radio('racs', 'Reprise d’activité cardiaque', [
            { v: 'oui', l: 'Oui', out: 'Reprise d’activité cardiaque spontanée' },
            { v: 'non', l: 'Non', cls: 'no', out: 'Pas de reprise d’activité cardiaque' },
          ], { show: (s) => has(s, 'sd_c', 'acr') }),
          { type: 'subtitle', label: 'Mesures' },
          {
            type: 'number',
            name: 'fc',
            label: 'Fréquence cardiaque',
            suffix: '/min',
            out: (v, s) => {
              const q = ['fc_ampl', 'fc_reg'].map((k) => optOut(k, s[k])).filter(Boolean);
              const site = optOut('pouls_site', s.pouls_site);
              if (isEmptyV(v) && !q.length) return null;
              const base = isEmptyV(v) ? `Pouls ${q.join(', ')}` : [`FC ${v}/min`, ...q].join(', ');
              return site ? `${base} (${site})` : base;
            },
          },
          { type: 'preset', label: 'Bien frappé, régulier', set: { fc_ampl: 'bien_frappe', fc_reg: 'regulier' } },
          radio('fc_ampl', 'Pouls', [
            { v: 'bien_frappe', l: 'Bien frappé', out: 'bien frappé' },
            { v: 'filant', l: 'Mal perçu, filant', out: 'filant' },
          ], { out: silent }),
          radio('fc_reg', 'Rythme', [{ v: 'regulier', l: 'Régulier', out: 'régulier' }, { v: 'irregulier', l: 'Irrégulier', out: 'irrégulier' }], { out: silent }),
          radio('pouls_site', 'Pris au pouls', [
            { v: 'radial', l: 'Radial', out: 'radial' },
            { v: 'carotidien', l: 'Carotidien', out: 'carotidien' },
            { v: 'humeral', l: 'Huméral', out: 'huméral' },
            { v: 'femoral', l: 'Fémoral', out: 'fémoral' },
          ], { out: silent }),
          text('ta_ref', 'TA habituelle', {
            placeholder: '120/80', inputmode: 'numeric', ta: true,
            help: 'Tension habituelle de la victime, si elle la connaît.',
            fmt: (v) => `TA habituelle ${v}`,
          }),
          text('ta_d', 'TA bras droit (TAD)', { placeholder: '126/89', inputmode: 'numeric', ta: true, fmt: (v) => `TAD ${v}` }),
          text('ta_g', 'TA bras gauche (TAG)', {
            placeholder: '132/87', inputmode: 'numeric', ta: true, fmt: (v) => `TAG ${v}`,
            warn: (s) => {
              const sys = [taParts(s.ta_d), taParts(s.ta_g)].filter(Boolean).map((x) => x[0]);
              const msg = [];
              let level = 'warn';
              if (sys.length && Math.min(...sys) < 90) { msg.push('TA systolique < 90 : détresse circulatoire.'); level = 'alert'; }
              const ref = taParts(s.ta_ref);
              if (ref && sys.length && Math.min(...sys) < ref[0] * 0.7) { msg.push('Baisse de plus de 30 % par rapport à la TA habituelle.'); level = 'alert'; }
              const ecart = taEcart(s);
              if (ecart !== null && ecart > 20) msg.push(`Écart de ${ecart} mmHg entre les deux bras (> 20) : dissection aortique ? AVC ?`);
              return msg.length ? { text: msg.join(' '), level } : null;
            },
          }),
          radio('trc', 'TRC', [
            { v: 'inf', l: '< 2 s', out: 'TRC < 2 s' },
            { v: 'sup', l: '> 2 s', out: 'TRC > 2 s' },
          ]),
          area('c_autre', 'Autres éléments circulatoires'),
        ],
        memo: MEMO.c,
      },
    ],
  },

  // ------------------------------------------------------------------- D
  {
    id: 'd',
    letter: 'D',
    title: 'Neurologique',
    groups: [
      {
        id: 'd',
        letter: 'D',
        title: 'Neurologique',
        vital: 'sd_d',
        fields: [
          sdField('sd_d', 'Signes de détresse neurologique'),
          { type: 'subtitle', label: 'Examen' },
          {
            type: 'gcs',
            name: 'gcs',
            label: 'Glasgow',
            warn: (s) => {
              const t = gcsSum(s);
              if (!t || t === 15) return null;
              if (t <= 8) return { text: `Glasgow ${t} : atteinte grave. PLS si pas de trauma (sinon maintenir la LVA).`, level: 'alert' };
              if (t <= 12) return { text: `Glasgow ${t} : atteinte modérée.${t < 10 ? ' PLS si pas de trauma.' : ''}`, level: 'alert' };
              return { text: `Glasgow ${t} : atteinte légère.`, level: 'warn' };
            },
          },
          tri('pci', 'Perte de connaissance', 'PC', 'Pas de PC', {
            out: (v, s) => (v === 'oui' ? (s.pci_detail ? `PC : ${s.pci_detail}` : 'Perte de connaissance') : v === 'non' ? 'Pas de perte de connaissance' : null),
          }),
          text('pci_detail', 'Durée, circonstances', { show: (s) => s.pci === 'oui', placeholder: 'environ 30 s, en se levant', out: silent }),
          tri('ost', 'Orientée (temps, espace)', 'Orientée dans le temps et l’espace', 'Désorientée'),
          radio('pupilles', 'Pupilles', [
            { v: 'egales', l: 'Égales et réactives', out: 'Pupilles égales et réactives' },
            { v: 'inegales', l: 'Inégales (anisocorie)' },
            { v: 'mydriase', l: 'Dilatées (mydriase)', out: 'Pupilles dilatées (mydriase)' },
            { v: 'myosis', l: 'Serrées (myosis)', out: 'Pupilles serrées (myosis)' },
            { v: 'areactives', l: 'Aréactives', out: 'Pupilles aréactives' },
          ], {
            vertical: true,
            out: (v, s) => {
              if (v !== 'inegales') return optOut('pupilles', v);
              return s.pup_cote ? `Pupilles inégales, ${s.pup_cote === 'g' ? 'gauche' : 'droite'} plus dilatée` : 'Pupilles inégales';
            },
            warn: opiaces,
          }),
          radio('pup_cote', 'La plus dilatée', [{ v: 'g', l: 'Gauche' }, { v: 'd', l: 'Droite' }], { show: (s) => s.pupilles === 'inegales', out: silent }),
          tri('ms4m', 'Motricité et sensibilité des 4 membres', 'Motricité et sensibilité des 4 membres conservées', 'Déficit', {
            out: (v, s) => {
              if (v === 'oui') return 'Motricité et sensibilité des 4 membres conservées';
              if (v !== 'non') return null;
              const type = { moteur: 'moteur', sensitif: 'sensitif', both: 'sensitivo-moteur' }[s.ms_type] || 'sensitivo-moteur';
              const zones = (s.ms_deficit || []).map((k) => optLabel('ms_deficit', k).toLowerCase());
              return `Déficit ${type}${zones.length ? ` : ${zones.join(', ')}` : ''}`;
            },
          }),
          checks('ms_deficit', 'Membre(s) atteint(s)', [
            { v: 'main_g', l: 'Main G' }, { v: 'main_d', l: 'Main D' },
            { v: 'bras_g', l: 'Bras G' }, { v: 'bras_d', l: 'Bras D' },
            { v: 'jambe_g', l: 'Jambe G' }, { v: 'jambe_d', l: 'Jambe D' },
            { v: 'pied_g', l: 'Pied G' }, { v: 'pied_d', l: 'Pied D' },
          ], { show: (s) => s.ms4m === 'non', out: silent }),
          radio('ms_type', 'Atteinte', [
            { v: 'moteur', l: 'Motricité' }, { v: 'sensitif', l: 'Sensibilité' }, { v: 'both', l: 'Les deux' },
          ], { show: (s) => s.ms4m === 'non', out: silent }),
          radio('fast', 'FAST', [
            { v: 'negatif', l: 'Négatif', out: 'FAST négatif' },
            { v: 'positif', l: 'Positif' },
          ], {
            out: (v, s) => {
              if (v !== 'positif') return optOut('fast', v);
              const signes = (s.fast_signes || []).map((k) => optOut('fast_signes', k));
              return `FAST positif${signes.length ? ` : ${signes.join(', ')}` : ''}`;
            },
          }),
          checks('fast_signes', 'Signes', [
            { v: 'face', l: 'Visage asymétrique', out: 'asymétrie du visage' },
            { v: 'bras', l: 'Bras qui retombe', out: 'faiblesse d’un bras' },
            { v: 'parole', l: 'Trouble de la parole', out: 'trouble de la parole' },
          ], { show: (s) => s.fast === 'positif', out: silent }),
          time('avc_heure', 'Heure des premiers signes', {
            show: (s) => s.fast === 'positif',
            fmt: (v) => `Premiers signes à ${fmtTime(v)}`,
            warn: avcWarn,
          }),
          area('d_autre', 'Autres éléments neurologiques'),
        ],
        memo: MEMO.d,
      },
    ],
  },

  // ------------------------------------------------------- Complémentaire
  {
    id: 'complementaire',
    title: 'Bilan complémentaire',
    groups: [
      {
        id: 'spe_choix',
        title: 'Bilans spécifiques',
        hint: 'Choisir un ou plusieurs bilans : les questions du mémo apparaissent en dessous.',
        fields: [
          checks('spe', '', SPE, { big: true, out: silent }),
          text('spe_autre', 'Préciser', { show: (s) => has(s, 'spe', 'autre'), out: silent }),
        ],
      },

      // ---------------------------------------------------------------- Spé
      {
        id: 'malaise',
        spe: 'malaise',
        title: 'Malaise',
        fields: [
          text('ml_contexte', 'Circonstances du malaise', { placeholder: 'en se levant, à l’effort, à jeun', fmt: (v) => `Malaise survenu ${v}` }),
          checks('ml_prodromes', 'Signes avant le malaise', [
            { v: 'sueurs', l: 'Sueurs' },
            { v: 'vision', l: 'Vision trouble' },
            { v: 'bourdonnements', l: 'Bourdonnements' },
            { v: 'nausees', l: 'Nausées' },
            { v: 'faiblesse', l: 'Faiblesse' },
            { v: 'palpitations', l: 'Palpitations' },
            { v: 'fourmillements', l: 'Fourmillements' },
            { v: 'chaleur', l: 'Bouffée de chaleur' },
          ], { fmt: (labels) => `Signes avant le malaise : ${labels.join(', ').toLowerCase()}` }),
          tri('ml_chute', 'Chute', 'Chute lors du malaise', 'Pas de chute'),
          tri('ml_atcd', 'Malaises antérieurs', 'ATCD de malaise similaire', 'Pas d’ATCD de malaise'),
          text('ml_hydratation', 'Hydratation', { placeholder: '1 L d’eau depuis ce matin', fmt: (v) => `Hydratation : ${v}` }),
          area('ml_autre', 'Autres éléments'),
        ],
        memo: ['Rechercher une aggravation de maladie : faiblesse d’un membre supérieur, anomalie de la parole, asymétrie du visage (FAST), glycémie (malaise à l’effort ou à jeun, diabétique), ordonnance.'],
      },
      {
        id: 'thoracique',
        spe: 'thoracique',
        title: 'Douleur thoracique',
        fields: [
          tri('th_effort', 'Liée à un effort', 'Douleur apparue à l’effort', 'Pas d’effort particulier'),
          tri('th_natispray', 'Vasodilatateur pris (Natispray…)', 'Prise de vasodilatateur', 'Pas de vasodilatateur', {
            out: (v, s) => {
              if (v === 'non') return 'Pas de vasodilatateur';
              if (v !== 'oui') return null;
              const e = optOut('th_natispray_effet', s.th_natispray_effet);
              return `Prise de vasodilatateur${e ? `, ${e}` : ''}`;
            },
          }),
          radio('th_natispray_effet', 'Après la prise', [
            { v: 'disparue', l: 'Douleur disparue', out: 'douleur disparue' },
            { v: 'diminuee', l: 'Diminuée', out: 'douleur diminuée' },
            { v: 'inchangee', l: 'Inchangée', out: 'douleur inchangée' },
          ], { show: (s) => s.th_natispray === 'oui', out: silent }),
          eva('th_eva_palpation', 'Douleur à la palpation', (v) => `Douleur à ${v}/10 à la palpation`),
          eva('th_eva_respi', 'Douleur à la respiration', (v) => `Douleur à ${v}/10 à la respiration`),
          checks('th_irradiation', 'Irradiation', [
            { v: 'aucune', l: 'Aucune', exclusive: true },
            { v: 'machoire', l: 'Mâchoire', out: 'la mâchoire' },
            { v: 'epaule_g', l: 'Épaule gauche', out: 'l’épaule gauche' },
            { v: 'bras_g', l: 'Bras gauche', out: 'le bras gauche' },
            { v: 'bras_d', l: 'Bras droit', out: 'le bras droit' },
            { v: 'dos', l: 'Dos', out: 'le dos' },
            { v: 'epigastre', l: 'Épigastre', out: 'l’épigastre' },
            { v: 'migrante', l: 'D’une épaule à l’autre', out: 'd’une épaule à l’autre' },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucune')) return 'Pas d’irradiation';
              return `Irradiation : ${joinEt(v.map((k) => optOut('th_irradiation', k)))}`;
            },
          }),
          tri('th_dyspnee', 'Sensation de manquer d’air', 'Sensation de manquer d’air', 'Pas de sensation de manque d’air'),
          info((s) => {
            const e = taEcart(s);
            if (e === null) return { text: 'Prendre la tension aux deux bras (étape C) : écart à rechercher.', level: 'info' };
            return { text: `Écart TAD / TAG : ${e} mmHg${e > 20 ? ' (> 20 : dissection ?)' : ''}`, level: e > 20 ? 'alert' : 'ok' };
          }, { report: true }),
          { type: 'subtitle', label: 'Facteurs de risque' },
          text('th_tabac', 'Tabac', { placeholder: '1 paquet par jour depuis 10 ans', none: 'Aucun', fmt: (v) => `Tabac : ${v}`, noneOut: 'Non fumeur' }),
          tri('th_diabete', 'Diabète', 'Diabète', 'Pas de diabète'),
          tri('th_cholesterol', 'Cholestérol', 'Cholestérol', 'Pas de cholestérol'),
          tri('th_hta', 'Hypertension', 'Hypertension', 'Pas d’hypertension'),
          text('th_poids', 'Surpoids (taille, poids)', { placeholder: '1,75 m, 95 kg', fmt: (v) => `Surpoids : ${v}` }),
          text('th_conso', 'Alcool, drogues', { none: 'Aucun', fmt: (v) => `Consommation : ${v}`, noneOut: 'Pas d’alcool ni de drogue' }),
          text('th_atcd', 'ATCD cardiaques (victime)', { none: 'Aucun', fmt: (v) => `ATCD cardiaques : ${v}`, noneOut: 'Pas d’ATCD cardiaque' }),
          text('th_atcd_fam', 'ATCD cardiaques familiaux (+ âge)', {
            placeholder: 'infarctus du père à 55 ans', none: 'Aucun',
            fmt: (v) => `ATCD cardiaques familiaux : ${v}`, noneOut: 'Pas d’ATCD cardiaque familial',
          }),
          tri('th_ecg', 'ECG de référence disponible', 'ECG de référence disponible', 'Pas d’ECG de référence'),
          { type: 'subtitle', label: 'Embolie pulmonaire' },
          tri('th_point_cote', 'Douleur en point de côté (basithoracique)', 'Douleur en point de côté', 'Pas de douleur en point de côté'),
          radio('th_mollets', 'Mollets', [
            { v: 'souples', l: 'Souples, indolores', out: 'Mollets souples et indolores' },
            { v: 'douloureux', l: 'Tendus ou douloureux', out: 'Mollets tendus ou douloureux' },
          ]),
          checks('th_ep', 'Facteurs de risque', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'phlebite', l: 'Phlébite' },
            { v: 'sedentarite', l: 'Sédentarité' },
            { v: 'voyage', l: 'Long voyage' },
            { v: 'altitude', l: 'Altitude, plongée' },
            { v: 'immobilisation', l: 'Immobilisation (plâtre, attelle, alitement)' },
            { v: 'cancer', l: 'Cancer' },
            { v: 'grossesse', l: 'Grossesse, accouchement récent, fausse couche', show: isF },
            { v: 'pilule', l: 'Pilule, contraception', show: isF },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Pas de facteur de risque d’embolie';
              return `Facteurs de risque d’embolie : ${v.map((k) => optLabel('th_ep', k).toLowerCase()).join(', ')}`;
            },
          }),
          area('th_autre', 'Autres éléments'),
        ],
        memo: [
          { h: 'Angor' }, 'Douleur médio-thoracique rétrosternale constrictive, irradiant au bras ou à la mâchoire. Cède 20 min après l’effort, 2 min après un vasodilatateur.',
          { h: 'Syndrome coronarien aigu' }, 'Mêmes signes, mais ne cède pas au repos ni au vasodilatateur.',
          { h: 'Embolie pulmonaire' }, 'Douleur basithoracique en point de côté, angoisse, détresse respiratoire, phlébite. Chez la femme : peut être confondue avec une crise d’angoisse. Désaturation attendue.',
          { h: 'Dissection aortique' }, 'Douleur violente, migrant d’une épaule à l’autre, sans effort. Asymétrie de tension > 20 mmHg.',
          'Position : celle où la victime se sent le mieux ; allongée si détresse.',
        ],
      },
      {
        id: 'respi_spe',
        spe: 'respi',
        title: 'Difficulté respiratoire',
        fields: [
          text('rs_debut', 'Début', { placeholder: 'il y a 20 min', fmt: (v) => `Difficultés respiratoires depuis ${v}` }),
          text('rs_declencheur', 'Événement déclencheur', { placeholder: 'effort, allergie, fumée…', fmt: (v) => `Déclencheur : ${v}` }),
          radio('rs_parole', 'Parole', [
            { v: 'phrases', l: 'Phrases complètes', out: 'Parle en phrases complètes' },
            { v: 'mots', l: 'Quelques mots', out: 'Ne parle que par quelques mots' },
            { v: 'impossible', l: 'Ne peut pas parler', out: 'Ne peut pas parler' },
          ], { vertical: true }),
          { type: 'subtitle', label: 'Asthme' },
          tri('rs_asthme', 'Asthme connu', 'Asthme connu', 'Pas d’asthme connu'),
          text('rs_derniere', 'Dernière crise', { fmt: (v) => `Dernière crise : ${v}` }),
          tri('rs_rea', 'Déjà passé en réanimation', 'ATCD de passage en réanimation', 'Jamais passé en réanimation'),
          text('rs_traitement', 'Traitement pris', { placeholder: 'Ventoline 2 bouffées à 23h', none: 'Aucun', fmt: (v) => `Traitement pris : ${v}`, noneOut: 'Pas de traitement pris' }),
          { type: 'subtitle', label: 'OAP' },
          tri('rs_crepitants', 'Toux, crépitements, râles', 'Toux, crépitements', 'Pas de crépitements'),
          tri('rs_mousse', 'Mousse aux lèvres', 'Mousse aux lèvres', 'Pas de mousse aux lèvres'),
          tri('rs_atcd_cardio', 'ATCD cardiaques', 'ATCD cardiaques', 'Pas d’ATCD cardiaque'),
          tri('rs_sel', 'Repas riche en sel', 'Repas riche en sel', 'Pas de repas riche en sel'),
          area('rs_autre', 'Autres éléments'),
        ],
        memo: [
          { h: 'Crise d’asthme' }, 'FR élevée, sifflement à l’expiration, difficulté à parler. Rechercher vite la saturation. Position assise, penchée en avant.',
          { h: 'Œdème aigu du poumon' }, 'Tension souvent élevée puis qui chute, toux, crépitements, mousse aux lèvres. Personnes âgées, ATCD cardiaques. Assise jambes pendantes ; demi-assise jambes allongées si détresse circulatoire.',
        ],
      },
      {
        id: 'abdo',
        spe: 'abdo',
        title: 'Douleur abdominale',
        fields: [
          radio('ab_palpation', 'Abdomen', [
            { v: 'souple', l: 'Souple, indolore', out: 'Abdomen souple et indolore' },
            { v: 'douloureux', l: 'Douloureux à la palpation', out: 'Abdomen douloureux à la palpation' },
            { v: 'defense', l: 'Défense', out: 'Défense abdominale' },
          ], { vertical: true }),
          eva('ab_eva_palpation', 'Douleur à la palpation', (v) => `Douleur à ${v}/10 à la palpation`),
          tri('ab_diarrhees', 'Diarrhées', 'Diarrhées', 'Pas de diarrhée'),
          text('ab_selles', 'Dernières selles (date, aspect)', { placeholder: 'hier, normales', fmt: (v) => `Dernières selles : ${v}` }),
          tri('ab_urines', 'Brûlures en urinant', 'Brûlures mictionnelles', 'Pas de brûlures mictionnelles'),
          tri('ab_saignement', 'Saignement aux toilettes', 'Saignement aux toilettes', 'Pas de saignement aux toilettes'),
          radio('ab_grossesse', 'Grossesse possible', [
            { v: 'oui', l: 'Oui', out: 'Grossesse possible' },
            { v: 'non', l: 'Non', out: 'Pas de grossesse possible' },
            { v: 'nsp', l: 'Ne sait pas', out: 'Ne sait pas si grossesse possible' },
          ], { show: isF }),
          text('ab_contraception', 'Contraception', { show: isF, fmt: (v) => `Contraception : ${v}` }),
          text('ab_regles', 'Dernières règles', { show: isF, fmt: (v) => `Dernières règles : ${v}` }),
          area('ab_autre', 'Autres éléments'),
        ],
        memo: ['Chez la femme : grossesse possible (rapports, contraception, dernières règles) ? Grossesse extra-utérine ?', 'Rechercher aussi une douleur thoracique. Position : allongée jambes fléchies.'],
      },
      {
        id: 'avc',
        spe: 'avc',
        title: 'AVC',
        fields: [
          time('avc_heure', 'Heure des premiers signes', {
            out: (v, s) => (s.fast === 'positif' || !v ? null : `Premiers signes à ${fmtTime(v)}`),
            warn: avcWarn,
          }),
          tri('avc_fourmis', 'Engourdissement, fourmillements', 'Engourdissement / fourmillements', 'Pas d’engourdissement'),
          tri('avc_ait', 'Signes disparus depuis', 'Signes disparus (AIT ?)', 'Signes toujours présents'),
          tri('avc_anticoag', 'Anticoagulant ou antiagrégant', 'Traitement anticoagulant / antiagrégant', 'Pas d’anticoagulant'),
          text('avc_fdr', 'Facteurs de risque cardiovasculaires', { none: 'Aucun', fmt: (v) => `Facteurs de risque : ${v}`, noneOut: 'Pas de facteur de risque cardiovasculaire' }),
          checks('avc_irm', 'Contre-indications à l’IRM', [
            { v: 'aucune', l: 'Aucune', exclusive: true },
            { v: 'pacemaker', l: 'Pacemaker' },
            { v: 'dai', l: 'Défibrillateur implanté' },
            { v: 'valve', l: 'Valve cardiaque' },
            { v: 'metal', l: 'Corps étranger métallique (œil, crâne)' },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucune')) return 'Pas de contre-indication à l’IRM';
              return `Contre-indication à l’IRM : ${v.map((k) => optLabel('avc_irm', k).toLowerCase()).join(', ')}`;
            },
          }),
          info((s) => {
            const e = taEcart(s);
            if (e === null) return { text: 'Symétrie des tensions à faire dans la foulée (étape C) : moins de 20 mmHg d’écart attendu.', level: 'info' };
            return { text: `Écart TAD / TAG : ${e} mmHg`, level: e > 20 ? 'alert' : 'ok' };
          }, { report: true }),
          area('avc_autre', 'Autres éléments'),
        ],
        memo: [
          'FAST (Face, Arm, Speech, Time). Heure du premier signe : 4 h pour agir. Glycémie. Neuro ++ (signes méningés si AVC hémorragique).',
          'Si les signes disparaissent : penser à l’AIT.',
          'Position : allongée strict.',
        ],
      },
      {
        id: 'convulsions',
        spe: 'convulsions',
        title: 'Crise convulsive',
        fields: [
          { type: 'number', name: 'cv_nb', label: 'Nombre de crises', fmt: (v) => `${v} crise${num(v) > 1 ? 's' : ''}` },
          {
            type: 'number', name: 'cv_duree', label: 'Durée de la crise', suffix: 'min', step: '0.5',
            fmt: (v) => `Durée : ${v} min`,
            warn: (s) => (num(s.cv_duree) > 5 ? { text: 'Crise de plus de 5 min : état de mal convulsif, UA.', level: 'alert' } : null),
          },
          tri('cv_recup', 'Récupération entre les crises', 'Récupération entre les crises', 'Pas de récupération entre les crises', {
            show: (s) => num(s.cv_nb) > 1,
            warn: (s) => (s.cv_recup === 'non' ? { text: 'Crises sans récupération : état de mal convulsif, UA.', level: 'alert' } : null),
          }),
          radio('cv_type', 'Crise', [
            { v: 'generalisee', l: 'Généralisée', out: 'Crise généralisée' },
            { v: 'focale', l: 'Focale', out: 'Crise focale' },
          ]),
          tri('cv_urine', 'Perte d’urine', 'Perte d’urine', 'Pas de perte d’urine'),
          tri('cv_langue', 'Morsure de la langue', 'Morsure de langue', 'Pas de morsure de langue'),
          tri('cv_tc', 'Choc à la tête', 'Choc à la tête lors de la crise', 'Pas de choc à la tête'),
          tri('cv_epilepsie', 'Épileptique connu', 'Épilepsie connue', 'Pas d’épilepsie connue'),
          text('cv_traitement', 'Traitement', { show: (s) => s.cv_epilepsie === 'oui', fmt: (v) => `Traitement : ${v}` }),
          tri('cv_pris', 'Traitement pris ce jour', 'Traitement pris ce jour', 'Traitement non pris ce jour', { show: (s) => s.cv_epilepsie === 'oui' }),
          text('cv_derniere', 'Dernière crise', { fmt: (v) => `Dernière crise : ${v}` }),
          text('cv_declencheur', 'Élément déclencheur', { fmt: (v) => `Déclencheur : ${v}` }),
          tri('cv_intox', 'Intoxication (drogue, médicaments)', 'Intoxication associée', 'Pas d’intoxication'),
          area('cv_autre', 'Autres éléments'),
        ],
        memo: [
          'Phase de début (chute avec PC brutale) → phase tonique (30 s à 1 min) → phase clonique (~1 min) → récupération (quelques minutes à 30 min).',
          'État de mal convulsif → UA : 1 crise de plus de 5 min, ou plusieurs crises sans récupération.',
          'Crises focales possibles sans PC (souvent chez l’enfant). Nourrisson : température directe, refroidir.',
        ],
      },
      {
        id: 'meningite',
        spe: 'meningite',
        title: 'Méningite',
        hint: 'EPI obligatoires : gants, masque, lunettes, combinaison, charlotte, surchaussures.',
        fields: [
          checks('mg_signes', 'Signes', [
            { v: 'cephalees', l: 'Céphalées' },
            { v: 'fievre', l: 'Fièvre' },
            { v: 'nuque', l: 'Raideur de nuque' },
            { v: 'vomissements', l: 'Vomissements en jet' },
            { v: 'photophobie', l: 'Photophobie' },
            { v: 'chien_fusil', l: 'Position en chien de fusil' },
            { v: 'purpura', l: 'Purpura (persiste à la vitropression)' },
          ], { fmt: (labels) => `Signes méningés : ${labels.join(', ').toLowerCase()}` }),
          tri('mg_contact', 'Cas contact', 'Cas contact', 'Pas de cas contact connu'),
          area('mg_autre', 'Autres éléments'),
        ],
        memo: ['Purpura : entourer les taches. Deux types : virale (plus courante) et bactérienne (plus grave).'],
      },
      {
        id: 'tc',
        spe: 'tc',
        title: 'Traumatisme crânien',
        heading: () => 'Bilan TC :',
        hint: 'Nausées, vomissements, céphalées, vertiges et vision sont repris dans le bilan TC.',
        fields: [
          text('tc_plaie', 'Plaie', { placeholder: 'superficielle à l’arrière du crâne', none: 'Aucune', fmt: (v) => `Plaie ${v}`, noneOut: 'Pas de plaie' }),
          tri('tc_deformation', 'Déformation du crâne (embarrure)', 'Déformation du crâne', 'Pas de déformation du crâne'),
          eva('tc_eva', 'Douleur à la palpation', (v) => `Douleur évaluée à ${v}/10 à la palpation`),
          { type: 'symptoms' },
          tri('tc_epistaxis', 'Épistaxis (saignement du nez)', 'Épistaxis', 'Pas d’épistaxis'),
          tri('tc_otorragie', 'Otorragie (saignement de l’oreille)', 'Otorragie', 'Pas d’otorragie'),
          tri('tc_somnolence', 'Somnolence ou agitation', 'Somnolence / agitation', 'Pas de somnolence ni d’agitation'),
          tri('tc_prostration', 'Obnubilation, prostration (enfant)', 'Obnubilation / prostration', 'Pas d’obnubilation'),
          tri('tc_amnesie', 'Amnésie des faits', 'Amnésie des faits', 'Pas d’amnésie'),
          tri('tc_cervical', 'Douleur cervicale', 'Douleur cervicale', 'Pas de douleur cervicale'),
          area('tc_autre', 'Autres éléments'),
        ],
      },
      {
        id: 'trauma',
        spe: 'trauma',
        title: 'Traumatisme',
        heading: () => 'Bilan traumatique :',
        fields: [
          text('tr_mecanisme', 'Mécanisme', { placeholder: 'chute de sa hauteur sur le poignet', fmt: (v) => `Mécanisme : ${v}` }),
          { type: 'lesions', name: 'lesions', label: 'Lésions', out: (v) => (v || []).map(lesionLine).filter(Boolean) },
          text('tr_atcd', 'ATCD sur la même zone', {
            placeholder: 'entorse du même genou en 2022', none: 'Aucun',
            fmt: (v) => `Antécédent : ${v}`, noneOut: 'Pas d’antécédent sur cette zone',
          }),
          area('tr_autre', 'Autres éléments'),
        ],
        memo: MEMO.immo,
      },
      {
        id: 'rachis',
        spe: 'rachis',
        title: 'Traumatisme du rachis',
        fields: [
          checks('rc_mecanisme', 'Mécanisme à risque', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'chute_tete', l: 'Chute tête > 1 m' },
            { v: 'chute_fesses', l: 'Chute pieds / fesses > 3 m' },
            { v: 'vehicule', l: 'Véhicule > 40 km/h (arrêt < 10 m, habitacle déformé)' },
            { v: 'airbag', l: 'Airbag sans ceinture, tonneau, éjection' },
            { v: 'deux_roues', l: 'Collision deux-roues' },
            { v: 'pieton', l: 'Piéton renversé' },
            { v: 'loisir', l: 'Véhicule de loisir (quad, jet-ski…)' },
            { v: 'cheval', l: 'Chute de cheval' },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Pas de mécanisme à risque';
              return `Mécanisme à risque : ${v.map((k) => optLabel('rc_mecanisme', k).toLowerCase()).join(', ')}`;
            },
          }),
          checks('rc_signes', 'Signes d’atteinte du rachis ou de la moelle', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'force', l: 'Perte de force (main, pied)' },
            { v: 'sensibilite', l: 'Perte de sensibilité, engourdissement' },
            { v: 'douleur', l: 'Douleur du rachis' },
            { v: 'decharges', l: 'Décharges électriques' },
            { v: 'nuque', l: 'Raideur de nuque' },
            { v: 'deformation', l: 'Déformation du rachis' },
            { v: 'sphincters', l: 'Perte d’urine ou de matières' },
            { v: 'priapisme', l: 'Priapisme', show: (s) => s.sexe !== 'F' },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Pas de signe d’atteinte du rachis';
              return `Signes d’atteinte : ${v.map((k) => optLabel('rc_signes', k).toLowerCase()).join(', ')}`;
            },
          }),
          checks('rc_atcd', 'ATCD à risque', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'age', l: 'Plus de 65 ans' },
            { v: 'trauma', l: 'Trauma vertébral' },
            { v: 'chirurgie', l: 'Chirurgie de la colonne' },
            { v: 'osteoporose', l: 'Ostéoporose' },
          ], {
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Pas d’ATCD à risque';
              return `ATCD à risque : ${v.map((k) => optLabel('rc_atcd', k).toLowerCase()).join(', ')}`;
            },
          }),
          radio('rc_fiabilite', 'Réponses fiables', [
            { v: 'oui', l: 'Oui', out: 'Réponses fiables' },
            { v: 'non', l: 'Non', cls: 'no', out: 'Réponses non fiables' },
          ], { help: 'Non fiables : détresse vitale, conscience altérée, difficultés de communication, alcool ou drogues, atteinte traumatique sévère.' }),
          info(rachisDecision, { report: true }),
          area('rc_autre', 'Autres éléments'),
        ],
        memo: [
          'Après traitement d’une détresse vitale :',
          { ul: [
            'Réponses non fiables ou signe d’atteinte → immobiliser.',
            'ATCD à risque et mécanisme à risque → immobiliser.',
            'Sinon → ne pas immobiliser.',
          ] },
          'Collier cervical : plan dur debout, ACT, roulement sur plan dur, maintien de tête incertain. Desserrer une fois dans le MID, resserrer pour mobiliser.',
        ],
      },
      {
        id: 'plaie',
        spe: 'plaie',
        title: 'Plaie / brûlure',
        heading: (s) => (s.pl_type === 'brulure' ? 'Bilan brûlure :' : s.pl_type === 'morsure' ? 'Bilan morsure :' : 'Bilan plaie :'),
        fields: [
          radio('pl_type', 'Type', [
            { v: 'plaie', l: 'Plaie' },
            { v: 'brulure', l: 'Brûlure' },
            { v: 'morsure', l: 'Morsure' },
          ], { out: silent }),
          text('pl_loc', 'Localisation', { fmt: (v) => `Localisation : ${v}` }),
          text('pl_taille', 'Taille, étendue', { placeholder: '3 cm, 2 paumes…', fmt: (v) => `Étendue : ${v}` }),
          text('pl_cause', 'Cause', { placeholder: 'verre, liquide chaud…', fmt: (v) => `Cause : ${v}` }),
          radio('pl_aspect', 'Plaie', [
            { v: 'contusion', l: 'Contusion' },
            { v: 'dermabrasion', l: 'Dermabrasion' },
            { v: 'ecorchure', l: 'Écorchure' },
            { v: 'coupure', l: 'Coupure' },
            { v: 'punctiforme', l: 'Punctiforme' },
            { v: 'laceration', l: 'Lacération' },
          ], { show: (s) => s.pl_type !== 'brulure', out: (v) => (v ? `Plaie de type ${optLabel('pl_aspect', v).toLowerCase()}` : null) }),
          checks('pl_gravite', 'Signes de gravité', [
            { v: 'aucun', l: 'Aucun', exclusive: true },
            { v: 'hemorragie', l: 'Hémorragie' },
            { v: 'penetrante', l: 'Pénétrante' },
            { v: 'ce', l: 'Corps étranger' },
            { v: 'dechiquetee', l: 'Déchiquetée, écrasée' },
            { v: 'localisation', l: 'Localisation à risque' },
          ], {
            show: (s) => s.pl_type !== 'brulure',
            out: (v) => {
              if (!v || !v.length) return null;
              if (v.includes('aucun')) return 'Plaie simple';
              return `Plaie grave : ${v.map((k) => optLabel('pl_gravite', k).toLowerCase()).join(', ')}`;
            },
          }),
          radio('pl_degre', 'Degré', [
            { v: '1', l: '1er : rouge, sèche', out: 'Brûlure du 1er degré' },
            { v: '2', l: '2e : cloques', out: 'Brûlure du 2e degré (phlyctènes)' },
            { v: '3', l: '3e : cartonnée, peu douloureuse', out: 'Brûlure du 3e degré' },
          ], { vertical: true, show: (s) => s.pl_type === 'brulure' }),
          radio('pl_bru_type', 'Origine', [
            { v: 'thermique', l: 'Thermique', out: 'Brûlure thermique' },
            { v: 'chimique', l: 'Chimique', out: 'Brûlure chimique' },
            { v: 'electrique', l: 'Électrique', out: 'Brûlure électrique' },
            { v: 'radiologique', l: 'Radiologique', out: 'Brûlure radiologique' },
            { v: 'ingestion', l: 'Ingestion', out: 'Brûlure par ingestion' },
          ], { show: (s) => s.pl_type === 'brulure' }),
          tri('pl_circulaire', 'Circulaire', 'Brûlure circulaire', 'Non circulaire', { show: (s) => s.pl_type === 'brulure' }),
          time('pl_heure', 'Heure de la brûlure', { show: (s) => s.pl_type === 'brulure', fmt: (v) => `Brûlure survenue à ${fmtTime(v)}` }),
          text('pl_refroid', 'Refroidissement', { placeholder: 'eau du robinet pendant 15 min', show: (s) => s.pl_type === 'brulure', fmt: (v) => `Refroidissement : ${v}` }),
          info((s) => {
            if (s.pl_type !== 'brulure') return null;
            const grave = s.pl_degre === '3' || s.pl_circulaire === 'oui' || ['electrique', 'radiologique', 'chimique'].includes(s.pl_bru_type);
            if (!grave) return { text: 'Brûlure grave si : cloques ≥ ½ paume de la victime, circulaire, électrique / chimique / radiologique, 3e degré, localisation à risque, 1er degré étendu chez l’enfant.', level: 'info' };
            return { text: 'Brûlure grave : arrosage 10 min minimum (idéalement 20), pansement stérile ou film alimentaire, couverture isotherme.', level: 'alert' };
          }),
          radio('pl_saignement', 'Saignement', [
            { v: 'aucun', l: 'Aucun', out: 'Pas de saignement' },
            { v: 'arrete', l: 'Arrêté', out: 'Saignement arrêté' },
            { v: 'actif', l: 'Actif', out: 'Saignement actif' },
          ], { show: (s) => s.pl_type !== 'brulure' }),
          tri('pl_souillee', 'Plaie souillée', 'Plaie souillée', 'Plaie propre', { show: (s) => s.pl_type !== 'brulure' }),
          radio('pl_tetanos', 'Vaccin antitétanique', [
            { v: 'ajour', l: 'À jour', out: 'Vaccin antitétanique à jour' },
            { v: 'non', l: 'Pas à jour', out: 'Vaccin antitétanique pas à jour' },
            { v: 'nsp', l: 'Ne sait pas', out: 'Statut vaccinal antitétanique inconnu' },
          ]),
          area('pl_autre', 'Autres éléments'),
        ],
        memo: [
          { h: 'Plaie' }, 'Profondeur, lésion, agent causal, infection, étendue, souillures. Grave : hémorragie, pénétrante, morsure, corps étranger, lacération, déchiquetée ou écrasée, localisation.',
          'Plaie grave : position adaptée (détresse circulatoire : allongée ; thorax : assise ; abdomen : allongée jambes fléchies), pansement stérile humidifié.',
          'Plaie simple : nettoyage + pansement. Consulter si vaccin tétanos pas à jour, ou plaie chaude, rouge, qui suinte, gonfle ou fait mal dans les 24 h.',
          { h: 'Brûlure' }, 'Refroidir le plus tôt possible (brûlure de moins de 30 min, victime consciente sans détresse circulatoire, ≤ 20 % chez l’adulte, ≤ 10 % chez l’enfant), à l’eau de 15 à 25 °C. Retirer les vêtements non adhérents, ne pas percer les cloques.',
          'Chimique : retirer les vêtements imbibés, laver à grande eau plus de 20 min. Ingestion : allongée sur le côté, ne pas boire ni faire vomir.',
          { h: 'Traumatisme dentaire' }, 'Faire mordre une compresse humide, rincer la dent au sérum physiologique, l’envelopper dans du film alimentaire (à défaut lait ou salive).',
        ],
      },
      {
        id: 'intox',
        spe: 'intox',
        title: 'Intoxication',
        fields: [
          checks('ix_voie', 'Voie', [
            { v: 'ingestion', l: 'Ingestion' },
            { v: 'inhalation', l: 'Inhalation' },
            { v: 'injection', l: 'Injection' },
            { v: 'projection', l: 'Projection (peau, yeux)' },
          ], { fmt: (labels) => `Intoxication par ${labels.join(', ').toLowerCase()}` }),
          text('ix_produit', 'Produit(s)', { placeholder: 'paracétamol, alcool, CO…', fmt: (v) => `Produit : ${v}` }),
          text('ix_dose', 'Dose supposée ingérée', { placeholder: '10 comprimés de 1 g, 1 bouteille de vodka', fmt: (v) => `Dose supposée : ${v}` }),
          text('ix_heure', 'Heure(s) de prise', { placeholder: 'vers 22h', now: 'append', fmt: (v) => `Prise : ${v}` }),
          radio('ix_contexte', 'Contexte', [
            { v: 'volontaire', l: 'Volontaire', out: 'Intoxication volontaire' },
            { v: 'accidentelle', l: 'Accidentelle', out: 'Intoxication accidentelle' },
            { v: 'festive', l: 'Récréative', out: 'Consommation récréative' },
            { v: 'inconnu', l: 'Inconnu', out: 'Contexte inconnu' },
          ]),
          checks('ix_indices', 'Indices retrouvés', [
            { v: 'flacons', l: 'Flacons, emballages vides' },
            { v: 'lettre', l: 'Lettre d’adieu' },
            { v: 'timbres', l: 'Timbres médicamenteux' },
            { v: 'piqures', l: 'Traces de piqûres' },
            { v: 'plantes', l: 'Plantes, champignons' },
          ], { fmt: (labels) => `Retrouvé : ${labels.join(', ').toLowerCase()}` }),
          radio('ix_habitude', 'Consommation', [
            { v: 'habituelle', l: 'Habituelle', out: 'Consommation habituelle' },
            { v: 'occasionnelle', l: 'Occasionnelle', out: 'Consommation occasionnelle' },
            { v: 'premiere', l: 'Première fois', out: 'Première consommation' },
          ]),
          checks('ix_comportement', 'Comportement', [
            { v: 'agitee', l: 'Agitée', out: 'agitée' },
            { v: 'confuse', l: 'Confuse', out: 'confuse' },
            { v: 'somnolente', l: 'Somnolente', out: 'somnolente' },
            { v: 'hallucinations', l: 'Hallucinations', out: 'hallucinée' },
            { v: 'incoherente', l: 'Propos incohérents', out: 'incohérente' },
            { v: 'euphorique', l: 'Euphorique', out: 'euphorique' },
            { v: 'anxieuse', l: 'Anxieuse', out: 'anxieuse' },
            { v: 'crispation', l: 'Crispation mâchoire / doigts', out: 'crispée (mâchoire, doigts)' },
          ], { out: (v) => (v && v.length ? `Victime ${joinEt(v.map((k) => optOut('ix_comportement', k)))}` : null) }),
          info(opiaces),
          area('ix_autre', 'Autres éléments'),
        ],
        memo: [
          'Danger persistant : gaz, CO, produit chimique, fumées…',
          'Contexte : volontaire ou accidentel, flacons suspects, lettre d’adieu, plantes. Dose supposée ingérée (fouiller : comprimés manquants, bouteilles vides, poubelle, toilettes) + heure.',
          'Timbres médicamenteux (creux axillaire, périnée, scrotum) et traces de piqûres. Température et glycémie rapidement.',
          { h: 'Opioïdes' }, 'Naloxone possible si plus de 14 ans et (FR < 12 ou inconscient). Ventilation artificielle si FR < 6.',
        ],
      },
      {
        id: 'grossesse',
        spe: 'grossesse',
        title: 'Grossesse / accouchement',
        fields: [
          text('gr_terme', 'Terme', { placeholder: '38 SA', fmt: (v) => `Terme : ${v}` }),
          { type: 'number', name: 'gr_gestite', label: 'Gestité (nb de grossesses)', fmt: (v) => `Gestité ${v}` },
          { type: 'number', name: 'gr_parite', label: 'Parité (nb d’enfants)', fmt: (v) => `Parité ${v}` },
          tri('gr_multiple', 'Grossesse multiple', 'Grossesse multiple', 'Grossesse unique'),
          text('gr_complications', 'Complications de la grossesse', { none: 'Aucune', fmt: (v) => `Complications : ${v}`, noneOut: 'Grossesse non compliquée' }),
          text('gr_prec', 'Grossesses précédentes', { placeholder: 'césarienne, prématuré, fausse couche…', fmt: (v) => `Grossesses précédentes : ${v}` }),
          text('gr_presentation', 'Présentation du bébé', { fmt: (v) => `Présentation : ${v}` }),
          text('gr_maternite', 'Maternité prévue', { fmt: (v) => `Maternité : ${v}` }),
          { type: 'subtitle', label: 'Travail' },
          text('gr_debut', 'Début des contractions', { placeholder: 'vers 2h', fmt: (v) => `Contractions depuis ${v}` }),
          tri('gr_eaux', 'Perte des eaux', 'Perte des eaux', 'Pas de perte des eaux'),
          text('gr_eaux_detail', 'Heure, couleur du liquide', { placeholder: '3h, clair', show: (s) => s.gr_eaux === 'oui', fmt: (v) => `Liquide : ${v}` }),
          tri('gr_saignement', 'Saignement (métrorragies)', 'Métrorragies', 'Pas de métrorragie'),
          text('gr_saignement_qte', 'Quantité, caillots', { placeholder: '1 serviette, pas de caillot', show: (s) => s.gr_saignement === 'oui', fmt: (v) => `Saignement : ${v}` }),
          tri('gr_bouge', 'Sent le bébé bouger', 'Sent le bébé bouger', 'Ne sent pas le bébé bouger'),
          tri('gr_pousser', 'Envie de pousser, sent le bébé descendre', 'Envie de pousser', 'Pas d’envie de pousser', {
            warn: (s) => (s.gr_pousser === 'oui' ? { text: 'Le bébé descend : accouchement sur place.', level: 'alert' } : null),
          }),
          tri('gr_assise', 'Impossible de s’asseoir', 'Impossibilité de s’asseoir', 'Peut s’asseoir'),
          tri('gr_tete', 'Tête visible', 'Tête visible', 'Tête non visible', {
            warn: (s) => (s.gr_tete === 'oui' ? { text: 'Tête visible : accouchement sur place.', level: 'alert' } : null),
          }),
          text('gr_ddr', 'Date des dernières règles', { fmt: (v) => `Dernières règles : ${v}` }),
          info((s) => {
            const sys = [taParts(s.ta_d), taParts(s.ta_g)].filter(Boolean);
            if (!sys.some(([a, b]) => a >= 140 || b >= 90)) return null;
            return { text: 'TA ≥ 14/9 : rechercher une éclampsie (troubles de la vision, du comportement, convulsions). PLS + O2 + contact urgent.', level: 'alert' };
          }),
          { type: 'subtitle', label: 'Score de Malinas' },
          score012('mal_parite', 'Parité', '1', '2', '3 et +'),
          score012('mal_travail', 'Durée du travail', '< 3 h', '3 à 5 h', '> 5 h'),
          score012('mal_duree', 'Durée des contractions', '< 1 min', '1 min', '> 1 min'),
          score012('mal_intervalle', 'Intervalle des contractions', '> 5 min', '3 à 5 min', '< 3 min'),
          score012('mal_eaux', 'Perte des eaux', 'Non', 'Récente', '> 1 h'),
          info((s) => {
            const m = malinas(s);
            if (m === null) return null;
            return { text: `Score de Malinas : ${m}/10${m < 5 ? ' (transport en général possible)' : ' (accouchement proche)'}`, level: m < 5 ? 'ok' : 'alert' };
          }, { report: true }),
          { type: 'subtitle', label: 'Nouveau-né' },
          tri('gr_accouche', 'Accouchement réalisé', 'Accouchement réalisé', 'Pas encore accouché', { out: silent }),
          time('gr_naissance', 'Heure de naissance', { show: (s) => s.gr_accouche === 'oui', fmt: (v) => `Naissance à ${fmtTime(v)}` }),
          score012('apgar_fc', 'Fréquence cardiaque', 'Absente', '< 100', '> 100'),
          score012('apgar_resp', 'Respiration', 'Absente', 'Lente', 'Cri vigoureux'),
          score012('apgar_tonus', 'Tonus', 'Faible', 'Flexion', 'Actif'),
          score012('apgar_reac', 'Réactivité', 'Nulle', 'Grimace', 'Vive'),
          score012('apgar_coul', 'Coloration', 'Cyanose globale', 'Extrémités bleues', 'Rose'),
          info((s) => {
            const a = apgar(s);
            return a === null ? null : { text: `Score d’APGAR : ${a}/10`, level: a >= 7 ? 'ok' : 'alert' };
          }, { report: true }),
          area('gr_autre', 'Autres éléments'),
        ],
        memo: [
          'À transmettre au minimum : terme, grossesse compliquée ?, risque infectieux (T° > 38 °C), liquide méconial ?, métrorragies ?',
          'Si la tête est visible ou que la parturiente sent le bébé descendre : accouchement sur place. Transport en général si Malinas < 5.',
          { h: 'Pathologies' },
          { ul: [
            'Grossesse extra-utérine (1er trimestre) : douleur du bas-ventre, malaise. Sur le dos jambes fléchies, contact urgent.',
            'Métrorragies : 1er trimestre ≈ fausse couche ; 2e / 3e trimestre : contact urgent si abondant.',
            'Éclampsie (3e trimestre) : HTA > 14/9, troubles de la vision ou du comportement, convulsions. PLS + O2 + contact urgent.',
          ] },
          'Gestité = nombre de grossesses ; parité = nombre d’enfants. SA = 2 + semaines de grossesse. 41 SA = terme normal ; prématurité avant 37 SA.',
        ],
      },
      {
        id: 'temperature_spe',
        spe: 'temperature',
        title: 'Hyperthermie / hypothermie',
        fields: [
          radio('tp_type', 'Type', [
            { v: 'hyper', l: 'Hyperthermie', out: 'Hyperthermie' },
            { v: 'hypo', l: 'Hypothermie', out: 'Hypothermie' },
          ]),
          text('tp_contexte', 'Contexte', { placeholder: 'course de 2 h en plein soleil', fmt: (v) => `Contexte : ${v}` }),
          checks('tp_peau', 'Peau', [
            { v: 'chaude', l: 'Chaude' }, { v: 'froide', l: 'Froide' }, { v: 'rouge', l: 'Rouge' },
            { v: 'pale', l: 'Pâle' }, { v: 'sueurs', l: 'Sueurs' }, { v: 'seche', l: 'Sèche' },
          ], { fmt: (labels) => `Peau ${labels.join(', ').toLowerCase()}` }),
          checks('tp_signes', 'Signes', [
            { v: 'nausees', l: 'Nausées, vomissements' },
            { v: 'cephalees', l: 'Céphalées' },
            { v: 'comportement', l: 'Troubles du comportement' },
            { v: 'crampes', l: 'Crampes, hypertonie' },
            { v: 'frissons', l: 'Frissons' },
            { v: 'rigidite', l: 'Rigidité' },
          ], { fmt: (labels) => `Signes : ${labels.join(', ').toLowerCase()}` }),
          info((s) => tempWarn(s) || { text: 'Prendre la température (régulièrement).', level: 'info' }),
          area('tp_autre', 'Autres éléments'),
        ],
        memo: [
          { h: 'Hyperthermie' },
          '> 40 °C (coup de chaleur, hyperthermie maligne d’effort) : avis médical urgent, refroidir activement en sous-vêtements (bain d’eau froide, glace aux troncs vasculaires, ventilation), objectif < 39,4 °C.',
          '< 40 °C (insolation, épuisement) : refroidir (pulvérisation d’eau, glace, ventilation), réhydrater.',
          { h: 'Hypothermie' },
          'Allonger, mobiliser avec extrême précaution (risque d’ACR), O2, réchauffer (sécher, vêtements chauds, couverture). T° < 30 °C : 3 chocs DSA maximum. Évaluer respiration et circulation plus d’1 min avant une RCP.',
        ],
      },
      {
        id: 'autre_spe',
        spe: 'autre',
        title: 'Autre',
        fields: [area('au_obs', 'Observations')],
      },

      {
        id: 'opqrst',
        title: 'Plainte : OPQRST',
        fields: [
          text('o_debut', 'O · Apparition', { placeholder: 'brutale, au repos', fmt: (v) => `Apparition : ${v}` }),
          text('p_provoque', 'P · Provoquée / calmée par', { placeholder: 'augmente à l’effort, calmée au repos', fmt: (v) => `Provoquée / calmée par : ${v}` }),
          radio('q_type', 'Q · Qualité', DOULEUR_TYPES),
          text('r_region', 'R · Région, irradiation', { placeholder: 'rétrosternale, irradie dans le bras gauche', fmt: (v) => `Localisation : ${v}` }),
          eva('s_eva', 'S · Sévérité', (v) => `Douleur évaluée à ${v}/10`),
          text('t_temps', 'T · Temps', { placeholder: 'depuis 1h, continue, première fois', fmt: (v) => `Depuis : ${v}` }),
          area('plaintes_autres', 'Autres plaintes'),
        ],
      },
      {
        id: 'symptomes',
        title: 'Signes associés',
        show: (s) => !has(s, 'spe', 'tc'),
        fields: [{ type: 'symptoms' }],
      },
      // ---------------------------------------------------- Paramètres
      {
        id: 'parametres',
        title: 'Glycémie / température',
        fields: [
          {
            type: 'number', name: 'gly', label: 'Glycémie', step: '0.01',
            out: (v, s) => (isEmptyV(v) ? null : `Glycémie ${String(v).replace('.', ',')} ${s.gly_unite || 'g/L'}`),
            warn: (s) => (glyBasse(s) ? { text: 'Hypoglycémie : 4 morceaux de sucre si la victime peut avaler (2 à 3 chez l’enfant), recontrôler après 15 min.', level: 'alert' } : null),
          },
          radio('gly_unite', 'Unité', [{ v: 'g/L', l: 'g/L' }, { v: 'mmol/L', l: 'mmol/L' }, { v: 'mg/dL', l: 'mg/dL' }], { out: silent }),
          tri('diabete', 'Diabétique', 'Diabétique', 'Non diabétique', {
            out: (v, s) => (v === 'oui' ? `Diabétique${s.insuline === 'oui' ? ' insulino-dépendant' : s.insuline === 'non' ? ' non insulino-dépendant' : ''}` : v === 'non' ? 'Non diabétique' : null),
          }),
          tri('insuline', 'Insulino-dépendant', null, null, { show: (s) => s.diabete === 'oui', out: silent }),
          {
            type: 'number', name: 'temp', label: 'Température', suffix: '°C', step: '0.1',
            out: (v, s) => (isEmptyV(v) ? null : `Température ${String(v).replace('.', ',')} °C${s.temp_site ? ` (${optOut('temp_site', s.temp_site)})` : ''}`),
            warn: tempWarn,
          },
          radio('temp_site', 'Prise', [
            { v: 'tympanique', l: 'Tympanique', out: 'tympanique' },
            { v: 'axillaire', l: 'Axillaire', out: 'axillaire' },
            { v: 'buccale', l: 'Buccale', out: 'buccale' },
            { v: 'frontale', l: 'Frontale', out: 'frontale' },
          ], { out: silent }),
        ],
        memo: MEMO.glycemie,
      },
      {
        id: 'mhta',
        title: 'Antécédents : M · H · T · A',
        hint: 'Comme dans eFiBi : maladies, hospitalisations, traitements, allergies.',
        fields: [
          area('atcd', 'M · Maladies', { none: 'Aucune', fmt: (v) => `ATCD : ${v}`, noneOut: 'Pas d’ATCD' }),
          area('hospit', 'H · Hospitalisations, opérations', { none: 'Aucune', fmt: (v) => `Hospitalisations : ${v}`, noneOut: 'Pas d’hospitalisation' }),
          area('traitements', 'T · Traitements', { none: 'Aucun', fmt: (v) => `Traitement : ${v}`, noneOut: 'Pas de traitement' }),
          tri('ordonnance', 'Ordonnance disponible', 'Ordonnance disponible', 'Pas d’ordonnance'),
          area('allergies', 'A · Allergies', { none: 'Aucune', fmt: (v) => `Allergies : ${v}`, noneOut: 'Pas d’allergie connue' }),
          { type: 'subtitle', label: 'Autres' },
          text('dernier_repas', 'Dernier repas', {
            placeholder: 'à 13h, il y a 2h, ce midi…',
            // « 13h » ou « 13:00 » → « Dernier repas à 13h » ; sinon le texte tel quel.
            fmt: (v) => (/^\d/.test(v) ? `Dernier repas à ${fmtTime(v)}` : `Dernier repas ${v}`),
          }),
          area('evenements', 'Événements ayant conduit à la situation', { fmt: (v) => `Événements : ${v}` }),
        ],
      },
    ],
  },

  // ------------------------------------------------------- Gestes, devenir
  {
    id: 'gestes',
    title: 'Gestes et devenir',
    groups: [
      {
        id: 'position',
        title: 'Position d’attente',
        fields: [
          radio('position', '', [
            { v: 'pls', l: 'PLS', out: 'PLS' },
            { v: 'allongee', l: 'Allongée', out: 'Position allongée' },
            { v: 'jambes_flechies', l: 'Allongée jambes fléchies', out: 'Position allongée jambes fléchies' },
            { v: 'jambes_relevees', l: 'Allongée jambes relevées', out: 'Position allongée jambes relevées' },
            { v: 'demi_assise', l: 'Demi-assise', out: 'Position demi-assise' },
            { v: 'assise', l: 'Assise', out: 'Position assise' },
            { v: 'jambes_pendantes', l: 'Assise jambes pendantes', out: 'Position assise jambes pendantes' },
            { v: 'penchee', l: 'Assise penchée en avant', out: 'Position assise penchée en avant' },
            { v: 'confort', l: 'Position de confort', out: 'Position de confort' },
          ], { cols2: true, out: silent }),
        ],
        memo: MEMO.position,
      },
      {
        id: 'gestes',
        title: 'Gestes effectués',
        hint: 'Les gestes notés aux étapes X, A, B et C sont repris automatiquement.',
        fields: [
          checks('gestes', '', [
            { v: 'protection', l: 'Protection thermique' },
            { v: 'rechauffement', l: 'Réchauffement' },
            { v: 'refroidissement', l: 'Refroidissement (hyperthermie)' },
            { v: 'refroid_brulure', l: 'Refroidissement de la brûlure' },
            { v: 'nettoyage', l: 'Nettoyage, désinfection' },
            { v: 'pansement', l: 'Pansement' },
            { v: 'froid', l: 'Poche de froid' },
            { v: 'echarpe', l: 'Écharpe' },
            { v: 'attelle', l: 'Attelle', out: (s) => (s.attelle_detail ? `Attelle ${s.attelle_detail}` : 'Attelle') },
            { v: 'realignement', l: 'Réalignement' },
            { v: 'collier', l: 'Collier cervical' },
            { v: 'act', l: 'ACT' },
            { v: 'mid', l: 'Matelas immobilisateur (MID)' },
            { v: 'plan_dur', l: 'Plan dur' },
            { v: 'pelvienne', l: 'Contention pelvienne' },
            { v: 'sucre', l: 'Resucrage', out: (s) => (num(s.sucre_nb) ? `Resucrage (${num(s.sucre_nb)} morceaux de sucre)` : 'Resucrage') },
            { v: 'medicament', l: 'Aide à la prise de médicament', out: (s) => (s.medic_detail ? `Aide à la prise de médicament : ${s.medic_detail}` : 'Aide à la prise de médicament') },
            { v: 'hydratation', l: 'Hydratation' },
            { v: 'surveillance', l: 'Surveillance' },
          ], { big: true, out: silent }),
          text('attelle_detail', 'Attelle de', { placeholder: 'membre inférieur gauche', show: (s) => has(s, 'gestes', 'attelle'), out: silent }),
          { type: 'number', name: 'sucre_nb', label: 'Morceaux de sucre', show: (s) => has(s, 'gestes', 'sucre'), out: silent },
          text('medic_detail', 'Médicament (nom, dose, heure)', { placeholder: 'Natispray 1 bouffée à 14h10', show: (s) => has(s, 'gestes', 'medicament'), out: silent }),
          area('gestes_autre', 'Autres gestes', { out: silent }),
        ],
      },
      {
        id: 'transmission',
        title: 'Transmission du bilan',
        fields: [
          checks('transmis', 'Bilan transmis', [
            { v: 'chef', l: 'Au chef (chef d’agrès, chef d’équipe)', out: 'au chef' },
            { v: 'cm', l: 'CM (coordination médicale)', out: 'à la CM' },
            { v: '18', l: '18 (BSPP)', out: 'au 18' },
            { v: '15', l: '15 (SAMU)', out: 'au 15' },
            { v: '17', l: '17 (Police)', out: 'au 17' },
          ], {
            out: (v, s) => {
              const to = (v || []).map((k) => optOut('transmis', k));
              if (!to.length && !s.heure_transmis) return null;
              return `Bilan transmis${to.length ? ` ${joinEt(to)}` : ''}${s.heure_transmis ? ` à ${fmtTime(s.heure_transmis)}` : ''}${s.contact_urgent === 'oui' ? ' (contact urgent)' : ''}`;
            },
          }),
          time('heure_transmis', 'À', { out: silent }),
          tri('contact_urgent', 'Contact urgent', null, null, { out: silent }),
          area('consignes', 'Avis, consignes reçus', { placeholder: 'évacuation vers les urgences de…', fmt: (v) => `Consignes : ${v}` }),
        ],
      },
      {
        id: 'devenir',
        title: 'Devenir',
        fields: [
          radio('devenir', '', [
            { v: 'evac', l: 'Évacuation' },
            { v: 'lsp', l: 'Laissée sur place (LSP)' },
            { v: 'refus', l: 'Refus (décharge)' },
            { v: 'medic', l: 'Prise en charge médicale sur place', out: 'Prise en charge médicale sur place' },
            { v: 'fdo', l: 'Remise aux forces de l’ordre', out: 'Remise aux forces de l’ordre' },
            { v: 'dcd', l: 'Décédée (DCD)', out: 'Décès constaté' },
          ], {
            vertical: true,
            out: (v, s) => {
              if (v === 'evac') {
                const par = optOut('evac_par', s.evac_par);
                return `Évacuation${par ? ` ${par}` : ''}${s.evac_dest ? ` vers ${s.evac_dest}` : ''}`;
              }
              if (v === 'lsp') return `Laissée sur place${s.lsp_consignes ? ` : ${s.lsp_consignes}` : ''}`;
              if (v === 'refus') {
                const t = optOut('refus_type', s.refus_type) || 'Refus';
                const h = s.refus_heure ? ` à ${fmtTime(s.refus_heure)}` : '';
                return `${t}${h}${s.decharge === 'oui' ? ', décharge signée' : s.decharge === 'non' ? ', décharge non signée' : ''}`;
              }
              return optOut('devenir', v);
            },
          }),
          text('evac_dest', 'Vers', { placeholder: 'urgences de l’hôpital…', show: (s) => s.devenir === 'evac', out: silent }),
          radio('evac_par', 'Par', [
            { v: 'nous', l: 'Notre équipe', out: 'par notre équipe' },
            { v: 'vsav', l: 'VSAV', out: 'par VSAV' },
            { v: 'ar', l: 'AR / SMUR', out: 'médicalisée (AR / SMUR)' },
            { v: 'privee', l: 'Ambulance privée', out: 'par ambulance privée' },
          ], { show: (s) => s.devenir === 'evac', out: silent }),
          text('iao', 'IAO / service', { show: (s) => s.devenir === 'evac', fmt: (v) => `Prise en charge IAO : ${v}` }),
          text('lsp_consignes', 'Consignes données, confiée à', { show: (s) => s.devenir === 'lsp', out: silent }),
          radio('refus_type', 'Refus de', [
            { v: 'pec', l: 'Prise en charge', out: 'Refus de prise en charge' },
            { v: 'transport', l: 'Transport', out: 'Refus de transport' },
          ], { show: (s) => s.devenir === 'refus', out: silent }),
          time('refus_heure', 'Heure du refus', { show: (s) => s.devenir === 'refus', out: silent }),
          tri('decharge', 'Décharge signée (victime + 2 témoins)', null, null, { show: (s) => s.devenir === 'refus', out: silent }),
          text('materiel', 'Matériel à récupérer', { fmt: (v) => `Matériel à récupérer : ${v}` }),
        ],
      },
      {
        id: 'horaires',
        title: 'Horaires',
        fields: [
          time('heure_renforts', 'Arrivée des renforts', { fmt: (v) => `Arrivée des renforts : ${fmtTime(v)}` }),
          time('heure_medic', 'Médicalisation', { fmt: (v) => `Médicalisation : ${fmtTime(v)}` }),
          time('heure_evac', 'Départ des lieux', { fmt: (v) => `Départ des lieux : ${fmtTime(v)}` }),
          time('heure_hopital', 'Arrivée à l’hôpital', { fmt: (v) => `Arrivée à l’hôpital : ${fmtTime(v)}` }),
          time('heure_fin', 'Fin d’intervention', { fmt: (v) => `Fin d’intervention : ${fmtTime(v)}` }),
        ],
      },
    ],
  },

  // ------------------------------------------------------- Surveillance
  {
    id: 'surveillance',
    title: 'Surveillance',
    groups: [
      {
        id: 'surveillance',
        title: 'Surveillance',
        hint: 'Ajoutez une série de constantes à chaque contrôle : elle est datée à l’heure du moment.',
        fields: [{ type: 'surveillance', name: 'surv' }],
      },
    ],
  },

  // ------------------------------------------------------- Identité
  {
    id: 'identite',
    title: 'Identité',
    groups: [
      {
        id: 'identite',
        title: 'Identité de la victime',
        fields: [
          text('nom', 'Nom', { autocap: 'characters' }),
          text('prenom', 'Prénom', { autocap: 'words' }),
          text('nom_naissance', 'Nom de naissance', { autocap: 'characters', show: isF }),
          { type: 'date', name: 'ddn', label: 'Date de naissance' },
          text('lieu_naissance', 'Lieu de naissance', { autocap: 'words' }),
          area('adresse', 'Adresse'),
          text('cp', 'Code postal', { inputmode: 'numeric' }),
          text('ville', 'Ville', { autocap: 'words' }),
          text('tel', 'Téléphone', { inputmode: 'tel' }),
          text('prevenir', 'Personne à prévenir', { placeholder: 'sa fille, Marie' }),
          text('tel_prevenir', 'Téléphone à prévenir', { inputmode: 'tel' }),
        ],
      },
    ],
  },
];

// Champs d'une série de constantes de surveillance (ordre B · C · D).
export const SURV_FIELDS = [
  { k: 'fr', l: 'FR', suffix: '/min', mode: 'numeric' },
  { k: 'sat', l: 'SpO2', suffix: '%', mode: 'numeric' },
  { k: 'fc', l: 'FC', suffix: '/min', mode: 'numeric' },
  { k: 'ta', l: 'TA', placeholder: '120/80', mode: 'numeric', ta: true },
  { k: 'gcs', l: 'Glasgow', mode: 'numeric' },
  { k: 'eva', l: 'Douleur', suffix: '/10', mode: 'numeric' },
  { k: 'temp', l: 'Temp.', suffix: '°C', mode: 'decimal' },
  { k: 'gly', l: 'Glycémie', mode: 'decimal' },
];
export const SURV_EVOLUTION = [
  { v: 'mieux', l: 'Amélioration', out: 'amélioration' },
  { v: 'stable', l: 'Inchangée', out: 'état inchangé' },
  { v: 'pire', l: 'Aggravation', out: 'aggravation' },
];

// Champs « signes associés », insérés là où un groupe contient { type: 'symptoms' }.
export const SYMPTOMS = [
  tri('nausees', 'Nausées', 'Présence de nausées', 'Pas de nausées'),
  tri('vomissements', 'Vomissements', 'Vomissements', 'Pas de vomissements', {
    out: (v, s) => {
      if (v === 'non') return 'Pas de vomissements';
      if (v !== 'oui') return null;
      const n = Number(s.vomissements_nb);
      return n ? `${n} épisode${n > 1 ? 's' : ''} de vomissement` : 'Vomissements';
    },
  }),
  { type: 'number', name: 'vomissements_nb', label: 'Nombre d’épisodes', show: (s) => s.vomissements === 'oui', out: silent },
  tri('cephalees', 'Céphalées', 'Céphalées', 'Pas de céphalées', {
    out: (v, s) => {
      if (v === 'non') return 'Pas de céphalées';
      if (v !== 'oui') return null;
      let line = 'Céphalées';
      if (s.cephalees_eva !== undefined && s.cephalees_eva !== '') line += ` évaluées à ${s.cephalees_eva}/10`;
      if (s.cephalees_depuis) line += ` depuis ${s.cephalees_depuis}`;
      const t = DOULEUR_TYPES.find((o) => o.v === s.cephalees_type);
      if (t) line += `, ${t.out.charAt(0).toLowerCase()}${t.out.slice(1)}`;
      return line;
    },
  }),
  eva('cephalees_eva', 'Intensité des céphalées', silent, { show: (s) => s.cephalees === 'oui' }),
  text('cephalees_depuis', 'Céphalées depuis', { show: (s) => s.cephalees === 'oui', placeholder: '1h', out: silent }),
  { type: 'radio', name: 'cephalees_type', label: 'Type', options: DOULEUR_TYPES, show: (s) => s.cephalees === 'oui', out: silent },
  tri('vertiges', 'Vertiges', 'Vertiges', 'Pas de vertiges'),
  tri('vision', 'Vision trouble', 'Vision trouble', 'Pas de trouble de la vision'),
  area('autres_signes', 'Autres signes', { placeholder: 'fourmillements, palpitations…' }),
];

// ---------------------------------------------------------------------------
// Utilitaires d'accès au schéma
// ---------------------------------------------------------------------------
function isEmptyV(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function gcsSum(s) {
  const y = Number(s.gcs_y), v = Number(s.gcs_v), m = Number(s.gcs_m);
  return y && v && m ? y + v + m : null;
}

function avcWarn(s) {
  const m = minutesSince(s.avc_heure);
  if (m === null) return null;
  return { text: `Premiers signes il y a ${fmtDuree(m)} (4 h pour agir).`, level: m >= 240 ? 'warn' : 'alert' };
}

const FIELD_INDEX = new Map();
function indexFields(fields) {
  for (const f of fields) if (f.name && !FIELD_INDEX.has(f.name)) FIELD_INDEX.set(f.name, f);
}
for (const tab of TABS) for (const g of tab.groups) indexFields(g.fields);
indexFields(SYMPTOMS);

export const getField = (name) => FIELD_INDEX.get(name);

export function optOut(fieldName, v) {
  const o = getField(fieldName)?.options?.find((x) => x.v === v);
  return o ? (o.out ?? o.l) : null;
}

export function optLabel(fieldName, v) {
  return getField(fieldName)?.options?.find((x) => x.v === v)?.l ?? v;
}

export function triOut(fieldName, v) {
  const f = getField(fieldName);
  if (!f) return null;
  return v === 'oui' ? f.yes : v === 'non' ? f.no : null;
}

export function joinEt(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`;
}
