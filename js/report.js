import {
  TABS, SYMPTOMS, SIGNES_DETRESSE, SPE, SURV_EVOLUTION, has, hasSome, fmtTime, joinEt, optOut, getField, num, taParts,
} from './schema.js';

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const toLines = (x) => (Array.isArray(x) ? x.filter((l) => !isEmpty(l)) : isEmpty(x) ? [] : [x]);
const NONE_RE = /^\s*aucun/i;

export function expandFields(fields) {
  return fields.flatMap((f) => (f.type === 'symptoms' ? SYMPTOMS : [f]));
}

export function isVisible(item, s) {
  return !item.show || !!item.show(s);
}

// Résultat d'un `warn` ou d'un champ `info` : { text, level } ou null.
export function infoValue(r) {
  if (!r) return null;
  return typeof r === 'string' ? { text: r, level: 'warn' } : r;
}

export function gcsTotal(s) {
  const y = Number(s.gcs_y), v = Number(s.gcs_v), m = Number(s.gcs_m);
  return y && v && m ? y + v + m : null;
}

export function computeAge(ddn, ref = new Date()) {
  if (!ddn) return '';
  const [y, m, d] = ddn.split('-').map(Number);
  if (!y || !m || !d) return '';
  let age = ref.getFullYear() - y;
  if (ref.getMonth() + 1 < m || (ref.getMonth() + 1 === m && ref.getDate() < d)) age--;
  return age >= 0 && age < 150 ? age : '';
}

const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function fieldLines(f, s) {
  if (!f || !isVisible(f, s)) return [];
  if (f.type === 'info') {
    // Les simples rappels (niveau « info ») ne vont pas dans le bilan.
    const r = f.report ? infoValue(f.calc(s)) : null;
    return r && r.level !== 'info' ? [r.text] : [];
  }
  if (!f.name) return [];
  const v = s[f.name];
  if (f.out) return toLines(f.out(v, s));

  switch (f.type) {
    case 'gcs': {
      const t = gcsTotal(s);
      if (!t) return [];
      return [t === 15 ? 'Glasgow 15' : `Glasgow ${t} (Y${s.gcs_y} V${s.gcs_v} M${s.gcs_m})`];
    }
    case 'tri':
      return toLines(v === 'oui' ? f.yes : v === 'non' ? f.no : null);
    case 'radio':
    case 'select': {
      const o = f.options.find((x) => x.v === v);
      return toLines(o?.out);
    }
    case 'checks': {
      if (isEmpty(v)) return [];
      const labels = v.map((k) => f.options.find((o) => o.v === k)?.l ?? k);
      return toLines(f.fmt ? f.fmt(labels) : labels.join(', '));
    }
    case 'eva':
      return isEmpty(v) ? [] : toLines(f.fmt(v));
    case 'time':
      return isEmpty(v) ? [] : toLines(f.fmt ? f.fmt(v) : fmtTime(v));
    default: {
      if (isEmpty(v)) return [];
      const str = String(v).trim();
      if (!str) return [];
      if (f.noneOut && NONE_RE.test(str)) return [f.noneOut];
      if (f.fmt) return toLines(f.fmt(str));
      return str.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    }
  }
}

function groupLines(g, s) {
  let lines = expandFields(g.fields).flatMap((f) => fieldLines(f, s));
  if (g.out) lines = toLines(g.out(s, lines));
  if (lines.length && g.heading) lines.unshift(g.heading(s));
  return lines;
}

const allGroups = () => TABS.flatMap((t) => t.groups);
const group = (id) => allGroups().find((g) => g.id === id);
const fieldsLines = (names, s) => names.flatMap((n) => fieldLines(getField(n), s));

// « se plaint de » + complément : « d’une douleur », « du ventre », « des jambes ».
export function plainteDe(str) {
  const t = String(str || '').trim().replace(/^d(e|’|')\s*/i, '');
  if (!t) return '';
  if (/^le\s/i.test(t)) return `du ${t.slice(3)}`;
  if (/^les\s/i.test(t)) return `des ${t.slice(4)}`;
  return /^[aeiouyhàâéèêëîïôöùûü]/i.test(t) ? `d’${t}` : `de ${t}`;
}

// Minuscule en tête, sauf sigle (« FC », « SpO2 », « PLS »).
const lowerFirst = (t) => (/^[A-ZÀ-Ý][a-zà-ÿ’' ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

const sentence = (str) => {
  const t = String(str).trim();
  if (!t) return '';
  return /[.!?…:]$/.test(t) ? t : `${t}.`;
};

// ---------------------------------------------------------------------------
// Sections du bilan
// ---------------------------------------------------------------------------
// Lignes d'identité [libellé, valeur], chacune copiable.
export function identiteRows(s) {
  const age = s.age !== undefined && s.age !== '' ? `${s.age} ans` : '';
  return [
    ['Nom', s.nom ? String(s.nom).toUpperCase() : ''],
    ['Prénom', s.prenom],
    ['Nom de naissance', s.sexe === 'F' && s.nom_naissance ? String(s.nom_naissance).toUpperCase() : ''],
    ['Sexe', s.sexe === 'H' ? 'Homme' : s.sexe === 'F' ? 'Femme' : ''],
    ['Date de naissance', s.ddn ? fmtDate(s.ddn) : ''],
    ['Âge', age],
    ['Lieu de naissance', s.lieu_naissance],
    ['Adresse', s.adresse ? String(s.adresse).replace(/\n+/g, ', ') : ''],
    ['Code postal', s.cp],
    ['Ville', s.ville],
    ['Téléphone', s.tel],
    ['Personne à prévenir', s.prevenir],
    ['Téléphone à prévenir', s.tel_prevenir],
  ].filter(([, v]) => !isEmpty(v)).map(([k, v]) => [k, String(v).trim()]);
}

export function identiteText(s) {
  return identiteRows(s).map(([k, v]) => `${k} : ${v}`).join('\n');
}

const victimeIntro = (s) => {
  const sexe = s.sexe === 'H' ? 'Homme' : s.sexe === 'F' ? 'Femme' : 'Victime';
  return !isEmpty(s.age) ? `${sexe} de ${s.age} ans` : sexe;
};

export function circonstancielText(s) {
  const out = [];
  const intro = victimeIntro(s);
  const histoire = (s.histoire || '').trim();
  const plainte = plainteDe(s.plainte);

  if (histoire) {
    const startsLower = /^[a-zà-ÿ]/.test(histoire);
    let first = startsLower ? `${intro} qui ${histoire}` : `${intro}. ${histoire}`;
    if (plainte) first = `${first.replace(/[.\s]+$/, '')}${startsLower ? ' et se plaint' : '. Se plaint'} ${plainte}`;
    out.push(sentence(first));
  } else if (plainte) {
    out.push(sentence(`${intro} qui se plaint ${plainte}`));
  } else if (s.sexe || !isEmpty(s.age)) {
    out.push(sentence(intro));
  }

  out.push(...fieldsLines(['lieu', 'temoins', 'danger', 'securite_ok', 'victimes', 'renfort'], s).map(sentence));
  return out.filter(Boolean).join('\n');
}

// Signes de détresse, lettre par lettre (en tête du bilan vital).
export function detresseLines(s) {
  const pos = [];
  for (const sd of SIGNES_DETRESSE) {
    const v = (s[sd.name] || []).filter((k) => k !== 'aucun');
    if (!v.length) continue;
    const signes = v.map((k) => { const o = sd.options.find((x) => x.v === k); return o ? (o.out ?? o.l) : k; });
    pos.push(`${sd.letter} – ${sd.title} : ${signes.join(', ')}`);
  }
  if (pos.length) return ['SIGNES DE DÉTRESSE :', ...pos];
  if (SIGNES_DETRESSE.every((sd) => has(s, sd.name, 'aucun'))) return ['Pas de détresse vitale'];
  return [];
}

// Constatations d'une lettre (les signes de détresse sont repris à part, en tête).
function lettreBody(g, s) {
  const sd = SIGNES_DETRESSE.find((x) => x.name === g.vital);
  const lines = expandFields(g.fields).flatMap((f) => fieldLines(f, s));
  if (has(s, sd.name, 'aucun')) lines.push(sd.none);
  return lines;
}

// Bloc d'une lettre : « B – Respiration : » puis les constatations (sur une ligne s'il n'y en a qu'une).
export function lettreLines(g, s) {
  const sd = SIGNES_DETRESSE.find((x) => x.name === g.vital);
  const lines = lettreBody(g, s);
  if (!lines.length) return [];
  const head = `${sd.letter} – ${sd.title} :`;
  return lines.length === 1 ? [`${head} ${lines[0]}`] : [head, ...lines];
}

export const LETTRES = ['x', 'a', 'b', 'c', 'd'];

export function vitalText(s) {
  const det = detresseLines(s);
  const letters = LETTRES.flatMap((id) => lettreLines(group(id), s));
  return [det, letters].filter((b) => b.length).map((b) => b.join('\n')).join('\n\n');
}

const speLabel = (s, k) => (k === 'autre' && s.spe_autre ? s.spe_autre : SPE.find((d) => d.v === k)?.l);

export function complementaireText(s) {
  const blocks = [];
  blocks.push(groupLines(group('opqrst'), s));
  if (isVisible(group('symptomes'), s)) blocks.push(groupLines(group('symptomes'), s));

  // Bilans spécifiques, dans l'ordre du schéma, pour ceux qui sont choisis.
  const selected = s.spe || [];
  for (const g of allGroups()) {
    if (!g.spe || !selected.includes(g.spe) || !isVisible(g, s)) continue;
    const lines = groupLines(g, s);
    if (lines.length && !g.heading) lines.unshift(`${speLabel(s, g.spe)} :`);
    blocks.push(lines);
  }
  blocks.push(groupLines(group('parametres'), s));
  blocks.push(groupLines(group('mhta'), s));
  return blocks.filter((b) => b.length).map((b) => b.join('\n')).join('\n\n');
}

// Tous les gestes : position, puis ceux notés à chaque lettre, puis les autres.
export function gestesLines(s) {
  const lines = [];
  const pos = optOut('position', s.position);
  if (pos) lines.push(pos);
  const add = (name) => {
    const f = getField(name);
    if (!isVisible(f, s)) return;
    for (const k of s[name] || []) {
      const o = f.options.find((x) => x.v === k);
      if (o) lines.push(typeof o.out === 'function' ? o.out(s) : (o.out ?? o.l));
    }
  };
  add('x_gestes');
  add('a_gestes');
  if (s.sat_sous === 'O2') {
    const debit = num(s.o2_debit);
    const masque = optOut('o2_masque', s.o2_masque);
    lines.push(`Oxygénothérapie${debit !== null ? ` ${debit} L/min` : ''}${masque ? ` (${masque})` : ''}`);
  }
  add('b_gestes');
  add('c_gestes');
  add('gestes');
  if (s.gestes_autre) lines.push(...String(s.gestes_autre).split(/\n+/).map((l) => l.trim()).filter(Boolean));
  return lines;
}

export function gestesText(s) {
  return gestesLines(s).join('\n');
}

// Surveillance : une ligne par série de constantes, précédée de son heure.
export function surveillanceText(s) {
  const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
  return (s.surv || []).map((e) => {
    const parts = [];
    if (filled(e.fr)) parts.push(`FR ${e.fr}`);
    if (filled(e.sat)) parts.push(`SpO2 ${e.sat} % ${e.sat_sous === 'O2' ? 'sous O2' : 'AA'}`);
    if (filled(e.fc)) parts.push(`FC ${e.fc}`);
    if (filled(e.ta)) parts.push(`TA ${e.ta}`);
    if (filled(e.gcs)) parts.push(`Glasgow ${e.gcs}`);
    if (filled(e.eva)) parts.push(`Douleur ${e.eva}/10`);
    if (filled(e.temp)) parts.push(`T° ${String(e.temp).replace('.', ',')} °C`);
    if (filled(e.gly)) parts.push(`Glycémie ${String(e.gly).replace('.', ',')} ${s.gly_unite || 'g/L'}`);
    const evo = SURV_EVOLUTION.find((o) => o.v === e.evolution)?.out;
    if (evo) parts.push(evo);
    const note = filled(e.note) ? String(e.note).trim().split(/\n+/) : [];
    if (!parts.length && !note.length) return '';
    const head = filled(e.heure) ? `${fmtTime(e.heure)} :` : 'Contrôle :';
    const lines = parts.length ? [`${head} ${parts.join(', ')}`, ...note] : [`${head} ${note[0]}`, ...note.slice(1)];
    return lines.join('\n');
  }).filter(Boolean).join('\n');
}

export function devenirText(s) {
  const lines = fieldsLines(['transmis', 'consignes', 'devenir', 'iao', 'materiel'], s);
  const horaires = [
    s.heure_depart && `Départ : ${fmtTime(s.heure_depart)}`,
    s.heure_pec && `Sur les lieux : ${fmtTime(s.heure_pec)}`,
    ...groupLines(group('horaires'), s),
  ].filter(Boolean);
  return [lines, horaires].filter((b) => b.length).map((b) => b.join('\n')).join('\n\n');
}

// Résumé court à transmettre (téléphone, radio).
export function syntheseText(s) {
  const lines = [];
  const sexe = s.sexe === 'H' ? 'Homme' : s.sexe === 'F' ? 'Femme' : '';
  const age = isEmpty(s.age) ? '' : `${s.age} ans`;
  const who = sexe && age ? `${sexe} de ${age}` : sexe || (age ? `Victime de ${age}` : '');
  const motif = (s.motif || '').trim();
  if (who || motif) lines.push([who, motif].filter(Boolean).join(' – '));
  const plainte = plainteDe(s.plainte);
  if (plainte) lines.push(`Se plaint ${plainte}`);

  const det = SIGNES_DETRESSE.filter((sd) => hasSome(s, sd.name)).map((sd) => {
    const signes = s[sd.name].filter((k) => k !== 'aucun').map((k) => { const o = sd.options.find((x) => x.v === k); return o ? (o.out ?? o.l) : k; });
    return `${sd.letter} (${signes.join(', ')})`;
  });
  if (det.length) lines.push(`Détresse ${det.join(', ')}`);
  else if (SIGNES_DETRESSE.every((sd) => has(s, sd.name, 'aucun'))) lines.push('Pas de détresse vitale');

  const t = gcsTotal(s);
  const ta = s.ta_g || s.ta_d;
  const constantes = [
    !isEmpty(s.fr) && `FR ${s.fr}`,
    !isEmpty(s.sat) && `SpO2 ${s.sat} %${s.sat_sous === 'O2' ? ' sous O2' : ''}`,
    !isEmpty(s.fc) && `FC ${s.fc}`,
    taParts(ta) && `TA ${ta}`,
    t && `Glasgow ${t}`,
    !isEmpty(s.gly) && `glycémie ${String(s.gly).replace('.', ',')} ${s.gly_unite || 'g/L'}`,
    !isEmpty(s.temp) && `T° ${String(s.temp).replace('.', ',')} °C`,
  ].filter(Boolean);
  if (constantes.length) lines.push(constantes.join(', '));

  const gestes = gestesLines(s);
  if (gestes.length) lines.push(`Gestes : ${gestes.map(lowerFirst).join(', ')}`);
  const dev = fieldLines(getField('devenir'), s);
  if (dev.length) lines.push(dev[0]);
  return lines.map(sentence).join('\n');
}

export function buildReport(s) {
  const when = [s.date_pec ? fmtDate(s.date_pec) : '', s.heure_pec ? fmtTime(s.heure_pec) : ''].filter(Boolean).join(' à ');
  const who = [s.nom ? String(s.nom).toUpperCase() : '', s.prenom].filter(Boolean).join(' ');
  const title = ['Bilan', when, who ? `– ${who}` : ''].filter(Boolean).join(' ');
  const types = (s.spe || []).map((k) => speLabel(s, k)).filter(Boolean);

  const sections = [
    { id: 'synthese', title: 'SYNTHÈSE', text: syntheseText(s) },
    { id: 'circonstanciel', title: 'CIRCONSTANCIEL', text: circonstancielText(s) },
    { id: 'vital', title: 'BILAN VITAL', text: vitalText(s) },
    { id: 'complementaire', title: 'BILAN COMPLÉMENTAIRE', text: complementaireText(s) },
    { id: 'gestes', title: 'GESTES EFFECTUÉS', text: gestesText(s) },
    { id: 'surveillance', title: 'SURVEILLANCE', text: surveillanceText(s) },
    { id: 'devenir', title: 'TRANSMISSION ET DEVENIR', text: devenirText(s) },
    { id: 'identite', title: 'IDENTITÉ', text: identiteText(s) },
  ];

  const head = [title];
  if (s.motif) head.push(`Motif : ${String(s.motif).trim()}`);
  if (s.adresse_inter) head.push(`Adresse : ${String(s.adresse_inter).trim().replace(/\n+/g, ', ')}`);
  if (types.length) head.push(`Bilan spécifique : ${types.join(', ')}`);
  const body = sections.filter((x) => x.text).map((x) => `${x.title}\n${x.text}`);
  return { title, sections, full: [head.join('\n'), ...body].join('\n\n') + '\n' };
}

// ---------------------------------------------------------------------------
// Bilan à lire au chef : un bloc par partie, dans l'ordre où on le donne
// (en bref, circonstanciel, détresses, X A B C D, complémentaire…).
// ---------------------------------------------------------------------------
export function readerBlocks(s) {
  const blocks = [];
  const add = (key, title, text, extra = {}) => {
    if (text) blocks.push({ key, title, lines: text.split('\n'), ...extra });
  };
  add('synthese', 'En bref', syntheseText(s));
  add('s', 'Circonstanciel', circonstancielText(s), { letter: 'S' });
  const det = detresseLines(s);
  if (det.length > 1) blocks.push({ key: 'detresse', title: 'Signes de détresse', lines: det.slice(1), level: 'alert' });
  else if (det.length) blocks.push({ key: 'detresse', title: det[0], lines: [], level: 'ok' });
  for (const id of LETTRES) {
    const g = group(id);
    const sd = SIGNES_DETRESSE.find((x) => x.name === g.vital);
    const lines = lettreBody(g, s);
    if (lines.length) blocks.push({ key: id, letter: sd.letter, title: sd.title, lines });
  }
  add('complementaire', 'Bilan complémentaire', complementaireText(s));
  add('gestes', 'Gestes effectués', gestesText(s));
  add('surveillance', 'Surveillance', surveillanceText(s));
  add('devenir', 'Transmission et devenir', devenirText(s));
  add('identite', 'Identité', identiteText(s));
  return blocks;
}

// ---------------------------------------------------------------------------
// Suggestions de signes de détresse à partir des mesures saisies.
// ---------------------------------------------------------------------------
export function suggestions(s) {
  const out = [];
  const fc = num(s.fc), fr = num(s.fr), sat = num(s.sat);
  const sys = [taParts(s.ta_g), taParts(s.ta_d)].filter(Boolean).map((x) => x[0]);
  const ref = taParts(s.ta_ref);
  const gcs = gcsTotal(s);

  if (fr !== null && fr <= 6) out.push({ group: 'sd_b', v: 'arret', why: `FR ${fr}` });
  else if (fr !== null && (fr > 25 || fr < 10)) out.push({ group: 'sd_b', v: 'fr', why: `FR ${fr}` });
  if (sat !== null && sat < 94) out.push({ group: 'sd_b', v: 'sat', why: `SpO2 ${sat} %` });

  if (fc !== null && (fc > 120 || fc < 50)) out.push({ group: 'sd_c', v: 'fc', why: `FC ${fc}` });
  if (sys.length && Math.min(...sys) < 90) out.push({ group: 'sd_c', v: 'ta', why: `TA syst ${Math.min(...sys)}` });
  else if (sys.length && ref && Math.min(...sys) < ref[0] * 0.7) out.push({ group: 'sd_c', v: 'ta', why: 'TA en baisse de plus de 30 %' });
  if (s.trc === 'sup') out.push({ group: 'sd_c', v: 'trc', why: 'TRC > 2 s' });

  if (gcs !== null && gcs < 15) out.push({ group: 'sd_d', v: 'glasgow', why: `Glasgow ${gcs}` });
  if (s.pci === 'oui') out.push({ group: 'sd_d', v: 'pci', why: 'Perte de connaissance' });
  if (s.ost === 'non') out.push({ group: 'sd_d', v: 'desorientation', why: 'Désorientée' });
  if (s.pupilles === 'inegales' || s.pupilles === 'areactives') out.push({ group: 'sd_d', v: 'pupilles', why: 'Pupilles' });
  if (s.fast === 'positif') {
    if (has(s, 'fast_signes', 'face')) out.push({ group: 'sd_d', v: 'asymetrie', why: 'FAST : visage' });
    if (has(s, 'fast_signes', 'bras')) out.push({ group: 'sd_d', v: 'paralysie', why: 'FAST : bras' });
    if (has(s, 'fast_signes', 'parole')) out.push({ group: 'sd_d', v: 'parole', why: 'FAST : parole' });
  }
  if (s.ms4m === 'non') {
    if (s.ms_type !== 'sensitif') out.push({ group: 'sd_d', v: 'paralysie', why: 'Déficit moteur' });
    if (s.ms_type === 'sensitif' || s.ms_type === 'both') out.push({ group: 'sd_d', v: 'sensibilite', why: 'Déficit sensitif' });
  }

  const seen = new Set();
  return out.filter((x) => {
    const key = `${x.group}:${x.v}`;
    if (seen.has(key) || has(s, x.group, x.v)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Résumé d'une victime (liste des bilans, en-tête de l'écran Bilan).
// ---------------------------------------------------------------------------
export function detresseStatus(s) {
  const pos = SIGNES_DETRESSE.filter((sd) => hasSome(s, sd.name));
  if (pos.length) return { level: 'detresse', text: `Détresse ${joinEt(pos.map((sd) => sd.letter))}` };
  if (SIGNES_DETRESSE.every((sd) => has(s, sd.name, 'aucun'))) return { level: 'ok', text: 'Pas de détresse vitale' };
  return { level: 'todo', text: 'XABCD à évaluer' };
}

export function victimSummary(s) {
  const name = [s.nom ? String(s.nom).toUpperCase() : '', s.prenom].filter(Boolean).join(' ');
  const who = [s.sexe === 'H' ? 'Homme' : s.sexe === 'F' ? 'Femme' : '', isEmpty(s.age) ? '' : `${s.age} ans`]
    .filter(Boolean).join(', ');
  const spe = (s.spe || []).map((k) => speLabel(s, k)).filter(Boolean);
  const types = spe.length ? spe : s.motif ? [String(s.motif).trim()] : [];
  const heure = s.heure_pec || s.heure_depart;
  return { name, who, heure: heure ? fmtTime(heure) : '', types };
}

// ---------------------------------------------------------------------------
// Saisie d'une tension : « 13287 » → « 132/87 ». La barre est ajoutée dès que la
// systolique est complète : 3 chiffres si elle commence par 1 ou 2, sinon 2.
// En effaçant, la barre n'est pas remise aussitôt.
// ---------------------------------------------------------------------------
export function formatTA(raw, deleting = false) {
  const s = String(raw ?? '');
  const [a, ...rest] = s.split('/');
  const sys = a.replace(/\D/g, '');
  // Barre déjà présente après la systolique (ajoutée ou tapée) : on la garde.
  if (rest.length && sys) return `${sys.slice(0, 3)}/${rest.join('').replace(/\D/g, '').slice(0, 3)}`;
  // Sinon (pas de barre, ou barre mal placée) : on repart des seuls chiffres.
  const d = s.replace(/\D/g, '');
  const sysLen = /^[12]/.test(d) ? 3 : 2;
  if (d.length < sysLen) return d;
  if (d.length === sysLen) return deleting ? d : `${d}/`;
  return `${d.slice(0, sysLen)}/${d.slice(sysLen, sysLen + 3)}`;
}
